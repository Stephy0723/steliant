// Permisos de creación de torneos/eventos/contenido.
// Roles que pueden crear: organizador de torneos, de eventos, creador de contenido,
// moderador y admin. Un jugador normal queda bloqueado hasta solicitar el rol.

export const CREATOR_ROLES = ['tournament-organizer', 'event-organizer', 'creator', 'moderator']

const GRANT_KEY = 'gg-creator-roles'

// Roles otorgados localmente (prototipo: cuando aprueban la solicitud)
export function getGrantedRoles() {
  try {
    const raw = JSON.parse(localStorage.getItem(GRANT_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function grantCreatorRole(role = 'tournament-organizer') {
  const current = new Set(getGrantedRoles())
  current.add(role)
  localStorage.setItem(GRANT_KEY, JSON.stringify([...current]))
}

export function canCreateTournaments(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (getGrantedRoles().length > 0) return true
  const roles = user.creatorRoles || user.roles || []
  return Array.isArray(roles) && roles.some(r => CREATOR_ROLES.includes(r))
}

