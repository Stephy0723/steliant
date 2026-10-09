function disabledEventsWarning(action) {
  console.warn(`[GlitchGang] ${action} local de eventos deshabilitado. Usa backend de eventos.`)
}

export function loadEvents() {
  return []
}

export function saveEvents() {
  disabledEventsWarning('Guardado')
}

export function addEvent() {
  disabledEventsWarning('Creacion')
  return []
}

export function removeEvent() {
  disabledEventsWarning('Eliminacion')
  return []
}

