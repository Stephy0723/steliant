import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useActiveCommunity } from '../../../hooks/useActiveCommunity.js'
import { getCommunityStats } from '../../../lib/communitiesApi.js'
import '../CommunityPanelDashboard/CommunityPanel.css'

const WEB_LINKS = [
  { label: 'Torneos', icon: Icon.trophy, desc: 'Ver y relacionar torneos activos con tu comunidad.', path: '/torneos' },
  { label: 'Equipos', icon: Icon.team, desc: 'Revisar equipos y reclutamiento dentro de la web.', path: '/equipos' },
  { label: 'Marcas', icon: Icon.star, desc: 'Explorar patrocinadores y marcas visibles.', path: '/marcas' },
  { label: 'Calendario', icon: Icon.calendar, desc: 'Seguir scrims, eventos y fechas clave.', path: '/calendario' },
  { label: 'Ranking', icon: Icon.award, desc: 'Consultar posiciones y rendimiento competitivo.', path: '/ranking' },
  { label: 'Redes', icon: Icon.globe, desc: 'Gestionar difusión y presencia social.', path: '/redes' },
]

export default function CommunityWeb() {
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
        <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.globe}</div><h3>No hay comunidad activa</h3><p>Crea o selecciona una comunidad para revisar su presencia en la web.</p></div>
      </div>
    )
  }

  const postsCount = stats?.postsCount || 0
  const memberCount = stats?.memberCount ?? community.memberCount ?? 0
  const visibilityCards = [
    { label: 'Página pública', value: community.slug ? 'Activa' : 'Pendiente', detail: community.slug ? `/comunidad/c/${community.slug}` : 'Sin slug público' },
    { label: 'Privacidad', value: community.privacy === 'private' ? 'Privada' : 'Pública', detail: community.privacy === 'private' ? 'Solo miembros la ven.' : 'Visible para todos.' },
    { label: 'Contenido público', value: String(postsCount), detail: postsCount ? 'Hay publicaciones visibles para la comunidad.' : 'Aún no hay mensajes para mostrar.' },
    { label: 'Miembros', value: String(memberCount), detail: memberCount ? `${memberCount} miembros activos.` : 'Todavía sin miembros.' },
  ]

  return (
    <div>
      <div className="pnl-head">
        <div><h1>Presencia web</h1><p>Aquí se controla cómo se encuentra y se entiende {community.name} dentro de GlitchGang y en su página pública.</p></div>
      </div>

      <motion.div className="cp-publicpreview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="cp-publicpreview__cover" style={{ background: 'linear-gradient(135deg, var(--accent, #1E9DE3)cc, transparent)' }} />
        <div className="cp-publicpreview__body">
          <span className="cp-commandcenter__eyebrow">Vista pública</span>
          <h2>{community.name}</h2>
          <p>{community.description || 'Define una descripción clara para que la comunidad sea fácil de encontrar y entender.'}</p>
          <div className="cp-commandcenter__chips">
            <span>{Icon.gamepad} {community.game || 'Sin juego'}</span>
            <span>{Icon.chat} {postsCount} publicaciones</span>
            <span>{Icon.users} {memberCount} miembros</span>
          </div>
          <div className="cp-commandcenter__actions">
            {community.slug && <button className="pnl-btn pnl-btn--primary" onClick={() => navigate(`/comunidad/c/${community.slug}`)}>{Icon.eye} Abrir página pública</button>}
            <button className="pnl-btn" onClick={() => navigate('/comunidad')}>{Icon.globe} Ver hub de comunidades</button>
            <button className="pnl-btn" onClick={() => navigate(`/mi-comunidad/editar/${community.id}`)}>{Icon.edit} Editar presencia</button>
          </div>
        </div>
      </motion.div>

      <div className="pnl-grid pnl-grid--2 pnl-section-gap">
        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="pnl-card__title">{Icon.eye} Estado de visibilidad</div>
          <div className="cp-statusgrid">
            {visibilityCards.map(item => (
              <div key={item.label} className="cp-statuscard">
                <strong>{item.value}</strong>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .03 }}>
          <div className="pnl-card__title">{Icon.dashboard} Ecosistema conectado</div>
          <div className="cp-webgrid">
            {WEB_LINKS.map(item => (
              <button key={item.label} className="cp-webcard" onClick={() => navigate(item.path)}>
                <span className="cp-webcard__icon">{item.icon}</span>
                <b>{item.label}</b>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

