import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'

// Moderacion global de publicaciones de comunidades (feeds universitarios y
// comunidades del hub). Un admin no tiene por que pertenecer a ninguna, asi
// que esta es su unica via para ver y retirar contenido reportado.
const KIND_LABEL = { text: 'Texto', poll: 'Encuesta', event: 'Evento', tournament: 'Torneo' }

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

function excerpt(post) {
  const label = post.eventTitle || post.text || ''
  return label.length > 110 ? `${label.slice(0, 110)}…` : (label || '—')
}

export default function AdminCommunityPostsTab({ communities = [] }) {
  const [scope, setScope] = useState('community')
  const [universities, setUniversities] = useState([])
  const [filterId, setFilterId] = useState('')
  const [reportedOnly, setReportedOnly] = useState(true)
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    api('/university/admin/catalog').then(list => setUniversities(Array.isArray(list) ? list : [])).catch(() => setUniversities([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page) })
    if (filterId) qs.set(scope === 'university' ? 'universityId' : 'communityId', filterId)
    if (reportedOnly) qs.set('reported', 'true')
    api(`/admin/community-posts?${qs.toString()}`)
      .then(d => {
        const rows = Array.isArray(d.posts) ? d.posts : []
        setPosts(scope === 'university' ? rows.filter(p => p.universityId) : rows.filter(p => p.communityId || !p.universityId))
        setTotal(d.total || 0)
        setPages(d.pages || 1)
      })
      .catch(() => { setPosts([]); toast('No se pudieron cargar las publicaciones', 'error') })
      .finally(() => setLoading(false))
  }, [scope, filterId, page, reportedOnly])

  useEffect(() => { load() }, [load])

  const remove = async (post) => {
    if (!window.confirm(`¿Retirar esta publicación de @${post.authorNick || 'usuario'}? Se le avisará al autor.`)) return
    setDeletingId(post._id)
    try {
      await api(`/admin/community-posts/${post._id}`, { method: 'DELETE' })
      setPosts(prev => prev.filter(p => p._id !== post._id))
      setTotal(t => Math.max(0, t - 1))
      toast('Publicación retirada', 'success')
    } catch (err) {
      toast(err.message || 'No se pudo retirar la publicación', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="gg-acom-mod">
      <section className="gg-acom__filters">
        <select value={scope} onChange={e => { setScope(e.target.value); setFilterId(''); setPage(1) }}>
          <option value="community">Comunidades del hub</option>
          <option value="university">Comunidades universitarias</option>
        </select>
        <select value={filterId} onChange={e => { setFilterId(e.target.value); setPage(1) }}>
          <option value="">{scope === 'university' ? 'Todas las universidades' : 'Todas las comunidades'}</option>
          {scope === 'university'
            ? universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
            : communities.filter(c => !c.catalogOnly).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="gg-acom-mod__check">
          <input type="checkbox" checked={reportedOnly} onChange={() => { setReportedOnly(r => !r); setPage(1) }} />
          Solo reportadas
        </label>
      </section>

      <div className="gg-acom-mod__list">
        {loading && <p className="gg-acom-mod__empty">Cargando…</p>}
        {!loading && posts.length === 0 && (
          <p className="gg-acom-mod__empty">{reportedOnly ? 'No hay publicaciones reportadas.' : 'Sin publicaciones con este filtro.'}</p>
        )}
        {!loading && posts.map(post => (
          <article key={post._id} className="gg-acom-mod__row">
            <div>
              <b>@{post.authorNick || '—'}</b>
              <span>
                {post.universityId ? post.universityId : (post.communityId?.name || 'Comunidad')}
                {' · '}{KIND_LABEL[post.kind] || post.kind}{' · '}{fmt(post.createdAt)}
              </span>
              <p>{excerpt(post)}</p>
              {post.reportsCount > 0 && (
                <small className="gg-acom-mod__reports">
                  {Icon.alert} {post.reportsCount} reporte{post.reportsCount === 1 ? '' : 's'}: {(post.reports || []).map(r => `${r.reason}${r.user?.nick ? ` (@${r.user.nick})` : ''}`).join(', ')}
                </small>
              )}
            </div>
            <button type="button" disabled={deletingId === post._id} onClick={() => remove(post)}>
              {Icon.trash} Retirar
            </button>
          </article>
        ))}
      </div>

      {pages > 1 && (
        <div className="gg-acom-mod__pager">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          <span>{page} / {pages} · {total} publicaciones</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}

