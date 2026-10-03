import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'

// GlassCard — frosted glass card with subtle 3D tilt on hover
//
// Props:
//   children   — content inside
//   className  — extra classes
//   glow       — show accent glow ring (bool)
//   tilt       — enable 3D mouse-tilt effect (bool, default true)
//   onClick    — click handler
//   style      — inline styles

export default function GlassCard({
  children,
  className = '',
  glow = false,
  tilt = true,
  onClick,
  style = {},
}) {
  const ref = useRef(null)

  // Mouse position as motion values — raw values, 0 to 1
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  // Spring smoothing — makes tilt feel physical, not snappy
  // stiffness + damping control how "heavy" the card feels
  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 })

  // Map 0→1 mouse position to -8→+8 degree rotation
  // rotateY tilts left/right, rotateX tilts up/down
  const rotateY = useTransform(springX, [0, 1], [-8, 8])
  const rotateX = useTransform(springY, [0, 1], [8, -8])

  // Subtle scale on hover — card "lifts" slightly
  const scale = useSpring(1, { stiffness: 200, damping: 20 })

  function handleMouseMove(e) {
    if (!tilt || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    // Normalize mouse position within card bounds to 0–1
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top)  / rect.height)
  }

  function handleMouseEnter() {
    if (tilt) scale.set(1.02)
  }

  function handleMouseLeave() {
    // Reset to center when mouse leaves
    mouseX.set(0.5)
    mouseY.set(0.5)
    scale.set(1)
  }

  return (
    <motion.div
      ref={ref}
      className={`glass ${glow ? 'glow-accent' : ''} ${className}`}
      style={{
        rotateX: tilt ? rotateX : 0,
        rotateY: tilt ? rotateY : 0,
        scale,
        transformStyle: 'preserve-3d',   // enables true 3D child stacking
        transformOrigin: 'center center',
        willChange: 'transform',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      // Entrance animation — card fades + rises when first mounted
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}
