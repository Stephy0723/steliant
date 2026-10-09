import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { onSocket } from '../../../lib/socket.js'
import { toast } from '../../../lib/toast.js'
import { SYSTEM_TICKET_STATUS, SYSTEM_TICKET_PRIORITY } from '../../../lib/systemTicketsStore.js'
import './AdminTickets.css'

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'waiting_user', 'closed']

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

function ticketKind(ticket) {
  if (ticket?.sourceType === 'user_report') return 'Reporte de usuario'
  return ticket?.sourceType ? ticket.sourceType : 'Ticket'
}

export default function AdminTickets() {
  const [searchParams] = useSearchParams()
  const deepLinkCode = searchParams.get('ticket')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(deepLinkCode ? 'all' : 'open')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const loadList = useCallback(() => {
    setLoading(true)
    api(`/system-tickets/admin?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ''}`)
      .then(d => setTickets(Array.isArray(d.tickets) ? d.tickets : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [status, search])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => onSocket('notification', (n) => {
    if (n?.type === 'system_ticket_new' || n?.type === 'system_ticket_reply') loadList()
  }), [loadList])

  const active = tickets.find(t => t.id === activeId) || null

  // `key` acepta el _id de Mongo (fila de la lista) o el publicCode (link de
  // notificación) -- systemTicketKeyFilter en el backend resuelve ambos.
  const openTicket = (key) => {
    api(`/system-tickets/admin/${encodeURIComponent(key)}`)
      .then(d => {
        setActiveId(d.ticket.id)
        setTickets(prev => prev.some(t => t.id === d.ticket.id)
          ? prev.map(t => t.id === d.ticket.id ? d.ticket : t)
          : [d.ticket, ...prev])
      })
      .catch(() => {})
  }

  useEffect(() => { if (deepLinkCode) openTicket(deepLinkCode) }, [deepLinkCode])

  const reply = async () => {
    const message = draft.trim()
    if (!message || !active || sending) return
    setSending(true)
    try {
      const data = await api(`/system-tickets/admin/${active.id}/reply`, { method: 'POST', body: { message } })
      setTickets(prev => prev.map(t => t.id === data.ticket.id ? data.ticket : t))
      setDraft('')
    } catch {
      toast('No se pudo enviar la respuesta', 'error')
    } finally {
      setSending(false)
    }
  }

  const setTicketStatus = async (newStatus) => {
    if (!active) return
    try {
      const data = await api(`/system-tickets/admin/${active.id}`, { method: 'PATCH', body: { status: newStatus } })
      setTickets(prev => prev.map(t => t.id === data.ticket.id ? data.ticket : t))
    } catch {
      toast('No se pudo actualizar el estado', 'error')
    }
  }

  return (
    <div className="gg-admtk">
      <aside className="gg-admtk__list">
        <header>
          <h2>Tickets de soporte</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" />
          <div className="gg-admtk__filters">
            {STATUS_FILTERS.map(s => (
              <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
                {s === 'all' ? 'Todos' : SYSTEM_TICKET_STATUS[s]}
              </button>
            ))}
          </div>
        </header>
        <div className="gg-admtk__scroll">
          {loading ? <p className="gg-admtk__hint">Cargando…</p> : tickets.length === 0 ? (
            <p className="gg-admtk__hint">Sin tickets aquí.</p>
          ) : tickets.map(t => (
            <button key={t.id} className={`gg-admtk__row ${activeId === t.id ? 'active' : ''}`} onClick={() => openTicket(t.id)}>
              <div className="gg-admtk__row-top">
                <b>{t.subject}</b>
                {t.unreadByAdmin > 0 && <i className="gg-admtk__dot" />}
              </div>
              <small>{ticketKind(t)} · {t.requesterName} · {t.publicCode}</small>
              <span className={`gg-admtk__prio gg-admtk__prio--${t.priority}`}>{SYSTEM_TICKET_PRIORITY[t.priority]}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="gg-admtk__detail">
        {!active ? (
          <div className="gg-admtk__empty">{Icon.msg}<p>Selecciona un ticket.</p></div>
        ) : (
          <>
            <header className="gg-admtk__detail-head">
              <div>
                <b>{active.subject}</b>
                <span>{active.publicCode} · {active.requesterName} {active.requesterEmail ? `(${active.requesterEmail})` : ''}</span>
                {active.sourceType === 'user_report' && (
                  <span>
                    Reporte de usuario · motivo {active.metadata?.reason || 'no indicado'} ·{' '}
                    <a href={`/perfil?user=${encodeURIComponent(active.metadata?.reportedNick || '')}`}>@{active.metadata?.reportedNick || 'usuario'}</a>
                    {' · '}
                    <a href={`/admin/moderacion?user=${encodeURIComponent(active.metadata?.reportedNick || '')}`}>Sancionar</a>
                  </span>
                )}
              </div>
              <select value={active.status} onChange={e => setTicketStatus(e.target.value)}>
                {Object.entries(SYSTEM_TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </header>
            <div className="gg-admtk__thread">
              {(active.messages || []).map((m, i) => (
                <article key={i} className={`gg-admtk__msg ${m.author === 'admin' ? 'mine' : ''} gg-admtk__msg--${m.author}`}>
                  <header>
                    <b>{m.author === 'admin' ? 'Tú (admin)' : m.author === 'user' ? active.requesterName : 'Sistema'}</b>
                    <time>{timeAgo(m.sentAt)}</time>
                  </header>
                  <p>{m.body}</p>
                </article>
              ))}
            </div>
            {active.status !== 'closed' && (
              <footer className="gg-admtk__composer">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && reply()}
                  placeholder="Responder al usuario…"
                  maxLength={2400}
                />
                <button onClick={reply} disabled={!draft.trim() || sending}>{Icon.send || 'Enviar'}</button>
              </footer>
            )}
          </>
        )}
      </main>
    </div>
  )
}

