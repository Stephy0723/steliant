import { isBetaHidden } from '../../../config/betaHidden.js'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGTeamCard, { teamTierIds } from '../../../components/GGTeamCard/GGTeamCard.jsx'
import { useLang } from '../../../i18n/LangContext.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { api } from '../../../lib/api.js'
import { PLAYER_KPIS as MOCK_PLAYER_KPIS } from '../../../data/playerStats.js'
import { ACHIEVEMENT_CARDS } from '../../../data/cosmetics.js'
import { GameAccountModal, GameAccountReminder, playsMobileLegends, useMyGameAccount } from '../../../components/GameAccountConnect/GameAccountConnect.jsx'
import { isMobileLegends } from '../../../../../shared/matchStats.mjs'
import './PlayerDashboard.css'

const ACHIEVEMENT_ICON = { gold: 'trophy', silver: 'trophy', bronze: 'trophy', mvp: 'award', goat: 'crown', month: 'crown', clutch: 'target', hawk: 'target' }

const ACTIVE_TEAM_KEY = 'gg-active-team-id'

const TR = {
  es: {
    level: 'Nivel', globalRank: 'Ranking global', regionRank: 'En tu region',
    trophies: 'Trofeos', teams: 'Equipos',
    ratingEvo: 'Evolucion de Rating', activeTeams: 'Mis Equipos Activos',
    allTeams: 'Ver todos los equipos', recent: 'Partidas Recientes',
    fullHistory: 'Ver historial completo', achievements: 'Logros', locked: 'Bloqueado',
    noTeam: 'Sin equipo activo todavia', noRecent: 'Sin partidas registradas todavia',
    tournamentData: 'Datos para torneos', editPlayerData: 'Editar datos de jugador',
    teamSlot: 'Slot en equipo', noSlot: 'Sin slot asignado',
    discord: 'Discord', whatsapp: 'WhatsApp', gameId: 'ID de juego',
    readyTitle: 'Listo para competir',
    attentionTitle: 'Faltan datos para competir',
    readyCopy: 'Tu equipo activo y tus datos principales estan listos para inscripciones, check-in y avisos.',
    attentionCopy: 'Completa lo pendiente para que el lider pueda inscribir el roster sin bloqueos.',
    missingItems: 'pendientes', readyItems: 'listos',
    teamSelector: 'Equipo activo',
    nextAction: 'Siguiente accion',
    quickActions: 'Acciones rapidas',
    manageActiveTeam: 'Gestionar equipo activo',
    editTeamProfile: 'Mi perfil de equipo',
    findTournament: 'Buscar torneo',
    registerResult: 'Ver partidas',
    completeProfile: 'Completar perfil',
    createTeam: 'Crear o unirme a equipo',
    selectedTeam: 'Equipo seleccionado',
    rosterReady: 'Roster listo',
    realData: 'Datos reales',
    fallbackData: 'Sin datos reales todavia',
    status: { ready: 'Listo', missing: 'Pendiente' },
    kpi: { winrate: 'Win rate global', kda: 'KDA promedio', rank: 'Ranking global', rating: 'Rating GG', matches: 'Partidas totales', earn: 'Ganancias' },
    streak: 'Racha actual',
    tournResults: 'Resultados en torneos', tournamentsPlayed: 'torneos', podiums: 'podios',
    noTournaments: 'Sin resultados de torneos todavia',
    activity: 'Actividad reciente', activityMatches: 'partidas en los ultimos 14 dias',
  },
  en: {
    level: 'Level', globalRank: 'Global rank', regionRank: 'In your region',
    trophies: 'Trophies', teams: 'Teams',
    ratingEvo: 'Rating Progression', activeTeams: 'My Active Teams',
    allTeams: 'View all teams', recent: 'Recent Matches',
    fullHistory: 'View full history', achievements: 'Achievements', locked: 'Locked',
    noTeam: 'No active team yet', noRecent: 'No matches recorded yet',
    tournamentData: 'Tournament data', editPlayerData: 'Edit player data',
    teamSlot: 'Team slot', noSlot: 'No assigned slot',
    discord: 'Discord', whatsapp: 'WhatsApp', gameId: 'Game ID',
    readyTitle: 'Ready to compete',
    attentionTitle: 'Missing competition data',
    readyCopy: 'Your active team and main player data are ready for registration, check-in and notices.',
    attentionCopy: 'Complete the pending items so the leader can register the roster without blockers.',
    missingItems: 'pending', readyItems: 'ready',
    teamSelector: 'Active team',
    nextAction: 'Next action',
    quickActions: 'Quick actions',
    manageActiveTeam: 'Manage active team',
    editTeamProfile: 'My team profile',
    findTournament: 'Find tournament',
    registerResult: 'View matches',
    completeProfile: 'Complete profile',
    createTeam: 'Create or join team',
    selectedTeam: 'Selected team',
    rosterReady: 'Roster ready',
    realData: 'Real data',
    fallbackData: 'No real data yet',
    status: { ready: 'Ready', missing: 'Pending' },
    kpi: { winrate: 'Global win rate', kda: 'Avg KDA', rank: 'Global ranking', rating: 'GG Rating', matches: 'Total matches', earn: 'Earnings' },
    streak: 'Current streak',
    tournResults: 'Tournament results', tournamentsPlayed: 'tournaments', podiums: 'podiums',
    noTournaments: 'No tournament results yet',
    activity: 'Recent activity', activityMatches: 'matches in the last 14 days',
  },
}

