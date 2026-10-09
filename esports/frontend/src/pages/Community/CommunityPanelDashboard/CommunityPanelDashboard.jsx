import { isBetaHidden } from '../../../config/betaHidden.js'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { getMyCommunities, setActiveCommunityId } from '../../../lib/communityStore.js'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { getAllCommunities } from '../../../data/communities.js'
import { getActiveCommunityPreference, setActiveCommunityPreference } from '../../../hooks/useActiveCommunity.js'
import './CommunityPanel.css'

const VIEW_MODE_KEY = 'gg.community.panel.view'
const SUMMARY_MODE_KEY = 'gg.community.summary.mode'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'members', label: 'Más miembros' },
  { value: 'posts', label: 'Más contenido' },
  { value: 'name', label: 'Nombre A-Z' },
]

function formatShortDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getCommunityCompletion(community, postCount) {
  const checks = [
    Boolean(community.logo),
    Boolean(community.banner || community.poster),
    Array.isArray(community.games) && community.games.length > 0,
    Boolean(community.links && Object.values(community.links).some(Boolean)),
    postCount > 0,
  ]
  const done = checks.filter(Boolean).length
  return Math.round((done / checks.length) * 100)
}

// El backend manda `_id` y `memberCount` (members es la lista de ids); todo
// este panel compara por `id` y muestra `members` como número. Sin esto el
// panel nunca encontraba la comunidad seleccionada.
function withId(community) {
  if (!community) return community
  const members = Array.isArray(community.members) ? community.members.length : community.members
  return {
    ...community,
    id: community.id || String(community._id || ''),
    members: Number(community.memberCount ?? members ?? 0) || 0,
  }
}

function communityKey(community = {}) {
  return String(community.slug || community.game || community.id || community.name || '').toLowerCase()
}

function normalizeCommunityOption(community = {}, source = 'catalog') {
  const slug = communityKey(community)
  const games = Array.isArray(community.games) && community.games.length
    ? community.games
    : [community.game || community.name].filter(Boolean)
  return {
    ...community,
    id: community.id || slug,
    slug,
    name: community.name || community.game || 'Comunidad',
    game: community.game || games[0] || community.name || '',
    games,
    genre: community.genre || community.category || 'Comunidad',
    logo: community.logo || community.icon || '',
    banner: community.banner || community.poster || '',
    poster: community.poster || community.banner || '',
    color: community.color || community.accent || community.gameColor || '#8b5cf6',
    accent: community.accent || community.color || community.gameColor || '#8b5cf6',
    description: community.description || 'Gestiona identidad, publicaciones, reglas y presencia de esta comunidad.',
    source,
  }
}

function mergeCommunityOptions(catalog, publicRows, myRows) {
  const bySlug = new Map()
  catalog.forEach(item => bySlug.set(communityKey(item), normalizeCommunityOption(item, 'catalog')))
  publicRows.forEach(item => {
    const key = communityKey(item)
    bySlug.set(key, { ...normalizeCommunityOption(bySlug.get(key), 'catalog'), ...normalizeCommunityOption(item, 'public'), exists: true })
  })
  myRows.forEach(item => {
    const key = communityKey(item)
    bySlug.set(key, { ...normalizeCommunityOption(bySlug.get(key), 'catalog'), ...normalizeCommunityOption(item, 'mine'), exists: true, managed: true })
  })
  return [...bySlug.values()].filter(item => item.slug || item.name)
}

