import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Badge from '../Badge/Badge.jsx'
import FilterTag from '../FilterTag/FilterTag.jsx'
import { Icon } from '../icons/Icons.jsx'
import './CommunityCard.css'

const fmtCount = (x) => {
  const n = Number(x) || 0
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}

export default function CommunityCard({ community, delay = 0, onTagClick }) {
  const navigate = useNavigate()
  const {
    slug, name, genre, description, tags,
    members, activePlayers, color, joined, poster,
  } = community

  const handleTagClick = (e, tag) => {
    e.stopPropagation()
    onTagClick?.(tag)
  }

  return (
    <motion.div
      className={`gg-community-card ${joined ? 'joined' : ''}`}
      style={{ '--cc': color }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={() => navigate(`/comunidad/${slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/comunidad/${slug}`)}
    >
      {/* Cover */}
      <div className="gg-cc__cover">
        {poster
          ? <img src={poster} alt={name} className="gg-cc__cover-img" loading="lazy" />
          : <div className="gg-cc__cover-grid" />
        }
        <div className="gg-cc__cover-overlay" />
        <div className="gg-cc__cover-glow" />
        {!poster && <span className="gg-cc__cover-letter">{name.charAt(0)}</span>}

        <span className="gg-cc__genre-badge">{genre}</span>
        {joined && <span className="gg-cc__joined-pill">{Icon.check} Unido</span>}
        {activePlayers > 0 && (
          <span className="gg-cc__active-pill">
            <span className="gg-cc__live-dot" />
            {fmtCount(activePlayers)} activos
          </span>
        )}

        {/* Overlay cinematográfico al pasar el mouse */}
        <div className="gg-cc__hover">
          <span className="gg-cc__enter">{Icon.play} Entrar</span>
        </div>
      </div>

      {/* Body */}
      <div className="gg-cc__body">
        <h3 className="gg-cc__name">{name}</h3>
        <p className="gg-cc__desc">{description}</p>

        {/* Clickable tags */}
        <div className="gg-cc__tags">
          {tags.slice(0, 3).map(t => (
            <button
              key={t}
              className="gg-cc__tag"
              onClick={e => handleTagClick(e, t)}
              title={`Filtrar por ${t}`}
            >
              {t}
            </button>
          ))}
          {tags.length > 3 && (
            <span className="gg-cc__more-tags">+{tags.length - 3}</span>
          )}
        </div>

        <div className="gg-cc__footer">
          <span className="gg-cc__members">{Icon.users} {fmtCount(members)} {Number(members) === 1 ? 'miembro' : 'miembros'}</span>
          <span className="gg-cc__arrow">{Icon.play}</span>
        </div>
      </div>
    </motion.div>
  )
}