function teamIdOf(team) {
  return String(team?._id || team?.id || team?.publicCode || team?.tag || '')
}

function rememberActiveTeam(team) {
  const id = teamIdOf(team)
  if (!id) return
  try {
    localStorage.setItem(ACTIVE_TEAM_KEY, id)
  } catch {}
}

function rosterList(team) {
  if (Array.isArray(team?.members)) return team.members
  if (Array.isArray(team?.players)) return team.players
  return []
}

function rosterCount(team) {
  return Number(team?.playerCount || rosterList(team).length || 0)
}

function findRosterSlot(team, user) {
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const identifiers = [
    user?._id,
    user?.id,
    user?.playerCode,
    user?.nick,
    user?.email,
    user?.discord?.id,
    user?.social?.discord,
  ].filter(Boolean).map(value => String(value).toLowerCase())

  for (const [key, slot] of Object.entries(slots)) {
    if (!slot || typeof slot !== 'object') continue
    const values = [
      slot.userId,
      slot.id,
      slot.playerCode,
      slot.nick,
      slot.email,
      slot.discordId,
      slot.discordName,
    ].filter(Boolean).map(value => String(value).toLowerCase())
    if (values.some(value => identifiers.includes(value))) return { key, ...slot }
  }

  return null
}

function isTeamLeader(team, user) {
  const userId = String(user?._id || user?.id || '')
  const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
  return Boolean(userId && leaderId && userId === leaderId)
}

function RatingChart({ data, labels }) {
  const W = 560, H = 180, pad = 28
  const safeData = data?.length ? data : [0, 0]
  const safeLabels = labels?.length === safeData.length ? labels : safeData.map((_, i) => String(i + 1))
  const min = Math.min(...safeData), max = Math.max(...safeData)
  const range = max - min || 1
  const stepX = safeData.length > 1 ? (W - pad * 2) / (safeData.length - 1) : 0
  const points = safeData.map((v, i) => {
    const x = pad + i * stepX
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return [x, y]
  })
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const area = `${line} L${points[points.length - 1][0]},${H - pad} L${points[0][0]},${H - pad} Z`

  return (
    <svg className="pp-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ppFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'rgba(var(--accent-rgb), .35)' }} />
          <stop offset="100%" style={{ stopColor: 'rgba(var(--accent-rgb), 0)' }} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ppFill)" />
      <path d={line} fill="none" stroke="var(--pp-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3.5" fill="var(--pp-color)" />
          <text x={p[0]} y={H - 8} textAnchor="middle" className="pp-chart__lbl">{safeLabels[i]}</text>
        </g>
      ))}
    </svg>
  )
}

