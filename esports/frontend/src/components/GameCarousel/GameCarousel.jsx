/**
 * GameCarousel — showcase de juegos con imágenes grandes.
 * Auto-advance · Thumbnails · Flechas · Progress bar · Pause al hover.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import './GameCarousel.css'

const INTERVAL = 4200

// Game SVG icons (stroke-based)
const ICONS = {
  val:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="20,4 36,28 4,28"/><line x1="20" y1="14" x2="20" y2="26" strokeWidth="3"/></svg>,
  lol:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="20,3 33,11 33,29 20,37 7,29 7,11"/><polygon points="20,12 27,16 27,24 20,28 13,24 13,16" opacity=".4" strokeWidth="1.2"/></svg>,
  cs2:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="4" fill="currentColor" strokeWidth="0"/><line x1="20" y1="6" x2="20" y2="15"/><line x1="20" y1="25" x2="20" y2="34"/><line x1="6" y1="20" x2="15" y2="20"/><line x1="25" y1="20" x2="34" y2="20"/></svg>,
  apex: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="20,4 36,34 4,34"/><polygon points="20,14 28,30 12,30" fill="currentColor" strokeWidth="0" opacity=".28"/></svg>,
  rl:   <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><path d="M6 20 Q20 7 34 20 Q20 33 6 20" fill="currentColor" strokeWidth="0" opacity=".22"/><circle cx="20" cy="20" r="4" fill="currentColor" strokeWidth="0"/></svg>,
  ff:   <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="20,4 34,14 34,26 20,36 6,26 6,14"/><line x1="20" y1="13" x2="20" y2="27" strokeWidth="3"/><line x1="13" y1="20" x2="27" y2="20" strokeWidth="3"/></svg>,
  mlbb: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><path d="M12 26 L20 10 L28 26" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/><line x1="14" y1="22" x2="26" y2="22" strokeWidth="2.5"/></svg>,
  dota: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 4 L34 30 Q20 38 6 30 Z"/><circle cx="20" cy="19" r="5" fill="currentColor" strokeWidth="0"/></svg>,
}

export default function GameCarousel({ games = [] }) {
  const navigate  = useNavigate()
  const [idx,    setIdx]    = useState(0)
  const [dir,    setDir]    = useState(1)
  const [paused, setPaused] = useState(false)
  const timer = useRef(null)

  const go = useCallback((next) => {
    setDir(next > idx ? 1 : -1)
    setIdx(next)
  }, [idx])

  const prev = useCallback(() => go((idx - 1 + games.length) % games.length), [go, idx, games.length])
  const next = useCallback(() => go((idx + 1) % games.length), [go, idx, games.length])

  useEffect(() => {
    if (paused || games.length < 2) return
    timer.current = setInterval(() => {
      setDir(1)
      setIdx(i => (i + 1) % games.length)
    }, INTERVAL)
    return () => clearInterval(timer.current)
  }, [paused, games.length])

  const game = games[idx]
  if (!game) return null

  const slideVariants = {
    enter: (d) => ({ x: d * 70, opacity: 0, scale: 0.97 }),
    show:  { x: 0, opacity: 1, scale: 1 },
    exit:  (d) => ({ x: -d * 50, opacity: 0, scale: 0.97 }),
  }

  return (
    <div
      className="gc-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Featured slide ── */}
      <div className="gc-featured">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={game.id}
            className="gc-slide"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="show"
            exit="exit"
            transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Background media */}
            {game.video ? (
              <div className="gc-slide__media" style={{ '--gc': game.color }}>
                <video
                  className="gc-slide__video"
                  src={game.video}
                  poster={game.image || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                <div
                  className="gc-slide__bg gc-slide__bg--fallback"
                  style={{ backgroundImage: `url(${game.image})`, '--gc': game.color }}
                />
              </div>
            ) : (
              <div
                className="gc-slide__bg"
                style={{ backgroundImage: `url(${game.image})`, '--gc': game.color }}
              />
            )}
            <div className="gc-slide__vignette" />

            {/* Content overlay */}
            <div className="gc-slide__content">
              {/* Icon */}
              <div className="gc-slide__icon" style={{ color: game.color }}>
                {ICONS[game.id] || ICONS.val}
              </div>

              <div className="gc-slide__genre">{game.genre}</div>
              <h3 className="gc-slide__name" style={{ '--gc': game.color }}>
                {game.name}
              </h3>
              <p className="gc-slide__desc">{game.description}</p>

              <div className="gc-slide__tags">
                {(game.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="gc-tag">{t}</span>
                ))}
              </div>

              <div className="gc-slide__foot">
                <div className="gc-slide__live">
                  <span className="gc-live-dot" />
                  {game.active} activos
                </div>
                <button
                  className="gc-slide__cta"
                  style={{ '--gc': game.color }}
                  onClick={() => navigate(`/comunidad/${game.id}`)}
                >
                  Explorar comunidad
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M4 10h12M10 4l6 6-6 6"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Slide counter */}
            <div className="gc-counter">
              <span>{String(idx + 1).padStart(2, '0')}</span>
              <span className="gc-counter-sep" />
              <span>{String(games.length).padStart(2, '0')}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="gc-progress">
          <motion.div
            key={`p-${idx}-${paused}`}
            className="gc-progress__fill"
            initial={{ scaleX: 0 }}
            animate={paused ? { scaleX: 0 } : { scaleX: 1 }}
            transition={{ duration: INTERVAL / 1000, ease: 'linear' }}
          />
        </div>

        {/* Arrows */}
        <button className="gc-arrow gc-arrow--l" onClick={prev} aria-label="Anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button className="gc-arrow gc-arrow--r" onClick={next} aria-label="Siguiente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* ── Thumbnail strip ── */}
      <div className="gc-thumbs">
        {games.map((g, i) => (
          <button
            key={g.id}
            className={`gc-thumb ${i === idx ? 'active' : ''}`}
            style={{ '--gc': g.color }}
            onClick={() => go(i)}
          >
            <img
              src={g.image}
              alt={g.name}
              className="gc-thumb__img"
              loading="lazy"
            />
            <div className="gc-thumb__overlay" />
            <div className="gc-thumb__icon" style={{ color: g.color }}>
              {ICONS[g.id] || ICONS.val}
            </div>
            <span className="gc-thumb__name">{g.name}</span>
            {/* Active progress line */}
            {i === idx && !paused && (
              <motion.div
                key={`tp-${i}`}
                className="gc-thumb__prog"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: INTERVAL / 1000, ease: 'linear' }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

