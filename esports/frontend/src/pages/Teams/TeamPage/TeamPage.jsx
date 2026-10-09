import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import ShareModal from '../../../components/ShareModal/ShareModal.jsx'
import LeaveTeamModal from '../../../components/LeaveTeamModal/LeaveTeamModal.jsx'
import JoinTeamModal from '../../../components/JoinTeamModal/JoinTeamModal.jsx'
import { presenceInfo } from '../../../lib/presence.js'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useTheme } from '../../../theme/ThemeContext.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { teamRequestTeamId, teamRequestUserId } from '../../../lib/teamJoinRequests.js'
import { GAME_BY_ID, GAMES, normalizeGameId } from '../../../data/games.js'
import { WHATSAPP_ENABLED } from '../../../config/featureFlags.js'
import './TeamPage.css'
import { teamColor } from '../../../lib/teamColor.js'
import { flagUrl, countryName, teamGenderKey, teamGenderLabel, joinScopeLabel, isRealCountry } from '../../../lib/teamEligibility.js'
import { PLACEMENT_LABEL, titlesForTeam, useTitlesIndex } from '../../../lib/teamTitles.js'
import TeamTitleShowcase from '../../../components/TeamTitles/TeamTitleShowcase.jsx'

const GAME_LOOKUP = GAMES.reduce((acc, game) => {
  acc[game.id] = game
  acc[game.slug] = game
  acc[game.name] = game
  acc[game.name.toLowerCase()] = game
  return acc
}, {})

const GAME_ALIASES = {
  mlbb: 'mobile-legends-bang-bang',
  'mobile legends': 'mobile-legends-bang-bang',
  'mobile legends bang bang': 'mobile-legends-bang-bang',
  lol: 'league-of-legends-wild-rift',
  'league of legends': 'league-of-legends-wild-rift',
  wildrift: 'league-of-legends-wild-rift',
  'wild rift': 'league-of-legends-wild-rift',
  ff: 'free-fire',
  freefire: 'free-fire',
  'free fire': 'free-fire',
  cod: 'call-of-duty-warzone-mobile',
  warzone: 'call-of-duty-warzone-mobile',
  rocket: 'rocket-league-sideswipe',
  'rocket league': 'rocket-league-sideswipe',
  cs2: 'counter-strike-2',
  csgo: 'counter-strike-2',
  counterstrike: 'counter-strike-2',
  'counter strike': 'counter-strike-2',
  'counter strike 2': 'counter-strike-2',
}

const revealSection = {
  hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
}

const revealList = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
}

const revealItem = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.34, ease: 'easeOut' } },
}

function normalizeGameText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function resolveGame(value) {
  const raw = String(value || '').trim()
  if (!raw) return GAME_BY_ID.valorant
  const normalizedText = normalizeGameText(raw)
  const aliasId = GAME_ALIASES[normalizedText]
  if (aliasId && GAME_BY_ID[aliasId]) return GAME_BY_ID[aliasId]

  const direct = GAME_LOOKUP[raw] || GAME_LOOKUP[raw.toLowerCase()] || GAME_BY_ID[normalizeGameId(raw, '')]
  if (direct) return direct

  const fuzzy = GAMES.find(game => {
    const gameText = normalizeGameText(game.name)
    return gameText.includes(normalizedText) || normalizedText.includes(gameText)
  })
  return fuzzy || GAME_BY_ID.valorant
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : null
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

function initials(value, fallback = 'GG') {
  return String(value || fallback).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || fallback
}

function formatDate(value) {
  if (!value) return 'Por anunciar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function compactPrize(tournament) {
  if (!tournament?.prizePool) return 'Premio pendiente'
  return `${tournament.currency || '$'}${tournament.prizePool}`
}

function externalUrl(value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  return `https://${clean.replace(/^@/, '')}`
}

function socialUrl(key, value) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  if (key === 'instagram') return `https://instagram.com/${clean.replace(/^@/, '')}`
  if (key === 'twitter' || key === 'x') return `https://twitter.com/${clean.replace(/^@/, '')}`
  if (key === 'discord') return clean.includes('discord.') ? `https://${clean}` : `https://discord.gg/${clean.replace(/^@/, '')}`
  if (key === 'tiktok') return `https://tiktok.com/@${clean.replace(/^@/, '')}`
  if (key === 'youtube') return `https://youtube.com/${clean.replace(/^@/, '')}`
  if (key === 'linkedin') return `https://linkedin.com/company/${clean.replace(/^@/, '')}`
  return externalUrl(clean)
}

function normalizeSponsor(sponsor = {}) {
  return {
    ...sponsor,
    name: sponsor.name || sponsor.brand || sponsor.title || '',
    tier: sponsor.tier || sponsor.type || sponsor.level || 'Sponsor',
    website: sponsor.website || sponsor.url || '',
    logo: sponsor.logo || sponsor.image || '',
    since: sponsor.since || sponsor.startedAt || sponsor.joinedAt || '',
    location: sponsor.location || sponsor.country || sponsor.region || '',
    description: sponsor.description || sponsor.bio || sponsor.note || '',
    contact: sponsor.contact || sponsor.email || '',
    socials: sponsor.socials || sponsor.social || {},
  }
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase()
}

function isTeamValue(value, team) {
  const target = normalizeKey(value)
  if (!target) return false
  return [
    team?._id,
    team?.id,
    team?.publicCode,
    team?.internalCode,
    team?.name,
    team?.tag,
  ].some(item => normalizeKey(item) === target)
}

function tournamentTeamResult(tournament, team) {
  const participant = (tournament.participants || []).find(item =>
    isTeamValue(item.id, team) || isTeamValue(item.name, team) || isTeamValue(item.tag, team)
  )
  const registration = (tournament.registrations || []).find(item => {
    const registeredTeam = item.team || item
    return isTeamValue(registeredTeam?._id || registeredTeam?.id, team) ||
      isTeamValue(registeredTeam?.publicCode, team) ||
      isTeamValue(registeredTeam?.name, team) ||
      isTeamValue(registeredTeam?.tag, team)
  })
  const champion = isTeamValue(tournament.winner, team)
  const placement = participant?.placement || (champion ? '1' : '')
  const prize = (tournament.prizes || []).find(item => String(item.place || '').trim() === String(placement || '').trim())
  const bracketPublished = Boolean(tournament.bracketState?.published ?? tournament.bracket?.length)
  const winsAgainst = []
  const rows = [
    ...Object.values(tournament.bracketResults || {}),
    ...(Array.isArray(tournament.bracket) ? tournament.bracket : []),
  ]

  rows.forEach(row => {
    if (!row || typeof row !== 'object') return
    const winner = row.winner || row.winnerName || row.winningTeam || row.result?.winner
    if (!isTeamValue(winner, team)) return
    const options = [
      row.loser,
      row.loserName,
      row.opponent,
      row.opponentName,
      row.teamA,
      row.teamB,
      row.a,
      row.b,
    ].filter(Boolean)
    const rival = options.find(option => !isTeamValue(option?.name || option?.tag || option?.id || option, team))
    if (rival) winsAgainst.push(typeof rival === 'object' ? (rival.name || rival.tag || rival.id) : rival)
  })

  return {
    registrationStatus: registration?.status || '',
    placement,
    champion,
    prize,
    bracketPublished,
    winsAgainst: Array.from(new Set(winsAgainst)).slice(0, 3),
  }
}

