// Datos de la tarjeta profesional de cada rol (RoleProfileCard), a partir de
// user.roleProfiles.<rol>.details. La misma tarjeta 3D del perfil de jugador
// (PlayerCard), con el color del rol, 3 datos clave al frente y el detalle
// del perfil profesional al reverso.
import { PLATFORM_ROLES } from '../data/roleApplications.js'
import { decodeList, decodeRate, decodeSchedule, decodeSocial, formatFieldValue } from './roleFieldCodec.js'
import { NO_EXPERIENCE } from '../data/roleFieldOptions.js'
import { GAME_BY_ID } from '../data/games.js'
import { gameAccountFormat } from '../../../shared/gameAccountIds.mjs'
import { gameKeyOf } from '../../../shared/games.mjs'

// name = campo del nombre profesional; stats = campos que se muestran al frente.
export const ROLE_CARD_META = {
  caster:    { accent: '#EF4444', name: 'casterName',    stats: ['mainGame', 'rate', 'availability'] },
  analyst:   { accent: '#06B6D4', name: 'analystName',   stats: ['specialty', 'rate', 'availability'] },
  coach:     { accent: '#F59E0B', name: 'coachName',     stats: ['mainGame', 'rate', 'availability'] },
  moderator: { accent: '#22C55E', name: 'moderatorName', stats: ['specialty', 'mainGame', 'rate'] },
  creator:   { accent: '#9146FF', name: 'creatorName',   stats: ['mainPlatform', 'yearsExp', 'portfolio'] },
  organizer: { accent: '#1E9DE3', name: 'orgName',       stats: ['eventType', 'yearsExp', 'website'] },
  sponsor:   { accent: '#F0A500', name: 'companyName',   stats: ['industry', 'yearsExp', 'website'] },
}

export const CARD_ROLE_IDS = Object.keys(ROLE_CARD_META)

const STAT_LABEL = {
  mainGame: 'juego', specialty: 'especialidad', rate: 'tarifa', availability: 'horario', mainPlatform: 'plataforma',
  yearsExp: 'experiencia', portfolio: 'red', website: 'red', eventType: 'eventos', industry: 'sector',
}

