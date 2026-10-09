import { User } from '../models/User.js'
import { University } from '../models/University.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { Organization } from '../models/Organization.js'
import { Community } from '../models/Community.js'
import { SystemTicket } from '../models/SystemTicket.js'
import { GameRequest } from '../models/GameRequest.js'
import { RoleApplication } from '../models/RoleApplication.js'
import { BrandApplication } from '../models/BrandApplication.js'
import { Brand } from '../models/Brand.js'
import { Campaign } from '../models/Campaign.js'
import { Creative } from '../models/Creative.js'
import { Invoice } from '../models/Invoice.js'
import { Ticket } from '../models/Ticket.js'
import { UniversityApplication } from '../models/UniversityApplication.js'
import { OrganizationRequest } from '../models/OrganizationRequest.js'
import { Order } from '../models/Order.js'
import { CommunityPost } from '../models/CommunityPost.js'
import { Session } from '../models/Session.js'
import { PlayerMatch } from '../models/PlayerMatch.js'
import { PlayerTournamentResult } from '../models/PlayerTournamentResult.js'
import { getCountryNumber } from '../config/countries.js'
import { sendNotif } from '../services/notifications.service.js'
import { createSystemTicketRecord } from '../services/systemTickets.service.js'
import { AdminActionLog } from '../models/AdminActionLog.js'
import { recordSanction } from './moderation.controller.js'
import { staffRoleOfSlot } from '../../../shared/teamRoles.mjs'

function actorName(user) {
  return user?.nick || user?.email || 'Admin'
}

async function logAdminAction(req, payload) {
  req._adminAudited = true // ver services/adminAudit.js
  try {
    await AdminActionLog.create({ actor: req.user?._id || null, actorName: actorName(req.user), ...payload })
  } catch (error) {
    console.error('[admin] log error:', error.message)
  }
}

const PLAN_IDS = {
  'Básico': 'PLAN-BAS', 'Basico': 'PLAN-BAS',
  'Pro': 'PLAN-PRO', 'Team': 'PLAN-TEAM', 'Pro Trial': 'PLAN-PROT',
  'Free': 'PLAN-FREE',
}

async function safeCount(model, filter = {}) {
  try {
    return await model.countDocuments(filter)
  } catch {
    return 0
  }
}

async function countTournamentReports() {
  try {
    const rows = await Tournament.aggregate([
      { $unwind: '$reports' },
      // Estados reales de Tournament.reports (open/in_review/resolved). Antes
      // buscaba 'pending'/'revision', que no existen, y nunca contaba nada.
      { $match: { 'reports.status': { $in: ['open', 'in_review'] } } },
      { $count: 'total' },
    ])
    return rows[0]?.total || 0
  } catch {
    return 0
  }
}

async function countBrandPendingChanges() {
  try {
    return await Brand.countDocuments({ 'pendingChanges.submittedAt': { $exists: true, $ne: null } })
  } catch {
    return 0
  }
}

async function countUnansweredAdminNotices() {
  try {
    const notices = await SystemTicket.find({
      sourceType: 'admin-notice',
      status: { $ne: 'closed' },
    }).select('messages').lean()
    return notices.filter(ticket => {
      const last = (ticket.messages || []).at(-1)
      return !last || last.author === 'admin'
    }).length
  } catch {
    return 0
  }
}