function playerCharacters(player, fallback = []) {
  const values = player?.mainCharacters || player?.characters || player?.agents || player?.heroes || player?.gamerProfile?.mainCharacters
  if (Array.isArray(values) && values.length) return values.filter(Boolean)
  if (typeof values === 'string' && values.trim()) return values.split(',').map(item => item.trim()).filter(Boolean)
  return fallback
}

function playerProfilePath(player) {
  const key = player?.nick || player?.playerCode || player?.id
  return key ? `/perfil?user=${encodeURIComponent(key)}` : '/perfil'
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || ''
}

// El nick va primero: el roster guarda tambien el nombre real (fullName) del
// slot y antes salia ese en la pagina publica del equipo en vez del username.
// El nombre real solo queda de respaldo para slots sin cuenta (sin nick).
function playerName(player) {
  return firstValue(player?.nick, player?.username, player?.displayName, player?.name, player?.fullName, 'Jugador')
}

function playerGameId(player) {
  return firstValue(player?.gameId, player?.gameTag, player?.riotId, player?.ign, player?.gamerProfile?.gameId, player?.playerCode, 'No publicado')
}

function playerLane(player) {
  return firstValue(player?.favoriteLane, player?.lane, player?.position, player?.mainRole, player?.gamerProfile?.favoriteLane, player?.gamerProfile?.mainRole, player?.role, 'No publicada')
}

function playerContact(player) {
  return firstValue(player?.email, player?.contactEmail, player?.discord, player?.contact, player?.gamerProfile?.contact, 'Privado')
}

function playerBio(player) {
  return firstValue(player?.bio, player?.about, player?.gamerProfile?.bio, player?.description, 'Este jugador todavia no ha publicado una biografia competitiva.')
}

function stripUrls(value) {
  return String(value || '').replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim()
}

function clampText(value, limit = 180) {
  const clean = stripUrls(value)
  if (clean.length <= limit) return clean
  return `${clean.slice(0, limit).trim()}...`
}

function playerAvailability(player) {
  return firstValue(player?.availability, player?.schedule, player?.gamerProfile?.availability, 'No publicada')
}

function slotLabel(slot = '') {
  if (slot.startsWith('titular')) return 'Titular'
  if (slot.startsWith('sub')) return 'Suplente'
  if (slot.startsWith('coach')) return 'Coach'
  if (slot.startsWith('manager')) return 'Manager'
  if (slot.startsWith('analyst') || slot.startsWith('analista')) return 'Analista'
  if (slot.startsWith('patrocinador') || slot.startsWith('sponsor')) return 'Patrocinador'
  return slot || 'Roster'
}

function normalizedSlotKey(slot = '') {
  return String(slot || '').trim().toLowerCase()
}

function isPlayerSlot(slot = '') {
  const key = normalizedSlotKey(slot)
  return key.startsWith('titular') || key.startsWith('sub') || key.startsWith('jugador') || key.startsWith('player')
}

function isStaffSlot(slot = '') {
  const key = normalizedSlotKey(slot)
  return key.startsWith('coach') || key.startsWith('manager') || key.startsWith('analyst') || key.startsWith('analista')
}

function isSponsorSlot(slot = '') {
  const key = normalizedSlotKey(slot)
  return key.startsWith('patrocinador') || key.startsWith('sponsor')
}

function isPlayerRosterItem(player = {}) {
  const role = normalizedSlotKey(player.slot || player.slotLabel || player.role || player.title || '')
  if (!role) return true
  if (isStaffSlot(role) || isSponsorSlot(role)) return false
  return true
}

function rosterFromSlots(team) {
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : null
  if (!slots) return []
  // Presencia real de cada cuenta miembro (team.roster ya la trae resuelta).
  const memberById = new Map((Array.isArray(team?.roster) ? team.roster : []).map(member => [String(member.id || member._id || ''), member]))
  return Object.entries(slots)
    .filter(([slot, player]) => isPlayerSlot(slot) && player && typeof player === 'object')
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([slot, player]) => {
      const social = player.social || player.socials || {
        twitter: player.twitter || '',
        instagram: player.instagram || '',
        discord: player.discord || player.discordName || '',
        twitch: player.twitch || '',
        youtube: player.youtube || '',
        whatsapp: player.whatsapp || '',
      }
      const member = player.userId ? memberById.get(String(player.userId)) : null
      return {
        ...player,
        id: player.id || player.playerCode || player.gameId || slot,
        slot,
        // Solo cuentas miembro tienen presencia (una ficha sin cuenta no).
        presence: member ? presenceInfo(member) : null,
        slotLabel: slotLabel(slot),
        role: player.role || slotLabel(slot),
        avatar: player.avatar || player.photo || '',
        discord: player.discord || player.discordName || '',
        playerCode: player.playerCode || player.id || player.publicCode || '',
        gameId: team?.hideGameId ? '' : (player.gameId || player.playerCode || ''),
        email: team?.hideEmails !== false ? '' : (player.email || player.contactEmail || ''),
        social,
        socials: social,
        mainCharacters: player.mainCharacters || player.characters || player.gamerProfile?.mainCharacters || [],
        bio: player.bio || player.description || player.gamerProfile?.bio || '',
        availability: player.availability || player.schedule || player.gamerProfile?.availability || '',
      }
    })
}

function readLocalTeamPageTeam(teamId) {
  return null
}

function normalizePeople(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value && typeof value === 'object') return [value]
  return []
}

function normalizeStaffPeople(teamValue = {}) {
  const team = teamValue || {}
  const rawStaff = team.staff && typeof team.staff === 'object' && !Array.isArray(team.staff) ? team.staff : {}
  const slotStaff = team.rosterSlots && typeof team.rosterSlots === 'object'
    ? Object.entries(team.rosterSlots)
      .filter(([slot, person]) => isStaffSlot(slot) && person && typeof person === 'object')
      .map(([slot, person]) => ({ ...person, slot, role: person.role || slotLabel(slot) }))
    : []
  const people = [
    ...normalizePeople(team.coach),
    ...normalizePeople(team.coaches),
    ...normalizePeople(team.manager),
    ...normalizePeople(team.staff).filter(person => Array.isArray(team.staff) || person?.name || person?.nick || person?.role),
    ...slotStaff,
  ]

  if (rawStaff.coach || rawStaff.coachId) {
    people.push({ name: rawStaff.coach || rawStaff.coachId, role: 'Coach', code: rawStaff.coachId, bio: rawStaff.coachBio || '', avatar: rawStaff.coachAvatar || '' })
  }
  if (rawStaff.manager || rawStaff.managerId) {
    people.push({ name: rawStaff.manager || rawStaff.managerId, role: 'Manager', code: rawStaff.managerId, bio: rawStaff.managerBio || '', avatar: rawStaff.managerAvatar || '' })
  }
  if (rawStaff.analyst || rawStaff.analystId) {
    people.push({ name: rawStaff.analyst || rawStaff.analystId, role: 'Analista', code: rawStaff.analystId, bio: rawStaff.analystBio || '', avatar: rawStaff.analystAvatar || '' })
  }

  return people
    .filter(person => person?.name || person?.nick || person?.role)
    .map((person, index) => ({
      ...person,
      id: person.id || person._id || person.code || `${person.role || 'staff'}-${index}`,
      name: person.name || person.nick || person.username || person.role || 'Staff',
      role: person.role || person.title || 'Staff competitivo',
      avatar: person.avatar || person.logo || person.image || '',
      bio: person.bio || person.description || person.about || 'Este miembro del staff todavia no publico una biografia.',
      contact: person.contact || person.email || person.discord || '',
      socials: person.socials || person.social || {},
    }))
}

