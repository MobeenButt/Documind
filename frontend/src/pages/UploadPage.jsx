import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'
import GlassCard from '../components/GlassCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import { uploadPDF } from '../services/api'

// ─── Upload States ────────────────────────────────────────────────────────────
// idle       → waiting for file
// dragging   → file hovering over dropzone
// uploading  → POST /upload/ in progress
// success    → upload done, doc_id received
// error      → something failed

export default function UploadPage() {
  const navigate = useNavigate()
  const [state, setState] = useState('idle')   // upload machine state
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploadResult, setUploadResult] = useState(null)

  // ── Dropzone Setup ──────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('Sirf PDF files allowed hain.')
      setState('error')
      return
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setState('idle')
      setError('')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,   // 50MB limit
  })

  // ── Upload Handler ──────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) return
    setState('uploading')
    setError('')

    try {
      const result = await uploadPDF(file)
      setUploadResult(result)
      setState('success')

      // After short success flash, navigate to processing page
      // Pass doc_id and filename via router state — no URL params needed
      setTimeout(() => {
        navigate('/processing', {
          state: {
            doc_id: result.doc_id,
            filename: result.filename,
            total_pages: result.total_pages,
          }
        })
      }, 1200)

    } catch (err) {
      setError(err.message || 'Upload fail ho gaya. Dobara try karo.')
      setState('error')
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function reset() {
    setFile(null)
    setState('idle')
    setError('')
    setUploadResult(null)
  }

  const isUploading = state === 'uploading'
  const isSuccess   = state === 'success'
  const isDragging  = isDragActive

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
        {/* ── Hero Text ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ textAlign: 'center', marginBottom: 48, maxWidth: 560 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 999,
              background: 'rgba(124, 107, 255, 0.12)',
              border: '1px solid rgba(124, 107, 255, 0.25)',
              marginBottom: 24,
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              color: '#a78bfa',
            }}
          >
            <Sparkles size={13} />
            RAG-powered document intelligence
          </motion.div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(2.4rem, 5vw, 3.4rem)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              marginBottom: 16,
              color: 'var(--text-primary)',
            }}
          >
            Chat with any{' '}
            <span className="gradient-text">document</span>
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.6,
            }}
          >
            Upload a PDF, ask anything in natural language.
            Get answers with exact page citations.
          </p>
        </motion.div>

        {/* ── Upload Card ────────────────────────────────────────────────── */}
        <GlassCard
          glow={isDragging || isSuccess}
          tilt={!isUploading && !isSuccess}
          style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}
        >
          {/* Dropzone area */}
          <div
            {...getRootProps()}
            style={{
              padding: '40px 32px 32px',
              cursor: isUploading || isSuccess ? 'default' : 'pointer',
              outline: 'none',
            }}
          >
            <input {...getInputProps()} />

            {/* Icon area */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 size={52} color="#34d399" strokeWidth={1.5} />
                  </motion.div>
                ) : isUploading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <LoadingSpinner variant="pulse" size={52} color="var(--accent)" />
                  </motion.div>
                ) : file ? (
                  <motion.div
                    key="file"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, rgba(124,107,255,0.2), rgba(56,189,248,0.15))',
                      border: '1px solid rgba(124,107,255,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={28} color="#a78bfa" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="upload"
                    animate={isDragging
                      ? { scale: 1.15, rotate: [0, -5, 5, 0] }
                      : { scale: [1, 1.04, 1] }
                    }
                    transition={isDragging
                      ? { duration: 0.4 }
                      : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                    }
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      background: isDragging
                        ? 'linear-gradient(135deg, rgba(124,107,255,0.3), rgba(56,189,248,0.25))'
                        : 'rgba(255,255,255,0.05)',
                      border: `2px dashed ${isDragging ? 'rgba(124,107,255,0.7)' : 'rgba(255,255,255,0.15)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <Upload
                      size={26}
                      color={isDragging ? '#a78bfa' : 'var(--text-muted)'}
                      strokeWidth={1.5}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Text content */}
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center' }}
                >
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', color: '#34d399', marginBottom: 6 }}>
                    Upload successful!
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Processing your document...
                  </p>
                </motion.div>
              ) : isUploading ? (
                <motion.div
                  key="uploading-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center' }}
                >
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                    Uploading...
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Extracting text from your PDF
                  </p>
                </motion.div>
              ) : file ? (
                <motion.div
                  key="file-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center' }}
                >
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 340,
                    margin: '0 auto 4px',
                  }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · PDF
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center' }}
                >
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    color: isDragging ? '#a78bfa' : 'var(--text-primary)',
                    marginBottom: 6,
                    transition: 'color 0.2s',
                  }}>
                    {isDragging ? 'Drop it here' : 'Drop your PDF here'}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    or click to browse · max 50MB
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Bottom Action Bar ─────────────────────────────────────────── */}
          <div
            style={{
              padding: '16px 32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '0.82rem',
                    color: '#fca5a5',
                  }}
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload / Reset button */}
            {file && !isSuccess && (
              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button
                  className="btn-glow"
                  onClick={handleUpload}
                  disabled={isUploading}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1,
                    padding: '13px 24px',
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: isUploading ? 0.7 : 1,
                  }}
                >
                  {isUploading ? (
                    <>
                      <LoadingSpinner variant="ring" size={16} color="white" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload & Analyze
                    </>
                  )}
                </motion.button>

                {!isUploading && (
                  <motion.button
                    onClick={reset}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      padding: '13px 16px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Clear
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </GlassCard>

        {/* ── Feature Pills ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 32,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {[
            { icon: '⚡', text: 'Instant answers' },
            { icon: '📄', text: 'Page citations' },
            { icon: '🔒', text: 'Stays local' },
          ].map((pill) => (
            <div
              key={pill.text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span>{pill.icon}</span>
              {pill.text}
            </div>
          ))}
        </motion.div>
      </div>
    </>
  )
}
