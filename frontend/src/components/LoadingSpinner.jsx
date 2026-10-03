import { motion } from 'framer-motion'

// LoadingSpinner — three variants for different contexts
//
// variant="ring"  — rotating arc (default, used in buttons)
// variant="dots"  — three bouncing dots (used in chat)
// variant="pulse" — expanding rings (used in ProcessingPage)

export default function LoadingSpinner({ variant = 'ring', size = 24, color = 'var(--accent)' }) {
  if (variant === 'ring') {
    return (
      <motion.div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid rgba(255,255,255,0.1)`,
          borderTopColor: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
      />
    )
  }

  if (variant === 'dots') {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderRadius: '50%',
              background: color,
            }}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.18,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    )
  }

  if (variant === 'pulse') {
    // Three expanding rings — used on the ProcessingPage
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${color}`,
            }}
            animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.65,
              ease: 'easeOut',
            }}
          />
        ))}
        {/* Center dot */}
        <div
          style={{
            position: 'absolute',
            inset: '35%',
            borderRadius: '50%',
            background: color,
          }}
        />
      </div>
    )
  }

  return null
}
