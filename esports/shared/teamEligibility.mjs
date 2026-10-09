// Reglas de quién puede entrar a un equipo (decididas 30/sep), compartidas
// por el backend (las hace cumplir) y el frontend (avisa antes):
// - Femenino: solo mujeres (User.gender === 'female'), incluida quien lo crea.
//   Non-binary no entra. Masculino / Mixto: descriptivo, no bloquea.
// - Alcance (Team.joinScope): abierto, solo del país del equipo o solo de su región.
// - Universitario: solo estudiantes verificados de esa universidad.
// - Idioma: requisito visible, nunca bloquea (no se puede comprobar).
// Son reglas de JUGADORES: el staff (coach, analista, manager) no las tiene
// (ver shared/teamRoles.mjs).

// "RD" es el código de plataforma para República Dominicana; el resto son ISO.
export const REGION_BY_COUNTRY = {
  RD: 'CAR', PR: 'CAR', CU: 'CAR', JM: 'CAR', HT: 'CAR',
  GT: 'CAM', HN: 'CAM', SV: 'CAM', NI: 'CAM', CR: 'CAM', PA: 'CAM',
  MX: 'LAN', CO: 'LAN', VE: 'LAN', EC: 'LAN', PE: 'LAN',
  BO: 'LAS', CL: 'LAS', AR: 'LAS', UY: 'LAS', PY: 'LAS', BR: 'LAS',
  US: 'NA', CA: 'NA',
  ES: 'EU',
}

export const REGION_CODES = ['CAR', 'CAM', 'LAN', 'LAS', 'NA', 'EU']

export const JOIN_SCOPES = ['open', 'country', 'region']

// Países que en el selector son en realidad zonas: no tienen bandera ni región fija.
const NON_COUNTRY = new Set(['GLB', 'ASIA', 'OCE', 'MENA', 'GLOBAL', ''])

const up = (value) => String(value || '').trim().toUpperCase()

export function normalizeCountry(code) {
  const c = up(code)
  return c === 'DO' ? 'RD' : c
}

export function regionForCountry(code) {
  return REGION_BY_COUNTRY[normalizeCountry(code)] || ''
}

export function isRealCountry(code) {
  return !NON_COUNTRY.has(normalizeCountry(code))
}

// Team.gender se guarda como la etiqueta del chip ("Femenino", "Female",
// "Mixto (Cualquiera)"...). Se normaliza a female | male | mixed.
export function teamGenderKey(value) {
  const g = String(value || '').trim().toLowerCase()
  if (g.startsWith('femen') || g.startsWith('female') || g === 'mujeres' || g === 'women') return 'female'
  if (g.startsWith('mascul') || g === 'male' || g === 'hombres' || g === 'men') return 'male'
  return 'mixed'
}

export function userRegion(user) {
  const own = up(user?.region)
  return REGION_CODES.includes(own) ? own : regionForCountry(user?.countryCode)
}

/**
 * Reglas que `user` no cumple para entrar a `team`, en orden:
 * 'gender' | 'country' | 'region' | 'university' | 'university_other'.
 * Vacío = puede entrar.
 */
export function teamJoinViolations(team, user) {
  const out = []
  if (!team) return out

  if (teamGenderKey(team.gender) === 'female' && user?.gender !== 'female') out.push('gender')

  const scope = team.joinScope || 'open'
  if (scope === 'country' && isRealCountry(team.country) && normalizeCountry(user?.countryCode) !== normalizeCountry(team.country)) {
    out.push('country')
  }
  if (scope === 'region' && up(team.region) && userRegion(user) !== up(team.region)) out.push('region')

  if (team.university?.isUniversityTeam) {
    const uni = user?.university
    if (uni?.verificationStatus !== 'verified') out.push('university')
    else if (String(uni.universityId || '') !== String(team.university.universityId || '')) out.push('university_other')
  }
  return out
}

