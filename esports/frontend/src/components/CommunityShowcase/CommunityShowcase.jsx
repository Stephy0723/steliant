import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { getUiPrefs, subscribeUi } from '../../lib/uiPrefs.js'
import './CommunityShowcase.css'

/**
 * Showcase rotativo cinematográfico (estilo store de juegos):
 * imágenes a pantalla completa que rotan solas, con miniaturas
 * navegables, barra de progreso y CTA.
 */
export default function CommunityShowcase({ items = [], autoMs = 6000 }) {
  const navigate = useNavigate()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef(null)
  const [perfMode, setPerfMode] = useState(() => getUiPrefs().perfMode)
  useEffect(() => subscribeUi(prefs => setPerfMode(prefs.perfMode)), [])

  const [videoError, setVideoError] = useState(false)
  const activeVideoRef = useRef(null)

  // Resetear error de video cuando cambia de slide
  useEffect(() => {
    setVideoError(false)
  }, [i])

  // Pausar video anterior cuando cambia de slide
  useEffect(() => {
    if (activeVideoRef.current) {
      activeVideoRef.current.pause()
      activeVideoRef.current = null
    }
  }, [i])

  const n = items.length
  const go = (idx) => setI((idx + n) % n)
  const next = () => go(i + 1)
  const prev = () => go(i - 1)

  useEffect(() => {
    if (paused || n <= 1) return
    timer.current = setInterval(() => setI(p => (p + 1) % n), autoMs)
    return () => clearInterval(timer.current)
  }, [paused, n, autoMs])

  if (!n) return null
  const c = items[i]
  const fmt = (x) => x >= 1000 ? `${(x / 1000).toFixed(1)}K` : String(x)

  return (
    <div className="gg-show" style={{ '--sc': c.color }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

      {/* Slides (crossfade + Ken Burns). Video si existe; si no, imagen; en modo rendimiento imagen estática. */}
      <div className="gg-show__stage" onClick={() => navigate(`/comunidad/${c.slug}`)}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={c.id} className="gg-show__slide"
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1.06 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ opacity: { duration: .7 }, scale: { duration: autoMs / 1000, ease: 'linear' } }}
          >
            {!perfMode && c.video && !videoError ? (
              <video
                ref={(el) => {
                  if (el) {
                    activeVideoRef.current = el
                    el.play().catch(() => {})
                  }
                }}
                className="gg-show__slide-video"
                src={c.video}
                poster={c.poster}
                muted
                loop
                playsInline
                onError={() => setVideoError(true)}
              />
            ) : (
              <div className="gg-show__slide-bg" style={{ backgroundImage: `url(${(perfMode ? c.lowFpsImage : null) || c.poster})` }} />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="gg-show__cine-left" />
        <div className="gg-show__cine-bottom" />

        {/* Contenido */}
        <div className="gg-show__content">
          <AnimatePresence mode="wait">
            <motion.div key={c.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .35 }}>
              <div className="gg-show__meta">
                <span className="gg-show__genre">{c.genre}</span>
                <span className="gg-show__stat">{Icon.users} {fmt(c.members)} miembros</span>
                {c.activePlayers > 0 && <span className="gg-show__stat gg-show__stat--live"><i /> {fmt(c.activePlayers)} en línea</span>}
              </div>
              <h2 className="gg-show__title">{c.name}</h2>
              <p className="gg-show__desc">{c.description}</p>
              <div className="gg-show__cta">
                <button className="gg-show__btn gg-show__btn--primary" onClick={(e) => { e.stopPropagation(); navigate(`/comunidad/${c.slug}`) }}>
                  {Icon.play} Entrar a la comunidad
                </button>
                <span className="gg-show__tags">{c.tags.slice(0, 4).map(t => <span key={t}>{t}</span>)}</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Flechas */}
        {n > 1 && (
          <>
            <button className="gg-show__arrow gg-show__arrow--l" onClick={(e) => { e.stopPropagation(); prev() }} aria-label="Anterior">{Icon.chevronRight}</button>
            <button className="gg-show__arrow gg-show__arrow--r" onClick={(e) => { e.stopPropagation(); next() }} aria-label="Siguiente">{Icon.chevronRight}</button>
          </>
        )}
      </div>

      {/* Miniaturas navegables */}
      <div className="gg-show__thumbs">
        {items.map((it, idx) => (
          <button key={it.id} className={`gg-show__thumb${idx === i ? ' active' : ''}`} style={{ '--tc': it.color, backgroundImage: `url(${it.poster})` }} onClick={() => go(idx)} title={it.name}>
            <span className="gg-show__thumb-scrim" />
            <span className="gg-show__thumb-name">{it.name}</span>
            {idx === i && !paused && <span className="gg-show__thumb-bar" style={{ animationDuration: `${autoMs}ms` }} />}
          </button>
        ))}
      </div>
    </div>
  )
}

