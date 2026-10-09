import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { teamGenderKey } from '../../../shared/teamEligibility.mjs'
import { Tournament } from '../models/Tournament.js'
import { sanitizeUserIdentityPayload } from '../services/identityPayload.service.js'
import { getOrCreateReferralCode } from '../services/codes.service.js'
import { sendNotif } from '../services/notifications.service.js'
import { isBlockedEitherWay, hasBlocked, breakUserRelations } from '../services/blocks.service.js'
import { createSystemTicketRecord, appendUserTicketReply } from '../services/systemTickets.service.js'
import { SystemTicket } from '../models/SystemTicket.js'
import { checkEquipUpdates, getCosmeticGrants, syncCosmetics } from '../services/cosmetics.service.js'
import { checkGameAccountId } from '../../../shared/gameAccountIds.mjs'
import { gameName } from '../../../shared/games.mjs'
import { publicPresence, withPublicPresence } from '../../../shared/presence.mjs'
import { refreshPresence } from '../realtime/messagesRealtime.js'

const PUBLIC_FIELDS = 'playerCode internalCode nick firstName lastName countryCode region phoneCountryDial phoneNumber birthDate gender games experienceLevel mainPlatform lookingFor bio banner avatar status plan gp role roles roleProfiles team createdAt activeFrame activeBg activeStatus activeBadge activeCustomBg activeCardDesign activeCardBg activeCardCustomBg cosmeticGrants titles showcaseCards website social gamerProfile privacy languages followers friends friendRequests blockedUsers'
const USER_REPORT_REASONS = new Set(['spam', 'acoso', 'suplantacion', 'contenido_inapropiado', 'trampas', 'nombre_ofensivo', 'otro'])
const USER_REPORT_LABELS = {
  spam: 'spam',
  acoso: 'acoso',
  suplantacion: 'suplantacion',
  contenido_inapropiado: 'contenido inapropiado',
  trampas: 'trampas',
  nombre_ofensivo: 'nombre ofensivo',
  otro: 'otro',
}

function sameId(a, b) {
  if (!a || !b) return false
  return String(a._id || a) === String(b._id || b)
}

export function canViewByVisibility(profile, viewer, visibility = 'public') {
  if (sameId(profile._id, viewer?._id)) return true
  if (visibility === 'public') return true
  if (!viewer?._id || visibility === 'nobody') return false
  if (visibility === 'friends') return (profile.friends || []).some(id => sameId(id, viewer._id))
  if (visibility === 'followers') return (profile.followers || []).some(id => sameId(id, viewer._id))
  return true
}

export function canViewPrivateProfile(profile, viewer) {
  if (sameId(profile._id, viewer?._id)) return true
  return viewer?.role === 'admin' || viewer?.isAdmin
}

export function applyProfilePrivacy(profile, viewer) {
  const user = { ...profile }
  const privacy = user.privacy || {}
  const privileged = canViewPrivateProfile(user, viewer)
  const privateSections = {}

  // Presencia (shared/presence.mjs): todos reciben `presence`/`online` ya
  // resueltos; el estado elegido crudo (que puede ser "Invisible") solo el dueno.
  Object.assign(user, publicPresence(profile))
  if (!viewer || String(viewer._id || viewer.id) !== String(profile._id)) delete user.activeStatus
  if (Array.isArray(user.friends)) user.friends = user.friends.map(friend => (friend && typeof friend === 'object' && friend.nick ? withPublicPresence(friend) : friend))

  if (!canViewByVisibility(user, viewer, privacy.personalVisibility)) {
    privateSections.personal = true
    delete user.firstName
    delete user.lastName
    delete user.birthDate
    delete user.gender
    delete user.languages
    delete user.countryCode
    delete user.bio
  }

  if (privacy.showStats === false || !canViewByVisibility(user, viewer, privacy.statsVisibility)) {
    privateSections.stats = true
    delete user.gp
    delete user.experienceLevel
    delete user.lookingFor
  }

  if (privacy.showGames === false || !canViewByVisibility(user, viewer, privacy.gamesVisibility)) {
    privateSections.games = true
    delete user.games
    delete user.gamerProfile
    delete user.mainPlatform
  }

  if (!canViewByVisibility(user, viewer, privacy.socialVisibility)) {
    privateSections.social = true
    delete user.social
    delete user.website
    delete user.phoneCountryDial
    delete user.phoneNumber
  }

  if (!canViewByVisibility(user, viewer, privacy.teamsVisibility)) {
    privateSections.teams = true
  }

  if (!canViewByVisibility(user, viewer, privacy.tournamentsVisibility)) {
    privateSections.tournaments = true
  }

  if (!privileged) {
    // Teléfono y fecha de nacimiento nunca son públicos (antes, con la
    // visibilidad por defecto 'public', cualquiera -- sin sesión -- podía
    // recolectar teléfono y edad de todos, menores incluidos).
    delete user.phoneCountryDial
    delete user.phoneNumber
    delete user.birthDate
    delete user.friends
    delete user.privacy
    if (Object.keys(privateSections).length) user.privateSections = privateSections
    // Discord/WhatsApp/red del perfil profesional: solo el dueno (los equipos lo
    // reciben en la solicitud de union, no en el perfil publico).
    if (user.gamerProfile?.pro?.contact) {
      user.gamerProfile = { ...user.gamerProfile, pro: { ...user.gamerProfile.pro } }
      delete user.gamerProfile.pro.contact
    }
  }
  if (!sameId(user._id, viewer?._id)) {
    delete user.friendRequests
    delete user.blockedUsers
  }
  return user
}

