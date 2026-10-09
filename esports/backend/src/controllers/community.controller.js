import mongoose from 'mongoose'
import { Community } from '../models/Community.js'
import { CommunityPost } from '../models/CommunityPost.js'
import { User } from '../models/User.js'
import { escapeRegex } from '../utils/regex.js'
import { getCountryNumber } from '../config/countries.js'

const MAX_TAGS = 10

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}

const cleanStr = (v, max) => String(v ?? '').trim().slice(0, max)
const cleanList = (v, max, itemMax) => (Array.isArray(v) ? v : [])
  .map(x => cleanStr(x, itemMax)).filter(Boolean).slice(0, max)

// Campos de presentación que manda CommunityCreate (logo, banner, enlaces,
// reglas, staff...). Antes create/update solo guardaban name/game/description/
// tags/privacy y todo lo demás del formulario se perdía al guardar.
function pickCommunityProfile(body = {}) {
  const out = {}
  for (const key of ['region', 'lang', 'audience', 'whoPublishes']) {
    if (body[key] !== undefined) out[key] = cleanStr(body[key], 60)
  }
  for (const key of ['logo', 'banner', 'video', 'rulesPdf']) {
    if (body[key] !== undefined) out[key] = cleanStr(body[key], 2048)
  }
  for (const key of ['allowed', 'notAllowed', 'banned']) {
    if (body[key] !== undefined) out[key] = cleanStr(body[key], 1000)
  }
  for (const key of ['color', 'accent']) {
    if (body[key] !== undefined) out[key] = /^#[0-9a-f]{3,8}$/i.test(String(body[key])) ? String(body[key]) : ''
  }
  if (body.games !== undefined) out.games = cleanList(body.games, 12, 60)
  if (body.rules !== undefined) out.rules = cleanList(body.rules, 30, 300)
  if (body.links !== undefined && body.links && typeof body.links === 'object' && !Array.isArray(body.links)) {
    out.links = Object.fromEntries(Object.entries(body.links)
      .slice(0, 20)
      .map(([k, v]) => [cleanStr(k, 30), cleanStr(v, 500)])
      // Solo http(s): un "javascript:" en un enlace público es XSS al hacer clic.
      .filter(([k, v]) => k && /^https?:\/\//i.test(v)))
  }
  if (body.gallery !== undefined) {
    out.gallery = (Array.isArray(body.gallery) ? body.gallery : []).slice(0, 12).map(item => ({
      url: cleanStr(item?.url, 2048),
      type: item?.type === 'video' ? 'video' : 'image',
      title: cleanStr(item?.title, 120),
    })).filter(item => item.url)
  }
  // El formulario lo llama `team`; en el modelo es `staff`.
  const team = body.team !== undefined ? body.team : body.staff
  if (team !== undefined) {
    out.staff = (Array.isArray(team) ? team : []).slice(0, 30).map(t => ({
      role: cleanStr(t?.role, 40) || 'Moderador',
      username: cleanStr(t?.username, 60),
    })).filter(t => t.username)
  }
  if (body.features !== undefined && body.features && typeof body.features === 'object') {
    out.features = Object.fromEntries(Object.entries(body.features).slice(0, 20).map(([k, v]) => [cleanStr(k, 40), Boolean(v)]))
  }
  return out
}

function decorate(c, userId) {
  return {
    ...c,
    memberCount: (c.members || []).length,
    joined: !!userId && (c.members || []).some(id => String(id) === String(userId)),
  }
}

/** Carga la comunidad y verifica que quien pide sea su creador (o un admin de la plataforma); responde 404/403 si no. */
async function requireOwnedCommunity(req, res) {
  const community = await Community.findById(req.params.id)
  if (!community) {
    res.status(404).json({ message: 'Comunidad no encontrada.' })
    return null
  }
  const isOwner = String(community.creator) === String(req.user._id)
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403).json({ message: 'Solo el creador puede gestionar esta comunidad.' })
    return null
  }
  return community
}

