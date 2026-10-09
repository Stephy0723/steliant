import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import './CreatorDashboard.css'
import StaffInvitations from '../../../components/StaffInvitations/StaffInvitations.jsx'
import StaffApply from '../../../components/StaffApply/StaffApply.jsx'

const EMPTY_KPIS = [
  { key: 'followers', icon: 'users',  label: 'Seguidores totales',  value: '—' },
  { key: 'views',     icon: 'eye',    label: 'Vistas este mes',     value: '—' },
  { key: 'revenue',   icon: 'gem',    label: 'Ingresos del mes',    value: '—' },
  { key: 'deals',     icon: 'star',   label: 'Deals activos',       value: '—' },
]

export default function CreatorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div>
      <StaffInvitations compact />
      <StaffApply platformRole="creator" compact />
      {/* Hero */}
      <motion.div className="cc-hero cc-hero--role-id" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="creator" profile={user} isOwner />
        <div className="cc-hero__glow" />
        <img className="cc-hero__avatar" src={user?.avatar || '/demos/steliant-esports/avatar-default.svg'} alt={user?.nick} />
        <div className="cc-hero__main">
          <div className="cc-hero__nameline">
            <h1>{user?.nick || '—'}</h1>
            <span className="cc-hero__tier">Creador</span>
          </div>
          <p className="cc-hero__sub">{user?.bio || 'Completa tu perfil para mostrar tu bio.'}</p>
        </div>
        <div className="cc-hero__cta">
          <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/creador/contenido')}>
            {Icon.plus} Subir contenido
          </button>
          <button className="pnl-btn" onClick={() => navigate('/creador/monetizacion')}>
            {Icon.creditCard} Ver ingresos
          </button>
        </div>
      </motion.div>

      {/* KPIs - vacíos hasta que haya datos reales */}
      <motion.div className="pnl-kpis pnl-section-gap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }}>
        {EMPTY_KPIS.map(k => (
          <div key={k.key} className="pnl-kpi">
            <div className="pnl-kpi__icon">{Icon[k.icon]}</div>
            <div className="pnl-kpi__value">{k.value}</div>
            <div className="pnl-kpi__label">{k.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Plataformas + Próximos streams */}
      <div className="pnl-grid pnl-grid--2">
        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
          <div className="pnl-card__title">{Icon.globe} Plataformas conectadas</div>
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '.875rem' }}>
            {Icon.link}<br />
            <span>No hay plataformas conectadas todavía.</span>
          </div>
        </motion.div>

        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .12 }}>
          <div className="pnl-card__title">
            {Icon.calendar} Próximos streams
            <button className="pnl-link pnl-card__action">{Icon.plus} Agendar</button>
          </div>
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '.875rem' }}>
            {Icon.calendar}<br />
            <span>Sin streams agendados.</span>
          </div>
        </motion.div>
      </div>

      {/* Brand deals */}
      <div className="pnl-grid pnl-grid--2 pnl-section-gap">
        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .14 }}>
          <div className="pnl-card__title">
            {Icon.star} Ofertas de marca
            <button className="pnl-link pnl-card__action" onClick={() => navigate('/creador/monetizacion')}>Ver todas {Icon.chevronRight}</button>
          </div>
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '.875rem' }}>
            {Icon.star}<br />
            <span>Sin deals activos todavía.</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

