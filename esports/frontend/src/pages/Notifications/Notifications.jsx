import { useState } from 'react'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { api } from '../../lib/api.js'
import { tournamentsApi } from '../../lib/serverApi.js'
import { toast } from '../../lib/toast.js'
import { CATEGORY_LABELS } from '../../data/notifications.js'
import { buildNotificationPreviews } from '../../data/notificationPreviews.js'
import NotificationDetailModal from '../../components/NotificationDetailModal/NotificationDetailModal.jsx'
import './Notifications.css'

const TYPE_ICON = {
  torneo:     Icon.trophy,
  amigo:      Icon.users,
  mensaje:    Icon.msg,
  pago:       Icon.bolt,
  sistema:    Icon.shield,
  admin_notice: Icon.shield,
  raffle_won: Icon.trophy,
  role_change: Icon.shield,
  equipo:     Icon.users,
  bienvenida: Icon.gem,
  cumpleaños: Icon.gem,
  navidad:    Icon.gem,
  community: Icon.msg,
  university: Icon.shield,
  join_request: Icon.users,
  admin_ticket_reply: Icon.shield,
  system_ticket_new: Icon.shield,
  system_ticket_reply: Icon.msg,
  organizer_discord_request: Icon.discord,
  organizer_discord_reviewed: Icon.discord,
  organization_request: Icon.shield,
  organization_request_approved: Icon.check,
  organization_request_rejected: Icon.alert,
  role_application_approved: Icon.check,
  role_application_rejected: Icon.alert,
  role_profile_complete_reminder: Icon.user,
  tournament_staff_invite: Icon.team,
  tournament_staff_response: Icon.team,
  tournament_staff_request: Icon.team,
  tournament_staff_request_response: Icon.check,
  tournament_staff_added: Icon.check,
  tournament_staff_removed: Icon.alert,
  tournament_roster_lock: Icon.lock,
  tournament_registration_next_steps: Icon.trophy,
  tournament_checkin_open: Icon.clock,
  tournament_match_ready: Icon.target,
  tournament_result_reported: Icon.chartBar,
  tournament_match_won: Icon.check,
  tournament_podium: Icon.trophy,
  tournament_eliminated: Icon.x,
  tournament_finished: Icon.trophy,
  tournament_prizes_pending: Icon.award,
  discord_sync_failed: Icon.discord,
  friend_request: Icon.users,
  friend_request_accepted: Icon.users,
  security_new_login: Icon.shield,
  message: Icon.msg,
}

const CATEGORIES = ['todas', 'sistema', 'equipos', 'torneos', 'social', 'soporte', 'admin']

// Tipos que ya traen suficiente prioridad/urgencia como para llevar el
// mismo tratamiento visual "prioritario" que admin_notice (banda de color +
// etiqueta), no solo ese tipo puntual.
const PRIORITY_TYPES = new Set(['admin_notice', 'admin_ticket_reply', 'system_ticket_new', 'system_ticket_reply'])

function hueFromString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

