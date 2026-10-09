import { initialTournamentForm, initialCompetition, normalizeCompetition, validateCompetition, validateSetupStep } from '../../../shared/tournamentSetup.mjs'
import { isValidGameId } from '../../../shared/games.mjs'
import { normalizeCountryCode, COUNTRY_NUMBERS } from '../config/countries.js'
import { STAFF_ROLES } from '../../../shared/tournamentSetup.mjs'
import { isStaffSlotKey } from '../../../shared/teamRoles.mjs'

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isObjectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)

export function sanitizeStaffMembers(rows) {
  const seen = new Set()
  const clean = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !STAFF_ROLES.includes(row.role)) continue
    // El staff del torneo debe ser un perfil real de GlitchGang (se le notifica).
    const user = isObjectId(String(row.user || '')) ? String(row.user) : null
    if (!user) continue
    const nick = String(row.nick || row.name || '').trim().slice(0, 120) || 'Staff'
    if (seen.has(user)) continue
    seen.add(user)
    clean.push({
      user, name: nick, nick,
      avatar: String(row.avatar || '').slice(0, 500),
      playerCode: String(row.playerCode || '').slice(0, 40),
      platformRole: String(row.platformRole || '').slice(0, 40),
      role: row.role,
      status: 'pending', invitedAt: new Date(), respondedAt: null,
    })
  }
  return clean
}

export function validateTournamentSetup(body) {
  const form = initialTournamentForm()
  for (const key of Object.keys(form)) if (body[key] !== undefined) form[key] = body[key]
  const issues = {}
  for (const [key, value] of Object.entries(form)) {
    const expected = initialTournamentForm()[key]
    if (Array.isArray(expected)) {
      if (!Array.isArray(value) || value.length > 250) issues[key] = 'Lista invalida.'
    } else if (isPlainObject(expected)) {
      if (!isPlainObject(value)) issues[key] = 'Configuracion invalida.'
    } else if (typeof expected === 'string' && typeof value !== 'string' && !(value === null && ['checkinDeadline', 'sourceTournament'].includes(key))) issues[key] = 'Texto invalido.'
    else if (typeof expected === 'boolean' && typeof value !== 'boolean') issues[key] = 'Valor invalido.'
  }
  if (!issues.gameId && form.gameId && !isValidGameId(form.gameId)) issues.gameId = 'Juego no reconocido.'
  if (!issues.competition && isPlainObject(body.competition)) {
    const raw = validateCompetition({ ...initialCompetition(), ...body.competition }, form.maxSlots)
    if (Object.keys(raw).length) issues.competition = Object.values(raw)[0]
  }
  form.competition = issues.competition ? initialCompetition() : normalizeCompetition(form.competition, form.maxSlots)
  for (const [key, fields] of Object.entries({ sponsors: ['name', 'link', 'tier'], staffMembers: ['role'], prizes: ['place', 'items'] })) {
    if (Array.isArray(form[key]) && form[key].some(row => !row || fields.some(field => typeof row[field] !== 'string'))) issues[key] = 'Revisa los campos de la lista.'
  }
  if (Object.keys(issues).length) return { form, issues }
  for (const key of ['date', 'endDate', 'registrationStart', 'registrationEnd', 'checkinDeadline', 'sourceTournament']) form[key] ||= ''
  if (form.allowedCountries.some(code => typeof code !== 'string' || !COUNTRY_NUMBERS[normalizeCountryCode(code)])) issues.allowedCountries = 'Pais no reconocido.'
  form.allowedCountries = [...new Set(form.allowedCountries.map(normalizeCountryCode))]
  form.staffMembers = sanitizeStaffMembers(form.staffMembers)
  for (let step = 0; step < 6; step++) Object.assign(issues, validateSetupStep(form, step))
  return { form, issues }
}

function ageAt(birthDate, date) {
  if (!birthDate) return NaN
  const born = new Date(birthDate)
  if (!Number.isFinite(born.getTime()) || born > date) return NaN
  let age = date.getUTCFullYear() - born.getUTCFullYear()
  if (date.getUTCMonth() < born.getUTCMonth() || (date.getUTCMonth() === born.getUTCMonth() && date.getUTCDate() < born.getUTCDate())) age--
  return age
}

export function participantRestrictions(team, tournament) {
  const issues = []
  const regional = tournament.participationScope === 'regional' || Boolean(tournament.allowedCountries?.length)
  const ageRequired = tournament.setupVersion === 1 || Number(tournament.minAge) > 0
  if (!regional && !ageRequired) return issues
  const members = team.members || []
  const byId = new Map()
  for (const player of members) {
    for (const id of [player._id, player.id, player.playerCode]) if (id) byId.set(String(id), player)
  }
  // Pais y edad son reglas de jugadores: el staff (coach, analista, manager)
  // no cuenta, igual que en las ligas (shared/teamRoles.mjs).
  const staffIds = new Set(Object.entries(team.rosterSlots || {})
    .filter(([key, slot]) => isStaffSlotKey(key) && slot?.userId)
    .map(([, slot]) => String(slot.userId)))
  const players = new Map(members.filter(p => !staffIds.has(String(p._id))).map(p => [String(p._id), p]))
  for (const [key, slot] of Object.entries(team.rosterSlots || {})) {
    if (!/^(titular|sub)-/.test(key) || !slot || !Object.values(slot).some(Boolean)) continue
    const member = [slot.userId, slot.playerCode, slot.id].map(id => byId.get(String(id || ''))).find(Boolean)
    if (!member) issues.push(`Vincula el perfil de ${slot.nick || slot.name || key} para comprobar pais y edad.`)
    else players.set(String(member._id), member)
  }
  if (!players.size) issues.push('No hay perfiles de jugadores vinculados para comprobar pais y edad.')
  const allowed = (tournament.allowedCountries || []).map(normalizeCountryCode)
  for (const player of players.values()) {
    const label = player.nick || player.playerCode || 'Jugador'
    if (regional && !allowed.includes(normalizeCountryCode(player.countryCode))) issues.push(`${label}: su pais no esta entre los permitidos o falta en su perfil.`)
    if (ageRequired) {
      const age = ageAt(player.birthDate, new Date(tournament.date))
      const min = Math.max(Number(tournament.minAge) || 0, tournament.setupVersion === 1 && !tournament.minorsAllowed ? 18 : 0)
      if (!Number.isFinite(age) || age < min) issues.push(`${label}: debe tener al menos ${min} anos al comenzar y una fecha de nacimiento valida.`)
    }
  }
  return issues
}
