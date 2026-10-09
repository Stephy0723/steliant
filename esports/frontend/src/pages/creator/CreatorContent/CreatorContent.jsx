import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
const CREATOR_CONTENT = []
const CONTENT_STATUS_LABEL = { published: 'Publicado', scheduled: 'Programado', draft: 'Borrador', review: 'En revisión' }
import './CreatorContent.css'

const FILTERS = [
  { key: 'all',       label: 'Todo' },
  { key: 'published', label: 'Publicado' },
  { key: 'scheduled', label: 'Programado' },
  { key: 'draft',     label: 'Borradores' },
]

const TYPE_COLORS = { Clip: '#FF4655', VOD: '#7c3aed', Tutorial: '#1E9DE3' }

export default function CreatorContent() {
  const [items, setItems] = useState(CREATOR_CONTENT)
  const [filter, setFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'Clip', game: 'Valorant' })

  const filtered = items.filter(i => filter === 'all' || i.status === filter)
  const counts = items.reduce((a, i) => ({ ...a, [i.status]: (a[i.status] || 0) + 1 }), {})

  const addContent = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setItems(prev => [{
      id: Date.now(), title: form.title.trim(), type: form.type, game: form.game,
      status: 'draft', views: 0, likes: 0, duration: '—', date: 'Borrador',
      thumb: TYPE_COLORS[form.type] || '#22c55e',
    }, ...prev])
    setForm({ title: '', type: 'Clip', game: 'Valorant' })
    setShowUpload(false)
  }

  const remove = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const publish = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'published', date: 'Hoy' } : i))

  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Contenido</h1>
          <p>Sube, programa y gestiona tus clips, VODs y tutoriales.</p>
        </div>
        <button className="pnl-btn pnl-btn--primary" onClick={() => setShowUpload(true)}>
          {Icon.upload} Subir contenido
        </button>
      </div>

      <div className="cct-filters">
        {FILTERS.map(f => (
          <button key={f.key} className={`cct-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}{f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
          </button>
        ))}
      </div>

      <div className="cct-grid">
        {filtered.map((c, i) => (
          <motion.article
            key={c.id} className="cct-card"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          >
            <div className="cct-card__thumb" style={{ background: `linear-gradient(135deg, ${c.thumb}, #0c0f0d)` }}>
              <span className="cct-card__type">{c.type}</span>
              <span className="cct-card__dur">{c.duration}</span>
              <span className="cct-card__play">{Icon.play}</span>
            </div>
            <div className="cct-card__body">
              <h3>{c.title}</h3>
              <div className="cct-card__meta">
                <span className="pnl-tag">{c.game}</span>
                <span className={`pnl-tag ${c.status === 'published' ? 'pnl-tag--ok' : c.status === 'scheduled' ? 'pnl-tag--accent' : 'pnl-tag--warn'}`}>
                  {CONTENT_STATUS_LABEL[c.status]}
                </span>
              </div>
              {c.status === 'published' ? (
                <div className="cct-card__stats">
                  <span>{Icon.eye} {c.views.toLocaleString()}</span>
                  <span>{Icon.heart} {c.likes.toLocaleString()}</span>
                  <span className="cct-card__date">{c.date}</span>
                </div>
              ) : (
                <div className="cct-card__stats"><span className="cct-card__date">{c.date}</span></div>
              )}
              <div className="cct-card__actions">
                {c.status !== 'published' && (
                  <button className="pnl-link" onClick={() => publish(c.id)}>{Icon.check} Publicar</button>
                )}
                <button className="cct-card__del" onClick={() => remove(c.id)} title="Eliminar">{Icon.trash}</button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="pnl-empty">
          <div className="pnl-empty__icon">{Icon.tv}</div>
          <h3>Sin contenido en esta categoría</h3>
          <p>Sube tu primer clip o VOD para empezar.</p>
        </div>
      )}

      {/* Modal de subida */}
      <AnimatePresence>
        {showUpload && (
          <motion.div className="cct-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpload(false)}>
            <motion.form
              className="cct-modal" onClick={e => e.stopPropagation()} onSubmit={addContent}
              initial={{ opacity: 0, scale: .96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }}
            >
              <div className="cct-modal__head">
                <h3>Subir contenido</h3>
                <button type="button" className="cct-modal__close" onClick={() => setShowUpload(false)}>{Icon.x}</button>
              </div>
              <div className="cct-dropzone">{Icon.upload}<span>Arrastra tu archivo aquí o haz clic para seleccionar</span><small>MP4, MOV · máx 2GB</small></div>
              <label className="cct-field">
                <span>Título</span>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej. Clutch 1v5 en la final…" autoFocus />
              </label>
              <div className="cct-field-row">
                <label className="cct-field">
                  <span>Tipo</span>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option>Clip</option><option>VOD</option><option>Tutorial</option>
                  </select>
                </label>
                <label className="cct-field">
                  <span>Juego</span>
                  <select value={form.game} onChange={e => setForm(f => ({ ...f, game: e.target.value }))}>
                    <option>Valorant</option><option>LoL</option><option>CS2</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="pnl-btn pnl-btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                {Icon.plus} Crear borrador
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