function ActivityBars({ data = [] }) {
  const max = Math.max(1, ...data.map(d => Number(d.matches || 0)))
  return (
    <div className="pp-activity">
      {data.map(d => {
        const value = Number(d.matches || 0)
        const day = Number(String(d.date).slice(8, 10))
        return (
          <div key={d.date} className="pp-activity__col" title={`${d.date} - ${value}`}>
            <div className="pp-activity__bar" style={{ height: `${Math.max(6, (value / max) * 100)}%`, opacity: value ? 1 : .3 }} />
            <small>{Number.isNaN(day) ? '' : day}</small>
          </div>
        )
      })}
    </div>
  )
}

function dashboardTeamCard(team, L) {
  // /teams/mine ya trae `roster` con nick y la foto del puesto en el equipo
  // (o la de la cuenta). Antes se leia `members` y solo salian fotos, sin
  // nombres ni logo.
  const roster = (Array.isArray(team?.roster) && team.roster.length ? team.roster : rosterList(team))
    .map((member, index) => ({
      nick: member?.nick || member?.name || member?.user?.nick || `Jugador ${index + 1}`,
      role: member?.role || '',
      avatar: member?.avatar || member?.user?.avatar || '/demos/steliant-esports/avatar-default.svg',
    }))
  const members = roster.slice(0, 5).map(member => member.avatar)
  const total = Number(team?.wins || 0) + Number(team?.losses || 0)
  const winrate = total ? Math.round((Number(team.wins || 0) / total) * 100) : 0

  return {
    name: team?.name || L.noTeam,
    crest: team?.logo || '',
    country: team?.country || '',
    gender: team?.gender || '',
    initials: String(team?.tag || team?.name || 'GG').slice(0, 2).toUpperCase(),
    code: team?.publicCode || team?.tag,
    shortCode: team?.tag,
    game: team?.game || 'GlitchGang',
    region: team?.myRole || team?.role || 'Player',
    bio: total ? `${winrate}% win rate` : L.fallbackData,
    tags: [{ label: L.selectedTeam, on: true }, team?.myRole || team?.role].filter(Boolean),
    members,
    capacity: Math.max(Number(team?.capacity || 5), 5),
    roster,
  }
}

// Acceso a "Buscar equipo": resumen de mis postulaciones y boton para buscar.
function FindTeamCta({ navigate }) {
  const [requests, setRequests] = useState(null)
  useEffect(() => {
    let alive = true
    api('/teams/requests/mine').then(res => { if (alive) setRequests(Array.isArray(res?.requests) ? res.requests : []) }).catch(() => { if (alive) setRequests([]) })
    return () => { alive = false }
  }, [])
  const count = (status) => (requests || []).filter(r => r.status === status).length
  return (
    <motion.div className="pp-findteam" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="pp-findteam__text">
        <b>{Icon.search} Buscando equipo</b>
        <small>
          {requests === null ? 'Cargando tus postulaciones…'
            : requests.length === 0 ? 'Elige qué buscas y postúlate a equipos con tu tarjeta de Jugador Pro.'
              : `${count('pending')} pendiente(s) · ${count('accepted')} aceptada(s) · ${count('rejected')} rechazada(s)`}
        </small>
      </div>
      <div className="pp-findteam__btns">
        <button type="button" className="pp-link-btn" onClick={() => navigate('/jugador/perfil')}>Mi perfil profesional</button>
        <button type="button" className="pp-findteam__go" onClick={() => navigate('/jugador/buscar-equipo')}>Buscar equipo {Icon.chevronRight}</button>
      </div>
    </motion.div>
  )
}

