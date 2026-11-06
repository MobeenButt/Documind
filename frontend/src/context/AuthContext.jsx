/**
 * AuthContext — global auth state.
 *
 * Auth is handled by the backend (/auth/signup, /auth/login).
 * Token storage uses localStorage → sessionStorage → in-memory fallback,
 * matching the same chain used in api.js, so the token is always available
 * for the Authorization header even when localStorage is blocked.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { signup as apiSignup, login as apiLogin, setToken, clearToken, getToken } from '../services/api'

const USER_KEY = 'documind_user'

// ─── User storage helpers (localStorage → sessionStorage → no-op) ─────────────
function loadUser() {
  let raw = null
  try { raw = localStorage.getItem(USER_KEY) }   catch { /* blocked */ }
  if (!raw) try { raw = sessionStorage.getItem(USER_KEY) } catch { /* blocked */ }
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function saveUser(user) {
  const str = JSON.stringify(user)
  try { localStorage.setItem(USER_KEY, str); return } catch { /* blocked */ }
  try { sessionStorage.setItem(USER_KEY, str) }       catch { /* blocked */ }
}

function removeUser() {
  try { localStorage.removeItem(USER_KEY) }   catch { /* blocked */ }
  try { sessionStorage.removeItem(USER_KEY) } catch { /* blocked */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [token, setTokenState]  = useState(null)
  const [loading, setLoading]   = useState(true)

  // Restore session on mount
  useEffect(() => {
    const savedToken = getToken()
    const savedUser  = loadUser()
    if (savedToken && savedUser) {
      setTokenState(savedToken)
      setUser(savedUser)
    }
    setLoading(false)
  }, [])

  async function signUp(email, password) {
    const data = await apiSignup(email, password)
    persist(data)
    return data
  }

  async function signIn(email, password) {
    const data = await apiLogin(email, password)
    persist(data)
    return data
  }

  async function signOut() {
    clearToken()
    removeUser()
    setTokenState(null)
    setUser(null)
  }

  function persist(data) {
    setToken(data.token)
    setTokenState(data.token)
    setUser(data.user)
    saveUser(data.user)
  }

  const value = { user, token, loading, signUp, signIn, signOut }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
