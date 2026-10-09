import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PromoModal from '../../components/PromoModal/PromoModal.jsx'
import CommunityCard from '../../components/CommunityCard/CommunityCard.jsx'
import CommunityShowcase from '../../components/CommunityShowcase/CommunityShowcase.jsx'
import GameShowcaseCard from '../../components/GameShowcaseCard/GameShowcaseCard.jsx'
import FilterTag from '../../components/FilterTag/FilterTag.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { COMMUNITY_TAGS, getAllCommunities, withRemoteCommunity } from '../../data/communities.js'
import { listAllCommunities } from '../../lib/communitiesApi.js'
import { GAMES, GAME_CATEGORIES as CANONICAL_CATEGORIES } from '../../data/games.js'
import { api } from '../../lib/api.js'
import { syncTicketToMessenger } from '../../lib/ticketMessengerBridge.js'
import { toast } from '../../lib/toast.js'
import './Community.css'

// ── Constants ──────────────────────────────────────────────────
const SECTIONS = [
  { id: 'hub',         label: 'Hub General' },
  { id: 'juegos',      label: 'Juegos' },
  { id: 'comunidades', label: 'Comunidades' },
]

const GAME_CATEGORIES = ['Todos', ...CANONICAL_CATEGORIES.map(c => c.name)]

// Tags que se resuelven a categoría de juego
const TAG_GENRE_MAP = {
  'MOBA':          'MOBA',
  'Battle Royale': 'Battle Royale',
  'Battle R.':     'Battle Royale',
  'FPS':           'FPS Táctico',
  'Táctico':       'FPS Táctico',
  'Sport':         'Sport / FPS',
  'Móvil':         'MOBA Móvil',
  'MOBA Móvil':    'MOBA Móvil',
  'Esports':       'Esports',
}

const fade = {
  initial:    { opacity: 0, y: 14 },
  animate:    { opacity: 1, y: 0  },
  exit:       { opacity: 0, y: -8 },
  transition: { duration: 0.22 },
}

const REQUEST_DEFAULTS = {
  gameName: '',
  genre: '',
  platform: '',
  links: '',
  message: '',
}

const GRID_V = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065, delayChildren: 0.04 } },
}
const CARD_V = {
  hidden: { y: 36, opacity: 0, scale: 0.91 },
  show:   { y: 0,  opacity: 1, scale: 1,
    transition: { type: 'spring', stiffness: 115, damping: 18, mass: 0.85 } },
}

function normalizeRemoteCommunity(remote = {}, fallback = null) {
  // Oficial con ficha local: se queda la presentación local y entran los
  // datos reales (miembros, unido). Creada por jugadores: todo del backend.
  if (fallback) return withRemoteCommunity(fallback, remote)
  return {
    ...remote,
    id: remote.slug || remote._id,
    remoteId: remote._id,
    slug: remote.slug,
    genre: remote.game || remote.games?.[0] || 'Comunidad',
    tags: [...new Set([...(remote.tags || []), ...(remote.games || []), remote.region, remote.lang, 'Comunidad'].filter(Boolean))],
    poster: remote.banner || remote.poster || '',
    lowFpsImage: remote.banner || '',
    color: remote.color || remote.accent,
    members: Number(remote.memberCount ?? (Array.isArray(remote.members) ? remote.members.length : 0)) || 0,
    joined: Boolean(remote.joined),
    activePlayers: 0,
  }
}

function mergeCommunities(local, remote) {
  const byKey = new Map()
  for (const item of local) {
    byKey.set(String(item.slug || item.id || item.name).toLowerCase(), item)
  }
  for (const item of remote) {
    const key = String(item.slug || item.id || item.name).toLowerCase()
    byKey.set(key, normalizeRemoteCommunity(item, byKey.get(key)))
  }
  return [...byKey.values()]
}
const HCARD_V = {
  hidden: { x: 36, opacity: 0 },
  show:   { x: 0,  opacity: 1,
    transition: { type: 'spring', stiffness: 130, damping: 20 } },
}

// ── Section header helper ──────────────────────────────────────
function SecHead({ title, onMore, moreLabel }) {
  return (
    <div className="gg-hub-sec__head">
      <h2 className="gg-hub-sec__title">{title}</h2>
      {onMore && (
        <button className="gg-hub-sec__more" onClick={onMore}>{moreLabel || 'Ver todas →'}</button>
      )}
    </div>
  )
}

