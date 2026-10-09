import { motion } from 'framer-motion'
import { useReveal } from '../../hooks/useReveal.js'

// Envoltorio que anima su contenido al entrar en viewport (revive al volver a entrar).
export default function Reveal({ children, delay = 0, y = 42, once = false, className = '' }) {
  const [ref, visible] = useReveal(0.18, once)
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y, scale: 0.985 }}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y, scale: 0.985 }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

