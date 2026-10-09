// Cliente HTTP base hacia el backend + clientes por dominio.
// Toda la "conexión" pasa por aquí: cuando el backend esté desplegado con
// credenciales, el frontend ya queda conectado sin cambiar las pantallas.
import { api, apiBlob } from './api.js'

export const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api')

// ── Torneos ──
export const tournamentsApi = {
  mine: () => api('/tournaments/mine'),
  staffRoom: (id) => api(`/tournaments/${id}/staff-room`),
  staffMine: (status) => api(`/tournaments/staff/mine${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  respondStaffInvite: (id, decision, reason = '') => api(`/tournaments/${id}/staff/response`, { method: 'PATCH', body: JSON.stringify({ decision, reason }) }),
  draft: () => api('/tournaments/draft/current'),
  saveDraft: (data) => api('/tournaments/draft/current', { method: 'PUT', body: JSON.stringify(data) }),
  deleteDraft: (key) => api(`/tournaments/draft/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api(`/tournaments${query ? `?${query}` : ''}`)
  },
  search: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api(`/tournaments/search${query ? `?${query}` : ''}`)
  },
  get: (id) => api(`/tournaments/${id}`),
  create: (data) => api('/tournaments', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
  update: (id, data) => api(`/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => api(`/tournaments/${id}`, { method: 'DELETE' }),
  getBracket: (id) => api(`/tournaments/${id}/bracket`),
  saveBracket: (id, data) => api(`/tournaments/${id}/bracket`, { method: 'PUT', body: JSON.stringify(data) }),
  // Reporte de resultados por los capitanes (ver matchReports.controller.js).
  listMatchReports: (id) => api(`/tournaments/${id}/bracket/reports`),
  getMatchReport: (id, matchId) => api(`/tournaments/${id}/bracket/matches/${matchId}/report`),
  submitMatchReport: (id, matchId, data) => api(`/tournaments/${id}/bracket/matches/${matchId}/report`, { method: 'POST', body: JSON.stringify(data) }),
  getDiscordSummary: (id) => api(`/tournaments/${id}/discord-summary`),
  // Tickets de #soporte del torneo (ver supportTickets.controller.js).
  listSupportTickets: (id) => api(`/tournaments/${id}/support-tickets`),
  resolveSupportTicket: (id, ticketId) => api(`/tournaments/${id}/support-tickets/${ticketId}/resolve`, { method: 'POST' }),
  // Log de mensajes/acciones automaticas del bot (bienvenidas, anuncios,
  // aprovisionamiento). El caller maneja rechazos para entornos viejos donde
  // el backend todavia no tenga este endpoint desplegado.
  getDiscordLog: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api(`/tournaments/${id}/discord-log${query ? `?${query}` : ''}`)
  },
  // Reintenta el aprovisionamiento Discord de un equipo (sala + bienvenida).
  // Idempotente del lado del bot: solo crea/envia lo que falte.
  retryTeamDiscordProvision: (id, teamId) => api(`/tournaments/${id}/discord/teams/${teamId}/retry`, { method: 'POST' }),
  // Reintenta crear la sala del TORNEO (categoria + canales) cuando quedo en 'failed'.
  retryTournamentDiscordProvision: (id) => api(`/tournaments/${id}/discord/retry`, { method: 'POST' }),
  // Torneos donde un equipo esta inscrito (para el panel de equipo/jugador: "Enfrentamiento").
  byTeam: (teamId, { includeFinished = false } = {}) => api(`/tournaments/by-team/${teamId}${includeFinished ? '?includeFinished=true' : ''}`),
  addCaster: (id, userId) => api(`/tournaments/${id}/staff/casters`, { method: 'POST', body: JSON.stringify({ userId }) }),
  removeCaster: (id, userId, reason) => api(`/tournaments/${id}/staff/casters/${userId}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
  addStaff: (id, member) => api(`/tournaments/${id}/staff`, { method: 'POST', body: JSON.stringify(member) }),
  applyForStaff: (id, role) => api(`/tournaments/${id}/staff/apply`, { method: 'POST', body: JSON.stringify({ role }) }),
  updateStaff: (id, userId, patch) => api(`/tournaments/${id}/staff/${userId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeStaff: (id, userId) => api(`/tournaments/${id}/staff/${userId}`, { method: 'DELETE' }),
  auditLog: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api(`/tournaments/${id}/audit-log${query ? `?${query}` : ''}`)
  },
}

// ── Inscripciones + check-in ──
// ── Resultados por revisar / arbitraje (lectura automática de /report) ──
export const resultsApi = {
  review: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString()
    return api(`/results/review${query ? `?${query}` : ''}`)
  },
  get: (id) => api(`/results/cases/${id}`),
  take: (id, to = '') => api(`/results/cases/${id}/take`, { method: 'POST', body: JSON.stringify(to ? { to } : {}) }),
  decide: (id, data) => api(`/results/cases/${id}/decide`, { method: 'POST', body: JSON.stringify(data) }),
  appeal: (id, reason) => api(`/results/cases/${id}/appeal`, { method: 'POST', body: JSON.stringify({ reason }) }),
  // Pista .ogg de un jugador (solo árbitro); queda en la auditoría del caso.
  recordingTrack: (id, recordingId, discordUserId) => apiBlob(`/results/cases/${id}/recordings/${recordingId}/tracks/${discordUserId}`),
}

export const registrationsApi = {
  list: (tid) => api(`/tournaments/${tid}/registrations`),
  create: (tid, data) => api(`/tournaments/${tid}/registrations`, { method: 'POST', body: JSON.stringify(data) }),
  checkin: (tid, rid, type) => api(`/tournaments/${tid}/registrations/${rid}/checkin`, { method: 'POST', body: JSON.stringify({ type }) }),
}

// ── Reportes / disputas ──
export const reportsApi = {
  list: (tid) => api(`/tournaments/${tid}/reports`),
  create: (tid, data) => api(`/tournaments/${tid}/reports`, { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (tid, rid, patch) => api(`/tournaments/${tid}/reports/${rid}`, { method: 'PATCH', body: JSON.stringify(patch) }),
}

// ── Notificaciones ──
export const notificationsApi = {
  list: (user) => api(`/notifications${user ? `?user=${encodeURIComponent(user)}` : ''}`),
  create: (data) => api('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'POST' }),
}

// ── Uploads (capturas, banners, PDF) ──
export const uploadsApi = {
  // file: File → lo convierte a dataURL y lo sube. Devuelve { url }.
  upload: (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => api('/uploads', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result, filename: file.name }) }).then(resolve).catch(reject)
    reader.onerror = reject
    reader.readAsDataURL(file)
  }),
}

// ── Pagos ──
export const paymentsApi = {
  config: () => api('/payments/config'),
  checkout: (data) => api('/payments/checkout', { method: 'POST', body: JSON.stringify(data) }),
  orders: () => api('/payments/orders'),
  verify: (id) => api(`/payments/orders/${encodeURIComponent(id)}/verify`),
  emailReceipt: (id) => api(`/payments/orders/${encodeURIComponent(id)}/receipt`, { method: 'POST' }),
}

// ── OAuth ──
export const oauthApi = {
  status: () => api('/oauth/status'),
  start: (provider) => api(`/oauth/${provider}/start`),
}

