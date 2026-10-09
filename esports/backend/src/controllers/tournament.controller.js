import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'
import { User } from '../models/User.js'
import { Organization } from '../models/Organization.js'
import { Team } from '../models/Team.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { DiscordProvisionLog } from '../models/DiscordProvisionLog.js'
import { IntegrationEvent } from '../models/IntegrationEvent.js'
import { sanitizeTournamentIdentityPayload } from '../services/identityPayload.service.js'
import { applyTournamentDefaults, getTournamentDefaults } from '../services/tournamentDefaults.service.js'
import { createSystemTicketRecord } from '../services/systemTickets.service.js'
import { sendNotif } from '../services/notifications.service.js'
import { TournamentDraft } from '../models/TournamentDraft.js'
import { TournamentAuditLog } from '../models/TournamentAuditLog.js'
import { validateTournamentSetup, participantRestrictions, sanitizeStaffMembers } from '../services/tournamentSetup.service.js'
import { enqueueIntegrationEvent } from '../services/integrationEvents.service.js'
import { syncTournamentCreatedToCrm } from '../services/crmSync.service.js'
import { autoGenerateBracketIfReady, onResultsConfirmed } from '../services/bracketSync.service.js'
import { syncRosterSlotsWithUsers, teamUsersForRosterSync } from './team.controller.js'
import { missingProfileFields } from '../../../shared/roleProfileCompleteness.mjs'
import { scheduleErrors, MIN_LEAD_MS, instant, SYSTEM_TO_FORMAT, STAFF_ROLES, PLATFORM_STAFF_ROLES, STAFF_ROLE_BY_PLATFORM, normalizeCompetition, validateCompetition } from '../../../shared/tournamentSetup.mjs'
import { competitionLockViolation } from '../../../shared/competitionLock.mjs'
import { gameKeyOf } from '../../../shared/games.mjs'
import { isMobileLegends } from '../../../shared/matchStats.mjs'
import { isUniversityGameAllowed, UNIVERSITY_ALLOWED_GAMES_LIST } from '../config/universityCatalog.js'
import { announcementSummary, pushAnnouncement, sanitizeChangeNotice, sendChangeNotice } from '../services/tournamentAnnouncements.service.js'
import { saveRosterSnapshot } from '../services/rosterLock.service.js'
import { buildBroadcastTeams, broadcastKitUserIds } from '../services/broadcastKit.service.js'
import { escapeRegex } from '../utils/regex.js'
import { ensureStaffRoom, syncStaffRoom } from '../services/tournamentStaffRoom.service.js'
import { viewConversation } from './messages.controller.js'

const GLITCHGANG_DISCORD_URL = 'https://discord.gg/bZTsanNB3G'

export function tournamentIdentityFilter(id, extra = {}) {
  const value = String(id || '').trim()
  const uppercase = value.toUpperCase()
  const identifiers = [
    { publicId: uppercase },
    { tournamentCode: uppercase },
    { legacyPublicId: uppercase },
  ]

  if (mongoose.Types.ObjectId.isValid(value)) identifiers.unshift({ _id: value })
  return { ...extra, $or: identifiers }
}

function isTournamentOwner(tournament, user) {
  return String(tournament?.organizer || '') === String(user?._id || '')
}

function isPrivilegedForTournament(tournament, user) {
  const role = String(user?.role || '').toLowerCase()
  const roles = (user?.roles || user?.creatorRoles || []).map(r => String(r).toLowerCase())
  return role === 'admin' || roles.includes('admin') || isTournamentOwner(tournament, user)
}

function acceptedStaffMember(tournament, user) {
  return (tournament?.staffMembers || []).find(
    (m) => m.user && String(m.user) === String(user?._id || '') && m.status === 'accepted',
  ) || null
}

// MISMA matriz que frontend/src/lib/staffPermissions.js (ROLE_DEFAULT_ACCESS)
// -- tienen que mantenerse iguales a mano, no hay una fuente compartida entre
// front y back todavia.
const ROLE_DEFAULT_ACCESS = {
  Director: {
    resumen: 'edit', competencia: 'edit', config: 'edit', equipos: 'edit', reglas: 'edit', checkin: 'edit', prizepool: 'edit',
    bracket: 'edit', ruleta: 'edit', marca: 'edit', colaboradores: 'edit', discord: 'edit', reportar: 'edit', resultados: 'edit',
  },
  Administrador: {
    resumen: 'edit', competencia: 'edit', config: 'edit', equipos: 'edit', reglas: 'edit', checkin: 'edit', prizepool: 'view',
    bracket: 'edit', ruleta: 'edit', marca: 'view', colaboradores: 'none', discord: 'edit', reportar: 'edit', resultados: 'view',
  },
  Arbitro: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'edit', prizepool: 'none',
    bracket: 'edit', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'edit', resultados: 'edit',
  },
  Moderador: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'edit', prizepool: 'none',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'edit', reportar: 'edit', resultados: 'view',
  },
  Caster: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'view',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'none', resultados: 'none',
  },
  Produccion: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'view',
    bracket: 'view', ruleta: 'none', marca: 'view', colaboradores: 'none', discord: 'none', reportar: 'none', resultados: 'none',
  },
  Coach: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'none',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'none', resultados: 'none',
  },
  Analista: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'view', prizepool: 'none',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'view', resultados: 'view',
  },
}

const ACCESS_RANK = { none: 0, view: 1, edit: 2 }

export function staffTabAccess(member, tabKey) {
  if (!member) return 'none'
  const override = member.permissions?.get ? member.permissions.get(tabKey) : member.permissions?.[tabKey]
  if (override && ACCESS_RANK[override] !== undefined) return override
  const defaults = ROLE_DEFAULT_ACCESS[member.role] || ROLE_DEFAULT_ACCESS.Moderador
  return defaults[tabKey] || 'none'
}

// Reemplaza assertCanManageTournament en los endpoints donde el staff invitado
// (no solo el organizador/admin) puede operar segun su pestana. El owner y un
// admin de GlitchGang siempre pasan, sin pasar por la matriz.
export function assertTabAccess(tournament, user, tabKey, required = 'edit') {
  if (!tournament) return Object.assign(new Error('Tournament not found'), { status: 404 })
  if (isPrivilegedForTournament(tournament, user)) return null
  const access = staffTabAccess(acceptedStaffMember(tournament, user), tabKey)
  if (ACCESS_RANK[access] >= ACCESS_RANK[required]) return null
  return Object.assign(new Error('You do not have permission to manage this tournament'), { status: 403 })
}

// Cada campo de updateTournament segun la pestana del panel que lo edita
// (ver frontend/src/pages/organizer/OrganizerTournamentManage/OrganizerTournamentManage.jsx,
// funciones TabConfig/TabReglas/TabCheckin/TabMarca/TabColaboradores). Un campo
// sin pestana clara (jurisdiction/law/complaintsChannel/mediaChannels/etc, hoy
// sin UI que los edite) cae en 'config', la mas conservadora entre las que el
// staff comun no tiene por defecto.
const FIELD_TAB_MAP = {
  title: ['config'], description: ['config'], visibility: ['config'], platform: ['config'],
  server: ['config'], series: ['config'], patch: ['config'], mapMode: ['config'], mapPool: ['config'],
  participationScope: ['config'], streamUrl: ['config'], streamLang: ['config'],
  contactEmail: ['config'], contactPhone: ['config'], contactDiscord: ['config'],
  modality: ['config'], timezone: ['config'], date: ['config'], endDate: ['config'],
  maxSlots: ['competencia', 'config'], entryFee: ['config'], minAge: ['config'], minorsAllowed: ['config'],
  allowedCountries: ['config'], status: ['config'], region: ['config'], format: ['competencia', 'config'], notes: ['config'],
  organizationContact: ['config'], organizationAddress: ['config'], mediaChannels: ['config'],
  mediaRetentionMonths: ['config'], competition: ['competencia', 'config'], seasonName: ['config'], seasonNumber: ['config'],
  gameId: ['config'], jurisdiction: ['config'], law: ['config'], complaintsChannel: ['config'],
  scheduledPublishAt: ['config'], lateRegistration: ['config'],
  checkinDeadline: ['checkin', 'config'], checkinConfig: ['checkin'], overcup: ['checkin'], matchSchedule: ['checkin'],
  rules: ['reglas'], rulesDocument: ['reglas'], rulesName: ['reglas'],
  logo: ['marca'], banner: ['marca'], primaryColor: ['marca'], organizerBrandName: ['marca'], sponsors: ['marca'],
  prizeType: ['prizepool'], currency: ['prizepool'], prizePool: ['prizepool'], prizes: ['prizepool'],
  prizeFundingStatus: ['prizepool'], prizeSponsor: ['prizepool'], prizeProofUrl: ['prizepool'],
  prizeDelivery: ['prizepool'], prizePayoutDeadline: ['prizepool'], prizeNotes: ['prizepool'],
  staff: ['colaboradores'], collaborators: ['colaboradores'],
  winner: ['bracket'], participants: ['bracket'],
  // staffMembers NO esta aca a proposito: sobreescribir el array completo por
  // PUT no notifica a los nuevos ni pasa por sanitizeStaffMembers y pisa
  // ediciones concurrentes -- usar POST/PATCH/DELETE /tournaments/:id/staff.
}

// El bot de Discord (discord-bot/) filtra TODO por tournament.organization,
// pero createTournament nunca lo asignaba -- ningun torneo creado desde el
// asistente le llegaba al bot. Servidor unico y compartido de GlitchGang
// (decision de producto ya tomada, ver tournament-discord-model): una sola
// Organization "GlitchGang" para todos los torneos propios. Cache simple en
// memoria de proceso para no hacer una query por torneo creado.
let glitchGangOrgIdCache = null
async function getGlitchGangOrganizationId(fallbackOwnerId) {
  if (glitchGangOrgIdCache) return glitchGangOrgIdCache
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) return null // sin servidor configurado, el bot no tiene a donde mirar todavia
  let org = await Organization.findOne({ discordGuildId: guildId }).select('_id').lean()
  if (!org) {
    org = await Organization.create({ name: 'GlitchGang', discordGuildId: guildId, owner: fallbackOwnerId })
  }
  glitchGangOrgIdCache = String(org._id)
  return glitchGangOrgIdCache
}

function notifyTournamentStaffInvitations(tournament, user) {
  for (const member of tournament.staffMembers || []) {
    if (!member.user || String(member.user) === String(user?._id)) continue
    sendNotif(member.user, {
      type: 'tournament_staff_invite',
      title: `Invitacion para ser ${member.role}`,
      message: `${user.nick || 'El organizador'} te invito a formar parte del staff de ${tournament.title} como ${member.role}. Responde desde tu panel de rol para confirmar disponibilidad, responsabilidades y reglas.`,
      link: '/torneos/invitaciones',
      meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title, role: member.role, actorNick: user.nick || 'El organizador', kind: 'staff_invite' },
    }).catch(() => {})
  }
}

function teamUserIds(team) {
  const ids = new Map()
  const add = (user, role = 'player') => {
    const id = String(user?._id || user?.id || user || '')
    if (!id) return
    ids.set(id, {
      id,
      nick: user?.nick || user?.playerCode || 'Jugador',
      playerCode: user?.playerCode || '',
      role,
    })
  }
  add(team?.leader, 'leader')
  for (const member of team?.members || []) add(member, 'player')
  return ids
}

function requiredPlayersForTournament(tournament) {
  const text = `${tournament?.modality || ''} ${tournament?.category || ''}`.toLowerCase()
  const match = text.match(/(\d+)\s*v\s*\d+/)
  if (match) return Math.max(1, Number(match[1]) || 5)
  if (text.includes('solo') || text.includes('1v1') || text.includes('individual')) return 1
  if (text.includes('duo') || text.includes('2v2')) return 2
  if (text.includes('trio') || text.includes('3v3')) return 3
  return 5
}

function normalizeRosterSlot(slot) {
  if (!slot || typeof slot !== 'object') return null
  const identity = String(slot.id || slot.playerCode || slot.userId || '').trim()
  const gameId = String(slot.gameId || '').trim()
  const nick = String(slot.nick || slot.name || slot.fullName || '').trim()
  if (!identity && !gameId && !nick) return null
  return {
    nick: nick || identity || gameId || 'Jugador',
    identity,
    gameId,
    discordId: String(slot.discordId || '').trim(),
  }
}

