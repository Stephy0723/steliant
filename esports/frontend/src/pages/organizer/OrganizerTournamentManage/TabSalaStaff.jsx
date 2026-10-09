import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { tournamentsApi } from '../../../lib/serverApi.js'
import './TabSalaStaff.css'

const POLL_MS = 8000
// Roles de staff que pueden marcar un mensaje como reporte formal (pedir
// bloquear a un jugador, denunciar una conducta, etc.). El resto -- caster,
// produccion, coach, analista -- escribe normal en la sala. Solo se aplica en
// la UI: el backend debe imponer lo mismo (BACKEND-PENDIENTE #sala-staff-torneo).
const REPORTER_ROLES = ['Director', 'Administrador', 'Arbitro', 'Moderador']

function fmtTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Sala de staff del torneo: chat del organizador + staff aceptado (+ admin de
// GlitchGang) para coordinar: pedir acceso a una sala, avisar de un jugador
// problematico, etc. Los miembros los decide el SERVIDOR (GET
// /tournaments/:id/staff-room devuelve la conversacion ya sincronizada); el
// front nunca manda una lista de participantes. Mensajes: endpoints de
// /messages ya existentes.
export default function TabSalaStaff({ t }) {
  const { user } = useAuth()
  const myId = String(user?._id || user?.id || '')
  const tournamentId = t.dbId || t.id
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [state, setState] = useState('loading') // loading | ready | unavailable
  const [text, setText] = useState('')
  const [asReport, setAsReport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const stickRef = useRef(true)

  const isAdmin = user?.role === 'admin' || (user?.roles || []).includes('admin')
  const isOwner = Boolean(myId && t.organizerId === myId)
  const myStaff = useMemo(() => (t.staffMembers || []).find(m => String(m.user) === myId) || null, [t.staffMembers, myId])
  const canReport = isAdmin || isOwner || REPORTER_ROLES.includes(myStaff?.role)

  // Etiqueta de rol por persona: el dueno como "Organizador", el resto segun su rol de staff.
  const roleLabelFor = useCallback((senderId) => {
    if (senderId && String(senderId) === String(t.organizerId)) return 'Organizador'
    return (t.staffMembers || []).find(m => String(m.user) === String(senderId))?.role || ''
  }, [t.organizerId, t.staffMembers])

  const loadMessages = useCallback(async (roomId) => {
    const data = await api(`/messages/conversations/${encodeURIComponent(roomId)}`)
    setMessages(Array.isArray(data?.conversation?.messages) ? data.conversation.messages : [])
    api(`/messages/conversations/${encodeURIComponent(roomId)}/read`, { method: 'PATCH' }).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setState('loading')
    tournamentsApi.staffRoom(tournamentId)
      .then(async data => {
        const conv = data?.conversation
        if (!conv?.id) throw new Error('sin sala')
        if (!alive) return
        setRoom(conv)
        await loadMessages(conv.id)
        if (alive) setState('ready')
      })
      .catch(() => { if (alive) setState('unavailable') })
    return () => { alive = false }
  }, [tournamentId, loadMessages])

  // Sin websocket todavia: refresco periodico mientras la pestana esta visible.
  useEffect(() => {
    if (state !== 'ready' || !room?.id) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(room.id).catch(() => {})
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [state, room?.id, loadMessages])

  useEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const onScroll = () => {
    const el = listRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const send = async (event) => {
    event?.preventDefault()
    const body = text.trim()
    if (!body || busy || !room?.id) return
    setBusy(true)
    setError('')
    try {
      await api(`/messages/conversations/${encodeURIComponent(room.id)}/messages`, {
        method: 'POST',
        body: { text: body, kind: asReport && canReport ? 'staff_report' : 'text' },
      })
      setText('')
      setAsReport(false)
      stickRef.current = true
      await loadMessages(room.id)
    } catch (err) {
      setError(err?.message || 'No se pudo enviar el mensaje.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <p className="otm-muted">Cargando la sala de staff…</p>
  if (state === 'unavailable') {
    return (
      <div className="otm-sala otm-sala--empty">
        {Icon.team}
        <h3>Sala de staff</h3>
        <p className="otm-muted">La sala de staff de este torneo aún no está disponible. Cuando se active, aquí podrán coordinarse el organizador y todo el staff.</p>
      </div>
    )
  }

  return (
    <div className="otm-sala">
      <header className="otm-sala__head">
        <div>
          <h3>{Icon.team} Sala de staff</h3>
          <p className="otm-muted">Solo organizador, staff aceptado y administración de GlitchGang. Pide accesos, avisa de incidencias o reporta a un jugador.</p>
        </div>
        <span className="otm-sala__count">{room?.participants?.length || 0} miembros</span>
      </header>

      <div className="otm-sala__list" ref={listRef} onScroll={onScroll}>
        {messages.length === 0 && <p className="otm-muted otm-sala__none">Aún no hay mensajes. Escribe el primero.</p>}
        {messages.map(m => {
          const mine = String(m.sender) === myId
          const isReport = m.kind === 'staff_report'
          const role = roleLabelFor(m.sender)
          return (
            <div key={m.id} className={`otm-sala__msg${mine ? ' otm-sala__msg--mine' : ''}${isReport ? ' otm-sala__msg--report' : ''}`}>
              <div className="otm-sala__meta">
                <b>{mine ? 'Tú' : m.senderName || 'Staff'}</b>
                {role && <span className="otm-sala__role">{role}</span>}
                <time>{fmtTime(m.createdAt)}</time>
              </div>
              {isReport && <span className="otm-sala__flag">{Icon.alert} Reporte</span>}
              <p>{m.text}</p>
              {isReport && (isOwner || isAdmin || canReport) && (
                <Link className="otm-sala__link" to={`/organizador/torneo/${t.id}/gestionar/reportar`}>Registrar en Reportar →</Link>
              )}
            </div>
          )
        })}
      </div>

      <form className="otm-sala__composer" onSubmit={send}>
        <textarea
          rows={2}
          maxLength={2000}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(e) }}
          placeholder="Escribe al staff del torneo… (Enter envía, Shift+Enter salto de línea)"
        />
        <div className="otm-sala__actions">
          {canReport && (
            <label className="otm-sala__check">
              <input type="checkbox" checked={asReport} onChange={e => setAsReport(e.target.checked)} />
              Marcar como reporte
            </label>
          )}
          {error && <span className="otm-sala__error" role="alert">{error}</span>}
          <button className="otm-btn otm-btn--primary" type="submit" disabled={busy || !text.trim()}>
            {Icon.send} {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}

