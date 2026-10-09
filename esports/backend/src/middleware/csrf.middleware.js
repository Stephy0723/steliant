import crypto from 'node:crypto'
import { config } from '../config/index.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const PUBLIC_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/discord/callback',
  '/api/university/microsoft/callback',
  '/api/health',
  '/api/csrf-token',
])

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  )
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

// Sin HttpOnly a proposito (el cliente igual lee el token del JSON de
// /csrf-token). Antes decia "HttpOnly=false", que no existe: la sola presencia
// del atributo HttpOnly lo activaba.
function setCsrfCookie(res, token) {
  res.append('Set-Cookie',
    `${config.csrf.cookieName}=${token}; Path=/; SameSite=${config.cookie.sameSite}${config.cookie.secure ? '; Secure' : ''}`
  )
}

// Solo aqui nace el token. Antes se creaba en CUALQUIER respuesta sin cookie:
// en la primera visita la app lanza varios GET en paralelo, cada uno volvia
// con un Set-Cookie distinto y el ultimo en llegar pisaba al token que el
// cliente habia guardado -> el primer POST respondia 403 "Invalid CSRF token".
const TOKEN_PATHS = new Set(['/api/csrf-token', '/api/auth/csrf-token'])

export function csrfMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie)
  let csrfToken = cookies[config.csrf.cookieName]

  if (!csrfToken && req.method === 'GET' && TOKEN_PATHS.has(req.path)) {
    csrfToken = generateToken()
    setCsrfCookie(res, csrfToken)
  }

  // Safe methods or public paths skip validation. /api/bots/* is machine-to-machine
  // (the Discord bot, no browser session/cookies) — it's authenticated by
  // requireBotAuth's shared secret instead, so CSRF doesn't apply there.
  if (SAFE_METHODS.has(req.method) || PUBLIC_PATHS.has(req.path) || req.path.startsWith('/api/bots/')) {
    req.csrfToken = csrfToken
    return next()
  }

  const headerToken = req.headers[config.csrf.headerName]
  if (!csrfToken || !headerToken || headerToken !== csrfToken) {
    return res.status(403).json({ message: 'Invalid CSRF token' })
  }

  req.csrfToken = csrfToken
  next()
}