export async function getAdminSummary(req, res, next) {
  try {
    const [
      ticketsNew,
      ticketsOpen,
      gameRequestsPending,
      gameRequestsReviewing,
      roleApplicationsPending,
      brandApplicationsPending,
      brandPendingChanges,
      brandCampaignsPending,
      brandCreativesReview,
      invoicesPending,
      campaignPaymentsPending,
      tournamentsDraft,
      tournamentReportsPending,
      systemReportsPending,
      brandTicketsUnread,
      brandTicketsOpen,
      universityApplicationsPending,
      adminNoticesUnanswered,
      organizationRequestsPending,
      usersTotal,
      teamsTotal,
      tournamentsTotal,
      communitiesTotal,
      communitiesPaused,
    ] = await Promise.all([
      safeCount(SystemTicket, { unreadByAdmin: { $gt: 0 }, status: { $ne: 'closed' } }),
      safeCount(SystemTicket, { status: { $in: ['open', 'in_progress'] } }),
      safeCount(GameRequest, { status: 'pending' }),
      safeCount(GameRequest, { status: 'reviewing' }),
      safeCount(RoleApplication, { status: 'pending' }),
      safeCount(BrandApplication, { status: 'pending' }),
      countBrandPendingChanges(),
      safeCount(Campaign, { status: 'pending' }),
      safeCount(Creative, { status: 'review' }),
      safeCount(Invoice, { status: 'pending' }),
      safeCount(Campaign, { 'payment.status': 'pending' }),
      safeCount(Tournament, { status: 'draft' }),
      countTournamentReports(),
      safeCount(SystemTicket, {
        purpose: { $in: ['complaint', 'bug', 'help'] },
        unreadByAdmin: { $gt: 0 },
        status: { $ne: 'closed' },
      }),
      safeCount(Ticket, { unreadByAdmin: { $gt: 0 }, status: { $ne: 'closed' } }),
      safeCount(Ticket, { status: { $in: ['open', 'in_progress'] } }),
      safeCount(UniversityApplication, { status: 'pending' }),
      countUnansweredAdminNotices(),
      safeCount(OrganizationRequest, { status: 'pending' }),
      safeCount(User, {}),
      safeCount(Team, {}),
      safeCount(Tournament, {}),
      safeCount(Community, {}),
      safeCount(Community, { status: 'paused' }),
    ])

    const paymentsPending = invoicesPending + campaignPaymentsPending
    const brandsPending = brandApplicationsPending + brandPendingChanges + brandCampaignsPending + brandCreativesReview
    // Un borrador es trabajo sin publicar del organizador, no algo que el
    // admin deba revisar: solo los reportes abiertos piden atencion.
    const tournamentsReview = tournamentReportsPending
    const reports = tournamentReportsPending + systemReportsPending + brandTicketsUnread

    const modules = {
      tickets: {
        new: ticketsNew,
        open: ticketsOpen,
        label: 'Tickets nuevos',
      },
      gameRequests: {
        pending: gameRequestsPending,
        reviewing: gameRequestsReviewing,
        label: 'Solicitudes de juego',
      },
      roleApplications: {
        pending: roleApplicationsPending,
        label: 'Solicitudes de rol',
      },
      payments: {
        pending: paymentsPending,
        invoicesPending,
        campaignPaymentsPending,
        label: 'Pagos pendientes',
      },
      brands: {
        pending: brandsPending,
        applicationsPending: brandApplicationsPending,
        profileChangesPending: brandPendingChanges,
        campaignsPending: brandCampaignsPending,
        creativesReview: brandCreativesReview,
        label: 'Marcas pendientes',
      },
      tournaments: {
        review: tournamentsReview,
        drafts: tournamentsDraft,
        reportsPending: tournamentReportsPending,
        label: 'Torneos por revisar',
      },
      communities: {
        total: communitiesTotal,
        paused: communitiesPaused,
        label: 'Comunidades',
      },
      reports: {
        pending: reports,
        tournamentReportsPending,
        systemReportsPending,
        brandTicketsUnread,
        brandTicketsOpen,
        label: 'Reportes',
      },
      universities: {
        pending: universityApplicationsPending,
        label: 'Universidades',
      },
      adminNotices: {
        unanswered: adminNoticesUnanswered,
        label: 'Avisos sin responder',
      },
      organizations: {
        pending: organizationRequestsPending,
        label: 'Solicitudes de organización',
      },
    }

    const requiresAttention =
      ticketsNew +
      gameRequestsPending +
      roleApplicationsPending +
      paymentsPending +
      brandsPending +
      tournamentsReview +
      reports +
      universityApplicationsPending +
      adminNoticesUnanswered +
      organizationRequestsPending

    res.json({
      modules,
      totals: {
        users: usersTotal,
        teams: teamsTotal,
        tournaments: tournamentsTotal,
        communities: communitiesTotal,
        requiresAttention,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

// El censo del panel admin (data/playersCensus.js -> CENSUS_ROLES) usa claves
// propias distintas al enum real de User.role: 'user' en vez de 'player', y
// 'mod' en vez de 'moderator'. Los roles no se asignan desde el censo: pasan
// por la solicitud/aprobacion (ver BACKEND-PENDIENTE.md #admin-role-bypass).
function censusRole(role) {
  if (role === 'player') return 'user'
  if (role === 'moderator') return 'mod'
  return role || 'user'
}

function mapUser(u, uni, stats = {}) {
  return {
    id: String(u._id),
    nick: u.nick,
    realName: [u.firstName, u.lastName].filter(Boolean).join(' '),
    email: u.email,
    phone: [u.phoneCountryDial, u.phoneNumber].filter(Boolean).join(' ') || '—',
    gender: u.gender || '—',
    birthDate: u.birthDate ? new Date(u.birthDate).toLocaleDateString('es-DO') : '—',
    age: u.birthDate ? Math.floor((Date.now() - new Date(u.birthDate).getTime()) / 31557600000) : '—',
    city: u.city || '—',
    province: u.province || '—',
    socials: u.social || {},
    bio: u.bio || '',
    gp: u.gp || 0,
    roleProfiles: u.roleProfiles || {},
    publicId: u.playerCode,
    internalId: u.internalCode,
    country: u.countryCode,
    countryNumber: getCountryNumber(u.countryCode) || '00',
    mainGame: (Array.isArray(u.games) && u.games[0]) || '—',
    level: u.level || 1,
    rank: u.rank || '—',
    // User.status mezcla estado de cuenta (activo/inactivo/ban, lo pone el
    // admin) y presencia (online/offline, la pone el socket): para el censo
    // solo cuenta lo primero; la presencia va aparte.
    status: u.isBanned || u.status === 'ban' ? 'ban' : u.status === 'inactivo' ? 'inactivo' : 'activo',
    online: u.status === 'online',
    banReason: u.banReason || '',
    role: censusRole(u.role),
    roles: Array.isArray(u.roles) && u.roles.length > 0
      ? u.roles.map(censusRole)
      : [censusRole(u.role)],
    plan: u.plan || 'Free',
    planId: PLAN_IDS[u.plan] || '—',
    joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-DO') : '—',
    lastActive: stats.lastActive || '—',
    lastActiveAt: stats.lastActiveAt || null,
    matches: stats.matches || 0,
    winrate: stats.winrate || 0,
    earnings: stats.earnings || 0,
    mutedUntil: u.mutedUntil && new Date(u.mutedUntil) > new Date() ? u.mutedUntil : null,
    verified: Boolean(u.verified),
    communities: Array.isArray(u.communities) ? u.communities : [],
    teams: u.team
      ? [{ id: u.team.publicCode || '—', name: u.team.name }]
      : [],
    university: uni
      ? {
          siglas: uni.siglas, name: uni.name, matricula: uni.matricula,
          id: uni.publicCode, internalId: uni.internalCode, regDate: uni.registeredOn,
        }
      : (u.university || null),
    avatar: u.avatar || '',
  }
}

// GET /admin/census — usuarios reales con todos sus IDs (jugador, país,
// equipo, universidad, plan) para el panel admin.
export async function getCensus(req, res, next) {
  try {
    const [users, unis, sessions, matches, prizes] = await Promise.all([
      User.find({ deleted: { $ne: true } }).populate('team').lean(),
      University.find().lean(),
      Session.aggregate([{ $group: { _id: '$userId', last: { $max: '$lastActiveAt' } } }]),
      PlayerMatch.aggregate([{ $group: { _id: '$player', total: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } } } }]),
      PlayerTournamentResult.aggregate([{ $group: { _id: '$player', prize: { $sum: '$prize' } } }]),
    ])
    const uniByUser = new Map(unis.filter(u => u.user).map(u => [String(u.user), u]))
    const lastByUser = new Map(sessions.map(x => [String(x._id), x.last]))
    const matchByUser = new Map(matches.map(x => [String(x._id), x]))
    const prizeByUser = new Map(prizes.map(x => [String(x._id), x.prize]))
    // "En linea" = actividad autenticada en los ultimos 5 min (Session.lastActiveAt
    // se actualiza en cada request, ver auth.middleware.js).
    const ONLINE_MS = 5 * 60 * 1000
    const players = users.map(u => {
      const id = String(u._id)
      const last = lastByUser.get(id)
      const m = matchByUser.get(id)
      return mapUser(u, uniByUser.get(id), {
        lastActiveAt: last || null,
        lastActive: last ? (Date.now() - new Date(last).getTime() < ONLINE_MS ? 'En linea' : new Date(last).toLocaleDateString('es-DO')) : '',
        matches: m?.total || 0,
        winrate: m?.total ? Math.round((m.wins / m.total) * 100) : 0,
        earnings: prizeByUser.get(id) || 0,
      })
    })
    res.json({ players })
  } catch (error) {
    next(error)
  }
}

// POST /admin/users/:id/notice - aviso administrativo directo al usuario.
export async function sendUserNotice(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('_id nick email playerCode countryCode').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })

    const title = String(req.body?.title || 'Aviso administrativo').trim().slice(0, 120)
    const message = String(req.body?.message || '').trim().slice(0, 400)
    if (!message) return res.status(400).json({ message: 'Message is required' })

    const ticket = await createSystemTicketRecord({
      requester: user._id,
      requesterUser: user,
      requesterName: user.nick || user.email || 'Usuario',
      requesterEmail: user.email || '',
      purpose: 'moderation',
      priority: 'high',
      subject: title,
      message,
      author: 'admin',
      authorId: req.user?._id || null,
      sourceType: 'admin-notice',
      sourceId: String(Date.now()),
      sourceLabel: title,
      metadata: {
        targetNick: user.nick,
        sentBy: req.user?.nick || req.user?.email || 'Admin GlitchGang',
      },
    })

    await sendNotif(user._id, {
      type: 'admin_notice',
      title,
      message,
      link: `/mensajes?ticket=${encodeURIComponent(ticket.publicCode)}`,
      meta: {
        ticketId: String(ticket._id),
        publicCode: ticket.publicCode,
        targetNick: user.nick,
        sentBy: req.user?.nick || req.user?.email || 'Admin GlitchGang',
      },
    })

    res.status(201).json({ message: 'Notice sent', ticket })
  } catch (error) {
    next(error)
  }
}

