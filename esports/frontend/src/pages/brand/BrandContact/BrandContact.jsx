import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { getMyBrand, createTicket, getMyTickets, getTicketDetail, replyTicket } from '../../../lib/brandApi.js'
import { toast } from '../../../lib/toast.js'
import './BrandContact.css'

// `category` es la categoria real del modelo Ticket (enum billing/campaign/
// technical/creative/other). Antes se mandaba el id del tema ('campana',
// 'torneo'...) que no existe en el enum: el backend respondia 500 y la
// pantalla igual decia "enviado" -- el ticket nunca llegaba a nadie.
const TOPICS = [
  { id: 'campana',     category: 'campaign',  label: 'Nueva campaña publicitaria', icon: Icon.bolt },
  { id: 'torneo',      category: 'campaign',  label: 'Patrocinio de torneo',       icon: Icon.trophy },
  { id: 'banner',      category: 'creative',  label: 'Espacio de banner/anuncio',  icon: Icon.layoutGrid },
  { id: 'facturacion', category: 'billing',   label: 'Pagos y facturación',        icon: Icon.creditCard },
  { id: 'reporte',     category: 'campaign',  label: 'Solicitar reporte de datos', icon: Icon.chartBar },
  { id: 'tecnico',     category: 'technical', label: 'Problema técnico',           icon: Icon.gear },
  { id: 'otro',        category: 'other',     label: 'Otro tema',                  icon: Icon.chat },
]

