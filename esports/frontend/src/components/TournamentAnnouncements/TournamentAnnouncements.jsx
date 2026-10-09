import { useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import './TournamentAnnouncements.css'

// "Comunicados del torneo": los cambios confirmados que el organizador avisa
// desde el panel (pestana Competencia y las que reusen changeNotice). Salen de
// Tournament.announcements (GET /tournaments/:id), ultimos primero.
const PREVIEW = 3

function fmtDate(value, isEs) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(isEs ? 'es-DO' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TournamentAnnouncements({ announcements = [], isEs = true, compact = false, title = '' }) {
  const [showAll, setShowAll] = useState(false)
  const list = [...(Array.isArray(announcements) ? announcements : [])]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
  if (!list.length) return null
  const visible = showAll ? list : list.slice(0, PREVIEW)

  return (
    <section className={`gg-tannc${compact ? ' gg-tannc--compact' : ''}`}>
      <div className="gg-tannc__head">
        <h3>{Icon.bell} {title || (isEs ? 'Comunicados del torneo' : 'Tournament announcements')}</h3>
        <small>{list.length}</small>
      </div>
      <ol className="gg-tannc__list">
        {visible.map((item, index) => (
          <li key={`${item.at}-${index}`} className="gg-tannc__item">
            <div className="gg-tannc__meta">
              {item.sectionLabel && <span className="gg-tannc__tag">{item.sectionLabel}</span>}
              <time>{fmtDate(item.at, isEs)}</time>
              {item.byNick && <span>· {item.byNick}</span>}
            </div>
            <b className="gg-tannc__title">{item.title}</b>
            {Array.isArray(item.changes) && item.changes.length > 0 && (
              <ul className="gg-tannc__changes">
                {item.changes.map((change, i) => (
                  <li key={i}>
                    <span>{change.label}:</span> <s>{change.before}</s> <em>→</em> <strong>{change.after}</strong>
                  </li>
                ))}
              </ul>
            )}
            {item.message && <p className="gg-tannc__note">{item.message}</p>}
          </li>
        ))}
      </ol>
      {list.length > PREVIEW && (
        <button type="button" className="gg-tannc__more" onClick={() => setShowAll(v => !v)}>
          {showAll ? (isEs ? 'Ver menos' : 'Show less') : (isEs ? `Ver todos (${list.length})` : `Show all (${list.length})`)}
        </button>
      )}
    </section>
  )
}

