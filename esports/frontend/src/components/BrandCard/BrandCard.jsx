import { motion } from 'framer-motion'
import { safeHref } from '../../lib/safeUrl.js'
import './BrandCard.css'

const TIER_LABEL = { platinum: 'Platino', gold: 'Oro', silver: 'Plata' }

/**
 * BrandCard — professional logo card for the /marcas grid.
 * Props: sponsor (full sponsor object), delay (number)
 */
export default function BrandCard({ sponsor, delay = 0 }) {
  return (
    <motion.div
      className="gg-brand-card"
      style={{ '--bc': sponsor.color }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: .3 }}
    >
      <div className="gg-brand-card__logo">
        <span>{sponsor.logoInitials}</span>
      </div>
      <div className="gg-brand-card__body">
        {sponsor.code && <code className="gg-brand-card__code">{sponsor.code}</code>}
        <div className="gg-brand-card__name-row">
          <h3>{sponsor.name}</h3>
          <span className={`gg-brand-card__tier gg-brand-card__tier--${sponsor.tier}`}>
            {TIER_LABEL[sponsor.tier]}
          </span>
        </div>
        <p>{sponsor.tagline}</p>
        <a
          className="gg-brand-card__link"
          href={safeHref(sponsor.website)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          Abrir sitio web →
        </a>
      </div>
    </motion.div>
  )
}

