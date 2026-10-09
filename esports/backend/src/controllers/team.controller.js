import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { TeamMembershipHistory } from '../models/TeamMembershipHistory.js'
import { TeamInvitation } from '../models/TeamInvitation.js'
import { Tournament } from '../models/Tournament.js'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { sendNotif } from '../services/notifications.service.js'
import { createTeamCode, formatTeamCode, formatTeamInternalCode } from '../services/codes.service.js'
import { getCountryNumber } from '../config/countries.js'
import { getTeamCompetitiveSnapshot } from '../services/competitive.service.js'
import { assertRosterNotLocked, rosterOccupantsChanged } from '../services/rosterLock.service.js'
import { JOIN_SCOPES, teamGenderKey, teamJoinViolations } from '../../../shared/teamEligibility.mjs'
import { gameKeyOf, gameName } from '../../../shared/games.mjs'
import { checkGameAccountId } from '../../../shared/gameAccountIds.mjs'
import { isMobileLegends } from '../../../shared/matchStats.mjs'
import { verifiedMlbbAccount, applyVerifiedAccountToSlot } from '../services/gameAccountSync.service.js'
import { score } from './search.controller.js'
import { publicPresence, withPublicPresence } from '../../../shared/presence.mjs'
import { canViewByVisibility, canViewPrivateProfile } from './profile.controller.js'
import {
  TEAM_ROLES, STAFF_ROLES, STAFF_SLOT_KEYS, STAFF_ROLE_MAX, VERIFIABLE_STAFF_ROLES, MAX_STAFF_LIMIT,
  normalizeTeamRole, isStaffRole, isStaffSlotKey, staffRoleOfSlot, staffSlotLabel, teamRoleLabel, teamMaxStaff,
} from '../../../shared/teamRoles.mjs'

// Demo state
const demoTeams = [
  {
    _id: 'demo-team-1', name: 'Glitch Core', tag: 'GLC', color: '#00E676',
    publicCode: 'TEAM-001-01', internalCode: 'TEAM-260101-001-01',
    leader: 'demo-brooklyn', members: ['demo-brooklyn'],
    wins: 142, losses: 58, rankPts: 2840, logo: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
]

// Nombre/tag unicos sin distinguir mayusculas: el indice unico de Mongo es
// case-sensitive, asi que "Alpha Squad" y "alpha squad" convivian (suplantacion).
const CI_COLLATION = { locale: 'en', strength: 2 }
const ACTIVE_TOURNAMENT_STATUSES = ['open', 'registration_closed', 'ongoing']

function activeTournamentForTeam(teamId) {
  return Tournament.findOne({ 'registrations.team': teamId, status: { $in: ACTIVE_TOURNAMENT_STATUSES } }).select('title').lean()
}

function isTeamOwner(team, userId) {
  const leaderId = team?.leader?._id || team?.leader?.id || team?.leader
  return Boolean(leaderId && userId && String(leaderId) === String(userId))
}

function protectInternalCode(team, userId) {
  // Always keep internalCode since both short and long IDs should be visible.
  return team
}

function teamPublicLookup(value) {
  const raw = String(value || '').trim()
  if (!raw) return { _id: null }

  const variants = Array.from(new Set([raw, raw.toUpperCase(), raw.toLowerCase()]))
  const $or = [
    { publicCode: { $in: variants } },
    { internalCode: { $in: variants } },
    { tag: { $in: variants } },
  ]

  if (mongoose.Types.ObjectId.isValid(raw)) {
    $or.unshift({ _id: raw })
  }

  return { $or }
}

function hasTeamCreationPremium(user) {
  const plan = String(user?.plan || '').toLowerCase()
  const role = String(user?.role || '').toLowerCase()
  const roles = (user?.roles || []).map(item => String(item).toLowerCase())
  return role === 'admin' || roles.includes('admin') || ['premium', 'pro', 'team', 'elite', 'pro trial'].includes(plan)
}

// Reglas de entrada (shared/teamEligibility.mjs, las mismas que avisa el
// frontend): femenino, solo país / solo región y universitario. Un equipo
// universitario representa a toda una universidad -- solo estudiantes
// verificados de ESA MISMA universidad entran. Se aplican en todos los
// caminos: solicitud, aprobación de solicitud y código de invitación.
const TEAM_JOIN_MESSAGES = {
  gender: () => 'Este equipo es solo para jugadoras.',
  country: team => `Este equipo solo acepta jugadores de su país (${team.country}).`,
  region: team => `Este equipo solo acepta jugadores de su región (${team.region}).`,
  university: () => 'Solo estudiantes verificados pueden unirse a un equipo universitario.',
  university_other: () => 'Solo puedes unirte al equipo universitario de tu propia universidad.',
}
const TEAM_JOIN_USER_FIELDS = 'gender countryCode region university'

function teamEligibilityError(user, team) {
  const [first] = teamJoinViolations(team, user)
  return first ? TEAM_JOIN_MESSAGES[first](team) : null
}

function cleanJoinScope(value) {
  return JOIN_SCOPES.includes(value) ? value : 'open'
}

// 'coach'/'manager' son puestos de staff, no de jugador -- separados de la
// lista de auto-asignacion para que un jugador que se une por solicitud
// nunca termine listado como staff solo por ser el "primer slot libre".
const DEFAULT_PLAYER_ROSTER_SLOT_KEYS = ['titular-1', 'titular-2', 'titular-3', 'titular-4', 'titular-5', 'sub-1', 'sub-2']
const ROSTER_SLOT_FIELDS = ['nick', 'role', 'gameId', 'email', 'avatar', 'bio', 'rank', 'availability']

function cleanRosterText(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

function normalizeRosterSocials(value = {}) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, val]) => [cleanRosterText(key, 30), cleanRosterText(val, 160)])
      .filter(([key, val]) => key && val)
  )
}

function userRosterIdentifiers(user) {
  return [
    user?._id,
    user?.id,
    user?.nick,
    user?.email,
    user?.playerCode,
    user?.discord?.id,
    user?.discord?.username,
    user?.social?.discord,
    user?.gamerProfile?.gameId,
  ]
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function slotBelongsToUser(slot, user) {
  // Default param solo cubre `undefined` -- un slot guardado como `null`
  // (en vez de borrado del objeto) igual llegaba hasta aca y reventaba
  // "Cannot read properties of null" al leer slot.userId.
  slot = slot || {}
  const identifiers = userRosterIdentifiers(user)
  const values = [
    slot.userId,
    slot.id,
    slot.playerCode,
    slot.nick,
    slot.email,
    slot.discordId,
    slot.discordName,
    slot.gameId,
  ]
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean)
  return values.some(value => identifiers.includes(value))
}

function rosterSlotForUser(rosterSlots, user) {
  if (!rosterSlots || typeof rosterSlots !== 'object' || Array.isArray(rosterSlots)) return null
  return Object.values(rosterSlots).find(slot => slotBelongsToUser(slot, user)) || null
}

function buildOwnRosterSlot(body = {}, user, previous = {}, fallbackSlot = 'titular-1') {
  const next = { ...previous }
  ROSTER_SLOT_FIELDS.forEach(field => {
    if (body[field] !== undefined) next[field] = cleanRosterText(body[field], field === 'bio' ? 600 : 180)
  })
  next.nick = next.nick || cleanRosterText(user?.nick, 80) || 'Jugador'
  next.role = next.role || cleanRosterText(body.slot, 60) || fallbackSlot
  next.email = next.email || cleanRosterText(user?.email, 180)
  next.avatar = next.avatar || cleanRosterText(user?.avatar, 300)
  next.userId = String(user?._id || user?.id || '')
  next.playerCode = cleanRosterText(user?.playerCode, 80)
  next.discordId = cleanRosterText(user?.discord?.id, 80)
  next.discordName = cleanRosterText(user?.discord?.username, 120)
  next.status = 'Sincronizado'
  next.mainCharacters = Array.isArray(body.mainCharacters)
    ? body.mainCharacters.map(item => cleanRosterText(item, 60)).filter(Boolean).slice(0, 12)
    : cleanRosterText(body.mainCharacters, 240).split(',').map(item => item.trim()).filter(Boolean).slice(0, 12)
  next.socials = normalizeRosterSocials(body.socials || body.social || previous.socials || previous.social)
  next.social = next.socials
  return next
}

function rosterUserKey(value) {
  return String(value || '').trim().toLowerCase()
}

function indexTeamUsers(users = []) {
  const map = new Map()
  for (const user of users) {
    for (const value of userRosterIdentifiers(user)) {
      if (value && !map.has(value)) map.set(value, user)
    }
  }
  return map
}

function rosterSlotLookupValues(slot = {}) {
  return [
    slot.userId,
    slot.id,
    slot.playerCode,
    slot.nick,
    slot.email,
    slot.gameId,
  ].map(rosterUserKey).filter(Boolean)
}

function attachVerifiedDiscord(slot = {}, user) {
  const next = { ...slot }
  next.userId = String(user?._id || user?.id || next.userId || '')
  next.playerCode = cleanRosterText(user?.playerCode || next.playerCode, 80)
  next.nick = cleanRosterText(next.nick || user?.nick, 180)
  next.email = cleanRosterText(next.email || user?.email, 180)
  next.avatar = cleanRosterText(next.avatar || user?.avatar, 300)

  const discordId = cleanRosterText(user?.discord?.id, 80)
  const discordName = cleanRosterText(user?.discord?.username, 120)
  next.discordId = discordId
  next.discordName = discordName
  next.status = discordId ? 'Sincronizado' : 'Discord pendiente'

  const socials = normalizeRosterSocials(next.socials || next.social || {})
  if (discordName) socials.discord = discordName
  else delete socials.discord
  next.socials = socials
  next.social = socials
  return next
}

function stripManualDiscord(slot = {}) {
  const next = { ...slot }
  delete next.discordId
  delete next.discordName
  const socials = normalizeRosterSocials(next.socials || next.social || {})
  delete socials.discord
  next.socials = socials
  next.social = socials
  if (next.status === 'Sincronizado') next.status = 'Discord pendiente'
  return next
}

// Vincula cada puesto con la cuenta miembro que lo ocupa (Discord verificado,
// codigo, sello de staff). El puesto del lider lleva su userId desde que lo
// crea (asistente) o lo reclama (/roster/mine), asi que no hace falta adivinar.
// `leaderId` queda por compatibilidad con quienes la llaman.
// eslint-disable-next-line no-unused-vars
export function syncRosterSlotsWithUsers(rosterSlots, users = [], leaderId = '') {
  if (!rosterSlots || typeof rosterSlots !== 'object' || Array.isArray(rosterSlots)) return rosterSlots || null
  const usersByIdentity = indexTeamUsers(users)
  const nextSlots = {}
  for (const [slotKey, rawSlot] of Object.entries(rosterSlots)) {
    if (!rawSlot || typeof rawSlot !== 'object' || Array.isArray(rawSlot)) {
      nextSlots[slotKey] = rawSlot
      continue
    }
    // Solo por identidad real (userId, codigo, nick, correo, ID de juego). Antes
    // "titular-1 es siempre el lider" le pegaba la cuenta y el Discord del
    // lider a CUALQUIER nick escrito en ese puesto: un jugador inventado pasaba
    // la validacion de Discord del torneo y sus stats iban a la cuenta del lider.
    const matchedUser = rosterSlotLookupValues(rawSlot).map(value => usersByIdentity.get(value)).find(Boolean)
    nextSlots[slotKey] = matchedUser ? attachVerifiedDiscord(rawSlot, matchedUser) : stripManualDiscord(rawSlot)
    // Sello "coach/analista verificado": se recalcula si el usuario vino con
    // roleProfiles (si no, queda el ultimo guardado). Sin cuenta, nunca.
    const staffRole = staffRoleOfSlot(slotKey)
    if (staffRole && (!matchedUser || matchedUser.roleProfiles)) {
      nextSlots[slotKey] = { ...nextSlots[slotKey], roleVerified: Boolean(matchedUser) && staffRoleVerified(matchedUser, staffRole) }
    }
  }
  return nextSlots
}

export function teamUsersForRosterSync(team) {
  return [team?.leader, ...(team?.members || [])].filter(user => user && typeof user === 'object')
}

function teamLeaderId(team) {
  return String(team?.leader?._id || team?.leader?.id || team?.leader || '')
}

// Toda lectura del equipo pasa por aca: tambien se quitan los datos
// personales que pudieran haber quedado guardados de antes.
export function teamWithSyncedRosterSlots(team) {
  if (!team?.rosterSlots) return publicMembers(team)
  return publicMembers({ ...team, rosterSlots: scrubRosterPrivateData(syncRosterSlotsWithUsers(team.rosterSlots, teamUsersForRosterSync(team), teamLeaderId(team))) })
}

async function syncRosterSlotsForTeam(team) {
  if (!team?.rosterSlots) return team?.rosterSlots || null
  const leaderId = teamLeaderId(team)
  const ids = Array.from(new Set([team.leader, ...(team.members || [])].map(id => String(id || '')).filter(Boolean)))
  if (!ids.length) return syncRosterSlotsWithUsers(team.rosterSlots, [], leaderId)
  const users = await User.find({ _id: { $in: ids } }).select(`nick email avatar playerCode discord gamerProfile ${ROLE_BADGE_FIELDS}`).lean()
  return syncRosterSlotsWithUsers(team.rosterSlots, users, leaderId)
}

function addVerifiedUserRosterSlot(team, user) {
  const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? { ...team.rosterSlots } : {}
  const existingEntry = Object.entries(slots).find(([, slot]) => slotBelongsToUser(slot, user))
  const targetSlot = existingEntry?.[0] || firstAvailableRosterSlot(slots)
  slots[targetSlot] = buildOwnRosterSlot({}, user, slots[targetSlot] || existingEntry?.[1] || {}, targetSlot)
  team.rosterSlots = slots
  team.markModified?.('rosterSlots')
}

