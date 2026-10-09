import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useReveal } from '../../hooks/useReveal.js'
import { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import './Stats.css'

const STATS = [
  { to: 120,  suffix: 'K', label: 'Jugadores activos' },
  { to: 4800, suffix: '+', label: 'Torneos jugados' },
  { to: 32,   suffix: '',  label: 'Países conectados' },
  { to: 99,   suffix: '.9%', label: 'Uptime competitivo' },
]

function Counter({ to, suffix, run }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) { setN(0); return }
    let c = 0; const step = to / 45
    const id = setInterval(() => { c += step; if (c >= to) { c = to; clearInterval(id) } setN(Math.round(c)) }, 22)
    return () => clearInterval(id)
  }, [run, to])
  return <span className="gg-stat__num">{n}{suffix}</span>
}

export default function Stats() {
  const [ref, visible] = useReveal(0.25)
  return (
    <section className="gg-section" ref={ref}>
      <div className="gg-eyebrow">Por qué <GlitchGangText>GlitchGang</GlitchGangText></div>
      <h2 className="gg-h2">Una plataforma construida para competir.</h2>
      <p className="gg-lead">Infraestructura de baja latencia, matchmaking inteligente y un ecosistema
        de comunidad diseñado para jugadores que van en serio.</p>
      <div className="gg-stats">
        {STATS.map((s, i) => (
          <motion.div className="gg-stat" key={s.label}
            initial={{ opacity: 0, y: 30 }}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: i * 0.08 }}>
            <Counter {...s} run={visible} />
            <div className="gg-stat__lbl">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

