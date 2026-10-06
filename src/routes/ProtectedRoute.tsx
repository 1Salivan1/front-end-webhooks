import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/**
 * The mock keeps the session in memory only, so a page reload always lands
 * here. The requested location is handed to the login screen and restored
 * after sign-in, which is what keeps the list's URL parameters alive.
 */
export function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (user === null) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