function playerApplicationMeta(user, team, request) {
  const profile = user?.gamerProfile || {}
  const pro = profile.pro && typeof profile.pro === 'object' ? profile.pro : null
  const entries = Array.isArray(pro?.entries) ? pro.entries : []
  const byTeamGame = entries.find(entry => entry?.gameId && String(entry.gameId) === String(team?.game || ''))
  const primary = byTeamGame || entries[0] || null
  const game = primary?.gameId || profile.mainGame || user?.games?.[0] || team?.game || ''
  const rank = primary?.rank || profile.ranks?.[game] || profile.rank || ''
  // La vacante a la que se postulo manda sobre el rol de su tarjeta.
  const vacancy = request?.vacancyId
    ? (team?.recruitment?.vacancies || []).find(v => String(v?._id || v?.id || '') === String(request.vacancyId))
    : null
  const role = (vacancy?.roles || []).filter(Boolean).join(' / ') || primary?.role || profile.mainRole || ''
  return {
    teamId: team._id,
    teamName: team.name,
    teamTag: team.tag,
    teamLogo: team.logo,
    game,
    userId: user._id,
    nick: user.nick,
    avatar: user.avatar,
    playerCode: user.playerCode,
    requestId: request._id,
    vacancyId: request.vacancyId || '',
    vacancyRole: role,
    rank,
    hasCard: Boolean(pro?.entries?.length),
  }
}

const isStaffRosterSlotKey = isStaffSlotKey

// ¿`user` ocupa un puesto de staff de `role` (coach, analyst...) en `team`?
// Mismo criterio que getMyStaffTeams. Devuelve la clave del puesto o null.
export function teamStaffSlotKey(team, user, role) {
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const wanted = String(role || '').trim().toLowerCase()
  const entry = Object.entries(slots).find(([key, slot]) =>
    isStaffRosterSlotKey(key) && (!wanted || key.toLowerCase().startsWith(wanted)) && slotBelongsToUser(slot, user))
  return entry ? entry[0] : null
}

function firstAvailableRosterSlot(slots = {}) {
  // Nunca auto-asignar un puesto de staff (coach/manager/...) -- filtramos
  // esas keys aunque ya existan en `slots` (por ejemplo si quedaron con
  // valor null), no solo las del default list.
  const keys = Array.from(new Set([...DEFAULT_PLAYER_ROSTER_SLOT_KEYS, ...Object.keys(slots || {})]))
    .filter(key => !isStaffRosterSlotKey(key))
  const vacant = keys.find(key => !slots?.[key])
  if (vacant) return vacant
  return `sub-${keys.length + 1}`
}

// ── Roles en el equipo: jugador o staff (shared/teamRoles.mjs) ──
// El rol sale del puesto que la persona ocupa en el plantel (rosterSlots):
// coach/coach-2 -> coach, analyst -> analista, manager -> manager; cualquier
// otro puesto, o ninguno, es jugador. La sincronizacion del plantel deja el
// userId de cada miembro en su puesto, asi que se compara por id.

const plainRosterSlots = team => (team?.rosterSlots && typeof team.rosterSlots === 'object' && !Array.isArray(team.rosterSlots) ? team.rosterSlots : {})
const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '')

function memberSlotEntries(team, userOrId) {
  const id = String(userOrId?._id || userOrId || '')
  return Object.entries(plainRosterSlots(team)).filter(([, slot]) => slot && typeof slot === 'object'
    && (String(slot.userId || '') === id || (typeof userOrId === 'object' && !slot.userId && slotBelongsToUser(slot, userOrId))))
}

export function memberTeamRole(team, userOrId) {
  const staffEntry = memberSlotEntries(team, userOrId).find(([key]) => isStaffSlotKey(key))
  return staffEntry ? staffRoleOfSlot(staffEntry[0]) : 'player'
}

function teamMemberIds(team) {
  return Array.from(new Set((team?.members || []).map(m => String(m?._id || m || '')).filter(Boolean)))
}

// Cuantos miembros juegan y cuantos son staff (el lider cuenta como jugador
// salvo que ocupe un puesto de staff).
export function teamRoleCounts(team) {
  const counts = { player: 0, staff: 0, coach: 0, analyst: 0, manager: 0 }
  for (const id of teamMemberIds(team)) {
    const role = memberTeamRole(team, id)
    counts[role] += 1
    if (role !== 'player') counts.staff += 1
  }
  return counts
}

// Primer puesto libre para `role` (coach -> coach, coach-2).
function freeStaffSlotKey(team, role) {
  const slots = plainRosterSlots(team)
  return (STAFF_SLOT_KEYS[role] || []).find(key => !slots[key] || !(slots[key].nick || slots[key].userId)) || null
}

// Por que no entra otra persona de staff con `role` ({ status, code, message }) o null.
// `ignoreUser`: al cambiar de rol a alguien que ya es miembro, no contarlo.
function staffCapacityBlocker(team, role, { ignoreUser = null } = {}) {
  if (!isStaffRole(role)) return { status: 400, code: 'role', message: 'Rol de staff inválido.' }
  const counts = teamRoleCounts(team)
  if (ignoreUser) {
    const current = memberTeamRole(team, ignoreUser)
    if (current !== 'player') { counts[current] -= 1; counts.staff -= 1 }
  }
  const label = teamRoleLabel(role)
  const max = teamMaxStaff(team)
  if (counts.staff >= max) return { status: 400, code: 'staff_full', message: `El staff del equipo está completo (${max}). Saca a alguien del staff para sumar a otra persona.` }
  if (counts[role] >= (STAFF_ROLE_MAX[role] || 1)) {
    return { status: 400, code: 'role_full', message: STAFF_ROLE_MAX[role] > 1 ? `El equipo ya tiene ${STAFF_ROLE_MAX[role]} ${label.toLowerCase()}s.` : `El equipo ya tiene ${label.toLowerCase()}.` }
  }
  if (!freeStaffSlotKey(team, role)) return { status: 400, code: 'role_full', message: `No hay puesto libre de ${label.toLowerCase()} en el plantel.` }
  return null
}

// Cupo de jugadores: maxMembers cuenta solo jugadores (el staff no le quita lugar a nadie).
function playerCapacityBlocker(team, { ignoreUser = null } = {}) {
  let players = teamRoleCounts(team).player
  if (ignoreUser && teamMemberIds(team).includes(String(ignoreUser?._id || ignoreUser)) && memberTeamRole(team, ignoreUser) === 'player') players -= 1
  if (players >= team.maxMembers) return { status: 400, code: 'full', message: `El equipo ya tiene su cupo de jugadores completo (${team.maxMembers}).` }
  return null
}

// ── El plantel solo lo ocupan cuentas miembro ──
// Un puesto de jugador o staff es una persona que ACEPTO entrar (invitacion,
// solicitud o codigo) y paso las reglas del equipo. Escribir un nick a mano no
// valida nada (ni que exista, ni femenino/universidad, ni que quiera estar):
// solo los patrocinadores (marcas, no personas) se escriben como texto.
const isSponsorSlotKey = key => /^(patrocinador|sponsor)/i.test(String(key || ''))

// Datos personales que nunca van en el plantel: rosterSlots sale en la pagina
// publica del equipo. El asistente pedia la cedula/WhatsApp de cada jugador.
const ROSTER_PRIVATE_FIELDS = ['cedula', 'whatsapp', 'phone', 'birthDate']
export function scrubRosterPrivateData(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return slots
  return Object.fromEntries(Object.entries(slots).map(([key, slot]) => {
    if (!slot || typeof slot !== 'object') return [key, slot]
    const clean = { ...slot }
    for (const field of ROSTER_PRIVATE_FIELDS) delete clean[field]
    return [key, clean]
  }))
}

const slotOccupied = slot => Boolean(slot && typeof slot === 'object' && (slot.nick || slot.userId || slot.name || slot.gameId))
// Mismo criterio que el roster congelado (rosterLock.slotIdentity): nick + ID de juego.
const slotIdentityKey = slot => `${String(slot?.nick || '').trim().toLowerCase()}|${String(slot?.gameId || '').trim().toLowerCase()}`

// Plantel para listados publicos (directorio, universidad).
export function publicRosterSlots(team) {
  if (team?.showRoster === false) return {}
  const slots = scrubRosterPrivateData(plainRosterSlots(team))
  if (team?.hideEmails === false) return slots
  return Object.fromEntries(Object.entries(slots).map(([key, slot]) => [key, slot && typeof slot === 'object' ? { ...slot, email: '' } : slot]))
}

function keepLeaderRosterSlots(slots, leader) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return slots || null
  const leaderId = String(leader?._id || leader?.id || '')
  return Object.fromEntries(Object.entries(slots).filter(([key, slot]) =>
    !slotOccupied(slot) || isSponsorSlotKey(key) || String(slot.userId || '') === leaderId))
}

// Puestos (no patrocinador) que pasan a tener a alguien que no es cuenta
// miembro. Los puestos de texto que ya existian y no cambian se respetan
// (datos de antes de esta regla), pero no se pueden crear nuevos.
function nonMemberRosterOccupants(team, prevSlots = {}) {
  const members = new Set([String(team.leader?._id || team.leader || ''), ...teamMemberIds(team)])
  const prev = prevSlots && typeof prevSlots === 'object' ? prevSlots : {}
  return Object.entries(plainRosterSlots(team))
    .filter(([key, slot]) => !isSponsorSlotKey(key) && slotOccupied(slot) && !members.has(String(slot.userId || '')))
    .filter(([key, slot]) => !slotOccupied(prev[key]) || slotIdentityKey(prev[key]) !== slotIdentityKey(slot))
    .map(([, slot]) => slot.nick || slot.name || slot.gameId)
}

// Un puesto escrito a mano no puede apuntar a la cuenta de alguien que no es
// miembro: esa persona apareceria en el plantel publico (o como coach), le
// llegarian las stats del roster congelado y nunca acepto entrar. El puesto
// queda como texto (nick/ID de juego) sin cuenta vinculada.
function detachNonMemberAccounts(slots, team) {
  if (!slots || typeof slots !== 'object') return slots
  const members = new Set([String(team.leader?._id || team.leader || ''), ...teamMemberIds(team)])
  const next = {}
  for (const [key, slot] of Object.entries(slots)) {
    if (slot && typeof slot === 'object' && slot.userId && !members.has(String(slot.userId))) {
      const { userId, playerCode, roleVerified, ...rest } = slot
      next[key] = { ...rest, status: 'Sin cuenta' }
    } else next[key] = slot
  }
  return next
}

// Plantel editado a mano por el lider: mismos limites que al invitar.
// Una cuenta miembro ocupa un solo puesto (no puede ser titular y coach a la vez).
// `before`: conteo previo a la edicion. Un equipo que ya venia pasado de cupo
// (datos de antes de separar cupos) puede seguir editando mientras no empeore.
function staffRosterError(team, before = null) {
  for (const id of teamMemberIds(team)) {
    if (memberSlotEntries(team, id).length > 1) return 'Una persona ocupa un solo puesto del plantel: no puede ser jugador y staff (o dos puestos) a la vez.'
  }
  const counts = teamRoleCounts(team)
  const worse = key => !before || counts[key] > before[key]
  const max = teamMaxStaff(team)
  if (counts.staff > max && worse('staff')) return `El staff del equipo está completo (${max}).`
  for (const role of STAFF_ROLES) {
    if (counts[role] > STAFF_ROLE_MAX[role] && worse(role)) return `Máximo ${STAFF_ROLE_MAX[role]} ${teamRoleLabel(role).toLowerCase()}${STAFF_ROLE_MAX[role] > 1 ? 's' : ''} por equipo.`
  }
  if (counts.player > team.maxMembers && worse('player')) return `El equipo ya tiene su cupo de jugadores completo (${team.maxMembers}).`
  return null
}

// Lo minimo de User.roleProfiles para el sello (sin codigos internos).
// + activeStatus/lastSeenAt para la presencia (shared/presence.mjs). El estado
// elegido crudo no sale en la respuesta: publicMembers() lo resuelve.
const ROLE_BADGE_FIELDS = [...VERIFIABLE_STAFF_ROLES.map(role => `roleProfiles.${role}.approvedAt`), 'activeStatus', 'lastSeenAt'].join(' ')

// Miembros/lider poblados con la presencia ya resuelta (sin activeStatus crudo:
// no revela a quien eligio Invisible).
export function publicMembers(team) {
  if (!team || typeof team !== 'object') return team
  const fix = user => (user && typeof user === 'object' && user.nick ? withPublicPresence(user) : user)
  return { ...team, leader: fix(team.leader), members: Array.isArray(team.members) ? team.members.map(fix) : team.members }
}

// Sello "verificado": la persona tiene aprobado en GlitchGang el rol de su puesto.
function staffRoleVerified(user, role) {
  return VERIFIABLE_STAFF_ROLES.includes(role) && Boolean(user?.roleProfiles?.[role]?.approvedAt)
}

// Mete a `user` en el puesto de staff libre de `role` (sin guardar el equipo).
// Si ya tenia otro puesto en el plantel lo deja libre: una persona, un puesto.
function assignStaffRosterSlot(team, user, role) {
  const slots = { ...plainRosterSlots(team) }
  for (const [key] of memberSlotEntries(team, user)) delete slots[key]
  const key = (STAFF_SLOT_KEYS[role] || []).find(k => !slots[k] || !(slots[k].nick || slots[k].userId))
  if (!key) throw Object.assign(new Error(`No hay puesto libre de ${teamRoleLabel(role).toLowerCase()} en el plantel.`), { status: 400 })
  slots[key] = buildOwnRosterSlot({ role: staffSlotLabel(key) }, user, {}, key)
  slots[key].role = staffSlotLabel(key)
  slots[key].roleVerified = staffRoleVerified(user, role)
  team.rosterSlots = slots
  team.markModified?.('rosterSlots')
  return key
}

// Copia del perfil de staff para la solicitud (lo que el lider ve al decidir).
// Solo datos publicos: el codigo publico del rol, nunca el interno.
function staffApplicationCard(user, role) {
  const profile = user?.roleProfiles?.[role] || {}
  const details = profile.details && typeof profile.details === 'object' ? profile.details : {}
  const codeField = `${role}Code`
  const card = {
    role,
    verified: staffRoleVerified(user, role),
    code: profile[codeField] || '',
    details: JSON.stringify(details).length <= 8000 ? details : {},
  }
  return card
}

// ── Equipo oficial universitario: uno por universidad y por juego ──
// Estandar de las ligas universitarias (NACE Varsity, Riot College): la
// universidad tiene un equipo oficial por juego, y ese es el que cuenta para
// el ranking y entra a los torneos "solo universitarios". Un estudiante puede
// estar en los equipos de varios juegos, pero no en dos del mismo juego.

