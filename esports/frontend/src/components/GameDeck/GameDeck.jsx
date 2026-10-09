import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import './GameDeck.css'

const FAN = [
  { rotate: -22, x: -200, y: 28,  scale: 0.80, zIndex: 1, fd: 0.0,  fDur: 3.3 },
  { rotate: -11, x: -100, y: 14,  scale: 0.90, zIndex: 2, fd: 0.55, fDur: 2.9 },
  { rotate:   0, x:    0, y:   0, scale: 1.00, zIndex: 5, fd: 1.0,  fDur: 3.1 },
  { rotate:  11, x:  100, y: 14,  scale: 0.90, zIndex: 2, fd: 0.35, fDur: 3.0 },
  { rotate:  22, x:  200, y: 28,  scale: 0.80, zIndex: 1, fd: 0.75, fDur: 2.8 },
]

// Professional SVG icons — colored with currentColor
const ICONS = {
  val:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="20,4 36,28 4,28"/><line x1="20" y1="14" x2="20" y2="26" strokeWidth="3"/></svg>,
  lol:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="20,3 33,11 33,29 20,37 7,29 7,11"/><polygon points="20,12 27,16 27,24 20,28 13,24 13,16" opacity=".45" strokeWidth="1.2"/></svg>,
  cs2:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="4" fill="currentColor" strokeWidth="0"/><line x1="20" y1="6" x2="20" y2="15"/><line x1="20" y1="25" x2="20" y2="34"/><line x1="6" y1="20" x2="15" y2="20"/><line x1="25" y1="20" x2="34" y2="20"/></svg>,
  apex: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="20,4 36,34 4,34"/><polygon points="20,14 28,30 12,30" fill="currentColor" strokeWidth="0" opacity=".3"/></svg>,
  rl:   <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><path d="M6 20 Q20 7 34 20 Q20 33 6 20" fill="currentColor" strokeWidth="0" opacity=".25"/><circle cx="20" cy="20" r="4" fill="currentColor" strokeWidth="0"/></svg>,
  ff:   <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="20,4 34,14 34,26 20,36 6,26 6,14"/><line x1="20" y1="13" x2="20" y2="27" strokeWidth="3"/><line x1="13" y1="20" x2="27" y2="20" strokeWidth="3"/></svg>,
  mlbb: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><path d="M12 26 L20 10 L28 26" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/><line x1="14" y1="22" x2="26" y2="22" strokeWidth="2.5"/></svg>,
  dota: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 4 L34 30 Q20 38 6 30 Z"/><circle cx="20" cy="19" r="5" fill="currentColor" strokeWidth="0"/></svg>,
}

const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function GameDeck({ games = [], onCard }) {
  const wrapRef   = useRef(null)
  const navigate  = useNavigate()
  const [tilt, setTilt]         = useState({ rx: 0, ry: 0 })
  const [hovering, setHovering] = useState(false)

  const visible = games.slice(0, 5)
  const fan     = FAN.slice(FAN.length - visible.length)
  const centerI = Math.floor(visible.length / 2)

  const onMouseMove = useCallback((e) => {
    if (PREFERS_REDUCED) return
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    setTilt({
      rx: (((e.clientY - r.top)  / r.height) - 0.5) * -10,
      ry: (((e.clientX - r.left) / r.width)  - 0.5) *  14,
    })
  }, [])

  return (
    <div
      ref={wrapRef}
      className="gd-wrap"
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setTilt({ rx: 0, ry: 0 }) }}
      aria-hidden="true"
    >
      <div
        className="gd-deck"
        style={{
          transform: hovering && !PREFERS_REDUCED
            ? `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
            : 'perspective(1100px) rotateX(0) rotateY(0)',
          transition: hovering ? 'transform 0.10s linear' : 'transform 0.55s ease-out',
        }}
      >
        {visible.map((game, i) => {
          const cfg      = fan[i]
          const isCenter = i === centerI
          const icon     = ICONS[game.id] || ICONS.val
          const verticalArt = game.images?.vertical || null

          return (
            <motion.div
              key={game.id}
              className="gd-slot"
              style={{ zIndex: cfg.zIndex }}
              initial={PREFERS_REDUCED
                ? { opacity: 0 }
                : { x: 0, y: 80, rotate: 0, scale: 0.65, opacity: 0 }
              }
              animate={PREFERS_REDUCED
                ? { opacity: 1 }
                : { x: cfg.x, y: cfg.y, rotate: cfg.rotate, scale: cfg.scale, opacity: 1 }
              }
              transition={{
                type: 'spring', stiffness: 100, damping: 16, mass: 1,
                delay: 0.15 + i * 0.09,
                opacity: { duration: 0.2, delay: 0.15 + i * 0.09 },
              }}
            >
              <motion.div
                animate={PREFERS_REDUCED ? {} : { y: [0, -16, 0] }}
                transition={{ duration: cfg.fDur, delay: cfg.fd, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.button
                  className={`gd-card ${isCenter ? 'gd-card--front' : ''} ${verticalArt ? 'gd-card--has-img' : ''}`}
                  style={{ '--gc': game.color, '--gcb': game.colorB }}
                  whileHover={PREFERS_REDUCED ? {} : {
                    y: -12, scale: 1.06,
                    transition: { type: 'spring', stiffness: 300, damping: 22 },
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onCard ? onCard(game.id) : navigate(`/comunidad/${game.id}`)}
                >
                  {verticalArt && (
                    <img
                      src={verticalArt}
                      alt={game.name}
                      className="gd-card__img"
                      loading="lazy"
                    />
                  )}
                  <div className="gd-card__art" />
                  <div className="gd-card__noise" />
                  <div className="gd-card__shine" />

                  <div className="gd-card__body">
                    <div className="gd-card__name">{game.name}</div>
                    <div className="gd-card__genre">{game.genre}</div>
                  </div>

                  {isCenter && (
                    <div className="gd-card__badge">
                      <span className="gd-dot" />{game.active} activos
                    </div>
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