function normalizeProfileUpdates(updates) {
  const next = { ...updates }

  if (typeof next.nick === 'string') next.nick = next.nick.trim()
  if (typeof next.firstName === 'string') next.firstName = next.firstName.trim()
  if (typeof next.lastName === 'string') next.lastName = next.lastName.trim()
  if (typeof next.countryCode === 'string') next.countryCode = next.countryCode.trim().toUpperCase()
  if (typeof next.region === 'string') next.region = next.region.trim().toUpperCase()
  if (next.countryCode && !next.region) next.region = next.countryCode
  if (Array.isArray(next.languages)) {
    next.languages = [...new Set(next.languages.map(item => String(item || '').trim().toLowerCase()).filter(Boolean))]
  }
  if (Array.isArray(next.games)) {
    next.games = [...new Set(next.games.map(item => String(item || '').trim()).filter(Boolean))]
  }
  if (Array.isArray(next.lookingFor)) {
    next.lookingFor = [...new Set(next.lookingFor.map(item => String(item || '').trim()).filter(Boolean))]
  }
  if (next.social && typeof next.social === 'object') {
    next.social = Object.fromEntries(
      Object.entries(next.social).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    )
  }
  if (next.gamerProfile && typeof next.gamerProfile === 'object') {
    next.gamerProfile = { ...next.gamerProfile }
    // El perfil profesional de jugador es un objeto libre: solo se acepta un objeto
    // plano de tamano razonable.
    if (next.gamerProfile.pro !== undefined) {
      const r = next.gamerProfile.pro
      const ok = r && typeof r === 'object' && !Array.isArray(r) && JSON.stringify(r).length <= 8000
      if (!ok) delete next.gamerProfile.pro
      // ID de cuenta por juego (Riot ID, BattleTag, UID...): se normaliza y se
      // rechaza el que tiene un formato imposible para su juego.
      else if (Array.isArray(r.entries)) {
        next.gamerProfile.pro = {
          ...r,
          entries: r.entries.map((entry) => {
            if (!entry || typeof entry !== 'object' || !entry.accountId) return entry
            const check = checkGameAccountId(entry.gameId, entry.accountId)
            if (!check.ok && check.strict) {
              throw Object.assign(new Error(`${gameName(entry.gameId) || entry.gameId}: ${check.message}`), { status: 400 })
            }
            return { ...entry, accountId: check.value.slice(0, 60) }
          }),
        }
      }
    }
    if (Array.isArray(next.gamerProfile.mainCharacters)) {
      next.gamerProfile.mainCharacters = [
        ...new Set(next.gamerProfile.mainCharacters.map(item => String(item || '').trim()).filter(Boolean)),
      ]
    }
  }

  return next
}

// Mismos ids que profileFields+experienceFields por rol en
// frontend/src/data/roleApplications.js (no se puede importar ese archivo
// desde el backend, es frontend/src/data -- se mantienen a mano en
// paralelo). 'coach' suma 'focus'/'methodology': 2 campos propios del panel
// de Coach que no vienen del formulario de solicitud original pero se
// editan en la misma pantalla de "perfil profesional".
const PROFESSIONAL_PROFILE_FIELDS = Object.freeze({
  organizer: ['orgName', 'eventType', 'website', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'photo'],
  creator: ['creatorName', 'mainPlatform', 'portfolio', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'photo'],
  coach: ['coachName', 'mainGame', 'availability', 'rate', 'website', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'focus', 'methodology', 'photo'],
  caster: ['casterName', 'mainGame', 'languages', 'availability', 'rate', 'website', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'photo'],
  analyst: ['analystName', 'specialty', 'availability', 'rate', 'website', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'photo'],
  moderator: ['moderatorName', 'specialty', 'mainGame', 'languages', 'availability', 'rate', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'photo', 'website'],
  sponsor: ['companyName', 'industry', 'website', 'yearsExp', 'maxSize', 'toolsUsed', 'descComplex', 'photo'],
})