function officialUniversityTeam(universityId, gameKey, excludeTeamId = null) {
  if (!universityId || !gameKey) return null
  return Team.findOne({
    'university.isUniversityTeam': true,
    'university.universityId': universityId,
    'university.gameKey': gameKey,
    ...(excludeTeamId ? { _id: { $ne: excludeTeamId } } : {}),
  }).select('name tag').lean()
}

function universitySlotTakenError(existing, game) {
  const owner = existing ? `"${existing.name}"` : 'otro equipo'
  const label = gameName(gameKeyOf(game)) || game || 'este juego'
  return Object.assign(
    new Error(`Tu universidad ya tiene su equipo oficial de ${label}: ${owner}. Pide unirte a ese equipo, o crea el tuyo sin marcar "Universitario".`),
    { status: 409, code: 'university_slot_taken' },
  )
}

const isUniversitySlotDuplicate = err => err?.code === 11000 && /university_official_slot/.test(String(err.message || ''))

function universityGameRequiredError() {
  return Object.assign(new Error('Elige el juego antes de marcar el equipo como universitario: cada universidad tiene un equipo oficial por juego.'), { status: 400 })
}

// Otro equipo del MISMO juego donde el usuario ya es JUGADOR (sin contar los
// que lidera: organizadores/managers pueden tener varios rosters, ni donde es
// staff: un coach puede llevar el principal y la academia). Si uno de los dos
// equipos no tiene juego definido se trata como conflicto, igual que la regla
// anterior de "un solo equipo". Dos equipos del mismo torneo los frena la
// inscripcion (Roster Lock), para jugadores y staff.
async function sameGameMembership(userId, team) {
  const key = gameKeyOf(team.game)
  const others = await Team.find({ _id: { $ne: team._id }, members: userId, leader: { $ne: userId } }).select('name game rosterSlots').lean()
  return others.find(other => {
    if (memberTeamRole(other, userId) !== 'player') return false
    const otherKey = gameKeyOf(other.game)
    return !key || !otherKey || otherKey === key
  }) || null
}

function sameGameMembershipMessage(other, { self = true } = {}) {
  const label = gameName(gameKeyOf(other.game)) || other.game
  const game = label ? ` (${label})` : ''
  return self
    ? `Ya estás en "${other.name}"${game}. Un jugador solo puede estar en un equipo por juego.`
    : `Ese jugador ya está en "${other.name}"${game}. Un jugador solo puede estar en un equipo por juego.`
}

// Mete a `user` en `team` (sin guardar el equipo) despues de comprobar todo lo
// que puede impedirlo. Lo usan aceptar una solicitud y aceptar una
// invitacion, para que las dos puertas tengan exactamente las mismas reglas.
// `self`: el mensaje habla en 2a persona (el propio jugador) o en 3a (el lider).
// `role`: 'player' (titular/suplente) o staff (coach, analyst, manager). El
// staff tiene su propio cupo y no tiene las reglas de entrada de jugadores.
async function addMemberChecked(team, user, { self = true, role = 'player' } = {}) {
  await assertRosterNotLocked(team._id)
  if ((team.members || []).some(memberId => sameId(memberId, user._id))) {
    throw Object.assign(new Error(self ? 'Ya perteneces a este equipo.' : `${user?.nick || 'Esa persona'} ya está en el equipo.`), { status: 409 })
  }
  const teamRole = normalizeTeamRole(role)
  if (teamRole === 'player') {
    const full = playerCapacityBlocker(team)
    if (full) throw Object.assign(new Error(full.message), { status: full.status })
    const eligibilityError = user?.nick && teamEligibilityError(user, team)
    if (eligibilityError) throw Object.assign(new Error(eligibilityError), { status: 400 })
    const sameGameTeam = await sameGameMembership(user._id, team)
    if (sameGameTeam) throw Object.assign(new Error(sameGameMembershipMessage(sameGameTeam, { self })), { status: 400 })
  } else {
    const blocked = staffCapacityBlocker(team, teamRole)
    if (blocked) throw Object.assign(new Error(blocked.message), { status: blocked.status })
  }

  team.members.push(user._id)
  if (teamRole === 'player') {
    if (user?.nick) addVerifiedUserRosterSlot(team, user)
    await User.updateOne({ _id: user._id }, { team: team._id })
  } else {
    if (user?.nick) assignStaffRosterSlot(team, user, teamRole)
    // User.team es "su equipo" (el que juega): el staff solo lo toma si no tiene.
    await User.updateOne({ _id: user._id, $or: [{ team: null }, { team: { $exists: false } }] }, { team: team._id })
  }
  return teamRole
}

// Etiquetas que el lider puede poner/quitar al editar (las mismas del wizard).
const LEADER_TIERS = ['nuevo', 'universitario', 'femenino', 'profesional']

// Al editar: mantiene coherente el cupo oficial con tiers/juego.
// - quita "Universitario"        -> libera el cupo
// - cambia el juego (oficial)    -> el cupo del juego nuevo tiene que estar libre
// - agrega "Universitario"       -> el lider verificado ocupa el cupo, si esta libre
//   y todos los miembros actuales son estudiantes verificados de esa universidad.
async function syncUniversityOfficialSlot(team, leader, { hadUniversityTier }) {
  const wantsUniversity = (team.tiers || []).includes('universitario')
  const official = Boolean(team.university?.isUniversityTeam)
  const gameKey = gameKeyOf(team.game)

  if (official && !wantsUniversity) {
    team.university.isUniversityTeam = false
    team.university.gameKey = ''
    return
  }
  if (official) {
    if (gameKey === team.university.gameKey) return
    if (!gameKey) throw universityGameRequiredError()
    const existing = await officialUniversityTeam(team.university.universityId, gameKey, team._id)
    if (existing) throw universitySlotTakenError(existing, team.game)
    team.university.gameKey = gameKey
    return
  }
  if (!wantsUniversity || hadUniversityTier) return

  const uni = leader.university || {}
  if (uni.verificationStatus !== 'verified') {
    throw Object.assign(new Error('Verifica tu universidad para marcar el equipo como universitario.'), { status: 403 })
  }
  if (!gameKey) throw universityGameRequiredError()
  const existing = await officialUniversityTeam(uni.universityId, gameKey, team._id)
  if (existing) throw universitySlotTakenError(existing, team.game)

  // Solo jugadores: el staff (coach, analista) no tiene que ser estudiante,
  // igual que en las ligas universitarias (NACE, Riot College).
  const playerIds = teamMemberIds(team).filter(id => memberTeamRole(team, id) === 'player')
  const members = await User.find({ _id: { $in: playerIds } }).select('nick university').lean()
  const outsiders = members.filter(m => m.university?.verificationStatus !== 'verified' || String(m.university.universityId || '') !== String(uni.universityId || ''))
  if (outsiders.length) {
    throw Object.assign(new Error(`Para ser equipo universitario todos los miembros deben ser estudiantes verificados de ${uni.universityName || 'tu universidad'}. No cumplen: ${outsiders.map(m => m.nick).join(', ')}.`), { status: 409 })
  }
  team.university = {
    isUniversityTeam: true,
    universityId: uni.universityId || '',
    universityTag: uni.universityTag || '',
    universityName: uni.universityName || '',
    region: uni.region || '',
    gameKey,
  }
}

// GET /teams/university-slot?game=X[&teamId=Y] -- el wizard avisa antes de
// enviar si el cupo oficial de la universidad del usuario en ese juego ya
// tiene dueño (teamId excluye el propio equipo al editar).
export async function getUniversitySlot(req, res, next) {
  try {
    const uni = req.user.university || {}
    if (uni.verificationStatus !== 'verified') return res.json({ verified: false, taken: false, team: null })
    const gameKey = gameKeyOf(req.query.game)
    const excludeId = mongoose.isValidObjectId(req.query.teamId) ? req.query.teamId : null
    const existing = await officialUniversityTeam(uni.universityId, gameKey, excludeId)
    res.json({
      verified: true,
      universityName: uni.universityName || '',
      taken: Boolean(existing),
      team: existing ? { name: existing.name, tag: existing.tag } : null,
    })
  } catch (err) { next(err) }
}

// Lógica de creación compartida entre la ruta HTTP (sesión/cookie) y el bot
// de Discord (identidad resuelta por discordId) — una sola fuente de reglas.
export async function createTeamForUser(user, payload = {}) {
  const { name, tag, color, game, tiers, region, country, slogan, sponsor, brand, contactEmail, community, level, category, lang, gender, description, banner, mainCharacters, sponsors, socials, rosterSlots, maxMembers, logo, partnerBadge, joinScope } = payload
  const cleanName = String(name || '').trim()
  const cleanTag  = String(tag || '').trim().toUpperCase()

  if (cleanName.length < 2) throw Object.assign(new Error('Team name must be at least 2 characters'), { status: 400 })
  if (cleanTag.length < 2 || cleanTag.length > 5) throw Object.assign(new Error('Team tag must be 2–5 characters'), { status: 400 })

  // Un equipo femenino solo lo crea una jugadora (si no, quien lo crea ya
  // rompe la regla que el equipo promete).
  if (teamGenderKey(gender) === 'female' && user.gender !== 'female') {
    throw Object.assign(new Error('Un equipo femenino solo lo puede crear una jugadora.'), { status: 403 })
  }
  const wantsUniversity = Array.isArray(tiers) && tiers.includes('universitario')
  if (wantsUniversity && user.university?.verificationStatus !== 'verified') {
    throw Object.assign(new Error('Verifica tu universidad para crear un equipo universitario.'), { status: 403 })
  }

  const duplicate = await Team.findOne({ $or: [{ name: cleanName }, { tag: cleanTag }] }).collation(CI_COLLATION)
  if (duplicate) throw Object.assign(new Error('Team name or tag already exists'), { status: 409 })

  const createsAsOrganizer = Boolean(payload.owner || payload.allowMultipleTeams)
  if (!createsAsOrganizer) {
    // Ser staff de otro equipo (coach, analista...) no impide armar el propio.
    const memberships = await Team.find({ members: user._id }).select('rosterSlots').lean()
    if (memberships.some(t => memberTeamRole(t, user._id) === 'player')) throw Object.assign(new Error('You are already in a team'), { status: 400 })
  } else if (!hasTeamCreationPremium(user)) {
    const cleanCategory = String(category || 'General').trim() || 'General'
    const ownedInCategory = await Team.countDocuments({ leader: user._id, category: cleanCategory })
    if (ownedInCategory >= 3) {
      throw Object.assign(new Error(`Llegaste al limite gratis de 3 equipos en ${cleanCategory}. Activa GlitchGang Pro para crear mas rosters en esta categoria.`), { status: 402 })
    }
  }

  const { publicCode, internalCode } = await createTeamCode(user.countryCode)

  // Un equipo es universitario solo si el fundador marcó "Universitario"
  // (tiers) -- un estudiante verificado también puede crear un equipo
  // normal. Los datos salen de la verificación institucional real, no del
  // formulario. NO se gatea por `createsAsOrganizer` -- Teams.jsx manda
  // `allowMultipleTeams: true` para todo el mundo. Si esa universidad ya
  // tiene su equipo oficial en ese juego se rechaza con un mensaje claro
  // (antes se creaba como equipo normal sin avisar a nadie).
  let founderUniversity = null
  if (wantsUniversity) {
    const universityId = user.university.universityId || ''
    const gameKey = gameKeyOf(game)
    if (!gameKey) throw universityGameRequiredError()
    const existingOfficialTeam = await officialUniversityTeam(universityId, gameKey)
    if (existingOfficialTeam) throw universitySlotTakenError(existingOfficialTeam, game)
    founderUniversity = {
      isUniversityTeam: true,
      universityId,
      universityTag: user.university.universityTag || '',
      universityName: user.university.universityName || '',
      region: user.university.region || '',
      gameKey,
    }
  }

  // Al crear, el unico miembro es el lider: el plantel solo guarda su puesto
  // (y patrocinadores). El resto entra por invitacion/solicitud/codigo, que
  // es donde se validan las reglas. Nunca se guardan cedula/WhatsApp.
  const sanitizedRosterSlots = keepLeaderRosterSlots(
    scrubRosterPrivateData(syncRosterSlotsWithUsers(rosterSlots || null, [user], String(user?._id || user?.id || ''))),
    user,
  )
  // Equipo de MLBB: el puesto del fundador lleva su cuenta verificada (ID +
  // servidor y nick del juego) aunque en el formulario no la haya escrito.
  if (isMobileLegends(game) && sanitizedRosterSlots && typeof sanitizedRosterSlots === 'object') {
    const verified = await verifiedMlbbAccount(user._id)
    const ownKey = Object.keys(sanitizedRosterSlots).find(k => String(sanitizedRosterSlots[k]?.userId || '') === String(user._id))
    if (verified && ownKey) sanitizedRosterSlots[ownKey] = applyVerifiedAccountToSlot(sanitizedRosterSlots[ownKey], verified)
  }

  // El indice unico university_official_slot cierra la carrera de dos
  // creaciones simultaneas que pasaron las dos el chequeo de arriba.
  const team = await Team.create({
    publicCode, internalCode,
    name: cleanName, tag: cleanTag, color: color || '#00E676',
    leader: user._id, members: [user._id],
    game: game || '', tiers: tiers || [], region: region || '', country: country || '',
    slogan: slogan || '', sponsor: sponsor || '', brand: brand || '', contactEmail: contactEmail || '', community: community || '',
    level: level || '', category: category || '', lang: lang || '',
    gender: gender || '', description: description || '',
    joinScope: cleanJoinScope(joinScope),
    partnerBadge: {
      active: false,
      label: String(partnerBadge?.label || sponsor || 'GlitchGang Partner').trim().slice(0, 80) || 'GlitchGang Partner',
      status: sponsor || partnerBadge?.label ? 'pending' : 'none',
      reason: '',
    },
    banner: banner || '', mainCharacters: mainCharacters || [], sponsors: sponsors || [], socials: socials || {},
    rosterSlots: sanitizedRosterSlots, maxMembers: maxMembers || 10,
    logo: logo || '',
    ...(founderUniversity ? { university: founderUniversity } : {}),
  }).catch(async (err) => {
    if (!isUniversitySlotDuplicate(err)) throw err
    throw universitySlotTakenError(await officialUniversityTeam(founderUniversity.universityId, founderUniversity.gameKey), game)
  })

  await User.updateOne({ _id: user._id }, { team: team._id })
  return team.toObject()
}