// PATCH /admin/users/:id/status  { status: 'activo'|'inactivo'|'ban', reason? }
// Banear/desbanear de verdad: toca isBanned (lo que auth.service.js revisa
// en el login) ademas de `status` (lo que pinta el censo/StatusPill). Un
// baneo/desbaneo tambien deja fila en /admin/moderacion automaticamente.
export async function setUserStatus(req, res, next) {
  try {
    const status = String(req.body?.status || '').trim()
    if (!['activo', 'inactivo', 'ban'].includes(status)) {
      return res.status(400).json({ message: 'Estado invalido' })
    }
    const reason = String(req.body?.reason || '').trim().slice(0, 500)

    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    const wasBanned = user.status === 'ban'
    const before = { status: user.status, isBanned: user.isBanned }
    user.status = status
    user.isBanned = status === 'ban'
    user.banReason = status === 'ban' ? reason : ''
    await user.save()

    await logAdminAction(req, {
      action: status === 'ban' ? 'user_banned' : wasBanned ? 'user_unbanned' : 'user_status_changed',
      module: 'user', targetId: String(user._id), targetCode: user.playerCode,
      summary: status === 'ban' ? `Baneado: ${reason || 'sin motivo especificado'}` : `Estado -> ${status}`,
      before, after: { status: user.status, isBanned: user.isBanned },
    })

    if (status === 'ban') {
      await recordSanction(req, {
        targetUser: user._id, targetNick: user.nick, type: 'ban',
        action: 'Baneo administrativo', reason: reason || 'Accion manual desde panel admin',
      })
    } else if (wasBanned) {
      await recordSanction(req, {
        targetUser: user._id, targetNick: user.nick, type: 'unban',
        action: 'Cuenta reactivada', reason: 'Revision de caso',
      })
    }

    res.json({ id: String(user._id), status: user.status, isBanned: user.isBanned, banReason: user.banReason })
  } catch (error) { next(error) }
}

// PATCH /admin/users/:id/verify  { verified: boolean }
export async function setUserVerified(req, res, next) {
  try {
    const verified = Boolean(req.body?.verified)
    const user = await User.findByIdAndUpdate(req.params.id, { verified }, { new: true }).select('_id nick playerCode verified')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    await logAdminAction(req, {
      action: verified ? 'user_verified' : 'user_unverified',
      module: 'user', targetId: String(user._id), targetCode: user.playerCode,
      summary: verified ? 'Verificado por admin' : 'Verificacion retirada',
    })

    res.json({ id: String(user._id), verified: user.verified })
  } catch (error) { next(error) }
}

