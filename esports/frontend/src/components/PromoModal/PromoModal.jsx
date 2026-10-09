import { useState, useEffect } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { motion, AnimatePresence } from 'framer-motion'
import { usePromo } from '../../context/PromoContext.jsx'
import { Icon } from '../icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import './PromoModal.css'

const COUNTDOWN = 10
const PROMO_ACCENTS = {
  'fdv-2026': '#0B4F8A',
  'npc-2026': '#F47B20',
}
const PROMO_COPY = {
  es: {
    'fdv-2026': {
      badge: 'Aliado institucional',
      title: 'Federacion Dominicana de Videojuegos',
      subtitle: 'Competencia organizada, comunidad y desarrollo nacional',
      description: 'Apoyo institucional para torneos, jugadores, organizadores y comunidades competitivas de Republica Dominicana.',
      cta: 'Conocer la federacion',
    },
    'npc-2026': {
      badge: 'Media partner',
      title: 'NPC Latino',
      subtitle: 'La escena latina de videojuegos en un solo lugar',
      description: 'Cobertura, historias y contenido competitivo para conectar a jugadores, fans y organizadores de LATAM.',
      cta: 'Visitar NPC Latino',
    },
  },
  en: {
    'fdv-2026': {
      badge: 'Institutional partner',
      title: 'Dominican Video Game Federation',
      subtitle: 'Organized competition, community and national growth',
      description: 'Institutional support for tournaments, players, organizers and competitive communities in the Dominican Republic.',
      cta: 'Learn more',
    },
    'npc-2026': {
      badge: 'Media partner',
      title: 'NPC Latino',
      subtitle: 'Latin gaming culture in one place',
      description: 'Coverage, stories and competitive content connecting players, fans and organizers across LATAM.',
      cta: 'Visit NPC Latino',
    },
  },
}

export default function PromoModal() {
  const { visible, campaign, close } = usePromo()
  const { lang } = useLang()
  const [seconds, setSeconds] = useState(COUNTDOWN)
  const canClose = seconds === 0
  const isEs = lang !== 'en'

  // Reset + run countdown each time modal opens
  useEffect(() => {
    if (!visible) return
    setSeconds(COUNTDOWN)
    const t = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(t); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [visible])

  // Block Escape key while counting down
  useEffect(() => {
    if (!visible) return
    const handler = (e) => { if (e.key === 'Escape' && !canClose) e.preventDefault() }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [visible, canClose])

  if (!campaign) return null

  const sponsor = campaign
  const accent = sponsor.accent || sponsor.color || PROMO_ACCENTS[sponsor.id] || 'var(--accent)'
  const localized = PROMO_COPY[isEs ? 'es' : 'en'][sponsor.id] || {}
  const badge = localized.badge || sponsor.badge
  const title = localized.title || sponsor.title
  const subtitle = localized.subtitle || sponsor.subtitle
  const description = localized.description || sponsor.description
  const ctaLabel = localized.cta || sponsor.cta || (isEs ? 'Ver oferta' : 'View offer')

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop — click blocked while counting */}
          <motion.div
            className="gg-promo-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={canClose ? close : undefined}
            style={{ cursor: canClose ? 'pointer' : 'default' }}
          />

          {/* Wrapper solo para centrar (flex) — el motion.div de adentro es el
              que anima scale/y, asi el transform de la animacion no le pisa
              el transform que centraria el modal si estuviera en el mismo
              elemento (ese era el bug del hueco vacio: position:fixed con
              top+bottom en 0 y height:auto estira el box a toda la pantalla
              en vez de ajustarse al contenido). */}
          <div className="gg-promo-modal-pos">
            <motion.div
              className="gg-promo-modal"
              data-no-translate
              translate="no"
              style={{ '--promo-bg': sponsor.bg || 'var(--bg-elev)', '--promo-edge': accent }}
              initial={{ opacity: 0, scale: 0.92, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              {/* Background gradient */}
              <div className="gg-promo-modal__bg" />
              <div className="gg-promo-modal__scan" />
              <div className="gg-promo-modal__sheen" />

              {/* Close / countdown */}
              <div className="gg-promo-modal__topbar">
                <span className="gg-promo-modal__ad-label">Anuncio patrocinado</span>
                <div className="gg-promo-modal__close-wrap">
                  {!canClose ? (
                    <div className="gg-promo-modal__countdown">
                      <div
                        className="gg-promo-modal__ring"
                        style={{ '--progress': `${((COUNTDOWN - seconds) / COUNTDOWN) * 251}` }}
                      >
                        <svg viewBox="0 0 44 44">
                          <circle cx="22" cy="22" r="20" className="track" />
                          <circle cx="22" cy="22" r="20" className="fill" />
                        </svg>
                        <span>{seconds}</span>
                      </div>
                      <span className="gg-promo-modal__cd-label">{isEs ? `Puedes cerrar en ${seconds}s` : `You can close in ${seconds}s`}</span>
                    </div>
                  ) : (
                    <motion.button
                      className="gg-promo-modal__close-btn"
                      onClick={close}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      {Icon.x}
                      <span>{isEs ? 'Cerrar anuncio' : 'Close ad'}</span>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="gg-promo-modal__body">
                {/* Badge */}
                {badge && (
                  <div className="gg-promo-modal__badge">{badge}</div>
                )}

                {/* Sponsor name */}
                <div className="gg-promo-modal__brand">{sponsor.id?.toUpperCase()}</div>

                {/* Titles */}
                <h2 className="gg-promo-modal__title">{title}</h2>
                <p className="gg-promo-modal__sub">{subtitle}</p>
                <p className="gg-promo-modal__desc">{description}</p>

                {/* CTA */}
                <div className="gg-promo-modal__actions">
                  {sponsor.ctaUrl ? (
                    <a
                      className="gg-btn gg-btn--primary gg-btn--lg"
                      href={safeHref(sponsor.ctaUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                    >
                      {ctaLabel}
                    </a>
                  ) : (
                    <button className="gg-btn gg-btn--primary gg-btn--lg" type="button" disabled>
                      {ctaLabel}
                    </button>
                  )}
                  {canClose && (
                    <button className="gg-btn gg-btn--ghost gg-btn--lg" onClick={close}>
                      {isEs ? 'No me interesa' : 'Not interested'}
                    </button>
                  )}
                </div>
              </div>

              {/* Decorative accent line */}
              <div className="gg-promo-modal__accent-bar" />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

