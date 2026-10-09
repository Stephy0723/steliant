import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import './AdminLogs.css'

const MODULE_COLORS = {
  admin_operations: '#3b82f6', moderation: '#f87171', tournaments: '#22c55e',
  news: '#a855f7', payments: '#f59e0b', reports: '#ef4444', users: '#06b6d4',
}

function moduleColor(module) {
  return MODULE_COLORS[module] || '#888'
}

function fmtTimestamp(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('Todos')
  const [admin, setAdmin] = useState('Todos')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api('/admin/operations/logs')
      .then(data => { if (alive) setLogs(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) setError('No se pudo cargar el registro de auditoría.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const modules = useMemo(() => ['Todos', ...new Set(logs.map(l => l.module).filter(Boolean))], [logs])
  const admins = useMemo(() => ['Todos', ...new Set(logs.map(l => l.actor?.nick || l.actorName).filter(Boolean))], [logs])

  const filtered = useMemo(() => logs.filter(l => {
    const adminName = l.actor?.nick || l.actorName || ''
    const q = search.toLowerCase()
    const mq = !q || [adminName, l.action, l.targetCode, l.targetId, l.summary, l.module].some(v => String(v || '').toLowerCase().includes(q))
    return mq && (module === 'Todos' || l.module === module) && (admin === 'Todos' || adminName === admin)
  }), [logs, search, module, admin])

  const todayKey = new Date().toISOString().slice(0, 10)
  const stats = {
    total: logs.length,
    today: logs.filter(l => String(l.createdAt || '').startsWith(todayKey)).length,
    admins: new Set(logs.map(l => l.actor?.nick || l.actorName).filter(Boolean)).size,
  }

  return (
    <div className="gg-admin-page gg-logs">
      <div className="gg-admin-page__header">
        <div>
          <h2>Logs & Auditoría</h2>
          <p>{stats.total} acciones registradas · {stats.today} hoy · {stats.admins} administradores</p>
        </div>
      </div>

      <div className="gg-logs__kpis">
        <div className="gg-logs__kpi"><b>{stats.total}</b><span>Total acciones</span></div>
        <div className="gg-logs__kpi accent"><b>{stats.today}</b><span>Hoy</span></div>
        <div className="gg-logs__kpi"><b>{stats.admins}</b><span>Admins activos</span></div>
      </div>

      <div className="gg-admin-controls">
        <div className="gg-admin-filter-tabs">
          {modules.map(m => (
            <button key={m} className={`gg-admin-filter-tab ${module === m ? 'active' : ''}`} onClick={() => setModule(m)}>{m}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="gg-admin-select" value={admin} onChange={e => setAdmin(e.target.value)} style={{ minWidth: 120 }}>
            {admins.map(a => <option key={a} value={a}>{a === 'Todos' ? 'Todos los admins' : a}</option>)}
          </select>
          <div className="gg-admin-search">
            <span className="gg-admin-search__icon">{Icon.search}</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar acción, admin o target…" />
            {search && <button className="gg-admin-search__clear" onClick={() => setSearch('')}>{Icon.x}</button>}
          </div>
        </div>
      </div>

      <div className="gg-admin-card" style={{ padding: 0 }}>
        <div className="gg-datatable-wrap">
          <table className="gg-datatable gg-logs__table">
            <thead>
              <tr><th>Timestamp</th><th>Admin</th><th>Acción</th><th>Módulo</th><th>Objetivo</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="gg-datatable__empty">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="gg-datatable__empty" style={{ color: '#f87171' }}>{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="gg-datatable__empty">{logs.length === 0 ? 'Todavia no hay acciones registradas.' : 'Sin acciones con ese criterio.'}</td></tr>
              ) : filtered.map((l, i) => {
                const color = moduleColor(l.module)
                return (
                  <motion.tr key={l._id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <td><code className="gg-logs__ts">{fmtTimestamp(l.createdAt)}</code></td>
                    <td><b>{l.actor?.nick || l.actorName || 'Admin'}</b></td>
                    <td>{l.action}</td>
                    <td><span className="gg-logs__mod" style={{ color, background: `${color}1a`, borderColor: `${color}40` }}>{l.module}</span></td>
                    <td><b>{l.targetCode || l.targetId}</b></td>
                    <td><code className="gg-logs__detail">{l.summary || '-'}</code></td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