export async function createTeam(req, res, next) {
  try {
    const { name, tag, color, game } = req.body
    const cleanName = String(name || '').trim()
    const cleanTag  = String(tag || '').trim().toUpperCase()

    if (cleanName.length < 2) return res.status(400).json({ message: 'Team name must be at least 2 characters' })
    if (cleanTag.length < 2 || cleanTag.length > 5) return res.status(400).json({ message: 'Team tag must be 2–5 characters' })

    if (!config.mongoEnabled) {
      if (demoTeams.find(t => t.name.toLowerCase() === cleanName.toLowerCase() || t.tag === cleanTag)) {
        return res.status(409).json({ message: 'Team name or tag already exists' })
      }
      const sequence = String(demoTeams.length + 1).padStart(3, '0')
      const countryNumber = getCountryNumber(req.user.countryCode || 'RD') || '01'
      const createdAt = new Date()
      const t = {
        _id: `demo-team-${Date.now()}`,
        publicCode: formatTeamCode(sequence, countryNumber),
        internalCode: formatTeamInternalCode(createdAt, sequence, countryNumber),
        name: cleanName, tag: cleanTag, color: color || '#00E676',
        leader: req.user._id, members: [req.user._id], wins: 0, losses: 0,
        rankPts: 1000, logo: '', game: game || '',
        createdAt: createdAt.toISOString(), updatedAt: createdAt.toISOString(),
      }
      demoTeams.push(t)
      return res.status(201).json(t)
    }

    const logoUrl = req.file ? `/uploads/teams/${req.file.filename}` : (req.body.logo || '')
    const team = await createTeamForUser(req.user, { ...req.body, logo: logoUrl })
    res.status(201).json(team)
  } catch (err) { next(err) }
}