// `role` es explicito (req.body.role), no se asume mas de req.user.role --
// una cuenta puede tener varios roles especializados aprobados (roles[]) y
// user.role es un solo valor, no necesariamente el que se esta editando en
// este momento (ver BACKEND-PENDIENTE.md #role-pisado-por-brand para otro
// bug de la misma familia). Solo se acepta si el rol pedido esta realmente
// aprobado para este usuario.
function normalizeProfessionalProfile(user, role, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const allowed = PROFESSIONAL_PROFILE_FIELDS[role] || []
  if (!allowed.length) return null
  if (!user.roleProfiles?.[role]?.approvedAt) return null

  return Object.fromEntries(
    allowed
      .filter(key => value[key] !== undefined)
      .map(key => [key, String(value[key] || '').trim().slice(0, 500)]),
  )
}

const STAFF_ROLES = ['organizer', 'creator', 'coach', 'caster', 'analyst', 'moderator', 'sponsor']
const STAFF_CODE_FIELD = Object.freeze({
  organizer: 'organizerCode',
  creator: 'creatorCode',
  coach: 'coachCode',
  caster: 'casterCode',
  analyst: 'analystCode',
  moderator: 'moderatorCode',
  sponsor: 'sponsorCode',
})

/** GET /api/profile/staff?role=coach,analyst&q=nick — busca staff aprobado por rol. */
export async function searchStaffByRole(req, res, next) {
  try {
    const roles = String(req.query.role || '')
      .split(',')
      .map(r => r.trim())
      .filter(r => STAFF_ROLES.includes(r))
    if (!roles.length) return res.status(400).json({ message: 'role query param is required' })

    const { q } = req.query
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1)
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit)) || 20))
    const filter = { roles: { $in: roles } }
    if (q?.trim()) {
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.nick = new RegExp(safe, 'i')
    }

    const users = await User.find(filter)
      .sort({ nick: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('nick avatar playerCode countryCode region roles roleProfiles team')
      .populate('team', 'name tag color logo')
      .lean()

    const total = await User.countDocuments(filter)

    // Historial de torneos como staff: auto-calculado (no editable), pedido
    // por Stephanie -- antes GET /profile/staff no lo devolvia en absoluto,
    // aunque el frontend (RoleStaffSearch.jsx) ya estaba preparado para
    // mostrar `acceptedTournamentsCount` en cuanto llegara. Una sola
    // agregacion para toda la pagina de resultados, no una query por persona.
    const userIds = users.map(u => u._id)
    const counts = userIds.length
      ? await Tournament.aggregate([
        { $unwind: '$staffMembers' },
        { $match: { 'staffMembers.user': { $in: userIds }, 'staffMembers.status': 'accepted' } },
        { $group: { _id: '$staffMembers.user', count: { $sum: 1 } } },
      ])
      : []
    const countByUser = new Map(counts.map(c => [String(c._id), c.count]))

    const staff = users.map(u => ({
      id: u._id,
      nick: u.nick,
      avatar: u.avatar,
      playerCode: u.playerCode,
      countryCode: u.countryCode,
      region: u.region || u.countryCode,
      team: u.team,
      acceptedTournamentsCount: countByUser.get(String(u._id)) || 0,
      roles: roles
        .filter(r => u.roles?.includes(r))
        .map(r => ({
          role: r,
          code: u.roleProfiles?.[r]?.[STAFF_CODE_FIELD[r]] || '',
          details: u.roleProfiles?.[r]?.details || {},
        })),
    }))

    res.json({ staff, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

/**
 * GET /api/profile/search?q=nick — buscar jugadores por nick para agregarlos
 * de amigos. Antes no existía ningún endpoint para esto: el buscador del
 * Topbar (Cmd+K) solo busca secciones del sitio, Ranking.jsx solo filtra la
 * lista de rankings ya cargada, y Amigos/Mensajes solo listan amigos que ya
 * tienes -- no había forma real de encontrar a alguien nuevo por su nick.
 *
 * Con `q` (nick o playerCode) se busca en TODOS los jugadores: los filtros de
 * país/juegos son solo para "Descubrir" sin texto. Antes se combinaban (AND)
 * y, como el frontend los activa por defecto, buscar a alguien por su nick o
 * ID exacto daba 0 resultados si era de otro país o jugaba otros juegos.
 */
// Mismo mapa que LEGACY_GAME_IDS en frontend/src/data/games.js: en la BD
// conviven ids viejos ('val', 'mlbb') y canónicos ('valorant', ...), y el
// frontend manda siempre el canónico -- sin expandir, los 'val' no salían.
const LEGACY_GAME_IDS = {
  val: 'valorant', cs2: 'counter-strike-2', csgo: 'counter-strike-2', mlbb: 'mobile-legends-bang-bang', ff: 'free-fire',
  rl: 'rocket-league', tft: 'teamfight-tactics', wr: 'league-of-legends-wild-rift',
  freefire: 'free-fire', lol: 'league-of-legends', apex: 'apex-legends', dota2: 'dota-2', hok: 'honor-of-kings',
  rocketleague: 'rocket-league', aov: 'arena-of-valor', pokemon: 'pokemon-unite', r6: 'rainbow-six-siege',
}

function expandGameIds(ids) {
  const wanted = new Set(ids.map(id => LEGACY_GAME_IDS[id] || id))
  const out = new Set(wanted)
  for (const [legacy, canonical] of Object.entries(LEGACY_GAME_IDS)) {
    if (wanted.has(canonical)) out.add(legacy)
  }
  return [...out]
}

function searchRank(u, term) {
  const nick = String(u.nick || '').toLowerCase()
  const code = String(u.playerCode || '').toLowerCase()
  if (nick === term || code === term) return 0
  if (nick.startsWith(term) || code.startsWith(term)) return 1
  return 2
}

export async function searchPlayers(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().replace(/^#/, '')
    const hasQuery = q.length >= 2
    const rawCountry = hasQuery ? '' : String(req.query.country || '').trim().toUpperCase()
    const country = rawCountry === 'DO' ? 'RD' : rawCountry
    const games = hasQuery ? [] : expandGameIds(String(req.query.games || '')
      .split(',')
      .map(game => game.trim())
      .filter(Boolean)
      .slice(0, 8))
    if (q.length < 2 && !country && !games.length) return res.json({ users: [] })

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const myId = req.user?._id ? String(req.user._id) : null
    const blockedByMe = new Set((req.user?.blockedUsers || []).map(String))
    const filter = {
      deleted: { $ne: true },
      isBanned: { $ne: true },
      ...(myId ? { _id: { $nin: [myId, ...blockedByMe] }, blockedUsers: { $ne: myId } } : {}),
    }
    if (q.length >= 2) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [
          { nick: new RegExp(safe, 'i') },
          { playerCode: new RegExp(safe, 'i') },
        ] },
      ]
    }
    if (country) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [
          { countryCode: country },
          { region: country },
        ] },
      ]
    }
    if (games.length) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { games: { $in: games } },
            { 'gamerProfile.mainGame': { $in: games } },
            { 'gamerProfile.secondGame': { $in: games } },
            { 'gamerProfile.gameId': { $in: games } },
          ],
        },
      ]
    }

    const found = await User.find(filter)
      .sort(hasQuery ? { nick: 1 } : { gp: -1, updatedAt: -1, nick: 1 })
      .limit(hasQuery ? 60 : 20)
      .select('nick avatar playerCode countryCode region games gamerProfile.mainGame gamerProfile.secondGame gamerProfile.gameId gamerProfile.rank plan status activeStatus lastSeenAt privacy.publicProfile')
      .lean()

    // Coincidencia exacta de nick/ID primero: con orden alfabético y límite,
    // el jugador buscado podía quedar fuera detrás de 20 coincidencias parciales.
    const term = q.toLowerCase()
    const users = hasQuery
      ? found.map(u => [searchRank(u, term), u]).sort((a, b) => a[0] - b[0]).map(([, u]) => u)
      : found

    // Perfiles privados no aparecen en la búsqueda de otras personas (mismo
    // criterio que getPublicProfile*: solo el dueño/admin los ve).
    const visible = users.filter(u => u.privacy?.publicProfile !== false).slice(0, 20)

    res.json({
      users: visible.map(u => ({
        id: u._id,
        nick: u.nick,
        avatar: u.avatar || '',
        playerCode: u.playerCode,
        countryCode: u.countryCode,
        region: u.region || u.countryCode,
        games: u.games || [],
        mainGame: u.gamerProfile?.mainGame || u.gamerProfile?.gameId || u.gamerProfile?.secondGame || '',
        rank: u.gamerProfile?.rank || '',
        plan: u.plan,
        // online + presence (estado elegido si esta conectado): shared/presence.mjs
        ...publicPresence(u),
      })),
    })
  } catch (err) { next(err) }
}

