import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminProtectedRoute() {
  const { user, authReady } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!authReady) return null
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