export async function getMyTeam(req, res, next) {
  try {
    if (!config.mongoEnabled) {
      const team = demoTeams.find(t => t.members.includes(req.user._id))
      if (!team) return res.json(null)
      team.competitive = await getTeamCompetitiveSnapshot(team)
      return res.json(protectInternalCode({ ...team, roster: [{ id: 'demo-brooklyn', nick: 'Brooklyn', role: 'Líder', online: true, avatar: 'https://i.pravatar.cc/96?img=12' }] }, req.user._id))
    }

    const team = await Team.findOne({
      $or: [{ leader: req.user._id }, { members: req.user._id }],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('leader', 'nick avatar playerCode roles role status activeStatus lastSeenAt discord')
      .populate('members', `nick avatar playerCode roles role status discord games gamerProfile ${ROLE_BADGE_FIELDS}`)
      .lean()

    if (!team) return res.json(null)

    const syncedTeam = teamWithSyncedRosterSlots(team)
    const roster = syncedTeam.members.map(m => ({
      id: m._id.toString(),
      nick: m.nick,
      role: m._id.toString() === syncedTeam.leader._id.toString() ? 'Líder' : 'Miembro',
      ...publicPresence(m),
      avatar: rosterSlotForUser(syncedTeam.rosterSlots, m)?.avatar || m.avatar || '',
      playerCode: m.playerCode || '',
      discord: m.discord || {},
    }))

    const competitive = await getTeamCompetitiveSnapshot(syncedTeam)

    res.json(protectInternalCode({ ...syncedTeam, roster, competitive }, req.user._id))
  } catch (err) { next(err) }
}

export async function getMyTeams(req, res, next) {
  try {
    if (!config.mongoEnabled) {
      const teams = demoTeams.filter(t => t.leader === req.user._id || t.members.includes(req.user._id))
      return res.json({ teams })
    }

    const teams = await Team.find({
      $or: [{ leader: req.user._id }, { members: req.user._id }],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('leader', 'nick avatar playerCode roles role status activeStatus lastSeenAt discord')
      .populate('members', `nick avatar playerCode roles role status discord games gamerProfile ${ROLE_BADGE_FIELDS}`)
      .lean()

    const mapped = await Promise.all(teams.map(async team => {
      const syncedTeam = teamWithSyncedRosterSlots(team)
      const roster = (syncedTeam.members || []).map(m => ({
        id: m._id.toString(),
        nick: m.nick,
        role: String(m._id) === String(syncedTeam.leader?._id || syncedTeam.leader) ? 'Lider' : 'Miembro',
        ...publicPresence(m),
        avatar: rosterSlotForUser(syncedTeam.rosterSlots, m)?.avatar || m.avatar || '',
        playerCode: m.playerCode || '',
        discord: m.discord || {},
      }))
      return protectInternalCode({ ...syncedTeam, roster, titles: syncedTeam.titles || [], titlesSummary: titlesSummary(syncedTeam.titles), competitive: await getTeamCompetitiveSnapshot(syncedTeam) }, req.user._id)
    }))

    res.json({ teams: mapped })
  } catch (err) { next(err) }
}

// GET /api/teams/mine/history -- equipos de los que el jugador SALIO (se fue
// el solo, o el lider disolvio el equipo). Antes de recordTeamMembershipDeparture
// (ver leaveTeam/deleteTeam) esto no existia en absoluto: el filtro "Anteriores"
// de /jugador/equipos nunca podia mostrar nada. Devuelve el mismo shape basico
// que necesita ese filtro (nombre/tag/logo/color/juego/cuando/por que salio),
// no el objeto Team completo -- el equipo puede ya no existir (disuelto).
// GET /teams/of/:userId -- equipos REALES de otra persona para su perfil
// (antes el perfil ajeno mostraba los equipos de quien lo miraba). Respeta la
// privacidad "Equipos" del perfil y no revela equipos privados ni con el
// plantel oculto (salvo a sus miembros). Incluye con que rol esta.
export async function getUserTeams(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Jugador inválido.' })
    const target = await User.findOne({ _id: req.params.userId, deleted: { $ne: true } }).select('privacy friends followers blockedUsers').lean()
    if (!target) return res.status(404).json({ message: 'Jugador no encontrado.' })
    const viewer = req.user || null
    if (viewer && (target.blockedUsers || []).some(id => sameId(id, viewer._id))) return res.status(404).json({ message: 'Jugador no encontrado.' })
    if (!canViewPrivateProfile(target, viewer) && !canViewByVisibility(target, viewer, target.privacy?.teamsVisibility)) {
      return res.json({ teams: [], private: true })
    }

    const teams = await Team.find({ members: target._id, status: { $ne: 'Eliminado' } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('leader', 'nick avatar playerCode status activeStatus lastSeenAt')
      .populate('members', `nick avatar playerCode status games ${ROLE_BADGE_FIELDS}`)
      .lean()

    const viewerId = String(viewer?._id || '')
    const visible = teams.filter(team => {
      const viewerIsMember = viewerId && (team.members || []).some(m => sameId(m, viewerId))
      return viewerIsMember || (team.publicProfile !== false && team.showRoster !== false)
    })
    res.json({
      teams: visible.map(raw => {
        const team = teamWithSyncedRosterSlots(raw)
        const { teamInviteCode, joinRequests, ...rest } = team
        void teamInviteCode; void joinRequests
        const roster = (team.members || []).filter(m => m && m.nick).map(m => ({
          id: String(m._id),
          nick: m.nick,
          avatar: rosterSlotForUser(team.rosterSlots, m)?.avatar || m.avatar || '',
          role: sameId(m._id, team.leader?._id || team.leader) ? 'Lider' : teamRoleLabel(memberTeamRole(team, m._id)),
          playerCode: m.playerCode || '',
          ...publicPresence(m),
        }))
        return {
          ...rest,
          rosterSlots: publicRosterSlots(team),
          roster,
          // Con que rol esta la persona del perfil en este equipo.
          memberRole: memberTeamRole(raw, target._id),
          isLeader: sameId(team.leader?._id || team.leader, target._id),
          titlesSummary: titlesSummary(team.showTournaments === false ? [] : team.titles),
        }
      }),
    })
  } catch (err) { next(err) }
}

export async function getMyFormerTeams(req, res, next) {
  try {
    const rows = await TeamMembershipHistory.find({ user: req.user._id })
      .sort({ leftAt: -1 })
      .lean()
    res.json({
      teams: rows.map(r => ({
        id: r.team ? String(r.team) : null,
        name: r.teamName,
        tag: r.teamTag,
        logo: r.teamLogo,
        color: r.teamColor,
        game: r.game,
        role: r.role,
        reason: r.reason,
        leftAt: r.leftAt,
      })),
    })
  } catch (err) { next(err) }
}

// GET /api/teams/staff/mine?role=analyst|coach|caster -- equipos donde el
// usuario ocupa un puesto de staff en rosterSlots (coach/manager/analyst/...,
// ver isStaffRosterSlotKey). El staff no es miembro "jugador" del equipo
// necesariamente -- por eso no alcanza con { leader } / { members }: hay que
// buscar en members tambien, pero el filtro real es por el slot de staff.
// Antes no existia (el frontend de AnalystDashboard le pegaba a una ruta que
// nunca se registro), asi que "Equipos analizados" siempre mostraba 0.
export async function getMyStaffTeams(req, res, next) {
  try {
    const roleFilter = String(req.query.role || '').trim().toLowerCase()

    if (!config.mongoEnabled) {
      return res.json({ teams: [] })
    }

    const teams = await Team.find({
      $or: [{ leader: req.user._id }, { members: req.user._id }],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('leader', 'nick avatar playerCode roles role status activeStatus lastSeenAt discord')
      .populate('members', `nick avatar playerCode roles role status discord games gamerProfile ${ROLE_BADGE_FIELDS}`)
      .lean()

    const mapped = []
    for (const team of teams) {
      const syncedTeam = teamWithSyncedRosterSlots(team)
      const slots = syncedTeam.rosterSlots && typeof syncedTeam.rosterSlots === 'object' ? syncedTeam.rosterSlots : {}
      const myStaffEntry = Object.entries(slots).find(([key, slot]) => {
        if (!isStaffRosterSlotKey(key)) return false
        if (roleFilter && !key.toLowerCase().startsWith(roleFilter)) return false
        return slotBelongsToUser(slot, req.user)
      })
      if (!myStaffEntry) continue

      const [staffSlotKey, staffSlotData] = myStaffEntry
      const roster = (syncedTeam.members || []).map(m => ({
        id: m._id.toString(),
        nick: m.nick,
        role: String(m._id) === String(syncedTeam.leader?._id || syncedTeam.leader) ? 'Lider' : 'Miembro',
        ...publicPresence(m),
        avatar: rosterSlotForUser(syncedTeam.rosterSlots, m)?.avatar || m.avatar || '',
        playerCode: m.playerCode || '',
        discord: m.discord || {},
      }))
      mapped.push(protectInternalCode({
        ...syncedTeam,
        roster,
        staffRole: staffSlotKey,
        staffSlot: staffSlotData,
        competitive: await getTeamCompetitiveSnapshot(syncedTeam),
      }, req.user._id))
    }

    res.json({ teams: mapped })
  } catch (err) { next(err) }
}

export async function getTeamById(req, res, next) {
  try {
    const team = await Team.findOne(teamPublicLookup(req.params.teamId))
      .populate('leader', 'nick avatar playerCode email status activeStatus lastSeenAt discord')
      .populate('members', `nick avatar playerCode email discord status games gamerProfile ${ROLE_BADGE_FIELDS}`)
      .lean()
    if (!team) return res.status(404).json({ message: 'Team not found' })
    const owner = isTeamOwner(team, req.user?._id)
    if (team.publicProfile === false && !owner) {
      return res.status(403).json({ message: 'Este equipo mantiene su pagina privada.' })
    }

    const viewerId = String(req.user?._id || '')
    const isMember = owner || Boolean(viewerId && (team.members || []).some(mem => String(mem?._id || mem) === viewerId))

    const syncedTeam = teamWithSyncedRosterSlots(team)
    const roster = (syncedTeam.members || []).map(member => ({
      id: String(member._id || member.id),
      nick: member.nick,
      avatar: rosterSlotForUser(syncedTeam.rosterSlots, member)?.avatar || member.avatar || '',
      playerCode: member.playerCode || '',
      role: String(member._id || member.id) === String(syncedTeam.leader?._id || syncedTeam.leader) ? 'Lider' : 'Jugador',
      games: member.games || [],
      gamerProfile: member.gamerProfile || {},
      mainCharacters: member.gamerProfile?.mainCharacters || member.gamerProfile?.agents || member.gamerProfile?.heroes || [],
      gameId: syncedTeam.hideGameId ? '' : (member.gamerProfile?.rank || ''),
      email: syncedTeam.hideEmails ? '' : (member.email || ''),
      discord: member.discord || {},
      ...publicPresence(member),
    }))

    const tournaments = await Tournament.find({
      'registrations.team': syncedTeam._id,
      visibility: { $ne: 'private' },
    })
      .select('publicId title game banner date status prizePool currency organizer registrations maxSlots winner participants bracket bracketResults bracketState prizes prizeType')
      .sort({ date: -1 })
      .limit(12)
      .populate('organizer', 'nick avatar')
      .lean()

    const competitive = await getTeamCompetitiveSnapshot(syncedTeam)
    const responseTeam = { ...syncedTeam }
    if (!owner) {
      if (team.showRoster === false) {
        responseTeam.members = []
        responseTeam.rosterSlots = {}
      }
      if (team.showSponsors === false) responseTeam.sponsors = []
      if (team.showStaff === false) responseTeam.staff = {}
      if (team.showSocials === false) responseTeam.socials = {}
      if (team.showContactEmail !== true) responseTeam.contactEmail = ''
      if (team.showCompetitiveSummary === false) {
        responseTeam.wins = 0
        responseTeam.losses = 0
        responseTeam.rankPts = 0
      }
    }

    // Datos que solo ve el equipo: el codigo de invitacion salta el flujo de
    // solicitudes, y las solicitudes/emails son datos personales.
    if (!isMember) delete responseTeam.teamInviteCode
    if (!owner) delete responseTeam.joinRequests
    if (!owner && syncedTeam.hideEmails !== false) {
      const stripEmail = (user) => (user && typeof user === 'object' ? { ...user, email: undefined } : user)
      responseTeam.leader = stripEmail(responseTeam.leader)
      responseTeam.members = (responseTeam.members || []).map(stripEmail)
      if (responseTeam.rosterSlots && typeof responseTeam.rosterSlots === 'object') {
        responseTeam.rosterSlots = Object.fromEntries(Object.entries(responseTeam.rosterSlots).map(
          ([key, slot]) => [key, slot && typeof slot === 'object' ? { ...slot, email: '' } : slot],
        ))
      }
    }

    res.json(protectInternalCode({
      ...responseTeam,
      roster: !owner && syncedTeam.showRoster === false ? [] : roster,
      tournaments: !owner && syncedTeam.showTournaments === false ? [] : tournaments,
      competitive: !owner && syncedTeam.showCompetitiveSummary === false ? null : competitive,
      // Siempre presente (aunque vacio): la vitrina usa esto en vez de
      // recalcular los titulos desde todos los torneos terminados.
      titles: !owner && syncedTeam.showTournaments === false ? [] : (syncedTeam.titles || []),
    }, req.user?._id))
  } catch (err) { next(err) }
}

function titlesSummary(titles = []) {
  const list = Array.isArray(titles) ? titles : []
  const byDate = [...list].sort((a, b) => new Date(b.date) - new Date(a.date))
  const championships = byDate.filter(title => title.placement === 1)
  const latestChampionship = championships[0] || null
  return {
    count: list.length,
    championships: championships.length,
    current: list.some(title => title.current),
    latest: byDate[0] || null,
    latestChampionship,
    // Campeonatos en la serie del ultimo ("Bicampeon", "Tricampeon"...).
    latestSeriesTitles: latestChampionship?.seriesId
      ? championships.filter(title => title.seriesId === latestChampionship.seriesId).length
      : (latestChampionship ? 1 : 0),
  }
}

export async function listTeams(req, res, next) {
  try {
    const { game, region } = req.query
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1)
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 20))
    const filter = { publicProfile: { $ne: false } }
    if (game) filter.game = game
    if (region) filter.region = region
    if (req.query.recruiting === 'true') filter['recruitment.open'] = true

    const teams = await Team.find(filter)
      .sort({ rankPts: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('leader', 'nick avatar')
      .lean()

    const total = await Team.countDocuments(filter)
    res.json({
      // Listado publico: sin codigo de invitacion ni solicitudes.
      // Titulos: en la lista solo el resumen para la tarjeta (cinta de campeon).
      // Plantel: sin datos personales, vacio si el equipo lo oculta y sin
      // correos si los oculta (igual que getTeamById).
      teams: teams.map(({ teamInviteCode, joinRequests, titles, ...team }) => protectInternalCode({
        ...team,
        rosterSlots: publicRosterSlots(team),
        titlesSummary: titlesSummary(team.showTournaments === false ? [] : titles),
      }, req.user?._id)),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) { next(err) }
}

export async function updateMyTeam(req, res, next) {
  try {
    const managedTeamId = req.params.teamId || null
    if (!config.mongoEnabled) {
      const team = managedTeamId
        ? demoTeams.find(t => String(t._id || t.id) === String(managedTeamId) && t.leader === req.user._id)
        : demoTeams.find(t => t.leader === req.user._id)
      if (!team) return res.status(404).json({ message: 'Team not found' })
      const allowed = ['name', 'tag', 'color', 'game', 'tiers', 'region', 'country', 'slogan', 'sponsor', 'brand', 'contactEmail', 'community', 'level', 'category', 'lang', 'gender', 'description', 'banner', 'logo', 'mainCharacters', 'sponsors', 'socials', 'publicProfile', 'showRoster', 'showStaff', 'showSponsors', 'showTournaments', 'showSocials', 'showContactEmail', 'showCompetitiveSummary', 'hideEmails', 'hideGameId', 'acceptRequests', 'rosterSlots']
      allowed.forEach(f => { if (req.body[f] !== undefined) team[f] = req.body[f] })
      if (req.body.partnerBadge?.label !== undefined) {
        team.partnerBadge = { label: String(req.body.partnerBadge.label || 'GlitchGang Partner').trim().slice(0, 80), active: false, status: 'pending', reason: '' }
      }
      return res.json(team)
    }

    const team = await Team.findOne(managedTeamId ? { _id: managedTeamId, leader: req.user._id } : { leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Team not found or you are not the leader' })

    const allowed = ['name', 'tag', 'color', 'game', 'tiers', 'region', 'country', 'slogan', 'sponsor', 'brand', 'contactEmail', 'community', 'level', 'category', 'lang', 'gender', 'description', 'banner', 'logo', 'mainCharacters', 'sponsors', 'socials', 'publicProfile', 'showRoster', 'showStaff', 'showSponsors', 'showTournaments', 'showSocials', 'showContactEmail', 'showCompetitiveSummary', 'hideEmails', 'hideGameId', 'acceptRequests', 'rosterSlots', 'maxMembers', 'maxStaff', 'joinScope']

    if (req.body.rosterSlots !== undefined && rosterOccupantsChanged(team.rosterSlots, req.body.rosterSlots)) {
      await assertRosterNotLocked(team._id)
    }
    // Cupos separados: maxMembers cuenta jugadores, maxStaff el staff.
    const roleCounts = teamRoleCounts(team)
    const previousRosterSlots = { ...plainRosterSlots(team) }
    if (req.body.maxMembers !== undefined && Number(req.body.maxMembers) < roleCounts.player) {
      return res.status(400).json({ message: `El cupo de jugadores no puede ser menor que los jugadores actuales (${roleCounts.player}).` })
    }
    if (req.body.maxStaff !== undefined) {
      const nextMaxStaff = Number(req.body.maxStaff)
      if (!Number.isInteger(nextMaxStaff) || nextMaxStaff < 0 || nextMaxStaff > MAX_STAFF_LIMIT) {
        return res.status(400).json({ message: `El cupo de staff va de 0 a ${MAX_STAFF_LIMIT}.` })
      }
      if (nextMaxStaff < roleCounts.staff) {
        return res.status(400).json({ message: `El cupo de staff no puede ser menor que el staff actual (${roleCounts.staff}).` })
      }
    }
    const nextName = req.body.name !== undefined ? String(req.body.name).trim() : null
    const nextTag = req.body.tag !== undefined ? String(req.body.tag).trim().toUpperCase() : null
    if ((nextName !== null && nextName.toLowerCase() !== String(team.name).toLowerCase())
      || (nextTag !== null && nextTag !== team.tag)) {
      const clash = await Team.findOne({
        _id: { $ne: team._id },
        $or: [...(nextName ? [{ name: nextName }] : []), ...(nextTag ? [{ tag: nextTag }] : [])],
      }).collation(CI_COLLATION).select('_id').lean()
      if (clash) return res.status(409).json({ message: 'Team name or tag already exists' })
    }

    const hadUniversityTier = (team.tiers || []).includes('universitario')
    // Inscrito en un torneo activo no puede cambiar de juego (quedaria en un
    // torneo de otro juego) ni dejar de ser universitario (quedaria en uno
    // "solo universitarios" sin serlo).
    const changesGame = req.body.game !== undefined && gameKeyOf(req.body.game) !== gameKeyOf(team.game)
    const dropsUniversity = req.body.tiers !== undefined && team.university?.isUniversityTeam
      && !(Array.isArray(req.body.tiers) && req.body.tiers.includes('universitario'))
    if (changesGame || dropsUniversity) {
      const blocking = await activeTournamentForTeam(team._id)
      if (blocking) {
        return res.status(409).json({ message: `No puedes ${changesGame ? 'cambiar el juego del equipo' : 'quitar "Universitario"'} mientras esté inscrito en "${blocking.title}". Cancela la inscripción o espera a que termine.` })
      }
    }
    const internalTiers = (team.tiers || []).filter(t => !LEADER_TIERS.includes(t))
    allowed.forEach(f => { if (req.body[f] !== undefined) team[f] = req.body[f] })
    // El lider elige solo las etiquetas publicas; Legendario / Siguiente Liga
    // las pone la plataforma por rendimiento y se conservan tal cual.
    if (req.body.tiers !== undefined) {
      const picked = (Array.isArray(req.body.tiers) ? req.body.tiers : []).map(t => String(t).trim().toLowerCase()).filter(t => LEADER_TIERS.includes(t))
      team.tiers = [...new Set([...(picked.length ? picked : ['nuevo']), ...internalTiers])]
    }
    if (req.body.joinScope !== undefined) team.joinScope = cleanJoinScope(req.body.joinScope)
    if (req.body.partnerBadge?.label !== undefined) {
      team.partnerBadge = { label: String(req.body.partnerBadge.label || 'GlitchGang Partner').trim().slice(0, 80), active: false, status: 'pending', reason: '' }
    }
    if (req.body.rosterSlots !== undefined) {
      team.rosterSlots = scrubRosterPrivateData(detachNonMemberAccounts(await syncRosterSlotsForTeam(team), team))
      team.markModified('rosterSlots')
      const outsiders = nonMemberRosterOccupants(team, previousRosterSlots)
      if (outsiders.length) {
        return res.status(400).json({
          code: 'NOT_A_MEMBER',
          message: `${outsiders.join(', ')} no ${outsiders.length > 1 ? 'son miembros' : 'es miembro'} del equipo. Invítalo desde Invitaciones con el rol del puesto: cuando acepte (y cumpla las reglas), queda en el plantel.`,
        })
      }
      // Pasar a alguien de jugador a staff (o al reves) tiene sus reglas: va
      // por PATCH /members/:userId/role, no moviendo la ficha de puesto.
      const previousTeam = { leader: team.leader, members: team.members, rosterSlots: previousRosterSlots }
      const switched = teamMemberIds(team).find(id => memberSlotEntries(previousTeam, id).length && memberTeamRole(previousTeam, id) !== memberTeamRole(team, id))
      if (switched) return res.status(400).json({ code: 'USE_ROLE_CHANGE', message: 'Para pasar a alguien de jugador a staff (o al revés) usa "Cambiar rol" en su ficha.' })
      const rosterError = staffRosterError(team, roleCounts)
      if (rosterError) return res.status(400).json({ message: rosterError })
    }
    // Antes el lider podia cambiar el juego de un equipo oficial (dos oficiales
    // del mismo juego) y marcar "Universitario" al editar solo cambiaba la
    // etiqueta, sin cupo ni verificacion.
    if (req.body.tiers !== undefined || req.body.game !== undefined) {
      await syncUniversityOfficialSlot(team, req.user, { hadUniversityTier })
    }

    try {
      await team.save()
    } catch (err) {
      if (!isUniversitySlotDuplicate(err)) throw err
      throw universitySlotTakenError(await officialUniversityTeam(team.university.universityId, team.university.gameKey, team._id), team.game)
    }
    res.json(protectInternalCode(team, req.user._id))
  } catch (err) { next(err) }
}

export async function updateMyRosterSlot(req, res, next) {
  try {
    const teamId = req.params.teamId
    if (!teamId) return res.status(400).json({ message: 'Team id is required' })

    if (!config.mongoEnabled) {
      const team = demoTeams.find(t => String(t._id || t.id) === String(teamId) && t.members.map(String).includes(String(req.user._id)))
      if (!team) return res.status(404).json({ message: 'Team not found or you are not a member' })
      const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? { ...team.rosterSlots } : {}
      const existingEntry = Object.entries(slots).find(([, slot]) => slotBelongsToUser(slot, req.user))
      const targetSlot = existingEntry?.[0] || cleanRosterText(req.body?.slot, 60) || firstAvailableRosterSlot(slots)
      if (slots[targetSlot] && existingEntry?.[0] !== targetSlot && !slotBelongsToUser(slots[targetSlot], req.user)) {
        return res.status(409).json({ message: 'Ese puesto del roster ya pertenece a otro miembro.' })
      }
      if (existingEntry?.[0] && existingEntry[0] !== targetSlot) delete slots[existingEntry[0]]
      slots[targetSlot] = buildOwnRosterSlot(req.body, req.user, slots[targetSlot] || existingEntry?.[1] || {}, targetSlot)
      team.rosterSlots = slots
      return res.json(team)
    }

    const team = await Team.findOne({
      _id: teamId,
      $or: [{ members: req.user._id }, { leader: req.user._id }],
    })
    if (!team) return res.status(404).json({ message: 'Team not found or you are not a member' })

    // Con la cuenta de Mobile Legends verificada, el Game ID del puesto propio
    // es siempre ese: no se puede escribir otro a mano.
    if (isMobileLegends(team.game)) {
      const verified = await verifiedMlbbAccount(req.user._id)
      if (verified) req.body = { ...req.body, gameId: `${verified.roleId} (${verified.zoneId})` }
    }
    // El ID tiene el formato del juego del equipo (Riot ID, UID, ID + Zona...).
    if (req.body?.gameId !== undefined) {
      const check = checkGameAccountId(team.game, req.body.gameId)
      if (!check.ok && check.strict) return res.status(400).json({ message: check.message })
      req.body.gameId = check.value
    }

    const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? { ...team.rosterSlots } : {}
    const existingEntry = Object.entries(slots).find(([, slot]) => slotBelongsToUser(slot, req.user))
    const requestedSlot = cleanRosterText(req.body?.slot, 60)
    const targetSlot = existingEntry?.[0] || requestedSlot || firstAvailableRosterSlot(slots)

    if (!targetSlot) return res.status(400).json({ message: 'Selecciona un puesto del roster.' })
    // Los puestos de staff los da el lider (invitacion/solicitud "como coach"
    // o cambio de rol): nadie se nombra coach a si mismo.
    if (!existingEntry && isStaffSlotKey(targetSlot)) {
      return res.status(403).json({ message: 'Los puestos de staff los asigna el líder del equipo.' })
    }
    // Con el roster congelado se puede seguir editando bio/avatar/redes del
    // puesto propio, pero no reclamar uno vacio ni cambiar el Game ID.
    const changesGameId = req.body?.gameId !== undefined
      && cleanRosterText(req.body.gameId, 180) !== String(existingEntry?.[1]?.gameId || '')
    if (!existingEntry || changesGameId) await assertRosterNotLocked(team._id)
    // Un puesto de otra cuenta miembro no se pisa; uno con un nick escrito a
    // mano (sin cuenta, de antes de la regla) si se puede reclamar.
    const occupant = slots[targetSlot]
    const occupantIsMember = occupant && teamMemberIds(team).concat(String(team.leader)).includes(String(occupant.userId || ''))
    if (occupant && existingEntry?.[0] !== targetSlot && !slotBelongsToUser(occupant, req.user) && occupantIsMember) {
      return res.status(409).json({ message: 'Ese puesto del roster ya pertenece a otro miembro.' })
    }
    if (existingEntry?.[0] && existingEntry[0] !== targetSlot) delete slots[existingEntry[0]]

    const keepFrom = occupant && (occupantIsMember || slotBelongsToUser(occupant, req.user)) ? occupant : null
    slots[targetSlot] = buildOwnRosterSlot(req.body, req.user, keepFrom || existingEntry?.[1] || {}, targetSlot)
    team.rosterSlots = scrubRosterPrivateData(slots)
    team.markModified('rosterSlots')
    await team.save()

    const populated = await Team.findById(team._id)
      .populate('leader', 'nick avatar playerCode roles role status activeStatus lastSeenAt discord')
      .populate('members', `nick avatar playerCode roles role status discord games gamerProfile ${ROLE_BADGE_FIELDS}`)
      .lean()

    const roster = (populated.members || []).map(m => ({
      id: m._id.toString(),
      nick: m.nick,
      role: String(m._id) === String(populated.leader?._id || populated.leader) ? 'Lider' : 'Miembro',
      ...publicPresence(m),
      avatar: rosterSlotForUser(populated.rosterSlots, m)?.avatar || m.avatar || '',
      playerCode: m.playerCode || '',
      discord: m.discord || {},
    }))

    res.json(protectInternalCode({ ...populated, roster, competitive: await getTeamCompetitiveSnapshot(populated) }, req.user._id))
  } catch (err) { next(err) }
}

export async function updateTeamLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' })
    const managedTeamId = req.params.teamId || null
    const team = await Team.findOne(managedTeamId ? { _id: managedTeamId, leader: req.user._id } : { leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Team not found' })
    const logoUrl = `/uploads/teams/${req.file.filename}`
    await Team.updateOne({ _id: team._id }, { logo: logoUrl })
    res.json({ logo: logoUrl })
  } catch (err) { next(err) }
}

export async function deleteTeam(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Team not found or you are not the leader' })
    await assertRosterNotLocked(team._id)
    const blocking = await activeTournamentForTeam(team._id)
    if (blocking) return res.status(409).json({ message: `No puedes disolver el equipo mientras esté inscrito en "${blocking.title}". Cancela la inscripción primero.` })
    // A diferencia de leaveTeam, este endpoint no exige que el roster este
    // vacio antes de disolver -- registrar la salida de TODOS (lider +
    // miembros), no solo de quien llama, para que a nadie le falte de "Anteriores".
    const affectedIds = [team.leader, ...(team.members || [])]
    const affectedUsers = await User.find({ _id: { $in: affectedIds } }).select('_id').lean()
    await Promise.all(affectedUsers.map(u => recordTeamMembershipDeparture(
      u, team, String(u._id) === String(team.leader) ? 'leader' : 'member', 'disbanded',
    )))
    await User.updateMany({ team: team._id }, { team: null })
    await Team.deleteOne({ _id: team._id })
    res.json({ message: 'Team disbanded' })
  } catch (err) { next(err) }
}

export async function getTeamByInviteCode(req, res, next) {
  try {
    const team = await Team.findOne({ teamInviteCode: req.params.code })
      .populate('leader', 'nick avatar')
      .lean()
    if (!team) return res.status(404).json({ message: 'Invite code not found' })
    res.json(protectInternalCode(team, req.user._id))
  } catch (err) { next(err) }
}

export async function joinTeam(req, res, next) {
  try {
    const result = await joinTeamForUser(req.user, req.body.inviteCode)
    res.json(result)
  } catch (err) { next(err) }
}

const RECRUIT_LEVELS = ['casual', 'competitivo', 'pro']
const cleanText = (value, max) => String(value || '').trim().slice(0, max)

/** PUT /api/teams/:teamId/recruitment -- el lider define que busca (boton "Reclutar"). */
export async function updateRecruitment(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Team not found or you are not the leader' })

    const rawVacancies = Array.isArray(req.body?.vacancies) ? req.body.vacancies.slice(0, 5) : []
    const vacancies = rawVacancies.map(v => ({
      game: cleanText(v.game || team.game, 60),
      roles: (Array.isArray(v.roles) ? v.roles : []).map(r => cleanText(r, 40)).filter(Boolean).slice(0, 6),
      rankMin: cleanText(v.rankMin, 40),
      rankMax: cleanText(v.rankMax, 40),
      level: RECRUIT_LEVELS.includes(String(v.level || '').toLowerCase()) ? String(v.level).toLowerCase() : '',
      femaleOnly: v.femaleOnly === true,
      schedule: cleanText(v.schedule, 400),
      languages: cleanText(v.languages, 200),
      description: cleanText(v.description, 300),
    }))
    team.recruitment = { open: req.body?.open === true && vacancies.length > 0, vacancies }
    await team.save()
    res.json({ recruitment: team.recruitment })
  } catch (err) { next(err) }
}

/** GET /api/teams/requests/mine -- equipos a los que el jugador se postulo y en que estado quedaron. */
export async function getMyJoinRequests(req, res, next) {
  try {
    const teams = await Team.find({ 'joinRequests.user': req.user._id })
      .select('name tag logo color game region joinRequests recruitment.open')
      .lean()
    const rows = []
    for (const team of teams) {
      for (const r of team.joinRequests || []) {
        if (String(r.user) !== String(req.user._id)) continue
        rows.push({
          requestId: String(r._id),
          teamId: String(team._id),
          name: team.name,
          tag: team.tag,
          logo: team.logo,
          color: team.color,
          game: team.game,
          region: team.region,
          recruiting: Boolean(team.recruitment?.open),
          status: r.status,
          message: r.message,
          vacancyId: r.vacancyId || '',
          createdAt: r.createdAt,
        })
      }
    }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ requests: rows })
  } catch (err) { next(err) }
}

export async function requestToJoin(req, res, next) {
  try {
    const team = await Team.findById(req.params.teamId)
    if (!team) return res.status(404).json({ message: 'Team not found' })
    if (!team.acceptRequests) return res.status(403).json({ message: 'Team is not accepting requests' })

    // Rol con el que se postula: jugador (por defecto) o staff.
    const role = normalizeTeamRole(req.body?.role)
    const isOwnTeam = String(team.leader) === String(req.user._id)
      || (team.members || []).some(memberId => String(memberId) === String(req.user._id))
    if (isOwnTeam) return res.status(400).json({ message: 'Ya perteneces a este equipo.' })

    if (role === 'player') {
      const eligibilityError = teamEligibilityError(req.user, team)
      if (eligibilityError) return res.status(403).json({ message: eligibilityError })
      const full = playerCapacityBlocker(team)
      if (full) return res.status(full.status).json({ message: full.message, code: full.code })
      const sameGameTeam = await sameGameMembership(req.user._id, team)
      if (sameGameTeam) return res.status(400).json({ message: sameGameMembershipMessage(sameGameTeam) })
    } else {
      const blocked = staffCapacityBlocker(team, role)
      if (blocked) return res.status(blocked.status).json({ message: blocked.message, code: blocked.code })
    }

    const alreadyRequested = team.joinRequests.some(r => r.user.toString() === req.user._id.toString() && r.status === 'pending')
    if (alreadyRequested) return res.status(409).json({ message: 'Request already pending' })

    // Jugador: tarjeta del perfil profesional de jugador (si la tiene).
    // Staff: su perfil de coach/analista y si el rol esta aprobado (verificado).
    let card = null
    if (role === 'player') {
      const pro = req.user.gamerProfile?.pro
      card = pro && typeof pro === 'object' && JSON.stringify(pro).length <= 8000 ? pro : null
      if (req.body.withCard === true && !card?.entries?.length) {
        return res.status(400).json({ message: 'Completa tu perfil profesional de jugador para postularte con tu tarjeta.' })
      }
    } else {
      card = staffApplicationCard(req.user, role)
    }

    team.joinRequests.push({
      user: req.user._id,
      message: String(req.body.message || '').slice(0, 500),
      vacancyId: String(req.body.vacancyId || '').slice(0, 40),
      card,
      role,
    })
    await team.save()
    const created = team.joinRequests[team.joinRequests.length - 1]

    // Notify leader
    const asRole = role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}${card?.verified ? ' (verificado)' : ''}`
    await sendNotif(team.leader, {
      type: 'join_request',
      title: role === 'player' ? 'Solicitud de equipo' : `Solicitud de ${teamRoleLabel(role).toLowerCase()}`,
      message: `${req.user.nick} quiere unirse a ${team.name}${asRole}`,
      link: '/mi-equipo/solicitudes',
      meta: { ...playerApplicationMeta(req.user, team, created), requestedRole: role, roleVerified: Boolean(card?.verified) },
    })

    res.json({ message: 'Join request sent', role })
  } catch (err) { next(err) }
}

export async function respondJoinRequest(req, res, next) {
  try {
    const { accept } = req.body
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Team not found' })

    const request = team.joinRequests.id(req.params.reqId)
    if (!request || request.status !== 'pending') return res.status(404).json({ message: 'Request not found' })

    request.status = accept ? 'accepted' : 'rejected'
    const role = normalizeTeamRole(request.role)
    const asRole = role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}`

    if (accept) {
      const requester = await User.findById(request.user).select(INVITEE_FIELDS)
      if (!requester) return res.status(404).json({ message: 'Esa cuenta ya no existe.' })
      // Se vuelve a comprobar al aprobar: el equipo pudo cambiar sus reglas
      // (o el jugador su perfil) desde que mandó la solicitud.
      await addMemberChecked(team, requester, { self: false, role })
    }

    await team.save()

    // Avisar al que pidio unirse -- antes se resolvia en silencio y solo se
    // enteraba si entraba a revisar el equipo a mano.
    await sendNotif(request.user, {
      type: 'join_request_result',
      title: accept ? 'Solicitud aceptada' : 'Solicitud rechazada',
      message: accept
        ? `${team.name} aceptó tu solicitud: ya estás en el equipo${asRole}.`
        : `${team.name} rechazó tu solicitud para unirte al equipo${asRole}.`,
      link: '/jugador',
      meta: {
        teamId: team._id,
        teamName: team.name,
        teamTag: team.tag,
        teamLogo: team.logo,
        game: team.game,
        accepted: accept,
        playerPanelPath: '/jugador',
      },
    })

    res.json({ message: accept ? 'Member added' : 'Request rejected' })
  } catch (err) { next(err) }
}

// ── Invitaciones por nick (el lider invita, el jugador acepta) ──

const INVITATION_TTL_DAYS = 14
const MAX_PENDING_INVITATIONS = 20
// roleProfiles.coach/analyst: para el sello "verificado" del staff (solo se
// lee approvedAt y el codigo publico; nunca se devuelve el perfil entero).
const INVITEE_FIELDS = `nick avatar playerCode email discord gamerProfile roleProfiles.coach roleProfiles.analyst ${TEAM_JOIN_USER_FIELDS}`

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const invitationExpired = inv => inv.status === 'pending' && inv.expiresAt && inv.expiresAt.getTime() < Date.now()

function publicInvitation(inv) {
  const team = inv.team && typeof inv.team === 'object' && inv.team.name ? inv.team : null
  const user = inv.user && typeof inv.user === 'object' && inv.user.nick ? inv.user : null
  return {
    id: String(inv._id),
    status: invitationExpired(inv) ? 'expired' : inv.status,
    role: normalizeTeamRole(inv.role),
    message: inv.message || '',
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    respondedAt: inv.respondedAt,
    team: team ? { id: String(team._id), name: team.name, tag: team.tag, logo: team.logo || '', game: team.game || '', publicCode: team.publicCode || '', university: team.university?.isUniversityTeam ? team.university.universityTag || team.university.universityName : '' } : { id: idOfRef(inv.team) },
    user: user ? { id: String(user._id), nick: user.nick, avatar: user.avatar || '', playerCode: user.playerCode || '' } : { id: idOfRef(inv.user) },
  }
}
const idOfRef = v => String(v?._id || v || '')

// Por que `invitee` no puede ser invitado a `team` ({ status, code, message })
// o null si puede. La usan invitar por nick, la lista de amigos del panel y el
// menu "Invitar a mi equipo" de Amigos: las tres con las mismas reglas que para
// entrar (se avisa ya, no cuando el jugador acepte). `role`: con que rol se
// invita; el staff tiene su cupo y no las reglas de entrada de jugadores.
async function invitationBlocker(team, invitee, inviterId, role = 'player') {
  if (String(invitee._id) === String(inviterId)) return { status: 400, code: 'self', message: 'No puedes invitarte a ti mismo.' }
  if ((team.members || []).some(id => String(id) === String(invitee._id))) {
    return { status: 409, code: 'member', message: `${invitee.nick} ya está en el equipo.` }
  }

  if (normalizeTeamRole(role) !== 'player') {
    const blocked = staffCapacityBlocker(team, normalizeTeamRole(role))
    if (blocked) return blocked
  } else {
    const full = playerCapacityBlocker(team)
    if (full) return full

    const eligibilityError = teamEligibilityError(invitee, team)
    if (eligibilityError) {
      const reason = teamJoinViolations(team, invitee)[0]
      const message = reason === 'university'
        ? `${invitee.nick} no tiene su universidad verificada: solo estudiantes verificados pueden entrar a un equipo universitario.`
        : reason === 'university_other'
          ? `${invitee.nick} no es estudiante de ${team.university?.universityName || 'tu universidad'}.`
          : `${invitee.nick} no cumple las reglas del equipo: ${eligibilityError}`
      return { status: 400, code: reason || 'rules', message }
    }
    const sameGameTeam = await sameGameMembership(invitee._id, team)
    if (sameGameTeam) return { status: 400, code: 'same_game', message: sameGameMembershipMessage(sameGameTeam, { self: false }) }
  }

  const hasRequested = (team.joinRequests || []).some(r => String(r.user) === String(invitee._id) && r.status === 'pending')
  if (hasRequested) return { status: 409, code: 'requested', message: `${invitee.nick} ya pidió unirse: acéptalo en las solicitudes.` }
  const invited = await TeamInvitation.exists({ team: team._id, user: invitee._id, status: 'pending', expiresAt: { $gt: new Date() } })
  if (invited) return { status: 409, code: 'invited', message: `Ya invitaste a ${invitee.nick}; espera su respuesta.` }
  return null
}

// POST /teams/:teamId/invitations { nick | userId, message?, role? } -- solo el lider.
// userId: desde la lista de amigos (no hace falta escribir el nick).
// role: player (por defecto), coach, analyst o manager.
export async function inviteToTeam(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    const role = normalizeTeamRole(req.body?.role)
    const asRole = role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}`

    let invitee = null
    if (req.body?.userId) {
      if (!mongoose.isValidObjectId(req.body.userId)) return res.status(400).json({ message: 'Jugador inválido.' })
      invitee = await User.findOne({ _id: req.body.userId, deleted: { $ne: true } }).select(INVITEE_FIELDS)
      if (!invitee) return res.status(404).json({ message: 'Ese jugador ya no existe.' })
    } else {
      const nick = String(req.body?.nick || '').trim().replace(/^@/, '')
      if (!nick) return res.status(400).json({ message: 'Escribe el nick del jugador.' })
      invitee = await User.findOne({ nick: new RegExp(`^${escapeRegex(nick)}$`, 'i'), deleted: { $ne: true } }).select(INVITEE_FIELDS)
      if (!invitee) return res.status(404).json({ message: `No existe ningún jugador con el nick "${nick}".` })
    }

    const blocker = await invitationBlocker(team, invitee, req.user._id, role)
    if (blocker) return res.status(blocker.status).json({ message: blocker.message, code: blocker.code })

    const pending = await TeamInvitation.countDocuments({ team: team._id, status: 'pending', expiresAt: { $gt: new Date() } })
    if (pending >= MAX_PENDING_INVITATIONS) return res.status(429).json({ message: `Tienes ${pending} invitaciones pendientes. Cancela alguna antes de enviar más.` })

    // Una invitacion vencida no cuenta como pendiente: se cierra para dejar invitar de nuevo.
    await TeamInvitation.updateMany({ team: team._id, user: invitee._id, status: 'pending', expiresAt: { $lte: new Date() } }, { $set: { status: 'cancelled', respondedAt: new Date() } })
    let invitation
    try {
      invitation = await TeamInvitation.create({
        team: team._id,
        user: invitee._id,
        invitedBy: req.user._id,
        message: String(req.body?.message || '').trim().slice(0, 280),
        role,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 864e5),
      })
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ message: `Ya invitaste a ${invitee.nick}; espera su respuesta.` })
      throw err
    }

    await sendNotif(invitee._id, {
      type: 'team_invitation',
      title: role === 'player' ? 'Te invitaron a un equipo' : `Te invitaron como ${teamRoleLabel(role).toLowerCase()}`,
      message: `${req.user.nick || 'El líder'} te invitó a unirte a ${team.name}${team.game ? ` (${team.game})` : ''}${asRole}.`,
      link: '/jugador/equipos',
      meta: {
        role,
        invitationId: String(invitation._id),
        teamId: String(team._id),
        teamName: team.name,
        teamTag: team.tag,
        teamLogo: team.logo || '',
        game: team.game || '',
        invitedBy: req.user.nick || '',
        playerPanelPath: '/jugador/equipos',
      },
    }).catch(() => {})

    invitation.user = invitee
    res.status(201).json({ invitation: publicInvitation(invitation) })
  } catch (err) { next(err) }
}

function invitableCandidate(user, blocker) {
  return {
    id: String(user._id),
    nick: user.nick,
    avatar: user.avatar || '',
    playerCode: user.playerCode || '',
    university: user.university?.verificationStatus === 'verified' ? (user.university.universityTag || user.university.universityName || '') : '',
    canInvite: !blocker,
    code: blocker?.code || null,
    reason: blocker?.message || '',
  }
}

// GET /teams/:teamId/invite-suggestions?q=&role= -- autocompletado del nick al
// invitar: amigos del lider primero y despues cuentas con nick parecido, cada
// una con si puede entrar con ese rol (y si no, por que). Sirve para no invitar
// a la persona equivocada con un nick casi igual.
const SUGGESTION_LIMIT = 8
export async function getInviteSuggestions(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    const q = String(req.query.q || '').trim().replace(/^@/, '').slice(0, 40)
    if (q.length < 2) return res.json({ suggestions: [] })
    const role = normalizeTeamRole(req.query.role)
    const term = q.toLowerCase()

    const me = await User.findById(req.user._id).select('friends blockedUsers').lean()
    const friendIds = new Set((me?.friends || []).map(String))
    const hidden = [req.user._id, ...(me?.blockedUsers || [])]
    const visible = { _id: { $nin: hidden }, blockedUsers: { $ne: req.user._id }, deleted: { $ne: true }, isBanned: { $ne: true } }
    const rx = new RegExp(escapeRegex(q), 'i')
    const fields = `${INVITEE_FIELDS} university`

    const [friends, others] = await Promise.all([
      User.find({ ...visible, _id: { $in: [...friendIds], $nin: hidden }, $or: [{ nick: rx }, { playerCode: rx }] }).select(fields).limit(30),
      User.find({ ...visible, _id: { $nin: [...hidden, ...friendIds] }, $or: [{ nick: rx }, { playerCode: rx }] }).select(fields).limit(30),
    ])
    let candidates = [...friends, ...others]
    // Pocos resultados: tambien nicks "parecidos" (las letras en orden, para
    // errores de tipeo: "elian" encuentra "Eli_an99").
    if (candidates.length < SUGGESTION_LIMIT && term.length >= 3) {
      const loose = new RegExp(term.split('').map(escapeRegex).join('.*'), 'i')
      const seen = candidates.map(u => u._id)
      const extra = await User.find({ ...visible, _id: { $nin: [...hidden, ...seen] }, nick: loose }).select(fields).limit(SUGGESTION_LIMIT)
      candidates = [...candidates, ...extra]
    }

    const ranked = candidates
      .map(user => ({ user, friend: friendIds.has(String(user._id)), s: score(term, user.nick, user.playerCode) }))
      .sort((a, b) => Number(b.friend) - Number(a.friend) || a.s - b.s || String(a.user.nick).localeCompare(String(b.user.nick)))
      .slice(0, SUGGESTION_LIMIT)

    const suggestions = []
    for (const { user, friend } of ranked) {
      const blocker = await invitationBlocker(team, user, req.user._id, role)
      suggestions.push({ ...invitableCandidate(user, blocker), avatar: user.avatar || '', friend, exact: String(user.nick).toLowerCase() === term })
    }
    res.json({ suggestions })
  } catch (err) { next(err) }
}

// GET /teams/:teamId/invitable-friends -- amigos del lider y si cada uno
// cumple para entrar (y si no, por que). Los que pueden, primero.
export async function listInvitableFriends(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    const me = await User.findById(req.user._id).select('friends').lean()
    const friends = await User.find({ _id: { $in: me?.friends || [] }, deleted: { $ne: true } }).select(INVITEE_FIELDS).limit(200)
    const rows = []
    const role = normalizeTeamRole(req.query?.role)
    for (const friend of friends) rows.push(invitableCandidate(friend, await invitationBlocker(team, friend, req.user._id, role)))
    rows.sort((a, b) => Number(b.canInvite) - Number(a.canInvite) || a.nick.localeCompare(b.nick))
    res.json({ friends: rows })
  } catch (err) { next(err) }
}

// GET /teams/invite-options/:userId -- equipos que lidero y si puedo invitar ahi
// a este jugador (menu "Invitar a mi equipo" en Amigos / perfil).
export async function getInviteOptionsForUser(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Jugador inválido.' })
    const invitee = await User.findOne({ _id: req.params.userId, deleted: { $ne: true } }).select(INVITEE_FIELDS)
    if (!invitee) return res.status(404).json({ message: 'Ese jugador ya no existe.' })
    const teams = await Team.find({ leader: req.user._id }).sort({ updatedAt: -1 }).limit(20)
    const role = normalizeTeamRole(req.query?.role)
    const options = []
    for (const team of teams) {
      const blocker = await invitationBlocker(team, invitee, req.user._id, role)
      options.push({
        teamId: String(team._id),
        name: team.name,
        tag: team.tag,
        logo: team.logo || '',
        game: team.game || '',
        university: team.university?.isUniversityTeam ? (team.university.universityTag || team.university.universityName) : '',
        canInvite: !blocker,
        code: blocker?.code || null,
        reason: blocker?.message || '',
      })
    }
    res.json({ user: { id: String(invitee._id), nick: invitee.nick }, teams: options })
  } catch (err) { next(err) }
}

// GET /teams/:teamId/invitations -- el lider ve las suyas (pendientes primero).
export async function listTeamInvitations(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id }).select('_id')
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    const invitations = await TeamInvitation.find({ team: team._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('user', 'nick avatar playerCode')
      .lean()
    res.json({ invitations: invitations.map(publicInvitation) })
  } catch (err) { next(err) }
}

// DELETE /teams/:teamId/invitations/:invId -- el lider cancela una pendiente.
export async function cancelTeamInvitation(req, res, next) {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id }).select('_id')
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    if (!mongoose.isValidObjectId(req.params.invId)) return res.status(400).json({ message: 'Invitación inválida.' })
    const invitation = await TeamInvitation.findOneAndUpdate(
      { _id: req.params.invId, team: team._id, status: 'pending' },
      { $set: { status: 'cancelled', respondedAt: new Date() } },
      { new: true },
    ).populate('user', 'nick avatar playerCode')
    if (!invitation) return res.status(404).json({ message: 'Esa invitación ya no está pendiente.' })
    res.json({ invitation: publicInvitation(invitation) })
  } catch (err) { next(err) }
}

// GET /teams/invitations/mine -- las que recibio el jugador (pendientes y vigentes).
export async function getMyInvitations(req, res, next) {
  try {
    const invitations = await TeamInvitation.find({ user: req.user._id, status: 'pending', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .populate('team', 'name tag logo game publicCode university')
      .lean()
    res.json({ invitations: invitations.filter(inv => inv.team).map(publicInvitation) })
  } catch (err) { next(err) }
}

// POST /teams/invitations/:invId/respond { accept } -- el invitado responde.
export async function respondTeamInvitation(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.invId)) return res.status(400).json({ message: 'Invitación inválida.' })
    const invitation = await TeamInvitation.findOne({ _id: req.params.invId, user: req.user._id })
    if (!invitation || invitation.status !== 'pending') return res.status(404).json({ message: 'Esa invitación ya no está pendiente.' })
    if (invitationExpired(invitation)) return res.status(410).json({ message: 'La invitación venció. Pide al líder que te invite de nuevo.' })

    const team = await Team.findById(invitation.team)
    if (!team) {
      invitation.status = 'cancelled'
      invitation.respondedAt = new Date()
      await invitation.save()
      return res.status(404).json({ message: 'El equipo ya no existe.' })
    }

    const accept = req.body?.accept === true
    const role = normalizeTeamRole(invitation.role)
    const asRole = role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}`
    if (accept) {
      const me = await User.findById(req.user._id).select(INVITEE_FIELDS)
      // Mismas comprobaciones que aceptar una solicitud: el equipo o el
      // jugador pudieron cambiar desde que se envio la invitacion.
      await addMemberChecked(team, me, { self: true, role })
      await team.save()
    }

    invitation.status = accept ? 'accepted' : 'declined'
    invitation.respondedAt = new Date()
    await invitation.save()

    await sendNotif(team.leader, {
      type: 'team_invitation_result',
      title: accept ? 'Invitación aceptada' : 'Invitación rechazada',
      message: accept
        ? `${req.user.nick} aceptó tu invitación y ya está en ${team.name}${asRole}.`
        : `${req.user.nick} rechazó tu invitación a ${team.name}${asRole}.`,
      link: '/mi-equipo/solicitudes',
      meta: { teamId: String(team._id), teamName: team.name, invitationId: String(invitation._id), accepted: accept, nick: req.user.nick || '', role },
    }).catch(() => {})

    res.json({
      invitation: publicInvitation(invitation),
      team: accept ? { id: String(team._id), name: team.name, publicCode: team.publicCode, role } : null,
    })
  } catch (err) { next(err) }
}

// Snapshot de la salida para el historial (#jugador-equipos-anteriores) --
// no interrumpe leaveTeam si falla (no es motivo para bloquear salir del
// equipo), solo se loguea.
async function recordTeamMembershipDeparture(user, team, role, reason) {
  try {
    await TeamMembershipHistory.create({
      user: user._id,
      team: reason === 'disbanded' ? null : team._id,
      teamName: team.name,
      teamTag: team.tag || '',
      teamLogo: team.logo || '',
      teamColor: team.color || '',
      game: team.game || '',
      role,
      teamRole: memberTeamRole(team, user),
      reason,
    })
  } catch (e) {
    console.error('[team] No se pudo registrar historial de salida:', e.message)
  }
}

export async function leaveTeam(req, res, next) {
  try {
    if (!config.mongoEnabled) {
      const idx = demoTeams.findIndex(t => t.members.includes(req.user._id))
      if (idx === -1) return res.status(400).json({ message: 'You are not in a team' })
      const t = demoTeams[idx]
      if (t.leader === req.user._id && t.members.filter(m => m !== req.user._id).length) {
        return res.status(400).json({ message: 'Transfer leadership before leaving the team' })
      }
      if (t.leader === req.user._id) demoTeams.splice(idx, 1)
      else t.members = t.members.filter(m => m !== req.user._id)
      return res.json({ message: 'Success' })
    }

    // Quien está en varios equipos (líder de uno, miembro de otro) dice de
    // cuál sale; sin `teamId` se mantiene el comportamiento viejo (el primero).
    const membership = { $or: [{ leader: req.user._id }, { members: req.user._id }] }
    const requestedTeamId = String(req.body?.teamId || '').trim()
    let team
    if (requestedTeamId) {
      const lookup = mongoose.isValidObjectId(requestedTeamId)
        ? { _id: requestedTeamId }
        : { publicCode: requestedTeamId.toUpperCase() }
      team = await Team.findOne({ ...lookup, ...membership })
      if (!team) return res.status(404).json({ message: 'No perteneces a ese equipo.' })
    } else {
      team = await Team.findOne(membership)
      if (!team) return res.status(400).json({ message: 'You are not in a team' })
    }
    await assertRosterNotLocked(team._id)

    if (team.leader.toString() === req.user._id.toString()) {
      const otherMembers = (team.members || []).filter(memberId => String(memberId) !== String(req.user._id))
      // No alcanza con que el ID siga en el array: si esa cuenta ya no
      // existe (ej. se borro directo de la base en algun momento), no es
      // "otro miembro" real a quien transferirle el liderazgo -- bloquear
      // acá dejaba al lider sin forma de disolver un equipo que, para el,
      // esta vacio. De paso se limpia esa referencia huerfana.
      const validOtherMemberIds = otherMembers.length
        ? (await User.find({ _id: { $in: otherMembers } }).select('_id').lean()).map(u => String(u._id))
        : []
      const staleMemberIds = otherMembers.filter(memberId => !validOtherMemberIds.includes(String(memberId)))
      if (staleMemberIds.length) {
        await Team.updateOne({ _id: team._id }, { $pull: { members: { $in: staleMemberIds } } })
      }
      if (validOtherMemberIds.length > 0) {
        return res.status(400).json({ message: 'Transfer leadership before leaving the team' })
      }
      const blocking = await activeTournamentForTeam(team._id)
      if (blocking) return res.status(409).json({ message: `No puedes disolver el equipo mientras esté inscrito en "${blocking.title}". Cancela la inscripción primero.` })
      await recordTeamMembershipDeparture(req.user, team, 'leader', 'disbanded')
      await User.updateMany({ team: team._id }, { team: null })
      await Team.deleteOne({ _id: team._id })
      return res.json({ message: 'Team disbanded' })
    }

    const teamRole = memberTeamRole(team, req.user)
    await recordTeamMembershipDeparture(req.user, team, 'member', 'left')
    await removeMemberFromTeam(team, req.user)
    // El lider se entera (antes la persona desaparecia del plantel sin aviso).
    await sendNotif(team.leader, {
      type: 'team_member_left',
      title: teamRole === 'player' ? 'Un jugador salió del equipo' : `Tu ${teamRoleLabel(teamRole).toLowerCase()} salió del equipo`,
      message: `${req.user.nick} salió de ${team.name}.`,
      link: '/mi-equipo',
      meta: { teamId: String(team._id), teamName: team.name, userId: String(req.user._id), nick: req.user.nick || '', role: teamRole },
    }).catch(() => {})
    res.json({ message: 'You left the team' })
  } catch (err) { next(err) }
}

// Saca a `user` de `team`: miembros, sus puestos del plantel y User.team.
async function removeMemberFromTeam(team, user) {
  const update = { $pull: { members: user._id } }
  if (team.rosterSlots && typeof team.rosterSlots === 'object') {
    const own = new Set(memberSlotEntries(team, user).map(([key]) => key))
    const remaining = Object.fromEntries(Object.entries(team.rosterSlots).filter(([key, slot]) => !own.has(key) && !(slot && slotBelongsToUser(slot, user))))
    if (Object.keys(remaining).length !== Object.keys(team.rosterSlots).length) update.$set = { rosterSlots: remaining }
  }
  await Team.updateOne({ _id: team._id }, update)
  // Con un equipo por juego puede seguir en otro: User.team apunta a ese.
  const stillIn = await Team.findOne({ members: user._id }).select('_id').lean()
  await User.updateOne({ _id: user._id }, { team: stillIn?._id || null })
}

// DELETE /teams/:teamId/members/:userId { reason? } -- el lider saca a alguien
// (jugador o staff). Antes "quitar del roster" solo vaciaba el puesto: la
// persona seguia en el equipo, con acceso, ocupando cupo y sin poder entrar
// a otro equipo del mismo juego. Respeta el roster congelado de los torneos.
export async function removeTeamMember(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Miembro inválido.' })
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    if (sameId(req.params.userId, req.user._id)) return res.status(400).json({ message: 'No puedes sacarte a ti mismo: transfiere el liderazgo o disuelve el equipo.' })
    if (!(team.members || []).some(id => sameId(id, req.params.userId))) return res.status(404).json({ message: 'Esa persona no está en el equipo.' })
    await assertRosterNotLocked(team._id)

    const member = await User.findById(req.params.userId).select('nick email playerCode discord gamerProfile')
    const target = member || { _id: req.params.userId }
    const teamRole = memberTeamRole(team, target)
    const reason = String(req.body?.reason || '').trim().slice(0, 280)
    await recordTeamMembershipDeparture(target, team, 'member', 'removed')
    await removeMemberFromTeam(team, target)
    if (member) {
      await sendNotif(member._id, {
        type: 'team_member_removed',
        title: 'Saliste de un equipo',
        message: `El líder de ${team.name} te sacó del equipo${teamRole === 'player' ? '' : ` (eras ${teamRoleLabel(teamRole).toLowerCase()})`}.${reason ? ` Motivo: ${reason}` : ''}`,
        link: '/jugador/equipos',
        meta: { teamId: String(team._id), teamName: team.name, teamTag: team.tag, teamLogo: team.logo || '', role: teamRole, reason },
      }).catch(() => {})
    }
    const fresh = await Team.findById(team._id)
    res.json({ message: 'Miembro removido', removed: { userId: String(req.params.userId), role: teamRole }, team: protectInternalCode(fresh, req.user._id) })
  } catch (err) { next(err) }
}

// PATCH /teams/:teamId/members/:userId/role { role } -- el lider cambia el
// rol de un miembro (jugador <-> coach/analista/manager). Pasar a jugador
// aplica las reglas de jugador (cupo, femenino/universidad, un equipo por
// juego); pasar a staff, el cupo de staff. El lider sigue siendo capitan
// (titular-1): para dejar de jugar primero transfiere el liderazgo.
export async function changeTeamMemberRole(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: 'Miembro inválido.' })
    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado o no eres el líder.' })
    if (!(team.members || []).some(id => sameId(id, req.params.userId))) return res.status(404).json({ message: 'Esa persona no está en el equipo.' })
    if (sameId(req.params.userId, team.leader)) return res.status(400).json({ message: 'El líder es el capitán del equipo. Para cambiar su rol, primero transfiere el liderazgo.' })
    if (!TEAM_ROLES.includes(String(req.body?.role || '').trim().toLowerCase())) return res.status(400).json({ message: 'Rol inválido.' })
    const role = normalizeTeamRole(req.body.role)

    const member = await User.findById(req.params.userId).select(INVITEE_FIELDS)
    if (!member) return res.status(404).json({ message: 'Esa cuenta ya no existe.' })
    const current = memberTeamRole(team, member)
    if (current === role) return res.json({ message: 'Sin cambios', role, team: protectInternalCode(team, req.user._id) })
    await assertRosterNotLocked(team._id)

    if (role === 'player') {
      const full = playerCapacityBlocker(team, { ignoreUser: member })
      if (full) return res.status(full.status).json({ message: full.message, code: full.code })
      const eligibilityError = teamEligibilityError(member, team)
      if (eligibilityError) return res.status(400).json({ message: `${member.nick} no cumple las reglas de jugador del equipo: ${eligibilityError}` })
      const sameGameTeam = await sameGameMembership(member._id, team)
      if (sameGameTeam) return res.status(400).json({ message: sameGameMembershipMessage(sameGameTeam, { self: false }) })
      const slots = { ...plainRosterSlots(team) }
      for (const [key] of memberSlotEntries(team, member)) delete slots[key]
      team.rosterSlots = slots
      addVerifiedUserRosterSlot(team, member)
    } else {
      const blocked = staffCapacityBlocker(team, role, { ignoreUser: member })
      if (blocked) return res.status(blocked.status).json({ message: blocked.message, code: blocked.code })
      assignStaffRosterSlot(team, member, role)
    }
    team.markModified('rosterSlots')
    await team.save()

    await sendNotif(member._id, {
      type: 'team_role_changed',
      title: 'Cambió tu rol en el equipo',
      message: `En ${team.name} ahora eres ${teamRoleLabel(role).toLowerCase()} (antes ${teamRoleLabel(current).toLowerCase()}).`,
      link: '/jugador/equipos',
      meta: { teamId: String(team._id), teamName: team.name, role, previousRole: current },
    }).catch(() => {})
    res.json({ message: 'Rol actualizado', role, previousRole: current, team: protectInternalCode(team, req.user._id) })
  } catch (err) { next(err) }
}