function validateTeamTournamentEligibility(team, tournament) {
  const required = requiredPlayersForTournament(tournament)
  const issues = []
  const members = Array.isArray(team?.members) ? team.members : []
  const memberByCode = new Map(members.map(m => [String(m?.playerCode || m?._id || '').trim(), m]).filter(([key]) => key))
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const titularSlots = Array.from({ length: required }, (_, index) => normalizeRosterSlot(slots[`titular-${index + 1}`]))
  const hasRosterSlots = Object.keys(slots).some(key => key.startsWith('titular-'))
  const players = hasRosterSlots ? titularSlots.filter(Boolean) : members.slice(0, required)

  if (players.length < required) {
    issues.push(`Faltan ${required - players.length} jugador(es) titular(es). Este torneo requiere ${required}.`)
  }

  const missingIdentity = []
  const missingDiscord = []
  players.forEach((player, index) => {
    const code = String(player?.identity || player?.playerCode || player?._id || player?.id || '').trim()
    const member = memberByCode.get(code) || null
    const nick = player?.nick || player?.nickName || member?.nick || `Titular ${index + 1}`
    const hasIdentity = Boolean(code || player?.gameId || member?.playerCode)
    const hasDiscord = Boolean(player?.discordId || member?.discord?.id)
    if (!hasIdentity) missingIdentity.push(nick)
    if (!hasDiscord) missingDiscord.push(nick)
  })

  if (missingIdentity.length) issues.push(`Falta validar perfil competitivo de: ${missingIdentity.join(', ')}.`)
  if (missingDiscord.length) issues.push(`Falta Discord vinculado de: ${missingDiscord.join(', ')}.`)

  return { ok: issues.length === 0, required, issues, rosterCount: players.length, missingDiscord }
}

async function notifyRosterLock({ tournament, team, conflict }) {
  const title = 'Roster Lock: jugador duplicado'
  const message = `${conflict.nick} ya figura en ${conflict.otherTeamName} para ${tournament.title}. Un jugador solo puede competir con un equipo por torneo.`
  const link = `/torneos/${tournament.publicId || tournament._id}`
  const leaders = [team?.leader, conflict.otherTeamLeader].map(item => String(item?._id || item || '')).filter(Boolean)
  const recipients = Array.from(new Set([conflict.id, ...leaders].filter(Boolean)))
  await Promise.all(recipients.map(userId => sendNotif(userId, {
    type: 'tournament_roster_lock',
    title,
    message,
    link,
    meta: {
      tournamentId: String(tournament._id),
      tournamentTitle: tournament.title,
      tournamentGame: tournament.game,
      blockedTeamId: String(team._id),
      blockedTeamName: team.name,
      otherTeamId: String(conflict.otherTeamId),
      otherTeamName: conflict.otherTeamName,
      playerId: conflict.id,
      playerCode: conflict.playerCode,
    },
  })))
}

async function notifyTournamentRegistrationNextSteps({ tournament, team, user, registration, eligibility }) {
  const tournamentPath = `/torneos/${tournament.publicId || tournament._id}`
  const teamPanelPath = '/mi-equipo/enfrentamiento'
  const teamName = team?.name || 'tu equipo'
  const tournamentTitle = tournament?.title || 'el torneo'
  const captainNick = user?.nick || team?.leader?.nick || 'lider'
  // Tarjeta "Capitán y Miembros": le llega a todo el equipo, no solo al lider.
  const leaderIds = new Set([String(team?.leader?._id || team?.leader || ''), String(user?._id || '')].filter(Boolean))
  const recipients = Array.from(new Set([
    ...leaderIds,
    ...(team?.members || []).map(m => String(m?._id || m || '')).filter(Boolean),
  ]))
  const leaderMessage = `${teamName} ya esta inscrito en ${tournamentTitle}. Como lider, revisa el roster, entra al Discord oficial y queda atento al check-in.`.slice(0, 400)
  const memberMessage = `${teamName} ya esta inscrito en ${tournamentTitle}. Entra al Discord oficial y queda atento al check-in.`.slice(0, 400)

  await Promise.all(recipients.map(userId => sendNotif(userId, {
    type: 'tournament_registration_next_steps',
    title: `Siguientes pasos: ${tournamentTitle}`.slice(0, 120),
    message: leaderIds.has(userId) ? leaderMessage : memberMessage,
    link: teamPanelPath,
    meta: {
      tournamentId: String(tournament._id),
      tournamentPublicId: tournament.publicId || tournament.tournamentCode || '',
      tournamentTitle,
      tournamentGame: tournament.game || '',
      teamId: String(team._id),
      teamName,
      captainNick,
      registrationId: String(registration?._id || ''),
      discordUrl: GLITCHGANG_DISCORD_URL,
      tournamentPath,
      teamPanelPath,
      modality: tournament.modality || '',
      startsAt: tournament.date ? new Date(tournament.date).toISOString() : null,
      tournamentBanner: tournament.banner || '',
      ...(eligibility ? {
        rosterCount: eligibility.rosterCount,
        rosterRequired: eligibility.required,
        missingDiscord: eligibility.missingDiscord || [],
      } : {}),
      checkinOpensMinutesBefore: tournament.checkinConfig?.prematchMins ?? null,
      nextSteps: [
        'Revisa que titulares, suplentes y staff tengan su perfil completo.',
        'Entra al Discord oficial de GlitchGang; ahi salen avisos, sala, check-in y cambios importantes.',
        'Abre Mi Equipo -> Enfrentamiento para ver rival, bracket y estado del torneo cuando el organizador lo publique.',
        'Mantente pendiente del check-in; si el horario aun no esta fijado, el panel y Discord te avisaran.',
      ],
    },
  })))
}

function actorRoleLabel(tournament, user) {
  if (isTournamentOwner(tournament, user)) return 'Organizador'
  const role = String(user?.role || '').toLowerCase()
  const roles = (user?.roles || user?.creatorRoles || []).map(r => String(r).toLowerCase())
  if (role === 'admin' || roles.includes('admin')) return 'Admin GlitchGang'
  return acceptedStaffMember(tournament, user)?.role || 'Staff'
}

// Log de auditoria por torneo -- best effort, nunca bloquea la respuesta
// principal del endpoint que lo llama si falla. Un helper por endpoint (no
// un middleware generico) porque cada uno sabe mejor que nadie cual es el
// resumen legible de lo que cambio.
async function logTournamentActivity(tournament, user, { action, tabKey = null, summary, meta = null }) {
  try {
    await TournamentAuditLog.create({
      tournament: tournament._id,
      user: user._id,
      userNick: user.nick || user.email || 'Usuario',
      role: actorRoleLabel(tournament, user),
      action,
      tabKey,
      summary,
      meta,
    })
  } catch (err) {
    console.error('[tournament-audit] failed to log activity:', err.message)
  }
}

function mapRegistration(reg) {
  const team = reg.team && typeof reg.team === 'object' ? reg.team : null
  const user = reg.user && typeof reg.user === 'object' ? reg.user : null
  return {
    id: String(reg._id),
    teamId: team?._id || reg.team,
    teamPublicCode: team?.publicCode || '',
    teamInternalCode: team?.internalCode || '',
    userId: user?._id || reg.user,
    userNick: user?.nick || '',
    userPlayerCode: user?.playerCode || '',
    name: team?.name || user?.nick || reg.teamMeta?.name || (user ? 'Jugador' : 'Equipo'),
    tag: team?.tag || '',
    color: team?.color || '',
    logo: team?.logo || '',
    status: reg.status || 'registered',
    registeredAt: reg.registeredAt,
    registeredBy: reg.registeredBy,
    teamMeta: reg.teamMeta || {},
    discordRoom: reg.discordProvision || null,
  }
}

