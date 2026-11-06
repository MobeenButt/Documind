import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, AlertCircle, FileText } from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'
import GlassCard from '../components/GlassCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Email and password are both required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/', { replace: true })
      } else {
        await signUp(email, password)
        navigate('/', { replace: true })
      }
    } catch (err) {
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('already registered'))
        setError('This email is already registered. Please sign in.')
      else if (msg.includes('invalid email or password'))
        setError('Incorrect email or password.')
      else
        setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <>
      <AuroraBackground />

      <div style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg, var(--accent), #5b4fcf)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px var(--accent-glow)',
          }}>
            <FileText size={19} color="white" strokeWidth={2} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '1.4rem',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            Docu
            <span style={{
              background: 'linear-gradient(135deg, #a78bfa, #38bdf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Mind
            </span>
          </span>
        </motion.div>

        {/* Auth Card */}
        <GlassCard tilt={false} style={{ width: '100%', maxWidth: 420, padding: '36px 32px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '1.5rem',
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
              {isLogin
                ? 'Sign in to access your documents'
                : 'Create an account to chat with your PDFs'}
            </p>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '11px 14px', borderRadius: 10, marginBottom: 16,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  fontSize: '0.82rem', color: '#fca5a5', lineHeight: 1.5,
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.78rem',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
                marginBottom: 6,
              }}>
                Email
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'border-color 0.2s',
              }}
                onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(124,107,255,0.45)'}
                onBlurCapture={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <Mail size={15} color="var(--text-muted)" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.78rem',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
                marginBottom: 6,
              }}>
                Password
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'border-color 0.2s',
              }}
                onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(124,107,255,0.45)'}
                onBlurCapture={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <Lock size={15} color="var(--text-muted)" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              className="btn-glow"
              whileTap={{ scale: 0.97 }}
              style={{
                width: '100%', padding: '13px',
                fontSize: '0.95rem', marginTop: 4,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <><LoadingSpinner variant="ring" size={16} color="white" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}</>
                : isLogin ? 'Sign in' : 'Create account'
              }
            </motion.button>
          </form>

          {/* Mode toggle */}
          <div style={{
            textAlign: 'center', marginTop: 20,
            fontSize: '0.82rem', color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
          }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(isLogin ? 'register' : 'login'); setError('') }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#a78bfa', fontFamily: 'var(--font-body)',
                fontSize: '0.82rem', fontWeight: 600, textDecoration: 'underline',
              }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </GlassCard>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          style={{
            marginTop: 20, fontSize: '0.72rem',
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            textAlign: 'center',
          }}
        >
          Your documents stay private to your account
        </motion.p>
      </div>
    </>
  )
}