// DELETE /admin/users/:id — soft-delete: la cuenta tiene equipos/torneos/
// partidas asociadas, asi que borrarla de verdad dejaria referencias huerfanas.
// Se desactiva (no puede loguear, desaparece del censo) en vez de eliminarse.
export async function deleteUserAdmin(req, res, next) {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    // Anonimizar: antes solo se marcaba `deleted` y el email/nick/teléfono/
    // Discord quedaban tomados para siempre (no se podía volver a registrar) y
    // los datos personales seguían guardados. Se conserva el _id/playerCode
    // para que el historial de torneos y resultados siga cuadrando.
    const tag = String(user._id).slice(-8)
    user.deleted = true
    user.deletedAt = new Date()
    user.isBanned = true
    user.status = 'ban'
    user.email = `eliminado-${user._id}@deleted.glitchgang.local`
    user.nick = `eliminado-${tag}`
    user.firstName = 'Cuenta'
    user.lastName = 'eliminada'
    user.phoneNumber = '0'
    user.avatar = ''
    user.bio = ''
    user.website = ''
    user.social = {}
    user.whatsapp = { phone: '', verified: false, linkedAt: null }
    user.discord = { id: null, username: null }
    user.twoFactorEnabled = false
    user.referralCode = undefined
    await user.save()
    await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() })

    await logAdminAction(req, {
      action: 'user_deleted', module: 'user', targetId: String(user._id), targetCode: user.playerCode,
      summary: 'Cuenta desactivada (soft-delete) por admin',
    })

    res.json({ message: 'Usuario eliminado' })
  } catch (error) { next(error) }
}

function sanitizePartnerBadge(input = {}, adminId = null, current = {}) {
  const nextActive = Boolean(input.active)
  const status = input.status || (nextActive ? 'verified' : 'revoked')
  return {
    active: nextActive,
    label: String(input.label || current.label || 'GlitchGang Partner').trim().slice(0, 80) || 'GlitchGang Partner',
    status: ['none', 'pending', 'verified', 'revoked'].includes(status) ? status : (nextActive ? 'verified' : 'revoked'),
    reason: String(input.reason || '').trim().slice(0, 260),
    verifiedAt: nextActive ? new Date() : (current.verifiedAt || null),
    revokedAt: nextActive ? null : new Date(),
    updatedBy: adminId || null,
  }
}

// Primer puesto ocupado de cada rol de staff del plantel (coach principal,
// primer analista, manager), con el formato que ya lee AdminTeams.
function staffFromRoster(rosterSlots) {
  const entries = Object.entries(rosterSlots && typeof rosterSlots === 'object' ? rosterSlots : {})
    .filter(([, slot]) => slot && typeof slot === 'object' && (slot.nick || slot.userId))
  const pick = role => entries.find(([key]) => staffRoleOfSlot(key) === role)?.[1] || null
  const coach = pick('coach'), manager = pick('manager'), analyst = pick('analyst')
  const out = {
    coach: coach?.nick || '—', coachId: coach?.playerCode || '—',
    manager: manager?.nick || '—', managerId: manager?.playerCode || '—',
    analyst: analyst?.nick || '—', analystId: analyst?.playerCode || '—',
  }
  return { ...out, staff: { ...out } }
}

function mapTeam(t, refs = {}) {
  const avatarByNick = new Map((t.members || []).map(m => [String(m.nick || '').toLowerCase(), m.avatar || '']))
  const roster = (Array.isArray(t.roster) && t.roster.length
    ? t.roster
    : (t.members || []).map(m => ({ nick: m.nick, id: m.playerCode })))
    .map(r => ({ ...r, avatar: r.avatar || avatarByNick.get(String(r.nick || '').toLowerCase()) || '' }))

  return {
    id: String(t._id),
    uid: t.publicCode || '—', publicCode: t.publicCode || '—',
    internalCode: t.internalCode || '—',
    teamInviteCode: t.teamInviteCode || '—',
    name: t.name, tag: t.tag, game: t.game, region: t.region || 'LATAM',
    color: t.color, logo: t.logo || '',
    category: t.category || '—', level: t.level || '—', lang: t.lang || '—', gender: t.gender || '—',
    community: t.community || '—',
    communityId: refs.communities?.get(String(t.community || '').toLowerCase()) || null,
    sponsor: t.sponsor || '—',
    partnerBadge: t.partnerBadge || { active: false, label: 'GlitchGang Partner', status: 'none', reason: '' },
    sponsorId: refs.brands?.get(String(t.sponsor || '').toLowerCase()) || null,
    slogan: t.slogan || '—',
    wins: t.wins || 0, losses: t.losses || 0, rankPts: t.rankPts || 0, rank: t.rank || '—', titles: t.titles || 0,
    captain: t.captainProfile?.nick || t.leader?.nick || roster[0]?.nick || '—',
    captainId: t.leader?.playerCode || (roster[0]?.id || '—'),
    captainProfile: t.captainProfile || (t.leader ? { name: `${t.leader.firstName || ''} ${t.leader.lastName || ''}`.trim(), nick: t.leader.nick } : null),
    // Staff real: los puestos coach/analyst/manager del plantel (el viejo
    // Team.staff de texto ya no existe).
    ...staffFromRoster(t.rosterSlots),
    rosterSlots: t.rosterSlots || null,
    roster, players: roster.map(r => r.nick).join(' | ') || '—',
    playerCount: roster.length,
    socials: t.socials || t.social || {},
    university: t.university || null,
    created: t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-DO') : '—',
    status: t.status || 'Activo',
  }
}

