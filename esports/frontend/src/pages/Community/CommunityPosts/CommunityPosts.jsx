import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import PostCard from '../../../components/PostCard/PostCard.jsx'
import { toast } from '../../../lib/toast.js'
import { api } from '../../../lib/api.js'
import { getActiveCommunityPreference, setActiveCommunityPreference } from '../../../hooks/useActiveCommunity.js'
import '../CommunityPanelDashboard/CommunityPanel.css'
import './CommunityHub.css'

export default function CommunityPosts() {
  const { user } = useAuth()
  const location = useLocation()
  const requestedId = location.state?.communityId || ''
  const [communities, setCommunities] = useState([])
  const [activeId, setActiveId] = useState(requestedId || getActiveCommunityPreference())
  const [draft, setDraft] = useState('')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  const community = useMemo(() => communities.find(item => item.id === activeId) || communities[0] || null, [activeId, communities])
  const summary = useMemo(() => {
    const pinned = posts.filter(post => post.pinned).length
    return { total: posts.length, pinned }
  }, [posts])

  useEffect(() => {
    if (!requestedId) return
    setActiveCommunityPreference(requestedId)
    setActiveId(requestedId)
  }, [requestedId])

  useEffect(() => {
    let cancelled = false
    // El backend expone GET /communities/mine, no /communities/my -- con
    // /my esto siempre devolvia 404 y la lista de comunidades quedaba vacia.
    api('/communities/mine')
      .then(data => {
        if (cancelled) return
        // El backend manda `_id`; aquí se selecciona por `id`.
        const rows = (Array.isArray(data.communities) ? data.communities : [])
          .map(row => ({ ...row, id: row.id || String(row._id || '') }))
        setCommunities(rows)
        if (!activeId && rows[0]) {
          setActiveCommunityPreference(rows[0].id)
          setActiveId(rows[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) toast('No se pudieron cargar tus comunidades.', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!community?.slug) {
      setPosts([])
      return
    }
    let cancelled = false
    api(`/posts?community=${encodeURIComponent(community.slug)}`)
      .then(data => {
        if (!cancelled) setPosts(Array.isArray(data.posts) ? data.posts : [])
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
    return () => { cancelled = true }
  }, [community?.slug])

  const handleDeletePost = async (id) => {
    try {
      await api(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setPosts(prev => prev.filter(p => String(p.id) !== String(id)))
      toast('Publicacion eliminada.', 'success')
    } catch {
      toast('No se pudo eliminar la publicacion.', 'error')
    }
  }

  const handleBlockPost = (id, blockAuthor) => {
    if (blockAuthor) {
      const blockedPost = posts.find(p => p.id === id)
      if (blockedPost) setPosts(prev => prev.filter(p => p.author !== blockedPost.author))
      return
    }
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const publishDraft = async () => {
    if (!community?.slug) {
      toast('Selecciona una comunidad para publicar.', 'error')
      return
    }
    if (!draft.trim()) {
      toast('Escribe un mensaje para publicar', 'error')
      return
    }
    setPublishing(true)
    try {
      const post = await api('/posts', {
        method: 'POST',
        body: {
          kind: 'anuncio',
          title: `Anuncio de ${community.name}`,
          text: draft.trim(),
          communitySlug: community.slug,
        },
      })
      setPosts(prev => [post, ...prev])
      setDraft('')
      toast('Publicacion guardada en tu comunidad', 'success')
    } catch {
      toast('No se pudo publicar en backend.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const sorted = [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned))

  if (loading) {
    return (
      <div className="pnl-card">
        <div className="pnl-empty"><GGLoader label="Sincronizando comunidades" size="sm" /></div>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="pnl-card">
        <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.chat}</div><h3>No hay comunidad activa</h3><p>Crea o selecciona una comunidad antes de publicar contenido.</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Publicaciones de {community.name}</h1>
          <p>Publica anuncios reales en el feed publico de la comunidad.</p>
        </div>
      </div>

      {communities.length > 1 && (
        <div className="pnl-card cp-composer">
          <div className="pnl-card__title">{Icon.globe} Comunidad activa</div>
          <select value={community.id} onChange={event => { setActiveCommunityPreference(event.target.value); setActiveId(event.target.value) }}>
            {communities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      )}

      <motion.div className="pnl-card cp-composer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">{Icon.edit} Nuevo anuncio</div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} placeholder="Escribe una actualizacion para tu comunidad, anuncia reglas, torneos o proximos pasos..." />
        <div className="cp-composer__foot">
          <div className="cp-post__stats"><span>{Icon.chat} {summary.total} publicaciones</span><span>{Icon.award} {summary.pinned} fijadas</span></div>
          <button className="pnl-btn pnl-btn--primary" onClick={publishDraft} disabled={publishing}>{Icon.send} {publishing ? 'Publicando...' : 'Publicar'}</button>
        </div>
      </motion.div>

      <div className="cp-posts pnl-section-gap">
        {sorted.length === 0 ? (
          <div className="pnl-card" style={{ padding: '40px', textAlign: 'center' }}>
            <p>Aun no hay publicaciones en esta comunidad. Empieza con un mensaje de bienvenida o un anuncio fijo.</p>
          </div>
        ) : (
          sorted.map((p) => (
            <PostCard key={p.id} post={p} onDelete={handleDeletePost} onBlock={handleBlockPost} />
          ))
        )}
      </div>
    </div>
  )
}