export async function createTournament(req, res, next) {
  try {
    const creationKey = typeof req.body.creationKey === 'string' ? req.body.creationKey : undefined
    if (creationKey) {
      const existing = await Tournament.findOne({ organizer: req.user._id, creationKey })
      if (existing) return res.json(existing)
    }
    let setup = null
    if (req.body.setupVersion === 1) {
      const { form, issues } = validateTournamentSetup(req.body)
      if (Object.keys(issues).length) return res.status(400).json({ message: Object.values(issues).join(' '), fields: issues })
      setup = form
      if (setup.sourceTournament && (!mongoose.Types.ObjectId.isValid(setup.sourceTournament) || !await Tournament.exists({ _id: setup.sourceTournament, organizer: req.user._id }))) {
        return res.status(403).json({ message: 'Solo puedes reutilizar tus propios torneos.' })
      }
    }
    // Discord solo se activa si: modo GlitchGang + consentimiento + el admin
    // ya habilito a este organizador. Si no, el torneo se publica sin Discord.
    const discordAllowed = setup?.discordMode === 'glitchgang' && req.user.organizerDiscord?.status === 'enabled'
    if (discordAllowed && !setup.discordConsent) {
      return res.status(400).json({ message: 'Debes autorizar al bot a crear los canales y roles del torneo.', fields: { discordConsent: 'Autorizacion requerida.' } })
    }
    const discordOn = Boolean(discordAllowed && setup.discordConsent)
    const {
      title, game, description, date, timezone,
      registrationStart, registrationEnd,
      format, modality, platform, region,
      maxSlots, prizePool, currency, entryFee,
      minAge, allowedCountries, notes, visibility,
    } = req.body

    // No hay pasarela real configurada ni cartera de organizador que respalde
    // un cobro -- el frontend ya fija el costo en $0, esto bloquea a quien le
    // pegue directo a la API. Ver BACKEND-PENDIENTE.md #pagos-no-hay-pasarela-real.
    if (Number(entryFee) > 0) {
      return res.status(400).json({ message: 'Cobro de inscripcion no disponible todavia. No hay pasarela de pago real configurada.' })
    }

    if (!title || !game || !date || !maxSlots || !registrationStart || !registrationEnd) {
      return res.status(400).json({ message: 'title, game, date, maxSlots, registrationStart and registrationEnd are required' })
    }
    const starts = Date.parse(date)
    const opens = Date.parse(registrationStart)
    const closes = Date.parse(registrationEnd)
    const lead = Date.now() + MIN_LEAD_MS
    if (![starts, opens, closes].every(Number.isFinite) || starts < lead || opens < lead || closes <= opens || closes > starts) {
      return res.status(400).json({ message: 'La apertura de inscripciones y el inicio deben ser al menos 2 horas despues, con cierre entre la apertura y el inicio.' })
    }

    const organizerCode = req.user.roleProfiles?.organizer?.organizerCode
    if (!organizerCode) {
      return res.status(403).json({ message: 'An approved organizerCode is required to create tournaments' })
    }
    const bannerUrl = req.file ? `/uploads/tournaments/${req.file.filename}` : ''
    const defaults = getTournamentDefaults({ title, game, prizePool, maxSlots, format, modality, platform, region })
    const requestedStatus = req.body.status === 'draft' ? 'draft' : 'open'
    const requestedVisibility = requestedStatus === 'draft' ? 'private' : (visibility || 'public')

    // Publicacion programada: solo tiene sentido para un torneo que se crea
    // sin publicar -- si ya se esta publicando ahora, no hay nada que programar.
    let scheduledPublishAt = null
    if (requestedStatus === 'draft' && req.body.scheduledPublishAt) {
      const parsed = new Date(req.body.scheduledPublishAt)
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        return res.status(400).json({ message: 'La fecha de publicacion programada debe ser futura.' })
      }
      scheduledPublishAt = parsed
    }

    const tournament = await Tournament.create({
      title, game, description: description || '',
      banner: bannerUrl,
      date: new Date(date),
      timezone: timezone || 'UTC',
      registrationWindow: {
        start: new Date(registrationStart),
        end:   new Date(registrationEnd),
      },
      format: format || 'single_elimination',
      modality: modality || defaults.modality || '5v5',
      platform: platform || defaults.platform || 'pc',
      region: region || defaults.region || '',
      maxSlots: Number(maxSlots || defaults.maxSlots),
      prizePool: prizePool ? Number(prizePool) : 0,
      currency: currency || 'USD',
      entryFee: entryFee ? Number(entryFee) : 0,
      minAge: minAge ? Number(minAge) : 0,
      allowedCountries: allowedCountries || [],
      notes: notes || defaults.notes,
      visibility: requestedVisibility,
      organizer: req.user._id,
      status: 'draft',
      scheduledPublishAt,
      server: defaults.server,
      series: defaults.series,
      patch: defaults.patch,
      mapPool: defaults.mapPool,
      prizeType: defaults.prizeType,
      prizes: defaults.prizes,
      contactDiscord: defaults.contactDiscord,
      streamLang: defaults.streamLang,
      jurisdiction: defaults.jurisdiction,
      law: defaults.law,
      complaintsChannel: defaults.complaintsChannel,
      staff: defaults.staff,
      rules: defaults.rules,
      ...(setup ? {
        ...Object.fromEntries(Object.entries(setup).filter(([key]) => !['date', 'registrationStart', 'registrationEnd', 'acceptTerms', 'discordMode', 'discordConsent'].includes(key))),
        setupVersion: 1,
        sourceTournament: setup.sourceTournament || null,
        seriesId: setup.seriesId || new mongoose.Types.ObjectId().toString(),
        discordEnabled: discordOn,
        discordConsent: discordOn ? { acceptedAt: new Date(), acceptedBy: req.user._id } : { acceptedAt: null, acceptedBy: null },
        format: SYSTEM_TO_FORMAT[setup.competition?.system] || 'single_elimination',
        series: setup.competition?.defaultSeries || 'BO1',
        endDate: new Date(setup.endDate),
        checkinDeadline: setup.checkinDeadline ? new Date(setup.checkinDeadline) : null,
        allowedCountries: setup.participationScope === 'regional' ? setup.allowedCountries : [],
        overcup: {
          enabled: setup.overcupEnabled, locked: setup.overcupLocked, secondCheckinHours: Number(setup.secondCheckinHours),
          secondCheckinDeadline: setup.overcupEnabled && setup.secondCheckinDeadline ? new Date(instant(setup.secondCheckinDeadline, setup.timezone)) : null,
        },
        staff: {
          director: setup.staffMembers.filter(s => s.role === 'Director').map(s => s.name).join(', '),
          admin: setup.staffMembers.filter(s => s.role === 'Administrador').map(s => s.name).join(', '),
          arbitros: setup.staffMembers.filter(s => s.role === 'Arbitro').map(s => s.name),
        },
        visibility: requestedVisibility,
        status: requestedStatus,
      } : {}),
      ...(creationKey ? { creationKey } : {}),
    })

    if (creationKey) await TournamentDraft.deleteOne({ owner: req.user._id, creationKey }).catch(() => {})

    // Sin esto el bot de Discord nunca encuentra el torneo (ver getGlitchGangOrganizationId).
    const orgId = await getGlitchGangOrganizationId(req.user._id).catch(() => null)
    if (orgId) {
      tournament.organization = orgId
      await tournament.save()
    }

    if (tournament.discordEnabled && tournament.status !== 'draft') {
      tournament.discordProvision = {
        ...(tournament.discordProvision?.toObject?.() || tournament.discordProvision || {}),
        status: 'pending',
        guildId: process.env.DISCORD_GUILD_ID || '',
        error: '',
      }
      await tournament.save()
      await syncTournamentCreatedToCrm(tournament, req.user).catch(async (error) => {
        tournament.discordProvision.status = 'failed'
        tournament.discordProvision.error = `CRM no recibio el torneo: ${error.message}`
        tournament.discordProvision.lastSyncAt = new Date()
        await tournament.save().catch(() => {})
      })
    }

    // Avisar a cada perfil real agregado como staff cuando el torneo queda publicado.
    if (tournament.status !== 'draft') notifyTournamentStaffInvitations(tournament, req.user)

    res.status(201).json(tournament)
  } catch (err) {
    if (err.code === 11000 && req.body.creationKey) {
      const existing = await Tournament.findOne({ organizer: req.user._id, creationKey: req.body.creationKey }).catch(() => null)
      if (existing) return res.json(existing)
    }
    next(err)
  }
}

// Lista publica: el bracket solo si esta publicado, y sin los registros
// internos (processedResults, remindersSent, titlesKey). Igual que getBracket,
// que ya ocultaba el no publicado.
function publicBracketSummary(doc) {
  if (!doc?.published) return { published: false }
  const { published, status, format, teams, results, champion } = doc
  return { published, status, format, teams, results, champion }
}
export async function getBroadcastKit(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
      .select('title organizer staffMembers staff.casters registrations')
      .populate('registrations.team', 'name tag color logo leader members rosterSlots')
      .lean()
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    const userId = String(req.user?._id || '')
    const isCaster = (tournament.staff?.casters || []).some(c => String(c.user) === userId && !c.removedAt)
    const permissionError = isCaster ? null : assertTabAccess(tournament, req.user, 'equipos', 'view')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const registrations = tournament.registrations || []
    const ids = broadcastKitUserIds(registrations).filter(id => mongoose.isValidObjectId(id))
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select('nick avatar').lean() : []
    const usersById = new Map(users.map(u => [String(u._id), u]))

    res.json({
      tournament: { id: String(tournament._id), title: tournament.title || '' },
      teams: buildBroadcastTeams(registrations, usersById),
    })
  } catch (err) { next(err) }
}

export async function listTournaments(req, res, next) {
  try {
    const { game, status, page = 1, limit = 20, mine } = req.query
    const filter = mine === 'true' && req.user
      ? { organizer: req.user._id }
      : { visibility: 'public' }
    if (game) filter.game = game
    if (status) filter.status = status

    const tournaments = await Tournament.find(filter)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('organizer', 'nick avatar website social roleProfiles.organizer.organizerCode')
      .lean()

    const total = await Tournament.countDocuments(filter)
    const ownList = mine === 'true' && req.user
    res.json({
      tournaments: tournaments.map(tournament => sanitizeTournamentIdentityPayload(
        applyTournamentDefaults(ownList ? tournament : { ...tournament, bracketDoc: publicBracketSummary(tournament.bracketDoc) }),
        req.user,
      )),
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    })
  } catch (err) { next(err) }
}

export async function getMyTournaments(req, res, next) {
  try {
    const tournaments = await Tournament.find({ organizer: req.user._id })
      .sort({ updatedAt: -1 })
      .populate('organizer', 'nick avatar website social roleProfiles.organizer.organizerCode')
      .lean()
    res.json({
      tournaments: tournaments.map(tournament => sanitizeTournamentIdentityPayload(applyTournamentDefaults(tournament), req.user)),
    })
  } catch (err) { next(err) }
}

// Solo cuenta como staff aceptado lo que de verdad paso por invitacion/aceptacion:
// `staffMembers` con su status real y casters activos (sin removedAt). Las
// coincidencias por nick en `staff.arbitros`/`collaborators` son texto libre
// que escribe el organizador -- cualquiera con ese nick "aparecia" como staff
// aceptado sin haber respondido nada. Ahora salen como 'unconfirmed' y no
// entran en ?status=accepted. ?role= filtra por rol en el servidor.
export async function getMyStaffTournaments(req, res, next) {
  try {
    const userId = String(req.user._id)
    const nick = String(req.user.nick || '').trim()
    const tournaments = await Tournament.find({
      $or: [
        { 'staff.casters': { $elemMatch: { user: req.user._id, removedAt: null } } },
        { 'staffMembers.user': req.user._id },
        ...(nick ? [{ 'staff.arbitros': nick }, { collaborators: nick }] : []),
      ],
    })
      .sort({ date: 1 })
      .populate('organizer', 'nick avatar website social roleProfiles.organizer.organizerCode')
      .lean()

    const wantStatus = String(req.query.status || '').trim()
    const normRole = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    const wantRole = normRole(req.query.role)
    const mapped = tournaments.map(tournament => {
      const row = sanitizeTournamentIdentityPayload(applyTournamentDefaults(tournament), req.user)
      const member = tournament.staffMembers?.find(m => String(m.user) === userId)
      const isCaster = tournament.staff?.casters?.some(caster => String(caster.user) === userId && !caster.removedAt)
      row.staffRole = isCaster ? 'caster' : member?.role || 'staff'
      row.staffStatus = member?.status || (isCaster ? 'accepted' : 'unconfirmed')
      row.staffInvitedAt = member?.invitedAt || null
      return row
    })
    const filtered = mapped
      .filter(t => !wantStatus || t.staffStatus === wantStatus)
      .filter(t => !wantRole || normRole(t.staffRole) === wantRole)
    res.json({ tournaments: filtered })
  } catch (err) { next(err) }
}

/**
 * GET /api/tournaments/by-team/:teamId — torneos donde ese equipo tiene una
 * inscripcion activa. Sin esto, la pestana "Enfrentamiento" (jugador/equipo)
 * no tiene de donde sacar en que torneo(s) buscar el bracket del equipo.
 */
export async function getTournamentsByTeam(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.teamId || ''))) {
      return res.status(400).json({ message: 'teamId invalido' })
    }
    const includeFinished = req.query.includeFinished === 'true'
    if (includeFinished && !await Team.exists({ _id: req.params.teamId, $or: [{ leader: req.user._id }, { members: req.user._id }] })) {
      return res.status(403).json({ message: 'Solo los integrantes pueden consultar el historial de torneos de este equipo.' })
    }
    const tournaments = await Tournament.find({
      'registrations.team': req.params.teamId,
      status: { $in: ['open', 'registration_closed', 'ongoing', ...(includeFinished ? ['finished'] : [])] },
    })
      .sort({ date: 1 })
      .populate('organizer', 'nick avatar website social roleProfiles.organizer.organizerCode')
      .lean()
    res.json({ tournaments: tournaments.map(tournament => sanitizeTournamentIdentityPayload(applyTournamentDefaults(tournament), req.user)) })
  } catch (err) { next(err) }
}

export async function searchTournaments(req, res, next) {
  try {
    const { q, game, status } = req.query
    // Borradores fuera aunque sean visibility 'public' (es el default al
    // crear) y q escapado: antes un ".*" o un patron con backtracking iba
    // directo a $regex.
    const filter = { visibility: 'public', status: { $ne: 'draft' } }
    if (q) filter.title = { $regex: escapeRegex(String(q).slice(0, 80)), $options: 'i' }
    if (game) filter.game = String(game)
    if (status && status !== 'draft') filter.status = String(status)

    const tournaments = await Tournament.find(filter)
      .sort({ date: 1 })
      .limit(20)
      .populate('organizer', 'nick avatar roleProfiles.organizer.organizerCode')
      .lean()

    res.json({ tournaments: tournaments.map(tournament => sanitizeTournamentIdentityPayload(applyTournamentDefaults(tournament), req.user)) })
  } catch (err) { next(err) }
}

// Un borrador o torneo privado solo lo ven su organizador, un admin, su staff
// y los equipos ya inscritos -- el resto recibe 404 (no revelar que existe).
async function canViewTournament(tournament, user) {
  if (tournament.status !== 'draft' && tournament.visibility !== 'private') return true
  if (!user) return false
  // `organizer` llega poblado aca (getTournament), no como id.
  const ownerId = tournament.organizer?._id || tournament.organizer
  if (isPrivilegedForTournament({ ...tournament, organizer: ownerId }, user)) return true
  const userId = String(user._id)
  if ((tournament.staffMembers || []).some(m => String(m.user) === userId)) return true
  if ((tournament.staff?.casters || []).some(c => String(c.user) === userId && !c.removedAt)) return true
  const teamIds = (tournament.registrations || []).map(r => r.team?._id || r.team).filter(Boolean)
  if (!teamIds.length) return false
  return Boolean(await Team.exists({ _id: { $in: teamIds }, $or: [{ leader: user._id }, { members: user._id }] }))
}

