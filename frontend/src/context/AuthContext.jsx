/**
 * AuthContext — global auth state.
 *
 * Auth is handled by the backend (/auth/signup, /auth/login). The JWT and
 * the user object are kept in localStorage so a page refresh keeps you
 * logged in. useAuth() returns { user, token, loading, signUp, signIn, signOut }.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { signup as apiSignup, login as apiLogin, setToken, clearToken } from '../services/api'

const USER_KEY = 'documind_user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setTokenState] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('documind_token')
    const savedUser = localStorage.getItem(USER_KEY)
    if (savedToken && savedUser) {
      setTokenState(savedToken)
      try { setUser(JSON.parse(savedUser)) } catch { setUser(null) }
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
    localStorage.removeItem(USER_KEY)
    setTokenState(null)
    setUser(null)
  }

  function persist(data) {
    setToken(data.token)
    setTokenState(data.token)
    setUser(data.user)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
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
