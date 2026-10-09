import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/Button/Button.jsx'
import GlitchText, { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import CircuitGrid from './CircuitGrid.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import './Hero.css'

const fade = (d = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.75, delay: d, ease: [0.16, 1, 0.3, 1] },
})

export default function Hero({ started }) {
  const { t } = useLang()
  const navigate = useNavigate()
  if (!started) return <section className="gg-hero" />
  return (
    <section className="gg-hero">
      <div className="gg-beam" />
      <div className="gg-beam gg-beam--2" />

      <motion.div className="gg-badge" {...fade(0.05)}>
        <span className="gg-badge__dot" /> {t.hero.badge}
      </motion.div>

      <motion.h1 className="gg-h1" {...fade(0.14)}>
        {t.hero.titleA} <GlitchText>{t.hero.glitch}</GlitchText><br />{t.hero.titleB}
      </motion.h1>

      <motion.p className="gg-sub" {...fade(0.24)}>
        <GlitchGangText>{t.hero.sub}</GlitchGangText>
      </motion.p>

      <motion.div className="gg-cta" {...fade(0.34)}>
        <Button variant="primary" size="lg" onClick={() => navigate('/register')}>
          {t.hero.cta1}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate('/login')}>
          {t.hero.cta2}
        </Button>
      </motion.div>

      <CircuitGrid />

      {/* Scroll indicator */}
      <div className="gg-scroll-hint">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
        <span>Scroll</span>
      </div>
    </section>
  )
}