// Un staff invitado con 'Sin acceso' a una pestana no deberia recibir esos
// campos por la API -- hasta ahora la pestana solo se ocultaba en el
// frontend, pero el documento completo ya habia viajado al navegador. Ver
// BACKEND-PENDIENTE.md #staff-get-sin-redaccion. Solo aplica a staff
// ACEPTADO del torneo: un visitante publico o un jugador inscrito (que no
// son staff) siguen viendo la pagina publica del torneo tal cual, ya que
// staffTabAccess(null, tab) no entra en este camino.
//
// Ojo: NO se reusa FIELD_TAB_MAP entero para esto. Esa tabla mapea campo ->
// pestana que lo EDITA, pero varios de esos campos (title, status,
// visibility, maxSlots, format...) los LEE tambien la pestana Resumen, que
// todo staff aceptado ve por defecto -- borrarlos segun el acceso a 'config'
// (que la mayoria de los roles tiene en 'none') rompia Resumen para casi
// todo el staff. Se redactan solo los 2 campos que son 100% exclusivos de su
// propia pestana y no se leen en ningun otro lado del panel: el roster de
// staffMembers (pestana Colaboradores) y los reports (pestana Reportar).
function redactTournamentForStaffAccess(tournament, user) {
  if (isPrivilegedForTournament(tournament, user)) return tournament
  const staffMember = acceptedStaffMember(tournament, user)
  if (!staffMember) return tournament

  if (staffTabAccess(staffMember, 'colaboradores') === 'none' && Array.isArray(tournament.staffMembers)) {
    // No se borra el array entero: el propio front usa
    // staffMembers.find(m => m.user === miId) para resolver su propio acceso
    // (OrganizerTournamentManage.jsx, OrganizerLayout.jsx) -- borrarlo del
    // todo lo dejaria bloqueado a el mismo. Se queda solo su propia entrada,
    // se esconde el resto del roster (nombres/contacto/permisos de los demas).
    const myId = String(user._id)
    tournament.staffMembers = tournament.staffMembers.filter(m => String(m.user) === myId)
  }
  if (staffTabAccess(staffMember, 'reportar') === 'none') delete tournament.reports

  return tournament
}

// Poster de campeon: "Bicampeon · 2 de 2 ediciones". Cuenta las ediciones
// terminadas de la serie HASTA esta (la edicion 1 no pasa a decir
// "Bicampeon" cuando gane la 2). Por equipo (Team.titles) para que un cambio
// de nombre no rompa la cuenta; por nombre si los titulos no existen.
async function seriesChampionOf(tournament) {
  const editions = await Tournament.find({
    seriesId: tournament.seriesId,
    status: 'finished',
    // Por fecha y no por seasonNumber: las ediciones viejas pueden tener
    // todas seasonNumber 1 (el default) y contarian ediciones posteriores.
    date: { $lte: tournament.date },
  }).select('_id winner').lean()
  const editionIds = editions.map(e => String(e._id))
  const championTeam = await Team.findOne({ titles: { $elemMatch: { tournament: tournament._id, placement: 1 } } }).select('titles').lean()
  let titles
  if (championTeam) {
    titles = (championTeam.titles || []).filter(title => title.placement === 1 && editionIds.includes(String(title.tournament))).length
  } else {
    const norm = value => String(value || '').trim().toLowerCase()
    titles = editions.filter(e => norm(e.winner) === norm(tournament.winner)).length
  }
  return { titles: Math.max(1, titles), editions: editions.length }
}

export async function getTournament(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
      .populate('organizer', 'nick avatar website social roleProfiles.organizer.organizerCode')
      .populate('registrations.team', 'name tag color logo publicCode internalCode')
      .populate('registrations.user', 'nick playerCode discord countryCode')
      .lean()
    if (!tournament || !(await canViewTournament(tournament, req.user))) return res.status(404).json({ message: 'Tournament not found' })
    if (tournament.status === 'finished' && tournament.winner && tournament.seriesId) {
      tournament.seriesChampion = await seriesChampionOf(tournament)
    }
    const payload = redactTournamentForStaffAccess(applyTournamentDefaults(tournament), req.user)
    res.json(sanitizeTournamentIdentityPayload(payload, req.user))
  } catch (err) { next(err) }
}

export async function updateTournament(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    const allowed = Object.keys(FIELD_TAB_MAP)
    const privileged = isPrivilegedForTournament(tournament, req.user)
    let staffMember = null
    if (!privileged) {
      staffMember = acceptedStaffMember(tournament, req.user)
      if (!staffMember) {
        return res.status(403).json({ message: 'You do not have permission to manage this tournament' })
      }
    }
    // El staff invitado solo puede escribir los campos de las pestanas donde
    // tiene 'edit' -- el resto del body se ignora en silencio (mismo criterio
    // que el resto de este endpoint con campos no reconocidos). El owner/admin
    // no pasan por este filtro.
    const canWriteField = (field) => privileged
      || (FIELD_TAB_MAP[field] || []).some(tab => staffTabAccess(staffMember, tab) === 'edit')

    // Mismo candado que createTournament: no hay pasarela real ni cartera de
    // organizador que respalde un cobro. Ver BACKEND-PENDIENTE.md #pagos-no-hay-pasarela-real.
    if (req.body.entryFee !== undefined && Number(req.body.entryFee) > 0) {
      return res.status(400).json({ message: 'Cobro de inscripcion no disponible todavia. No hay pasarela de pago real configurada.' })
    }

    if (req.body.maxSlots !== undefined && canWriteField('maxSlots') && Number(req.body.maxSlots) < (tournament.registrations || []).filter(r => r.status !== 'withdrawn').length) {
      return res.status(400).json({ message: 'El cupo no puede ser menor que los equipos ya inscritos.' })
    }

    // Estructura competitiva: normalizada y validada igual que al crear, y con
    // el mismo candado que la pestana Competencia (shared/competitionLock.mjs):
    // con el bracket generado no se cambia sistema/grupos/puntuacion/cupos, y
    // la serie de una ronda ya jugada tampoco.
    const touchesCompetition = (req.body.competition !== undefined && canWriteField('competition'))
      || (req.body.maxSlots !== undefined && canWriteField('maxSlots'))
    if (touchesCompetition) {
      const current = tournament.toObject({ flattenMaps: true })
      const before = { competition: current.competition, maxSlots: current.maxSlots }
      const maxSlotsAfter = req.body.maxSlots !== undefined && canWriteField('maxSlots') ? Number(req.body.maxSlots) : current.maxSlots
      let competitionAfter = current.competition
      if (req.body.competition !== undefined && canWriteField('competition')) {
        competitionAfter = normalizeCompetition(req.body.competition || {}, maxSlotsAfter)
        const errors = validateCompetition(competitionAfter, maxSlotsAfter)
        if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors).join(' ') })
        req.body.competition = { ...competitionAfter, configVersion: current.competition?.configVersion || 2 }
      }
      const violation = competitionLockViolation(current.bracketDoc, before, { competition: competitionAfter, maxSlots: maxSlotsAfter })
      if (violation) return res.status(409).json({ code: 'BRACKET_LOCKED', message: violation })
    }

    const previousStatus = tournament.status
    const changedFields = []
    allowed.forEach(f => { if (req.body[f] !== undefined && canWriteField(f)) { tournament[f] = req.body[f]; changedFields.push(f) } })
    // Hora limite nueva = el cierre automatico del check-in (checkinClose.service.js)
    // tiene que volver a correr con ella, aunque ya hubiera cerrado con la anterior.
    if (changedFields.includes('checkinDeadline') || changedFields.includes('checkinConfig')) tournament.checkinClosedAt = null

    // discordEnabled solo se puede encender si un admin ya habilito a este
    // organizador para el Discord de GlitchGang.
    let turningDiscordOn = false
    if (req.body.discordEnabled !== undefined && (privileged || staffTabAccess(staffMember, 'discord') === 'edit')) {
      const wants = req.body.discordEnabled === true
      if (wants && !tournament.discordEnabled && req.user.organizerDiscord?.status !== 'enabled') {
        return res.status(409).json({ message: 'Un admin de GlitchGang tiene que habilitarte Discord antes de conectar un torneo.' })
      }
      turningDiscordOn = wants && !tournament.discordEnabled
      tournament.discordEnabled = wants
      if (wants && !tournament.discordConsent?.acceptedAt) {
        tournament.discordConsent = { acceptedAt: new Date(), acceptedBy: req.user._id }
      }
      changedFields.push('discordEnabled')
    }

    // "Solo equipos universitarios": antes nada lo podia escribir, asi que el
    // chequeo de registerTeamForUser nunca corria y el ranking universitario
    // (que solo cuenta estos torneos) no podia sumar puntos.
    if (req.body.universityOnly !== undefined && canWriteField('config')) {
      const wants = req.body.universityOnly === true
      if (wants !== Boolean(tournament.eligibility?.universityOnly)) {
        if (tournament.status === 'finished') {
          return res.status(409).json({ message: 'El torneo ya terminó: cambiar si es universitario alteraría el ranking universitario.' })
        }
        if (wants && !isUniversityGameAllowed(tournament.gameId || tournament.game)) {
          return res.status(400).json({ message: `${tournament.game || 'Este juego'} no es parte de la competencia universitaria (${UNIVERSITY_ALLOWED_GAMES_LIST.join(', ')}).` })
        }
        if (wants) {
          const teamIds = (tournament.registrations || []).filter(r => r.status !== 'withdrawn' && r.team).map(r => r.team)
          const notUniversity = await Team.find({ _id: { $in: teamIds }, 'university.isUniversityTeam': { $ne: true } }).select('name').lean()
          if (notUniversity.length) {
            return res.status(409).json({ message: `Ya hay equipos inscritos que no son universitarios: ${notUniversity.map(t => t.name).join(', ')}.` })
          }
        }
        tournament.eligibility = { ...(tournament.eligibility?.toObject?.() || tournament.eligibility || {}), universityOnly: wants }
        changedFields.push('universityOnly')
      }
    }

    if (req.body.registrationStart || req.body.registrationEnd) {
      tournament.registrationWindow = {
        start: new Date(req.body.registrationStart ?? tournament.registrationWindow.start),
        end:   new Date(req.body.registrationEnd   ?? tournament.registrationWindow.end),
      }
      changedFields.push('registrationWindow')
    }

    const scheduleChanged = ['date', 'endDate', 'registrationStart', 'registrationEnd', 'timezone', 'checkinDeadline'].some(key => req.body[key] !== undefined)
    const tournamentAlreadyStarted = ['ongoing', 'finished', 'cancelled'].includes(tournament.status)
    if (scheduleChanged && tournament.setupVersion === 1 && !tournamentAlreadyStarted) {
      const errors = scheduleErrors({
        ...tournament.toObject(),
        date: tournament.date?.toISOString(), endDate: tournament.endDate?.toISOString(),
        registrationStart: tournament.registrationWindow.start?.toISOString(),
        registrationEnd: tournament.registrationWindow.end?.toISOString(),
        checkinDeadline: tournament.checkinDeadline?.toISOString(),
      }, Date.now(), { requireFuture: false })
      if (req.body.date && new Date(req.body.date).getTime() <= Date.now()) errors.date = 'El inicio debe ser futuro.'
      if (req.body.registrationStart && new Date(req.body.registrationStart).getTime() <= Date.now()) errors.registrationStart = 'La apertura debe ser futura.'
      if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors).join(' ') })
    }
    // Para TODOS los torneos (el bloque de arriba solo cubre setupVersion 1):
    // la ventana de inscripcion tiene que cerrar antes del inicio. Sin esto el
    // panel "Abrir 7 dias" dejaba inscribirse con el torneo ya empezado.
    if (scheduleChanged && !tournamentAlreadyStarted) {
      const opens = tournament.registrationWindow?.start?.getTime?.()
      const closes = tournament.registrationWindow?.end?.getTime?.()
      const starts = tournament.date ? new Date(tournament.date).getTime() : NaN
      if (!Number.isFinite(opens) || !Number.isFinite(closes)) {
        return res.status(400).json({ message: 'Fechas de inscripcion invalidas.' })
      }
      if (closes <= opens) {
        return res.status(400).json({ message: 'El cierre de inscripciones debe ser posterior a la apertura.' })
      }
      if (Number.isFinite(starts) && closes > starts) {
        return res.status(400).json({ message: 'El cierre de inscripciones no puede ser despues del inicio del torneo.' })
      }
    }

    if (turningDiscordOn && tournament.status !== 'draft' && !tournament.organization) {
      const orgId = await getGlitchGangOrganizationId(req.user._id).catch(() => null)
      if (orgId) tournament.organization = orgId
    }

    await tournament.save()
    if (previousStatus === 'draft' && tournament.status !== 'draft') notifyTournamentStaffInvitations(tournament, req.user)

    // Prender Discord en un torneo ya publicado no lo aprovisionaba: el sync
    // al CRM/bot solo corria en createTournament. Sin esto, el toggle
    // guardaba discordEnabled=true pero el bot nunca se enteraba.
    if (turningDiscordOn && tournament.status !== 'draft') {
      tournament.discordProvision = {
        ...(tournament.discordProvision?.toObject?.() || tournament.discordProvision || {}),
        status: 'pending',
        guildId: process.env.DISCORD_GUILD_ID || '',
        error: '',
      }
      await tournament.save()
      await syncTournamentCreatedToCrm(tournament, req.user).catch(async (error) => {
        tournament.discordProvision.status = 'failed'
        tournament.discordProvision.error = `CRM no recibio el torneo: ${error.message}`
        tournament.discordProvision.lastSyncAt = new Date()
        await tournament.save().catch(() => {})
      })
    }

    if (changedFields.length) {
      const primaryTab = FIELD_TAB_MAP[changedFields[0]]?.[0] || (changedFields[0] === 'discordEnabled' ? 'discord' : ['registrationWindow', 'universityOnly'].includes(changedFields[0]) ? 'config' : null)
      logTournamentActivity(tournament, req.user, {
        action: 'update', tabKey: primaryTab,
        summary: `Actualizó: ${changedFields.join(', ')}`,
      })
    }

    // Comunicado del cambio (pestana Competencia): avisa a equipos inscritos y
    // staff, Discord y queda en el historial. Solo si de verdad se guardo algo.
    const notice = changedFields.length ? sanitizeChangeNotice(req.body.changeNotice) : null
    if (notice) {
      const changeNotice = await sendChangeNotice(tournament, req.user, notice)
      pushAnnouncement(tournament, req.user, notice)
      await tournament.save()
      logTournamentActivity(tournament, req.user, {
        action: 'update', tabKey: notice.section || 'competencia',
        summary: announcementSummary(notice),
      })
      return res.json({ ...tournament.toObject(), changeNotice })
    }
    res.json(tournament)
  } catch (err) { next(err) }
}

