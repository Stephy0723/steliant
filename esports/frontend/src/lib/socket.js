import { io } from 'socket.io-client'
import { API_URL } from './api.js'

// El backend deriva la identidad de la misma cookie de sesión que usa la API
// REST (auth_token) -- withCredentials manda esa cookie en el handshake, no
// hace falta manejar tokens a mano acá.
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '')

let socket = null

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { withCredentials: true, autoConnect: false })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  // Showcase does not connect to a production socket.
  return s
}

export function disconnectSocket() {
  socket?.disconnect()
}

/** Suscribe mientras el componente esté montado; devuelve la función de limpieza. */
export function onSocket(event, handler) {
  const s = getSocket()
  s.on(event, handler)
  return () => s.off(event, handler)
}