// IDs reales de la comunidad/marca que el equipo declara (por nombre). Antes
// se inventaban: un COM-... fijo por juego y un MARCA-XXX-01 armado del texto.
async function teamRefs() {
  const [communities, brands] = await Promise.all([
    Community.find({ publicCode: { $exists: true, $ne: '' } }).select('name slug publicCode').lean(),
    Brand.find().select('name code').lean(),
  ])
  const communityMap = new Map()
  communities.forEach(c => {
    communityMap.set(String(c.name || '').toLowerCase(), c.publicCode)
    if (c.slug) communityMap.set(String(c.slug).toLowerCase(), c.publicCode)
  })
  return {
    communities: communityMap,
    brands: new Map(brands.map(b => [String(b.name || '').toLowerCase(), b.code])),
  }
}

export async function getTeams(req, res, next) {
  try {
    const [teams, refs] = await Promise.all([
      Team.find().populate('members', 'nick playerCode avatar').populate('leader', 'nick playerCode').lean(),
      teamRefs(),
    ])
    res.json({ teams: teams.map(t => mapTeam(t, refs)) })
  } catch (error) { next(error) }
}

const TEAM_ADMIN_EDITABLE_FIELDS = [
  'name', 'tag', 'color', 'game', 'tiers', 'region', 'country', 'slogan', 'sponsor', 'brand',
  'contactEmail', 'community', 'level', 'category', 'lang', 'gender', 'description', 'banner', 'logo', 'status',
]

export async function updateTeamAdmin(req, res, next) {
  try {
    const patch = {}
    if (req.body.partnerBadge) {
      const current = await Team.findById(req.params.id).select('partnerBadge')
      if (!current) return res.status(404).json({ message: 'Equipo no encontrado' })
      patch.partnerBadge = sanitizePartnerBadge(req.body.partnerBadge, req.user?._id, current.partnerBadge?.toObject?.() || current.partnerBadge || {})
    }
    TEAM_ADMIN_EDITABLE_FIELDS.forEach(field => {
      if (req.body[field] !== undefined) patch[field] = req.body[field]
    })
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nada para actualizar' })

    const row = await Team.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true })
      .populate('members', 'nick playerCode avatar')
      .populate('leader', 'nick playerCode')
      .lean()
    if (!row) return res.status(404).json({ message: 'Equipo no encontrado' })
    res.json({ team: mapTeam(row, await teamRefs()) })
  } catch (error) { next(error) }
}

export async function deleteTeamAdmin(req, res, next) {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado' })
    await User.updateMany({ team: team._id }, { team: null })
    await Team.deleteOne({ _id: team._id })
    res.json({ message: 'Equipo eliminado' })
  } catch (error) { next(error) }
}

// Equipos inscritos + W/L dentro de este torneo, sacados de las inscripciones
// reales y de los resultados confirmados del bracket (bracketDoc.results).
function tournamentTeams(t) {
  const results = t.bracketDoc?.results || {}
  const record = new Map()
  const bump = (name, key) => {
    if (!name) return
    const row = record.get(name) || { wins: 0, losses: 0 }
    row[key] += 1
    record.set(name, row)
  }
  Object.values(results).forEach(m => {
    if (!m?.confirmed || !m.winner) return
    bump(m.winner, 'wins')
    bump(m.winner === m.a ? m.b : m.a, 'losses')
  })
  const seedOrder = t.bracketDoc?.seedOrder || []
  return (t.registrations || [])
    .filter(r => r.status !== 'withdrawn')
    .map((r, i) => {
      const team = r.team && typeof r.team === 'object' ? r.team : null
      const name = team?.name || r.teamMeta?.name || 'Equipo'
      const rec = record.get(name) || { wins: 0, losses: 0 }
      const seedIdx = seedOrder.indexOf(name)
      return {
        id: String(team?._id || r._id || i),
        name,
        tag: team?.tag || r.teamMeta?.tag || '',
        logo: team?.logo || '',
        members: Array.isArray(team?.members) ? team.members.length : (r.rosterSnapshot?.length || 0),
        status: r.status,
        seed: seedIdx >= 0 ? seedIdx + 1 : null,
        wins: rec.wins,
        losses: rec.losses,
      }
    })
}

function tournamentMatches(t) {
  return Object.entries(t.bracketDoc?.results || {}).map(([id, m]) => ({
    id,
    a: m?.a || '', b: m?.b || '',
    scoreA: m?.scoreA ?? null, scoreB: m?.scoreB ?? null,
    winner: m?.winner || '',
    confirmed: m?.confirmed === true,
  }))
}

