import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import { showSocialLinkNotice } from '../lib/socialLinkNotice.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// La app compara el usuario con `user._id` en unos sitios y `user.id` en
// otros. Login devolvia solo `id` y /auth/me solo `_id`, asi que segun como
// empezo la sesion una de las dos formas venia vacia. Toda entrada de usuario
// a la sesion pasa por aqui y sale con las dos (mismo valor, string).
export function withUserIds(user) {
  if (!user || typeof user !== 'object') return user
  const userId = String(user._id || user.id || '')
  if (!userId) return user
  if (user._id === userId && user.id === userId) return user
  return { ...user, _id: userId, id: userId }
}

function withSessionIds(session) {
  if (!session?.user) return session
  const user = withUserIds(session.user)
  return user === session.user ? session : { ...session, user }
}

function readSession() {
  try {
    const raw = localStorage.getItem('gg-session') || sessionStorage.getItem('gg-session')
    return raw ? withSessionIds(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)
  // false while a cached session's role/permissions haven't been re-verified against
  // the server yet — route guards should wait on this instead of trusting the stale
  // localStorage snapshot (which can lag behind a role change until this resolves).
  const [authReady, setAuthReady] = useState(() => !readSession()?.user)

  const storeSession = (rawSession, remember) => {
    const nextSession = withSessionIds(rawSession)
    localStorage.removeItem('gg-session')
    sessionStorage.removeItem('gg-session')
    const storage = remember ? localStorage : sessionStorage
    storage.setItem('gg-session', JSON.stringify(nextSession))
    setSession(nextSession)
    setAuthReady(true)

    // Si el usuario llego a /login o /register desde /conectar-discord sin
    // sesion activa, ConnectDiscord dejo el token pendiente aqui.
    const pendingDiscordToken = sessionStorage.getItem('gg-discord-link-token')
    if (pendingDiscordToken) {
      sessionStorage.removeItem('gg-discord-link-token')
      api('/auth/discord/link/confirm', { method: 'POST', body: { token: pendingDiscordToken } })
        .then(() => {
          showSocialLinkNotice('discord', 'success')
          window.dispatchEvent(new Event('gg:auth:refresh'))
        })
        .catch((err) => showSocialLinkNotice('discord', 'error', {
          message: err.message || 'No se pudo vincular Discord despues de crear tu cuenta.',
        }))
    }
  }

  // Cuando cualquier llamada a la API devuelve 401, limpiar sesión
  const mergeUserIntoSession = useCallback((user) => {
    if (!user) return
    setSession(prev => {
      if (!prev) return prev
      const merged = { ...prev, user: withUserIds({ ...prev.user, ...user }) }
      // Sin cambios reales -> se devuelve el mismo objeto. Si no, cada refresco
      // (cada minuto, cada vez que se vuelve a la pestaña) creaba un `user`
      // nuevo identico y toda la app volvia a pedir datos y redibujarse:
      // se veia como parpadeos y saltos sin haber tocado nada.
      if (JSON.stringify(merged.user) === JSON.stringify(prev.user)) return prev
      const inLocal = localStorage.getItem('gg-session')
      const storage = inLocal ? localStorage : sessionStorage
      storage.setItem('gg-session', JSON.stringify(merged))
      return merged
    })
  }, [])

  // Una sola peticion a la vez: al volver a la pestaña llegan `focus` y
  // `visibilitychange` casi juntos, y antes eso eran 2-3 /auth/me seguidos.
  const refreshInFlight = useRef(null)
  const lastRefreshAt = useRef(0)

  const refreshUser = useCallback(async () => {
    const current = readSession()
    if (!current?.user) {
      setAuthReady(true)
      return null
    }
    if (refreshInFlight.current) return refreshInFlight.current

    refreshInFlight.current = (async () => {
      try {
        const { user } = await api('/auth/me')
        mergeUserIntoSession(user)
        return user || null
      } catch {
        return null
      } finally {
        lastRefreshAt.current = Date.now()
        refreshInFlight.current = null
        setAuthReady(true)
      }
    })()
    return refreshInFlight.current
  }, [mergeUserIntoSession])

  useEffect(() => {
    const handleExpired = () => {
      localStorage.removeItem('gg-session')
      sessionStorage.removeItem('gg-session')
      setSession(null)
      setAuthReady(true)
    }
    window.addEventListener('gg:auth:expired', handleExpired)
    return () => window.removeEventListener('gg:auth:expired', handleExpired)
  }, [])

  // Refresca el usuario desde el backend al cargar (refleja cambios sin re-login)
  useEffect(() => {
    if (!session?.user) { setAuthReady(true); return }
    refreshUser()
  }, [refreshUser, session?.token])

  // Mantiene roles/permisos al dia sin obligar a refrescar la pagina.
  useEffect(() => {
    if (!session?.user) return undefined

    // Volver a la pestaña/app refresca, pero no mas de una vez cada 15s. El
    // evento explicito gg:auth:refresh (rol aprobado, Discord vinculado...)
    // siempre refresca.
    const handleRefresh = () => refreshUser()
    const handleReturn = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefreshAt.current < 15_000) return
      refreshUser()
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshUser()
    }, 60_000)

    window.addEventListener('focus', handleReturn)
    window.addEventListener('gg:auth:refresh', handleRefresh)
    document.addEventListener('visibilitychange', handleReturn)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleReturn)
      window.removeEventListener('gg:auth:refresh', handleRefresh)
      document.removeEventListener('visibilitychange', handleReturn)
    }
  }, [refreshUser, session?.token])

  // identifier acepta email o nick (cambio de master)
  // Con 2FA activo el backend no abre sesión: devuelve { requiresTwoFactor,
  // tempToken } y la pantalla de login pide el código (verifyTwoFactor).
  const login = async (identifier, password, remember = false) => {
    const nextSession = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, rememberMe: Boolean(remember) }),
    })
    if (nextSession.requiresTwoFactor) {
      return { requiresTwoFactor: true, tempToken: nextSession.tempToken }
    }
    storeSession(nextSession, remember)
    return withUserIds(nextSession.user)
  }

  // code: el de la app autenticadora o uno de los códigos de respaldo.
  const verifyTwoFactor = async (tempToken, code, remember = false) => {
    const nextSession = await api('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code: String(code || '').trim() }),
    })
    storeSession(nextSession, remember)
    return withUserIds(nextSession.user)
  }

  const register = async (payload) => {
    const nextSession = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    storeSession(nextSession, true)
    return withUserIds(nextSession.user)
  }

  const forgotPassword = (email) => api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

  const resetPassword = (token, password) => api('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })

  // Revoca la sesión en el servidor (jti + cookie HttpOnly) además de borrar la
  // local; sin esto el token seguía válido y la cookie volvía a autenticar.
  const logout = () => {
    if (session?.token) api('/auth/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem('gg-session')
    sessionStorage.removeItem('gg-session')
    setSession(null)
    setAuthReady(true)
  }

  const updateUser = useCallback((patchOrUser) => {
    setSession(prev => {
      if (!prev) return prev
      const user = withUserIds(typeof patchOrUser === 'function'
        ? patchOrUser(prev.user || {})
        : { ...(prev.user || {}), ...(patchOrUser || {}) })
      const merged = { ...prev, user }
      const storage = localStorage.getItem('gg-session') ? localStorage : sessionStorage
      storage.setItem('gg-session', JSON.stringify(merged))
      return merged
    })
  }, [])

  return (
    <AuthContext.Provider value={{
      user: session?.user || null,
      token: session?.token || null,
      authReady,
      login,
      verifyTwoFactor,
      register,
      logout,
      forgotPassword,
      resetPassword,
      refreshUser,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

