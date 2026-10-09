import { Server } from 'socket.io'
import { config } from '../config/index.js'
import { verifySessionToken } from '../middleware/auth.middleware.js'

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
  const cookies = parseCookies(socket.handshake.headers?.cookie || '')
  return cookies[config.cookie.name] || null
}

// Misma verificación que requireAuth (auth.middleware.js): JWT firmado con
// config.jwt.secret, jti activo en Session. Duplicado a propósito -- ese
// archivo es intocable esta sesión (arquitectura de auth), esto solo LEE el
// mismo cookie/JWT que ya emite auth.controller.js, no cambia cómo se emite.
async function authenticateSocket(socket) {
  const token = tokenFromSocket(socket)
  if (!token) throw new Error('Authentication required')
  // Misma validación que la API: solo sesiones reales (no tokens de 2FA/vínculo).
  const { decoded, user } = await verifySessionToken(token)
  if (!config.mongoEnabled) return { _id: decoded.sub, role: decoded.role || 'player' }
  return { _id: user._id, role: user.role, isBanned: user.isBanned }
}

/** Empuja un evento en vivo a un usuario conectado. No-op si no está conectado o si el socket no ha arrancado (dev sin mongo, tests). */
export function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return
  ioInstance.to(`user:${String(userId)}`).emit(event, payload)
}

export function initializeRealtime(server) {
  const allowedOrigins = config.isProd
    ? [config.clientOrigin]
    : [config.clientOrigin, 'http://localhost:5174', 'http://localhost:5175']

  ioInstance = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
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
    socket.join(`user:${String(socket.user._id)}`)
  })

  return ioInstance
}
