/**
 * PromoCarousel — carrusel publicitario grande para torneos.
 * Muestra sponsors, partners y anunciantes Pro.
 * Auto-advance · Flechas · Dots · Pausa al hover.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './PromoCarousel.css'

const INTERVAL = 5000

export default function PromoCarousel({ slides = [] }) {
  const [idx,    setIdx]    = useState(0)
  const [dir,    setDir]    = useState(1)
  const [paused, setPaused] = useState(false)
  const timer = useRef(null)

  const go = useCallback((next) => {
    if (!slides.length) return
    setDir(next > idx ? 1 : -1)
    setIdx(((next % slides.length) + slides.length) % slides.length)
  }, [idx, slides.length])

  useEffect(() => {
    if (paused || slides.length < 2) return
    timer.current = setInterval(() => {
      setDir(1)
      setIdx(i => (i + 1) % slides.length)
    }, INTERVAL)
    return () => clearInterval(timer.current)
  }, [paused, slides.length])

  if (!slides.length) return null
  const s = slides[idx]

  const variants = {
    enter:  d => ({ x: d * 80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   d => ({ x: -d * 60, opacity: 0 }),
  }

  return (
    <div
      className="pc-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={s.id}
          className="pc-slide"
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Background image */}
          <div
            className="pc-slide__bg"
            style={{ backgroundImage: `url(${s.image})`, '--sc': s.color }}
          />
          {/* Gradient overlay with brand color */}
          <div className="pc-slide__overlay" style={{ '--sc': s.color }} />

          {/* Type badge */}
          <div className="pc-slide__type">
            {s.type === 'sponsor'  && <span className="pc-badge pc-badge--sponsor">★ Sponsor Oficial</span>}
            {s.type === 'partner'  && <span className="pc-badge pc-badge--partner">◆ Partner</span>}
            {s.type === 'pro'      && <span className="pc-badge pc-badge--pro">⚡ Pro Advertiser</span>}
            {s.type === 'platform' && <span className="pc-badge pc-badge--gg">GG Platform</span>}
          </div>

          {/* Content */}
          <div className="pc-slide__content">
            <div className="pc-slide__brand" style={{ color: s.color }}>
              {s.logoText || s.sponsor}
            </div>
            <h3 className="pc-slide__title">{s.title}</h3>
            <p className="pc-slide__sub">{s.subtitle}</p>
            {s.badge && (
              <span className="pc-slide__badge" style={{ '--sc': s.color }}>{s.badge}</span>
            )}
            {s.cta && s.ctaUrl && (
              <a className="pc-slide__cta" style={{ '--sc': s.color }} href={s.ctaUrl} target="_blank" rel="noreferrer">
                {s.cta}
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M4 10h12M10 4l6 6-6 6"/>
                </svg>
              </a>
            )}
          </div>

          {/* Decorative logo text (large) */}
          <div className="pc-slide__watermark" style={{ color: s.color }}>
            {s.logoText || s.sponsor}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      <button className="pc-arrow pc-arrow--l" onClick={() => go(idx - 1)} aria-label="Anterior">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button className="pc-arrow pc-arrow--r" onClick={() => go(idx + 1)} aria-label="Siguiente">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* Progress bar */}
      <div className="pc-progress">
        <motion.div
          key={`pb-${idx}-${paused}`}
          className="pc-progress__fill"
          style={{ '--sc': s.color }}
          initial={{ scaleX: 0 }}
          animate={paused ? {} : { scaleX: 1 }}
          transition={{ duration: INTERVAL / 1000, ease: 'linear' }}
        />
      </div>

      {/* Dot indicators */}
      <div className="pc-dots">
        {slides.map((sl, i) => (
          <button
            key={sl.id}
            className={`pc-dot ${i === idx ? 'active' : ''}`}
            style={i === idx ? { background: s.color } : {}}
            onClick={() => go(i)}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="pc-counter">
        {String(idx + 1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}
      </div>
    </div>
  )
}

