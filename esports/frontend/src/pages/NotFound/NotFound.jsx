import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../components/icons/Icons.jsx'
import './NotFound.css'

function getContextAction(pathname = '') {
  const path = pathname.toLowerCase()
  if (path.startsWith('/equipos')) return { label: 'Equipos', path: '/equipos', icon: Icon.users }
  if (path.startsWith('/torneos')) return { label: 'Torneos', path: '/torneos', icon: Icon.trophy }
  if (path.startsWith('/perfil')) return { label: 'Perfil', path: '/perfil', icon: Icon.user || Icon.users }
  if (path.startsWith('/marcas')) return { label: 'Marcas', path: '/marcas', icon: Icon.award }
  if (path.startsWith('/comunidad')) return { label: 'Comunidad', path: '/comunidad', icon: Icon.globe }
  if (path.startsWith('/noticias')) return { label: 'Noticias', path: '/noticias', icon: Icon.fileText }
  if (path.startsWith('/ranking')) return { label: 'Ranking', path: '/ranking', icon: Icon.trophy }
  return null
}

export default function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()
  const contextAction = getContextAction(location.pathname)

  return (
    <main className="gg-notfound">
      <motion.section
        className="gg-notfound__card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="gg-notfound__scan" />
        <p className="gg-notfound__eyebrow">Ruta perdida</p>
        <div className="gg-notfound__code" data-text="404">404</div>
        <h1>Pagina no encontrada</h1>
        <p className="gg-notfound__copy">
          La ruta que buscas no existe, fue movida o quedo fuera del mapa competitivo.
        </p>

        <div className="gg-notfound__actions">
          <button className="gg-notfound__btn gg-notfound__btn--primary" type="button" onClick={() => navigate('/')}>
            {Icon.home || Icon.globe} Inicio
          </button>
          <button className="gg-notfound__btn" type="button" onClick={() => navigate(-1)}>
            {Icon.chevronRight} Volver
          </button>
          {contextAction && (
            <button className="gg-notfound__btn" type="button" onClick={() => navigate(contextAction.path)}>
              {contextAction.icon} {contextAction.label}
            </button>
          )}
        </div>
      </motion.section>
    </main>
  )
}

