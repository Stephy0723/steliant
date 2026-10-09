import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import './ChampionPoster.css'
import './poster-console.css'

// Poster de campeon del torneo (TorneoDetalle, torneo finalizado). Es parte
// de la pagina, no una imagen: cada equipo lleva a su pagina
// (/equipos/:teamId) y "Historial competitivo" a su seccion de torneos
// (#historial). "Sacar imagen" es un extra para compartir.
// Recibe lo que arma lib/championPoster.js; cada bloque se pinta solo si
// tiene datos. El diseño visual final esta pendiente: todo el color sale de
// variables en .gg-cp (ver ChampionPoster.css).

function initialsOf(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const teamPath = (key, hash = '') => `/equipos/${encodeURIComponent(key)}${hash}`

// Nombre/escudo de un equipo: enlace a su pagina si se conoce, texto si no.
function TeamLink({ teamKey, hash, className = '', title, children }) {
  if (!teamKey) return <span className={className}>{children}</span>
  return (
    <Link to={teamPath(teamKey, hash)} className={`gg-cp__link ${className}`} title={title}>
      {children}
    </Link>
  )
}

function TeamMark({ team, size = 'md' }) {
  return (
    <span className={`gg-cp__mark gg-cp__mark--${size}`}>
      {team.logo ? <img src={team.logo} alt="" /> : <b>{initialsOf(team.name)}</b>}
    </span>
  )
}

function PathList({ path }) {
  if (!path.length) return null
  return (
    <ol className="gg-cp__path">
      {path.map(step => (
        <li key={step.id}>
          <span className="gg-cp__path-round">{step.round}</span>
          <span className="gg-cp__path-vs">
            vs <TeamLink teamKey={step.opponentKey} title={`Ver ${step.opponent}`}><b>{step.opponent}</b></TeamLink>
          </span>
          <span className={`gg-cp__path-res ${step.won ? 'is-win' : 'is-loss'}`}>
            {step.won ? Icon.check : Icon.x}
            {step.score ? `${step.score[0]}-${step.score[1]}` : step.won ? 'Ganó' : 'Perdió'}
          </span>
        </li>
      ))}
    </ol>
  )
}

// Lista "A · B · C" con cada equipo enlazado.
function TeamList({ teams }) {
  return teams.map((team, index) => (
    <span key={`${team.name}-${index}`}>
      {index > 0 && ' · '}
      <TeamLink teamKey={team.pageKey}>{team.name}</TeamLink>
    </span>
  ))
}

function statsLine({ series, wins, games }) {
  const parts = [`${series} ${series === 1 ? 'serie' : 'series'}`, `${wins} ${wins === 1 ? 'victoria' : 'victorias'}`]
  if (games) parts.push(`${games[0]}-${games[1]} en juegos`)
  return parts.join(' · ')
}

function slug(text) {
  return String(text || 'campeon').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Lo marcado con .gg-cp__hint (pistas "Ver equipo", enlaces de historial)
// sirve en la web pero no tiene sentido en la imagen.
const skipHints = (node) => !node.classList?.contains('gg-cp__hint')

async function renderPng(node) {
  const { toBlob } = await import('html-to-image')
  const opts = { pixelRatio: 2, cacheBust: true, filter: skipHints }
  try {
    return await toBlob(node, opts)
  } catch {
    // Fuentes/imagenes de otro origen pueden romper el embebido: reintenta sin fuentes.
    return toBlob(node, { ...opts, skipFonts: true })
  }
}

export default function ChampionPoster({ poster, tournament, onViewBracket }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  if (!poster) return null
  const { champion, runnerUp, final, thirdPlace, titles, editions, headline, sponsors } = poster
  const edition = [tournament.seasonName, tournament.seasonNumber > 1 ? `Edición ${tournament.seasonNumber}` : ''].filter(Boolean).join(' · ')
  const lead = titles > 1
    ? `${champion.name} vuelve a ganar ${tournament.title}${editions ? ` y suma ${titles} de ${editions} ediciones` : ''}.`
    : `${champion.name} se corona en ${tournament.title}.`
  const runnerWins = runnerUp.path.filter(p => p.won)

  // Un solo boton: en el movil abre el menu de compartir con la imagen; donde
  // no se puede compartir un archivo, la descarga.
  const takeImage = async () => {
    setBusy(true); setNotice('')
    try {
      const blob = await renderPng(ref.current)
      const fileName = `${slug(tournament.title)}-${slug(champion.name)}.png`
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: tournament.title,
          text: `🏆 ${champion.name} — ${headline} de ${tournament.title}\n${window.location.href.split('#')[0]}`,
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
        setNotice('Imagen descargada.')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setNotice('No se pudo generar la imagen. Intenta de nuevo.')
    } finally { setBusy(false) }
  }

  return (
    <section className="gg-cp-wrap" id="campeon">
      <div className="gg-cp-frame">
        <div
          ref={ref}
          className="gg-cp"
          style={{ '--cp-champ': champion.color || tournament.color || undefined, '--cp-runner': runnerUp.color || undefined }}
        >
          <header className="gg-cp__top">
            <span className="gg-cp__brand">
              {tournament.organizerLogo && <img src={tournament.organizerLogo} alt="" />}
              {tournament.organizer}
            </span>
            {tournament.game && <span className="gg-cp__game">{tournament.game}</span>}
          </header>

          <p className="gg-cp__eyebrow">{[tournament.title, edition].filter(Boolean).join(' · ')}</p>
          {/* --hl-chars: el CSS achica el titular para que "Tetracampeón" quepa igual que "Campeón". */}
          <h2 className="gg-cp__headline" style={{ '--hl-chars': headline.length }}>{headline}</h2>

          <div className="gg-cp__hero">
            <div className="gg-cp__hero-text">
              <p className="gg-cp__lead">{lead}</p>
              <h3 className="gg-cp__champ-name">
                <TeamLink teamKey={champion.pageKey} title={`Ver ${champion.name}`}>{champion.name}</TeamLink>
              </h3>
              <p className="gg-cp__champ-meta">
                {champion.tag && <span className="gg-cp__tag">{champion.tag}</span>}
                {Icon.trophy} Campeón · {statsLine(champion.stats)}
              </p>
              {champion.path.length > 0 && (
                <>
                  <h4 className="gg-cp__label">El camino a la final</h4>
                  <PathList path={champion.path} />
                </>
              )}
              {champion.pageKey && (
                <Link className="gg-cp__more gg-cp__hint" to={teamPath(champion.pageKey, '#historial')}>
                  Ver historial competitivo {Icon.chevronRight}
                </Link>
              )}
            </div>
            <div className="gg-cp__crest">
              <TeamLink teamKey={champion.pageKey} className="gg-cp__crest-link" title={`Ir a la página de ${champion.name}`}>
                <TeamMark team={champion} size="xl" />
                {champion.pageKey && <span className="gg-cp__crest-hint gg-cp__hint">{Icon.team} Ver equipo</span>}
              </TeamLink>
              {titles > 1 && (
                <span className="gg-cp__titles">
                  <b>{editions ? `${titles} de ${editions}` : `×${titles}`}</b>
                  <small>{editions ? 'ediciones ganadas' : 'títulos'}</small>
                </span>
              )}
            </div>
          </div>

          <div className="gg-cp__final">
            <TeamLink teamKey={champion.pageKey} className="gg-cp__final-team">
              <TeamMark team={champion} />
              <span><small>Campeón{champion.tag ? ` · ${champion.tag}` : ''}</small><b>{champion.name}</b></span>
            </TeamLink>
            <div className="gg-cp__final-score">
              <small>{final.round}</small>
              <b>{final.score ? `${final.score[0]} - ${final.score[1]}` : 'Ganó'}</b>
              {final.bestOf && <small>{final.bestOf === 1 ? 'Partida única' : `Al mejor de ${final.bestOf}`}</small>}
            </div>
            <TeamLink teamKey={runnerUp.pageKey} className="gg-cp__final-team gg-cp__final-team--right">
              <span><small>Subcampeón{runnerUp.tag ? ` · ${runnerUp.tag}` : ''}</small><b>{runnerUp.name}</b></span>
              <TeamMark team={runnerUp} />
            </TeamLink>
          </div>

          <div className="gg-cp__runner">
            <TeamLink teamKey={runnerUp.pageKey} title={`Ver ${runnerUp.name}`}>
              <TeamMark team={runnerUp} size="lg" />
            </TeamLink>
            <div>
              <small className="gg-cp__label">{Icon.award} Subcampeón · Finalista</small>
              <b><TeamLink teamKey={runnerUp.pageKey}>{runnerUp.name}</TeamLink></b>
              {runnerWins.length > 0 && (
                <p>
                  Llegó a la final ganando {runnerWins.length} {runnerWins.length === 1 ? 'serie' : 'series'}:{' '}
                  <TeamList teams={runnerWins.map(p => ({ name: p.opponent, pageKey: p.opponentKey }))} />
                </p>
              )}
              {thirdPlace.length > 0 && <p className="gg-cp__third">3.er lugar: <TeamList teams={thirdPlace} /></p>}
              {runnerUp.pageKey && (
                <Link className="gg-cp__more gg-cp__hint" to={teamPath(runnerUp.pageKey, '#historial')}>
                  Historial competitivo {Icon.chevronRight}
                </Link>
              )}
            </div>
          </div>

          <footer className="gg-cp__foot">
            {sponsors.length > 0 && (
              <div className="gg-cp__sponsors">
                <small>Patrocinan</small>
                {sponsors.slice(0, 4).map((s, i) => (
                  <span key={`${s.name}-${i}`}>
                    {s.logo ? <img src={s.logo} alt={s.name || ''} /> : s.name}
                  </span>
                ))}
              </div>
            )}
            <span className="gg-cp__site">glitchgang.gg</span>
          </footer>
        </div>
      </div>

      <div className="gg-cp-actions">
        {champion.pageKey && (
          <Link className="is-primary" to={teamPath(champion.pageKey)}>{Icon.team} Página del campeón</Link>
        )}
        {champion.pageKey && (
          <Link to={teamPath(champion.pageKey, '#historial')}>{Icon.trophy} Historial competitivo</Link>
        )}
        {onViewBracket && (
          <button type="button" onClick={onViewBracket}>{Icon.layers} Ver llave completa</button>
        )}
        <button type="button" onClick={takeImage} disabled={busy}>
          {Icon.camera} {busy ? 'Generando…' : 'Sacar imagen'}
        </button>
      </div>
      {notice && <p className="gg-cp-error">{notice}</p>}
    </section>
  )
}

