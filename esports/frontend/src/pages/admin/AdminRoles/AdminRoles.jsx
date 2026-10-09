import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { PLATFORM_ROLES } from '../../../data/roleApplications.js'
import './AdminRoles.css'

const ROLE_TONE = {
  player: 'green',
  organizer: 'yellow',
  creator: 'purple',
  coach: 'blue',
  caster: 'red',
  analyst: 'cyan',
  sponsor: 'gold',
}

function RoleCard({ role, stats, onReview }) {
  const s = stats[role.id] || { users: 0, pending: 0, approved: 0, rejected: 0 }
  const tone = ROLE_TONE[role.id] || 'green'
  const isBase = role.id === 'player'

  return (
    <motion.article
      className={`ar-card ar-card--${tone}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="ar-card__head">
        <span className="ar-card__icon">{Icon[role.icon] || Icon.star}</span>
        <div>
          <span className="ar-card__tag">{role.tag}</span>
          <h3 className="ar-card__name">{role.label}</h3>
        </div>
        {isBase && <span className="ar-card__base-badge">Base</span>}
      </div>

      <p className="ar-card__desc">{role.desc}</p>

      <div className="ar-card__stats">
        {isBase ? (
          <span className="ar-card__stat">Todos los usuarios registrados</span>
        ) : (
          <>
            <div className="ar-card__stat-row">
              <span>{Icon.users}</span>
              <span><b>{s.users}</b> con este rol</span>
            </div>
            <div className="ar-card__stat-row">
              <span>{Icon.check}</span>
              <span><b>{s.approved}</b> aprobadas</span>
            </div>
            <div className={`ar-card__stat-row ${s.pending > 0 ? 'ar-card__stat-row--warn' : ''}`}>
              <span>{Icon.clock}</span>
              <span><b>{s.pending}</b> pendientes</span>
            </div>
            {s.rejected > 0 && (
              <div className="ar-card__stat-row ar-card__stat-row--dim">
                <span>{Icon.x}</span>
                <span><b>{s.rejected}</b> rechazadas</span>
              </div>
            )}
          </>
        )}
      </div>

      {!isBase && (
        <button
          className={`ar-card__btn ${s.pending > 0 ? 'ar-card__btn--warn' : ''}`}
          onClick={() => onReview(role.id)}
        >
          {s.pending > 0
            ? <>{Icon.alert} Revisar {s.pending} pendiente{s.pending !== 1 ? 's' : ''}</>
            : <>{Icon.eye} Ver solicitudes</>
          }
        </button>
      )}
    </motion.article>
  )
}

export default function AdminRoles() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/role-applications/admin/stats')
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalPending = Object.values(stats).reduce((sum, s) => sum + (s.pending || 0), 0)

  const handleReview = (roleId) => {
    navigate('/admin/autorizaciones', { state: { roleFilter: roleId } })
  }

  return (
    <div className="gg-admin-page">
      <div className="gg-admin-page__header">
        <div>
          <h2>Roles &amp; Permisos</h2>
          <p>
            {loading
              ? 'Cargando estadísticas...'
              : totalPending > 0
                ? `${totalPending} solicitud${totalPending !== 1 ? 'es' : ''} pendiente${totalPending !== 1 ? 's' : ''} de revisión`
                : 'Sin solicitudes pendientes'
            }
          </p>
        </div>
        {totalPending > 0 && (
          <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => navigate('/admin/autorizaciones')}>
            {Icon.check} Revisar todas
          </button>
        )}
      </div>

      <div className="ar-legend">
        <span>{Icon.users} Los roles marcados como <b>Base</b> son asignados automáticamente al registrarse.</span>
        <span>{Icon.shield} Los demás requieren solicitud del usuario y aprobación del Admin.</span>
      </div>

      {loading ? (
        <div className="gg-admin-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p className="gg-admin-dim">Cargando estadísticas de roles...</p>
        </div>
      ) : (
        <div className="ar-grid">
          {PLATFORM_ROLES.map((role, i) => (
            <RoleCard
              key={role.id}
              role={role}
              stats={stats}
              onReview={handleReview}
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      )}

      <div className="gg-admin-card ar-info">
        <h4>{Icon.layoutGrid} Flujo operativo de roles</h4>
        <div className="ar-info__grid">
          <div>
            <b>1. El usuario solicita</b>
            <p>Desde <code>/solicitar-rol</code>, llena el formulario con su información y documentos.</p>
          </div>
          <div>
            <b>2. El Admin revisa</b>
            <p>La solicitud aparece en <a onClick={() => navigate('/admin/autorizaciones')}>/admin/autorizaciones</a> con todos los datos.</p>
          </div>
          <div>
            <b>3. Se aprueba o rechaza</b>
            <p>Al aprobar, el campo <code>User.role</code> se actualiza automáticamente en la base de datos.</p>
          </div>
          <div>
            <b>4. El usuario accede</b>
            <p>Al refrescar la sesión, el usuario ve las herramientas exclusivas de su nuevo rol.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

