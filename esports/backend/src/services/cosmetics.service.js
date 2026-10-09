import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { COSMETICS, FALLBACK, FOUNDER_LIMIT, REFERRALS_NEEDED, SOURCE_DURATION_MS } from '../config/cosmetics.js'

// Motor de desbloqueo de cosmeticos (estados, marcos, placas, cartas). Es la
// fuente de verdad: /auth/me, login y PATCH /profile/me mandan la lista en
// `user.cosmeticUnlocks` (el frontend, lib/cosmeticUnlocks.js, pinta eso) y
// updateProfile rechaza lo que no este aqui.
//
// Dos origenes:
//  1. Deducidos al vuelo de datos reales: bienvenida (tener cuenta), Premium
//     (plan de pago), perfil completo, semana del cumpleanos, fundador (los
//     primeros 100), referidos (3 cuentas con referredBy = el) y torneos OFICIALES de GlitchGang: haber jugado uno
//     terminado y los titulos de podio (User.titles, los escribe
//     tournamentTitles.service.js). Los resultados que el jugador carga a
//     mano (PlayerTournamentResult) no cuentan.
//  2. `User.cosmeticGrants` guardados: lo que no se puede deducir (MVP,
//     racha, ranking, evento de temporada, votacion, logros de partida).
//     Hoy nada los escribe todavia; cuando exista ese dato se otorgan ahi.

