import { Server } from 'socket.io'
import { verifySessionToken } from '../middleware/auth.middleware.js'
import { config } from '../config/index.js'
import { Conversation } from '../models/Conversation.js'
import { postMessage } from '../controllers/messages.controller.js'
import { applyPeer, loadPeers, unreadFor } from '../services/conversationView.service.js'
import { User } from '../models/User.js'
import { publicPresence } from '../../../shared/presence.mjs'

let ioInstance = null


function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const index = cookie.indexOf('=')
        if (index < 0) return [decodeURIComponent(cookie), '']
        return [decodeURIComponent(cookie.slice(0, index)), decodeURIComponent(cookie.slice(index + 1))]
      }),
  )
}

function tokenFromSocket(socket) {
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token
  if (authToken) return String(authToken).replace(/^Bearer\s+/i, '')
  const authHeader = socket.handshake.headers?.authorization || ''
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7)
  const cookies = parseCookies(socket.handshake.headers?.cookie || '')
  return cookies[config.cookie.name] || null
}

async function authenticateSocket(socket) {
  const token = tokenFromSocket(socket)
  if (!token) throw new Error('Authentication required')
  // Misma validación que la API: solo sesiones reales (no tokens de 2FA/vínculo).
  const { decoded, user } = await verifySessionToken(token)

  if (!config.mongoEnabled) {
    return {
      _id: decoded.sub,
      role: decoded.role ?? 'player',
      nick: 'Brooklyn',
      firstName: 'Demo',
      lastName: 'Player',
      countryCode: 'RD',
    }
  }

  return user
}

function canAccess(conversation, user) {
  const id = String(user?._id || '')
  if (!id) return false
  if (user?.role === 'admin' || user?.isAdmin) return true
  return (conversation.participants || []).some(participant => String(participant) === id)
}

function mapMessage(message) {
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    sender: message.sender ? String(message.sender) : null,
    senderName: message.senderName,
    senderRole: message.senderRole,
    kind: message.kind,
    text: message.text,
    card: message.card,
    attachments: message.attachments || [],
    relatedTicket: message.relatedTicket ? String(message.relatedTicket) : null,
    readBy: (message.readBy || []).map(String),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  }
}

function mapConversation(conversation, viewerId = null) {
  return {
    id: String(conversation._id),
    type: conversation.type,
    title: conversation.title,
    subtitle: conversation.subtitle,
    image: conversation.image,
    cover: conversation.cover,
    color: conversation.color,
    context: conversation.context,
    participants: (conversation.participants || []).map(String),
    unread: viewerId ? unreadFor(conversation, viewerId) : 0,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  }
}

function emitToUsers(userIds = [], event, payload) {
  if (!ioInstance) return
  userIds.forEach(id => {
    if (id) ioInstance.to(`user:${String(id)}`).emit(event, payload)
  })
}

/** Empuja cualquier evento en vivo a un usuario conectado. */
export function emitToUser(userId, event, payload) {
  emitToUsers([userId], event, payload)
}

// El mensaje va a la sala del chat; la conversacion actualizada va a cada
// participante por su sala personal, YA personalizada (titulo/foto del otro
// en chats privados, su propio "sin leer"). Antes se mandaba la misma copia
// a todos -- con el titulo guardado -- dos veces (sala del chat + personal).
export async function emitConversationMessage(conversation, message) {
  if (!ioInstance || !conversation || !message) return
  const conversationId = String(conversation._id || conversation.id || message.conversation)
  ioInstance.to(`conversation:${conversationId}`).emit('receive_message', mapMessage(message))

  const plain = typeof conversation.toObject === 'function' ? conversation.toObject() : conversation
  const participants = (plain.participants || []).map(String)
  try {
    const peersByViewer = await Promise.all(participants.map(viewerId => loadPeers([plain], viewerId)))
    participants.forEach((viewerId, index) => {
      const view = applyPeer(mapConversation(plain, viewerId), plain, viewerId, peersByViewer[index])
      ioInstance.to(`user:${viewerId}`).emit('conversation_updated', view)
    })
  } catch {
    emitToUsers(participants, 'conversation_updated', mapConversation(plain))
  }
}

// ── Presencia ──
// User.status ('online'/'offline') es lo que pintan Amigos y Equipos. Se
// enciende con el primer socket del usuario (NotificationsContext abre uno en
// toda la web) y se apaga cuando se cierra el ultimo (puede tener varias
// pestanas). 'ban' e 'inactivo' los pone el admin y no se pisan; 'activo'
// (lo que queda al desbanear) cuenta como presencia normal. "Invisible"
// nunca sale en linea.
const PRESENCE_STATES = ['online', 'offline', 'gaming', 'activo', null]
const openSockets = new Map()

