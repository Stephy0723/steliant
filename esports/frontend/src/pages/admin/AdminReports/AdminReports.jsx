import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { REPORT_TONES, REPORT_TEMPLATES } from '../../../data/admin.js'
import { useAuth } from '../../../context/AuthContext.jsx'
import { api } from '../../../lib/api.js'
import {
  SYSTEM_TICKET_PRIORITY,
  SYSTEM_TICKET_PURPOSES,
  SYSTEM_TICKET_STATUS,
} from '../../../lib/systemTicketsStore.js'
import { syncTicketToMessenger } from '../../../lib/ticketMessengerBridge.js'
import { toast } from '../../../lib/toast.js'
import './AdminReports.css'

const STATUSES = ['Todos', 'pendiente', 'revision', 'resuelto', 'descartado']
const STATUS_COLOR = {
  pendiente: '#f87171', revision: '#f59e0b', resuelto: '#22c55e', descartado: '#8b938e',
}
const GAME_STATUS_TO_REPORT = { pending: 'pendiente', reviewing: 'revision', approved: 'resuelto', rejected: 'descartado' }
const REPORT_STATUS_TO_GAME = { pendiente: 'pending', revision: 'reviewing', resuelto: 'approved', descartado: 'rejected' }
const TICKET_STATUS_TO_REPORT = { open: 'pendiente', in_progress: 'revision', waiting_user: 'revision', closed: 'resuelto' }
const REPORT_STATUS_TO_TICKET = { pendiente: 'open', revision: 'in_progress', resuelto: 'closed', descartado: 'closed' }
const PURPOSE_LABEL = Object.fromEntries(SYSTEM_TICKET_PURPOSES.map(item => [item.id, item.label]))

