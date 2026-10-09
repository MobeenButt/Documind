import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary  from './components/ErrorBoundary'
import LoadingSpinner from './components/LoadingSpinner'

import AuthPage       from './pages/AuthPage'
import UploadPage     from './pages/UploadPage'
import ProcessingPage from './pages/ProcessingPage'
import ChatPage       from './pages/ChatPage'

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Concept: Protected route kya hai?
//
// Kuch pages sirf logged-in users ke liye hain.
// ProtectedRoute check karta hai:
//   - Auth load ho rahi hai → loading spinner dikhao
//   - User logged in hai → requested page dikhao
//   - User logged out hai → /auth pe redirect karo
//
// Usage: <Route element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    // Auth check chal raha hai — blank screen mat dikhao
    return (
      <div style={{
        height:         '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     '#06060f',
        flexDirection:  'column',
        gap:            16,
      }}>
        <LoadingSpinner variant="ring" size={36} color="var(--accent)" />
        <p style={{
          fontSize:   '0.8rem',
          color:      'rgba(240,240,255,0.3)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Loading...
        </p>
      </div>
    )
  }

  if (!user) {
    // Not logged in → auth page pe bhejo
    // replace: true → back button press karne pe infinite redirect na ho
    return <Navigate to="/auth" replace />
  }

  return children
}

// ─── Public Route ─────────────────────────────────────────────────────────────
// Agar user already logged in hai aur /auth pe jaane ki koshish kare
// toh seedha home pe redirect karo

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null   // Auth check chal raha hai

  if (user) {
    return <Navigate to="/" replace />   // Already logged in → home
  }

  return children
}

// ─── Animated Routes ──────────────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        {/* Public — only for logged-out users */}
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />

        {/* Protected — require login */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/processing"
          element={
            <ProtectedRoute>
              <ProcessingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AnimatePresence>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      {/* AuthProvider sabse upar — saare components ko user access milta hai */}
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
