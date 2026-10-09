import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.jsx'

// Solo expone el resumen real del panel (/admin/summary). Antes tambien
// cargaba usuarios/torneos/pagos/moderacion/anuncios de ejemplo (data/admin.js)
// que varias paginas usaban como "fallback" -- y terminaban mostrando datos
// inventados cuando el backend tardaba o fallaba.
const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const { user } = useAuth()
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin' || user?.roles?.includes('admin'))
  const [summary, setSummary] = useState(null)

  const refreshSummary = async () => {
    try {
      const data = await api('/admin/summary')
      setSummary(data || null)
    } catch {
      setSummary(null)
    }
  }

  // /admin/summary siempre da 401 para quien no es admin -- este provider
  // envuelve toda la app (ver App.jsx), asi que sin este candado cada visita
  // de cada usuario dispara un fetch destinado a fallar, cada 30s, para siempre.
  useEffect(() => {
    if (!isAdmin) { setSummary(null); return }
    refreshSummary()
    const timer = setInterval(refreshSummary, 30_000)
    window.addEventListener('gg-admin-summary:update', refreshSummary)
    window.addEventListener('gg-system-tickets:update', refreshSummary)
    return () => {
      clearInterval(timer)
      window.removeEventListener('gg-admin-summary:update', refreshSummary)
      window.removeEventListener('gg-system-tickets:update', refreshSummary)
    }
  }, [isAdmin])

  return <AdminContext.Provider value={{ summary, refreshSummary }}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  return useContext(AdminContext)
}

