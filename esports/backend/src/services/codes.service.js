import { Counter } from '../models/Counter.js'
import { User } from '../models/User.js'
import { requireCountryNumber } from './countries.service.js'

// Igual que nextSequence pero con ancho de padding configurable -- lo pide
// systemTickets.service.js (secuencias de 4 dígitos, no 3).
export async function reserveSequence(key, width = 3) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) throw Object.assign(new Error('Counter key is required'), { status: 500 })

  // findOneAndUpdate + $inc is atomic. A duplicate-key retry only covers the
  // tiny race where two processes attempt the first upsert for the same key.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { key: normalizedKey },
        { $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      return String(counter.value).padStart(width, '0')
    } catch (error) {
      if (error?.code !== 11000 || attempt === 1) throw error
    }
  }

  throw Object.assign(new Error('Could not reserve sequence'), { status: 500 })
}

const nextSequence = reserveSequence

export const SPECIALIZED_ROLE_PREFIX = Object.freeze({
  organizer: 'ORG',
  creator: 'CRE',
  coach: 'COA',
  caster: 'CAS',
  analyst: 'ANA',
  moderator: 'MOD',
  sponsor: 'SPN',
})

export function formatYYMMDD(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '000000'
  const yy = String(d.getUTCFullYear()).slice(-2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

// Universidad: la fecha de registro web se formatea DDMMYY (no YYMMDD).
export function formatDDMMYY(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '000000'
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yy = String(d.getUTCFullYear()).slice(-2)
  return `${dd}${mm}${yy}`
}

export function getLastNameInitials(lastName) {
  if (!lastName) return ''
  return String(lastName)
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
}

export function getFirstNameInitial(firstName) {
  return String(firstName || '').trim()[0]?.toUpperCase() || 'J'
}

export function formatPlayerCode(firstName, sequence, countryNumber) {
  return `${getFirstNameInitial(firstName)}${sequence}-${countryNumber}`
}

export function formatPlayerInternalCode(firstName, birthDate, lastName, sequence, countryNumber) {
  const dateStr = formatYYMMDD(birthDate)
  const initials = getLastNameInitials(lastName)
  return `${dateStr}-${getFirstNameInitial(firstName)}${initials}-${sequence}-${countryNumber}`
}

export function sanitizeGameCode(gameCode) {
  return String(gameCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
}

export function organizerRef(organizerCode) {
  const match = /^ORG-(\d{3,})-\d{2,3}$/.exec(String(organizerCode || '').trim().toUpperCase())
  if (!match) throw Object.assign(new Error('A valid organizerCode is required'), { status: 400 })
  return `ORG${match[1]}`
}

export function formatTournamentCode(gameCode, organizerCode, sequence, countryNumber) {
  return `TOR-${sanitizeGameCode(gameCode)}-${organizerRef(organizerCode)}-${sequence}-${countryNumber}`
}

export function formatTournamentInternalCode(gameCode, date, organizerCode, sequence, countryNumber) {
  return `TOR-${sanitizeGameCode(gameCode)}-${formatYYMMDD(date)}-${organizerRef(organizerCode)}-${sequence}-${countryNumber}`
}

export function formatTeamCode(sequence, countryNumber) {
  return `TEAM-${sequence}-${countryNumber}`
}

export function formatTeamInternalCode(date, sequence, countryNumber) {
  const dateStr = formatYYMMDD(date)
  return `TEAM-${dateStr}-${sequence}-${countryNumber}`
}

export async function createPlayerCode(countryCode, firstName) {
  const { code, number } = requireCountryNumber(countryCode)
  return formatPlayerCode(firstName, await nextSequence(`player:${code}`), number)
}

export async function createPlayerCodes(countryCode, firstName, birthDate, lastName) {
  const { code, number } = requireCountryNumber(countryCode)
  const sequence = await nextSequence(`player:${code}`)
  return {
    publicCode: formatPlayerCode(firstName, sequence, number),
    internalCode: formatPlayerInternalCode(firstName, birthDate, lastName, sequence, number),
  }
}

export async function createTournamentCodes({ countryCode, gameCode, organizerCode, organizerId, createdAt = new Date() }) {
  const { code, number } = requireCountryNumber(countryCode)
  const game = sanitizeGameCode(gameCode)
  if (!game) {
    const error = new Error('Game code is required')
    error.status = 400
    throw error
  }
  if (!organizerId) throw Object.assign(new Error('organizerId is required'), { status: 400 })
  organizerRef(organizerCode)

  const sequence = await nextSequence(`tournament:${code}:${game}:${String(organizerId)}`)
  return {
    publicId: formatTournamentCode(game, organizerCode, sequence, number),
    tournamentCode: formatTournamentInternalCode(game, createdAt, organizerCode, sequence, number),
    gameCode: game,
    countryCode: code,
  }
}

export async function createTournamentCode(countryCode, gameCode, organizerCode, organizerId, createdAt = new Date()) {
  return createTournamentCodes({ countryCode, gameCode, organizerCode, organizerId, createdAt })
}

export function formatSpecializedRoleCode(role, sequence, countryNumber) {
  const prefix = SPECIALIZED_ROLE_PREFIX[role]
  if (!prefix) throw Object.assign(new Error('Unsupported specialized role'), { status: 400 })
  return `${prefix}-${sequence}-${countryNumber}`
}

export function formatSpecializedRoleInternalCode(role, approvedAt, sequence, countryNumber) {
  const prefix = SPECIALIZED_ROLE_PREFIX[role]
  if (!prefix) throw Object.assign(new Error('Unsupported specialized role'), { status: 400 })
  return `${prefix}-${formatYYMMDD(approvedAt)}-${sequence}-${countryNumber}`
}

export async function createSpecializedRoleCodes(role, countryCode, approvedAt = new Date()) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  if (!SPECIALIZED_ROLE_PREFIX[normalizedRole]) {
    throw Object.assign(new Error('Unsupported specialized role'), { status: 400 })
  }

  const { code, number } = requireCountryNumber(countryCode)
  const sequence = await nextSequence(`${normalizedRole}:${code}`)
  return {
    publicCode: formatSpecializedRoleCode(normalizedRole, sequence, number),
    internalCode: formatSpecializedRoleInternalCode(normalizedRole, approvedAt, sequence, number),
    approvedAt: new Date(approvedAt),
  }
}

export async function createTeamCode(countryCode) {
  const { code, number } = requireCountryNumber(countryCode)
  const sequence = await nextSequence(`team:${code}`)
  return {
    publicCode: formatTeamCode(sequence, number),
    internalCode: formatTeamInternalCode(new Date(), sequence, number),
  }
}

export function formatBrandCode(sequence) {
  return `BRD-${String(sequence).padStart(3, '0')}`
}

export async function createBrandCode() {
  return formatBrandCode(await nextSequence('brand', 3))
}

export function formatInvoiceNumber(year, sequence) {
  return `INV-${year}-${String(sequence).padStart(4, '0')}`
}

export async function createInvoiceNumber(brandCode, tournamentPublicId, brandId, tournamentId, createdAt = new Date()) {
  if (!brandId) {
    const date = brandCode instanceof Date ? brandCode : new Date()
    const year = date.getUTCFullYear()
    return formatInvoiceNumber(year, await nextSequence(`invoice:${year}`, 4))
  }

  const bRef = brandRef(brandCode)
  const tRef = tournamentPublicId ? tourRef(tournamentPublicId) : 'GLOBAL'
  const tKey = tournamentId ? String(tournamentId) : 'global'
  const seq = await nextSequence(`invoice:${String(tKey)}:${String(brandId)}`, 4)
  return {
    invoiceNumber: `INV-${tRef}-${bRef}-${seq}`,
    internalCode: `INV-${formatYYYYMMDD(createdAt)}-${tRef}-${bRef}-${seq}`,
  }
}

// ── Fecha completa YYYYMMDD para IDs extensos ──
export function formatYYYYMMDD(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '00000000'
  const yyyy = String(d.getUTCFullYear())
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

// ── Reference helpers: extraen refs cortas de IDs públicos existentes ──
// S001-01 → S00101
export function userRef(playerCode) {
  return String(playerCode || '').replace(/-/g, '').toUpperCase()
}
// BRD-001 → BRD001
export function brandRef(brandCode) {
  return String(brandCode || '').replace(/-/g, '').toUpperCase()
}
// ITLA-0614-0001 → ITLA06140001
export function uniRef(universityPublicCode) {
  return String(universityPublicCode || '').replace(/-/g, '').toUpperCase()
}
// TOR-MLBB-ORG001-001-01 → TORMLBBORG00100101
export function tourRef(tournamentPublicId) {
  return String(tournamentPublicId || '').replace(/-/g, '').toUpperCase()
}
// CAM-BRD001-TORMLBB00101-001 → CAM001 (extrae la secuencia final)
export function camRef(campaignPublicCode) {
  const match = /-([a-zA-Z0-9]+)$/.exec(String(campaignPublicCode || ''))
  const seq = match ? match[1] : '000'
  return `CAM${seq}`
}
// Código de rol aprobado: organizer→ORG, creator→CRE, etc.
export function roleCode(roleId) {
  const CODES = { organizer: 'ORG', creator: 'CRE', coach: 'COA', caster: 'CAS', analyst: 'ANA', moderator: 'MOD', sponsor: 'BRD' }
  return CODES[roleId] || String(roleId || '').slice(0, 3).toUpperCase()
}

// ── Brand internalCode ──
// BRD-{YYYYMMDD}-{SEQ3}   ej. BRD-20260622-001
export function formatBrandInternalCode(date, sequence) {
  return `BRD-${formatYYYYMMDD(date)}-${String(sequence).padStart(3, '0')}`
}

export async function createBrandCodes(createdAt = new Date()) {
  const sequence = await nextSequence('brand', 3)
  return {
    code: formatBrandCode(sequence),
    internalCode: formatBrandInternalCode(createdAt, sequence),
  }
}

// ── BrandApplication ──
// BAP-{USERREF}-{SEQ4}               ej. BAP-S00101-0001
// BAP-{YYYYMMDD}-{USERREF}-{SEQ4}    ej. BAP-20260622-S00101-0001
export async function createBrandApplicationCodes(playerCode, userId, createdAt = new Date()) {
  const ref = userRef(playerCode)
  const seq = await nextSequence(`brand-application:${String(userId)}`, 4)
  return {
    publicCode: `BAP-${ref}-${seq}`,
    internalCode: `BAP-${formatYYYYMMDD(createdAt)}-${ref}-${seq}`,
  }
}

// ── BrandReport ──
// BRP-{BRANDREF}-{SEQ4}               ej. BRP-BRD001-0001
// BRP-{YYYYMMDD}-{BRANDREF}-{SEQ4}    ej. BRP-20260622-BRD001-0001
export async function createBrandReportCodes(brandCodeValue, brandId, createdAt = new Date()) {
  const ref = brandRef(brandCodeValue)
  const seq = await nextSequence(`brand-report:${String(brandId)}`, 4)
  return {
    publicCode: `BRP-${ref}-${seq}`,
    internalCode: `BRP-${formatYYYYMMDD(createdAt)}-${ref}-${seq}`,
  }
}

// ── News ──
// NEW-{USERREF}-{SEQ4}               ej. NEW-S00101-0001
// NEW-{YYYYMMDD}-{USERREF}-{SEQ4}    ej. NEW-20260622-S00101-0001
export async function createNewsCodes(playerCode, createdBy, createdAt = new Date()) {
  const ref = userRef(playerCode)
  const seq = await nextSequence(`news:${String(createdBy)}`, 4)
  return {
    publicCode: `NEW-${ref}-${seq}`,
    internalCode: `NEW-${formatYYYYMMDD(createdAt)}-${ref}-${seq}`,
  }
}

// ── Notification (solo internalCode, no visible públicamente) ──
// NTF-{YYYYMMDD}-{USERREF}-{SEQ4}    ej. NTF-20260622-S00101-0001
export async function createNotificationCode(playerCode, userId, createdAt = new Date()) {
  const ref = userRef(playerCode)
  const seq = await nextSequence(`notification:${String(userId)}`, 4)
  return `NTF-${formatYYYYMMDD(createdAt)}-${ref}-${seq}`
}

// ── RoleApplication ──
// RAP-{USERREF}-{ROL}-{SEQ3}               ej. RAP-S00101-ORG-001
// RAP-{YYYYMMDD}-{USERREF}-{ROL}-{SEQ3}    ej. RAP-20260622-S00101-ORG-001
export async function createRoleApplicationCodes(playerCode, userId, roleId, createdAt = new Date()) {
  const ref = userRef(playerCode)
  const rol = roleCode(roleId)
  const seq = await nextSequence(`role-application:${String(userId)}:${roleId}`, 3)
  return {
    publicCode: `RAP-${ref}-${rol}-${seq}`,
    internalCode: `RAP-${formatYYYYMMDD(createdAt)}-${ref}-${rol}-${seq}`,
  }
}

// ── Ticket ──
// TKT-{BRANDREF}-{SEQ4}               ej. TKT-BRD001-0001
// TKT-{YYYYMMDD}-{BRANDREF}-{SEQ4}    ej. TKT-20260622-BRD001-0001
export async function createTicketCodes(brandCodeValue, brandId, createdAt = new Date()) {
  const ref = brandRef(brandCodeValue)
  const seq = await nextSequence(`ticket:${String(brandId)}`, 4)
  return {
    publicCode: `TKT-${ref}-${seq}`,
    internalCode: `TKT-${formatYYYYMMDD(createdAt)}-${ref}-${seq}`,
  }
}

// ── UniversityApplication ──
// UAP-{UNIREF}-{USERREF}-{SEQ3}               ej. UAP-ITLA06140001-S00101-001
// UAP-{YYYYMMDD}-{UNIREF}-{USERREF}-{SEQ3}    ej. UAP-20260622-ITLA06140001-S00101-001
export async function createUniversityApplicationCodes(universityPublicCode, playerCode, universityId, createdAt = new Date()) {
  const uRef = uniRef(universityPublicCode)
  const uUserRef = userRef(playerCode)
  const seq = await nextSequence(`university-application:${String(universityId)}`, 3)
  return {
    publicCode: `UAP-${uRef}-${uUserRef}-${seq}`,
    internalCode: `UAP-${formatYYYYMMDD(createdAt)}-${uRef}-${uUserRef}-${seq}`,
  }
}

// ── Universidad ──
//  abreviado {SIGLAS}-{matrículaTail}-{NNNN}             ej. ITLA-0614-0001
//  extenso   {SIGLAS}-{matrículaTail}-{DDMMYY}-{NNNN}    ej. ITLA-0614-071026-0001
export function sanitizeUniversitySiglas(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'UNIV'
}

export function getMatriculaTail(matricula, len = 4) {
  const clean = String(matricula || '').replace(/[^0-9A-Za-z]/g, '')
  return (clean.slice(-len) || '0000').toUpperCase().padStart(len, '0')
}

export function formatUniversityCode(siglas, matriculaTail, sequence) {
  return `${siglas}-${matriculaTail}-${sequence}`
}

export function formatUniversityInternalCode(siglas, matriculaTail, regDate, sequence) {
  return `${siglas}-${matriculaTail}-${formatDDMMYY(regDate)}-${sequence}`
}

export async function createUniversityCodes(siglasInput, matricula, regDate) {
  const siglas = sanitizeUniversitySiglas(siglasInput)
  const tail = getMatriculaTail(matricula)
  // Secuencia ascendente por universidad — 4 dígitos.
  const seq3 = await nextSequence(`university:${siglas}`)
  const sequence = String(parseInt(seq3, 10)).padStart(4, '0')
  return {
    siglas,
    matriculaTail: tail,
    publicCode: formatUniversityCode(siglas, tail, sequence),
    internalCode: formatUniversityInternalCode(siglas, tail, regDate, sequence),
  }
}

export async function createCampaignCodes(brandCode, tournamentPublicId, brandId, tournamentId, createdAt = new Date()) {
  const bRef = brandRef(brandCode)
  const tRef = tournamentPublicId ? tourRef(tournamentPublicId) : 'GLOBAL'
  const tKey = tournamentId ? String(tournamentId) : 'global'
  const seq = await nextSequence(`campaign:${String(brandId)}:${tKey}`, 3)
  return {
    publicCode: `CAM-${bRef}-${tRef}-${seq}`,
    internalCode: `CAM-${formatYYYYMMDD(createdAt)}-${bRef}-${tRef}-${seq}`,
  }
}

/**
 * Devuelve el codigo de referido del usuario, generandolo (y persistiendolo)
 * si aun no tiene uno. Usado tanto por la web (GET /api/profile/referral-code)
 * como por el bot de Discord (GET /api/bots/referral/:discordId) — un solo
 * lugar donde vive el formato del codigo.
 */
export async function getOrCreateReferralCode(user) {
  if (user.referralCode) return user.referralCode

  const base = String(user.playerCode || user.nick || user._id)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const code = `REF-${base}`

  await User.updateOne({ _id: user._id }, { referralCode: code })
  return code
}

export async function createCreativeCodes(brandCode, campaignPublicCode, campaignId, adType, createdAt = new Date()) {
  const bRef = brandRef(brandCode)
  const cRef = campaignPublicCode ? camRef(campaignPublicCode) : 'GLOBAL'
  const TYPE_CODE = { banner: 'BNR', strip: 'STP', floating: 'FLT' }
  const type = TYPE_CODE[adType] || 'ADS'
  const cKey = campaignId ? String(campaignId) : 'global'
  const seq = await nextSequence(`creative:${cKey}:${type}`, 3)
  return {
    adId: `ADS-${bRef}-${cRef}-${type}-${seq}`,
    internalCode: `ADS-${formatYYYYMMDD(createdAt)}-${bRef}-${cRef}-${type}-${seq}`,
  }
}
