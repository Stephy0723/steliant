import { useMemo, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { NEWS_CATEGORIES, CHANGELOG_TYPES, ANNOUNCEMENT_TYPES, ANNOUNCEMENT_PERIODS } from '../../../data/admin.js'
import { toast } from '../../../lib/toast.js'
import { api } from '../../../lib/api.js'
import { uploadFile } from '../../../lib/uploadsApi.js'
import './AdminNews.css'

const todayISO = () => new Date().toISOString().slice(0, 10)
const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }

// Sube la imagen al backend (/uploads) y guarda la URL servida. Antes se
// guardaba el dataURL base64 dentro del documento de la noticia.
function ImageInput({ value, onChange, label, tall }) {
  const [uploading, setUploading] = useState(false)
  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 4 * 1024 * 1024) { toast('La imagen supera 4MB', 'error'); return }
    setUploading(true)
    try {
      const { url } = await uploadFile(f)
      onChange(url)
    } catch (err) {
      toast(err.message || 'No se pudo subir la imagen', 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  return (
    <div className="gg-img">
      <span>{label}</span>
      <label className={`gg-img__drop ${tall ? 'tall' : ''}`} style={value ? { backgroundImage: `url(${value})` } : undefined}>
        <input type="file" accept="image/*" onChange={onFile} hidden />
        {!value && <span className="gg-img__ph">{Icon.upload} {uploading ? 'Subiendo…' : 'Subir imagen'}</span>}
        {value && <button type="button" className="gg-img__rm" onClick={(e) => { e.preventDefault(); onChange('') }}>{Icon.x}</button>}
      </label>
    </div>
  )
}

export default function AdminNews() {
  const { user } = useAuth()
  const [tab, setTab] = useState('articulos')
  const [announcements, setAnnouncements] = useState([])
  const [changelog, setChangelog] = useState([])
  const [dbNews, setDbNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [editing, setEditing] = useState(null)
  const [logOpen, setLogOpen] = useState(false)
  const [annOpen, setAnnOpen] = useState(null)
  const authorName = user?.nick || 'Brooklyn'

  const fetchNews = () => {
    setLoadingNews(true)
    api('/news?status=all')
      .then(res => {
        setDbNews(res.news || [])
      })
      .catch(err => {
        console.error(err)
        toast('Error al cargar noticias', 'error')
      })
      .finally(() => setLoadingNews(false))
  }

  useEffect(() => {
    fetchNews()
    api('/admin/announcements').then(res => setAnnouncements(res.announcements || [])).catch(() => toast('Error al cargar anuncios', 'error'))
    api('/admin/changelog').then(res => setChangelog(res.changelog || [])).catch(() => toast('Error al cargar el changelog', 'error'))
  }, [])

  const saveAnnouncement = async (data) => {
    try {
      if (annOpen.id) {
        const res = await api(`/admin/announcements/${annOpen.id}`, { method: 'PATCH', body: data })
        setAnnouncements(prev => prev.map(a => a.id === annOpen.id ? res.announcement : a))
        toast('Anuncio actualizado', 'success')
      } else {
        const res = await api('/admin/announcements', { method: 'POST', body: data })
        setAnnouncements(prev => [res.announcement, ...prev])
        toast('Anuncio creado', 'success')
      }
      setAnnOpen(null)
    } catch (err) {
      toast(err.message || 'No se pudo guardar el anuncio', 'error')
    }
  }

  const toggleAnnouncement = async (a) => {
    try {
      const res = await api(`/admin/announcements/${a.id}`, { method: 'PATCH', body: { active: !a.active } })
      setAnnouncements(prev => prev.map(x => x.id === a.id ? res.announcement : x))
    } catch (err) {
      toast(err.message || 'No se pudo actualizar el anuncio', 'error')
    }
  }

  const deleteAnnouncement = async (a) => {
    try {
      await api(`/admin/announcements/${a.id}`, { method: 'DELETE' })
      setAnnouncements(prev => prev.filter(x => x.id !== a.id))
      toast('Anuncio eliminado', 'error')
    } catch (err) {
      toast(err.message || 'No se pudo eliminar el anuncio', 'error')
    }
  }

  const saveChangelog = async (data) => {
    try {
      const res = await api('/admin/changelog', { method: 'POST', body: data })
      setChangelog(prev => [res.entry, ...prev])
      toast('Entrada añadida', 'success')
      setLogOpen(false)
    } catch (err) {
      toast(err.message || 'No se pudo guardar la entrada', 'error')
    }
  }

  const deleteChangelog = async (c) => {
    try {
      await api(`/admin/changelog/${c.id}`, { method: 'DELETE' })
      setChangelog(prev => prev.filter(x => x.id !== c.id))
      toast('Entrada eliminada', 'error')
    } catch (err) {
      toast(err.message || 'No se pudo eliminar la entrada', 'error')
    }
  }

  return (
    <div className="gg-admin-page gg-news">
      <div className="gg-admin-page__header">
        <div><h2>Publicaciones</h2><p>Artículos, anuncios de la web y registro de cambios</p></div>
      </div>

      <div className="at-viewnav">
        <button className={`at-viewnav__btn ${tab === 'articulos' ? 'active' : ''}`} onClick={() => setTab('articulos')}>{Icon.news}<span>Artículos ({dbNews.length})</span></button>
        <button className={`at-viewnav__btn ${tab === 'anuncios' ? 'active' : ''}`} onClick={() => setTab('anuncios')}>{Icon.bell}<span>Anuncios ({announcements?.length || 0})</span></button>
        <button className={`at-viewnav__btn ${tab === 'changelog' ? 'active' : ''}`} onClick={() => setTab('changelog')}>{Icon.bolt}<span>Changelog ({changelog?.length || 0})</span></button>
      </div>

      {tab === 'articulos' && (
        <Articulos
          news={dbNews}
          loading={loadingNews}
          onNew={() => setEditing({})}
          onEdit={setEditing}
          onToggleStatus={async (n) => {
            const nextStatus = n.status === 'publicado' ? 'borrador' : 'publicado'
            const articleId = n._id || n.id
            try {
              const res = await api(`/news/${articleId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: nextStatus })
              })
              setDbNews(prev => prev.map(item => (item._id === articleId || item.id === articleId) ? res : item))
              toast(nextStatus === 'publicado' ? 'Publicado' : 'Pasado a borrador', 'success')
            } catch {
              toast('Error al cambiar estado del artículo', 'error')
            }
          }}
          onDelete={async (n) => {
            const articleId = n._id || n.id
            try {
              await api(`/news/${articleId}`, {
                method: 'DELETE'
              })
              setDbNews(prev => prev.filter(item => item._id !== articleId && item.id !== articleId))
              toast('Artículo eliminado', 'error')
            } catch {
              toast('Error al eliminar artículo', 'error')
            }
          }}
        />
      )}
      {tab === 'anuncios' && <Anuncios announcements={announcements} onNew={() => setAnnOpen({})} onEdit={setAnnOpen} onToggle={toggleAnnouncement} onDelete={deleteAnnouncement} />}
      {tab === 'changelog' && <Changelog changelog={changelog} onNew={() => setLogOpen(true)} onDelete={deleteChangelog} />}

      <AnimatePresence>
        {editing && <ArticleEditor article={editing} author={authorName} onClose={() => setEditing(null)}
          onSave={async (data) => {
            const articleId = editing._id || editing.id
            if (articleId) {
              try {
                const res = await api(`/news/${articleId}`, {
                  method: 'PUT',
                  body: JSON.stringify(data)
                })
                setDbNews(prev => prev.map(n => (n._id === articleId || n.id === articleId) ? res : n))
                toast('Artículo actualizado', 'success')
              } catch {
                toast('Error al actualizar artículo', 'error')
              }
            } else {
              try {
                const res = await api('/news', {
                  method: 'POST',
                  body: JSON.stringify(data)
                })
                setDbNews(prev => [res, ...prev])
                toast('Artículo creado', 'success')
              } catch {
                toast('Error al crear artículo', 'error')
              }
            }
            setEditing(null)
          }} />}
        {annOpen && <AnnouncementEditor ann={annOpen} onClose={() => setAnnOpen(null)} onSave={saveAnnouncement} />}
        {logOpen && <ChangelogEditor onClose={() => setLogOpen(false)} onSave={saveChangelog} />}
      </AnimatePresence>
    </div>
  )
}

/* ════ ARTÍCULOS ════ */
function Articulos({ news, loading, onNew, onEdit, onToggleStatus, onDelete }) {
  const popularArticles = useMemo(() => {
    return [...news].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)
  }, [news])

  if (loading) {
    return <div className="gg-news__empty" style={{ padding: '40px 0' }}><GGLoader label="Sincronizando articulos" size="sm" /></div>
  }

  return (
    <>
      {news.length > 0 && (
        <div className="gg-news__popular-dashboard">
          <h3>🔥 Artículos Populares (Top 5 por vistas)</h3>
          <div className="gg-news__popular-grid">
            {popularArticles.map((n, idx) => (
              <div key={n._id || n.id} className="gg-news__popular-card" onClick={() => onEdit(n)}>
                <span className="gg-news__popular-rank">#{idx + 1}</span>
                <div className="gg-news__popular-info">
                  <h4>{n.title}</h4>
                  <div className="gg-news__popular-meta">
                    <span>{n.views || 0} vistas</span> · 
                    <span>CTR {n.views ? (((n.clicks || 0) / n.views) * 100).toFixed(1) : '0'}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gg-news__bar">
        <span>{news.filter(n => n.status === 'publicado').length} publicados · {news.filter(n => n.status === 'borrador').length} borradores</span>
        <button className="gg-news__new" onClick={onNew}>{Icon.plus} Nuevo artículo</button>
      </div>
      <div className="gg-news__grid">
        {news.map((n, i) => {
          const ctr = n.views ? (((n.clicks || 0) / n.views) * 100).toFixed(1) : '0'
          const readingTime = n.readingTime || Math.max(1, Math.ceil((n.body || '').trim().split(/\s+/).filter(Boolean).length / 200))
          return (
            <motion.article key={n._id || n.id} className="gg-news__card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="gg-news__cover" style={(n.cover || n.image) ? { backgroundImage: `url(${n.cover || n.image})` } : undefined}>
                {!(n.cover || n.image) && <span>{Icon.news}</span>}
                <span className={`gg-news__state ${n.status || 'borrador'}`}>{n.status || 'borrador'}</span>
              </div>
              <div className="gg-news__body">
                {n.category && <span className="gg-news__cat">{n.category}</span>}
                <h3>{n.title}</h3>
                <p>{n.excerpt || 'Sin resumen.'}</p>
                {n.links?.length > 0 && <div className="gg-news__links">{n.links.map((l, k) => <span key={k}>{Icon.globe} {l.label || l.url}</span>)}</div>}
                
                {n.seoDescription && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 4 }}>
                    <strong>SEO Meta:</strong> {n.seoDescription}
                  </div>
                )}
                {n.scheduledDate && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
                    ⏱️ Programado para: <strong>{fmtDate(n.scheduledDate)}</strong>
                  </div>
                )}

                <div className="gg-news__meta" style={{ marginTop: 8, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {n.publicCode && <code className="gg-news-code" title={n.internalCode}>{n.publicCode}</code>}
                  <span>{n.author}</span>
                  <span>{n.date || (n.createdAt ? fmtDate(n.createdAt) : '')}</span>
                  <span>👁️ {n.views || 0}</span>
                  <span>⏱️ {readingTime} min</span>
                  <span>🖱️ CTR {ctr}%</span>
                  <span>📢 {n.shares || 0}</span>
                </div>
                <div className="gg-news__actions">
                  <button onClick={() => onEdit(n)}>{Icon.edit} Editar</button>
                  <button onClick={() => onToggleStatus(n)}>
                    {n.status === 'publicado' ? Icon.eye : Icon.check} {n.status === 'publicado' ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button className="danger" onClick={() => onDelete(n)}>{Icon.trash}</button>
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>
    </>
  )
}

/* ════ ANUNCIOS (con control de programación) ════ */
function Anuncios({ announcements, onNew, onEdit, onToggle, onDelete }) {
  const [when, setWhen] = useState('todas')
  const t = todayISO(), tm = addDaysISO(1), wk = addDaysISO(7)
  const inWhen = (a) => when === 'todas'
    || (when === 'hoy' && a.date === t)
    || (when === 'manana' && a.date === tm)
    || (when === 'semana' && a.date >= t && a.date <= wk)
  const shown = announcements.filter(inWhen)
  const counts = {
    hoy: announcements.filter(a => a.date === t).length,
    manana: announcements.filter(a => a.date === tm).length,
    activos: announcements.filter(a => a.active).length,
  }

  return (
    <>
      <div className="gg-ann__summary">
        <div className="gg-ann__sum"><b>{counts.hoy}</b><span>{Icon.calendar} Hoy</span></div>
        <div className="gg-ann__sum"><b>{counts.manana}</b><span>{Icon.bell} Mañana</span></div>
        <div className="gg-ann__sum"><b>{counts.activos}</b><span>{Icon.check} Activos</span></div>
        <button className="gg-news__new" onClick={onNew}>{Icon.plus} Nuevo anuncio</button>
      </div>
      <div className="gg-ann__filters">
        {[['todas', 'Todas'], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Esta semana']].map(([k, l]) => (
          <button key={k} className={`gg-ann__chip ${when === k ? 'on' : ''}`} onClick={() => setWhen(k)}>{l}</button>
        ))}
      </div>
      <div className="gg-ann__list">
        {shown.map((a, i) => {
          const ty = ANNOUNCEMENT_TYPES[a.type] || ANNOUNCEMENT_TYPES.aviso
          return (
            <motion.div key={a.id} className={`gg-ann__card ${a.active ? '' : 'off'}`} style={{ '--c': ty.color }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="gg-ann__icon">{Icon[ty.icon]}</div>
              <div className="gg-ann__main">
                <div className="gg-ann__top"><span className="gg-ann__type">{ty.label}</span><span className="gg-ann__date">{Icon.calendar} {fmtDate(a.date)} · {ANNOUNCEMENT_PERIODS[a.period] || a.period}</span></div>
                <h4>{a.title}</h4>
                <p>{a.message}</p>
                {a.link && <a className="gg-ann__link" href={a.link} onClick={e => e.preventDefault()}>{Icon.globe} {a.link}</a>}
              </div>
              <div className="gg-ann__actions">
                <button className={`gg-ann__toggle ${a.active ? 'on' : ''}`} title={a.active ? 'Activo (clic para ocultar)' : 'Oculto (clic para mostrar)'} onClick={() => onToggle(a)}>{a.active ? Icon.eye : Icon.lock}</button>
                <button onClick={() => onEdit(a)}>{Icon.edit}</button>
                <button className="danger" onClick={() => onDelete(a)}>{Icon.trash}</button>
              </div>
            </motion.div>
          )
        })}
        {shown.length === 0 && <div className="gg-news__empty">No hay anuncios para ese filtro.</div>}
      </div>
    </>
  )
}

/* ════ CHANGELOG ════ */
function Changelog({ changelog, onNew, onDelete }) {
  return (
    <>
      <div className="gg-news__bar"><span>Registro de cambios — se publica en "Novedades" para todos los usuarios</span><button className="gg-news__new" onClick={onNew}>{Icon.plus} Nueva entrada</button></div>
      <div className="gg-log">
        {changelog.map((c, i) => {
          const ty = CHANGELOG_TYPES[c.type] || CHANGELOG_TYPES.feature
          return (
            <motion.div key={c.id} className="gg-log__entry" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="gg-log__line"><span className="gg-log__dot" style={{ background: ty.color }} /></div>
              <div className="gg-log__content">
                <div className="gg-log__top">
                  <span className="gg-log__ver">{c.version}</span>
                  <span className="gg-log__type" style={{ color: ty.color, background: `${ty.color}1a`, borderColor: `${ty.color}40` }}>{Icon[ty.icon]} {ty.label}</span>
                  <span className="gg-log__date">{c.date}</span>
                  <button className="gg-log__del" onClick={() => onDelete(c)}>{Icon.trash}</button>
                </div>
                <h4>{c.title}</h4>
                <ul>{(c.items || []).map((it, k) => <li key={k}>{it}</li>)}</ul>
              </div>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

/* ════ EDITOR DE ARTÍCULO ════ */
function ArticleEditor({ article, author, onClose, onSave }) {
  const [f, setF] = useState({
    title: article.title || '', category: article.category || NEWS_CATEGORIES[0],
    cover: article.cover || '', photo: article.photo || '',
    excerpt: article.excerpt || '', body: article.body || '',
    author: article.author || author, status: article.status || 'borrador',
    links: article.links || [],
    scheduledDate: article.scheduledDate || '',
    seoDescription: article.seoDescription || '',
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const addLink = () => set('links', [...f.links, { label: '', url: '' }])
  const setLink = (i, k, v) => set('links', f.links.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  const delLink = (i) => set('links', f.links.filter((_, idx) => idx !== i))
  const save = () => { if (!f.title.trim()) { toast('El título es obligatorio', 'error'); return } onSave(f) }

  return (
    <motion.div className="gg-ned-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-ned" onClick={e => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
        <div className="gg-ned__head"><h3>{(article._id || article.id) ? 'Editar artículo' : 'Nuevo artículo'}</h3><button onClick={onClose}>{Icon.x}</button></div>
        <div className="gg-ned__cols">
          <div className="gg-ned__form">
            <label>Título<input value={f.title} onChange={e => set('title', e.target.value)} placeholder="Título del artículo" /></label>
            <div className="gg-ned__row">
              <label>Categoría<select value={f.category} onChange={e => set('category', e.target.value)}>{NEWS_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Autor<input value={f.author} onChange={e => set('author', e.target.value)} /></label>
            </div>
            <div className="gg-ned__prefill">{Icon.bolt} La fecha y el tiempo de lectura se calculan al guardar. Vistas, clics y compartidos los cuenta el servidor con el tráfico real.</div>
            <div className="gg-ned__row">
              <ImageInput label="Foto de portada" value={f.cover} onChange={v => set('cover', v)} tall />
              <ImageInput label="Foto del artículo" value={f.photo} onChange={v => set('photo', v)} tall />
            </div>
            
            <div className="gg-ned__row">
              <label>Programar Publicación (Opcional)
                <input type="date" value={f.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
              </label>
              <label>Meta Descripción SEO
                <textarea rows={1} value={f.seoDescription} onChange={e => set('seoDescription', e.target.value)} placeholder="Breve extracto para motores de búsqueda..." style={{ resize: 'none' }} />
              </label>
            </div>

            <label>Resumen<textarea rows={2} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="Resumen corto que aparece en la tarjeta" /></label>
            <label>Cuerpo<textarea rows={6} value={f.body} onChange={e => set('body', e.target.value)} placeholder="Contenido del artículo…" /></label>
            <div className="gg-ned__links">
              <div className="gg-ned__links-head"><span>Enlaces</span><button onClick={addLink}>{Icon.plus} Añadir enlace</button></div>
              {f.links.map((l, i) => (
                <div key={i} className="gg-ned__link">
                  <input placeholder="Texto" value={l.label} onChange={e => setLink(i, 'label', e.target.value)} />
                  <input placeholder="https://…" value={l.url} onChange={e => setLink(i, 'url', e.target.value)} />
                  <button onClick={() => delLink(i)}>{Icon.x}</button>
                </div>
              ))}
            </div>
            <div className="gg-ned__statusrow">
              {['borrador', 'publicado'].map(s => <button key={s} type="button" className={f.status === s ? 'on' : ''} onClick={() => set('status', s)}>{s}</button>)}
            </div>
          </div>
          <div className="gg-ned__preview">
            <span className="gg-ned__preview-label">Vista previa</span>
            <div className="gg-news__card">
              <div className="gg-news__cover" style={f.cover ? { backgroundImage: `url(${f.cover})` } : undefined}>{!f.cover && <span>{Icon.news}</span>}<span className={`gg-news__state ${f.status}`}>{f.status}</span></div>
              <div className="gg-news__body">
                <span className="gg-news__cat">{f.category}</span>
                <h3>{f.title || 'Título del artículo'}</h3>
                <p>{f.excerpt || 'Resumen del artículo…'}</p>
                {f.seoDescription && (
                  <p style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4 }}>
                    <strong>Meta SEO:</strong> {f.seoDescription}
                  </p>
                )}
                {f.scheduledDate && (
                  <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                    ⏱️ Programado: {fmtDate(f.scheduledDate)}
                  </p>
                )}
                <div className="gg-news__meta" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {article.publicCode && <code className="gg-news-code" title={article.internalCode}>{article.publicCode}</code>}
                  <span>{f.author}</span>
                  <span>{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="gg-ned__foot">
          <button className="gg-ned__btn ghost" onClick={onClose}>Cancelar</button>
          <button className="gg-ned__btn primary" onClick={save}>{Icon.check} Guardar</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ════ EDITOR DE ANUNCIO ════ */
function AnnouncementEditor({ ann, onClose, onSave }) {
  const [f, setF] = useState({
    type: ann.type || 'evento', title: ann.title || '', message: ann.message || '',
    link: ann.link || '', date: ann.date || todayISO(), period: ann.period || 'todo', active: ann.active ?? true,
  })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const save = () => { if (!f.title.trim()) { toast('El título es obligatorio', 'error'); return } onSave(f) }
  const ty = ANNOUNCEMENT_TYPES[f.type]

  return (
    <motion.div className="gg-ned-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-ned gg-ned--sm" onClick={e => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
        <div className="gg-ned__head"><h3>{ann.id ? 'Editar anuncio' : 'Nuevo anuncio'}</h3><button onClick={onClose}>{Icon.x}</button></div>
        <div className="gg-ned__form">
          <span className="gg-ned__sublabel">Tipo de anuncio</span>
          <div className="gg-ann__typepick">
            {Object.entries(ANNOUNCEMENT_TYPES).map(([k, v]) => (
              <button key={k} type="button" className={`gg-ann__typebtn ${f.type === k ? 'on' : ''}`} style={{ '--c': v.color }} onClick={() => set('type', k)}>
                {Icon[v.icon]}<span>{v.label}</span>
              </button>
            ))}
          </div>
          <label>Título<input value={f.title} onChange={e => set('title', e.target.value)} placeholder="Título del anuncio" /></label>
          <label>Mensaje<textarea rows={3} value={f.message} onChange={e => set('message', e.target.value)} placeholder="Texto del anuncio…" /></label>
          <label>Enlace (opcional)<input value={f.link} onChange={e => set('link', e.target.value)} placeholder="/torneos/3 o https://…" /></label>
          <div className="gg-ned__row">
            <label>Fecha en que se muestra<input type="date" value={f.date} onChange={e => set('date', e.target.value)} /></label>
            <label>Franja<select value={f.period} onChange={e => set('period', e.target.value)}>{Object.entries(ANNOUNCEMENT_PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <label className="gg-ned__check"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> Activo (visible en la web)</label>
          <div className="gg-ann__preview" style={{ '--c': ty.color }}>
            <div className="gg-ann__icon">{Icon[ty.icon]}</div>
            <div><b>{f.title || 'Título del anuncio'}</b><p>{f.message || 'Mensaje…'}</p></div>
          </div>
        </div>
        <div className="gg-ned__foot">
          <button className="gg-ned__btn ghost" onClick={onClose}>Cancelar</button>
          <button className="gg-ned__btn primary" onClick={save}>{Icon.check} Guardar</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ════ EDITOR DE CHANGELOG ════ */
function ChangelogEditor({ onClose, onSave }) {
  const [f, setF] = useState({ version: '', type: 'feature', title: '', items: '' })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const save = () => {
    if (!f.title.trim()) { toast('El título es obligatorio', 'error'); return }
    onSave({ version: f.version || 'v—', type: f.type, title: f.title, items: f.items.split('\n').map(s => s.trim()).filter(Boolean) })
  }
  return (
    <motion.div className="gg-ned-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-ned gg-ned--sm" onClick={e => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
        <div className="gg-ned__head"><h3>Nueva entrada de changelog</h3><button onClick={onClose}>{Icon.x}</button></div>
        <div className="gg-ned__form">
          <div className="gg-ned__row">
            <label>Versión<input value={f.version} onChange={e => set('version', e.target.value)} placeholder="v2.4" /></label>
            <label>Tipo<select value={f.type} onChange={e => set('type', e.target.value)}>{Object.entries(CHANGELOG_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          </div>
          <label>Título<input value={f.title} onChange={e => set('title', e.target.value)} placeholder="Resumen del cambio" /></label>
          <label>Detalles (uno por línea)<textarea rows={4} value={f.items} onChange={e => set('items', e.target.value)} placeholder={'Nuevo panel X\nCorrección de Y'} /></label>
        </div>
        <div className="gg-ned__foot">
          <button className="gg-ned__btn ghost" onClick={onClose}>Cancelar</button>
          <button className="gg-ned__btn primary" onClick={save}>{Icon.check} Añadir</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

