import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../../../components/Button/Button.jsx'
import Badge from '../../../components/Badge/Badge.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { uploadFile } from '../../../lib/uploadsApi.js'
import { toast } from '../../../lib/toast.js'
import '../../../components/UniCard/UniCard.css'

// Catálogo de universidades editable sin tocar código (restaurado de d62aaa5,
// se había perdido en un merge). Los dominios deciden qué correo institucional
// verifica a un estudiante en cada universidad.
const getUniversityGamesCatalog     = () => api('/university/games-catalog')
const adminListUniversityCatalog    = () => api('/university/admin/catalog')
const createUniversityCatalogEntry  = (body) => api('/university/catalog', { method: 'POST', body: JSON.stringify(body) })
const updateUniversityCatalogEntry  = (id, body) => api(`/university/catalog/${id}`, { method: 'PUT', body: JSON.stringify(body) })
const setUniversityCatalogActive    = (id, active) => api(`/university/catalog/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) })

const EMPTY_FORM = {
  id: '', tag: '', name: '', city: '', founded: '', color: '#333333',
  logo: '', bio: '', verified: false, games: [], programs: [], campuses: [], allowedDomains: [],
}

function ChipsInput({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v || items.includes(v)) return
    onChange([...items, v])
    setDraft('')
  }

  return (
    <div className="auc-field">
      <span>{label}</span>
      <div className="auc-chips-input">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
        />
        <button type="button" onClick={add}>{Icon.plus}</button>
      </div>
      {items.length > 0 && (
        <div className="auc-chips">
          {items.map(it => (
            <span key={it} className="auc-chip">
              {it}
              <button type="button" onClick={() => onChange(items.filter(x => x !== it))}>{Icon.x}</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function EditModal({ uni, allowedGames, onClose, onSaved }) {
  const isNew = !uni
  const [form, setForm] = useState(() => uni ? {
    id: uni.id, tag: uni.tag || '', name: uni.name || '', city: uni.city || '',
    founded: uni.founded || '', color: uni.color || '#333333', logo: uni.logo || '',
    bio: uni.bio || '', verified: Boolean(uni.verified),
    games: uni.games || [], programs: uni.programs || [], campuses: uni.campuses || [],
    allowedDomains: uni.allowedDomains || [],
  } : EMPTY_FORM)
  const [uploading, setUploading] = useState(false)

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('El logo debe ser una imagen.'); return }
    setUploading(true)
    try {
      const res = await uploadFile(file)
      set('logo', res.url)
    } catch (err) {
      setError(err.message || 'No se pudo subir el logo.')
    } finally {
      setUploading(false)
    }
  }
  const [saving, setSaving]  = useState(false)
  const [error, setError]    = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleGame = (g) => set('games', form.games.includes(g) ? form.games.filter(x => x !== g) : [...form.games, g])

  const submit = async () => {
    setError('')
    if (isNew && !/^[a-z0-9][a-z0-9-]{1,29}$/.test(form.id.trim().toLowerCase())) {
      setError('El ID debe ser minúsculas, sin espacios, 2-30 caracteres (a-z, 0-9, guiones). Ej: "intec".')
      return
    }
    if (!form.tag.trim() || !form.name.trim()) {
      setError('Tag y nombre son obligatorios.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        tag: form.tag.trim(), name: form.name.trim(), city: form.city.trim(),
        founded: form.founded === '' ? null : Number(form.founded),
        color: form.color, logo: form.logo.trim(), bio: form.bio.trim(),
        verified: form.verified, games: form.games, programs: form.programs, campuses: form.campuses,
        allowedDomains: form.allowedDomains,
      }
      if (isNew) {
        await createUniversityCatalogEntry({ id: form.id.trim().toLowerCase(), ...payload })
      } else {
        await updateUniversityCatalogEntry(uni.id, payload)
      }
      toast(isNew ? 'Universidad agregada' : 'Cambios guardados', 'success')
      onSaved()
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div className="auc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="auc-modal" initial={{ opacity: 0, scale: .95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }}>
        <div className="auc-modal__head">
          <h3>{isNew ? 'Agregar universidad' : `Editar ${uni.name}`}</h3>
          <button onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="auc-modal__body">
          <div className="auc-row">
            {isNew && (
              <label className="auc-field">
                <span>ID único *</span>
                <input value={form.id} onChange={e => set('id', e.target.value)} placeholder="ej: intec" />
              </label>
            )}
            <label className="auc-field">
              <span>Tag / sigla *</span>
              <input value={form.tag} onChange={e => set('tag', e.target.value)} placeholder="INTEC" maxLength={20} />
            </label>
          </div>

          <label className="auc-field">
            <span>Nombre completo *</span>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Instituto Tecnológico de Santo Domingo" />
          </label>

          <div className="auc-row">
            <label className="auc-field">
              <span>Ciudad</span>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Santo Domingo" />
            </label>
            <label className="auc-field">
              <span>Fundada (año)</span>
              <input type="number" value={form.founded} onChange={e => set('founded', e.target.value)} placeholder="1972" />
            </label>
          </div>

          <div className="auc-row">
            <label className="auc-field">
              <span>Color de marca</span>
              <div className="auc-color-row">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#333333'} onChange={e => set('color', e.target.value)} />
                <input value={form.color} onChange={e => set('color', e.target.value)} placeholder="#002D72" />
              </div>
            </label>
            <div className="auc-field">
              <span>Logo</span>
              <div className="auc-logo-row">
                <div className="auc-logo-preview">{form.logo ? <img src={form.logo} alt="" /> : (form.tag || '?')}</div>
                <label className="auc-logo-upload">
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} hidden />
                  {Icon.upload} {uploading ? 'Subiendo…' : 'Subir imagen'}
                </label>
              </div>
              <input value={form.logo} onChange={e => set('logo', e.target.value)} placeholder="o pega una URL: /universities/intec.png" />
            </div>
          </div>

          <label className="auc-field">
            <span>Bio / descripción</span>
            <textarea rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} maxLength={600} />
          </label>

          <label className="auc-checkbox">
            <input type="checkbox" checked={form.verified} onChange={e => set('verified', e.target.checked)} />
            <span>Universidad verificada (socia oficial)</span>
          </label>

          <div className="auc-field">
            <span>Juegos activos</span>
            <div className="auc-game-grid">
              {allowedGames.map(g => (
                <label key={g} className={`auc-game-chip ${form.games.includes(g) ? 'active' : ''}`}>
                  <input type="checkbox" checked={form.games.includes(g)} onChange={() => toggleGame(g)} />
                  {g}
                </label>
              ))}
            </div>
          </div>

          <ChipsInput label="Carreras / programas" items={form.programs} onChange={v => set('programs', v)} placeholder="Ingeniería de Software" />
          <ChipsInput label="Campus (opcional, si no agregas ninguno se usa la ciudad)" items={form.campuses} onChange={v => set('campuses', v)} placeholder="Santo Domingo" />
          <ChipsInput label="Dominios del correo institucional (sin dominios nadie puede verificarse)" items={form.allowedDomains} onChange={v => set('allowedDomains', v.map(d => d.toLowerCase().replace(/^@/, '')))} placeholder="intec.edu.do" />

          {error && <p className="auc-error">{error}</p>}
        </div>

        <div className="auc-modal__foot">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function AdminUniversityCatalogTab() {
  const [list, setList]           = useState([])
  const [games, setGames]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)   // uni object, or {} sentinel for "new"
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([adminListUniversityCatalog(), getUniversityGamesCatalog()])
      .then(([list, g]) => { setList(Array.isArray(list) ? list : []); setGames(g.games || []) })
      .catch(() => { setList([]); setGames([]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async (uni) => {
    try {
      await setUniversityCatalogActive(uni.id, !uni.active)
      load()
    } catch (err) {
      toast(err.message || 'No se pudo cambiar el estado.', 'error')
    }
  }

  const shown = showInactive ? list : list.filter(u => u.active)

  return (
    <div className="auc">
      <div className="auc-toolbar">
        <Button size="sm" variant={showInactive ? 'primary' : 'ghost'} onClick={() => setShowInactive(s => !s)}>
          {showInactive ? 'Ocultar inactivas' : 'Mostrar inactivas'}
        </Button>
        <Button size="sm" variant="primary" onClick={() => setEditing({})}>{Icon.plus} Agregar universidad</Button>
      </div>

      {loading ? (
        <p className="gg-admin-dim au-list__empty">Cargando...</p>
      ) : shown.length === 0 ? (
        <p className="gg-admin-dim au-list__empty">Sin universidades en el catálogo.</p>
      ) : (
        <div className="auc-grid">
          {shown.map(u => (
            <div key={u.id} className={`gg-uni-card auc-card ${!u.active ? 'inactive' : ''}`} style={{ '--uc': u.color || '#00E676' }} onClick={() => setEditing(u)}>
              <div className="gg-uni-card__banner" />
              <div className="gg-uni-card__logo" style={{ background: u.color || '#00E676' }}>
                {u.logo ? <img src={u.logo} alt={u.tag} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : u.tag}
              </div>
              <div className="gg-uni-card__badges">
                {u.verified && <Badge variant="live">Socia oficial</Badge>}
                {!u.active && <Badge variant="muted">Inactiva</Badge>}
                {!(u.allowedDomains || []).length && <Badge variant="muted">Sin dominios</Badge>}
              </div>
              <h3 className="gg-uni-card__name">{u.name}</h3>
              <p className="gg-uni-card__city">{u.city || 'Sin ciudad'}{u.founded ? ` · ${u.founded}` : ''}</p>
              <div className="auc-card__meta">
                <span>{Icon.gamepad} {(u.games || []).slice(0, 3).join(' · ') || 'Sin juegos'}</span>
                <span>{Icon.globe} {(u.allowedDomains || []).map(d => `@${d}`).join(' · ') || 'Sin dominios de correo'}</span>
              </div>
              <div className="gg-uni-card__stats">
                <div className="gg-uni-card__stat"><span>{u.verifiedStudentsCount || 0}</span><small>Verificados</small></div>
                <div className="gg-uni-card__stat"><span>{u.activeTeamsCount || 0}</span><small>Equipos</small></div>
                <div className="gg-uni-card__stat"><span>{u.tag || '—'}</span><small>Siglas</small></div>
              </div>
              <div className="auc-card__actions" onClick={e => e.stopPropagation()}>
                <button type="button" onClick={() => setEditing(u)}>{Icon.edit} Editar</button>
                <button type="button" className={u.active ? 'is-danger' : 'is-ok'} onClick={() => toggleActive(u)}>
                  {u.active ? Icon.lock : Icon.check} {u.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
              <div className="gg-uni-card__bar" />
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing !== null && (
          <EditModal
            uni={editing.id ? editing : null}
            allowedGames={games}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

