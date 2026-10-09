import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { filterStaffTournamentsForPanel } from '../../../lib/staffPanelRoles.js'
import { exportCsv } from '../../../lib/reportKit.js'
import StaffInvitations from '../../../components/StaffInvitations/StaffInvitations.jsx'
import StaffApply from '../../../components/StaffApply/StaffApply.jsx'
import RoleProfessionalProfile from '../../roles/RoleProfessionalProfile/RoleProfessionalProfile.jsx'

function fmtDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const TIPS = [
  'Completa tu perfil con especialidad, idiomas, disponibilidad y tarifa.',
  'Acepta invitaciones de torneos solo cuando el horario y las reglas te convengan.',
  'Usa arbitraje para disputas, W.O., check-in y reportes de partida.',
]

const MOD_EXPORT_FIELDS = [
  { label: 'Torneo', get: t => t.title },
  { label: 'Juego', get: t => t.game },
  { label: 'Rol asignado', get: t => t.staffRole || 'Staff' },
  { label: 'Fecha', get: t => fmtDate(t.date) },
  { label: 'Estado', get: t => t.status },
  { label: 'Equipos', get: t => `${t.currentSlots || t.registrations?.length || 0}/${t.maxSlots || 0}` },
  { label: 'Check-in', get: t => fmtDate(t.checkinDeadline || t.registrationWindow?.end) },
  { label: 'Reglas', get: t => t.rules || t.rulesDocument ? 'Publicadas' : 'Pendientes' },
]