/** GET /communities — listado; las privadas solo se muestran a sus propios miembros. */
export async function listCommunities(req, res, next) {
  try {
    const { game, tag, search, official, page = 1 } = req.query
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    // Las comunidades oficiales del catálogo por juego (sembradas aparte,
    // ver seed-official-communities.js) tienen su propia vitrina en
    // /comunidad/:game -- por defecto no se listan junto a las creadas por
    // jugadores; ?official=true las trae a ellas exclusivamente (lo usa el
    // hub para saber el estado real de "unido" de cada una).
    const filter = official === 'true' ? { official: true } : { official: { $ne: true } }
    if (game) filter.game = game
    if (tag) filter.tags = tag
    if (search) filter.name = { $regex: escapeRegex(String(search).trim().slice(0, 80)), $options: 'i' }

    filter.$or = req.user
      ? [{ privacy: 'public' }, { members: req.user._id }]
      : [{ privacy: 'public' }]

    const communities = await Community.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * limit)
      .limit(limit)
      .populate('creator', 'nick avatar')
      .lean()

    const total = await Community.countDocuments(filter)
    res.json({
      communities: communities.map(c => decorate(c, req.user?._id)),
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    })
  } catch (err) { next(err) }
}

/** GET /communities/mine — comunidades que yo creé (para el panel de gestión). */
export async function getMyCommunities(req, res, next) {
  try {
    const communities = await Community.find({ creator: req.user._id, official: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ communities: communities.map(c => decorate(c, req.user._id)) })
  } catch (err) { next(err) }
}

/** GET /communities/:id — detalle por _id o slug; una privada solo es visible para sus miembros. */
export async function getCommunityDetail(req, res, next) {
  try {
    const { id } = req.params
    const query = mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { slug: id }] } : { slug: id }
    const community = await Community.findOne(query).populate('creator', 'nick avatar').lean()
    if (!community) return res.status(404).json({ message: 'Comunidad no encontrada.' })

    const isMember = !!req.user && community.members.some(m => String(m) === String(req.user._id))
    if (community.privacy === 'private' && !isMember) {
      return res.status(403).json({ message: 'Esta comunidad es privada.' })
    }

    res.json({ community: decorate(community, req.user?._id) })
  } catch (err) { next(err) }
}

/** POST /communities — crear una comunidad. El creador queda unido automáticamente. */
export async function createCommunity(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim()
    if (name.length < 2) return res.status(400).json({ message: 'El nombre debe tener al menos 2 caracteres.' })

    const profile = pickCommunityProfile(req.body || {})
    // El formulario manda `games` (lista); `game` queda como el principal.
    const game = String(req.body?.game || profile.games?.[0] || '').trim().slice(0, 60)
    const description = String(req.body?.description || '').trim().slice(0, 1000)
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map(t => String(t).trim()).filter(Boolean).slice(0, MAX_TAGS)
      : String(req.body?.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, MAX_TAGS)
    const privacy = req.body?.privacy === 'private' ? 'private' : 'public'

    let slug = slugify(name) || `comunidad-${Date.now()}`
    const exists = await Community.findOne({ slug })
    if (exists) slug = `${slug}-${Date.now()}`

    const community = await Community.create({
      ...profile,
      name, slug, game, description, tags, privacy,
      publicCode: await nextCommunityCode(req.user),
      creator: req.user._id, owner: req.user._id, members: [req.user._id],
    })

    res.status(201).json({ community: decorate(community.toObject(), req.user._id) })
  } catch (err) { next(err) }
}

/** POST /communities/:id/join — unirse a una comunidad pública. */
export async function joinCommunity(req, res, next) {
  try {
    const community = await Community.findById(req.params.id)
    if (!community) return res.status(404).json({ message: 'Comunidad no encontrada.' })
    if (community.privacy === 'private') return res.status(403).json({ message: 'Esta comunidad es privada.' })

    const isBanned = (community.bannedMembers || []).some(id => String(id) === String(req.user._id))
    if (isBanned) return res.status(403).json({ message: 'Fuiste expulsado de esta comunidad y no puedes volver a unirte.' })

    const already = community.members.some(id => String(id) === String(req.user._id))
    if (already) return res.status(400).json({ message: 'Ya eres miembro de esta comunidad.' })

    await Community.updateOne({ _id: community._id }, { $addToSet: { members: req.user._id } })
    res.json({ memberCount: community.members.length + 1, joined: true })
  } catch (err) { next(err) }
}

