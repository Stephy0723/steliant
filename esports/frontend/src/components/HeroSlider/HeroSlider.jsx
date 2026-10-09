/**
 * HeroSlider — fondo de imagen animado para el hero.
 * Crossfade + Ken Burns zoom en cada slide.
 * Pausa al hover. Indicador de progreso.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './HeroSlider.css'

const INTERVAL = 5500  // ms por slide

export default function HeroSlider({ slides = [] }) {
  const [idx,    setIdx]    = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || slides.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), INTERVAL)
    return () => clearInterval(t)
  }, [paused, slides.length])

  if (!slides.length) return null

  return (
    <div
      className="hs-root"
      aria-hidden="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides with Ken Burns */}
      <AnimatePresence mode="sync">
        <motion.div
          key={slides[idx].id}
          className="hs-slide"
          style={{ backgroundImage: `url(${slides[idx].src})` }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1.03 }}
          exit={{ opacity: 0, scale: 1.0 }}
          transition={{
            opacity: { duration: 1.4, ease: 'easeInOut' },
            scale:   { duration: INTERVAL / 1000 + 1, ease: 'linear' },
          }}
        />
      </AnimatePresence>

      {/* Gradient overlays — keeps text readable */}
      <div className="hs-grad-top" />
      <div className="hs-grad-bottom" />
      <div className="hs-grad-left" />

      {/* Progress bar at bottom */}
      <div className="hs-progress-track">
        {!paused && (
          <motion.div
            key={`prog-${idx}`}
            className="hs-progress-fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: INTERVAL / 1000, ease: 'linear' }}
          />
        )}
      </div>

      {/* Dot indicators */}
      <div className="hs-dots">
        {slides.map((s, i) => (
          <button
            key={s.id}
            className={`hs-dot ${i === idx ? 'active' : ''}`}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </div>
  )
}

