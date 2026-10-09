function keyOf(ticketOrCode) {
  if (typeof ticketOrCode === 'string') return ticketOrCode
  return ticketOrCode?.publicCode || ticketOrCode?.id || ticketOrCode?._id || 'ticket'
}

export function getSystemTicketChatId(ticketOrCode) {
  return `system-ticket-${keyOf(ticketOrCode)}`
}

// Página propia de seguimiento del ticket (no /mensajes -- esta rama no
// tiene un sistema de conversaciones grupales donde insertar el hilo del
// ticket, así que vive en su propia vista con el mismo backend real).
export function getSystemTicketLink(ticketOrCode) {
  return `/ayuda/ticket/${encodeURIComponent(keyOf(ticketOrCode))}`
}

export function syncTicketToMessenger(ticket, options = {}) {
  if (!ticket) return null
  const chatId = getSystemTicketChatId(ticket)
  if (!options.silent) {
    window.dispatchEvent(new CustomEvent('gg-messenger-share', { detail: { chatId, ticket } }))
  }
  return { id: chatId, ticket }
}

