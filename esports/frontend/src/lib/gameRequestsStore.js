function disabledStoreWarning(action) {
  console.warn(`[GlitchGang] ${action} local de solicitudes de juego deshabilitado. Usa /game-requests.`)
}

export function getLocalGameRequests() {
  disabledStoreWarning('Lectura')
  return []
}

export function addLocalGameRequest() {
  disabledStoreWarning('Creacion')
  return null
}

export function updateLocalGameRequest() {
  disabledStoreWarning('Actualizacion')
  return null
}