export async function getPublicProfile(req, res, next) {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(String(req.params.userId || ''))) {
      req.params.identifier = req.params.userId
      return getPublicProfileByIdentifier(req, res, next)
    }

    const user = await User.findById(req.params.userId)
      .select(PUBLIC_FIELDS)
      .populate('friends', 'nick avatar status activeStatus lastSeenAt games plan')
      .populate('friendRequests.received', 'nick avatar')
      .populate('friendRequests.sent', 'nick avatar')
      .lean()

    if (!user) return res.status(404).json({ message: 'Player not found' })
    if (req.user && !sameId(user._id, req.user._id)) {
      if (hasBlocked(user, req.user._id)) return res.status(404).json({ message: 'Usuario no encontrado' })
      if (hasBlocked(req.user, user._id)) {
        return res.json({ user: sanitizeUserIdentityPayload({ _id: user._id, nick: user.nick, avatar: user.avatar, blockedByMe: true }, req.user) })
      }
    }
    if (user.privacy?.publicProfile === false && !canViewPrivateProfile(user, req.user)) {
      return res.status(403).json({ message: 'This profile is private' })
    }
    // Un regalo vencido (ej. la Corona de 7 dias) no se sigue mostrando
    // aunque el dueno no haya vuelto a entrar.
    await syncCosmetics(user)
    delete user.cosmeticGrants
    res.json({ user: sanitizeUserIdentityPayload(applyProfilePrivacy(user, req.user), req.user) })
  } catch (err) { next(err) }
}

