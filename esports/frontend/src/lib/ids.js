// ════════════════════════════════════════════════════════════
//  IDs oficiales de GlitchGang (espejo en frontend del backend).
//  Cada entidad tiene un código PÚBLICO (corto) y otro EXTENSO/interno
//  (incluye fecha YYMMDD). Fuente de verdad backend:
//  backend/src/services/codes.service.js + backend/src/config/countries.js
//
//  ── Jugador ──
//    público   {InicialNombre}{seq}-{país}           ej. S001-01
//    extenso   {YYMMDD nac}-{Ini}{InicialesApe}-{seq}-{país}  ej. 031007-SLF-001-01
//  ── Comunidad ──  COM-{CREADOR}-{YYMMDD}-{NNNN}
//  ── Equipo ──     público TEAM-{seq}-{país} · extenso TEAM-{YYMMDD}-{seq}-{país}
//  ── Universidad ──
//    extenso   {SIGLAS}-{matrículaTail}-{DDMMYY reg.}-{NNNN}  ej. ITLA-0614-071026-0001
//    abreviado {SIGLAS}-{matrículaTail}-{NNNN}                ej. ITLA-0614-0001
// ════════════════════════════════════════════════════════════

// Orden estable de países de la plataforma. RD = Rep. Dominicana.
const COUNTRY_CODES = [
  'RD', 'MX', 'AR',
  'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AM', 'AW', 'AX', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI',
  'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ',
  'DK', 'DJ', 'DM',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET',
  'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF',
  'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY',
  'HT', 'HM', 'VA', 'HN', 'HK', 'HU',
  'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT',
  'JM', 'JP', 'JE', 'JO',
  'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG',
  'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU',
  'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM',
  'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MK', 'MP', 'NO',
  'OM',
  'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR',
  'QA',
  'RE', 'RO', 'RU', 'RW',
  'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY',
  'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV',
  'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ',
  'VU', 'VE', 'VN', 'VG', 'VI',
  'WF', 'EH',
  'YE',
  'ZM', 'ZW',
]

export const COUNTRY_NUMBERS = Object.freeze(
  Object.fromEntries(COUNTRY_CODES.map((code, i) => [code, String(i + 1).padStart(2, '0')]))
)

// ISO-2 que usan los mocks → código oficial de la plataforma.
const COUNTRY_ALIASES = { DO: 'RD' }

export function normalizeCountryCode(value = '') {
  const code = String(value).trim().toUpperCase()
  return COUNTRY_ALIASES[code] || code
}

export function getCountryNumber(code) {
  return COUNTRY_NUMBERS[normalizeCountryCode(code)] || '00'
}

// ── helpers de formato ──
const seq3 = (n) => String(n).padStart(3, '0')
const seq4 = (n) => String(n).padStart(4, '0')

export function formatYYMMDD(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '000000'
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

export function formatDDMMYY(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '000000'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}${mm}${yy}`
}

export function firstNameInitial(firstName) {
  return String(firstName || '').trim()[0]?.toUpperCase() || 'J'
}

export function lastNameInitials(lastName) {
  if (!lastName) return ''
  return String(lastName).trim().split(/\s+/).map(w => w[0]).filter(Boolean).join('').toUpperCase()
}

// ── IDs universales secuenciales (multi-admin) ──
//  Formato simple y legible para identificar cualquier registro sin
//  depender del nombre: {PREFIJO}-{6 dígitos}.  ej. JUG-000001
export const ENTITY_PREFIX = {
  player: 'JUG',
  team: 'TEAM',
  tournament: 'TRN',
  event: 'EVT',
  staff: 'STAFF',
  organizer: 'ORG',
}

export function entityCode(entity, sequence) {
  const prefix = ENTITY_PREFIX[entity] || String(entity || 'GG').toUpperCase()
  return `${prefix}-${String(Number(sequence) || 0).padStart(6, '0')}`
}

// UUID determinista a partir de un seed (mock estable, no criptográfico).
export function pseudoUuid(seed) {
  const s = String(seed || 'gg')
  let h = 2166136261
  const next = (salt) => { h ^= (s.charCodeAt(salt % s.length) || 1) + salt * 131; h = Math.imul(h, 16777619) >>> 0; return (h % 16).toString(16) }
  const hex = (len, off) => Array.from({ length: len }, (_, i) => next(i + off)).join('')
  return `${hex(8, 0)}-${hex(4, 8)}-4${hex(3, 12)}-${hex(4, 15)}-${hex(12, 19)}`
}

// ID corto = primer segmento del código público (ej. "S001" de "S001-01").
export function shortIdFrom(publicCode) {
  return String(publicCode || '').split('-')[0] || '—'
}

// Código de verificación legible: VRF-{iniciales}-{NNNNN}
export function makeVerifyId(initials, sequence) {
  return `VRF-${String(initials || 'GG').toUpperCase()}-${String(Number(sequence) || 0).padStart(5, '0')}`
}

// ── Jugador ──
export function playerPublicCode(firstName, sequence, countryCode) {
  return `${firstNameInitial(firstName)}${seq3(sequence)}-${getCountryNumber(countryCode)}`
}

export function playerInternalCode(firstName, lastName, birthDate, sequence, countryCode) {
  return `${formatYYMMDD(birthDate)}-${firstNameInitial(firstName)}${lastNameInitials(lastName)}-${seq3(sequence)}-${getCountryNumber(countryCode)}`
}

// ── Comunidad ── (alineado con lib/communityStore.js)
const sanitize = (s) => String(s || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'USER'

export function communityCode(creatorCode, date = new Date(), sequence = 1) {
  return `COM-${sanitize(creatorCode)}-${formatYYMMDD(date)}-${seq4(sequence)}`
}

// ── Equipo ──
export function teamPublicCode(sequence, countryCode) {
  return `TEAM-${seq3(sequence)}-${getCountryNumber(countryCode)}`
}

export function teamInternalCode(date, sequence, countryCode) {
  return `TEAM-${formatYYMMDD(date)}-${seq3(sequence)}-${getCountryNumber(countryCode)}`
}

// ── Universidad ──
//  siglas       → ITLA, UASD, PUCMM… (se sanitiza a A-Z 0-9)
//  matriculaTail→ última parte de la matrícula (ej. "0614")
//  regDate      → fecha de registro en la web (se formatea DDMMYY)
//  sequence     → 4 números ascendentes (0001, 0002…)
export function universitySiglas(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'UNIV'
}

export function matriculaTail(matricula, len = 4) {
  const clean = String(matricula || '').replace(/[^0-9A-Za-z]/g, '')
  return (clean.slice(-len) || '0000').toUpperCase().padStart(len, '0')
}

export function universityCodes(siglas, matricula, regDate, sequence = 1) {
  const sg = universitySiglas(siglas)
  const tail = matriculaTail(matricula)
  const seq = seq4(sequence)
  return {
    publicCode: `${sg}-${tail}-${seq}`,                            // ITLA-0614-0001
    internalCode: `${sg}-${tail}-${formatDDMMYY(regDate)}-${seq}`, // ITLA-0614-071026-0001
  }
}

