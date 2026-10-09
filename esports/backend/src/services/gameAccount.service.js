// Verificacion de cuentas de Mobile Legends con el codigo que Moonton manda
// al CORREO DENTRO DEL JUEGO. Solo el dueno de la cuenta puede abrir ese
// correo, asi que acertar el codigo prueba que el ID es suyo.
//
// Usa la API comunitaria Rone Arena (https://arena.rone.dev, no oficial, sin
// afiliacion con Moonton, codigo BSD-3). Flujo:
//   POST /user/auth/send-vc {role_id, zone_id}      -> codigo de 4 digitos, 5 min
//   POST /user/auth/login   {role_id, zone_id, vc}  -> jwt
//   GET  /user/info  (Bearer jwt)                   -> nick, nivel, rango, avatar
//   POST /user/auth/logout (Bearer jwt)             -> el jwt no se guarda nunca
// Si el proveedor cambia o se cae, solo hay que tocar este archivo.
import { config } from '../config/index.js'

export const CODE_TTL_MS = 5 * 60 * 1000
export const CONFIRM_TTL_MS = 15 * 60 * 1000
export const MAX_CODE_ATTEMPTS = 5
// Respuesta de Moonton cuando el ID + servidor no existe.
const ROLE_NOT_FOUND = -20007

export function gameAccountError(message, status = 400, code = '') {
  return Object.assign(new Error(message), { status, ...(code ? { payload: { code } } : {}) })
}

const unavailable = () => gameAccountError('No pudimos comunicarnos con Mobile Legends ahora. Inténtalo en unos minutos.', 503, 'GAME_SERVICE_UNAVAILABLE')

/** ID y servidor solo con digitos, en el rango que usa MLBB. */
export function parseMlbbIds(roleId, zoneId) {
  const role = String(roleId ?? '').trim()
  const zone = String(zoneId ?? '').trim().replace(/^\((.*)\)$/, '$1')
  if (!/^\d{4,12}$/.test(role)) throw gameAccountError('El ID de juego tiene entre 4 y 12 números. Lo ves en tu perfil de Mobile Legends, debajo de tu nombre.', 400, 'INVALID_ROLE_ID')
  if (!/^\d{1,6}$/.test(zone)) throw gameAccountError('El servidor son solo números: es el que aparece entre paréntesis junto a tu ID.', 400, 'INVALID_ZONE_ID')
  return { roleId: role, zoneId: zone }
}

// Rangos de rank_level segun /academy/ranks (1-105) y la escala del juego:
// Leyenda son 5 divisiones de 5 estrellas (106-130) y de ahi en adelante Mitico.
const RANK_TIERS = [[10, 'Guerrero'], [25, 'Élite'], [45, 'Maestro'], [75, 'Gran Maestro'], [105, 'Épico'], [130, 'Leyenda']]
export function mlbbRankName(level) {
  const n = Number(level)
  if (!Number.isFinite(n) || n <= 0) return ''
  const tier = RANK_TIERS.find(([max]) => n <= max)
  return tier ? tier[1] : 'Mítico'
}

async function call(path, { method = 'GET', body, jwt, fetchImpl = fetch, baseUrl = config.gameAccounts.baseUrl, retried = false } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.gameAccounts.timeoutMs)
  let res
  try {
    res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    console.error('[GameAccount] Sin respuesta del servicio:', error.message)
    throw unavailable()
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json().catch(() => null)
  // "High traffic": el servicio sugiere otro host en vez de reintentar a ciegas.
  // Solo se sigue si es del mismo proveedor: la respuesta no decide a donde
  // mandamos el ID y el codigo del jugador.
  const alternative = data?.alternative_endpoint
  if (res.status === 503 && !retried && sameProvider(alternative, baseUrl)) {
    return call(path, { method, body, jwt, fetchImpl, baseUrl: alternative.replace(/\/+$/, ''), retried: true })
  }
  return { status: res.status, data }
}

// Mismo dominio que el configurado (arena.rone.dev -> *.rone.dev) o uno de
// GAME_ACCOUNT_VERIFY_ALT_HOSTS; solo https.
export function sameProvider(candidate, baseUrl, altHosts = config.gameAccounts.altHosts) {
  if (typeof candidate !== 'string') return false
  try {
    const next = new URL(candidate)
    const domain = new URL(baseUrl).hostname.split('.').slice(-2).join('.')
    if (next.protocol !== 'https:' || next.username || next.password) return false
    return next.hostname === domain || next.hostname.endsWith(`.${domain}`) || (altHosts || []).includes(next.hostname)
  } catch { return false }
}

