import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Badge from '../Badge/Badge.jsx'
import { Icon } from '../icons/Icons.jsx'
import './UniCard.css'

/**
 * UniCard — grid card for a university.
 * Props: uni (university object), delay (number), onClick
 */
export default function UniCard({ uni, delay = 0, onClick }) {
  const navigate = useNavigate()

  return (
    <motion.div
      className={`gg-uni-card ${uni.userUniversity ? 'mine' : ''}`}
      style={{ '--uc': uni.color, '--uc-accent': uni.accentColor }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: .28 }}
      onClick={onClick || (() => navigate(`/universidad/${uni.id}`))}
    >
      {/* Banner gradient top */}
      <div className="gg-uni-card__banner" />

      {/* Logo */}
      <div className="gg-uni-card__logo" style={{ background: uni.color }}>
        {uni.logo
          ? <img src={uni.logo} alt={uni.acronym} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
          : uni.acronym
        }
      </div>

      {/* Badges */}
      <div className="gg-uni-card__badges">
        {uni.userUniversity && <Badge variant="pro">Mi universidad</Badge>}
        {uni.verified && <Badge variant="live">Verificada</Badge>}
      </div>

      {/* Name */}
      <h3 className="gg-uni-card__name">{uni.name}</h3>
      <p className="gg-uni-card__city">{uni.city}, {uni.country}</p>

      {/* Stats row */}
      <div className="gg-uni-card__stats">
        <div className="gg-uni-card__stat">
          <span>{uni.teams}</span>
          <small>Equipos</small>
        </div>
        <div className="gg-uni-card__stat">
          <span>{uni.players}</span>
          <small>Jugadores</small>
        </div>
        <div className="gg-uni-card__stat">
          <span>{uni.rank ? `#${uni.rank}` : '—'}</span>
          <small>Ranking</small>
        </div>
      </div>

      <div className="gg-uni-card__bar" />
    </motion.div>
  )
}

