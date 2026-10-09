import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import CreatorCard from '../../components/CreatorCard/CreatorCard.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { GAMES } from '../../data/games.js'
import './CreatorsDirectory.css'

const PLATFORMS = [
  { key: 'all', label: 'Todos' },
  { key: 'twitch', label: 'Twitch' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
]

const CATEGORIES = [
  { key: 'all', label: 'Todas', hint: 'Todo el contenido' },
  { key: 'fps', label: 'FPS', hint: 'Valorant, CS2, Apex' },
  { key: 'moba', label: 'MOBA', hint: 'LoL y Mobile' },
  { key: 'coaching', label: 'Guias', hint: 'Tips y analisis' },
]

const SORTS = [
  { key: 'reciente', label: 'Mas recientes' },
  { key: 'conectados', label: 'Con redes conectadas' },
]

function firstConnectedPlatform(socials) {
  if (!socials) return null
  for (const platform of ['twitch', 'youtube', 'tiktok', 'instagram']) {
    if (socials[platform]?.connected) return platform
  }
  return null
}

function creatorCategory(creator) {
  const haystack = `${(creator.games || []).join(' ')} ${creator.bio || ''}`.toLowerCase()
  const categories = []
  if (haystack.includes('valorant') || haystack.includes('cs2') || haystack.includes('apex')) categories.push('fps')
  if (haystack.includes('league') || haystack.includes('lol') || haystack.includes('mobile')) categories.push('moba')
  if (haystack.includes('guia') || haystack.includes('coach') || haystack.includes('analisis')) categories.push('coaching')
  return categories.length ? categories : ['all']
}

function getGameName(id) {
  return GAMES.find(g => g.id === id)?.name || id
}

// Directorio real de usuarios con role:'creator' (GET /users/creators, sin
// filtro = todos). Antes esta página mostraba 4 creadores 100% inventados
// con seguidores y estado "en vivo" falsos -- esos datos no existen en la
// app (no hay tracking real de audiencia por plataforma), así que el
// carrusel/panel de Stephanie se conservan pero sin esas métricas: solo se
// muestra lo real (nick, avatar, bio, red social conectada de verdad, juegos).
export default function CreatorsDirectory() {
  const [creatorsRaw, setCreatorsRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('reciente')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    let cancelled = false
    api('/users/creators')
      .then(d => { if (!cancelled) setCreatorsRaw(Array.isArray(d.creators) ? d.creators : []) })
      .catch(() => { if (!cancelled) setCreatorsRaw([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const activeGames = useMemo(() => {
    const ids = new Set(creatorsRaw.flatMap(c => c.games || []))
    return GAMES.filter(g => ids.has(g.id))
  }, [creatorsRaw])

  const creators = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = creatorsRaw.filter((creator) => {
      const okPlatform = platform === 'all' || firstConnectedPlatform(creator.socials) === platform
      const okCategory = category === 'all' || creatorCategory(creator).includes(category)
      const okQuery = !q
        || creator.nick.toLowerCase().includes(q)
        || (creator.bio || '').toLowerCase().includes(q)
        || (creator.games || []).some(g => getGameName(g).toLowerCase().includes(q))
      return okPlatform && okCategory && okQuery
    })

    if (sort === 'conectados') {
      return [...filtered].sort((a, b) => Number(!!firstConnectedPlatform(b.socials)) - Number(!!firstConnectedPlatform(a.socials)))
    }
    return filtered
  }, [creatorsRaw, platform, category, sort, query])

  const connectedCount = useMemo(() => creatorsRaw.filter(c => firstConnectedPlatform(c.socials)).length, [creatorsRaw])
  const featured = creatorsRaw.slice(0, 5)
  const activeCreator = featured[active] || featured[0]

  useEffect(() => {
    if (!featured.length) return undefined
    const timer = window.setInterval(() => {
      setActive(value => (value + 1) % Math.max(featured.length, 1))
    }, 5200)
    return () => window.clearInterval(timer)
  }, [featured.length])

  const previous = () => setActive(value => (value - 1 + featured.length) % featured.length)
  const next = () => setActive(value => (value + 1) % featured.length)

  return (
    <div className="gg-page gg-creators-dir">
      <section className="gg-creators-dir__hero">
        <div>
          <span className="gg-creators-dir__pre">{Icon.camera} Creadores</span>
          <h1>Creadores de contenido de GlitchGang</h1>
          <p>Jugadores con el rol de Creador, con sus redes reales conectadas.</p>
        </div>
        <div className="gg-creators-dir__metrics">
          <div><b>{creatorsRaw.length}</b><span>creadores</span></div>
          <div><b>{connectedCount}</b><span>con redes</span></div>
          <div><b>{activeGames.length}</b><span>juegos</span></div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="gg-creators-dir__experience">
          <div className="gg-creators-dir__carousel">
            <CreatorSlide creator={activeCreator} active={active} />
            <div className="gg-creators-dir__carousel-actions">
              <button type="button" onClick={previous} aria-label="Anterior">{Icon.chevronRight}</button>
              <button type="button" onClick={next} aria-label="Siguiente">{Icon.chevronRight}</button>
            </div>
            <div className="gg-creators-dir__dots">
              {featured.map((creator, index) => (
                <button
                  key={creator.id}
                  type="button"
                  className={index === active ? 'active' : ''}
                  onClick={() => setActive(index)}
                  aria-label={`Ver ${creator.nick}`}
                />
              ))}
            </div>
          </div>

          <aside className="gg-creators-dir__panel">
            <div className="gg-creators-dir__section-head">
              <span>{Icon.trend}</span>
              <div>
                <h2>Panel lateral</h2>
                <p>Creadores destacados y juegos activos.</p>
              </div>
            </div>
            <div className="gg-creators-dir__panel-block">
              <h3>Creadores</h3>
              {featured.map((creator, index) => (
                <button key={creator.id} type="button" className="gg-creators-dir__mini" onClick={() => setActive(index)}>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <img src={creator.avatar || '/demos/steliant-esports/avatar-default.svg'} alt={creator.nick} />
                  <span><b>{creator.nick}</b><small>{(creator.games || []).map(getGameName).join(', ') || 'Sin juegos'}</small></span>
                </button>
              ))}
            </div>
            {activeGames.length > 0 && (
              <div className="gg-creators-dir__panel-block">
                <h3>Juegos activos</h3>
                <div className="gg-creators-dir__chips">
                  {activeGames.slice(0, 6).map(g => <button key={g.id} type="button" onClick={() => setQuery(g.name)}>{g.name}</button>)}
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      <section className="gg-creators-dir__featured">
        <div className="gg-creators-dir__section-head">
          <span>{Icon.award}</span>
          <div>
            <h2>Categorias</h2>
            <p>Filtra el contenido por formato o juego.</p>
          </div>
        </div>
        <div className="gg-creators-dir__categories" aria-label="Categorias">
          {CATEGORIES.map(item => (
            <button key={item.key} type="button" className={category === item.key ? 'active' : ''} onClick={() => setCategory(item.key)}>
              <b>{item.label}</b>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="gg-creators-dir__controls">
        <div className="gg-creators-dir__toolbar">
          <div className="gg-creators-dir__tabs">
            {PLATFORMS.map(item => (
              <button key={item.key} type="button" className={platform === item.key ? 'active' : ''} onClick={() => setPlatform(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Ordenar creadores">
            {SORTS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <label className="gg-creators-dir__search">
            {Icon.search}
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar creador o juego..." />
          </label>
        </div>
      </div>

      <div className="gg-creators-dir__list-head">
        <h2>Directorio de creadores</h2>
        <span>{creators.length} resultados</span>
      </div>

      <div className="gg-creators-dir__grid">
        {loading ? (
          <p className="gg-creators-dir__hint">Cargando…</p>
        ) : creators.length > 0 ? (
          creators.map((creator, index) => (
            <CreatorCard key={creator.id} creator={creator} delay={index * 0.04} />
          ))
        ) : (
          <motion.div className="gg-creators-dir__empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {Icon.search}
            <p>{creatorsRaw.length === 0 ? 'Todavía no hay creadores destacados.' : 'No hay creadores con ese filtro.'}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function CreatorSlide({ creator, active }) {
  if (!creator) return null
  const social = firstConnectedPlatform(creator.socials)

  return (
    <motion.article
      key={`${creator.id}-${active}`}
      className="gg-creators-dir__slide"
      initial={{ opacity: 0, x: 34, scale: .98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: .34, ease: 'easeOut' }}
    >
      <div className="gg-creators-dir__slide-media">
        <img src={creator.avatar || '/demos/steliant-esports/avatar-default.svg'} alt={creator.nick} />
      </div>
      <div className="gg-creators-dir__slide-copy">
        <small>{social ? `${social} · ${creator.socials[social].username || creator.nick}` : 'Sin red conectada'}</small>
        <h2>{creator.nick}</h2>
        <p>{creator.bio || 'Sin biografía todavía.'}</p>
        <div>
          <b>{(creator.games || []).map(getGameName).join(', ') || '—'}</b><span>juegos</span>
        </div>
      </div>
    </motion.article>
  )
}

