function asText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function disabledJoinRequestWarning(action) {
  console.warn(`[GlitchGang] ${action} local de solicitudes de equipo deshabilitado. Usa /teams/:teamId/requests.`)
}

export function teamRequestTeamId(team, fallback = '') {
  return asText(team?._id || team?.id || team?.teamId || fallback || team?.publicCode || team?.name)
}

export function teamRequestUserId(user) {
  return asText(user?._id || user?.id || user?.userId || user?.nick || user?.username || user?.email, 'guest')
}

export function readTeamJoinRequests() {
  return []
}

export function writeTeamJoinRequests() {
  disabledJoinRequestWarning('Guardado')
}

export function upsertLocalTeamJoinRequest() {
  disabledJoinRequestWarning('Creacion')
  return null
}

export function updateLocalTeamJoinRequest() {
  disabledJoinRequestWarning('Actualizacion')
  return []
}

