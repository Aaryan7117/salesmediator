import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, createContext, useContext } from 'react'
import ParticleBackground from './components/ParticleBackground'
import Login from './pages/Login'
import Signup from './pages/Signup'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import LiveMonitor from './pages/LiveMonitor'
import KnowledgeBase from './pages/KnowledgeBase'
import WidgetCustomizer from './pages/WidgetCustomizer'
import Integrations from './pages/Integrations'
import Team from './pages/Team'
import Onboarding from './pages/Onboarding'

// ── API Config ──
// In development: defaults to localhost. In production: set VITE_API_URL in .env
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// ── Auth Context ──
interface AuthState {
  token: string | null
  userId: string | null
  orgId: string | null
  orgSlug: string | null
  role: string | null
  fullName: string | null
}

interface AuthContextType {
  auth: AuthState
  setAuth: (auth: AuthState) => void
  logout: () => void
  isAuthenticated: boolean
}

const defaultAuth: AuthState = {
  token: null, userId: null, orgId: null,
  orgSlug: null, role: null, fullName: null,
}

export const AuthContext = createContext<AuthContextType>({
  auth: defaultAuth,
  setAuth: () => {},
  logout: () => {},
  isAuthenticated: false,
})

export const useAuth = () => useContext(AuthContext)

function App() {
  const [auth, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('salesgen_auth')
    return saved ? JSON.parse(saved) : defaultAuth
  })

  const setAuth = (newAuth: AuthState) => {
    setAuthState(newAuth)
    if (newAuth.token) {
      localStorage.setItem('salesgen_auth', JSON.stringify(newAuth))
    } else {
      localStorage.removeItem('salesgen_auth')
    }
  }

  const logout = () => {
    setAuth(defaultAuth)
  }

  const isAuthenticated = !!auth.token

  return (
    <AuthContext.Provider value={{ auth, setAuth, logout, isAuthenticated }}>
      <ParticleBackground />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login />
          } />
          <Route path="/signup" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Signup />
          } />

          {/* Protected routes */}
          <Route path="/" element={
            isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />
          }>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="live" element={<LiveMonitor />} />
            <Route path="knowledge-base" element={<KnowledgeBase />} />
            <Route path="widget" element={<WidgetCustomizer />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="team" element={<Team />} />
          </Route>

          {/* Onboarding */}
          <Route path="/onboarding" element={
            isAuthenticated ? <Onboarding /> : <Navigate to="/signup" />
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
