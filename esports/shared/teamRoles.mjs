// Roles dentro de un equipo, compartidos por el backend (los hace cumplir) y
// el frontend (avisa antes). Estandar de ligas (MPL, VCT, FACEIT, start.gg):
// - El plantel separa jugadores (titulares + suplentes) del staff (coach,
//   analista, manager). El staff tiene su propio cupo: no le quita lugar a
//   un jugador.
// - Se entra con un rol: la invitacion y la solicitud dicen "como coach" y al
//   aceptar la persona queda directo en su puesto, sin pasos manuales.
// - Las reglas de quien puede entrar (femenino, pais/region, universidad) y
//   la de "un equipo por juego" son de JUGADORES. El staff no las tiene: un
//   coach puede llevar el equipo principal y la academia. Lo que nunca puede
//   es estar en dos equipos del mismo torneo (eso se valida al inscribirse).
// - Ser coach de un equipo no requiere el rol aprobado en GlitchGang; el rol
//   aprobado se muestra como sello "verificado" y abre el Coach HQ.

export const TEAM_ROLES = ['player', 'coach', 'analyst', 'manager']
export const STAFF_ROLES = ['coach', 'analyst', 'manager']

export const TEAM_ROLE_LABELS = {
  es: { player: 'Jugador', coach: 'Coach', analyst: 'Analista', manager: 'Manager' },
  en: { player: 'Player', coach: 'Coach', analyst: 'Analyst', manager: 'Manager' },
}

// Puestos del plantel por rol de staff, en orden de asignacion
// (coach = principal, coach-2 = asistente).
export const STAFF_SLOT_KEYS = {
  coach: ['coach', 'coach-2'],
  analyst: ['analyst', 'analyst-2'],
  manager: ['manager'],
}

export const STAFF_SLOT_LABELS = {
  coach: 'Coach principal',
  'coach-2': 'Coach asistente',
  analyst: 'Analista',
  'analyst-2': 'Analista 2',
  manager: 'Manager',
}

// Cupo total de staff por equipo (Team.maxStaff) y maximo por rol.
export const DEFAULT_MAX_STAFF = 4
export const MAX_STAFF_LIMIT = 6
export const STAFF_ROLE_MAX = { coach: 2, analyst: 2, manager: 1 }

// Roles de GlitchGang (User.roleProfiles) que dan el sello "verificado".
// Manager no tiene rol aprobable propio.
export const VERIFIABLE_STAFF_ROLES = ['coach', 'analyst']

export function normalizeTeamRole(value) {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'analista') return 'analyst'
  return TEAM_ROLES.includes(v) ? v : 'player'
}

export const isStaffRole = role => STAFF_ROLES.includes(role)

// Rol de staff de un puesto del plantel ('coach', 'coach-1', 'coach-2' ->
// coach), o null si es un puesto de jugador. 'rep'/'representante' se
// trataba como staff antes: cuenta como manager.
export function staffRoleOfSlot(key = '') {
  const k = String(key || '').trim().toLowerCase()
  if (k.startsWith('coach')) return 'coach'
  if (k.startsWith('analyst') || k.startsWith('analista')) return 'analyst'
  if (k.startsWith('manager') || k.startsWith('rep')) return 'manager'
  return null
}

export const isStaffSlotKey = key => Boolean(staffRoleOfSlot(key))

export function teamRoleLabel(role, lang = 'es') {
  const labels = TEAM_ROLE_LABELS[lang] || TEAM_ROLE_LABELS.es
  return labels[normalizeTeamRole(role)] || labels.player
}

export function staffSlotLabel(key = '') {
  const k = String(key || '').trim().toLowerCase()
  if (STAFF_SLOT_LABELS[k]) return STAFF_SLOT_LABELS[k]
  const role = staffRoleOfSlot(k)
  return role ? teamRoleLabel(role) : ''
}

export function teamMaxStaff(team) {
  const n = Number(team?.maxStaff)
  return Number.isFinite(n) && n >= 0 ? Math.min(MAX_STAFF_LIMIT, Math.floor(n)) : DEFAULT_MAX_STAFF
}

