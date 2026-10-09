import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import { PLACEMENT_COLOR, PLACEMENT_LABEL, titleSummary } from '../../lib/teamTitles.js'
import './TeamTitleShowcase.css'

const COUNT_LABEL = {
  1: ['título', 'títulos'],
  2: ['subcampeonato', 'subcampeonatos'],
  3: ['tercer lugar', 'terceros lugares'],
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const posterPath = title => `/torneos/${title.publicId || title.tournamentId}?tab=resumen#campeon`

// Vitrina de titulos del equipo: el ultimo campeonato destacado y el resto
// como trofeos (oro / plata / bronce). Cada uno lleva al poster del torneo.
// No se pinta nada si el equipo no tiene titulos.
export default function TeamTitleShowcase({ titles }) {
  if (!titles?.length) return null
  const { counts, latestChampionship: latest, latestHeadline } = titleSummary(titles)
  const rest = latest ? titles.filter(title => title !== latest) : titles

  return (
    <section className="gg-titles" aria-labelledby="gg-titles-heading">
      <header className="gg-titles__head">
        <span className="gg-titles__icon">{Icon.trophy}</span>
        <div>
          <p>Palmarés</p>
          <h2 id="gg-titles-heading">Vitrina de títulos</h2>
        </div>
        <ul className="gg-titles__counts">
          {[1, 2, 3].filter(p => counts[p]).map(p => (
            <li key={p} style={{ '--medal': PLACEMENT_COLOR[p] }}>
              <b>{counts[p]}</b> {COUNT_LABEL[p][counts[p] === 1 ? 0 : 1]}
            </li>
          ))}
        </ul>
      </header>

      {latest && (
        <Link className="gg-titles__feature" to={posterPath(latest)}
          style={latest.banner ? { '--banner': `url("${latest.banner}")` } : undefined}>
          <span className="gg-titles__feature-trophy">{Icon.trophy}</span>
          <span className="gg-titles__feature-body">
            <small>Último título</small>
            <strong>{latestHeadline}</strong>
            <span>{latest.tournamentTitle}</span>
            <em>{[latest.game, formatDate(latest.date)].filter(Boolean).join(' · ')}</em>
          </span>
          <span className="gg-titles__feature-go">Ver póster {Icon.chevronRight}</span>
        </Link>
      )}

      {rest.length > 0 && (
        <ol className="gg-titles__grid">
          {rest.map(title => (
            <li key={title.tournamentId}>
              <Link className="gg-titles__item" to={posterPath(title)} style={{ '--medal': PLACEMENT_COLOR[title.placement] }}>
                <span className="gg-titles__medal" aria-hidden="true">
                  {title.placement === 1 ? Icon.trophy : `${title.placement}º`}
                </span>
                <span className="gg-titles__item-body">
                  <b>{PLACEMENT_LABEL[title.placement]}</b>
                  <span>{title.tournamentTitle}</span>
                  <small>{[title.game, formatDate(title.date)].filter(Boolean).join(' · ')}</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

