import { motion } from 'framer-motion'
import { GlitchGangText } from '../GlitchText/GlitchText.jsx'
import './BrandSpotlight.css'

/**
 * BrandSpotlight — large featured campaign card.
 * Props: sponsor (full sponsor object), delay (number)
 */
export default function BrandSpotlight({ sponsor, delay = 0 }) {
  if (!sponsor) return null
  const c = sponsor.campaign

  return (
    <motion.div
      className="gg-brand-spot"
      style={{ '--bs-bg': c.bg || 'var(--bg-elev)', '--bs-color': sponsor.color }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: .35 }}
    >
      <div className="gg-brand-spot__bg" />
      <div className="gg-brand-spot__inner">
        {/* Logo */}
        <div className="gg-brand-spot__logo" style={{ background: sponsor.color }}>
          {sponsor.logoInitials}
        </div>

        <div className="gg-brand-spot__body">
          {c.badge && <div className="gg-brand-spot__badge">{c.badge}</div>}
          <div className="gg-brand-spot__sponsor">{sponsor.name}</div>
          <h3 className="gg-brand-spot__title"><GlitchGangText>{c.title}</GlitchGangText></h3>
          <p className="gg-brand-spot__sub"><GlitchGangText>{c.subtitle}</GlitchGangText></p>
          <p className="gg-brand-spot__desc">{c.description}</p>
          {c.ctaUrl ? (
            <a
              className="gg-btn gg-btn--primary gg-btn--md"
              href={c.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.cta}
            </a>
          ) : (
            <button type="button" className="gg-btn gg-btn--primary gg-btn--md" disabled>
              {c.cta}
            </button>
          )}
        </div>
      </div>
      <div className="gg-brand-spot__bar" />
    </motion.div>
  )
}

