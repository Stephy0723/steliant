import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Badge from '../Badge/Badge.jsx'
import { Icon } from '../icons/Icons.jsx'
import { GlitchGangText } from '../GlitchText/GlitchText.jsx'
import './ScholarshipCard.css'

const TYPE_LABEL = { full: 'Beca completa', partial: 'Beca parcial', equipment: 'Equipamiento' }
const TYPE_VARIANT = { full: 'pro', partial: 'live', equipment: 'muted' }

/**
 * ScholarshipCard — card for a scholarship/opportunity.
 * Props: scholarship (object from university.js), delay (number)
 */
export default function ScholarshipCard({ scholarship: s, delay = 0 }) {
  const navigate = useNavigate()
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(s.deadline) - new Date()) / (1000 * 60 * 60 * 24)
  ))

  return (
    <motion.div
      className="gg-scholarship"
      style={{ '--sc': s.uniColor }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: .3 }}
    >
      {/* Header */}
      <div className="gg-scholarship__head">
        <div className="gg-scholarship__logo" style={{ background: s.uniColor }}>
          {s.uniAcronym}
        </div>
        <div className="gg-scholarship__badges">
          <Badge variant={TYPE_VARIANT[s.type]}>{TYPE_LABEL[s.type]}</Badge>
          <Badge variant="muted">{s.game}</Badge>
        </div>
      </div>

      {/* Title & uni */}
      <h3 className="gg-scholarship__title"><GlitchGangText>{s.title}</GlitchGangText></h3>
      <p className="gg-scholarship__uni">{s.university}</p>
      <p className="gg-scholarship__desc">{s.description}</p>

      {/* Amount */}
      <div className="gg-scholarship__amount">
        {Icon.star}
        <span>{s.amount}</span>
      </div>

      {/* Requirements (collapsed to 3) */}
      <ul className="gg-scholarship__reqs">
        {s.requirements.slice(0, 3).map((r, i) => (
          <li key={i}>{Icon.check} {r}</li>
        ))}
        {s.requirements.length > 3 && (
          <li className="more">+{s.requirements.length - 3} más requisitos</li>
        )}
      </ul>

      {/* Footer */}
      <div className="gg-scholarship__footer">
        <div className="gg-scholarship__deadline">
          <span className={`gg-scholarship__days ${daysLeft <= 14 ? 'urgent' : ''}`}>
            {daysLeft > 0 ? `${daysLeft}d restantes` : 'Plazo vencido'}
          </span>
          <span className="gg-scholarship__slots">{s.available} plazas</span>
        </div>
        <button
          className="gg-btn gg-btn--primary gg-btn--sm"
          onClick={() => navigate('/universidad')}
          disabled={daysLeft === 0}
        >
          Solicitar
        </button>
      </div>

      <div className="gg-scholarship__bar" />
    </motion.div>
  )
}

