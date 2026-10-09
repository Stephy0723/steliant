import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { MODERATION_TYPES } from '../../../data/admin.js'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import './AdminModeration.css'

// Lo que cada tipo le hace de verdad a la cuenta (ver moderation.controller.js).
const MODERATION_EFFECT = {
  ban: 'Bloquea la cuenta: no puede iniciar sesión ni usar la plataforma hasta que se registre una Reactivación.',
  mute: 'Restricción temporal: no puede publicar, comentar ni mandar mensajes durante los días indicados. Se le avisa por notificación y correo.',
  warning: 'Advertencia formal: se le envía por notificación y correo y queda en su historial. No limita la cuenta.',
  unban: 'Levanta el baneo y cualquier restricción vigente de la cuenta, y se le avisa.',
}

export default function AdminModeration() {
  const { user } = useAuth()
  const [moderation, setModeration] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const load = () => {
    setLoading(true)
    api('/admin/moderation')
      .then(res => setModeration(Array.isArray(res.sanctions) ? res.sanctions : []))
      .catch(() => toast('No se pudo cargar el historial de moderación', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const shown = moderation.filter(m => {
    const mf = filter === 'Todos' || m.type === filter
    const ms = !search || [m.user, m.action, m.reason, m.mod].some(v => String(v).toLowerCase().includes(search.toLowerCase()))
    return mf && ms
  })
  const counts = useMemo(() => {
    const c = { total: moderation.length }
    Object.keys(MODERATION_TYPES).forEach(k => { c[k] = moderation.filter(m => m.type === k).length })
    return c
  }, [moderation])

  const create = async (data) => {
    try {
      const res = await api('/admin/moderation', { method: 'POST', body: data })
      setModeration(prev => [res.sanction, ...prev])
      toast('Acción registrada', 'success')
      setOpen(false)
    } catch (error) {
      toast(error.message || 'No se pudo registrar la acción', 'error')
    }
  }

  const remove = async (id) => {
    try {
      await api(`/admin/moderation/${id}`, { method: 'DELETE' })
      setModeration(prev => prev.filter(m => m.id !== id))
      toast('Acción eliminada', 'error')
    } catch (error) {
      toast(error.message || 'No se pudo eliminar', 'error')
    }
  }

  return (
    <div className="gg-admin-page gg-mod">
      <div className="gg-admin-page__header">
        <div><h2>Moderación</h2><p>{counts.total} acciones · {counts.ban || 0} baneos · {counts.warning || 0} advertencias</p></div>
        <button className="gg-mod__new" onClick={() => setOpen(true)}>{Icon.plus} Nueva acción</button>
      </div>

      <div className="gg-mod__kpis">
        {Object.entries(MODERATION_TYPES).map(([k, v]) => (
          <div key={k} className="gg-mod__kpi" style={{ '--c': v.color }}>
            <span className="gg-mod__kpi-icon">{Icon[v.icon]}</span>
            <div><b>{counts[k] || 0}</b><small>{v.label}</small></div>
          </div>
        ))}
      </div>

      <div className="gg-admin-controls">
        <div className="gg-admin-filter-tabs">
          <button className={`gg-admin-filter-tab ${filter === 'Todos' ? 'active' : ''}`} onClick={() => setFilter('Todos')}>Todos</button>
          {Object.entries(MODERATION_TYPES).map(([k, v]) => (
            <button key={k} className={`gg-admin-filter-tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{v.label}</button>
          ))}
        </div>
        <div className="gg-admin-search">
          <span className="gg-admin-search__icon">{Icon.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuario, acción o moderador…" />
          {search && <button className="gg-admin-search__clear" onClick={() => setSearch('')}>{Icon.x}</button>}
        </div>
      </div>

      <div className="gg-mod__list">
        {loading ? (
          <div className="gg-mod__empty">Cargando...</div>
        ) : shown.map((m, i) => {
          const ty = MODERATION_TYPES[m.type] || MODERATION_TYPES.warning
          return (
            <motion.div key={m.id} className="gg-mod__card" style={{ '--c': ty.color }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="gg-mod__icon">{Icon[ty.icon]}</div>
              <div className="gg-mod__main">
                <div className="gg-mod__top"><b>{m.user}</b><span className="gg-mod__type">{ty.label}</span></div>
                <p className="gg-mod__action">{m.action}</p>
                <p className="gg-mod__reason">{Icon.alert} {m.reason}</p>
              </div>
              <div className="gg-mod__side">
                <span className="gg-mod__mod">{Icon.shield} {m.mod}</span>
                <span className="gg-mod__date">{m.date}</span>
                <button className="gg-mod__del" onClick={() => remove(m.id)}>{Icon.trash}</button>
              </div>
            </motion.div>
          )
        })}
        {!loading && shown.length === 0 && <div className="gg-mod__empty">Sin acciones con ese criterio.</div>}
      </div>

      <AnimatePresence>
        {open && <ModerationEditor mod={user?.nick || 'Admin'} onClose={() => setOpen(false)} onSave={create} />}
      </AnimatePresence>
    </div>
  )
}

function ModerationEditor({ mod, onClose, onSave }) {
  const [f, setF] = useState({ user: '', type: 'warning', action: '', reason: '', durationDays: 7 })
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const save = () => {
    if (!f.user.trim()) { toast('Indica la cuenta', 'error'); return }
    if (f.type !== 'unban' && !f.reason.trim()) { toast('Indica el motivo', 'error'); return }
    onSave({ ...f, user: f.user.trim(), durationDays: Number(f.durationDays) || 7 })
  }
  return (
    <motion.div className="gg-ned-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-ned gg-ned--sm" onClick={e => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
        <div className="gg-ned__head"><h3>Nueva acción de moderación</h3><button onClick={onClose}>{Icon.x}</button></div>
        <div className="gg-ned__form">
          <label>Cuenta<input value={f.user} onChange={e => set('user', e.target.value)} placeholder="Nick, email o ID de jugador" /></label>
          <span className="gg-ned__sublabel">Tipo de acción</span>
          <div className="gg-mod__typepick">
            {Object.entries(MODERATION_TYPES).map(([k, v]) => (
              <button key={k} type="button" className={`gg-mod__typebtn ${f.type === k ? 'on' : ''}`} style={{ '--c': v.color }} onClick={() => set('type', k)}>{Icon[v.icon]}<span>{v.label}</span></button>
            ))}
          </div>
          <p className="gg-mod__effect">{MODERATION_EFFECT[f.type]}</p>
          {f.type === 'mute' && (
            <label>Duración (días)<input type="number" min={1} max={365} value={f.durationDays} onChange={e => set('durationDays', e.target.value)} /></label>
          )}
          <label>Detalle de la acción (opcional)<input value={f.action} onChange={e => set('action', e.target.value)} placeholder={MODERATION_TYPES[f.type].label} /></label>
          <label>Motivo<textarea rows={2} value={f.reason} onChange={e => set('reason', e.target.value)} placeholder="Motivo de la sanción" /></label>
          <label>Moderador<input value={mod} readOnly title="Se registra con tu propia cuenta de admin" /></label>
        </div>
        <div className="gg-ned__foot">
          <button className="gg-ned__btn ghost" onClick={onClose}>Cancelar</button>
          <button className="gg-ned__btn primary" onClick={save}>{Icon.check} Registrar</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