/** GET /api/tournaments/:id/staff-room — sala de chat del staff (la crea si no existe). */
export async function getTournamentStaffRoom(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
      .select('title logo publicId organizer staffMembers staff.casters')
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    // Mismo 404 para quien no es del staff: no confirma que exista la sala.
    if (!isPrivilegedForTournament(tournament, req.user) && !acceptedStaffMember(tournament, req.user)) {
      return res.status(404).json({ message: 'Sala no encontrada' })
    }
    const room = await ensureStaffRoom(tournament)
    res.json({ conversation: await viewConversation(room.toObject(), [], req.user._id) })
  } catch (err) { next(err) }
}

/** POST /api/tournaments/:id/staff/casters — asigna un caster aprobado al torneo. */
export async function addTournamentCaster(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permError = assertTabAccess(tournament, req.user, 'colaboradores')
    if (permError) return res.status(permError.status).json({ message: permError.message })

    const { userId } = req.body
    if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) {
      return res.status(400).json({ message: 'userId invalido' })
    }

    const caster = await User.findById(userId).select('nick avatar roles roleProfiles.caster')
    if (!caster) return res.status(404).json({ message: 'Usuario no encontrado' })
    if (!caster.roles?.includes('caster') || !caster.roleProfiles?.caster?.approvedAt) {
      return res.status(400).json({ message: 'Este usuario no tiene el rol de caster aprobado' })
    }

    tournament.staff = tournament.staff || {}
    tournament.staff.casters = tournament.staff.casters || []
    const alreadyActive = tournament.staff.casters.some(c => String(c.user) === String(userId) && !c.removedAt)
    if (alreadyActive) return res.status(409).json({ message: 'Este caster ya esta asignado a este torneo' })

    tournament.staff.casters.push({
      user: caster._id,
      nick: caster.nick,
      avatar: caster.avatar,
      assignedBy: req.user._id,
      assignedAt: new Date(),
    })
    await tournament.save()
    syncStaffRoom(tournament)

    sendNotif(caster._id, {
      type: 'tournament_staff_added',
      title: 'Fuiste asignado como caster',
      message: `${req.user.nick || 'El organizador'} te asigno como caster en el torneo ${tournament.title}.`,
      link: `/torneos/${tournament.publicId || tournament._id}`,
      meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title, role: 'Caster' },
    }).catch(() => {})
    logTournamentActivity(tournament, req.user, { action: 'create', tabKey: 'colaboradores', summary: `Asignó a ${caster.nick} como caster` })

    res.json(tournament)
  } catch (err) { next(err) }
}

/** DELETE /api/tournaments/:id/staff/casters/:userId — remueve un caster con justificacion. */
export async function removeTournamentCaster(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permError = assertTabAccess(tournament, req.user, 'colaboradores')
    if (permError) return res.status(permError.status).json({ message: permError.message })

    const reason = String(req.body?.reason || '').trim()
    if (!reason) return res.status(400).json({ message: 'La justificacion es obligatoria' })

    const entry = tournament.staff?.casters?.find(c => String(c.user) === String(req.params.userId) && !c.removedAt)
    if (!entry) return res.status(404).json({ message: 'Caster no encontrado en este torneo' })

    entry.removedAt = new Date()
    entry.removedBy = req.user._id
    entry.removedReason = reason
    await tournament.save()
    syncStaffRoom(tournament)

    sendNotif(entry.user, {
      type: 'tournament_staff_removed',
      title: `Fuiste removido como caster de ${tournament.title}`,
      message: `Fuiste removido del staff de casters de ${tournament.title}. Motivo: ${reason}.`,
      link: `/torneos/${tournament.publicId || tournament._id}`,
      meta: { tournamentId: String(tournament._id), role: 'Caster', reason },
    }).catch(() => {})
    logTournamentActivity(tournament, req.user, { action: 'delete', tabKey: 'colaboradores', summary: `Removió a un caster. Motivo: ${reason}` })

    res.json(tournament)
  } catch (err) { next(err) }
}

/** PATCH /api/tournaments/:id/staff/response — el invitado acepta o rechaza. */
export async function respondStaffInvitation(req, res, next) {
  try {
    const decision = String(req.body?.decision || '').trim()
    const reason = String(req.body?.reason || '').trim().slice(0, 600)
    if (!['accept', 'decline'].includes(decision)) {
      return res.status(400).json({ message: 'decision debe ser accept o decline' })
    }
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    const entry = tournament.staffMembers?.find(m => String(m.user) === String(req.user._id))
    if (!entry) return res.status(404).json({ message: 'No tienes una invitacion de staff en este torneo' })
    if (entry.status !== 'pending') return res.status(409).json({ message: 'Esta invitacion ya fue respondida' })

    entry.status = decision === 'accept' ? 'accepted' : 'declined'
    entry.respondedAt = new Date()
    entry.responseReason = reason
    await tournament.save()
    syncStaffRoom(tournament)

    sendNotif(tournament.organizer, {
      type: 'tournament_staff_response',
      title: `Respuesta de invitacion de staff`,
      message: `${req.user.nick || 'Un integrante'} ${entry.status === 'accepted' ? 'acepto' : 'rechazo'} la invitacion para el rol ${entry.role} en ${tournament.title}.${reason ? ` Mensaje: ${reason}` : ''}`,
      link: `/torneos/${tournament.publicId || tournament._id}`,
      meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title, role: entry.role, status: entry.status, actorNick: req.user.nick || 'Un integrante', reason },
    }).catch(() => {})
    logTournamentActivity(tournament, req.user, { action: 'respond', tabKey: 'colaboradores', summary: `${entry.status === 'accepted' ? 'Aceptó' : 'Rechazó'} la invitación como ${entry.role}` })

    res.json({ status: entry.status })
  } catch (err) { next(err) }
}

/**
 * POST /api/tournaments/:id/staff — agrega un miembro (queda pending y se le
 * notifica). Reemplaza el PUT del array completo para no pisar ediciones
 * concurrentes ni saltarse sanitizeStaffMembers/la notificacion.
 */
export async function addStaffMember(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'colaboradores')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const [candidate] = sanitizeStaffMembers([{ user: req.body?.userId, role: req.body?.role, nick: req.body?.nick, avatar: req.body?.avatar, playerCode: req.body?.playerCode, platformRole: req.body?.platformRole }])
    if (!candidate) return res.status(400).json({ message: 'userId y role validos son requeridos' })
    if (tournament.staffMembers.some(m => String(m.user) === candidate.user)) {
      return res.status(409).json({ message: 'Esta persona ya es staff de este torneo' })
    }

    if (!req.body?.nick || !req.body?.avatar) {
      const profile = await User.findById(candidate.user).select('nick avatar').lean()
      if (!profile) return res.status(404).json({ message: 'Usuario no encontrado' })
      candidate.nick = candidate.nick || profile.nick
      candidate.name = candidate.nick
      candidate.avatar = candidate.avatar || profile.avatar || ''
    }

    tournament.staffMembers.push(candidate)
    await tournament.save()
    syncStaffRoom(tournament)
    const member = tournament.staffMembers[tournament.staffMembers.length - 1]

    sendNotif(member.user, {
      type: 'tournament_staff_invite',
      title: `Invitacion de staff: ${member.role}`,
      message: `${req.user.nick || 'El organizador'} te invito como ${member.role} en el torneo ${tournament.title}. Acepta o rechaza desde tu panel de rol.`,
      link: '/torneos/invitaciones',
      meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title, role: member.role, kind: 'staff_invite' },
    }).catch(() => {})
    logTournamentActivity(tournament, req.user, { action: 'create', tabKey: 'colaboradores', summary: `Invitó a ${member.nick || member.role} como ${member.role}` })

    res.status(201).json({ member, tournament: sanitizeTournamentIdentityPayload(tournament.toObject({ flattenMaps: true }), req.user) })
  } catch (err) { next(err) }
}

/**
 * POST /api/tournaments/:id/staff/apply — un caster/analista/coach/moderador/
 * creador/organizador se postula por su cuenta al staff de un torneo (antes
 * solo existia el camino inverso: el organizador busca y agrega). Queda en
 * `status: 'requested'` -- lo resuelve el organizador via updateStaffMember,
 * no el propio postulante (respondStaffInvitation es solo para invitaciones
 * que el organizador mando, direccion contraria). Ver BACKEND-PENDIENTE.md
 * #staff-autopostulacion.
 */