function mapTournament(t) {
  return {
    id: String(t._id),
    uid: t.publicId || '—',
    publicId: t.publicId || '—',
    tournamentCode: t.tournamentCode || '—',
    internalId: t.tournamentCode || '—',
    legacyPublicId: t.legacyPublicId || '—',
    gameCode: t.gameCode || '—',
    organizerCode: t.organizerCode || '—',
    creator: t.organizerCode || '—',
    countryCode: t.countryCode || '—',
    name: t.title,
    title: t.title,
    game: t.game,
    format: t.format,
    status: t.status === 'ongoing' ? 'live' : t.status === 'open' ? 'upcoming' : t.status,
    region: t.region || 'LATAM',
    startDate: t.date ? new Date(t.date).toISOString().slice(0, 10) : '—',
    date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '—',
    time: t.date ? new Date(t.date).toISOString().slice(11, 16) : '—',
    capacity: t.maxSlots || 0,
    slots: t.maxSlots || 0,
    registered: t.currentSlots || 0,
    filled: t.currentSlots || 0,
    entryFee: t.entryFee || 0,
    cost: t.entryFee > 0 ? `$${t.entryFee}` : 'Gratis',
    prizePool: t.prizePool || 0,
    prize: t.prizePool || '0',
    currency: t.currency || 'USD',
    prizes: t.prizes || [],
    winner: t.winner || '—',
    participants: t.participants || [],
    participantNames: (t.participants || []).map(p => p.name).join(' | ') || '—',
    bracket: t.bracket || [],
    teams: tournamentTeams(t),
    matches: tournamentMatches(t),
    bracketStatus: t.bracketDoc?.status || 'idle',
    bracketPublished: Boolean(t.bracketDoc?.published),
    champion: t.bracketDoc?.champion || t.winner || '',
    reports: t.reports || [],
    checkin: t.checkin || {},
    staff: t.staff || {},
    collaborators: Array.isArray(t.collaborators) ? t.collaborators : [],
    sponsors: Array.isArray(t.sponsors) ? t.sponsors : [],
    evidences: Array.isArray(t.evidences) ? t.evidences : [],
    rules: t.rules || '—',
    description: t.description || '—',
    organizer: t.organizer ? String(t.organizer) : '—',
    created: t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-DO') : '—',
    visibility: t.visibility || 'public',
    discordEnabled: Boolean(t.discordEnabled),
    organizationId: t.organization ? String(t.organization) : null,
    modality: t.modality || '5v5',
    platform: t.platform || 'pc',
    timezone: t.timezone || 'UTC',
    minAge: t.minAge || 0,
    allowedCountries: t.allowedCountries || [],
    eligibility: t.eligibility || {},
    notes: t.notes || '',
    server: t.server || '—',
    series: t.series || '—',
    patch: t.patch || '—',
    mapPool: t.mapPool || '—',
    checkinDeadline: t.checkinDeadline ? new Date(t.checkinDeadline).toISOString() : '—',
    overcup: t.overcup || {},
    prizeType: t.prizeType || 'Sin premio',
    contactEmail: t.contactEmail || '—',
    contactPhone: t.contactPhone || '—',
    contactDiscord: t.contactDiscord || '—',
    streamUrl: t.streamUrl || '—',
    streamLang: t.streamLang || '—',
    jurisdiction: t.jurisdiction || '—',
    law: t.law || '—',
    complaintsChannel: t.complaintsChannel || '—',
  }
}

export async function getTournaments(req, res, next) {
  try {
    const items = await Tournament.find().populate('registrations.team', 'name tag logo members').lean()
    res.json({ tournaments: items.map(mapTournament) })
  } catch (error) { next(error) }
}

/** PATCH /api/admin/tournaments/:id/discord — marca/desmarca un torneo como jugable por Discord. */
export async function setTournamentDiscordEnabled(req, res, next) {
  try {
    const discordEnabled = Boolean(req.body?.discordEnabled)
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $set: { discordEnabled } },
      { new: true },
    ).lean()
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    res.json(mapTournament(tournament))
  } catch (error) { next(error) }
}

/** PATCH /api/admin/tournaments/:id/organization — asigna un torneo a un cliente (Organization). */
export async function setTournamentOrganization(req, res, next) {
  try {
    const organizationId = req.body?.organizationId || null
    if (organizationId) {
      const org = await Organization.findById(organizationId).lean()
      if (!org) return res.status(404).json({ message: 'Organization not found' })
    }
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $set: { organization: organizationId } },
      { new: true },
    ).lean()
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    res.json(mapTournament(tournament))
  } catch (error) { next(error) }
}

function mapOrganization(org) {
  return {
    id: String(org._id),
    name: org.name,
    discordGuildId: org.discordGuildId,
    owner: org.owner ? String(org.owner) : null,
    welcomeChannelId: org.welcomeChannelId || '',
    status: org.status,
    createdAt: org.createdAt,
  }
}

/** GET /api/admin/organizations — lista los clientes dados de alta. */
export async function listOrganizations(req, res, next) {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 }).lean()
    res.json({ organizations: orgs.map(mapOrganization) })
  } catch (error) { next(error) }
}

/**
 * POST /api/admin/organizations — da de alta un cliente nuevo (alta manual).
 * body: { name, discordGuildId, ownerEmail, welcomeChannelId? }
 * El dueño debe tener ya una cuenta de GlitchGang (se busca por email).
 */
export async function createOrganization(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim()
    const discordGuildId = String(req.body?.discordGuildId || '').trim()
    const ownerEmail = String(req.body?.ownerEmail || '').trim().toLowerCase()

    if (!name || !discordGuildId || !ownerEmail) {
      return res.status(400).json({ message: 'name, discordGuildId y ownerEmail son requeridos' })
    }

    const owner = await User.findOne({ email: ownerEmail })
    if (!owner) {
      return res.status(404).json({ message: `No existe una cuenta de GlitchGang con el correo ${ownerEmail}. El dueño debe registrarse primero.` })
    }

    const existing = await Organization.findOne({ discordGuildId })
    if (existing) {
      return res.status(409).json({ message: 'Ya existe una organizacion registrada para ese servidor de Discord.' })
    }

    const org = await Organization.create({
      name,
      discordGuildId,
      owner: owner._id,
      welcomeChannelId: String(req.body?.welcomeChannelId || '').trim(),
    })

    res.status(201).json(mapOrganization(org))
  } catch (error) { next(error) }
}

/**
 * PATCH /api/admin/organizations/:id — corrige datos de un cliente ya dado
 * de alta (ej. el discordGuildId quedo mal cargado — un ID de usuario en
 * vez del ID del servidor). body: { name?, discordGuildId?, welcomeChannelId?, status? }
 */
