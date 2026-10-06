import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { WebhooksPage } from '../features/webhooks/WebhooksPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/webhooks" element={<WebhooksPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/webhooks" replace />} />
    </Routes>
  )
}