function gameRequestToReport(req, source = 'api') {
  return {
    id: `game-request-${req.id || req._id}`,
    gameRequestId: req.id || req._id,
    reporter: req.requesterName || req.requester?.nick || 'Invitado',
    target: req.gameName,
    reason: 'Solicitud de nuevo juego para Comunidad',
    status: GAME_STATUS_TO_REPORT[req.status] || 'pendiente',
    date: req.createdAt
      ? new Date(req.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('es-ES'),
    updates: req.reviewNote ? [{
      id: `review-${req.id || req._id}`,
      author: 'Admin',
      tone: req.status === 'approved' ? 'positivo' : req.status === 'rejected' ? 'negativo' : 'neutro',
      message: req.reviewNote,
      date: req.reviewedAt
        ? new Date(req.reviewedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        : '',
    }] : [],
    source: 'community-game-request',
    gameRequestSource: source,
    details: {
      gameName: req.gameName,
      genre: req.genre,
      platform: req.platform,
      links: req.links,
      message: req.message,
      requestedBy: req.requesterName || req.requester?.nick || 'Invitado',
      requesterEmail: req.requesterEmail || req.requester?.email || '',
      origin: 'Comunidad',
    },
  }
}

function systemTicketToReport(ticket, source = 'api') {
  const firstMessage = ticket.messages?.[0]?.body || ''
  const isUserReport = ticket.sourceType === 'user_report'
  const reportedNick = ticket.metadata?.reportedNick || ''
  const reportReason = ticket.metadata?.reason || ''
  return {
    id: `system-ticket-${ticket.id || ticket._id}`,
    systemTicketId: ticket.id || ticket._id,
    reporter: ticket.requesterName || ticket.requester?.nick || 'Invitado',
    target: isUserReport ? `@${reportedNick || ticket.sourceId}` : (ticket.publicCode || ticket.subject),
    reason: isUserReport ? `Reporte de usuario${reportReason ? ` - ${reportReason}` : ''}` : (ticket.subject || PURPOSE_LABEL[ticket.purpose] || 'Ticket del sistema'),
    status: TICKET_STATUS_TO_REPORT[ticket.status] || 'pendiente',
    date: ticket.createdAt
      ? new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('es-ES'),
    updates: (ticket.messages || []).map((message, index) => ({
      id: `${ticket.id || ticket._id}-${index}`,
      author: message.author === 'admin' ? 'Admin' : (ticket.requesterName || 'Usuario'),
      tone: message.author === 'admin' ? 'positivo' : 'neutro',
      message: message.body,
      date: message.sentAt
        ? new Date(message.sentAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        : '',
    })),
    source: isUserReport ? 'user-report' : 'system-ticket',
    systemTicketSource: source,
    unreadByAdmin: ticket.unreadByAdmin || 0,
    details: {
      code: ticket.publicCode,
      internalCode: ticket.internalCode,
      purpose: PURPOSE_LABEL[ticket.purpose] || ticket.purpose,
      priority: SYSTEM_TICKET_PRIORITY[ticket.priority] || ticket.priority,
      ticketStatus: SYSTEM_TICKET_STATUS[ticket.status] || ticket.status,
      subject: ticket.subject,
      message: firstMessage,
      requestedBy: ticket.requesterName || ticket.requester?.nick || 'Invitado',
      requesterEmail: ticket.requesterEmail || ticket.requester?.email || '',
      sourceType: ticket.sourceType,
      reportedNick,
      reportReason,
    },
  }
}

export default function AdminReports() {
  const [searchParams] = useSearchParams()
  // Ticket de la URL ya abierto: sin esto el efecto de abajo (allReports es un
  // arreglo nuevo en cada render) reabria el panel apenas se cerraba.
  const openedTicketRef = useRef(null)
  const [filter, setFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null) // report id abierto
  const [gameReports, setGameReports] = useState([])
  const [systemReports, setSystemReports] = useState([])

  const loadGameRequests = async () => {
    try {
      const data = await api('/game-requests/admin?status=all')
      const remote = Array.isArray(data.requests) ? data.requests : []
      setGameReports(remote.filter(item => !item.systemTicket && !item.ticket).map(item => gameRequestToReport(item, 'api')))
    } catch {
      setGameReports([])
      toast('No se pudo cargar solicitudes de juego desde backend', 'error')
    }
  }

  const loadSystemTickets = async () => {
    try {
      const data = await api('/system-tickets/admin?status=all')
      const remote = Array.isArray(data.tickets) ? data.tickets : []
      setSystemReports(remote.map(item => systemTicketToReport(item, 'api')))
    } catch {
      setSystemReports([])
      toast('No se pudo cargar tickets desde backend', 'error')
    }
  }

  useEffect(() => {
    loadGameRequests()
    loadSystemTickets()
    const refresh = () => {
      loadGameRequests()
      loadSystemTickets()
    }
    window.addEventListener('gg-game-requests:update', refresh)
    window.addEventListener('gg-system-tickets:update', refresh)
    return () => {
      window.removeEventListener('gg-game-requests:update', refresh)
      window.removeEventListener('gg-system-tickets:update', refresh)
    }
  }, [])

  const allReports = [
    ...systemReports,
    ...gameReports,
  ]

  const shown = allReports.filter(r => {
    const mf = filter === 'Todos' || r.status === filter
    const ms = !search || [
      r.reporter,
      r.target,
      r.reason,
      r.details?.gameName,
      r.details?.genre,
      r.details?.platform,
      r.details?.message,
    ].filter(Boolean).some(v => v.toLowerCase().includes(search.toLowerCase()))
    return mf && ms
  })
  const counts = useMemo(() => ({
    pendiente: allReports.filter(r => r.status === 'pendiente').length,
    revision: allReports.filter(r => r.status === 'revision').length,
    resuelto: allReports.filter(r => r.status === 'resuelto').length,
    descartado: allReports.filter(r => r.status === 'descartado').length,
  }), [allReports])

  const current = allReports.find(r => r.id === open)

  useEffect(() => {
    const ticketKey = searchParams.get('ticket')
    if (!ticketKey || !allReports.length || openedTicketRef.current === ticketKey) return
    const match = allReports.find(report => [
      report.systemTicketId,
      report.details?.code,
      report.details?.internalCode,
      report.target,
    ].filter(Boolean).map(String).includes(String(ticketKey)))
    if (match) {
      openedTicketRef.current = ticketKey
      setOpen(match.id)
    }
  }, [allReports, searchParams])

  const addUpdate = async (report, update) => {
    if (report?.systemTicketId) {
      const replyBody = [update.message, update.note].filter(Boolean).join('\n')

      try {
        const data = await api(`/system-tickets/admin/${report.systemTicketId}/reply`, { method: 'POST', body: { message: replyBody } })
        if (data?.ticket) syncTicketToMessenger(data.ticket, { unread: data.ticket.unreadByUser || 1 })
        await loadSystemTickets()
        return true
      } catch {
        toast('No se pudo responder el ticket', 'error')
      }
      return false
    }

    if (report?.gameRequestId) {
      const apiStatus = REPORT_STATUS_TO_GAME[report.status] || 'pending'
      const reviewNote = [update.message, update.note].filter(Boolean).join('\n')

      try {
        const data = await api(`/game-requests/admin/${report.gameRequestId}`, { method: 'PATCH', body: { status: apiStatus, reviewNote } })
        await loadGameRequests()
        if (data?.request?.ticket) await loadSystemTickets()
        return true
      } catch {
        toast('No se pudo guardar la actualizacion de la solicitud', 'error')
      }
      return false
    }

    toast('Este reporte no tiene respaldo real en backend', 'error')
    return false
  }

  const updateStatus = async (report, status) => {
    if (report?.systemTicketId) {
      const apiStatus = REPORT_STATUS_TO_TICKET[status] || 'open'

      try {
        await api(`/system-tickets/admin/${report.systemTicketId}`, { method: 'PATCH', body: { status: apiStatus } })
        await loadSystemTickets()
      } catch {
        toast('No se pudo actualizar el ticket', 'error')
      }
      return
    }

    if (!report?.gameRequestId) {
      toast('Este reporte no tiene respaldo real en backend', 'error')
      return
    }

    const apiStatus = REPORT_STATUS_TO_GAME[status] || 'pending'

    try {
      const data = await api(`/game-requests/admin/${report.gameRequestId}`, { method: 'PATCH', body: { status: apiStatus } })
      await loadGameRequests()
      if (data?.request?.ticket) await loadSystemTickets()
    } catch {
      toast('No se pudo actualizar la solicitud de juego', 'error')
    }
  }

  const openReport = async (report) => {
    setOpen(report.id)
    if (!report?.systemTicketId || !report.unreadByAdmin) return
    try {
      await api(`/system-tickets/admin/${report.systemTicketId}`)
      await loadSystemTickets()
    } catch {}
  }

  return (
    <div className="gg-admin-page gg-rep">
      <div className="gg-admin-page__header">
        <div><h2>Reportes y soporte</h2><p>{counts.pendiente} pendientes · {counts.revision} en revisión · {counts.resuelto} resueltos</p></div>
      </div>

      <div className="gg-admin-controls">
        <div className="gg-admin-filter-tabs">
          {STATUSES.map(s => (
            <button key={s} className={`gg-admin-filter-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s === 'Todos' ? 'Todos' : s}{s !== 'Todos' && counts[s] > 0 && <span style={{ marginLeft: 5, opacity: .7, fontSize: 10 }}>{counts[s]}</span>}
            </button>
          ))}
        </div>
        <div className="gg-admin-search">
          <span className="gg-admin-search__icon">{Icon.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por usuario o motivo…" />
          {search && <button className="gg-admin-search__clear" onClick={() => setSearch('')}>{Icon.x}</button>}
        </div>
      </div>

      <div className="gg-rep__list">
        {shown.map((r, i) => {
          const color = STATUS_COLOR[r.status] || STATUS_COLOR.pendiente
          const last = (r.updates || [])[r.updates?.length - 1]
          return (
            <motion.div key={r.id} className="gg-rep__card" style={{ borderLeftColor: color }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => openReport(r)}>
              <div className="gg-rep__card-main">
                <div className="gg-rep__who">
                  <span>De <b>{r.reporter}</b> contra <b style={{ color }}>{r.target}</b></span>
                  <p>{r.reason}</p>
                  {r.source === 'system-ticket' && <span className="gg-rep__tag gg-rep__tag--ticket">Ticket del sistema</span>}
                  {r.source === 'user-report' && <span className="gg-rep__tag gg-rep__tag--ticket">Reporte de usuario</span>}
                  {r.source === 'community-game-request' && <span className="gg-rep__tag">Solicitud de juego</span>}
                  {last && <p className="gg-rep__last">{Icon.chat} <b>{last.author}</b>, {last.message}</p>}
                </div>
              </div>
              <div className="gg-rep__card-side">
                <span className="gg-rep__status" style={{ color, background: `${color}1a`, borderColor: `${color}40` }}>{r.status}</span>
                <span className="gg-rep__date">{r.date}</span>
                {r.updates?.length > 0 && <span className="gg-rep__count">{Icon.chat} {r.updates.length}</span>}
                {r.unreadByAdmin > 0 && <span className="gg-rep__new-dot">{r.unreadByAdmin}</span>}
              </div>
              <span className="gg-rep__open">{Icon.chevronRight}</span>
            </motion.div>
          )
        })}
        {shown.length === 0 && <div className="gg-rep__empty">Sin reportes con ese criterio.</div>}
      </div>

      <AnimatePresence>
        {current && <ReportDetail report={current} onClose={() => setOpen(null)}
          onStatus={s => updateStatus(current, s)}
          onAddUpdate={u => addUpdate(current, u)} />}
      </AnimatePresence>
    </div>
  )
}

function ReportDetail({ report: r, onClose, onStatus, onAddUpdate }) {
  // La respuesta sale firmada por la cuenta real del admin (el backend la
  // registra con req.user); antes se elegia entre nombres de ejemplo.
  const { user } = useAuth()
  const author = user?.nick || 'Soporte GlitchGang'
  const [tone, setTone] = useState('neutro')
  const [tema, setTema] = useState(r.reason)
  const [template, setTemplate] = useState(0)
  const [note, setNote] = useState('')

  const message = REPORT_TEMPLATES[tone][template].replace('{tema}', tema || '…')
  const preview = `${author}, ${message}`

  // Solo se confirma si el servidor guardó (antes decía "publicada" aunque fallara).
  const publish = async () => {
    if (!tema.trim()) { toast('Escribe el tema/asunto', 'error'); return }
    const ok = await onAddUpdate({
      id: Date.now(), author, tone, message,
      note: note.trim(),
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    })
    if (!ok) return
    setNote('')
    toast('Actualización publicada', 'success')
  }

  return (
    <motion.div className="gg-rep-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-rep-modal" onClick={e => e.stopPropagation()}
        initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
        <button className="gg-rep-modal__close" onClick={onClose}>{Icon.x}</button>
        <div className="gg-rep-modal__head">
          <h3>Reporte de {r.reporter}</h3>
          <p>contra <b>{r.target}</b> · {r.date}</p>
          <p className="gg-rep-modal__reason">{r.reason}</p>
          {r.source === 'community-game-request' && (
            <div className="gg-rep-modal__meta">
              <div><span>Juego</span><b>{r.details?.gameName || r.target}</b></div>
              <div><span>Genero</span><b>{r.details?.genre || 'No indicado'}</b></div>
              <div><span>Plataforma</span><b>{r.details?.platform || 'No indicada'}</b></div>
              <div><span>Solicitante</span><b>{r.details?.requestedBy || r.reporter}</b></div>
              <div className="gg-rep-modal__meta-full"><span>Referencia</span><b>{r.details?.links || 'Sin link adjunto'}</b></div>
              <div className="gg-rep-modal__meta-full"><span>Detalle</span><p>{r.details?.message || 'Sin descripción adicional.'}</p></div>
            </div>
          )}
          {(r.source === 'system-ticket' || r.source === 'user-report') && (
            <div className="gg-rep-modal__meta">
              <div><span>ID publico</span><b>{r.details?.code || r.target}</b></div>
              <div><span>Proposito</span><b>{r.details?.purpose || 'Ticket'}</b></div>
              <div><span>Prioridad</span><b>{r.details?.priority || 'Media'}</b></div>
              <div><span>Estado ticket</span><b>{r.details?.ticketStatus || r.status}</b></div>
              {r.source === 'user-report' && <div><span>Motivo</span><b>{r.details?.reportReason || 'No indicado'}</b></div>}
              {r.source === 'user-report' && r.details?.reportedNick && <div><span>Perfil reportado</span><b><a href={`/perfil?user=${encodeURIComponent(r.details.reportedNick)}`}>@{r.details.reportedNick}</a></b></div>}
              {r.source === 'user-report' && r.details?.reportedNick && <div><span>Accion</span><b><a href={`/admin/moderacion?user=${encodeURIComponent(r.details.reportedNick)}`}>Sancionar</a></b></div>}
              <div className="gg-rep-modal__meta-full"><span>Solicitante</span><b>{r.details?.requestedBy || r.reporter} {r.details?.requesterEmail ? `· ${r.details.requesterEmail}` : ''}</b></div>
              <div className="gg-rep-modal__meta-full"><span>Mensaje inicial</span><p>{r.details?.message || 'Sin mensaje inicial.'}</p></div>
            </div>
          )}
          <div className="gg-rep-modal__statusrow">
            {['pendiente', 'revision', 'resuelto', 'descartado'].map(s => (
              <button key={s} className={`gg-rep-modal__st ${r.status === s ? 'on' : ''}`} style={r.status === s ? { '--c': STATUS_COLOR[s] } : undefined} onClick={() => onStatus(s)}>{s}</button>
            ))}
          </div>
        </div>

        {/* Hilo */}
        <div className="gg-rep-thread">
          <h4>{Icon.chat} Actualizaciones ({r.updates?.length || 0})</h4>
          {(!r.updates || r.updates.length === 0)
            ? <p className="gg-rep-thread__empty">Aún no hay respuestas. Publica una abajo.</p>
            : r.updates.map(u => (
              <div key={u.id} className="gg-rep-msg" style={{ '--tone': REPORT_TONES[u.tone]?.color }}>
                <div className="gg-rep-msg__top">
                  <span className="gg-rep-msg__author">{u.author}</span>
                  <span className="gg-rep-msg__tone">{REPORT_TONES[u.tone]?.label}</span>
                  <span className="gg-rep-msg__date">{u.date}</span>
                </div>
                <p className="gg-rep-msg__text"><b>{u.author}</b>, {u.message}</p>
                {u.note && <p className="gg-rep-msg__note">{u.note}</p>}
              </div>
            ))}
        </div>

        {/* Compositor */}
        <div className="gg-rep-comp">
          <h4>{Icon.send} Nueva actualización</h4>
          <div className="gg-rep-comp__row">
            <label>Autor
              <input value={author} readOnly title="Se publica con tu cuenta de admin" />
            </label>
            <label>Tono
              <div className="gg-rep-comp__tones">
                {Object.entries(REPORT_TONES).map(([k, v]) => (
                  <button key={k} type="button" className={`gg-rep-comp__tone ${tone === k ? 'on' : ''}`} style={{ '--c': v.color }} onClick={() => { setTone(k); setTemplate(0) }}>{v.label}</button>
                ))}
              </div>
            </label>
          </div>
          <label className="gg-rep-comp__full">Tema / asunto
            <input value={tema} onChange={e => setTema(e.target.value)} placeholder='ej. el bug en perfil' />
          </label>
          <label className="gg-rep-comp__full">Plantilla
            <select value={template} onChange={e => setTemplate(Number(e.target.value))}>
              {REPORT_TEMPLATES[tone].map((t, i) => <option key={i} value={i}>{t.replace('{tema}', tema || '…')}</option>)}
            </select>
          </label>
          <label className="gg-rep-comp__full">Texto adicional (abajo)
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Detalle o siguiente paso…" />
          </label>
          <div className="gg-rep-comp__preview" style={{ '--tone': REPORT_TONES[tone].color }}>
            <span>Vista previa</span>
            <p>{preview}</p>
            {note && <p className="gg-rep-comp__preview-note">{note}</p>}
          </div>
          <button className="gg-rep-comp__publish" onClick={publish}>{Icon.send} Publicar actualización</button>
        </div>
      </motion.div>
    </motion.div>
  )
}