export async function applyForStaff(req, res, next) {
  try {
    const platformRole = String(req.body?.role || '').trim()
    if (!PLATFORM_STAFF_ROLES.includes(platformRole)) {
      return res.status(400).json({ message: 'role invalido' })
    }
    if (!req.user.roleProfiles?.[platformRole]?.approvedAt) {
      return res.status(403).json({ message: 'No tienes ese rol aprobado en tu cuenta' })
    }
    // Misma regla que el boton "Postularme" del frontend (shared/roleProfileCompleteness.mjs):
    // sin esto, llamar la API directo se saltaba el bloqueo.
    const details = req.user.roleProfiles?.[platformRole]?.details || {}
    const missing = missingProfileFields(platformRole, details)
    if (missing.length) {
      return res.status(400).json({
        code: 'PROFILE_INCOMPLETE',
        missing,
        message: `Completa tu perfil profesional antes de postularte. Falta: ${missing.join(', ')}.`,
      })
    }

    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    if (isTournamentOwner(tournament, req.user)) {
      return res.status(400).json({ message: 'Ya eres el organizador de este torneo' })
    }
    if (tournament.staffMembers.some(m => String(m.user) === String(req.user._id))) {
      return res.status(409).json({ message: 'Ya eres staff (o tienes una postulacion) en este torneo' })
    }

    const staffRole = STAFF_ROLE_BY_PLATFORM[platformRole] || 'Moderador'
    tournament.staffMembers.push({
      user: req.user._id,
      name: req.user.nick || 'Staff',
      nick: req.user.nick || '',
      avatar: req.user.avatar || '',
      platformRole,
      role: staffRole,
      status: 'requested',
      invitedAt: new Date(),
      // "Carta de presentacion": el organizador la ve en Colaboradores sin ir al buscador.
      applicationCard: JSON.stringify(details).length <= 8000 ? details : null,
    })
    await tournament.save()
    syncStaffRoom(tournament)
    const member = tournament.staffMembers[tournament.staffMembers.length - 1]

    sendNotif(tournament.organizer, {
      type: 'tournament_staff_request',
      title: `Postulacion de staff: ${staffRole}`,
      message: `${req.user.nick || 'Alguien'} se postulo como ${staffRole} para tu torneo ${tournament.title}. Revisa su perfil desde Colaboradores.`,
      link: `/organizador/torneo/${tournament.publicId || tournament._id}/gestionar/colaboradores`,
      meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title, role: staffRole, kind: 'staff_request' },
    }).catch(() => {})
    logTournamentActivity(tournament, req.user, { action: 'create', tabKey: 'colaboradores', summary: `Se postuló como ${staffRole}` })

    res.status(201).json({ member, tournament: sanitizeTournamentIdentityPayload(tournament.toObject({ flattenMaps: true }), req.user) })
  } catch (err) { next(err) }
}

/** PATCH /api/tournaments/:id/staff/:userId — cambia rol y/o permisos por pestana de un miembro. */
export async function updateStaffMember(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'colaboradores')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const member = tournament.staffMembers.find(m => String(m.user) === String(req.params.userId))
    if (!member) return res.status(404).json({ message: 'Staff member not found' })

    const summaryParts = []
    if (req.body?.role !== undefined) {
      if (!STAFF_ROLES.includes(req.body.role)) return res.status(400).json({ message: 'role invalido' })
      summaryParts.push(`rol -> ${req.body.role}`)
      member.role = req.body.role
    }
    if (req.body?.permissions && typeof req.body.permissions === 'object') {
      for (const [tabKey, level] of Object.entries(req.body.permissions)) {
        if (level === null) member.permissions.delete(tabKey)
        else if (ACCESS_RANK[level] !== undefined) member.permissions.set(tabKey, level)
      }
      summaryParts.push('permisos por pestaña')
    }
    // Resolver una POSTULACION (member.status === 'requested', ver
    // applyForStaff): solo el organizador/admin llega aca (assertTabAccess ya
    // filtro arriba), nunca el propio postulante -- a diferencia de una
    // invitacion que el organizador mando, esta la aprueba/rechaza quien la
    // recibe, no quien la mando. Una invitacion 'pending' normal sigue
    // resolviendose solo por respondStaffInvitation (el invitado, no aca).
    let notifyApplicant = null
    if (req.body?.status !== undefined) {
      if (member.status !== 'requested') {
        return res.status(409).json({ message: 'Solo se puede aceptar/rechazar una postulacion pendiente' })
      }
      if (!['accepted', 'declined'].includes(req.body.status)) {
        return res.status(400).json({ message: 'status invalido' })
      }
      member.status = req.body.status
      member.respondedAt = new Date()
      notifyApplicant = member.status
      summaryParts.push(member.status === 'accepted' ? 'postulación aceptada' : 'postulación rechazada')
    }
    await tournament.save()
    syncStaffRoom(tournament)
    if (summaryParts.length) {
      logTournamentActivity(tournament, req.user, { action: 'update', tabKey: 'colaboradores', summary: `Editó a ${member.nick || member.role} (${summaryParts.join(', ')})` })
    }
    if (notifyApplicant) {
      sendNotif(member.user, {
        type: 'tournament_staff_request_response',
        title: `Tu postulación de staff fue ${notifyApplicant === 'accepted' ? 'aceptada' : 'rechazada'}`,
        message: `Tu postulación como ${member.role} para ${tournament.title} fue ${notifyApplicant === 'accepted' ? 'aceptada' : 'rechazada'} por el organizador.`,
        link: `/torneos/${tournament.publicId || tournament._id}`,
        meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title, role: member.role, status: notifyApplicant },
      }).catch(() => {})
    }
    res.json({ member, tournament: sanitizeTournamentIdentityPayload(tournament.toObject({ flattenMaps: true }), req.user) })
  } catch (err) { next(err) }
}

/** DELETE /api/tournaments/:id/staff/:userId — quita a un miembro (avisa si ya habia confirmado). */
export async function removeStaffMember(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'colaboradores')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const member = tournament.staffMembers.find(m => String(m.user) === String(req.params.userId))
    if (!member) return res.status(404).json({ message: 'Staff member not found' })
    const wasAccepted = member.status === 'accepted'
    const { user: removedUserId, role: removedRole } = member

    tournament.staffMembers = tournament.staffMembers.filter(m => String(m.user) !== String(req.params.userId))
    await tournament.save()
    syncStaffRoom(tournament)

    if (wasAccepted) {
      sendNotif(removedUserId, {
        type: 'tournament_staff_removed',
        title: 'Fuiste removido del staff',
        message: `Ya no formas parte del staff (${removedRole}) del torneo ${tournament.title}.`,
        link: `/torneos/${tournament.publicId || tournament._id}`,
        meta: { tournamentId: String(tournament._id), role: removedRole },
      }).catch(() => {})
    }
    logTournamentActivity(tournament, req.user, { action: 'delete', tabKey: 'colaboradores', summary: `Quitó a un miembro del staff (${removedRole})` })

    res.json({ tournament: sanitizeTournamentIdentityPayload(tournament.toObject({ flattenMaps: true }), req.user) })
  } catch (err) { next(err) }
}

export async function getBracket(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id)).lean()
    if (!tournament || !(await canViewTournament(tournament, req.user))) return res.status(404).json({ message: 'Tournament not found' })
    // Un bracket sin publicar es borrador de quien organiza: el resto solo
    // recibe el flag, no equipos/seeds/resultados.
    if (!tournament.bracketDoc?.published && assertTabAccess(tournament, req.user, 'bracket', 'view')) {
      return res.json({ bracket: { published: false } })
    }
    res.json({ bracket: tournament.bracketDoc || { published: false } })
  } catch (err) { next(err) }
}

// Persiste el bracket que arma el organizador (formato, equipos, resultados,
// campeon). Antes escribia en campos (bracket/bracketResults/bracketState/
// winner) que no existian en el schema -- Mongoose (strict) los descartaba en
// silencio, la API respondia 200 pero getBracket siempre daba vacio.
export async function saveBracket(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'bracket')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const { published, status, format, results, teams, seedOrder, champion } = req.body || {}
    const doc = tournament.bracketDoc || {}
    const prevResults = doc.results || {}

    // "Regenerar bracket" (pestana Competencia) solo vale sin resultados
    // confirmados; la UI ya lo esconde, pero el servidor tambien lo frena.
    const hasConfirmed = Object.values(prevResults).some(result => result?.confirmed)
    const resetting = published === false && status === 'idle' && results && typeof results === 'object' && !Object.keys(results).length
    if (resetting && hasConfirmed) {
      return res.status(409).json({ code: 'BRACKET_LOCKED', message: 'El bracket ya tiene resultados confirmados: no se puede regenerar.' })
    }

    if (published !== undefined) doc.published = Boolean(published)
    if (status !== undefined) doc.status = status
    if (format !== undefined) doc.format = format
    if (Array.isArray(teams)) doc.teams = teams
    if (Array.isArray(seedOrder)) doc.seedOrder = seedOrder
    if (results && typeof results === 'object') {
      // El panel manda `results` entero desde lo que tiene en pantalla: un
      // resultado que el servidor confirmó mientras tanto (/report de Discord)
      // no viene ahí y se perdía. Lo confirmado solo se reemplaza, nunca se
      // descarta por omisión.
      const kept = Object.fromEntries(Object.entries(prevResults).filter(([id, r]) => r?.confirmed && !(id in results)))
      doc.results = { ...kept, ...results }
    }
    if (champion !== undefined) doc.champion = champion
    doc.updatedAt = new Date()

    // El campeon tiene que ser uno de los participantes del bracket.
    if (champion && doc.status === 'finished' && Array.isArray(doc.teams) && doc.teams.length && !doc.teams.includes(champion)) {
      return res.status(400).json({ message: 'El campeón debe ser uno de los equipos del bracket.' })
    }

    tournament.bracketDoc = doc
    tournament.markModified('bracketDoc.results')

    if (doc.status === 'finished' && doc.champion) {
      tournament.winner = doc.champion
      tournament.status = 'finished'
    } else if (doc.status === 'running' && ['open', 'registration_closed'].includes(tournament.status)) {
      tournament.status = 'ongoing'
    }

    await tournament.save()
    logTournamentActivity(tournament, req.user, {
      action: 'update', tabKey: 'bracket',
      summary: doc.status === 'finished' && doc.champion
        ? `Finalizó el bracket -- campeón: ${doc.champion}`
        : `Actualizó el bracket${doc.published ? ' (publicado)' : ''}`,
    })
    // Avisos web, stats de jugador, W/L del equipo y anuncios de Discord --
    // lo mismo que hace el camino /report de Discord (ver bracketSync.service.js).
    await onResultsConfirmed(tournament, prevResults, { source: 'organizer' }).catch((error) => {
      console.error('[bracket] onResultsConfirmed fallo:', error.message)
    })
    res.json({ bracket: tournament.bracketDoc, tournament: sanitizeTournamentIdentityPayload(tournament.toObject({ flattenMaps: true }), req.user) })
  } catch (err) { next(err) }
}

export async function getTournamentDiscordSummary(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
      .select('discordEnabled organization registrations')
      .populate('organization', 'name')
      .populate({
        path: 'registrations.team',
        select: 'name tag members',
        populate: { path: 'members', select: 'discord' },
      })
      .lean()
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    const teams = (tournament.registrations || [])
      .filter((reg) => reg.team)
      .map((reg) => {
        const team = reg.team
        const members = team.members || []
        return {
          id: String(team._id),
          name: team.name,
          tag: team.tag || '',
          playersCount: members.length,
          verifiedCount: members.filter((m) => m?.discord?.id).length,
          // Sala/rol de ESTE equipo en ESTE torneo (la crea el bot al
          // inscribirse) -- separado de "verifiedCount", que solo dice si
          // el jugador YA vinculo su cuenta de Discord, no si el bot ya le
          // armo la sala. Vive en la inscripcion, no en el equipo (un
          // equipo puede estar en varios torneos activos a la vez).
          discordProvision: reg.discordProvision || null,
        }
      })

    const matchSummary = { checking_in: 0, ready: 0, in_progress: 0, completed: 0, disqualified: 0, cancelled: 0 }
    let recentActivity = []

    if (tournament.discordEnabled && tournament.organization) {
      const matches = await TournamentMatch.find({ tournament: tournament._id })
        .sort({ updatedAt: -1 })
        .limit(50)
        .select('teamNameSnapshot status updatedAt')
        .lean()

      for (const m of matches) {
        if (matchSummary[m.status] !== undefined) matchSummary[m.status] += 1
      }
      recentActivity = matches.slice(0, 5).map((m) => ({
        id: String(m._id),
        teamName: m.teamNameSnapshot,
        status: m.status,
        updatedAt: m.updatedAt,
      }))
    }

    res.json({
      discordEnabled: Boolean(tournament.discordEnabled),
      hasOrganization: Boolean(tournament.organization),
      organizationName: tournament.organization?.name || null,
      teams,
      matchSummary,
      recentActivity,
    })
  } catch (err) { next(err) }
}

