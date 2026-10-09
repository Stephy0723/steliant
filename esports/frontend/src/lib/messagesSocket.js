import { io } from 'socket.io-client'

const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || '/api'
const CONFIGURED_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

function socketUrl() {
  if (CONFIGURED_SOCKET_URL) return CONFIGURED_SOCKET_URL.replace(/\/$/, '')
  if (/^https?:\/\//i.test(CONFIGURED_API_URL)) {
    return CONFIGURED_API_URL.replace(/\/api\/?$/i, '').replace(/\/$/, '')
  }
  if (import.meta.env.DEV) return 'http://localhost:4000'
  return window.location.origin
}

function authToken() {
  try {
    const raw = localStorage.getItem('gg-session') || sessionStorage.getItem('gg-session')
    const session = raw ? JSON.parse(raw) : null
    return session?.token || ''
  } catch {
    return ''
  }
}

export function createMessagesSocket() {
  return io(socketUrl(), {
    auth: { token: authToken() },
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1200,
  })
}

