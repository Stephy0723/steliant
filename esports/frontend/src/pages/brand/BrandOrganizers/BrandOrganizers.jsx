import { isBetaHidden } from '../../../config/betaHidden.js'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api.js'
import { Icon } from '../../../components/icons/Icons.jsx'
import OrganizerStatCard from '../../../components/OrganizerStatCard/OrganizerStatCard.jsx'
import './BrandOrganizers.css'

const SORTS = [
  { id: 'prize', label: 'Mayor prize pool' },
  { id: 'teams', label: 'Mas equipos alcanzados' },
  { id: 'count', label: 'Mas torneos' },
]

export default function BrandOrganizers() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('prize')
  const [reputations, setReputations] = useState({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    // Mismo endpoint publico que ya usa /torneos -- solo torneos con
    // visibility:'public' (los privados de un organizador no entran en esta
    // cuenta, es una limitacion honesta, no un hueco escondido).
    api('/tournaments?limit=200')
      .then(data => { if (alive) setTournaments(Array.isArray(data?.tournaments) ? data.tournaments : []) })
      .catch(err => { if (alive) setError(err.message || 'No se pudo cargar la lista de torneos') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Reputacion real (rating 1-5 de equipos que jugaron un torneo suyo, ver
  // BACKEND-PENDIENTE.md #brand-organizador-reputacion) -- una sola llamada
  // bulk para todos los organizadores de la lista, no una por tarjeta.
  const organizerIds = useMemo(
    () => [...new Set(tournaments.map(t => t.organizer?._id || t.organizer?.id).filter(Boolean))],
    [tournaments],
  )
  useEffect(() => {
    if (!organizerIds.length) { setReputations({}); return }
    let alive = true
    api(`/organizers/reviews/summary?ids=${organizerIds.join(',')}`)
      .then(data => { if (alive) setReputations(data?.summaries || {}) })
      .catch(() => { if (alive) setReputations({}) })
    return () => { alive = false }
  }, [organizerIds])

  const organizers = useMemo(() => {
    const byId = new Map()
    for (const t of tournaments) {
      const org = t.organizer
      const id = org?._id || org?.id
      if (!id) continue
      if (!byId.has(id)) {
        byId.set(id, {
          organizer: {
            id,
            nick: org.nick || 'Organizador',
            avatar: org.avatar,
            organizerCode: org.roleProfiles?.organizer?.organizerCode,
          },
          tournaments: [],
        })
      }
      byId.get(id).tournaments.push(t)
    }
    let list = Array.from(byId.values())
    const term = query.trim().toLowerCase()
    if (term) list = list.filter(o => o.organizer.nick.toLowerCase().includes(term))
    const totalPrize = o => o.tournaments.reduce((sum, t) => sum + Number(t.prizePool || 0), 0)
    const totalTeams = o => o.tournaments.reduce((sum, t) => sum + Number(t.currentSlots || t.registrations?.length || 0), 0)
    list.sort((a, b) => {
      if (sort === 'teams') return totalTeams(b) - totalTeams(a)
      if (sort === 'count') return b.tournaments.length - a.tournaments.length
      return totalPrize(b) - totalPrize(a)
    })
    return list
  }, [tournaments, query, sort])

  return (
    <div className="brand-organizers">
      <header className="brand-organizers__head">
        <div>
          <h1>Organizadores</h1>
          <p>Elegi con quien patrocinar segun lo que de verdad han corrido: cantidad de torneos, prize pool repartido y equipos alcanzados en cada uno -- no solo cuantos torneos tienen encima.</p>
        </div>
      </header>

      <div className="brand-organizers__bar">
        <label className="brand-organizers__search">
          {Icon.search}
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar organizador por nick..." />
        </label>
        <div className="brand-organizers__sorts">
          {SORTS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`brand-organizers__sort${sort === s.id ? ' active' : ''}`}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="brand-organizers__hint">Cargando organizadores...</p>}
      {error && <p className="brand-organizers__hint brand-organizers__hint--error">{error}</p>}
      {!loading && !error && organizers.length === 0 && (
        <p className="brand-organizers__hint">No hay organizadores con torneos publicos todavia.</p>
      )}

      <div className="brand-organizers__grid">
        {organizers.map(({ organizer, tournaments: list }, index) => (
          <OrganizerStatCard
            key={organizer.id}
            organizer={organizer}
            tournaments={list}
            index={index}
            reputation={reputations[organizer.id]}
            onContact={isBetaHidden('/organizadores') ? undefined : () => navigate(`/organizadores/${organizer.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