// Registro de lo que el bot mando o intento mandar solo (bienvenidas de
// equipo, anuncios, aprovisionamiento) -- DiscordProvisionLog ya se escribe
// desde completeIntegrationEvent/failIntegrationEvent
// (integrationEvents.controller.js), esto es simplemente lo primero que lo
// lee. Mismo control de acceso que getTournamentDiscordSummary (ninguno mas
// alla de requireAuth) para no quedar mas restrictivo que la pestaña que ya
// muestra ese resumen.
export async function getTournamentDiscordLog(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id)).select('_id organizer staffMembers').lean()
    // Solo staff con acceso a la pestaña Discord (antes cualquier usuario lo leía).
    const denied = assertTabAccess(tournament, req.user, 'discord', 'view')
    if (denied) return res.status(denied.status).json({ message: denied.message })

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40))
    const logs = await DiscordProvisionLog.find({ tournament: tournament._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('team', 'name')
      .lean()

    res.json({
      entries: logs.map((log) => ({
        id: String(log._id),
        createdAt: log.createdAt,
        action: log.action,
        status: log.status,
        message: log.message || '',
        teamName: log.team?.name || null,
      })),
    })
  } catch (err) { next(err) }
}

export async function retryTeamDiscordProvision(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
      .select('_id title organizer discordEnabled registrations staffMembers')
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    const denied = assertTabAccess(tournament, req.user, 'discord', 'edit')
    if (denied) throw denied
    if (!tournament.discordEnabled) {
      return res.status(400).json({ message: 'Discord no esta activo para este torneo.' })
    }

    const teamId = String(req.params.teamId || '')
    const registration = (tournament.registrations || []).find(reg => String(reg.team) === teamId)
    if (!registration) {
      return res.status(404).json({ message: 'Ese equipo no esta inscrito en este torneo.' })
    }

    registration.discordProvision = { status: 'pending', error: '', lastSyncAt: new Date() }
    await tournament.save()
    const event = await enqueueIntegrationEvent({
      type: 'discord.team.provision',
      entityType: 'team',
      entityId: teamId,
      payload: { tournamentId: tournament._id, teamId, registrationId: registration?._id },
      dedupe: false,
    })

    logTournamentActivity(tournament, req.user, {
      action: 'update',
      tabKey: 'discord',
      summary: 'Reintento la sincronizacion de Discord de un equipo.',
    })

    res.json({ ok: true, eventId: String(event._id || '') })
  } catch (err) { next(err) }
}

// La ayuda del panel de organizador siempre prometio un "Reintentar" junto
// al torneo cuando fallaba (ver DiscordHelpModal), pero nunca existio el
// endpoint -- el organizador se quedaba con el error en pantalla y sin
// forma de volver a pedirle al bot que cree la sala. Mismo mecanismo que
// usa la creacion del torneo (syncTournamentCreatedToCrm).
export async function retryTournamentDiscordProvision(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    const denied = assertTabAccess(tournament, req.user, 'discord', 'edit')
    if (denied) throw denied
    if (!tournament.discordEnabled) {
      return res.status(400).json({ message: 'Discord no esta activo para este torneo.' })
    }

    tournament.discordProvision = {
      ...(tournament.discordProvision?.toObject?.() || tournament.discordProvision || {}),
      status: 'pending',
      guildId: tournament.discordProvision?.guildId || process.env.DISCORD_GUILD_ID || '',
      error: '',
    }
    await tournament.save()

    try {
      await syncTournamentCreatedToCrm(tournament, req.user)
    } catch (error) {
      tournament.discordProvision.status = 'failed'
      tournament.discordProvision.error = `CRM no recibio el torneo: ${error.message}`
      tournament.discordProvision.lastSyncAt = new Date()
      await tournament.save().catch(() => {})
      throw error
    }

    logTournamentActivity(tournament, req.user, {
      action: 'update',
      tabKey: 'discord',
      summary: 'Reintento la creacion de la sala Discord del torneo.',
    })

    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function listRegistrations(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
      .populate('registrations.team', 'name tag color logo members leader')
      .populate('registrations.user', 'nick playerCode discord countryCode')
      .lean()
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    // Staff (cualquier pestaña con lectura) ve todo; el resto solo torneos
    // publicados y sin el código interno de los equipos (antes cualquier
    // usuario veía inscripciones de borradores/privados con teamInternalCode).
    const isStaff = ['checkin', 'bracket', 'reportar', 'colaboradores', 'discord']
      .some(tab => !assertTabAccess(tournament, req.user, tab, 'view'))
    if (!isStaff && (tournament.status === 'draft' || tournament.visibility === 'private')) {
      return res.status(403).json({ message: 'You do not have permission to view this tournament' })
    }
    res.json({
      registrations: (tournament.registrations || []).map(mapRegistration).map(reg => (isStaff ? reg : { ...reg, teamInternalCode: undefined })),
      checkin: tournament.checkin || {},
      currentSlots: tournament.currentSlots,
      maxSlots: tournament.maxSlots,
    })
  } catch (err) { next(err) }
}

export async function updateRegistrationCheckin(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'checkin')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const reg = tournament.registrations.id(req.params.rid)
    if (!reg) return res.status(404).json({ message: 'Registration not found' })

    const type = String(req.body?.type || 'checked_in')
    const statusByType = {
      on_time: 'checked_in',
      late: 'checked_in',
      checked_in: 'checked_in',
      no_show: 'disqualified',
      disqualified: 'disqualified',
      withdrawn: 'withdrawn',
      registered: 'registered',
    }
    reg.status = statusByType[type] || 'checked_in'

    const registrations = tournament.registrations || []
    tournament.checkin = {
      aTiempo: registrations.filter(r => r.status === 'checked_in').length,
      tarde: type === 'late' ? Number(tournament.checkin?.tarde || 0) + 1 : Number(tournament.checkin?.tarde || 0),
      noShow: registrations.filter(r => r.status === 'disqualified').length,
    }

    await tournament.save()
    if (reg.status === 'checked_in') {
      await saveRosterSnapshot(tournament._id, reg.team).catch((error) => {
        console.error('[Checkin] No se pudo guardar el rosterSnapshot:', error.message)
      })
      await autoGenerateBracketIfReady(tournament._id).catch((error) => {
        console.error('[Checkin] Auto-generacion de bracket fallo:', error.message)
      })
    }
    await tournament.populate('registrations.team', 'name tag color logo')
    await tournament.populate('registrations.user', 'nick')
    const checkedReg = tournament.registrations.id(req.params.rid)
    const regTeamName = checkedReg?.team?.name || checkedReg?.user?.nick || 'un equipo'
    logTournamentActivity(tournament, req.user, { action: 'update', tabKey: 'checkin', summary: `Marcó check-in de ${regTeamName} como ${type}` })
    res.json({
      registration: mapRegistration(tournament.registrations.id(req.params.rid)),
      registrations: tournament.registrations.map(mapRegistration),
      checkin: tournament.checkin,
    })
  } catch (err) { next(err) }
}

export async function listReports(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'reportar', 'view')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })
    res.json({ reports: tournament.reports || [] })
  } catch (err) { next(err) }
}

const REPORT_PRIORITY_BY_SEVERITY = { urgente: 'urgent', alta: 'high' }

export async function createReport(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'reportar')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const severity = ['baja', 'media', 'alta', 'urgente'].includes(req.body?.severity) ? req.body.severity : 'media'
    const report = {
      type: req.body?.type || 'Incidencia',
      team: req.body?.team || '',
      severity,
      detail: req.body?.detail || '',
      evidence: Array.isArray(req.body?.evidence) ? req.body.evidence.filter(Boolean) : [],
      status: 'open',
      reportedBy: req.user?._id || null,
    }
    tournament.reports.push(report)
    await tournament.save()
    const savedReport = tournament.reports[tournament.reports.length - 1]
    const ticket = await createSystemTicketRecord({
      requester: req.user?._id || null,
      requesterUser: req.user || null,
      requesterName: req.user?.nick || req.user?.email || 'Organizador',
      requesterEmail: req.user?.email || '',
      purpose: 'tournament',
      priority: REPORT_PRIORITY_BY_SEVERITY[severity] || 'medium',
      subject: `Reporte de torneo: ${tournament.title}`,
      message: [
        `Tipo: ${report.type}`,
        report.team ? `Equipo: ${report.team}` : '',
        report.detail || 'Reporte sin detalle adicional.',
      ].filter(Boolean).join('\n'),
      author: 'user',
      authorId: req.user?._id || null,
      sourceType: 'tournament-report',
      sourceId: String(savedReport._id),
      sourceLabel: tournament.title,
      metadata: {
        tournamentId: String(tournament._id),
        publicId: tournament.publicId,
        tournamentCode: tournament.tournamentCode,
        reportType: report.type,
        team: report.team,
      },
    })
    savedReport.ticketId = ticket?._id || ticket?.id || null
    await tournament.save()
    logTournamentActivity(tournament, req.user, { action: 'create', tabKey: 'reportar', summary: `Creó un reporte (${severity}): ${report.type}${report.team ? ` - equipo ${report.team}` : ''}` })
    res.status(201).json({ report: savedReport, ticket, reports: tournament.reports })
  } catch (err) { next(err) }
}

export async function updateReportStatus(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    const permissionError = assertTabAccess(tournament, req.user, 'reportar')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })

    const report = tournament.reports.id(req.params.rid)
    if (!report) return res.status(404).json({ message: 'Report not found' })

    const status = req.body?.status
    if (!['open', 'in_review', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    report.status = status
    if (status === 'resolved') {
      report.resolvedAt = new Date()
      report.resolution = req.body?.resolution || report.resolution
      if (report.reportedBy) {
        sendNotif(report.reportedBy, {
          type: 'tournament_report_resolved',
          title: 'Reporte resuelto',
          message: `Tu reporte "${report.type}" en ${tournament.title} fue marcado como resuelto.`,
          link: `/torneos/${tournament.publicId || tournament._id}`,
          meta: { tournamentId: String(tournament._id), reportId: String(report._id) },
        }).catch(() => {})
      }
    }
    await tournament.save()
    logTournamentActivity(tournament, req.user, { action: 'update', tabKey: 'reportar', summary: `Cambió un reporte (${report.type}) a estado "${status}"` })
    res.json({ report, reports: tournament.reports })
  } catch (err) { next(err) }
}