// RD es UTC-4 todo el ano (sin horario de verano).
const RD_OFFSET_MS = 4 * 60 * 60 * 1000

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// Mismo calculo que completionScore() de EditProfile.jsx. Genero, idiomas y
// pais siempre cuentan alli (el formulario los rellena con un valor por
// defecto), asi que aqui tambien.
export function profileCompletion(user) {
  const gp = user?.gamerProfile || {}
  const social = user?.social || {}
  const checks = [
    user?.nick,
    user?.birthDate,
    true,
    true,
    true,
    user?.bio,
    gp.mainGame || user?.games?.[0],
    user?.experienceLevel,
    user?.mainPlatform,
    user?.games?.length,
    social.discord || social.instagram || social.twitch || social.youtube,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// Semana del cumpleanos en hora de RD: desde las 00:00 del dia del cumple
// hasta 7 dias despues. birthDate se guarda a medianoche UTC, por eso se lee
// el dia/mes en UTC.
export function birthdayWindow(birthDate, now = new Date()) {
  const born = toDate(birthDate)
  if (!born) return null
  const rdYear = new Date(now.getTime() - RD_OFFSET_MS).getUTCFullYear()
  for (const year of [rdYear - 1, rdYear]) {
    const start = new Date(Date.UTC(year, born.getUTCMonth(), born.getUTCDate()) + RD_OFFSET_MS)
    const end = new Date(start.getTime() + SOURCE_DURATION_MS.birthday)
    if (now >= start && now < end) return { start, end }
  }
  return null
}

// Propositos activos ahora mismo -> { grantedAt, expiresAt }.
function activeSources(user, { titles = [], played = false, founder = false, referrals = 0 }, now) {
  const sources = new Map()
  const add = (source, grantedAt = null, expiresAt = null) => sources.set(source, { grantedAt, expiresAt })

  add('welcome', toDate(user.createdAt))
  if (user.plan && user.plan !== 'Free') add('premium')
  if (profileCompletion(user) >= 100) add('profile')
  const birthday = birthdayWindow(user.birthDate, now)
  if (birthday) add('birthday', birthday.start, birthday.end)
  if (founder) add('founder')
  if (referrals >= REFERRALS_NEEDED) add('referral')

  const placements = titles.map(title => Number(title.placement)).filter(n => n > 0)
  if (played || placements.length) add('firstTournament')
  if (placements.length) {
    const best = Math.min(...placements)
    if (best <= 3) add('podium')
    if (best <= 2) add('finalist')
    if (best === 1) add('winner')
  }
  const lastWin = titles
    .filter(title => Number(title.placement) === 1)
    .map(title => toDate(title.date))
    .filter(Boolean)
    .sort((a, b) => b - a)[0]
  if (lastWin) {
    const expiresAt = new Date(lastWin.getTime() + SOURCE_DURATION_MS.champion)
    if (expiresAt > now) add('champion', lastWin, expiresAt)
  }
  return sources
}

// Lista de grants vigentes (deducidos + guardados), con la forma que lee el
// frontend: [{ kind, item, source, grantedAt, expiresAt }]. Los cosmeticos
// 'base' no aparecen: siempre estan disponibles.
export function buildGrants(user, facts = {}, now = new Date()) {
  const sources = activeSources(user, facts, now)
  const grants = new Map()
  for (const [kind, items] of Object.entries(COSMETICS)) {
    for (const [item, source] of Object.entries(items)) {
      const active = sources.get(source)
      if (active) grants.set(`${kind}:${item}`, { kind, item, source, ...active })
    }
  }
  for (const grant of Array.isArray(user.cosmeticGrants) ? user.cosmeticGrants : []) {
    const expiresAt = toDate(grant.expiresAt)
    if (expiresAt && expiresAt <= now) continue
    const key = `${grant.kind}:${grant.item}`
    if (!COSMETICS[grant.kind]?.[grant.item]) continue
    const current = grants.get(key)
    // Si ya esta deducido de forma permanente no se pisa con uno que vence.
    if (current && !current.expiresAt) continue
    grants.set(key, {
      kind: grant.kind,
      item: String(grant.item),
      source: grant.source,
      grantedAt: toDate(grant.grantedAt),
      expiresAt,
    })
  }
  return [...grants.values()]
}

// Jugo algun torneo ya terminado: estaba en el roster congelado del check-in
// o, si ese torneo no tuvo check-in, en un equipo inscrito.
async function playedFinishedTournament(userId) {
  const teamIds = (await Team.find({ $or: [{ leader: userId }, { members: userId }] }).select('_id').lean()).map(team => team._id)
  return Boolean(await Tournament.exists({
    status: 'finished',
    registrations: { $elemMatch: { status: { $ne: 'withdrawn' }, $or: [{ 'rosterSnapshot.userId': userId }, { team: { $in: teamIds } }] } },
  }))
}

export async function loadCosmeticFacts(user) {
  const [stored, played, earlier, referrals] = await Promise.all([
    User.findById(user._id).select('titles').lean(),
    playedFinishedTournament(user._id),
    user.createdAt ? User.countDocuments({ createdAt: { $lt: user.createdAt } }) : Promise.resolve(Infinity),
    User.countDocuments({ referredBy: user._id }),
  ])
  return { titles: stored?.titles || [], played, founder: earlier < FOUNDER_LIMIT, referrals }
}

export async function getCosmeticGrants(user, now = new Date()) {
  return buildGrants(user, await loadCosmeticFacts(user), now)
}

const KIND_BY_FIELD = { activeStatus: 'status', activeFrame: 'frame', activeBadge: 'plate' }

export function isKnownCosmetic(kind, item) {
  return Boolean(COSMETICS[kind]?.[String(item)])
}

export function isCosmeticUnlocked(kind, item, grants) {
  const source = COSMETICS[kind]?.[String(item)]
  if (!source) return false
  if (source === 'base') return true
  return grants.some(grant => grant.kind === kind && String(grant.item) === String(item))
}

// Valida lo que llega en un PATCH de perfil. Devuelve null si todo esta bien
// o { status, message } con el primer problema.
export function checkEquipUpdates(updates, grants) {
  for (const [field, kind] of Object.entries(KIND_BY_FIELD)) {
    if (updates[field] === undefined) continue
    const item = String(updates[field])
    if (!isKnownCosmetic(kind, item)) {
      return { status: 400, message: `Cosmetico desconocido: ${item}` }
    }
    if (!isCosmeticUnlocked(kind, item, grants)) {
      return { status: 403, message: 'Ese cosmetico esta bloqueado: todavia no cumples el requisito o ya se vencio.' }
    }
  }
  return null
}

// Si lo equipado se vencio, ya no esta desbloqueado o es un id viejo
// (pixel-rush, 101...), vuelve al regalo de bienvenida / 'online'.
export function equippedCorrections(user, grants) {
  const fixes = {}
  for (const [field, kind] of Object.entries(KIND_BY_FIELD)) {
    const current = user[field]
    if (current === undefined || current === null || current === '') continue
    if (!isCosmeticUnlocked(kind, current, grants)) fixes[field] = FALLBACK[kind]
  }
  return fixes
}

// Calcula los grants, corrige y guarda lo equipado que ya no vale. Muta
// `user` (un objeto lean) para que la respuesta salga ya corregida.
export async function syncCosmetics(user, now = new Date()) {
  const grants = await getCosmeticGrants(user, now)
  const fixes = equippedCorrections(user, grants)
  if (Object.keys(fixes).length) {
    await User.updateOne({ _id: user._id }, { $set: fixes })
    Object.assign(user, fixes)
  }
  return grants
}
