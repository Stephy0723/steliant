import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { STATUS_BY_ID, resolveStatusId, sourceDurationMs } from '../data/cosmetics.js'

// Decide que cosmeticos tiene desbloqueados un jugador y hasta cuando.
//
// Fuente de verdad: `user.cosmeticUnlocks`, la lista que calcula el backend
// (services/cosmetics.service.js) y manda en /auth/me, login y PATCH
// /profile/me: [{ kind, item, source, grantedAt, expiresAt }]. Cubre
// bienvenida, Premium, cumpleanos, fundador, torneos OFICIALES y los grants
// guardados (MVP, racha...). El servidor rechaza equipar lo que no este ahi.
//
// Con esa lista solo se calcula aqui "Perfil completo", para que se
// desbloquee en vivo mientras se rellena el formulario (el servidor valida
// con el perfil ya guardado, mismo calculo).
//
// Sin esa lista (sesion vieja guardada antes de que existiera) se cae al
// calculo provisional de antes: cuenta, plan, cumpleanos, perfil y
// /players/me/tournaments (que incluye resultados cargados a mano).

const DAY = 24 * 60 * 60 * 1000

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// birthDate se guarda como fecha (medianoche UTC): se lee el dia/mes en UTC
// para que en RD (UTC-4) no caiga un dia antes.
function birthMonthDay(birthDate) {
  const born = toDate(birthDate)
  return born ? { month: born.getUTCMonth(), day: born.getUTCDate() } : null
}

export function isBirthdayToday(birthDate, now = new Date()) {
  const md = birthMonthDay(birthDate)
  return Boolean(md) && now.getMonth() === md.month && now.getDate() === md.day
}

// Semana del cumpleanos: desde el dia del cumple hasta 7 dias despues.
export function birthdayWindow(birthDate, now = new Date()) {
  const md = birthMonthDay(birthDate)
  if (!md) return null
  for (const year of [now.getFullYear() - 1, now.getFullYear()]) {
    const start = new Date(year, md.month, md.day)
    const end = new Date(start.getTime() + 7 * DAY)
    if (now >= start && now < end) return { start, end }
  }
  return null
}

// Estado que se muestra: el dia del cumpleanos se pone solo "Cumpleanos".
export function displayStatusId(user, now = new Date()) {
  if (isBirthdayToday(user?.birthDate, now)) return 'bday'
  return resolveStatusId(user?.activeStatus)
}

export function displayStatus(user, now = new Date()) {
  return STATUS_BY_ID[displayStatusId(user, now)]
}

function buildFacts({ user, results = [], profileScore = 0, now = new Date() }) {
  const official = results.filter(result => Number(result.placement) > 0)
  const placements = official.map(result => Number(result.placement))
  const lastWin = official
    .filter(result => Number(result.placement) === 1)
    .map(result => toDate(result.date))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null
  const serverList = Array.isArray(user?.cosmeticUnlocks) ? user.cosmeticUnlocks : null
  const grants = (serverList || (Array.isArray(user?.cosmeticGrants) ? user.cosmeticGrants : []))
    .map(grant => ({ ...grant, expiresAt: toDate(grant.expiresAt) }))
  return {
    now,
    fromServer: Boolean(serverList),
    loggedIn: Boolean(user),
    premium: Boolean(user?.plan) && user.plan !== 'Free',
    profileComplete: profileScore >= 100,
    played: official.length > 0,
    best: placements.length ? Math.min(...placements) : 0,
    lastWin,
    birthday: birthdayWindow(user?.birthDate, now),
    grants,
  }
}

// Propositos que el frontend puede resolver solo. Devuelve null si no sabe.
function deriveSource(source, facts) {
  const { now } = facts
  if (facts.fromServer && source !== 'base' && source !== 'profile') return { unlocked: false }
  switch (source) {
    case 'base': return { unlocked: true }
    case 'welcome': return { unlocked: facts.loggedIn }
    case 'premium': return { unlocked: facts.premium, whileActive: facts.premium }
    case 'profile': return { unlocked: facts.profileComplete }
    case 'firstTournament': return { unlocked: facts.played }
    case 'podium': return { unlocked: facts.best > 0 && facts.best <= 3 }
    case 'finalist': return { unlocked: facts.best > 0 && facts.best <= 2 }
    case 'winner': return { unlocked: facts.best === 1 }
    case 'champion': {
      if (!facts.lastWin) return { unlocked: false }
      const expiresAt = new Date(facts.lastWin.getTime() + sourceDurationMs('champion'))
      return expiresAt > now ? { unlocked: true, expiresAt } : { unlocked: false, expiredAt: expiresAt }
    }
    case 'birthday':
      return facts.birthday ? { unlocked: true, expiresAt: facts.birthday.end } : { unlocked: false }
    default: return null
  }
}

export function cosmeticState(kind, item, facts) {
  if (!item) return { unlocked: false }
  const now = facts.now
  // "Perfil completo" sigue al formulario en vivo, no a lo ultimo guardado.
  if (facts.fromServer && item.source === 'profile') return { ...deriveSource('profile', facts), source: item.source }
  const grant = facts.grants.find(g => g.kind === kind && String(g.item) === String(item.id))
  if (grant && (!grant.expiresAt || grant.expiresAt > now)) {
    return { unlocked: true, expiresAt: grant.expiresAt, granted: true, source: grant.source || item.source }
  }
  const derived = deriveSource(item.source, facts)
  if (derived) return { ...derived, source: item.source }
  return {
    unlocked: false,
    source: item.source,
    expiredAt: grant?.expiresAt || null,
    // Depende de datos que el backend todavia no manda.
    waitingBackend: true,
  }
}

// "6 d", "5 h", "40 min" -- para la etiqueta de los regalos temporales.
export function formatRemaining(expiresAt, now = new Date()) {
  const date = toDate(expiresAt)
  if (!date) return ''
  const ms = date.getTime() - now.getTime()
  if (ms <= 0) return 'vencido'
  if (ms >= DAY) return `${Math.ceil(ms / DAY)} d`
  if (ms >= 60 * 60 * 1000) return `${Math.ceil(ms / (60 * 60 * 1000))} h`
  return `${Math.max(1, Math.ceil(ms / 60000))} min`
}

// Hook para el propio jugador (Editar perfil): devuelve `stateOf(kind, item)`.
// Solo trae sus resultados de torneo si el servidor no mando la lista.
export function useCosmeticUnlocks(user, profileScore = 0) {
  const fromServer = Array.isArray(user?.cosmeticUnlocks)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(Boolean(user) && !fromServer)
  const userId = user?.id || user?._id

  useEffect(() => {
    if (!userId || fromServer) { setLoading(false); return undefined }
    let alive = true
    setLoading(true)
    api('/players/me/tournaments?limit=50')
      .then(res => { if (alive) setResults(Array.isArray(res?.results) ? res.results : []) })
      .catch(() => { if (alive) setResults([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [userId, fromServer])

  const facts = useMemo(
    () => buildFacts({ user, results, profileScore }),
    [user, results, profileScore],
  )
  const stateOf = useCallback((kind, item) => cosmeticState(kind, item, facts), [facts])
  return { stateOf, loading, now: facts.now }
}