export async function updateOrganization(req, res, next) {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return res.status(404).json({ message: 'Organization not found' })

    if (req.body?.discordGuildId !== undefined) {
      const discordGuildId = String(req.body.discordGuildId).trim()
      if (!discordGuildId) return res.status(400).json({ message: 'discordGuildId no puede quedar vacio' })
      const existing = await Organization.findOne({ discordGuildId, _id: { $ne: org._id } })
      if (existing) {
        return res.status(409).json({ message: 'Ya existe otra organizacion registrada para ese servidor de Discord.' })
      }
      org.discordGuildId = discordGuildId
    }
    if (req.body?.name !== undefined) org.name = String(req.body.name).trim()
    if (req.body?.welcomeChannelId !== undefined) org.welcomeChannelId = String(req.body.welcomeChannelId).trim()
    if (req.body?.status !== undefined) org.status = req.body.status

    await org.save()
    res.json(mapOrganization(org))
  } catch (error) { next(error) }
}

// ─── Staff: administradores y moderadores (/admin/admins) ───────────────────
// `admin` vive en User.role (unico rol que abre /admin, ver requireAdmin);
// `moderator` vive en User.roles (rol de plataforma con su propio panel).
// Ascender/quitar acceso es una accion deliberada del admin, no pasa por la
// cola de solicitudes de rol.
const STAFF_ROLES = { admin: 'Administrador', moderator: 'Moderador' }

function isStaffAdmin(u) { return u.role === 'admin' }
function isStaffMod(u) { return u.role === 'moderator' || (u.roles || []).includes('moderator') }

function mapStaff(u) {
  return {
    id: String(u._id),
    nick: u.nick,
    email: u.email,
    avatar: u.avatar || '',
    publicId: u.playerCode || '',
    staffRole: isStaffAdmin(u) ? 'admin' : 'moderator',
    isAdmin: isStaffAdmin(u),
    isModerator: isStaffMod(u),
    status: u.isBanned ? 'ban' : u.status === 'inactivo' ? 'inactivo' : 'activo',
    joinedAt: u.createdAt || null,
  }
}

async function notifyStaffChange(req, user, title, message, logAction, summary) {
  await logAdminAction(req, { action: logAction, module: 'staff', targetId: String(user._id), targetCode: user.playerCode, summary })
  sendNotif(user._id, {
    type: 'role_change', title, message, link: '/',
    meta: { action: logAction, role: user.role || '', roles: user.roles || [], actorNick: req.user?.nick || 'Admin' },
  }, { email: true }).catch(() => {})
}

// GET /admin/staff
export async function getStaff(req, res, next) {
  try {
    const staff = await User.find({
      deleted: { $ne: true },
      $or: [{ role: { $in: ['admin', 'moderator'] } }, { roles: 'moderator' }],
    }).sort({ createdAt: 1 }).lean()
    res.json({ staff: staff.map(mapStaff) })
  } catch (error) { next(error) }
}

// POST /admin/staff  { identifier: email|nick|playerCode, role: 'admin'|'moderator' }
export async function promoteStaff(req, res, next) {
  try {
    const role = String(req.body?.role || '')
    if (!STAFF_ROLES[role]) return res.status(400).json({ message: 'Rol invalido' })
    const identifier = String(req.body?.identifier || '').trim()
    if (!identifier) return res.status(400).json({ message: 'Indica email, nick o ID del usuario' })

    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const user = await User.findOne({
      deleted: { $ne: true },
      $or: [
        { email: identifier.toLowerCase() },
        { nick: new RegExp(`^${escaped}$`, 'i') },
        { playerCode: identifier.toUpperCase() },
      ],
    })
    if (!user) return res.status(404).json({ message: 'No existe una cuenta con ese email, nick o ID' })
    if (user.isBanned) return res.status(409).json({ message: `${user.nick} esta baneado` })

    if (role === 'admin') {
      if (isStaffAdmin(user)) return res.status(409).json({ message: `${user.nick} ya es Administrador` })
      user.role = 'admin'
    } else {
      if (isStaffMod(user)) return res.status(409).json({ message: `${user.nick} ya es Moderador` })
      user.roles = [...new Set([...(user.roles || []), 'moderator'])]
      if (!user.role || user.role === 'player') user.role = 'moderator'
    }
    await user.save()
    await notifyStaffChange(req, user, `Ahora eres ${STAFF_ROLES[role]}`,
      `Un administrador te otorgo el rol de ${STAFF_ROLES[role]} en GlitchGang.`,
      'staff_promoted', `Ascendido a ${STAFF_ROLES[role]}`)
    res.status(201).json({ staff: mapStaff(user) })
  } catch (error) { next(error) }
}

// DELETE /admin/staff/:id/:role — quita ese rol de staff (admin o moderator).
export async function removeStaffRole(req, res, next) {
  try {
    const role = String(req.params.role || '')
    if (!STAFF_ROLES[role]) return res.status(400).json({ message: 'Rol invalido' })
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
    if (String(user._id) === String(req.user._id)) {
      return res.status(403).json({ message: 'No puedes quitarte tu propio acceso' })
    }

    if (role === 'admin') {
      if (!isStaffAdmin(user)) return res.status(409).json({ message: `${user.nick} no es Administrador` })
      const admins = await User.countDocuments({ role: 'admin', deleted: { $ne: true } })
      if (admins <= 1) return res.status(409).json({ message: 'Debe quedar al menos un administrador' })
      user.role = (user.roles || [])[0] || 'player'
    } else {
      if (!isStaffMod(user)) return res.status(409).json({ message: `${user.nick} no es Moderador` })
      user.roles = (user.roles || []).filter(r => r !== 'moderator')
      if (user.role === 'moderator') user.role = user.roles[0] || 'player'
    }
    await user.save()
    await notifyStaffChange(req, user, 'Tu rol cambio',
      `Se removio tu acceso de ${STAFF_ROLES[role]} en GlitchGang.`,
      'staff_removed', `${STAFF_ROLES[role]} removido`)

    const stillStaff = isStaffAdmin(user) || isStaffMod(user)
    res.json({ id: String(user._id), staff: stillStaff ? mapStaff(user) : null })
  } catch (error) { next(error) }
}

