import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { User } from '../models/User.js'
import { Session } from '../models/Session.js'

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  )
}

export function extractToken(req) {
  const cookies = parseCookies(req.headers.cookie)
  if (cookies[config.cookie.name]) return cookies[config.cookie.name]

  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)

  return null
}

function authError(message, status = 401) {
  return Object.assign(new Error(message), { status })
}

/**
 * Único punto que convierte un JWT en una sesión válida (API y sockets).
 * Con el mismo secreto también se firman tokens que NO son sesiones: el
 * temporal del 2FA ({ require2fa }) y los de vincular Discord/Microsoft
 * ({ purpose }, viajan en URLs). Antes se aceptaban como sesión: con la
 * contraseña se entraba sin el código 2FA. Una sesión real siempre tiene jti
 * (createSession) y debe seguir activa en Session.
 * Devuelve { decoded, user } o lanza un error con status.
 */
export async function verifySessionToken(token) {
  let decoded
  try {
    decoded = jwt.verify(token, config.jwt.secret)
  } catch {
    throw authError('Invalid or expired token')
  }
  if (!decoded?.sub || decoded.require2fa || decoded.purpose) throw authError('Invalid token type')

  if (!config.mongoEnabled) return { decoded, user: null }

  if (!decoded.jti) throw authError('Invalid token type')
  const session = await Session.findOne({ jti: decoded.jti, revokedAt: null }).lean()
  if (!session) throw authError('Session expired or revoked')
  // Update lastActiveAt without blocking the request
  Session.updateOne({ jti: decoded.jti }, { lastActiveAt: new Date() }).catch(() => {})

  const user = await User.findById(decoded.sub).lean()
  if (!user || user.deleted) throw authError('User not found')
  if (user.isBanned) throw authError('Account suspended', 403)
  return { decoded, user }
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req)

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    const { decoded, user } = await verifySessionToken(token)

    if (!config.mongoEnabled) {
      req.user = {
        _id: decoded.sub,
        role: decoded.role ?? 'player',
        nick: 'Brooklyn',
        firstName: 'Demo',
        lastName: 'Player',
        countryCode: 'RD',
        playerCode: 'D001-01',
        plan: 'Free',
        gp: 2480,
      }
      return next()
    }

    req.user = user
    req.tokenJti = decoded.jti
    next()
  } catch (err) {
    return res.status(err.status || 401).json({ message: err.message || 'Invalid or expired token' })
  }
}

// Public endpoints can still identify an authenticated owner/admin without
// turning authentication into a requirement. Invalid or expired credentials
// simply continue as an anonymous public request.
export async function optionalAuth(req, _res, next) {
  const token = extractToken(req)
  if (!token) return next()

  try {
    const { decoded, user } = await verifySessionToken(token)
    if (!config.mongoEnabled) {
      req.user = {
        _id: decoded.sub,
        role: decoded.role ?? 'player',
        countryCode: 'RD',
      }
      return next()
    }
    req.user = user
  } catch {
    // Anonymous response: never expose private IDs when optional auth fails.
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' })
  }
  next()
}
