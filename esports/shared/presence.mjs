// Presencia de un usuario, compartida por backend y frontend.
//
// Dos campos en User:
//   status        -> CONEXION: 'online'/'gaming' mientras tiene la web abierta
//                    (lo pone el socket, realtime/messagesRealtime.js).
//   activeStatus  -> lo que ELIGE el usuario (En linea, Jugando, AFK, No
//                    molestar, Invisible, En torneo...; data/cosmetics.js).
//
// Lo que ven los demas: si esta conectado, su estado elegido; si no, o si
// eligio Invisible, "Desconectado". El backend manda `presence` ya resuelto y
// nunca manda activeStatus de alguien desconectado (no revela que se puso
// Invisible).

export const CONNECTED_STATUSES = ['online', 'gaming']
export const OFFLINE_PRESENCE = 'offline'

export function isConnected(user) {
  if (!user) return false
  if (typeof user.online === 'boolean' && !user.status) return user.online
  return CONNECTED_STATUSES.includes(String(user.status || ''))
}

// Id del estado a mostrar: el elegido si esta conectado, 'offline' si no.
// Si ya viene `presence` resuelto por el backend, se respeta.
export function presenceId(user) {
  if (!user) return OFFLINE_PRESENCE
  if (typeof user.presence === 'string' && user.presence) return user.presence
  if (!isConnected(user)) return OFFLINE_PRESENCE
  const chosen = String(user.activeStatus || '')
  return chosen && chosen !== 'invisible' ? chosen : 'online'
}

// Campos publicos de presencia para una respuesta de la API.
export function publicPresence(user) {
  const presence = presenceId({ presence: user?.presence, status: user?.status, activeStatus: user?.activeStatus, online: user?.online })
  const online = presence !== OFFLINE_PRESENCE
  return { online, presence, lastSeenAt: online ? null : (user?.lastSeenAt || null) }
}

// Copia del usuario con la presencia resuelta y sin el estado elegido crudo
// (para no revelar "Invisible" ni el estado de alguien desconectado).
export function withPublicPresence(user) {
  if (!user || typeof user !== 'object') return user
  const plain = typeof user.toObject === 'function' ? user.toObject() : user
  const { activeStatus, ...rest } = plain
  void activeStatus
  return { ...rest, ...publicPresence(plain) }
}

