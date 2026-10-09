import { toast } from '../../lib/toast.js'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isBetaHidden } from '../../config/betaHidden.js'
import ComingSoon from '../ComingSoon/ComingSoon.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import Avatar from '../../components/Avatar/Avatar.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Input from '../../components/Input/Input.jsx'
import Button from '../../components/Button/Button.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import { api } from '../../lib/api.js'
import { uploadFile } from '../../lib/uploadsApi.js'
import { teamRequestTeamId } from '../../lib/teamJoinRequests.js'
import { setGGContext } from '../../lib/ggAssistant.js'
import { useShareDestinations } from '../../hooks/useShareDestinations.js'
import { GAMES, GAMES_BY_CATEGORY } from '../../data/games.js'
import { ROSTER_SLOTS, GAME_ROSTER_SLOTS_LABELS } from '../../data/rosterSlots.js'
import { WHATSAPP_ENABLED } from '../../config/featureFlags.js'
import GGTeamCard from '../../components/GGTeamCard/GGTeamCard.jsx'
import RoleStaffSearch from '../../components/RoleStaffSearch/RoleStaffSearch.jsx'
import GGLoader from '../../components/GGLoader/GGLoader.jsx'
import { TEAM_DEFAULT_COLOR, teamColor } from '../../lib/teamColor.js'
import { regionForCountry, teamGenderKey, teamGenderLabel, joinBlockers, flagUrl, saveTeamDraft, readTeamDraft, clearTeamDraft } from '../../lib/teamEligibility.js'
import { titleSummary, titlesForTeam, useTitlesIndex } from '../../lib/teamTitles.js'
import { championWord } from '../../lib/championPoster.js'
import { checkGameAccountId, gameAccountFormat } from '../../../../shared/gameAccountIds.mjs'
import './Teams.css'
import { GameIdVerify } from '../../components/GameAccountConnect/GameAccountConnect.jsx'
import { isMobileLegends } from '../../../../shared/matchStats.mjs'
import JoinTeamModal from '../../components/JoinTeamModal/JoinTeamModal.jsx'
import './TeamCreateWizard.css'

const TEAMS_STORAGE_KEYS = {
  scrims: 'gg-teams-scrims-v1',
  lftPlayers: 'gg-teams-lft-players-v1',
  lftProfile: 'gg-teams-my-lft-profile-v1',
  vacancies: 'gg-teams-vacancies-v1'
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function rememberActiveTeam(team) {
  const id = team?._id || team?.id
  if (!id) return
  try {
    localStorage.setItem('gg-active-team-id', String(id))
  } catch {}
}

function teamManagePath(team) {
  const id = team?._id || team?.id
  if (!id) throw new Error('No active team id')
  return `/teams/${id}/manage`
}

// Avatar neutro para jugadores sin foto. Antes se usaban fotos de pravatar.cc:
// en equipos reales salian caras de desconocidos como si fueran los miembros.
const DEFAULT_AVATAR = '/demos/steliant-esports/avatar-default.svg'

// ─── TIER DEFINITIONS AND COLORS ─────────────────────────────────────────────
function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const joined = value.map(item => safeText(item, '')).filter(Boolean).join(', ')
    return joined || fallback
  }
  if (typeof value === 'object') {
    return safeText(
      value.nick
        || value.username
        || value.name
        || value.displayName
        || value['Nombre de usuario']
        || value.nombre
        || value.id
        || value._id,
      fallback,
    )
  }
  return fallback
}

const TIER_CONFIGS = (p) => ({
  nuevo:         { label: p.tierNew          || 'Nuevo',           hex: 'var(--accent)', class: 'tier-nuevo'        },
  universitario: { label: p.tierUniversity   || 'Universitario',   hex: 'var(--accent)', class: 'tier-universitario' },
  femenino:      { label: p.tierFemale       || 'Femenino',        hex: 'var(--accent)', class: 'tier-femenino'      },
  profesional:   { label: p.tierProfessional || 'Profesional',     hex: 'var(--accent)', class: 'tier-profesional'   },
  legendario:    { label: p.tierLegendary    || 'Legendario',      hex: 'var(--accent)', class: 'tier-legendario'    },
  sig_liga:      { label: p.tierNextLeague   || 'Siguiente Liga',  hex: 'var(--accent)', class: 'tier-sig-liga'      },
})

// Gradient generator based on active tiers
function getTeamGradientStyle(tiers, configs) {
  if (!tiers || tiers.length === 0) return { background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 72%, var(--text)))' }
  const hexMap = {
    nuevo: 'var(--accent)',
    universitario: 'color-mix(in srgb, var(--accent) 86%, var(--text))',
    femenino: 'color-mix(in srgb, var(--accent) 78%, var(--text))',
    profesional: 'color-mix(in srgb, var(--accent) 92%, var(--bg))',
    legendario: 'color-mix(in srgb, var(--accent) 82%, var(--text))',
    sig_liga: 'color-mix(in srgb, var(--accent) 72%, var(--text))',
  }
  const colors = tiers.map(t => hexMap[t] || 'var(--accent)')
  return { background: `linear-gradient(135deg, ${colors.join(', ')})` }
}

// Tier gradient map — each tier has primary color, gradient border, and glow
const TIER_GRAD = {
  nuevo:         { color: 'var(--accent)', border: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 72%, var(--text)))', glow: 'rgba(var(--accent-rgb),.2)' },
  universitario: { color: 'color-mix(in srgb, var(--accent) 86%, var(--text))', border: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 66%, var(--text)))', glow: 'rgba(var(--accent-rgb),.18)' },
  femenino:      { color: 'color-mix(in srgb, var(--accent) 78%, var(--text))', border: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 78%, var(--text)), var(--accent))', glow: 'rgba(var(--accent-rgb),.18)' },
  profesional:   { color: 'color-mix(in srgb, var(--accent) 92%, var(--bg))', border: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 72%, var(--bg)))', glow: 'rgba(var(--accent-rgb),.2)' },
  legendario:    { color: 'color-mix(in srgb, var(--accent) 82%, var(--text))', border: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, var(--text)), var(--accent))', glow: 'rgba(var(--accent-rgb),.18)' },
  sig_liga:      { color: 'color-mix(in srgb, var(--accent) 72%, var(--text))', border: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 58%, var(--text)))', glow: 'rgba(var(--accent-rgb),.2)', anim: 'sig-liga-pulse 3s infinite alternate' },
}

function getTeamTierStyles(tiers) {
  if (!tiers || tiers.length === 0) {
    const d = TIER_GRAD.nuevo
    return { '--tier-color-primary': d.color, '--tier-border': d.border, '--tier-glow': d.glow }
  }
  if (tiers.length === 1) {
    const cfg = TIER_GRAD[tiers[0]] || TIER_GRAD.nuevo
    const out = { '--tier-color-primary': cfg.color, '--tier-border': cfg.border, '--tier-glow': cfg.glow }
    if (cfg.anim) out['--tier-animation'] = cfg.anim
    return out
  }
  // Multi-tier gradient combination (e.g. profesional + legendario)
  const colors = tiers.map(t => (TIER_GRAD[t] || TIER_GRAD.nuevo).color)
  const primary = TIER_GRAD[tiers[0]] || TIER_GRAD.nuevo
  return {
    '--tier-color-primary': primary.color,
    '--tier-border': `linear-gradient(135deg, ${colors.join(', ')})`,
    '--tier-glow': primary.glow,
  }
}

function splitCommaList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function formatCommaList(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : ''
}

function parseSponsorLines(value) {
  return String(value || '')
    .split('\n')
    .map(line => {
      const [name, tier, website, logo] = line.split('|').map(part => part.trim())
      if (!name) return null
      return { name, tier: tier || 'Sponsor', website: website || '', logo: logo || '' }
    })
    .filter(Boolean)
}

function formatSponsorLines(value) {
  return Array.isArray(value)
    ? value
      .filter(sponsor => sponsor?.name)
      .map(sponsor => [sponsor.name, sponsor.tier, sponsor.website, sponsor.logo].filter(Boolean).join(' | '))
      .join('\n')
    : ''
}

// ─── ROSTER LIMITS PER GAME ──────────────────────────────────────────────────
function normalizeTeamRecord(team) {
  if (!team || typeof team !== 'object') return null
  const normalized = {
    ...team,
    id: team._id || team.id,
    name: team.name || team.Nombre || team.equipo || team.Equipo || '',
    tag: team.tag || team.Tag || team.siglas || team.Siglas || '',
    game: team.game || team.Juego || team.juego || team.mainGame || team['Juego principal'] || '',
    region: team.region || team.Region || team['Pais / Region'] || team['País / Región'] || '',
    level: team.level || team.Nivel || team['Nivel competitivo'] || '',
    lang: team.lang || team.Idioma || team.idioma || '',
    category: team.category || team.Categoria || team['Categoría'] || team['Categoría'] || '',
    rosterSlots: team.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : undefined,
  }
  if (!normalized.tag && normalized.name) normalized.tag = normalized.name.substring(0, 3).toUpperCase()
  return normalized
}

function normalizeTeamList(value) {
  const list = Array.isArray(value) ? value : value?.teams || value?.ranking || value?.data || []
  return Array.isArray(list)
    ? list.map(normalizeTeamRecord).filter(Boolean)
    : []
}

const TEMPLATE_TEAM_KEYS = new Set([
  'glitch core',
  'alpha wolves',
  'cyber queens',
  'phoenix esports',
  'royal dynasty',
  'astro league',
  'glc',
  'aw',
  'cq',
  'phx',
  'rd',
  'al',
])

function isTemplateTeamRecord(team) {
  if (!team || typeof team !== 'object') return true
  const nameKey = String(team.name || '').trim().toLowerCase()
  const tagKey = String(team.tag || '').trim().toLowerCase()
  const sourceKey = String(team.source || team.origin || team.kind || '').trim().toLowerCase()
  const rawId = team._id || team.id || ''
  const hasBackendIdentity = Boolean(team._id || team.publicCode || team.internalCode || team.teamIdCode || team.teamInviteCode)
  const isNumericTemplateId = typeof rawId === 'number' || /^(10[1-6])$/.test(String(rawId))

  return Boolean(
    team.isTemplate ||
    team.template ||
    team.isDemo ||
    team.demo ||
    team.mock ||
    sourceKey === 'template' ||
    sourceKey === 'demo' ||
    sourceKey === 'mock' ||
    TEMPLATE_TEAM_KEYS.has(nameKey) ||
    TEMPLATE_TEAM_KEYS.has(tagKey) ||
    (!hasBackendIdentity && isNumericTemplateId)
  )
}

function normalizeDirectoryTeamList(value) {
  return normalizeTeamList(value).filter(team => !isTemplateTeamRecord(team))
}

function normalizeFlag(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return ['activo', 'active', 'true', 'si', 'sí', 'enabled', 'on'].includes(value.trim().toLowerCase())
  return false
}

function hasActiveChallengerPlan(value) {
  if (!value || typeof value !== 'object') return false
  const explicit = [
    value.planRetadorActivo,
    value.retadorActivo,
    value.challengerPlanActive,
    value.challengerModeActive,
    value.weeklyChallengerActive,
    value.acceptChallengerRequests,
  ]
  if (explicit.some(normalizeFlag)) return true

  const planValues = [
    value.plan,
    value.planName,
    value.activePlan,
    value.subscription?.plan,
    value.subscription?.name,
    ...(Array.isArray(value.activePlans) ? value.activePlans : []),
  ]
  const hasRetadorPlan = planValues.some(plan => /retador|challenger/i.test(String(plan || '')))
  const status = value.planStatus || value.subscriptionStatus || value.subscription?.status || value.statusPlan
  return hasRetadorPlan && (!status || normalizeFlag(status))
}

function isNewTeamRecord(team) {
  if (!team || typeof team !== 'object') return false
  if (normalizeFlag(team.isNewTeam) || normalizeFlag(team.newTeam)) return true
  if (Array.isArray(team.tiers) && team.tiers.includes('nuevo')) return true
  if (hasActiveChallengerPlan(team)) return false
  return (team.wins || 0) === 0 && (team.losses || 0) === 0 && (team.rankPts || 1000) <= 1000
}

function isEstablishedTeamRecord(team) {
  return !!team && !isNewTeamRecord(team)
}

const GAME_CATEGORIES = {
  'MOBA': ['Mobile Legends', 'League of Legends', 'Dota 2'],
  'Shooter': ['Valorant', 'CS2'],
  'Battle Royale': ['Apex Legends', 'Fortnite', 'Free Fire'],
  'Deporte': ['Rocket League'],
  'Fighting': ['Tekken 8']
}

const SCRIM_MAP_OPTIONS = {
  'Mobile Legends': ['Custom Draft', 'Ranked Draft', 'Torneo / sala privada'],
  'League of Legends': ['Summoner Rift - Tournament Draft', 'Summoner Rift - Draft', 'ARAM practice'],
  'Dota 2': ['Captains Mode', 'All Pick lobby', 'Tournament lobby'],
  Valorant: ['Ascent', 'Bind', 'Haven', 'Lotus', 'Split', 'Sunset'],
  CS2: ['Mirage', 'Inferno', 'Ancient', 'Nuke', 'Anubis', 'Overpass'],
  'Apex Legends': ['World Edge', 'Storm Point', 'Olympus', 'Broken Moon'],
  Fortnite: ['Battle Royale customs', 'Zone Wars', 'Box Fight', 'Trio customs'],
  'Free Fire': ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine'],
  'Rocket League': ['DFH Stadium', 'Mannfield', 'Champions Field', '3v3 privado'],
  'Tekken 8': ['FT5', 'FT10', 'Lobby ranked rules', 'Matchup lab']
}

const SCRIM_CATEGORY_RULES = {
  MOBA: ['Draft competitivo, remake antes del minuto 3, pausas maximo 5 min', 'Sin stream snipe, VOD permitido, picks confirmados por capitan', 'Sala privada, side swap por partida, resultado reportado al cerrar'],
  Shooter: ['Servidor Miami/LAN, overtime activo, VOD permitido', 'Knife/coin toss para side, pausas tacticas acordadas, anti-cheat activo', 'Map veto previo, coach permitido solo en pausa, resultado reportado al cerrar'],
  'Battle Royale': ['Sala privada, codigo por sala, reinicio solo por crash masivo', 'Puntos por placement y kills, no teaming, stream delay recomendado', 'Rotacion y drop spot respetados, resultado reportado al cerrar'],
  Deporte: ['Lobby privado, BO5 recomendado, overtime activo', 'Servidor acordado por ping, rematch solo por desconexion temprana', 'Resultado reportado al cerrar'],
  Fighting: ['FT5/FT10, cable recomendado, cambio de personaje permitido segun acuerdo', 'Ping estable, stage random, no coaching entre rounds', 'Resultado reportado al cerrar']
}

function getGameCategory(game) {
  return Object.entries(GAME_CATEGORIES).find(([, games]) => games.includes(game))?.[0] || 'Shooter'
}

function getScrimMapOptions(game) {
  return SCRIM_MAP_OPTIONS[game] || ['Mapa / modo por acordar']
}

function getScrimRulesOptions(category) {
  return SCRIM_CATEGORY_RULES[category] || SCRIM_CATEGORY_RULES.Shooter
}

function getScrimModeCopy(mode, isEs) {
  const copy = {
    prioridad_vs: {
      title: isEs ? 'Crear desafio' : 'Create challenge',
      eyebrow: isEs ? 'Reto directo' : 'Direct challenge',
      description: isEs
        ? 'Reta a un equipo registrado, define juego, mapa, horario y reglas para que el rival acepte o negocie la sala.'
        : 'Challenge a registered team, define game, map, schedule and rules so the rival can accept or negotiate the room.',
      targetLabel: isEs ? 'Equipo rival *' : 'Rival team *',
      targetPlaceholder: isEs ? 'Nombre o tag del equipo registrado' : 'Registered team name or tag',
      titlePlaceholder: isEs ? 'ej: Reto BO3 contra TITANS hoy 20:00' : 'ex: BO3 challenge vs TITANS today 20:00',
      submit: isEs ? 'Publicar desafio' : 'Post challenge',
      targetRequired: true,
      showTarget: true,
    },
    anytime: {
      title: isEs ? 'Buscar scrim' : 'Find scrim',
      eyebrow: isEs ? 'Desafio abierto' : 'Open challenge',
      description: isEs
        ? 'Publica una disponibilidad abierta por juego para que otro equipo compatible confirme el enfrentamiento.'
        : 'Post open availability by game so a compatible team can confirm the match.',
      targetLabel: isEs ? 'Preferencia de rival' : 'Rival preference',
      targetPlaceholder: isEs ? 'Abierto, nivel similar, region o liga' : 'Open, similar level, region or league',
      titlePlaceholder: isEs ? 'ej: Buscamos scrim MLBB esta noche' : 'ex: Looking for MLBB scrim tonight',
      submit: isEs ? 'Publicar busqueda' : 'Post search',
      targetRequired: false,
      showTarget: true,
    },
    weekly_upset: {
      title: isEs ? 'Modo retador' : 'Challenger mode',
      eyebrow: isEs ? 'Reto semanal' : 'Weekly challenge',
      description: isEs
        ? 'Para equipos nuevos: reta una vez por semana a un equipo superior que tenga el plan retador activo.'
        : 'For new teams: once per week, challenge a higher team with an active challenger plan.',
      targetLabel: isEs ? 'Equipo superior *' : 'Higher team *',
      targetPlaceholder: isEs ? 'Equipo superior con plan retador activo' : 'Higher team with active challenger plan',
      titlePlaceholder: isEs ? 'ej: Retador semanal vs equipo superior' : 'ex: Weekly challenger vs higher team',
      submit: isEs ? 'Publicar reto retador' : 'Post challenger request',
      targetRequired: true,
      showTarget: true,
    },
  }
  return copy[mode] || copy.prioridad_vs
}

function normalizeGameName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

const GAME_NAME_ALIASES = {
  lol: 'leagueoflegends',
  league: 'leagueoflegends',
  leagueoflegendswildrift: 'leagueoflegendswildrift',
  wildrift: 'leagueoflegendswildrift',
  mlbb: 'mobilelegends',
  mobilelegendsbangbang: 'mobilelegends',
  val: 'valorant',
  valo: 'valorant',
  rl: 'rocketleague',
  rocket: 'rocketleague',
  freefire: 'freefire',
  frefire: 'freefire',
  csgo: 'cs2',
  counterstrike2: 'cs2',
}

function resolveGameArt(gameName) {
  const normalized = normalizeGameName(gameName)
  const alias = GAME_NAME_ALIASES[normalized] || normalized
  const game = GAMES.find(item => {
    const itemName = normalizeGameName(item.name)
    const itemId = normalizeGameName(item.id)
    return itemName === alias || itemId === alias || itemName.includes(alias) || alias.includes(itemName)
  })
  return {
    image: game?.images?.horizontal || game?.poster || game?.image || '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    railImages: [
      game?.images?.horizontal,
      game?.poster,
      game?.image,
      game?.lowFpsImage,
      ...Object.values(game?.railImages || {}),
    ].filter(Boolean),
    color: 'var(--accent)',
    name: game?.name || gameName || 'GlitchGang',
  }
}

const PUBLIC_FORM_TIERS = ['nuevo', 'universitario', 'femenino', 'profesional']

// ─── MOCK DIRECTORIES DATA ────────────────────────────────────────────────────
const INITIAL_MOCK_TEAMS = [
  { id: 101, name: 'Glitch Core', tag: 'GLC', wins: 142, losses: 58, rankPts: 2840, game: 'Mobile Legends', tiers: ['profesional', 'legendario'], region: 'LAS', filled: 5, slogan: '¡Hasta la gloria final!', acceptRequests: true },
  { id: 102, name: 'Alpha Wolves', tag: 'AW', wins: 82, losses: 40, rankPts: 1800, game: 'Valorant', tiers: ['universitario', 'profesional'], region: 'LAN', filled: 5, slogan: 'Cazamos en manada', acceptRequests: false },
  { id: 103, name: 'Cyber Queens', tag: 'CQ', wins: 54, losses: 20, rankPts: 1550, game: 'League of Legends', tiers: ['femenino', 'nuevo'], region: 'EUW', filled: 5, slogan: 'El trono es nuestro', acceptRequests: true },
  { id: 104, name: 'Phoenix Esports', tag: 'PHX', wins: 99, losses: 95, rankPts: 1200, game: 'CS2', tiers: ['nuevo'], region: 'NA', filled: 4, slogan: 'Renaciendo del fuego', acceptRequests: true },
  { id: 105, name: 'Royal Dynasty', tag: 'RD', wins: 180, losses: 120, rankPts: 2100, game: 'Tekken 8', tiers: ['legendario', 'sig_liga'], region: 'Global', filled: 2, slogan: 'Golpes de realeza', acceptRequests: false },
  { id: 106, name: 'Astro League', tag: 'AL', wins: 15, losses: 8, rankPts: 1100, game: 'Rocket League', tiers: ['universitario'], region: 'MX', filled: 3, slogan: 'Vuelo supersónico', acceptRequests: true }
]

INITIAL_MOCK_TEAMS[0] = { ...INITIAL_MOCK_TEAMS[0], plan: 'Retador', planStatus: 'Activo', challengerPlanActive: true }
INITIAL_MOCK_TEAMS[4] = { ...INITIAL_MOCK_TEAMS[4], plan: 'Retador', planStatus: 'Inactivo' }

const INITIAL_MOCK_PLAYERS = [
  { id: 201, nick: 'Nyx_Esports', game: 'Valorant', role: 'IGL', rankPts: 1850, status: 'Disponible / LFT', avatar: 'https://i.pravatar.cc/96?img=33' },
  { id: 202, nick: 'FakerJr', game: 'League of Legends', role: 'Mid', rankPts: 2100, status: 'Disponible / LFT', avatar: 'https://i.pravatar.cc/96?img=56' },
  { id: 203, nick: 'Stephy_GG', game: 'Mobile Legends', role: 'Roamer', rankPts: 1450, status: 'Disponible / LFT', avatar: 'https://i.pravatar.cc/96?img=47' },
  { id: 204, nick: 'ViperSniper', game: 'CS2', role: 'AWPer', rankPts: 1600, status: 'Disponible', avatar: 'https://i.pravatar.cc/96?img=68' },
  { id: 205, nick: 'KingJin', game: 'Tekken 8', role: 'Main', rankPts: 1900, status: 'LFT', avatar: 'https://i.pravatar.cc/96?img=11' },
  { id: 206, nick: 'AeroStrike', game: 'Rocket League', role: 'Striker', rankPts: 1300, status: 'Disponible', avatar: 'https://i.pravatar.cc/96?img=24' }
]

const INITIAL_MOCK_SCRIMS = [
  { id: 301, team: 'Glitch Core', game: 'Mobile Legends', region: 'LAN', time: '20:00 UTC', format: 'BO3', title: 'Scrim BO3 - Buscamos rival rango Mítico', color: '#FF4655' },
  { id: 302, team: 'Alpha Wolves', game: 'Valorant', region: 'LAN', time: '22:30 UTC', format: 'BO3', title: 'VS BO3 contra Diamante / Ascendente', color: '#0072F5' },
  { id: 303, team: 'Cyber Queens', game: 'League of Legends', region: 'EUW', time: '19:00 UTC', format: 'BO1', title: 'Scrim amistosa la Grieta - Nivel Platino', color: '#FF4FD8' },
  { id: 304, team: 'Royal Dynasty', game: 'Tekken 8', region: 'Global', time: '18:00 UTC', format: 'FT5', title: 'Lobby FT5 / Espejo para práctica activa', color: '#FACC15' }
]