// ── Hub Tab ────────────────────────────────────────────────────
function HubTab({ onGoToJuegos, onGoToComunidades, onTagClick, communities }) {
  const popular   = [...communities].sort((a, b) => (b.members || 0) - (a.members || 0))
  const joined    = communities.filter(c => c.joined)
  const suggested = communities.filter(c => !c.joined).slice(0, 4)

  return (
    <div className="gg-hub__body">
      {/* Populares — showcase rotativo cinematográfico */}
      <section className="gg-hub-sec">
        <SecHead title="Destacados ahora" onMore={onGoToComunidades} moreLabel="Ver todas →" />
        <CommunityShowcase items={popular.slice(0, 6)} />
      </section>

      {/* Tus comunidades */}
      {joined.length > 0 && (
        <section className="gg-hub-sec">
          <SecHead title="Tus comunidades" />
          <motion.div className="gg-hub__grid"
            variants={GRID_V} initial="hidden" whileInView="show"
            viewport={{ once: true, amount: 0.1 }}>
            {joined.map(c => (
              <motion.div key={c.id} variants={CARD_V}>
                <CommunityCard community={c} onTagClick={onTagClick} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* Te podría interesar */}
      <section className="gg-hub-sec">
        <SecHead title="Te podría interesar" onMore={onGoToJuegos} moreLabel="Explorar juegos →" />
        <motion.div className="gg-hub__grid"
          variants={GRID_V} initial="hidden" whileInView="show"
          viewport={{ once: true, amount: 0.1 }}>
          {suggested.map(c => (
            <motion.div key={c.id} variants={CARD_V}>
              <CommunityCard community={c} onTagClick={onTagClick} />
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  )
}

// ── Juegos Tab ─────────────────────────────────────────────────
function JuegosTab({ category, setCategory, activeTag, setActiveTag, onOpenRequest }) {
  const navigate = useNavigate()
  const byCategory = category === 'Todos'
    ? GAMES
    : category === 'Esports'
      ? GAMES.filter(g => g.isEsport)
      : GAMES.filter(g => g.genre === category)

  const shown = activeTag && activeTag !== 'Todos'
    ? byCategory.filter(game => (game.tags || []).some(tag => tag.toLowerCase() === activeTag.toLowerCase()))
    : byCategory

  return (
    <div className="gg-juegos">
      {/* Category submenu */}
      <nav className="gg-juegos__nav" aria-label="Categorías de juego">
        {GAME_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`gg-juegos__cat ${category === cat ? 'active' : ''}`}
            onClick={() => {
              setCategory(cat)
              setActiveTag('Todos')
            }}
          >
            {cat}
            {category === cat && <motion.span className="gg-juegos__cat-line" layoutId="cat-line" />}
          </button>
        ))}
      </nav>

      {activeTag && activeTag !== 'Todos' && (
        <div className="gg-juegos__filterbar">
          <span className="gg-juegos__filtercopy">Filtrando por tag: <b>{activeTag}</b></span>
          <button className="gg-juegos__filterclear" onClick={() => setActiveTag('Todos')}>
            {Icon.x}
            <span>Quitar filtro</span>
          </button>
        </div>
      )}

      <section className="gg-juegos__request">
        <div className="gg-juegos__request-copy">
          <span className="gg-juegos__request-kicker">Catalogo abierto</span>
          <h3>Tu juego favorito no esta aqui?</h3>
          <p>Repórtalo desde aquí con nombre, género, plataforma y referencia. El equipo lo recibe directo en admin para revisar si entra al hub.</p>
        </div>
        <button className="gg-juegos__request-btn" onClick={onOpenRequest}>
          {Icon.send}
          <span>Solicitar juego</span>
        </button>
      </section>

      {/* Games grid */}
      <AnimatePresence mode="wait">
        <motion.div key={category} className="gg-juegos__grid"
          variants={GRID_V} initial="hidden" animate="show"
          exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {shown.map(game => (
            <motion.div key={game.id} layout variants={CARD_V}>
              <GameShowcaseCard
                game={game}
                onClick={() => navigate(`/comunidad/${game.id}`)}
                onTag={tag => {
                  const cat = GAME_CATEGORIES.find(c =>
                    c.toLowerCase() === tag.toLowerCase() ||
                    c.toLowerCase().includes(tag.toLowerCase())
                  )
                  if (cat) {
                    setCategory(cat)
                    setActiveTag('Todos')
                    return
                  }
                  setActiveTag(tag === activeTag ? 'Todos' : tag)
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Comunidades Tab ────────────────────────────────────────────
function ComunidadesTab({ activeTag, setActiveTag, onTagClick, communities }) {
  const navigate = useNavigate()
  const [search,     setSearch]     = useState('')
  const filtered = communities.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchTag = !activeTag || activeTag === 'Todos' ||
      c.tags.some(t => t.toLowerCase() === activeTag.toLowerCase()) ||
      c.genre.toLowerCase().includes(activeTag.toLowerCase())
    return matchSearch && matchTag
  })

  return (
    <div className="gg-comunidades">
      {/* Search + filters */}
      <div className="gg-hub__controls">
        <div className="gg-hub__search">
          <span className="gg-hub__search-icon">{Icon.search}</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar comunidades o juegos…"
          />
          {search && (
            <button className="gg-hub__search-clear" onClick={() => setSearch('')}>{Icon.x}</button>
          )}
        </div>
        <div className="gg-hub__tags">
          {COMMUNITY_TAGS.map(tag => (
            <FilterTag key={tag} label={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(tag === activeTag ? 'Todos' : tag)}
            />
          ))}
        </div>
      </div>

      {/* Results header */}
      <div className="gg-hub-sec__head">
        <h2 className="gg-hub-sec__title">
          {!search && (!activeTag || activeTag === 'Todos') ? 'Todas las comunidades' : 'Resultados'}
          <span className="gg-hub__count">{filtered.length}</span>
        </h2>
        <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => navigate('/mi-comunidad/crear')}>
          {Icon.plus} Crear comunidad
        </button>
      </div>

      {filtered.length > 0 ? (
        <motion.div className="gg-hub__grid"
          variants={GRID_V} initial="hidden" animate="show">
          {filtered.map(c => (
            <motion.div key={c.id} variants={CARD_V}>
              <CommunityCard community={c} onTagClick={onTagClick} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="gg-hub__empty">
          <span>{Icon.search}</span>
          <p>No encontramos comunidades con ese criterio.</p>
          <button className="gg-btn gg-btn--ghost gg-btn--sm"
            onClick={() => { setSearch(''); setActiveTag('Todos') }}>
            Ver todas
          </button>
        </div>
      )}

    </div>
  )
}

function FavoriteGameRequestModal({ open, onClose, onSubmit, userNick }) {
  const [form, setForm] = useState(REQUEST_DEFAULTS)

  if (!open) return null

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const submit = () => {
    if (!form.gameName.trim()) {
      toast('Escribe el nombre del juego', 'error')
      return
    }
    if (!form.message.trim()) {
      toast('Cuéntanos por qué debemos añadirlo', 'error')
      return
    }
    onSubmit(form, () => setForm(REQUEST_DEFAULTS))
  }

  return (
    <motion.div className="gg-create-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-create-modal__box gg-create-modal__box--request" initial={{ y: 24, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 18, opacity: 0 }} onClick={e => e.stopPropagation()}>
        <div className="gg-create-modal__head">
          <h3>{Icon.gamepad} Tu juego favorito no esta aqui?</h3>
          <button className="gg-create-modal__close" onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="gg-create-modal__intro">
          <p>Mándanos el nombre del juego y los datos clave. La solicitud llegará al panel admin para revisión.</p>
          <span>Solicitante: <b>{userNick}</b></span>
        </div>

        <div className="gg-create-modal__fields">
          <div className="gg-create-modal__field">
            <label>Nombre del juego</label>
            <input value={form.gameName} onChange={e => updateField('gameName', e.target.value)} placeholder="Ej. Delta Force" />
          </div>
          <div className="gg-create-modal__row">
            <div className="gg-create-modal__field">
              <label>Genero / categoria</label>
              <input value={form.genre} onChange={e => updateField('genre', e.target.value)} placeholder="Ej. FPS táctico" />
            </div>
            <div className="gg-create-modal__field">
              <label>Plataforma</label>
              <input value={form.platform} onChange={e => updateField('platform', e.target.value)} placeholder="PC, móvil, consola..." />
            </div>
          </div>
          <div className="gg-create-modal__field">
            <label>Link o referencia</label>
            <input value={form.links} onChange={e => updateField('links', e.target.value)} placeholder="Web oficial, trailer, Steam, etc." />
          </div>
          <div className="gg-create-modal__field">
            <label>Por que deberia estar en comunidad?</label>
            <textarea value={form.message} onChange={e => updateField('message', e.target.value)} rows={4} placeholder="Cuéntanos el potencial competitivo, comunidad activa, región, formato, etc." />
          </div>
        </div>

        <div className="gg-create-modal__actions">
          <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={onClose}>Cancelar</button>
          <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={submit}>{Icon.send} Enviar al admin</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Root ───────────────────────────────────────────────────────
export default function Community() {
  const { user } = useAuth()
  const [section,      setSection]      = useState('hub')
  const [gameCategory, setGameCategory] = useState('Todos')
  const [gameTag,      setGameTag]      = useState('Todos')
  const [communityTag, setCommunityTag] = useState('Todos')
  const [requestOpen, setRequestOpen] = useState(false)
  const [remoteCommunities, setRemoteCommunities] = useState([])

  const requester = user?.nick || user?.email?.split('@')[0] || 'Invitado'
  const communities = mergeCommunities(getAllCommunities(), remoteCommunities)

  useEffect(() => {
    let cancelled = false
    // Con el usuario como dependencia: "unido" depende de quién mira.
    listAllCommunities()
      .then(list => { if (!cancelled) setRemoteCommunities(list) })
      .catch(() => { if (!cancelled) setRemoteCommunities([]) })
    return () => { cancelled = true }
  }, [user?._id])

  const handleTagClick = (tag) => {
    const genre = TAG_GENRE_MAP[tag]
    if (genre) {
      setGameCategory(genre)
      setGameTag('Todos')
      setSection('juegos')
    } else {
      setCommunityTag(tag)
      setSection('comunidades')
    }
  }

  const handleGameRequest = async (form, reset) => {
    const payload = {
      gameName: form.gameName.trim(),
      genre: form.genre.trim(),
      platform: form.platform.trim(),
      links: form.links.trim(),
      message: form.message.trim(),
      requesterName: requester,
      requesterEmail: user?.email || '',
    }

    try {
      const data = await api('/game-requests', { method: 'POST', body: payload })
      if (data?.request?.ticket) syncTicketToMessenger(data.request.ticket)
      toast('Solicitud enviada al panel admin', 'success')
      reset()
      setRequestOpen(false)
    } catch (error) {
      toast('No se pudo enviar la solicitud al backend. Intentalo de nuevo.', 'error')
    }
  }

  return (
    <div className="gg-page gg-community-hub">
      <PromoModal />

      {/* Hero header */}
      <motion.header className="gg-hub__hero"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <p className="gg-hub__hero-eyebrow">Plataforma · Season 01 activa</p>
        <h1 className="gg-hub__hero-title">GlitchGang Hub</h1>
        <p className="gg-hub__hero-sub">Explora juegos, comunidades y competiciones activas.</p>
      </motion.header>

      {/* Main navigation */}
      <nav className="gg-hub__mainnav" role="tablist">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            className={`gg-hub__mainnav-btn ${section === s.id ? 'active' : ''}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {section === s.id && (
              <motion.span className="gg-hub__mainnav-line" layoutId="main-nav-line" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {section === 'hub' && (
          <motion.div key="hub" {...fade}>
            <HubTab
              onGoToJuegos={() => setSection('juegos')}
              onGoToComunidades={() => setSection('comunidades')}
              onTagClick={handleTagClick}
              communities={communities}
            />
          </motion.div>
        )}
        {section === 'juegos' && (
          <motion.div key="juegos" {...fade}>
            <JuegosTab
              category={gameCategory}
              setCategory={setGameCategory}
              activeTag={gameTag}
              setActiveTag={setGameTag}
              onOpenRequest={() => setRequestOpen(true)}
            />
          </motion.div>
        )}
        {section === 'comunidades' && (
          <motion.div key="comunidades" {...fade}>
            <ComunidadesTab
              activeTag={communityTag}
              setActiveTag={setCommunityTag}
              onTagClick={handleTagClick}
              communities={communities}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <FavoriteGameRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          onSubmit={handleGameRequest}
          userNick={requester}
        />
      </AnimatePresence>
    </div>
  )
}

