import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import { FEATURED_ORGANIZERS, REGIONS } from '../../data/featuredOrganizers.js'
import './OrganizersDirectory.css'

const CATEGORIES = [
  { key: 'all', label: 'Todas', hint: 'Ligas y eventos' },
  { key: 'tournament-organizer', label: 'Torneos', hint: 'Competencias oficiales' },
  { key: 'event-organizer', label: 'Eventos', hint: 'Activaciones y showmatches' },
  { key: 'verified', label: 'Verificadas', hint: 'Organizaciones aprobadas' },
]

const SORTS = [
  { key: 'popular', label: 'Mas populares' },
  { key: 'tournaments', label: 'Mas torneos' },
  { key: 'news', label: 'Mas actividad' },
  { key: 'newest', label: 'Mas recientes' },
]

const parsePlayers = (value) => {
  const text = String(value || '').toLowerCase()
  const number = Number.parseFloat(text.replace(/[^\d.]/g, '')) || 0
  if (text.includes('k')) return number * 1000
  if (text.includes('m')) return number * 1000000
  return number
}

export default function OrganizersDirectory() {
  const navigate = useNavigate()
  const [region, setRegion] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('popular')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = FEATURED_ORGANIZERS.filter((o) => {
      const okRegion = region === 'all' || o.region === region
      const okCategory = category === 'all' || o.role === category || (category === 'verified' && o.verified)
      const okQuery = !q
        || o.name.toLowerCase().includes(q)
        || o.bio.toLowerCase().includes(q)
        || String(o.country).toLowerCase().includes(q)
      return okRegion && okCategory && okQuery
    })

    return [...filtered].sort((a, b) => {
      if (sort === 'tournaments') return Number(b.tournaments) - Number(a.tournaments)
      if (sort === 'news') return (b.news?.length || 0) - (a.news?.length || 0)
      if (sort === 'newest') return Number(b.founded || 0) - Number(a.founded || 0)
      return parsePlayers(b.players) - parsePlayers(a.players) || Number(b.tournaments) - Number(a.tournaments)
    })
  }, [region, category, sort, query])

  const popular = [...FEATURED_ORGANIZERS].sort((a, b) => parsePlayers(b.players) - parsePlayers(a.players))
  const featured = popular.slice(0, 5)
  const activeOrganizer = featured[active] || featured[0]
  const totalTournaments = FEATURED_ORGANIZERS.reduce((sum, o) => sum + Number(o.tournaments || 0), 0)
  const totalNews = FEATURED_ORGANIZERS.reduce((sum, o) => sum + (o.news?.length || 0), 0)
  const recentNews = FEATURED_ORGANIZERS.flatMap(o => (o.news || []).map(news => ({ ...news, organizer: o.name, color: o.color }))).slice(0, 5)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive(value => (value + 1) % Math.max(featured.length, 1))
    }, 5400)
    return () => window.clearInterval(timer)
  }, [featured.length])

  const previous = () => setActive(value => (value - 1 + featured.length) % featured.length)
  const next = () => setActive(value => (value + 1) % featured.length)

  return (
    <div className="gg-page gg-dir">
      <section className="gg-dir__hero">
        <div>
          <span className="gg-dir__pre">{Icon.crown} Directorio - RD - Caribe - LATAM</span>
          <h1>Organizaciones de esports</h1>
          <p>Empresas, ligas y creadores que sostienen torneos, eventos y noticias competitivas.</p>
        </div>
        <div className="gg-dir__metrics">
          <div><b>{FEATURED_ORGANIZERS.length}</b><span>organizaciones</span></div>
          <div><b>{totalTournaments}</b><span>torneos</span></div>
          <div><b>{totalNews}</b><span>noticias</span></div>
        </div>
      </section>

      <section className="gg-dir__experience">
        <div className="gg-dir__carousel">
          <OrganizerSlide organizer={activeOrganizer} active={active} onOpen={() => navigate(`/organizadores/${activeOrganizer.id}`)} />
          <div className="gg-dir__carousel-actions">
            <button type="button" onClick={previous} aria-label="Anterior">{Icon.chevronRight}</button>
            <button type="button" onClick={next} aria-label="Siguiente">{Icon.chevronRight}</button>
          </div>
          <div className="gg-dir__dots">
            {featured.map((organizer, index) => (
              <button
                key={organizer.id}
                type="button"
                className={index === active ? 'active' : ''}
                onClick={() => setActive(index)}
                aria-label={`Ver ${organizer.name}`}
              />
            ))}
          </div>
        </div>

        <aside className="gg-dir__panel">
          <div className="gg-dir__section-head">
            <span>{Icon.trend}</span>
            <div>
              <h2>Panel lateral</h2>
              <p>Rankings, actividad reciente y regiones.</p>
            </div>
          </div>
          <div className="gg-dir__panel-block">
            <h3>Mas populares</h3>
            {popular.slice(0, 4).map((o, index) => (
              <button key={o.id} type="button" className="gg-dir__mini" onClick={() => setActive(index)}>
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <img src={o.avatar} alt={o.name} />
                <span><b>{o.name}</b><small>{o.players} jugadores - {o.tournaments} torneos</small></span>
                {o.verified && <i>{Icon.check}</i>}
              </button>
            ))}
          </div>
          <div className="gg-dir__panel-block">
            <h3>Actividad</h3>
            {recentNews.slice(0, 3).map(item => (
              <button key={item.id} type="button" className="gg-dir__activity" style={{ '--oc': item.color || 'var(--accent)' }}>
                <b>{item.tag}</b>
                <span>{item.title}</span>
                <small>{item.organizer}</small>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="gg-dir__featured">
        <div className="gg-dir__section-head">
          <span>{Icon.award}</span>
          <div>
            <h2>Categorias</h2>
            <p>Filtra por tipo de organizacion, region y actividad.</p>
          </div>
        </div>
        <div className="gg-dir__categories" aria-label="Categorias de organizadores">
          {CATEGORIES.map(item => (
            <button key={item.key} type="button" className={category === item.key ? 'active' : ''} onClick={() => setCategory(item.key)}>
              <b>{item.label}</b>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="gg-dir__controls">
        <div className="gg-dir__toolbar">
          <div className="gg-dir__regions">
            {REGIONS.map(r => (
              <button key={r.key} className={`gg-dir__region${region === r.key ? ' active' : ''}`} onClick={() => setRegion(r.key)}>{r.label}</button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Ordenar organizadores">
            {SORTS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <label className="gg-dir__search">
            {Icon.search}
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar organizacion..." />
          </label>
        </div>
      </div>

      <div className="gg-dir__list-head">
        <h2>Directorio de organizadores</h2>
        <span>{list.length} resultados</span>
      </div>

      <div className="gg-dir__grid">
        {list.map((o, i) => (
          <motion.button
            key={o.id} className="gg-dir__card" style={{ '--oc': o.color || 'var(--accent)' }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/organizadores/${o.id}`)}
          >
            <RoleIdentityCorner role="organizer" profile={o} />
            <div className="gg-dir__card-top">
              <img src={o.avatar} alt={o.name} />
              <div className="gg-dir__card-id">
                <b>{o.name}{o.verified && <span className="gg-dir__verif">{Icon.check}</span>}</b>
                <small>{o.country} - {o.roleLabel} - desde {o.founded}</small>
              </div>
            </div>
            <p className="gg-dir__bio">{o.bio}</p>
            <div className="gg-dir__stats">
              <div><b>{o.tournaments}</b><span>torneos</span></div>
              <div><b>{o.players}</b><span>jugadores</span></div>
              <div><b>{o.news.length}</b><span>noticias</span></div>
            </div>
            <span className="gg-dir__view">Ver organizacion {Icon.chevronRight}</span>
          </motion.button>
        ))}
        {list.length === 0 && <div className="gg-dir__empty">{Icon.search}<p>No hay organizaciones con esos filtros.</p></div>}
      </div>
    </div>
  )
}

function OrganizerSlide({ organizer, active, onOpen }) {
  if (!organizer) return null

  return (
    <motion.article
      key={`${organizer.id}-${active}`}
      className="gg-dir__slide"
      style={{ '--oc': organizer.color || 'var(--accent)' }}
      initial={{ opacity: 0, x: 34, scale: .98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: .34, ease: 'easeOut' }}
    >
      <div className="gg-dir__slide-media">
        <img src={organizer.avatar} alt={organizer.name} />
        <span>{organizer.country}</span>
      </div>
      <div className="gg-dir__slide-copy">
        <small>{organizer.roleLabel} - desde {organizer.founded}</small>
        <h2>{organizer.name}</h2>
        <p>{organizer.bio}</p>
        <div>
          <b>{organizer.tournaments}</b><span>torneos</span>
          <b>{organizer.players}</b><span>jugadores</span>
        </div>
        <button type="button" onClick={onOpen}>Ver organizacion {Icon.chevronRight}</button>
      </div>
    </motion.article>
  )
}