export async function getPublicProfileByIdentifier(req, res, next) {
  try {
    const raw = String(req.params.identifier || '').trim()
    if (!raw) return res.status(404).json({ message: 'Player not found' })

    const safeRegex = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const user = await User.findOne({
      $or: [
        { nick: new RegExp(`^${safeRegex}$`, 'i') },
        { playerCode: raw.toUpperCase() },
        { internalCode: raw.toUpperCase() },
      ],
    })
      .select(PUBLIC_FIELDS)
      .populate('friends', 'nick avatar status activeStatus lastSeenAt games plan')
      .populate('friendRequests.received', 'nick avatar')
      .populate('friendRequests.sent', 'nick avatar')
      .lean()

    if (!user) return res.status(404).json({ message: 'Player not found' })
    if (req.user && !sameId(user._id, req.user._id)) {
      if (hasBlocked(user, req.user._id)) return res.status(404).json({ message: 'Usuario no encontrado' })
      if (hasBlocked(req.user, user._id)) {
        return res.json({ user: sanitizeUserIdentityPayload({ _id: user._id, nick: user.nick, avatar: user.avatar, blockedByMe: true }, req.user) })
      }
    }
    if (user.privacy?.publicProfile === false && !canViewPrivateProfile(user, req.user)) {
      return res.status(403).json({ message: 'This profile is private' })
    }
    // Un regalo vencido (ej. la Corona de 7 dias) no se sigue mostrando
    // aunque el dueno no haya vuelto a entrar.
    await syncCosmetics(user)
    delete user.cosmeticGrants
    res.json({ user: sanitizeUserIdentityPayload(applyProfilePrivacy(user, req.user), req.user) })
  } catch (err) { next(err) }
}

