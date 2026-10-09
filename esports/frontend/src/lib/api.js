import {showcaseApi} from './showcaseApi.js'
const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || '/api'
// Use Vite's same-origin proxy in development so cookies and CSRF keep working
// when the dev server moves from 5173 to 5174 (or another available port).
export const API_URL = import.meta.env.DEV && /^https?:\/\/(localhost|127\.0\.0\.1):4000\/api\/?$/i.test(CONFIGURED_API_URL)
  ? '/api'
  : CONFIGURED_API_URL.replace(/\/$/, '')
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
let csrfToken = ''
let csrfRequest = null

async function getCsrfToken(force = false) {
  if (csrfToken && !force) return csrfToken
  if (!csrfRequest || force) {
    csrfRequest = fetch(`${API_URL}/csrf-token`, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo iniciar la sesión segura')
        const data = await response.json()
        csrfToken = data.csrfToken || ''
        return csrfToken
      })
      .finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

export async function api(path, options = {}) {
  return showcaseApi(path, options);
}
async function serverApi(path, options = {}) {
  const raw = localStorage.getItem('gg-session') || sessionStorage.getItem('gg-session')
  const isFormData = options.body instanceof FormData
  const headers = { ...(!isFormData ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  const method = String(options.method || 'GET').toUpperCase()

  if (raw) {
    try {
      const session = JSON.parse(raw)
      if (session?.token) {
        headers['Authorization'] = `Bearer ${session.token}`
      }
    } catch {}
  }

  if (!SAFE_METHODS.has(method)) headers['x-csrf-token'] = await getCsrfToken()

  let body = options.body
  if (body && !isFormData && typeof body !== 'string') {
    body = JSON.stringify(body)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    body,
    headers,
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))
  // En la primera visita (sin cookie CSRF) varias peticiones GET simultaneas
  // reciben cada una un token nuevo y la cookie final puede no coincidir con el
  // que se guardo aqui: el primer POST fallaba con "Invalid CSRF token".
  // Se pide el token otra vez (ya con la cookie asentada) y se reintenta una vez.
  if (response.status === 403 && /csrf/i.test(data.message || '') && !options.__csrfRetried) {
    await getCsrfToken(true)
    return api(path, { ...options, __csrfRetried: true })
  }
  if (!response.ok) {
    const err = new Error(data.message || data.error || 'Could not connect to the server')
    err.status = response.status
    if (data.code) err.code = data.code
    // Token inválido/expirado — notificar para limpiar la sesión
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('gg:auth:expired'))
    }
    throw err
  }
  return data
}

// Archivo protegido (p. ej. la pista de voz de una grabación): misma sesión
// que api(), pero devuelve el Blob en vez de JSON. Un <audio src> directo no
// manda el Authorization y, con el API en otro dominio, tampoco la cookie.
export async function apiBlob(path) {
  const raw = localStorage.getItem('gg-session') || sessionStorage.getItem('gg-session')
  const headers = {}
  if (raw) {
    try {
      const session = JSON.parse(raw)
      if (session?.token) headers['Authorization'] = `Bearer ${session.token}`
    } catch {}
  }
  const response = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const err = new Error(data.message || 'No se pudo descargar el archivo')
    err.status = response.status
    if (response.status === 401) window.dispatchEvent(new CustomEvent('gg:auth:expired'))
    throw err
  }
  return response.blob()
}

