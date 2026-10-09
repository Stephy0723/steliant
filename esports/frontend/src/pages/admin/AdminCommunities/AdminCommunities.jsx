import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { getAllCommunities } from '../../../data/communities.js'
import AdminCommunityPostsTab from './AdminCommunityPostsTab.jsx'
import './AdminCommunities.css'

const STATUS_LABEL = { active: 'Activa', paused: 'Pausada', archived: 'Archivada' }

function formatDate(value) {
  if (!value) return 'Catalogo base'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function communityImage(item) {
  return item.banner || item.poster || item.logo || ''
}

function catalogCommunity(item) {
  const game = item.name || item.game || 'Comunidad'
  return {
    id: `catalog-${item.slug || item.id}`,
    catalogOnly: true,
    publicId: item.publicId || item.publicCode || `CAT-${String(item.slug || item.id || game).toUpperCase()}`,
    publicCode: item.publicId || item.publicCode || `CAT-${String(item.slug || item.id || game).toUpperCase()}`,
    slug: item.slug || item.id,
    name: game,
    game,
    games: [game],
    region: item.region || 'Global',
    lang: item.lang || 'Espanol',
    audience: item.audience || 'Mixto',
    whoPublishes: item.whoPublishes || 'Admin GlitchGang',
    description: item.description || `${game} tiene un espacio de comunidad dentro de GlitchGang.`,
    logo: item.logo || '',
    banner: item.banner || item.poster || '',
    poster: item.poster || item.banner || '',
    color: item.color || item.accent || '#8b5cf6',
    ownerName: 'GlitchGang',
    ownerEmail: '',
    // Una entrada de catalogo todavia no es una comunidad real: no tiene
    // miembros (antes mostraba las cifras de ejemplo de data/communities.js).
    members: 0,
    status: item.status || 'active',
    createdAt: item.createdAt || null,
    links: item.links || {},
    rules: item.rules || [],
    allowed: item.allowed || '',
    notAllowed: item.notAllowed || '',
    banned: item.banned || '',
    team: item.team || [],
    staff: item.staff || [],
    features: item.features || {},
    partnerBadge: item.partnerBadge || { active: false, label: 'GlitchGang Partner', status: 'none', reason: '' },
  }
}

function payloadFromCatalog(item) {
  return {
    name: item.name,
    slug: item.slug,
    publicCode: item.publicCode,
    game: item.game || item.name,
    games: item.games?.length ? item.games : [item.game || item.name],
    region: item.region || 'Global',
    lang: item.lang || 'Espanol',
    audience: item.audience || 'Mixto',
    whoPublishes: item.whoPublishes || 'Admin GlitchGang',
    description: item.description,
    logo: item.logo || '',
    banner: item.banner || item.poster || '',
    color: item.color || item.accent || '#8b5cf6',
    accent: item.color || item.accent || '#8b5cf6',
    links: item.links || {},
    rules: item.rules || [],
    allowed: item.allowed || '',
    notAllowed: item.notAllowed || '',
    banned: item.banned || '',
    staff: item.team || item.staff || [],
    features: item.features || {},
  }
}

export default function AdminCommunities() {
  const navigate = useNavigate()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [game, setGame] = useState('all')
  const [view, setView] = useState('comunidades')

  const catalog = useMemo(() => getAllCommunities().map(catalogCommunity), [])
  const rows = useMemo(() => {
    const seen = new Set()
    const merged = []
    for (const item of communities) {
      seen.add(String(item.slug || item.publicCode || item.name || '').toLowerCase())
      merged.push({ ...item, catalogOnly: false })
    }
    for (const item of catalog) {
      const key = String(item.slug || item.publicCode || item.name || '').toLowerCase()
      if (!seen.has(key)) merged.push(item)
    }
    return merged
  }, [catalog, communities])

  const games = useMemo(() => {
    const values = rows.flatMap(item => item.games?.length ? item.games : [item.game || item.name]).filter(Boolean)
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  const metrics = useMemo(() => ({
    total: rows.length,
    managed: rows.filter(item => !item.catalogOnly).length,
    catalog: rows.filter(item => item.catalogOnly).length,
    active: rows.filter(item => item.status === 'active').length,
    paused: rows.filter(item => item.status === 'paused').length,
    archived: rows.filter(item => item.status === 'archived').length,
    missingMedia: rows.filter(item => !item.logo || !communityImage(item)).length,
    missingRules: rows.filter(item => !item.rules?.length && !item.allowed && !item.notAllowed).length,
    partnered: rows.filter(item => item.partnerBadge?.active).length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(item => {
      const matchesStatus = status === 'all' || item.status === status
      const matchesSource = source === 'all' || (source === 'managed' ? !item.catalogOnly : item.catalogOnly)
      const matchesGame = game === 'all' || [item.game, ...(item.games || [])].some(value => value === game)
      const haystack = [item.name, item.publicCode, item.publicId, item.slug, item.region, item.lang, item.ownerName, item.ownerEmail, item.description, ...(item.games || [])].join(' ').toLowerCase()
      return matchesStatus && matchesSource && matchesGame && (!q || haystack.includes(q))
    })
  }, [game, query, rows, source, status])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api('/admin/communities')
      setCommunities(Array.isArray(data.communities) ? data.communities : [])
    } catch {
      setCommunities([])
      toast('No se pudieron cargar comunidades desde backend.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const ensureManagedCommunity = async (item) => {
    if (!item.catalogOnly) return item
    const data = await api('/admin/communities/catalog', { method: 'POST', body: payloadFromCatalog(item) })
    setCommunities(prev => [data.community, ...prev.filter(row => row.id !== data.community.id)])
    window.dispatchEvent(new CustomEvent('gg-admin-summary:update'))
    toast(data.existed ? 'Comunidad abierta para gestion.' : 'Comunidad creada desde catalogo.', 'success')
    return data.community
  }

  const openCommunityManager = async (item, path = 'editar') => {
    try {
      const real = await ensureManagedCommunity(item)
      if (path === 'publicaciones') {
        navigate('/mi-comunidad/publicaciones', { state: { communityId: real.id } })
        return
      }
      navigate(`/mi-comunidad/editar/${encodeURIComponent(real.id)}`)
    } catch {
      toast('No se pudo abrir la comunidad en Mi Comunidad.', 'error')
    }
  }

  const updateStatus = async (item, nextStatus) => {
    try {
      const real = await ensureManagedCommunity(item)
      const data = await api(`/admin/communities/${encodeURIComponent(real.id)}`, { method: 'PATCH', body: { status: nextStatus } })
      setCommunities(prev => prev.map(row => row.id === real.id ? data.community : row))
      window.dispatchEvent(new CustomEvent('gg-admin-summary:update'))
      toast(`Comunidad ${STATUS_LABEL[nextStatus]?.toLowerCase() || nextStatus}.`, 'success')
    } catch {
      toast('No se pudo actualizar la comunidad.', 'error')
    }
  }

  const togglePartnerBadge = async (item) => {
    try {
      const real = await ensureManagedCommunity(item)
      const nextActive = !real.partnerBadge?.active
      const partnerBadge = {
        active: nextActive,
        label: real.partnerBadge?.label || 'GlitchGang Partner',
        status: nextActive ? 'verified' : 'revoked',
        reason: nextActive
          ? 'Verificada por admin GlitchGang'
          : 'Insignia retirada por conducta, reportes validos o incumplimiento de reglas',
      }
      const data = await api(`/admin/communities/${encodeURIComponent(real.id)}`, { method: 'PATCH', body: { partnerBadge } })
      setCommunities(prev => prev.map(row => row.id === real.id ? data.community : row))
      window.dispatchEvent(new CustomEvent('gg-admin-summary:update'))
      toast(nextActive ? 'Insignia de comunidad verificada.' : 'Insignia de comunidad retirada.', 'success')
    } catch {
      toast('No se pudo actualizar la insignia de comunidad.', 'error')
    }
  }

  return (
    <div className="gg-admin-page gg-acom">
      <div className="gg-acom__header">
        <div>
          <span className="gg-acom__eyebrow">{Icon.globe} Comunidades</span>
          <h2>Estado de comunidades</h2>
          <p>Admin aqui revisa estadisticas, salud del catalogo y accesos. La edicion completa vive en Mi Comunidad.</p>
        </div>
        <div className="gg-acom__header-actions">
          <button className="gg-acom__primary" onClick={() => navigate('/mi-comunidad')}>{Icon.dashboard} Mi Comunidad</button>
          <button className="gg-acom__primary gg-acom__primary--ghost" onClick={() => navigate('/mi-comunidad/crear')}>{Icon.plus} Crear</button>
        </div>
      </div>

      <nav className="gg-acom__tabs">
        <button className={view === 'comunidades' ? 'active' : ''} onClick={() => setView('comunidades')}>{Icon.globe} Comunidades</button>
        <button className={view === 'moderacion' ? 'active' : ''} onClick={() => setView('moderacion')}>{Icon.shield} Moderación de publicaciones</button>
      </nav>

      {view === 'moderacion' ? <AdminCommunityPostsTab communities={rows} /> : (<>
      <section className="gg-acom__metrics gg-acom__metrics--six" aria-label="Resumen de comunidades">
        <button className={source === 'all' ? 'active' : ''} onClick={() => setSource('all')}><b>{metrics.total}</b><span>Total</span></button>
        <button className={source === 'managed' ? 'active' : ''} onClick={() => setSource('managed')}><b>{metrics.managed}</b><span>Gestionadas</span></button>
        <button className={source === 'catalog' ? 'active' : ''} onClick={() => setSource('catalog')}><b>{metrics.catalog}</b><span>Catalogo</span></button>
        <button className={status === 'active' ? 'active' : ''} onClick={() => setStatus(status === 'active' ? 'all' : 'active')}><b>{metrics.active}</b><span>Activas</span></button>
        <button className={status === 'paused' ? 'active' : ''} onClick={() => setStatus(status === 'paused' ? 'all' : 'paused')}><b>{metrics.paused}</b><span>Pausadas</span></button>
        <button><b>{metrics.partnered}</b><span>Con insignia</span></button>
      </section>

      <section className="gg-acom__health">
        <article><span>{Icon.camera}</span><div><b>{metrics.missingMedia}</b><p>Comunidades necesitan logo o banner.</p></div></article>
        <article><span>{Icon.shield}</span><div><b>{metrics.missingRules}</b><p>Comunidades necesitan reglas o politica de contenido.</p></div></article>
        <article><span>{Icon.archive || Icon.clock}</span><div><b>{metrics.archived}</b><p>Comunidades archivadas o fuera de operacion.</p></div></article>
      </section>

      <section className="gg-acom__filters">
        <label className="gg-acom__search">{Icon.search}<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nombre, ID, dueno, region, juego..." /></label>
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">Todos los estados</option><option value="active">Activas</option><option value="paused">Pausadas</option><option value="archived">Archivadas</option>
        </select>
        <select value={game} onChange={event => setGame(event.target.value)}>
          <option value="all">Todos los juegos</option>{games.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={load}>{Icon.refresh} Actualizar</button>
      </section>

      <section className="gg-acom__board">
        <div className="gg-acom__board-head"><span>Comunidad</span><span>Estado</span><span>Origen</span><span>Accesos</span></div>
        {loading ? <div className="gg-acom__empty">{Icon.clock}<p>Cargando comunidades...</p></div> : filtered.length ? filtered.map((item, index) => (
          <motion.article key={item.id} className={`gg-acom__row gg-acom__row--${item.status || 'active'}`} style={{ '--row-accent': item.color || item.accent || 'var(--accent)' }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.015 }}>
            <div className="gg-acom__identity">
              <div className="gg-acom__cover" style={communityImage(item) ? { backgroundImage: `url(${communityImage(item)})` } : undefined}>{!communityImage(item) && <span>{item.name?.[0] || 'C'}</span>}</div>
              <div>
                <small>{item.publicCode || item.publicId || 'Sin ID'}</small>
                <h3>{item.name}</h3>
                <p>{item.description || 'Sin descripcion publica.'}</p>
                <div className="gg-acom__meta">
                  <span>{Icon.gamepad} {(item.games || []).join(', ') || item.game || 'Sin juego'}</span>
                  <span>{Icon.globe} {item.region || 'Sin region'}</span>
                  <span>{Icon.users} {item.catalogOnly ? 'Sin crear' : `${item.members || 0} miembros`}</span>
                  {item.partnerBadge?.active && <span className="gg-acom__partner">{Icon.award} {item.partnerBadge.label || 'GlitchGang Partner'}</span>}
                  <span>{Icon.clock} {formatDate(item.createdAt)}</span>
                </div>
              </div>
            </div>
            <span className="gg-acom__status">{STATUS_LABEL[item.status] || item.status}</span>
            <span className={`gg-acom__source ${item.catalogOnly ? 'is-catalog' : ''}`}>{item.catalogOnly ? 'Catalogo' : 'Backend'}</span>
            <div className="gg-acom__actions">
              {item.slug && <button onClick={() => navigate(`/comunidad/${item.slug}`)}>{Icon.eye} Ver</button>}
              <button className="is-primary" onClick={() => openCommunityManager(item)}>{Icon.edit} Editar en Mi Comunidad</button>
              <button
                className={item.partnerBadge?.active ? 'is-danger' : ''}
                title="Se puede retirar por mala conducta, reportes validos o incumplimiento de reglas."
                onClick={() => togglePartnerBadge(item)}
              >
                {Icon.award} {item.partnerBadge?.active ? 'Quitar insignia' : 'Verificar insignia'}
              </button>
              <button onClick={() => openCommunityManager(item, 'publicaciones')}>{Icon.send} Publicar</button>
              {item.status !== 'active' && <button onClick={() => updateStatus(item, 'active')}>{Icon.check} Activar</button>}
              {item.status === 'active' && <button onClick={() => updateStatus(item, 'paused')}>{Icon.clock} Pausar</button>}
            </div>
          </motion.article>
        )) : <div className="gg-acom__empty">{Icon.globe}<p>No hay comunidades con esos filtros.</p></div>}
      </section>
      </>)}
    </div>
  )
}