export async function updateProfile(req, res, next) {
  try {
    const allowed = [
      'nick', 'bio', 'status', 'games', 'experienceLevel', 'mainPlatform', 'lookingFor',
      'phoneCountryDial', 'phoneNumber', 'countryCode', 'region', 'activeFrame', 'activeBg',
      'activeStatus', 'activeBadge', 'activeCustomBg', 'activeCardDesign', 'activeCardBg',
      'activeCardCustomBg', 'website', 'social', 'avatar', 'showcaseCards',
      'gamerProfile', 'privacy', 'languages', 'birthDate', 'gender',
      'firstName', 'lastName', 'notificationPrefs', 'security',
    ]
    let updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    updates = normalizeProfileUpdates(updates)

    // Tarjetas del perfil principal: solo 'player' o roles con tarjeta que la
    // persona tenga aprobados; sin duplicados. Nunca queda vacio.
    if (updates.showcaseCards !== undefined) {
      const cardRoles = ['organizer', 'creator', 'coach', 'caster', 'analyst', 'moderator', 'sponsor']
      const wanted = Array.isArray(updates.showcaseCards) ? updates.showcaseCards.map(String) : []
      const hasPro = Array.isArray(req.user.gamerProfile?.pro?.entries) && req.user.gamerProfile.pro.entries.length > 0
      const valid = [...new Set(wanted)].filter(id => id === 'player' || (id === 'proplayer' && hasPro) || (cardRoles.includes(id) && req.user.roleProfiles?.[id]?.approvedAt))
      updates.showcaseCards = valid.length ? valid : ['player']
    }

    // Por compatibilidad con los llamados existentes que no mandan `role`
    // (ModeratorDashboard) se cae a req.user.role -- pero ahora se puede
    // pedir explicitamente cualquier rol especializado que el usuario tenga
    // aprobado, no solo el que hoy este en el campo unico `role`.
    const professionalRole = String(req.body.role || req.user.role || '')
    const professionalProfile = normalizeProfessionalProfile(req.user, professionalRole, req.body.professionalProfile)
    if (professionalProfile) {
      updates[`roleProfiles.${professionalRole}.details`] = professionalProfile
    }

    if (updates.birthDate !== undefined) {
      const born = new Date(updates.birthDate)
      if (Number.isNaN(born.getTime()) || born.getTime() > Date.now() || born.getFullYear() < 1900) {
        return res.status(400).json({ message: 'Valid birth date is required' })
      }
      updates.birthDate = born
    }

    // En un equipo femenino no se cambia el genero: si no, cualquiera entra
    // y despues se lo cambia (BACKEND-PENDIENTE "Reglas de elegibilidad").
    if (updates.gender !== undefined && updates.gender !== req.user.gender) {
      const teams = await Team.find({ members: req.user._id }).select('name gender').lean()
      const femaleTeam = teams.find(team => teamGenderKey(team.gender) === 'female')
      if (femaleTeam) {
        return res.status(400).json({ message: `No puedes cambiar tu genero mientras estes en un equipo femenino (${femaleTeam.name}). Sal del equipo primero.` })
      }
    }

    if (updates.nick) {
      // Sin distinguir mayusculas: "Nick" y "nick" no pueden convivir.
      const existing = await User.findOne({ nick: updates.nick, _id: { $ne: req.user._id } }).collation({ locale: 'en', strength: 2 }).lean()
      if (existing) return res.status(409).json({ message: 'Nick is already in use' })
    }

    // Marco/placa/estado: solo se puede equipar lo desbloqueado. Se calcula
    // con el perfil ya actualizado (completar el perfil y elegir el marco
    // de "Perfil completo" en el mismo guardado tiene que funcionar).
    if (['activeFrame', 'activeBadge', 'activeStatus'].some(field => updates[field] !== undefined)) {
      const merged = { ...req.user, ...updates }
      for (const key of ['gamerProfile', 'social']) {
        if (updates[key] && typeof updates[key] === 'object') merged[key] = { ...(req.user[key] || {}), ...updates[key] }
      }
      const problem = checkEquipUpdates(updates, await getCosmeticGrants(merged))
      if (problem) return res.status(problem.status).json({ message: problem.message })
    }

    // Objetos anidados: un $set del objeto completo reemplaza TODO el
    // subdocumento (un PATCH { social: { twitch } } borraba twitter, discord...).
    // Se aplanan a rutas con punto para tocar solo las llaves enviadas.
    for (const key of ['gamerProfile', 'social', 'privacy', 'notificationPrefs', 'security']) {
      const value = updates[key]
      if (!value || typeof value !== 'object' || Array.isArray(value)) { if (value !== undefined) delete updates[key]; continue }
      delete updates[key]
      for (const [inner, innerValue] of Object.entries(value)) updates[`${key}.${inner}`] = innerValue
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -emailVerificationToken -emailVerificationExpires').lean()

    user.cosmeticUnlocks = await syncCosmetics(user)
    // Cambio de estado con la web abierta: se aplica ya y se avisa a los amigos.
    if (updates.activeStatus !== undefined && updates.activeStatus !== req.user.activeStatus) refreshPresence(user._id, user.activeStatus)
    res.json({ user })
  } catch (err) { next(err) }
}

/** GET /api/profile/me/referral-code — código real (se genera si el usuario aún no tiene uno). */
export async function getMyReferralCode(req, res, next) {
  try {
    const code = await getOrCreateReferralCode(req.user)
    res.json({ referralCode: code })
  } catch (err) { next(err) }
}

export async function updateAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' })
    const avatarUrl = `/uploads/avatars/${req.file.filename}`
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -emailVerificationToken -emailVerificationExpires')
    res.json({ avatar: avatarUrl, user })
  } catch (err) { next(err) }
}