const clip = (text, max) => {
  const t = String(text || '').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

export function resolveCardImage(value) {
  if (!value) return ''
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch { /* url invalida: se usa tal cual */ }
  return text
}

const fieldOf = (role, id) => {
  const meta = PLATFORM_ROLES.find(r => r.id === role)
  return [...(meta?.profileFields || []), ...(meta?.experienceFields || [])].find(f => f.id === id)
}

// Valor corto para el frente de la tarjeta (cabe en una celda pequena).
function shortValue(field, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  switch (field?.type) {
    case 'games': {
      const list = decodeList(raw)
      return list.length > 1 ? `${clip(list[0], 9)} +${list.length - 1}` : clip(list[0], 12)
    }
    case 'multiselect': {
      const list = decodeList(raw)
      return list.length > 1 ? `${clip(list[0], 9)} +${list.length - 1}` : clip(list[0], 12)
    }
    case 'rate': {
      const r = decodeRate(raw)
      if (r.legacy) return clip(r.legacy, 12)
      if (r.mode === 'negotiable') return 'Negociable'
      if (r.mode === 'free') return 'Gratis'
      return `${r.min}${r.max ? `-${r.max}` : ''} ${r.currency}`.trim()
    }
    case 'schedule': {
      const s = decodeSchedule(raw)
      if (s.legacy) return clip(s.legacy, 12)
      if (s.presets.length) return clip(s.presets[0], 12)
      return Object.keys(s.days).length ? `${Object.keys(s.days).length} días` : ''
    }
    case 'social': {
      const s = decodeSocial(raw)
      return clip(s.platform || s.handle, 12)
    }
    default:
      return clip(raw, 13)
  }
}

const cleanLabel = (label) => String(label || '').replace(/\s*\(opcional\)/i, '').toLowerCase()

// ── Jugador profesional ────────────────────────────────────────────────
// No es un rol aprobado: todos son jugadores desde que se registran. Es la
// tarjeta con la que un jugador se presenta ante los equipos (gamerProfile.pro).
export const PRO_PLAYER_ACCENT = '#A855F7'

/** Perfil profesional de jugador guardado (acepta los nombres anteriores lft/recruiting). */
export function getProPlayerProfile(user) {
  const gp = user?.gamerProfile || {}
  const raw = gp.pro || gp.lft || gp.recruiting
  return raw && typeof raw === 'object' ? raw : null
}

export const hasProPlayerProfile = (user) => Boolean(getProPlayerProfile(user)?.entries?.some(e => e?.gameId))

/** ID de cuenta que el jugador guardo en su tarjeta para `game` (id o nombre), o ''. */
export function proAccountIdFor(user, game) {
  const key = gameKeyOf(game)
  if (!key) return ''
  const entry = (getProPlayerProfile(user)?.entries || []).find(e => e?.gameId && gameKeyOf(e.gameId) === key)
  return entry?.accountId || ''
}

const gameLabel = (id) => GAME_BY_ID[id]?.name || id || ''

/** Props de PlayerCard para la tarjeta de jugador profesional. `pro` permite previsualizar sin guardar. */
export function buildProPlayerCard(user, pro) {
  const d = pro || getProPlayerProfile(user) || {}
  const entries = (Array.isArray(d.entries) ? d.entries : []).filter(e => e?.gameId)
  const first = entries[0] || null
  const sched = decodeSchedule(d.schedule)
  const langs = decodeList(d.languages)

  const backBlocks = []
  if (entries.length) {
    backBlocks.push({
      title: 'Juegos y rangos',
      rows: entries.map(e => ({
        label: gameLabel(e.gameId).toLowerCase(),
        value: [e.rank, e.role].filter(Boolean).join(' · ') + (e.peakRank ? ` (máx. ${e.peakRank})` : '') || '-',
        wide: true,
      })),
    })
  }
  // El ID de cada juego con el nombre que le da ese juego (Riot ID, BattleTag,
  // UID...). mono implica raw en Data: el traductor no toca lo que escribio el usuario.
  const accounts = entries.filter(e => e.accountId)
  if (accounts.length) {
    backBlocks.push({
      title: 'Cuentas de juego',
      rows: accounts.map(e => ({
        label: `${gameLabel(e.gameId).split(':')[0].toLowerCase()} · ${gameAccountFormat(e.gameId).label}`,
        value: e.accountId,
        mono: true,
        wide: true,
      })),
    })
  }
  const availability = []
  if (d.schedule) availability.push({ label: 'horario', value: formatFieldValue({ type: 'schedule' }, sched.legacy || d.schedule), wide: true })
  if (langs.length) availability.push({ label: 'idiomas', value: langs.join(', '), wide: true })
  if (d.objective) availability.push({ label: 'busca', value: d.objective, wide: true })
  if (d.experience) availability.push({ label: 'experiencia', value: d.experience, wide: true })
  if (availability.length) backBlocks.push({ title: 'Disponibilidad', rows: availability })
  // raw: texto escrito por el usuario, el traductor legacy no lo toca.
  if (d.about) backBlocks.push({ title: 'Presentación', text: clip(d.about, 280), raw: true })
  if (!backBlocks.length) backBlocks.push({ title: 'Perfil profesional de jugador', text: 'Aún no completó su perfil profesional.' })

  return {
    accent: PRO_PLAYER_ACCENT,
    stats: first
      ? [
          { label: 'juego', value: clip(gameLabel(first.gameId).split(':')[0], 14) },
          { label: 'rango', value: clip(first.rank || '-', 13) },
          { label: 'rol', value: clip(first.role || '-', 13) },
        ]
      : null,
    status: { label: 'JUGADOR PRO', color: PRO_PLAYER_ACCENT },
    backBlocks,
    player: {
      nick: user?.nick || 'Jugador',
      avatar: resolveCardImage(d.photo || user?.avatar),
      code: user?.playerCode || '-',
      roles: ['Jugador Pro'],
      joined: '-',
    },
  }
}

/** Roles con tarjeta que la persona tiene aprobados (para elegir cuales mostrar). */
export function availableRoleCards(user) {
  const profiles = user?.roleProfiles || {}
  return CARD_ROLE_IDS.filter(role => profiles[role]?.approvedAt)
}

/** Props para PlayerCard de la tarjeta profesional de `role`. `details` permite previsualizar sin guardar. */
export function buildRoleCard(role, user, details) {
  if (role === 'proplayer') return buildProPlayerCard(user, details)
  const meta = ROLE_CARD_META[role]
  const roleDef = PLATFORM_ROLES.find(r => r.id === role)
  const profile = user?.roleProfiles?.[role] || {}
  const d = details || profile.details || {}
  const code = profile[`${role}Code`] || ''
  const label = roleDef?.label || role

  const stats = meta.stats
    .map(id => ({ label: STAT_LABEL[id] || id, value: shortValue(fieldOf(role, id), d[id]) }))
    .filter(item => item.value)

  const profileRows = (roleDef?.profileFields || [])
    .filter(f => f.id !== meta.name && f.id !== 'photo' && d[f.id])
    .map(f => ({
      label: cleanLabel(f.label),
      value: formatFieldValue(f, d[f.id]),
      wide: ['games', 'schedule', 'social', 'multiselect', 'languages'].includes(f.type) || String(d[f.id]).length > 22,
      mono: f.type === 'social',
    }))

  const noExperience = String(d.yearsExp || '').trim() === NO_EXPERIENCE
  const expRows = (roleDef?.experienceFields || [])
    .filter(f => f.id !== 'descComplex' && d[f.id] && !(noExperience && f.id !== 'yearsExp'))
    .map(f => ({ label: cleanLabel(f.label), value: clip(d[f.id], 60), wide: String(d[f.id]).length > 22 }))

  const backBlocks = []
  if (profileRows.length) backBlocks.push({ title: 'Perfil profesional', rows: profileRows })
  if (noExperience) backBlocks.push({ title: 'Experiencia', text: 'Sin experiencia previa: está empezando en este rol.' })
  else if (expRows.length) backBlocks.push({ title: 'Experiencia', rows: expRows })
  if (d.descComplex) backBlocks.push({ title: 'Presentación', text: clip(d.descComplex, 280), raw: true })
  if (!backBlocks.length) backBlocks.push({ title: 'Perfil profesional', text: 'Aún no completó su perfil profesional.' })

  return {
    accent: meta.accent,
    stats: stats.length ? stats : null,
    status: { label: label.toUpperCase(), color: meta.accent },
    backBlocks,
    player: {
      nick: d[meta.name] || user?.nick || label,
      avatar: resolveCardImage(d.photo || user?.avatar),
      code: code || '-',
      roles: [label],
      joined: profile.approvedAt ? new Date(profile.approvedAt).toLocaleDateString('es-DO', { month: 'short', year: 'numeric' }) : '-',
    },
  }
}

