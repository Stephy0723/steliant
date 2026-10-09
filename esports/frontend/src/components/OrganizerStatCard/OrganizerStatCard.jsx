import { useRef, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import '../GGTeamCard/GGTeamCard.css'
import './OrganizerStatCard.css'

function initialsFor(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || 'GG'
}

function fmtDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(value) {
  const n = Number(value || 0)
  if (!n) return '$0'
  return `$${n.toLocaleString('es-DO')}`
}

// Resenas reales de equipos que jugaron un torneo de este organizador (ver
// BACKEND-PENDIENTE.md #brand-organizador-reputacion) -- solo se muestra si
// ya tiene al menos una, para no mostrar "0.0 estrellas" como si fuera mala
// reputacion en vez de simplemente "todavia nadie califico".
function StarRating({ average = 0, count = 0 }) {
  if (!count) return null
  const rounded = Math.round(average)
  return (
    <div className="gg-osc__rating" title={`${average.toFixed(1)} de 5 · ${count} reseña${count === 1 ? '' : 's'}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= rounded ? 'gg-osc__star gg-osc__star--on' : 'gg-osc__star'}>{Icon.star}</span>
      ))}
      <b>{average.toFixed(1)}</b>
      <span className="gg-osc__rating-count">({count})</span>
    </div>
  )
}

/**
 * Ficha de organizador para el Centro de Marcas -- misma familia visual
 * puntiaguda que GGTeamCard (cresta con esquina cortada, glow, sheen, rail),
 * pero con contenido propio de organizador: torneos reales corridos, con
 * "ver mas" mostrando el detalle torneo por torneo (fecha, equipos, prize
 * pool) en vez de un promedio -- asi se distingue un organizador de 3
 * torneos de 32 equipos de otro con 20 torneos de 8 personas cada uno.
 */
export default function OrganizerStatCard({ organizer, tournaments = [], index = 0, onContact, reputation }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)

  const count = tournaments.length
  const totalPrize = tournaments.reduce((sum, t) => sum + Number(t.prizePool || 0), 0)
  const totalTeams = tournaments.reduce((sum, t) => sum + Number(t.currentSlots || t.registrations?.length || 0), 0)
  const biggestTeams = tournaments.reduce((max, t) => Math.max(max, Number(t.currentSlots || t.registrations?.length || 0)), 0)
  const games = [...new Set(tournaments.map(t => t.game).filter(Boolean))]

  const onMove = (event) => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
    el.style.transform = `translateY(-5px) rotateY(${(px - 0.5) * 9}deg) rotateX(${(0.5 - py) * 7}deg)`
  }
  const onLeave = () => { if (ref.current) ref.current.style.transform = '' }

  return (
    <div className="gg-tc-wrap gg-tc-wrap--vertical" style={{ '--i': index }}>
      <article
        ref={ref}
        className="gg-tc gg-tc--vertical gg-osc"
        style={{ '--t': '#F0A500', '--tbg': '#F0A500' }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div className="gg-tc__rail" />
        <div className="gg-tc__glow" />
        <div className="gg-tc__mesh" />
        <div className="gg-tc__spec" />
        <div className="gg-tc__sheen" />

        <div className="gg-tc__body">
          <div className="gg-tc__hd">
            <div className="gg-tc__crest">
              {organizer.avatar ? <img src={organizer.avatar} alt="" /> : initialsFor(organizer.nick)}
            </div>
            <div className="gg-tc__codes">
              {organizer.organizerCode && <span className="gg-tc__code">{organizer.organizerCode}</span>}
            </div>
          </div>

          <div className="gg-tc__name">
            <h3>{organizer.nick}</h3>
          </div>

          <StarRating average={reputation?.average || 0} count={reputation?.count || 0} />

          <div className="gg-tc__meta">
            <span>{games.length ? games.slice(0, 3).join(' / ') : 'Sin categoria'}</span>
            {games.length > 3 && <><i /><em>+{games.length - 3}</em></>}
          </div>

          <div className="gg-osc__stats">
            <div className="gg-osc__stat">
              <span>Torneos publicos</span>
              <b>{count}</b>
            </div>
            <div className="gg-osc__stat">
              <span>Prize pool total</span>
              <b>{fmtMoney(totalPrize)}</b>
            </div>
            <div className="gg-osc__stat">
              <span>Equipos alcanzados</span>
              <b>{totalTeams}</b>
            </div>
            <div className="gg-osc__stat">
              <span>Torneo mas grande</span>
              <b>{biggestTeams} equipos</b>
            </div>
          </div>

          <div className={`gg-tc__panel${open ? ' open' : ''}`}>
            <div>
              {tournaments.slice(0, 10).map((t, n) => (
                <div className="gg-tc__rrow gg-osc__row" key={t._id || t.publicId || n} style={{ '--n': n }}>
                  <b>{t.title}</b>
                  <span>{fmtDate(t.date)} · {t.currentSlots || t.registrations?.length || 0} equipos{t.prizePool ? ` · ${fmtMoney(t.prizePool)}` : ''}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="gg-tc__foot">
            <span className="gg-tc__members">
              {count === 0 ? 'Sin torneos publicos todavia' : `Mostrando ${Math.min(count, 10)} de ${count}`}
            </span>
            <div className="gg-tc__acts">
              <button type="button" className="gg-tc__btn" onClick={() => setOpen(v => !v)} disabled={!count}>
                {open ? 'Ver menos' : 'Ver mas'}
                <span className={`chev${open ? ' up' : ''}`}>{Icon.chevronRight}</span>
              </button>
              {onContact && (
                <button type="button" className="gg-tc__btn gg-tc__btn--go" onClick={() => onContact(organizer)}>
                  Contactar
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