export async function updateProfileBackground(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' })
    const backgroundUrl = `/uploads/profile-backgrounds/${req.file.filename}`
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { activeBg: 'custom', activeCustomBg: backgroundUrl },
      { new: true }
    ).select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -emailVerificationToken -emailVerificationExpires')
    res.json({ activeBg: 'custom', activeCustomBg: backgroundUrl, user })
  } catch (err) { next(err) }
}

export async function updateProfileCardBackground(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' })
    const backgroundUrl = `/uploads/profile-backgrounds/${req.file.filename}`
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { activeCardBg: 'custom', activeCardCustomBg: backgroundUrl },
      { new: true }
    ).select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -emailVerificationToken -emailVerificationExpires')
    res.json({ activeCardBg: 'custom', activeCardCustomBg: backgroundUrl, user })
  } catch (err) { next(err) }
}

// ─── friend system ─────────────────────────────────────────────────────────

export async function sendFriendRequest(req, res, next) {
  try {
    const { userId } = req.params
    const myId = req.user._id.toString()

    if (myId === userId) return res.status(400).json({ message: 'Cannot add yourself' })

    const target = await User.findById(userId)
    if (!target) return res.status(404).json({ message: 'User not found' })
    if (await isBlockedEitherWay(myId, userId)) {
      return res.status(403).json({ message: 'No puedes enviar solicitud a este usuario' })
    }

    // Ajustes/Privacidad "Permitir solicitudes de amistad": se guardaba en
    // user.privacy.allowFriends desde siempre pero nunca se comprobaba aquí,
    // asi que apagarlo no evitaba nada.
    if (target.privacy?.allowFriends === false && req.user.role !== 'admin') {
      return res.status(403).json({ message: `${target.nick} no está aceptando solicitudes de amistad` })
    }

    const alreadyFriends = req.user.friends?.some(f => f.toString() === userId)
    if (alreadyFriends) return res.status(409).json({ message: 'Already friends' })

    const alreadySent = req.user.friendRequests?.sent?.some(f => f.toString() === userId)
    if (alreadySent) return res.status(409).json({ message: 'Request already sent' })

    // Solicitud cruzada: esa persona ya me habia enviado una -- en vez de dejar
    // dos solicitudes colgadas en direcciones opuestas, se aceptan de una.
    const theyAskedMe = req.user.friendRequests?.received?.some(f => f.toString() === userId)
    if (theyAskedMe) {
      await User.updateOne({ _id: myId }, { $pull: { 'friendRequests.received': userId }, $addToSet: { friends: userId } })
      await User.updateOne({ _id: userId }, { $pull: { 'friendRequests.sent': myId }, $addToSet: { friends: myId } })
      await sendNotif(userId, {
        type: 'friend_request_accepted',
        title: 'Nuevo amigo',
        message: `${req.user.nick} y tú ahora son amigos en GlitchGang.`,
        link: `/perfil?user=${req.user.nick}`,
        meta: { actorId: myId, actorNick: req.user.nick },
      })
      return res.json({ message: 'Friend added' })
    }

    await User.updateOne({ _id: myId }, { $addToSet: { 'friendRequests.sent': userId } })
    await User.updateOne({ _id: userId }, { $addToSet: { 'friendRequests.received': myId } })

    // Sin esto la solicitud quedaba guardada pero invisible -- la otra
    // persona solo se enteraba si entraba por su cuenta a Ajustes/Amigos.
    await sendNotif(userId, {
      type: 'friend_request',
      title: 'Nueva solicitud de amistad',
      message: `${req.user.nick} quiere agregarte como amigo.`,
      link: '/amigos',
      meta: { actorId: myId, actorNick: req.user.nick },
    })

    res.json({ message: 'Friend request sent' })
  } catch (err) { next(err) }
}

export async function respondFriendRequest(req, res, next) {
  try {
    const { userId } = req.params
    const accept = req.body.action === 'accept' || req.body.accept === true
    const myId = req.user._id.toString()

    const hasPending = req.user.friendRequests?.received?.some(f => f.toString() === userId)
    if (!hasPending) return res.status(404).json({ message: 'No pending request from this user' })

    await User.updateOne({ _id: myId }, { $pull: { 'friendRequests.received': userId } })
    await User.updateOne({ _id: userId }, { $pull: { 'friendRequests.sent': myId } })

    if (accept) {
      await User.updateOne({ _id: myId }, { $addToSet: { friends: userId } })
      await User.updateOne({ _id: userId }, { $addToSet: { friends: myId } })
      await sendNotif(userId, {
        type: 'friend_request_accepted',
        title: 'Solicitud aceptada',
        message: `${req.user.nick} aceptó tu solicitud de amistad.`,
        link: `/perfil?user=${req.user.nick}`,
        meta: { actorId: myId, actorNick: req.user.nick },
      })
    }

    res.json({ message: accept ? 'Friend added' : 'Request rejected' })
  } catch (err) { next(err) }
}

