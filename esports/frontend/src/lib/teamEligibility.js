// Reglas de quién puede entrar a un equipo (decididas 30/sep):
// - Femenino: solo mujeres (User.gender === 'female'), incluida quien lo crea.
// - Masculino / Mixto: descriptivo, no bloquea.
// - Alcance: abierto, solo del país del equipo o solo de su región.
// - Universitario: solo estudiantes verificados de esa universidad.
// - Idioma: requisito visible, nunca bloquea (no se puede comprobar).
// El frontend solo avisa antes; el backend tiene que hacer cumplir lo mismo
// (ver BACKEND-PENDIENTE: "Reglas de elegibilidad de equipos").

import {
  REGION_BY_COUNTRY, JOIN_SCOPES, normalizeCountry, regionForCountry, isRealCountry,
  teamGenderKey, teamJoinViolations,
} from '../../../shared/teamEligibility.mjs'

export { REGION_BY_COUNTRY, JOIN_SCOPES, normalizeCountry, regionForCountry, isRealCountry, teamGenderKey }

export const REGION_LABELS = {
  CAR: { es: 'Caribe', en: 'Caribbean' },
  CAM: { es: 'Centroamérica', en: 'Central America' },
  LAN: { es: 'LATAM Norte', en: 'LATAM North' },
  LAS: { es: 'LATAM Sur', en: 'LATAM South' },
  NA:  { es: 'Norteamérica', en: 'North America' },
  EU:  { es: 'Europa', en: 'Europe' },
}

const up = (value) => String(value || '').trim().toUpperCase()

export function regionLabel(code, isEs = true) {
  const r = REGION_LABELS[up(code)]
  return r ? (isEs ? r.es : r.en) : up(code)
}

export function flagUrl(code, width = 40) {
  const c = normalizeCountry(code)
  if (!isRealCountry(c)) return ''
  const iso = c === 'RD' ? 'do' : c.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2)
  return iso ? `https://flagcdn.com/w${width}/${iso}.png` : ''
}

export function teamGenderLabel(value, isEs = true) {
  const k = teamGenderKey(value)
  if (k === 'female') return isEs ? 'Femenino' : 'Women'
  if (k === 'male') return isEs ? 'Masculino' : 'Men'
  return isEs ? 'Mixto' : 'Mixed'
}

export function joinScopeLabel(scope, team, isEs = true) {
  if (scope === 'country') return isEs ? `Solo de ${countryName(team?.country, isEs)}` : `${countryName(team?.country, isEs)} only`
  if (scope === 'region') return isEs ? `Solo de ${regionLabel(team?.region, isEs)}` : `${regionLabel(team?.region, isEs)} only`
  return isEs ? 'Abierto a todos' : 'Open to everyone'
}

const COUNTRY_NAMES = {
  RD: 'República Dominicana', PR: 'Puerto Rico', CU: 'Cuba', JM: 'Jamaica', HT: 'Haití',
  MX: 'México', GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá',
  CO: 'Colombia', VE: 'Venezuela', EC: 'Ecuador', PE: 'Perú', BO: 'Bolivia', CL: 'Chile', AR: 'Argentina',
  UY: 'Uruguay', PY: 'Paraguay', BR: 'Brasil', US: 'Estados Unidos', CA: 'Canadá', ES: 'España',
}
export function countryName(code, isEs = true) {
  const c = normalizeCountry(code)
  if (!isEs && c === 'RD') return 'Dominican Republic'
  return COUNTRY_NAMES[c] || c
}

/**
 * Motivos por los que `user` no puede entrar a `team` (vacío = puede).
 * Cada motivo: { key, title, detail }.
 */
export function joinBlockers(team, user, isEs = true) {
  const uniName = team?.university?.universityName || team?.university?.universityTag
  const texts = {
    gender: [isEs ? 'Equipo femenino' : "Women's team", isEs ? 'Este equipo es solo para jugadoras.' : 'This team is for women players only.'],
    country: [isEs ? 'Solo jugadores del país' : 'Country only', isEs ? `Este equipo solo acepta jugadores de ${countryName(team?.country, isEs)}.` : `This team only accepts players from ${countryName(team?.country, isEs)}.`],
    region: [isEs ? 'Solo jugadores de la región' : 'Region only', isEs ? `Este equipo solo acepta jugadores de ${regionLabel(team?.region, isEs)}.` : `This team only accepts players from ${regionLabel(team?.region, isEs)}.`],
    university: [isEs ? 'Equipo universitario' : 'University team', isEs ? 'Solo estudiantes verificados pueden unirse.' : 'Only verified students can join.'],
    university_other: [isEs ? 'Otra universidad' : 'Different university', isEs ? `Solo estudiantes de ${uniName || 'esa universidad'}.` : `Only students from ${uniName || 'that university'}.`],
  }
  return teamJoinViolations(team, user).map(key => ({
    key: key === 'university_other' ? 'university' : key,
    title: texts[key][0],
    detail: texts[key][1],
  }))
}

// ─── Borrador del wizard "Crear equipo" ─────────────────────────────────────
// Se guarda al salir a verificar la universidad o vincular Discord, y se
// recupera con el botón "Volver a mi equipo". Vive en localStorage porque el
// login de Microsoft sale del sitio y vuelve en la misma pestaña.
const DRAFT_KEY = 'gg-team-draft-v1'
const DRAFT_TTL = 24 * 60 * 60 * 1000

export function saveTeamDraft(userKey, data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ userKey: String(userKey || ''), savedAt: Date.now(), data }))
  } catch {}
}

export function readTeamDraft(userKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (!raw || Date.now() - Number(raw.savedAt || 0) > DRAFT_TTL) return null
    if (userKey && raw.userKey && String(raw.userKey) !== String(userKey)) return null
    return raw.data || null
  } catch {
    return null
  }
}

export function clearTeamDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
}

export function hasTeamDraft(userKey) {
  return Boolean(readTeamDraft(userKey))
}

// Misma clave que usa Teams.jsx (wizardUserKey) para asociar el borrador.
export function teamDraftUserKey(user) {
  return user?._id || user?.id || user?.playerCode || user?.nick || 'local-user'
}

// "Volver a mi equipo": si esta pestaña la abrió el wizard (Discord abre en
// pestaña nueva), se cierra y se vuelve a la original, que refresca el
// usuario al recuperar el foco. Si no, se navega al wizard con el borrador.
export function returnToTeamDraft(navigate) {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.focus()
      window.close()
      return
    }
  } catch {}
  navigate('/equipos', { state: { resumeTeamDraft: true } })
}