export default function ModeratorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = pathname.includes('/eventos') ? 'eventos' : pathname.includes('/arbitraje') ? 'arbitraje' : pathname.includes('/produccion') ? 'produccion' : 'resumen'

  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    tournamentsApi.staffMine('accepted')
      .then(data => { if (alive) setTournaments(filterStaffTournamentsForPanel(data?.tournaments, 'moderator')) })
      .catch(() => { if (alive) setTournaments([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const next = tournaments[0]
  const totalTeams = useMemo(() => tournaments.reduce((sum, t) => sum + (Array.isArray(t.registrations) ? t.registrations.length : Number(t.currentSlots || 0)), 0), [tournaments])
  const pendingCheckins = useMemo(() => tournaments.filter(t => t.checkinDeadline || t.registrationWindow?.end).length, [tournaments])
  const kpis = [
    { label: 'Eventos asignados', value: loading ? '...' : tournaments.length, icon: 'trophy', delta: next ? fmtDate(next.date) : 'sin evento' },
    { label: 'Equipos a supervisar', value: loading ? '...' : totalTeams, icon: 'team', delta: 'inscritos visibles' },
    { label: 'Check-ins por vigilar', value: loading ? '...' : pendingCheckins, icon: 'clock', delta: 'con ventana activa' },
    { label: 'Rol operativo', value: next?.staffRole || 'Sin definir', icon: 'shield', delta: 'segun el torneo' },
  ]

  return (
    <div className="role-dashboard role-dashboard--moderator">
      <StaffInvitations compact />
      <StaffApply platformRole="moderator" compact />
      <motion.div className="pnl-hero pnl-hero--role-id" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="moderator" profile={user} isOwner />
        <div className="pnl-hero__glow" />
        <div className="pnl-hero__info">
          <div className="pnl-hero__nameline">
            <h1>Bienvenido, {user?.nick}</h1>
            <span className="pnl-tag pnl-tag--accent">Moderador</span>
          </div>
          <p className="pnl-hero__sub">Gestiona asignaciones de torneo como arbitro, moderador o produccion: equipos, check-in, disputas y estado de cada evento.</p>
        </div>
        <div className="pnl-hero__cta">
          <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/moderador/eventos')}>{Icon.trophy} Ver eventos</button>
          <button className="pnl-btn" onClick={() => navigate('/editar-perfil')}>{Icon.edit} Editar perfil</button>
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

      {section === 'eventos' && <ModeratorEvents tournaments={tournaments} loading={loading} />}
      {section === 'arbitraje' && <ModeratorArbitraje tournaments={tournaments} loading={loading} />}
      {section === 'produccion' && <ModeratorProduction tournaments={tournaments} loading={loading} />}
      {section === 'resumen' && (
        <>
          <div className="pnl-grid pnl-grid--2 pnl-section-gap">
            <ModeratorEvents tournaments={tournaments} loading={loading} compact />
            <ModeratorArbitraje tournaments={tournaments} loading={loading} compact />
          </div>

          <RoleProfessionalProfile role="moderator" embedded />

          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.bolt} Primeros pasos como Moderador</div>
            <ul className="pnl-tips">
              {TIPS.map((tip, i) => (
                <li key={i} className="pnl-tip">
                  <span className="pnl-tip__num">{i + 1}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </div>
  )
}

function ModeratorEvents({ tournaments, loading, compact = false }) {
  const navigate = useNavigate()
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">
        {Icon.trophy} Torneos asignados
        {!loading && tournaments.length > 0 && (
          <button
            className="pnl-link pnl-card__action"
            onClick={() => exportCsv(tournaments, MOD_EXPORT_FIELDS, `mis-torneos-moderador-${new Date().toISOString().slice(0, 10)}.csv`)}
          >
            {Icon.download} Exportar
          </button>
        )}
      </div>
      {loading ? <p className="pnl-empty-hint">Cargando torneos...</p> : tournaments.length ? (
        <div className="role-list">
          {tournaments.slice(0, compact ? 3 : 12).map(t => (
            <article className="role-list__item role-list__item--stack" key={t._id || t.publicId}>
              <div>
                <b>{t.title} <span>{t.staffRole || 'Staff'}</span></b>
                <small>{t.game} - {fmtDate(t.date)} - {t.status}</small>
              </div>
              <div className="role-info-grid role-info-grid--compact">
                <div><span>Equipos</span><b>{t.currentSlots || t.registrations?.length || 0}/{t.maxSlots || 0}</b></div>
                <div><span>Check-in</span><b>{fmtDate(t.checkinDeadline || t.registrationWindow?.end)}</b></div>
                <div><span>Reglas</span><b>{t.rules || t.rulesDocument ? 'Publicadas' : 'Pendientes'}</b></div>
                <div><span>Estado</span><b>{t.status}</b></div>
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
        <p className="pnl-empty-hint">Cuando un organizador te asigne a un torneo como arbitro, moderador o produccion, aparecera aqui con equipos, reglas y check-in.</p>
      )}
    </motion.div>
  )
}

function ModeratorArbitraje({ tournaments, loading, compact = false }) {
  const navigate = useNavigate()
  const list = tournaments.slice(0, compact ? 3 : 12)
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.shield} Arbitraje y disputas</div>
      {loading ? <p className="pnl-empty-hint">Cargando torneos...</p> : list.length ? (
        <div className="role-list">
          {list.map(t => (
            <article className="role-list__item role-list__item--stack" key={t._id || t.publicId}>
              <div>
                <b>{t.title}</b>
                <small>Check-in: {fmtDate(t.checkinDeadline || t.registrationWindow?.end)}</small>
              </div>
              <p className="role-note">{t.rules ? String(t.rules).slice(0, 180) : 'Reglas pendientes: confirma formato, W.O. y tolerancia antes de arbitrar partidas.'}</p>
              <div className="role-actions">
                <button className="pnl-btn" type="button" onClick={() => navigate(`/organizador/torneo/${t._id || t.publicId}/gestionar/checkin`)}>
                  {Icon.check} Check-in
                </button>
                <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => navigate(`/organizador/torneo/${t._id || t.publicId}/gestionar/reportar`)}>
                  {Icon.alert} Reportar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="pnl-empty-hint">Sin torneos asignados todavia para arbitrar.</p>
      )}
    </motion.div>
  )
}

function ModeratorProduction({ tournaments, loading }) {
  const navigate = useNavigate()
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.tv} Produccion</div>
      {loading ? <p className="pnl-empty-hint">Cargando torneos...</p> : tournaments.length ? (
        <div className="role-list">
          {tournaments.slice(0, 12).map(t => (
            <article className="role-list__item role-list__item--stack" key={t._id || t.publicId}>
              <div>
                <b>{t.title}</b>
                <small>{t.streamUrl || 'Canal de stream pendiente'} - idioma {t.streamLang || 'sin definir'}</small>
              </div>
              <div className="role-actions">
                <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => navigate(`/organizador/torneo/${t._id || t.publicId}/gestionar/marca`)}>
                  {Icon.eye} Ver marca / sponsors
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="pnl-empty-hint">Sin torneos asignados todavia para produccion.</p>
      )}
    </motion.div>
  )
}

