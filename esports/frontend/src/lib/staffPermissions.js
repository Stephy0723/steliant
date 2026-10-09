// Permisos del staff dentro de un torneo: qué pestaña del panel puede ver /
// editar cada rol, con la posibilidad de ajustarlo persona por persona.
//
// El dueño del torneo (organizer) y un admin de GlitchGang siempre tienen
// 'edit' en todas las pestañas — no pasan por esta tabla, se resuelven aparte
// en OrganizerTournamentManage (isOwner / isAdmin).
//
// El backend ya valida esta misma matriz por su cuenta (assertTabAccess /
// canWriteField en tournament.controller.js), asi que esconder una pestaña o
// bloquear un formulario aca es una conveniencia de UI, no la unica barrera:
// aunque alguien fuerce una llamada directa a la API, el servidor igual
// rechaza escrituras fuera de lo que su rol/override permite.
import { MANAGE_TAB_KEYS } from '../data/organizerManageTabs.js'
import { STAFF_ROLES } from '../../../shared/tournamentSetup.mjs'

export const ACCESS_NONE = 'none'
export const ACCESS_VIEW = 'view'
export const ACCESS_EDIT = 'edit'

export const ACCESS_LEVELS = [ACCESS_NONE, ACCESS_VIEW, ACCESS_EDIT]

export const ACCESS_LABEL = {
  [ACCESS_NONE]: 'Sin acceso',
  [ACCESS_VIEW]: 'Ver',
  [ACCESS_EDIT]: 'Ver y editar',
}

// Matriz por defecto: rol de staff -> pestaña -> nivel de acceso.
// Director = misma confianza que el organizador. Administrador = operación
// del día a día, sin tocar quién entra al staff ni sponsors/premios.
// Arbitro/Moderador = lo operativo de partidas. Caster/Producción = mayormente
// solo ver, para transmitir o hacer contenido. Coach = solo ver, para guiar a
// su equipo. Analista = solo ver, con reportar en modo lectura para revisar
// incidencias. Competencia la ve todo el staff (es lo que se juega, lo mismo
// que ve el publico) y solo la editan Director y Administrador.
export const ROLE_DEFAULT_ACCESS = {
  Director: {
    resumen: 'edit', competencia: 'edit', config: 'edit', equipos: 'edit', reglas: 'edit', checkin: 'edit', prizepool: 'edit',
    bracket: 'edit', ruleta: 'edit', marca: 'edit', colaboradores: 'edit', discord: 'edit', reportar: 'edit', resultados: 'edit',
  },
  Administrador: {
    resumen: 'edit', competencia: 'edit', config: 'edit', equipos: 'edit', reglas: 'edit', checkin: 'edit', prizepool: 'view',
    bracket: 'edit', ruleta: 'edit', marca: 'view', colaboradores: 'none', discord: 'edit', reportar: 'edit', resultados: 'view',
  },
  Arbitro: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'edit', prizepool: 'none',
    bracket: 'edit', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'edit', resultados: 'edit',
  },
  Moderador: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'edit', prizepool: 'none',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'edit', reportar: 'edit', resultados: 'view',
  },
  Caster: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'view',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'none', resultados: 'none',
  },
  Produccion: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'view',
    bracket: 'view', ruleta: 'none', marca: 'view', colaboradores: 'none', discord: 'none', reportar: 'none', resultados: 'none',
  },
  Coach: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'none',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'none', resultados: 'none',
  },
  Analista: {
    resumen: 'view', competencia: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'view', prizepool: 'none',
    bracket: 'view', ruleta: 'none', marca: 'none', colaboradores: 'none', discord: 'none', reportar: 'view', resultados: 'view',
  },
}

export function roleDefaults(role) {
  return ROLE_DEFAULT_ACCESS[role] || ROLE_DEFAULT_ACCESS.Moderador
}

// --- Ajustes puntuales por persona --------------------------------------
// El ajuste real se guarda en el servidor (Tournament.staffMembers[].permissions,
// vía PATCH /tournaments/:id/staff/:userId) y `tabAccessFor` lo prioriza sobre
// esto. Este localStorage queda como respaldo optimista (por si esa respuesta
// no trae el campo de vuelta todavía) — no es la fuente de verdad.
const STORAGE_KEY = 'gg-staff-perms'

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function writeStore(store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch { /* almacenamiento no disponible */ }
}

/** Ajustes guardados localmente para un miembro de un torneo: { [tabKey]: level }. */
export function getLocalOverrides(tournamentId, userId) {
  if (!tournamentId || !userId) return {}
  return readStore()?.[tournamentId]?.[String(userId)] || {}
}

export function setLocalOverride(tournamentId, userId, tabKey, level) {
  if (!tournamentId || !userId) return
  const store = readStore()
  const forTournament = { ...(store[tournamentId] || {}) }
  const forMember = { ...(forTournament[String(userId)] || {}) }
  if (level == null) delete forMember[tabKey]
  else forMember[tabKey] = level
  forTournament[String(userId)] = forMember
  store[tournamentId] = forTournament
  writeStore(store)
}

export function clearLocalOverride(tournamentId, userId, tabKey) {
  setLocalOverride(tournamentId, userId, tabKey, null)
}

/**
 * Acceso final de un miembro a una pestaña: gana el ajuste puntual (guardado
 * en el torneo si el backend ya lo soporta, o local mientras tanto) sobre el
 * default de su rol.
 */
export function tabAccessFor(member, tabKey, tournamentId) {
  if (!member) return ACCESS_NONE
  // La sala de staff es de todo el staff aceptado: no entra en la matriz de permisos.
  if (tabKey === 'sala') return ACCESS_EDIT
  const remote = member.permissions?.[tabKey]
  if (ACCESS_LEVELS.includes(remote)) return remote
  const local = getLocalOverrides(tournamentId, member.user)[tabKey]
  if (ACCESS_LEVELS.includes(local)) return local
  return roleDefaults(member.role)[tabKey] || ACCESS_NONE
}

/** { [tabKey]: 'none'|'view'|'edit' } ya resuelto (default de rol + ajustes) para un miembro. */
export function resolveMemberAccess(member, tournamentId) {
  const out = {}
  for (const tab of MANAGE_TAB_KEYS) out[tab] = tabAccessFor(member, tab, tournamentId)
  return out
}

export function isCustomized(member, tabKey, tournamentId) {
  const remote = member?.permissions?.[tabKey]
  if (ACCESS_LEVELS.includes(remote)) return true
  return ACCESS_LEVELS.includes(getLocalOverrides(tournamentId, member?.user)[tabKey])
}

export { STAFF_ROLES }