function sponsorsFromSlots(teamValue = {}) {
  const team = teamValue || {}
  if (!team.rosterSlots || typeof team.rosterSlots !== 'object') return []
  return Object.entries(team.rosterSlots)
    .filter(([slot, sponsor]) => isSponsorSlot(slot) && sponsor && typeof sponsor === 'object')
    .map(([slot, sponsor], index) => normalizeSponsor({
      ...sponsor,
      name: sponsor.name || sponsor.nick || sponsor.brand || sponsor.company || `Patrocinador ${index + 1}`,
      tier: sponsor.tier || sponsor.role || slotLabel(slot),
      logo: sponsor.logo || sponsor.avatar || sponsor.image || '',
      website: sponsor.website || sponsor.web || sponsor.url || '',
      description: sponsor.description || sponsor.bio || sponsor.note || '',
      contact: sponsor.contact || sponsor.email || sponsor.gameId || '',
      socials: sponsor.socials || sponsor.social || {},
    }))
}

function partnerName(item = {}) {
  return item.name || item.nick || item.brand || item.role || 'Perfil'
}

function partnerAvatar(item = {}) {
  return item.logo || item.avatar || item.image || ''
}

function partnerBio(item = {}, type = 'sponsor') {
  return item.description || item.bio || item.about || (type === 'sponsor'
    ? 'Esta marca todavia no publico una descripcion completa de su alianza.'
    : 'Este miembro del staff todavia no publico una biografia completa.')
}

function partnerFacts(item = {}, type = 'sponsor', team = {}) {
  if (type === 'sponsor') {
    return [
      ['Nivel', item.tier || 'Sponsor'],
      ['Desde', item.since || 'No publicado'],
      ['Ubicacion', item.location || 'No publicada'],
      ['Contacto', item.contact || 'No publicado'],
      ['Equipo', team?.name || 'GlitchGang'],
    ]
  }

  return [
    ['Rol', item.role || 'Staff competitivo'],
    ['Codigo', item.code || item.id || 'No publicado'],
    ['Contacto', item.contact || 'No publicado'],
    ['Disponibilidad', item.availability || item.schedule || 'No publicada'],
    ['Equipo', team?.name || 'GlitchGang'],
    ['Juego', team?.game || 'No publicado'],
  ]
}