function initialsOf(str) {
  const words = String(str || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase()
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

function notificationImage(n) {
  return resolveUploadUrl(
    n.hero?.image ||
    n.meta?.avatar ||
    n.meta?.teamLogo ||
    n.meta?.tournamentBanner ||
    n.entity?.image ||
    '',
  )
}

// Miniatura de cada fila: si el tipo trae una entidad real con nombre
// (equipo/torneo ya resueltos en NotificationsContext), se muestra un
// monograma con color propio en vez del icono generico -- da variedad
// visual real por tipo sin inventar imagenes que el backend no manda.
function NotifThumb({ n }) {
  const image = notificationImage(n)
  if (image) {
    return (
      <div className="gg-notif-row__thumb gg-notif-row__thumb--image">
        <img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} />
      </div>
    )
  }
  const name = n.entity?.name
  if (name) {
    const hue = hueFromString(name)
    return (
      <div className="gg-notif-row__thumb gg-notif-row__thumb--mono" style={{ '--thumb-hue': hue }}>
        {initialsOf(name)}
      </div>
    )
  }
  return (
    <div className="gg-notif-row__thumb gg-notif-row__thumb--icon">
      {TYPE_ICON[n.type] || Icon.bolt}
    </div>
  )
}

export default function Notifications() {
  const { notifications, unread, markRead, markAllRead, remove, archive, restore, toggleSave, reply, pushNotification } = useNotifications()
  const [activeTab, setActiveTab] = useState('todas')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState(null)

  const active = notifications.filter(n => !n.archived)
  const archived = notifications.filter(n => n.archived)

  const filtered = activeTab === 'todas'
    ? active
    : active.filter(n => n.category === activeTab)

  const getCategoryCount = (cat) => {
    if (cat === 'todas') return active.filter(n => !n.read).length
    return active.filter(n => n.category === cat && !n.read).length
  }

  // Aceptar/Declinar una invitacion desde la propia notificacion (solo los
  // tipos que de verdad tienen endpoint para resolverse aqui — ver
  // INVITE_TYPES en NotificationsContext.jsx).
  const respondInvite = async (id, accept, reason = '') => {
    const n = notifications.find(x => x.id === id)
    if (String(id).startsWith('preview-')) {
      toast(accept ? 'Vista previa: solicitud aceptada' : 'Vista previa: solicitud rechazada', 'info')
      remove(id)
      setSelected(null)
      return
    }
    // Notificaciones join_request creadas antes de que el backend empezara a
    // mandar requestId en el meta: no hay con que armar el PATCH. Si se
    // tratan igual que las nuevas, el boton "funciona" en apariencia (la
    // notificacion desaparece) pero no llama al backend y la solicitud real
    // se queda 'pending' para siempre -- mejor avisar y no fingir que se resolvio.
    if (n?.type === 'join_request' && (!n.meta?.teamId || !n.meta?.requestId)) {
      toast('Esta solicitud es de antes de esta funcion. Resuelvela desde el panel de tu equipo.', 'error')
      setSelected(null)
      return
    }
    try {
      if (n?.type === 'tournament_staff_invite' && n.meta?.tournamentId) {
        await tournamentsApi.respondStaffInvite(n.meta.tournamentId, accept ? 'accept' : 'decline', reason)
      }
      if (n?.type === 'join_request' && n.meta?.teamId && n.meta?.requestId) {
        await api(`/teams/${n.meta.teamId}/requests/${n.meta.requestId}`, { method: 'PATCH', body: { accept } })
      }
    } catch { /* si falla el backend, igual se limpia la notificacion */ }
    markRead(id)
    remove(id)
    setSelected(null)
  }

  // remove(id) ya borra cada una en el servidor (DELETE /notifications/:id).
  // No existe un DELETE masivo: la llamada que había siempre daba 404.
  const deleteAll = async () => {
    await Promise.all(filtered.map(n => remove(n.id)))
  }

  return (
    <div className="gg-page gg-notifs-page">
      <PageHeader title="Notificaciones" sub={`${unread} sin leer`}>
        <div className="gg-notifs-header-actions">
          {import.meta.env.DEV && (
            <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => buildNotificationPreviews().reverse().forEach(item => { remove(item._id); pushNotification(item) })}>
              {Icon.eye}<span>Vista previa</span>
            </button>
          )}
          {unread > 0 && (
            <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={markAllRead}>
              {Icon.check}<span>Marcar leídas</span>
            </button>
          )}
          {filtered.length > 0 && (
            <button className="gg-btn gg-btn--danger gg-btn--sm" onClick={deleteAll}>
              {Icon.trash}<span>Eliminar todo</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* Tabs por categoría */}
      <div className="gg-notif-tabs">
        {CATEGORIES.map(cat => {
          const count = getCategoryCount(cat)
          return (
            <button
              key={cat}
              className={`gg-notif-tab ${activeTab === cat ? 'active' : ''}`}
              onClick={() => setActiveTab(cat)}
            >
              {CATEGORY_LABELS[cat]}
              {count > 0 && <span className="gg-notif-tab__badge">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Lista de notificaciones */}
      <div className="gg-notifs-list">
        {filtered.length === 0 ? (
          <div className="gg-notifs-empty">
            <div className="gg-notifs-empty__icon">{Icon.bell}</div>
            <p>Sin notificaciones en esta categoría</p>
          </div>
        ) : filtered.map((n) => (
          <div
            key={n.id}
            className={`gg-notif-row gg-notif-row--${n.tone || 'info'} ${n.read ? 'read' : ''} ${PRIORITY_TYPES.has(n.type) ? 'gg-notif-row--admin' : ''}`}
            onClick={() => markRead(n.id)}
            style={{ '--notif-tone': n.toneColor }}
          >
            <NotifThumb n={n} />
            <div className="gg-notif-row__body">
              <p className="gg-notif-row__title">{n.title}</p>
              <span className="gg-notif-row__kind">{n.subtitle || CATEGORY_LABELS[n.category] || n.category || 'Notificacion'}</span>
              <p className="gg-notif-row__desc">{n.desc}</p>
              <time>{n.time}</time>
            </div>
            {!n.read && <div className="gg-notif-row__dot" />}
            <div className="gg-notif-row__actions">
              <button onClick={e => { e.stopPropagation(); markRead(n.id); setSelected({ ...n, read: true }) }}>Ver más</button>
              <button onClick={e => { e.stopPropagation(); archive(n.id) }}>Archivar</button>
              <button className="danger" onClick={e => { e.stopPropagation(); remove(n.id) }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Archivadas */}
      <div className="gg-notifs-archive">
        <button
          className="gg-notifs-archive__toggle"
          onClick={() => setShowArchived(v => !v)}
        >
          <span>Archivadas ({archived.length})</span>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
            style={{ transform: showArchived ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {showArchived && archived.map(n => (
          <div key={n.id} className={`gg-notif-row gg-notif-row--${n.tone || 'info'} read archived ${PRIORITY_TYPES.has(n.type) ? 'gg-notif-row--admin' : ''}`} style={{ '--notif-tone': n.toneColor }}>
            <NotifThumb n={n} />
            <div className="gg-notif-row__body">
              <p className="gg-notif-row__title">{n.title}</p>
              <span className="gg-notif-row__kind">{n.subtitle || CATEGORY_LABELS[n.category] || n.category || 'Notificacion'}</span>
              <p className="gg-notif-row__desc">{n.desc}</p>
              <time>{n.time}</time>
            </div>
            <div className="gg-notif-row__actions">
              <button onClick={() => setSelected(n)}>Ver más</button>
              <button onClick={() => restore(n.id)}>Restaurar</button>
              <button className="danger" onClick={() => remove(n.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      <NotificationDetailModal
        notification={selected}
        onClose={() => setSelected(null)}
        onArchive={id => { archive(id); setSelected(null) }}
        onRestore={id => { restore(id); setSelected(null) }}
        onRemove={id => { remove(id); setSelected(null) }}
        onSave={id => { toggleSave(id); setSelected(s => s && s.id === id ? { ...s, saved: !s.saved } : s) }}
        onReply={(id, text) => {
          reply(id, text)
          const ticketKey = selected?.meta?.publicCode || selected?.meta?.ticketId
          if (ticketKey) {
            api(`/system-tickets/${encodeURIComponent(ticketKey)}/reply`, { method: 'POST', body: { message: text } }).catch(() => {})
          }
          setSelected(s => s && s.id === id ? { ...s, read: true, replied: text } : s)
        }}
        onAccept={(id, reason) => respondInvite(id, true, reason)}
        onDecline={(id, reason) => respondInvite(id, false, reason)}
      />
    </div>
  )
}

