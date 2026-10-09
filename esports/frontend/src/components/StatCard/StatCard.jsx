import { motion } from 'framer-motion'
import './StatCard.css'

export default function StatCard({ label, value, trend, up, icon, delay = 0 }) {
  return (
    <motion.div
      className="gg-stat-card"
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:.35, delay }}
    >
      {icon && <div className="gg-stat-card__icon">{icon}</div>}
      <div className="gg-stat-card__body">
        <span className="gg-stat-card__label">{label}</span>
        <b className="gg-stat-card__value">{value}</b>
      </div>
      {trend && (
        <span className={`gg-stat-card__trend ${up ? 'up' : 'down'}`}>{trend}</span>
      )}
    </motion.div>
  )
}

