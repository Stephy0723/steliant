import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { isBetaHidden } from '../../../config/betaHidden.js'
import TeamRecruitment, { ProCardButton } from './TeamRecruitment.jsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { api } from '../../../lib/api.js'
import { uploadFile } from '../../../lib/uploadsApi.js'
import { toast } from '../../../lib/toast.js'
import { readTeamJoinRequests, teamRequestTeamId, updateLocalTeamJoinRequest } from '../../../lib/teamJoinRequests.js'
import { rosterSlotPositionLabel, GAME_ROSTER_SLOTS_LABELS } from '../../../data/rosterSlots.js'
import { WHATSAPP_ENABLED } from '../../../config/featureFlags.js'
import { TEAM_DEFAULT_COLOR, isTeamColorTooDark, parseHexColor, teamColor } from '../../../lib/teamColor.js'
import TeamMatchups from '../../../components/TeamMatchups/TeamMatchups.jsx'
import TeamCoachPlans from '../../../components/TeamCoachPlans/TeamCoachPlans.jsx'
import { useRosterLock, rosterLockMessage } from '../../../lib/useRosterLock.js'
import { proAccountIdFor } from '../../../lib/roleCard.js'
import TeamInvitations from './TeamInvitations.jsx'
import SlotAssignPanel from './SlotAssignPanel.jsx'
import { checkGameAccountId, gameAccountFormat } from '../../../../../shared/gameAccountIds.mjs'
import { gameKeyOf } from '../../../../../shared/games.mjs'
import { TEAM_ROLES, STAFF_ROLE_MAX, staffRoleOfSlot, staffSlotLabel, teamRoleLabel, teamMaxStaff } from '../../../../../shared/teamRoles.mjs'
import { isMobileLegends } from '../../../../../shared/matchStats.mjs'
import { GameAccountBadge, GameIdVerify } from '../../../components/GameAccountConnect/GameAccountConnect.jsx'
import { gameAccountsApi } from '../../../lib/gameAccountsApi.js'
import './MyTeamPanel.css'
import './team-hq.css'

const DEFAULT_TEAM = {
  name: '',
  tag: '',
  game: '',
  region: '',
  level: '',
  category: '',
  lang: '',
  slogan: '',
  description: '',
  banner: '',
  logo: '',
  brand: '',
  sponsor: '',
  sponsors: [],
  mainCharacters: [],
  socials: {},
  contactEmail: '',
  publicProfile: true,
  acceptRequests: true,
  showRoster: true,
  showStaff: true,
  showSponsors: true,
  showTournaments: true,
  showSocials: true,
  showContactEmail: false,
  showCompetitiveSummary: true,
  hideEmails: true,
  hideGameId: false,
  rosterSlots: {},
}

// Etiquetas que el lider puede cambiar (colores = GG_TEAM_TIERS de la tarjeta).
// Legendario / Siguiente Liga las asigna la plataforma y no salen aqui.
const TEAM_TIER_OPTS = [
  { id: 'nuevo', label: 'Nuevo', color: '#00E676' },
  { id: 'universitario', label: 'Universitario', color: '#3B82F6' },
  { id: 'femenino', label: 'Femenino', color: '#FF4FD8' },
  { id: 'profesional', label: 'Profesional', color: '#EF4444' },
]

// Pone/quita una etiqueta publica; siempre queda al menos una (Nuevo si no hay otra).
function toggleTier(current, id) {
  const list = Array.isArray(current) ? current : []
  const next = list.includes(id) ? list.filter(t => t !== id) : [...list, id]
  return next.some(t => TEAM_TIER_OPTS.some(opt => opt.id === t)) ? next : [...next, 'nuevo']
}

const TEAM_REGION_OPTS = [
  { value: 'CAR', label: 'CAR · Caribe' },
  { value: 'LAN', label: 'LAN · LATAM Norte' },
  { value: 'LAS', label: 'LAS · LATAM Sur' },
  { value: 'NA', label: 'NA · Norteamérica' },
  { value: 'EU', label: 'EU · Europa' },
  { value: 'Global', label: 'Global' },
]

const TEAM_LANG_OPTS = [
  'Español', 'Inglés', 'Bilingüe', 'Portugués', 'Francés', 'Italiano',
  'Alemán', 'Árabe', 'Chino', 'Japonés', 'Coreano', 'Ruso', 'Hindi',
  'Criollo haitiano', 'Otro',
]

// Nota: 'whatsapp' tampoco existe en el schema de Team.socials -- si se
// reactiva aqui, agregar tambien el campo en backend/src/models/Team.js.
const SOCIAL_FIELDS = [
  ['discord', 'Discord'],
  ...(WHATSAPP_ENABLED ? [['whatsapp', 'WhatsApp']] : []),
  ['instagram', 'Instagram'],
  ['twitter', 'Twitter / X'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['website', 'Sitio web'],
]

// Staff (shared/teamRoles.mjs): coach principal, coach asistente, analista y manager.
const DEFAULT_SLOT_LABELS = ['titular-1', 'titular-2', 'titular-3', 'titular-4', 'titular-5', 'sub-1', 'sub-2', 'coach', 'coach-2', 'analyst', 'manager', 'patrocinador-1']
const TEAM_SCRIM_KEYS = {
  scrims: 'gg-teams-scrims-v1',
  recentVs: 'gg-teams-recent-vs-v1',
  history: 'gg-teams-scrim-history-v1',
}
const TEAM_CALENDAR_KEY = 'gg-team-calendar-v1'
const TEAM_CALENDAR_COLORS = ['#00E676', '#FF4655', '#7c3aed', '#F0A500', '#1E9DE3', '#E1306C']
const TEAM_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const TEAM_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function teamDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseTeamDate(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return new Date(`${value}T12:00:00`)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function teamCalendarStorageKey(teamId = 'local') {
  return `${TEAM_CALENDAR_KEY}-${teamId || 'local'}`
}

function readTeamActivities(teamId) {
  return readLocal(teamCalendarStorageKey(teamId), [])
}

function writeTeamActivities(teamId, activities) {
  writeLocal(teamCalendarStorageKey(teamId), activities)
}

function formatTeamShortDate(value) {
  const date = parseTeamDate(value)
  if (!date) return '--'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })
}

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value || fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function rosterArrayToSlots(roster) {
  if (!Array.isArray(roster)) return {}
  return roster.reduce((acc, player, index) => {
    acc[`titular-${index + 1}`] = {
      nick: player.nick || player.name || `Jugador ${index + 1}`,
      role: player.role || 'Jugador',
      gameId: player.gameId || player.playerCode || '',
      email: player.email || '',
      avatar: player.avatar || '',
      status: player.status || 'Sincronizado',
    }
    return acc
  }, {})
}

function normalizeTeam(team) {
  if (!team || typeof team !== 'object') return null
  const rosterSlots = team.rosterSlots && typeof team.rosterSlots === 'object'
    ? team.rosterSlots
    : rosterArrayToSlots(team.roster)
  return {
    ...DEFAULT_TEAM,
    ...team,
    id: team._id || team.id,
    rosterSlots,
    socials: team.socials && typeof team.socials === 'object' ? team.socials : {},
    sponsors: Array.isArray(team.sponsors) ? team.sponsors : [],
    mainCharacters: Array.isArray(team.mainCharacters) ? team.mainCharacters : [],
    challengerMode: team.challengerMode || { active: false, currentMonthTickets: 0, streak: 0, totalTicketsCompleted: 0 }
  }
}

function readLocalTeam() {
  return null
}

function writeLocalTeam(team) {
  return team || null
}

function readLocal(key, fallback) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {}
}

const MOCK_PRO_CHALLENGER_TEAMS = [
  { id: 101, name: 'Glitch Core', tag: 'GLC', game: 'Mobile Legends', tiers: ['profesional', 'legendario'], region: 'LAS', rankPts: 2840, slogan: 'Hasta la gloria final.', challengerMode: { active: true, currentMonthTickets: 4, streak: 3 } },
  { id: 105, name: 'Royal Dynasty', tag: 'RD', game: 'Tekken 8', tiers: ['legendario', 'sig_liga'], region: 'Global', rankPts: 2100, slogan: 'Golpes de realeza', challengerMode: { active: true, currentMonthTickets: 6, streak: 5 } }
]

const MOCK_CHALLENGER_TICKETS = [
  {
    id: 'mock-ch-1',
    publicCode: 'CHKT-001-202607',
    internalCode: 'CHKT-260714-001-202607',
    challengerTeam: { name: 'Cyber Queens', tag: 'CQ', logo: '', game: 'League of Legends', rankPts: 1550 },
    proTeam: { id: 101, name: 'Glitch Core', tag: 'GLC', game: 'Mobile Legends' },
    game: 'League of Legends',
    format: 'BO3',
    scheduledDate: '2026-07-18',
    scheduledTime: '19:00',
    message: 'Hola Glitch Core, queremos jugar contra ustedes para medir nuestro nivel.',
    status: 'pending',
    result: { winner: '', score: '', reportedByChallenger: false, reportedByPro: false },
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-ch-2',
    publicCode: 'CHKT-002-202607',
    internalCode: 'CHKT-260714-002-202607',
    challengerTeam: { name: 'Phoenix Esports', tag: 'PHX', logo: '', game: 'CS2', rankPts: 1200 },
    proTeam: { id: 105, name: 'Royal Dynasty', tag: 'RD', game: 'Tekken 8' },
    game: 'Tekken 8',
    format: 'BO1',
    scheduledDate: '2026-07-12',
    scheduledTime: '21:00',
    status: 'completed',
    result: { winner: 'pro', score: '2-0', reportedByChallenger: true, reportedByPro: true, confirmedAt: new Date().toISOString() },
    createdAt: new Date().toISOString()
  }
]

function isProfessionalTeam(team) {
  if (team?.competitive?.eligibility?.canBeChallenged !== undefined) {
    return Boolean(team.competitive.eligibility.canBeChallenged)
  }
  const tiers = (team?.tiers || []).map(tier => String(tier).toLowerCase())
  const level = String(team?.level || '').toLowerCase()
  return tiers.includes('profesional') ||
    tiers.includes('legendario') ||
    tiers.includes('sig_liga') ||
    level === 'profesional' ||
    level === 'professional'
}

function ticketTeamId(value) {
  return String(value?._id || value?.id || value || '')
}

function isSameGame(a, b) {
  if (!a || !b) return true
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
}

function isActiveTicket(ticket) {
  return ['accepted', 'scheduled', 'played'].includes(ticket?.status)
}

function canSendChallenge(team) {
  if (team?.competitive?.eligibility?.canChallenge !== undefined) {
    return Boolean(team.competitive.eligibility.canChallenge)
  }
  return true
}

function initials(value) {
  return String(value || 'GG')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

// Jugador antes que staff/patrocinador -- el orden alfabetico ponia
// "coach"/"manager"/"patrocinador" primero, asi que al aceptar una
// solicitud el primer slot "vacante" auto-asignado terminaba siendo uno
// de esos en vez de un puesto real de jugador.
function rosterSlotSortRank(slot = '') {
  const key = String(slot).toLowerCase()
  if (key.startsWith('titular')) return 0
  if (key.startsWith('sub')) return 1
  return 2
}

function rosterSlotRows(slots = {}) {
  const keys = Array.from(new Set([...DEFAULT_SLOT_LABELS, ...Object.keys(slots || {})]))
  return keys
    .sort((a, b) => {
      const rankDiff = rosterSlotSortRank(a) - rosterSlotSortRank(b)
      return rankDiff !== 0 ? rankDiff : a.localeCompare(b, undefined, { numeric: true })
    })
    .map(slot => ({ slot, player: slots?.[slot] || null }))
}

function patchRosterSlot(slots, slot, value) {
  const next = { ...(slots || {}) }
  if (!value?.nick) delete next[slot]
  else next[slot] = value
  return next
}

// Tipo de puesto: jugador, el rol de staff, o marca.
function rosterSlotGroupKind(slot = '') {
  if (/^(patrocinador|sponsor)/.test(slot)) return 'sponsor'
  return staffRoleOfSlot(slot) || 'player'
}

// Nombre del puesto en el plantel (no la posicion en el juego).
function rosterSlotSeatLabel(slot = '') {
  const [kind, num] = String(slot).split('-')
  if (kind === 'titular') return `Titular ${num || ''}`.trim()
  if (kind === 'sub') return `Suplente ${num || ''}`.trim()
  if (staffRoleOfSlot(slot)) return staffSlotLabel(slot)
  if (kind === 'patrocinador' || kind === 'sponsor') return 'Patrocinador'
  return slot
}

function rosterSlotGroup(slot = '') {
  if (slot.startsWith('titular')) return 'titulares'
  if (slot.startsWith('sub')) return 'suplentes'
  if (staffRoleOfSlot(slot)) return 'staff'
  if (slot.startsWith('patrocinador') || slot.startsWith('sponsor')) return 'patrocinadores'
  return 'otros'
}

// Opciones de rol validas para el juego del equipo (ej: Duelista, Iniciador,
// Controlador... en Valorant) en vez de dejar el rol como texto libre.
function rosterSlotRoleOptions(slot = '', game = '') {
  const labels = GAME_ROSTER_SLOTS_LABELS[game]
  if (!labels) return []
  if (slot.startsWith('titular')) return labels.titulares || []
  if (slot.startsWith('sub')) return labels.suplentes || []
  if (staffRoleOfSlot(slot)) return labels.coach || []
  return []
}

// Etiqueta y ejemplo del ID segun el juego del equipo (Riot ID, BattleTag,
// UID, ID + Zona...). Antes solo LoL y Valorant tenian pista, y por nombre exacto.
function gameIdHint(game = '', value = '') {
  const format = gameAccountFormat(game)
  const check = checkGameAccountId(game, value)
  return {
    label: format.label,
    placeholder: format.placeholder,
    hint: check.ok ? format.hint : check.message,
  }
}

function rosterSlotGroupTitle(group) {
  return {
    titulares: 'Equipo titular',
    suplentes: 'Suplentes',
    staff: 'Staff competitivo',
    patrocinadores: 'Patrocinadores',
    otros: 'Otros miembros',
  }[group] || 'Roster'
}


function normalizeSocials(player = {}) {
  const socials = {
    ...(player.gamerProfile?.socials || {}),
    ...(player.social || {}),
    ...(player.socials || {}),
  }
  const verifiedDiscord = player.discordName || player.discord?.username || player.user?.discord?.username
  if (verifiedDiscord) socials.discord = verifiedDiscord
  return socials
}

function verifiedDiscordValue(player = {}) {
  return player.discordName || player.discord?.username || player.socials?.discord || player.social?.discord || ''
}

function normalizeCharacters(player = {}, teamCharacters = []) {
  const values = player.mainCharacters
    || player.characters
    || player.agents
    || player.heroes
    || player.gamerProfile?.mainCharacters
    || player.gamerProfile?.characters
    || []
  const list = Array.isArray(values)
    ? values
    : String(values || '').split(',')
  const cleaned = list.map(item => String(item || '').trim()).filter(Boolean)
  return cleaned.length ? cleaned : teamCharacters
}

function mergeRosterPlayer(slotPlayer, profileUser, game = '') {
  if (!profileUser) return slotPlayer
  const discordName = slotPlayer?.discordName || profileUser.discord?.username || ''
  return {
    ...profileUser,
    ...slotPlayer,
    avatar: slotPlayer?.avatar || profileUser.avatar,
    role: slotPlayer?.role || profileUser.gamerProfile?.mainRole || profileUser.role,
    // Si el puesto no tiene ID, el que el jugador guardo en su tarjeta para ESTE juego.
    gameId: slotPlayer?.gameId || proAccountIdFor(profileUser, game) || profileUser.gamerProfile?.gameId || profileUser.playerCode,
    email: slotPlayer?.email || profileUser.email || '',
    discordId: slotPlayer?.discordId || profileUser.discord?.id || '',
    discordName,
    social: { ...(profileUser.social || {}), ...(slotPlayer?.social || slotPlayer?.socials || {}), ...(discordName ? { discord: discordName } : {}) },
    socials: { ...(profileUser.socials || profileUser.social || {}), ...(slotPlayer?.socials || slotPlayer?.social || {}), ...(discordName ? { discord: discordName } : {}) },
    mainCharacters: slotPlayer?.mainCharacters || slotPlayer?.characters || profileUser.gamerProfile?.mainCharacters || profileUser.mainCharacters,
  }
}

function rosterLookupKeys(player = {}) {
  return [
    player.nick,
    player.playerCode,
    player.publicCode,
    player.internalCode,
    player.id,
    player.gameId,
  ]
    .map(value => String(value || '').trim())
    .filter(value => value && !/^(sin id|id oculto|vacante|n\/a)$/i.test(value))
}

function socialHref(key, value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  if (key === 'discord') return clean.includes('discord.') ? `https://${clean}` : `https://discord.gg/${clean.replace(/^@/, '')}`
  if (key === 'instagram') return `https://instagram.com/${clean.replace(/^@/, '')}`
  if (key === 'tiktok') return `https://tiktok.com/@${clean.replace(/^@/, '')}`
  if (key === 'youtube') return `https://youtube.com/${clean.replace(/^@/, '')}`
  if (key === 'twitch') return `https://twitch.tv/${clean.replace(/^@/, '')}`
  if (key === 'twitter' || key === 'x') return `https://twitter.com/${clean.replace(/^@/, '')}`
  if (key === 'website' || key === 'web') return `https://${clean.replace(/^https?:\/\//, '')}`
  if (key === 'whatsapp') return `https://wa.me/${clean.replace(/[^\d+]/g, '')}`
  return clean
}

function parseSponsors(value) {
  return String(value || '')
    .split('\n')
    .map(line => {
      const [name, tier, website, logo, since, location, description, instagram, twitter, discord, contact] = line.split('|').map(part => part.trim())
      return name ? {
        name,
        tier: tier || 'Sponsor',
        website: website || '',
        logo: logo || '',
        since: since || '',
        location: location || '',
        description: description || '',
        contact: contact || '',
        socials: {
          instagram: instagram || '',
          twitter: twitter || '',
          discord: discord || '',
        },
      } : null
    })
    .filter(Boolean)
}

function formatSponsors(value) {
  return Array.isArray(value)
    ? value.map(item => [
        item.name,
        item.tier,
        item.website,
        item.logo,
        item.since,
        item.location,
        item.description,
        item.socials?.instagram,
        item.socials?.twitter || item.socials?.x,
        item.socials?.discord,
        item.contact,
      ].filter(Boolean).join(' | ')).join('\n')
    : ''
}

function normalizeJoinRequest(request, team, index = 0, source = 'backend') {
  const user = request?.user && typeof request.user === 'object' ? request.user : null
  // `request.role` del backend es el rol EN EL EQUIPO (player/coach/...);
  // el rol en el juego sale del perfil del jugador.
  const teamRole = TEAM_ROLES.includes(request?.role) ? request.role : 'player'
  const staffCard = teamRole !== 'player' && request?.card && typeof request.card === 'object' && request.card.role ? request.card : null
  return {
    id: String(request?._id || request?.id || `request-${source}-${index}`),
    source,
    teamId: String(request?.teamId || teamRequestTeamId(team)),
    nick: request?.nick || user?.nick || user?.name || user?.username || 'Jugador',
    teamRole,
    roleVerified: Boolean(staffCard?.verified),
    staffCode: staffCard?.code || '',
    role: teamRole !== 'player'
      ? teamRoleLabel(teamRole)
      : (TEAM_ROLES.includes(request?.role) ? '' : request?.role) || user?.gamerProfile?.mainRole || 'Rol sin definir',
    // La tarjeta con la que se postulo trae el ID de cada juego: se usa el del juego del equipo.
    gameId: request?.gameId
      || (request?.card?.entries || []).find(e => e?.accountId && gameKeyOf(e.gameId) === gameKeyOf(team?.game))?.accountId
      || proAccountIdFor(user, team?.game)
      || user?.playerCode || user?.gameId || user?.gamerProfile?.gameId || 'ID no publicado',
    region: request?.region || user?.country || user?.region || 'Region sin definir',
    message: request?.message || 'Quiere formar parte del equipo.',
    status: request?.status || 'pending',
    createdAt: request?.createdAt || request?.updatedAt || new Date().toISOString(),
    // Postulacion desde Buscar equipo: tarjeta de Jugador Pro (con contacto) del jugador.
    // Staff: su card es el perfil de coach/analista (otro formato), no se abre como tarjeta Pro.
    card: teamRole === 'player' ? (request?.card || null) : null,
    avatar: user?.avatar || '',
    playerCode: user?.playerCode || '',
  }
}

function requestStatusLabel(status) {
  if (status === 'accepted') return 'Aceptada'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'invited') return 'Invitado'
  return 'Pendiente'
}