/** POST /communities/:id/leave — abandonar una comunidad. El creador no puede (debe borrarla). */
export async function leaveCommunity(req, res, next) {
  try {
    const community = await Community.findById(req.params.id).select('members creator')
    if (!community) return res.status(404).json({ message: 'Comunidad no encontrada.' })

    if (String(community.creator) === String(req.user._id)) {
      return res.status(400).json({ message: 'El creador no puede abandonar su propia comunidad.' })
    }

    const isMember = community.members.some(id => String(id) === String(req.user._id))
    if (!isMember) return res.status(400).json({ message: 'No eres miembro de esta comunidad.' })

    await Community.updateOne({ _id: community._id }, { $pull: { members: req.user._id } })
    res.json({ memberCount: community.members.length - 1, joined: false })
  } catch (err) { next(err) }
}

/** PUT /communities/:id — editar una comunidad (solo su creador). */
export async function updateCommunity(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim()
      if (name.length < 2) return res.status(400).json({ message: 'El nombre debe tener al menos 2 caracteres.' })
      community.name = name
    }
    const profile = pickCommunityProfile(req.body || {})
    community.set(profile)
    if (req.body?.game !== undefined) community.game = String(req.body.game).trim().slice(0, 60)
    else if (profile.games?.length) community.game = profile.games[0]
    if (req.body?.description !== undefined) community.description = String(req.body.description).trim().slice(0, 1000)
    if (!community.publicCode) community.publicCode = await nextCommunityCode(req.user)
    if (req.body?.tags !== undefined) {
      community.tags = Array.isArray(req.body.tags)
        ? req.body.tags.map(t => String(t).trim()).filter(Boolean).slice(0, MAX_TAGS)
        : String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean).slice(0, MAX_TAGS)
    }
    if (req.body?.privacy !== undefined) community.privacy = req.body.privacy === 'private' ? 'private' : 'public'

    await community.save()
    res.json({ community: decorate(community.toObject(), req.user._id) })
  } catch (err) { next(err) }
}

/** GET /communities/:id/members — lista de miembros con nick/avatar (solo el creador). */
export async function listCommunityMembers(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    await community.populate('members', 'nick avatar')
    const members = community.members.map(m => ({
      _id: m._id,
      nick: m.nick,
      avatar: m.avatar,
      isCreator: String(m._id) === String(community.creator),
    }))
    res.json({ members })
  } catch (err) { next(err) }
}

/**
 * DELETE /communities/:id/members/:userId — expulsar a un miembro (solo el
 * creador; no puede expulsarse a sí mismo). El expulsado queda además
 * baneado -- si no, en una comunidad pública podía volver a unirse al toque.
 */
export async function removeCommunityMember(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    if (String(req.params.userId) === String(community.creator)) {
      return res.status(400).json({ message: 'No puedes expulsarte a ti mismo. Para cerrar la comunidad, bórrala.' })
    }

    await Community.updateOne(
      { _id: community._id },
      { $pull: { members: req.params.userId }, $addToSet: { bannedMembers: req.params.userId } },
    )
    res.json({ ok: true })
  } catch (err) { next(err) }
}

/** GET /communities/:id/bans — lista de miembros baneados, con nick/avatar (solo el creador/admin). */
export async function listCommunityBans(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    await community.populate('bannedMembers', 'nick avatar')
    res.json({ bans: community.bannedMembers.map(u => ({ _id: u._id, nick: u.nick, avatar: u.avatar })) })
  } catch (err) { next(err) }
}

