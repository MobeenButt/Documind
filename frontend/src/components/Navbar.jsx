import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, LogOut, ChevronDown, User } from 'lucide-react'
import { checkHealth } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const navigate           = useNavigate()
  const location           = useLocation()
  const { user, signOut }  = useAuth()
  const isHome             = location.pathname === '/'

  const [apiStatus, setApiStatus]   = useState('checking')
  const [showDropdown, setDropdown] = useState(false)

  // Real API health check on mount
  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'))
  }, [])

  const statusColor = apiStatus === 'ok' ? '#34d399' : apiStatus === 'error' ? '#f87171' : '#fbbf24'
  const statusLabel = apiStatus === 'ok' ? 'API connected' : apiStatus === 'error' ? 'API offline' : 'Connecting...'

  async function handleSignOut() {
    setDropdown(false)
    await signOut()
    navigate('/auth', { replace: true })
  }

  // Short email — show only first part before @
  const emailShort = user?.email?.split('@')[0] ?? ''

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      style={{
        position:       'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        padding:        '14px 28px',
        display:        'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom:   '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background:     'rgba(6,6,15,0.7)',
      }}
    >
      {/* ── Logo ── */}
      <motion.button
        onClick={() => !isHome && navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none',
          cursor: isHome ? 'default' : 'pointer', padding: 0,
        }}
        whileHover={!isHome ? { scale: 1.03 } : {}}
        whileTap={!isHome   ? { scale: 0.97 } : {}}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent), #5b4fcf)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px var(--accent-glow)', flexShrink: 0,
        }}>
          <FileText size={16} color="white" strokeWidth={2} />
        </div>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--text-primary)',
        }}>
          Docu
          <span style={{
            background: 'linear-gradient(135deg, #a78bfa, #38bdf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Mind
          </span>
        </span>
      </motion.button>

      {/* ── Right side ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* API status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}80`,
            display: 'inline-block', flexShrink: 0,
          }} />
          {statusLabel}
        </div>

        {/* User dropdown — only if logged in */}
        {user && (
          <div style={{ position: 'relative' }}>
            <motion.button
              onClick={() => setDropdown(!showDropdown)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display:      'flex', alignItems: 'center', gap: 7,
                padding:      '7px 12px', borderRadius: 10,
                background:   'rgba(255,255,255,0.05)',
                border:       '1px solid rgba(255,255,255,0.1)',
                cursor:       'pointer',
              }}
            >
              {/* Avatar circle */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), #5b4fcf)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', color: 'white', fontWeight: 700,
                flexShrink: 0,
              }}>
                {emailShort[0]?.toUpperCase() ?? '?'}
              </div>
              <span style={{
                fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)', maxWidth: 120,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {emailShort}
              </span>
              <ChevronDown
                size={13} color="var(--text-muted)"
                style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0,  scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position:   'absolute', top: '110%', right: 0,
                    minWidth:   180, zIndex: 100,
                    background: 'rgba(13,13,31,0.96)',
                    border:     '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    backdropFilter: 'blur(20px)',
                    overflow:   'hidden',
                    boxShadow:  '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Email display */}
                  <div style={{
                    padding:    '12px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                      Logged in as
                    </p>
                    <p style={{
                      fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {user.email}
                    </p>
                  </div>

                  {/* Logout button */}
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 9,
                      fontSize: '0.82rem', color: '#fca5a5',
                      fontFamily: 'var(--font-body)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.nav>
  )
}