/** Pide a Moonton que mande el codigo al correo del juego. */
export async function sendMlbbCode(roleId, zoneId, { fetchImpl } = {}) {
  if (!config.gameAccounts.enabled) throw unavailable()
  const { status, data } = await call('/user/auth/send-vc', { method: 'POST', body: { role_id: Number(roleId), zone_id: Number(zoneId) }, fetchImpl })
  if (status === 200 && data?.code === 0) return true
  if (data?.code === ROLE_NOT_FOUND) throw gameAccountError('No encontramos esa cuenta. Revisa el ID y el servidor tal como salen en tu perfil del juego.', 404, 'GAME_ACCOUNT_NOT_FOUND')
  console.error('[GameAccount] send-vc rechazado:', status, data?.code, data?.msg)
  if (status >= 500 || status === 429) throw unavailable()
  throw gameAccountError('Mobile Legends no aceptó enviar el código ahora. Espera un minuto e inténtalo de nuevo.', 502, 'GAME_CODE_NOT_SENT')
}

/**
 * Valida el codigo y devuelve los datos de la cuenta. El jwt se usa solo
 * aqui dentro y se cierra la sesion al terminar.
 */
export async function verifyMlbbCode(roleId, zoneId, vc, { fetchImpl } = {}) {
  if (!config.gameAccounts.enabled) throw unavailable()
  const login = await call('/user/auth/login', { method: 'POST', body: { role_id: Number(roleId), zone_id: Number(zoneId), vc: Number(vc) }, fetchImpl })
  const session = login.data?.data
  if (login.status === 429 || login.status === 503) throw unavailable()
  // Con un codigo equivocado o vencido el servicio responde code != 0 o un 500.
  if (login.status !== 200 || login.data?.code !== 0 || !session?.jwt) {
    throw gameAccountError('Código incorrecto o vencido. Revisa el correo del juego o pide uno nuevo.', 400, 'GAME_CODE_INVALID')
  }
  if ((session.roleid != null && String(session.roleid) !== String(roleId)) || (session.zoneid != null && String(session.zoneid) !== String(zoneId))) {
    throw gameAccountError('El juego devolvió otra cuenta distinta a la que escribiste. Pide un código nuevo.', 409, 'GAME_ACCOUNT_MISMATCH')
  }
  let info = null
  try {
    const res = await call('/user/info', { jwt: session.jwt, fetchImpl })
    if (res.status === 200 && res.data?.code === 0) info = res.data.data || null
  } catch {
    // El codigo ya probo que la cuenta es suya; sin perfil solo faltan los datos visibles.
  }
  call('/user/auth/logout', { method: 'POST', jwt: session.jwt, fetchImpl }).catch(() => {})
  return {
    nickname: String(info?.name || '').slice(0, 60),
    avatar: /^https:\/\//.test(String(info?.avatar || '')) ? String(info.avatar).slice(0, 500) : '',
    level: Number.isFinite(Number(info?.level)) ? Number(info.level) : null,
    rankLevel: Number.isFinite(Number(info?.rank_level)) ? Number(info.rank_level) : null,
    historyRankLevel: Number.isFinite(Number(info?.history_rank_level)) ? Number(info.history_rank_level) : null,
    country: String(info?.reg_country || '').slice(0, 8),
  }
}

/** Lo que ve el propio jugador de su cuenta. */
export function ownAccountView(doc) {
  if (!doc) return null
  return {
    game: doc.game,
    roleId: doc.roleId,
    zoneId: doc.zoneId,
    status: doc.status,
    nickname: doc.nickname || '',
    avatar: doc.avatar || '',
    level: doc.level ?? null,
    rank: mlbbRankName(doc.rankLevel),
    highestRank: mlbbRankName(doc.historyRankLevel),
    country: doc.country || '',
    codeSentAt: doc.codeSentAt || null,
    codeExpiresAt: doc.codeSentAt ? new Date(new Date(doc.codeSentAt).getTime() + CODE_TTL_MS) : null,
    verifiedAt: doc.verifiedAt || null,
  }
}
