import { motion } from 'framer-motion'
import { useReveal } from '../../hooks/useReveal.js'
import './Features.css'

const FEATURES = [
  {
    icon: 'M13 2 3 14h7l-1 8 10-12h-7z',
    title: 'Matchmaking Glitch',
    text: 'Emparejamiento por habilidad en milisegundos con ranking transparente y anti-cheat integrado.',
    accent: '#00E676',
  },
  {
    icon: 'M12 8 a4 4 0 1 0 0-8 a4 4 0 0 0 0 8 M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
    title: 'Comunidad premium',
    text: 'Servidores, clanes y eventos privados. Conecta con jugadores de tu nivel y crea tu escena.',
    accent: '#8B5CF6',
  },
  {
    icon: 'M3 3v18h18 M7 14l4-4 3 3 5-6',
    title: 'Stats en tiempo real',
    text: 'Dashboards profesionales con rendimiento, progreso y métricas detalladas de cada partida.',
    accent: '#3B82F6',
  },
  {
    icon: 'M6 9V4h12v5a6 6 0 0 1-12 0Z M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M9 18h6M12 14v4M8 21h8',
    title: 'Torneos organizados',
    text: 'Brackets automáticos, premiaciones y transmisión en vivo. Compite desde cualquier región.',
    accent: '#FACC15',
  },
  {
    icon: 'M3 15a4 4 0 0 0 4 4h9a5 5 0 0 0 1.8-9.7 7 7 0 1 0-13.4-2',
    title: 'Plataforma en la nube',
    text: 'Sin downloads, sin lag. Accede a torneos, stats y equipo desde el navegador con latencia mínima.',
    accent: '#EC4899',
  },
  {
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    title: 'Anti-cheat integrado',
    text: 'Sistema de reporte avanzado, moderación y protección de resultados. Competencia limpia garantizada.',
    accent: '#EF4444',
  },
]

export default function Features() {
  const [ref, visible] = useReveal(0.15)
  return (
    <section className="gg-section" id="features" ref={ref}>
      <div className="gg-eyebrow">El ecosistema</div>
      <h2 className="gg-h2">Todo lo que tu comunidad necesita.</h2>
      <p className="gg-lead">Infraestructura diseñada para jugadores serios. Del primer torneo a la temporada completa.</p>
      <div className="gg-cards">
        {FEATURES.map((f, i) => (
          <motion.div
            className="gg-card"
            key={f.title}
            style={{ '--card-accent': f.accent }}
            initial={{ opacity: 0, y: 28 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: i * 0.07 }}
          >
            <div className="gg-card__ic" style={{ background: `${f.accent}18`, color: f.accent }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={f.icon} />
              </svg>
            </div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