export default function PlayerDashboard() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const { user } = useAuth()
  const { account: mlbbAccount } = useMyGameAccount()
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [ranking, setRanking] = useState(null)
  const [teams, setTeams] = useState([])
  const [activeTeamId, setActiveTeamId] = useState('')
  const [matchRows, setMatchRows] = useState([])
  const [gameStats, setGameStats] = useState([])
  const [apiTournaments, setApiTournaments] = useState([])
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [ratingTimeline, setRatingTimeline] = useState(null)
  const L = TR[lang] || TR.es

  useEffect(() => {
    let alive = true
    api('/rankings/me').then(value => { if (alive) setRanking(value) }).catch(() => { if (alive) setRanking(null) })
    api('/teams/mine')
      .then(res => {
        if (!alive) return
        const list = Array.isArray(res) ? res : Array.isArray(res?.teams) ? res.teams : []
        let stored = ''
        try {
          stored = localStorage.getItem(ACTIVE_TEAM_KEY) || ''
        } catch {}
        const selected = list.find(team => teamIdOf(team) === stored) || list[0] || null
        setTeams(list)
        setActiveTeamId(selected ? teamIdOf(selected) : '')
        if (selected) rememberActiveTeam(selected)
      })
      .catch(() => {
        if (alive) {
          setTeams([])
          setActiveTeamId('')
        }
      })
    api('/players/me/matches?limit=8').then(res => { if (alive) setMatchRows(res.matches || []) }).catch(() => { if (alive) setMatchRows([]) })
    api('/players/me/stats/games').then(res => { if (alive) setGameStats(res.stats || []) }).catch(() => { if (alive) setGameStats([]) })
    api('/players/me/tournaments?limit=50').then(res => { if (alive) setApiTournaments(res.results || []) }).catch(() => { if (alive) setApiTournaments([]) })
    api('/players/me/activity/weekly?days=14').then(res => { if (alive) setWeeklyActivity(res.activity || []) }).catch(() => { if (alive) setWeeklyActivity([]) })
    api('/players/me/rating/timeline?days=90').then(res => { if (alive) setRatingTimeline(Array.isArray(res.timeline) ? res.timeline : []) }).catch(() => { if (alive) setRatingTimeline([]) })
    return () => { alive = false }
  }, [])

  const userGames = user?.games || []
  const mainGame = user?.gamerProfile?.mainGame || userGames[0] || '-'
  const activeTeam = useMemo(
    () => teams.find(team => teamIdOf(team) === activeTeamId) || teams[0] || null,
    [teams, activeTeamId]
  )
  const activeTeamTotal = Number(activeTeam?.wins || 0) + Number(activeTeam?.losses || 0)
  const activeTeamWinrate = activeTeamTotal ? Math.round((Number(activeTeam.wins || 0) / activeTeamTotal) * 100) : null
  const level = Math.max(1, Math.floor(Number(user?.gp || 0) / 1000) + 1)
  const xp = Number(user?.gp || 0) % 1000
  const xpNext = 1000
  const xpPct = Math.min(100, Math.round((xp / xpNext) * 100))
  const myRosterSlot = useMemo(() => findRosterSlot(activeTeam, user), [activeTeam, user])
  // GET /players/me/rating/timeline devuelve un punto POR DIA (90 dias) --
  // demasiado denso para el grafico (RatingChart pone una etiqueta por
  // punto). Se muestra 1 punto por semana (el ultimo dia de cada semana),
  // igual de real, sin inventar nada -- solo se aligera para que se pueda
  // leer. Ver BACKEND-PENDIENTE.md #jugador-rating-timeline.
  const weeklyRatingPoints = useMemo(() => {
    if (!Array.isArray(ratingTimeline) || !ratingTimeline.length) return []
    const weeks = []
    for (let i = 0; i < ratingTimeline.length; i += 7) {
      const chunk = ratingTimeline.slice(i, i + 7)
      weeks.push(chunk[chunk.length - 1])
    }
    return weeks
  }, [ratingTimeline])
  const ratingChartData = weeklyRatingPoints.map(point => point.rating)
  const ratingChartLabels = weeklyRatingPoints.map(point => {
    const d = new Date(`${point.date}T00:00:00`)
    return d.toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short' })
  })
  // Solo el lider/creador del equipo activo va a /mi-equipo -- ser admin del
  // sitio no cuenta aca (para eso esta /admin/equipos).
  const canManageActiveTeam = isTeamLeader(activeTeam, user)

  const tournamentDataRows = [
    {
      key: 'team',
      label: L.teamSelector,
      value: activeTeam?.name || L.noTeam,
      ok: Boolean(activeTeam),
    },
    {
      key: 'slot',
      label: L.teamSlot,
      value: myRosterSlot?.role || myRosterSlot?.key || L.noSlot,
      ok: Boolean(myRosterSlot),
    },
    // Equipo de Mobile Legends: el ID de juego cuenta solo si esta verificado
    // con el codigo del juego (antes mostraba el codigo de GlitchGang).
    isMobileLegends(activeTeam?.game)
      ? {
        key: 'game',
        label: L.gameId,
        value: mlbbAccount ? `${mlbbAccount.roleId} (${mlbbAccount.zoneId})` : (lang === 'es' ? 'Sin verificar' : 'Not verified'),
        ok: Boolean(mlbbAccount),
      }
      : {
        key: 'game',
        label: L.gameId,
        value: myRosterSlot?.gameId || user?.gamerProfile?.gameId || user?.playerCode || '-',
        ok: Boolean(myRosterSlot?.gameId || user?.gamerProfile?.gameId || user?.playerCode),
      },
    {
      key: 'discord',
      label: L.discord,
      value: user?.discord?.username || user?.social?.discord || myRosterSlot?.discordName || '-',
      ok: Boolean(user?.discord?.id || user?.social?.discord || myRosterSlot?.discordName),
    },
  ]
  const missingRows = tournamentDataRows.filter(row => !row.ok)
  const readyCount = tournamentDataRows.length - missingRows.length
  const tournamentDataReady = missingRows.length === 0
  const nextAction = !activeTeam
    ? { label: L.createTeam, icon: Icon.team, path: '/jugador/equipos' }
    : !myRosterSlot
      ? { label: canManageActiveTeam ? L.manageActiveTeam : L.editTeamProfile, icon: Icon.team, path: canManageActiveTeam ? '/mi-equipo' : '/jugador/equipos' }
      : isMobileLegends(activeTeam?.game) && !mlbbAccount
        ? { label: lang === 'es' ? 'Verificar ID de juego' : 'Verify game ID', icon: Icon.check, onClick: () => setVerifyOpen(true) }
      : !tournamentDataReady
        ? { label: L.completeProfile, icon: Icon.edit, path: '/jugador/equipos' }
        : { label: L.findTournament, icon: Icon.trophy, path: '/torneos' }
  const quickActions = [
    { label: canManageActiveTeam ? L.manageActiveTeam : L.editTeamProfile, icon: Icon.team, path: canManageActiveTeam ? '/mi-equipo' : '/jugador/equipos', disabled: !activeTeam },
    { label: L.findTournament, icon: Icon.trophy, path: '/torneos' },
    { label: L.registerResult, icon: Icon.target, path: '/jugador/partidas' },
    { label: L.completeProfile, icon: Icon.edit, path: '/editar-perfil' },
  ]

  // Solo datos reales: sin partidas/torneos se muestra el estado vacío,
  // nunca los ejemplos de data/playerStats.js.
  const recentAll = matchRows
  const recent = recentAll.slice(0, 5)
  const streak = useMemo(() => {
    if (!recentAll.length) return { count: 0, type: null }
    const type = recentAll[0].result
    let count = 0
    for (const m of recentAll) {
      if (m.result !== type) break
      count += 1
    }
    return { count, type }
  }, [recentAll])
  const userTournaments = apiTournaments
  const careerTournaments = userTournaments.slice(0, 5)
  const careerEarnings = userTournaments.reduce((sum, t) => sum + Number(t.prize || 0), 0)
  const podiums = userTournaments.filter(t => Number(t.placement) <= 3).length
  const activityTotal = weeklyActivity.reduce((sum, d) => sum + Number(d.matches || 0), 0)
  const totalMatches = gameStats.reduce((sum, item) => sum + Number(item.matches || 0), 0)
  const avgWinrate = gameStats.length
    ? Math.round(gameStats.reduce((sum, item) => sum + Number(item.winrate || 0), 0) / gameStats.length)
    : null
  const knownKda = gameStats.filter(item => item.kda != null)
  const avgKda = knownKda.length
    ? (knownKda.reduce((sum, item) => sum + Number(item.kda), 0) / knownKda.length).toFixed(2)
    : null
  const kpis = MOCK_PLAYER_KPIS.map(item => {
    if (item.key === 'rank') return { ...item, value: ranking?.globalRank ? `#${ranking.globalRank.toLocaleString()}` : '-', delta: ranking?.regionalRank ? `#${ranking.regionalRank} ${L.regionRank.toLowerCase()}` : '-' }
    if (item.key === 'rating') return { ...item, value: Number(user?.gp || 0).toLocaleString(), delta: user?.plan || 'Free' }
    if (item.key === 'winrate') return { ...item, value: avgWinrate == null ? (activeTeamWinrate == null ? '-' : `${activeTeamWinrate}%`) : `${avgWinrate}%`, delta: totalMatches ? `${totalMatches} ${L.kpi.matches.toLowerCase()}` : '-' }
    if (item.key === 'kda') return { ...item, value: avgKda || '-', delta: gameStats.length ? `${gameStats.length} games` : '-' }
    if (item.key === 'matches') return { ...item, value: totalMatches || activeTeamTotal || recent.length, delta: activeTeam?.name || '-' }
    if (item.key === 'earn') return { ...item, value: careerEarnings ? `$${careerEarnings.toLocaleString()}` : '-', delta: userTournaments.length ? `${userTournaments.length} ${L.tournamentsPlayed}` : '-', down: false }
    return item
  })
  // Logros = cartas de logro de la Vitrina (data/cosmetics.js). Desbloqueadas
  // segun user.cosmeticUnlocks, que calcula el servidor (titulos oficiales,
  // etc.). Antes era un array fijo, igual para cualquier jugador.
  const cardGrants = new Map((Array.isArray(user?.cosmeticUnlocks) ? user.cosmeticUnlocks : [])
    .filter(grant => grant.kind === 'card')
    .map(grant => [String(grant.item), grant]))
  const achievements = ACHIEVEMENT_CARDS.map(card => {
    const grant = cardGrants.get(card.id)
    return {
      id: card.id,
      icon: ACHIEVEMENT_ICON[card.id] || 'star',
      name: card.name,
      desc: card.goal,
      unlocked: Boolean(grant),
      date: grant?.grantedAt ? new Date(grant.grantedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-DO', { month: 'short', year: 'numeric' }) : '',
    }
  })
  const unlocked = achievements.filter(a => a.unlocked).length
  const p = {
    nick: user?.nick || '-',
    avatar: user?.avatar || '/demos/steliant-esports/avatar-default.svg',
    realName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '-',
    role: user?.role || 'Jugador',
    globalRank: ranking?.globalRank || 0,
    regionRank: ranking?.regionalRank || 0,
  }

  const handleActiveTeamChange = (event) => {
    const next = teams.find(team => teamIdOf(team) === event.target.value)
    setActiveTeamId(event.target.value)
    if (next) rememberActiveTeam(next)
  }

  return (
    <div className="pp-page">
      <GameAccountReminder show={playsMobileLegends(user, isMobileLegends, teams.map(t => t?.game))} />
      <FindTeamCta navigate={navigate} />
      <motion.div className="pp-hero" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="pp-hero__glow" />
        <img className="pp-hero__avatar" src={p.avatar} alt={p.nick} />
        <div className="pp-hero__main">
          <div className="pp-hero__nameline">
            <h1>{p.nick}</h1>
            {user?.emailVerified && <span className="pp-hero__verified" title="Verified">{Icon.check}</span>}
            <span className="pp-hero__lvl">{L.level.toUpperCase()} {level}</span>
          </div>
          <p className="pp-hero__sub">{p.realName} - {p.role} - {mainGame}</p>
          <div className="pp-hero__xp">
            <div className="pp-bar"><div className="pp-bar__fill" style={{ width: `${xpPct}%` }} /></div>
            <span>{xp.toLocaleString()} / {xpNext.toLocaleString()} XP</span>
          </div>
        </div>
        <div className="pp-hero__badges">
          <div className="pp-hero__badge"><b>{p.globalRank ? `#${p.globalRank.toLocaleString()}` : '-'}</b><span>{L.globalRank}</span></div>
          <div className="pp-hero__badge"><b>{p.regionRank ? `#${p.regionRank}` : '-'}</b><span>{L.regionRank}</span></div>
          <div className="pp-hero__badge"><b>{teams.length}</b><span>{L.teams}</span></div>
          <div className="pp-hero__badge"><b>{podiums}</b><span>{L.trophies}</span></div>
          <div className="pp-hero__badge"><b>{streak.count ? `${streak.count}${streak.type === 'win' ? 'V' : 'D'}` : '-'}</b><span>{L.streak}</span></div>
        </div>
      </motion.div>

      <motion.section className={`pp-ops ${tournamentDataReady ? 'is-ready' : 'is-missing'}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .03 }}>
        <div className="pp-ops__status">
          <span>{tournamentDataReady ? Icon.check : Icon.alert}</span>
          <div>
            <p>{tournamentDataReady ? L.readyTitle : L.attentionTitle}</p>
            <h2>{readyCount}/{tournamentDataRows.length} {tournamentDataReady ? L.readyItems : L.missingItems}</h2>
            <small>{tournamentDataReady ? L.readyCopy : L.attentionCopy}</small>
          </div>
        </div>

        <div className="pp-ops__checks">
          {tournamentDataRows.map(row => (
            <div key={row.key} className={row.ok ? 'is-ready' : 'is-missing'}>
              <span>{row.label}</span>
              <b>{row.value}</b>
              <em>{row.ok ? L.status.ready : L.status.missing}</em>
            </div>
          ))}
        </div>

        <div className="pp-ops__next">
          <span>{L.nextAction}</span>
          <button type="button" onClick={() => (nextAction.onClick ? nextAction.onClick() : navigate(nextAction.path))}>
            {nextAction.icon}
            <b>{nextAction.label}</b>
          </button>
        </div>
        {verifyOpen && <GameAccountModal onClose={() => setVerifyOpen(false)} />}
      </motion.section>

      <motion.div className="pp-kpis" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }}>
        {kpis.map(k => (
          <div key={k.key} className="pp-kpi">
            <div className="pp-kpi__icon">{Icon[k.icon] || Icon.bolt}</div>
            <div className="pp-kpi__value">{k.value}</div>
            <div className="pp-kpi__label">{L.kpi[k.key] || k.label}</div>
            <div className={`pp-kpi__delta ${k.down ? 'down' : ''}`}>{k.down ? 'v' : '^'} {k.delta}</div>
          </div>
        ))}
      </motion.div>

      <div className="pp-dash-grid">
        <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
          <div className="pp-card__title">{Icon.team} {L.activeTeams}</div>
          {teams.length > 1 && (
            <label className="pp-team-select">
              <span>{L.teamSelector}</span>
              <select value={activeTeamId} onChange={handleActiveTeamChange}>
                {teams.map(team => (
                  <option key={teamIdOf(team)} value={teamIdOf(team)}>{team.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="pp-team-panel">
            {!activeTeam ? (
              <div className="pp-hist-empty">{Icon.team} {L.noTeam}</div>
            ) : (
              <GGTeamCard
                team={dashboardTeamCard(activeTeam, L)}
                tiers={teamTierIds(activeTeam)}
                index={0}
                layout="row"
                defaultOpen
                hideJoin
                viewLabel={L.allTeams}
                onView={() => navigate('/jugador/equipos')}
                actions={[
                  {
                    key: canManageActiveTeam ? 'manage' : 'profile',
                    label: canManageActiveTeam ? L.manageActiveTeam : L.editTeamProfile,
                    icon: Icon.team,
                    primary: true,
                    onClick: () => navigate(canManageActiveTeam ? '/mi-equipo' : '/jugador/equipos'),
                  },
                  {
                    key: 'teams',
                    label: L.allTeams,
                    icon: Icon.chevronRight,
                    onClick: () => navigate('/jugador/equipos'),
                  },
                ]}
              />
            )}
          </div>
        </motion.div>

        <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .12 }}>
          <div className="pp-card__title">{Icon.bolt} {L.quickActions}</div>
          <div className="pp-actions-grid">
            {quickActions.map(action => (
              <button key={action.label} type="button" disabled={action.disabled} onClick={() => navigate(action.path)}>
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div className="pp-card pp-tournament-data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .13 }}>
        <div className="pp-tournament-data__head">
          <div>
            <span className="pp-eyebrow">Roster</span>
            <h2>{L.tournamentData}</h2>
            <p>{tournamentDataReady ? L.readyCopy : L.attentionCopy}</p>
          </div>
          <button className="pp-edit-data-btn" onClick={() => navigate('/editar-perfil')}>
            {Icon.edit} <span>{L.editPlayerData}</span>
          </button>
        </div>
        <div className="pp-tournament-data__grid">
          {tournamentDataRows.map(row => (
            <div key={row.key} className={`pp-data-item ${row.ok ? 'is-ready' : 'is-missing'}`}>
              <span>{row.label}</span>
              <b>{row.value}</b>
              <em>{row.ok ? L.status.ready : L.status.missing}</em>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="pp-dash-grid">
        <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .14 }}>
          <div className="pp-card__title">{Icon.clock} {L.recent}</div>
          <div className="pp-recent">
            {recent.length === 0 ? (
              <div className="pp-hist-empty">{Icon.search} {L.noRecent}</div>
            ) : recent.map(m => (
              <div key={m.id} className="pp-recent__row">
                <span className={`pp-result pp-result--${m.result}`}>{m.result === 'win' ? 'V' : 'D'}</span>
                <div className="pp-recent__info">
                  <b>vs {m.vs}</b>
                  <small>{m.game} - {m.mode} - {m.map}</small>
                </div>
                <span className="pp-recent__kda">{m.kda}</span>
                <span className={`pp-recent__rp ${m.rp >= 0 ? 'up' : 'down'}`}>{m.rp >= 0 ? '+' : ''}{m.rp}</span>
              </div>
            ))}
          </div>
{!isBetaHidden('/jugador/historial') && (
          <button className="pp-link-btn" onClick={() => navigate('/jugador/historial')}>
            {L.fullHistory} {Icon.chevronRight}
          </button>
)}
        </motion.div>

        <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .16 }}>
          <div className="pp-card__title">{Icon.trend} {L.ratingEvo}</div>
          <RatingChart data={ratingChartData} labels={ratingChartLabels} />
        </motion.div>
      </div>

      <div className="pp-dash-grid">
        <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .18 }}>
          <div className="pp-card__title">{Icon.trophy} {L.tournResults}</div>
          <p className="pp-card__sub">{userTournaments.length} {L.tournamentsPlayed} · {podiums} {L.podiums} · {careerEarnings ? `$${careerEarnings.toLocaleString()}` : '-'}</p>
          <div className="pp-recent">
            {careerTournaments.length === 0 ? (
              <div className="pp-hist-empty">{Icon.trophy} {L.noTournaments}</div>
            ) : careerTournaments.map(t => (
              <div key={t.id} className="pp-recent__row">
                <span className={`pp-result ${Number(t.placement) <= 3 ? 'pp-result--win' : 'pp-result--loss'}`}>#{t.placement}</span>
                <div className="pp-recent__info">
                  <b>{t.name}</b>
                  <small>{t.game} - {t.team} - {String(t.date || '').slice(0, 10)}</small>
                </div>
                <span className={`pp-recent__rp ${Number(t.prize) > 0 ? 'up' : 'down'}`}>{Number(t.prize) > 0 ? `$${Number(t.prize).toLocaleString()}` : '-'}</span>
              </div>
            ))}
          </div>
{!isBetaHidden('/jugador/historial') && (
          <button className="pp-link-btn" onClick={() => navigate('/jugador/historial')}>
            {L.fullHistory} {Icon.chevronRight}
          </button>
)}
        </motion.div>

        <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}>
          <div className="pp-card__title">{Icon.chartBar} {L.activity}</div>
          <p className="pp-card__sub">{activityTotal} {L.activityMatches}</p>
          <ActivityBars data={weeklyActivity} />
        </motion.div>
      </div>

{!isBetaHidden('section:player-achievements') && (
      <motion.div className="pp-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .22 }}>
        <div className="pp-card__title">{Icon.award} {L.achievements} - {unlocked}/{achievements.length}</div>
        <div className="pp-ach-grid">
          {achievements.map(a => (
            <div key={a.id} className={`pp-ach ${a.unlocked ? '' : 'locked'}`} title={a.desc}>
              <span className="pp-ach__icon">{Icon[a.icon] || Icon.star}</span>
              <b>{a.name}</b>
              <small>{a.unlocked ? a.date : L.locked}</small>
            </div>
          ))}
        </div>
      </motion.div>
)}
    </div>
  )
}

