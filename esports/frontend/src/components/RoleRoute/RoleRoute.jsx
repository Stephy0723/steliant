import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function RoleRoute({ roles }) {
  const { user, authReady } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  // Wait for the server-fresh role check before deciding — the cached session can
  // still hold a role that was just changed server-side (e.g. a role approval).
  if (!authReady) return null
  const userRoles = new Set([user.role, ...(user.roles || [])].filter(Boolean))
  if (!roles.some(role => userRoles.has(role))) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

