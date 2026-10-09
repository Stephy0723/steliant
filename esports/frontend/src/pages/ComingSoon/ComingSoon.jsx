import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../components/icons/Icons.jsx'
import './ComingSoon.css'

export default function ComingSoon({ title = 'Esta seccion', description, homePath = '/dashboard' }) {
  const navigate = useNavigate()

  return (
    <main className="gg-soon">
      <motion.section
        className="gg-soon__card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="gg-soon__scan" />
        <div className="gg-soon__badge">{Icon.bolt}</div>
        <p className="gg-soon__eyebrow">Proximamente</p>
        <h1>{title}</h1>
        <p className="gg-soon__copy">
          {description || 'Esta sección se habilitará en la próxima versión de GlitchGang.'}
        </p>

        <div className="gg-soon__actions">
          <button className="gg-soon__btn gg-soon__btn--primary" type="button" onClick={() => navigate(homePath)}>
            {Icon.home || Icon.globe} Ir al inicio
          </button>
          <button className="gg-soon__btn" type="button" onClick={() => navigate(-1)}>
            {Icon.chevronRight} Volver
          </button>
        </div>
      </motion.section>
    </main>
  )
}

