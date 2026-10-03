import { motion } from 'framer-motion'

// CitationBadge — glowing page number pill shown in chat answers
// Example: <CitationBadge page={3} />  → renders "p.3"

export default function CitationBadge({ page, index = 0 }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.25, ease: 'backOut' }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.72rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        background: 'rgba(124, 107, 255, 0.15)',
        border: '1px solid rgba(124, 107, 255, 0.35)',
        color: '#a78bfa',
        boxShadow: '0 0 10px rgba(124, 107, 255, 0.2)',
        cursor: 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>pg</span>
      {page}
    </motion.span>
  )
}