// Compartida entre la ruta HTTP y el bot de Discord — misma fuente de reglas
// para "solo el líder inscribe", ventana de inscripción y cupo.
export async function registerTeamForUser(user, tournamentIdOrCode, options = {}) {
  const tournament = await Tournament.findOne(tournamentIdentityFilter(tournamentIdOrCode))
  if (!tournament) throw Object.assign(new Error('Tournament not found'), { status: 404 })
  if (isMobileLegends(tournament.game) && options.dataConsent !== true) {
    throw Object.assign(new Error('Debes aceptar el envío de capturas y nicks a Google para inscribir tu equipo.'), { status: 400, payload: { code: 'DATA_CONSENT_REQUIRED' } })
  }

  const now = new Date()
  if (!['open'].includes(tournament.status)) throw Object.assign(new Error('Este torneo no admite inscripciones.'), { status: 400 })
  if (now < tournament.registrationWindow.start) throw Object.assign(new Error('Registration has not opened yet'), { status: 400 })
  if (tournament.lateRegistration) {
    // Inscripcion tardia (la enciende el organizador): se salta el cierre y el
    // inicio, pero no se agregan equipos a un bracket ya publicado.
    if (tournament.bracketDoc?.published) throw Object.assign(new Error('El bracket ya esta publicado: las inscripciones estan cerradas.'), { status: 400 })
  } else {
    if (now > tournament.registrationWindow.end) throw Object.assign(new Error('Registration is closed'), { status: 400 })
    // Torneos viejos tienen la ventana cerrando DESPUES del inicio (4 de 7 en la
    // base local): con el torneo ya empezado no se inscribe nadie, diga lo que diga la ventana.
    if (tournament.date && now >= tournament.date) throw Object.assign(new Error('El torneo ya empezo: las inscripciones estan cerradas.'), { status: 400 })
  }
  if (tournament.currentSlots >= tournament.maxSlots) throw Object.assign(new Error('Tournament is full'), { status: 400 })
  // Freno a cuentas múltiples en torneos con premios: quien inscribe debe
  // tener el correo verificado (web y bot pasan por aquí).
  if (config.mongoEnabled && !user?.emailVerified) {
    throw Object.assign(new Error('Verifica tu correo para inscribirte: Ajustes → Cuenta → Verificar correo.'), { status: 403, payload: { code: 'EMAIL_NOT_VERIFIED' } })
  }

  // Todo torneo -- incluidos 1v1/individuales -- se inscribe con un equipo.
  // Para modalidad solo, requiredPlayersForTournament calcula 1 titular
  // requerido, asi que un equipo de una sola persona (el propio lider) ya
  // cumple: mismo camino, misma validacion de roster/Discord para todos.
  const requestedTeamId = options.teamId || options.team || null
  const teamQuery = requestedTeamId && mongoose.Types.ObjectId.isValid(String(requestedTeamId))
    ? { _id: requestedTeamId, leader: user._id }
    : { leader: user._id, game: tournament.game }
  let team = await Team.findOne({ ...teamQuery, status: { $ne: 'Eliminado' } })
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate('leader', 'nick playerCode discord countryCode birthDate')
    .populate('members', 'nick playerCode discord countryCode birthDate')
  if (!team && !requestedTeamId) {
    team = await Team.findOne({ leader: user._id, status: { $ne: 'Eliminado' } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('leader', 'nick playerCode discord countryCode birthDate')
      .populate('members', 'nick playerCode discord countryCode birthDate')
  }
  if (!team) throw Object.assign(new Error('You must be a team leader to register'), { status: 400 })

  // Un equipo de otro juego no puede inscribirse (solo se compara si ambos lo definen).
  // gameKeyOf: "Mobile Legends" (equipo) y "Mobile Legends: Bang Bang" (torneo)
  // son el mismo juego; antes se comparaba el texto y se rechazaba.
  const sameGame = (a, b) => gameKeyOf(a) === gameKeyOf(b)
  if (team.game && (tournament.gameId || tournament.game) && !sameGame(team.game, tournament.gameId || tournament.game)) {
    throw Object.assign(new Error(`Este torneo es de ${tournament.game} y tu equipo juega ${team.game}.`), { status: 400 })
  }

  if (tournament.eligibility?.universityOnly && !team.university?.isUniversityTeam) {
    throw Object.assign(new Error('Este torneo es solo para equipos universitarios verificados.'), { status: 403 })
  }

  // Vincula cada puesto con su cuenta miembro (Discord verificado). Ya no se
  // le asigna el lider a titular-1 "por posicion": eso dejaba pasar a un
  // jugador escrito a mano con el Discord del lider.
  team.rosterSlots = syncRosterSlotsWithUsers(team.rosterSlots, teamUsersForRosterSync(team), String(team.leader?._id || team.leader || ''))
  await Team.updateOne({ _id: team._id }, { $set: { rosterSlots: team.rosterSlots } })

  // Los titulares que juegan tienen que ser personas del equipo con cuenta:
  // un nick escrito a mano no acepto entrar ni paso ninguna regla.
  const memberIds = new Set(teamUserIds(team).keys())
  const strangers = Array.from({ length: requiredPlayersForTournament(tournament) }, (_, i) => team.rosterSlots?.[`titular-${i + 1}`])
    .filter(slot => slot && typeof slot === 'object' && (slot.nick || slot.gameId) && !memberIds.has(String(slot.userId || '')))
    .map(slot => slot.nick || slot.gameId)
  if (strangers.length) {
    throw Object.assign(new Error(`${strangers.join(', ')} ${strangers.length > 1 ? 'no son miembros' : 'no es miembro'} del equipo (no ${strangers.length > 1 ? 'tienen' : 'tiene'} cuenta vinculada). Cada titular tiene que aceptar una invitación al equipo antes de inscribirse.`), { status: 400, payload: { code: 'ROSTER_NOT_MEMBERS', players: strangers } })
  }

  const restrictions = participantRestrictions(team, tournament)
  if (restrictions.length) throw Object.assign(new Error(restrictions.join(' ')), { status: 400 })

  const eligibility = validateTeamTournamentEligibility(team, tournament)
  if (!eligibility.ok) {
    throw Object.assign(new Error(`El equipo no esta listo para inscribirse: ${eligibility.issues.join(' ')}`), { status: 400 })
  }

  const alreadyRegistered = tournament.registrations.some(r => r.team && r.team.toString() === team._id.toString())
  if (alreadyRegistered) throw Object.assign(new Error('Team already registered'), { status: 409 })

  const registeredTeamIds = tournament.registrations.map(r => r.team).filter(Boolean)
  if (registeredTeamIds.length) {
    const registeredTeams = await Team.find({ _id: { $in: registeredTeamIds } })
      .select('name tag leader members game')
      .populate('leader', 'nick playerCode')
      .populate('members', 'nick playerCode')
      .lean()
    const currentIds = teamUserIds(team)
    let conflict = null
    for (const otherTeam of registeredTeams) {
      const otherIds = teamUserIds(otherTeam)
      for (const [id, player] of currentIds.entries()) {
        if (otherIds.has(id)) {
          conflict = {
            ...player,
            otherTeamId: otherTeam._id,
            otherTeamName: otherTeam.name,
            otherTeamLeader: otherTeam.leader,
          }
          break
        }
      }
      if (conflict) break
    }
    if (conflict) {
      await notifyRosterLock({ tournament, team, conflict })
      // Cuenta a jugadores y staff: nadie (ni un coach) puede estar en dos
      // equipos del mismo torneo.
      throw Object.assign(new Error(`Roster Lock: ${conflict.nick} ya esta inscrito con ${conflict.otherTeamName}. Una persona (jugador o staff) solo puede estar en un equipo de este torneo.`), { status: 409 })
    }
  }

  // Snapshot: universityStandings.js / university.controller.js agregan por
  // registrations.teamMeta.university, que antes nadie escribia.
  const uni = team.university?.isUniversityTeam ? team.university : null
  tournament.registrations.push({
    team: team._id,
    registeredBy: user._id,
    dataConsent: isMobileLegends(tournament.game) ? { acceptedAt: now, acceptedBy: user._id } : undefined,
    teamMeta: {
      name: team.name,
      tag: team.tag,
      university: uni
        ? { universityId: uni.universityId || '', universityTag: uni.universityTag || '', universityName: uni.universityName || '', region: uni.region || '' }
        : undefined,
    },
  })
  tournament.currentSlots += 1
  await tournament.save()
  const registration = tournament.registrations.at(-1)

  await notifyTournamentRegistrationNextSteps({ tournament, team, user, registration, eligibility })

  if (tournament.discordEnabled) {
    registration.discordProvision = { status: 'pending', error: '' }
    await tournament.save()
    await enqueueIntegrationEvent({
      type: 'discord.team.provision',
      entityType: 'team',
      entityId: team._id,
      payload: { tournamentId: tournament._id, teamId: team._id, registrationId: registration?._id },
    })
  }

  return { message: 'Team registered successfully', tournament: { publicId: tournament.publicId, title: tournament.title } }
}

export async function registerTeam(req, res, next) {
  try {
    const result = await registerTeamForUser(req.user, req.params.id, { teamId: req.body?.teamId, dataConsent: req.body?.dataConsent })
    res.json(result)
  } catch (err) { next(err) }
}

export async function cancelRegistration(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id))
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    // Busca primero por equipo (camino actual, para toda modalidad); si no
    // hay nada ahi, cae a buscar por user -- inscripciones 1v1 hechas antes
    // de que las individuales tambien pasaran a requerir equipo.
    // Un torneo iniciado o cerrado no admite bajas: rompe el bracket ya armado.
    if (!['draft', 'open', 'registration_closed'].includes(tournament.status)) {
      return res.status(400).json({ message: 'Este torneo ya empezó o terminó: no se puede cancelar la inscripción.' })
    }

    // Un lider puede tener varios equipos: se cancela el equipo pedido, o el
    // que este realmente inscrito (no "el primero que lidere").
    const requestedTeamId = req.body?.teamId || req.query?.teamId
    const ledTeams = await Team.find({
      leader: req.user._id,
      ...(requestedTeamId && mongoose.Types.ObjectId.isValid(String(requestedTeamId)) ? { _id: requestedTeamId } : {}),
    }).select('_id').lean()
    const ledIds = new Set(ledTeams.map(t => String(t._id)))
    let regIndex = tournament.registrations.findIndex(r => r.team && ledIds.has(String(r.team)))
    if (regIndex === -1) {
      regIndex = tournament.registrations.findIndex(r => r.user && r.user.toString() === req.user._id.toString())
    }
    if (regIndex === -1) return res.status(404).json({ message: 'Registration not found' })

    // Si esa inscripcion llego a tener sala de Discord (rol/categoria/
    // canales propios del equipo), hay que borrarla -- si no, queda huerfana
    // en el servidor para siempre. Se captura ANTES de sacar la inscripcion
    // del array porque despues del splice+save ya no hay de donde leerla.
    const cancelledRegistration = tournament.registrations[regIndex]
    const cancelledDiscord = cancelledRegistration?.discordProvision
    const registrationId = cancelledRegistration?._id
    const hasDiscordRoom = cancelledDiscord && (cancelledDiscord.roleId || cancelledDiscord.categoryId)
    const deprovisionPayload = hasDiscordRoom ? {
      guildId: tournament.discordProvision?.guildId || '',
      roleId: cancelledDiscord.roleId || '',
      categoryId: cancelledDiscord.categoryId || '',
      textChannelId: cancelledDiscord.textChannelId || '',
      bracketChannelId: cancelledDiscord.bracketChannelId || '',
      voiceChannelId: cancelledDiscord.voiceChannelId || '',
      teamName: cancelledRegistration.teamMeta?.name || '',
    } : null

    if (registrationId) {
      await IntegrationEvent.updateMany(
        {
          type: 'discord.team.provision',
          status: { $in: ['pending', 'processing', 'failed'] },
          'payload.tournamentId': tournament._id,
          'payload.registrationId': registrationId,
        },
        {
          $set: {
            status: 'done',
            result: { cancelled: true, reason: 'registration_cancelled' },
            processedAt: new Date(),
            lockedAt: null,
            lockedBy: '',
            lastError: '',
          },
        },
      )
    }

    tournament.registrations.splice(regIndex, 1)
    tournament.currentSlots = Math.max(0, tournament.currentSlots - 1)
    await tournament.save()

    if (deprovisionPayload?.guildId) {
      await enqueueIntegrationEvent({
        type: 'discord.team.deprovision',
        entityType: 'team',
        entityId: cancelledRegistration.team,
        payload: deprovisionPayload,
        dedupe: false,
      })
    }

    res.json({ message: 'Registration cancelled' })
  } catch (err) { next(err) }
}

/**
 * GET /api/tournaments/:id/audit-log — quien hizo que y cuando en este
 * torneo. Visibilidad para quien organiza (owner/admin), no para el staff
 * en general -- mismo criterio que ya documenta la pestaña "Actividad" del
 * frontend (no está en ROLE_DEFAULT_ACCESS a propósito).
 */
export async function getTournamentAuditLog(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id)).select('_id organizer')
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })
    if (!isPrivilegedForTournament(tournament, req.user)) {
      return res.status(403).json({ message: 'You do not have permission to view this tournament activity log' })
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100)
    const filter = { tournament: tournament._id }
    if (req.query.tabKey) filter.tabKey = req.query.tabKey
    if (req.query.userId && mongoose.Types.ObjectId.isValid(String(req.query.userId))) filter.user = req.query.userId
    if (req.query.cursor && mongoose.Types.ObjectId.isValid(String(req.query.cursor))) filter._id = { $lt: req.query.cursor }

    const rows = await TournamentAuditLog.find(filter).sort({ _id: -1 }).limit(limit + 1).lean()
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    res.json({
      entries: page.map(e => ({
        id: String(e._id), userId: String(e.user), userNick: e.userNick, role: e.role,
        action: e.action, tabKey: e.tabKey, summary: e.summary, meta: e.meta, createdAt: e.createdAt,
      })),
      nextCursor: hasMore ? String(page[page.length - 1]._id) : null,
    })
  } catch (err) { next(err) }
}