export default function TeamPage() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const theme = useTheme()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeRosterIndex, setActiveRosterIndex] = useState(0)
  const [expandedPlayerIndex, setExpandedPlayerIndex] = useState(null)
  const [expandedPartner, setExpandedPartner] = useState(null)
  const [requestSent, setRequestSent] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [myTeamIds, setMyTeamIds] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setRequestSent(false)

    api(`/teams/${teamId}`)
      .then(data => {
        if (!cancelled) {
          setTeam(data)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || 'No se pudo cargar el equipo.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [teamId, reloadKey])

  useEffect(() => {
    if (!user) { setMyTeamIds([]); return }
    let alive = true
    api('/teams/mine')
      .then(data => {
        if (!alive) return
        setMyTeamIds((Array.isArray(data?.teams) ? data.teams : []).map(t => String(t._id || t.id || '')).filter(Boolean))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user, reloadKey])

  const game = useMemo(() => resolveGame(team?.game), [team?.game])
  // Solo recalcula desde los torneos si el servidor no mando team.titles.
  const titlesIdx = useTitlesIndex(Boolean(team) && !Array.isArray(team.titles))
  const teamTitles = useMemo(() => titlesForTeam(team, titlesIdx), [team, titlesIdx])
  const titleByTournament = useMemo(() => new Map(teamTitles.map(title => [title.tournamentId, title])), [teamTitles])
  const roster = useMemo(() => {
    const slotRoster = rosterFromSlots(team)
    return slotRoster.length ? slotRoster : (Array.isArray(team?.roster) ? team.roster.filter(isPlayerRosterItem) : [])
  }, [team])
  const tournaments = Array.isArray(team?.tournaments) ? team.tournaments : []
  const sponsors = [
    ...(Array.isArray(team?.sponsors) ? team.sponsors.map(normalizeSponsor) : []),
    ...sponsorsFromSlots(team),
  ].filter(sponsor => sponsor?.name)
  const staff = normalizeStaffPeople(team)
  const teamCharacters = Array.isArray(team?.mainCharacters)
    ? team.mainCharacters.filter(Boolean)
    : []
  const teamPublicBio = clampText(team?.description || team?.slogan || 'Equipo competitivo de GlitchGang con roster activo, identidad publica y pagina preparada para torneos, marcas y reclutamiento.', 165)
  const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
  const userId = teamRequestUserId(user)
  const isLeader = Boolean(leaderId && userId && leaderId === userId)
  const memberIds = [
    leaderId,
    ...(Array.isArray(team?.members) ? team.members : []),
    ...(Array.isArray(team?.roster) ? team.roster : []),
  ].map(member => String(member?._id || member?.id || member?.userId || member?.user || member || '')).filter(Boolean)
  // Si el equipo oculta su roster, el servidor no manda `members` y el
  // jugador no se veia como miembro: tambien se mira /teams/mine.
  const isMember = userId !== 'guest' && (
    memberIds.some(memberId => memberId === userId) ||
    [team?._id, team?.id].filter(Boolean).some(id => myTeamIds.includes(String(id)))
  )
  const canRequestJoin = !isLeader && !isMember && team?.acceptRequests !== false
  const canSeePrivateTeamData = isLeader || isMember
  const visibleRoster = team?.showRoster === false && !canSeePrivateTeamData ? [] : roster
  const visibleSponsors = team?.showSponsors === false && !canSeePrivateTeamData ? [] : sponsors
  const visibleStaff = team?.showStaff === false && !canSeePrivateTeamData ? [] : staff
  const visibleTournaments = team?.showTournaments === false && !canSeePrivateTeamData ? [] : tournaments
  // Si el equipo oculta su historial, tampoco se muestran sus titulos.
  const visibleTitles = team?.showTournaments === false && !canSeePrivateTeamData ? [] : teamTitles
  const visibleSocials = team?.showSocials === false && !canSeePrivateTeamData ? {} : (team?.socials || {})
  const visibleContactEmail = team?.showContactEmail === true || canSeePrivateTeamData ? team?.contactEmail : ''
  const showCompetitiveSummary = team?.showCompetitiveSummary !== false || canSeePrivateTeamData
  const color = teamColor(team?.color)
  const colorRgb = hexToRgb(team?.color) || 'var(--accent-rgb)'
  const themeMode = theme?.mode || 'dark'
  const banner = imageUrl(team?.banner || game?.images?.horizontal || game?.image)
  const logo = imageUrl(team?.logo || game?.images?.logo)
  const wins = Number(team?.wins || 0)
  const losses = Number(team?.losses || 0)
  const winRate = wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0
  const competitive = team?.competitive || {}
  const parsedTeamPoints = Number(competitive.points ?? team?.rankPts ?? 0)
  const teamPoints = Number.isFinite(parsedTeamPoints) ? parsedTeamPoints : 0
  const rankingPosition = competitive.rankLabel || (competitive.rank ? `#${competitive.rank}` : 'N/A')
  const divisionLabel = competitive.divisionLabel || team?.level || 'Amateur'
  const activePlayer = visibleRoster[activeRosterIndex] || visibleRoster[0] || null
  // El lider del equipo dentro del roster (por cuenta, o por codigo de jugador
  // en puestos viejos sin userId). Antes la pagina publica no lo marcaba.
  const leaderCode = String(team?.leader?.playerCode || '')
  const isTeamLeader = player => Boolean(player) && (
    (leaderId && String(player.userId || '') === leaderId)
    || (leaderCode && String(player.playerCode || '') === leaderCode)
  )
  const expandedPlayer = expandedPlayerIndex !== null ? visibleRoster[expandedPlayerIndex] : null
  const activePlayerCharacters = playerCharacters(activePlayer, teamCharacters)
  const rosterRail = visibleRoster.slice(0, 7)
  const activeNumber = String(activeRosterIndex + 1).padStart(2, '0')
  const publicTeamKey = team?.publicCode || team?._id || team?.id || teamId
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/equipos/${encodeURIComponent(publicTeamKey)}`
    : `/equipos/${publicTeamKey}`
  const shareContacts = useMemo(() => visibleRoster
    .filter(player => player?.nick || playerName(player))
    .slice(0, 10)
    .map(player => ({
      id: player.id || player.playerCode || player.nick,
      name: playerName(player),
      avatar: imageUrl(player.avatar),
      subtitle: player.role || player.position || 'Roster',
    })), [visibleRoster])
  const shareTeams = useMemo(() => [{
    id: publicTeamKey,
    name: team?.name || 'Mi equipo',
    subtitle: game?.name || team?.game || 'Equipo',
    avatar: logo,
    logo,
    cover: banner,
  }], [game?.name, logo, publicTeamKey, team?.game, team?.name])
  const shareSummary = `${team?.name || 'Equipo'} compite en ${game?.name || team?.game || 'GlitchGang'}${team?.region ? ` desde ${team.region}` : ''}.`

  useEffect(() => {
    if (activeRosterIndex > 0 && activeRosterIndex >= visibleRoster.length) {
      setActiveRosterIndex(0)
    }
  }, [activeRosterIndex, visibleRoster.length])

  // /equipos/:id#historial (p. ej. desde el poster de campeon de un torneo):
  // baja directo a la seccion de torneos una vez que el equipo cargo.
  const { hash } = useLocation()
  useEffect(() => {
    if (loading || hash !== '#historial') return
    requestAnimationFrame(() => document.getElementById('historial')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [loading, hash])

  const openPlayerPanel = (index) => {
    setActiveRosterIndex(index)
    setExpandedPlayerIndex(index)
  }

  function shouldShowSocials(player) {
    const social = player?.social || player?.socials
    if (!player || !social) return false
    const hasSocial = Object.values(social).some(Boolean)
    if (!hasSocial) return false
    const visibility = player.privacy?.socialVisibility || 'public'
    if (visibility === 'nobody') return false
    if (visibility === 'public') return true
    return isLeader || isMember
  }

  // Un jugador (no lider) sale del equipo desde su pagina publica. El lider
  // no: tiene que delegar o disolver desde Mi equipo -> Privacidad.
  function handleLeftTeam() {
    setLeaveOpen(false)
    setMyTeamIds(ids => ids.filter(id => id !== String(team?._id || '')))
    refreshUser?.()
    setReloadKey(key => key + 1)
  }

  // Abre la solicitud con eleccion de rol (jugador o staff); JoinTeamModal
  // hace el envio y trata el 409 (ya pendiente) como enviado.
  function handleRequestToJoin() {
    if (!team || joinOpen) return
    if (isLeader || isMember) {
      toast('Ya perteneces a este equipo.')
      return
    }
    if (team.acceptRequests === false) {
      toast('Este equipo no esta aceptando solicitudes ahora.')
      return
    }
    setJoinOpen(true)
  }

  if (loading) {
    return (
      <main className="team-profile-page team-profile-page--state">
        <GGLoader label="Sincronizando equipo" size="lg" />
      </main>
    )
  }

  if (error || !team) {
    return (
      <main className="team-profile-page team-profile-page--state">
        <h1>No encontramos este equipo</h1>
        <p>{error || 'La pagina del equipo no esta disponible.'}</p>
        <button className="tp-action" onClick={() => navigate('/equipos')}>{Icon.chevronRight} Volver a equipos</button>
      </main>
    )
  }

  return (
    <main className="team-profile-page" data-theme-mode={themeMode} style={{ '--team-color': color, '--team-color-rgb': colorRgb, '--team-banner': `url(${banner})` }}>
      <section className="team-rank-hero">
        <div className="team-rank-hero__media" />
        <div className="team-rank-hero__grid" />

        <button className="team-rank-hero__back" onClick={() => navigate('/equipos')}>
          {Icon.chevronRight} Equipos
        </button>

        <div className="team-rank-hero__brandmark">
          <span>TEAM</span>
          <b>PROFILE</b>
        </div>

        <motion.div
          className="team-rank-hero__copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="team-rank-hero__eyebrow">
            <span>{team.publicCode || 'TEAM-ID'}</span>
            <span>{game?.name || team.game || 'Juego competitivo'}</span>
          </div>

          <div className="team-rank-hero__identity">
            <div className="team-rank-hero__logo">
              {logo ? <img src={logo} alt={team.name} /> : <span>{initials(team.tag || team.name)}</span>}
            </div>
            <div>
              <span className="team-rank-hero__tag">{team.tag || initials(team.name)}</span>
              <h1>{team.name}</h1>
            </div>
          </div>

          <p className="team-rank-hero__bio">
            {teamPublicBio}
          </p>

          <div className="team-rank-hero__chips">
            {isRealCountry(team.country) && (
              <span className="tp-chip-flag"><img src={flagUrl(team.country)} alt="" />{countryName(team.country)}</span>
            )}
            <span>{Icon.globe} {team.region || 'Global'}</span>
            <span className={`tp-chip-gender tp-chip-gender--${teamGenderKey(team.gender)}`}>
              {teamGenderKey(team.gender) === 'female' ? '♀' : teamGenderKey(team.gender) === 'male' ? '♂' : '⚥'} {teamGenderLabel(team.gender)}
            </span>
            <span>{Icon.shield} {divisionLabel}</span>
            <span>{Icon.users} {visibleRoster.length || 0} jugadores</span>
          </div>

          <div className="team-rank-hero__actions">
            <button className="tp-action tp-action--share" type="button" onClick={() => setShareOpen(true)}>
              {Icon.share} Compartir
            </button>
            {isMember && !isLeader && (
              <button className="tp-action tp-action--leave" type="button" onClick={() => setLeaveOpen(true)}>
                {Icon.logout} Salir del equipo
              </button>
            )}
            {isLeader && (
              <button className="tp-action tp-action--hot" onClick={() => navigate('/mi-equipo')}>
                {Icon.team} Mi equipo
              </button>
            )}
            {!isLeader && !isMember && (
              <button
                className="tp-action tp-action--hot"
                onClick={handleRequestToJoin}
                disabled={requestSent || !canRequestJoin}
              >
                {Icon.send || Icon.plus} {requestSent
                  ? 'Solicitud enviada'
                  : (team.acceptRequests === false ? 'No recluta' : 'Solicitar unirme')}
              </button>
            )}
            {visibleContactEmail && (
              <a className="tp-action" href={"mailto:demo@steliant.example"}>
                {Icon.chat} Contactar
              </a>
            )}
          </div>
        </motion.div>

        <motion.div
          className="team-rank-hero__showcase"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, delay: 0.08 }}
        >
          <div className="team-rank-card">
            <div className="team-rank-card__number">{activeNumber}</div>
            <button
              type="button"
              className="team-rank-card__photo"
              onClick={() => openPlayerPanel(activeRosterIndex)}
              aria-label={`Ver datos de ${activePlayer?.nick || team.name}`}
            >
              {activePlayer?.avatar
                ? <img src={imageUrl(activePlayer.avatar)} alt={activePlayer.nick} />
                : <span>{initials(activePlayer?.nick || team.name)}</span>}
            </button>
            <div className="team-rank-card__footer">
              <div>
                <b>
                  {activePlayer?.nick || team.leader?.nick || team.name}
                  {isTeamLeader(activePlayer) && <em className="tp-leader-badge" title="Líder del equipo">{Icon.crown} Líder</em>}
                </b>
                <span>{activePlayer?.role || 'Lider / Captain'}</span>
              </div>
              <button
                type="button"
                onClick={() => openPlayerPanel(activeRosterIndex)}
              >
                Ver datos
              </button>
            </div>
          </div>

          <div className="team-rank-side">
            {rosterRail.map((player, index) => (
              <button
                type="button"
                className={`team-rank-side__player ${index === activeRosterIndex ? 'active' : ''}`}
                key={player.id || player.nick}
                onClick={() => setActiveRosterIndex(index)}
                onDoubleClick={() => openPlayerPanel(index)}
                title="Click para destacar. Doble click para ver datos."
              >
                {player.avatar ? <img src={imageUrl(player.avatar)} alt={player.nick} /> : <span>{initials(player.nick)}</span>}
                <div>
                  <em>{String(index + 1).padStart(2, '0')}{isTeamLeader(player) && <span className="tp-leader-mark" title="Líder del equipo">{Icon.crown} Líder</span>}</em>
                  <b>{player.nick}</b>
                  <small>{player.role || 'Jugador'}</small>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {showCompetitiveSummary && (
          <motion.div
            className="team-rank-hero__stats"
            variants={revealList}
            initial="hidden"
            animate="show"
          >
            <motion.span variants={revealItem}><b>{wins}</b> Victorias</motion.span>
            <motion.span variants={revealItem}><b>{losses}</b> Derrotas</motion.span>
            <motion.span variants={revealItem}><b>{winRate}%</b> Win rate</motion.span>
            <motion.span variants={revealItem}><b>{teamPoints.toLocaleString('es-DO')}</b> Puntos</motion.span>
            <motion.span variants={revealItem}><b>{rankingPosition}</b> Ranking</motion.span>
          </motion.div>
        )}
      </section>

      {visibleTitles.length > 0 && (
        <div className="team-titles-band">
          <TeamTitleShowcase titles={visibleTitles} />
        </div>
      )}

      <motion.section
        className="team-player-gallery"
        aria-label="Roster visual"
        variants={revealSection}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.22 }}
      >
        <div className="team-player-gallery__head">
          <div>
            <p>{team.publicCode || 'TEAM-ID'}</p>
            <h2>{team.name} roster</h2>
          </div>
          <div className="team-player-gallery__actions">
            <span>{visibleRoster.length || 0} jugadores publicados</span>
          </div>
        </div>

        <motion.div className="team-player-gallery__rail" variants={revealList} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {visibleRoster.length ? visibleRoster.map((player, index) => (
            <motion.article
              className={`team-player-poster ${index === activeRosterIndex ? 'active' : ''}`}
              key={player.id || player.nick || index}
              variants={revealItem}
              whileHover={{ y: -8, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <button
                type="button"
                className="team-player-poster__media"
                onClick={() => openPlayerPanel(index)}
                aria-label={`Abrir ficha de ${playerName(player)}`}
              >
                {player.avatar ? <img src={imageUrl(player.avatar)} alt={playerName(player)} /> : <span>{initials(player.nick || playerName(player))}</span>}
              </button>
              <div className="team-player-poster__body">
                <span>{String(index + 1).padStart(2, '0')} · {player.role || 'Jugador'}</span>
                <h3>{playerName(player)}</h3>
                <p>{playerGameId(player)}</p>
                <div>
                  <small>{playerLane(player)}</small>
                  <small>{playerAvailability(player)}</small>
                </div>
              </div>
            </motion.article>
          )) : (
            <p className="tp-empty">{team.showRoster === false && !canSeePrivateTeamData ? 'Roster privado por configuración del equipo.' : 'No hay jugadores publicados todavía.'}</p>
          )}
        </motion.div>
      </motion.section>

      <motion.section
        className="team-partner-band"
        variants={revealSection}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.22 }}
      >
        <div className="team-partner-band__block">
          <div className="team-partner-band__title">
            <p>Soporte competitivo</p>
            <h2>Patrocinadores</h2>
          </div>
          <motion.div className="team-partner-grid" variants={revealList} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.24 }}>
            {visibleSponsors.length ? visibleSponsors.map(sponsor => (
              <motion.article
                key={`${sponsor.name}-${sponsor.tier}`}
                className="team-partner-card"
                variants={revealItem}
                whileHover={{ y: -5, scale: 1.015 }}
                onClick={() => setExpandedPartner({ type: 'sponsor', data: sponsor })}
              >
                <span>{sponsor.logo ? <img src={imageUrl(sponsor.logo)} alt="" /> : initials(sponsor.name, 'SP')}</span>
                <div>
                  <b>{sponsor.name}</b>
                  <small>{sponsor.tier || 'Sponsor'}{sponsor.since ? ` desde ${sponsor.since}` : ''}</small>
                  {sponsor.description && <p>{sponsor.description}</p>}
                  <div className="team-partner-card__meta">
                    {sponsor.location && <em>{Icon.globe} {sponsor.location}</em>}
                    {sponsor.website && <a href={externalUrl(sponsor.website)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Web</a>}
                    {Object.entries(sponsor.socials || {}).filter(([, value]) => value).slice(0, 3).map(([key, value]) => (
                      <a key={key} href={socialUrl(key, value)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{key === 'twitter' ? 'X' : key}</a>
                    ))}
                  </div>
                  <button type="button" className="team-partner-card__open">Ver ficha</button>
                </div>
              </motion.article>
            )) : (
              <motion.div className="team-partner-card team-partner-card--empty" variants={revealItem}>
                <span>SP</span>
                <div>
                  <b>{team.showSponsors === false && !canSeePrivateTeamData ? 'Patrocinadores privados' : 'Sin patrocinadores'}</b>
                  <small>{team.showSponsors === false && !canSeePrivateTeamData ? 'El equipo decidió no mostrar esta información.' : 'El equipo aún no publicó marcas aliadas.'}</small>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="team-partner-band__block team-partner-band__block--staff">
          <div className="team-partner-band__title">
            <p>Direccion competitiva</p>
            <h2>Coach y staff</h2>
          </div>
          <motion.div className="team-partner-grid team-partner-grid--staff" variants={revealList} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.24 }}>
            {visibleStaff.length ? visibleStaff.map((person, index) => (
              <motion.div className="team-partner-card team-partner-card--staff" key={`${person.name || person.nick}-${index}`} variants={revealItem} whileHover={{ y: -5, scale: 1.015 }} onClick={() => setExpandedPartner({ type: 'staff', data: person })}>
                <span>{person.avatar ? <img src={imageUrl(person.avatar)} alt="" /> : initials(person.name || person.nick, 'ST')}</span>
                <div>
                  <b>{person.name || person.nick || 'Staff'}</b>
                  <small>
                    {person.role || 'Coach / Staff'}
                    {person.roleVerified && <em className="team-partner-card__verified" title="Rol aprobado por GlitchGang">{Icon.check} Verificado</em>}
                  </small>
                  <p>{clampText(person.bio, 120)}</p>
                  <button type="button" className="team-partner-card__open">Ver ficha</button>
                </div>
              </motion.div>
            )) : (
              <motion.div className="team-partner-card team-partner-card--empty" variants={revealItem}>
                <span>CO</span>
                <div>
                  <b>{team.showStaff === false && !canSeePrivateTeamData ? 'Staff privado' : 'Coach no publicado'}</b>
                  <small>{team.showStaff === false && !canSeePrivateTeamData ? 'El equipo decidió ocultar su dirección competitiva.' : 'Disponible para completar en el panel del equipo.'}</small>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="team-profile-shell"
        variants={revealSection}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.16 }}
      >
        <div className="team-profile-main">
          <motion.section className="tp-panel tp-panel--bio" variants={revealItem}>
            <div className="tp-panel__head">
              <span>{Icon.award}</span>
              <div>
                <p>Identidad competitiva</p>
                <h2>Biografia del equipo</h2>
              </div>
            </div>
            <p>{team.description || 'El lider todavia no ha publicado una biografia para este equipo.'}</p>

            <div className="tp-data-grid">
              <div><span>Marca</span><b>{team.brand || team.sponsor || 'Sin marca asignada'}</b></div>
              <div><span>Categoria</span><b>{team.category || game?.category || 'Competitivo'}</b></div>
              <div><span>Idioma</span><b>{team.lang || 'Espanol'}</b></div>
              <div><span>Quien puede unirse</span><b>{joinScopeLabel(team.joinScope || 'open', team)}{teamGenderKey(team.gender) === 'female' ? ' · solo jugadoras' : ''}{team.university?.isUniversityTeam ? ` · estudiantes de ${team.university.universityTag || 'la universidad'}` : ''}</b></div>
              <div><span>Contacto</span><b>{visibleContactEmail || 'Privado'}</b></div>
            </div>
          </motion.section>

          <motion.section className="tp-panel" variants={revealItem}>
            <div className="tp-panel__head">
              <span>{Icon.users}</span>
              <div>
                <p>Roster oficial</p>
                <h2>Jugadores</h2>
              </div>
            </div>
            <motion.div className="tp-roster-grid" variants={revealList} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
              {visibleRoster.length ? visibleRoster.map((player, index) => (
                <motion.article
                  className={`tp-player ${index === activeRosterIndex ? 'active' : ''}`}
                  key={player.id || player.nick}
                  onClick={() => openPlayerPanel(index)}
                  variants={revealItem}
                  whileHover={{ x: 5, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="tp-player__avatar">
                    {player.avatar ? <img src={imageUrl(player.avatar)} alt={player.nick} /> : <span>{initials(player.nick)}</span>}
                    {player.presence && (
                      <i
                        className={player.presence.online ? 'online' : ''}
                        style={player.presence.online ? { background: player.presence.color } : undefined}
                        title={player.presence.label}
                      />
                    )}
                  </div>
                  <div>
                    <h3>{player.nick || 'Jugador'}</h3>
                    <p>{player.role || 'Jugador'}</p>
                    {player.playerCode && <small>{player.playerCode}</small>}
                  </div>
                  <button
                    className="tp-player__view"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openPlayerPanel(index)
                    }}
                  >
                    Datos
                  </button>
                </motion.article>
              )) : (
                <p className="tp-empty">{team.showRoster === false && !canSeePrivateTeamData ? 'Roster privado por configuración del equipo.' : 'No hay jugadores publicados todavía.'}</p>
              )}
            </motion.div>
          </motion.section>

          <motion.section className="tp-panel" id="historial" variants={revealItem}>
            <div className="tp-panel__head">
              <span>{Icon.trophy}</span>
              <div>
                <p>Historial competitivo</p>
                <h2>Torneos donde participa</h2>
              </div>
            </div>
            <motion.div className="tp-tournament-grid" variants={revealList} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
              {visibleTournaments.length ? visibleTournaments.map(tournament => {
                const tournamentGame = resolveGame(tournament.game)
                const tournamentImage = imageUrl(tournament.banner || tournamentGame?.images?.horizontal)
                const result = tournamentTeamResult(tournament, team)
                const podiumTitle = titleByTournament.get(String(tournament._id || tournament.id || ''))
                const tournamentId = tournament._id || tournament.id || tournament.publicId
                const prizeLabel = result.prize
                  ? `${result.prize.place || result.placement} lugar - ${result.prize.amount ? `${tournament.currency || '$'}${result.prize.amount}` : result.prize.items || 'Reconocimiento'}`
                  : compactPrize(tournament)
                return (
                  <motion.article className="tp-tournament" key={tournament._id || tournament.id || tournament.title} variants={revealItem} whileHover={{ y: -4, scale: 1.01 }}>
                    <div className="tp-tournament__image" style={{ backgroundImage: `url(${tournamentImage})` }} />
                    <div>
                      <span>{podiumTitle ? PLACEMENT_LABEL[podiumTitle.placement] : result.champion ? 'Campeón' : (result.placement ? `${result.placement} lugar` : tournament.status || 'Activo')}</span>
                      <h3>{tournament.title || tournament.name}</h3>
                      <p>{formatDate(tournament.date)} - {prizeLabel}</p>
                      <dl className="tp-tournament__facts">
                        <div><dt>Bracket</dt><dd>{result.bracketPublished ? 'Publicado' : 'Pendiente'}</dd></div>
                        <div><dt>Registro</dt><dd>{result.registrationStatus || 'Inscrito'}</dd></div>
                      </dl>
                      {result.winsAgainst.length > 0 && (
                        <p className="tp-tournament__wins">Victorias vs {result.winsAgainst.join(', ')}</p>
                      )}
                      <button type="button" className="tp-tournament__link" onClick={() => navigate(`/torneos/${tournamentId}`)}>
                        {Icon.trophy} Ver torneo / bracket
                      </button>
                    </div>
                  </motion.article>
                )
              }) : (
                <p className="tp-empty">{team.showTournaments === false && !canSeePrivateTeamData ? 'Historial de torneos privado.' : 'Este equipo aún no aparece inscrito en torneos públicos.'}</p>
              )}
            </motion.div>
          </motion.section>
        </div>

        <motion.aside className="team-profile-side" variants={revealList}>
          <motion.section className="tp-side-card" variants={revealItem}>
            <h3>Ficha del jugador</h3>
            <div className="tp-player-detail">
              <div className="tp-player-detail__avatar">
                {activePlayer?.avatar ? <img src={imageUrl(activePlayer.avatar)} alt={activePlayer.nick} /> : <span>{initials(activePlayer?.nick || 'GG')}</span>}
              </div>
              <div>
                <b>{activePlayer?.nick || 'Selecciona un jugador'}</b>
                <span>{activePlayer?.role || activePlayer?.gamerProfile?.mainRole || 'Jugador'}</span>
              </div>
            </div>
            <dl className="tp-player-detail__meta">
              <div><dt>Juego</dt><dd>{resolveGame(activePlayer?.gamerProfile?.mainGame || activePlayer?.games?.[0] || team.game)?.name || game?.name}</dd></div>
              <div><dt>Rango / ID</dt><dd>{activePlayer?.gameId || activePlayer?.gamerProfile?.rank || activePlayer?.playerCode || 'No publicado'}</dd></div>
              <div><dt>Contacto</dt><dd>{activePlayer?.email || 'Privado'}</dd></div>
            </dl>
          </motion.section>

          <motion.section className="tp-side-card" variants={revealItem}>
            <h3>{activePlayer?.nick ? `Personajes de ${activePlayer.nick}` : 'Personajes del jugador'}</h3>
            <div className="tp-chip-list">
              {activePlayerCharacters.length ? activePlayerCharacters.map(character => (
                <span key={character}>{character}</span>
              )) : (
                <span>Sin personajes publicados para este jugador</span>
              )}
            </div>
          </motion.section>

          <motion.section className="tp-side-card" variants={revealItem}>
            <h3>Patrocinadores</h3>
            <div className="tp-sponsor-list">
              {visibleSponsors.length ? visibleSponsors.map(sponsor => (
                <a
                  key={`${sponsor.name}-${sponsor.tier}`}
                  href={sponsor.website || undefined}
                  target={sponsor.website ? '_blank' : undefined}
                  rel="noreferrer"
                  className="tp-sponsor"
                >
                  <span>{sponsor.logo ? <img src={imageUrl(sponsor.logo)} alt="" /> : initials(sponsor.name, 'SP')}</span>
                  <div>
                    <b>{sponsor.name}</b>
                    <small>{sponsor.tier || 'Sponsor'}</small>
                    {(sponsor.since || sponsor.location) && (
                      <em>{[sponsor.since ? `Desde ${sponsor.since}` : '', sponsor.location].filter(Boolean).join(' - ')}</em>
                    )}
                  </div>
                </a>
              )) : (
                <p className="tp-empty">{team.showSponsors === false && !canSeePrivateTeamData ? 'Patrocinadores privados.' : 'Sin sponsors publicados.'}</p>
              )}
            </div>
          </motion.section>

          <motion.section className="tp-side-card tp-side-card--contact" variants={revealItem}>
            <h3>Contacto y marca</h3>
            <dl>
              <div><dt>Email</dt><dd>{visibleContactEmail || 'Privado'}</dd></div>
              <div><dt>Comunidad</dt><dd>{team.community || 'Independiente'}</dd></div>
              <div><dt>Codigo</dt><dd>{team.publicCode || 'TEAM'}</dd></div>
            </dl>
            {visibleSocials && Object.values(visibleSocials).some(Boolean) && (
              <div className="tp-team-socials" style={{ display: 'flex', gap: '10px', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', flexWrap: 'wrap' }}>
                {visibleSocials.twitter && (
                  <a href={`https://twitter.com/${visibleSocials.twitter.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" title="X (Twitter)" style={{ color: '#fff', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                    {Icon.x || Icon.share}
                  </a>
                )}
                {visibleSocials.instagram && (
                  <a href={`https://instagram.com/${visibleSocials.instagram.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" title="Instagram" style={{ color: '#e1306c', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                    {Icon.instagram || Icon.share}
                  </a>
                )}
                {visibleSocials.discord && (
                  <a href={`https://discord.gg/${visibleSocials.discord.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" title="Discord" style={{ color: '#5865f2', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                    {Icon.discord || Icon.share}
                  </a>
                )}
                {visibleSocials.youtube && (
                  <a href={`https://youtube.com/${visibleSocials.youtube.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" title="YouTube" style={{ color: '#ff0000', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                    {Icon.youtube || Icon.share}
                  </a>
                )}
                {visibleSocials.tiktok && (
                  <a href={`https://tiktok.com/@${visibleSocials.tiktok.replace(/^https?:\/\//, '').replace(/^@/, '')}`} target="_blank" rel="noreferrer" title="TikTok" style={{ color: '#01f2f9', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                    {Icon.tiktok || Icon.share}
                  </a>
                )}
                {visibleSocials.website && (
                  <a href={`https://${visibleSocials.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" title="Sitio Web" style={{ color: '#00e5a0', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                    {Icon.globe || Icon.share}
                  </a>
                )}
              </div>
            )}
          </motion.section>
        </motion.aside>
      </motion.section>

      {expandedPlayer && (
        <div className="team-player-modal" onClick={() => setExpandedPlayerIndex(null)}>
          <motion.article
            className="team-player-modal__panel"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <button className="team-player-modal__close" type="button" onClick={() => setExpandedPlayerIndex(null)}>
              {Icon.x}
            </button>
            <div className="team-player-modal__media">
              {expandedPlayer.avatar ? <img src={imageUrl(expandedPlayer.avatar)} alt={playerName(expandedPlayer)} /> : <span>{initials(expandedPlayer.nick || playerName(expandedPlayer))}</span>}
            </div>
            <div className="team-player-modal__content">
              <p>{team.name} · {team.publicCode || 'TEAM-ID'}</p>
              <h2>{playerName(expandedPlayer)}</h2>
              <span className="team-player-modal__role">{expandedPlayer.role || expandedPlayer.gamerProfile?.mainRole || 'Jugador'}</span>
              
              {/* Redes Sociales del Jugador */}
              {shouldShowSocials(expandedPlayer) && (
                <div className="player-modal-socials" style={{ display: 'flex', gap: '12px', margin: '10px 0 16px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  {expandedPlayer.social?.twitter && (
                    <a href={`https://twitter.com/${expandedPlayer.social.twitter.replace(/^@/, '')}`} target="_blank" rel="noreferrer" title="Twitter / X" style={{ color: '#fff', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                      {Icon.x || Icon.share}
                    </a>
                  )}
                  {expandedPlayer.social?.instagram && (
                    <a href={`https://instagram.com/${expandedPlayer.social.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" title="Instagram" style={{ color: '#e1306c', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                      {Icon.instagram || Icon.share}
                    </a>
                  )}
                  {expandedPlayer.social?.discord && (
                    <a href={`https://discord.gg/${expandedPlayer.social.discord}`} target="_blank" rel="noreferrer" title="Discord" style={{ color: '#5865f2', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                      {Icon.discord || Icon.share}
                    </a>
                  )}
                  {expandedPlayer.social?.twitch && (
                    <a href={`https://twitch.tv/${expandedPlayer.social.twitch}`} target="_blank" rel="noreferrer" title="Twitch" style={{ color: '#9146ff', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                      {Icon.twitch || Icon.share}
                    </a>
                  )}
                  {expandedPlayer.social?.youtube && (
                    <a href={`https://youtube.com/${expandedPlayer.social.youtube}`} target="_blank" rel="noreferrer" title="YouTube" style={{ color: '#ff0000', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                      {Icon.youtube || Icon.share}
                    </a>
                  )}
                  {WHATSAPP_ENABLED && expandedPlayer.social?.whatsapp && (
                    <a href={`https://wa.me/${expandedPlayer.social.whatsapp}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ color: '#25d366', display: 'inline-flex', width: '18px', height: '18px' }} className="tp-soc-link">
                      {Icon.whatsapp || Icon.share}
                    </a>
                  )}
                </div>
              )}

              <p className="team-player-modal__bio">{playerBio(expandedPlayer)}</p>

              <dl className="team-player-modal__data">
                <div><dt>ID de juego</dt><dd>{playerGameId(expandedPlayer)}</dd></div>
                <div><dt>Linea favorita</dt><dd>{playerLane(expandedPlayer)}</dd></div>
                <div><dt>Juego</dt><dd>{resolveGame(expandedPlayer?.gamerProfile?.mainGame || expandedPlayer?.games?.[0] || team.game)?.name || game?.name}</dd></div>
                <div><dt>Correo / contacto</dt><dd>{playerContact(expandedPlayer)}</dd></div>
                <div><dt>Disponibilidad</dt><dd>{playerAvailability(expandedPlayer)}</dd></div>
                <div><dt>Codigo roster</dt><dd>{expandedPlayer.playerCode || expandedPlayer.publicCode || 'No publicado'}</dd></div>
              </dl>

              <div className="team-player-modal__characters">
                <b>Personajes / mains</b>
                <div>
                  {playerCharacters(expandedPlayer, teamCharacters).length ? playerCharacters(expandedPlayer, teamCharacters).map(character => (
                    <span key={character}>{character}</span>
                  )) : (
                    <span>Sin personajes publicados</span>
                  )}
                </div>
              </div>

              <div className="team-player-modal__actions">
                <button type="button" className="tp-action tp-action--hot" onClick={() => navigate(playerProfilePath(expandedPlayer))}>
                  {Icon.user} Ver perfil completo
                </button>
                <button type="button" className="tp-action" onClick={() => setExpandedPlayerIndex(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </motion.article>
        </div>
      )}
      {expandedPartner && (
        <div className="team-player-modal team-partner-modal" onClick={() => setExpandedPartner(null)}>
          <motion.article
            className="team-player-modal__panel team-partner-modal__panel"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <button className="team-player-modal__close" type="button" onClick={() => setExpandedPartner(null)}>
              {Icon.x}
            </button>
            <div className="team-player-modal__media team-partner-modal__media">
              {partnerAvatar(expandedPartner.data)
                ? <img src={imageUrl(partnerAvatar(expandedPartner.data))} alt={partnerName(expandedPartner.data)} />
                : <span>{initials(partnerName(expandedPartner.data), expandedPartner.type === 'sponsor' ? 'SP' : 'ST')}</span>}
            </div>
            <div className="team-player-modal__content team-partner-modal__content">
              <p>{team.name} - {expandedPartner.type === 'sponsor' ? 'Patrocinador oficial' : 'Staff competitivo'}</p>
              <h2>{partnerName(expandedPartner.data)}</h2>
              <span className="team-player-modal__role">{expandedPartner.type === 'sponsor' ? (expandedPartner.data.tier || 'Sponsor') : (expandedPartner.data.role || 'Staff')}</span>

              {Object.entries(expandedPartner.data.socials || {}).filter(([, value]) => value).length > 0 && (
                <div className="player-modal-socials team-partner-modal__socials">
                  {Object.entries(expandedPartner.data.socials || {}).filter(([, value]) => value).map(([key, value]) => (
                    <a key={key} href={socialUrl(key, value)} target="_blank" rel="noreferrer" title={key} className="tp-soc-link">
                      {key === 'instagram' ? Icon.instagram : key === 'discord' ? Icon.discord : key === 'youtube' ? Icon.youtube : key === 'tiktok' ? Icon.tiktok : Icon.globe}
                    </a>
                  ))}
                </div>
              )}

              <p className="team-player-modal__bio team-partner-modal__bio">
                {clampText(partnerBio(expandedPartner.data, expandedPartner.type), 230)}
              </p>

              <dl className="team-player-modal__data">
                {partnerFacts(expandedPartner.data, expandedPartner.type, team).map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>

              <div className="team-player-modal__actions">
                {expandedPartner.type === 'sponsor' && expandedPartner.data.website && (
                  <a className="tp-action tp-action--hot" href={externalUrl(expandedPartner.data.website)} target="_blank" rel="noreferrer">
                    {Icon.globe} Visitar marca
                  </a>
                )}
                <button type="button" className="tp-action" onClick={() => setExpandedPartner(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </motion.article>
        </div>
      )}
      <LeaveTeamModal
        open={leaveOpen}
        team={team}
        onClose={() => setLeaveOpen(false)}
        onLeft={handleLeftTeam}
      />
      <JoinTeamModal
        open={joinOpen}
        team={team}
        teamId={teamRequestTeamId(team, teamId)}
        onClose={() => setJoinOpen(false)}
        onSent={() => { setJoinOpen(false); setRequestSent(true) }}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={`Compartir ${team.name || 'equipo'}`}
        subtitle="Comparte la pagina publica con informacion del equipo, juego y roster."
        url={shareUrl}
        text={`${team.name || 'Equipo'} en GlitchGang`}
        game={game?.name || team?.game || ''}
        summary={shareSummary}
        image={banner}
        logo={logo}
        contacts={shareContacts}
        teams={shareTeams}
      />
    </main>
  )
}

