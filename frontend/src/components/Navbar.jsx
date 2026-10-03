import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText } from 'lucide-react'

// Navbar — minimal top bar, shown on all pages
// Logo click goes home (upload page) — only if not already there

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === '/'

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(6, 6, 15, 0.6)',
      }}
    >
      {/* Logo */}
      <motion.button
        onClick={() => !isHome && navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'none',
          border: 'none',
          cursor: isHome ? 'default' : 'pointer',
          padding: 0,
        }}
        whileHover={!isHome ? { scale: 1.03 } : {}}
        whileTap={!isHome ? { scale: 0.97 } : {}}
      >
        {/* Icon with glow */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #5b4fcf)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px var(--accent-glow)',
            flexShrink: 0,
          }}
        >
          <FileText size={17} color="white" strokeWidth={2} />
        </div>

        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '1.1rem',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          Docu<span className="gradient-text">Mind</span>
        </span>
      </motion.button>

      {/* Right side — subtle status indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.78rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52, 211, 153, 0.6)',
            display: 'inline-block',
          }}
        />
        API connected
      </div>
    </motion.nav>
  )
}
