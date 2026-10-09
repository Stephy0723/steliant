export const SYSTEM_TICKET_PURPOSES = [
  { id: 'bot', label: 'Hablar con bot', desc: 'Dudas rapidas, automatizaciones y guias del sistema.' },
  { id: 'representative', label: 'Representante', desc: 'Necesitas una persona del equipo GlitchGang.' },
  { id: 'complaint', label: 'Queja', desc: 'Reporta trato, abuso, conducta o una mala experiencia.' },
  { id: 'help', label: 'Ayuda general', desc: 'No sabes donde encaja tu caso.' },
  { id: 'bug', label: 'Bug tecnico', desc: 'Algo no funciona correctamente.' },
  { id: 'account', label: 'Cuenta', desc: 'Acceso, perfil, seguridad o verificacion.' },
  { id: 'payment', label: 'Pago', desc: 'Planes, facturas, inscripciones o reembolsos.' },
  { id: 'tournament', label: 'Torneo', desc: 'Check-in, bracket, resultados o reglas.' },
  { id: 'community', label: 'Comunidad', desc: 'Solicitudes de juegos, comunidades y catalogo.' },
  { id: 'brand', label: 'Marca', desc: 'Soporte, campanas, creatividades o reportes de marcas.' },
  { id: 'moderation', label: 'Moderacion', desc: 'Avisos administrativos, evidencia o conducta.' },
]

export const SYSTEM_TICKET_STATUS = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_user: 'Esperando usuario',
  closed: 'Cerrado',
}

export const SYSTEM_TICKET_PRIORITY = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

function disabledStoreWarning(action) {
  console.warn(`[GlitchGang] ${action} local de tickets deshabilitado. Usa /system-tickets.`)
}

export function getLocalSystemTickets() {
  disabledStoreWarning('Lectura')
  return []
}

export function createLocalSystemTicket() {
  disabledStoreWarning('Creacion')
  return null
}

export function updateLocalSystemTicket() {
  disabledStoreWarning('Actualizacion')
  return null
}

export function appendLocalSystemTicketMessage() {
  disabledStoreWarning('Mensaje')
  return null
}

