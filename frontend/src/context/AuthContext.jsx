/**
 * AuthContext — Global auth state management
 *
 * Concept: React Context kya hai?
 * Normal mein agar parent se child ko data pass karna ho toh props use karte hain:
 *   App → Navbar → UserAvatar (user prop pass karo har jagah)
 *
 * Context se koi bhi component directly user access kar sakta hai:
 *   useAuth() → { user, session, signOut }
 * Koi prop drilling nahi.
 *
 * Supabase Auth kaise kaam karta hai?
 * 1. signUp(email, password) → Supabase user banata hai → confirmation email
 * 2. signIn(email, password) → JWT token milta hai → session mein store hoti hai
 * 3. supabase.auth.onAuthStateChange() → har change pe callback
 *    (login, logout, token refresh — sab automatically handle hota hai)
 * 4. session.access_token → backend ko bhejo har request mein
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Context object — default value null means "not inside a provider"
const AuthContext = createContext(null)

// ─── Provider ────────────────────────────────────────────────────────────────
// Yeh component poori app ko wrap karta hai (App.jsx mein)
// Saare child components useAuth() hook se user access kar sakte hain

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)     // Supabase user object
  const [session, setSession] = useState(null)     // Session (contains JWT token)
  const [loading, setLoading] = useState(true)     // Initial auth check chal raha hai?

  useEffect(() => {
    // ── Step 1: Current session check ──────────────────────────────────────
    // App load hone pe check karo — kya user pehle se logged in hai?
    // Supabase localStorage mein session save karta hai
    // (user page refresh kare toh logout nahi hota)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // ── Step 2: Auth state listener ────────────────────────────────────────
    // Jab bhi auth change ho (login/logout/token refresh) yeh callback chalega
    // 'SIGNED_IN' event pe session milti hai
    // 'SIGNED_OUT' event pe session null hoti hai
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Cleanup — component unmount pe listener remove karo
    return () => subscription.unsubscribe()
  }, [])

  // ── Auth functions ────────────────────────────────────────────────────────

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Value jo saare child components ko milegi
  const value = {
    user,        // Supabase user object { id, email, ... }
    session,     // Session { access_token, ... }
    loading,     // true jab tak initial check complete na ho
    signUp,
    signIn,
    signOut,
    // Convenience: JWT token directly
    // Backend ko har request mein yeh bhejni hoti hai
    token: session?.access_token ?? null,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────
// Custom hook — useAuth() likhne se saara context ek line mein milta hai
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
