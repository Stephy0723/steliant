import { api } from './api.js'

// Cuentas de juego verificadas con el codigo del correo del juego
// (backend: routes/gameAccount.routes.js).
export const gameAccountsApi = {
  mine: () => api('/game-accounts/me'),
  sendCode: (roleId, zoneId) => api('/game-accounts/mlbb/send-code', { method: 'POST', body: { roleId, zoneId } }),
  verify: code => api('/game-accounts/mlbb/verify', { method: 'POST', body: { code } }),
  confirm: accept => api('/game-accounts/mlbb/confirm', { method: 'POST', body: { accept } }),
  disconnect: () => api('/game-accounts/mlbb', { method: 'DELETE' }),
  status: userIds => api(`/game-accounts/status?users=${encodeURIComponent(userIds.join(','))}`),
}

