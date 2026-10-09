import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { tournamentsApi } from '../../lib/serverApi.js'
import { normalizeTournament } from '../../lib/tournamentAdapter.js'
import { roleDashboardPath } from '../../lib/roleDashboards.js'

// Protege /organizador/torneo/:id/* para dueño/admin (como antes, sin
// costo de red extra) o para staff aceptado de ESE torneo puntual — el
// mismo torneo puede dejar pasar a un caster y rechazar a otro.
export default function TournamentStaffRoute() {
  const { user, authReady } = useAuth()
  const { id } = useParams()
  const [allowed, setAllowed] = useState(null)

  useEffect(() => {
    if (!user || !authReady) return
    if (user.role === 'admin' || user.role === 'organizer') { setAllowed(true); return }
    let alive = true
    setAllowed(null)
    const myId = String(user._id || user.id || '')
    tournamentsApi.get(id)
      .then(data => {
        if (!alive) return
        const t = normalizeTournament(data)
        const isAccepted = (t.staffMembers || []).some(m => String(m.user) === myId && m.status === 'accepted')
        setAllowed(isAccepted)
      })
      .catch(() => { if (alive) setAllowed(false) })
    return () => { alive = false }
  }, [user, authReady, id])

  if (!user) return <Navigate to="/login" replace />
  if (!authReady || allowed === null) return null
  if (!allowed) return <Navigate to={roleDashboardPath(user.role)} replace />
  return <Outlet />
}