function communityCreatePayload(option = {}) {
  const infoLinks = Array.isArray(option.info?.links) ? option.info.links : []
  const official = infoLinks.find(item => /oficial|web/i.test(item.label || ''))?.url || infoLinks[0]?.url || ''
  const rules = Array.isArray(option.rules)
    ? option.rules
    : [option.info?.rules || `Normas oficiales de ${option.name} dentro de GlitchGang.`].filter(Boolean)
  return {
    name: option.name,
    slug: option.slug,
    game: option.game || option.name,
    games: option.games?.length ? option.games : [option.game || option.name].filter(Boolean),
    region: option.region || 'Global',
    lang: option.lang || 'Espanol',
    audience: option.audience || 'Mixto',
    whoPublishes: option.whoPublishes || 'Staff y moderadores',
    description: option.description || `Comunidad de ${option.name} en GlitchGang.`,
    logo: option.logo || '',
    banner: option.banner || option.poster || '',
    video: option.video || '',
    gallery: Array.isArray(option.gallery) ? option.gallery : [],
    color: option.color || option.accent || '#8b5cf6',
    accent: option.accent || option.color || '#8b5cf6',
    links: {
      official,
      discord: option.links?.discord || '',
      twitch: option.links?.twitch || '',
      youtube: option.links?.youtube || '',
      instagram: option.links?.instagram || '',
      x: option.links?.x || option.links?.twitter || '',
    },
    rules,
    allowed: option.allowed || 'Publicaciones del juego, anuncios, torneos, encuestas, guias y contenido de comunidad.',
    notAllowed: option.notAllowed || 'Spam, toxicidad, ataques personales, suplantacion y contenido fuera de tema.',
    banned: option.banned || 'Trampas, venta de cuentas, acoso, doxxing y cualquier actividad que ponga en riesgo a la comunidad.',
    features: option.features || {},
    team: Array.isArray(option.team) ? option.team : [],
  }
}