export async function transferTeamLeadership(req, res, next) {
  try {
    const { newLeaderId } = req.body || {}
    if (!newLeaderId) return res.status(400).json({ message: 'newLeaderId is required' })

    if (!config.mongoEnabled) {
      const team = demoTeams.find(t => String(t._id || t.id) === String(req.params.teamId) && String(t.leader) === String(req.user._id))
      if (!team) return res.status(404).json({ message: 'Team not found or you are not the leader' })
      if (!team.members.map(String).includes(String(newLeaderId))) {
        return res.status(400).json({ message: 'New leader must be a team member' })
      }
      team.leader = newLeaderId
      return res.json({ team })
    }

    const team = await Team.findOne({ _id: req.params.teamId, leader: req.user._id })
    if (!team) return res.status(404).json({ message: 'Team not found or you are not the leader' })

    const isMember = (team.members || []).some(memberId => String(memberId) === String(newLeaderId))
    if (!isMember) return res.status(400).json({ message: 'New leader must be a team member' })
    if (String(newLeaderId) === String(req.user._id)) {
      return res.status(400).json({ message: 'You are already the leader' })
    }

    team.leader = newLeaderId
    if (!team.members.some(memberId => String(memberId) === String(req.user._id))) {
      team.members.push(req.user._id)
    }
    await team.save()

    // Antes el cambio era silencioso: el nuevo lider se enteraba solo si
    // entraba a revisar el equipo.
    const newLeader = await User.findById(newLeaderId).select('nick').lean()
    const meta = { kind: 'leader_transfer', teamId: String(team._id), teamName: team.name || '', teamLogo: team.logo || '', previousLeader: req.user.nick || '', newLeader: newLeader?.nick || '' }
    await sendNotif(newLeaderId, {
      type: 'team_leader_transfer',
      title: 'Ahora eres líder del equipo',
      message: `${req.user.nick || 'El líder anterior'} te pasó el liderazgo de ${team.name}. Ya puedes gestionar roster, solicitudes e invitaciones.`,
      link: '/mi-equipo',
      meta,
    }).catch(() => {})
    const others = (team.members || []).map(String).filter(id => id !== String(newLeaderId) && id !== String(req.user._id))
    await Promise.all(others.map(id => sendNotif(id, {
      type: 'team_leader_transfer',
      title: 'Nuevo líder del equipo',
      message: `${newLeader?.nick || 'Un compañero'} es el nuevo líder de ${team.name}.`,
      link: `/equipos/${team.publicCode || team._id}`,
      meta,
    }).catch(() => {})))

    const populated = await Team.findById(team._id)
      .populate('leader', 'nick avatar playerCode roles role status activeStatus lastSeenAt discord')
      .populate('members', `nick avatar playerCode roles role status discord games gamerProfile ${ROLE_BADGE_FIELDS}`)
      .lean()

    res.json({ team: populated })
  } catch (err) { next(err) }
}

