import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { getRedisClient } from '../services/redis.service.js'
import { extractToken } from './auth.middleware.js'

// Cada limitador usa su propio prefijo y su propia ventana: antes todos
// compartían la misma clave (la IP) en Redis y la ventana fija de 15 min.
function makeStore(prefix, windowMs) {
  const redis = getRedisClient()
  if (!redis) return undefined // express-rate-limit uses memory store by default

  // Minimal Redis store adapter for express-rate-limit v7
  return {
    async increment(key) {
      const k = `rl:${prefix}:${key}`
      const multi = redis.multi()
      multi.incr(k)
      multi.pttl(k)
      const [[, count], [, ttl]] = await multi.exec()
      if (ttl < 0) await redis.pexpire(k, windowMs)
      return { totalHits: count, resetTime: undefined }
    },
    async decrement(key) { await redis.decr(`rl:${prefix}:${key}`) },
    async resetKey(key) { await redis.del(`rl:${prefix}:${key}`) },
  }
}

// Con sesión se cuenta por usuario, no por IP: en un evento presencial (LAN,
// wifi de universidad) todos comparten IP y se bloqueaban entre sí. El token
// solo se decodifica para elegir la clave; la autenticación real va después.
function userOrIpKey(req) {
  const token = extractToken(req)
  const sub = token ? jwt.decode(token)?.sub : null
  return sub ? `u:${sub}` : `ip:${req.ip}`
}

// Login/registro: por IP + cuenta intentada, para que una sala con la misma IP
// no se bloquee entera, pero sí se frene la fuerza bruta contra una cuenta.
function ipAndIdentifierKey(req) {
  const id = String(req.body?.identifier || req.body?.email || req.body?.nick || '').trim().toLowerCase()
  return `ip:${req.ip}:${id}`
}

function limiter(name, options) {
  const windowMs = options.windowMs || 15 * 60 * 1000
  return rateLimit({
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(name, windowMs),
    handler: (_req, res) => res.status(429).json({ message: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' }),
    ...options,
  })
}

export const authLimiter = limiter('auth', { windowMs: 15 * 60 * 1000, max: 10, keyGenerator: ipAndIdentifierKey })
export const passwordLimiter = limiter('password', { windowMs: 60 * 60 * 1000, max: 5, keyGenerator: ipAndIdentifierKey })
export const generalLimiter = limiter('general', { windowMs: 15 * 60 * 1000, max: 300, keyGenerator: userOrIpKey })
export const uploadLimiter = limiter('upload', { windowMs: 60 * 60 * 1000, max: 40, keyGenerator: userOrIpKey })

// Toda escritura (POST/PUT/PATCH/DELETE) de la API: frena bots que inundan
// posts, mensajes, solicitudes o tickets. 120 cada 5 min por usuario es de
// sobra para uso humano. El bot de Discord y los webhooks quedan fuera.
const writeLimiterInner = limiter('write', { windowMs: 5 * 60 * 1000, max: 120, keyGenerator: userOrIpKey })
export function writeLimiter(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.path.startsWith('/bots') || req.path.startsWith('/payments/webhook')) return next()
  return writeLimiterInner(req, res, next)
}