export default function CommunityPanelDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mine, setMine] = useState([])
  const [publicCommunities, setPublicCommunities] = useState([])
  const [activeId, setActiveId] = useState(() => getActiveCommunityPreference())
  const [selectedId, setSelectedId] = useState(() => getActiveCommunityPreference())
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_MODE_KEY) || 'list')
  const [summaryMode, setSummaryMode] = useState(() => localStorage.getItem(SUMMARY_MODE_KEY) || 'cards')
  const [search, setSearch] = useState('')
  const [gameSearch, setGameSearch] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [openingGame, setOpeningGame] = useState('')

  useEffect(() => {
    let cancelled = false
    // El backend expone GET /communities/mine, no /communities/my -- con
    // /my esto siempre devolvia 404 y caia siempre al mock de abajo (por
    // eso "mis comunidades" mostraba datos de prueba en vez de las reales).
    api('/communities/mine')
      .then(data => {
        if (!cancelled) setMine(Array.isArray(data.communities) ? data.communities.map(withId) : [])
      })
      .catch(() => {
        if (!cancelled) setMine(getMyCommunities(user?.nick || 'Usuario'))
      })
    return () => { cancelled = true }
  }, [user?.nick])

  useEffect(() => {
    let cancelled = false
    api('/communities')
      .then(data => {
        if (!cancelled) setPublicCommunities(Array.isArray(data.communities) ? data.communities.map(withId) : [])
      })
      .catch(() => {
        if (!cancelled) setPublicCommunities([])
      })
    return () => { cancelled = true }
  }, [])

  const selectableCommunities = useMemo(() => {
    return mergeCommunityOptions(getAllCommunities(), publicCommunities, mine)
      .sort((a, b) => {
        if (a.managed !== b.managed) return a.managed ? -1 : 1
        if (a.exists !== b.exists) return a.exists ? -1 : 1
        return String(a.name || '').localeCompare(String(b.name || ''), 'es')
      })
  }, [mine, publicCommunities])

  const filteredGameOptions = useMemo(() => {
    const query = gameSearch.trim().toLowerCase()
    if (!query) return selectableCommunities
    return selectableCommunities.filter(item => [
      item.name,
      item.game,
      item.genre,
      item.region,
      item.slug,
      ...(item.tags || []),
      ...(item.games || []),
    ].join(' ').toLowerCase().includes(query))
  }, [gameSearch, selectableCommunities])

  const c = useMemo(() => {
    if (!selectedId && !activeId) return null
    return mine.find(item => item.id === selectedId || item.id === activeId)
      || publicCommunities.find(item => item.id === selectedId || item.id === activeId)
      || null
  }, [activeId, mine, publicCommunities, selectedId])
  const hasManagedCommunity = Boolean(c)
  // Posts reales de la comunidad seleccionada (/posts?community=slug, el mismo
  // feed de /comunidad/:slug). loadPosts() es un stub que siempre da [].
  const [communityPosts, setCommunityPosts] = useState([])
  useEffect(() => {
    if (!c?.slug) { setCommunityPosts([]); return undefined }
    let cancelled = false
    api(`/posts?community=${encodeURIComponent(c.slug)}`)
      .then(data => { if (!cancelled) setCommunityPosts(Array.isArray(data.posts) ? data.posts : []) })
      .catch(() => { if (!cancelled) setCommunityPosts([]) })
    return () => { cancelled = true }
  }, [c?.slug])
  // Conteo de posts real solo para la seleccionada (es la única que se carga).
  const communitiesWithStats = useMemo(() => mine.map(item => {
    const postCount = item.id === c?.id ? communityPosts.length : 0
    const staff = Array.isArray(item.staff) && item.staff.length ? item.staff : item.team
    return {
      ...item,
      postCount,
      teamCount: Array.isArray(staff) ? staff.length : 0,
      gameList: (item.games || []).join(', ') || 'Sin juegos',
      linkCount: Object.values(item.links || {}).filter(Boolean).length,
      completion: getCommunityCompletion(item, postCount),
      createdLabel: formatShortDate(item.createdAt),
    }
  }), [mine, c?.id, communityPosts.length])
  const filteredCommunities = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = communitiesWithStats.filter(item => {
      if (!query) return true
      return [item.name, item.region, item.publicId, item.gameList]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sortMode === 'members') return (b.members || 0) - (a.members || 0)
      if (sortMode === 'posts') return (b.postCount || 0) - (a.postCount || 0)
      if (sortMode === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'es')
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
    return sorted
  }, [communitiesWithStats, search, sortMode])
  const activeCommunity = useMemo(() => communitiesWithStats.find(item => item.id === c?.id) || null, [communitiesWithStats, c?.id])
  const topMembers = useMemo(() => {
    const staff = Array.isArray(c?.staff) && c.staff.length ? c.staff : c?.team
    if (Array.isArray(staff) && staff.length) {
      return staff.slice(0, 5).map((member, index) => ({
        id: `${c.id}-team-${index}`,
        avatar: '/demos/steliant-esports/avatar-default.svg',
        nick: String(member.username || 'staff').replace(/^@/, ''),
        role: member.role,
        posts: Math.max(0, communityPosts.filter(post => (post.author?.nick || post.author || '').replace(/^@/, '') === String(member.username || '').replace(/^@/, '')).length),
      }))
    }
    return []
  }, [c?.id, c?.staff, c?.team, communityPosts])
  const completion = activeCommunity?.completion || 0
  const summaryCards = [
    { label: 'Completada', value: `${completion}%`, detail: 'Estado general de la comunidad.' },
    { label: 'Miembros', value: String(c?.members || 0), detail: 'Jugadores unidos a tu comunidad.' },
    { label: 'Publicaciones', value: String(communityPosts.length || 0), detail: 'Mensajes visibles en tu comunidad.' },
    { label: 'Enlaces', value: String(activeCommunity?.linkCount || 0), detail: 'Canales oficiales conectados.' },
  ]
  const summaryRows = [
    { label: 'ID publico', value: c?.publicId || 'Pendiente' },
    { label: 'Region', value: c?.region || 'Sin definir' },
    { label: 'Juegos', value: (c?.games || []).join(', ') || 'Sin juegos' },
    { label: 'Staff', value: String(activeCommunity?.teamCount || 0) },
    { label: 'Creada', value: formatShortDate(c?.createdAt) },
    { label: 'Slug', value: c?.slug || 'Pendiente' },
  ]

  const handleSelectCommunity = (communityId) => {
    setActiveCommunityId(communityId)
    setActiveCommunityPreference(communityId)
    setActiveId(communityId)
    setSelectedId(communityId)
  }

  const handleOpenGame = async (option) => {
    const slug = communityKey(option)
    if (!slug) return
    const existing = mine.find(item => communityKey(item) === slug)
      || publicCommunities.find(item => communityKey(item) === slug)
    if (existing) {
      setActiveCommunityId(existing.id)
      setActiveCommunityPreference(existing.id)
      setActiveId(existing.id)
      setSelectedId(existing.id)
      return
    }

    setOpeningGame(slug)
    try {
      const data = await api('/communities', {
        method: 'POST',
        body: communityCreatePayload(option),
      })
      const created = withId(data.community)
      if (created) {
        setMine(prev => [created, ...prev.filter(item => item.id !== created.id)])
        setPublicCommunities(prev => [created, ...prev.filter(item => item.id !== created.id)])
        setActiveCommunityId(created.id)
        setActiveCommunityPreference(created.id)
        setActiveId(created.id)
        setSelectedId(created.id)
        toast(`Panel preparado: ${created.name}`, 'success')
      }
    } catch (error) {
      try {
        // No existe /communities/public/:slug en el backend -- GET /communities/:id
        // ya acepta un slug ademas del _id real (ver getCommunityDetail), asi
        // que con /public/ delante esto siempre devolvia 404.
        const data = await api(`/communities/${encodeURIComponent(slug)}`)
        if (data.community) {
          const existingCommunity = withId(data.community)
          setPublicCommunities(prev => [existingCommunity, ...prev.filter(item => item.id !== existingCommunity.id)])
          setActiveCommunityId(existingCommunity.id)
          setActiveCommunityPreference(existingCommunity.id)
          setActiveId(existingCommunity.id)
          setSelectedId(existingCommunity.id)
          toast(`Panel abierto: ${existingCommunity.name}`, 'info')
          return
        }
      } catch (_) {
        // Keep the original error for the user-facing toast below.
      }
      toast(error?.message || 'No se pudo preparar esta comunidad', 'error')
    } finally {
      setOpeningGame('')
    }
  }

  const handleViewMode = (mode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  const handleSummaryMode = (mode) => {
    setSummaryMode(mode)
    localStorage.setItem(SUMMARY_MODE_KEY, mode)
  }

  const openCommunityContext = (communityId, path) => {
    setActiveCommunityId(communityId)
    setActiveCommunityPreference(communityId)
    setActiveId(communityId)
    setSelectedId(communityId)
    navigate(path)
  }

  const handleDeleteCommunity = (communityId, communityName) => {
    if (!window.confirm(`¿Eliminar ${communityName}? Esta acción la quitará de tu panel.`)) return
    api(`/communities/${encodeURIComponent(communityId)}`, { method: 'DELETE' })
      .then(() => {
        const next = mine.filter(item => item.id !== communityId)
        setMine(next)
        setActiveId('')
        setSelectedId('')
        setActiveCommunityPreference('')
        window.dispatchEvent(new CustomEvent('gg-admin-summary:update'))
        toast(`Comunidad eliminada: ${communityName}`, 'info')
      })
      .catch(err => {
        // Antes decía "eliminada" aunque el servidor la rechazara.
        toast(err?.message || `No se pudo eliminar ${communityName}`, 'error')
      })
  }

  const webLinks = [
    { label: 'Torneos', icon: Icon.trophy, desc: 'Ver y relacionar torneos activos con tu comunidad.', action: () => navigate('/torneos') },
    { label: 'Equipos', icon: Icon.team, desc: 'Revisar equipos y reclutamiento dentro de la web.', action: () => navigate('/equipos') },
    { label: 'Marcas', icon: Icon.star, desc: 'Explorar patrocinadores y marcas visibles.', action: () => navigate('/marcas') },
    { label: 'Calendario', icon: Icon.calendar, desc: 'Seguir scrims, eventos y fechas clave.', action: () => navigate('/calendario') },
    { label: 'Ranking', icon: Icon.award, desc: 'Consultar posiciones y rendimiento competitivo.', action: () => navigate('/ranking') },
    ...(isBetaHidden('/redes') ? [] : [{ label: 'Redes', icon: Icon.globe, desc: 'Gestionar difusión y presencia social.', action: () => navigate('/redes') }]),
  ]

  if (!selectedId) {
    return (
      <div>
        <motion.section className="cp-picker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="cp-picker__hero">
            <span className="cp-commandcenter__eyebrow">Mi Comunidad</span>
            <h1>Elige el juego que vas a administrar</h1>
            <p>Busca en el catalogo completo de juegos. Si la comunidad ya existe, abrimos su panel; si no existe, se prepara con la informacion base del juego.</p>
            <label className="cp-picker__search" aria-label="Buscar juego o comunidad">
              {Icon.search}
              <input value={gameSearch} onChange={(event) => setGameSearch(event.target.value)} placeholder="Buscar juego, genero, region o slug..." autoFocus />
            </label>
          </div>

          <div className="cp-picker__stats">
            <div><b>{selectableCommunities.length}</b><span>juegos en catalogo</span></div>
            <div><b>{selectableCommunities.filter(item => item.exists).length}</b><span>con panel creado</span></div>
            <div><b>{mine.length}</b><span>gestionadas por ti</span></div>
          </div>

          <div className="cp-picker__grid">
            {filteredGameOptions.map(option => {
              const cover = option.banner || option.poster || ''
              const isOpening = openingGame === communityKey(option)
              return (
                <button
                  key={`${option.source}-${option.id}-${option.slug}`}
                  type="button"
                  className="cp-picker__card"
                  style={{ '--mc': option.accent || option.color || '#8b5cf6', backgroundImage: cover ? `linear-gradient(180deg, rgba(5,8,13,.16), rgba(5,8,13,.92)), url(${cover})` : undefined }}
                  onClick={() => handleOpenGame(option)}
                  disabled={Boolean(openingGame)}
                >
                  <span className="cp-picker__glow" />
                  <span className="cp-picker__top">
                    <span className="cp-picker__logo" style={option.logo ? { backgroundImage: `url(${option.logo})` } : undefined}>{!option.logo && option.name.slice(0, 2).toUpperCase()}</span>
                    <span className={`cp-picker__state ${option.managed ? 'managed' : option.exists ? 'exists' : ''}`}>
                      {option.managed ? 'En tu panel' : option.exists ? 'Existe' : 'Nuevo panel'}
                    </span>
                  </span>
                  <span className="cp-picker__body">
                    <b>{option.name}</b>
                    <small>{option.genre || option.game || 'Comunidad'} · {(option.games || []).slice(0, 2).join(', ') || option.game || 'Juego'}</small>
                  </span>
                  <span className="cp-picker__foot">
                    <span>{option.members || 0} miembros</span>
                    <span>{isOpening ? 'Preparando...' : 'Abrir panel'} {Icon.chevronRight}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {filteredGameOptions.length === 0 && (
            <div className="cp-picker__empty">
              <b>No encontramos ese juego.</b>
              <span>Puedes crear una comunidad nueva y completar sus imagenes, reglas, redes y publicaciones.</span>
              <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/mi-comunidad/crear')}>{Icon.plus} Crear comunidad</button>
            </div>
          )}
        </motion.section>
      </div>
    )
  }

  return (
    <div>
      <motion.div className="cp-commandcenter" style={{ '--cc': c?.color || '#1E9DE3' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="cp-commandcenter__media" style={{ backgroundImage: `linear-gradient(135deg, ${c?.color || '#1E9DE3'}dd, rgba(5, 10, 19, .18)), url(${c?.poster || c?.banner || ''})` }} />
        <div className="cp-commandcenter__body">
          <span className="cp-commandcenter__eyebrow">Centro de mando</span>
          <div className="cp-commandcenter__titleline">
            <div>
              <h1>{c?.name || 'Mi comunidad'}</h1>
              <p>{c?.description || 'Administra identidad, equipo, visibilidad pública y contenido desde un solo lugar.'}</p>
            </div>
            <div className="cp-commandcenter__pulse">
              <strong>{completion}%</strong>
              <small>Configuración completada</small>
            </div>
          </div>
          <div className="cp-commandcenter__chips">
            <span>{Icon.gamepad} {(c?.games || []).join(', ') || 'Sin juegos'}</span>
            <span>{Icon.team} {c?.members || 0} miembros</span>
            <span>{Icon.chat} {communityPosts.length || 0} publicaciones</span>
            <span>{Icon.globe} {activeCommunity?.linkCount || 0} enlaces conectados</span>
          </div>
          <div className="cp-commandcenter__actions">
            <button className="pnl-btn pnl-btn--primary" onClick={() => openCommunityContext(c?.id || '', `/mi-comunidad/editar/${c?.id || ''}`)}>{Icon.edit} Editar comunidad</button>
            <button className="pnl-btn" onClick={() => { setSelectedId(''); setActiveId(''); setActiveCommunityPreference('') }}>{Icon.search} Cambiar juego</button>
{!isBetaHidden('/mi-comunidad/operaciones') && (
            <button className="pnl-btn" onClick={() => navigate('/mi-comunidad/operaciones')}>{Icon.bolt} Ir a operaciones</button>
)}
            <button className="pnl-btn" onClick={() => navigate('/mi-comunidad/publicaciones')}>{Icon.plus} Nuevo anuncio</button>
            {c?.slug && <button className="pnl-btn" onClick={() => navigate(`/comunidad/${c.slug}`)}>{Icon.eye} Ver pública</button>}
          </div>
        </div>
      </motion.div>

      <motion.div className="pnl-card cp-mine" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="pnl-card__title">
          {Icon.chat} Administrar comunidades
          <div className="cp-mine__toolbar">
            <label className="cp-search cp-search--panel" aria-label="Buscar comunidades">
              {Icon.search}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, ID, región o juego" />
            </label>
            <label className="cp-select" aria-label="Ordenar comunidades">
              <span>{Icon.refresh}</span>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="cp-viewtoggle" role="tablist" aria-label="Modo de visualización de comunidades">
              <button className={`cp-viewtoggle__btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => handleViewMode('grid')} aria-pressed={viewMode === 'grid'}>{Icon.layoutGrid} Cuadrícula</button>
              <button className={`cp-viewtoggle__btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => handleViewMode('list')} aria-pressed={viewMode === 'list'}>{Icon.list} Lista</button>
            </div>
            <button className="pnl-btn pnl-btn--primary pnl-card__action" onClick={() => navigate('/mi-comunidad/crear')}>{Icon.plus} Crear comunidad</button>
          </div>
        </div>
        {mine.length === 0 ? (
          <p className="cp-mine__empty">Aún no has creado comunidades. Crea una para gestionarla, definir sus reglas y publicar contenido.</p>
        ) : (
          <>
            <div className="cp-mine__summary">
              <span>{filteredCommunities.length} comunidades visibles</span>
              <span>{filteredCommunities.filter(item => item.completion >= 80).length} listas para publicar</span>
            </div>
            <div className={viewMode === 'grid' ? 'cp-mine__grid' : 'cp-mine__list'}>
            {filteredCommunities.map(m => (
              <article key={m.id} className={`cp-mine__item ${viewMode === 'grid' ? 'cp-mine__item--grid' : 'cp-mine__item--list'}`} style={{ '--mc': m.accent || '#1E9DE3' }}>
                <div className="cp-mine__head">
                  <span className="cp-mine__logo" style={m.logo ? { backgroundImage: `url(${m.logo})` } : undefined}>{!m.logo && (m.name[0] || 'C')}</span>
                  <div className="cp-mine__info">
                    <b>{m.name}</b>
                    <small>{m.publicId} · {m.region} · {m.createdLabel}</small>
                  </div>
                  <span className={`pnl-tag ${c?.id === m.id ? 'pnl-tag--accent' : ''}`}>{c?.id === m.id ? 'Activa' : 'Disponible'}</span>
                </div>
                <div className="cp-mine__actions">
                  <button className={`pnl-btn ${c?.id === m.id ? 'pnl-btn--primary' : ''}`} onClick={() => handleSelectCommunity(m.id)}>{c?.id === m.id ? <>{Icon.check} Activa</> : 'Gestionar'}</button>
                  <button className="pnl-btn" onClick={() => openCommunityContext(m.id, `/mi-comunidad/editar/${m.id}`)}>{Icon.edit} Editar</button>
                  <button className="pnl-btn" onClick={() => openCommunityContext(m.id, '/mi-comunidad/publicaciones')}>{Icon.send} Publicar</button>
                  <button className="pnl-btn pnl-btn--danger" onClick={() => handleDeleteCommunity(m.id, m.name)}>{Icon.x} Eliminar</button>
                </div>
              </article>
            ))}
            </div>
            {filteredCommunities.length === 0 && <p className="cp-mine__empty">No hay comunidades que coincidan con esa búsqueda.</p>}
          </>
        )}
      </motion.div>

      {hasManagedCommunity ? (
        <>
          <motion.div className="pnl-grid pnl-grid--2 pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .03 }}>
            <div className="pnl-card">
              <div className="pnl-card__title">
                {Icon.dashboard} Resumen breve
                <div className="cp-viewtoggle cp-viewtoggle--compact">
                  <button className={`cp-viewtoggle__btn ${summaryMode === 'cards' ? 'active' : ''}`} onClick={() => handleSummaryMode('cards')} aria-pressed={summaryMode === 'cards'}>{Icon.layoutGrid} Cuadro</button>
                  <button className={`cp-viewtoggle__btn ${summaryMode === 'rows' ? 'active' : ''}`} onClick={() => handleSummaryMode('rows')} aria-pressed={summaryMode === 'rows'}>{Icon.list} Linea</button>
                </div>
              </div>
              {summaryMode === 'cards' ? (
                <div className="cp-statusgrid">
                  {summaryCards.map(item => (
                    <div key={item.label} className="cp-statuscard">
                      <strong>{item.value}</strong>
                      <b>{item.label}</b>
                      <small>{item.detail}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cp-overview">
                  {summaryRows.map(item => (
                    <div key={item.label} className="cp-overview__row">
                      <span>{item.label}</span>
                      <b>{item.value}</b>
                    </div>
                  ))}
                </div>
              )}
              <div className="cp-summarynote">Este resumen solo muestra lo esencial. La gestion detallada vive en Operaciones, Miembros, Publicaciones y Presencia web.</div>
            </div>
            <div className="pnl-card">
              <div className="pnl-card__title">{Icon.bolt} Accesos del panel</div>
              <div className="cp-summarylinks">
{!isBetaHidden('/mi-comunidad/operaciones') && (
                <button className="cp-summarylinks__item" onClick={() => navigate('/mi-comunidad/operaciones')}>
                  <span>{Icon.bolt}</span>
                  <div><b>Operaciones</b><small>Checklist, estado y gestión interna.</small></div>
                </button>
)}
                <button className="cp-summarylinks__item" onClick={() => navigate('/mi-comunidad/miembros')}>
                  <span>{Icon.users}</span>
                  <div><b>Miembros</b><small>Staff, roles y responsables.</small></div>
                </button>
                <button className="cp-summarylinks__item" onClick={() => navigate('/mi-comunidad/publicaciones')}>
                  <span>{Icon.chat}</span>
                  <div><b>Publicaciones</b><small>Anuncios y actividad reciente.</small></div>
                </button>
{!isBetaHidden('/mi-comunidad/web') && (
                <button className="cp-summarylinks__item" onClick={() => navigate('/mi-comunidad/web')}>
                  <span>{Icon.globe}</span>
                  <div><b>Presencia web</b><small>Visibilidad pública y ecosistema.</small></div>
                </button>
)}
              </div>
            </div>
          </motion.div>
        </>
      ) : (
        <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="pnl-card__title">{Icon.chat} Configura tu primera comunidad</div>
          <p className="cp-mine__empty">Todavía no tienes una comunidad activa para gestionar. Empieza por crearla y luego podrás definir reglas, staff, juegos, publicaciones y enlaces oficiales.</p>
          <div className="cp-hero__cta">
            <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/mi-comunidad/crear')}>{Icon.plus} Crear comunidad</button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

