import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'

export default function TeamRoute() {
  const { user, authReady } = useAuth()
  const [canManageTeam, setCanManageTeam] = useState(null)

  useEffect(() => {
    if (!user || !authReady) return
    let alive = true
    api('/teams/mine')
      .then(data => {
        if (!alive) return
        const userId = String(user?._id || user?.id || '')
        const teams = Array.isArray(data?.teams) ? data.teams : []
        const ownsTeam = teams.some(team => {
          const leaderId = String(team?.leader?._id || team?.leader?.id || team?.leader || '')
          return userId && leaderId && userId === leaderId
        })
        // Solo quien de verdad lidera un equipo entra a /mi-equipo -- ser
        // admin del sitio no cuenta (para eso esta /admin/equipos).
        setCanManageTeam(ownsTeam)
      })
      .catch(() => { if (alive) setCanManageTeam(false) })
    return () => { alive = false }
  }, [user, authReady])

  if (!user) return <Navigate to="/login" replace />
  if (!authReady || canManageTeam === null) return null
  if (!canManageTeam) return <Navigate to="/jugador/equipos" replace />
  return <Outlet />
}