// POST /admin/users/:id/case  { category, reason } — abre un caso de revision
// interno sobre la cuenta (SystemTicket de moderacion, visible en
// /admin/reportes y /admin/tickets). No avisa al usuario: es un expediente
// del staff. Antes se guardaba en el estado del navegador del admin.
export async function openUserCase(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('_id nick email playerCode countryCode').lean()
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
    const category = String(req.body?.category || 'Conducta').trim().slice(0, 40)
    const reason = String(req.body?.reason || '').trim().slice(0, 2000)
    if (!reason) return res.status(400).json({ message: 'Describe la evidencia o justificacion' })

    const staffName = req.user?.nick || req.user?.email || 'Admin GlitchGang'
    const subject = `Caso de revision: ${user.nick} [${category}]`
    const ticket = await createSystemTicketRecord({
      requester: req.user?._id || null,
      requesterUser: req.user,
      requesterName: staffName,
      requesterEmail: req.user?.email || '',
      purpose: 'moderation',
      priority: 'high',
      subject,
      message: reason,
      author: 'admin',
      authorId: req.user?._id || null,
      sourceType: 'admin-case',
      sourceId: String(user._id),
      sourceLabel: `${user.nick} (${user.playerCode})`,
      metadata: { targetUserId: String(user._id), targetNick: user.nick, targetCode: user.playerCode, category, openedBy: staffName },
    })

    await logAdminAction(req, {
      action: 'user_case_opened', module: 'user', targetId: String(user._id), targetCode: user.playerCode,
      summary: `${category}: ${reason.slice(0, 200)}`, metadata: { ticket: ticket.publicCode },
    })
    res.status(201).json({ ticket: { id: String(ticket._id), publicCode: ticket.publicCode, subject } })
  } catch (error) { next(error) }
}

// GET /admin/users/:id/activity — pagos (Order) y torneos reales del jugador
// para la ficha del censo (antes: paymentsStore vacio + torneos de ejemplo).
export async function getUserActivity(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('_id team').lean()
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    const [orders, teamHistory] = await Promise.all([
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(100).lean(),
      Team.find({ $or: [{ members: user._id }, { leader: user._id }] }).select('_id').lean(),
    ])
    const teamIds = [...new Set([...(user.team ? [String(user.team)] : []), ...teamHistory.map(t => String(t._id))])]
    const tournaments = await Tournament.find({
      $or: [
        { 'registrations.user': user._id },
        { 'registrations.registeredBy': user._id },
        ...(teamIds.length ? [{ 'registrations.team': { $in: teamIds } }] : []),
      ],
    }).select('title game status publicId date winner bracketDoc.champion').sort({ date: -1 }).limit(100).lean()

    res.json({
      payments: orders.map(o => ({
        id: o.id, concept: o.concept, amount: o.amount, currency: o.currency || 'USD',
        status: o.status, mode: o.mode, date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-DO') : '—',
      })),
      tournaments: tournaments.map(t => ({
        id: String(t._id), name: t.title, game: t.game, status: t.status, publicId: t.publicId,
        date: t.date ? new Date(t.date).toLocaleDateString('es-DO') : '—',
        champion: t.bracketDoc?.champion || t.winner || '',
      })),
    })
  } catch (error) { next(error) }
}

// ─── Moderacion de publicaciones de comunidades (cross-comunidad) ───────────
// Un admin puede no pertenecer a ninguna universidad/comunidad, asi que no ve
// esos feeds por la via normal. Estas rutas le dan vista y borrado global.
export async function adminListCommunityPosts(req, res, next) {
  try {
    const { universityId, communityId, reported } = req.query
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100)
    const filter = {}
    if (universityId) filter.universityId = String(universityId)
    if (communityId) filter.communityId = String(communityId)
    if (reported === 'true' || reported === '1') filter['reports.0'] = { $exists: true }

    const [posts, total] = await Promise.all([
      CommunityPost.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('reports.user', 'nick')
        .populate('communityId', 'name slug')
        .lean(),
      CommunityPost.countDocuments(filter),
    ])

    res.json({
      posts: posts.map(p => ({ ...p, reportsCount: (p.reports || []).length })),
      total, page, pages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) { next(error) }
}

export async function adminDeleteCommunityPost(req, res, next) {
  try {
    const post = await CommunityPost.findByIdAndDelete(req.params.id)
    if (!post) return res.status(404).json({ message: 'Publicacion no encontrada' })
    await logAdminAction(req, {
      action: 'community_post_deleted', module: 'community', targetId: String(post._id), targetCode: post.authorNick,
      summary: `Post de @${post.authorNick || '—'} borrado (${(post.reports || []).length} reportes): ${String(post.text || post.eventTitle || '').slice(0, 160)}`,
    })
    if (post.author) {
      sendNotif(post.author, {
        type: 'admin_notice',
        title: 'Tu publicacion fue retirada',
        message: 'Moderacion de GlitchGang retiro una de tus publicaciones de comunidad por incumplir las normas.',
        link: '/',
        meta: { kind: 'post_removed', postId: String(post._id), reportsCount: (post.reports || []).length, excerpt: String(post.text || post.eventTitle || '').slice(0, 120) },
      }).catch(() => {})
    }
    res.json({ ok: true })
  } catch (error) { next(error) }
}