const SCRIM_GAME_FIELDS = {
  'Mobile Legends': { mapLabel: 'Modo', mapPlaceholder: 'Ranked Draft / Custom Draft', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Rotaciones early, turtle control, cierre en Lord', rosterLabel: 'Composicion buscada', rosterPlaceholder: 'Mitico+ con jungla asesino, roamer iniciador' },
  'League of Legends': { mapLabel: 'Mapa / cola', mapPlaceholder: 'Summoner Rift / Tournament Draft', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Herald tempo, bot prio, setup de Nashor', rosterLabel: 'Pool o lanes a probar', rosterPlaceholder: 'Top weakside, mid control mage, bot hypercarry' },
  'Dota 2': { mapLabel: 'Lobby', mapPlaceholder: 'Captains Mode', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Draft flexible, smoke timings, Roshan control', rosterLabel: 'Heroes / roles', rosterPlaceholder: 'Offlane iniciador, pos 4 roaming' },
  Valorant: { mapLabel: 'Map pool', mapPlaceholder: 'Ascent, Haven, Bind', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Defaults, retakes, exec A/B', rosterLabel: 'Composicion buscada', rosterPlaceholder: 'Ascendente+, IGL, controller y sentinel fijos' },
  CS2: { mapLabel: 'Map pool', mapPlaceholder: 'Mirage, Inferno, Ancient', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Utility set, executes, clutch protocol', rosterLabel: 'Nivel / roles', rosterPlaceholder: 'Faceit 8+, AWPer disponible, riflers estables' },
  'Apex Legends': { mapLabel: 'Mapa / modo', mapPlaceholder: 'World Edge / scrim lobby', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Rotacion zona 2, fights controladas', rosterLabel: 'Composicion buscada', rosterPlaceholder: 'IGL, anchor y fragger Diamond+' },
  Fortnite: { mapLabel: 'Modo', mapPlaceholder: 'Trio customs / Zone wars', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Rotaciones, surge, endgame', rosterLabel: 'Nivel / plataforma', rosterPlaceholder: 'Elite, PC, mando permitido' },
  'Free Fire': { mapLabel: 'Mapa / sala', mapPlaceholder: 'Bermuda / sala privada', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Rotacion, tradeo, cierre de zona', rosterLabel: 'Composicion buscada', rosterPlaceholder: 'Heroico+, caller y soporte' },
  'Rocket League': { mapLabel: 'Modo', mapPlaceholder: '3v3 privado', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Kickoffs, boost control, defensa backboard', rosterLabel: 'Nivel', rosterPlaceholder: 'Champ II+, 3 titulares' },
  'Tekken 8': { mapLabel: 'Set', mapPlaceholder: 'FT5 / FT10', focusLabel: 'Objetivo tactico', focusPlaceholder: 'Matchup lab, castigo, adaptacion', rosterLabel: 'Personajes', rosterPlaceholder: 'Jin, Reina, Dragunov, King' }
}

function getScrimGameFields(game) {
  return SCRIM_GAME_FIELDS[game] || SCRIM_GAME_FIELDS.Valorant
}

const ENHANCED_MOCK_SCRIMS = [
  { id: 301, team: 'Glitch Core', tag: 'GLC', game: 'Mobile Legends', region: 'LAN', time: '20:00 UTC', timeWindow: '20:00 - 23:00 UTC', format: 'BO3', title: 'Buscamos rival Mitico para macro y Lord control', level: 'Mitico+', roster: 'Roster completo 5/5, coach observando', mapPool: 'Custom Draft', focus: 'Early invade, turtle setup, cierre con Lord', rules: 'Sin pausas mayores a 5 min, draft competitivo', priorityMode: 'prioridad_vs', targetTeam: 'Phoenix Esports', contact: '@glitchcore', record: '12-4', winRate: 75, tier: 'Profesional', color: '#FF4655' },
  { id: 302, team: 'Alpha Wolves', tag: 'AW', game: 'Valorant', region: 'LAN', time: '22:30 UTC', timeWindow: '22:00 - 00:00 UTC', format: 'BO3', title: 'VS Ascendente para probar mapa pool competitivo', level: 'Ascendente / Inmortal', roster: 'IGL, controller fijo, sentinel flexible', mapPool: 'Ascent, Haven, Bind', focus: 'Defaults, retakes y economia post plant', rules: 'VOD permitido, servidor Miami', priorityMode: 'anytime', targetTeam: 'Abierto', contact: '@alphawolves', record: '9-6', winRate: 60, tier: 'Semi-Pro', color: '#0072F5' },
  { id: 303, team: 'Cyber Queens', tag: 'CQ', game: 'League of Legends', region: 'EUW', time: '19:00 UTC', timeWindow: '18:30 - 21:00 UTC', format: 'BO1', title: 'Scrim LoL Platino para practicar bot prio', level: 'Platino / Esmeralda', roster: 'Bot lane fija, mid control mage', mapPool: 'Summoner Rift Tournament Draft', focus: 'Herald tempo, bot prio, Nashor setup', rules: 'Draft serio, remake antes minuto 3', priorityMode: 'weekly_upset', targetTeam: 'Equipo superior semanal', contact: '@cyberqueens', record: '7-5', winRate: 58, tier: 'Femenino', color: '#FF4FD8' },
  { id: 304, team: 'Royal Dynasty', tag: 'RD', game: 'Tekken 8', region: 'Global', time: '18:00 UTC', timeWindow: '18:00 - 20:00 UTC', format: 'FT5', title: 'Lobby FT5 para matchup lab y adaptacion', level: 'Tekken King+', roster: 'Jin / Reina / Dragunov', mapPool: 'FT5 con cambio de personaje permitido', focus: 'Castigo, whiff punish, adaptacion por ronda', rules: 'Cable recomendado, ping estable', priorityMode: 'prioridad_vs', targetTeam: 'Duelistas top', contact: '@royaldynasty', record: '14-8', winRate: 64, tier: 'Legendario', color: '#FACC15' }
]

ENHANCED_MOCK_SCRIMS[0] = {
  ...ENHANCED_MOCK_SCRIMS[0],
  title: 'Buscamos rival nuevo para macro y Lord control',
  priorityMode: 'weekly_upset',
  targetTeam: 'Equipos nuevos',
  plan: 'Retador',
  planStatus: 'Activo',
  challengerPlanActive: true
}

const LFT_ROLE_SUGGESTIONS = {
  'Mobile Legends': ['Gold lane', 'Jungla', 'Roamer', 'Mid', 'EXP lane'],
  'League of Legends': ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
  'Dota 2': ['Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Pos 5'],
  Valorant: ['Duelista', 'Iniciador', 'Controller', 'Sentinel', 'IGL'],
  CS2: ['Rifler', 'AWPer', 'Entry', 'Lurker', 'IGL'],
  'Apex Legends': ['IGL', 'Fragger', 'Anchor', 'Support'],
  Fortnite: ['IGL', 'Fragger', 'Support', 'Builder'],
  'Free Fire': ['Rush', 'Soporte', 'Sniper', 'Caller'],
  'Rocket League': ['Striker', 'Third man', 'Flex', 'Goalkeeper'],
  'Tekken 8': ['Main', 'Secondary', 'Matchup lab', 'Coach']
}

const LFT_RECOMMENDED_TEAMS = [
  { id: 'rec-1', team: 'Alpha Wolves', game: 'Valorant', needs: 'Controller / Sentinel', fit: '92%', schedule: 'Noches LAN', level: 'Ascendente+' },
  { id: 'rec-2', team: 'Cyber Queens', game: 'League of Legends', needs: 'Support shotcaller', fit: '87%', schedule: 'Mar/Jue 20:00', level: 'Platino+' },
  { id: 'rec-3', team: 'Glitch Core', game: 'Mobile Legends', needs: 'Roamer suplente', fit: '84%', schedule: 'Fines de semana', level: 'Mitico+' }
]

const INITIAL_MOCK_VACANCIES = [
  { id: 401, team: 'Alpha Wolves', role: 'Duelista', level: 'Semi-Pro', desc: 'Buscamos duelista activo para scrims de noche y torneos semanales.' },
  { id: 402, team: 'Cyber Queens', role: 'Support', level: 'Amateur', desc: 'Buscamos soporte carismática para equipo femenino de LoL.' }
]

// ─── Códigos de equipo según la convención oficial del backend ───────────────
//   público   → TEAM-{secuencia}-{país}            ej: TEAM-001-01
//   extenso   → TEAM-{YYMMDD}-{secuencia}-{país}   ej: TEAM-260603-001-01
//   (país en 2 dígitos: RD = 01, MX = 02, AR = 03 …)
const TEAM_COUNTRY_NUM = {
  'RD': '01', 'REPÚBLICA DOMINICANA': '01', 'DOMINICANA': '01', 'REP. DOMINICANA': '01', 'DOMINICAN REPUBLIC': '01',
  'MX': '02', 'MÉXICO': '02', 'MEXICO': '02',
  'AR': '03', 'ARGENTINA': '03',
}
function teamCountryNum(region) {
  return TEAM_COUNTRY_NUM[String(region || '').toUpperCase()] || '01'
}
// Secuencia determinista de 3 dígitos a partir de un texto base (tag/nombre/id)
function teamSeq(basis) {
  const base = String(basis ?? '1')
  let h = 0
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0
  return String((h % 999) + 1).padStart(3, '0')
}
function yymmdd(date) {
  const d = date ? new Date(date) : new Date()
  if (Number.isNaN(d.getTime())) return yymmdd(new Date())
  return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
function teamPublicCode(region, basis) {
  return `TEAM-${teamSeq(basis)}-${teamCountryNum(region)}`
}
function teamInternalCode(region, basis, date) {
  return `TEAM-${yymmdd(date)}-${teamSeq(basis)}-${teamCountryNum(region)}`
}
// Compatibilidad con llamadas previas: devuelve el código público.
function generateTeamId(gameName, countryName, tag) {
  return teamPublicCode(countryName, tag || gameName)
}

// Subidor de foto reutilizable (logo del equipo o foto de jugador)
function PhotoUpload({ value, onChange, variant = 'player', label }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const handleFile = async (file) => {
    if (!file || uploading) return
    setUploading(true)
    try {
      const res = await uploadFile(file)
      if (!res?.url) throw new Error('Upload sin URL')
      onChange(res.url)
    } catch (error) {
      toast(error?.message || 'No se pudo subir la imagen.', 'error')
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className={`gg-photo-upload gg-photo-upload--${variant}`}>
      <button
        type="button"
        className="gg-photo-upload__btn"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={label || 'Subir foto'}
      >
        {value ? (
          <img src={value} alt="preview" />
        ) : (
          <span className="gg-photo-upload__ph">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </span>
        )}
        <span className="gg-photo-upload__cam">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
      </button>
      <span className="gg-photo-upload__label" style={{ color: '#ef4444' }}>{label || 'Foto profesional'}</span>
      {uploading && <span className="gg-photo-upload__label">Subiendo...</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}

function RosterSlotField({ label, children }) {
  return (
    <label className="gg-slot-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function TeamCreateDcWizard({
  isEs,
  user,
  creationStep,
  setCreationStep,
  setIsCreating,
  formName,
  setFormName,
  formTag,
  setFormTag,
  formSlogan,
  setFormSlogan,
  formDescription,
  setFormDescription,
  descriptionTouched,
  setDescriptionTouched,
  formGender,
  setFormGender,
  formRegion,
  setFormRegion,
  formCountry,
  setFormCountry,
  formTiers,
  formJoinScope,
  setFormJoinScope,
  onSaveDraft,
  resumed,
  formCommunity,
  setFormCommunity,
  formSponsor,
  setFormSponsor,
  formCategory,
  setFormCategory,
  formGame,
  setFormGame,
  formLang,
  setFormLang,
  formLevel,
  setFormLevel,
  formLogo,
  setFormLogo,
  captName,
  setCaptName,
  captNick,
  setCaptNick,
  captTag,
  setCaptTag,
  captRole,
  setCaptRole,
  captSlotKey,
  setCaptSlotKey,
  rosterInputs,
  rosterPlayerForms,
  setRosterPlayerForms,
  selectableTierKeys,
  configs,
  handleToggleTier,
  handleStep1Submit,
  handleStep2Submit,
  createdTeamData,
  GAME_CATEGORIES,
  GAME_ROSTER_SLOTS_LABELS,
}) {
  const [screen, setScreen] = useState(resumed ? 'wizard' : 'intro')
  const [open, setOpen] = useState('identity')
  const [rosterTab, setRosterTab] = useState('slots')
  const [copied, setCopied] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const navigate = useNavigate()
  // Which step the user last tried to leave while incomplete — turns on the
  // red field markers for that step only (so a fresh form isn't a wall of red).
  const [triedStep, setTriedStep] = useState(0)

  const starters = Object.keys(rosterInputs).filter(k => k.startsWith('titular'))
  const subs = Object.keys(rosterInputs).filter(k => k.startsWith('sub'))
  const starterCount = starters.length || 5

  const discordLinked = Boolean(user?.discord?.id)
  const whatsappVerified = Boolean(user?.whatsapp?.verified)

  // A team can be created by an owner/admin who may not play. The creator data
  // comes from registration; roster slots stay optional and can be filled later.
  const ownerMissing = () => {
    const miss = []
    if (!String(captName || '').trim()) miss.push(isEs ? 'nombre' : 'name')
    if (!String(captNick || '').trim()) miss.push('nick')
    if (!String(captTag || '').trim()) miss.push(isEs ? 'tag competitivo' : 'competitive tag')
    return miss
  }
  const slotMissing = () => []
  const starterComplete = (key) => {
    const row = rosterPlayerForms[key] || {}
    return Boolean(row.gameNick || row.name)
  }
  const ownerReady = ownerMissing().length === 0
  const filledStarters = starters.filter((k, i) => {
    const row = rosterPlayerForms[k] || {}
    return Boolean(row.gameNick || row.name)
  }).length
  const cleanTeamTag = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)

  const regionOpts = [
    { value: 'CAR', label: isEs ? 'CAR · Caribe' : 'CAR · Caribbean' },
    { value: 'CAM', label: isEs ? 'CAM · Centroamerica' : 'CAM · Central America' },
    { value: 'LAN', label: isEs ? 'LAN · LATAM Norte' : 'LAN · LATAM North' },
    { value: 'LAS', label: isEs ? 'LAS · LATAM Sur' : 'LAS · LATAM South' },
    { value: 'NA', label: isEs ? 'NA · Norteamerica' : 'NA · North America' },
    { value: 'EU', label: isEs ? 'EU · Europa' : 'EU · Europe' },
  ]
  const countryOpts = [
    { value: 'GLB', label: 'GLB · Global' },
    { value: 'RD', label: isEs ? 'RD · Republica Dominicana' : 'RD · Dominican Republic' },
    { value: 'PR', label: 'PR · Puerto Rico' },
    { value: 'CU', label: 'CU · Cuba' },
    { value: 'JM', label: 'JM · Jamaica' },
    { value: 'HT', label: 'HT · Haiti' },
    { value: 'MX', label: 'MX · Mexico' },
    { value: 'GT', label: 'GT · Guatemala' },
    { value: 'HN', label: 'HN · Honduras' },
    { value: 'SV', label: 'SV · El Salvador' },
    { value: 'NI', label: 'NI · Nicaragua' },
    { value: 'CR', label: 'CR · Costa Rica' },
    { value: 'PA', label: 'PA · Panama' },
    { value: 'CO', label: 'CO · Colombia' },
    { value: 'VE', label: 'VE · Venezuela' },
    { value: 'EC', label: 'EC · Ecuador' },
    { value: 'PE', label: 'PE · Peru' },
    { value: 'BO', label: 'BO · Bolivia' },
    { value: 'CL', label: 'CL · Chile' },
    { value: 'AR', label: 'AR · Argentina' },
    { value: 'UY', label: 'UY · Uruguay' },
    { value: 'PY', label: 'PY · Paraguay' },
    { value: 'BR', label: 'BR · Brasil' },
    { value: 'US', label: 'US · Estados Unidos' },
    { value: 'CA', label: 'CA · Canada' },
    { value: 'ES', label: 'ES · Espana' },
    { value: 'ASIA', label: 'ASIA' },
    { value: 'OCE', label: 'OCE · Oceania' },
    { value: 'MENA', label: 'MENA' },
  ]
  const langOpts = isEs ? ['Espanol', 'Ingles', 'Bilingue', 'Portugues'] : ['Spanish', 'English', 'Bilingual', 'Portuguese']
  const moreLangOpts = isEs
    ? ['Frances', 'Italiano', 'Aleman', 'Arabe', 'Chino', 'Japones', 'Coreano', 'Ruso', 'Hindi', 'Criollo haitiano', 'Otro']
    : ['French', 'Italian', 'German', 'Arabic', 'Chinese', 'Japanese', 'Korean', 'Russian', 'Hindi', 'Haitian Creole', 'Other']
  const levelOpts = isEs ? ['Casual', 'Amateur', 'Semi-Pro', 'Profesional'] : ['Casual', 'Amateur', 'Semi-Pro', 'Professional']
  const genderOpts = isEs ? ['Mixto', 'Masculino', 'Femenino'] : ['Mixed', 'Male', 'Female']
  const regionName = (code) => regionOpts.find(r => r.value === code)?.label.split(' · ')[1] || code
  const joinScopeOpts = [
    { value: 'open', label: isEs ? 'Abierto a todos' : 'Open to everyone' },
    ...(formCountry && regionForCountry(formCountry) ? [{ value: 'country', label: isEs ? `Solo de ${formCountry}` : `${formCountry} only` }] : []),
    ...(formRegion ? [{ value: 'region', label: isEs ? `Solo de ${regionName(formRegion)}` : `${regionName(formRegion)} only` }] : []),
  ]
  const catalogCategories = GAMES_BY_CATEGORY.filter(category => category.id !== 'esports' && category.games?.length)
  const selectedCatalogCategory = catalogCategories.find(category => category.name === formCategory)
  const catOpts = catalogCategories.map(category => ({
    value: category.name,
    label: category.name,
    count: category.games.length,
  }))
  const gameOpts = selectedCatalogCategory
    ? selectedCatalogCategory.games
    : GAMES.filter(game => game.isEsport).slice(0, 12)
  const teamTag = cleanTeamTag(formTag) || 'GG'
  const teamTagReady = teamTag.length >= 2 && teamTag.length <= 5
  const defaultSponsorLabel = 'GlitchGang Partner'
  const defaultDescription = formName
    ? (isEs
      ? `Somos el equipo ${formName}, una escuadra de GlitchGang lista para competir con disciplina, estrategia y buena vibra en cada partida.`
      : `We are ${formName}, a GlitchGang squad built to compete with discipline, strategy and sharp team energy.`)
    : ''
  const communityOpts = ['Steliant Community', 'INTEC Esports', 'PUCMM Gaming', 'ITLA Arena', 'Steliant Esports Official']
  const tierDesc = {
    nuevo: isEs ? 'Menos de 6 meses' : 'Under 6 months old',
    universitario: isEs ? 'Representa una universidad' : 'Represents a university',
    femenino: isEs ? 'Roster femenino' : 'All-female roster',
    profesional: isEs ? 'Contrato o sueldo' : 'Contracted or salaried',
  }

  // Femenino = solo mujeres, incluida quien crea el equipo.
  const genderBlocked = teamGenderKey(formGender) === 'female' && user?.gender !== 'female'
  const wantsUniversity = formTiers.includes('universitario')
  const uniVerified = user?.university?.verificationStatus === 'verified'
  // Cada universidad tiene UN equipo oficial por juego: se consulta antes de
  // enviar para no dejar al usuario llenar todo y recibir el rechazo al final.
  const [uniSlot, setUniSlot] = useState(null) // { taken, team } | null
  useEffect(() => {
    if (!wantsUniversity || !uniVerified || !formGame) { setUniSlot(null); return undefined }
    let cancelled = false
    api(`/teams/university-slot?game=${encodeURIComponent(formGame)}`)
      .then(data => { if (!cancelled) setUniSlot(data) })
      .catch(() => { if (!cancelled) setUniSlot(null) })
    return () => { cancelled = true }
  }, [wantsUniversity, uniVerified, formGame])
  const uniSlotTaken = Boolean(uniSlot?.taken)
  const uniBlocked = wantsUniversity && (!uniVerified || uniSlotTaken)
  const goVerify = (path) => {
    onSaveDraft?.()
    navigate(path, { state: { returnToTeamDraft: true } })
  }

  const secDefs = [
    {
      id: 'identity', code: 'A1', title: isEs ? 'Identidad' : 'Identity',
      done: Boolean(formName && teamTagReady && formRegion && formLang && formLevel && !genderBlocked),
      summary: [formName && `${formName} [${teamTag}]`, formRegion, formCountry, formLang, formLevel].filter(Boolean).join('  ·  ') || (isEs ? 'Nombre, region, idioma y nivel' : 'Name, region, language and level'),
    },
    {
      id: 'game', code: 'A2', title: isEs ? 'Disciplina y juego' : 'Discipline & game',
      done: Boolean(formGame),
      summary: [formCategory, formGame].filter(Boolean).join('  ·  ') || (isEs ? 'Selecciona categoria y juego' : 'Select category and game'),
    },
    {
      id: 'tiers', code: 'A3', title: isEs ? 'Universidad' : 'University',
      done: !uniBlocked,
      summary: wantsUniversity
        ? (!uniVerified
          ? (isEs ? 'Falta verificar tu universidad' : 'Verify your university first')
          : uniSlotTaken
            ? (isEs ? `Tu universidad ya tiene equipo oficial de ${formGame}` : `Your university already has an official ${formGame} team`)
            : `${isEs ? 'Equipo universitario' : 'University team'} · ${user.university.universityTag || user.university.universityName || ''}`)
        : (isEs ? 'Opcional · equipo que representa a tu universidad' : 'Optional · team representing your university'),
    },
    {
      id: 'captain', code: 'A4', title: isEs ? 'Capitan' : 'Captain',
      done: ownerReady,
      summary: [captName, captNick, captTag].filter(Boolean).join('  ·  ') || (isEs ? 'Datos del creador' : 'Creator details'),
    },
    {
      id: 'profile', code: 'A5', title: isEs ? 'Perfil de escuadra' : 'Squad profile',
      done: Boolean(formDescription.trim().length > 10),
      summary: [
        formDescription.trim().length > 10 ? (isEs ? 'Descripcion lista' : 'Description ready') : null,
        formSponsor || (isEs ? 'Partner opcional' : 'Optional partner'),
        formCommunity || (isEs ? 'Comunidad opcional' : 'Optional community'),
      ].filter(Boolean).join('  ·  '),
    },
  ]
  const step1Total = secDefs.length
  const step1Done = secDefs.filter(s => s.done).length
  const step1Missing = secDefs.filter(s => !s.done)
  const rosterDone = true
  const allPending = step1Missing.length + (rosterDone ? 0 : 1)
  const pct = creationStep === 3 ? 100 : Math.round(((step1Done + (rosterDone ? 1 : 0)) / (step1Total + 1)) * 100)
  const firstPending = step1Missing[0]

  const stepInfo = [
    { done: step1Done, total: step1Total },
    { done: rosterDone ? 1 : 0, total: 1 },
    { done: 0, total: 0 },
  ]
  const barLabels = [isEs ? 'Identidad' : 'Identity', 'Roster', isEs ? 'Publicar' : 'Publish']
  const bars = [0, 1, 2].map(i => {
    const info = stepInfo[i]
    const barPct = i === 2 ? (allPending === 0 ? 100 : 0) : (info.total ? Math.round((info.done / info.total) * 100) : 0)
    return {
      step: i + 1,
      code: `0${i + 1}`,
      label: barLabels[i],
      pct: `${barPct}%`,
      meta: i === 2 ? (allPending === 0 ? (isEs ? 'Listo' : 'Ready') : '') : `${info.done}/${info.total}`,
    }
  })

  const stepCopy = {
    1: { title: isEs ? 'Identidad' : 'Identity', sub: isEs ? 'Quien es tu equipo y donde compite.' : 'Who your team is and where it plays.' },
    2: { title: 'Roster', sub: isEs ? 'Agrega jugadores ahora o comparte el link para que se unan despues.' : 'Add players now or share the link so they can join later.' },
    3: { title: isEs ? 'Publicar' : 'Publish', sub: isEs ? 'Revisa como se vera y publicalo.' : 'Check how it looks, then publish.' },
  }[creationStep]
  const stepCode = `GG · SETUP-0${creationStep} · ${teamTag}`
  const panelCode = `S0${creationStep}/03 · ${pct}%`
  const panelState = allPending === 0 ? (isEs ? 'TODO LISTO' : 'ALL SET') : `${isEs ? 'FALTAN' : 'MISSING'} ${allPending}`

  // Action-bar status: say exactly what is missing and where to go.
  const capMiss = ownerMissing()
  let pendingLabel, pendingDetail, pendingTarget
  if (allPending === 0) {
    pendingLabel = isEs ? 'Todo listo' : 'All set'
    pendingDetail = isEs ? 'Puedes crear tu equipo' : 'You can create your team'
    pendingTarget = null
  } else if (creationStep === 2 && !rosterDone) {
    pendingLabel = isEs ? 'Falta el capitan' : 'Captain incomplete'
    pendingDetail = (isEs ? 'Completa: ' : 'Complete: ') + capMiss.join(', ')
    pendingTarget = { step: 2 }
  } else if (step1Missing.length) {
    pendingLabel = isEs
      ? `Faltan ${step1Missing.length} secci${step1Missing.length === 1 ? 'on' : 'ones'}`
      : `${step1Missing.length} section${step1Missing.length === 1 ? '' : 's'} left`
    pendingDetail = (isEs ? 'Completa: ' : 'Complete: ') + step1Missing.map(s => s.title).join(', ')
    pendingTarget = { step: 1, section: firstPending?.id }
  } else {
    pendingLabel = isEs ? 'Siguiente: Roster' : 'Next: Roster'
    pendingDetail = isEs ? 'Puedes invitar jugadores ahora o despues' : 'You can invite players now or later'
    pendingTarget = { step: 2 }
  }
  const goToPending = () => {
    if (!pendingTarget) return
    if (pendingTarget.step === 1) {
      setCreationStep(1)
      if (pendingTarget.section) setOpen(pendingTarget.section)
    } else {
      setCreationStep(2)
    }
  }
  const nextLabel = creationStep === 3
    ? (isEs ? 'Cerrar' : 'Close')
    : creationStep === 2
      ? (isEs ? 'Crear equipo' : 'Create team')
      : (isEs ? 'Continuar' : 'Continue')
  const stepReady = creationStep === 1 ? step1Done >= step1Total : creationStep === 2 ? rosterDone : true
  const showInvalid = triedStep === creationStep
  const backLabel = creationStep === 1 ? (isEs ? 'Cancelar' : 'Cancel') : (isEs ? 'Atras' : 'Back')
  const eqBars = [10, 18, 7, 24, 13, 20]

  // El codigo lo genera el backend al guardar el equipo, asi que antes de
  // crearlo no hay link real que mostrar. /equipos/unirse/:code (JoinTeam)
  // mete al jugador directo al roster con POST /teams/join.
  const inviteCode = createdTeamData?.teamInviteCode || ''
  const inviteLink = inviteCode ? `${window.location.origin}/equipos/unirse/${inviteCode}` : ''
  const copyLabel = copied ? (isEs ? 'Copiado' : 'Copied') : (isEs ? 'Copiar link' : 'Copy link')
  const copyLink = () => {
    if (!inviteLink) {
      toast(isEs ? 'El link de invitacion aparece cuando el equipo ya esta creado.' : 'The invite link appears once the team is created.', 'info')
      return
    }
    try { navigator.clipboard?.writeText(inviteLink) } catch { /* clipboard unavailable */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const shareLink = () => {
    if (!inviteLink) return copyLink()
    const name = createdTeamData?.name || (isEs ? 'mi equipo' : 'my team')
    if (navigator.share) {
      navigator.share({ title: name, text: isEs ? `Unete a ${name} en GlitchGang` : `Join ${name} on GlitchGang`, url: inviteLink }).catch(() => {})
    } else {
      copyLink()
    }
  }

  useEffect(() => {
    if (!descriptionTouched && defaultDescription && formDescription !== defaultDescription) {
      setFormDescription(defaultDescription)
    }
  }, [defaultDescription, descriptionTouched, formDescription, setFormDescription])

  const gotoStep = (step) => {
    // Free navigation between steps 1 and 2 (like design B); step 3 only once created.
    if (step === 3 && !createdTeamData) { setCreationStep(2); return }
    setCreationStep(step)
  }
  const handleNext = (e) => {
    if (creationStep === 3) { setIsCreating(false); return }
    if (!stepReady) {
      setTriedStep(creationStep)
      if (creationStep === 1 && firstPending) {
        setOpen(firstPending.id)
        toast(isEs ? `Completa: ${step1Missing.map(s => s.title).join(', ')}` : `Complete: ${step1Missing.map(s => s.title).join(', ')}`, 'error')
      } else if (creationStep === 2) {
        setRosterTab('slots')
        setTimeout(() => document.querySelector(`[data-slot="${captSlotKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40)
        toast(isEs ? `Falta el capitan: ${capMiss.join(', ')}` : `Captain incomplete: ${capMiss.join(', ')}`, 'error')
      }
      return
    }
    setTriedStep(0)
    if (creationStep === 1) handleStep1Submit(e)
    else if (creationStep === 2) handleStep2Submit(e)
  }
  const handleBack = () => {
    setTriedStep(0)
    if (creationStep === 1) setIsCreating(false)
    else setCreationStep(creationStep - 1)
  }

  const updRow = (key, patch) => setRosterPlayerForms(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const renderChips = (label, options, value, onPick, required, more = null) => {
    const bad = showInvalid && required && !value
    const moreOptions = more?.options || []
    const toOption = option => typeof option === 'string' ? { value: option, label: option } : option
    const hasMoreValue = moreOptions.some(option => toOption(option).value === value)
    return (
      <div className="dcb-choice" data-invalid={bad || undefined}>
        <span>{label}{bad && <b className="dcb-req"> · {isEs ? 'requerido' : 'required'}</b>}</span>
        <div className="dcb-chips">
          {options.map(raw => {
            const opt = toOption(raw)
            return (
            <button
              type="button"
              key={opt.value}
              className="dcb-chip"
              data-active={value === opt.value || undefined}
              onClick={() => onPick(value === opt.value ? '' : opt.value)}
            >
              <span>{opt.label}</span>
              {Number.isFinite(opt.count) && <small>{opt.count}</small>}
            </button>
            )
          })}
        </div>
        {moreOptions.length > 0 && (
          <label className="dcb-more-select">
            <span>{more.label}</span>
            <select className="dcb-input" value={hasMoreValue ? value : ''} onChange={e => onPick(e.target.value)}>
              <option value="">{more.placeholder}</option>
              {moreOptions.map(raw => {
                const opt = toOption(raw)
                return <option key={opt.value} value={opt.value}>{opt.label}</option>
              })}
            </select>
          </label>
        )}
      </div>
    )
  }

  const renderSlotForm = (key, idx) => {
    const num = key.split('-')[1]
    const isStarter = key.startsWith('titular')
    const isCaptain = key === captSlotKey
    const roleLabel = isStarter
      ? (GAME_ROSTER_SLOTS_LABELS[formGame]?.titulares?.[parseInt(num, 10) - 1] || `${isEs ? 'Titular' : 'Starter'} ${num}`)
      : `${isEs ? 'Suplente' : 'Sub'} ${num}`
    const row = rosterPlayerForms[key] || {}
    const missing = []
    const inv = (v) => isCaptain && showInvalid && !String(v || '').trim()
    return (
      <article className="dcb-rform" key={key} data-optional={!isCaptain || undefined} data-incomplete={isCaptain && showInvalid && missing.length ? true : undefined} data-slot={key}>
        <div className="dcb-rform__head">
          <PhotoUpload value={row.photo} onChange={photo => updRow(key, { photo })} />
          <div>
            <strong>{roleLabel}{isCaptain && <span className="dcb-rform__cap">{isEs ? 'Capitan' : 'Captain'}</span>}</strong>
            <small>
              {!isCaptain
                ? (isEs ? 'Opcional — se puede unir con el link' : 'Optional — can join with the link')
                : missing.length
                  ? <span className="dcb-req">{(isEs ? 'Falta: ' : 'Missing: ') + missing.join(', ')}</span>
                  : <span className="dcb-ok">{Icon.check} {isEs ? 'Listo' : 'Ready'}</span>}
            </small>
          </div>
          {!isCaptain && (
            <button type="button" className="dcb-verify-btn" onClick={() => {
              setCaptSlotKey(key)
              setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], gameNick: p[key]?.gameNick || captNick, name: p[key]?.name || captName } }))
            }}>
              {isEs ? 'Este soy yo' : 'This is me'}
            </button>
          )}
          <em>{isStarter ? String(num).padStart(2, '0') : 'SUB'}</em>
        </div>
        <div className="dcb-rform__grid">
          <label className="dcb-field"><span>{isEs ? 'Nombre completo' : 'Full name'}{isCaptain && ' *'}</span><input className="dcb-input" data-invalid={inv(row.name) || undefined} value={row.name || ''} onChange={e => updRow(key, { name: e.target.value })} placeholder={isEs ? 'Nombre legal' : 'Legal name'} /></label>
          <label className="dcb-field"><span>{isEs ? 'Nick en juego' : 'In-game nick'}{isCaptain && ' *'}</span><input className="dcb-input" data-invalid={inv(row.gameNick) || undefined} value={row.gameNick || ''} onChange={e => updRow(key, { gameNick: e.target.value })} placeholder={isEs ? 'Alias competitivo' : 'Competitive alias'} /></label>
          <label className="dcb-field"><span className="dcb-field__ic">{Icon.gamepad}{gameAccountFormat(formGame).label}</span><input className="dcb-input" value={row.gameId || ''} onChange={e => updRow(key, { gameId: e.target.value })} onBlur={() => { const c = checkGameAccountId(formGame, row.gameId); if (c.ok && c.value !== (row.gameId || '')) updRow(key, { gameId: c.value }) }} placeholder={gameAccountFormat(formGame).placeholder} data-no-translate />{(() => { const c = checkGameAccountId(formGame, row.gameId); return !c.ok ? <small className="dcb-field__hint" data-bad={c.strict || undefined}>{c.message}</small> : null })()}</label>

          {isCaptain ? (
            <>
              <label className="dcb-field"><span className="dcb-field__ic">{Icon.discord}Discord *</span>
                {discordLinked
                  ? <div className="dcb-linked"><b>{Icon.check}{user.discord.username}</b><small>{isEs ? 'Vinculado' : 'Linked'}</small></div>
                  : <a className="dcb-verify-btn" data-invalid={(showInvalid && !discordLinked) || undefined} href="/conectar-discord?volver=equipo" target="_blank" rel="noreferrer" onClick={() => onSaveDraft?.()}>{Icon.discord} {isEs ? 'Conectar con Discord' : 'Connect with Discord'}</a>}
              </label>
              {WHATSAPP_ENABLED && (
                <label className="dcb-field"><span className="dcb-field__ic">{Icon.whatsapp}WhatsApp *</span>
                  {whatsappVerified
                    ? <div className="dcb-linked"><b>{Icon.check}{user.whatsapp.phone}</b><small>{isEs ? 'Verificado' : 'Verified'}</small></div>
                    : <a className="dcb-verify-btn" data-invalid={(showInvalid && !whatsappVerified) || undefined} href="/vincular-whatsapp" target="_blank" rel="noreferrer">{Icon.whatsapp} {isEs ? 'Verificar WhatsApp' : 'Verify WhatsApp'}</a>}
                </label>
              )}
            </>
          ) : (
            <>
              <label className="dcb-field"><span className="dcb-field__ic">{Icon.discord}Discord</span>
                <button type="button" className="dcb-verify-btn" onClick={() => setRosterTab('invite')}>
                  {Icon.discord} {isEs ? 'Invitar por link' : 'Invite by link'}
                </button>
              </label>
              {WHATSAPP_ENABLED && (
                <label className="dcb-field"><span className="dcb-field__ic">{Icon.whatsapp}WhatsApp</span><input className="dcb-input" value={row.whatsapp || ''} onChange={e => updRow(key, { whatsapp: e.target.value })} placeholder={isEs ? 'Numero (opcional)' : 'Number (optional)'} /></label>
              )}
            </>
          )}

        </div>
      </article>
    )
  }

  if (screen === 'intro') {
    const introSteps = [
      { num: '01', title: isEs ? 'Identidad' : 'Identity', desc: isEs ? 'Equipo, juego y creador.' : 'Team, game and creator.', time: '3 min' },
      { num: '02', title: 'Roster', desc: isEs ? 'Invita o busca a tus jugadores.' : 'Invite or search your players.', time: '2 min' },
      { num: '03', title: isEs ? 'Publicar' : 'Publish', desc: isEs ? 'Publica y compartelo.' : 'Publish and share it.', time: '30 s' },
    ]
    return (
      <div className="dcb">
        <motion.section
          className="dcb-empty"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="dcb-empty__eyebrow">
            <span className="dcb-ticks"><i /><i /><i /></span>
            <span className="dcb-mono">GG · TEAM-SETUP · 03 {isEs ? 'PASOS' : 'STEPS'}</span>
          </div>
          <h1 className="dcb-empty__h">{isEs ? 'Arma tu escuadra' : 'Build your squad'}</h1>
          <p className="dcb-empty__p">
            {isEs
              ? 'Tres pasos y quedas listo para scrims y torneos. Puedes guardar y volver cuando quieras.'
              : 'Three steps and you are ready for scrims and tournaments. Save and come back any time.'}
          </p>
          <div className="dcb-empty__actions">
            <button type="button" className="dcb-btn dcb-btn--primary dcb-btn--lg" onClick={() => setScreen('wizard')}>
              {isEs ? 'Crear equipo' : 'Create team'}
            </button>
            <button type="button" className="dcb-btn dcb-btn--ghost dcb-btn--lg" onClick={() => setJoinOpen(v => !v)}>
              {isEs ? 'Unirme con codigo' : 'Join with code'}
            </button>
          </div>
          {joinOpen && (
            <form
              className="dcb-join-code"
              onSubmit={e => {
                e.preventDefault()
                // Acepta el codigo solo o el link completo pegado tal cual.
                const code = joinCode.trim().split('/').filter(Boolean).pop()?.toUpperCase()
                if (!code) return
                navigate(`/equipos/unirse/${encodeURIComponent(code)}`)
              }}
            >
              <input
                className="dcb-input"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder={isEs ? 'Codigo o link de invitacion' : 'Invite code or link'}
                autoFocus
              />
              <button type="submit" className="dcb-btn dcb-btn--primary" disabled={!joinCode.trim()}>
                {isEs ? 'Unirme' : 'Join'}
              </button>
            </form>
          )}
          <div className="dcb-empty__steps">
            {introSteps.map(s => (
              <div className="dcb-srow" key={s.num}>
                <span className="dcb-mono dcb-srow__num">{s.num}</span>
                <div className="dcb-srow__body">
                  <div className="dcb-srow__title">{s.title}</div>
                  <div className="dcb-srow__desc">{s.desc}</div>
                </div>
                <span className="dcb-srow__stripe" aria-hidden="true" />
                <span className="dcb-mono dcb-srow__time">{s.time}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    )
  }

  const summaryRows = [
    { k: isEs ? 'Equipo' : 'Team', val: formName ? `${formName}  [${teamTag}]` : null },
    { k: isEs ? 'Juego' : 'Game', val: formGame || null },
    { k: isEs ? 'Region' : 'Region', val: [formRegion, formCountry, formLang].filter(Boolean).join(' · ') || null },
    { k: isEs ? 'Nivel' : 'Level', val: formLevel || null },
    { k: isEs ? 'Divisiones' : 'Divisions', val: formTiers.map(key => configs[key]?.label || key).join(', ') || null },
    { k: isEs ? 'Creador' : 'Creator', val: captNick ? `${captName || captNick} · ${captNick}` : null },
    { k: isEs ? 'Patrocinador' : 'Sponsor', val: formSponsor || null },
    { k: 'Roster', val: `${filledStarters}/5` },
  ]
  const previewName = createdTeamData?.name || formName || (isEs ? 'Tu equipo' : 'Your team')
  const previewTag = String(createdTeamData?.tag || teamTag || 'GG').toUpperCase().slice(0, 4)
  const previewMeta = [formGame, formRegion, formCountry, formLevel].filter(Boolean).join(' · ') || '—'
  const previewTiers = formTiers.map(key => configs[key]?.label || key)
  const previewMembers = [
    ...starters.map(k => {
      const row = rosterPlayerForms[k] || {}
      return row.gameNick || row.name || ''
    }).filter(Boolean),
  ].slice(0, 5).map(n => (String(n)[0] || '?').toUpperCase())
  const previewStats = [
    { k: isEs ? 'Nivel' : 'Level', v: formLevel || '—' },
    { k: isEs ? 'Creador' : 'Creator', v: captNick || '—' },
    { k: 'Roster', v: `${filledStarters}/5` },
  ]

  return (
    <div className="dcb dcb--wizard">
      <div className="dcb__frame">
        <div className="dcb__panel">
          <div className="dcb__rail" aria-hidden="true">
            <span className="dcb__rail-ticks"><i /><i /><i /></span>
            <span className="dcb__rail-label">{isEs ? 'Crear escuadra' : 'Create squad'}</span>
            <span className="dcb-mono">x</span>
          </div>
          <span className="dcb__corner dcb__corner--tr" aria-hidden="true" />
          <span className="dcb__corner dcb__corner--bl" aria-hidden="true" />

          <header className="dcb__head">
            <div className="dcb__head-main">
              <div className="dcb-mono dcb__head-code">{stepCode}</div>
              <h2 className="dcb__head-title">{stepCopy.title}</h2>
              <p className="dcb__head-sub">{stepCopy.sub}</p>
            </div>
            <div className="dcb__meter">
              <span className="dcb__eq" aria-hidden="true">
                {eqBars.map((h, i) => <i key={i} style={{ height: h }} />)}
              </span>
              <span className="dcb__pct"><b>{pct}%</b><span>{isEs ? 'Completo' : 'Complete'}</span></span>
            </div>
          </header>

          <div className="dcb__bars">
            {bars.map(b => (
              <button
                type="button"
                key={b.step}
                className="dcb__bar"
                data-active={creationStep === b.step || undefined}
                onClick={() => gotoStep(b.step)}
              >
                <span className="dcb__bar-track"><span className="dcb__bar-fill" style={{ width: b.pct }} /></span>
                <span className="dcb__bar-meta"><span>{b.code} {b.label}</span><span>{b.meta}</span></span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {creationStep === 1 && (
              <motion.div key="dcb-s1" className="dcb__step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}>
                {secDefs.map(sec => (
                  <section className="dcb-acc" key={sec.id} data-open={open === sec.id || undefined} data-done={sec.done || undefined}>
                    <button type="button" className="dcb-acc__trigger" onClick={() => setOpen(open === sec.id ? '' : sec.id)}>
                      <span className="dcb-mono dcb-acc__code" data-done={sec.done || undefined}>{sec.code}</span>
                      <span className="dcb-acc__dot" data-done={sec.done || undefined}>{sec.done ? Icon.check : Icon.plus}</span>
                      <span className="dcb-acc__label">
                        <span className="dcb-acc__title">{sec.title}</span>
                        <span className="dcb-acc__summary">{sec.summary}</span>
                      </span>
                      <span className="dcb-acc__state" data-done={sec.done || undefined}>{sec.done ? (isEs ? 'Listo' : 'Done') : (isEs ? 'Pendiente' : 'Missing')}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open === sec.id && (
                        <motion.div className="dcb-acc__body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22, ease: [0.16, 1, 0.3, 1] }}>
                          <div className="dcb-acc__inner">
                            {sec.id === 'identity' && (
                              <>
                                <div className="dcb-grid dcb-grid--identity">
                                  <label className="dcb-field"><span>{isEs ? 'Nombre del equipo *' : 'Team name *'}</span><input className="dcb-input" data-invalid={(showInvalid && !formName) || undefined} value={formName} onChange={e => setFormName(e.target.value)} placeholder="Glitch Wolves" /></label>
                                  <label className="dcb-field">
                                    <span>{isEs ? 'Tag del equipo *' : 'Team tag *'}</span>
                                    <input
                                      className="dcb-input"
                                      data-invalid={(showInvalid && !teamTagReady) || undefined}
                                      value={formTag}
                                      onChange={e => setFormTag(cleanTeamTag(e.target.value))}
                                      placeholder="GG"
                                      maxLength={5}
                                    />
                                    <small className="dcb-field__hint">{isEs ? '2 a 5 letras o numeros. No se genera automaticamente.' : '2 to 5 letters or numbers. Not generated automatically.'}</small>
                                  </label>
                                </div>
                                <div className="dcb-choice">
                                  <span>{isEs ? 'Pais' : 'Country'}</span>
                                  <label className="dcb-more-select">
                                    <select className="dcb-input" value={formCountry} onChange={e => {
                                      const next = e.target.value
                                      setFormCountry(next)
                                      // La region sale del pais para que no queden RD + LATAM Sur.
                                      const autoRegion = regionForCountry(next)
                                      if (autoRegion) setFormRegion(autoRegion)
                                    }}>
                                      <option value="">{isEs ? 'Selecciona tu pais' : 'Select your country'}</option>
                                      {countryOpts.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                {renderChips(isEs ? 'Region *' : 'Region *', regionOpts, formRegion, value => {
                                  setFormRegion(value)
                                  // Si el pais no pertenece a la region elegida, se quita el pais.
                                  if (formCountry && regionForCountry(formCountry) && regionForCountry(formCountry) !== value) setFormCountry('')
                                }, true)}
                                {renderChips(isEs ? 'Quien puede unirse' : 'Who can join', joinScopeOpts, formJoinScope, value => setFormJoinScope(value || 'open'))}
                                {renderChips(isEs ? 'Idioma *' : 'Language *', langOpts, formLang, setFormLang, true, {
                                  label: isEs ? 'Mas idiomas' : 'More languages',
                                  placeholder: isEs ? 'Selecciona otro idioma' : 'Select another language',
                                  options: moreLangOpts,
                                })}
                                <small className="dcb-field__hint">{isEs ? 'El idioma se muestra en la tarjeta como requisito del equipo; no bloquea a nadie.' : 'Language is shown on the card as a team requirement; it does not block anyone.'}</small>
                                {renderChips(isEs ? 'Nivel competitivo *' : 'Competitive level *', levelOpts, formLevel, setFormLevel, true)}
                                {renderChips(isEs ? 'Genero' : 'Gender', genderOpts, formGender, setFormGender)}
                                {teamGenderKey(formGender) === 'female' && (
                                  <div className="dcb-rule" data-bad={genderBlocked || undefined}>
                                    {genderBlocked ? Icon.alert : Icon.check}
                                    <span>
                                      {genderBlocked
                                        ? (isEs ? 'Un equipo femenino solo admite jugadoras, incluida quien lo crea. Tu perfil no esta registrado como mujer.' : "A women's team only admits women, including its creator. Your profile is not registered as a woman.")
                                        : (isEs ? 'Equipo femenino: solo podran unirse jugadoras.' : "Women's team: only women players can join.")}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            {sec.id === 'game' && (
                              <>
                                {renderChips(isEs ? 'Categoria *' : 'Category *', catOpts, formCategory, value => { setFormCategory(value); setFormGame('') }, true)}
                                <div className="dcb-games" data-invalid={(showInvalid && !formGame) || undefined}>
                                  {gameOpts.map(g => (
                                    <button type="button" key={g.id || g.name} className="dcb-game" data-active={formGame === g.name || undefined} onClick={() => setFormGame(formGame === g.name ? '' : g.name)}>
                                      <span className="dcb-game__ic">
                                        {g.images?.logo ? <img src={g.images.logo} alt="" loading="lazy" /> : (g.name || '?').slice(0, 2).toUpperCase()}
                                      </span>
                                      <span className="dcb-game__name">{g.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            {sec.id === 'tiers' && (
                              <div className="dcb-tiers">
                                {selectableTierKeys.map(key => {
                                  const active = formTiers.includes(key)
                                  return (
                                    <button type="button" key={key} className="dcb-tier" data-active={active || undefined} onClick={() => handleToggleTier(key)}>
                                      <span className="dcb-tier__box">{active ? Icon.check : Icon.plus}</span>
                                      <span>
                                        <span className="dcb-tier__label">{configs[key]?.label || key}</span>
                                        <span className="dcb-tier__desc">{tierDesc[key] || (isEs ? 'Division visible' : 'Visible division')}</span>
                                      </span>
                                    </button>
                                  )
                                })}
                                {wantsUniversity && uniVerified && uniSlotTaken && (
                                  <div className="dcb-rule" data-bad="true">
                                    {Icon.award}
                                    <span>{isEs
                                      ? `${user.university.universityName || user.university.universityTag} ya tiene su equipo oficial de ${formGame}: "${uniSlot.team?.name}". Cada universidad tiene un equipo oficial por juego. Pide unirte a ese equipo, o quita "Universitario" para crear el tuyo como equipo normal.`
                                      : `${user.university.universityName || user.university.universityTag} already has its official ${formGame} team: "${uniSlot.team?.name}". Each university has one official team per game. Ask to join it, or remove "University" to create yours as a regular team.`}</span>
                                  </div>
                                )}
                                {wantsUniversity && !uniSlotTaken && (uniVerified ? (
                                  <div className="dcb-rule">
                                    {Icon.check}
                                    <span>{isEs
                                      ? `Representara a ${user.university.universityName || user.university.universityTag}. Solo estudiantes verificados de tu universidad podran unirse.`
                                      : `It will represent ${user.university.universityName || user.university.universityTag}. Only verified students from your university can join.`}</span>
                                  </div>
                                ) : (
                                  <div className="dcb-rule dcb-rule--action" data-bad="true">
                                    {Icon.award}
                                    <span>
                                      <b>{isEs ? 'Verifica tu universidad' : 'Verify your university'}</b>
                                      {isEs ? 'Guardamos tu equipo tal como esta. Cuando termines te llevamos de vuelta para publicarlo.' : 'We save your team as it is. When you are done we bring you back to publish it.'}
                                    </span>
                                    <button type="button" className="dcb-verify-btn" onClick={() => goVerify('/universidad')}>
                                      {isEs ? 'Verificar ahora' : 'Verify now'}
                                    </button>
                                  </div>
                                ))}
                                <p className="dcb-field__hint">{isEs ? 'Femenino y Profesional se toman de Genero y Nivel en Identidad.' : 'Women and Pro come from Gender and Level in Identity.'}</p>
                              </div>
                            )}
                            {sec.id === 'captain' && (
                              <>
                                {(captName || captNick) && (
                                  <p className="dcb-prefill">{Icon.check} {isEs ? 'Datos traidos de tu registro. Puedes editarlos.' : 'Pulled from your registration. You can edit them.'}</p>
                                )}
                                <div className="dcb-grid">
                                  <label className="dcb-field"><span>{isEs ? 'Nombre completo *' : 'Full name *'}</span><input className="dcb-input" data-invalid={(showInvalid && !captName) || undefined} value={captName} onChange={e => setCaptName(e.target.value)} placeholder={isEs ? 'Nombre legal' : 'Legal name'} /></label>
                                  <label className="dcb-field"><span>{isEs ? 'Nick en juego *' : 'In-game nick *'}</span><input className="dcb-input" data-invalid={(showInvalid && !captNick) || undefined} value={captNick} onChange={e => setCaptNick(e.target.value)} placeholder={isEs ? 'Alias competitivo' : 'Competitive alias'} /></label>
                                  <label className="dcb-field dcb-field--full"><span>{isEs ? 'Usuario / tag competitivo *' : 'Competitive user / tag *'}</span><input className="dcb-input" data-invalid={(showInvalid && !captTag) || undefined} value={captTag} onChange={e => setCaptTag(e.target.value)} placeholder={user?.playerCode || '#1234'} /></label>
                                  {/* Mobile Legends: verificar la cuenta aqui mismo (ventana flotante) y
                                      llenar nick + ID del capitan sin salir del asistente. */}
                                  {isMobileLegends(formGame) && (
                                    <div className="dcb-field dcb-field--full">
                                      <GameIdVerify
                                        value={captTag}
                                        onUse={account => {
                                          const accountId = `${account.roleId} (${account.zoneId})`
                                          if (account.nickname) setCaptNick(account.nickname)
                                          setCaptTag(accountId)
                                          setRosterPlayerForms(p => ({ ...p, [captSlotKey]: { ...p[captSlotKey], gameId: accountId, gameNick: account.nickname || p[captSlotKey]?.gameNick || '' } }))
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            {sec.id === 'profile' && (
                              <div className="dcb-grid">
                                <label className="dcb-field"><span>{isEs ? 'Partner / patrocinador' : 'Partner / sponsor'} <em>{isEs ? 'opcional' : 'optional'}</em></span><input className="dcb-input" value={formSponsor} onChange={e => setFormSponsor(e.target.value)} placeholder={defaultSponsorLabel} /></label>
                                <label className="dcb-field"><span>{isEs ? 'Comunidad' : 'Community'} <em>{isEs ? 'opcional' : 'optional'}</em></span>
                                  <select className="dcb-input" value={formCommunity} onChange={e => setFormCommunity(e.target.value)}>
                                    <option value="">{isEs ? 'Sin comunidad' : 'No community'}</option>
                                    {communityOpts.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </label>
                                <div className="dcb-badge-note dcb-field--full">
                                  <span>{isEs ? 'Insignia sugerida' : 'Suggested badge'}</span>
                                  <b>{defaultSponsorLabel}</b>
                                  <button type="button" className="dcb-mini-help" aria-label={isEs ? 'Politica de insignia' : 'Badge policy'}>?
                                    <span>
                                      {isEs
                                        ? 'GlitchGang puede patrocinar/verificar equipos. Si el equipo tiene mala conducta, reportes validos o infringe reglas, la insignia puede retirarse desde admin.'
                                        : 'GlitchGang can sponsor/verify teams. Bad conduct, valid reports or rule violations can make admins remove the badge.'}
                                    </span>
                                  </button>
                                </div>
                                <label className="dcb-field dcb-field--full"><span>{isEs ? 'Descripcion *' : 'Description *'}</span>
                                  <textarea className="dcb-input dcb-textarea" data-invalid={(showInvalid && formDescription.trim().length <= 10) || undefined} rows={3} maxLength={240} value={formDescription} onChange={e => { setDescriptionTouched(true); setFormDescription(e.target.value) }} placeholder={isEs ? 'Describe tu escuadra, objetivos y ambiente (min. 10 caracteres)...' : 'Describe your squad, goals and vibe (min. 10 chars)...'} />
                                  <small className="dcb-count">{formDescription.length}/240</small>
                                </label>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                ))}
              </motion.div>
            )}

            {creationStep === 2 && (
              <motion.div key="dcb-s2" className="dcb__step dcb__step--roster" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}>
                <div className="dcb-roster-bar" data-done={rosterDone || undefined}>
                  <div>
                    <b>{rosterDone
                      ? (isEs ? 'Capitan listo' : 'Captain ready')
                      : (isEs ? 'Falta el capitan' : 'Captain incomplete')}</b>
                    <span>{rosterDone
                      ? (isEs ? `Ya puedes crear el equipo. ${filledStarters > 1 ? filledStarters : 1} en el roster — invita a mas con el link.` : `You can create the team. ${filledStarters > 1 ? filledStarters : 1} on the roster — invite more with the link.`)
                      : (isEs ? 'Solo tu (capitan) tienes que estar completo para crear. El resto es opcional.' : 'Only you (the captain) must be complete to create. The rest is optional.')}</span>
                  </div>
                  <button type="button" className="dcb-help" data-open={helpOpen || undefined} onClick={() => setHelpOpen(v => !v)} aria-label={isEs ? 'Ayuda' : 'Help'}>?
                    {helpOpen && (
                      <span className="dcb-help__pop" onClick={e => e.stopPropagation()}>
                        {isEs
                          ? <>Puedes crear el equipo como <b>creador/admin</b> aunque no juegues. Agrega jugadores ahora o comparte el link para que completen su registro despues.<br /><br />Los jugadores vinculan sus datos cuando aceptan la invitacion.</>
                          : <>You can create the team as <b>creator/admin</b> even if you do not play. Add players now or share the link so they complete their registration later.<br /><br />Players link their own data when they accept the invite.</>}
                      </span>
                    )}
                  </button>
                </div>

                <div className="dcb-slots">
                  {Array.from({ length: starterCount }).map((_, i) => {
                    const key = starters[i] || `titular-${i + 1}`
                    const row = rosterPlayerForms[key] || {}
                    const complete = Boolean(row.gameNick || row.name)
                    const name = row.gameNick || row.name || (isEs ? 'Vacante' : 'Open')
                    const role = GAME_ROSTER_SLOTS_LABELS[formGame]?.titulares?.[i] || `${isEs ? 'Titular' : 'Starter'} ${i + 1}`
                    return (
                      <button
                        type="button"
                        className="dcb-slot"
                        key={key}
                        data-filled={complete || undefined}
                        data-optional={!complete || undefined}
                        onClick={() => { setRosterTab('slots'); const el = document.querySelector(`[data-slot="${key}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
                      >
                        <span className="dcb-slot__av">
                          {row.photo ? <img src={row.photo} alt="" /> : (String(name)[0] || '?').toUpperCase()}
                        </span>
                        <div className="dcb-slot__name">{name}</div>
                        <div className="dcb-slot__role">{complete ? role : (isEs ? 'Opcional' : 'Optional')}</div>
                      </button>
                    )
                  })}
                </div>

                <div className="dcb-rcard">
                  <div className="dcb-rtabs">
                    <button type="button" className="dcb-rtab" data-active={rosterTab === 'slots' || undefined} onClick={() => setRosterTab('slots')}>{isEs ? 'Slots del roster' : 'Roster slots'}</button>
                    <button type="button" className="dcb-rtab" data-active={rosterTab === 'invite' || undefined} onClick={() => setRosterTab('invite')}>{isEs ? 'Invitar por link' : 'Invite by link'}</button>
                    <button type="button" className="dcb-rtab" data-active={rosterTab === 'search' || undefined} onClick={() => setRosterTab('search')}>{isEs ? 'Buscar jugadores' : 'Search players'}</button>
                  </div>

                  {rosterTab === 'invite' && (
                    <div className="dcb-invite">
                      <p>{isEs
                        ? 'El link de invitacion se genera al crear el equipo. Lo veras en el ultimo paso y en Mi equipo > Solicitudes. Quien lo abra entra directo al roster (mientras tengas "Aceptar solicitudes" activo).'
                        : 'The invite link is generated when the team is created. You will see it in the last step and in My team > Requests. Whoever opens it joins the roster directly (while "Accept requests" is on).'}</p>
                    </div>
                  )}
                  {rosterTab === 'search' && (
                    <div className="dcb-invite">
                      <p>{isEs
                        ? 'Cuando el equipo esté creado, en Mi equipo > Invitaciones buscas a cada jugador o coach por su nick y lo invitas con su rol. Recibe el aviso, acepta, y recién ahí entra al plantel.'
                        : 'Once the team is created, go to My team > Invitations, search each player or coach by nick and invite them with their role. They get notified, accept, and only then join the roster.'}</p>
                    </div>
                  )}
                  {rosterTab === 'slots' && (
                    <div className="dcb-rforms">
                      {/* Solo el puesto del capitan: los demas se suman aceptando una invitacion. */}
                      <div className="dcb-capslot" role="radiogroup" aria-label={isEs ? '¿En qué puesto juegas tú?' : 'Which slot do you play?'}>
                        <span>{isEs ? '¿En qué puesto juegas tú?' : 'Which slot do you play?'}</span>
                        {[...starters, ...subs].map(key => {
                          const n = key.split('-')[1]
                          const label = key.startsWith('titular')
                            ? (GAME_ROSTER_SLOTS_LABELS[formGame]?.titulares?.[parseInt(n, 10) - 1] || `${isEs ? 'Titular' : 'Starter'} ${n}`)
                            : `${isEs ? 'Suplente' : 'Sub'} ${n}`
                          return (
                            <button key={key} type="button" role="radio" aria-checked={captSlotKey === key} className="dcb-capslot__opt" data-active={captSlotKey === key || undefined} onClick={() => setCaptSlotKey(key)}>
                              {label}
                            </button>
                          )
                        })}
                      </div>
                      {renderSlotForm([...starters, ...subs].includes(captSlotKey) ? captSlotKey : (starters[0] || 'titular-1'), 0)}
                      <p className="dcb-capslot__note">{Icon.users} {isEs
                        ? 'Tus compañeros no se escriben aquí: al crear el equipo los invitas por nick (como jugador, coach, analista o manager) o compartes el código. Así cada uno acepta, usa su propia cuenta y se revisan las reglas del equipo.'
                        : 'Teammates are not typed here: after creating the team you invite them by nick (as player, coach, analyst or manager) or share the code. That way each one accepts, uses their own account and the team rules are checked.'}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {creationStep === 3 && (
              <motion.div key="dcb-s3" className="dcb__step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}>
                <div className="dcb-publish">
                  <div className="dcb-tcard__frame">
                    <div className="dcb-tcard">
                      <div className="dcb-tcard__rail" aria-hidden="true">
                        <span>x</span>
                        <span className="dcb-tcard__rail-label">{(formRegion || 'GG')} · {previewTag}</span>
                        <span>x</span>
                      </div>
                      <div className="dcb-tcard__top">
                        <span className="dcb-tcard__brand">GLITCH</span>
                        <span className="dcb-mono dcb-tcard__code">TEAM-0{filledStarters}</span>
                      </div>
                      <div className="dcb-tcard__stage">
                        <span className="dcb-tcard__scan" aria-hidden="true" />
                        <div className="dcb-tcard__crest">{previewTag}</div>
                        <div className="dcb-tcard__name">{previewName}</div>
                        <div className="dcb-tcard__meta">{previewMeta}</div>
                        <div className="dcb-tcard__tiers">
                          {previewTiers.map(x => <span key={x}>{x}</span>)}
                        </div>
                        <div className="dcb-tcard__members">
                          {previewMembers.map((m, i) => <span className="dcb-tcard__av" key={i}>{m}</span>)}
                        </div>
                      </div>
                      <div className="dcb-tcard__stats">
                        {previewStats.map(s => <div key={s.k}><b>{s.v}</b><span>{s.k}</span></div>)}
                      </div>
                      <div className="dcb-tcard__serial">
                        <span className="dcb-mono">S{teamTag}-01</span>
                        <span className="dcb-tcard__serial-stripe" aria-hidden="true" />
                      </div>
                    </div>
                  </div>

                  <div className="dcb-summary">
                    {summaryRows.map(r => (
                      <div className="dcb-summary__row" key={r.k}>
                        <span>{r.k}</span>
                        <span data-empty={!r.val || undefined}>{r.val || '—'}</span>
                      </div>
                    ))}
                    <div className="dcb-summary__actions">
                      <button type="button" className="dcb-btn dcb-btn--ghost dcb-btn--sm" onClick={() => toast(isEs ? 'Publicacion en Discord disponible pronto.' : 'Discord posting coming soon.', 'info')}>{isEs ? 'Publicar en Discord' : 'Post to Discord'}</button>
                      <button type="button" className="dcb-btn dcb-btn--ghost dcb-btn--sm" onClick={copyLink}>{copyLabel}</button>
                      <button type="button" className="dcb-btn dcb-btn--primary dcb-btn--sm" onClick={shareLink}>{isEs ? 'Compartir' : 'Share'}</button>
                    </div>
                    {inviteLink && (
                      <div className="dcb-invite__link">
                        <span>{inviteLink}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="dcb__accent" aria-hidden="true">
            <span className="dcb-mono">{panelCode}</span>
            <span className="dcb__accent-stripe" />
            <span className="dcb-mono dcb__accent-state">{panelState}</span>
          </div>
        </div>
      </div>

      <div className="dcb__actionbar">
        <div className="dcb__actionbar-inner">
          <button type="button" className="dcb-btn dcb-btn--ghost" onClick={handleBack}>{backLabel}</button>
          <div className="dcb__actionbar-right">
            <span className="dcb__actionbar-stripe" aria-hidden="true" />
            <button
              type="button"
              className="dcb__actionbar-status"
              data-actionable={pendingTarget ? true : undefined}
              onClick={goToPending}
              disabled={!pendingTarget}
            >
              <span data-tone={allPending === 0 ? 'ok' : 'warn'}>{pendingLabel}</span>
              <span>{pendingDetail}{pendingTarget && ` →`}</span>
            </button>
            <button type="button" className="dcb-btn dcb-btn--primary" data-ready={stepReady || undefined} onClick={handleNext}>{nextLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// "Buscar Equipo" y "Buscar Jugadores" siguen construidos (tarjetas LFT, vacantes)
// pero salen como "Proximamente" para la beta. Cambiar a true para reactivarlos.
const FIND_TABS_ENABLED = !isBetaHidden('section:teams-find')
// Idem para Scrims.
const SCRIMS_ENABLED = !isBetaHidden('section:teams-scrims')

// Pantalla "Proximamente" ya existente (pages/ComingSoon, clases gg-soon) --
// se reutiliza en vez de mantener un diseno aparte.
function FindSoonPanel({ isEs, kind }) {
  const title = kind === 'scrims' ? 'Scrims' : kind === 'buscar_equipo' ? (isEs ? 'Buscar Equipo' : 'Find Team') : (isEs ? 'Buscar Jugadores' : 'Find Players')
  return <ComingSoon title={title} homePath="/dashboard" />
}

export default function Teams({ panelMode = null } = {}) {
  const { lang, t } = useLang()
  const theme = useTheme()
  const { user } = useAuth()
  const notifications = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const p = t.pages
  const isEs = lang === 'es'
  const configs = TIER_CONFIGS(p)
  const themeMode = theme?.mode || 'dark'
  const selectableTierKeys = PUBLIC_FORM_TIERS.filter(key => configs[key])
  const isTeamPanelMode = panelMode === 'team'

  // ─── STATE MANAGEMENT ──────────────────────────────────────────────────────
  // Solicitud con eleccion de rol (JoinTeamModal) y la promesa de GGTeamCard.
  const [joinTarget, setJoinTarget] = useState(null)
  const joinResolverRef = useRef(null)
  const [tab, setTab] = useState('equipos') // equipos | scrims | buscar_equipo | buscar_jugadores
  const [selectedSubFilter, setSelectedSubFilter] = useState('todos')
  const [teamDetail, setTeamDetail] = useState(null) // tarjeta de equipo abierta (panel de detalle)
  const [loading, setLoading] = useState(true)
  const [loadingDirectory, setLoadingDirectory] = useState(true)
  const [error, setError] = useState(null)

  // Roster lists
  const [myTeam, setMyTeam] = useState(null)
  const [myTeams, setMyTeams] = useState([])
  const [ranking, setRanking] = useState([])
  const [teamsList, setTeamsList] = useState([])
  const [playersList, setPlayersList] = useState(INITIAL_MOCK_PLAYERS)
  const [scrimsList, setScrimsList] = useState(ENHANCED_MOCK_SCRIMS)
  const [storageReady, setStorageReady] = useState(false)

  // Search filter inputs
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGame, setFilterGame] = useState('All')
  const [filterTier, setFilterTier] = useState('All')

  // Invite states
  const [inviteNick, setInviteNick] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Scrim Creator Form
  const createDefaultScrimForm = () => ({
    title: '',
    category: 'Shooter',
    game: 'Valorant',
    region: 'LAN',
    time: '',
    timeWindow: '',
    format: 'BO3',
    targetTeam: '',
    contact: '',
    level: '',
    roster: '',
    mapPool: 'Ascent',
    focus: '',
    rules: SCRIM_CATEGORY_RULES.Shooter[0],
    leadersRoomEnabled: true,
    noShowWarningActive: true,
    cannotPlayNotice: false,
    priorityMode: 'prioridad_vs'
  })
  const [showScrimForm, setShowScrimForm] = useState(false)
  const [scrimForm, setScrimForm] = useState(createDefaultScrimForm)

  // ─── CREATE TEAM MULTI-STEP STATE ──────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false)
  const [creationStep, setCreationStep] = useState(1) // 1: Identity, 2: Roster, 3: Success Share
  const [teamWizardMode, setTeamWizardMode] = useState('create') // create | edit
  const [createdTeamData, setCreatedTeamData] = useState(null)
  const [shareMethod, setShareMethod] = useState('qr') // qr | link | amigos | redes
  const [shareFriendSearch, setShareFriendSearch] = useState('')
  // Amigos reales (antes era una lista inventada y "enviar" solo mostraba un
  // toast). La invitación llega como mensaje con el enlace del equipo.
  const { friends: shareFriends } = useShareDestinations(isCreating && creationStep === 3)
  const [invitedFriendIds, setInvitedFriendIds] = useState([])
  const sendTeamInviteToFriend = async (friend, inviteUrl) => {
    try {
      await api('/messages/share', {
        method: 'POST',
        body: {
          destinations: [{ kind: 'friend', id: friend.id, name: friend.name, avatar: friend.avatar }],
          payload: {
            title: isEs ? `Únete a ${createdTeamData?.name || 'mi equipo'}` : `Join ${createdTeamData?.name || 'my team'}`,
            message: isEs ? `Te invito a mi equipo ${createdTeamData?.name || ''}: ${inviteUrl}` : `Join my team ${createdTeamData?.name || ''}: ${inviteUrl}`,
            url: inviteUrl,
            logo: createdTeamData?.logo || '',
            game: createdTeamData?.game || '',
          },
          shareKind: 'invite',
        },
      })
      setInvitedFriendIds(prev => [...new Set([...prev, friend.id])])
      toast(isEs ? `Invitación enviada a ${friend.name}` : `Invite sent to ${friend.name}`)
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo enviar la invitación' : 'Could not send the invite'), 'error')
    }
  }

  // GG lee en qué paso del asistente va el usuario para ofrecer ayuda si se queda quieto.
  useEffect(() => {
    setGGContext('teamWizard', isCreating && teamWizardMode === 'create' ? { step: creationStep } : null)
  }, [isCreating, creationStep, teamWizardMode])
  useEffect(() => () => setGGContext('teamWizard', null), [])

  // Form Fields
  const [formName, setFormName] = useState('')
  const [formTag, setFormTag] = useState('')
  const [formSlogan, setFormSlogan] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [formGender, setFormGender] = useState('Mixto (Cualquiera)')
  const [formRegion, setFormRegion] = useState('')
  const [formCountry, setFormCountry] = useState('')
  const [formTiers, setFormTiers] = useState(['nuevo']) // array of selected tiers
  const [formJoinScope, setFormJoinScope] = useState('open') // open | country | region
  const [wizardResumed, setWizardResumed] = useState(false) // volvio de verificar: salta la intro
  const [formCommunity, setFormCommunity] = useState('')
  const [formSponsor, setFormSponsor] = useState('GlitchGang Partner')
  const [formCategory, setFormCategory] = useState('')
  const [formGame, setFormGame] = useState('')
  const [formLang, setFormLang] = useState('Espanol')
  const [formLevel, setFormLevel] = useState('Amateur')
  const [formLogo, setFormLogo] = useState('') // URL real del logo del equipo
  const [formBanner, setFormBanner] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formContactEmail, setFormContactEmail] = useState('')
  const [formMainCharacters, setFormMainCharacters] = useState('')
  const [formSponsors, setFormSponsors] = useState('')

  // Captain verification fields — prefilled from the user's own registration.
  const registrationFullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
  const registrationNick = user?.nick || user?.username || user?.gamerProfile?.nick || user?.email?.split('@')[0] || ''
  const registrationTag = user?.playerCode || user?.gamerProfile?.gameId || user?.username || ''
  const [captName, setCaptName] = useState(user?.name || registrationFullName || '')
  const [captNick, setCaptNick] = useState(registrationNick)
  const [captTag, setCaptTag] = useState(registrationTag)
  const [captRegion, setCaptRegion] = useState(user?.region || 'República Dominicana')
  const [captRole, setCaptRole] = useState('')
  const [captSlotKey, setCaptSlotKey] = useState('titular-1')
  const wizardUserKey = user?._id || user?.id || user?.playerCode || user?.nick || 'local-user'

  useEffect(() => {
    if (!captName && (user?.name || registrationFullName)) setCaptName(user?.name || registrationFullName)
    if (!captNick && registrationNick) setCaptNick(registrationNick)
    if (!captTag && registrationTag) setCaptTag(registrationTag)
  }, [captName, captNick, captTag, registrationFullName, registrationNick, registrationTag, user?.name])

  const openCreateTeamWizard = useCallback(() => {
    const nextFullName = user?.name || registrationFullName || ''
    setTab('equipos')
    setTeamWizardMode('create')
    setCreatedTeamData(null)
    setShareMethod('qr')
    setShareFriendSearch('')
    setCreationStep(1)
    setFormName('')
    setFormTag('')
    setFormSlogan('')
    setFormDescription('')
    setDescriptionTouched(false)
    setFormGender(isEs ? 'Mixto' : 'Mixed')
    setFormRegion('')
    setFormCountry('')
    setFormTiers(['nuevo'])
    setFormJoinScope('open')
    setWizardResumed(false)
    setFormCommunity('')
    setFormSponsor('GlitchGang Partner')
    setFormCategory('')
    setFormGame('')
    setFormLang(isEs ? 'Espanol' : 'Spanish')
    setFormLevel('Amateur')
    setFormLogo('')
    setFormBanner('')
    setFormBrand('')
    setFormContactEmail('')
    setFormMainCharacters('')
    setFormSponsors('')
    setCaptName(nextFullName)
    setCaptNick(registrationNick)
    setCaptTag(registrationTag)
    setCaptRole('')
    setCaptSlotKey('titular-1')
    setRosterInputs({})
    setRosterPlayerForms({})
    setIsCreating(true)
  }, [isEs, registrationFullName, registrationNick, registrationTag, user?.name])

  useEffect(() => {
    if (!location.state?.autoCreate) return
    openCreateTeamWizard()
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // Borrador del wizard: se guarda al salir a verificar la universidad o a
  // vincular Discord, y "Volver a mi equipo" lo recupera tal cual estaba.
  const saveWizardDraft = () => saveTeamDraft(wizardUserKey, {
    formName, formTag, formSlogan, formDescription, formGender, formRegion, formCountry,
    formTiers, formJoinScope, formCommunity, formSponsor, formCategory, formGame, formLang,
    formLevel, formLogo, captName, captNick, captTag, captRole, captSlotKey, rosterPlayerForms,
  })

  useEffect(() => {
    if (!location.state?.resumeTeamDraft) return
    const d = readTeamDraft(wizardUserKey)
    navigate(location.pathname, { replace: true, state: null })
    if (!d) { openCreateTeamWizard(); return }
    openCreateTeamWizard()
    setWizardResumed(true)
    const put = (setter, value) => { if (value !== undefined) setter(value) }
    put(setFormName, d.formName); put(setFormTag, d.formTag); put(setFormSlogan, d.formSlogan)
    put(setFormDescription, d.formDescription); put(setFormGender, d.formGender); put(setFormRegion, d.formRegion)
    put(setFormCountry, d.formCountry); put(setFormTiers, d.formTiers); put(setFormJoinScope, d.formJoinScope)
    put(setFormCommunity, d.formCommunity); put(setFormSponsor, d.formSponsor); put(setFormCategory, d.formCategory)
    put(setFormGame, d.formGame); put(setFormLang, d.formLang); put(setFormLevel, d.formLevel); put(setFormLogo, d.formLogo)
    put(setCaptName, d.captName); put(setCaptNick, d.captNick); put(setCaptTag, d.captTag)
    put(setCaptRole, d.captRole); put(setCaptSlotKey, d.captSlotKey); put(setRosterPlayerForms, d.rosterPlayerForms)
    toast(isEs ? 'Recuperamos tu equipo donde lo dejaste.' : 'We restored your team where you left it.', 'success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // Tiers que se guardan: Femenino y Profesional salen de Identidad (género y
  // nivel), así no se repiten en dos sitios; Universitario es la única casilla.
  const effectiveTiers = (() => {
    const base = formTiers.filter(k => k !== 'femenino' && k !== 'profesional')
    if (teamGenderKey(formGender) === 'female') base.push('femenino')
    if (/^prof/i.test(String(formLevel || ''))) base.push('profesional')
    if (!base.length) base.push('nuevo')
    return Array.from(new Set(base))
  })()

  // Dynamic Roster GamerTags inputs
  const [rosterInputs, setRosterInputs] = useState({})
  const [rosterPlayerForms, setRosterPlayerForms] = useState({}) // {key: {name, cedula, photo, gameId, username, discordName, discordId}}
  const [staffSearchRole, setStaffSearchRole] = useState(null) // 'coach' | 'analyst' | null

  function applyStaffSelection(slotKey, member) {
    setRosterPlayerForms(p => ({
      ...p,
      [slotKey]: { ...p[slotKey], photo: member.avatar || p[slotKey]?.photo, gameNick: member.nick, userId: member.id },
    }))
    setStaffSearchRole(null)
  }
  const [showCopiedAlert, setShowCopiedAlert] = useState(false)

  // ─── NEW TEAM DETAIL / MANAGEMENT STATES ───────────────────────────────────
  const [isManaging, setIsManaging] = useState(isTeamPanelMode)
  const [manageTab, setManageTab] = useState(isTeamPanelMode ? 'resumen' : 'roster') // resumen | roster | solicitudes | pagina | privacidad | invitaciones

  // Privacy toggles
  const [hideEmails, setHideEmails] = useState(true)
  const [hideGameId, setHideGameId] = useState(false)
  const [acceptRequests, setAcceptRequests] = useState(true)

  // Códigos reales entregados por el backend.
  const isValidPublic = (c) => typeof c === 'string' && /^TEAM-\d{3}-\d{2}$/.test(c)
  const isValidInternal = (c) => typeof c === 'string' && /^TEAM-\d{6}-\d{3}-\d{2}$/.test(c)
  const teamIdCode = isValidPublic(myTeam?.publicCode)
    ? myTeam.publicCode
    : (myTeam ? teamPublicCode(myTeam.region || 'RD', myTeam.tag || myTeam.name) : '—')
  const teamIdInternal = isValidInternal(myTeam?.internalCode)
    ? myTeam.internalCode
    : (myTeam ? teamInternalCode(myTeam.region || 'RD', myTeam.tag || myTeam.name, myTeam.createdAt || new Date()) : '')

  // Roster slots status
  const [rosterSlotsState, setRosterSlotsState] = useState({
    'titular-1': { nick: '123', gameId: '2022993710', region: 'República Dominicana', email: 'capt@glitch.com', role: 'EXP', status: 'Sincronizado' },
    'titular-2': null, // Vacante Gold
    'titular-3': null, // Vacante Mid
    'titular-4': null, // Vacante Jungla
    'titular-5': null, // Vacante Roam
    'sub-1': null, // Vacante Suplente 1
    'sub-2': null, // Vacante Suplente 2
    'sub-3': null, // Vacante Suplente 3
    'coach': null  // Sin coach
  })

  // Agregar Jugador Form
  const [addSlotType, setAddSlotType] = useState('Titular')
  const [addSlotKey, setAddSlotKey] = useState('')
  const [addPlayerNick, setAddPlayerNick] = useState('')
  const [addPlayerGameId, setAddPlayerGameId] = useState('')
  const [addPlayerRegion, setAddPlayerRegion] = useState('República Dominicana')
  const [addPlayerEmail, setAddPlayerEmail] = useState('')

  // Invitar Amigo Form
  const [inviteFriend, setInviteFriend] = useState('Arlinton Feliz @Darkness · A001-01')
  const [inviteFriendSlotType, setInviteFriendSlotType] = useState('Titular')
  const [inviteFriendSlot, setInviteFriendSlot] = useState('')
  const [inviteFriendNote, setInviteFriendNote] = useState('')

  // Solicitudes list
  // Sin datos de ejemplo: aceptar el "Darkness" de prueba lo grababa en el
  // roster real. Las solicitudes reales viven en MyTeamPanel (/mi-equipo).
  const [incomingRequests, setIncomingRequests] = useState([])

  // LFT Player Profile Form (Buscar Equipo)
  const [lftGame, setLftGame] = useState('Mobile Legends')
  const [lftRole, setLftRole] = useState('Mid')
  const [lftRegion, setLftRegion] = useState('LAN')
  const [lftAvail, setLftAvail] = useState('Noches')
  const [lftRank, setLftRank] = useState('Diamante+')
  const [lftSecondaryRoles, setLftSecondaryRoles] = useState('Flex, shotcaller')
  const [lftObjective, setLftObjective] = useState('Scrims semanales y torneos')
  const [lftStyle, setLftStyle] = useState('Comunicativo, disciplinado, orientado a macro')
  const [lftContact, setLftContact] = useState('@player')
  const [lftLanguage, setLftLanguage] = useState('Español')
  const [lftExperience, setLftExperience] = useState('6 meses compitiendo')
  const [lftStrengths, setLftStrengths] = useState('Comunicacion, adaptacion, VOD review')
  const [lftTeamType, setLftTeamType] = useState('Semi-Pro')
  const [lftVisible, setLftVisible] = useState(true)
  const [hasLftProfile, setHasLftProfile] = useState(false)
  const [showLftForm, setShowLftForm] = useState(false)
  const [editingLftId, setEditingLftId] = useState(null)
  const [playerDetail, setPlayerDetail] = useState(null)
  const [compatibleTeamDetail, setCompatibleTeamDetail] = useState(null)
  const [teamInboxNotifications, setTeamInboxNotifications] = useState([
    { id: 'note-1', type: 'invite', title: 'Invitacion pendiente', body: 'Alpha Wolves quiere revisar tu tarjeta de Valorant.', status: 'Pendiente' },
    { id: 'note-2', type: 'match', title: 'Equipo compatible', body: 'Cyber Queens encaja con tu rol Support shotcaller.', status: 'Nuevo' },
  ])

  // Publicar Vacante Form (Buscar Jugadores)
  const [vacRole, setVacRole] = useState('Mid')
  const [vacLevel, setVacLevel] = useState('Amateur')
  const [vacDesc, setVacDesc] = useState('Buscamos jugador para torneos los fines de semana.')
  const [vacGame, setVacGame] = useState('Mobile Legends')
  const [vacRegion, setVacRegion] = useState('LAN')
  const [vacSchedule, setVacSchedule] = useState('Noches y fines de semana')
  const [vacRequirements, setVacRequirements] = useState('Microfono activo, puntualidad, experiencia en scrims')
  const [vacContact, setVacContact] = useState('@captain')
  const [vacUrgency, setVacUrgency] = useState('Alta')
  const [vacMode, setVacMode] = useState('Tryout')
  const [showVacancyForm, setShowVacancyForm] = useState(false)
  const [vacanciesList, setVacanciesList] = useState(INITIAL_MOCK_VACANCIES)
  const [editingScrimId, setEditingScrimId] = useState(null)
  const [editingVacancyId, setEditingVacancyId] = useState(null)
  const [scrimShareOpen, setScrimShareOpen] = useState(null)
  const [leaderForwardPrompt, setLeaderForwardPrompt] = useState(null)
  const [scrimDetail, setScrimDetail] = useState(null)

  useEffect(() => {
    const storedScrims = readLocal(TEAMS_STORAGE_KEYS.scrims, null)
    const storedLftPlayers = readLocal(TEAMS_STORAGE_KEYS.lftPlayers, null)
    const storedProfile = readLocal(TEAMS_STORAGE_KEYS.lftProfile, null)
    const storedVacancies = readLocal(TEAMS_STORAGE_KEYS.vacancies, null)

    if (Array.isArray(storedScrims)) setScrimsList(storedScrims)
    if (Array.isArray(storedLftPlayers)) setPlayersList(storedLftPlayers)
    if (Array.isArray(storedVacancies)) setVacanciesList(storedVacancies)
    if (storedProfile) {
      setLftGame(storedProfile.game || 'Mobile Legends')
      setLftRole(storedProfile.role || 'Mid')
      setLftRegion(storedProfile.region || 'LAN')
      setLftAvail(storedProfile.availability || 'Noches')
      setLftRank(storedProfile.rank || 'Diamante+')
      setLftSecondaryRoles(storedProfile.secondaryRoles || '')
      setLftObjective(storedProfile.objective || '')
      setLftStyle(storedProfile.style || '')
      setLftContact(storedProfile.contact || '')
      setLftLanguage(storedProfile.language || 'Espanol')
      setLftExperience(storedProfile.experience || '')
      setLftStrengths(storedProfile.strengths || '')
      setLftTeamType(storedProfile.teamType || 'Semi-Pro')
      setLftVisible(storedProfile.visible !== false)
      setHasLftProfile(true)
    }
    setStorageReady(true)
  }, [])

  useEffect(() => { if (storageReady) writeLocal(TEAMS_STORAGE_KEYS.scrims, scrimsList) }, [scrimsList, storageReady])
  useEffect(() => { if (storageReady) writeLocal(TEAMS_STORAGE_KEYS.lftPlayers, playersList) }, [playersList, storageReady])
  useEffect(() => { if (storageReady) writeLocal(TEAMS_STORAGE_KEYS.vacancies, vacanciesList) }, [vacanciesList, storageReady])

  // Load backend and local team
  async function loadData() {
    try {
      setLoading(true)
      const myTeamsData = await api('/teams/mine').catch(() => ({ teams: [] }))
      const myTeamsList = Array.isArray(myTeamsData?.teams) ? myTeamsData.teams.map(normalizeTeamRecord).filter(Boolean) : []
      const storedTeamId = (() => {
        try { return localStorage.getItem('gg-active-team-id') || '' } catch { return '' }
      })()
      const selectedMyTeam = myTeamsList.find(team => String(team?._id || team?.id) === String(storedTeamId)) || myTeamsList[0] || null
      const rankingData = await api('/teams/ranking')

      // Directorio de equipos real (fallback a mock si está vacío)
      setLoadingDirectory(true)
      try {
        const allTeams = await api('/teams')
        const directoryTeams = Array.isArray(allTeams) ? allTeams : allTeams?.teams
        const normalizedDirectory = normalizeDirectoryTeamList(directoryTeams)
        setTeamsList(normalizedDirectory)
      } catch {
        setTeamsList([])
      } finally {
        setLoadingDirectory(false)
      }

      const populateTeamState = (team) => {
        if (!team) return
        if (team.hideEmails !== undefined) setHideEmails(team.hideEmails)
        if (team.hideGameId !== undefined) setHideGameId(team.hideGameId)
        if (team.acceptRequests !== undefined) setAcceptRequests(team.acceptRequests)
        if (team.level) setFormLevel(team.level)
        if (team.rosterSlots) setRosterSlotsState(team.rosterSlots)

        // Populate form inputs so they are ready for edit or view
        if (team.name) setFormName(team.name)
        if (team.tag) setFormTag(team.tag)
        if (team.slogan) setFormSlogan(team.slogan)
        if (team.description) setFormDescription(team.description)
        if (team.gender) setFormGender(team.gender)
        if (team.region) setFormRegion(team.region)
        if (team.country) setFormCountry(team.country)
        if (team.logo) setFormLogo(team.logo)
        if (team.tiers) setFormTiers(team.tiers)
        setFormJoinScope(team.joinScope || 'open')
        if (team.community) setFormCommunity(team.community)
        if (team.sponsor) setFormSponsor(team.sponsor)
        if (team.banner) setFormBanner(team.banner)
        if (team.brand) setFormBrand(team.brand)
        if (team.contactEmail) setFormContactEmail(team.contactEmail)
        setFormMainCharacters(formatCommaList(team.mainCharacters))
        setFormSponsors(formatSponsorLines(team.sponsors))
        if (team.category) setFormCategory(team.category)
        if (team.game) setFormGame(team.game)
        if (team.lang) setFormLang(team.lang)
      }

      setMyTeams(myTeamsList)
      setMyTeam(selectedMyTeam)
      populateTeamState(selectedMyTeam)

      setRanking(normalizeTeamList(rankingData))
      setError(null)
    } catch (err) {
      setError(err.message)
      setMyTeam(null)
      setMyTeams([])
      setTeamsList([])
      setLoadingDirectory(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!isTeamPanelMode) return
    setTab('equipos')
    setIsManaging(Boolean(myTeam))
    if (myTeam) setManageTab('resumen')
  }, [isTeamPanelMode, myTeam])

  // Dynamic Roster setup when game changes
  useEffect(() => {
    if (formGame) {
      const limits = ROSTER_SLOTS[formGame] || { players: 5, subs: 1, coach: true }
      const newInputs = {}

      for (let i = 1; i <= limits.players; i++) {
        newInputs[`titular-${i}`] = ''
      }
      for (let i = 1; i <= (limits.subs || 0); i++) {
        newInputs[`sub-${i}`] = ''
      }
      if (limits.coach) newInputs['coach'] = ''
      if (limits.analyst) newInputs['analyst'] = ''
      if (limits.rep) newInputs['rep'] = ''

      setRosterInputs(newInputs)

      setRosterPlayerForms(prev => ({ ...prev }))
    }
  }, [formGame])

  // Toggle tiers selection (must have at least one)
  const handleToggleTier = (tierKey) => {
    setFormTiers(prev => {
      if (prev.includes(tierKey)) {
        if (prev.length === 1) return prev // keep at least one
        return prev.filter(t => t !== tierKey)
      }
      return [...prev, tierKey]
    })
  }

  // Handle invite member
  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    try {
      const res = await api('/teams/invite', {
        method: 'POST',
        body: JSON.stringify({ nick: inviteNick }),
      })
      setInviteSuccess(res.message || (isEs ? 'Jugador invitado con éxito.' : 'Player successfully invited.'))
      setInviteNick('')
      await loadData()
    } catch (err) {
      setInviteError(err.message)
    }
  }

  // Handle leave or disband team
  const handleLeaveOrDisband = async () => {
    const isLeader = myTeam && (myTeam.leader?.id === user?.id || myTeam.leader === user?.id)
    const confirmMsg = isLeader
      ? (isEs ? '¿Estás seguro de que quieres disolver el equipo?' : 'Are you sure you want to disband the team?')
      : (isEs ? '¿Estás seguro de que quieres salir del equipo?' : 'Are you sure you want to leave the team?')

    if (!window.confirm(confirmMsg)) return

    try {
      await api('/teams/leave', { method: 'POST' })
      setMyTeam(null)
      await loadData()
    } catch (err) {
      toast(err?.message || (isEs ? 'No se pudo actualizar el equipo en el servidor.' : 'Could not update the team on the server.'), 'error')
    }
  }

  // creation wizard - go to Step 2
  const handleStep1Submit = (e) => {
    e.preventDefault()
    if (!formName.trim() || !formTag.trim() || formTag.trim().length < 2 || !formGame || !captName.trim() || !captNick.trim() || !captTag.trim()) return
    setCreationStep(2)
  }

  // creation wizard - finish and save Step 3
  const handleStep2Submit = async (e) => {
    e.preventDefault()

    const limits = ROSTER_SLOTS[formGame] || { players: 5, subs: 1, coach: true }
    const slotLabels = GAME_ROSTER_SLOTS_LABELS[formGame] || {}
    // Al crear, el plantel solo lleva el puesto del capitan (su cuenta, con
    // userId): los compañeros entran despues por invitacion/solicitud/codigo,
    // aceptando ellos y pasando las reglas del equipo. El servidor descarta
    // cualquier otro puesto escrito a mano y nunca guarda cedula ni WhatsApp.
    const buildSlot = (key, fallback = {}) => {
      if (key !== captSlotKey) return null
      const data = rosterPlayerForms[key] || {}
      const nick = String(data.gameNick || fallback.nick || '').trim()
      const fullName = String(data.name || fallback.name || '').trim()
      const discordName = data.discordName || fallback.discordName || ''
      const discordId = data.discordId || fallback.discordId || ''
      const hasData = nick || fullName || data.gameId || discordName || discordId || data.photo
      if (!hasData) return null

      return {
        userId: String(user?._id || user?.id || ''),
        name: fullName,
        nick: nick || fullName,
        gameId: data.gameId || fallback.gameId || '',
        region: fallback.region || captRegion || 'Global',
        email: fallback.email || '',
        role: fallback.role || 'Titular',
        discordName,
        discordId,
        photo: data.photo || fallback.photo || '',
      }
    }

    const initialRosterSlots = {}

    // El slot del capitan siempre se guarda con su identidad del paso 1
    // (nombre/nick), aunque no vuelva a llenar la tarjeta de roster para su
    // propio puesto -- si no, el capitan quedaba fuera del roster guardado.
    const captFallback = (key) => key === captSlotKey
      ? { nick: captNick, name: captName, discordName: user?.discord?.username || '' }
      : {}

    for (let i = 1; i <= limits.players; i++) {
      const key = `titular-${i}`
      const roleFallback = (key === captSlotKey && captRole)
        ? captRole
        : (slotLabels.titulares?.[i - 1] || (isEs ? 'Titular' : 'Starter'))
      initialRosterSlots[key] = buildSlot(key, { role: roleFallback, ...captFallback(key) })
    }
    for (let i = 1; i <= (limits.subs || 0); i++) {
      const key = `sub-${i}`
      const roleFallback = (key === captSlotKey && captRole)
        ? captRole
        : (slotLabels.suplentes?.[i - 1] || (isEs ? 'Suplente' : 'Substitute'))
      initialRosterSlots[key] = buildSlot(key, {
        role: roleFallback,
        ...captFallback(key),
      })
    }
    if (limits.coach) {
      initialRosterSlots.coach = buildSlot('coach', { role: 'Coach' })
    }
    if (limits.analyst) initialRosterSlots.analyst = buildSlot('analyst', { role: isEs ? 'Analista' : 'Analyst' })
    if (limits.rep) initialRosterSlots.rep = buildSlot('rep', { role: isEs ? 'Representante' : 'Representative' })
    initialRosterSlots.manager = buildSlot('manager', { role: 'Manager' })

    const rosterList = Object.entries(initialRosterSlots)
      .filter(([, slot]) => slot?.nick)
      .map(([key, slot], index) => ({
        id: `member-${key}-${Date.now()}`,
        nick: slot.nick,
        role: slot.role || (key.startsWith('sub') ? (isEs ? 'Suplente' : 'Substitute') : (isEs ? 'Titular' : 'Starter')),
        online: false,
        avatar: slot.photo || DEFAULT_AVATAR,
      }))

    setRosterSlotsState(initialRosterSlots)

    const cleanFormTag = String(formTag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
    const teamIdVal = generateTeamId(formGame, formRegion, cleanFormTag)

    const newTeamObj = {
      id: Date.now(),
      name: formName,
      tag: cleanFormTag,
      wins: 0,
      losses: 0,
      rankPts: 1000,
      game: formGame,
      tiers: effectiveTiers,
      region: formRegion || 'Global',
      country: formCountry || '',
      slogan: formSlogan || (isEs ? '¡Hasta el final!' : 'To the end!'),
      sponsor: formSponsor || null,
      partnerBadge: {
        active: false,
        label: formSponsor || 'GlitchGang Partner',
        status: 'pending',
        reason: ''
      },
      banner: formBanner,
      brand: formBrand,
      contactEmail: formContactEmail,
      mainCharacters: splitCommaList(formMainCharacters),
      sponsors: parseSponsorLines(formSponsors),
      community: formCommunity || null,
      leader: { _id: wizardUserKey, id: wizardUserKey, nick: captNick, name: captName, tag: captTag, role: 'owner' },
      owner: {
        id: wizardUserKey,
        name: captName,
        nick: captNick,
        competitiveTag: captTag,
        email: user?.email || '',
        discordName: user?.discord?.username || '',
        discordId: user?.discord?.id || '',
        whatsapp: user?.whatsapp?.verified ? (user?.whatsapp?.phone || '') : '',
        avatar: user?.avatar || '',
      },
      roster: rosterList,
      level: formLevel,
      category: formCategory,
      lang: formLang,
      gender: formGender,
      joinScope: formJoinScope,
      description: formDescription,
      rosterSlots: initialRosterSlots,
      teamIdCode: teamIdVal,
      logo: formLogo || ''
    }

    const isEdit = teamWizardMode === 'edit' && !!myTeam

    const payload = {
      name: formName,
      tag: newTeamObj.tag,
      // Hex real: el tier.hex es 'var(--accent)' y guardarlo dejaba el panel
      // en negro. Al editar se respeta el color que el lider eligio.
      color: isEdit ? teamColor(myTeam?.color) : TEAM_DEFAULT_COLOR,
      game: formGame,
      tiers: effectiveTiers,
      region: formRegion || 'Global',
      country: formCountry || '',
      slogan: newTeamObj.slogan,
      sponsor: formSponsor,
      partnerBadge: {
        active: false,
        label: formSponsor || 'GlitchGang Partner',
        status: 'pending',
        reason: ''
      },
      banner: formBanner,
      brand: formBrand,
      contactEmail: formContactEmail,
      mainCharacters: splitCommaList(formMainCharacters),
      sponsors: parseSponsorLines(formSponsors),
      community: formCommunity,
      level: formLevel,
      category: formCategory,
      lang: formLang,
      gender: formGender,
      joinScope: formJoinScope,
      description: formDescription,
      logo: formLogo || '',
      owner: newTeamObj.owner,
      allowMultipleTeams: true,
      // Al editar un equipo existente, el paso 2 del wizard (formularios de
      // roster) arranca vacio -- no se precarga con el rosterSlots real del
      // servidor. Mandarlo igual pisaba el roster real (miembros que se
      // unieron despues) con placeholders vacios. Solo se manda al crear.
      ...(isEdit ? {} : { rosterSlots: initialRosterSlots }),
    }

    // Lo que muestra la tarjeta final. Al crear se reemplaza por lo que
    // devolvio el backend: solo ese objeto trae el teamInviteCode real con el
    // que se arma el link de invitacion.
    let finalTeam = newTeamObj
    try {
      if (isEdit) {
        const dbTeam = await api(teamManagePath(myTeam), {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        if (dbTeam) {
          const updated = {
            ...myTeam,
            ...dbTeam,
            roster: rosterList,
            // Cédula real del backend (visible + interna)
            teamIdCode: dbTeam.publicCode || dbTeam.teamIdCode || teamIdVal,
            publicCode: dbTeam.publicCode,
            internalCode: dbTeam.internalCode,
          }
          finalTeam = updated
          setMyTeam(updated)
        }
      } else {
        const dbTeam = await api('/teams', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        if (dbTeam) {
          // El backend es la fuente de verdad: se combina sobre el objeto local
          // para no mostrar en el panel datos optimistas que nunca se guardaron
          // (p.ej. si un campo fue rechazado o normalizado distinto al enviarlo).
          const savedTeam = { ...newTeamObj, ...dbTeam, roster: rosterList }
          finalTeam = savedTeam
          rememberActiveTeam(savedTeam)
          setMyTeam(savedTeam)
          setMyTeams(prev => [normalizeTeamRecord(savedTeam), ...prev.filter(team => String(team?._id || team?.id || team?.name) !== String(savedTeam._id || savedTeam.id || savedTeam.name))])
        }
      }
    } catch (err) {
      console.error('API sync failed', err)
      if (err?.status === 402 || /limite gratis|GlitchGang Pro/i.test(err?.message || '')) {
        toast(err?.message || (isEs ? 'Activa GlitchGang Pro para crear mas equipos en esta categoria.' : 'Activate GlitchGang Pro to create more teams in this category.'), 'info')
        navigate('/planes')
        return
      }
      if (err?.status === 400 && /already in a team/i.test(err?.message || '')) {
        try {
          const existing = await api('/teams/mine')
          const list = Array.isArray(existing?.teams) ? existing.teams.map(normalizeTeamRecord).filter(Boolean) : []
          const normalized = list[0] || null
          if (normalized) rememberActiveTeam(normalized)
          setMyTeam(normalized)
          setMyTeams(list)
          if (normalized) setTeamsList(prev => [normalized, ...prev.filter(t => String(t._id || t.id || t.name) !== String(normalized._id || normalized.id || normalized.name))])
          const userId = String(user?._id || user?.id || '')
          const owned = list.find(team => {
            const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
            return userId && leaderId && userId === leaderId
          })
          if (owned) {
            rememberActiveTeam(owned)
            toast(isEs ? 'Ya tienes un equipo propio. Te lleve a gestionarlo.' : 'You already own a team. Opened it for management.', 'info')
            navigate('/mi-equipo')
          } else {
            toast(isEs ? 'Ya perteneces a un equipo. Te lleve a tu perfil de equipo.' : 'You already belong to a team. Opened your team profile.', 'info')
            navigate('/jugador/equipos')
          }
          return
        } catch {
          toast(isEs ? 'Ya perteneces a un equipo. Revisa Mis Equipos para editar tu perfil o Mi Equipo si eres dueño.' : 'You already belong to a team. Check My Teams for your profile or My Team if you own it.', 'info')
          navigate('/jugador/equipos')
          return
        }
      }
      toast(err?.message || (isEs ? 'No se pudo guardar el equipo en backend.' : 'Could not save the team in backend.'), 'error')
      return
    }

    // Add to main directory list
    setTeamsList(prev => [finalTeam, ...prev.filter(t => t.name !== finalTeam.name)])
    setCreatedTeamData(finalTeam)
    setCreationStep(3)
    clearTeamDraft()
  }

  // Create Scrim
  const handleCreateScrim = (e) => {
    e.preventDefault()
    if (!scrimForm.title.trim()) return
    if (!myTeam) {
      toast(isEs ? 'Favor crea un equipo o se parte de uno para que puedas publicar solicitudes.' : 'Create or join a team before posting requests.')
      return
    }
    if (!isLeader) {
      setLeaderForwardPrompt({ action: 'publish', item: { title: scrimForm.title, game: scrimForm.game } })
      return
    }
    const modeCopy = getScrimModeCopy(scrimForm.priorityMode, isEs)
    if (modeCopy.targetRequired && !scrimForm.targetTeam.trim()) {
      toast(isEs ? 'Indica el equipo rival para este tipo de solicitud.' : 'Add the rival team for this request type.')
      return
    }

    const newScrim = {
      id: Date.now(),
      team: myTeam.name,
      tag: myTeam.tag || myTeam.name?.slice(0, 3)?.toUpperCase() || 'GG',
      ownerTeamId: myTeam._id || myTeam.id || myTeam.publicCode || myTeam.teamIdCode || myTeam.name,
      ownerUserId: user?._id || user?.id,
      createdBy: user?.nick || user?.name || 'Captain',
      isMine: true,
      category: scrimForm.category || getGameCategory(scrimForm.game),
      game: scrimForm.game,
      region: scrimForm.region,
      time: scrimForm.time || '20:00 UTC',
      timeWindow: scrimForm.timeWindow || scrimForm.time || 'Cualquier hora confirmada',
      format: scrimForm.format,
      title: scrimForm.title,
      level: scrimForm.level || 'Nivel por validar',
      roster: scrimForm.roster || 'Roster pendiente de confirmar',
      mapPool: scrimForm.mapPool || getScrimMapOptions(scrimForm.game)[0],
      focus: scrimForm.focus || 'Practica competitiva',
      rules: scrimForm.rules || getScrimRulesOptions(scrimForm.category || getGameCategory(scrimForm.game))[0],
      room: 'Sala automática al confirmar ambos equipos',
      roomStatus: 'Pendiente',
      leadersRoomEnabled: scrimForm.leadersRoomEnabled,
      leadersRoom: scrimForm.leadersRoomEnabled
        ? {
            status: 'Pendiente',
            purpose: isEs ? 'Coordinacion privada entre lideres del VS' : 'Private coordination between VS leaders',
            participants: [safeText(myTeam?.name, 'Tu equipo'), scrimForm.targetTeam || 'Rival por confirmar'],
          }
        : null,
      noShowWarningActive: Boolean(scrimForm.noShowWarningActive && !scrimForm.cannotPlayNotice),
      cannotPlayNotice: Boolean(scrimForm.cannotPlayNotice),
      penaltyWarning: scrimForm.noShowWarningActive && !scrimForm.cannotPlayNotice
        ? (isEs
            ? 'Si aceptas el VS y tu equipo no se presenta, el equipo recibira una amonestacion.'
            : 'If you accept the VS and your team does not show up, the team will receive a warning.')
        : (isEs
            ? 'Aviso de amonestacion desactivado porque el equipo marco que no puede jugar.'
            : 'No-show warning disabled because the team marked it cannot play.'),
      priorityMode: scrimForm.priorityMode,
      targetTeam: scrimForm.targetTeam || (scrimForm.priorityMode === 'weekly_upset' ? 'Equipo superior semanal' : 'Abierto'),
      contact: 'Sala automática',
      record: myTeam?.wins && myTeam?.losses ? `${myTeam.wins}-${myTeam.losses}` : '0-0',
      winRate: myTeam?.wins || myTeam?.losses ? Math.round((myTeam.wins / ((myTeam.wins || 0) + (myTeam.losses || 0))) * 100) : 50,
      tier: myTeam?.tiers?.[0] ? configs[myTeam.tiers[0]]?.label : 'Abierto',
      status: 'Abierto',
      plan: myTeam?.plan,
      planStatus: myTeam?.planStatus,
      challengerPlanActive: hasActiveChallengerPlan(myTeam),
      color: teamColor(myTeam?.color)
    }

    if (editingScrimId) {
      setScrimsList(prev => prev.map(item => item.id === editingScrimId ? { ...item, ...newScrim, id: editingScrimId, ownerTeamId: item.ownerTeamId || newScrim.ownerTeamId, ownerUserId: item.ownerUserId || newScrim.ownerUserId } : item))
      toast(isEs ? 'Solicitud de scrim actualizada.' : 'Scrim request updated.')
    } else {
      setScrimsList(prev => [newScrim, ...prev])
      toast(isEs ? 'Solicitud de scrim publicada.' : 'Scrim request published.')
    }
    setScrimForm(createDefaultScrimForm())
    setEditingScrimId(null)
    setShowScrimForm(false)
  }

  const openScrimFormWithMode = (priorityMode = 'prioridad_vs') => {
    setEditingScrimId(null)
    setScrimForm(prev => ({ ...createDefaultScrimForm(), priorityMode }))
    setShowScrimForm(true)
  }

  const handleEditScrim = (scrim) => {
    if (!isOwnScrim(scrim)) {
      toast(isEs ? 'Solo puedes editar solicitudes creadas por tu equipo.' : 'You can only edit requests created by your team.')
      return
    }
    if (!requireLeaderForScrimAction(scrim, 'edit')) return
    const category = scrim.category || getGameCategory(scrim.game)
    setEditingScrimId(scrim.id)
    setScrimForm({
      title: scrim.title || '',
      category,
      game: scrim.game || GAME_CATEGORIES[category]?.[0] || 'Valorant',
      region: scrim.region || 'LAN',
      time: scrim.time || '',
      timeWindow: scrim.timeWindow || '',
      format: scrim.format || 'BO3',
      targetTeam: scrim.targetTeam || '',
      contact: '',
      level: scrim.level || '',
      roster: scrim.roster || '',
      mapPool: scrim.mapPool || getScrimMapOptions(scrim.game)[0],
      focus: scrim.focus || '',
      rules: scrim.rules || getScrimRulesOptions(category)[0],
      leadersRoomEnabled: scrim.leadersRoomEnabled !== false,
      noShowWarningActive: scrim.noShowWarningActive !== false,
      cannotPlayNotice: Boolean(scrim.cannotPlayNotice),
      priorityMode: scrim.priorityMode || 'prioridad_vs',
    })
    setShowScrimForm(true)
  }

  const handleDeleteScrim = (scrim) => {
    if (!isOwnScrim(scrim)) {
      toast(isEs ? 'Solo puedes eliminar solicitudes creadas por tu equipo.' : 'You can only delete requests created by your team.')
      return
    }
    if (!requireLeaderForScrimAction(scrim, 'delete')) return
    setScrimsList(prev => prev.filter(item => item.id !== scrim.id))
    setScrimShareOpen(prev => prev === scrim.id ? null : prev)
    toast(isEs ? 'Solicitud eliminada.' : 'Request deleted.')
  }

  const buildScrimShareText = (scrim) => {
    const title = scrim.title || (isEs ? 'Reto de scrim' : 'Scrim challenge')
    return `${title} | ${scrim.team} vs ${scrim.targetTeam || 'Open'} | ${scrim.game} ${scrim.format} | ${scrim.timeWindow || scrim.time || 'TBD'}`
  }

  const handleShareScrim = (scrim, target) => {
    const text = buildScrimShareText(scrim)
    const url = `${window.location.origin}/equipos?tab=scrims&scrim=${scrim.id}`
    const payload = `${text} ${url}`
    if (target === 'details') {
      setScrimDetail(scrim)
      setScrimShareOpen(null)
      return
    }
    if (target === 'native') {
      if (navigator.share) {
        navigator.share({ title: scrim.title || 'Scrim / VS', text, url })
          .then(() => toast(isEs ? 'Solicitud compartida.' : 'Request shared.'))
          .catch(() => {})
      } else {
        navigator.clipboard.writeText(payload)
        toast(isEs ? 'Tu navegador no permite compartir directo. Enlace copiado.' : 'Direct share is not available. Link copied.')
      }
      setScrimShareOpen(null)
      return
    }
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`, '_blank', 'noopener,noreferrer')
      setScrimShareOpen(null)
      return
    }
    if (target === 'copy') {
      navigator.clipboard.writeText(payload)
      toast(isEs ? 'Enlace copiado.' : 'Link copied.')
      setScrimShareOpen(null)
      return
    }
    setScrimsList(prev => prev.map(item => item.id === scrim.id
      ? { ...item, publishedTo: Array.from(new Set([...(item.publishedTo || []), target])) }
      : item
    ))
    toast(target === 'profile'
      ? (isEs ? 'Publicado en tu perfil.' : 'Published to your profile.')
      : (isEs ? 'Publicado en comunidad.' : 'Published to community.')
    )
    setScrimShareOpen(null)
  }

  const handleAcceptScrim = (scrim) => {
    if (!requireLeaderForScrimAction(scrim, 'accept')) return
    const challengeState = getScrimChallengeState(scrim)
    if (!challengeState.allowed) {
      toast(challengeState.reason)
      return
    }

    const challengerName = myTeam?.name || 'Tu equipo'
    const challengerTag = myTeam?.tag || challengerName.slice(0, 3).toUpperCase()
    const challengerTeamId = myTeam?._id || myTeam?.id || myTeam?.publicCode || myTeam?.teamIdCode || challengerName
    const acceptedAt = new Date().toISOString()
    const acceptedVs = {
      id: Date.now(),
      sourceScrimId: scrim.id,
      date: 'Hoy',
      time: scrim.time?.replace(' UTC', '') || '20:00',
      teamA: challengerName,
      tagA: challengerTag,
      teamAId: challengerTeamId,
      teamB: scrim.team,
      tagB: scrim.tag || scrim.team?.slice(0, 3)?.toUpperCase() || 'VS',
      teamBId: scrim.ownerTeamId || scrim.teamId || scrim.team,
      game: scrim.game,
      level: scrim.level,
      status: 'Confirmado',
      acceptedBy: challengerName,
      acceptedByTeamId: challengerTeamId,
      acceptedAt,
      roomStatus: scrim.leadersRoomEnabled === false ? 'Manual' : 'Creada',
      leadersRoom: scrim.leadersRoomEnabled === false ? null : {
        status: 'Creada',
        purpose: isEs ? 'Coordinacion privada entre lideres del VS' : 'Private coordination between VS leaders',
        participants: [challengerName, scrim.team],
      },
      noShowWarningActive: scrim.noShowWarningActive !== false,
      penaltyWarning: scrim.penaltyWarning,
      room: scrim.room || 'Sala automática creada',
      stage: scrim.format || 'Scrim',
      accent: scrim.color || 'var(--accent)'
    }

    setScrimsList(prev => prev.map(item => item.id === scrim.id ? {
      ...item,
      status: 'Confirmado',
      acceptedBy: challengerName,
      acceptedByTeamId: challengerTeamId,
      acceptedAt,
      roomStatus: item.leadersRoomEnabled === false ? 'Manual' : 'Creada',
      leadersRoom: item.leadersRoomEnabled === false ? null : {
        status: 'Creada',
        purpose: isEs ? 'Coordinacion privada entre lideres del VS' : 'Private coordination between VS leaders',
        participants: [challengerName, item.team],
      },
      penaltyWarning: item.penaltyWarning || (isEs ? 'Si se acepta el VS y un equipo no se presenta, recibira una amonestacion.' : 'If the VS is accepted and a team does not show up, it will receive a warning.'),
    } : item))
    toast(isEs ? `VS confirmado contra ${scrim.team}.` : `VS confirmed against ${scrim.team}.`)
  }

  const handleCannotPlayScrim = (scrim) => {
    if (!requireLeaderForScrimAction(scrim, 'update')) return
    const nextScrim = {
      ...scrim,
      status: 'Reprogramar',
      cannotPlayNotice: true,
      noShowWarningActive: false,
      penaltyWarning: isEs
        ? 'Aviso de amonestacion desactivado: el equipo marco que no puede jugar este VS.'
        : 'No-show warning disabled: the team marked it cannot play this VS.',
    }
    setScrimsList(prev => prev.map(item => item.id === scrim.id ? { ...item, ...nextScrim } : item))
    setScrimDetail(nextScrim)
    toast(isEs ? 'Aviso desactivado y VS marcado para reprogramar.' : 'Warning disabled and VS marked for reschedule.')
  }
  // Copy clip recruitment helper
  const copyRecruitmentLink = () => {
    navigator.clipboard.writeText(`https://glitchgang.gg/equipos/join/${myTeam?.tag || 'GANG'}`)
    setShowCopiedAlert(true)
    setTimeout(() => setShowCopiedAlert(false), 2500)
  }

  // ─── NEW TEAM MANAGEMENT ACTIONS ───────────────────────────────────────────
  // Add Player to Roster
  const handleAddRosterPlayer = (e) => {
    e.preventDefault()
    if (!addSlotKey || !addPlayerNick.trim()) return

    const newSlotVal = {
      nick: addPlayerNick,
      gameId: addPlayerGameId || 'Vacante',
      region: addPlayerRegion || 'Global',
      email: addPlayerEmail || 'n/a',
      role: addSlotKey.startsWith('titular') ? 'Titular' : 'Suplente',
      status: 'Sincronizado'
    }

    const nextSlotsState = {
      ...rosterSlotsState,
      [addSlotKey]: newSlotVal
    }

    setRosterSlotsState(nextSlotsState)

    // Add to myTeam roster list
    if (myTeam) {
      const displayRole = addSlotKey.startsWith('titular') ? 'Titular' : 'Suplente'
      const updated = {
        ...myTeam,
        rosterSlots: nextSlotsState,
        roster: [
          ...(myTeam.roster || []).filter(m => m.nick !== addPlayerNick),
          {
            id: `player-${Date.now()}`,
            nick: addPlayerNick,
            role: displayRole,
            online: true,
            avatar: DEFAULT_AVATAR
          }
        ]
      }
      setMyTeam(updated)
      api(teamManagePath(myTeam), {
        method: 'PUT',
        body: JSON.stringify({ rosterSlots: nextSlotsState })
      }).catch(err => console.error("Update roster slots failed", err))
    }

    setAddPlayerNick('')
    setAddPlayerGameId('')
    setAddPlayerEmail('')
    toast(isEs ? 'Jugador agregado al roster exitosamente.' : 'Player added to roster successfully.')
  }

  // Invite Friend by Notification
  const handleInviteFriendNotification = (e) => {
    e.preventDefault()
    if (!inviteFriendSlot) {
      toast(isEs ? 'Por favor selecciona un slot para invitar.' : 'Please select a slot to invite.')
      return
    }
    toast(isEs
      ? `Invitación enviada por notificación a ${inviteFriend} en el slot ${inviteFriendSlot}.`
      : `Notification invitation sent to ${inviteFriend} for slot ${inviteFriendSlot}.`
    )
    setInviteFriendNote('')
  }

  // Accept Player Request
  const handleAcceptRequest = (reqId, slotKey) => {
    const req = incomingRequests.find(r => r.id === reqId)
    if (!req) return

    const newSlotVal = {
      nick: req.nick,
      gameId: req.gameId,
      region: req.region,
      email: req.email,
      role: slotKey.startsWith('titular') ? 'Titular' : 'Suplente',
      status: 'Sincronizado'
    }

    const nextSlotsState = {
      ...rosterSlotsState,
      [slotKey]: newSlotVal
    }

    setRosterSlotsState(nextSlotsState)

    if (myTeam) {
      const displayRole = slotKey.startsWith('titular') ? 'Titular' : 'Suplente'
      const updated = {
        ...myTeam,
        rosterSlots: nextSlotsState,
        roster: [
          ...(myTeam.roster || []),
          {
            id: `player-req-${Date.now()}`,
            nick: req.nick,
            role: displayRole,
            online: true,
            avatar: DEFAULT_AVATAR
          }
        ]
      }
      setMyTeam(updated)
      api(teamManagePath(myTeam), {
        method: 'PUT',
        body: JSON.stringify({ rosterSlots: nextSlotsState })
      }).catch(err => console.error("Accept request slots update failed", err))
    }

    setIncomingRequests(prev => prev.filter(r => r.id !== reqId))
    toast(isEs ? 'Solicitud aceptada y jugador asignado.' : 'Request accepted and player assigned.')
  }

  // Reject Player Request
  const handleRejectRequest = (reqId) => {
    setIncomingRequests(prev => prev.filter(r => r.id !== reqId))
    toast(isEs ? 'Solicitud rechazada.' : 'Request rejected.')
  }

  const handleFillLftProfile = () => {
    setEditingLftId(null)
    setLftGame('Mobile Legends')
    setLftRole('Roamer')
    setLftRegion('LAN')
    setLftAvail('Lunes a jueves 20:00 - 23:00, fines de semana flexible')
    setLftRank('Mitico+ / 1800 RP')
    setLftSecondaryRoles('Jungla, Mid, shotcaller')
    setLftObjective('Entrar a roster serio para scrims semanales, liga y torneos')
    setLftStyle('Comunicativo, disciplinado, fuerte en macro y rotaciones')
    setLftContact(user?.discord || user?.nick || '@mi_discord')
    setLftLanguage('Espanol, microfono activo, ingles basico')
    setLftExperience('8 meses compitiendo, 4 torneos comunitarios, VOD review semanal')
    setLftStrengths('Comunicacion, control de vision, engages, adaptacion de draft')
    setLftTeamType('Semi-Pro')
    setLftVisible(true)
    setShowLftForm(true)
    toast(isEs ? 'Formulario de jugador rellenado.' : 'Player profile form filled.')
  }

  const loadLftForm = (profile) => {
    if (!profile) return
    setEditingLftId(profile.id)
    setLftGame(profile.game || 'Mobile Legends')
    setLftRole(profile.role || 'Mid')
    setLftRegion(profile.region || 'LAN')
    setLftAvail(profile.availability || 'Noches')
    setLftRank(profile.rank || 'Diamante+')
    setLftSecondaryRoles(profile.secondaryRoles || '')
    setLftObjective(profile.objective || '')
    setLftStyle(profile.style || '')
    setLftContact(profile.contact || '')
    setLftLanguage(profile.language || 'Español')
    setLftExperience(profile.experience || '')
    setLftStrengths(profile.strengths || '')
    setLftTeamType(profile.teamType || 'Semi-Pro')
    setLftVisible(profile.visible !== false)
    setShowLftForm(true)
  }

  const resetLftFormForNew = () => {
    setEditingLftId(null)
    setLftGame('Mobile Legends')
    setLftRole('Mid')
    setLftRegion('LAN')
    setLftAvail('Noches')
    setLftRank('Diamante+')
    setLftSecondaryRoles('Flex, shotcaller')
    setLftObjective('Scrims semanales y torneos')
    setLftStyle('Comunicativo, disciplinado, orientado a macro')
    setLftContact(safeText(user?.discord || user?.nick || user?.username || user?.name, '@player'))
    setLftLanguage('Espanol')
    setLftExperience('6 meses compitiendo')
    setLftStrengths('Comunicacion, adaptacion, VOD review')
    setLftTeamType('Semi-Pro')
    setLftVisible(true)
    setShowLftForm(true)
  }

  // Save LFT profile
  const handleSaveLftProfile = (e) => {
    e.preventDefault()
    setHasLftProfile(true)
    const ownerKey = safeText(user?._id || user?.id || user?.nick || user?.username || user?.name, 'local')
    const profileId = editingLftId || `lft-${ownerKey}-${Date.now()}`
    const newLftPlayer = {
      id: profileId,
      ownerUserId: ownerKey,
      isMine: true,
      nick: safeText(user?.nick || user?.username || user?.name, isEs ? 'Tu jugador' : 'Your player'),
      game: lftGame,
      role: lftRole,
      rankPts: user?.rankPts || 1200,
      rank: lftRank,
      secondaryRoles: lftSecondaryRoles,
      objective: lftObjective,
      style: lftStyle,
      contact: safeText(lftContact, '@player'),
      language: lftLanguage,
      experience: lftExperience,
      strengths: lftStrengths,
      teamType: lftTeamType,
      region: lftRegion,
      availability: lftAvail,
      visible: lftVisible,
      status: 'Disponible / LFT',
      avatar: user?.avatar || DEFAULT_AVATAR
    }
    writeLocal(TEAMS_STORAGE_KEYS.lftProfile, newLftPlayer)
    setPlayersList(prev => editingLftId
      ? prev.map(player => player.id === editingLftId ? newLftPlayer : player)
      : [newLftPlayer, ...prev]
    )
    setEditingLftId(null)
    setShowLftForm(false)
    toast(editingLftId
      ? (isEs ? 'Tarjeta LFT actualizada.' : 'LFT card updated.')
      : (isEs ? 'Nueva tarjeta LFT publicada.' : 'New LFT card published.')
    )
  }

  const handleDeleteLftProfile = (profileId) => {
    setPlayersList(prev => prev.filter(player => player.id !== profileId))
    if (editingLftId === profileId) setEditingLftId(null)
    toast(isEs ? 'Tarjeta LFT eliminada.' : 'LFT card deleted.')
  }

  const pushTeamNotification = (type, title, body) => {
    const noteTitle = safeText(title, isEs ? 'Notificacion de equipo' : 'Team notification')
    const noteBody = safeText(body, isEs ? 'Tienes una actualizacion de equipo.' : 'You have a team update.')
    const note = { id: `note-${Date.now()}`, type, title: noteTitle, body: noteBody, status: 'Nuevo' }
    setTeamInboxNotifications(prev => [note, ...prev])
    notifications?.pushNotification?.({
      type: 'mensaje',
      title: noteTitle,
      desc: noteBody,
      message: noteBody,
      from: isEs ? 'Buzon de equipo' : 'Team inbox',
      category: 'team',
      action: { label: isEs ? 'Ver equipos' : 'View teams', link: '/equipos?tab=buscar_equipo' },
    })
  }

  const updateTeamNotification = (id, status) => {
    setTeamInboxNotifications(prev => prev.map(note => note.id === id ? { ...note, status } : note))
    toast(status)
  }

  // Publicar Vacante
  const handlePublishVacancy = (e) => {
    e.preventDefault()
    if (!vacRole) return
    const newVacObj = {
      id: Date.now(),
      team: safeText(myTeam?.name, 'Test'),
      role: vacRole,
      level: vacLevel,
      desc: vacDesc,
      game: vacGame,
      region: vacRegion,
      schedule: vacSchedule,
      requirements: vacRequirements,
      contact: vacContact,
      urgency: vacUrgency,
      mode: vacMode,
      applicants: 0,
      status: 'Abierta',
      ownerTeamId: safeText(myTeam?._id || myTeam?.id || myTeam?.publicCode || myTeam?.teamIdCode || myTeam?.name, 'local-team'),
      ownerUserId: safeText(user?._id || user?.id || user?.nick || user?.username || user?.name, 'local'),
      isMine: true
    }
    if (editingVacancyId) {
      setVacanciesList(prev => prev.map(item => item.id === editingVacancyId ? { ...item, ...newVacObj, id: editingVacancyId, ownerTeamId: item.ownerTeamId || newVacObj.ownerTeamId, ownerUserId: item.ownerUserId || newVacObj.ownerUserId, isMine: item.isMine ?? newVacObj.isMine } : item))
      setEditingVacancyId(null)
      toast(isEs ? 'Vacante actualizada.' : 'Vacancy updated.')
    } else {
      setVacanciesList(prev => [newVacObj, ...prev])
      toast(isEs ? 'Vacante publicada exitosamente.' : 'Vacancy published successfully.')
    }
    setShowVacancyForm(false)
  }

  const handleEditVacancy = (vacancy) => {
    if (!isOwnVacancy(vacancy)) {
      toast(isEs ? 'Solo puedes editar vacantes publicadas por tu equipo.' : 'You can only edit vacancies posted by your team.')
      return
    }
    setEditingVacancyId(vacancy.id)
    setVacRole(vacancy.role || '')
    setVacLevel(vacancy.level || 'Amateur')
    setVacDesc(vacancy.desc || '')
    setVacGame(vacancy.game || 'Mobile Legends')
    setVacRegion(vacancy.region || 'LAN')
    setVacSchedule(vacancy.schedule || '')
    setVacRequirements(vacancy.requirements || '')
    setVacContact(vacancy.contact || '@captain')
    setVacUrgency(vacancy.urgency || 'Media')
    setVacMode(vacancy.mode || 'Tryout')
    setShowVacancyForm(true)
  }

  const handleDeleteVacancy = (vacancyId) => {
    const vacancy = vacanciesList.find(item => item.id === vacancyId)
    if (!isOwnVacancy(vacancy)) {
      toast(isEs ? 'Solo puedes eliminar vacantes publicadas por tu equipo.' : 'You can only delete vacancies posted by your team.')
      return
    }
    setVacanciesList(prev => prev.filter(item => item.id !== vacancyId))
    toast(isEs ? 'Vacante eliminada.' : 'Vacancy deleted.')
  }

  const handleToggleVacancyStatus = (vacancy) => {
    if (!isOwnVacancy(vacancy)) {
      toast(isEs ? 'Solo puedes cerrar vacantes publicadas por tu equipo.' : 'You can only close vacancies posted by your team.')
      return
    }
    const nextStatus = vacancy.status === 'Cerrada' ? 'Abierta' : 'Cerrada'
    setVacanciesList(prev => prev.map(item => item.id === vacancy.id ? { ...item, status: nextStatus } : item))
    toast(nextStatus === 'Cerrada' ? (isEs ? 'Vacante cerrada.' : 'Vacancy closed.') : (isEs ? 'Vacante reabierta.' : 'Vacancy reopened.'))
  }

  const handleShareVacancy = (vacancy) => {
    const text = `${vacancy.team} busca ${vacancy.role} | ${vacancy.game} | ${vacancy.schedule || 'Horario por confirmar'}`
    navigator.clipboard.writeText(`${text} ${window.location.origin}/equipos?tab=buscar_jugadores&vacancy=${vacancy.id}`)
    toast(isEs ? 'Vacante copiada para compartir.' : 'Vacancy copied to share.')
  }

  // Abre JoinTeamModal (rol: jugador o staff) y resuelve true/false cuando la
  // persona envia o cierra: GGTeamCard solo muestra "Solicitud enviada" con
  // un true. Si no cumple las reglas de jugador (femenino, universidad...),
  // igual puede postularse como staff, que no las tiene.
  const handleRequestTeamJoin = (team) => {
    if (!team) return false
    if (team.acceptRequests === false) {
      toast(isEs ? 'Este equipo no esta reclutando ahora.' : 'This team is not recruiting right now.')
      return false
    }
    const blockers = joinBlockers(team, user, isEs)
    joinResolverRef.current?.(false)
    return new Promise(resolve => {
      joinResolverRef.current = resolve
      setJoinTarget({ team, teamId: teamRequestTeamId(team), playerBlockedReason: blockers[0]?.detail || '' })
    })
  }

  const finishJoinRequest = (sent) => {
    joinResolverRef.current?.(sent)
    joinResolverRef.current = null
    setJoinTarget(null)
  }

  const handleSaveTeamPublicProfile = async (e) => {
    e.preventDefault()
    if (!myTeam) return

    const payload = {
      name: formName || myTeam.name,
      tag: (formTag || myTeam.tag || 'GG').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5),
      game: formGame || myTeam.game,
      tiers: effectiveTiers,
      region: formRegion || 'Global',
      country: formCountry || '',
      slogan: formSlogan,
      sponsor: formSponsor,
      brand: formBrand,
      contactEmail: formContactEmail,
      community: formCommunity,
      level: formLevel,
      category: formCategory,
      lang: formLang,
      gender: formGender,
      joinScope: formJoinScope,
      description: formDescription,
      banner: formBanner,
      mainCharacters: splitCommaList(formMainCharacters),
      sponsors: parseSponsorLines(formSponsors),
    }

    try {
      const saved = await api(teamManagePath(myTeam), {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const nextTeam = { ...myTeam, ...saved }
      setMyTeam(nextTeam)
      setTeamsList(prev => prev.map(team => (
        team._id === myTeam._id || team.id === myTeam.id ? { ...team, ...saved } : team
      )))
      toast(isEs ? 'Datos públicos del equipo guardados.' : 'Team public data saved.')
    } catch (err) {
      toast(err?.message || (isEs ? 'No se pudo guardar el equipo en backend.' : 'Could not save the team in backend.'), 'error')
    }
  }

  const handleEditTeam = () => {
    if (myTeam) {
      setFormName(myTeam.name || '')
      setFormTag(myTeam.tag || '')
      setFormSlogan(myTeam.slogan || '')
      setFormGender(myTeam.gender || 'Mixto (Cualquiera)')
      setFormRegion(myTeam.region || '')
      setFormCountry(myTeam.country || '')
      setFormLogo(myTeam.logo || '')
      setFormTiers((myTeam.tiers || []).filter(tier => PUBLIC_FORM_TIERS.includes(tier)).length
        ? (myTeam.tiers || []).filter(tier => PUBLIC_FORM_TIERS.includes(tier))
        : ['nuevo'])
      setFormJoinScope(myTeam.joinScope || 'open')
      setFormCommunity(myTeam.community || '')
      setFormSponsor(myTeam.sponsor || '')
      setFormBanner(myTeam.banner || '')
      setFormBrand(myTeam.brand || '')
      setFormContactEmail(myTeam.contactEmail || '')
      setFormMainCharacters(formatCommaList(myTeam.mainCharacters))
      setFormSponsors(formatSponsorLines(myTeam.sponsors))
      setFormCategory(myTeam.category || '')
      setFormGame(myTeam.game || '')
      setFormLang(myTeam.lang || 'Espanol')
      setFormLevel(myTeam.level || 'Amateur')
    }
    setTeamWizardMode('edit')
    setIsCreating(true)
    setCreationStep(1)
  }

  // Settings toggle handlers
  const handleToggleHideEmails = (val) => {
    setHideEmails(val)
    if (myTeam) {
      const updated = { ...myTeam, hideEmails: val }
      setMyTeam(updated)
      api(teamManagePath(myTeam), {
        method: 'PUT',
        body: JSON.stringify({ hideEmails: val })
      }).catch(err => console.error("Toggle hideEmails failed", err))
    }
  }

  const handleToggleHideGameId = (val) => {
    setHideGameId(val)
    if (myTeam) {
      const updated = { ...myTeam, hideGameId: val }
      setMyTeam(updated)
      api(teamManagePath(myTeam), {
        method: 'PUT',
        body: JSON.stringify({ hideGameId: val })
      }).catch(err => console.error("Toggle hideGameId failed", err))
    }
  }

  const handleToggleAcceptRequests = (val) => {
    setAcceptRequests(val)
    if (myTeam) {
      const updated = { ...myTeam, acceptRequests: val }
      setMyTeam(updated)
      setTeamsList(prev => prev.map(t => t.id === myTeam.id ? { ...t, acceptRequests: val } : t))
      api(teamManagePath(myTeam), {
        method: 'PUT',
        body: JSON.stringify({ acceptRequests: val })
      }).catch(err => console.error("Toggle acceptRequests failed", err))
    }
  }

  // Transfer team leadership to another real member
  const handleTransferLeadership = async (member) => {
    if (!isLeader || !myTeam) return
    const targetId = member?.id || member?._id
    if (!targetId) return
    const confirmMsg = isEs
      ? `Vas a transferir el liderazgo del equipo a ${member.nick || 'este miembro'}. Ya no podras administrar el equipo como lider. Continuar?`
      : `You're about to transfer team leadership to ${member.nick || 'this member'}. You will no longer manage the team as leader. Continue?`
    if (!window.confirm(confirmMsg)) return
    const teamId = myTeam?._id || myTeam?.id
    try {
      const res = await api(`/teams/${teamId}/leader`, {
        method: 'PATCH',
        body: { newLeaderId: targetId },
      })
      const updated = res?.team || res
      setMyTeam(updated)
      setTeamsList(prev => prev.map(t => (t._id || t.id) === teamId ? updated : t))
      toast(isEs ? 'Liderazgo transferido.' : 'Leadership transferred.')
    } catch (err) {
      console.error('Transfer leadership failed', err)
      toast(err?.message || (isEs ? 'No se pudo transferir el liderazgo.' : 'Could not transfer leadership.'), 'error')
    }
  }

  // Delete team permanently
  const handleDeleteTeam = async () => {
    if (!isLeader) return
    if (!window.confirm(isEs ? '¿ESTÁS SEGURO? Esta acción eliminará el equipo permanentemente de la base de datos y de la sesión.' : 'ARE YOU SURE? This action will permanently delete the team.')) {
      return
    }
    const teamId = myTeam?._id || myTeam?.id
    try {
      await api(`/teams/${teamId}`, { method: 'DELETE' })
      setTeamsList(prev => prev.filter(t => (t._id || t.id) !== teamId))
      setMyTeam(null)
      setIsManaging(false)
      toast(isEs ? 'Equipo eliminado permanentemente.' : 'Team permanently deleted.')
      navigate('/equipos')
    } catch (err) {
      console.error('Delete team failed', err)
      toast(isEs ? 'No se pudo eliminar el equipo.' : 'Could not delete the team.')
    }
  }

  const teamKeysForOwnership = (team) => [
    team?._id,
    team?.id,
    team?.publicCode,
    team?.teamIdCode,
    team?.internalCode,
    team?.name,
    team?.tag,
  ].filter(Boolean).map(value => String(value).toLowerCase())

  const myTeamKeySet = new Set(myTeams.flatMap(teamKeysForOwnership))
  const isMyOwnTeam = (team) => teamKeysForOwnership(team).some(key => myTeamKeySet.has(key))
  // Solo el lider/creador del equipo va a /mi-equipo -- ser admin del sitio
  // no cuenta aca (para eso esta /admin/equipos).
  const isMyLeaderTeam = (team) => {
    const userId = String(user?._id || user?.id || '')
    const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
    return Boolean(userId && leaderId && userId === leaderId)
  }

  // Predicado del sub-filtro (pills: Todos / Nuevos / Pro / Leyenda...).
  const matchSubFilter = (t, ft) => {
    if (ft === 'todos') return true
    if (ft === 'mis_equipos') return isMyOwnTeam(t)
    if (ft === 'nuevos') return !!t.tiers && t.tiers.includes('nuevo')
    if (ft === 'mixto') return !!t.tiers && (t.tiers.length > 1 || t.gender === 'Mixto' || t.gender === 'Mixto (Cualquiera)')
    if (ft === 'femenino') return (!!t.tiers && t.tiers.includes('femenino')) || t.gender === 'Femenino'
    if (ft === 'masculino') return t.gender === 'Masculino'
    if (ft === 'casual') return t.level === 'Casual'
    if (ft === 'amateur') return t.level === 'Amateur'
    // El oficial (verificado, con cupo), no la etiqueta: tiers solo es lo que marco el lider.
    if (ft === 'universitario') return Boolean(t.university?.isUniversityTeam)
    if (ft === 'semi-pro') return t.level === 'Semi-Pro'
    if (ft === 'pro') return (!!t.tiers && t.tiers.includes('profesional')) || t.level === 'Profesional'
    if (ft === 'leyenda') return !!t.tiers && t.tiers.includes('legendario')
    return true
  }

  const ALL_GAMES = Object.values(GAME_CATEGORIES).flat()

  // Filtered lists based on search
  const filteredTeams = teamsList.filter(t => {
    if (isTemplateTeamRecord(t)) return false
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.tag.toLowerCase().includes(searchTerm.toLowerCase())
    const matchGame = filterGame === 'All' || t.game === filterGame
    const matchTier = filterTier === 'All' || t.tiers.includes(filterTier)
    return matchSearch && matchGame && matchTier && matchSubFilter(t, selectedSubFilter)
  })

  const filteredPlayers = playersList.filter(p => {
    const matchSearch = safeText(p.nick, '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchGame = filterGame === 'All' || p.game === filterGame
    const matchRole = filterTier === 'All' || p.role.toLowerCase().includes(filterTier.toLowerCase()) // map search tier to role filter in player search
    return matchSearch && matchGame
  })
  const currentUserKey = safeText(user?._id || user?.id || user?.nick || user?.username || user?.name, 'local')
  const isOwnLftPlayer = (player) => Boolean(player?.isMine || (player?.ownerUserId && String(player.ownerUserId) === String(currentUserKey)))
  const myLftCards = playersList.filter(isOwnLftPlayer)

  const filteredScrims = scrimsList.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.team.toLowerCase().includes(searchTerm.toLowerCase())
    const matchGame = filterGame === 'All' || s.game === filterGame
    return matchSearch && matchGame
  })
  const activeVsScrim = filteredScrims.find(s => s.status === 'Confirmado') || filteredScrims[0] || null

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    const scrimParam = params.get('scrim')

    if (tabParam === 'scrims') {
      setTab('scrims')
      setIsCreating(false)
      setIsManaging(false)
    }

    if (!scrimParam) return
    const targetScrim = scrimsList.find(item => String(item.id) === String(scrimParam))
    if (targetScrim) setScrimDetail(targetScrim)
  }, [location.search, scrimsList])

  const scrimGameMeta = getScrimGameFields(scrimForm.game)
  const scrimCategory = scrimForm.category || getGameCategory(scrimForm.game)
  const scrimGameOptions = GAME_CATEGORIES[scrimCategory] || ALL_GAMES
  const scrimMapOptions = getScrimMapOptions(scrimForm.game)
  const scrimRulesOptions = getScrimRulesOptions(scrimCategory)
  const scrimModeCopy = getScrimModeCopy(scrimForm.priorityMode, isEs)
  const handleScrimCategoryChange = (category) => {
    const nextGame = GAME_CATEGORIES[category]?.[0] || 'Valorant'
    setScrimForm(prev => ({
      ...prev,
      category,
      game: nextGame,
      mapPool: getScrimMapOptions(nextGame)[0],
      rules: getScrimRulesOptions(category)[0],
    }))
  }
  const handleScrimGameChange = (game) => {
    setScrimForm(prev => ({
      ...prev,
      game,
      category: getGameCategory(game),
      mapPool: getScrimMapOptions(game)[0],
    }))
  }
  const priorityLabel = (mode) => {
    if (mode === 'prioridad_vs') return isEs ? 'Prioridad VS' : 'VS priority'
    if (mode === 'anytime') return isEs ? 'Cualquier hora' : 'Any time'
    if (mode === 'weekly_upset') return isEs ? 'Retador semanal' : 'Weekly challenger'
    return isEs ? 'Abierto' : 'Open'
  }
  const findScrimOwnerTeam = (scrim) => {
    const scrimId = scrim.teamId || scrim.ownerTeamId || scrim._teamId
    const scrimName = String(scrim.team || '').toLowerCase()
    const scrimTag = String(scrim.tag || '').toLowerCase()
    return teamsList.find(team => {
      const idsMatch = scrimId && [team._id, team.id, team.teamIdCode, team.publicCode].some(id => String(id || '') === String(scrimId))
      const nameMatch = scrimName && String(team.name || '').toLowerCase() === scrimName
      const tagMatch = scrimTag && String(team.tag || '').toLowerCase() === scrimTag
      return idsMatch || nameMatch || tagMatch
    }) || scrim
  }
  const getScrimChallengeState = (scrim) => {
    if (scrim.status === 'Confirmado') {
      return { allowed: false, reason: isEs ? 'Este reto ya fue confirmado.' : 'This challenge is already confirmed.' }
    }
    if (scrim.priorityMode !== 'weekly_upset') {
      return { allowed: true, reason: '' }
    }
    if (!myTeam) {
      return { allowed: false, reason: isEs ? 'Necesitas crear o tener un equipo para retar.' : 'You need a team before challenging.' }
    }

    const ownerTeam = findScrimOwnerTeam(scrim)
    const sameTeam = [ownerTeam?._id, ownerTeam?.id, ownerTeam?.name, ownerTeam?.tag]
      .filter(Boolean)
      .some(value => [myTeam?._id, myTeam?.id, myTeam?.name, myTeam?.tag].filter(Boolean).some(mine => String(mine) === String(value)))

    if (sameTeam) {
      return { allowed: false, reason: isEs ? 'No puedes retar a tu propio equipo.' : 'You cannot challenge your own team.' }
    }
    if (!isNewTeamRecord(myTeam)) {
      return { allowed: false, reason: isEs ? 'El modo retador es para equipos nuevos.' : 'Challenger mode is for new teams.' }
    }
    if (!isEstablishedTeamRecord(ownerTeam)) {
      return { allowed: false, reason: isEs ? 'Solo puedes retar equipos viejos en este modo.' : 'Only established teams can be challenged in this mode.' }
    }
    if (!hasActiveChallengerPlan(ownerTeam) && !hasActiveChallengerPlan(scrim)) {
      return { allowed: false, reason: isEs ? 'Ese equipo no tiene el plan retador activo.' : 'That team does not have an active challenger plan.' }
    }

    return { allowed: true, reason: '' }
  }
  const lftRoleOptions = LFT_ROLE_SUGGESTIONS[lftGame] || ['Flex', 'IGL', 'Support']

  const leaderId = myTeam?.leader?._id || myTeam?.leader?.id || myTeam?.leader
  const currentUserId = user?._id || user?.id
  const isLeader = Boolean(myTeam && leaderId && currentUserId && String(leaderId) === String(currentUserId))
  const currentTeamKeys = [
    myTeam?._id,
    myTeam?.id,
    myTeam?.publicCode,
    myTeam?.teamIdCode,
    myTeam?.name,
  ].map(value => safeText(value, '')).filter(Boolean)
  const isOwnVacancy = (vacancy) => {
    if (!vacancy) return false
    if (vacancy.isMine) return true
    const ownerTeam = safeText(vacancy.ownerTeamId || vacancy.teamId || vacancy._teamId, '')
    const ownerUser = safeText(vacancy.ownerUserId || vacancy.userId || vacancy.createdBy, '')
    return Boolean(
      (ownerTeam && currentTeamKeys.includes(ownerTeam))
        || (ownerUser && currentUserId && String(ownerUser) === String(currentUserId))
    )
  }
  const handleRecruitLftPlayer = (player) => {
    if (isOwnLftPlayer(player)) {
      toast(isEs ? 'No puedes reclutarte a ti mismo.' : 'You cannot recruit yourself.')
      return
    }

    if (!myTeam) {
      toast(isEs ? 'Crea un equipo para poder reclutar jugadores.' : 'Create a team before recruiting players.')
      openCreateTeamWizard()
      return
    }

    const filled = getRosterFilledCount(myTeam)
    const total = getRosterTotalSlots(myTeam)
    if (total > 0 && filled >= total) {
      toast(isEs ? 'Tu roster esta lleno. Libera un cupo antes de reclutar.' : 'Your roster is full. Free a slot before recruiting.')
      return
    }

    if (!isLeader) {
      const playerNick = safeText(player?.nick, 'Jugador LFT')
      pushTeamNotification(
        'invite',
        isEs ? `Solicitud enviada al lider: ${playerNick}` : `Request sent to leader: ${playerNick}`,
        isEs
          ? `No eres lider del equipo. Enviamos esta vacante a tu lider para que revise a ${playerNick}.`
          : `You are not the team leader. This recruit request was sent to your leader to review ${playerNick}.`,
      )
      toast(isEs ? 'No eres lider. Se envio la solicitud a tu lider.' : 'You are not the leader. Request sent to your leader.')
      return
    }

    const playerNick = safeText(player?.nick, 'Jugador LFT')
    const playerGame = safeText(player?.game, 'Game')
    pushTeamNotification('invite', `Invitacion enviada a ${playerNick}`, `${safeText(myTeam?.name, 'Tu equipo')} invito a ${playerNick} para ${playerGame}.`)
    toast(isEs ? `Invitacion enviada a ${playerNick}` : `Invitation sent to ${playerNick}`)
  }
  const ownTeamKeys = [
    myTeam?._id,
    myTeam?.id,
    myTeam?.publicCode,
    myTeam?.teamIdCode,
    myTeam?.internalCode,
    myTeam?.name,
    myTeam?.tag,
  ].filter(Boolean).map(value => String(value).toLowerCase())
  const ownUserKeys = [user?._id, user?.id, user?.nick, user?.name].filter(Boolean).map(value => String(value).toLowerCase())
  const isOwnScrim = (scrim) => {
    if (!scrim || !myTeam) return false
    if (scrim.isMine) return true
    const scrimTeamKeys = [
      scrim.ownerTeamId,
      scrim.teamId,
      scrim._teamId,
      scrim.team,
      scrim.tag,
    ].filter(Boolean).map(value => String(value).toLowerCase())
    const scrimUserKeys = [
      scrim.ownerUserId,
      scrim.createdBy,
    ].filter(Boolean).map(value => String(value).toLowerCase())
    return scrimTeamKeys.some(key => ownTeamKeys.includes(key)) || scrimUserKeys.some(key => ownUserKeys.includes(key))
  }
  const requireLeaderForScrimAction = (scrim, action = 'accept') => {
    if (!myTeam) {
      toast(isEs
        ? 'Favor crea un equipo o se parte de uno para que puedas aceptar solicitudes.'
        : 'Create or join a team before accepting requests.'
      )
      return false
    }
    if (!isLeader) {
      setLeaderForwardPrompt({ action, item: scrim })
      return false
    }
    return true
  }
  const closeLeaderForwardPrompt = () => setLeaderForwardPrompt(null)
  const handleForwardToLeader = () => {
    toast(isEs ? 'Solicitud enviada a tu lider.' : 'Request sent to your leader.')
    setLeaderForwardPrompt(null)
  }

  // Ranking: usa datos del backend si existen, sino deriva del teamsList local
  // Nota: isMyOwnTeam se define más abajo — usamos comparación inline para evitar hoisting
  const displayRanking = ranking.length > 0
    ? ranking
    : [...teamsList]
        .sort((a, b) => (b.rankPts || 0) - (a.rankPts || 0))
        .map((t, i) => ({
          rank: i + 1,
          name: t.name,
          tag: t.tag || t.name.substring(0, 3).toUpperCase(),
          pts: t.rankPts || 1000,
          wins: t.wins || 0,
          losses: t.losses || 0,
          color: TIER_GRAD[t.tiers?.[0]]?.color || 'var(--accent)',
          mine: isMyOwnTeam(t),
        }))
  const isMoba = formGame && (formGame === 'Mobile Legends' || formGame === 'League of Legends' || formGame === 'Dota 2')

  // Helper functions for redesigned cards and filters
  const getRosterFilledCount = (t) => {
    if (!t) return 0;
    if (t.rosterSlots) {
      return Object.keys(t.rosterSlots).filter(k => k.startsWith('titular') && t.rosterSlots[k]).length;
    }
    return t.filled || 1;
  }

  const getRosterTotalSlots = (t) => {
    if (!t) return ROSTER_SLOTS[formGame]?.players || 5;
    return ROSTER_SLOTS[t.game || formGame]?.players || 5;
  }

  const getTeamCardGameCategory = (gameName) => {
    for (const cat of Object.keys(GAME_CATEGORIES)) {
      if (GAME_CATEGORIES[cat].includes(gameName)) {
        return cat;
      }
    }
    return 'MOBA';
  }

  const renderCardRosterAvatars = (t) => {
    const maxSlots = getRosterTotalSlots(t);
    const avatars = [];

    if (t.rosterSlots) {
      for (let i = 1; i <= maxSlots; i++) {
        const key = `titular-${i}`;
        const val = t.rosterSlots[key];
        if (val) {
          avatars.push(
            <img
              key={key}
              src={val.avatar || val.photo || DEFAULT_AVATAR}
              className="gg-team-card__mini-avatar"
              alt={val.nick}
              title={`${val.role}: ${val.nick}`}
            />
          );
        } else {
          avatars.push(
            <div key={key} className="gg-team-card__mini-avatar vacant" title="Slot Vacante">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          );
        }
      }
    } else {
      const filled = t.filled || 1;
      for (let i = 1; i <= maxSlots; i++) {
        if (i <= filled) {
          avatars.push(
            <img
              key={i}
              src={DEFAULT_AVATAR}
              className="gg-team-card__mini-avatar"
              alt="Roster Member"
            />
          );
        } else {
          avatars.push(
            <div key={i} className="gg-team-card__mini-avatar vacant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          );
        }
      }
    }
    return avatars;
  }

  const mapTeamCardTier = (tierKey) => {
    const value = String(tierKey || '').toLowerCase()
    const map = {
      nuevo: 'novato',
      novato: 'novato',
      universitario: 'universitario',
      femenino: 'femenino',
      profesional: 'profesional',
      semipro: 'semipro',
      semi_pro: 'semipro',
      semi: 'semipro',
      sig_liga: 'semipro',
      'sig-liga': 'semipro',
      legendario: 'elite',
      elite: 'elite',
    }
    return map[value] || 'novato'
  }

  const teamCardShortCode = (code, tag) => {
    const match = String(code || '').match(/(\d{3})(?:-\d{2})?$/)
    return match?.[1] || String(tag || '').slice(0, 3).toUpperCase()
  }

  const teamCardRoster = (team) => {
    if (!team?.rosterSlots) return []
    return Object.entries(team.rosterSlots)
      .filter(([slot, value]) => slot.startsWith('titular') && value)
      .map(([slot, value], idx) => ({
        nick: safeText(value.nick || value.name || value.username, `Jugador ${idx + 1}`),
        role: safeText(value.role || value.position || slot.replace('-', ' '), 'Flex'),
        avatar: value.avatar || value.photo || DEFAULT_AVATAR,
      }))
  }

  const teamCardMembers = (team) => {
    const roster = teamCardRoster(team)
    if (roster.length) return roster.map(row => row.avatar)
    const filled = getRosterFilledCount(team)
    return Array.from({ length: filled }, () => DEFAULT_AVATAR)
  }

  // Cinta dorada de campeon: ultimo campeonato del equipo. Sale de
  // titlesSummary (GET /teams); solo si falta se recalcula (lib/teamTitles).
  const needsTitlesIndex = [...teamsList, ...myTeams].some(team => team && !team.titlesSummary)
  const titlesIdx = useTitlesIndex(needsTitlesIndex)
  const cardTitle = (team) => {
    const summary = team?.titlesSummary
    const fromServer = summary
      ? {
          counts: { 1: summary.championships || 0 },
          latestChampionship: summary.latestChampionship
            ? { tournamentTitle: summary.latestChampionship.tournamentTitle, date: summary.latestChampionship.date }
            : null,
          latestHeadline: summary.latestChampionship ? championWord(summary.latestSeriesTitles || 1) : '',
        }
      : null
    const { counts, latestChampionship: latest, latestHeadline } = fromServer || titleSummary(titlesForTeam(team, titlesIdx))
    if (!latest) return undefined
    const date = new Date(latest.date)
    return {
      tournament: latest.tournamentTitle,
      date: Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(isEs ? 'es-DO' : 'en-US', { month: 'short', year: 'numeric' }),
      scope: counts[1] > 1 ? (isEs ? `${counts[1]} títulos` : `${counts[1]} titles`) : '',
      placement: 1,
      ribbon: latestHeadline,
    }
  }

  const adaptTeamForCard = (team) => {
    const publicCode = isValidPublic(team.publicCode) ? team.publicCode : (team.publicCode || teamPublicCode(team.region || 'RD', team.tag || team.name))
    const internalCode = isValidInternal(team.internalCode) ? team.internalCode : (team.internalCode || teamInternalCode(team.region || 'RD', team.tag || team.name, team.createdAt || new Date('2025-05-10')))
    const tierKeys = Array.isArray(team.tiers) && team.tiers.length ? team.tiers : ['nuevo']
    const category = getTeamCardGameCategory(team.game)
    const tags = [
      ...tierKeys.map(key => ({ label: configs[key]?.label || key, on: true })),
      team.level || 'Amateur',
      category,
      String(team.lang || 'ES').substring(0, 2).toUpperCase(),
      team.joinScope === 'country' && team.country ? (isEs ? `Solo ${team.country}` : `${team.country} only`) : null,
      team.joinScope === 'region' && team.region ? (isEs ? `Solo ${team.region}` : `${team.region} only`) : null,
    ].filter(Boolean)

    return {
      name: team.name || 'Equipo',
      crest: team.logo || team.crest || '',
      initials: (team.tag || team.name || 'TE').substring(0, 2).toUpperCase(),
      code: publicCode,
      longCode: internalCode,
      shortCode: teamCardShortCode(publicCode, team.tag),
      game: team.game || 'GlitchGang',
      region: team.region || 'Global',
      country: team.country || '',
      flag: flagUrl(team.country),
      gender: { key: teamGenderKey(team.gender), label: teamGenderLabel(team.gender, isEs) },
      founded: team.createdAt ? new Date(team.createdAt).getFullYear() : '',
      bio: `"${team.slogan || team.description || (isEs ? 'Llegaremos alto!' : 'To the top!')}"`,
      tags,
      members: teamCardMembers(team),
      capacity: getRosterTotalSlots(team),
      roster: teamCardRoster(team),
      distinction: team.distinction || (tierKeys.includes('legendario') ? 'Campeon nacional' : ''),
      title: cardTitle(team),
    }
  }

  const getSubFilterCount = (filterType) => {
    return teamsList.filter(t => {
      const matchGame = filterGame === 'All' || t.game === filterGame;
      return matchGame && matchSubFilter(t, filterType);
    }).length;
  }

  const createStepMeta = {
    1: {
      code: isEs ? 'GG - SETUP - 01 - IDENTIDAD' : 'GG - SETUP - 01 - IDENTITY',
      title: isEs ? 'Identidad' : 'Identity',
      subtitle: isEs ? 'Define nombre, region, juego y capitan antes de abrir el roster.' : 'Define name, region, game and captain before opening the roster.',
      percent: 17,
      next: isEs ? 'Siguiente: roster' : 'Next: roster',
    },
    2: {
      code: isEs ? 'GG - SETUP - 02 - ROSTER' : 'GG - SETUP - 02 - ROSTER',
      title: 'Roster',
      subtitle: isEs ? 'Cinco titulares para poder inscribirte. Discord y WhatsApp quedan preparados para la proxima capa.' : 'Five starters to register. Discord and WhatsApp are prepared for the next layer.',
      percent: 54,
      next: isEs ? 'Siguiente: publicar' : 'Next: publish',
    },
    3: {
      code: isEs ? 'GG - SETUP - 03 - PUBLICAR' : 'GG - SETUP - 03 - SHARE',
      title: isEs ? 'Publicar' : 'Share',
      subtitle: isEs ? 'Comparte el equipo y el enlace para completar integrantes.' : 'Share the team and the link to complete members.',
      percent: 100,
      next: isEs ? 'Completado' : 'Complete',
    },
  }
  const currentCreateStep = createStepMeta[creationStep] || createStepMeta[1]

  return (
    <div className={`gg-page gg-teams ${isTeamPanelMode ? 'gg-teams--team-panel' : ''}`} data-theme-mode={themeMode} data-lang={lang}>

      {/* HEADER */}
      <PageHeader
        title={isTeamPanelMode ? (isEs ? 'Mi equipo' : 'My team') : (p.myTeamsTab || 'Equipos & Directorios')}
        sub={isTeamPanelMode
          ? (isEs ? 'Configura tu equipo, roster, privacidad y la pagina publica que ven otros jugadores.' : 'Configure your team, roster, privacy and the public page other players see.')
          : (isEs ? 'Organiza escuadras, busca rivales para scrims y recluta jugadores.' : 'Organize squads, find scrim opponents and recruit players.')}
      />

      {!isCreating && (!isTeamPanelMode || !myTeam) && (
        <div className="gg-teams__quick-actions">
          <button
            type="button"
            className="gg-btn-create-team"
            onClick={openCreateTeamWizard}
          >
            {Icon.plus}
            <span>{isTeamPanelMode ? (isEs ? 'Crear mi equipo' : 'Create my team') : (isEs ? 'Crear Equipo' : 'Create Team')}</span>
          </button>
        </div>
      )}

      {error && <p className="gg-auth-err" style={{ marginBottom: '20px' }}>{error}</p>}

      {/* ─── CREATION MULTI-STEP WIZARD ─── */}
      <AnimatePresence mode="wait">
        {isCreating && (
          <motion.div
            className="gg-teams__wizard-card gg-team-create-wizard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TeamCreateDcWizard
              isEs={isEs}
              user={user}
              creationStep={creationStep}
              setCreationStep={setCreationStep}
              setIsCreating={setIsCreating}
              formName={formName}
              setFormName={setFormName}
              formTag={formTag}
              setFormTag={setFormTag}
              formSlogan={formSlogan}
              setFormSlogan={setFormSlogan}
              formDescription={formDescription}
              setFormDescription={setFormDescription}
              descriptionTouched={descriptionTouched}
              setDescriptionTouched={setDescriptionTouched}
              formGender={formGender}
              setFormGender={setFormGender}
              formRegion={formRegion}
              setFormRegion={setFormRegion}
              formCountry={formCountry}
              setFormCountry={setFormCountry}
              formTiers={formTiers}
              formJoinScope={formJoinScope}
              setFormJoinScope={setFormJoinScope}
              onSaveDraft={saveWizardDraft}
              resumed={wizardResumed}
              formCommunity={formCommunity}
              setFormCommunity={setFormCommunity}
              formSponsor={formSponsor}
              setFormSponsor={setFormSponsor}
              formCategory={formCategory}
              setFormCategory={setFormCategory}
              formGame={formGame}
              setFormGame={setFormGame}
              formLang={formLang}
              setFormLang={setFormLang}
              formLevel={formLevel}
              setFormLevel={setFormLevel}
              formLogo={formLogo}
              setFormLogo={setFormLogo}
              captName={captName}
              setCaptName={setCaptName}
              captNick={captNick}
              setCaptNick={setCaptNick}
              captTag={captTag}
              setCaptTag={setCaptTag}
              captRole={captRole}
              setCaptRole={setCaptRole}
              captSlotKey={captSlotKey}
              setCaptSlotKey={setCaptSlotKey}
              rosterInputs={rosterInputs}
              rosterPlayerForms={rosterPlayerForms}
              setRosterPlayerForms={setRosterPlayerForms}
              selectableTierKeys={['universitario'].filter(key => configs[key])}
              configs={configs}
              handleToggleTier={handleToggleTier}
              handleStep1Submit={handleStep1Submit}
              handleStep2Submit={handleStep2Submit}
              createdTeamData={createdTeamData}
              GAME_CATEGORIES={GAME_CATEGORIES}
              GAME_ROSTER_SLOTS_LABELS={GAME_ROSTER_SLOTS_LABELS}
            />
            {false && (
            <>
            <div className="gg-create-console-rail">
              <span>{isEs ? 'Crear escuadra' : 'Squad setup'}</span>
            </div>

            <div className="gg-create-console-head">
              <div className="gg-create-console-head__copy">
                <span className="gg-create-console-code">{currentCreateStep.code}</span>
                <h2>{currentCreateStep.title}</h2>
                <p>{currentCreateStep.subtitle}</p>
              </div>
              <div className="gg-create-console-progress">
                <b>{currentCreateStep.percent}%</b>
                <span>{isEs ? 'completo' : 'complete'}</span>
              </div>
            </div>

            <div className="gg-create-progress-bars" aria-label={isEs ? 'Progreso de creacion' : 'Creation progress'}>
              {[1, 2, 3].map(step => {
                const meta = createStepMeta[step]
                const active = creationStep >= step
                return (
                  <button
                    key={step}
                    type="button"
                    className={`gg-create-progress-bars__item ${active ? 'active' : ''}`}
                    onClick={() => {
                      if (step < creationStep || (step === 2 && formName && formGame && captName && captNick) || (step === 3 && createdTeamData)) setCreationStep(step)
                    }}
                  >
                    <i><span style={{ width: active ? '100%' : '0%' }} /></i>
                    <strong>{String(step).padStart(2, '0')} {meta.title}</strong>
                    <em>{step === 1 ? (isEs ? 'identidad' : 'identity') : step === 2 ? 'roster' : (isEs ? 'publicar' : 'share')}</em>
                  </button>
                )
              })}
            </div>

            {/* STEP 1: IDENTITY */}
            {creationStep === 1 && (
              <form onSubmit={handleStep1Submit} className="gg-wizard__form">
                <div className="gg-wizard__section gg-wizard__section--identity">
                  <h4>{isEs ? 'Identidad del equipo' : 'Team identity'}</h4>
                  <div className="gg-wizard__logo-row">
                    <PhotoUpload
                      variant="logo"
                      value={formLogo}
                      onChange={setFormLogo}
                      label={isEs ? 'Logo del equipo' : 'Team logo'}
                    />
                    <div className="gg-wizard__logo-hint">
                      <b>{isEs ? 'Sube el logo de tu escuadra' : 'Upload your squad logo'}</b>
                      <span>{isEs ? 'PNG o JPG, preferiblemente cuadrado (512 x 512 px).' : 'PNG or JPG, square preferred (512 x 512 px).'}</span>
                    </div>
                  </div>
                  <div className="gg-wizard__grid">
                    <Input
                      label={isEs ? 'Nombre del equipo *' : 'Team Name *'}
                      placeholder="ej: Glitch Core"
                      value={formName} onChange={e => setFormName(e.target.value)}
                      required
                    />
                    <Input
                      label={isEs ? 'Eslogan / grito de guerra' : 'Slogan / war cry'}
                      placeholder={isEs ? 'ej: Hasta el final' : 'ex: To the end'}
                      value={formSlogan} onChange={e => setFormSlogan(e.target.value)}
                    />
                    <div className="gg-wizard__field">
                      <label>{isEs ? 'Genero' : 'Gender'}</label>
                      <select value={formGender} onChange={e => setFormGender(e.target.value)}>
                        <option value="Mixto (Cualquiera)">{isEs ? 'Mixto (Cualquiera)' : 'Mixed (Any)'}</option>
                        <option value="Masculino">{isEs ? 'Masculino' : 'Male'}</option>
                        <option value="Femenino">{isEs ? 'Femenino' : 'Female'}</option>
                      </select>
                    </div>
                    <Input
                      label={isEs ? 'Pais / region *' : 'Country / region *'}
                      placeholder={isEs ? 'ej: LAN, LAS, Mexico, RD' : 'ex: LAN, LAS, Mexico, DR'}
                      value={formRegion} onChange={e => setFormRegion(e.target.value)}
                      required
                    />
                    <div className="gg-wizard__field">
                      <label>{isEs ? 'Nivel competitivo *' : 'Competitive Level *'}</label>
                      <select value={formLevel} onChange={e => setFormLevel(e.target.value)}>
                        <option value="Amateur">{isEs ? 'Amateur (Torneos Menores)' : 'Amateur (Minor Tournaments)'}</option>
                        <option value="Semi-Pro">{isEs ? 'Semi-Pro (Torneos Medianos)' : 'Semi-Pro (Mid Tournaments)'}</option>
                        <option value="Profesional">{isEs ? 'Profesional (Liga Mayor)' : 'Professional (Major League)'}</option>
                      </select>
                    </div>
                    <div className="gg-wizard__field">
                      <label>{isEs ? 'Idioma' : 'Language'}</label>
                      <select value={formLang} onChange={e => setFormLang(e.target.value)}>
                        <option value="Espanol">Espanol</option>
                        <option value="English">English</option>
                        <option value="Portugues">Portugues</option>
                      </select>
                    </div>
                    <Input
                      label={isEs ? 'Patrocinador opcional' : 'Sponsor optional'}
                      placeholder="ej: Federacion Dominicana de Videojuegos, NPC Latino"
                      value={formSponsor} onChange={e => setFormSponsor(e.target.value)}
                    />
                    <div className="gg-wizard__field">
                      <label>{isEs ? 'Comunidad opcional' : 'Community optional'}</label>
                      <select value={formCommunity} onChange={e => setFormCommunity(e.target.value)}>
                        <option value="">{isEs ? 'Sin comunidad' : 'No community'}</option>
                        <option value="Steliant Esports Official">Steliant Esports Official</option>
                        <option value="Dominican eSports">Dominican eSports</option>
                        <option value="LATAM Pro League">LATAM Pro League</option>
                      </select>
                    </div>
                    <div className="gg-wizard__field" style={{ gridColumn: 'span 2' }}>
                      <label>{isEs ? 'Perfil de la escuadra' : 'Squad profile'}</label>
                      <textarea
                        rows={3}
                        placeholder={isEs ? 'Describe brevemente el perfil, metas y ambiente de tu escuadra...' : 'Briefly describe your squad profile, goals and vibes...'}
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--bg-elev)',
                          border: '1px solid var(--line)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          outline: 'none',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Categories / Tiers Toggles */}
                <div className="gg-wizard__section gg-wizard__section--compact">
                  <h4>{isEs ? 'Tiers activos' : 'Active tiers'}</h4>
                  <div className="gg-wizard__tiers-flex">
                    {selectableTierKeys.map(tierKey => {
                      const isActive = formTiers.includes(tierKey)
                      const c = configs[tierKey]
                      return (
                        <button
                          key={tierKey} type="button"
                          className={`gg-tier-pill-btn ${isActive ? 'active' : ''}`}
                          style={{ '--tier-c': c.hex }}
                          onClick={() => handleToggleTier(tierKey)}
                        >
                          <span className="dot" style={{ backgroundColor: c.hex }} />
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="gg-wizard__hint">
                    {isEs ? 'Legendario y Siguiente Liga se asignan internamente por rendimiento del equipo.' : 'Legendary and Next League are assigned internally based on team performance.'}
                  </p>
                </div>

                {/* Discipline Selection */}
                <div className="gg-wizard__section gg-wizard__section--compact">
                  <h4>{isEs ? 'Disciplina y juego principal' : 'Discipline and main game'}</h4>
                  <div className="gg-wizard__grid">
                    <div className="gg-wizard__field">
                      <label>{isEs ? 'Categoria *' : 'Category *'}</label>
                      <select
                        value={formCategory}
                        onChange={e => {
                          setFormCategory(e.target.value)
                          setFormGame('')
                        }}
                        required
                      >
                        <option value="">{isEs ? 'Seleccionar categoría...' : 'Select category...'}</option>
                        {Object.keys(GAME_CATEGORIES).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="gg-wizard__field">
                      <label>{isEs ? 'Juego principal *' : 'Main game *'}</label>
                      <select
                        value={formGame}
                        onChange={e => setFormGame(e.target.value)}
                        disabled={!formCategory}
                        required
                      >
                        <option value="">{isEs ? 'Seleccionar juego...' : 'Select game...'}</option>
                        {formCategory && GAME_CATEGORIES[formCategory].map(game => (
                          <option key={game} value={game}>{game}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Captain Verification */}
                <div className="gg-wizard__section gg-wizard__section--compact">
                  <h4>{isEs ? 'Capitan del equipo' : 'Team captain'}</h4>
                  <div className="gg-wizard__grid">
                    <Input
                      label={isEs ? 'Nombre completo' : 'Full name'}
                      value={captName} onChange={e => setCaptName(e.target.value)}
                      required
                    />
                    <Input
                      label={isEs ? 'Nick en juego' : 'In-game nick'}
                      value={captNick} onChange={e => setCaptNick(e.target.value)}
                      required
                    />
                    <Input
                      label={isEs ? 'Usuario / tag competitivo' : 'Competitive user / tag'}
                      placeholder="#1234 o tag"
                      value={captTag} onChange={e => setCaptTag(e.target.value)}
                    />
                    <Input
                      label={isEs ? 'Rol principal' : 'Main role'}
                      placeholder="ej: Mid, Roamer, IGL"
                      value={captRole} onChange={e => setCaptRole(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="gg-wizard__actions">
                  <Button variant="ghost" type="button" onClick={() => setIsCreating(false)}>
                    {isEs ? 'Cancelar' : 'Cancel'}
                  </Button>
                  <Button variant="primary" type="submit" disabled={!formName || !formGame || !captName || !captNick || !captRole}>
                    {isEs ? 'Siguiente: Roster' : 'Next: Roster'}
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 2: ROSTER DEFINITION */}
            {creationStep === 2 && (
              <form onSubmit={handleStep2Submit} className="gg-wizard__form">
                <div className="gg-wizard__section">
                  <div className="gg-roster-header-wrap">
                    <h4>{isEs ? `Estructura del Roster: ${formGame}` : `Roster Structure: ${formGame}`}</h4>
                    <p className="dim">
                      {isEs
                        ? `Completa los datos de cada integrante. Solo los titulares son requeridos.`
                        : `Fill in player details. Only starters are required.`}
                    </p>
                  </div>

                  <div className="gg-roster-players-wrap">
                    {/* TITULARES / STARTERS */}
                    {Object.keys(rosterInputs).filter(k => k.startsWith('titular')).length > 0 && (
                      <div className="gg-roster-category">
                        <h5>{isEs ? 'TITULARES' : 'STARTERS'}</h5>
                        <div className="gg-roster-category-grid">
                          {Object.keys(rosterInputs).filter(k => k.startsWith('titular')).map(key => {
                            const num = key.split('-')[1]
                            const posLabel = GAME_ROSTER_SLOTS_LABELS[formGame]?.titulares?.[parseInt(num) - 1] || `Titular ${num}`
                            return (
                              <div className="gg-roster-player-card" key={key}>
                                <div className="card-header">
                                  <PhotoUpload
                                    value={rosterPlayerForms[key]?.photo}
                                    onChange={dataUrl => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], photo: dataUrl } }))}
                                  />
                                  <div className="pos-badge">{num}</div>
                                  <div className="gg-roster-card-title">
                                    <h6>{posLabel}</h6>
                                    <small>{key === captSlotKey ? (isEs ? 'Capitan requerido' : 'Required captain') : (isEs ? 'Titular requerido' : 'Required starter')}</small>
                                  </div>
                                  {key !== captSlotKey && (
                                    <button type="button" className="dcb-verify-btn" onClick={() => {
                                      setCaptSlotKey(key)
                                      setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], gameNick: p[key]?.gameNick || captNick, name: p[key]?.name || captName } }))
                                    }}>
                                      {isEs ? 'Este soy yo' : 'This is me'}
                                    </button>
                                  )}
                                </div>
                                <div className="card-form">
                                  <div className="input-row">
                                    <RosterSlotField label={isEs ? 'Nombre completo' : 'Full name'}>
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Nombre legal del jugador' : 'Player legal name'}
                                        value={rosterPlayerForms[key]?.name || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], name: e.target.value } }))}
                                        required={key === captSlotKey}
                                      />
                                    </RosterSlotField>
                                    <RosterSlotField label={isEs ? 'Nick en juego' : 'In-game nick'}>
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Alias competitivo' : 'Competitive alias'}
                                        value={rosterPlayerForms[key]?.gameNick || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], gameNick: e.target.value } }))}
                                        required={key === captSlotKey}
                                      />
                                    </RosterSlotField>
                                  </div>
                                  <div className="input-row">
                                    <RosterSlotField label={isEs ? 'Cedula' : 'ID number'}>
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Documento si el torneo lo pide' : 'Document if required'}
                                        value={rosterPlayerForms[key]?.cedula || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], cedula: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                    <RosterSlotField label={gameAccountFormat(formGame).label}>
                                      <input
                                        type="text"
                                        placeholder={gameAccountFormat(formGame).placeholder}
                                        value={rosterPlayerForms[key]?.gameId || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], gameId: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                  </div>
                                  <div className="input-row">
                                    <RosterSlotField label="Discord">
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Usuario de Discord' : 'Discord username'}
                                        value={rosterPlayerForms[key]?.discordName || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], discordName: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                    {WHATSAPP_ENABLED && (
                                      <RosterSlotField label="WhatsApp">
                                        <input
                                          type="text"
                                          placeholder={isEs ? 'Numero para avisos rapidos' : 'Number for quick notices'}
                                          value={rosterPlayerForms[key]?.whatsapp || ''}
                                          onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], whatsapp: e.target.value } }))}
                                        />
                                      </RosterSlotField>
                                    )}
                                  </div>
                                  <div className="input-row input-row--single">
                                    <RosterSlotField label={isEs ? 'Discord ID' : 'Discord ID'}>
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Opcional por ahora, luego sera vinculado' : 'Optional for now, later linked'}
                                        value={rosterPlayerForms[key]?.discordId || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], discordId: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* SUPLENTES / SUBSTITUTES */}
                    {Object.keys(rosterInputs).filter(k => k.startsWith('sub')).length > 0 && (
                      <div className="gg-roster-category">
                        <h5>{isEs ? 'SUPLENTES' : 'SUBSTITUTES'}</h5>
                        <div className="gg-roster-category-grid">
                          {Object.keys(rosterInputs).filter(k => k.startsWith('sub')).map(key => {
                            const num = key.split('-')[1]
                            return (
                              <div className="gg-roster-player-card gg-player-optional" key={key}>
                                <div className="card-header">
                                  <div className="pos-badge">{isEs ? 'SUP' : 'SUB'}</div>
                                  <div className="gg-roster-card-title">
                                    <h6>{`${isEs ? 'Suplente' : 'Sub'} #${num}`}</h6>
                                    <small>{key === captSlotKey ? (isEs ? 'Capitan (tu)' : 'Captain (you)') : (isEs ? 'Opcional para banca' : 'Optional bench slot')}</small>
                                  </div>
                                  {key !== captSlotKey && (
                                    <button type="button" className="dcb-verify-btn" onClick={() => {
                                      setCaptSlotKey(key)
                                      setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], gameNick: p[key]?.gameNick || captNick, name: p[key]?.name || captName } }))
                                    }}>
                                      {isEs ? 'Este soy yo' : 'This is me'}
                                    </button>
                                  )}
                                </div>
                                <div className="card-form">
                                  <div className="input-row">
                                    <RosterSlotField label={isEs ? 'Nick en juego' : 'In-game nick'}>
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Alias competitivo' : 'Competitive alias'}
                                        value={rosterPlayerForms[key]?.gameNick || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], gameNick: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                    <RosterSlotField label="Discord">
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Usuario de Discord' : 'Discord username'}
                                        value={rosterPlayerForms[key]?.discordName || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], discordName: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                  </div>
                                  {WHATSAPP_ENABLED && (
                                    <RosterSlotField label="WhatsApp">
                                      <input
                                        type="text"
                                        placeholder={isEs ? 'Numero para avisos rapidos' : 'Number for quick notices'}
                                        value={rosterPlayerForms[key]?.whatsapp || ''}
                                        onChange={e => setRosterPlayerForms(p => ({ ...p, [key]: { ...p[key], whatsapp: e.target.value } }))}
                                      />
                                    </RosterSlotField>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* STAFF — Coach y Manager siempre disponibles */}
                    <div className="gg-roster-category">
                      <h5>{isEs ? 'STAFF / EQUIPO TÉCNICO' : 'STAFF'}</h5>
                      <div className="gg-roster-category-grid">
                        {/* COACH */}
                        <div className="gg-roster-player-card gg-player-optional" key="coach">
                          <div className="card-header">
                            <PhotoUpload
                              value={rosterPlayerForms.coach?.photo}
                              onChange={d => setRosterPlayerForms(p => ({ ...p, coach: { ...p.coach, photo: d } }))}
                            />
                            <div className="pos-badge">{isEs ? 'COA' : 'COACH'}</div>
                            <div className="gg-roster-card-title">
                              <h6>Coach</h6>
                              <small>{isEs ? 'Soporte tecnico' : 'Technical support'}</small>
                            </div>
                            <button
                              type="button"
                              className="gg-roster-staff-search-btn"
                              onClick={() => setStaffSearchRole('coach')}
                              title={isEs ? 'Buscar coach registrado' : 'Search registered coach'}
                            >
                              {Icon.search} {isEs ? 'Buscar' : 'Search'}
                            </button>
                          </div>
                          <div className="card-form">
                            <div className="input-row">
                              <RosterSlotField label={isEs ? 'Nombre / nick' : 'Name / nick'}>
                                <input
                                  type="text"
                                  placeholder={isEs ? 'Nombre o alias' : 'Name or alias'}
                                  value={rosterPlayerForms.coach?.gameNick || ''}
                                  onChange={e => setRosterPlayerForms(p => ({ ...p, coach: { ...p.coach, gameNick: e.target.value } }))}
                                />
                              </RosterSlotField>
                              <RosterSlotField label="Discord">
                                <input
                                  type="text"
                                  placeholder={isEs ? 'Usuario de Discord' : 'Discord username'}
                                  value={rosterPlayerForms.coach?.discordName || ''}
                                  onChange={e => setRosterPlayerForms(p => ({ ...p, coach: { ...p.coach, discordName: e.target.value } }))}
                                />
                              </RosterSlotField>
                            </div>
                          </div>
                        </div>

                        {/* MANAGER */}
                        <div className="gg-roster-player-card gg-player-optional" key="manager">
                          <div className="card-header">
                            <PhotoUpload
                              value={rosterPlayerForms.manager?.photo}
                              onChange={d => setRosterPlayerForms(p => ({ ...p, manager: { ...p.manager, photo: d } }))}
                            />
                            <div className="pos-badge">MGR</div>
                            <div className="gg-roster-card-title">
                              <h6>Manager</h6>
                              <small>{isEs ? 'Gestion del equipo' : 'Team management'}</small>
                            </div>
                          </div>
                          <div className="card-form">
                            <div className="input-row">
                              <RosterSlotField label={isEs ? 'Nombre / nick' : 'Name / nick'}>
                                <input
                                  type="text"
                                  placeholder={isEs ? 'Nombre o alias' : 'Name or alias'}
                                  value={rosterPlayerForms.manager?.gameNick || ''}
                                  onChange={e => setRosterPlayerForms(p => ({ ...p, manager: { ...p.manager, gameNick: e.target.value } }))}
                                />
                              </RosterSlotField>
                              <RosterSlotField label="Discord">
                                <input
                                  type="text"
                                  placeholder={isEs ? 'Usuario de Discord' : 'Discord username'}
                                  value={rosterPlayerForms.manager?.discordName || ''}
                                  onChange={e => setRosterPlayerForms(p => ({ ...p, manager: { ...p.manager, discordName: e.target.value } }))}
                                />
                              </RosterSlotField>
                            </div>
                          </div>
                        </div>

                        {/* ANALISTA (según el juego) */}
                        {rosterInputs.analyst && (
                          <div className="gg-roster-player-card gg-player-optional" key="analyst">
                            <div className="card-header">
                              <PhotoUpload
                                value={rosterPlayerForms.analyst?.photo}
                                onChange={d => setRosterPlayerForms(p => ({ ...p, analyst: { ...p.analyst, photo: d } }))}
                              />
                              <div className="pos-badge">{isEs ? 'ANA' : 'ANLY'}</div>
                              <div className="gg-roster-card-title">
                                <h6>{isEs ? 'Analista' : 'Analyst'}</h6>
                                <small>{isEs ? 'Datos y scouting' : 'Data and scouting'}</small>
                              </div>
                              <button
                                type="button"
                                className="gg-roster-staff-search-btn"
                                onClick={() => setStaffSearchRole('analyst')}
                                title={isEs ? 'Buscar analista registrado' : 'Search registered analyst'}
                              >
                                {Icon.search} {isEs ? 'Buscar' : 'Search'}
                              </button>
                            </div>
                            <div className="card-form">
                              <div className="input-row">
                                <RosterSlotField label={isEs ? 'Nombre / nick' : 'Name / nick'}>
                                  <input
                                    type="text"
                                    placeholder={isEs ? 'Nombre o alias' : 'Name or alias'}
                                    value={rosterPlayerForms.analyst?.gameNick || ''}
                                    onChange={e => setRosterPlayerForms(p => ({ ...p, analyst: { ...p.analyst, gameNick: e.target.value } }))}
                                  />
                                </RosterSlotField>
                                <RosterSlotField label="Discord">
                                  <input
                                    type="text"
                                    placeholder={isEs ? 'Usuario de Discord' : 'Discord username'}
                                    value={rosterPlayerForms.analyst?.discordName || ''}
                                    onChange={e => setRosterPlayerForms(p => ({ ...p, analyst: { ...p.analyst, discordName: e.target.value } }))}
                                  />
                                </RosterSlotField>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {typeof document !== 'undefined' && createPortal(
                  <AnimatePresence>
                    {staffSearchRole && (
                      <motion.div
                        className="scrim-form-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setStaffSearchRole(null)}
                      >
                        <motion.div
                          className="scrim-form-modal gg-staff-search-modal"
                          initial={{ scale: 0.95, y: 15 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0.95, y: 15 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="modal-head">
                            <h4>{isEs ? 'Buscar staff registrado' : 'Search registered staff'}</h4>
                            <button className="close-btn" onClick={() => setStaffSearchRole(null)}>{Icon.x}</button>
                          </div>
                          <RoleStaffSearch
                            roles={staffSearchRole ? [staffSearchRole] : []}
                            selectLabel={isEs ? 'Elegir' : 'Pick'}
                            emptyLabel={isEs ? 'Nadie con este rol aprobado todavia.' : 'No one with this approved role yet.'}
                            onSelect={member => applyStaffSelection(staffSearchRole, member)}
                          />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>,
                  document.body,
                )}

                <div className="gg-wizard__actions">
                  <Button variant="ghost" type="button" onClick={() => setCreationStep(1)}>
                    {isEs ? '← Atrás' : '← Back'}
                  </Button>
                  <Button variant="primary" type="submit">
                    {isEs ? 'Crear y Compartir →' : 'Create & Share →'}
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 3: SHARE */}
            {creationStep === 3 && createdTeamData && (() => {
              const inviteUrl = `${window.location.origin}/equipos/unirse/${createdTeamData.teamInviteCode || ''}`
              const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(inviteUrl)}`
              const SHARE_TABS = [
                { id: 'qr',     label: isEs ? 'Código QR' : 'QR Code',  icon: Icon.gamepad },
                { id: 'link',   label: isEs ? 'Enlace' : 'Link',        icon: Icon.link },
                { id: 'amigos', label: isEs ? 'Amigos' : 'Friends',     icon: Icon.friends },
                { id: 'redes',  label: isEs ? 'Redes' : 'Social',       icon: Icon.globe },
              ]
              const friends = shareFriends
                .filter(f => !shareFriendSearch || f.name.toLowerCase().includes(shareFriendSearch.toLowerCase()))

              return (
              <div className="gg-share-stage">
                <div className="gg-share-stage__head">
                  <div className="gg-share-stage__check">{Icon.check}</div>
                  <div>
                    <h2>{isEs ? '¡Equipo creado!' : 'Team created!'}</h2>
                    <p>{isEs ? 'Invita a tus jugadores para completar tu roster.' : 'Invite your players to complete the roster.'}</p>
                  </div>
                </div>
<div className="gg-share-grid">
                  {/* Left: team card preview */}
                  <div className="gg-share-card" style={{ '--grad-bg': getTeamGradientStyle(createdTeamData.tiers, configs).background }}>
                    <div className="card-head">
                      <div className="logo-box">
                        {createdTeamData.logo
                          ? <img src={createdTeamData.logo} alt={createdTeamData.name} />
                          : createdTeamData.name[0]}
                      </div>
                      <div>
                        <h3>{createdTeamData.name} <small>[{createdTeamData.tag}]</small></h3>
                        <p className="slogan">"{createdTeamData.slogan}"</p>
                      </div>
                    </div>
                    <div className="card-meta">
                      <div className="meta-row"><span>{isEs ? 'Juego' : 'Game'}</span><strong>{createdTeamData.game}</strong></div>
                      <div className="meta-row"><span>{isEs ? 'Región' : 'Region'}</span><strong>{createdTeamData.region}</strong></div>
                      <div className="meta-row"><span>{isEs ? 'ID del equipo' : 'Team ID'}</span><strong>{createdTeamData.publicCode || teamPublicCode(createdTeamData.region || 'RD', createdTeamData.tag || createdTeamData.name)}</strong></div>
                      <div className="meta-row"><span>{isEs ? 'ID interno' : 'Internal ID'}</span><strong>{createdTeamData.internalCode || teamInternalCode(createdTeamData.region || 'RD', createdTeamData.tag || createdTeamData.name, new Date())}</strong></div>
                    </div>
                    <div className="card-tiers">
                      {createdTeamData.tiers.map(t => (
                        <span key={t} className={`badge-pill ${configs[t]?.class}`}>{configs[t]?.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* Right: share methods */}
                  <div className="gg-share-panel">
                    <div className="gg-teams__tabs-container gg-share-tabs">
                      {SHARE_TABS.map(s => (
                        <button key={s.id} className={`gg-tab-btn ${shareMethod === s.id ? 'active' : ''}`} onClick={() => setShareMethod(s.id)}>
                          {s.icon} {s.label}
                        </button>
                      ))}
                    </div>

                    <div className="gg-share-content">
                      {shareMethod === 'qr' && (
                        <div className="gg-share-qr">
                          <div className="gg-share-qr__frame"><img src={qrSrc} alt="QR" /></div>
                          <p>{isEs ? 'Escanea para unirte al equipo' : 'Scan to join the team'}</p>
                        </div>
                      )}

                      {shareMethod === 'link' && (
                        <div className="gg-share-link">
                          <label>{isEs ? 'Enlace de invitación' : 'Invite link'}</label>
                          <div className="gg-share-link__box">
                            <input readOnly value={inviteUrl} />
                            <button onClick={copyRecruitmentLink}>{Icon.link} {isEs ? 'Copiar' : 'Copy'}</button>
                          </div>
                          <label>{isEs ? 'Código de invitación' : 'Invite code'}</label>
                          <div className="gg-share-code-box">
                            <code>{createdTeamData.teamInviteCode}</code>
                            <button onClick={() => { navigator.clipboard.writeText(createdTeamData.teamInviteCode || ''); setShowCopiedAlert(true); setTimeout(() => setShowCopiedAlert(false), 2500) }}>{isEs ? 'Copiar' : 'Copy'}</button>
                          </div>
                        </div>
                      )}

                      {shareMethod === 'amigos' && (
                        <div className="gg-share-friends">
                          <div className="gg-share-friends__search">
                            {Icon.search}
                            <input value={shareFriendSearch} onChange={e => setShareFriendSearch(e.target.value)} placeholder={isEs ? 'Buscar amigo…' : 'Search friend…'} />
                          </div>
                          <div className="gg-share-friends__list">
                            {friends.map(f => (
                              <div className="gg-share-friend" key={f.id}>
                                <img src={f.avatar || '/demos/steliant-esports/avatar-default.svg'} alt={f.name} />
                                <div><b>{f.name}</b><small>{f.subtitle}</small></div>
                                <button
                                  disabled={invitedFriendIds.includes(f.id)}
                                  title={invitedFriendIds.includes(f.id) ? (isEs ? 'Invitación enviada' : 'Invite sent') : undefined}
                                  onClick={() => sendTeamInviteToFriend(f, inviteUrl)}
                                >
                                  {invitedFriendIds.includes(f.id) ? Icon.check : Icon.send}
                                </button>
                              </div>
                            ))}
                            {friends.length === 0 && (
                              <p className="empty-text">
                                {shareFriendSearch
                                  ? (isEs ? 'Sin resultados' : 'No results')
                                  : (isEs ? 'Aún no tienes amigos agregados.' : 'You have no friends added yet.')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {shareMethod === 'redes' && (
                        <div className="gg-share-social">
                          <a className="gg-share-social__btn" style={{ '--brand': '#5865F2' }} href={`https://discord.com/channels/@me`} target="_blank" rel="noreferrer">{Icon.discord} Discord</a>
                          <a className="gg-share-social__btn" style={{ '--brand': '#25D366' }} href={`https://wa.me/?text=${encodeURIComponent(inviteUrl)}`} target="_blank" rel="noreferrer">{Icon.whatsapp} WhatsApp</a>
                          <a className="gg-share-social__btn" style={{ '--brand': '#1DA1F2' }} href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(inviteUrl)}`} target="_blank" rel="noreferrer">{Icon.globe} X / Twitter</a>
                          <a className="gg-share-social__btn" style={{ '--brand': '#FF0000' }} href={`https://www.youtube.com`} target="_blank" rel="noreferrer">{Icon.youtube} YouTube</a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="gg-share-stage__actions">
                  {SCRIMS_ENABLED && <Button variant="ghost" onClick={() => { setTab('scrims'); setIsCreating(false) }}>{Icon.bolt} {isEs ? 'Buscar Scrims' : 'Find Scrims'}</Button>}
                <Button variant="primary" onClick={() => navigate('/mi-equipo')}>{isEs ? 'Ir a mi equipo ->' : 'Go to my team ->'}</Button>
                </div>

                {showCopiedAlert && (
                  <motion.div className="gg-copied-toast" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                    {Icon.check} {isEs ? '¡Copiado al portapapeles!' : 'Copied to clipboard!'}
                  </motion.div>
                )}
              </div>
              )
            })()}
            </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SEARCH/TABS SECTION (IF NOT CREATING) ─── */}
      {!isCreating && (
        <>
          {/* Section Tabs */}
          {!isTeamPanelMode && (
          <div className="gg-teams__tabs-container gg-teams__main-tabs">
            <button
              className={`gg-tab-btn ${tab === 'equipos' ? 'active' : ''}`}
              onClick={() => { setTab('equipos'); setIsManaging(false); }}
            >
              {Icon.shield} <span>{isEs ? 'Equipos' : 'Teams'}</span>
            </button>
            <button
              className={`gg-tab-btn ${tab === 'scrims' ? 'active' : ''}`}
              onClick={() => { setTab('scrims'); setIsManaging(false); }}
            >
              {Icon.bolt} <span>{isEs ? 'Scrims' : 'Scrims'}</span>{!SCRIMS_ENABLED && <em className="gg-tab-soon">{isEs ? 'Próximamente' : 'Soon'}</em>}
            </button>
            <button
              className={`gg-tab-btn ${tab === 'buscar_equipo' ? 'active' : ''}`}
              onClick={() => { setTab('buscar_equipo'); setIsManaging(false); }}
            >
              {Icon.search} <span>{isEs ? 'Buscar Equipo' : 'Find Team'}</span>{!FIND_TABS_ENABLED && <em className="gg-tab-soon">{isEs ? 'Próximamente' : 'Soon'}</em>}
            </button>
            <button
              className={`gg-tab-btn ${tab === 'buscar_jugadores' ? 'active' : ''}`}
              onClick={() => { setTab('buscar_jugadores'); setIsManaging(false); }}
            >
              {Icon.friends} <span>{isEs ? 'Buscar Jugadores' : 'Find Players'}</span>{!FIND_TABS_ENABLED && <em className="gg-tab-soon">{isEs ? 'Próximamente' : 'Soon'}</em>}
            </button>
          </div>
          )}

          {/* TAB 1: EQUIPOS & MY TEAM DETAILS */}
          {tab === 'equipos' && (
            <>
              {isTeamPanelMode && !loading && !myTeam ? (
                <div className="gg-noteam-container gg-noteam-container--panel">
                  <span className="gg-noteam-icon">{Icon.shield}</span>
                  <h3>{isEs ? 'Todavia no tienes un equipo configurado' : 'You do not have a team configured yet'}</h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: '8px 0 20px 0' }}>
                    {isEs
                      ? 'Crea tu equipo para activar el panel privado, editar el roster y publicar su pagina web.'
                      : 'Create your team to activate the private panel, edit the roster and publish its web page.'}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button variant="primary" size="sm" onClick={openCreateTeamWizard}>
                      {isEs ? 'Crear mi equipo' : 'Create my team'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/equipos')}>
                      {isEs ? 'Ver directorio de equipos' : 'View team directory'}
                    </Button>
                  </div>
                </div>
              ) : (
              <>
              {isTeamPanelMode && myTeam && (
                <motion.section
                  className="team-panel-command"
                  style={{ '--team-panel-accent': configs[myTeam?.tiers?.[0]]?.hex || myTeam?.color || 'var(--accent)' }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="team-panel-command__media" style={myTeam?.banner ? { backgroundImage: `linear-gradient(135deg, rgba(5,8,12,.82), rgba(5,8,12,.42)), url(${myTeam.banner})` } : undefined} />
                  <div className="team-panel-command__body">
                    <div className="team-panel-command__logo" style={getTeamTierStyles(myTeam?.tiers)}>
                      {myTeam?.logo ? <img src={myTeam.logo} alt={myTeam?.name} /> : (myTeam?.tag || myTeam?.name || 'GG').substring(0, 3).toUpperCase()}
                    </div>
                    <div className="team-panel-command__main">
                      <span className="team-panel-command__eyebrow">{isEs ? 'Panel privado de equipo' : 'Private team panel'}</span>
                      <h2>{myTeam?.name || (isEs ? 'Mi equipo' : 'My team')}</h2>
                      <p>{myTeam?.description || myTeam?.slogan || (isEs ? 'Gestiona identidad, roster, privacidad y pagina publica desde un solo lugar.' : 'Manage identity, roster, privacy and public page from one place.')}</p>
                      <div className="team-panel-command__chips">
                        <span>{Icon.shield} {teamIdCode}</span>
                        <span>{Icon.gamepad} {myTeam?.game || formGame || 'Juego'}</span>
                        <span>{Icon.users} {Object.values(rosterSlotsState).filter(Boolean).length}/{getRosterTotalSlots(myTeam)} {isEs ? 'jugadores' : 'players'}</span>
                      </div>
                    </div>
                    <div className="team-panel-command__actions">
                      <Button variant="primary" size="sm" onClick={() => setManageTab('pagina')}>{Icon.edit} {isEs ? 'Editar web' : 'Edit web'}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setManageTab('roster')}>{Icon.users} Roster</Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/equipos/${myTeam?._id || myTeam?.id}`)}>{Icon.eye} {isEs ? 'Ver publica' : 'View public'}</Button>
                    </div>
                    <div className="team-panel-command__stats">
                      <span><b>{myTeam?.wins || 0}</b>{isEs ? 'Victorias' : 'Wins'}</span>
                      <span><b>{myTeam?.losses || 0}</b>{isEs ? 'Derrotas' : 'Losses'}</span>
                      <span><b>{acceptRequests ? (isEs ? 'Activo' : 'Open') : (isEs ? 'Cerrado' : 'Closed')}</b>{isEs ? 'Solicitudes' : 'Requests'}</span>
                      <span><b>{hideEmails ? (isEs ? 'Privado' : 'Private') : (isEs ? 'Visible' : 'Visible')}</b>{isEs ? 'Contacto' : 'Contact'}</span>
                    </div>
                  </div>
                </motion.section>
              )}

              <AnimatePresence>
                {isManaging && myTeam && (
                // VIEW B: TEAM DETAILED MANAGEMENT PANEL
                <motion.div
                  className={`gg-team-manager-overlay ${isTeamPanelMode ? 'gg-team-manager-overlay--embedded' : ''}`}
                  key="manager-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => { if (!isTeamPanelMode) setIsManaging(false) }}
                >
                <motion.div
                  className={`gg-team-manager-panel ${isTeamPanelMode ? 'gg-team-manager-panel--embedded' : ''}`}
                  key="manager-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {/* Head */}
                  <div className="manager-header">
                    <div className="manager-head-left">
                      <div className="team-avatar-box" style={getTeamTierStyles(myTeam?.tiers)}>
                        {myTeam?.logo
                          ? <img src={myTeam.logo} alt={myTeam?.name} />
                          : (myTeam?.name || '').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="team-profile-meta">
                        <div className="team-cedulas">
                          <span className="team-id-badge" title={isEs ? 'ID público' : 'Public ID'}>{teamIdCode}</span>
                          {teamIdInternal && (
                            <span className="team-internal-code" title={isEs ? 'ID extenso' : 'Extended ID'}>
                              {Icon.lock} {teamIdInternal}
                            </span>
                          )}
                        </div>
                        <h2>{myTeam?.name || ''}</h2>
                        <p className="subtitle">
                          <span className="game">{(myTeam?.game || '').toUpperCase()}</span>
                          <span className="level">{formLevel.toUpperCase() || 'AMATEUR'}</span>
                        </p>
                      </div>
                    </div>

                    {isTeamPanelMode ? (
                      <button className="manager-close-btn manager-close-btn--directory" onClick={() => navigate('/equipos')}>
                        {isEs ? 'Ver directorio' : 'Directory'}
                      </button>
                    ) : (
                      <button className="manager-close-btn" onClick={() => setIsManaging(false)}>
                        {Icon.x}
                      </button>
                    )}
                  </div>

                  {/* Tabs selector */}
                  <div className="manager-tabs-nav">
                    <button
                      className={`nav-btn ${manageTab === 'resumen' ? 'active' : ''}`}
                      onClick={() => setManageTab('resumen')}
                    >
                      {isEs ? 'Resumen' : 'Overview'}
                    </button>
                    <button
                      className={`nav-btn ${manageTab === 'roster' ? 'active' : ''}`}
                      onClick={() => setManageTab('roster')}
                    >
                      Roster
                    </button>
                    <button
                      className={`nav-btn ${manageTab === 'solicitudes' ? 'active' : ''}`}
                      onClick={() => setManageTab('solicitudes')}
                    >
                      Solicitudes {incomingRequests.length > 0 && <span className="count-badge">{incomingRequests.length}</span>}
                    </button>
                    <button
                      className={`nav-btn ${manageTab === 'pagina' ? 'active' : ''}`}
                      onClick={() => setManageTab('pagina')}
                    >
                      {isEs ? 'Pagina publica' : 'Public page'}
                    </button>
                    <button
                      className={`nav-btn ${manageTab === 'privacidad' ? 'active' : ''}`}
                      onClick={() => setManageTab('privacidad')}
                    >
                      {isEs ? 'Privacidad' : 'Privacy'}
                    </button>
                    <button
                      className={`nav-btn ${manageTab === 'invitaciones' ? 'active' : ''}`}
                      onClick={() => setManageTab('invitaciones')}
                    >
                      {isEs ? 'Invitaciones' : 'Invites'}
                    </button>
                  </div>

                  {/* Tab Content Render */}
                  <div className="manager-tab-content">
                    {/* RESUMEN TAB */}
                    {manageTab === 'resumen' && (
                      <div className="info-tab-view">
                        <div className="details-grid">
                          <div className="detail-item">
                            <span className="lbl">{isEs ? 'Categoría' : 'Category'}</span>
                            <strong className="val">{formCategory || 'MOBA'}</strong>
                          </div>
                          <div className="detail-item">
                            <span className="lbl">{isEs ? 'País / Región' : 'Country / Region'}</span>
                            <strong className="val">{[formRegion, formCountry].filter(Boolean).join(' · ') || captRegion || 'República Dominicana'}</strong>
                          </div>
                          <div className="detail-item">
                            <span className="lbl">{isEs ? 'Nivel competitivo' : 'Competitive Level'}</span>
                            <strong className="val">{formLevel || 'Amateur'}</strong>
                          </div>
                          <div className="detail-item">
                            <span className="lbl">{isEs ? 'Idioma' : 'Language'}</span>
                            <strong className="val">{formLang || 'Español'}</strong>
                          </div>
                          <div className="detail-item">
                            <span className="lbl">{isEs ? 'Género' : 'Gender'}</span>
                            <strong className="val">{formGender || 'Mixto'}</strong>
                          </div>
                          <div className="detail-item">
                            <span className="lbl">Roster</span>
                            <strong className="val">{Object.values(rosterSlotsState).filter(Boolean).length}/{getRosterTotalSlots(myTeam)} {isEs ? 'jugadores' : 'players'}</strong>
                          </div>
                        </div>

                        <div className="invite-code-card">
                          <span className="lbl">{isEs ? 'Código de Invitación' : 'Invitation Code'}</span>
                          <div className="code-box">
                            <code>{myTeam?.teamInviteCode}</code>
                            <div className="box-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(myTeam?.teamInviteCode || '')
                                  toast(isEs ? 'Código copiado' : 'Code copied')
                                }}
                              >
                                {isEs ? 'Copiar' : 'Copy'}
                              </Button>
                              <Button variant="primary" size="sm" onClick={handleEditTeam}>
                                {isEs ? 'Editar Información' : 'Edit Information'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ROSTER TAB */}
                    {manageTab === 'roster' && (
                      <div className="roster-tab-view">
                        <div className="roster-status-bar">
                          <span>{isEs ? 'Sincronizados:' : 'Synced:'} <b className="green">1</b></span>
                          <span>{isEs ? 'Con problemas:' : 'Issues:'} <b className="red">0</b></span>
                        </div>

                        {/* Section: Titulares */}
                        <div className="roster-section">
                          <h4>{isEs ? 'Titulares' : 'Starters'}</h4>
                          <div className="roster-list-rows">
                            {(() => {
                              const labels = GAME_ROSTER_SLOTS_LABELS[myTeam?.game || 'Mobile Legends']?.titulares || ['Titular 1', 'Titular 2', 'Titular 3', 'Titular 4', 'Titular 5']
                              return labels.map((label, idx) => {
                                const key = `titular-${idx + 1}`
                                const val = rosterSlotsState[key]

                                if (val) {
                                  return (
                                    <div className="roster-row filled" key={key}>
                                      <div className="slot-name">{label}</div>
                                      <div className="player-details">
                                        <span className="nick">{val.nick}</span>
                                        <span className="tag">{label}</span>
                                        <span className="sync-badge">{isEs ? 'Sincronizado' : 'Synced'}</span>
                                        <span className="game-id">
                                          {hideGameId ? (isEs ? 'ID Oculto' : 'ID Hidden') : val.gameId}
                                          {hideGameId && <span className="gg-id-lock" title={isEs ? "Oculto para externos" : "Hidden for externals"}>{Icon.lock}</span>}
                                        </span>
                                        {!hideEmails && val.email && val.email !== 'n/a' && (
                                          <span className="email-lbl" style={{ color: 'var(--text-dim)', fontSize: '11px', opacity: 0.7 }}>
                                            · {val.email}
                                          </span>
                                        )}
                                        {isLeader && val.cedula && (
                                          <span className="email-lbl" style={{ color: 'var(--text-dim)', fontSize: '11px', opacity: 0.7 }}>
                                            · {isEs ? 'Cedula' : 'ID'}: {val.cedula}
                                          </span>
                                        )}
                                      </div>
                                      <span className="rating">{val.rating || 5519}</span>
                                    </div>
                                  )
                                } else {
                                  return (
                                    <div className="roster-row vacant" key={key}>
                                      <div className="slot-name">{label}</div>
                                      <div className="player-details">
                                        <span className="lbl-vacant">{isEs ? 'Vacante' : 'Vacant'}</span>
                                        <span className="slot-role">{label}</span>
                                      </div>
                                    </div>
                                  )
                                }
                              })
                            })()}
                          </div>
                        </div>

                        {/* Section: Suplentes */}
                        <div className="roster-section">
                          <h4>{isEs ? 'Suplentes' : 'Substitutes'}</h4>
                          <div className="roster-list-rows">
                            {(() => {
                              const labels = GAME_ROSTER_SLOTS_LABELS[myTeam?.game || 'Mobile Legends']?.suplentes || ['Suplente 1', 'Suplente 2', 'Suplente 3']
                              return labels.map((label, idx) => {
                                const key = `sub-${idx + 1}`
                                const val = rosterSlotsState[key]
                                if (val) {
                                  return (
                                    <div className="roster-row filled" key={key}>
                                      <div className="slot-name">{label}</div>
                                      <div className="player-details">
                                        <span className="nick">{val.nick}</span>
                                        <span className="sync-badge">{isEs ? 'Sincronizado' : 'Synced'}</span>
                                        <span className="game-id">
                                          {hideGameId ? (isEs ? 'ID Oculto' : 'ID Hidden') : val.gameId}
                                          {hideGameId && <span className="gg-id-lock" title={isEs ? "Oculto para externos" : "Hidden for externals"}>{Icon.lock}</span>}
                                        </span>
                                        {!hideEmails && val.email && val.email !== 'n/a' && (
                                          <span className="email-lbl" style={{ color: 'var(--text-dim)', fontSize: '11px', opacity: 0.7 }}>
                                            · {val.email}
                                          </span>
                                        )}
                                        {isLeader && val.cedula && (
                                          <span className="email-lbl" style={{ color: 'var(--text-dim)', fontSize: '11px', opacity: 0.7 }}>
                                            · {isEs ? 'Cedula' : 'ID'}: {val.cedula}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                } else {
                                  return (
                                    <div className="roster-row vacant" key={key}>
                                      <div className="slot-name">{label}</div>
                                      <div className="player-details">
                                        <span className="lbl-vacant">{isEs ? 'Vacante' : 'Vacant'}</span>
                                        <span className="slot-role">{label}</span>
                                      </div>
                                    </div>
                                  )
                                }
                              })
                            })()}
                          </div>
                        </div>

                        {/* Section: Coach */}
                        <div className="roster-section">
                          <h4>Coach / Staff</h4>
                          <div className="roster-list-rows">
                            {rosterSlotsState['coach'] ? (
                              <div className="roster-row filled">
                                <div className="slot-name">Coach</div>
                                <div className="player-details">
                                  <span className="nick">{rosterSlotsState['coach'].nick}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="roster-row vacant">
                                <div className="slot-name">Coach</div>
                                <div className="player-details">
                                  <span className="lbl-vacant">{isEs ? 'Sin coach' : 'No coach'}</span>
                                  <span className="slot-role">Coach</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Section: Transferir liderazgo */}
                        {isLeader && (myTeam?.roster || []).filter(m => (m.id || m._id) && String(m.id || m._id) !== String(currentUserId)).length > 0 && (
                          <div className="roster-section">
                            <h4>{isEs ? 'Transferir liderazgo' : 'Transfer leadership'}</h4>
                            <div className="roster-list-rows">
                              {(myTeam.roster || [])
                                .filter(m => (m.id || m._id) && String(m.id || m._id) !== String(currentUserId))
                                .map(member => (
                                  <div className="roster-row filled" key={member.id || member._id}>
                                    <div className="slot-name">{member.nick}</div>
                                    <div className="player-details">
                                      <span className="nick">{member.role || (isEs ? 'Miembro' : 'Member')}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleTransferLeadership(member)}>
                                      {isEs ? 'Hacer lider' : 'Make leader'}
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Form: Agregar Jugador */}
                        <form onSubmit={handleAddRosterPlayer} className="roster-action-form">
                          <h4>{isEs ? 'Agregar Jugador' : 'Add Player'}</h4>

                          <div className="form-grid">
                            <div className="field">
                              <label>{isEs ? 'Tipo de Slot' : 'Slot Type'}</label>
                              <select
                                value={addSlotType}
                                onChange={e => {
                                  setAddSlotType(e.target.value)
                                  setAddSlotKey('')
                                }}
                              >
                                <option value="Titular">{isEs ? 'Titular' : 'Starter'}</option>
                                <option value="Suplente">{isEs ? 'Suplente' : 'Substitute'}</option>
                                <option value="Coach">Coach</option>
                              </select>
                            </div>

                            <div className="field">
                              <label>Slot</label>
                              <select value={addSlotKey} onChange={e => setAddSlotKey(e.target.value)} required>
                                <option value="">{isEs ? 'Seleccionar slot...' : 'Select slot...'}</option>
                                {(() => {
                                  const titularLabels = GAME_ROSTER_SLOTS_LABELS[myTeam?.game || 'Mobile Legends']?.titulares || []
                                  const subLabels = GAME_ROSTER_SLOTS_LABELS[myTeam?.game || 'Mobile Legends']?.suplentes || []

                                  const options = []
                                  if (addSlotType === 'Titular') {
                                    titularLabels.forEach((label, idx) => {
                                      const key = `titular-${idx + 1}`
                                      const val = rosterSlotsState[key]
                                      const optionLabel = val ? `${val.nick} ✓` : label
                                      options.push(<option key={key} value={key}>{optionLabel}</option>)
                                    })
                                  } else if (addSlotType === 'Suplente') {
                                    subLabels.forEach((label, idx) => {
                                      const key = `sub-${idx + 1}`
                                      const val = rosterSlotsState[key]
                                      const optionLabel = val ? `${val.nick} ✓` : label
                                      options.push(<option key={key} value={key}>{optionLabel}</option>)
                                    })
                                  } else if (addSlotType === 'Coach') {
                                    const val = rosterSlotsState['coach']
                                    const optionLabel = val ? `${val.nick} ✓` : 'Coach'
                                    options.push(<option key="coach" value="coach">{optionLabel}</option>)
                                  }
                                  return options
                                })()}
                              </select>
                            </div>

                            <Input
                              label={isEs ? 'Nickname *' : 'Nickname *'}
                              value={addPlayerNick}
                              onChange={e => setAddPlayerNick(e.target.value)}
                              required
                            />

                            <Input
                              label="Game ID"
                              placeholder="e.g. 2022993710"
                              value={addPlayerGameId}
                              onChange={e => setAddPlayerGameId(e.target.value)}
                            />

                            <Input
                              label={isEs ? 'Región' : 'Region'}
                              value={addPlayerRegion}
                              onChange={e => setAddPlayerRegion(e.target.value)}
                            />

                            <Input
                              label={isEs ? 'Email (opcional)' : 'Email (optional)'}
                              type="email"
                              value={addPlayerEmail}
                              onChange={e => setAddPlayerEmail(e.target.value)}
                            />
                          </div>

                          <Button type="submit" variant="primary">
                            {isEs ? 'Agregar al Roster' : 'Add to Roster'}
                          </Button>
                        </form>
                      </div>
                    )}

                    {/* SOLICITUDES TAB */}
                    {manageTab === 'solicitudes' && (
                      <div className="solicitudes-tab-view">
                        {incomingRequests.length === 0 ? (
                          <p className="empty-text">{isEs ? 'No hay solicitudes de ingreso pendientes.' : 'No pending requests.'}</p>
                        ) : (
                          <div className="requests-list">
                            {incomingRequests.map(req => (
                              <div className="request-card" key={req.id}>
                                <div className="req-meta">
                                  <strong>{req.nick}</strong>
                                  <span>{isEs ? `Rol solicitado: ${req.role}` : `Requested Role: ${req.role}`}</span>
                                  <small>ID: {req.gameId} · {req.region}</small>
                                </div>
                                <div className="req-actions">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      const slotKey = req.role === 'Mid' ? 'titular-3' : 'titular-2'
                                      handleAcceptRequest(req.id, slotKey)
                                    }}
                                  >
                                    {isEs ? 'Aceptar' : 'Accept'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRejectRequest(req.id)}
                                  >
                                    {isEs ? 'Rechazar' : 'Decline'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PAGINA PUBLICA TAB */}
                    {manageTab === 'pagina' && (
                      <div className="ajustes-tab-view">
                        <form className="settings-section team-public-settings" onSubmit={handleSaveTeamPublicProfile}>
                          <div className="team-public-settings__head">
                            <div>
                              <h4>{isEs ? 'Página pública del equipo' : 'Team public page'}</h4>
                              <p>{isEs ? 'Estos datos alimentan la página dedicada del equipo: imagen, biografía, marca, sponsors y personajes.' : 'These fields feed the dedicated team page: image, bio, brand, sponsors and main characters.'}</p>
                            </div>
                            <Button variant="primary" size="sm" type="submit">
                              {isEs ? 'Guardar datos' : 'Save data'}
                            </Button>
                          </div>

                          <div className="team-public-settings__grid">
                            <Input
                              label={isEs ? 'Nombre del equipo' : 'Team name'}
                              value={formName}
                              onChange={e => setFormName(e.target.value)}
                            />
                            <Input
                              label={isEs ? 'Marca / organización' : 'Brand / organization'}
                              placeholder="Glitch Elite, FDV, NPC Latino..."
                              value={formBrand}
                              onChange={e => setFormBrand(e.target.value)}
                            />
                            <Input
                              label={isEs ? 'Correo de contacto' : 'Contact email'}
                              type="email"
                              placeholder="team@glitchgang.gg"
                              value={formContactEmail}
                              onChange={e => setFormContactEmail(e.target.value)}
                            />
                            <Input
                              label={isEs ? 'Banner profesional URL' : 'Professional banner URL'}
                              placeholder="/demos/steliant-esports/ImaHorizontal/Valo.jpg"
                              value={formBanner}
                              onChange={e => setFormBanner(e.target.value)}
                            />
                            <Input
                              label={isEs ? 'Personajes principales' : 'Main characters'}
                              placeholder="Jett, Raze, Killjoy"
                              value={formMainCharacters}
                              onChange={e => setFormMainCharacters(e.target.value)}
                            />
                            <Input
                              label={isEs ? 'Patrocinador rápido' : 'Quick sponsor'}
                              placeholder="NPC Latino"
                              value={formSponsor}
                              onChange={e => setFormSponsor(e.target.value)}
                            />
                          </div>

                          <label className="team-public-settings__field">
                            <span>{isEs ? 'Biografía pública' : 'Public biography'}</span>
                            <textarea
                              rows={4}
                              value={formDescription}
                              onChange={e => setFormDescription(e.target.value)}
                              placeholder={isEs ? 'Historia corta, estilo competitivo, logros y objetivo del equipo...' : 'Short story, competitive style, achievements and team goals...'}
                            />
                          </label>

                          <label className="team-public-settings__field">
                            <span>{isEs ? 'Sponsors avanzados' : 'Advanced sponsors'}</span>
                            <textarea
                              rows={4}
                              value={formSponsors}
                              onChange={e => setFormSponsors(e.target.value)}
                              placeholder={isEs ? 'Uno por línea: Nombre | Nivel | Website | Logo URL' : 'One per line: Name | Tier | Website | Logo URL'}
                            />
                          </label>
                        </form>
                      </div>
                    )}

                    {/* PRIVACIDAD TAB */}
                    {manageTab === 'privacidad' && (
                      <div className="ajustes-tab-view">
                        <div className="settings-section">
                          <h4>{isEs ? 'Privacidad' : 'Privacy'}</h4>

                          <div className="setting-toggle-row">
                            <div className="meta">
                              <strong>{isEs ? 'Ocultar Emails' : 'Hide Emails'}</strong>
                              <span>{isEs ? 'Los emails de los jugadores no se mostrarán en el roster' : 'Player emails will not be shown in the roster'}</span>
                            </div>
                            <label className="gg-switch">
                              <input type="checkbox" checked={hideEmails} onChange={e => handleToggleHideEmails(e.target.checked)} />
                              <span className="slider"></span>
                            </label>
                          </div>

                          <div className="setting-toggle-row">
                            <div className="meta">
                              <strong>{isEs ? 'Ocultar Game ID' : 'Hide Game ID'}</strong>
                              <span>{isEs ? 'Los IDs de juego no serán visibles para externos' : 'Game IDs will not be visible to external users'}</span>
                            </div>
                            <label className="gg-switch">
                              <input type="checkbox" checked={hideGameId} onChange={e => handleToggleHideGameId(e.target.checked)} />
                              <span className="slider"></span>
                            </label>
                          </div>

                          <div className="setting-toggle-row">
                            <div className="meta">
                              <strong>{isEs ? 'Aceptar Solicitudes' : 'Accept Requests'}</strong>
                              <span>{isEs ? 'Permitir que nuevos jugadores soliciten unirse' : 'Allow new players to request to join'}</span>
                            </div>
                            <label className="gg-switch">
                              <input type="checkbox" checked={acceptRequests} onChange={e => handleToggleAcceptRequests(e.target.checked)} />
                              <span className="slider"></span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* INVITACIONES TAB */}
                    {manageTab === 'invitaciones' && (
                      <div className="ajustes-tab-view">
                        <div className="settings-section">
                          <h4>{isEs ? 'Invitación' : 'Invitation'}</h4>
                          <div className="invite-code-display-box">
                            <span className="code-text">{myTeam?.teamInviteCode}</span>
                            <div className="btn-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(myTeam?.teamInviteCode || '')
                                  toast(isEs ? 'Código copiado al portapapeles' : 'Code copied to clipboard')
                                }}
                              >
                                {isEs ? 'Copiar' : 'Copy'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {isLeader && (
                        <div className="settings-section danger-zone-section">
                          <h4>⚠️ ZONA DE PELIGRO</h4>
                          <p>{isEs ? 'Una vez eliminado el equipo, no se podrá recuperar la información ni el récord competitivo.' : 'Once the team is deleted, competitive record and info cannot be recovered.'}</p>
                          <Button variant="primary" className="danger-btn" onClick={handleDeleteTeam}>
                            {isEs ? 'Eliminar Equipo Permanentemente' : 'Permanently Delete Team'}
                          </Button>
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
                {/* VIEW A: TEAMS DIRECTORY & SEARCH VIEW */}
                {!isTeamPanelMode && (
                <motion.div
                  className="gg-teams__directory-container"
                  key="directory-container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Search Bar Input */}
                  <div className="gg-teams__search-filters">
                    <div className="search-input-box">
                      {Icon.search}
                      <input
                        type="text"
                        placeholder={isEs ? 'Buscar por TEAM-ID, nombre, juego, país...' : 'Search by TEAM-ID, name, game, country...'}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Sub-filter Pills Horizontal List */}
                  <div className="gg-teams__sub-filters-list">
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'todos' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('todos')}
                    >
                      <span className="dot dot-green"></span>
                      {isEs ? 'Todos' : 'All'}
                      {getSubFilterCount('todos') > 0 && <span className="count">{getSubFilterCount('todos')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'mis_equipos' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('mis_equipos')}
                    >
                      <span className="dot dot-white"></span>
                      {isEs ? 'Mis Equipos' : 'My Teams'}
                      {myTeam && getSubFilterCount('mis_equipos') > 0 && <span className="count">{getSubFilterCount('mis_equipos')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'nuevos' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('nuevos')}
                    >
                      <span className="dot dot-green"></span>
                      {isEs ? 'Nuevos' : 'New'}
                      {getSubFilterCount('nuevos') > 0 && <span className="count">{getSubFilterCount('nuevos')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'mixto' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('mixto')}
                    >
                      <span className="dot dot-pink"></span>
                      {isEs ? 'Mixto' : 'Mixed'}
                      {getSubFilterCount('mixto') > 0 && <span className="count">{getSubFilterCount('mixto')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'femenino' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('femenino')}
                    >
                      <span className="dot dot-pink"></span>
                      {isEs ? 'Femenino' : 'Female'}
                      {getSubFilterCount('femenino') > 0 && <span className="count">{getSubFilterCount('femenino')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'masculino' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('masculino')}
                    >
                      <span className="dot dot-red"></span>
                      {isEs ? 'Masculino' : 'Male'}
                      {getSubFilterCount('masculino') > 0 && <span className="count">{getSubFilterCount('masculino')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'casual' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('casual')}
                    >
                      <span className="dot dot-green"></span>
                      {isEs ? 'Casual' : 'Casual'}
                      {getSubFilterCount('casual') > 0 && <span className="count">{getSubFilterCount('casual')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'amateur' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('amateur')}
                    >
                      <span className="dot dot-blue"></span>
                      {isEs ? 'Amateur' : 'Amateur'}
                      {getSubFilterCount('amateur') > 0 && <span className="count">{getSubFilterCount('amateur')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'universitario' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('universitario')}
                    >
                      <span className="dot dot-blue"></span>
                      {isEs ? 'Universitario' : 'University'}
                      {getSubFilterCount('universitario') > 0 && <span className="count">{getSubFilterCount('universitario')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'semi-pro' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('semi-pro')}
                    >
                      <span className="dot dot-purple"></span>
                      {isEs ? 'Semi-Pro' : 'Semi-Pro'}
                      {getSubFilterCount('semi-pro') > 0 && <span className="count">{getSubFilterCount('semi-pro')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'pro' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('pro')}
                    >
                      <span className="dot dot-orange"></span>
                      {isEs ? 'Pro' : 'Pro'}
                      {getSubFilterCount('pro') > 0 && <span className="count">{getSubFilterCount('pro')}</span>}
                    </button>
                    <button
                      className={`gg-sub-filter-pill ${selectedSubFilter === 'leyenda' ? 'active' : ''}`}
                      onClick={() => setSelectedSubFilter('leyenda')}
                    >
                      <span className="dot dot-red"></span>
                      {isEs ? 'Leyenda' : 'Legend'}
                      {getSubFilterCount('leyenda') > 0 && <span className="count">{getSubFilterCount('leyenda')}</span>}
                    </button>
                  </div>

                  {/* Cards Directory Grid */}
                  {loadingDirectory && teamsList.length === 0 ? (
                    <div className="gg-directory-empty" style={{ textAlign: 'center', padding: '48px', border: '1px dashed var(--cyber-line)', borderRadius: '12px' }}>
                      <GGLoader label={isEs ? 'Sincronizando equipos' : 'Syncing teams'} size="sm" />
                    </div>
                  ) : filteredTeams.length === 0 ? (
                    selectedSubFilter === 'mis_equipos' && !myTeam ? (
                      // Display "No team yet" helper inside Mis Equipos filter
                      <div className="gg-noteam-container">
                        <span className="gg-noteam-icon">{Icon.shield}</span>
                        <h3>{isEs ? 'No perteneces a ningún equipo' : 'You do not belong to a team'}</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: '8px 0 20px 0' }}>
                          {isEs
                            ? 'Crea tu propio equipo o busca escuadras activas para unirte y competir en la liga.'
                            : 'Create your own team or search active squads to join and compete in the league.'}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                          <Button variant="primary" size="sm" onClick={openCreateTeamWizard}>
                            {isEs ? 'Formar un Equipo' : 'Form a Team'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSubFilter('todos')}>
                            {isEs ? 'Explorar Directorio' : 'Explore Directory'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="gg-directory-empty" style={{ textAlign: 'center', padding: '48px', border: '1px dashed var(--cyber-line)', borderRadius: '12px' }}>
                        <p style={{ color: 'var(--text-dim)' }}>{isEs ? 'No se encontraron equipos con los filtros activos.' : 'No teams found matching current filters.'}</p>
                      </div>
                    )
                  ) : (
                    <div className="gg-teams__grid-directory">
                      {filteredTeams.map((t, index) => (
                        <GGTeamCard
                          key={t.id || t._id}
                          team={adaptTeamForCard(t)}
                          tiers={(Array.isArray(t.tiers) && t.tiers.length ? t.tiers : ['nuevo']).map(mapTeamCardTier)}
                          index={index}
                          onView={() => navigate(`/equipos/${t._id || t.id}`)}
                          onJoin={() => handleRequestTeamJoin(t)}
                          hideJoin={Boolean(myTeam)}
                          joinLabel={isEs ? 'Unirse' : 'Join'}
                          sentLabel={isEs ? 'Solicitud enviada' : 'Request sent'}
                          fullLabel={isEs ? 'Completo' : 'Full'}
                          viewLabel={isEs ? 'Ver equipo' : 'View team'}
                          actions={isMyOwnTeam(t) ? [
                            {
                              key: 'invite',
                              label: isEs ? 'Invitar' : 'Invite',
                              onClick: () => {
                                navigator.clipboard.writeText(t.teamInviteCode || '')
                                toast(isEs ? 'Codigo de invitacion copiado!' : 'Invite code copied!')
                              },
                            },
                            {
                              key: 'view',
                              label: isEs ? 'Ver equipo' : 'View team',
                              onClick: () => navigate(`/equipos/${t._id || t.id}`),
                            },
                            {
                              key: 'manage',
                              label: isMyLeaderTeam(t) ? (isEs ? 'Gestionar' : 'Manage') : (isEs ? 'Mi perfil' : 'My profile'),
                              primary: true,
                              onClick: () => {
                                if (isMyLeaderTeam(t)) {
                                  rememberActiveTeam(t)
                                  navigate('/mi-equipo')
                                } else {
                                  navigate('/jugador/equipos')
                                }
                              },
                            },
                          ] : undefined}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
                )}
              </>
              )}
          </>
          )}

          {/* TAB 2: SCRIMS / VS */}
          {!SCRIMS_ENABLED && tab === 'scrims' && <FindSoonPanel isEs={isEs} kind="scrims" />}
          {SCRIMS_ENABLED && tab === 'scrims' && (
            <motion.div
              className="gg-teams__scrims-directory-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="gg-scrims-hero-panel">
                <div>
                  <span className="gg-scrims-kicker">SCRIMS / VS</span>
                  <h3>{isEs ? 'Centro competitivo de retos' : 'Competitive challenge hub'}</h3>
                  <p>{isEs ? 'Crea varias solicitudes por juego, gestiona estados, comparte retos y confirma salas competitivas cuando ambos equipos aceptan.' : 'Create multiple requests per game, manage states, share challenges and confirm competitive rooms when both teams accept.'}</p>
                </div>
                <Button variant="primary" onClick={() => openScrimFormWithMode('prioridad_vs')}>{isEs ? 'Crear desafio' : 'Create challenge'}</Button>
              </div>

              {activeVsScrim && (() => {
                const homeTeam = myTeam && !isOwnScrim(activeVsScrim)
                  ? myTeam
                  : findScrimOwnerTeam(activeVsScrim)
                const awayName = activeVsScrim.targetTeam && activeVsScrim.targetTeam !== 'Abierto'
                  ? activeVsScrim.targetTeam
                  : (isEs ? 'Rival abierto' : 'Open rival')
                const homeName = safeText(homeTeam?.name || activeVsScrim.team, isEs ? 'Equipo' : 'Team')
                const homeTag = safeText(homeTeam?.tag || activeVsScrim.tag || homeName.slice(0, 3), 'GG').slice(0, 4).toUpperCase()
                const awayTag = safeText(activeVsScrim.targetTag || awayName.slice(0, 3), 'VS').slice(0, 4).toUpperCase()
                const vsAccent = activeVsScrim.color || homeTeam?.color || 'var(--accent)'
                return (
                  <section className="gg-vs-stage" style={{ '--vs-accent': vsAccent }}>
                    <div className="gg-vs-stage__top">
                      <b>{activeVsScrim.status === 'Confirmado' ? (isEs ? 'VS confirmado' : 'Confirmed VS') : (isEs ? 'VS abierto' : 'Open VS')}</b>
                      <span>{activeVsScrim.game} · {activeVsScrim.timeWindow || activeVsScrim.time || (isEs ? 'Hora por confirmar' : 'Time TBD')}</span>
                    </div>
                    <div className="gg-vs-stage__body">
                      <div className="gg-vs-stage__bolt" />
                      <div className="gg-vs-side">
                        <span className="gg-vs-crest">{homeTag}</span>
                        <div>
                          <strong>{homeName}</strong>
                          <small>{activeVsScrim.region || 'Global'} · {activeVsScrim.record || '0-0'}</small>
                        </div>
                      </div>
                      <div className="gg-vs-mid">
                        <b>VS</b>
                        <span>{activeVsScrim.format || 'BO3'}</span>
                        <small>{priorityLabel(activeVsScrim.priorityMode)}</small>
                      </div>
                      <div className="gg-vs-side gg-vs-side--right">
                        <span className="gg-vs-crest">{awayTag}</span>
                        <div>
                          <strong>{awayName}</strong>
                          <small>{activeVsScrim.level || (isEs ? 'Nivel abierto' : 'Open level')}</small>
                        </div>
                      </div>
                    </div>
                    <div className="gg-vs-stage__foot">
                      <span>{activeVsScrim.title}</span>
                      <div>
                        <button type="button" className="gg-hub-btn gg-hub-btn--ghost" onClick={() => setScrimDetail(activeVsScrim)}>{Icon.eye} {isEs ? 'Ver datos' : 'Details'}</button>
                        <button type="button" className="gg-hub-btn gg-hub-btn--ghost" onClick={() => handleShareScrim(activeVsScrim, 'copy')}>{Icon.link || Icon.share} Link</button>
                        <button type="button" className="gg-hub-btn" onClick={() => handleAcceptScrim(activeVsScrim)}>{Icon.check} {isEs ? 'Aceptar VS' : 'Accept VS'}</button>
                      </div>
                    </div>
                  </section>
                )
              })()}

              {/* Scrim main cards */}
              <div className="gg-scrims-cards-grid">
                <div className="gg-scrim-main-card card-desafio" onClick={() => openScrimFormWithMode('prioridad_vs')}>
                  <div className="gg-scrim-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <h3>{isEs ? 'Crear Desafio' : 'Create Challenge'}</h3>
                  <p>{isEs ? 'Reta a un equipo registrado' : 'Challenge a registered team'}</p>
                </div>

                <div className="gg-scrim-main-card card-buscar" onClick={() => openScrimFormWithMode('anytime')}>
                  <div className="gg-scrim-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                  </div>
                  <h3>{isEs ? 'Buscar Scrim' : 'Find Scrim'}</h3>
                  <p>{isEs ? 'Publica o encuentra desafios abiertos' : 'Post or find open challenges'}</p>
                </div>

                <div className="gg-scrim-main-card card-retador" onClick={() => openScrimFormWithMode('weekly_upset')}>
                  <div className="gg-scrim-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19h16" />
                      <path d="M6 17V8l6-4 6 4v9" />
                      <path d="M9 17v-5h6v5" />
                    </svg>
                  </div>
                  <h3>{isEs ? 'Modo retador' : 'Challenger mode'}</h3>
                  <p>{isEs ? 'Reta a un equipo superior con plan retador' : 'Challenge a higher team with challenger plan'}</p>
                </div>
              </div>

              <div className="directory-split-container">
                {/* Left side: list of active challenges */}
                <div className="directory-left-column">
                  <h3>{isEs ? 'Encuentros de Entrenamiento (Scrims)' : 'Training Encounters (Scrims)'}</h3>
                  {filteredScrims.length === 0 ? (
                    <div className="gg-directory-empty">
                      <p>{isEs ? 'No hay solicitudes de scrim activas.' : 'No active scrim requests.'}</p>
                    </div>
                  ) : (
                    <div className="scrims-list-grid">
                      {filteredScrims.map(s => {
                        const ownScrim = isOwnScrim(s)
                        return (
                        <div
                          className="gg-directory-scrim-card"
                          key={s.id}
                          style={{ borderLeftColor: s.color }}
                          role="button"
                          tabIndex={0}
                          onClick={() => setScrimDetail(s)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setScrimDetail(s)
                            }
                          }}
                        >
                          <div className="scrim-card-head">
                            <div>
                              <span className="team-name">{s.team}</span>
                              <span className="game-badge" style={{ backgroundColor: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44` }}>
                                {s.game}
                              </span>
                            </div>
                            <span className="format-badge">{s.format}</span>
                          </div>

                          <div className="scrim-chip-row">
                            <span className="priority-badge">{priorityLabel(s.priorityMode)}</span>
                            <span className="priority-badge muted">{s.level}</span>
                            <span className="priority-badge muted">{s.record || '0-0'} · {s.winRate || 50}% WR</span>
                          </div>

                          <h4 className="scrim-title">"{s.title}"</h4>

                          <div className="scrim-card-actions">
                            {ownScrim && (
                              <button type="button" onClick={(event) => { event.stopPropagation(); handleEditScrim(s) }}>{Icon.edit} {isEs ? 'Editar' : 'Edit'}</button>
                            )}
                            <button type="button" onClick={(event) => { event.stopPropagation(); setScrimShareOpen(prev => prev === s.id ? null : s.id) }}>{Icon.share} {isEs ? 'Compartir' : 'Share'}</button>
                            {ownScrim && (
                              <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); handleDeleteScrim(s) }}>{Icon.trash || Icon.x} {isEs ? 'Eliminar' : 'Delete'}</button>
                            )}
                          </div>

                          {scrimShareOpen === s.id && (
                            <div className="scrim-share-dock" onClick={event => event.stopPropagation()}>
                              <button type="button" onClick={() => handleShareScrim(s, 'details')}>{Icon.eye} {isEs ? 'Ver datos' : 'Details'}</button>
                              <button type="button" onClick={() => handleShareScrim(s, 'native')}>{Icon.share} {isEs ? 'Compartir' : 'Share'}</button>
                              <button type="button" onClick={() => handleShareScrim(s, 'profile')}>{Icon.user} {isEs ? 'Perfil' : 'Profile'}</button>
                              <button type="button" onClick={() => handleShareScrim(s, 'community')}>{Icon.chat} {isEs ? 'Comunidad' : 'Community'}</button>
                              <button type="button" onClick={() => handleShareScrim(s, 'whatsapp')}>{Icon.whatsapp} WhatsApp</button>
                              <button type="button" onClick={() => handleShareScrim(s, 'copy')}>{Icon.link || Icon.share} Link</button>
                            </div>
                          )}

                          <div className="scrim-details-grid">
                            <span><b>{isEs ? 'Roster' : 'Roster'}</b>{s.roster}</span>
                            <span><b>{isEs ? 'Mapa / modo' : 'Map / mode'}</b>{s.mapPool}</span>
                            <span><b>{isEs ? 'Objetivo' : 'Focus'}</b>{s.focus}</span>
                            <span><b>{isEs ? 'Reglas' : 'Rules'}</b>{s.rules}</span>
                          </div>

                          <div className="scrim-card-footer">
                            <div className="meta">
                              <span><b>{isEs ? 'Región:' : 'Region:'}</b> {s.region}</span>
                              <span>•</span>
                              <span><b>{isEs ? 'Hora:' : 'Time:'}</b> {s.timeWindow || s.time}</span>
                              <span><b>{isEs ? 'Sala:' : 'Room:'}</b> {s.roomStatus === 'Creada' ? (isEs ? 'Creada' : 'Created') : (isEs ? 'Al confirmar' : 'On confirm')}</span>
                              <span><b>{isEs ? 'Rival:' : 'Rival:'}</b> {s.targetTeam || 'Abierto'}</span>
                            </div>

                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right side: Scrim Highlights Info */}
                <div className="directory-right-column">
                  <div className="gg-scrims-info-box">
                    <div className="gg-scrims-info-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                      </svg>
                    </div>
                    <strong>{isEs ? 'Matchmaking Directo' : 'Direct Matchmaking'}</strong>
                    <p>{isEs ? 'Elige un equipo rival, define el juego, mapa y reglas. Envía el reto y espera confirmación.' : 'Choose a rival team, define the game, map and rules. Send the challenge and wait for confirmation.'}</p>
                  </div>

                  <div className="gg-scrims-info-box">
                    <div className="gg-scrims-info-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <strong>{isEs ? 'Agenda tu Scrim' : 'Schedule your Scrim'}</strong>
                    <p>{isEs ? 'Programa fecha y hora para tu práctica. Ambos equipos reciben notificación con recordatorio.' : 'Schedule date and time for your practice. Both teams receive a notification reminder.'}</p>
                  </div>

                  <div className="gg-scrims-info-box">
                    <div className="gg-scrims-info-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </div>
                    <strong>{isEs ? 'Historial y Stats' : 'History & Stats'}</strong>
                    <p>{isEs ? 'Registra resultados, lleva un récord de victorias/derrotas y analiza el rendimiento de tu equipo.' : 'Record results, keep a win/loss track record and analyze your team performance.'}</p>
                  </div>

                  <div className="gg-scrims-info-box">
                    <div className="gg-scrims-info-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                        <path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" />
                      </svg>
                    </div>
                    <strong>{isEs ? 'Ranking de Scrims' : 'Scrims Ranking'}</strong>
                    <p>{isEs ? 'Los equipos más activos y con mejor récord aparecerán en el ranking competitivo.' : 'The most active teams with the best winrate record will appear on the competitive ranking.'}</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Scrim Creator Modal Overlay */}
              {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {showScrimForm && (
                  <motion.div
                    className="scrim-form-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowScrimForm(false)}
                  >
                    <motion.div
                      className="scrim-form-modal"
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="modal-head">
                        <h4>{editingScrimId ? (isEs ? 'Editar solicitud de scrim / VS' : 'Edit scrim / VS request') : scrimModeCopy.title}</h4>
                        <button className="close-btn" onClick={() => { setShowScrimForm(false); setEditingScrimId(null); }}>{Icon.x}</button>
                      </div>

                      <form onSubmit={handleCreateScrim} className="scrim-form">
                        <div className="scrim-form-mode-note">
                          <span>{scrimModeCopy.eyebrow}</span>
                          <strong>{scrimModeCopy.title}</strong>
                          <p>{scrimModeCopy.description}</p>
                        </div>

                        <Input
                          label={isEs ? 'Objetivo del reto *' : 'Challenge objective *'}
                          placeholder={scrimModeCopy.titlePlaceholder}
                          value={scrimForm.title}
                          onChange={e => setScrimForm(prev => ({ ...prev, title: e.target.value }))}
                          required
                        />

                        <div className="form-row">
                          <Input
                            label={scrimModeCopy.targetLabel}
                            placeholder={scrimModeCopy.targetPlaceholder}
                            value={scrimForm.targetTeam}
                            onChange={e => setScrimForm(prev => ({ ...prev, targetTeam: e.target.value }))}
                            required={scrimModeCopy.targetRequired}
                          />
                          <div className="scrim-room-note">
                            <strong>{isEs ? 'Sala automática' : 'Automatic room'}</strong>
                            <span>{isEs ? 'Cuando ambos equipos confirmen, se crea la sala del enfrentamiento. No hace falta contacto externo.' : 'When both teams confirm, the match room is created. No external contact is needed.'}</span>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="field">
                            <label>{isEs ? 'Categoría' : 'Category'}</label>
                            <select
                              value={scrimCategory}
                              onChange={e => handleScrimCategoryChange(e.target.value)}
                            >
                              {Object.keys(GAME_CATEGORIES).map(category => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </div>

                          <div className="field">
                            <label>{isEs ? 'Juego' : 'Game'}</label>
                            <select
                              value={scrimForm.game}
                              onChange={e => handleScrimGameChange(e.target.value)}
                            >
                              {scrimGameOptions.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="field">
                            <label>Región</label>
                            <input
                              type="text"
                              value={scrimForm.region}
                              onChange={e => setScrimForm(prev => ({ ...prev, region: e.target.value }))}
                            />
                          </div>

                          <div className="field">
                            <label>Formato</label>
                            <select
                              value={scrimForm.format}
                              onChange={e => setScrimForm(prev => ({ ...prev, format: e.target.value }))}
                            >
                              <option value="BO1">BO1</option>
                              <option value="BO3">BO3</option>
                              <option value="BO5">BO5</option>
                              <option value="FT5">FT5</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="field">
                            <label>{isEs ? 'Hora de Inicio' : 'Start Time'}</label>
                            <input
                              type="text"
                              placeholder="20:00 UTC"
                              value={scrimForm.time}
                              onChange={e => setScrimForm(prev => ({ ...prev, time: e.target.value }))}
                            />
                          </div>

                          <Input
                            label={isEs ? 'Ventana disponible' : 'Available window'}
                            placeholder={isEs ? '20:00 - 23:00 UTC / cualquier hora' : '20:00 - 23:00 UTC / any time'}
                            value={scrimForm.timeWindow}
                            onChange={e => setScrimForm(prev => ({ ...prev, timeWindow: e.target.value }))}
                          />
                        </div>

                        <div className="form-row">
                          <Input
                            label={isEs ? 'Nivel del equipo' : 'Team level'}
                            placeholder={isEs ? 'Diamante, Mitico+, Faceit 8, etc.' : 'Diamond, Mythic+, Faceit 8, etc.'}
                            value={scrimForm.level}
                            onChange={e => setScrimForm(prev => ({ ...prev, level: e.target.value }))}
                          />
                          <Input
                            label={scrimGameMeta.rosterLabel}
                            placeholder={scrimGameMeta.rosterPlaceholder}
                            value={scrimForm.roster}
                            onChange={e => setScrimForm(prev => ({ ...prev, roster: e.target.value }))}
                          />
                        </div>

                        <div className="form-row">
                          <div className="field">
                            <label>{scrimGameMeta.mapLabel}</label>
                            <select
                              value={scrimForm.mapPool}
                              onChange={e => setScrimForm(prev => ({ ...prev, mapPool: e.target.value }))}
                            >
                              {scrimMapOptions.map(map => (
                                <option key={map} value={map}>{map}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-row">
                          <Input
                            label={scrimGameMeta.focusLabel}
                            placeholder={scrimGameMeta.focusPlaceholder}
                            value={scrimForm.focus}
                            onChange={e => setScrimForm(prev => ({ ...prev, focus: e.target.value }))}
                          />
                          <div className="field">
                            <label>{isEs ? 'Reglas / condiciones' : 'Rules / conditions'}</label>
                            <select
                              value={scrimForm.rules}
                              onChange={e => setScrimForm(prev => ({ ...prev, rules: e.target.value }))}
                            >
                              {scrimRulesOptions.map(rule => (
                                <option key={rule} value={rule}>{rule}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="scrim-form-notice-grid">
                          <div className="setting-toggle-row">
                            <div className="meta">
                              <strong>{isEs ? 'Sala para lideres' : 'Leader room'}</strong>
                              <span>{isEs ? 'Al confirmar ambos equipos, se crea una sala privada para que los lideres coordinen el VS.' : 'When both teams confirm, a private room is created for leaders to coordinate the VS.'}</span>
                            </div>
                            <label className="gg-switch">
                              <input
                                type="checkbox"
                                checked={scrimForm.leadersRoomEnabled}
                                onChange={e => setScrimForm(prev => ({ ...prev, leadersRoomEnabled: e.target.checked }))}
                              />
                              <span className="slider"></span>
                            </label>
                          </div>

                          <div className="setting-toggle-row">
                            <div className="meta">
                              <strong>{isEs ? 'Aviso de amonestacion' : 'No-show warning'}</strong>
                              <span>{isEs ? 'Si el VS se acepta y tu equipo no se presenta, el equipo tendra una amonestacion.' : 'If the VS is accepted and your team does not show up, your team receives a warning.'}</span>
                            </div>
                            <label className="gg-switch">
                              <input
                                type="checkbox"
                                checked={scrimForm.noShowWarningActive && !scrimForm.cannotPlayNotice}
                                onChange={e => setScrimForm(prev => ({ ...prev, noShowWarningActive: e.target.checked, cannotPlayNotice: e.target.checked ? false : prev.cannotPlayNotice }))}
                              />
                              <span className="slider"></span>
                            </label>
                          </div>

                          <div className="setting-toggle-row scrim-warning-control">
                            <div className="meta">
                              <strong>{isEs ? 'Mi equipo no puede jugar' : 'My team cannot play'}</strong>
                              <span>{isEs ? 'Marca esto para desactivar el aviso de amonestacion y evitar aceptar/publicar un VS que no podran cumplir.' : 'Mark this to disable the no-show warning and avoid accepting/posting a VS your team cannot play.'}</span>
                            </div>
                            <label className="gg-switch">
                              <input
                                type="checkbox"
                                checked={scrimForm.cannotPlayNotice}
                                onChange={e => setScrimForm(prev => ({ ...prev, cannotPlayNotice: e.target.checked, noShowWarningActive: e.target.checked ? false : prev.noShowWarningActive }))}
                              />
                              <span className="slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="modal-actions">
                          <Button variant="ghost" type="button" onClick={() => setShowScrimForm(false)}>
                            {isEs ? 'Cancelar' : 'Cancel'}
                          </Button>
                          <Button variant="primary" type="submit">
                            {editingScrimId ? (isEs ? 'Guardar cambios' : 'Save changes') : scrimModeCopy.submit}
                          </Button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
              )}

              {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {leaderForwardPrompt && (
                  <motion.div
                    className="scrim-form-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeLeaderForwardPrompt}
                  >
                    <motion.div
                      className="scrim-form-modal scrim-leader-forward"
                      initial={{ scale: 0.96, y: 12 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.96, y: 12 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="scrim-leader-forward__icon">{Icon.share}</div>
                      <span>{isEs ? 'Permiso de capitan' : 'Captain permission'}</span>
                      <h4>{isEs ? 'No eres lider del equipo.' : 'You are not the team leader.'}</h4>
                      <p>
                        {isEs
                          ? 'Deseas enviarle esta solicitud a tu lider para que la revise y la acepte desde el panel del equipo?'
                          : 'Do you want to send this request to your leader so they can review and accept it from the team panel?'}
                      </p>
                      <div className="scrim-leader-forward__preview">
                        <strong>{leaderForwardPrompt.item?.title || (isEs ? 'Solicitud competitiva' : 'Competitive request')}</strong>
                        <small>{leaderForwardPrompt.item?.game || scrimForm.game || 'Scrim'} · {leaderForwardPrompt.action}</small>
                      </div>
                      <div className="modal-actions">
                        <Button variant="primary" type="button" onClick={handleForwardToLeader}>
                          {isEs ? 'Si, enviar al lider' : 'Yes, send to leader'}
                        </Button>
                        <Button variant="ghost" type="button" onClick={closeLeaderForwardPrompt}>
                          {isEs ? 'No' : 'No'}
                        </Button>
                        <Button variant="ghost" type="button" onClick={closeLeaderForwardPrompt}>
                          {isEs ? 'Cancelar' : 'Cancel'}
                        </Button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
              )}
            </motion.div>
          )}

          {/* TAB 3: BUSCAR EQUIPO */}
          {!FIND_TABS_ENABLED && (tab === 'buscar_equipo' || tab === 'buscar_jugadores') && <FindSoonPanel isEs={isEs} kind={tab} />}
          {FIND_TABS_ENABLED && tab === 'buscar_equipo' && (
            <motion.div
              className="gg-teams__players-directory-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="directory-split-container">
                {/* Left side: form & list of LFT players */}
                <div className="directory-left-column">
                  <div className="gg-form-box-premium theme-cyan">
                    <div className="gg-form-box-premium__head">
                      <div className="gg-form-box-premium__icon-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </div>
                      <div className="gg-form-box-premium__title-group">
                        <h3>{isEs ? 'Tu Perfil de Jugador' : 'Your Player Profile'}</h3>
                        <p>{isEs ? 'Completa tu perfil para que los equipos te encuentren más fácil. Los capitanes podrán ver tu información y considerarte para su roster.' : 'Complete your profile so teams can find you easily. Captains can see your info and consider you.'}</p>
                      </div>
                      <button type="button" className="lft-fill-btn" onClick={handleFillLftProfile}>
                        {Icon.sparkles || Icon.plus}
                        {isEs ? 'Rellenar perfil' : 'Fill profile'}
                      </button>
                    </div>

                    <div className="lft-profile-summary">
                      <div className="lft-profile-summary__main">
                        <span className={`lft-profile-summary__status ${myLftCards.length ? 'active' : ''}`}>
                          {myLftCards.length ? `${myLftCards.length} ${isEs ? 'tarjetas activas' : 'active cards'}` : (isEs ? 'Sin publicar' : 'Unpublished')}
                        </span>
                        <strong>{safeText(user?.nick || user?.username || user?.name, 'Jugador LFT')}</strong>
                        <p>{lftGame} · {lftRole} · {lftRank} · {lftRegion}</p>
                      </div>
                      <div className="lft-profile-summary__actions">
                        <button type="button" className="lft-profile-toggle-btn" onClick={resetLftFormForNew}>
                          {isEs ? 'Crear otra tarjeta' : 'Create another card'}
                        </button>
                        <button type="button" className="lft-profile-toggle-btn" onClick={() => setShowLftForm(prev => !prev)}>
                          {showLftForm ? (isEs ? 'Ocultar formulario' : 'Hide form') : (isEs ? 'Abrir formulario' : 'Open form')}
                        </button>
                      </div>
                    </div>

                    {showLftForm && (
                    <form onSubmit={handleSaveLftProfile} className="gg-cyber-form">
                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="3" /><circle cx="7" cy="12" r="2" /><path d="M15 12h2M16 10v4" /></svg>
                          {isEs ? 'Juego principal' : 'Main Game'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={lftGame} onChange={e => setLftGame(e.target.value)}>
                            {ALL_GAMES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                          {isEs ? 'Rol preferido' : 'Preferred Role'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={lftRole} onChange={e => setLftRole(e.target.value)}>
                            {lftRoleOptions.map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          {isEs ? 'Región' : 'Region'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: LAN, LAS, NA...' : 'Ex: LAN, LAS, NA...'} value={lftRegion} onChange={e => setLftRegion(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          {isEs ? 'Disponibilidad' : 'Availability'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: Tardes, Noches, Fines de semana...' : 'Ex: Tardes, Noches, Fines de semana...'} value={lftAvail} onChange={e => setLftAvail(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19h16" /><path d="M7 16V8" /><path d="M12 16V5" /><path d="M17 16v-3" /></svg>
                          {isEs ? 'Rank / nivel actual' : 'Current rank / level'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: Diamante+, Mitico, Faceit 8' : 'Ex: Diamond+, Mythic, Faceit 8'} value={lftRank} onChange={e => setLftRank(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
                          {isEs ? 'Roles secundarios' : 'Secondary roles'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: Flex, IGL, shotcaller' : 'Ex: Flex, IGL, shotcaller'} value={lftSecondaryRoles} onChange={e => setLftSecondaryRoles(e.target.value)} />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-6" /></svg>
                          {isEs ? 'Objetivo competitivo' : 'Competitive goal'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Scrims, liga, torneos, academia...' : 'Scrims, league, tournaments, academy...'} value={lftObjective} onChange={e => setLftObjective(e.target.value)} />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
                          {isEs ? 'Contacto' : 'Contact'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder="@discord, WhatsApp o ID" value={lftContact} onChange={e => setLftContact(e.target.value)} />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /></svg>
                          {isEs ? 'Idioma / comunicación' : 'Language / comms'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Español, inglés, micrófono activo' : 'Spanish, English, active mic'} value={lftLanguage} onChange={e => setLftLanguage(e.target.value)} />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M5 4H3v3a4 4 0 0 0 4 4" /><path d="M19 4h2v3a4 4 0 0 1-4 4" /></svg>
                          {isEs ? 'Experiencia' : 'Experience'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: 6 meses compitiendo, 3 torneos' : 'Ex: 6 months competing, 3 tournaments'} value={lftExperience} onChange={e => setLftExperience(e.target.value)} />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                          {isEs ? 'Fortalezas' : 'Strengths'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Comunicación, macro, aim, VOD review...' : 'Comms, macro, aim, VOD review...'} value={lftStrengths} onChange={e => setLftStrengths(e.target.value)} />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></svg>
                          {isEs ? 'Tipo de equipo buscado' : 'Team type wanted'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={lftTeamType} onChange={e => setLftTeamType(e.target.value)}>
                            <option value="Academia">Academia</option>
                            <option value="Amateur">Amateur</option>
                            <option value="Semi-Pro">Semi-Pro</option>
                            <option value="Profesional">Profesional</option>
                            <option value="Femenino">Femenino</option>
                            <option value="Universitario">Universitario</option>
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <div className="setting-toggle-row">
                          <div className="meta">
                            <strong>{isEs ? 'Visibilidad del perfil' : 'Profile Visibility'}</strong>
                            <span>{isEs ? 'Permite que los reclutadores vean tu perfil' : 'Allow recruiters to view your profile'}</span>
                          </div>
                          <label className="gg-switch">
                            <input type="checkbox" checked={lftVisible} onChange={e => setLftVisible(e.target.checked)} />
                            <span className="slider"></span>
                          </label>
                        </div>
                      </div>

                      <Button type="submit" variant="primary" style={{ gridColumn: 'span 2' }}>
                        {editingLftId ? (isEs ? 'Actualizar tarjeta' : 'Update card') : (isEs ? 'Guardar y publicar tarjeta' : 'Save & publish card')}
                      </Button>
                    </form>
                    )}
                  </div>

                  {/* List of LFT players */}
                  <h3>{isEs ? 'Jugadores Buscando Equipo (LFT)' : 'Players Looking for Team (LFT)'}</h3>
                  {filteredPlayers.length === 0 ? (
                    <div className="gg-directory-empty">
                      <p>{isEs ? 'No se encontraron jugadores.' : 'No players found.'}</p>
                    </div>
                  ) : (
                    <div className="players-list-grid">
                      {filteredPlayers.map(pl => {
                        const ownLft = isOwnLftPlayer(pl)
                        const playerNick = safeText(pl.nick, isEs ? 'Jugador LFT' : 'LFT player')
                        const playerGame = safeText(pl.game, 'Game')
                        const playerRole = safeText(pl.role, 'Flex')
                        const playerRegion = safeText(pl.region, 'Global')
                        const playerRank = safeText(pl.rank, `${safeText(pl.rankPts, '0')} RP`)
                        const playerStatus = safeText(pl.status, 'Disponible / LFT')
                        const playerAvailability = safeText(pl.availability, 'Noches')
                        const playerObjective = safeText(pl.objective, isEs ? 'Scrims y torneo' : 'Scrims and tournaments')
                        const playerSecondaryRoles = safeText(pl.secondaryRoles, 'Flex')
                        const playerContact = safeText(pl.contact, '@player')
                        const playerStyle = safeText(pl.style || pl.strengths, isEs ? 'Jugador disponible para pruebas y scrims.' : 'Player available for tryouts and scrims.')
                        return (
                        <div
                          className={`gg-player-card ${ownLft ? 'is-own' : ''}`}
                          key={pl.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setPlayerDetail(pl)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setPlayerDetail(pl)
                            }
                          }}
                        >
                          <div className="gg-player-card__top">
                            <img src={pl.avatar} alt={playerNick} className="gg-player-card__avatar" />
                            <span className="gg-player-card__status">
                              <span className="gg-player-card__status-dot" />
                              {playerStatus}
                            </span>
                          </div>
                          <h4 className="gg-player-card__nick">{playerNick}</h4>
                          <span className="gg-player-card__game">{playerGame} - {playerRegion}</span>
                          <div className="gg-player-card__tags">
                            <span className="role-tag">{playerRole}</span>
                            <span className="rp-tag">{playerRank}</span>
                            {pl.teamType ? <span className="role-tag muted">{safeText(pl.teamType)}</span> : null}
                          </div>
                          <div className="lft-player-meta-grid">
                            <span><b>{isEs ? 'Disponible' : 'Available'}</b>{playerAvailability}</span>
                            <span><b>{isEs ? 'Busca' : 'Seeking'}</b>{playerObjective}</span>
                            <span><b>{isEs ? 'Secundarios' : 'Secondary'}</b>{playerSecondaryRoles}</span>
                            <span><b>{isEs ? 'Contacto' : 'Contact'}</b>{playerContact}</span>
                          </div>
                          <p className="lft-player-style">{playerStyle}</p>
                          {ownLft && (
                            <div className="lft-card-actions" onClick={event => event.stopPropagation()}>
                              <button type="button" className="gg-player-card__btn" onClick={() => loadLftForm(pl)}>{Icon.edit} {isEs ? 'Editar' : 'Edit'}</button>
                              <button type="button" className="gg-player-card__btn danger" onClick={() => handleDeleteLftProfile(pl.id)}>{Icon.trash || Icon.x} {isEs ? 'Eliminar' : 'Delete'}</button>
                            </div>
                          )}
                          {!ownLft && (
                            <div className="lft-card-actions" onClick={event => event.stopPropagation()}>
                              <button
                                type="button"
                                className="gg-player-card__btn"
                                onClick={() => handleRecruitLftPlayer(pl)}
                              >
                                {Icon.plus} {isEs ? 'Reclutar' : 'Recruit'}
                              </button>
                            </div>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right side: 3 cards showing Visibilidad, Match por Juego, Notificaciones */}
                <div className="directory-right-column">
                  <div className="lft-match-panel">
                    <div className="scrim-intel-head">
                      <span>{isEs ? 'Equipos compatibles' : 'Compatible teams'}</span>
                      <b>{LFT_RECOMMENDED_TEAMS.length}</b>
                    </div>
                    <div className="lft-team-match-list">
                      {LFT_RECOMMENDED_TEAMS.map(team => {
                        const teamName = safeText(team.team, isEs ? 'Equipo compatible' : 'Compatible team')
                        const teamGame = safeText(team.game, 'Game')
                        const teamNeeds = safeText(team.needs, isEs ? 'Rol disponible' : 'Open role')
                        const teamFit = safeText(team.fit, '0%')
                        const teamLevel = safeText(team.level, 'Nivel abierto')
                        const teamSchedule = safeText(team.schedule, 'Horario flexible')
                        return (
                        <article
                          key={team.id}
                          className="lft-team-match"
                          role="button"
                          tabIndex={0}
                          onClick={() => setCompatibleTeamDetail(team)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setCompatibleTeamDetail(team)
                            }
                          }}
                        >
                          <div>
                            <strong>{teamName}</strong>
                            <span>{teamGame} - {teamNeeds}</span>
                          </div>
                          <b>{teamFit}</b>
                          <small>{teamLevel} - {teamSchedule}</small>
                        </article>
                        )
                      })}
                    </div>
                  </div>

                  <div className="team-inbox-panel">
                    <div className="scrim-intel-head">
                      <span>{isEs ? 'Buzon de equipo' : 'Team inbox'}</span>
                      <b>{teamInboxNotifications.length}</b>
                    </div>
                    <div className="team-inbox-list">
                      {teamInboxNotifications.map(note => (
                        <article key={note.id} className={`team-inbox-note type-${note.type}`}>
                          <div>
                            <strong>{safeText(note.title, isEs ? 'Notificacion de equipo' : 'Team notification')}</strong>
                            <p>{safeText(note.body, '')}</p>
                            <small>{safeText(note.status, 'Nuevo')}</small>
                          </div>
                          <div className="team-inbox-actions">
                            <button type="button" onClick={() => updateTeamNotification(note.id, 'Aceptada')}>{Icon.check} {isEs ? 'Aceptar' : 'Accept'}</button>
                            <button type="button" onClick={() => updateTeamNotification(note.id, 'Rechazada')}>{Icon.x} {isEs ? 'Rechazar' : 'Reject'}</button>
                            <button type="button" onClick={() => updateTeamNotification(note.id, 'Invitacion enviada')}>{Icon.plus} {isEs ? 'Invitar' : 'Invite'}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="gg-bottom-info-card">
                    <div className="gg-bottom-info-card__icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></svg>
                    </div>
                    <strong>{isEs ? 'Visibilidad' : 'Visibility'}</strong>
                    <p>{isEs ? 'Tu perfil será visible para todos los capitanes de equipo que buscan nuevos miembros.' : 'Your profile will be visible to all team captains looking for new members.'}</p>
                  </div>

                  <div className="gg-bottom-info-card">
                    <div className="gg-bottom-info-card__icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                    </div>
                    <strong>{isEs ? 'Match por Juego' : 'Match by Game'}</strong>
                    <p>{isEs ? 'Te conectamos con equipos que juegan el mismo juego y buscan tu rol específico.' : 'We connect you with teams playing the same game and seeking your specific role.'}</p>
                  </div>

                  <div className="gg-bottom-info-card">
                    <div className="gg-bottom-info-card__icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    </div>
                    <strong>{isEs ? 'Notificaciones' : 'Notifications'}</strong>
                    <p>{isEs ? 'Recibe alertas cuando un equipo compatible publique una vacante que encaje contigo.' : 'Receive alerts when a compatible team posts a vacancy that fits you.'}</p>
                  </div>

                  <div className="lft-checklist-card">
                    <strong>{isEs ? 'Checklist para ser reclutado' : 'Recruitment checklist'}</strong>
                    <span>{isEs ? 'Rank verificable' : 'Verifiable rank'}</span>
                    <span>{isEs ? 'Horario claro' : 'Clear schedule'}</span>
                    <span>{isEs ? 'Contacto activo' : 'Active contact'}</span>
                    <span>{isEs ? 'Objetivo competitivo definido' : 'Defined competitive goal'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: BUSCAR JUGADORES */}
          {FIND_TABS_ENABLED && tab === 'buscar_jugadores' && (
            <motion.div
              className="gg-teams__players-directory-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="directory-split-container">
                {/* Left side: form & list of vacancies */}
                <div className="directory-left-column">
                  <div className="gg-form-box-premium theme-magenta">
                    <div className="gg-form-box-premium__head">
                      <div className="gg-form-box-premium__icon-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      </div>
                      <div className="gg-form-box-premium__title-group">
                        <h3>{isEs ? 'Publicar Vacante' : 'Post Vacancy'}</h3>
                        <p>{isEs ? 'Publica qué posición necesitas y los jugadores interesados podrán aplicar directamente a tu equipo.' : 'Publish what position you need and interested players can apply directly to your team.'}</p>
                      </div>
                    </div>
                    <div className="vacancy-summary">
                      <div className="vacancy-summary__main">
                        <span className="vacancy-summary__status">{vacanciesList.length} {isEs ? 'vacantes activas' : 'active vacancies'}</span>
                        <strong>{vacGame} · {vacRole} · {vacLevel}</strong>
                        <p>{isEs ? 'Define juego, horario, requisitos y contacto antes de abrir el tryout.' : 'Define game, schedule, requirements and contact before opening tryouts.'}</p>
                      </div>
                      <div className="vacancy-summary__actions">
                        <button type="button" className="vacancy-toggle-btn" onClick={() => setShowVacancyForm(prev => !prev)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={showVacancyForm ? 'M18 6 6 18M6 6l12 12' : 'M12 5v14M5 12h14'} /></svg>
                          {showVacancyForm ? (isEs ? 'Ocultar formulario' : 'Hide form') : (isEs ? 'Crear vacante' : 'Create vacancy')}
                        </button>
                      </div>
                    </div>

                    {showVacancyForm && (
                    <form onSubmit={handlePublishVacancy} className="gg-cyber-form">
                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                          {isEs ? 'Equipo' : 'Team'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select disabled>
                            <option>{myTeam?.name || (isEs ? 'Selecciona tu equipo...' : 'Select your team...')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                          {isEs ? 'Rol que buscas' : 'Role you seek'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: Duelista, Jungla, Support...' : 'Ex: Duelist, Jungle, Support...'} value={vacRole} onChange={e => setVacRole(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" /></svg>
                          {isEs ? 'Juego' : 'Game'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={vacGame} onChange={e => setVacGame(e.target.value)}>
                            {ALL_GAMES.map(game => <option key={game} value={game}>{game}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field span-2">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" /></svg>
                          {isEs ? 'Nivel mínimo' : 'Min Level'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={vacLevel} onChange={e => setVacLevel(e.target.value)}>
                            <option value="Cualquier nivel">{isEs ? 'Cualquier nivel' : 'Any level'}</option>
                            <option value="Amateur">Amateur</option>
                            <option value="Semi-Pro">Semi-Pro</option>
                            <option value="Profesional">{isEs ? 'Profesional' : 'Professional'}</option>
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z" /><circle cx="12" cy="10" r="2" /></svg>
                          {isEs ? 'Region' : 'Region'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder="LAN, Caribe, RD..." value={vacRegion} onChange={e => setVacRegion(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                          {isEs ? 'Horario' : 'Schedule'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Ej: Mar/Jue 20:00' : 'Ex: Tue/Thu 20:00'} value={vacSchedule} onChange={e => setVacSchedule(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" /></svg>
                          {isEs ? 'Urgencia' : 'Urgency'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={vacUrgency} onChange={e => setVacUrgency(e.target.value)}>
                            <option value="Alta">{isEs ? 'Alta' : 'High'}</option>
                            <option value="Media">{isEs ? 'Media' : 'Medium'}</option>
                            <option value="Baja">{isEs ? 'Baja' : 'Low'}</option>
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                          {isEs ? 'Modalidad' : 'Mode'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <select value={vacMode} onChange={e => setVacMode(e.target.value)}>
                            <option value="Tryout">Tryout</option>
                            <option value="Scrim de prueba">{isEs ? 'Scrim de prueba' : 'Trial scrim'}</option>
                            <option value="Roster fijo">{isEs ? 'Roster fijo' : 'Main roster'}</option>
                            <option value="Suplente">{isEs ? 'Suplente' : 'Substitute'}</option>
                            <option value="Academia">{isEs ? 'Academia' : 'Academy'}</option>
                          </select>
                        </div>
                      </div>

                      <div className="gg-cyber-form__field span-2">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                          {isEs ? 'Requisitos clave' : 'Key requirements'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder={isEs ? 'Rank, microfono, experiencia...' : 'Rank, mic, experience...'} value={vacRequirements} onChange={e => setVacRequirements(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field span-2">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 10h8M8 14h6" /></svg>
                          {isEs ? 'Contacto' : 'Contact'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <input type="text" placeholder="@captain / Discord" value={vacContact} onChange={e => setVacContact(e.target.value)} required />
                        </div>
                      </div>

                      <div className="gg-cyber-form__field span-2">
                        <label>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          {isEs ? 'Descripción' : 'Description'}
                        </label>
                        <div className="gg-cyber-form__input-wrap">
                          <textarea rows={3} placeholder={isEs ? 'Describe qué tipo de jugador buscas, horarios, requisitos...' : 'Describe what kind of player you are seeking, schedules, requirements...'} value={vacDesc} onChange={e => setVacDesc(e.target.value)} required />
                        </div>
                      </div>

                      <button type="submit" className="gg-btn-publish-vacancy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 16, height: 16}}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                        {editingVacancyId ? (isEs ? 'Guardar vacante' : 'Save vacancy') : (isEs ? 'Publica una vacante' : 'Publish vacancy')}
                      </button>
                    </form>
                    )}
                  </div>

                  {/* List of vacancies */}
                  <h3>{isEs ? 'Vacantes Publicadas' : 'Published Vacancies'}</h3>
                  {vacanciesList.length === 0 ? (
                    <div className="gg-directory-empty">
                      <p>{isEs ? 'No hay vacantes publicadas.' : 'No vacancies published.'}</p>
                    </div>
                  ) : (
                    <div className="vacancies-list-grid">
                      {vacanciesList.map(v => {
                        const canManageVacancy = isOwnVacancy(v)
                        return (
                        <div className={`vacancy-card-item ${canManageVacancy ? 'is-owned' : 'is-public'}`} key={v.id}>
                          <div className="v-head">
                            <strong>{v.team}</strong>
                            <span className="lvl-badge">{v.status || (isEs ? 'Abierta' : 'Open')}</span>
                          </div>
                          <div className="v-role">{isEs ? `Busca ${v.role}` : `Seeks ${v.role}`}</div>
                          <div className="vacancy-card-tags">
                            <span>{v.game || vacGame}</span>
                            <span>{v.level}</span>
                            <span className={`urgency-${String(v.urgency || 'Media').toLowerCase()}`}>{v.urgency || (isEs ? 'Media' : 'Medium')}</span>
                          </div>
                          <div className="vacancy-card-meta-grid">
                            <span><b>{isEs ? 'Region' : 'Region'}</b>{v.region || 'LAN'}</span>
                            <span><b>{isEs ? 'Horario' : 'Schedule'}</b>{v.schedule || (isEs ? 'Noches' : 'Nights')}</span>
                            <span><b>{isEs ? 'Modalidad' : 'Mode'}</b>{v.mode || 'Tryout'}</span>
                            <span><b>{isEs ? 'Aplicantes' : 'Applicants'}</b>{v.applicants || 0}</span>
                          </div>
                          <p className="v-desc">"{v.desc}"</p>
                          <p className="vacancy-requirements"><b>{isEs ? 'Requisitos:' : 'Requirements:'}</b> {v.requirements || (isEs ? 'Perfil competitivo, disponibilidad y comunicacion activa.' : 'Competitive profile, availability and active comms.')}</p>
                          <small className="vacancy-contact">{isEs ? 'Contacto' : 'Contact'}: {v.contact || '@captain'}</small>
                          <div className="vacancy-card-actions">
                            {canManageVacancy && (
                              <>
                                <button type="button" onClick={() => handleEditVacancy(v)}>{Icon.edit} {isEs ? 'Editar' : 'Edit'}</button>
                                <button type="button" onClick={() => handleToggleVacancyStatus(v)}>{Icon.bell} {v.status === 'Cerrada' ? (isEs ? 'Reabrir' : 'Reopen') : (isEs ? 'Cerrar' : 'Close')}</button>
                              </>
                            )}
                            <button type="button" onClick={() => handleShareVacancy(v)}>{Icon.share} {isEs ? 'Compartir' : 'Share'}</button>
                            {canManageVacancy && (
                              <button type="button" className="danger" onClick={() => handleDeleteVacancy(v.id)}>{Icon.x} {isEs ? 'Eliminar' : 'Delete'}</button>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={v.status === 'Cerrada'}
                            onClick={() => {
                              setVacanciesList(prev => prev.map(item => item.id === v.id ? { ...item, applicants: (item.applicants || 0) + 1 } : item))
                              toast(isEs ? `Aplicacion enviada para ${v.team}` : `Application sent to ${v.team}`)
                            }}
                          >
                            {v.status === 'Cerrada' ? (isEs ? 'Cerrada' : 'Closed') : (isEs ? 'Aplicar' : 'Apply')}
                          </Button>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right side: 3 cards showing Perfiles Verificados, Comunicación Directa, Reputación */}
                <div className="directory-right-column">
                  <div className="vacancy-pipeline-card">
                    <strong>{isEs ? 'Flujo de reclutamiento' : 'Recruitment flow'}</strong>
                    <span>{isEs ? 'Publicar vacante' : 'Publish vacancy'}</span>
                    <span>{isEs ? 'Filtrar aplicantes' : 'Filter applicants'}</span>
                    <span>{isEs ? 'Tryout / scrim de prueba' : 'Tryout / trial scrim'}</span>
                    <span>{isEs ? 'Confirmar roster' : 'Confirm roster'}</span>
                  </div>

                  <div className="gg-bottom-info-card">
                    <div className="gg-bottom-info-card__icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>
                    </div>
                    <strong>{isEs ? 'Perfiles Verificados' : 'Verified Profiles'}</strong>
                    <p>{isEs ? 'Los jugadores que aplican tienen su cuenta verificada y datos de juego confirmados.' : 'Applying players have verified accounts and confirmed game stats.'}</p>
                  </div>

                  <div className="gg-bottom-info-card">
                    <div className="gg-bottom-info-card__icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 10h8M8 14h6" /></svg>
                    </div>
                    <strong>{isEs ? 'Comunicación Directa' : 'Direct Communication'}</strong>
                    <p>{isEs ? 'Revisa aplicaciones, chatea con candidatos y decide quién entra a tu roster.' : 'Review applications, chat with candidates and decide who joins your roster.'}</p>
                  </div>

                  <div className="gg-bottom-info-card">
                    <div className="gg-bottom-info-card__icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    </div>
                    <strong>{isEs ? 'Reputación' : 'Reputation'}</strong>
                    <p>{isEs ? 'Los jugadores acumulan reputación basada en su compromiso y desempeño en equipos anteriores.' : 'Players accumulate reputation based on commitment and past performance.'}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </>
      )}

      {scrimDetail && (
        <div className="gg-data-modal__overlay" onClick={() => setScrimDetail(null)}>
          <motion.div
            className="gg-data-modal gg-data-modal--scrim"
            style={{ '--detail-accent': scrimDetail.color || 'var(--accent)' }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <button className="gg-data-modal__close" onClick={() => setScrimDetail(null)}>{Icon.x}</button>
            <div className="scrim-detail-hero">
              <div className="scrim-detail-hero__top">
                <span className="scrim-detail-pill">{priorityLabel(scrimDetail.priorityMode)}</span>
                <span className="scrim-detail-pill scrim-detail-pill--status">{scrimDetail.status || 'Abierto'}</span>
              </div>

              <div className="scrim-detail-hero__main">
                <span className="scrim-detail-team-mark">{scrimDetail.tag || scrimDetail.team?.slice(0, 3)?.toUpperCase() || 'VS'}</span>
                <div>
                  <h3>{scrimDetail.title || 'Scrim / VS'}</h3>
                  <p>{scrimDetail.team} vs {scrimDetail.targetTeam || 'Abierto'}</p>
                </div>
              </div>

              <div className="scrim-detail-versus">
                <div>
                  <small>Equipo retador</small>
                  <strong>{scrimDetail.team || 'Equipo'}</strong>
                </div>
                <b>VS</b>
                <div>
                  <small>Rival</small>
                  <strong>{scrimDetail.targetTeam || 'Abierto'}</strong>
                </div>
              </div>
            </div>

            <div className="scrim-detail-metrics">
              <span><b>Juego</b>{scrimDetail.game}</span>
              <span><b>Formato</b>{scrimDetail.format}</span>
              <span><b>Region</b>{scrimDetail.region}</span>
              <span><b>Hora</b>{scrimDetail.timeWindow || scrimDetail.time || 'Por confirmar'}</span>
              <span><b>Mapa / modo</b>{scrimDetail.mapPool || 'Por acordar'}</span>
              <span><b>Nivel</b>{scrimDetail.level || 'Sin definir'}</span>
            </div>

            <div className="scrim-detail-sections">
              <section>
                <span>{Icon.users}</span>
                <div>
                  <b>Roster buscado</b>
                  <p>{scrimDetail.roster || 'Roster pendiente'}</p>
                </div>
              </section>
              <section>
                <span>{Icon.target}</span>
                <div>
                  <b>Objetivo</b>
                  <p>{scrimDetail.focus || 'Practica competitiva'}</p>
                </div>
              </section>
              <section>
                <span>{Icon.shield}</span>
                <div>
                  <b>Reglas</b>
                  <p>{scrimDetail.rules || 'Reglas por acordar'}</p>
                </div>
              </section>
              <section>
                <span>{Icon.chat}</span>
                <div>
                  <b>Sala</b>
                  <p>{scrimDetail.room || 'Sala automatica al confirmar ambos equipos'} - {scrimDetail.roomStatus || 'Pendiente'}</p>
                </div>
              </section>
              <section>
                <span>{Icon.lock}</span>
                <div>
                  <b>{isEs ? 'Sala de lideres' : 'Leader room'}</b>
                  <p>{scrimDetail.leadersRoomEnabled === false ? (isEs ? 'Desactivada / coordinacion manual' : 'Disabled / manual coordination') : (scrimDetail.leadersRoom?.status === 'Creada' ? (isEs ? 'Creada para coordinar el VS' : 'Created to coordinate the VS') : (isEs ? 'Se creara al confirmar ambos equipos' : 'Will be created when both teams confirm'))}</p>
                </div>
              </section>
              <section className="scrim-detail-sections__warning">
                <span>{Icon.alert}</span>
                <div>
                  <b>{isEs ? 'Aviso competitivo' : 'Competitive warning'}</b>
                  <p>{scrimDetail.penaltyWarning || (scrimDetail.noShowWarningActive === false ? (isEs ? 'Amonestacion desactivada por disponibilidad.' : 'Warning disabled by availability.') : (isEs ? 'Si aceptan y no se presentan, habra amonestacion.' : 'If accepted and no-show, a warning applies.'))}</p>
                </div>
              </section>
            </div>
            <div className="gg-data-modal__actions scrim-detail-actions">
              <button type="button" onClick={() => handleShareScrim(scrimDetail, 'native')}>{Icon.share} Compartir</button>
              <button type="button" onClick={() => handleShareScrim(scrimDetail, 'whatsapp')}>{Icon.whatsapp} WhatsApp</button>
              <button type="button" onClick={() => handleShareScrim(scrimDetail, 'copy')}>{Icon.link || Icon.share} Copiar link</button>
              <button type="button" onClick={() => handleCannotPlayScrim(scrimDetail)}>{Icon.bell} {isEs ? 'No puedo jugar' : 'Cannot play'}</button>
              <button type="button" className="primary" onClick={() => handleAcceptScrim(scrimDetail)}>{Icon.check} Aceptar / retar</button>
            </div>
          </motion.div>
        </div>
      )}
      {playerDetail && (
        <div className="gg-data-modal__overlay" onClick={() => setPlayerDetail(null)}>
          <motion.div className="gg-data-modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
            <button className="gg-data-modal__close" onClick={() => setPlayerDetail(null)}>{Icon.x}</button>
            <div className="gg-data-modal__head" style={{ '--detail-accent': 'var(--accent)' }}>
              <span className="gg-data-modal__logo">{safeText(playerDetail.nick, 'GG').slice(0, 3).toUpperCase()}</span>
              <div>
                <small>{isOwnLftPlayer(playerDetail) ? (isEs ? 'Tu tarjeta LFT' : 'Your LFT card') : 'LFT'}</small>
                <h3>{safeText(playerDetail.nick, isEs ? 'Jugador LFT' : 'LFT player')}</h3>
                <p>{safeText(playerDetail.game, 'Game')} - {safeText(playerDetail.role, 'Flex')} - {safeText(playerDetail.rank, `${safeText(playerDetail.rankPts, '0')} RP`)}</p>
              </div>
            </div>
            <div className="gg-data-modal__grid">
              <span><b>Juego</b>{safeText(playerDetail.game, 'Game')}</span>
              <span><b>Rol</b>{safeText(playerDetail.role, 'Flex')}</span>
              <span><b>Region</b>{safeText(playerDetail.region, 'Global')}</span>
              <span><b>Disponibilidad</b>{safeText(playerDetail.availability, 'Noches')}</span>
              <span><b>Contacto</b>{safeText(playerDetail.contact, '@player')}</span>
              <span><b>Tipo</b>{safeText(playerDetail.teamType, 'Semi-Pro')}</span>
              <span className="span-2"><b>Objetivo</b>{safeText(playerDetail.objective, 'Scrims y torneos')}</span>
              <span className="span-2"><b>Fortalezas</b>{safeText(playerDetail.strengths || playerDetail.style, 'Perfil competitivo disponible')}</span>
            </div>
            <div className="gg-data-modal__actions">
              {isOwnLftPlayer(playerDetail) ? (
                <>
                  <button type="button" onClick={() => { loadLftForm(playerDetail); setPlayerDetail(null) }}>{Icon.edit} Editar</button>
                  <button type="button" onClick={() => { handleDeleteLftProfile(playerDetail.id); setPlayerDetail(null) }}>{Icon.trash || Icon.x} Eliminar</button>
                </>
              ) : (
                <button type="button" className="primary" onClick={() => { handleRecruitLftPlayer(playerDetail); setPlayerDetail(null) }}>{Icon.plus} Reclutar</button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {compatibleTeamDetail && (
        <div className="gg-data-modal__overlay" onClick={() => setCompatibleTeamDetail(null)}>
          <motion.div className="gg-data-modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
            <button className="gg-data-modal__close" onClick={() => setCompatibleTeamDetail(null)}>{Icon.x}</button>
            <div className="gg-data-modal__head" style={{ '--detail-accent': 'var(--accent)' }}>
              <span className="gg-data-modal__logo">{safeText(compatibleTeamDetail.team, 'TM').slice(0, 3).toUpperCase()}</span>
              <div>
                <small>{isEs ? 'Equipo compatible' : 'Compatible team'} - {safeText(compatibleTeamDetail.fit, '0%')}</small>
                <h3>{safeText(compatibleTeamDetail.team, isEs ? 'Equipo compatible' : 'Compatible team')}</h3>
                <p>{safeText(compatibleTeamDetail.game, 'Game')} - {safeText(compatibleTeamDetail.needs, isEs ? 'Rol disponible' : 'Open role')}</p>
              </div>
            </div>
            <div className="gg-data-modal__grid">
              <span><b>Juego</b>{safeText(compatibleTeamDetail.game, 'Game')}</span>
              <span><b>Busca</b>{safeText(compatibleTeamDetail.needs, isEs ? 'Rol disponible' : 'Open role')}</span>
              <span><b>Fit</b>{safeText(compatibleTeamDetail.fit, '0%')}</span>
              <span><b>Nivel</b>{safeText(compatibleTeamDetail.level, 'Nivel abierto')}</span>
              <span className="span-2"><b>Horario</b>{safeText(compatibleTeamDetail.schedule, 'Horario flexible')}</span>
            </div>
            <div className="gg-data-modal__actions">
              <button type="button" onClick={() => { const teamName = safeText(compatibleTeamDetail.team, 'Equipo'); pushTeamNotification('match', `Solicitud aceptada: ${teamName}`, `Aceptaste revisar ${teamName}.`); setCompatibleTeamDetail(null) }}>{Icon.check} Aceptar</button>
              <button type="button" onClick={() => { const teamName = safeText(compatibleTeamDetail.team, 'Equipo'); pushTeamNotification('match', `Solicitud rechazada: ${teamName}`, `Rechazaste la recomendacion de ${teamName}.`); setCompatibleTeamDetail(null) }}>{Icon.x} Rechazar</button>
              <button type="button" className="primary" onClick={() => { const teamName = safeText(compatibleTeamDetail.team, 'Equipo'); pushTeamNotification('invite', `Invitacion para ${teamName}`, `Enviaste una invitacion a ${teamName}.`); setCompatibleTeamDetail(null) }}>{Icon.plus} Invitar</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Panel de detalle de equipo ─── */}
      {teamDetail && (
        <div className="gg-tdetail__overlay" onClick={() => setTeamDetail(null)}>
          <motion.div
            className="gg-tdetail"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <button className="gg-tdetail__close" onClick={() => setTeamDetail(null)}>{Icon.x}</button>
            <div className="gg-tdetail__head" style={getTeamTierStyles(teamDetail.tiers)}>
              <div className="gg-tdetail__logo">{(teamDetail.name || 'TE').substring(0, 2).toUpperCase()}</div>
              <div className="gg-tdetail__id">
                <h2>{teamDetail.name}</h2>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span className="gg-team-card__id-pill" title="ID público">
                    {isValidPublic(teamDetail.publicCode) ? teamDetail.publicCode : (teamDetail.publicCode || teamPublicCode(teamDetail.region || 'RD', teamDetail.tag || teamDetail.name))}
                  </span>
                  <span className="gg-team-card__id-pill" style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'var(--text-dim)' }} title="ID interno">
                    {isValidInternal(teamDetail.internalCode) ? teamDetail.internalCode : (teamDetail.internalCode || teamInternalCode(teamDetail.region || 'RD', teamDetail.tag || teamDetail.name, teamDetail.createdAt || new Date('2025-05-10')))}
                  </span>
                </div>
                <span>{(teamDetail.game || '').toUpperCase()} · {teamDetail.region || 'Global'} · {(teamDetail.tag || '').toUpperCase()}</span>
              </div>
            </div>

            <p className="gg-tdetail__slogan">"{teamDetail.slogan || (isEs ? '¡Llegaremos alto!' : 'To the top!')}"</p>

            {teamDetail.tiers?.length > 0 && (
              <div className="gg-tdetail__tiers">
                {teamDetail.tiers.map(tk => (
                  <span key={tk} className={`gg-team-card__tier-pill gg-tier-${tk}`}>{configs[tk]?.label || tk}</span>
                ))}
              </div>
            )}

            <div className="gg-tdetail__section">
              <h4>{Icon.users} {isEs ? 'Miembros' : 'Members'} · {getRosterFilledCount(teamDetail)}/{getRosterTotalSlots(teamDetail)}</h4>
              <div className="gg-tdetail__avatars">{renderCardRosterAvatars(teamDetail)}</div>
            </div>

            <div className="gg-tdetail__footer">
              {teamDetail.acceptRequests ? (
                <>
                  <span className="gg-tdetail__recruiting">{isEs ? '🟢 Reclutando jugadores' : '🟢 Recruiting players'}</span>
                  <button
                    className="gg-btn gg-btn--primary"
                    onClick={() => { handleRequestTeamJoin(teamDetail); setTeamDetail(null) }}
                  >
                    {isEs ? 'Postularme' : 'Apply'}
                  </button>
                </>
              ) : (
                <span className="gg-tdetail__closed">{isEs ? '🔒 Este equipo no está reclutando' : '🔒 This team is not recruiting'}</span>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <JoinTeamModal
        open={Boolean(joinTarget)}
        team={joinTarget?.team}
        teamId={joinTarget?.teamId}
        playerBlockedReason={joinTarget?.playerBlockedReason || ''}
        onClose={() => finishJoinRequest(false)}
        onSent={() => finishJoinRequest(true)}
      />
    </div>
  )
}

