import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useActiveCommunity } from '../../../hooks/useActiveCommunity.js'
import { getCommunityStats } from '../../../lib/communitiesApi.js'
import '../CommunityPanelDashboard/CommunityPanel.css'

// Checklist basado en lo que el modelo Community real tiene de verdad
// (name/slug/game/description/tags/privacy/creator/members) -- la versión
// de main asumía logo/banner/links/team, que esta rama no tiene.
function getCommunityCompletion(community, stats) {
  const checks = [
    Boolean(community.description),
    Boolean(community.game),
    Array.isArray(community.tags) && community.tags.length > 0,
    (stats?.postsCount || 0) > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function formatShortDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CommunityOperations() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { community } = useActiveCommunity()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!community?.id) { setStats(null); return }
    let alive = true
    getCommunityStats(community.id).then(d => { if (alive) setStats(d) }).catch(() => { if (alive) setStats(null) })
    return () => { alive = false }
  }, [community?.id])

  if (!community) {
    return (
      <div className="pnl-card">
        <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.bolt}</div><h3>No hay comunidad activa</h3><p>Crea o selecciona una comunidad para usar el centro operativo.</p></div>
      </div>
    )
  }

  const postsCount = stats?.postsCount || 0
  const memberCount = stats?.memberCount ?? community.memberCount ?? 0
  const completion = getCommunityCompletion(community, stats)
  const setupItems = [
    { label: 'Descripción', done: Boolean(community.description), detail: 'Explica de qué trata la comunidad a nuevos miembros.' },
    { label: 'Juego definido', done: Boolean(community.game), detail: 'Sirve para categorizar la comunidad y ubicarla.' },
    { label: 'Etiquetas', done: Array.isArray(community.tags) && community.tags.length > 0, detail: 'Ayudan a que la comunidad aparezca en búsquedas.' },
    { label: 'Contenido inicial', done: postsCount > 0, detail: 'Mensajes para orientar a nuevos miembros.' },
  ]

  const statusCards = [
    { label: 'Configuración', value: `${completion}%`, detail: completion >= 75 ? 'La estructura ya es sólida.' : 'Todavía faltan piezas importantes.', tone: completion >= 75 ? 'good' : 'warn' },
    { label: 'Miembros', value: String(memberCount), detail: community.privacy === 'private' ? 'Comunidad privada' : 'Comunidad pública', tone: 'neutral' },
    { label: 'Publicaciones', value: String(postsCount), detail: postsCount ? 'Hay actividad visible.' : 'Falta actividad pública.', tone: postsCount ? 'good' : 'warn' },
  ]

  const overviewRows = [
    { label: 'Slug público', value: community.slug || 'Pendiente' },
    { label: 'Juego', value: community.game || 'Sin definir' },
    { label: 'Etiquetas', value: (community.tags || []).join(', ') || 'Sin etiquetas' },
    { label: 'Privacidad', value: community.privacy === 'private' ? 'Privada' : 'Pública' },
    { label: 'Creada', value: formatShortDate(community.createdAt) },
    { label: 'Propietario', value: user?.nick || 'Tú' },
  ]

  const actions = [
    { label: 'Editar perfil', icon: Icon.edit, desc: 'Corrige nombre, juego, etiquetas y descripción.', action: () => navigate(`/mi-comunidad/editar/${community.id}`) },
    { label: 'Gestionar miembros', icon: Icon.users, desc: 'Revisa y modera a los miembros de la comunidad.', action: () => navigate('/mi-comunidad/miembros') },
    { label: 'Nuevo anuncio', icon: Icon.send, desc: 'Publica novedades y mensajes clave.', action: () => navigate('/mi-comunidad/publicaciones') },
    { label: 'Ver pública', icon: Icon.eye, desc: 'Comprueba cómo la ve el usuario final.', action: () => navigate(`/comunidad/c/${community.slug || community.id}`) },
  ]

  return (
    <div>
      <div className="pnl-head">
        <div><h1>Operaciones</h1><p>Este espacio concentra la gestión interna de {community.name}: configuración y nivel real de preparación.</p></div>
      </div>

      <div className="pnl-grid pnl-grid--2">
        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="pnl-card__title">{Icon.alert} Estado operativo</div>
          <div className="cp-progress">
            <div className="cp-progress__bar"><span style={{ width: `${completion}%` }} /></div>
            <div className="cp-progress__legend">
              <b>{completion}% listo</b>
              <small>{completion >= 75 ? 'La comunidad ya puede escalar con una estructura bastante clara.' : 'Todavía conviene completar descripción, etiquetas o contenido.'}</small>
            </div>
          </div>
          <div className="cp-statusgrid">
            {statusCards.map(item => (
              <div key={item.label} className={`cp-statuscard cp-statuscard--${item.tone}`}>
                <strong>{item.value}</strong>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
          <div className="cp-checklist">
            {setupItems.map(item => (
              <div key={item.label} className={`cp-checklist__item ${item.done ? 'done' : ''}`}>
                <span>{item.done ? Icon.check : Icon.chevronRight}</span>
                <div>
                  <b>{item.label}</b>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .03 }}>
          <div className="pnl-card__title">{Icon.bolt} Flujo de gestión</div>
          <div className="cp-actiondeck">
            {actions.map(item => (
              <button key={item.label} className="cp-actiondeck__item" onClick={item.action}>
                <span className="cp-actiondeck__icon">{item.icon}</span>
                <div>
                  <b>{item.label}</b>
                  <small>{item.desc}</small>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .05 }}>
        <div className="pnl-card__title">{Icon.dashboard} Datos base de la comunidad</div>
        <div className="cp-overview">
          {overviewRows.map(item => (
            <div key={item.label} className="cp-overview__row">
              <span>{item.label}</span>
              <b>{item.value}</b>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