export default function BrandContact() {
  const [topic,    setTopic]   = useState('')
  const [msg,      setMsg]     = useState('')
  const [sent,     setSent]    = useState(false)
  const [sending,  setSending] = useState(false)
  const [brandName, setBrandName] = useState('')

  // Tickets history
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replyMsg, setReplyMsg] = useState('')
  const [replying, setReplying] = useState(false)

  const loadTickets = () => {
    setLoadingTickets(true)
    getMyTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoadingTickets(false))
  }

  useEffect(() => {
    getMyBrand().then(d => setBrandName(d.brand?.name || '')).catch(() => {})
    loadTickets()
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!topic || !msg.trim()) return
    setSending(true)
    try {
      const selected = TOPICS.find(t => t.id === topic)
      const subject = brandName ? `[${brandName}] ${selected?.label || topic}` : (selected?.label || topic)
      await createTicket({ subject, message: msg.trim(), category: selected?.category || 'other' })
      setSent(true)
      loadTickets()
    } catch (err) {
      // Sin "exito" falso: el mensaje se queda en el formulario para reintentar.
      toast(err?.message || 'No se pudo enviar tu consulta. Intenta de nuevo.', 'error', { title: 'Consulta no enviada' })
    } finally {
      setSending(false)
    }
  }

  const handleOpenTicket = async (t) => {
    setSelectedTicket(t)
    try {
      const detailed = await getTicketDetail(t._id)
      setSelectedTicket(detailed)
      // Reload tickets to update read states
      getMyTickets().then(setTickets).catch(() => {})
    } catch (err) {
      toast('Error al cargar detalle de la consulta', 'error')
    }
  }

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!replyMsg.trim()) return
    setReplying(true)
    try {
      const updated = await replyTicket(selectedTicket._id, replyMsg.trim())
      setSelectedTicket(updated)
      setReplyMsg('')
      getMyTickets().then(setTickets).catch(() => {})
      toast('Respuesta enviada', 'success')
    } catch {
      toast('Error al enviar respuesta', 'error')
    } finally {
      setReplying(false)
    }
  }

  if (sent) {
    return (
      <motion.div className="bco-success" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="bco-success__icon">{Icon.check}</div>
        <h2>¡Mensaje enviado!</h2>
        <p>Nuestro equipo te responderá en menos de 24 horas hábiles al correo registrado de tu cuenta.</p>
        <button className="pnl-btn pnl-btn--primary" onClick={() => { setSent(false); setMsg(''); setTopic('') }}>
          Enviar otro mensaje
        </button>
      </motion.div>
    )
  }

  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Hablar con el equipo</h1>
          <p>¿Tienes una idea, necesitas asesoría o quieres ajustar tu campaña? Escríbenos.</p>
        </div>
      </div>

      {/* Canales directos */}
      <div className="bco-channels">
        <a href="mailto:demo@steliant.example" className="bco-channel">
          <span className="bco-channel__icon">
            {Icon.send}
          </span>
          <div>
            <b>Email directo</b>
            <small>marcas@glitchgang.gg</small>
          </div>
          <span className="bco-channel__arr">{Icon.chevronRight}</span>
        </a>
        <a href="https://wa.me/0000000000?text=Hola+GlitchGang,+soy+de+" target="_blank" rel="noreferrer" className="bco-channel">
          <span className="bco-channel__icon">
            {Icon.chat}
          </span>
          <div>
            <b>WhatsApp Business</b>
            <small>Respuesta en &lt;2 horas (lun–vie)</small>
          </div>
          <span className="bco-channel__arr">{Icon.chevronRight}</span>
        </a>
      </div>

      {/* Formulario */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="pnl-card__title">{Icon.fileText} Enviar mensaje al equipo GlitchGang</div>

        <form onSubmit={handleSubmit} className="bco-form">
          <div className="bco-field">
            <span>¿Sobre qué tema es tu consulta?</span>
            <div className="bco-topic-grid">
              {TOPICS.map(t => (
                <button type="button" key={t.id}
                  className={`bco-topic-btn ${topic === t.id ? 'active' : ''}`}
                  onClick={() => setTopic(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <label className="bco-field">
            <span>Mensaje *</span>
            <textarea
              rows={5} value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Cuéntanos qué necesitas: presupuesto, fechas, tipo de campaña, alcance esperado…"
              required
            />
          </label>

          <div className="bco-form__foot">
            <p className="bco-form__note">{Icon.clock} Tiempo de respuesta habitual: 4–8 horas hábiles</p>
            <button type="submit" className="pnl-btn pnl-btn--primary"
              disabled={!topic || !msg.trim() || sending}>
              {sending ? 'Enviando...' : <>{Icon.send} Enviar mensaje</>}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Historial de Consultas */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="pnl-card__title">{Icon.chat} Mis consultas anteriores</div>
        
        {loadingTickets ? (
          <p className="bco-empty-msg">Cargando consultas...</p>
        ) : tickets.length === 0 ? (
          <p className="bco-empty-msg">No tienes consultas registradas. Usa el formulario de arriba para iniciar una.</p>
        ) : (
          <div className="bco-tickets-list">
            {tickets.map(t => (
              <div key={t._id} className="bco-ticket-item" onClick={() => handleOpenTicket(t)}>
                <div className="bco-ticket-item__head">
                  <span className={`bco-badge bco-badge--${t.status}`}>
                    {{ open: 'Abierto', in_progress: 'En proceso', closed: 'Cerrado' }[t.status] || t.status}
                  </span>
                  <code className="bco-ticket-code">{t.publicCode || 'TKT-—'}</code>
                  <span className="bco-ticket-date">{new Date(t.createdAt).toLocaleDateString('es-ES')}</span>
                </div>
                <div className="bco-ticket-item__body">
                  <h4>{t.subject}</h4>
                  <span className="bco-ticket-cat">Categoría: {{ billing: 'Facturación', campaign: 'Campaña', technical: 'Técnico', creative: 'Creatividades', other: 'Otro' }[t.category] || t.category}</span>
                </div>
                {t.unreadByBrand > 0 && (
                  <span className="bco-ticket-unread">{t.unreadByBrand} nuevo{t.unreadByBrand > 1 ? 's' : ''}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Chat Drawer/Overlay */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div className="bco-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setSelectedTicket(null)}>
            <motion.div className="bco-chat-drawer" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}>
              <div className="bco-chat-drawer__head">
                <div>
                  <span className="bco-chat-drawer__pre">Consulta {selectedTicket.publicCode || '—'}</span>
                  <h3>{selectedTicket.subject}</h3>
                </div>
                <button className="bco-close-btn" onClick={() => setSelectedTicket(null)}>{Icon.x}</button>
              </div>

              <div className="bco-chat-drawer__messages">
                {selectedTicket.messages?.map((m, idx) => (
                  <div key={idx} className={`bco-msg-bubble bco-msg-bubble--${m.author}`}>
                    <div className="bco-msg-bubble__info">
                      <span>{m.author === 'brand' ? 'Tú (Marca)' : 'Soporte GlitchGang'}</span>
                      <span>{new Date(m.sentAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>

              {selectedTicket.status !== 'closed' ? (
                <form className="bco-chat-drawer__input" onSubmit={handleReplySubmit}>
                  <textarea
                    rows={2}
                    value={replyMsg}
                    onChange={e => setReplyMsg(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    required
                    disabled={replying}
                  />
                  <button type="submit" className="pnl-btn pnl-btn--primary" disabled={replying || !replyMsg.trim()}>
                    {replying ? 'Enviando...' : <>{Icon.send} Responder</>}
                  </button>
                </form>
              ) : (
                <div className="bco-chat-drawer__closed-msg">
                  {Icon.lock} Esta consulta ha sido cerrada.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

