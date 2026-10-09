import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { Icon } from '../icons/Icons.jsx'
import { GlitchGangText } from '../GlitchText/GlitchText.jsx'
import './NotificationsDropdown.css'

const TYPE_ICON = {
  torneo: Icon.trophy,
  amigo: Icon.friends,
  mensaje: Icon.msg,
  pago: Icon.star,
  sistema: Icon.bolt,
  admin_notice: Icon.shield,
  raffle_won: Icon.trophy,
  role_change: Icon.shield,
  trophy: Icon.trophy,
  friend: Icon.friends,
  friend_request: Icon.friends,
  friend_request_accepted: Icon.friends,
  message: Icon.msg,
  msg: Icon.msg,
  rank: Icon.award,
  system: Icon.bolt,
}

function resolveUploadUrl(value) {
  if (!value) return ''
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

function initialsOf(value) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

function hueFromString(value) {
  const text = String(value || 'GG')
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

function notificationImage(notification) {
  return resolveUploadUrl(
    notification.hero?.image ||
    notification.meta?.avatar ||
    notification.meta?.teamLogo ||
    notification.meta?.tournamentBanner ||
    notification.entity?.image ||
    notification.entity?.avatar ||
    '',
  )
}

function notificationContext(notification) {
  return notification.entity?.name ||
    notification.meta?.teamName ||
    notification.meta?.tournamentTitle ||
    notification.subtitle ||
    notification.category ||
    'GlitchGang'
}

function NotificationThumb({ notification }) {
  const image = notificationImage(notification)
  const label = notificationContext(notification)
  if (image) {
    return (
      <div className="gg-notif-drop__thumb gg-notif-drop__thumb--image">
        <img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} />
      </div>
    )
  }
  return (
    <div className="gg-notif-drop__thumb gg-notif-drop__thumb--mono" style={{ '--thumb-hue': hueFromString(label) }}>
      {initialsOf(label)}
    </div>
  )
}

export default function NotificationsDropdown({ onClose }) {
  const { notifications, unread, markRead, markAllRead, remove, archive } = useNotifications()
  const navigate = useNavigate()
  const ref = useRef()
  const recent = notifications.filter(item => !item.archived).slice(0, 3)

  useEffect(() => {
    function handler(event) {
      if (ref.current && !ref.current.contains(event.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      className="gg-notif-drop"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ duration: 0.18 }}
    >
      <div className="gg-notif-drop__header">
        <span>Notificaciones</span>
        <div className="gg-notif-drop__header-actions">
          {unread > 0 && (
            <button className="gg-notif-drop__mark-all" onClick={markAllRead}>
              Marcar todo leído
            </button>
          )}
          <button className="gg-notif-drop__close" onClick={onClose}>{Icon.x}</button>
        </div>
      </div>

      <div className="gg-notif-drop__list">
        {recent.length === 0 && (
          <div className="gg-notif-drop__empty">Sin notificaciones</div>
        )}
        {recent.map(notification => (
          <div
            key={notification.id}
            className={`gg-notif-drop__item gg-notif-drop__item--${notification.tone || 'info'} ${!notification.read ? 'unread' : ''} ${notification.type === 'admin_notice' ? 'gg-notif-drop__item--admin' : ''}`}
            onClick={() => { markRead(notification.id); onClose(); navigate('/notificaciones') }}
            style={{ '--notif-tone': notification.toneColor }}
          >
            <NotificationThumb notification={notification} />
            <div className="gg-notif-drop__body">
              <span className="gg-notif-drop__kind">
                <i>{TYPE_ICON[notification.type] || Icon.bell}</i>
                {notification.subtitle || notificationContext(notification)}
              </span>
              <span className="gg-notif-drop__title"><GlitchGangText>{notification.title}</GlitchGangText></span>
              <span className="gg-notif-drop__desc">{notification.desc}</span>
              <span className="gg-notif-drop__meta">
                <b>{notification.from || notificationContext(notification)}</b>
                <em>{notification.time}</em>
              </span>
            </div>
            <div className="gg-notif-drop__actions">
              <button onClick={event => { event.stopPropagation(); markRead(notification.id); onClose(); navigate('/notificaciones') }}>Ver más</button>
              <button onClick={event => { event.stopPropagation(); archive(notification.id) }}>Archivar</button>
              <button className="danger" onClick={event => { event.stopPropagation(); remove(notification.id) }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <div className="gg-notif-drop__footer">
        <button onClick={() => { onClose(); navigate('/notificaciones') }}>
          Ver todas las notificaciones
        </button>
      </div>
    </motion.div>
  )
}