function setPresence(user, online) {
  if (!config.mongoEnabled) return
  const status = online && user.activeStatus !== 'invisible' ? 'online' : 'offline'
  const update = online ? { status } : { status, lastSeenAt: new Date() }
  User.updateOne({ _id: user._id, status: { $in: PRESENCE_STATES } }, { $set: update })
    .then(result => { if (result?.modifiedCount) broadcastPresence(user._id, { status, activeStatus: user.activeStatus }) })
    .catch(() => {})
}

// Avisa a los amigos el estado a mostrar (shared/presence.mjs): asi Amigos,
// Mensajes y Equipos cambian al momento sin recargar.
async function broadcastPresence(userId, { status, activeStatus }) {
  if (!ioInstance) return
  try {
    const user = await User.findById(userId).select('friends lastSeenAt').lean()
    const payload = { userId: String(userId), ...publicPresence({ status, activeStatus, lastSeenAt: user?.lastSeenAt }) }
    for (const friendId of user?.friends || []) ioInstance.to(`user:${friendId}`).emit('presence', payload)
    ioInstance.to(`user:${userId}`).emit('presence', payload)
  } catch { /* la presencia no debe romper nada */ }
}

// El usuario cambio su estado elegido (Invisible, No molestar...): si esta
// conectado, se aplica ya (antes recien al reconectarse: elegir Invisible lo
// dejaba "en linea" para todos hasta cerrar la web).
export function refreshPresence(userId, activeStatus) {
  const id = String(userId)
  if (!openSockets.has(id)) return
  const status = activeStatus === 'invisible' ? 'offline' : 'online'
  if (!config.mongoEnabled) return
  User.updateOne({ _id: id, status: { $in: PRESENCE_STATES } }, { $set: { status } })
    .then(() => broadcastPresence(id, { status, activeStatus }))
    .catch(() => {})
}

function trackConnect(user) {
  const id = String(user._id)
  const count = (openSockets.get(id) || 0) + 1
  openSockets.set(id, count)
  if (count === 1) setPresence(user, true)
}

function trackDisconnect(user) {
  const id = String(user._id)
  const count = (openSockets.get(id) || 1) - 1
  if (count > 0) { openSockets.set(id, count); return }
  openSockets.delete(id)
  setPresence(user, false)
}

export function initializeMessagesRealtime(server) {
  // Tras un reinicio nadie tiene socket abierto: limpia los que quedaron "en linea".
  if (config.mongoEnabled) {
    User.updateMany({ status: { $in: ['online', 'gaming'] } }, { $set: { status: 'offline' } }).catch(() => {})
  }

  const origins = String(config.clientOrigin || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  ioInstance = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || origins.includes(origin) || (!config.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
          return callback(null, true)
        }
        return callback(new Error(`Origin not allowed by Socket.IO: ${origin}`), false)
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  })

  ioInstance.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket)
      next()
    } catch (error) {
      next(error)
    }
  })

  ioInstance.on('connection', socket => {
    const currentUser = socket.user
    socket.join(`user:${String(currentUser._id)}`)
    trackConnect(currentUser)
    socket.on('disconnect', () => trackDisconnect(currentUser))

    socket.on('join_chat', async conversationId => {
      const conversation = await Conversation.findById(conversationId).catch(() => null)
      if (!conversation || !canAccess(conversation, currentUser)) return
      socket.join(`conversation:${String(conversation._id)}`)
    })

    socket.on('leave_chat', conversationId => {
      socket.leave(`conversation:${String(conversationId || '')}`)
    })

    // Misma logica que POST /messages/conversations/:id/messages (bloqueos,
    // validacion de adjuntos/tarjetas, notificacion y tiempo real).
    socket.on('send_message', async data => {
      try {
        const conversation = await Conversation.findById(data?.conversationId).catch(() => null)
        if (!conversation || !canAccess(conversation, currentUser)) {
          socket.emit('message_error', { message: 'Conversation not found' })
          return
        }
        await postMessage(conversation, currentUser, data || {})
      } catch (error) {
        socket.emit('message_error', { message: error.message || 'No se pudo enviar el mensaje' })
      }
    })
  })

  return ioInstance
}
