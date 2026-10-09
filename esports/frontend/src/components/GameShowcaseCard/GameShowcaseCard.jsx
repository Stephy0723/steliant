import { motion } from 'framer-motion'
import './GameShowcaseCard.css'

const ICONS = {
  val:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="20,4 36,28 4,28"/><line x1="20" y1="14" x2="20" y2="26" strokeWidth="3"/></svg>,
  lol:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="20,3 33,11 33,29 20,37 7,29 7,11"/><polygon points="20,12 27,16 27,24 20,28 13,24 13,16" opacity=".45" strokeWidth="1.2"/></svg>,
  cs2:  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="4" fill="currentColor" strokeWidth="0"/><line x1="20" y1="6" x2="20" y2="15"/><line x1="20" y1="25" x2="20" y2="34"/><line x1="6" y1="20" x2="15" y2="20"/><line x1="25" y1="20" x2="34" y2="20"/></svg>,
  apex: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="20,4 36,34 4,34"/><polygon points="20,14 28,30 12,30" fill="currentColor" strokeWidth="0" opacity=".3"/></svg>,
  rl:   <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><path d="M6 20 Q20 7 34 20 Q20 33 6 20" fill="currentColor" strokeWidth="0" opacity=".22"/><circle cx="20" cy="20" r="4" fill="currentColor" strokeWidth="0"/></svg>,
  ff:   <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="20,4 34,14 34,26 20,36 6,26 6,14"/><line x1="20" y1="13" x2="20" y2="27" strokeWidth="3"/><line x1="13" y1="20" x2="27" y2="20" strokeWidth="3"/></svg>,
  mlbb: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="20" cy="20" r="14"/><path d="M12 26 L20 10 L28 26" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/><line x1="14" y1="22" x2="26" y2="22" strokeWidth="2.5"/></svg>,
  dota: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 4 L34 30 Q20 38 6 30 Z"/><circle cx="20" cy="19" r="5" fill="currentColor" strokeWidth="0"/></svg>,
}

export default function GameShowcaseCard({ game, onTag, onClick }) {
  return (
    <article
      className="gsc-card"
      style={{ '--gc': game.color, '--gcb': game.colorB }}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      role="button"
      aria-label={`Ir a comunidad de ${game.name}`}
    >
      {/* Cover with real image */}
      <div className="gsc-cover">
        {game.image
          ? <img src={game.image} alt={game.name} className="gsc-img" loading="lazy" />
          : <div className="gsc-cover__art" />
        }
        {/* Overlays */}
        <div className="gsc-cover__vignette" />
        <div className="gsc-cover__bottom-grad" />

        {/* Genre pill */}
        <span className="gsc-genre">{game.genre}</span>

        {/* Icon centered — colored */}
        <div className="gsc-icon-wrap" style={{ color: game.color }}>
          {ICONS[game.id] || ICONS.val}
        </div>

        {/* Live badge */}
        <div className="gsc-live">
          <span className="gsc-dot" />
          <span>{game.active} activos</span>
        </div>
      </div>

      {/* Body */}
      <div className="gsc-body">
        <div className="gsc-titleblock">
          <h3 className="gsc-name">{game.name}</h3>
          {game.company && <p className="gsc-company">{game.company}</p>}
        </div>
        <p className="gsc-desc">{game.description}</p>

        <div className="gsc-tags">
          {(game.tags || []).map(tag => (
            <button
              key={tag}
              className="gsc-tag"
              onClick={e => { e.stopPropagation(); onTag?.(tag) }}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="gsc-footer">
          <span className="gsc-players">{game.players} jugadores globales</span>
          <span className="gsc-cta">
            Explorar
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </span>
        </div>
      </div>
    </article>
  )
}

