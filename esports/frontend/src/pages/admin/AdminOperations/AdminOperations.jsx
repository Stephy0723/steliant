import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import './AdminOperations.css'

const MODULE_LABELS = {
  system_ticket: 'Tickets',
  game_request: 'Juegos',
  role_application: 'Roles',
  brand_application: 'Marcas',
  brand_ticket: 'Soporte marca',
  payment: 'Pagos',
  tournament: 'Torneos',
  university: 'Universidad',
  report: 'Reportes',
}

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_user: 'Esperando usuario',
  closed: 'Cerrado',
  pending: 'Pendiente',
  reviewing: 'En revision',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  draft: 'Borrador',
}

const STATUS_OPTIONS = {
  system_ticket: ['open', 'in_progress', 'waiting_user', 'closed'],
  brand_ticket: ['open', 'in_progress', 'closed'],
  game_request: ['pending', 'reviewing', 'approved', 'rejected'],
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function renderTemplate(template, item, extra = '') {
  const base = template?.body || ''
  return [base
    .replaceAll('{{subject}}', item?.title || 'tu solicitud')
    .replaceAll('{{ticket}}', item?.ticketCode || 'ticket')
    .replaceAll('{{requester}}', item?.requesterName || 'usuario'), extra]
    .filter(Boolean)
    .join('\n\n')
}

export default function AdminOperations() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [logs, setLogs] = useState([])
  const [templates, setTemplates] = useState([])
  const [activeId, setActiveId] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = async () => {
    const [queue, templateData, logData] = await Promise.all([
      api('/admin/operations/queue'),
      api('/admin/operations/templates'),
      api('/admin/operations/logs'),
    ])
    setItems(queue.items || [])
    setTemplates(templateData || [])
    setLogs(logData || [])
    setActiveId(current => (queue.items || []).some(item => item.id === current) ? current : '')
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [queue, templateData, logData] = await Promise.all([
          api('/admin/operations/queue'),
          api('/admin/operations/templates'),
          api('/admin/operations/logs'),
        ])
        if (cancelled) return
        setItems(queue.items || [])
        setTemplates(templateData || [])
        setLogs(logData || [])
        setActiveId(current => (queue.items || []).some(item => item.id === current) ? current : '')
      } catch {
        if (!cancelled) setNotice('No se pudo cargar el centro operativo.')
      }
    }
    run()
    const timer = setInterval(run, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const modules = useMemo(() => {
    const found = new Set(items.map(item => item.module))
    return ['all', ...Array.from(found)]
  }, [items])

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter(item => {
      if (moduleFilter !== 'all' && item.module !== moduleFilter) return false
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false
      if (!needle) return true
      return [item.title, item.description, item.ticketCode, item.requesterName, item.kind]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [items, moduleFilter, priorityFilter, query])

  const active = filteredItems.find(item => item.id === activeId) || null
  const activeTemplates = templates.filter(t => t.module === 'all' || t.module === active?.module)
  const selectedTemplate = activeTemplates.find(t => t._id === templateId) || activeTemplates[0] || null
  const preview = active ? renderTemplate(selectedTemplate, active, manual.trim()) : ''
  const statusOptions = STATUS_OPTIONS[active?.module] || []

  useEffect(() => {
    if (activeTemplates.length && !activeTemplates.some(t => t._id === templateId)) {
      setTemplateId(activeTemplates[0]._id)
    }
  }, [active?.module, activeTemplates.length])

  const runAction = async (action) => {
    if (!active || busy) return
    setBusy(true)
    setNotice('')
    try {
      if (action === 'assign') {
        await api(`/admin/operations/items/${active.module}/${active.id}/assign`, { method: 'POST', body: {} })
        setNotice('Ticket asignado.')
      }
      if (action.startsWith('status:')) {
        const status = action.split(':')[1]
        await api(`/admin/operations/items/${active.module}/${active.id}/status`, { method: 'POST', body: { status } })
        setNotice(`Estado actualizado: ${STATUS_LABELS[status] || status}.`)
      }
      if (action === 'reply') {
        if (!preview.trim()) {
          setNotice('Escribe o selecciona una respuesta.')
          return
        }
        await api(`/admin/operations/items/${active.module}/${active.id}/reply`, { method: 'POST', body: { message: preview, close: selectedTemplate?.key === 'RESOLVED' } })
        setManual('')
        setNotice('Respuesta enviada y notificada al usuario.')
      }
      await load()
      window.dispatchEvent(new CustomEvent('gg-admin-summary:update'))
    } catch (error) {
      setNotice(error.message || 'No se pudo completar la accion.')
    } finally {
      setBusy(false)
    }
  }

  const counts = useMemo(() => ({
    total: items.length,
    unread: items.filter(item => item.unread > 0).length,
    urgent: items.filter(item => ['urgent', 'high'].includes(item.priority)).length,
    assigned: items.filter(item => item.assignedTo).length,
  }), [items])

  return (
    <main className="gg-ops">
      <header className="gg-ops__hero">
        <div>
          <span className="gg-ops__eyebrow">{Icon.bolt} Centro operativo</span>
          <h1>Tickets, solicitudes y revisiones en una sola cola</h1>
          <p>Todo lo que entra al panel admin queda visible, asignable, respondible y registrado para seguimiento.</p>
        </div>
        <button type="button" className="gg-ops__refresh" onClick={load} disabled={busy}>
          {Icon.refresh} Actualizar
        </button>
      </header>

      <section className="gg-ops__metrics" aria-label="Resumen operativo">
        <div><span>Total</span><b>{counts.total}</b></div>
        <div><span>Sin leer</span><b>{counts.unread}</b></div>
        <div><span>Alta prioridad</span><b>{counts.urgent}</b></div>
        <div><span>Asignados</span><b>{counts.assigned}</b></div>
      </section>

      <section className="gg-ops__filters">
        <label>
          <span>{Icon.search}</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por ID, usuario, asunto o origen" />
        </label>
        <select value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}>
          {modules.map(module => <option key={module} value={module}>{module === 'all' ? 'Todos los modulos' : MODULE_LABELS[module] || module}</option>)}
        </select>
        <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}>
          <option value="all">Todas las prioridades</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </section>

      {notice && <div className="gg-ops__notice">{notice}</div>}

      <div className="gg-ops__workspace">
        <section className="gg-ops__queue" aria-label="Cola de operaciones">
          {filteredItems.map(item => (
            <div
              role="button"
              tabIndex={0}
              key={`${item.module}-${item.id}`}
              className={`gg-ops-item ${active?.id === item.id ? 'is-active' : ''}`}
              onClick={() => setActiveId(item.id)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setActiveId(item.id) }}
            >
              <span className={`gg-ops-item__priority is-${item.priority}`} />
              <span className="gg-ops-item__main">
                <b>{item.title}</b>
                <small>{item.ticketCode || item.id}</small>
                <em>{item.requesterName} - {formatDate(item.updatedAt || item.createdAt)}</em>
              </span>
              <span className="gg-ops-item__side">
                <i>{MODULE_LABELS[item.module] || item.module}</i>
                {item.unread > 0 && <strong>{item.unread}</strong>}
              </span>
              <span className="gg-ops-item__chevron">{Icon.chevronRight}</span>
            </div>
          ))}
          {!filteredItems.length && (
            <div className="gg-ops__empty">{Icon.check}<p>No hay elementos con esos filtros.</p></div>
          )}
        </section>

        <aside className="gg-ops__logs" aria-label="Bitacora">
          <h3>{Icon.clock} Bitacora reciente</h3>
          {logs.slice(0, 16).map(log => (
            <article key={log._id}>
              <b>{log.action}</b>
              <span>{log.summary || log.targetCode || log.targetId}</span>
              <small>{log.actorName || log.actor?.nick || 'Admin'} - {formatDate(log.createdAt)}</small>
            </article>
          ))}
          {!logs.length && <p className="gg-ops__muted">Aun no hay acciones registradas.</p>}
        </aside>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="gg-ops-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveId('')}
          >
            <motion.aside
              className="gg-ops-panel"
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={event => event.stopPropagation()}
              aria-label="Detalle operativo"
            >
              <div className="gg-ops-detail__head">
                <div>
                  <span>{MODULE_LABELS[active.module] || active.module}</span>
                  <h2>{active.title}</h2>
                  <p>{active.description || 'Sin descripcion adicional.'}</p>
                </div>
                <button type="button" className="gg-ops-panel__close" onClick={() => setActiveId('')} aria-label="Cerrar">
                  {Icon.x}
                </button>
              </div>

              <div className="gg-ops-panel__body">
                <button type="button" className="gg-ops-open-module" onClick={() => navigate(active.actionPath || '/admin/reportes')}>
                  {Icon.eye} Abrir modulo
                </button>

                <div className="gg-ops-detail__meta">
                  <div><span>ID ticket</span><b>{active.ticketCode || active.id}</b></div>
                  <div><span>Creador</span><b>{active.requesterName}</b></div>
                  <div><span>Estado</span><b>{STATUS_LABELS[active.status] || active.status}</b></div>
                  <div><span>Prioridad</span><b>{active.priority}</b></div>
                  <div><span>Creado</span><b>{formatDate(active.createdAt)}</b></div>
                  <div><span>Actualizado</span><b>{formatDate(active.updatedAt)}</b></div>
                </div>

                <div className="gg-ops-actions">
                  {active.actions?.includes('assign') && (
                    <button type="button" onClick={() => runAction('assign')} disabled={busy}>{Icon.user} Tomar caso</button>
                  )}
                  {statusOptions.map(status => (
                    <button type="button" key={status} onClick={() => runAction(`status:${status}`)} disabled={busy || active.status === status}>
                      {STATUS_LABELS[status] || status}
                    </button>
                  ))}
                </div>

                {active.actions?.includes('reply') && (
                  <div className="gg-ops-reply">
                    <div className="gg-ops-reply__top">
                      <label>
                        Plantilla
                        <select value={selectedTemplate?._id || ''} onChange={event => setTemplateId(event.target.value)}>
                          {activeTemplates.map(template => (
                            <option key={template._id} value={template._id}>{template.title}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Texto manual destacado
                        <textarea
                          value={manual}
                          onChange={event => setManual(event.target.value)}
                          placeholder="Agrega contexto humano: solucion, siguiente paso, evidencia solicitada, fecha limite..."
                        />
                      </label>
                    </div>
                    <div className="gg-ops-preview">
                      <span>Vista previa</span>
                      <p>{preview || 'Selecciona una plantilla o escribe una respuesta.'}</p>
                    </div>
                    <button type="button" className="gg-ops-send" onClick={() => runAction('reply')} disabled={busy}>
                      {Icon.send} Enviar respuesta y notificar
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

