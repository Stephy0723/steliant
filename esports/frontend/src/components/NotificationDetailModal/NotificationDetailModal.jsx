import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import NotificationActionCard from './NotificationActionCard.jsx'
import './NotificationDetailModal.css'

// Estado visual según el tono de la notificación
const TONES = {
  success:   { color: '#22c55e', icon: Icon.check },
  pending:   { color: '#a855f7', icon: Icon.clock },
  error:     { color: '#ef4444', icon: Icon.x },
  warning:   { color: '#f59e0b', icon: Icon.alert },
  admin:     { color: '#f97316', icon: Icon.shield },
  celebrate: { color: 'var(--accent)', icon: Icon.gem },
  info:      { color: '#3b82f6', icon: Icon.bell },
}

function EntityCard({ entity }) {
  if (!entity) return null

  if (entity.kind === 'player') {
    return (
      <div className="nd-entity nd-entity--player">
        <img src={entity.avatar} alt={entity.nick} />
        <div className="nd-entity__info">
          <b>{entity.nick}</b>
          <span>{entity.role}</span>
        </div>
        {entity.rating && <span className="nd-entity__pill">{entity.rating}</span>}
      </div>
    )
  }

  if (entity.kind === 'team') {
    return (
      <div className="nd-entity nd-entity--team" style={{ '--ec': entity.color }}>
        <div className="nd-entity__logo">{(entity.tag || entity.name || '').slice(0, 2).toUpperCase()}</div>
        <div className="nd-entity__info">
          <b>{entity.name} {entity.tag && <small>[{entity.tag}]</small>}</b>
          <span>{entity.game}{entity.members != null ? ` · ${entity.members}/${entity.capacity} jugadores` : ''}</span>
        </div>
      </div>
    )
  }

  if (entity.kind === 'tournament') {
    return (
      <div className="nd-entity nd-entity--tournament" style={{ '--ec': entity.color }}>
        <div
          className="nd-entity__cover"
          style={entity.image ? { backgroundImage: `url(${entity.image})` } : { background: entity.color }}
        >
          <span className="nd-entity__game">{entity.game}</span>
        </div>
        <div className="nd-entity__tbody">
          <b>{entity.name}</b>
          <div className="nd-entity__stats">
            {entity.prize && <div><span>Premio</span><b>{entity.prize}</b></div>}
            {entity.date && <div><span>Inicio</span><b>{entity.date}</b></div>}
            {entity.cupos && <div><span>Cupos</span><b>{entity.cupos}</b></div>}
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function NotificationDetailModal({ notification, onClose, onArchive, onRestore, onRemove, onSave, onReply, onAccept, onDecline }) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [decisionReason, setDecisionReason] = useState('')

  const isEmail = notification?.emailHtml
  const isActionCard = !isEmail && notification?.layout === 'action'
  const isAdminTicketReply = notification?.type === 'admin_ticket_reply'
  const isAdminNotice = notification?.type === 'admin_notice' || isAdminTicketReply
  const tone = TONES[notification?.tone] || TONES.info
  const messageText = notification?.fullMessage || notification?.desc || ''
  const adminMessageParts = isAdminNotice
    ? String(messageText).split('\n').map(part => part.trim()).filter(Boolean)
    : []
  const adminMainMessage = adminMessageParts[0] || messageText
  const adminManualMessage = adminMessageParts.slice(1).join('\n')
  const detailRows = notification?.detailRows || (Array.isArray(notification?.meta) ? notification.meta : [])
  const actions = Array.isArray(notification?.actions) && notification.actions.length
    ? notification.actions
    : (notification?.action ? [notification.action] : [])

  useEffect(() => {
    setDecisionReason('')
    setReplyOpen(false)
    setReplyText('')
  }, [notification?.id])

  const sendReply = () => {
    if (!replyText.trim()) return
    onReply?.(notification.id, replyText.trim())
    setReplyText('')
    setReplyOpen(false)
    if (!isAdminNotice) onClose()
  }

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          className="gg-notif-detail__overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`gg-notif-detail ${isEmail ? 'gg-notif-detail--email' : isActionCard ? 'gg-notif-detail--action' : 'gg-notif-detail--card'} ${isAdminNotice && !isActionCard ? 'gg-notif-detail--admin' : ''}`}
            initial={{ opacity: 0, y: 16, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={e => e.stopPropagation()}
            style={!isEmail ? { '--tone': notification.toneColor || tone.color } : undefined}
          >
            {isActionCard ? (
              <>
                <NotificationActionCard
                  notification={notification}
                  onClose={onClose}
                  onAccept={onAccept}
                  onDecline={onDecline}
                  onReply={onReply}
                />
                <div className="nd-subactions nd-subactions--action">
                  {onSave && (
                    <button className={notification.saved ? 'active' : ''} onClick={() => onSave(notification.id)}>
                      {Icon.star} {notification.saved ? 'Guardado' : 'Guardar'}
                    </button>
                  )}
                  {notification.archived
                    ? <button onClick={() => onRestore(notification.id)}>Restaurar</button>
                    : <button onClick={() => onArchive(notification.id)}>Archivar</button>}
                  <button className="danger" onClick={() => onRemove(notification.id)}>Eliminar</button>
                </div>
              </>
            ) : isEmail ? (
              <>
                <div className="gg-notif-detail__email">
                  <div className="email-header">
                    <div>
                      <span className="email-from">{notification.from || 'STELIANT ESPORTS'}</span>
                      <p className="email-subject">{notification.title}</p>
                    </div>
                    <button className="email-close" onClick={onClose}>{Icon.x}</button>
                  </div>
                  <iframe className="email-iframe" srcDoc={notification.emailHtml} title="Email" />
                </div>
                <div className="nd-subactions nd-subactions--email">
                  {notification.action && <a className="nd-btn nd-btn--primary" href={notification.action.link}>{notification.action.label}</a>}
                  <button onClick={() => onArchive(notification.id)}>Archivar</button>
                  <button className="danger" onClick={() => onRemove(notification.id)}>Eliminar</button>
                </div>
              </>
            ) : (
              <>
                {/* Panel lateral de color (tarjeta horizontal) */}
                <div className="ndc-side">
                  <span className="ndc-side__blob" />
                  {notification.heroEmoji
                    ? <div className="ndc-side__emoji">{notification.heroEmoji}</div>
                    : <div className="ndc-side__icon">{tone.icon}</div>}
                  <span className="ndc-side__tag">{notification.category || 'Notificación'}</span>
                </div>

                <button className="ndc-close" onClick={onClose}>{Icon.x}</button>
                <div className="nd-body">
                  {isAdminNotice && (
                    <div className="nd-admin-banner">
                      <span>{Icon.shield}</span>
                      <div>
                        <b>Aviso administrativo prioritario</b>
                        <small>{isAdminTicketReply ? 'Tu ticket recibio respuesta. Abre mensajes para continuar el seguimiento.' : 'Revisa el mensaje. Puedes responder al panel admin o abrir mensajes para dar seguimiento.'}</small>
                      </div>
                    </div>
                  )}
                  <h3 className="nd-title">{notification.title}</h3>
                  {notification.subtitle && <p className="nd-subtitle">{notification.subtitle}</p>}

                  <EntityCard entity={notification.entity} />

                  {messageText && (
                    isAdminNotice ? (
                      <div className="nd-admin-message">
                        <p className="nd-msg nd-msg--admin-main">{adminMainMessage}</p>
                        {adminManualMessage && (
                          <div className="nd-admin-message__manual">
                            <span>Mensaje del admin</span>
                            <p>{adminManualMessage}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="nd-msg">{messageText}</p>
                    )
                  )}

                  {isAdminNotice && notification.replied && (
                    <div className="nd-admin-replied">
                      {Icon.check}<span>Respuesta enviada al panel admin.</span>
                    </div>
                  )}

                  {/* Regalo */}
                  {notification.rewardGift && (
                    <div className="nd-gallery">
                      {notification.rewardGift.items.map(item => (
                        <div className={`nd-gallery__item ${notification.rewardGift.equipped === item.src ? 'equipped' : ''}`} key={item.id}>
                          {item.type === 'video'
                            ? <video src={item.src} poster={item.poster} muted playsInline preload="none" controls />
                            : <img src={item.src} alt={item.label} loading="lazy" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Datos */}
                  {detailRows.length > 0 && (
                    <div className="nd-meta">
                      {detailRows.map((m, i) => (
                        <div className="nd-meta__row" key={i}><span>{m.label}</span><b>{m.value}</b></div>
                      ))}
                    </div>
                  )}

                  {notification.from && (
                    <div className="nd-from">{Icon.user}<span>{notification.from} · {notification.time}</span></div>
                  )}

                  {/* Respuesta */}
                  {replyOpen && (
                    <div className="nd-reply">
                      <textarea rows={3} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Escribe tu respuesta..." autoFocus />
                      <div className="nd-reply__actions">
                        <button className="nd-btn nd-btn--primary" onClick={sendReply}>{Icon.send} Enviar</button>
                        <button className="nd-btn nd-btn--ghost" onClick={() => setReplyOpen(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {notification.request && !replyOpen && (
                    <div className="nd-decision-note">
                      <label htmlFor={`decision-note-${notification.id}`}>Mensaje opcional para quien invita</label>
                      <textarea
                        id={`decision-note-${notification.id}`}
                        rows={3}
                        value={decisionReason}
                        onChange={e => setDecisionReason(e.target.value)}
                        placeholder="Ej. Acepto, puedo cubrir el check-in y la transmision. / No puedo por conflicto de horario."
                      />
                    </div>
                  )}

                  {/* Acciones principales */}
                  {!replyOpen && (
                    <div className="nd-actions">
                      {notification.request ? (
                        <>
                          <button className="nd-btn nd-btn--primary" onClick={() => onAccept?.(notification.id, decisionReason.trim())}>{Icon.check} Aceptar invitacion</button>
                          <button className="nd-btn nd-btn--ghost" onClick={() => onDecline?.(notification.id, decisionReason.trim())}>Rechazar</button>
                        </>
                      ) : isAdminNotice ? (
                        <>
                          {notification.replyable !== false && <button className="nd-btn nd-btn--primary nd-btn--admin" onClick={() => setReplyOpen(true)}>{Icon.send} Responder al admin</button>}
                          <a className="nd-btn nd-btn--ghost" href={notification.action?.link || '/mensajes?to=admin'}>{notification.action?.label || 'Contactar admin'}</a>
                        </>
                      ) : actions.length ? (
                        actions.map((action, index) => (
                          <a
                            className={`nd-btn ${index === 0 ? 'nd-btn--primary' : 'nd-btn--ghost'}`}
                            href={action.link}
                            key={`${action.label}-${action.link}`}
                            target={String(action.link || '').startsWith('http') ? '_blank' : undefined}
                            rel={String(action.link || '').startsWith('http') ? 'noreferrer' : undefined}
                          >
                            {action.label}
                          </a>
                        ))
                      ) : (
                        <button className="nd-btn nd-btn--primary" onClick={onClose}>Entendido</button>
                      )}
                    </div>
                  )}

                  {isAdminNotice && !replyOpen && (
                    <div className="nd-actions nd-actions--secondary">
                      <button
                        className="nd-btn nd-btn--ghost"
                        disabled={notification.saved}
                        onClick={() => !notification.saved && onSave?.(notification.id)}
                      >
                        {notification.saved ? Icon.check : Icon.star} {notification.saved ? 'Aviso guardado' : 'Guardar aviso'}
                      </button>
                      <button className="nd-btn nd-btn--ghost" onClick={onClose}>Cerrar</button>
                    </div>
                  )}

                  {/* Acciones secundarias */}
                  <div className="nd-subactions">
                    {notification.replyable && !replyOpen && (
                      <button onClick={() => setReplyOpen(true)}>{Icon.send} Responder</button>
                    )}
                    {onSave && (
                      <button className={notification.saved ? 'active' : ''} onClick={() => onSave(notification.id)}>
                        {Icon.star} {notification.saved ? 'Guardado' : 'Guardar'}
                      </button>
                    )}
                    {notification.archived
                      ? <button onClick={() => onRestore(notification.id)}>Restaurar</button>
                      : <button onClick={() => onArchive(notification.id)}>Archivar</button>}
                    <button className="danger" onClick={() => onRemove(notification.id)}>Eliminar</button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

