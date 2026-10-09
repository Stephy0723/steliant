import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import GlitchText from '../GlitchText/GlitchText.jsx'
import { Icon } from '../icons/Icons.jsx'
import './DiscordLinkedCelebration.css'

const PARTICLE_COLORS = ['#00e676', '#8b5cf6', '#ff4fd8', '#5865F2']
const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2
  const distance = 80 + Math.random() * 70
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    delay: Math.random() * 0.15,
  }
})

// Momento celebratorio — no un toast mas. Se dispara una sola vez cuando
// el backend confirma que Discord quedo vinculado a la cuenta actual.
export default function DiscordLinkedCelebration({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const t = setTimeout(onClose, 5200)
    return () => clearTimeout(t)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="gg-dcelebrate-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="gg-dcelebrate"
            initial={{ opacity: 0, scale: 0.72, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gg-dcelebrate__burst">
              {PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  className="gg-dcelebrate__particle"
                  style={{ background: p.color }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 1, delay: p.delay, ease: 'easeOut' }}
                />
              ))}
              <motion.div
                className="gg-dcelebrate__icon"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: [0, 1.2, 1], rotate: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
              >
                {Icon.discord}
              </motion.div>
            </div>

            <h3><GlitchText>¡Discord conectado!</GlitchText></h3>
            <p>Tu cuenta de GlitchGang ya está vinculada — roles automáticos, torneos por Discord y todo listo para usarse.</p>

            <button className="gg-dcelebrate__close" onClick={onClose}>Genial</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

