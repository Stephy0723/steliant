import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import StaffInvitations from '../../../components/StaffInvitations/StaffInvitations.jsx'
import StaffApply from '../../../components/StaffApply/StaffApply.jsx'
import ProfileCompletionBanner from '../../../components/ProfileCompletionBanner/ProfileCompletionBanner.jsx'
import { api } from '../../../lib/api.js'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { filterStaffTournamentsForPanel } from '../../../lib/staffPanelRoles.js'
import { exportCsv } from '../../../lib/reportKit.js'

function fmtDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function winRate(team) {
  const wins = Number(team?.wins || 0)
  const losses = Number(team?.losses || 0)
  const total = wins + losses
  return total ? `${Math.round((wins / total) * 100)}%` : 'Sin data'
}

export default function AnalystDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = pathname.includes('/equipos') ? 'equipos' : pathname.includes('/torneos') ? 'torneos' : pathname.includes('/reportes') ? 'reportes' : 'resumen'
  const [teams, setTeams] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.allSettled([
      api('/teams/staff/mine?role=analyst'),
      tournamentsApi.staffMine('accepted'),
    ]).then(([teamResult, tournamentResult]) => {
      if (!alive) return
      setTeams(teamResult.status === 'fulfilled' && Array.isArray(teamResult.value?.teams) ? teamResult.value.teams : [])
      setTournaments(tournamentResult.status === 'fulfilled' ? filterStaffTournamentsForPanel(tournamentResult.value?.tournaments, 'analyst') : [])
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const totalPlayers = useMemo(() => teams.reduce((sum, team) => sum + ((team.roster || team.members || []).length), 0), [teams])
  const kpis = [
    { label: 'Equipos analizados', value: loading ? '...' : teams.length, icon: 'team', delta: `${totalPlayers} jugadores` },
    { label: 'Torneos cubiertos', value: loading ? '...' : tournaments.length, icon: 'trophy', delta: tournaments[0] ? fmtDate(tournaments[0].date) : 'sin torneo' },
    { label: 'Reportes pendientes', value: teams.length + tournaments.length ? teams.length + tournaments.length : 0, icon: 'fileText', delta: 'equipo + torneo' },
    { label: 'Modo de trabajo', value: section === 'torneos' ? 'Torneo' : section === 'equipos' ? 'Equipo' : 'Mixto', icon: 'chartBar', delta: 'analisis competitivo' },
  ]

  return (
    <div className="role-dashboard role-dashboard--analyst">
      <StaffInvitations compact />
      <StaffApply platformRole="analyst" compact />
      <ProfileCompletionBanner role="analyst" user={user} />
      <motion.div className="pnl-hero pnl-hero--role-id" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="analyst" profile={user} isOwner />
        <div className="pnl-hero__glow" />
        <div className="pnl-hero__info">
          <div className="pnl-hero__nameline">
            <h1>Analyst Lab de {user?.nick || 'GlitchGang'}</h1>
            <span className="pnl-tag pnl-tag--accent">Analista</span>
          </div>
          <p className="pnl-hero__sub">Analisis para equipos y torneos: rivales, rendimiento, check-in competitivo, tendencias y reportes accionables.</p>
        </div>
        <div className="pnl-hero__cta">
          <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/analista/equipos')}>{Icon.team} Equipos</button>
          <button className="pnl-btn" onClick={() => navigate('/analista/torneos')}>{Icon.trophy} Torneos</button>
        </div>
      </motion.div>

      <motion.div className="pnl-kpis" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {kpis.map(k => (
          <div key={k.label} className="pnl-kpi">
            <div className="pnl-kpi__icon">{Icon[k.icon]}</div>
            <div className="pnl-kpi__value">{k.value}</div>
            <div className="pnl-kpi__label">{k.label}</div>
            <div className="pnl-kpi__delta">{k.delta}</div>
          </div>
        ))}
      </motion.div>

      {section === 'equipos' && <AnalystTeams teams={teams} />}
      {section === 'torneos' && <AnalystTournaments tournaments={tournaments} />}
      {section === 'reportes' && <AnalystReports teams={teams} tournaments={tournaments} />}
      {section === 'resumen' && (
        <div className="pnl-grid pnl-grid--2">
          <AnalystTeams teams={teams} compact />
          <AnalystTournaments tournaments={tournaments} compact />
        </div>
      )}
    </div>
  )
}

const ANALYST_TEAM_FIELDS = [
  { label: 'Equipo', get: t => t.name },
  { label: 'Tag', get: t => t.tag || '-' },
  { label: 'Juego', get: t => t.game || '-' },
  { label: 'Nivel', get: t => t.level || t.category || '-' },
  { label: 'Jugadores', get: t => (t.roster || t.members || []).length },
  { label: 'Victorias', get: t => Number(t.wins || 0) },
  { label: 'Derrotas', get: t => Number(t.losses || 0) },
  { label: 'Win rate', get: t => winRate(t) },
  { label: 'Puntos ranking', get: t => t.rankPts || 0 },
]

const ANALYST_TOURNAMENT_FIELDS = [
  { label: 'Torneo', get: t => t.title },
  { label: 'Juego', get: t => t.game },
  { label: 'Formato', get: t => t.format || t.competition?.system || '-' },
  { label: 'Estado', get: t => t.status },
  { label: 'Fecha', get: t => fmtDate(t.date) },
  { label: 'Equipos', get: t => `${t.currentSlots || t.registrations?.length || 0}/${t.maxSlots || 0}` },
]

function AnalystTeams({ teams, compact = false }) {
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">
        {Icon.team} Analisis de equipos
        {teams.length > 0 && (
          <button
            className="pnl-link pnl-card__action"
            onClick={() => exportCsv(teams, ANALYST_TEAM_FIELDS, `mis-equipos-analista-${new Date().toISOString().slice(0, 10)}.csv`)}
          >
            {Icon.download} Exportar
          </button>
        )}
      </div>
      <div className="role-list">
        {teams.slice(0, compact ? 4 : 12).map(team => (
          <article className="role-list__item" key={team._id || team.id}>
            <div>
              <b>{team.name} <span>[{team.tag || 'TAG'}]</span></b>
              <small>{team.game || 'Juego sin definir'} - {team.level || team.category || 'nivel sin definir'}</small>
            </div>
            <div className="role-list__meta">
              <span>WR {winRate(team)}</span>
              <span>{team.rankPts || 0} pts</span>
            </div>
          </article>
        ))}
        {!teams.length && <p className="pnl-empty-hint">Cuando te asignen como analista de un equipo, veras aqui roster, juego, rendimiento y focos de scouting.</p>}
      </div>
    </motion.div>
  )
}