export default function MyTeamPanel({ section = 'resumen' }) {
  const navigate = useNavigate()
  const panelContext = useOutletContext() || {}
  const { user, refreshUser } = useAuth()
  const [team, setTeam] = useState(null)
  const [myTeams, setMyTeams] = useState([])
  const [form, setForm] = useState(DEFAULT_TEAM)
  const [slotForm, setSlotForm] = useState({
    slot: 'titular-1',
    nick: '',
    role: '',
    gameId: '',
    email: '',
    avatar: '',
    bio: '',
    rank: '',
    availability: '',
    mainCharacters: '',
    discordId: '',
    discordName: '',
    socials: {},
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const rosterLock = useRosterLock(team?.id || team?._id)
  const [localJoinRequests, setLocalJoinRequests] = useState([])
  const [teamScrimState, setTeamScrimState] = useState({ scrims: [], recentVs: [], history: [] })
  const today = useMemo(() => new Date(), [])
  const todayKey = teamDateKey(today)
  const [teamActivities, setTeamActivities] = useState([])
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayKey)
  const [calendarPeriod, setCalendarPeriod] = useState('all')
  const [calendarType, setCalendarType] = useState('all')
  const [calendarQuery, setCalendarQuery] = useState('')
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityForm, setActivityForm] = useState({
    title: '',
    type: 'evento',
    date: todayKey,
    time: '19:00',
    game: '',
    color: TEAM_CALENDAR_COLORS[0],
    description: '',
  })
  const [rosterProfiles, setRosterProfiles] = useState({})
  const [activeRosterSlot, setActiveRosterSlot] = useState('')
  const [showRosterEditor, setShowRosterEditor] = useState(false)
  // Puesto vacio que se esta asignando (SlotAssignPanel: miembro o invitacion).
  const [assignSlot, setAssignSlot] = useState('')
  const [newLeaderId, setNewLeaderId] = useState('')
  const confirmResolverRef = useRef(null)
  const [confirmDialog, setConfirmDialog] = useState(null)

  // Challenger mode states
  const [challengerTickets, setChallengerTickets] = useState([])
  const [proChallengerTeams, setProChallengerTeams] = useState([])
  const [activeChallengerTab, setActiveChallengerTab] = useState('dashboard') // dashboard | mis_retos
  const [selectedProTeam, setSelectedProTeam] = useState(null)
  const [challengerLoading, setChallengerLoading] = useState(false)
  const [challengerError, setChallengerError] = useState('')
  const [challengerForm, setChallengerForm] = useState({
    game: '',
    format: 'BO3',
    scheduledDate: '',
    scheduledTime: '',
    message: ''
  })

  function askTeamConfirm(config) {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false)
    }
    return new Promise(resolve => {
      confirmResolverRef.current = resolve
      setConfirmDialog({
        tone: 'warn',
        confirmLabel: 'Aceptar',
        cancelLabel: 'Cancelar',
        ...config,
      })
    })
  }

  function closeTeamConfirm(accepted) {
    const resolve = confirmResolverRef.current
    confirmResolverRef.current = null
    setConfirmDialog(null)
    resolve?.(accepted)
  }

  useEffect(() => {
    if (panelContext.team) {
      const normalized = normalizeTeam(panelContext.team)
      setTeam(normalized)
      setForm(normalized || DEFAULT_TEAM)
      setError('')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    api('/teams/mine')
      .then(data => {
        if (!alive) return
        const list = Array.isArray(data?.teams) ? data.teams : []
        setMyTeams(list)
        const selectedId = localStorage.getItem('gg-active-team-id') || ''
        const selected = list.find(item => String(item._id || item.id) === String(selectedId)) || list[0] || null
        const normalized = normalizeTeam(selected)
        setTeam(normalized)
        setForm(normalized || DEFAULT_TEAM)
        setError(list.length ? '' : 'Todavía no tienes un equipo.')
      })
      .catch(err => {
        if (!alive) return
        setMyTeams([])
        setTeam(null)
        setForm(DEFAULT_TEAM)
        setError(err?.message || 'No se pudo cargar tu equipo')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [panelContext.team])

  // El layout (TeamPanelLayout) ya trae la lista completa de mis equipos --
  // esto ANTES quedaba en [] para siempre (nunca se llenaba en el camino
  // feliz de arriba), asi que el switcher de mas abajo nunca se mostraba y
  // solo se podia gestionar el equipo que el layout elegia por defecto (el
  // ultimo actualizado). Ahora se sincroniza con panelContext.teams.
  useEffect(() => {
    if (Array.isArray(panelContext.teams) && panelContext.teams.length) {
      setMyTeams(panelContext.teams)
    }
  }, [panelContext.teams])

  // Cambia cuál de tus equipos gestiona el panel -- pasa por el mismo
  // selector que usa el dropdown del topbar (TeamPanelLayout) para que
  // ambos queden sincronizados entre si.
  function switchTeam(teamId) {
    if (panelContext.selectTeam) { panelContext.selectTeam(teamId); return }
    const next = myTeams.find(t => String(t._id || t.id) === String(teamId))
    if (!next) return
    const normalized = normalizeTeam(next)
    setTeam(normalized)
    setForm(normalized || DEFAULT_TEAM)
  }

  useEffect(() => {
    setLocalJoinRequests(readTeamJoinRequests())
  }, [])

  useEffect(() => {
    const key = team?.id || team?._id || team?.publicCode || team?.tag || 'local'
    setTeamActivities(readTeamActivities(key))
  }, [team?.id, team?._id, team?.publicCode, team?.tag])

  useEffect(() => {
    let alive = true
    setChallengerLoading(true)
    setChallengerError('')
    api('/challenger/pro-teams')
      .then(res => {
        if (!alive) return
        const teams = Array.isArray(res?.teams) ? res.teams : []
        setProChallengerTeams(teams)
        writeLocal('gg-teams-pro-challenger-teams-v1', teams)
      })
      .catch((err) => {
        if (!alive) return
        setProChallengerTeams(readLocal('gg-teams-pro-challenger-teams-v1', []))
        setChallengerError(err?.message || 'No se pudo cargar el circuito retador.')
      })
      .finally(() => { if (alive) setChallengerLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!team?.id && !team?._id) return
    let alive = true
    const teamId = team.id || team._id
    setChallengerLoading(true)
    setChallengerError('')
    api(`/challenger/tickets/team/${teamId}`)
      .then(res => {
        if (!alive) return
        const tickets = Array.isArray(res?.tickets) ? res.tickets : []
        setChallengerTickets(tickets)
        writeLocal('gg-teams-challenger-tickets-v1', tickets)
      })
      .catch((err) => {
        if (!alive) return
        setChallengerTickets(readLocal('gg-teams-challenger-tickets-v1', []))
        setChallengerError(err?.message || 'No se pudieron cargar los retos.')
      })
      .finally(() => { if (alive) setChallengerLoading(false) })
    return () => { alive = false }
  }, [team])

  useEffect(() => {
    writeLocal('gg-teams-challenger-tickets-v1', challengerTickets)
  }, [challengerTickets])

  const refreshTeamScrims = () => {
    setTeamScrimState({
      scrims: readLocal(TEAM_SCRIM_KEYS.scrims, []),
      recentVs: readLocal(TEAM_SCRIM_KEYS.recentVs, []),
      history: readLocal(TEAM_SCRIM_KEYS.history, []),
    })
  }

  useEffect(() => {
    refreshTeamScrims()
    const onStorage = event => {
      if (Object.values(TEAM_SCRIM_KEYS).includes(event.key)) refreshTeamScrims()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const slotRows = useMemo(() => rosterSlotRows(form.rosterSlots), [form.rosterSlots])
  // Cuenta de MLBB verificada -> llena ID y nick del puesto propio.
  const fillVerifiedAccount = account => setSlotForm(prev => ({ ...prev, gameId: `${account.roleId} (${account.zoneId})`, nick: account.nickname || prev.nick }))
  // Insignia "cuenta de Mobile Legends verificada" por integrante (solo equipos de MLBB).
  const [gameAccountStatus, setGameAccountStatus] = useState({})
  const rosterUserIdsKey = useMemo(() => {
    const ids = Object.values(form.rosterSlots || {}).map(slot => String(slot?.userId || '')).filter(id => /^[a-f\d]{24}$/i.test(id))
    return [...new Set(ids)].sort().join(',')
  }, [form.rosterSlots])
  useEffect(() => {
    if (!rosterUserIdsKey || !isMobileLegends(form.game || team?.game)) return undefined
    let alive = true
    gameAccountsApi.status(rosterUserIdsKey.split(','))
      .then(d => { if (alive) setGameAccountStatus(d.statuses || {}) })
      .catch(() => {})
    return () => { alive = false }
  }, [rosterUserIdsKey, form.game, team?.game])

  const enrichedSlotRows = useMemo(() => slotRows.map(row => ({
    ...row,
    player: row.player ? mergeRosterPlayer(row.player, rosterProfiles[row.slot], form.game || team?.game) : null,
  })), [slotRows, rosterProfiles, form.game, team?.game])
  const groupedRosterRows = useMemo(() => {
    const groups = ['titulares', 'suplentes', 'staff', 'patrocinadores', 'otros']
    return groups
      .map(group => ({
        group,
        title: rosterSlotGroupTitle(group),
        rows: enrichedSlotRows.filter(row => rosterSlotGroup(row.slot) === group),
      }))
      .filter(item => item.rows.length)
  }, [enrichedSlotRows])
  const filledRows = slotRows.filter(row => row.player)
  const activeRosterRow = useMemo(() => {
    if (!activeRosterSlot) return null
    return enrichedSlotRows.find(row => row.slot === activeRosterSlot) || null
  }, [activeRosterSlot, enrichedSlotRows])
  const activeRosterPlayer = activeRosterRow?.player || null
  const currentUserId = String(user?._id || user?.id || '')
  const teamLeaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
  const isCurrentLeader = Boolean(currentUserId && teamLeaderId && currentUserId === teamLeaderId)
  // Cuentas miembro (para "Sacar del equipo" / "Cambiar rol") y cupos separados.
  const memberIdSet = useMemo(() => new Set((team?.members || []).map(m => String(m?._id || m?.id || m || '')).filter(Boolean)), [team?.members])
  const staffUsed = useMemo(() => Object.entries(form.rosterSlots || {})
    .filter(([key, slot]) => staffRoleOfSlot(key) && slot && (slot.nick || slot.userId)).length, [form.rosterSlots])
  const maxStaff = teamMaxStaff(team)

  // Un miembro (no lider) solo puede ver/editar el slot del roster que le
  // pertenece a EL -- se identifica por userId, guardado en rosterSlots
  // cuando reclama o se le asigna un puesto. Ver [[BACKEND-PENDIENTE.md]]:
  // el backend todavia no guarda userId por slot ni expone el endpoint de
  // guardado propio, asi que esto queda listo del lado frontend a la espera.
  const mySlotKey = useMemo(() => {
    if (!team?.rosterSlots) return ''
    const entry = Object.entries(team.rosterSlots).find(([, value]) => String(value?.userId || '') === currentUserId)
    return entry ? entry[0] : ''
  }, [team?.rosterSlots, currentUserId])
  // El editor del lider sirve para cualquier puesto; la verificacion de MLBB
  // solo aplica al suyo (o a uno vacio que esta por ocupar el mismo).
  const editingOwnSlot = Boolean(slotForm.slot) && (slotForm.slot === mySlotKey || String(form.rosterSlots?.[slotForm.slot]?.userId || '') === currentUserId)
  // La ficha es de una cuenta miembro: su nick (y su ID, si no es la propia) no se editan aqui.
  const editingMemberAccount = memberIdSet.has(String(form.rosterSlots?.[slotForm.slot]?.userId || ''))

  useEffect(() => {
    if (!team || isCurrentLeader) return
    const mine = mySlotKey ? team.rosterSlots?.[mySlotKey] : null
    setSlotForm(prev => ({
      ...prev,
      slot: mySlotKey || prev.slot || 'titular-1',
      nick: mine?.nick || user?.nick || '',
      role: mine?.role || '',
      gameId: mine?.gameId || '',
      email: mine?.email || user?.email || '',
      avatar: mine?.avatar || user?.avatar || '',
      bio: mine?.bio || '',
      rank: mine?.rank || '',
      availability: mine?.availability || '',
      mainCharacters: Array.isArray(mine?.mainCharacters) ? mine.mainCharacters.join(', ') : (mine?.mainCharacters || ''),
      discordId: mine?.discordId || user?.discord?.id || '',
      discordName: mine?.discordName || user?.discord?.username || '',
      socials: normalizeSocials(mine || user),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, mySlotKey, isCurrentLeader])

  const leadershipCandidates = useMemo(() => {
    const seen = new Set()
    return (Array.isArray(team?.members) ? team.members : [])
      .map(member => ({
        id: String(member?._id || member?.id || member || ''),
        nick: member?.nick || member?.name || member?.username || member?.playerCode || 'Miembro',
        playerCode: member?.playerCode || '',
      }))
      .filter(member => {
        if (!member.id || member.id === teamLeaderId || seen.has(member.id)) return false
        seen.add(member.id)
        return true
      })
  }, [team?.members, teamLeaderId])

  useEffect(() => {
    if (!leadershipCandidates.length) {
      setNewLeaderId('')
      return
    }
    setNewLeaderId(current => leadershipCandidates.some(member => member.id === current) ? current : leadershipCandidates[0].id)
  }, [leadershipCandidates])

  useEffect(() => {
    const rowsToLookup = slotRows
      .filter(row => row.player && rosterProfiles[row.slot] === undefined)
      .map(row => ({ slot: row.slot, keys: rosterLookupKeys(row.player) }))
      .filter(row => row.keys.length)

    if (!rowsToLookup.length) return
    let cancelled = false

    Promise.all(rowsToLookup.map(async row => {
      for (const key of row.keys) {
        try {
          const result = await api(`/profile/lookup/${encodeURIComponent(key)}`)
          if (result?.user) return [row.slot, result.user]
        } catch {}
      }
      return [row.slot, null]
    })).then(entries => {
      if (cancelled) return
      setRosterProfiles(prev => {
        const next = { ...prev }
        entries.forEach(([slot, profile]) => {
          next[slot] = profile || false
        })
        return next
      })
    })

    return () => { cancelled = true }
  }, [slotRows, rosterProfiles])

  const wins = Number(team?.wins || 0)
  const losses = Number(team?.losses || 0)
  const winrate = wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0
  const accent = teamColor(form?.color)
  const socialsCount = Object.values(form.socials || {}).filter(Boolean).length
  const profileScore = [form.name, form.game, form.description, form.banner, form.contactEmail, socialsCount > 0, filledRows.length > 0].filter(Boolean).length
  const profilePercent = Math.round((profileScore / 7) * 100)
  const myTeamKeys = useMemo(() => {
    if (!team) return []
    return [
      team._id,
      team.id,
      team.publicCode,
      team.teamIdCode,
      team.internalCode,
      team.name,
      team.tag,
    ].map(value => safeText(value, '').toLowerCase()).filter(Boolean)
  }, [team])
  const isMyTeamValue = value => {
    const normalized = safeText(value, '').toLowerCase()
    return Boolean(normalized && myTeamKeys.includes(normalized))
  }
  const isMyScrim = scrim => Boolean(scrim?.isMine || isMyTeamValue(scrim?.ownerTeamId || scrim?.teamId || scrim?._teamId) || isMyTeamValue(scrim?.team) || isMyTeamValue(scrim?.tag))
  const isMyVs = match => Boolean(isMyTeamValue(match?.teamAId) || isMyTeamValue(match?.teamBId) || isMyTeamValue(match?.teamA) || isMyTeamValue(match?.teamB) || isMyTeamValue(match?.tagA) || isMyTeamValue(match?.tagB))
  const myScrims = useMemo(() => teamScrimState.scrims.filter(isMyScrim), [teamScrimState.scrims, myTeamKeys.join('|')])
  const pendingScrims = myScrims.filter(scrim => scrim.status !== 'Confirmado' && scrim.status !== 'Finalizado')
  const acceptedScrims = myScrims.filter(scrim => scrim.status === 'Confirmado')
  const myActiveVs = useMemo(() => teamScrimState.recentVs.filter(isMyVs), [teamScrimState.recentVs, myTeamKeys.join('|')])
  const myScrimHistory = useMemo(() => teamScrimState.history.filter(isMyVs), [teamScrimState.history, myTeamKeys.join('|')])
  
  const backendRequests = Array.isArray(team?.joinRequests)
    ? team.joinRequests.map((request, index) => normalizeJoinRequest(request, team, index, 'backend'))
    : []
  const localRequests = localJoinRequests
    .filter(request => isMyTeamValue(request.teamId) || isMyTeamValue(request.teamName) || isMyTeamValue(request.teamTag))
    .map((request, index) => normalizeJoinRequest(request, team, index, 'local'))
  const joinRequests = [...backendRequests, ...localRequests].reduce((acc, request) => {
    if (!acc.some(item => String(item.id) === String(request.id))) acc.push(request)
    return acc
  }, [])
  const pendingJoinRequests = joinRequests.filter(request => request.status === 'pending')
  const teamIsProfessional = isProfessionalTeam(team)
  const teamCanChallenge = canSendChallenge(team)
  const competitive = team?.competitive || {}
  const competitiveDivision = competitive.divisionLabel || team?.level || 'Sin division'
  const competitivePoints = Number.isFinite(Number(competitive.points ?? team?.rankPts))
    ? Number(competitive.points ?? team?.rankPts).toLocaleString('es-DO')
    : '0'
  const competitiveRank = competitive.rankLabel || (competitive.rank ? `#${competitive.rank}` : 'N/A')
  const competitiveReason = competitive.eligibility?.reason || 'Completa actividad competitiva para desbloquear beneficios.'
  const teamIdValue = ticketTeamId(team?.id || team?._id)
  const mySentChallengerTickets = challengerTickets.filter(ticket =>
    ticketTeamId(ticket.challengerTeam) === teamIdValue ||
    ticketTeamId(ticket.challengerTeam?._id || ticket.challengerTeam?.id) === teamIdValue ||
    safeText(ticket.challengerTeam?.name).toLowerCase() === safeText(team?.name).toLowerCase()
  )
  const incomingChallengerTickets = challengerTickets.filter(ticket =>
    ticketTeamId(ticket.proTeam) === teamIdValue ||
    ticketTeamId(ticket.proTeam?._id || ticket.proTeam?.id) === teamIdValue ||
    safeText(ticket.proTeam?.name).toLowerCase() === safeText(team?.name).toLowerCase()
  )
  const availableProChallengerTeams = proChallengerTeams.filter(pro =>
    ticketTeamId(pro) !== teamIdValue &&
    isSameGame(pro.game, team?.game) &&
    pro?.competitive?.eligibility?.canBeChallenged !== false
  )
  const teamActivityItems = useMemo(() => {
    const manual = teamActivities.map(item => ({
      id: item.id,
      type: item.type || 'evento',
      title: item.title || 'Actividad',
      date: teamDateKey(item.date),
      time: item.time || '--:--',
      game: item.game || team?.game || 'General',
      color: item.color || accent,
      description: item.description || '',
      source: 'manual',
    })).filter(item => item.date)

    const scrimItems = myScrims.map((scrim, index) => ({
      id: `scrim-${scrim.id || scrim._id || index}`,
      type: 'scrim',
      title: scrim.title || scrim.objective || scrim.name || 'Scrim del equipo',
      date: teamDateKey(scrim.date || scrim.scheduledDate || scrim.createdAt || new Date()),
      time: scrim.time || scrim.startTime || scrim.hour || '--:--',
      game: scrim.game || team?.game || 'Scrim',
      color: '#FF4655',
      description: [scrim.status, scrim.format, scrim.region].filter(Boolean).join(' · '),
      source: 'scrim',
      link: '/equipos?tab=scrims',
    })).filter(item => item.date)

    const vsItems = [...myActiveVs, ...myScrimHistory].map((match, index) => ({
      id: `vs-${match.id || match._id || index}`,
      type: match.status === 'Finalizado' ? 'resultado' : 'vs',
      title: `${match.teamA || 'Equipo A'} vs ${match.teamB || 'Equipo B'}`,
      date: teamDateKey(match.date || match.scheduledDate || match.playedAt || match.createdAt || new Date()),
      time: match.time || match.hour || '--:--',
      game: match.game || team?.game || 'VS',
      color: match.status === 'Finalizado' ? '#7c3aed' : accent,
      description: [match.status, match.score, match.format].filter(Boolean).join(' · '),
      source: 'vs',
    })).filter(item => item.date)

    const ticketItems = [...mySentChallengerTickets, ...incomingChallengerTickets].map((ticket, index) => ({
      id: `ticket-${ticket.id || ticket._id || index}`,
      type: 'retador',
      title: ticket.challengerTeam?.name && ticket.proTeam?.name
        ? `${ticket.challengerTeam.name} vs ${ticket.proTeam.name}`
        : ticket.title || 'Ticket retador',
      date: teamDateKey(ticket.scheduledDate || ticket.createdAt || new Date()),
      time: ticket.scheduledTime || '--:--',
      game: ticket.game || team?.game || 'Modo Retador',
      color: '#F0A500',
      description: [ticket.status, ticket.format, ticket.message].filter(Boolean).join(' · '),
      source: 'retador',
    })).filter(item => item.date)

    return [...manual, ...scrimItems, ...vsItems, ...ticketItems]
      .map(item => ({
        ...item,
        period: item.date < todayKey ? 'past' : item.date > todayKey ? 'future' : 'today',
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }, [teamActivities, myScrims, myActiveVs, myScrimHistory, mySentChallengerTickets, incomingChallengerTickets, team?.game, accent, todayKey])
  const filteredTeamActivities = teamActivityItems.filter(item => {
    const text = `${item.title} ${item.game} ${item.description}`.toLowerCase()
    return (calendarPeriod === 'all' || item.period === calendarPeriod) &&
      (calendarType === 'all' || item.type === calendarType || item.source === calendarType) &&
      (!calendarQuery.trim() || text.includes(calendarQuery.trim().toLowerCase()))
  })
  const teamActivitiesByDate = teamActivityItems.reduce((acc, item) => {
    ;(acc[item.date] ||= []).push(item)
    return acc
  }, {})
  const selectedTeamActivities = selectedCalendarDate ? (teamActivitiesByDate[selectedCalendarDate] || []) : []
  const calendarStats = {
    past: teamActivityItems.filter(item => item.period === 'past').length,
    today: teamActivityItems.filter(item => item.period === 'today').length,
    future: teamActivityItems.filter(item => item.period === 'future').length,
    total: teamActivityItems.length,
  }
  const firstCalendarDay = new Date(calendarYear, calendarMonth, 1)
  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const calendarOffset = (firstCalendarDay.getDay() + 6) % 7
  const calendarCells = [...Array(calendarOffset).fill(null), ...Array.from({ length: calendarDaysInMonth }, (_, index) => index + 1)]
  const calendarKeyFor = day => `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const calendarTeamKey = team?.id || team?._id || team?.publicCode || team?.tag || 'local'

  function openActivityForm(date = selectedCalendarDate || todayKey) {
    setActivityForm(prev => ({ ...prev, date, game: prev.game || team?.game || '' }))
    setShowActivityForm(true)
  }

  function saveTeamActivity(event) {
    event.preventDefault()
    if (!activityForm.title.trim() || !activityForm.date) return
    const next = [
      {
        ...activityForm,
        id: `act-${Date.now()}`,
        title: activityForm.title.trim(),
        description: activityForm.description.trim(),
      },
      ...teamActivities,
    ]
    setTeamActivities(next)
    writeTeamActivities(calendarTeamKey, next)
    setShowActivityForm(false)
    setActivityForm({ title: '', type: 'evento', date: todayKey, time: '19:00', game: team?.game || '', color: TEAM_CALENDAR_COLORS[0], description: '' })
    toast('Actividad agregada al calendario del equipo.')
  }

  function deleteTeamActivity(id) {
    const next = teamActivities.filter(item => item.id !== id)
    setTeamActivities(next)
    writeTeamActivities(calendarTeamKey, next)
    toast('Actividad eliminada del calendario.')
  }

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const setSocial = (key, value) => setForm(prev => ({ ...prev, socials: { ...(prev.socials || {}), [key]: value } }))
  const sponsorListWithPatch = (baseSponsors, index, patch) => {
    const sponsors = Array.isArray(baseSponsors) ? [...baseSponsors] : []
    sponsors[index] = {
      ...(sponsors[index] || {}),
      ...patch,
      socials: {
        ...(sponsors[index]?.socials || {}),
        ...(patch.socials || {}),
      },
    }
    return sponsors
  }
  const updateSponsor = (index, patch) => {
    setForm(prev => {
      return { ...prev, sponsors: sponsorListWithPatch(prev.sponsors, index, patch) }
    })
  }

  const addSponsor = () => {
    setForm(prev => ({
      ...prev,
      sponsors: [
        ...(Array.isArray(prev.sponsors) ? prev.sponsors : []),
        { name: '', tier: 'Sponsor', website: '', logo: '', since: '', location: '', description: '', contact: '', socials: {} },
      ],
    }))
  }

  const removeSponsor = (index) => {
    setForm(prev => ({
      ...prev,
      sponsors: (Array.isArray(prev.sponsors) ? prev.sponsors : []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  async function handleSponsorLogoUpload(event, index) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    // Se guarda el logo previo para poder revertir la vista previa optimista
    // si la subida falla -- antes, si /uploads fallaba, el catch persistia
    // el data: URI base64 CRUDO como si fuera la URL del logo (savePatch lo
    // mandaba tal cual al backend). Ademas de inflar el documento del equipo,
    // ese base64 termina roto en pantalla mas tarde ("Data URL decoding
    // failed") -- nunca deberia guardarse como URL de imagen.
    const previousLogo = form.sponsors?.[index]?.logo || ''
    setSaving(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      updateSponsor(index, { logo: dataUrl })
      try {
        const res = await api('/uploads', {
          method: 'POST',
          body: { dataUrl, filename: file.name }
        })
        if (!res?.url) throw new Error('Sin URL')
        const uploadUrl = normalizeUploadUrl(res.url)
        const nextSponsors = sponsorListWithPatch(form.sponsors, index, { logo: uploadUrl })
        setField('sponsors', nextSponsors)
        await savePatch({ sponsors: nextSponsors }, 'Logo del patrocinador cargado')
      } catch (err) {
        updateSponsor(index, { logo: previousLogo })
        toast(err?.message || 'No se pudo subir el logo del patrocinador al servidor', 'error')
      } finally {
        input.value = ''
        setSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleLogoUpload(event) {
    const file = event.target.files[0]
    if (!file || !team) return
    const formData = new FormData()
    formData.append('logo', file)
    setSaving(true)
    const teamId = team?.id || team?._id
    try {
      const res = await api(teamId ? `/teams/${encodeURIComponent(teamId)}/logo` : '/teams/my/logo', {
        method: 'PATCH',
        body: formData
      })
      if (res && res.logo) {
        setField('logo', res.logo)
        setTeam(prev => ({ ...prev, logo: res.logo }))
        panelContext.setTeam?.(prev => prev ? { ...prev, logo: res.logo } : prev)
        toast('Logo corporativo actualizado con éxito')
      }
    } catch (err) {
      toast(err?.message || 'No se pudo subir el logo al servidor', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleMediaUpload(event, fieldKey) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setSaving(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      try {
        const res = await api('/uploads', {
          method: 'POST',
          body: { dataUrl, filename: file.name }
        })
        if (res && res.url) {
          const uploadUrl = normalizeUploadUrl(res.url)
          setField(fieldKey, uploadUrl)
          setTeam(prev => ({ ...prev, [fieldKey]: uploadUrl }))
          await savePatch({ [fieldKey]: uploadUrl }, fieldKey === 'logo' ? 'Imagen del equipo actualizada' : 'Portada del equipo actualizada')
        } else {
          throw new Error('Sin URL')
        }
      } catch (err) {
        toast(err?.message || 'No se pudo guardar la imagen en backend', 'error')
      } finally {
        input.value = ''
        setSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleToggleChallengerMode(activate) {
    if (!team) return
    setSaving(true)
    const endpoint = activate ? '/challenger/activate' : '/challenger/deactivate'
    try {
      const res = await api(endpoint, { method: 'POST' })
      const updated = normalizeTeam(res?.team || { ...team, challengerMode: res?.challengerMode })
      setTeam(updated)
      setForm(updated)
      writeLocalTeam(updated)
      toast(activate ? 'Modo Retador activado con éxito.' : 'Modo Retador desactivado.')
    } catch (err) {
      toast(err?.message || (activate ? 'No se pudo activar el Modo Retador.' : 'No se pudo desactivar el Modo Retador.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateChallengerTicket(event) {
    event.preventDefault()
    if (!selectedProTeam || !team) return
    setSaving(true)
    try {
      const body = {
        proTeamId: selectedProTeam._id || selectedProTeam.id,
        game: challengerForm.game || selectedProTeam.game || team.game,
        format: challengerForm.format || 'BO3',
        scheduledDate: challengerForm.scheduledDate,
        scheduledTime: challengerForm.scheduledTime,
        message: challengerForm.message
      }
      const res = await api('/challenger/tickets', { method: 'POST', body })
      if (res && res.ticket) setChallengerTickets(prev => [res.ticket, ...prev])
      toast('Reto enviado con éxito')
      setSelectedProTeam(null)
      setChallengerForm({ game: '', format: 'BO3', scheduledDate: '', scheduledTime: '', message: '' })
    } catch (err) {
      toast(err?.message || 'Error al proponer reto', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRespondChallengerTicket(ticketId, action) {
    setSaving(true)
    try {
      const res = await api(`/challenger/tickets/${ticketId}/respond`, {
        method: 'PATCH',
        body: { action }
      })
      if (res && res.ticket) setChallengerTickets(prev => prev.map(t => t.id === ticketId || t._id === ticketId ? res.ticket : t))
      toast(action === 'accept' ? 'Reto aceptado' : 'Reto rechazado')
    } catch (err) {
      toast(err?.message || 'No se pudo responder el reto.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReportChallengerResult(ticketId, winner, score, role) {
    setSaving(true)
    try {
      const res = await api(`/challenger/tickets/${ticketId}/result`, {
        method: 'PATCH',
        body: { winner, score, side: role }
      })
      if (res && res.ticket) {
        setChallengerTickets(prev => prev.map(t => t.id === ticketId || t._id === ticketId ? res.ticket : t))
        if (res.ticket.status === 'completed' && res.team) {
          const updated = normalizeTeam(res.team)
          setTeam(updated)
          setForm(updated)
          writeLocalTeam(updated)
        }
      }
      toast('Resultado reportado')
    } catch (err) {
      toast(err?.message || 'Error al reportar resultado', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function savePatch(patch, message = 'Cambios guardados') {
    if (!team) return
    setSaving(true)
    const teamId = team.id || team._id
    try {
      const updated = normalizeTeam(await api(teamId ? `/teams/${encodeURIComponent(teamId)}/manage` : '/teams/my', { method: 'PATCH', body: patch }))
      setTeam(updated)
      setForm(updated)
      panelContext.setTeam?.(updated)
      writeLocalTeam(updated)
      toast(message)
      return true
    } catch (err) {
      toast(err?.message || 'No se pudo guardar el equipo en backend', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleTransferLeadership() {
    if (!team || !newLeaderId || saving) return
    const candidate = leadershipCandidates.find(member => member.id === newLeaderId)
    const ok = await askTeamConfirm({
      icon: Icon.crown || Icon.shield,
      title: 'Delegar liderazgo',
      message: `Delegar liderazgo de ${team.name || 'este equipo'} a ${candidate?.nick || 'este miembro'}?`,
      detail: 'Esta persona quedara como lider del equipo y podra administrar roster, solicitudes y configuracion.',
      confirmLabel: 'Delegar',
    })
    if (!ok) return
    setSaving(true)
    try {
      const teamId = team.id || team._id
      const res = await api(`/teams/${encodeURIComponent(teamId)}/leader`, {
        method: 'PATCH',
        body: { newLeaderId },
      })
      const updated = normalizeTeam(res?.team || res)
      setTeam(updated)
      setForm(updated || DEFAULT_TEAM)
      setMyTeams(prev => prev.map(item => String(item._id || item.id) === String(teamId) ? updated : item).filter(Boolean))
      panelContext.setTeam?.(updated)
      toast(`Liderazgo delegado a ${candidate?.nick || 'el nuevo lider'}.`)
    } catch (err) {
      toast(err?.message || 'No se pudo delegar el liderazgo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Con check-in hecho, quien juega queda fijo: nadie entra, sale ni cambia
  // de cuenta. Editar datos cosmeticos (bio, avatar, redes) si se permite.
  function blockedByRosterLock() {
    if (!rosterLock.locked) return false
    toast(rosterLockMessage(rosterLock), 'error')
    return true
  }

  // ID del puesto ya normalizado para el juego del equipo, o null si su formato
  // es imposible (Riot ID sin #TAG, UID con letras...). Los formatos no
  // oficiales solo avisan en el campo, no bloquean.
  function slotGameIdOrNull() {
    const check = checkGameAccountId(team?.game, slotForm.gameId)
    if (!check.ok && check.strict) {
      toast(check.message, 'error')
      return null
    }
    return check.value
  }

  function changesSlotIdentity(previousSlot, nick, gameId) {
    if (!previousSlot || !previousSlot.nick) return true
    return String(previousSlot.nick || '').trim() !== nick || String(previousSlot.gameId || '').trim() !== gameId
  }

  async function handleLeaveTeam() {
    if (!team || saving) return
    if (blockedByRosterLock()) return
    const teamId = team.id || team._id
    const hasDelegateOptions = leadershipCandidates.length > 0
    const candidate = leadershipCandidates.find(member => member.id === newLeaderId)

    if (isCurrentLeader && hasDelegateOptions) {
      const ok = await askTeamConfirm({
        icon: Icon.logOut || Icon.user,
        title: 'Salir del equipo',
        message: `Antes de salir de "${team.name || 'este equipo'}", puedes dejar a ${candidate?.nick || 'otro miembro'} como lider.`,
        detail: 'Si aceptas, transferiremos el liderazgo y luego saldras del equipo. Si cancelas, no haremos ningun cambio.',
        confirmLabel: 'Aceptar y salir',
      })
      if (!ok) return
    } else {
      const ok = await askTeamConfirm({
        icon: Icon.alert || Icon.logOut,
        title: isCurrentLeader ? 'Eliminar equipo' : 'Salir del equipo',
        message: isCurrentLeader
          ? `Eres el unico miembro de "${team.name || 'este equipo'}". Si sales, el equipo se eliminara para siempre.`
          : `Deseas abandonar "${team.name || 'este equipo'}"?`,
        detail: isCurrentLeader
          ? 'Esta accion no se puede deshacer.'
          : 'Gracias por haber formado parte. Podras unirte o crear otro equipo cuando quieras.',
        confirmLabel: isCurrentLeader ? 'Eliminar y salir' : 'Salir',
      })
      if (!ok) return

      // Al ser una accion irreversible (borra el equipo para siempre), se
      // pide una segunda confirmacion explicita en vez de una sola.
      if (isCurrentLeader) {
        const reallyOk = await askTeamConfirm({
          icon: Icon.alert,
          title: 'Ultima confirmacion',
          message: `Se eliminara "${team.name || 'el equipo'}" para siempre, junto con su historial, roster y configuracion.`,
          detail: 'No hay forma de deshacer esto despues.',
          confirmLabel: 'Si, eliminar definitivamente',
        })
        if (!reallyOk) return
      }
    }

    setSaving(true)
    try {
      if (isCurrentLeader && hasDelegateOptions) {
        await api(`/teams/${encodeURIComponent(teamId)}/leader`, {
          method: 'PATCH',
          body: { newLeaderId },
        })
      }
      // teamId: sin él el backend sale del "primer" equipo, que puede no ser
      // este si la persona está en varios (y si es líder, lo borraría).
      await api('/teams/leave', { method: 'POST', body: { teamId } })
      await refreshUser()
      try {
        if (String(localStorage.getItem('gg-active-team-id') || '') === String(teamId)) {
          localStorage.removeItem('gg-active-team-id')
        }
      } catch {}
      setTeam(null)
      setForm(DEFAULT_TEAM)
      setMyTeams(prev => prev.filter(item => String(item._id || item.id) !== String(teamId)))
      panelContext.setTeam?.(null)
      toast(isCurrentLeader && hasDelegateOptions
        ? `Listo. ${candidate?.nick || 'El nuevo lider'} queda al mando. Gracias por tu etapa con el equipo.`
        : isCurrentLeader
          ? 'Equipo eliminado para siempre. Gracias por haberlo creado.'
          : 'Saliste del equipo. Gracias por haber formado parte.'
      )
      navigate('/equipos')
    } catch (err) {
      // El backend a veces responde con este mensaje en ingles cuando, del
      // lado del servidor, el equipo todavia tiene otro integrante que esta
      // pagina no esta mostrando (dato desincronizado) -- ver [[BACKEND-PENDIENTE.md]]
      // "Eliminar equipo bloqueado por un miembro fantasma". Mientras se
      // arregla de raiz, al menos no mostramos el texto crudo en ingles.
      const raw = err?.message || ''
      const message = /transfer leadership/i.test(raw)
        ? 'El servidor todavia registra otro integrante en este equipo, aunque no lo veas en tu lista. Actualiza la pagina e intenta de nuevo; si sigue pasando, contacta a soporte con el nombre del equipo.'
        : (raw || 'No se pudo salir del equipo.')
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function saveIdentity(event) {
    event.preventDefault()
    savePatch({
      name: form.name,
      tag: form.tag,
      game: form.game,
      region: form.region,
      level: form.level,
      category: form.category,
      lang: form.lang,
      slogan: form.slogan,
      color: teamColor(form.color),
      tiers: form.tiers,
    }, 'Identidad del equipo guardada')
  }

  function saveWeb(event) {
    event.preventDefault()
    savePatch({
      name: form.name,
      slogan: form.slogan,
      description: form.description,
      banner: form.banner,
      brand: form.brand,
      sponsor: form.sponsor,
      sponsors: form.sponsors,
      mainCharacters: form.mainCharacters,
      socials: form.socials,
      contactEmail: form.contactEmail,
    }, 'Pagina publica guardada')
  }

  // Antes esto guardaba el data: URI base64 CRUDO directo en slotForm.avatar
  // (sin pasar nunca por /uploads) -- saveRoster/saveMySlot lo persistian
  // tal cual en el roster del equipo. Ademas de inflar el documento, ese
  // base64 termina roto en pantalla despues ("Data URL decoding failed").
  // Ahora sube el archivo de verdad y guarda solo la URL real devuelta.
  async function handleRosterAvatarUpload(event) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setSaving(true)
    try {
      const res = await uploadFile(file)
      if (!res?.url) throw new Error('Sin URL')
      setSlotForm(prev => ({ ...prev, avatar: normalizeUploadUrl(res.url) }))
    } catch (err) {
      toast(err?.message || 'No se pudo subir la foto al servidor', 'error')
    } finally {
      input.value = ''
      setSaving(false)
    }
  }

  function saveRoster(event) {
    event.preventDefault()
    const moving = Boolean(slotForm.originSlot) && slotForm.originSlot !== slotForm.slot
    const previousSlot = form.rosterSlots?.[moving ? slotForm.originSlot : slotForm.slot] || {}
    const gameId = slotGameIdOrNull()
    if (gameId === null) return
    if ((moving || changesSlotIdentity(previousSlot, slotForm.nick.trim(), gameId)) && blockedByRosterLock()) return
    const nextSocials = Object.fromEntries(
      Object.entries(slotForm.socials || {}).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value)
    )
    const baseSlots = moving ? patchRosterSlot(form.rosterSlots, slotForm.originSlot, null) : form.rosterSlots
    const nextSlots = patchRosterSlot(baseSlots, slotForm.slot, {
      ...previousSlot,
      nick: slotForm.nick.trim(),
      role: slotForm.role.trim() || slotForm.slot,
      gameId,
      email: slotForm.email.trim(),
      avatar: slotForm.avatar || previousSlot.avatar || '',
      bio: slotForm.bio.trim(),
      rank: slotForm.rank.trim(),
      availability: slotForm.availability.trim(),
      mainCharacters: String(slotForm.mainCharacters || '').split(',').map(item => item.trim()).filter(Boolean),
      discordId: previousSlot.discordId || slotForm.discordId || '',
      discordName: previousSlot.discordName || slotForm.discordName || '',
      socials: nextSocials,
      social: nextSocials,
    })
    setField('rosterSlots', nextSlots)
    setSlotForm(prev => ({ ...prev, originSlot: '', nick: '', role: '', gameId: '', email: '', avatar: '', bio: '', rank: '', availability: '', mainCharacters: '', discordId: '', discordName: '', socials: {} }))
    savePatch({ rosterSlots: nextSlots }, moving ? 'Movido de puesto' : 'Roster actualizado')
  }

  // Guarda SOLO el slot del roster que le pertenece al miembro actual (no
  // lider) -- a diferencia de saveRoster/savePatch, que van al endpoint de
  // gestion del equipo (solo el lider puede llamarlo).
  async function saveMySlot(event) {
    event.preventDefault()
    if (!team || saving) return
    const teamId = team.id || team._id
    const targetSlot = mySlotKey || slotForm.slot
    const currentSlot = mySlotKey ? team.rosterSlots?.[mySlotKey] : null
    const gameId = slotGameIdOrNull()
    if (gameId === null) return
    if ((!mySlotKey || String(currentSlot?.gameId || '').trim() !== gameId) && blockedByRosterLock()) return
    const nextSocials = Object.fromEntries(
      Object.entries(slotForm.socials || {}).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value)
    )
    setSaving(true)
    try {
      const updated = normalizeTeam(await api(`/teams/${encodeURIComponent(teamId)}/roster/mine`, {
        method: 'PATCH',
        body: {
          slot: targetSlot,
          nick: slotForm.nick.trim(),
          role: slotForm.role.trim() || targetSlot,
          gameId,
          email: slotForm.email.trim(),
          avatar: slotForm.avatar || '',
          bio: slotForm.bio.trim(),
          rank: slotForm.rank.trim(),
          availability: slotForm.availability.trim(),
          mainCharacters: String(slotForm.mainCharacters || '').split(',').map(item => item.trim()).filter(Boolean),
          socials: nextSocials,
        },
      }))
      setTeam(updated)
      setForm(updated)
      panelContext.setTeam?.(updated)
      toast(mySlotKey ? 'Tu perfil en el equipo quedo guardado' : 'Te uniste a ese puesto del roster')
    } catch (err) {
      toast(err?.message || 'No se pudo guardar tu perfil todavia.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Puesto con la cuenta de un miembro: "Quitar" lo saca del equipo de verdad
  // (DELETE /members). Antes solo vaciaba el puesto y la persona seguia en el
  // equipo, con acceso y ocupando cupo. Un puesto escrito a mano (sin cuenta)
  // se sigue quitando del plantel como siempre.
  function removeSlot(slot) {
    if (blockedByRosterLock()) return
    const memberId = String(form.rosterSlots?.[slot]?.userId || '')
    if (memberId && memberIdSet.has(memberId) && memberId !== teamLeaderId) {
      removeMember(slot, memberId)
      return
    }
    const nextSlots = patchRosterSlot(form.rosterSlots, slot, null)
    setField('rosterSlots', nextSlots)
    savePatch({ rosterSlots: nextSlots }, 'Jugador removido del roster')
  }

  function applyServerTeam(raw) {
    const updated = normalizeTeam(raw)
    if (!updated) return
    setTeam(updated)
    setForm(updated)
    panelContext.setTeam?.(updated)
    writeLocalTeam(updated)
  }

  async function removeMember(slot, memberId) {
    const person = form.rosterSlots?.[slot] || {}
    const roleName = teamRoleLabel(staffRoleOfSlot(slot) || 'player').toLowerCase()
    const ok = await askTeamConfirm({
      icon: Icon.alert || Icon.trash,
      title: 'Sacar del equipo',
      message: `¿Sacar a ${person.nick || 'este miembro'} (${roleName}) de ${team?.name || 'el equipo'}?`,
      detail: 'Sale del equipo y del plantel, pierde el acceso y le llega un aviso. Para volver necesita otra invitación.',
      confirmLabel: 'Sacar del equipo',
    })
    if (!ok) return
    setSaving(true)
    try {
      const teamId = team.id || team._id
      const res = await api(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE', body: {} })
      applyServerTeam(res?.team)
      toast(`${person.nick || 'El miembro'} ya no está en el equipo`, 'success')
    } catch (err) {
      toast(err?.message || 'No se pudo sacar del equipo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Posicion en el juego del puesto (Duelista, Iniciador...). No cambia el
  // rol en el equipo (jugador/staff) ni el puesto, ni toca el roster congelado.
  async function changeSlotPosition(slot, position) {
    const current = form.rosterSlots?.[slot]
    if (!current || !position || current.role === position || saving) return
    if (isCurrentLeader) {
      await savePatch({ rosterSlots: { ...(form.rosterSlots || {}), [slot]: { ...current, role: position } } }, `Posición: ${position}`)
      return
    }
    setSaving(true)
    try {
      const teamId = team.id || team._id
      applyServerTeam(await api(`/teams/${encodeURIComponent(teamId)}/roster/mine`, { method: 'PATCH', body: { role: position } }))
      toast(`Posición: ${position}`)
    } catch (err) {
      toast(err?.message || 'No se pudo cambiar la posición.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Mueve a un miembro a otro puesto del MISMO rol (titular <-> suplente,
  // coach <-> coach asistente). Entre jugador y staff va changeMemberRole.
  async function moveMemberToSlot(memberId, targetSlot) {
    if (blockedByRosterLock()) return
    const slots = { ...(form.rosterSlots || {}) }
    const currentKey = Object.keys(slots).find(key => String(slots[key]?.userId || '') === String(memberId))
    const member = (team?.members || []).find(m => String(m?._id || m?.id || '') === String(memberId)) || {}
    const data = currentKey ? slots[currentKey] : { userId: String(memberId), nick: member.nick || '', avatar: member.avatar || '' }
    if (currentKey) delete slots[currentKey]
    slots[targetSlot] = { ...data, role: currentKey && staffRoleOfSlot(currentKey) === staffRoleOfSlot(targetSlot) && data.role ? data.role : rosterSlotPositionLabel(targetSlot, team?.game) }
    const ok = await savePatch({ rosterSlots: slots }, `${data.nick || 'Miembro'} ahora está en ${rosterSlotPositionLabel(targetSlot, team?.game)}`)
    if (ok) setAssignSlot('')
  }

  async function changeMemberRole(slot, memberId, nextRole) {
    const current = staffRoleOfSlot(slot) || 'player'
    if (!nextRole || nextRole === current || saving) return
    if (blockedByRosterLock()) return
    setSaving(true)
    try {
      const teamId = team.id || team._id
      const res = await api(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/role`, { method: 'PATCH', body: { role: nextRole } })
      applyServerTeam(res?.team)
      setActiveRosterSlot(null)
      toast(`Ahora es ${teamRoleLabel(nextRole).toLowerCase()}`, 'success')
    } catch (err) {
      // Motivo real del servidor: cupo de jugadores/staff, reglas del equipo...
      toast(err?.message || 'No se pudo cambiar el rol.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function respondJoinRequest(request, nextStatus) {
    const accept = nextStatus === 'accepted'
    const status = accept ? 'accepted' : 'rejected'
    if (accept && blockedByRosterLock()) return

    if (request.source === 'backend' && team?.id && request.id && !request.id.startsWith('request-')) {
      try {
        await api(`/teams/${team.id}/requests/${request.id}`, {
          method: 'PATCH',
          body: { accept },
        })
      } catch (err) {
        // El backend puede rechazar esto por una razon real (equipo lleno,
        // jugador ya en otro equipo, etc.) -- si seguimos de largo y
        // actualizamos el roster solo local, se desincroniza y el cambio
        // desaparece al recargar. Mostrar el motivo real y frenar aca.
        toast(err.message || 'No se pudo sincronizar con el servidor.')
        return
      }
    }

    if (request.source === 'local') {
      const nextLocal = updateLocalTeamJoinRequest(request.id, { status })
      setLocalJoinRequests(nextLocal)
    }

    setTeam(prev => {
      if (!prev?.joinRequests) return prev
      return {
        ...prev,
        joinRequests: prev.joinRequests.map(item => {
          const itemId = String(item?._id || item?.id || '')
          return itemId === String(request.id) ? { ...item, status } : item
        }),
      }
    })

    if (accept) {
      const firstEmpty = rosterSlotRows(form.rosterSlots).find(row => !row.player)?.slot || `sub-${filledRows.length + 1}`
      const nextSlots = patchRosterSlot(form.rosterSlots, firstEmpty, {
        nick: request.nick,
        role: request.role,
        gameId: request.gameId,
        email: '',
        status: 'Aceptado',
      })
      setField('rosterSlots', nextSlots)
      savePatch({ rosterSlots: nextSlots }, 'Solicitud aceptada y roster actualizado')
    } else {
      toast('Solicitud rechazada')
    }
  }

  function handleCompleteTeamVs(match) {
    const completed = {
      id: Date.now(),
      sourceScrimId: match.sourceScrimId,
      date: match.date || 'Hoy',
      time: match.time || 'TBD',
      game: match.game || team.game || 'Scrim',
      teamA: match.teamA,
      tagA: match.tagA,
      teamB: match.teamB,
      tagB: match.tagB,
      score: '2-1',
      winner: match.teamA,
      note: `${match.stage || 'VS'} cerrado desde Mi equipo`,
      status: 'Finalizado',
      accent: match.accent || accent,
    }
    const nextRecent = teamScrimState.recentVs.filter(item => String(item.id) !== String(match.id))
    const nextHistory = [completed, ...teamScrimState.history]
    writeLocal(TEAM_SCRIM_KEYS.recentVs, nextRecent)
    writeLocal(TEAM_SCRIM_KEYS.history, nextHistory)
    if (match.sourceScrimId) {
      const nextScrims = teamScrimState.scrims.map(scrim => String(scrim.id) === String(match.sourceScrimId)
        ? { ...scrim, status: 'Finalizado', finishedAt: new Date().toISOString() }
        : scrim
      )
      writeLocal(TEAM_SCRIM_KEYS.scrims, nextScrims)
      setTeamScrimState({ scrims: nextScrims, recentVs: nextRecent, history: nextHistory })
    } else {
      setTeamScrimState(prev => ({ ...prev, recentVs: nextRecent, history: nextHistory }))
    }
    toast('VS movido al historico de tu equipo')
  }

  if (loading) {
    return (
      <div className="pnl-empty">
        <GGLoader label="Sincronizando panel de equipo" sub="Estamos buscando tu equipo activo." size="sm" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="pnl-empty">
        <div className="pnl-empty__icon">{Icon.team}</div>
        <h3>No tienes equipo activo</h3>
        <p>{error || 'Crea o asigna tu equipo para activar este panel.'}</p>
        <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/equipos')}>
          {Icon.plus} Crear o buscar equipo
        </button>
      </div>
    )
  }

  // Un miembro (no lider) no ve el panel completo del lider -- ni la config
  // del equipo, ni el roster ajeno, ni invitaciones/privacidad. Solo puede
  // ver la identidad basica del equipo y editar su propio puesto en el
  // roster (identificado por mySlotKey, ver arriba).
  if (!isCurrentLeader) {
    const vacantSlots = rosterSlotRows(team.rosterSlots).filter(row => !row.player)
    return (
      <div className="mtp-page" style={{ '--mtp-accent': accent }}>
        <motion.section className="pnl-hero mtp-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mtp-hero__media" />
          <div className="mtp-hero__mark" style={{ position: 'relative', overflow: 'hidden' }}>
            {team.logo ? <img src={imageUrl(team.logo)} alt={team.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(team.tag || team.name)}
          </div>
          <div className="pnl-hero__info">
            <div className="pnl-hero__nameline">
              <h1 data-no-translate>{team.name || 'Mi equipo'}</h1>
              <span className="pnl-tag pnl-tag--accent" style={{ background: accent, color: '#000' }} data-no-translate>{team.publicCode || team.tag || 'TEAM'}</span>
              <span className="pnl-tag">{team.game || 'Juego sin definir'}</span>
            </div>
            <p className="pnl-hero__sub">Sos miembro de este equipo. Podes ver su info y editar tu propio perfil en el roster.</p>
            <div className="mtp-hero__meta">
              <span>{Icon.shield} {team.region || 'Region sin definir'}</span>
            </div>
          </div>
          <div className="pnl-hero__cta">
            <button className="pnl-btn pnl-btn--primary" onClick={() => navigate(`/equipos/${team.id || team._id}`)}>{Icon.eye} Ver pagina publica</button>
            <button className="pnl-btn pnl-btn--danger" type="button" disabled={saving} onClick={handleLeaveTeam}>
              {Icon.x} Salir del equipo
            </button>
          </div>
        </motion.section>

        {rosterLock.locked && <div className="mtp-roster-lock" role="status">{Icon.lock} {rosterLockMessage(rosterLock)}</div>}

        <form className="mtp-form mtp-roster-form" onSubmit={saveMySlot}>
          <h3 className="mtp-section-heading mtp-roster-heading">
            <span className="mtp-title-icon">{Icon.plus}</span>
            {mySlotKey ? `Tu perfil -- ${rosterSlotPositionLabel(mySlotKey, team?.game)}` : 'Elegi tu puesto en el roster'}
          </h3>

          {!mySlotKey && (
            <label className="mtp-field">
              <span className="mtp-field__label">Puesto</span>
              <div className="mtp-control">
                <select value={slotForm.slot} onChange={e => setSlotForm(prev => ({ ...prev, slot: e.target.value }))}>
                  {vacantSlots.length === 0 && <option value={slotForm.slot}>{slotForm.slot.toUpperCase()}</option>}
                  {vacantSlots.map(row => (
                    <option key={row.slot} value={row.slot}>{rosterSlotPositionLabel(row.slot, team?.game)}</option>
                  ))}
                </select>
              </div>
            </label>
          )}

          <Field label="Nickname del Jugador" value={slotForm.nick} onChange={value => setSlotForm(prev => ({ ...prev, nick: value }))} required />
          {rosterSlotRoleOptions(slotForm.slot, team?.game).length > 0 ? (
            <Field label="Rol / Linea competitiva" value={slotForm.role} onChange={value => setSlotForm(prev => ({ ...prev, role: value }))} options={rosterSlotRoleOptions(slotForm.slot, team?.game)} />
          ) : (
            <Field label="Rol / Linea competitiva (ej. Midlaner, IGL)" value={slotForm.role} onChange={value => setSlotForm(prev => ({ ...prev, role: value }))} />
          )}
          <Field label={gameIdHint(team?.game).label} value={slotForm.gameId} onChange={value => setSlotForm(prev => ({ ...prev, gameId: value }))} placeholder={gameIdHint(team?.game).placeholder} hint={gameIdHint(team?.game, slotForm.gameId).hint} />
          {isMobileLegends(team?.game) && <GameIdVerify value={slotForm.gameId} onUse={fillVerifiedAccount} />}
          <Field label="Correo electronico (opcional)" type="email" value={slotForm.email} onChange={value => setSlotForm(prev => ({ ...prev, email: value }))} />
          <Field label="Biografia del jugador" textarea value={slotForm.bio} onChange={value => setSlotForm(prev => ({ ...prev, bio: value }))} />
          <Field label="Personajes favoritos" value={slotForm.mainCharacters} onChange={value => setSlotForm(prev => ({ ...prev, mainCharacters: value }))} />
          <Field label="Rango / nivel" value={slotForm.rank} onChange={value => setSlotForm(prev => ({ ...prev, rank: value }))} />
          <Field label="Disponibilidad" value={slotForm.availability} onChange={value => setSlotForm(prev => ({ ...prev, availability: value }))} />

          <div className="mtp-roster-social-editor">
            <b>Redes del miembro</b>
            <div>
              {SOCIAL_FIELDS.map(([key, label]) => {
                const verifiedDiscord = key === 'discord' && Boolean(slotForm.discordId || slotForm.discordName)
                return (
                  <Field
                    key={key}
                    label={label}
                    value={key === 'discord' ? (slotForm.discordName || slotForm.socials?.discord || '') : (slotForm.socials?.[key] || '')}
                    onChange={value => setSlotForm(prev => ({ ...prev, socials: { ...(prev.socials || {}), [key]: value } }))}
                    disabled={verifiedDiscord}
                    hint={verifiedDiscord ? 'Discord vinculado desde la cuenta. Para cambiarlo, ve a Ajustes > Conexiones.' : ''}
                  />
                )
              })}
            </div>
          </div>

          <button className="pnl-btn pnl-btn--primary mtp-roster-save" disabled={saving}>
            {Icon.check} {mySlotKey ? 'Guardar mi perfil' : 'Unirme a este puesto'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div
      className="mtp-page"
      style={{
        '--mtp-accent': accent,
        '--mtp-banner': form.banner ? `url("${form.banner}")` : 'none',
      }}
    >
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            className="mtp-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => closeTeamConfirm(false)}
          >
            <motion.div
              className={`mtp-confirm__panel mtp-confirm__panel--${confirmDialog.tone || 'warn'}`}
              initial={{ opacity: 0, y: 18, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: .96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mtp-confirm-title"
            >
              <div className="mtp-confirm__head">
                <span className="mtp-confirm__icon">{confirmDialog.icon || Icon.alert}</span>
                <div>
                  <small>GlitchGang</small>
                  <h3 id="mtp-confirm-title">{confirmDialog.title}</h3>
                </div>
              </div>
              <p className="mtp-confirm__message">{confirmDialog.message}</p>
              {confirmDialog.detail && <p className="mtp-confirm__detail">{confirmDialog.detail}</p>}
              <div className="mtp-confirm__actions">
                <button type="button" className="pnl-btn" onClick={() => closeTeamConfirm(false)}>
                  {confirmDialog.cancelLabel || 'Cancelar'}
                </button>
                <button type="button" className="pnl-btn pnl-btn--primary" onClick={() => closeTeamConfirm(true)}>
                  {confirmDialog.confirmLabel || 'Aceptar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {myTeams.length > 1 && (
        <div className="mtp-team-switcher">
          <span>Gestionando:</span>
          <select
            value={team?.id || ''}
            onChange={e => switchTeam(e.target.value)}
          >
            {myTeams.map(t => (
              <option key={t._id || t.id} value={t._id || t.id}>
                {t.name} ({t.game})
              </option>
            ))}
          </select>
        </div>
      )}
      {rosterLock.locked && <div className="mtp-roster-lock" role="status">{Icon.lock} {rosterLockMessage(rosterLock)}</div>}
      {section === 'resumen' && (
        <>
          <motion.section className="pnl-hero mtp-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mtp-hero__media" />
            <div className="mtp-hero__mark" style={{ position: 'relative', overflow: 'hidden' }}>
              {team.logo ? <img src={imageUrl(team.logo)} alt={team.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(team.tag || team.name)}
            </div>
            <div className="pnl-hero__info">
              <div className="pnl-hero__nameline">
                <h1 data-no-translate>{team.name || 'Mi equipo'}</h1>
                <span className="pnl-tag pnl-tag--accent" style={{ background: accent, color: '#000' }} data-no-translate>{team.publicCode || team.tag || 'TEAM'}</span>
                <span className="pnl-tag">{team.game || 'Juego sin definir'}</span>
              </div>
              <p className="pnl-hero__sub" data-no-translate>{team.slogan || team.description || 'Gestiona roster, identidad publica, redes y privacidad del equipo desde este panel.'}</p>
              <div className="mtp-hero__meta">
                <span>{Icon.shield} {team.region || 'Region sin definir'}</span>
                <span>{Icon.lock} {form.hideGameId ? 'Game ID oculto' : 'Game ID visible'}</span>
                <span>{Icon.mail} {form.hideEmails !== false ? 'Correos privados' : 'Correos visibles'}</span>
              </div>
            </div>
            <div className="pnl-hero__cta">
              <button className="pnl-btn pnl-btn--primary" onClick={() => navigate(`/equipos/${team.id || team._id}`)}>{Icon.eye} Ver publica</button>
              <button className="pnl-btn" onClick={() => navigate('/mi-equipo/roster')}>{Icon.users} Ver roster</button>
              <button className="pnl-btn" onClick={() => navigate('/mi-equipo/solicitudes')}>{Icon.mail} Solicitudes</button>
              <button className="pnl-btn pnl-btn--danger" type="button" disabled={saving} onClick={handleLeaveTeam}>
                {Icon.x} {isCurrentLeader && leadershipCandidates.length === 0 ? 'Disolver equipo' : 'Salir del equipo'}
              </button>
            </div>
          </motion.section>

          <section className="pnl-kpis">
            <Kpi icon={Icon.trophy} value={wins} label="Victorias" delta={`${losses} derrotas`} />
            <Kpi icon={Icon.trend} value={`${winrate}%`} label="Win rate" delta="Competencia activa" />
            <Kpi icon={Icon.users} value={filledRows.length} label="Roster publicado" delta={`${team.maxMembers || 5} cupos objetivo`} />
            <Kpi icon={Icon.globe} value={`${profilePercent}%`} label="Perfil completo" delta={`${socialsCount} redes conectadas`} />
          </section>

          <section className="mtp-scrim-command">
            <Panel title="Retos Scrim / VS de mi equipo" icon={Icon.target}>
              <div className="mtp-scrim-command__head">
                <div>
                  <h3>Control competitivo del equipo</h3>
                  <p>Revisa los retos que publicaste, quien los acepto y los VS que tu equipo tiene activos.</p>
                </div>
                {!isBetaHidden('section:teams-scrims') && <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/equipos?tab=scrims')}>
                  {Icon.eye} Ver Scrims / VS
                </button>}
              </div>

              <div className="mtp-scrim-status-grid">
                <span><b>{pendingScrims.length}</b> Esperando rival</span>
                <span><b>{acceptedScrims.length}</b> Retos aceptados</span>
                <span><b>{myActiveVs.length}</b> VS activos</span>
              </div>

              {(pendingScrims.length || acceptedScrims.length || myActiveVs.length) ? (
                <div className="mtp-scrim-board">
                  {[...acceptedScrims, ...pendingScrims].slice(0, 4).map(scrim => (
                    <article className={`mtp-scrim-card ${scrim.status === 'Confirmado' ? 'is-confirmed' : 'is-pending'}`} key={`scrim-${scrim.id}`}>
                      <div className="mtp-scrim-card__top">
                        <span className="mtp-scrim-logo">{initials(scrim.team)}</span>
                        <div>
                          <strong>{scrim.title || 'Reto de scrim'}</strong>
                          <small>{scrim.game || team.game} - {scrim.format || 'BO3'} - {scrim.timeWindow || scrim.time || 'Hora por confirmar'}</small>
                        </div>
                        <b>{scrim.status === 'Confirmado' ? 'Aceptado' : 'Pendiente'}</b>
                      </div>
                      <div className="mtp-scrim-card__meta">
                        <span><b>Publicado por</b>{scrim.team || team.name}</span>
                        <span><b>Rival objetivo</b>{scrim.targetTeam || 'Abierto'}</span>
                        <span><b>Respuesta</b>{scrim.acceptedBy ? `Aceptado por ${scrim.acceptedBy}` : 'Esperando quien lo acepte'}</span>
                        <span><b>Sala</b>{scrim.roomStatus === 'Creada' ? 'Creada' : 'Al confirmar'}</span>
                      </div>
                    </article>
                  ))}

                  {myActiveVs.slice(0, 4).map(match => (
                    <article className="mtp-scrim-card is-active" key={`vs-${match.id}`}>
                      <div className="mtp-scrim-card__top">
                        <span className="mtp-scrim-logo">{initials(match.tagA || match.teamA)}</span>
                        <div>
                          <strong>{match.teamA} vs {match.teamB}</strong>
                          <small>{match.game} - {match.stage || 'Scrim'} - {match.time || 'TBD'}</small>
                        </div>
                        <b>Activo</b>
                      </div>
                      <div className="mtp-scrim-card__meta">
                        <span><b>Confirmado por</b>{match.acceptedBy || match.teamA}</span>
                        <span><b>Sala</b>{match.roomStatus || 'Creada'}</span>
                        <span><b>Estado</b>{match.status || 'Confirmado'}</span>
                        <span><b>Rival</b>{isMyTeamValue(match.teamA) ? match.teamB : match.teamA}</span>
                      </div>
                      <div className="mtp-scrim-card__actions">
                        {!isBetaHidden('section:teams-scrims') && <button className="pnl-btn pnl-btn--small" onClick={() => navigate('/equipos?tab=scrims')}>{Icon.eye} Ver en scrims</button>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mtp-scrim-empty">
                  <b>No hay retos conectados a este equipo todavia.</b>
                  <span>Crea un desafio o acepta uno desde Scrims para que aparezca aqui con su estado.</span>
                </div>
              )}

              {myScrimHistory.length > 0 && (
                <div className="mtp-scrim-history-strip">
                  {myScrimHistory.slice(0, 3).map(match => (
                    <span key={`hist-${match.id}`}>
                      <b>{match.teamA} vs {match.teamB}</b>
                      {match.score || match.status || 'Finalizado'}
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          </section>

          <section className="mtp-summary-dashboard">
            <Panel title="Resumen competitivo" icon={Icon.shield}>
              <div className="mtp-summary-team">
                <div className="mtp-summary-team__mark">
                  {team.logo ? <img src={imageUrl(team.logo)} alt={team.name} /> : initials(team.tag || team.name)}
                </div>
                <div className="mtp-summary-team__body">
                  <span className="mtp-summary-eyebrow" data-no-translate>{team.tag || team.publicCode || 'TEAM'}</span>
                  <h2 data-no-translate>{team.name || 'Mi equipo'}</h2>
                  <p data-no-translate>{team.slogan || team.description || 'Equipo competitivo listo para configurar su presencia publica.'}</p>
                  <div className="mtp-summary-chips">
                    <span>{Icon.gamepad} {team.game || 'Juego sin definir'}</span>
                    <span>{Icon.globe} {team.region || 'Region sin definir'}</span>
                    <span>{Icon.trophy} {team.level || 'Amateur'}</span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Perfil publico" icon={Icon.globe}>
              <div className="mtp-summary-progress">
                <div className="mtp-summary-progress__value">
                  <strong>{profilePercent}%</strong>
                  <span>completo</span>
                </div>
                <div className="mtp-summary-progress__bar">
                  <i style={{ width: `${profilePercent}%` }} />
                </div>
              </div>
              <div className="mtp-summary-metrics">
                <span><b>{socialsCount}</b> redes</span>
                <span><b>{team.brand ? 'Si' : 'No'}</b> marca</span>
                <span><b>{team.contactEmail ? 'Si' : 'No'}</b> contacto</span>
              </div>
              <button className="pnl-btn" onClick={() => navigate(`/equipos/${team.id || team._id}`)}>
                {Icon.eye} Ver pagina publica
              </button>
            </Panel>

            <Panel title="Roster" icon={Icon.users}>
              <div className="mtp-summary-roster-head">
                <strong>{filledRows.length}/{team.maxMembers || 5}</strong>
                <span>jugadores publicados</span>
              </div>
              <div className="mtp-summary-roster-list">
                {slotRows.slice(0, 6).map(({ slot, player }) => (
                  <span className={player ? 'is-filled' : 'is-empty'} key={slot}>
                    <b>{slot.replace('-', ' ')}</b>
                    {player?.nick || 'Vacante'}
                  </span>
                ))}
              </div>
              <button className="pnl-btn" onClick={() => navigate('/mi-equipo/roster')}>
                {Icon.users} Ver roster
              </button>
            </Panel>

            <Panel title="Actividad" icon={Icon.mail}>
              <div className="mtp-summary-activity">
                <span><b>{pendingScrims.length}</b> scrims esperando rival</span>
                <span><b>{acceptedScrims.length}</b> retos aceptados</span>
                <span><b>{pendingJoinRequests.length}</b> solicitudes pendientes</span>
                <span><b>{form.acceptRequests !== false ? 'Abierto' : 'Cerrado'}</b> reclutamiento</span>
              </div>
              <button className="pnl-btn" onClick={() => navigate('/mi-equipo/solicitudes')}>
                {Icon.mail} Ver solicitudes
              </button>
            </Panel>

            {isCurrentLeader && (
              <>
            {/* Formulario 1: Editar Identidad del Equipo */}
            <Panel title="Editar Identidad de Equipo" icon={Icon.shield}>
              <form className="mtp-form mtp-form--grid" onSubmit={saveIdentity}>
                <Field label="Nombre del Equipo" value={form.name} onChange={value => setField('name', value)} icon={Icon.users} />
                <Field label="Tag (siglas - máx. 4)" value={form.tag} onChange={value => setField('tag', value.toUpperCase())} icon={Icon.award} />
                <Field label="Juego Principal" value={form.game} onChange={value => setField('game', value)} icon={Icon.gamepad} />
                <label className="mtp-field">
                  <span>Región / Servidor</span>
                  <div className="mtp-input-wrapper">
                    <select
                      style={{ width: '100%', height: '42px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(6,8,13,0.4)', color: '#fff', padding: '0 12px', outline: 'none' }}
                      value={form.region || ''}
                      onChange={e => setField('region', e.target.value)}
                    >
                      <option value="" disabled>Selecciona una región</option>
                      {form.region && !TEAM_REGION_OPTS.some(opt => opt.value === form.region) && (
                        <option value={form.region}>{form.region}</option>
                      )}
                      {TEAM_REGION_OPTS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="mtp-field">
                  <span>Nivel Competitivo</span>
                  <div className="mtp-input-wrapper">
                    <select
                      style={{ width: '100%', height: '42px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(6,8,13,0.4)', color: '#fff', padding: '0 12px', outline: 'none' }}
                      value={form.level || 'Amateur'}
                      onChange={e => setField('level', e.target.value)}
                    >
                      <option value="Amateur">Amateur</option>
                      <option value="Semi-profesional">Semi-profesional</option>
                      <option value="Profesional">Profesional</option>
                    </select>
                  </div>
                </label>
                <label className="mtp-field">
                  <span>Idioma principal</span>
                  <div className="mtp-input-wrapper">
                    <select
                      style={{ width: '100%', height: '42px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(6,8,13,0.4)', color: '#fff', padding: '0 12px', outline: 'none' }}
                      value={form.lang || ''}
                      onChange={e => setField('lang', e.target.value)}
                    >
                      <option value="" disabled>Selecciona un idioma</option>
                      {form.lang && !TEAM_LANG_OPTS.includes(form.lang) && (
                        <option value={form.lang}>{form.lang}</option>
                      )}
                      {TEAM_LANG_OPTS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </label>
                <Field label="Slogan competitivo" value={form.slogan} onChange={value => setField('slogan', value)} icon={Icon.chat} />

                <div className="mtp-field mtp-tier-field">
                  <span>Etiquetas del equipo</span>
                  <div className="mtp-tier-picks">
                    {TEAM_TIER_OPTS.map(tier => {
                      const active = (form.tiers || []).includes(tier.id)
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          className={`mtp-tier-pick${active ? ' is-active' : ''}`}
                          style={{ '--tier': tier.color }}
                          aria-pressed={active}
                          onClick={() => setField('tiers', toggleTier(form.tiers, tier.id))}
                        >
                          {active ? Icon.check : null} {tier.label}
                        </button>
                      )
                    })}
                  </div>
                  <small>El color de la etiqueta en la tarjeta cambia al guardar. "Universitario" pide tu universidad verificada.</small>
                </div>

                <label className="mtp-field">
                  <span>Color de Acento (Hex)</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                    <input 
                      type="color" 
                      style={{ width: '42px', height: '42px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                      value={parseHexColor(form.color) || TEAM_DEFAULT_COLOR}
                      onChange={e => setField('color', e.target.value)}
                    />
                    <input 
                      type="text" 
                      style={{ flex: 1, height: '42px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(6,8,13,0.4)', color: '#fff', padding: '0 12px' }}
                      value={form.color || TEAM_DEFAULT_COLOR}
                      onChange={e => setField('color', e.target.value)}
                      onBlur={() => setField('color', parseHexColor(form.color) || TEAM_DEFAULT_COLOR)}
                    />
                    <button
                      type="button"
                      className="pnl-btn"
                      style={{ height: '42px', whiteSpace: 'nowrap' }}
                      onClick={() => setField('color', TEAM_DEFAULT_COLOR)}
                    >
                      Verde GG
                    </button>
                  </div>
                  {(!parseHexColor(form.color) || isTeamColorTooDark(form.color)) && (
                    <small style={{ color: '#f97316', fontSize: '12px', marginTop: '6px' }}>
                      {parseHexColor(form.color)
                        ? 'Ese color es demasiado oscuro para el panel: se usara el verde GG.'
                        : 'Escribe un color hex (ej. #00E676). Mientras tanto se usa el verde GG.'}
                    </small>
                  )}
                </label>
                <button className="pnl-btn pnl-btn--primary" style={{ gridColumn: '1 / -1', marginTop: '8px' }} disabled={saving}>
                  {Icon.check} Guardar Identidad
                </button>
              </form>
            </Panel>

            {/* Formulario 2: Biografia e Historia */}
            <Panel title="Biografía e Historia" icon={Icon.fileText}>
              <form className="mtp-form" onSubmit={e => { e.preventDefault(); savePatch({ description: form.description, mainCharacters: form.mainCharacters }, 'Biografía e historia guardada') }}>
                <Field label="Biografía pública del equipo" textarea value={form.description} onChange={value => setField('description', value)} />
                <Field label="Personajes / Picks Principales (ej. Zed, Jinx - separados por coma)" value={(form.mainCharacters || []).join(', ')} onChange={value => setField('mainCharacters', value.split(',').map(item => item.trim()).filter(Boolean))} icon={Icon.gamepad} />
                <button className="pnl-btn pnl-btn--primary" style={{ marginTop: '8px' }} disabled={saving}>
                  {Icon.check} Guardar biografía y picks
                </button>
              </form>
            </Panel>

            {/* Formulario Adicional: Multimedia del Equipo (Logo y Banner) */}
            <Panel title="Multimedia del Equipo" icon={Icon.camera}>
              <p className="dim" style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-dim)' }}>
                Sube el logotipo oficial y la foto profesional o banner de portada de tu escuadra competitiva.
              </p>
              <div className="mtp-media-upload-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '8px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logo del Equipo</span>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(6,8,13,0.4)', border: '2px solid rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {form.logo ? <img src={imageUrl(form.logo)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px', fontWeight: '900', color: accent }}>{initials(form.name)}</span>}
                  </div>
                  <label className="pnl-btn pnl-btn--small pnl-btn--primary" style={{ cursor: 'pointer', textAlign: 'center', width: '100%', margin: '0' }}>
                    {Icon.plus} Subir Nuevo Logo
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleMediaUpload(e, 'logo')} />
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Banner / Portada</span>
                  <div style={{ width: '100%', height: '80px', borderRadius: '8px', background: 'rgba(6,8,13,0.4)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {form.banner ? <img src={imageUrl(form.banner)} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Sin Foto Cargada</span>}
                  </div>
                  <label className="pnl-btn pnl-btn--small pnl-btn--primary" style={{ cursor: 'pointer', textAlign: 'center', width: '100%', margin: '0' }}>
                    {Icon.plus} Subir Banner
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleMediaUpload(e, 'banner')} />
                  </label>
                </div>
              </div>
            </Panel>

            {/* Formulario 3: Ajustes de Reclutamiento */}
            <Panel title="Ajustes de reclutamiento y página" icon={Icon.globe}>
              <form className="mtp-form" onSubmit={e => { e.preventDefault(); savePatch({ brand: form.brand, contactEmail: form.contactEmail }, 'Ajustes guardados') }}>
                <Field label="Organización / Marca corporativa" value={form.brand} onChange={value => setField('brand', value)} icon={Icon.award} />
                <Field label="Correo electrónico de contacto" type="email" value={form.contactEmail} onChange={value => setField('contactEmail', value)} icon={Icon.mail} />
                
                <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                  <Toggle label="Aceptar solicitudes" hint="Permite que otros jugadores se postulen al equipo públicamente." checked={form.acceptRequests !== false} onChange={value => { setField('acceptRequests', value); savePatch({ acceptRequests: value }) }} />
                </div>
                <button className="pnl-btn pnl-btn--primary" style={{ marginTop: '8px' }} disabled={saving}>
                  {Icon.check} Guardar Ajustes
                </button>
              </form>
            </Panel>

            {/* Formulario 4: Roster Rapido */}
            <Panel title="Roster rápido" icon={Icon.users}>
              <p className="dim" style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-dim)' }}>
                Estado de ocupación de las posiciones clave de tu roster competitivo.
              </p>
              <div className="mtp-roster-mini" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                {slotRows.slice(0, 6).map(({ slot, player }) => (
                  <div className={`mtp-mini-slot ${player ? 'filled' : 'empty'}`} key={slot} style={{ cursor: 'pointer' }} onClick={() => navigate('/mi-equipo/roster')}>
                    <span>{slot}</span>
                    <b style={{ color: player ? accent : 'var(--text-dim)' }}>{player?.nick || 'Vacante'}</b>
                  </div>
                ))}
              </div>
              <button className="pnl-btn" style={{ width: '100%', marginTop: '18px' }} onClick={() => navigate('/mi-equipo/roster')}>
                {Icon.edit} Gestionar Roster Completo
              </button>
            </Panel>
              </>
            )}
          </section>
        </>
      )}

      {section === 'roster' && (
        <div className="mtp-roster-container">
          <div className="mtp-roster-main">
            <h3 className="mtp-section-heading mtp-roster-heading">
              <span className="mtp-title-icon">{Icon.users}</span> Roster Oficial
            </h3>
            {/* Quien es el lider, a la vista de todos los miembros; el lider lo
                puede delegar desde aqui (antes solo en Privacidad). */}
            <div className="mtp-leader-strip">
              <span className="mtp-leader-strip__who">
                {Icon.crown}
                <span>Líder: <b data-no-translate>{team?.leader?.nick || (isCurrentLeader ? (user?.nick || 'Tú') : 'Sin datos')}</b>{isCurrentLeader && ' (tú)'}</span>
              </span>
              {isCurrentLeader && leadershipCandidates.length > 0 && (
                <span className="mtp-leader-strip__actions">
                  <select value={newLeaderId} onChange={event => setNewLeaderId(event.target.value)} disabled={saving} aria-label="Nuevo líder">
                    {leadershipCandidates.map(member => (
                      <option key={member.id} value={member.id}>{member.nick}</option>
                    ))}
                  </select>
                  <button className="pnl-btn" type="button" disabled={saving || !newLeaderId} onClick={handleTransferLeadership}>
                    {Icon.crown} Delegar liderazgo
                  </button>
                </span>
              )}
              {isCurrentLeader && leadershipCandidates.length === 0 && (
                <small>Para delegar el liderazgo primero invita a otro miembro.</small>
              )}
            </div>
            <div className="mtp-roster-groups">
              {groupedRosterRows.map(({ group, title, rows }) => (
                <section className={`mtp-roster-group mtp-roster-group--${group}`} key={group}>
                  <div className="mtp-roster-group__head">
                    <div>
                      <span>{group === 'staff' ? `${staffUsed}/${maxStaff}` : `${rows.filter(row => row.player).length}/${rows.length}`}</span>
                      <h4>{title}</h4>
                    </div>
                    <small>{group === 'patrocinadores'
                      ? 'Logos y marcas aliadas'
                      : group === 'staff'
                        ? `Cupo propio: no ocupa lugar de jugador · máx. ${STAFF_ROLE_MAX.coach} coaches, ${STAFF_ROLE_MAX.analyst} analistas, ${STAFF_ROLE_MAX.manager} manager`
                        : 'Slots competitivos'}</small>
                  </div>
                  <div className="mtp-roster-list">
                    {rows.map(({ slot, player }) => {
                const isTitular = slot.startsWith('titular')
                const isCoach = slot.startsWith('coach')
                const isSponsor = slot.startsWith('patrocinador') || slot.startsWith('sponsor')
                // El distintivo es el PUESTO (Titular 1, Coach principal...); la
                // posicion en el juego (Duelista, Iniciador...) va aparte y se edita.
                const slotBadgeText = rosterSlotSeatLabel(slot)
                const positionOptions = rosterSlotRoleOptions(slot, team?.game)
                const canEditPosition = Boolean(player) && positionOptions.length > 0 && (isCurrentLeader || String(player?.userId || '') === currentUserId)
                const slotBadgeClass = isTitular ? 'roster-badge--titular' : (isCoach ? 'roster-badge--coach' : (isSponsor ? 'roster-badge--sponsor' : 'roster-badge--suplente'))
                // Cuenta miembro en este puesto (no un nombre escrito a mano).
                const slotMemberId = player && memberIdSet.has(String(player.userId || '')) ? String(player.userId) : ''
                const characters = player ? normalizeCharacters(player, form.mainCharacters) : []
                const socials = player ? normalizeSocials(player) : {}
                const socialCount = Object.values(socials).filter(Boolean).length
                
                return (
                  <motion.article
                    className={`mtp-roster-card ${player ? 'filled' : 'vacant'} ${activeRosterSlot === slot ? 'is-selected' : ''}`}
                    key={slot}
                    style={{ '--roster-accent': accent }}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: activeRosterSlot === slot ? 1.02 : 1,
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    whileTap={player ? { scale: 0.98 } : undefined}
                    role={player ? 'button' : undefined}
                    tabIndex={player ? 0 : undefined}
                    onClick={() => {
                      if (!player) return
                      setActiveRosterSlot(slot)
                      setShowRosterEditor(false)
                    }}
                    onKeyDown={event => {
                      if (!player || (event.key !== 'Enter' && event.key !== ' ')) return
                      event.preventDefault()
                      setActiveRosterSlot(slot)
                      setShowRosterEditor(false)
                    }}
                  >
                    <div className="mtp-roster-card__main">
                      <span className="mtp-roster-card__avatar">
                        {player?.avatar ? <img src={imageUrl(player.avatar)} alt={player.nick} /> : (player ? initials(player.nick) : initials(slot))}
                      </span>
                      <div className="mtp-roster-card__info">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <b>{player?.nick || 'Vacante'}</b>
                          <span className={`roster-badge ${slotBadgeClass}`}>{slotBadgeText}</span>
                          {player?.roleVerified && <span className="mtp-roster-card__verified" title="Rol aprobado por GlitchGang">{Icon.check} Verificado</span>}
                          {player && <GameAccountBadge account={gameAccountStatus[String(form.rosterSlots?.[slot]?.userId || '')]?.mlbb} compact />}
                        </div>
                        <small className="slot-key">{slot.toUpperCase()}</small>
                        {player ? (
                          <div className="player-details player-details--compact">
                            {canEditPosition ? (
                              <label className="mtp-roster-card__position" onClick={event => event.stopPropagation()}>
                                <span>{Icon.award} Posición en el juego</span>
                                <select
                                  value={positionOptions.includes(player.role) ? player.role : ''}
                                  disabled={saving}
                                  onChange={event => changeSlotPosition(slot, event.target.value)}
                                >
                                  {!positionOptions.includes(player.role) && <option value="">{player.role || 'Elegir…'}</option>}
                                  {positionOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </label>
                            ) : (
                              <span>{Icon.award} {player.role || 'Posición libre'}</span>
                            )}
                            <div className="mtp-roster-card__signals">
                              <i className={player.gameId ? 'is-on' : ''} title="ID de juego">{Icon.gamepad}</i>
                              <i className={characters.length ? 'is-on' : ''} title="Personajes favoritos">{Icon.trophy}</i>
                              <i className={socialCount ? 'is-on' : ''} title="Redes sociales">{Icon.share}</i>
                            </div>
                          </div>
                        ) : (
                          <p className="dim" style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>Sin jugador asignado</p>
                        )}
                      </div>
                    </div>
                    <div className="mtp-roster-card__actions">
                      {player ? (
                        <>
                          <button className="pnl-btn pnl-btn--small" onClick={(event) => { event.stopPropagation(); setActiveRosterSlot(slot); setShowRosterEditor(false) }}>
                            {Icon.eye} Ver ficha
                          </button>
                          {isCurrentLeader && slotMemberId && slotMemberId !== teamLeaderId && (
                            <select
                              className="mtp-roster-card__role"
                              aria-label={`Rol de ${player.nick}`}
                              value={staffRoleOfSlot(slot) || 'player'}
                              disabled={saving}
                              onClick={event => event.stopPropagation()}
                              onChange={event => changeMemberRole(slot, slotMemberId, event.target.value)}
                            >
                              {TEAM_ROLES.map(item => <option key={item} value={item}>{teamRoleLabel(item)}</option>)}
                            </select>
                          )}
                          {!(slotMemberId && slotMemberId === teamLeaderId) && (
                            <button className="pnl-btn pnl-btn--danger pnl-btn--small" onClick={(event) => { event.stopPropagation(); removeSlot(slot) }}>
                              {Icon.trash} {slotMemberId ? 'Sacar del equipo' : 'Quitar'}
                            </button>
                          )}
                        </>
                      ) : (
                        <button className="pnl-btn pnl-btn--primary pnl-btn--small" onClick={() => {
                          // Patrocinador (marca): ficha de texto. Jugador/staff: un
                          // miembro o una invitacion (SlotAssignPanel), nunca un nick a mano.
                          if (isSponsor) {
                            setSlotForm(prev => ({ ...prev, slot, nick: '', role: rosterSlotPositionLabel(slot, team?.game), gameId: '', email: '', avatar: '', bio: '', rank: '', availability: '', mainCharacters: '', socials: {} }))
                            setShowRosterEditor(true)
                          } else {
                            setActiveRosterSlot('')
                            setShowRosterEditor(false)
                            setAssignSlot(slot)
                          }
                        }}>
                          {Icon.plus} Asignar
                        </button>
                      )}
                    </div>
                  </motion.article>
                )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {(showRosterEditor || activeRosterPlayer || assignSlot) && (
            <button
              className="mtp-roster-editor-backdrop"
              type="button"
              aria-label="Cerrar ficha"
              onClick={() => {
                setShowRosterEditor(false)
                setActiveRosterSlot('')
                setAssignSlot('')
              }}
            />
          )}

          <div className={`mtp-roster-editor ${(showRosterEditor || activeRosterPlayer || assignSlot) ? 'is-open' : ''}`}>
            <AnimatePresence mode="wait">
              {assignSlot && !showRosterEditor && !activeRosterPlayer ? (
                <motion.div
                  key={`assign-${assignSlot}`}
                  initial={{ opacity: 0, x: 24, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: -18, filter: 'blur(6px)' }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                >
                  <SlotAssignPanel
                    slot={assignSlot}
                    team={form}
                    members={(team?.members || []).filter(m => m && typeof m === 'object')}
                    leaderId={teamLeaderId}
                    busy={saving}
                    onMove={moveMemberToSlot}
                    onChangeRole={async (currentSlot, memberId, role) => { await changeMemberRole(currentSlot, memberId, role); setAssignSlot('') }}
                    onClose={() => setAssignSlot('')}
                  />
                </motion.div>
              ) : !showRosterEditor && activeRosterPlayer ? (
                <RosterPlayerDetail
                  key={`detail-${activeRosterRow.slot}`}
                  slot={activeRosterRow.slot}
                  player={activeRosterPlayer}
                  team={form}
                  accent={accent}
                  onEdit={() => {
                    const characters = normalizeCharacters(activeRosterPlayer, [])
                    setSlotForm({
                      slot: activeRosterRow.slot,
                      // Puesto donde estaba al abrir: si se elige otro, la ficha se mueve (no se duplica).
                      originSlot: activeRosterRow.slot,
                      nick: activeRosterPlayer.nick || '',
                      role: activeRosterPlayer.role || '',
                      gameId: activeRosterPlayer.gameId || activeRosterPlayer.playerCode || '',
                      email: activeRosterPlayer.email || '',
                      avatar: activeRosterPlayer.avatar || '',
                      bio: activeRosterPlayer.bio || activeRosterPlayer.description || activeRosterPlayer.gamerProfile?.bio || '',
                      rank: activeRosterPlayer.rank || activeRosterPlayer.gamerProfile?.rank || activeRosterPlayer.experienceLevel || '',
                      availability: activeRosterPlayer.availability || '',
                      mainCharacters: characters.join(', '),
                      discordId: activeRosterPlayer.discordId || activeRosterPlayer.discord?.id || '',
                      discordName: verifiedDiscordValue(activeRosterPlayer),
                      socials: normalizeSocials(activeRosterPlayer),
                    })
                    setShowRosterEditor(true)
                  }}
                  onClose={() => setActiveRosterSlot('')}
                />
              ) : showRosterEditor ? (
                // Solo existe cuando se abre: antes quedaba montado oculto y, al
                // tocar "Asignar", se veia salir antes de que entrara el panel nuevo.
                <motion.div
                  key="roster-editor-form"
                  initial={{ opacity: 0, x: 24, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: -18, filter: 'blur(6px)' }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                >
            <h3 className="mtp-section-heading mtp-roster-heading mtp-roster-heading--editor">
              <span className="mtp-title-icon">{Icon.plus}</span> Perfil del miembro
              <button
                className="mtp-roster-editor__close"
                type="button"
                aria-label="Cerrar editor"
                onClick={() => {
                  setShowRosterEditor(false)
                  setActiveRosterSlot('')
                }}
              >
                {Icon.x}
              </button>
            </h3>
            {activeRosterPlayer && (
              <button className="pnl-btn pnl-btn--small mtp-roster-back" type="button" onClick={() => setShowRosterEditor(false)}>
                {Icon.eye} Volver a ficha
              </button>
            )}
            <form className="mtp-form mtp-roster-form" onSubmit={saveRoster}>
              <div className="mtp-roster-photo-field">
                <div className="mtp-roster-photo-field__preview">
                  {slotForm.avatar ? <img src={imageUrl(slotForm.avatar)} alt="Foto del miembro" /> : <span>{initials(slotForm.nick || slotForm.slot)}</span>}
                </div>
                <div>
                  <b style={{ color: '#ef4444' }}>Foto profesional</b>
                  <p>Sube la imagen del jugador, coach, manager o patrocinador.</p>
                  <label className="pnl-btn pnl-btn--small">
                    {Icon.camera || Icon.plus} Subir foto
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleRosterAvatarUpload}
                    />
                  </label>
                </div>
              </div>

              <label className="mtp-field">
                <span>Posición / Roster slot</span>
                <div className="mtp-input-wrapper">
                  <select
                    value={slotForm.slot}
                    onChange={e => setSlotForm(prev => ({ ...prev, slot: e.target.value }))}
                  >
                    {/* Solo puestos del mismo tipo (jugador<->jugador, staff<->staff, marca<->marca):
                        pasar de jugador a staff es "Cambiar rol". */}
                    {slotRows
                      .filter(row => row.slot === slotForm.slot || rosterSlotGroupKind(row.slot) === rosterSlotGroupKind(slotForm.slot))
                      .map(row => (
                        <option key={row.slot} value={row.slot} disabled={Boolean(row.player) && row.slot !== slotForm.slot}>
                          {rosterSlotSeatLabel(row.slot)} {row.player ? `(${row.player.nick})` : '(Vacante)'}
                        </option>
                      ))}
                  </select>
                </div>
              </label>

              <Field
                label={editingMemberAccount ? 'Nickname (de su cuenta)' : 'Nombre de la marca / nickname'}
                value={slotForm.nick}
                onChange={value => setSlotForm(prev => ({ ...prev, nick: value }))}
                disabled={editingMemberAccount}
                hint={editingMemberAccount ? 'Es la identidad de su cuenta: solo la cambia esa persona.' : ''}
                required
              />
              {rosterSlotRoleOptions(slotForm.slot, team?.game).length > 0 ? (
                <Field label="Rol / Línea competitiva" value={slotForm.role} onChange={value => setSlotForm(prev => ({ ...prev, role: value }))} options={rosterSlotRoleOptions(slotForm.slot, team?.game)} />
              ) : (
                <Field label="Rol / Línea competitiva (ej. Midlaner, IGL)" value={slotForm.role} onChange={value => setSlotForm(prev => ({ ...prev, role: value }))} />
              )}
              <Field
                label={gameIdHint(team?.game).label}
                value={slotForm.gameId}
                onChange={value => setSlotForm(prev => ({ ...prev, gameId: value }))}
                placeholder={gameIdHint(team?.game).placeholder}
                disabled={editingMemberAccount && !editingOwnSlot}
                hint={editingMemberAccount && !editingOwnSlot ? 'El ID de juego lo pone cada jugador en su propia ficha.' : gameIdHint(team?.game, slotForm.gameId).hint}
              />
              {/* Solo en el puesto propio: la cuenta verificada es de quien esta conectado. */}
              {isMobileLegends(team?.game) && editingOwnSlot && <GameIdVerify value={slotForm.gameId} onUse={fillVerifiedAccount} />}
              <Field label="Correo electrónico (opcional)" type="email" value={slotForm.email} onChange={value => setSlotForm(prev => ({ ...prev, email: value }))} />
              <Field label="Biografia del jugador" textarea value={slotForm.bio} onChange={value => setSlotForm(prev => ({ ...prev, bio: value }))} />
              <Field label="Personajes favoritos" value={slotForm.mainCharacters} onChange={value => setSlotForm(prev => ({ ...prev, mainCharacters: value }))} />
              <Field label="Rango / nivel" value={slotForm.rank} onChange={value => setSlotForm(prev => ({ ...prev, rank: value }))} />
              <Field label="Disponibilidad" value={slotForm.availability} onChange={value => setSlotForm(prev => ({ ...prev, availability: value }))} />

              <div className="mtp-roster-social-editor">
                <b>Redes del miembro</b>
                <div>
                  {SOCIAL_FIELDS.map(([key, label]) => {
                    const verifiedDiscord = key === 'discord' && Boolean(slotForm.discordId || slotForm.discordName)
                    return (
                      <Field
                        key={key}
                        label={label}
                        value={key === 'discord' ? (slotForm.discordName || slotForm.socials?.discord || '') : (slotForm.socials?.[key] || '')}
                        onChange={value => setSlotForm(prev => ({ ...prev, socials: { ...(prev.socials || {}), [key]: value } }))}
                        disabled={verifiedDiscord}
                        hint={verifiedDiscord ? 'Discord vinculado desde la cuenta. Para cambiarlo, ve a Ajustes > Conexiones.' : ''}
                      />
                    )
                  })}
                </div>
              </div>
              
              <button className="pnl-btn pnl-btn--primary mtp-roster-save" disabled={saving}>
                {Icon.check} Guardar miembro
              </button>
            </form>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      )}

      {section === 'enfrentamiento' && (
        <section className="mtp-matchups">
          <div className="mtp-matchups__head">
            <span>{Icon.target} Partidas</span>
            <h2>Enfrentamiento del equipo</h2>
            <p>Rival, horario, formato y estado del check-in del próximo partido de {team?.name || 'tu equipo'} en cada torneo activo.</p>
          </div>
          <TeamMatchups team={team} />
        </section>
      )}

      {section === 'planes' && (
        <section className="mtp-matchups">
          <div className="mtp-matchups__head">
            <span>{Icon.fileText} Coach</span>
            <h2>Planes del coach</h2>
            <p>Planes de trabajo que el coach de {team?.name || 'tu equipo'} te envió: objetivo de la semana, estudio, práctica y tareas. Revísalos y apruébalos para que el coach sepa que el equipo está alineado.</p>
          </div>
          <TeamCoachPlans team={team} />
        </section>
      )}

      {(section === 'web' || section === 'patrocinadores') && (
        <section className="mtp-web-studio">
          <div className="mtp-web-studio__hero">
            <div>
              <span>{section === 'patrocinadores' ? Icon.award : Icon.globe} {section === 'patrocinadores' ? 'Soporte comercial' : 'Pagina publica'}</span>
              <h2>{section === 'patrocinadores' ? 'Patrocinadores del equipo' : 'Pagina web del equipo'}</h2>
              <p>
                {section === 'patrocinadores'
                  ? 'Administra marcas aliadas, logos, enlaces, redes y datos publicos en un espacio dedicado.'
                  : `Define como se presenta ${form.name || 'tu equipo'} en la pagina publica: portada, identidad, biografia, patrocinadores y canales de contacto.`}
              </p>
            </div>
            <button className="pnl-btn" type="button" onClick={() => navigate(`/equipos/${team.id || team._id}`)}>
              {Icon.eye} Ver pagina publica
            </button>
          </div>

          <div className={`mtp-web-studio__grid ${section === 'patrocinadores' ? 'mtp-web-studio__grid--single' : ''}`}>
            <form className="mtp-web-card mtp-web-card--main" onSubmit={saveWeb}>
              {section === 'web' && (
                <>
                  <div className="mtp-web-card__head">
                    <div>
                      <span>{Icon.edit} Informacion</span>
                      <h3>Identidad y contenido</h3>
                    </div>
                    <small>{profilePercent}% completo</small>
                  </div>

                  <div className="mtp-web-cover">
                    <div className="mtp-web-cover__media" style={{ '--team-banner': form.banner ? `url(${imageUrl(form.banner)})` : undefined }}>
                      {!form.banner && <span>{Icon.image || Icon.globe} Portada del equipo</span>}
                      <div className="mtp-web-cover__logo">
                        {form.logo ? <img src={imageUrl(form.logo)} alt={form.name || 'Logo del equipo'} /> : initials(form.name)}
                      </div>
                    </div>
                    <div className="mtp-web-cover__tools">
                      <div className="mtp-web-upload-actions">
                        <label className="pnl-btn pnl-btn--small">
                          {Icon.camera || Icon.plus} Subir portada
                          <input type="file" accept="image/*" onChange={event => handleMediaUpload(event, 'banner')} />
                        </label>
                        <label className="pnl-btn pnl-btn--small">
                          {Icon.image || Icon.plus} Subir logo
                          <input type="file" accept="image/*" onChange={event => handleMediaUpload(event, 'logo')} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mtp-web-form-grid">
                    <Field label="Nombre publico" value={form.name} onChange={value => setField('name', value)} />
                    <Field label="Marca / organizacion" value={form.brand} onChange={value => setField('brand', value)} />
                    <Field label="Slogan" value={form.slogan} onChange={value => setField('slogan', value)} />
                    <Field label="Correo de contacto" type="email" value={form.contactEmail} onChange={value => setField('contactEmail', value)} />
                    <Field label="Picks principales" value={(form.mainCharacters || []).join(', ')} onChange={value => setField('mainCharacters', value.split(',').map(item => item.trim()).filter(Boolean))} />
                    <Field label="Patrocinador destacado" value={form.sponsor} onChange={value => setField('sponsor', value)} />
                    <Field label="Biografia publica" textarea value={form.description} onChange={value => setField('description', value)} />
                  </div>
                </>
              )}

              {section === 'patrocinadores' && (
                <section className="mtp-sponsor-studio" aria-label="Patrocinadores del equipo">
                  <div className="mtp-sponsor-studio__head">
                    <div>
                      <span>{Icon.award} Patrocinadores</span>
                      <h3>Marcas aliadas</h3>
                      <p>Gestiona cada patrocinador con su logo, pagina, redes y datos publicos. Esta informacion se mostrara en la pagina web del equipo.</p>
                    </div>
                    <button className="pnl-btn pnl-btn--small" type="button" onClick={addSponsor}>
                      {Icon.plus} Agregar patrocinador
                    </button>
                  </div>

                  <div className="mtp-sponsor-editor-list">
                    {(form.sponsors || []).length ? (form.sponsors || []).map((sponsor, index) => (
                      <motion.article
                        className="mtp-sponsor-editor"
                        key={`sponsor-editor-${index}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, delay: index * 0.03 }}
                      >
                        <div className="mtp-sponsor-editor__media">
                          <div className="mtp-sponsor-editor__logo">
                            {sponsor.logo ? <img src={imageUrl(sponsor.logo)} alt={sponsor.name || 'Logo del patrocinador'} /> : <span>{sponsor.name ? initials(sponsor.name) : 'SP'}</span>}
                          </div>
                          <label className="pnl-btn pnl-btn--small">
                            {Icon.camera || Icon.image} Subir logo
                            <input type="file" accept="image/*" onChange={event => handleSponsorLogoUpload(event, index)} />
                          </label>
                        </div>

                        <div className="mtp-sponsor-editor__content">
                          <div className="mtp-sponsor-editor__top">
                            <div>
                              <span>Patrocinador #{index + 1}</span>
                              <h4>{sponsor.name || 'Nueva marca aliada'}</h4>
                            </div>
                            <button className="pnl-btn pnl-btn--small" type="button" onClick={() => removeSponsor(index)}>
                              {Icon.trash} Quitar
                            </button>
                          </div>

                          <div className="mtp-sponsor-editor__grid">
                            <Field label="Nombre de la marca" value={sponsor.name} onChange={value => updateSponsor(index, { name: value })} />
                            <Field label="Nivel / tipo" value={sponsor.tier} onChange={value => updateSponsor(index, { tier: value })} />
                            <Field label="Pagina web" value={sponsor.website} onChange={value => updateSponsor(index, { website: value })} />
                            <Field label="Desde" value={sponsor.since} onChange={value => updateSponsor(index, { since: value })} />
                            <Field label="Ubicacion" value={sponsor.location} onChange={value => updateSponsor(index, { location: value })} />
                            <Field label="Contacto" value={sponsor.contact} onChange={value => updateSponsor(index, { contact: value })} />
                            <Field label="Descripcion publica" textarea value={sponsor.description} onChange={value => updateSponsor(index, { description: value })} />
                          </div>

                          <div className="mtp-sponsor-editor__socials">
                            <Field label="Instagram" value={sponsor.socials?.instagram || ''} onChange={value => updateSponsor(index, { socials: { instagram: value } })} />
                            <Field label="X / Twitter" value={sponsor.socials?.twitter || sponsor.socials?.x || ''} onChange={value => updateSponsor(index, { socials: { twitter: value, x: value } })} />
                            <Field label="Discord" value={sponsor.socials?.discord || ''} onChange={value => updateSponsor(index, { socials: { discord: value } })} />
                          </div>
                        </div>
                      </motion.article>
                    )) : (
                      <div className="mtp-sponsor-empty">
                        <span>{Icon.award}</span>
                        <b>Sin patrocinadores publicados</b>
                        <p>Agrega una marca aliada con logo, enlaces y descripcion para que tenga su propio espacio en la pagina del equipo.</p>
                        <button className="pnl-btn pnl-btn--primary" type="button" onClick={addSponsor}>
                          {Icon.plus} Crear patrocinador
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <div className="mtp-web-actions">
                <button className="pnl-btn pnl-btn--primary" disabled={saving}>
                  {Icon.check} {section === 'patrocinadores' ? 'Guardar patrocinadores' : 'Guardar pagina'}
                </button>
              </div>
            </form>

            {section === 'web' && <aside className="mtp-web-side">
              <form className="mtp-web-card" onSubmit={event => { event.preventDefault(); savePatch({ socials: form.socials, contactEmail: form.contactEmail }, 'Redes guardadas') }}>
                <div className="mtp-web-card__head">
                  <div>
                    <span>{Icon.share} Contacto</span>
                    <h3>Redes sociales</h3>
                  </div>
                </div>
                <div className="mtp-social-form">
                  {SOCIAL_FIELDS.map(([key, label]) => (
                    <Field key={key} label={label} value={form.socials?.[key] || ''} onChange={value => setSocial(key, value)} />
                  ))}
                </div>
                <button className="pnl-btn pnl-btn--primary" disabled={saving}>{Icon.check} Guardar redes</button>
              </form>

              <div className="mtp-web-card mtp-web-preview">
                <div className="mtp-web-card__head">
                  <div>
                    <span>{Icon.eye} Vista rapida</span>
                    <h3>{form.name || 'Equipo sin nombre'}</h3>
                  </div>
                </div>
                <p>{form.slogan || 'Agrega un slogan competitivo para presentar el equipo.'}</p>
                <div>
                  <span>{form.game || 'Juego sin definir'}</span>
                  <span>{form.brand || 'Marca sin definir'}</span>
                  <span>{(form.mainCharacters || []).length} picks</span>
                </div>
              </div>
            </aside>}
          </div>
        </section>
      )}

      {section === 'calendario' && (
        <section className="mtp-team-calendar">
          <div className="mtp-team-calendar__hero">
            <div>
              <span>{Icon.calendar} Cronograma del equipo</span>
              <h2>Actividades, torneos y retos</h2>
              <p>Organiza todo lo que afecta al equipo: scrims publicados, VS activos, historial, tickets retadores y actividades internas.</p>
            </div>
            <div className="mtp-team-calendar__actions">
              <button className="pnl-btn" type="button" onClick={() => {
                setCalendarYear(today.getFullYear())
                setCalendarMonth(today.getMonth())
                setSelectedCalendarDate(todayKey)
                setCalendarPeriod('today')
              }}>{Icon.clock} Hoy</button>
              <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => openActivityForm(selectedCalendarDate)}>
                {Icon.plus} Nueva actividad
              </button>
            </div>
          </div>

          <div className="mtp-team-calendar__stats">
            <button type="button" className={calendarPeriod === 'past' ? 'active' : ''} onClick={() => setCalendarPeriod('past')}><b>{calendarStats.past}</b><span>Pasadas</span></button>
            <button type="button" className={calendarPeriod === 'today' ? 'active' : ''} onClick={() => setCalendarPeriod('today')}><b>{calendarStats.today}</b><span>Hoy</span></button>
            <button type="button" className={calendarPeriod === 'future' ? 'active' : ''} onClick={() => setCalendarPeriod('future')}><b>{calendarStats.future}</b><span>Futuras</span></button>
            <button type="button" className={calendarPeriod === 'all' ? 'active' : ''} onClick={() => setCalendarPeriod('all')}><b>{calendarStats.total}</b><span>Total</span></button>
          </div>

          <div className="mtp-team-calendar__layout">
            <Panel title={`${TEAM_MONTHS[calendarMonth]} ${calendarYear}`} icon={Icon.calendar}>
              <div className="mtp-team-calendar__bar">
                <button className="pnl-btn pnl-btn--small" type="button" onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11)
                    setCalendarYear(value => value - 1)
                  } else {
                    setCalendarMonth(value => value - 1)
                  }
                }}><span style={{ transform: 'rotate(180deg)', display: 'inline-grid' }}>{Icon.chevronRight}</span> Mes</button>
                <button className="pnl-btn pnl-btn--small" type="button" onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0)
                    setCalendarYear(value => value + 1)
                  } else {
                    setCalendarMonth(value => value + 1)
                  }
                }}>Mes {Icon.chevronRight}</button>
              </div>
              <div className="mtp-team-calendar__board">
                <div className="mtp-team-calendar__week">
                  {TEAM_WEEKDAYS.map(day => <span key={day}>{day}</span>)}
                </div>
                <div className="mtp-team-calendar__grid">
                  {calendarCells.map((day, index) => {
                    if (!day) return <div className="mtp-team-calendar__cell mtp-team-calendar__cell--empty" key={`empty-${index}`} />
                    const key = calendarKeyFor(day)
                    const dayItems = teamActivitiesByDate[key] || []
                    return (
                      <button
                        className={`mtp-team-calendar__cell ${key === todayKey ? 'today' : ''} ${key === selectedCalendarDate ? 'selected' : ''}`}
                        key={key}
                        type="button"
                        onClick={() => setSelectedCalendarDate(key)}
                        onDoubleClick={() => openActivityForm(key)}
                      >
                        <b>{day}</b>
                        <span>
                          {dayItems.slice(0, 3).map(item => (
                            <em key={item.id} style={{ '--activity-color': item.color }}>{item.title}</em>
                          ))}
                          {dayItems.length > 3 && <small>+{dayItems.length - 3}</small>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </Panel>

            <Panel title={selectedCalendarDate ? `Agenda del ${formatTeamShortDate(selectedCalendarDate)}` : 'Agenda del día'} icon={Icon.bell}>
              <div className="mtp-team-calendar__day-list">
                {selectedTeamActivities.length ? selectedTeamActivities.map(item => (
                  <TeamActivityCard key={item.id} item={item} onDelete={deleteTeamActivity} navigate={navigate} />
                )) : (
                  <div className="mtp-team-calendar__empty">
                    <span>{Icon.calendar}</span>
                    <b>Sin actividades en esta fecha</b>
                    <p>Agrega una actividad, reunión, práctica, scrim o recordatorio del equipo.</p>
                    <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => openActivityForm(selectedCalendarDate)}>{Icon.plus} Crear actividad</button>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Línea de tiempo del equipo" icon={Icon.bolt}>
            <div className="mtp-team-calendar__filters">
              <input value={calendarQuery} onChange={event => setCalendarQuery(event.target.value)} placeholder="Buscar por actividad, juego o rival" />
              <select value={calendarType} onChange={event => setCalendarType(event.target.value)}>
                <option value="all">Todo</option>
                <option value="evento">Eventos</option>
                <option value="practica">Prácticas</option>
                <option value="scrim">Scrims</option>
                <option value="vs">VS</option>
                <option value="retador">Modo Retador</option>
                <option value="resultado">Resultados</option>
              </select>
            </div>
            <div className="mtp-team-calendar__timeline">
              {filteredTeamActivities.length ? filteredTeamActivities.map(item => (
                <TeamActivityCard key={`${item.id}-timeline`} item={item} onDelete={deleteTeamActivity} navigate={navigate} timeline />
              )) : (
                <div className="mtp-team-calendar__empty">
                  <span>{Icon.search}</span>
                  <b>No hay actividades con ese filtro</b>
                  <p>Cambia los filtros o crea una nueva actividad para este equipo.</p>
                </div>
              )}
            </div>
          </Panel>

          <AnimatePresence>
            {showActivityForm && (
              <motion.div className="mtp-team-calendar-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowActivityForm(false)}>
                <motion.form className="mtp-team-calendar-modal__panel" initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .96 }} onClick={event => event.stopPropagation()} onSubmit={saveTeamActivity}>
                  <div className="mtp-team-calendar-modal__head">
                    <div>
                      <span>{Icon.calendar} Nueva actividad</span>
                      <h3>Agregar al calendario</h3>
                    </div>
                    <button type="button" onClick={() => setShowActivityForm(false)} aria-label="Cerrar">{Icon.x}</button>
                  </div>
                  <Field label="Título" value={activityForm.title} onChange={value => setActivityForm(prev => ({ ...prev, title: value }))} required />
                  <div className="mtp-form--grid">
                    <label className="mtp-field">
                      <span className="mtp-field__label">Tipo</span>
                      <div className="mtp-control">
                        <select value={activityForm.type} onChange={event => setActivityForm(prev => ({ ...prev, type: event.target.value }))}>
                          <option value="evento">Evento</option>
                          <option value="practica">Práctica</option>
                          <option value="scrim">Scrim</option>
                          <option value="reunion">Reunión</option>
                          <option value="torneo">Torneo</option>
                        </select>
                      </div>
                    </label>
                    <Field label="Juego / categoría" value={activityForm.game} onChange={value => setActivityForm(prev => ({ ...prev, game: value }))} />
                    <Field label="Fecha" type="date" value={activityForm.date} onChange={value => setActivityForm(prev => ({ ...prev, date: value }))} required />
                    <Field label="Hora" type="time" value={activityForm.time} onChange={value => setActivityForm(prev => ({ ...prev, time: value }))} />
                  </div>
                  <Field label="Descripción" textarea value={activityForm.description} onChange={value => setActivityForm(prev => ({ ...prev, description: value }))} />
                  <div className="mtp-team-calendar-modal__colors">
                    {TEAM_CALENDAR_COLORS.map(color => (
                      <button type="button" key={color} className={activityForm.color === color ? 'active' : ''} style={{ background: color }} onClick={() => setActivityForm(prev => ({ ...prev, color }))} />
                    ))}
                  </div>
                  <button className="pnl-btn pnl-btn--primary" type="submit">{Icon.check} Guardar actividad</button>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {section === 'reclutar' && team && (
        <TeamRecruitment
          team={team}
          canManage={String(team?.leader?._id || team?.leader || '') === String(user?._id || user?.id || '')}
          onSaved={recruitment => setTeam(prev => (prev ? { ...prev, recruitment } : prev))}
        />
      )}

      {section === 'solicitudes' && (
        <section className="mtp-requests-layout">
          <div className="mtp-requests-hero">
            <div>
              <span>{Icon.mail} Reclutamiento</span>
              <h2>Solicitudes de ingreso</h2>
              <p>Gestiona jugadores que pidieron entrar desde el directorio de equipos o desde la pagina publica del equipo.</p>
            </div>
            <div className="mtp-requests-hero__stats">
              <strong>{pendingJoinRequests.length}</strong>
              <small>Pendientes</small>
              <button type="button" className="pnl-btn pnl-btn--primary" style={{ marginTop: 10 }} onClick={() => navigate('/mi-equipo/reclutar')}>{Icon.send} Reclutar</button>
            </div>
          </div>

          <Panel title="Bandeja de jugadores" icon={Icon.mail}>
            {joinRequests.length ? (
              <div className="mtp-request-list">
                {joinRequests.map(request => (
                  <article className={`mtp-request-card mtp-request-card--${request.status}`} key={`${request.source}-${request.id}`}>
                    <div className="mtp-request-card__avatar">{initials(request.nick)}</div>
                    <div className="mtp-request-card__body">
                      <div className="mtp-request-card__top">
                        <b>{request.nick}</b>
                        {request.teamRole !== 'player' && (
                          <em className={`mtp-request-card__as ${request.roleVerified ? 'is-verified' : ''}`}>
                            {request.roleVerified ? <>{Icon.check} {request.role} verificado</> : `Como ${request.role.toLowerCase()}`}
                          </em>
                        )}
                        <span>{requestStatusLabel(request.status)}</span>
                      </div>
                      <p>{request.message}</p>
                      <div className="mtp-request-card__meta">
                        <span>{Icon.shield} {request.role}</span>
                        {request.teamRole === 'player'
                          ? <span>{Icon.gamepad} {request.gameId}</span>
                          : <span>{Icon.users} Staff · no ocupa lugar de jugador</span>}
                        {request.staffCode && <span data-no-translate>{Icon.award || Icon.shield} {request.staffCode}</span>}
                        <span>{Icon.globe} {request.region}</span>
                      </div>
                      {request.card && <div className="mtp-request-actions"><ProCardButton request={request} /></div>}
                      {request.status === 'pending' && (
                        <div className="mtp-request-actions">
                          <button className="pnl-btn pnl-btn--primary" onClick={() => respondJoinRequest(request, 'accepted')}>{Icon.check} Aceptar</button>
                          <button className="pnl-btn pnl-btn--danger" onClick={() => respondJoinRequest(request, 'rejected')}>{Icon.x} Rechazar</button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mtp-requests-empty">
                <div className="mtp-requests-empty__icon">{Icon.users}</div>
                <h3>No hay solicitudes todavia</h3>
                <p>Para recibir candidatos, mantén activo el reclutamiento y comparte el código o la página pública del equipo. Cuando un jugador pulse <b>Solicitar unirme</b>, aparecerá aquí con sus datos.</p>
                <div className="mtp-requests-empty__steps">
                  <span><b>1</b> Activa “Aceptar solicitudes”.</span>
                  <span><b>2</b> Comparte el código del equipo.</span>
                  <span><b>3</b> Revisa, acepta o invita desde esta bandeja.</span>
                </div>
                <button className="pnl-btn pnl-btn--primary" onClick={() => navigate(`/equipos/${team.id || team._id}`)}>
                  {Icon.eye} Ver página pública
                </button>
              </div>
            )}
          </Panel>
          <Panel title="Invitar por nick" icon={Icon.send}>
            <TeamInvitations team={team} />
          </Panel>
          <Panel title="Centro de reclutamiento" icon={Icon.users}>
            <Toggle label="Aceptar solicitudes" hint="Abre o cierra la entrada de nuevos jugadores." checked={form.acceptRequests !== false} onChange={value => { setField('acceptRequests', value); savePatch({ acceptRequests: value }) }} />
            <div className="mtp-share-box">
              <b>Estado del buzón</b>
              <span className="mtp-request-count">{pendingJoinRequests.length} pendientes</span>
              <b>Link de invitación</b>
              {team.university?.isUniversityTeam ? (
                // El backend rechaza el link/codigo en equipos universitarios
                // (joinTeamForUser): mostrarlo prometia algo que no funciona.
                <small>Los equipos universitarios no usan link ni código: cada jugador entra por solicitud o por invitación por nick, para comprobar que sea estudiante verificado de la universidad.</small>
              ) : team.teamInviteCode ? (
                <>
                  {/* Quien abre el link entra directo al roster (JoinTeam ->
                      POST /teams/join). El codigo solo tambien sirve en
                      Equipos > "Unirme con codigo". */}
                  <code>{`${window.location.origin}/equipos/unirse/${team.teamInviteCode}`}</code>
                  <small>Código: {team.teamInviteCode} — quien abra el link entra directo al equipo{form.acceptRequests === false ? ' (ahora mismo está bloqueado: activa "Aceptar solicitudes")' : ''}.</small>
                  <button className="pnl-btn" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/equipos/unirse/${team.teamInviteCode}`); toast('Link copiado') }}>{Icon.link || Icon.copy} Copiar link</button>
                  <button className="pnl-btn" onClick={() => { navigator.clipboard.writeText(team.teamInviteCode); toast('Codigo copiado') }}>{Icon.copy || Icon.link} Copiar codigo</button>
                </>
              ) : (
                <small>Este equipo todavía no tiene código de invitación.</small>
              )}
              {!isBetaHidden('section:teams-find') && <button className="pnl-btn" onClick={() => navigate('/equipos?tab=buscar_jugadores')}>{Icon.search} Buscar jugadores</button>}
            </div>
          </Panel>
        </section>
      )}

      {section === 'privacidad' && (
        <section className="mtp-privacy-studio">
          <div className="mtp-privacy-hero">
            <div>
              <span>{Icon.lock} Centro de privacidad</span>
              <h2>Controla qué ve el público</h2>
              <p>Decide si el equipo recluta, si la página pública existe y qué datos aparecen para jugadores, rivales, marcas y organizadores.</p>
            </div>
            <div className="mtp-privacy-hero__status">
              <b>{form.publicProfile === false ? 'Privado' : 'Publicado'}</b>
              <small>{form.acceptRequests === false ? 'No acepta solicitudes' : 'Solicitudes abiertas'}</small>
            </div>
          </div>

          <div className="mtp-privacy-grid">
            <Panel title="Acceso y reclutamiento" icon={Icon.shield}>
              <Toggle label="Página pública del equipo" hint="Si lo apagas, terceros no podrán entrar al perfil web del equipo." checked={form.publicProfile !== false} onChange={value => { setField('publicProfile', value); savePatch({ publicProfile: value }) }} />
              <Toggle label="Aceptar solicitudes" hint="Permite o bloquea que jugadores envíen solicitudes desde la página pública." checked={form.acceptRequests !== false} onChange={value => { setField('acceptRequests', value); savePatch({ acceptRequests: value }) }} />
              <div className="mtp-privacy-actions">
                <button className="pnl-btn" type="button" onClick={() => navigate(`/equipos/${team.id || team._id}`)}>{Icon.eye} Ver web</button>
                <button className="pnl-btn" type="button" onClick={() => navigate('/mi-equipo/solicitudes')}>{Icon.mail} Buzón</button>
              </div>
            </Panel>

            <Panel title="Liderazgo y salida" icon={Icon.users}>
              <div className="mtp-share-box">
                <b>Tu rol en este equipo</b>
                <span>{isCurrentLeader ? 'Lider del equipo' : 'Miembro del equipo'}</span>

                {isCurrentLeader && leadershipCandidates.length > 0 && (
                  <>
                    <b>Delegar liderazgo</b>
                    <select
                      value={newLeaderId}
                      onChange={event => setNewLeaderId(event.target.value)}
                      disabled={saving}
                      style={{ width: '100%', minHeight: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(6,8,13,.72)', color: 'var(--text)', padding: '0 12px' }}
                    >
                      {leadershipCandidates.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.nick}{member.playerCode ? ` - ${member.playerCode}` : ''}
                        </option>
                      ))}
                    </select>
                    <button className="pnl-btn" type="button" disabled={saving || !newLeaderId} onClick={handleTransferLeadership}>
                      {Icon.check} Delegar liderazgo
                    </button>
                    <small className="dim">Puedes delegar ahora, o usar "Salir del equipo" para delegar y salir en un solo paso.</small>
                  </>
                )}

                {isCurrentLeader && leadershipCandidates.length === 0 && (
                  <small className="dim">No hay otro miembro real para recibir el liderazgo. Si sales ahora, el equipo se disuelve.</small>
                )}

                {!isCurrentLeader && (
                  <small className="dim">Al abandonar el equipo perderas acceso a su panel y a sus solicitudes internas.</small>
                )}

                <button className="pnl-btn pnl-btn--danger" type="button" disabled={saving} onClick={handleLeaveTeam}>
                  {Icon.x} {isCurrentLeader && leadershipCandidates.length === 0 ? 'Disolver equipo' : 'Salir del equipo'}
                </button>
              </div>
            </Panel>

            <Panel title="Contenido visible" icon={Icon.eye}>
              <Toggle label="Mostrar roster" hint="Oculta jugadores, fichas y carruseles del roster para visitantes." checked={form.showRoster !== false} onChange={value => { setField('showRoster', value); savePatch({ showRoster: value }) }} />
              <Toggle label="Mostrar staff" hint="Controla si coach, manager y analistas aparecen en la página pública." checked={form.showStaff !== false} onChange={value => { setField('showStaff', value); savePatch({ showStaff: value }) }} />
              <Toggle label="Mostrar patrocinadores" hint="Muestra u oculta marcas aliadas y sus fichas públicas." checked={form.showSponsors !== false} onChange={value => { setField('showSponsors', value); savePatch({ showSponsors: value }) }} />
              <Toggle label="Mostrar torneos" hint="Oculta historial, brackets y resultados competitivos del equipo." checked={form.showTournaments !== false} onChange={value => { setField('showTournaments', value); savePatch({ showTournaments: value }) }} />
            </Panel>

            <Panel title="Datos sensibles" icon={Icon.lock}>
              <Toggle label="Ocultar correos del roster" hint="Los correos personales de jugadores no se muestran a visitantes." checked={form.hideEmails !== false} onChange={value => { setField('hideEmails', value); savePatch({ hideEmails: value }) }} />
              <Toggle label="Ocultar IDs de juego" hint="Oculta Riot ID, player code, game tag u otros identificadores del roster." checked={Boolean(form.hideGameId)} onChange={value => { setField('hideGameId', value); savePatch({ hideGameId: value }) }} />
              <Toggle label="Mostrar correo del equipo" hint="Publica el correo de contacto general del equipo en la web." checked={form.showContactEmail === true} onChange={value => { setField('showContactEmail', value); savePatch({ showContactEmail: value }) }} />
              <Toggle label="Mostrar redes sociales" hint="Muestra Discord, Instagram, TikTok, YouTube y sitio web del equipo." checked={form.showSocials !== false} onChange={value => { setField('showSocials', value); savePatch({ showSocials: value }) }} />
            </Panel>

            <Panel title="Competencia y reputación" icon={Icon.trophy}>
              <Toggle label="Mostrar ranking y puntos" hint="Permite que visitantes vean victorias, derrotas, win rate, puntos y posición." checked={form.showCompetitiveSummary !== false} onChange={value => { setField('showCompetitiveSummary', value); savePatch({ showCompetitiveSummary: value }) }} />
              <div className="mtp-privacy-preview">
                <span><b>{form.showRoster !== false ? 'Visible' : 'Oculto'}</b> Roster</span>
                <span><b>{form.showStaff !== false ? 'Visible' : 'Oculto'}</b> Staff</span>
                <span><b>{form.showSponsors !== false ? 'Visible' : 'Oculto'}</b> Patrocinadores</span>
                <span><b>{form.showTournaments !== false ? 'Visible' : 'Oculto'}</b> Torneos</span>
                <span><b>{form.showSocials !== false ? 'Visible' : 'Oculto'}</b> Redes</span>
                <span><b>{form.showCompetitiveSummary !== false ? 'Visible' : 'Oculto'}</b> Ranking</span>
              </div>
            </Panel>
          </div>
        </section>
      )}

      {section === 'retador' && (
        <div className="mtp-challenger-section">
          {/* Header Banner */}
          <div className="challenger-header-card">
            <div className="challenger-header-card__info">
              <h2>{Icon.target} Modo Retador (Challenger)</h2>
              <p>
                El circuito de alta competencia para escuadras profesionales. Enfréntate a las promesas amateurs y semi-profesionales para validar tu estatus y obtener exposición global.
              </p>
              <div className="challenger-competitive-strip">
                <span><b>{competitiveDivision}</b> Division</span>
                <span><b>{competitivePoints}</b> Puntos</span>
                <span><b>{competitiveRank}</b> Ranking</span>
                <span><b>{teamCanChallenge ? 'Si' : 'No'}</b> Puede retar</span>
                <span><b>{teamIsProfessional ? 'Si' : 'No'}</b> Recibe retos</span>
              </div>
            </div>
            {teamIsProfessional && (
              <div className="challenger-header-card__action">
                <Toggle
                  label={team.challengerMode?.active ? "Suscripción activa" : "Suscripción inactiva"}
                  hint="Activa el Modo Retador para recibir desafíos y publicidad"
                  checked={Boolean(team.challengerMode?.active)}
                  onChange={handleToggleChallengerMode}
                />
              </div>
            )}
            <button className="pnl-btn challenger-info-trigger" type="button" onClick={() => navigate('/modo-retador')}>
              {Icon.fileText} Ver guía completa
            </button>
          </div>

          {/* View for non-pro or inactive pro teams */}
          {(!team.challengerMode?.active || !teamIsProfessional) && (
            <div className="challenger-inactive-grid">
              {/* Info panel */}
              <Panel title="Beneficios y Reglas del Modo Retador" icon={Icon.award}>
                <div className="rules-list">
                  <div className="rule-item">
                    <div className="rule-item__icon" style={{ color: accent }}>{Icon.trend}</div>
                    <div className="rule-item__body">
                      <h4>Prioridad y exposición</h4>
                      <p>Los equipos en Modo Retador aparecen en el tope del directorio general y en los carruseles de patrocinados.</p>
                    </div>
                  </div>
                  <div className="rule-item">
                    <div className="rule-item__icon" style={{ color: accent }}>{Icon.globe}</div>
                    <div className="rule-item__body">
                      <h4>Espacios de Publicidad</h4>
                      <p>Acceso a banners rotativos patrocinados por GlitchGang en toda la plataforma de forma mensual.</p>
                    </div>
                  </div>
                  <div className="rule-item">
                    <div className="rule-item__icon" style={{ color: accent }}>{Icon.shield}</div>
                    <div className="rule-item__body">
                      <h4>Insignia Exclusiva de Retador</h4>
                      <p>Un sello de validación competitivo visible en tu perfil público para patrocinadores y torneos.</p>
                    </div>
                  </div>
                  <div className="rule-item">
                    <div className="rule-item__icon" style={{ color: '#ff3e3e' }}>{Icon.alert}</div>
                    <div className="rule-item__body">
                      <h4>La Regla de los 7 Tickets</h4>
                      <p>Para mantener los beneficios debes aceptar y disputar un estándar mínimo de <strong>7 retos (tickets) mensuales</strong> contra equipos principiantes o semi-profesionales.</p>
                    </div>
                  </div>
                </div>

                {!teamIsProfessional && (
                  <div className="challenger-notice-box">
                    <p>
                      <strong>Nota competitiva:</strong> Tu equipo actual está registrado como <strong>{team.level || 'Amateur'}</strong>. El rol de receptor del Modo Retador está limitado a equipos de nivel <strong>Profesional</strong>. Sin embargo, puedes desafiar a escuadras profesionales a continuación para medir tu nivel.
                    </p>
                  </div>
                )}
              </Panel>

              {/* Challenger Directory / Actions for amateur/semi-pro */}
              {!teamIsProfessional ? (
                <Panel title="Desafiar Equipos Profesionales" icon={Icon.users}>
                  <div className="challenger-sub-tabs">
                    <button className={`sub-tab-btn ${activeChallengerTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveChallengerTab('dashboard')}>
                      Directorio Pro
                    </button>
                    <button className={`sub-tab-btn ${activeChallengerTab === 'mis_retos' ? 'active' : ''}`} onClick={() => setActiveChallengerTab('mis_retos')}>
                      Mis Retos Enviados ({mySentChallengerTickets.length})
                    </button>
                  </div>

                  {activeChallengerTab === 'dashboard' && (
                    <div className="pro-directory-list">
                      {!teamCanChallenge ? (
                        <div className="challenger-notice-box challenger-notice-box--locked">
                          <p><strong>Aun no puedes enviar retos.</strong><br />{competitiveReason}</p>
                        </div>
                      ) : selectedProTeam ? (
                        <form className="mtp-form" onSubmit={handleCreateChallengerTicket}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ color: accent }}>Desafiando a {selectedProTeam.name}</h4>
                            <button type="button" className="pnl-btn pnl-btn--small" onClick={() => setSelectedProTeam(null)}>Volver</button>
                          </div>
                          <Field label="Juego del Reto" value={challengerForm.game || selectedProTeam.game} onChange={val => setChallengerForm(prev => ({ ...prev, game: val }))} />
                          <label className="mtp-field">
                            <span>Formato del Reto</span>
                            <select 
                              value={challengerForm.format} 
                              onChange={e => setChallengerForm(prev => ({ ...prev, format: e.target.value }))}
                              style={{ width: '100%', height: '42px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(6,8,13,0.4)', color: '#fff', padding: '0 12px' }}
                            >
                              <option value="BO1">Best of 1 (BO1)</option>
                              <option value="BO3">Best of 3 (BO3)</option>
                              <option value="BO5">Best of 5 (BO5)</option>
                            </select>
                          </label>
                          <div className="mtp-challenge-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <Field label="Fecha" type="date" value={challengerForm.scheduledDate} onChange={val => setChallengerForm(prev => ({ ...prev, scheduledDate: val }))} />
                            <Field label="Hora (UTC)" type="time" value={challengerForm.scheduledTime} onChange={val => setChallengerForm(prev => ({ ...prev, scheduledTime: val }))} />
                          </div>
                          <Field label="Mensaje del desafío" textarea value={challengerForm.message} onChange={val => setChallengerForm(prev => ({ ...prev, message: val }))} />
                          <button className="pnl-btn pnl-btn--primary" style={{ width: '100%', marginTop: '10px' }} disabled={saving || !teamCanChallenge}>
                            {Icon.send} Enviar Propuesta de Reto
                          </button>
                        </form>
                      ) : (
                        <>
                          {challengerLoading && <p className="dim" style={{ textAlign: 'center', padding: '18px 0' }}>Cargando equipos retadores...</p>}
                          {!challengerLoading && challengerError && <p className="dim" style={{ textAlign: 'center', padding: '18px 0', color: 'var(--danger)' }}>{challengerError}</p>}
                          {!challengerLoading && !challengerError && availableProChallengerTeams.length > 0 ? (
                            <div className="pro-teams-list">
                              {availableProChallengerTeams.map(pro => (
                                <div className="pro-team-row-card" key={pro.id || pro._id}>
                                  <div className="pro-team-row-card__avatar">{initials(pro.name)}</div>
                                  <div className="pro-team-row-card__info">
                                    <h4>{pro.name} <span style={{ color: accent }}>[{pro.tag}]</span></h4>
                                    <p>{pro.game} · {pro.region}</p>
                                    <small>{pro.slogan || 'Listos para competir.'}</small>
                                    <span className="pro-team-row-card__meta">
                                      {pro.competitive?.rankLabel || 'Ranking N/A'} - {Number(pro.competitive?.points ?? pro.rankPts ?? 0).toLocaleString('es-DO')} pts - {pro.competitive?.divisionLabel || 'Pro'}
                                    </span>
                                  </div>
                                  <div className="pro-team-row-card__actions">
                                    <button className="pnl-btn pnl-btn--primary pnl-btn--small" onClick={() => { setSelectedProTeam(pro); setChallengerForm(prev => ({ ...prev, game: pro.game })) }}>
                                      Desafiar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : !challengerLoading && !challengerError ? (
                            <p className="dim" style={{ textAlign: 'center', padding: '30px 0' }}>No hay equipos profesionales con Modo Retador activo en este momento.</p>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}

                  {activeChallengerTab === 'mis_retos' && (
                    <div className="proposals-list">
                      {mySentChallengerTickets.length > 0 ? (
                        <div className="tickets-grid">
                          {mySentChallengerTickets.map(ticket => (
                            <div className={`ticket-item-card ticket-item-card--${ticket.status}`} key={ticket.id || ticket._id}>
                              <div className="ticket-item-card__header">
                                <span className="ticket-code">{ticket.publicCode || 'CHKT-TEMP'}</span>
                                <span className={`ticket-badge ticket-badge--${ticket.status}`}>
                                  {ticket.status === 'pending' && 'Pendiente'}
                                  {ticket.status === 'accepted' && 'Aceptado'}
                                  {ticket.status === 'scheduled' && 'Agendado'}
                                  {ticket.status === 'played' && 'Resultado enviado'}
                                  {ticket.status === 'rejected' && 'Rechazado'}
                                  {ticket.status === 'completed' && 'Completado'}
                                </span>
                              </div>
                              <div className="ticket-item-card__body">
                                <h5>Rival: {ticket.proTeam?.name}</h5>
                                <p><strong>Juego:</strong> {ticket.game} ({ticket.format})</p>
                                <p><strong>Fecha/Hora:</strong> {ticket.scheduledDate} {ticket.scheduledTime}</p>
                                {ticket.message && <p className="msg">"{ticket.message}"</p>}
                                
                                {isActiveTicket(ticket) && (
                                  <div className="report-box" style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                                    <p style={{ fontSize: '11px', marginBottom: '8px' }}>Reportar el resultado de la partida:</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button className="pnl-btn pnl-btn--small pnl-btn--primary" onClick={() => handleReportChallengerResult(ticket.id || ticket._id, 'challenger', '2-0', 'challenger')}>Ganamos</button>
                                      <button className="pnl-btn pnl-btn--small" onClick={() => handleReportChallengerResult(ticket.id || ticket._id, 'pro', '0-2', 'challenger')}>Perdimos</button>
                                    </div>
                                  </div>
                                )}
                                {ticket.status === 'completed' && (
                                  <div className="result-info" style={{ marginTop: '8px', color: accent }}>
                                    <span>Ganador: {ticket.result?.winner === 'challenger' ? 'Tú' : ticket.proTeam?.name} ({ticket.result?.score || '2-0'})</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="dim" style={{ textAlign: 'center', padding: '30px 0' }}>Aún no has enviado ninguna propuesta de reto.</p>
                      )}
                    </div>
                  )}
                </Panel>
              ) : (
                <Panel title="Activa el Modo Retador" icon={Icon.target}>
                  <div className="challenger-activation-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px', color: accent }}>{Icon.award}</div>
                    <h3>Tu escuadra califica para el circuito profesional</h3>
                    <p style={{ margin: '10px 0 20px', color: 'var(--text-dim)' }}>
                      Como equipo Profesional, puedes activar esta suscripción para empezar a aparecer en el tope del ranking y recibir desafíos directos de equipos amateurs.
                    </p>
                    <button className="pnl-btn pnl-btn--primary" style={{ padding: '12px 30px' }} onClick={() => handleToggleChallengerMode(true)}>
                      Activar Modo Retador ahora
                    </button>
                  </div>
                </Panel>
              )}
            </div>
          )}

          {/* Pro Challenger Dashboard view (Only for active professional teams) */}
          {team.challengerMode?.active && teamIsProfessional && (
            <div className="challenger-pro-dashboard">
              <div className="pro-metrics-grid">
                {/* Progress Circle Panel */}
                <Panel title="Progreso mensual del estándar" icon={Icon.trend}>
                  <div className="progress-wheel-container">
                    <div className="progress-wheel" style={{ '--progress-pct': `${Math.min(100, ((team.challengerMode.currentMonthTickets || 0) / 7) * 100)}%` }}>
                      <span className="progress-val">{team.challengerMode.currentMonthTickets || 0} / 7</span>
                      <span className="progress-lbl">Tickets</span>
                    </div>
                    <div className="progress-details">
                      <h4>Estándar de 7 retos</h4>
                      <p>
                        Has completado {team.challengerMode.currentMonthTickets || 0} retos este mes. Cumplir con los 7 retos mensuales mantiene tu posicionamiento destacado y banners rotativos activos.
                      </p>
                      <div className="standard-badge" style={{ color: (team.challengerMode.currentMonthTickets || 0) >= 7 ? accent : '#ff8800' }}>
                        {Icon.shield} {(team.challengerMode.currentMonthTickets || 0) >= 7 ? 'Suficiente para renovar' : 'Por debajo del estándar'}
                      </div>
                    </div>
                  </div>
                </Panel>

                {/* Metrics Stats */}
                <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gap: '15px' }}>
                  <Panel title="Racha Competitiva" icon={Icon.trophy}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0' }}>
                      <span style={{ fontSize: '32px', color: accent, fontWeight: 'bold' }}>{team.challengerMode.streak || 0}</span>
                      <div>
                        <h4>Meses seguidos cumpliendo</h4>
                        <p className="dim" style={{ fontSize: '12px' }}>Mantén la racha para desbloquear multiplicadores de patrocinio.</p>
                      </div>
                    </div>
                  </Panel>
                  <Panel title="Total Retos Disputados" icon={Icon.award}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0' }}>
                      <span style={{ fontSize: '32px', color: '#ffb800', fontWeight: 'bold' }}>{team.challengerMode.totalTicketsCompleted || 0}</span>
                      <div>
                        <h4>Histórico de partidas retadoras</h4>
                        <p className="dim" style={{ fontSize: '12px' }}>Total de retos validados frente a escuadras amateurs.</p>
                      </div>
                    </div>
                  </Panel>
                </div>

                {/* Active Benefits Panel */}
                <Panel title="Mis Beneficios de Retador" icon={Icon.share}>
                  <div className="benefits-active-list">
                    <div className="benefit-status-row">
                      <span>Posición destacada</span>
                      <strong className="status-on">{Icon.check} Activo</strong>
                    </div>
                    <div className="benefit-status-row">
                      <span>Banners Rotativos</span>
                      <strong className="status-on">{Icon.check} Activo</strong>
                    </div>
                    <div className="benefit-status-row">
                      <span>Sello de validación</span>
                      <strong className="status-on">{Icon.check} Activo</strong>
                    </div>
                    <div className="benefit-status-row">
                      <span>Publicidad G-Gang</span>
                      <strong className="status-on">{Icon.check} Habilitado (1 slot)</strong>
                    </div>
                  </div>
                </Panel>
              </div>

              {/* Sub-tabs list of challenges and history */}
              <div className="pro-dashboard-grid" style={{ marginTop: '20px' }}>
                <Panel title="Tickets de desafío recibidos" icon={Icon.mail}>
                  <div className="challenger-sub-tabs">
                    <button className={`sub-tab-btn ${activeChallengerTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveChallengerTab('dashboard')}>
                      Desafíos entrantes ({incomingChallengerTickets.filter(t => t.status === 'pending').length})
                    </button>
                    <button className={`sub-tab-btn ${activeChallengerTab === 'mis_retos' ? 'active' : ''}`} onClick={() => setActiveChallengerTab('mis_retos')}>
                      Desafíos aceptados y activos ({incomingChallengerTickets.filter(isActiveTicket).length})
                    </button>
                  </div>

                  {activeChallengerTab === 'dashboard' && (
                    <div className="incoming-challenges-list" style={{ marginTop: '15px' }}>
                      {incomingChallengerTickets.filter(t => t.status === 'pending').length > 0 ? (
                        <div className="tickets-grid">
                          {incomingChallengerTickets.filter(t => t.status === 'pending').map(ticket => (
                            <div className="ticket-item-card" key={ticket.id || ticket._id}>
                              <div className="ticket-item-card__header">
                                <span className="ticket-code">{ticket.publicCode || 'CHKT-TEMP'}</span>
                                <span className="ticket-date">{ticket.scheduledDate} {ticket.scheduledTime}</span>
                              </div>
                              <div className="ticket-item-card__body">
                                <h4>Desafiante: {ticket.challengerTeam?.name} <span style={{ color: accent }}>[{ticket.challengerTeam?.tag}]</span></h4>
                                <p><strong>Juego:</strong> {ticket.game} ({ticket.format})</p>
                                {ticket.message && <p className="msg">"{ticket.message}"</p>}
                                <div className="ticket-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                  <button className="pnl-btn pnl-btn--primary pnl-btn--small" onClick={() => handleRespondChallengerTicket(ticket.id || ticket._id, 'accept')}>
                                    {Icon.check} Aceptar Reto
                                  </button>
                                  <button className="pnl-btn pnl-btn--danger pnl-btn--small" onClick={() => handleRespondChallengerTicket(ticket.id || ticket._id, 'reject')}>
                                    {Icon.x} Rechazar
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="dim" style={{ textAlign: 'center', padding: '30px 0' }}>No tienes propuestas de reto pendientes.</p>
                      )}
                    </div>
                  )}

                  {activeChallengerTab === 'mis_retos' && (
                    <div className="active-challenges-list" style={{ marginTop: '15px' }}>
                      {incomingChallengerTickets.filter(isActiveTicket).length > 0 ? (
                        <div className="tickets-grid">
                          {incomingChallengerTickets.filter(isActiveTicket).map(ticket => (
                            <div className="ticket-item-card ticket-item-card--accepted" key={ticket.id || ticket._id}>
                              <div className="ticket-item-card__header">
                                <span className="ticket-code">{ticket.publicCode || 'CHKT-TEMP'}</span>
                                <span className="ticket-date">{ticket.scheduledDate} {ticket.scheduledTime}</span>
                              </div>
                              <div className="ticket-item-card__body">
                                <h4>Rival: {ticket.challengerTeam?.name} <span style={{ color: accent }}>[{ticket.challengerTeam?.tag}]</span></h4>
                                <p><strong>Juego:</strong> {ticket.game} ({ticket.format})</p>
                                {ticket.message && <p className="msg">"{ticket.message}"</p>}
                                
                                <div className="report-box" style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                  <p style={{ fontSize: '11px', marginBottom: '8px' }}>Reportar el resultado oficial de la partida:</p>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="pnl-btn pnl-btn--primary pnl-btn--small" onClick={() => handleReportChallengerResult(ticket.id || ticket._id, 'pro', '2-0', 'pro')}>
                                      Ganamos (2-0)
                                    </button>
                                    <button className="pnl-btn pnl-btn--danger pnl-btn--small" onClick={() => handleReportChallengerResult(ticket.id || ticket._id, 'challenger', '0-2', 'pro')}>
                                      Perdimos (0-2)
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="dim" style={{ textAlign: 'center', padding: '30px 0' }}>No tienes retos activos pendientes de jugar.</p>
                      )}
                    </div>
                  )}
                </Panel>

                <Panel title="Desactivar suscripción de Retador" icon={Icon.lock}>
                  <div style={{ padding: '15px 0' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '15px' }}>
                      Si decides desactivar tu suscripción al Modo Retador, perderás la prioridad en las listas públicas, los banners de publicidad rotativos activos de G-Gang y la insignia de verificación en tu perfil público de equipo.
                    </p>
                    <button className="pnl-btn pnl-btn--danger" style={{ width: '100%', padding: '12px' }} onClick={() => handleToggleChallengerMode(false)}>
                      Cancelar suscripción al Modo Retador
                    </button>
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, value, label, delta }) {
  return (
    <div className="pnl-kpi">
      <div className="pnl-kpi__icon">{icon}</div>
      <div className="pnl-kpi__value">{value}</div>
      <div className="pnl-kpi__label">{label}</div>
      <div className="pnl-kpi__delta">{delta}</div>
    </div>
  )
}

function Panel({ title, icon, children }) {
  return (
    <motion.article className="pnl-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="pnl-card__title">{icon} {title}</div>
      {children}
    </motion.article>
  )
}

function InfoGrid({ rows }) {
  return (
    <div className="mtp-info-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value || 'Sin definir'}</b>
        </div>
      ))}
    </div>
  )
}

function TeamActivityCard({ item, onDelete, navigate, timeline = false }) {
  const periodLabel = item.period === 'past' ? 'Pasado' : item.period === 'today' ? 'Hoy' : 'Futuro'
  const canDelete = item.source === 'manual'
  return (
    <motion.article
      className={`mtp-team-activity ${timeline ? 'mtp-team-activity--timeline' : ''}`}
      style={{ '--activity-color': item.color }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mtp-team-activity__date">
        <b>{formatTeamShortDate(item.date)}</b>
        <span>{item.time || '--:--'}</span>
      </div>
      <div className="mtp-team-activity__body">
        <div className="mtp-team-activity__top">
          <b>{item.title}</b>
          <span>{item.type}</span>
        </div>
        <small>{item.game || 'General'} · {periodLabel}</small>
        {item.description && <p>{item.description}</p>}
        <div className="mtp-team-activity__actions">
          {item.link && <button className="pnl-btn pnl-btn--small" type="button" onClick={() => navigate(item.link)}>{Icon.eye} Ver</button>}
          {canDelete && <button className="pnl-btn pnl-btn--small" type="button" onClick={() => onDelete(item.id)}>{Icon.trash} Eliminar</button>}
        </div>
      </div>
    </motion.article>
  )
}

function RosterPlayerDetail({ slot, player, team, accent, onEdit, onClose }) {
  const socials = normalizeSocials(player)
  const socialEntries = Object.entries(socials).filter(([, value]) => Boolean(value))
  const characters = normalizeCharacters(player, team.mainCharacters)
  const gameId = team.hideGameId ? 'ID oculto por privacidad' : (player.gameId || player.gamerProfile?.gameId || player.playerCode || 'No publicado')
  const email = team.hideEmails !== false ? 'Privado por configuracion del equipo' : (player.email || player.contactEmail || 'No publicado')
  const fullName = [player.firstName, player.lastName].filter(Boolean).join(' ') || player.fullName || player.name || ''
  const mainGame = player.gamerProfile?.mainGame || player.games?.[0] || team.game || 'Juego sin definir'
  const bio = player.bio || player.description || player.gamerProfile?.bio || 'Este miembro todavia no tiene una biografia publica.'

  return (
    <motion.div
      className="mtp-roster-detail"
      initial={{ opacity: 0, x: 34, scale: 0.96, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -24, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div className="mtp-roster-detail__top" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div className="mtp-roster-detail__avatar" style={{ '--roster-accent': accent }}>
          {player.avatar ? <img src={imageUrl(player.avatar)} alt={player.nick} /> : initials(player.nick || fullName)}
        </div>
        <div>
          <span>{slot.toUpperCase()}</span>
          <h3>{player.nick || fullName || 'Jugador'}</h3>
          <p>{player.role || player.gamerProfile?.mainRole || 'Rol sin definir'}</p>
        </div>
        <button className="mtp-roster-detail__close" type="button" onClick={onClose} aria-label="Cerrar ficha">
          {Icon.x}
        </button>
      </motion.div>

      <motion.div className="mtp-roster-detail__summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <p>{bio}</p>
        <div>
          <span>{Icon.gamepad} {mainGame}</span>
          <span>{Icon.award} {player.gamerProfile?.rank || player.rank || player.experienceLevel || 'Sin rango'}</span>
          <span>{Icon.clock || Icon.calendar} {player.availability || 'Sin horario'}</span>
        </div>
      </motion.div>

      <motion.dl className="mtp-roster-detail__quick" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <div><dt>ID</dt><dd>{gameId}</dd></div>
        <div><dt>Email</dt><dd>{email}</dd></div>
        {fullName && <div><dt>Nombre</dt><dd>{fullName}</dd></div>}
      </motion.dl>

      <motion.div className="mtp-roster-detail__section" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <h4>{Icon.gamepad} Personajes favoritos</h4>
        <div className="mtp-roster-detail__chips">
          {characters.length ? characters.map(character => (
            <span key={character}>{character}</span>
          )) : (
            <span>Sin personajes publicados</span>
          )}
        </div>
      </motion.div>

      <motion.div className="mtp-roster-detail__section" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <h4>{Icon.share} Redes sociales</h4>
        {socialEntries.length ? (
          <div className="mtp-roster-detail__socials">
            {socialEntries.map(([key, value]) => (
              <a href={socialHref(key, value)} target="_blank" rel="noreferrer" key={key}>
                {Icon[key] || Icon.globe || Icon.share}
                <span>{key}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="dim">Este jugador no tiene redes publicadas.</p>
        )}
      </motion.div>

      <motion.div className="mtp-roster-detail__actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
        <button className="pnl-btn pnl-btn--primary" type="button" onClick={onEdit}>{Icon.edit} Editar slot</button>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, value, onChange, type = 'text', textarea = false, required = false, icon = null, disabled = false, hint = null, options = null, placeholder = '' }) {
  return (
    <label className={`mtp-field ${textarea ? 'mtp-field--wide' : ''}`}>
      <span className="mtp-field__label">{icon && <i className="mtp-field__ic">{icon}</i>}{label}</span>
      <div className="mtp-control">
        {options ? (
          <select value={value || ''} onChange={event => onChange(event.target.value)} required={required} disabled={disabled}>
            <option value="" disabled={required}>{placeholder || 'Selecciona...'}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : textarea ? (
          <textarea rows={5} value={value || ''} onChange={event => onChange(event.target.value)} required={required} disabled={disabled} placeholder={placeholder} />
        ) : (
          <input type={type} value={value || ''} onChange={event => onChange(event.target.value)} required={required} disabled={disabled} placeholder={placeholder} />
        )}
      </div>
      {hint && <small className="mtp-field__hint">{hint}</small>}
    </label>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="mtp-toggle">
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <i />
    </label>
  )
}

function imageUrl(value) {
  if (!value) return ''
  const uploadUrl = normalizeUploadUrl(value)
  if (uploadUrl) return uploadUrl
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) return value
  return `/${value}`
}

function normalizeUploadUrl(value) {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('/uploads/')) return value
  try {
    const url = new URL(value)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return ''
}

