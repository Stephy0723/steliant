import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { onSocket } from '../../lib/socket.js'
import { toast } from '../../lib/toast.js'
import { SYSTEM_TICKET_STATUS, SYSTEM_TICKET_PRIORITY } from '../../lib/systemTicketsStore.js'
import './TicketDetail.css'

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} d`
}

export default function TicketDetail() {
  const { code } = useParams()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const threadRef = useRef(null)

  const load = useCallback(() => {
    api(`/system-tickets/${encodeURIComponent(code)}`)
      .then(d => setTicket(d.ticket))
      .catch(err => { setTicket(null); setNeedsLogin(err?.status === 401) })
      .finally(() => setLoading(false))
  }, [code])

  useEffect(() => { load() }, [load])

  // Las respuestas empujan una notificación real (sendNotif -> emitToUser);
  // en vez de duplicar el shape del mensaje acá, si la notificación es de
  // este ticket simplemente se recarga -- misma idea que NotificationsContext.
  useEffect(() => onSocket('notification', (n) => {
    if (n?.meta?.publicCode === code || n?.meta?.ticketId === ticket?.id) load()
  }), [code, ticket?.id, load])

  useEffect(() => {
    const thread = threadRef.current
    if (thread) {
      requestAnimationFrame(() => {
        thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
      })
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [ticket?.messages?.length])

  const reply = async () => {
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    try {
      const data = await api(`/system-tickets/${encodeURIComponent(code)}/reply`, { method: 'POST', body: { message } })
      setTicket(data.ticket)
      setDraft('')
    } catch {
      toast('No se pudo enviar la respuesta', 'error')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="gg-ticket-page gg-ticket-page--empty"><p>Cargando…</p></div>
  if (needsLogin) {
    return (
      <div className="gg-ticket-page gg-ticket-page--empty">
        <p>Tu ticket se creó, pero necesitas iniciar sesión para ver las respuestas y contestar.</p>
        <Link to={`/login?next=/ayuda/ticket/${encodeURIComponent(code)}`}>Iniciar sesión</Link>
      </div>
    )
  }
  if (!ticket) {
    return (
      <div className="gg-ticket-page gg-ticket-page--empty">
        <p>No se encontró este ticket.</p>
        <Link to="/ayuda">Volver a Ayuda</Link>
      </div>
    )
  }

  const closed = ticket.status === 'closed'

  return (
    <div className="gg-ticket-page">
      <header className="gg-ticket-page__head">
        <Link to="/ayuda" className="gg-ticket-page__back">{Icon.arrowLeft || '←'} Ayuda</Link>
        <div>
          <b>{ticket.subject}</b>
          <span className="gg-ticket-page__code">{ticket.publicCode}</span>
        </div>
        <div className="gg-ticket-page__badges">
          <i className={`gg-ticket-badge gg-ticket-badge--${ticket.status}`}>{SYSTEM_TICKET_STATUS[ticket.status] || ticket.status}</i>
          <i className={`gg-ticket-badge gg-ticket-badge--prio-${ticket.priority}`}>{SYSTEM_TICKET_PRIORITY[ticket.priority] || ticket.priority}</i>
        </div>
      </header>

      <div className="gg-ticket-thread" ref={threadRef}>
        {(ticket.messages || []).map((m, i) => (
          <article key={i} className={`gg-ticket-msg ${m.author === 'user' ? 'mine' : ''} gg-ticket-msg--${m.author}`}>
            <header>
              <b>{m.author === 'user' ? (user?.nick || 'Tú') : m.author === 'admin' ? 'Soporte GlitchGang' : 'Sistema'}</b>
              <time>{timeAgo(m.sentAt)}</time>
            </header>
            <p>{m.body}</p>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <p className="gg-ticket-page__closed">Este ticket está cerrado. Crea uno nuevo desde Ayuda si necesitas más soporte.</p>
      ) : (
        <footer className="gg-ticket-composer">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && reply()}
            placeholder="Responder…"
            maxLength={2400}
          />
          <button onClick={reply} disabled={!draft.trim() || sending}>{Icon.send || 'Enviar'}</button>
        </footer>
      )}
    </div>
  )
}