function AnalystTournaments({ tournaments, compact = false }) {
  const navigate = useNavigate()
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">
        {Icon.trophy} Analisis de torneos
        {tournaments.length > 0 && (
          <button
            className="pnl-link pnl-card__action"
            onClick={() => exportCsv(tournaments, ANALYST_TOURNAMENT_FIELDS, `mis-torneos-analista-${new Date().toISOString().slice(0, 10)}.csv`)}
          >
            {Icon.download} Exportar
          </button>
        )}
      </div>
      <div className="role-list">
        {tournaments.slice(0, compact ? 4 : 12).map(t => (
          <article className="role-list__item" key={t._id || t.publicId}>
            <div>
              <b>{t.title}</b>
              <small>{t.game} - {t.format || t.competition?.system || 'formato sin definir'} - {t.status}</small>
            </div>
            <div className="role-list__meta">
              <span>{fmtDate(t.date)}</span>
              <span>{t.currentSlots || t.registrations?.length || 0}/{t.maxSlots || 0}</span>
              <button className="pnl-link" type="button" onClick={() => navigate(`/organizador/torneo/${t._id || t.publicId}/gestionar`)}>
                {Icon.eye} Ver panel
              </button>
            </div>
          </article>
        ))}
        {!tournaments.length && <p className="pnl-empty-hint">Cuando formes parte del staff de un torneo, veras estructura, equipos inscritos, horarios y lectura competitiva.</p>}
      </div>
    </motion.div>
  )
}

function AnalystReports({ teams, tournaments }) {
  const rows = [
    ['Reporte de rival', teams[0] ? `Preparar scouting de ${teams[0].name}` : 'Pendiente de equipo asignado'],
    ['Reporte de torneo', tournaments[0] ? `Lectura de bracket y favoritos en ${tournaments[0].title}` : 'Pendiente de torneo asignado'],
    ['Datos minimos', 'roster, juego, resultados, mapas/modos, horarios y estado de check-in'],
    ['Salida esperada', 'recomendaciones para coach, staff o transmision'],
  ]
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.fileText} Reportes accionables</div>
      <div className="role-info-grid">
        {rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
      </div>
    </motion.div>
  )
}

