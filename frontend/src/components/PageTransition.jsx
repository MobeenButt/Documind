import { motion } from 'framer-motion'

// PageTransition — wraps each page route for smooth enter/exit
// Used in App.jsx around each <Route> element

export default function PageTransition({ children }) {
  return (
    <motion.div
      className="page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}
