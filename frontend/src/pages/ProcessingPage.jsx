import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Brain, Database, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'
import GlassCard from '../components/GlassCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import { ingestDocument } from '../services/api'

// ─── Processing Steps ─────────────────────────────────────────────────────────
// Each step represents a real backend operation.
// They animate in sequence — gives user a sense of progress
// even though the actual call is one POST /ingest/ request.

const STEPS = [
  {
    id: 'extract',
    icon: FileText,
    label: 'Reading document',
    detail: 'Extracting text from all pages',
    color: '#38bdf8',
  },
  {
    id: 'chunk',
    icon: Brain,
    label: 'Analyzing structure',
    detail: 'Detecting document type · chunking content',
    color: '#a78bfa',
  },
  {
    id: 'embed',
    icon: Sparkles,
    label: 'Generating embeddings',
    detail: 'Converting text to semantic vectors',
    color: '#f472b6',
  },
  {
    id: 'store',
    icon: Database,
    label: 'Storing in vector DB',
    detail: 'Indexing chunks in ChromaDB',
    color: '#34d399',
  },
]

export default function ProcessingPage() {
  const location  = useLocation()
  const navigate  = useNavigate()

  // Data passed from UploadPage via router state
  const { doc_id, filename, total_pages } = location.state || {}

  const [activeStep, setActiveStep]   = useState(0)   // which step is animating
  const [status, setStatus]           = useState('processing')  // processing | success | error
  const [error, setError]             = useState('')
  const [ingestResult, setIngestResult] = useState(null)

  // ── Guard: if navigated here directly without state, go back ───────────────
  useEffect(() => {
    if (!doc_id) {
      navigate('/', { replace: true })
    }
  }, [doc_id, navigate])

  // ── Main Effect: Run ingest + animate steps in parallel ───────────────────
  useEffect(() => {
    if (!doc_id) return

    // Step animation runs on a timer — purely visual, independent of API
    // Each step shows for ~1.8s, giving a sense of progress
    const stepTimers = STEPS.map((_, i) =>
      setTimeout(() => setActiveStep(i), i * 1800)
    )

    // Actual API call — POST /ingest/{doc_id}
    ingestDocument(doc_id)
      .then((result) => {
        setIngestResult(result)
        setActiveStep(STEPS.length)  // all steps done
        setStatus('success')

        // Navigate to chat after brief success display
        setTimeout(() => {
          navigate('/chat', {
            state: {
              doc_id,
              filename,
              total_pages,
              doc_type: result.doc_type_detected,
              total_chunks: result.total_chunks,
            }
          })
        }, 1800)
      })
      .catch((err) => {
        setError(err.message || 'Processing failed. Please try again.')
        setStatus('error')
      })

    return () => stepTimers.forEach(clearTimeout)
  }, [doc_id])

  if (!doc_id) return null

  const isSuccess = status === 'success'
  const isError   = status === 'error'

  return (
    <>
      <AuroraBackground />
      <Navbar />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '100px 24px 40px',
        }}
      >
        <GlassCard
          tilt={false}
          style={{ width: '100%', maxWidth: 500, padding: '40px 36px' }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {/* Central pulse animation */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  >
                    <CheckCircle2 size={56} color="#34d399" strokeWidth={1.5} />
                  </motion.div>
                ) : isError ? (
                  <motion.div
                    key="err"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <AlertCircle size={56} color="#f87171" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <motion.div key="pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <LoadingSpinner variant="pulse" size={56} color="var(--accent)" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: '#34d399',
                    marginBottom: 6,
                  }}>
                    Ready to chat!
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {ingestResult?.total_chunks} chunks indexed ·{' '}
                    <span style={{ textTransform: 'capitalize' }}>
                      {ingestResult?.doc_type_detected}
                    </span>{' '}
                    document detected
                  </p>
                </motion.div>
              ) : isError ? (
                <motion.div
                  key="error-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color: '#f87171',
                    marginBottom: 6,
                  }}>
                    Processing failed
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {error}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="processing-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}>
                    Processing document
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    This takes 10–30 seconds for most PDFs
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── File Info Pill ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 28,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(124,107,255,0.25), rgba(56,189,248,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FileText size={15} color="#a78bfa" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '0.85rem',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {filename}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {total_pages} pages
              </p>
            </div>
          </motion.div>

          {/* ── Steps List ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEPS.map((step, i) => {
              const Icon       = step.icon
              const isDone     = activeStep > i || isSuccess
              const isActive   = activeStep === i && !isSuccess && !isError
              const isPending  = activeStep < i && !isSuccess

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: isActive
                      ? `rgba(${step.color === '#38bdf8' ? '56,189,248' : step.color === '#a78bfa' ? '167,139,250' : step.color === '#f472b6' ? '244,114,182' : '52,211,153'}, 0.08)`
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive
                      ? `${step.color}30`
                      : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.4s ease',
                  }}
                >
                  {/* Step icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: isDone
                      ? 'rgba(52, 211, 153, 0.12)'
                      : isActive
                        ? `${step.color}18`
                        : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isDone ? 'rgba(52,211,153,0.3)' : isActive ? `${step.color}40` : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s ease',
                  }}>
                    {isDone
                      ? <CheckCircle2 size={15} color="#34d399" strokeWidth={2} />
                      : isActive
                        ? <LoadingSpinner variant="ring" size={15} color={step.color} />
                        : <Icon size={15} color="var(--text-muted)" strokeWidth={1.5} />
                    }
                  </div>

                  {/* Step text */}
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-display)',
                      fontWeight: isActive ? 600 : 500,
                      color: isDone ? '#34d399' : isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      transition: 'color 0.3s',
                      marginBottom: 1,
                    }}>
                      {step.label}
                    </p>
                    <p style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {step.detail}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* ── Error retry button ──────────────────────────────────────── */}
          {isError && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('/')}
              className="btn-glow"
              style={{
                width: '100%',
                padding: '13px',
                marginTop: 24,
                fontSize: '0.9rem',
              }}
            >
              Try again
            </motion.button>
          )}
        </GlassCard>
      </div>
    </>
  )
}