export async function getRanking(req, res, next) {
  try {
    if (!config.mongoEnabled) {
      return res.json(demoTeams.map((t, i) => ({ rank: i + 1, name: t.name, tag: t.tag, color: t.color, pts: t.rankPts, wins: t.wins, losses: t.losses, mine: Boolean(req.user?._id && t.members.includes(req.user._id)) })))
    }

    const teams = await Team.find().sort({ rankPts: -1 }).populate('members', '_id').lean()
    const userId = req.user?._id ? String(req.user._id) : ''
    res.json(teams.map((t, i) => ({
      rank: i + 1, name: t.name, tag: t.tag, publicCode: t.publicCode, color: t.color,
      pts: t.rankPts, wins: t.wins, losses: t.losses,
      mine: Boolean(userId && t.members.some(m => String(m._id) === userId)),
    })))
  } catch (err) { next(err) }
}

// Lógica de unión compartida entre la ruta HTTP (sesión/cookie) y el bot de
// Discord (identidad resuelta por discordId) -- una sola fuente de reglas.
// `joinTeam` (arriba) es un wrapper delgado sobre esta función; NO llamar a
// `joinTeam` desde acá, o se vuelve una recursión infinita (bug real que
// tuvo esta función hasta que se detectó: cualquiera que se uniera por
// código de invitación producía un stack overflow).
export async function joinTeamForUser(user, inviteCode) {
  const team = await Team.findOne({ teamInviteCode: inviteCode })
  if (!team) throw Object.assign(new Error('Invalid invite code'), { status: 404 })
  if (!team.acceptRequests) throw Object.assign(new Error('This team is not accepting members'), { status: 403 })

  // Un equipo universitario no es "un equipito cualquiera" -- el líder es
  // el encargado de meter a sus aliados, no un código que cualquiera use.
  if (team.university?.isUniversityTeam) {
    throw Object.assign(new Error('Este equipo universitario no acepta código de invitación directo: pide al líder que te invite por tu nick, o solicita unirte desde su perfil.'), { status: 403 })
  }
  const eligibilityError = teamEligibilityError(user, team)
  if (eligibilityError) throw Object.assign(new Error(eligibilityError), { status: 403 })

  const sameGameTeam = await sameGameMembership(user._id, team)
  if (sameGameTeam) throw Object.assign(new Error(sameGameMembershipMessage(sameGameTeam)), { status: 400 })

  // El codigo de invitacion entra como jugador: el staff entra con invitacion
  // o solicitud "como coach/analista/manager".
  const full = playerCapacityBlocker(team)
  if (full) throw Object.assign(new Error(full.message), { status: full.status })
  await assertRosterNotLocked(team._id)

  if (!team.members.some(memberId => String(memberId) === String(user._id))) {
    team.members.push(user._id)
  }
  addVerifiedUserRosterSlot(team, user)
  await team.save()
  await User.updateOne({ _id: user._id }, { team: team._id })

  return { message: `Joined ${team.name}`, team: { name: team.name, tag: team.tag, publicCode: team.publicCode } }
}
