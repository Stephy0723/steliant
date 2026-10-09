import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import StaffInvitations from '../../../components/StaffInvitations/StaffInvitations.jsx'
import StaffApply from '../../../components/StaffApply/StaffApply.jsx'
import ProfileCompletionBanner from '../../../components/ProfileCompletionBanner/ProfileCompletionBanner.jsx'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { filterStaffTournamentsForPanel } from '../../../lib/staffPanelRoles.js'
import { exportCsv } from '../../../lib/reportKit.js'

function fmtDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function teamName(registration) {
  const team = registration?.team
  if (!team) return registration?.teamMeta?.name || 'Equipo sin nombre'
  if (typeof team === 'string') return team
  return `${team.name || 'Equipo'}${team.tag ? ` [${team.tag}]` : ''}`
}

export default function CasterDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = pathname.includes('/emisiones') ? 'emisiones' : pathname.includes('/stats') ? 'stats' : pathname.includes('/eventos') ? 'eventos' : 'resumen'
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    tournamentsApi.staffMine('accepted')
      .then(data => {
        if (alive) setTournaments(filterStaffTournamentsForPanel(data?.tournaments, 'caster'))
      })
      .catch(() => {
        if (alive) setTournaments([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const next = tournaments[0]
  const totalTeams = useMemo(() => tournaments.reduce((sum, t) => sum + (Array.isArray(t.registrations) ? t.registrations.length : Number(t.currentSlots || 0)), 0), [tournaments])
  const details = user?.roleProfiles?.caster?.details || {}
  const kpis = [
    { label: 'Eventos asignados', value: loading ? '...' : tournaments.length, icon: 'trophy', delta: next ? fmtDate(next.date) : 'sin evento' },
    { label: 'Equipos a narrar', value: loading ? '...' : totalTeams, icon: 'team', delta: 'inscritos visibles' },
    { label: 'Juego principal', value: details.mainGame || 'Sin definir', icon: 'gamepad', delta: 'perfil caster' },
    { label: 'Tarifa', value: details.rate || 'Sin definir', icon: 'creditCard', delta: 'para organizadores' },
  ]

  return (
    <div className="role-dashboard role-dashboard--caster">
      <StaffInvitations compact />
      <StaffApply platformRole="caster" compact />
      <ProfileCompletionBanner role="caster" user={user} />
      <motion.div className="pnl-hero pnl-hero--role-id" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="caster" profile={user} isOwner />
        <div className="pnl-hero__glow" />
        <div className="pnl-hero__info">
          <div className="pnl-hero__nameline">
            <h1>Caster Studio de {details.casterName || user?.nick || 'GlitchGang'}</h1>
            <span className="pnl-tag pnl-tag--accent">Caster</span>
          </div>
          <p className="pnl-hero__sub">Briefing para transmitir: equipos, staff, reglas, horario, check-in, canal y estado de cada torneo asignado.</p>
        </div>
        <div className="pnl-hero__cta">
          <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/caster/eventos')}>{Icon.trophy} Eventos</button>
          <button className="pnl-btn" onClick={() => navigate('/caster/emisiones')}>{Icon.tv} Emisiones</button>
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

      {section === 'eventos' && <CasterEvents tournaments={tournaments} loading={loading} />}
      {section === 'emisiones' && <CasterBroadcasts tournaments={tournaments} />}
      {section === 'stats' && <CasterStats tournaments={tournaments} />}
      {section === 'resumen' && (
        <div className="pnl-grid pnl-grid--2">
          <CasterEvents tournaments={tournaments} loading={loading} compact />
          <CasterBroadcasts tournaments={tournaments} compact />
        </div>
      )}
    </div>
  )
}

const CASTER_EXPORT_FIELDS = [
  { label: 'Torneo', get: t => t.title },
  { label: 'Juego', get: t => t.game },
  { label: 'Fecha', get: t => fmtDate(t.date) },
  { label: 'Estado', get: t => t.status },
  { label: 'Equipos', get: t => `${t.currentSlots || t.registrations?.length || 0}/${t.maxSlots || 0}` },
  { label: 'Check-in', get: t => fmtDate(t.checkinDeadline || t.registrationWindow?.end) },
  { label: 'Staff', get: t => (t.staffMembers || []).filter(m => m.status !== 'declined').length },
  { label: 'Reglas', get: t => t.rules || t.rulesDocument ? 'Publicadas' : 'Pendientes' },
  { label: 'Canal de stream', get: t => t.streamUrl || 'Sin definir' },
]

function CasterEvents({ tournaments, loading, compact = false }) {
  const navigate = useNavigate()
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">
        {Icon.trophy} Eventos asignados
        {!loading && tournaments.length > 0 && (
          <button
            className="pnl-link pnl-card__action"
            onClick={() => exportCsv(tournaments, CASTER_EXPORT_FIELDS, `mis-eventos-caster-${new Date().toISOString().slice(0, 10)}.csv`)}
          >
            {Icon.download} Exportar
          </button>
        )}
      </div>
      {loading ? <p className="pnl-empty-hint">Cargando eventos...</p> : tournaments.length ? (
        <div className="role-list">
          {tournaments.slice(0, compact ? 3 : 12).map(t => (
            <article className="role-list__item role-list__item--stack" key={t._id || t.publicId}>
              <div>
                <b>{t.title}</b>
                <small>{t.game} - {fmtDate(t.date)} - {t.status}</small>
              </div>
              <div className="role-info-grid role-info-grid--compact">
                <div><span>Equipos</span><b>{t.currentSlots || t.registrations?.length || 0}/{t.maxSlots || 0}</b></div>
                <div><span>Check-in</span><b>{fmtDate(t.checkinDeadline || t.registrationWindow?.end)}</b></div>
                <div><span>Staff</span><b>{(t.staffMembers || []).filter(m => m.status !== 'declined').length || 'Sin staff'}</b></div>
                <div><span>Reglas</span><b>{t.rules || t.rulesDocument ? 'Publicadas' : 'Pendientes'}</b></div>
              </div>
              <div className="role-actions">
                <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => navigate(`/organizador/torneo/${t._id || t.publicId}/gestionar`)}>
                  {Icon.eye} Ver panel del torneo
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="pnl-empty-hint">Cuando te asignen a un torneo como caster, aparecera aqui con horario, reglas, equipos y check-in.</p>
      )}
    </motion.div>
  )
}

function CasterBroadcasts({ tournaments, compact = false }) {
  const list = tournaments.slice(0, compact ? 2 : 8)
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.tv} Briefing de emision</div>
      <div className="role-list">
        {list.map(t => {
          const teams = (t.registrations || []).slice(0, 6).map(teamName)
          return (
            <article className="role-list__item role-list__item--stack" key={t._id || t.publicId}>
              <div>
                <b>{t.title}</b>
                <small>{t.streamUrl || 'Canal de stream pendiente'} - idioma {t.streamLang || 'sin definir'}</small>
              </div>
              <div className="role-chips">
                {(teams.length ? teams : ['Equipos pendientes']).map(name => <span key={name}>{name}</span>)}
              </div>
              <p className="role-note">{t.rules ? String(t.rules).slice(0, 180) : 'Reglas pendientes: el caster debe pedir reglas, formato, mapa/modo y tolerancia de W.O. antes de salir en vivo.'}</p>
            </article>
          )
        })}
        {!list.length && <p className="pnl-empty-hint">Sin emisiones asignadas todavia.</p>}
      </div>
    </motion.div>
  )
}

function CasterStats({ tournaments }) {
  const rows = [
    ['Eventos listos para directo', tournaments.filter(t => t.streamUrl).length],
    ['Eventos sin canal', tournaments.filter(t => !t.streamUrl).length],
    ['Reglas pendientes', tournaments.filter(t => !t.rules && !t.rulesDocument).length],
    ['Check-ins por vigilar', tournaments.filter(t => t.checkinDeadline || t.registrationWindow?.end).length],
  ]
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.chartBar} Estado operativo</div>
      <div className="role-info-grid">
        {rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
      </div>
    </motion.div>
  )
}

