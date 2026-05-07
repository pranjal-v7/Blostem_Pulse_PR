import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import RadarPage from './pages/RadarPage'
import CompanyDetailPage from './pages/CompanyDetailPage'
import OutreachPage from './pages/OutreachPage'
import SettingsPage from './pages/SettingsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { user, loading, needsOnboarding } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--teal)' }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--teal)' }} />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/app/radar" replace /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="radar" element={<RadarPage />} />
        <Route path="company/:id" element={<CompanyDetailPage />} />
        <Route path="outreach" element={<OutreachPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route index element={<Navigate to="radar" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/app/radar" : "/login"} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