export async function removeFriend(req, res, next) {
  try {
    const { userId } = req.params
    const myId = req.user._id.toString()

    await User.updateOne({ _id: myId }, { $pull: { friends: userId } })
    await User.updateOne({ _id: userId }, { $pull: { friends: myId } })

    res.json({ message: 'Friend removed' })
  } catch (err) { next(err) }
}

export async function cancelFriendRequest(req, res, next) {
  try {
    const { userId } = req.params
    const myId = req.user._id.toString()

    const updateMe = await User.updateOne({ _id: myId, 'friendRequests.sent': userId }, { $pull: { 'friendRequests.sent': userId } })
    if (!updateMe.matchedCount) return res.status(404).json({ message: 'No pending request to this user' })

    await User.updateOne({ _id: userId }, { $pull: { 'friendRequests.received': myId } })
    res.json({ message: 'Friend request canceled' })
  } catch (err) { next(err) }
}

export async function blockUser(req, res, next) {
  try {
    const { userId } = req.params
    const myId = req.user._id.toString()
    if (myId === userId) return res.status(400).json({ message: 'No puedes bloquearte a ti mismo' })

    const target = await User.findById(userId).select('_id nick avatar').lean()
    if (!target) return res.status(404).json({ message: 'User not found' })

    await User.updateOne({ _id: myId }, { $addToSet: { blockedUsers: userId } })
    await breakUserRelations(myId, userId)
    res.json({ message: 'Usuario bloqueado', user: target })
  } catch (err) { next(err) }
}

export async function unblockUser(req, res, next) {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { blockedUsers: req.params.userId } })
    res.json({ message: 'Usuario desbloqueado' })
  } catch (err) { next(err) }
}

export async function listBlockedUsers(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
      .select('blockedUsers')
      .populate('blockedUsers', 'nick avatar')
      .lean()
    res.json({ users: user?.blockedUsers || [] })
  } catch (err) { next(err) }
}

export async function reportUser(req, res, next) {
  try {
    const { userId } = req.params
    const myId = req.user._id.toString()
    if (myId === userId) return res.status(400).json({ message: 'No puedes reportarte a ti mismo' })

    const reason = String(req.body?.reason || '').trim()
    const details = String(req.body?.details || '').trim().slice(0, 1000)
    if (!USER_REPORT_REASONS.has(reason)) return res.status(400).json({ message: 'Motivo de reporte invalido' })
    if (reason === 'otro' && !details) return res.status(400).json({ message: 'Describe el motivo del reporte' })

    const reported = await User.findById(userId).select('nick avatar').lean()
    if (!reported) return res.status(404).json({ message: 'User not found' })

    if (req.body?.alsoBlock === true) {
      await User.updateOne({ _id: myId }, { $addToSet: { blockedUsers: userId } })
      await breakUserRelations(myId, userId)
    }

    const openTicket = await SystemTicket.findOne({
      requester: myId,
      sourceType: 'user_report',
      sourceId: userId,
      status: { $in: ['open', 'in_progress'] },
    })

    const context = req.body?.context && typeof req.body.context === 'object'
      ? {
          type: String(req.body.context.type || '').slice(0, 40),
          id: String(req.body.context.id || '').slice(0, 120),
        }
      : null

    let ticket = openTicket
    if (ticket) {
      ticket = await appendUserTicketReply(ticket, req.user, details || `Nuevo reporte: ${USER_REPORT_LABELS[reason]}`)
    } else {
      ticket = await createSystemTicketRecord({
        requester: req.user._id,
        requesterUser: req.user,
        requesterName: req.user.nick,
        requesterEmail: req.user.email,
        purpose: 'moderation',
        sourceType: 'user_report',
        sourceId: String(reported._id),
        subject: `Reporte de usuario: @${reported.nick} - ${USER_REPORT_LABELS[reason]}`,
        metadata: {
          reportedUserId: String(reported._id),
          reportedNick: reported.nick,
          reason,
          context,
        },
        message: details || `Reporte por ${USER_REPORT_LABELS[reason]}`,
        priority: reason === 'acoso' ? 'high' : 'medium',
      })
    }

    res.json({ message: 'Reporte enviado', ticketCode: ticket.publicCode })
  } catch (err) { next(err) }
}