/** DELETE /communities/:id/bans/:userId — desbanear (solo el creador/admin). No los une de nuevo, solo les permite volver a intentarlo. */
export async function unbanCommunityMember(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    await Community.updateOne({ _id: community._id }, { $pull: { bannedMembers: req.params.userId } })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

/**
 * POST /communities/:id/transfer — transferir la propiedad a otro miembro
 * (solo el creador/admin actual). El nuevo dueño debe ya ser miembro; el
 * viejo dueño queda como miembro regular (puede irse después si quiere).
 */
export async function transferOwnership(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    const newOwnerId = String(req.body?.userId || '')
    if (!mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return res.status(400).json({ message: 'Selecciona un miembro válido.' })
    }
    if (newOwnerId === String(community.creator)) {
      return res.status(400).json({ message: 'Ya eres el dueño de esta comunidad.' })
    }
    const isMember = community.members.some(id => String(id) === newOwnerId)
    if (!isMember) return res.status(400).json({ message: 'Solo puedes transferir la propiedad a un miembro actual.' })

    community.creator = newOwnerId
    await community.save()
    res.json({ community: decorate(community.toObject(), req.user._id) })
  } catch (err) { next(err) }
}

/** DELETE /communities/:id — borrar una comunidad y sus publicaciones (solo el creador/admin). */
export async function deleteCommunity(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    await Promise.all([
      CommunityPost.deleteMany({ communityId: community._id }),
      Community.deleteOne({ _id: community._id }),
    ])
    res.json({ ok: true })
  } catch (err) { next(err) }
}

/** GET /communities/:id/stats — métricas reales para el panel de gestión (solo el creador). */
export async function getCommunityStats(req, res, next) {
  try {
    const community = await requireOwnedCommunity(req, res)
    if (!community) return

    const [postsCount, upcomingEventsCount, topMembersAgg] = await Promise.all([
      CommunityPost.countDocuments({ communityId: community._id }),
      CommunityPost.countDocuments({ communityId: community._id, kind: 'event', eventDate: { $gte: new Date() } }),
      CommunityPost.aggregate([
        { $match: { communityId: community._id } },
        { $group: { _id: '$author', postsCount: { $sum: 1 } } },
        { $sort: { postsCount: -1 } },
        { $limit: 5 },
      ]),
    ])

    const users = await User.find({ _id: { $in: topMembersAgg.map(m => m._id) } }).select('nick avatar').lean()
    const userMap = new Map(users.map(u => [String(u._id), u]))
    const topMembers = topMembersAgg.map(m => ({
      _id: m._id,
      postsCount: m.postsCount,
      nick: userMap.get(String(m._id))?.nick || 'Usuario',
      avatar: userMap.get(String(m._id))?.avatar || '',
    }))

    res.json({ memberCount: community.members.length, postsCount, upcomingEventsCount, topMembers })
  } catch (err) { next(err) }
}

// --- Catalogo (admin): helpers propios, campos distintos a los de arriba
// (games[], audience, whoPublishes, gallery, links, rules, features, staff) --
// feature separada de "mis comunidades" (arriba), gestiona el catalogo oficial.
const clean = (value, max = 500) => String(value || '').trim().slice(0, max)
const catalogSlugify = (value) => clean(value, 90)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || `comunidad-${Date.now()}`

function sanitizeCode(value = 'USER') {
  return String(value || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'USER'
}

async function nextCommunityCode(user) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const country = getCountryNumber(user?.countryCode || 'RD') || '01'
  const prefix = `COM-${sanitizeCode(user?.nick || user?.playerCode || 'USER')}-${yy}${mm}${dd}`
  const count = await Community.countDocuments({ publicCode: new RegExp(`^${prefix}-`) })
  return `${prefix}-${String(count + 1).padStart(4, '0')}-${country}`
}

function mapUser(user) {
  if (!user) return null
  return {
    id: String(user._id || user),
    nick: user.nick || '',
    email: user.email || '',
    playerCode: user.playerCode || '',
    avatar: user.avatar || '',
    countryCode: user.countryCode || '',
  }
}

function mapCommunity(doc) {
  const c = typeof doc.toObject === 'function' ? doc.toObject() : doc
  const owner = c.owner && typeof c.owner === 'object' ? mapUser(c.owner) : null
  const members = Array.isArray(c.members) ? c.members : []
  const moderators = Array.isArray(c.moderators) ? c.moderators : []
  return {
    id: String(c._id),
    _id: String(c._id),
    publicId: c.publicCode || '',
    publicCode: c.publicCode || '',
    slug: c.slug || '',
    name: c.name || '',
    game: c.game || '',
    games: c.games || [],
    region: c.region || '',
    lang: c.lang || '',
    audience: c.audience || '',
    whoPublishes: c.whoPublishes || '',
    description: c.description || '',
    logo: c.logo || '',
    banner: c.banner || '',
    video: c.video || '',
    gallery: Array.isArray(c.gallery) ? c.gallery : [],
    poster: c.banner || '',
    color: c.color || c.accent || '',
    accent: c.accent || c.color || '',
    links: c.links || {},
    rules: c.rules || [],
    rulesPdf: c.rulesPdf || '',
    allowed: c.allowed || '',
    notAllowed: c.notAllowed || '',
    banned: c.banned || '',
    features: c.features || {},
    partnerBadge: c.partnerBadge || { active: false, label: 'GlitchGang Partner', status: 'none', reason: '' },
    team: c.staff || [],
    staff: c.staff || [],
    owner,
    ownerName: owner?.nick || 'Sin dueño',
    ownerEmail: owner?.email || '',
    members: members.length,
    memberIds: members.map(item => String(item._id || item)),
    moderators: moderators.map(item => typeof item === 'object' ? mapUser(item) : { id: String(item) }),
    status: c.status || 'active',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

function payloadFromBody(body = {}) {
  const games = Array.isArray(body.games) ? body.games.map(item => clean(item, 80)).filter(Boolean) : []
  const links = body.links && typeof body.links === 'object' ? body.links : {}
  const features = body.features && typeof body.features === 'object' ? body.features : {}
  const gallery = Array.isArray(body.gallery)
    ? body.gallery.map(item => ({
        url: clean(item.url, 180000),
        type: item.type === 'video' ? 'video' : 'image',
        title: clean(item.title, 120),
      })).filter(item => item.url)
    : []
  const staff = Array.isArray(body.team || body.staff)
    ? (body.team || body.staff).map(item => ({
        role: clean(item.role, 50) || 'Moderador',
        username: clean(item.username, 80),
      })).filter(item => item.username)
    : []

  return {
    name: clean(body.name, 120),
    slug: body.slug ? catalogSlugify(body.slug) : catalogSlugify(body.name),
    game: clean(body.game || games[0] || '', 80),
    games,
    region: clean(body.region, 80),
    lang: clean(body.lang || 'Español', 40),
    audience: clean(body.audience || 'Mixto', 40),
    whoPublishes: clean(body.whoPublishes || 'Todos', 60),
    description: clean(body.description, 500),
    logo: clean(body.logo, 120000),
    banner: clean(body.banner, 180000),
    video: clean(body.video, 180000),
    gallery,
    color: clean(body.color || body.accent, 40),
    accent: clean(body.accent || body.color, 40),
    links,
    rules: Array.isArray(body.rules) ? body.rules.map(item => clean(item, 220)).filter(Boolean) : [],
    rulesPdf: clean(body.rulesPdf, 180),
    allowed: clean(body.allowed, 500),
    notAllowed: clean(body.notAllowed, 500),
    banned: clean(body.banned, 500),
    features,
    staff,
  }
}

function communityLookup(id) {
  const raw = String(id || '').trim()
  if (!raw) return { _id: null }
  if (raw.startsWith('COM-')) return { publicCode: raw.toUpperCase() }
  if (raw.length === 24) return { _id: raw }
  return { slug: raw.toLowerCase() }
}

function canManageCommunity(community, user) {
  const userId = String(user?._id || '')
  if (!userId) return false
  const role = String(user?.role || '').toLowerCase()
  const roles = Array.isArray(user?.roles) ? user.roles.map(item => String(item).toLowerCase()) : []
  if (role === 'admin' || roles.includes('admin')) return true
  const ownerId = String(community?.owner?._id || community?.owner || '')
  return ownerId === userId
}

export async function listPublicCommunities(req, res, next) {
  try {
    const filter = { status: 'active' }
    if (req.query?.game) filter.game = clean(req.query.game, 80)
    if (req.query?.region) filter.region = clean(req.query.region, 80)

    const rows = await Community.find(filter)
      .populate('owner', 'nick email avatar playerCode countryCode')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean()
    res.json({ communities: rows.map(mapCommunity) })
  } catch (error) {
    next(error)
  }
}

export async function getCommunity(req, res, next) {
  try {
    const row = await Community.findOne(communityLookup(req.params.id))
      .populate('owner', 'nick email avatar playerCode countryCode')
      .populate('moderators', 'nick email avatar playerCode countryCode')
      .lean()
    if (!row) return res.status(404).json({ message: 'Comunidad no encontrada' })
    res.json({ community: mapCommunity(row) })
  } catch (error) {
    next(error)
  }
}

export async function adminListCommunities(_req, res, next) {
  try {
    const rows = await Community.find({})
      .populate('owner', 'nick email avatar playerCode countryCode')
      .sort({ updatedAt: -1 })
      .lean()
    const communities = rows.map(mapCommunity)
    res.json({
      communities,
      summary: {
        total: communities.length,
        active: communities.filter(item => item.status === 'active').length,
        paused: communities.filter(item => item.status === 'paused').length,
        archived: communities.filter(item => item.status === 'archived').length,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function adminUpdateCommunity(req, res, next) {
  try {
    const allowed = ['status', 'name', 'game', 'games', 'description', 'region', 'lang', 'audience', 'whoPublishes', 'logo', 'banner', 'video', 'gallery', 'color', 'accent', 'links', 'rules', 'allowed', 'notAllowed', 'banned', 'features', 'staff', 'partnerBadge']
    const patch = {}
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key]
    }
    if (patch.partnerBadge) {
      patch.partnerBadge = {
        active: Boolean(patch.partnerBadge.active),
        label: clean(patch.partnerBadge.label || 'GlitchGang Partner', 80) || 'GlitchGang Partner',
        status: ['none', 'pending', 'verified', 'revoked'].includes(patch.partnerBadge.status) ? patch.partnerBadge.status : (patch.partnerBadge.active ? 'verified' : 'revoked'),
        reason: clean(patch.partnerBadge.reason, 260),
        verifiedAt: patch.partnerBadge.active ? new Date() : (patch.partnerBadge.verifiedAt || null),
        revokedAt: patch.partnerBadge.active ? null : new Date(),
        updatedBy: req.user?._id || null,
      }
    }
    if (patch.name && !patch.slug) patch.slug = catalogSlugify(patch.name)
    const row = await Community.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true })
      .populate('owner', 'nick email avatar playerCode countryCode')
      .lean()
    if (!row) return res.status(404).json({ message: 'Comunidad no encontrada' })
    res.json({ community: mapCommunity(row) })
  } catch (error) {
    next(error)
  }
}

export async function adminCreateCatalogCommunity(req, res, next) {
  try {
    const payload = payloadFromBody(req.body)
    if (!payload.name) return res.status(400).json({ message: 'Nombre de comunidad requerido' })
    if (!payload.description) payload.description = `${payload.name} tiene un espacio dedicado para jugadores, equipos, torneos y anuncios dentro de GlitchGang.`

    const slug = payload.slug || catalogSlugify(payload.name)
    const existing = await Community.findOne({ $or: [{ slug }, { name: payload.name }] })
      .populate('owner', 'nick email avatar playerCode countryCode')
      .lean()
    if (existing) return res.json({ community: mapCommunity(existing), existed: true })

    const publicCode = clean(req.body.publicCode || req.body.publicId, 80).toUpperCase() || await nextCommunityCode(req.user)
    const doc = await Community.create({
      ...payload,
      slug,
      publicCode,
      owner: req.user?._id || null,
      members: req.user?._id ? [req.user._id] : [],
      status: 'active',
    })
    const row = await Community.findById(doc._id).populate('owner', 'nick email avatar playerCode countryCode').lean()
    res.status(201).json({ community: mapCommunity(row) })
  } catch (error) {
    if (error?.code === 11000) {
      error.status = 409
      error.message = 'Ya existe una comunidad con ese nombre o slug'
    }
    next(error)
  }
}

export async function adminDeleteCommunity(req, res, next) {
  try {
    const row = await Community.findByIdAndDelete(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Comunidad no encontrada' })
    res.json({ ok: true, deletedId: String(row._id) })
  } catch (error) {
    next(error)
  }
}
