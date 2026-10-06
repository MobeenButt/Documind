import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, Sparkles, AlertCircle,
  CheckCircle2, Clock, Trash2, MessageSquare,
  ChevronRight, RefreshCw,
} from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'
import GlassCard from '../components/GlassCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import { uploadPDF, getDocuments, deleteDocument } from '../services/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSize(mb) {
  if (!mb) return ''
  return mb < 1 ? `${Math.round(mb * 1024)} KB` : `${mb.toFixed(1)} MB`
}

export default function UploadPage() {
  const navigate = useNavigate()

  // ── Upload state machine ──────────────────────────────────────────────────
  const [state, setState]           = useState('idle')
  const [file, setFile]             = useState(null)
  const [error, setError]           = useState('')

  // ── Document history ──────────────────────────────────────────────────────
  const [documents, setDocuments]   = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  // ── Load document history on mount ───────────────────────────────────────
  useEffect(() => { fetchDocuments() }, [])

  async function fetchDocuments() {
    setLoadingDocs(true)
    try {
      const res = await getDocuments()
      setDocuments(res.documents || [])
    } catch {
      // Silently fail — history is non-critical
    } finally {
      setLoadingDocs(false)
    }
  }

  // ── Open existing document in chat ────────────────────────────────────────
  function openDocument(doc) {
    navigate('/chat', {
      state: {
        doc_id:       doc.id,
        filename:     doc.filename,
        total_pages:  doc.total_pages,
        total_chunks: doc.total_chunks,
        doc_type:     doc.doc_type,
      }
    })
  }

  // ── Delete document ───────────────────────────────────────────────────────
  async function handleDelete(e, doc_id) {
    e.stopPropagation()
    setDeletingId(doc_id)
    try {
      await deleteDocument(doc_id)
      setDocuments(prev => prev.filter(d => d.id !== doc_id))
    } catch {
      // Show nothing — just keep the item
    } finally {
      setDeletingId(null)
    }
  }

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) { setError('Only PDF files allowed.'); return }
    if (accepted.length > 0) { setFile(accepted[0]); setError('') }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize:  50 * 1024 * 1024,
  })

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) return
    setState('uploading')
    setError('')
    try {
      const result = await uploadPDF(file)
      setState('success')
      setTimeout(() => {
        navigate('/processing', {
          state: {
            doc_id:      result.doc_id,
            filename:    result.filename,
            total_pages: result.total_pages,
          }
        })
      }, 1000)
    } catch (err) {
      setError(err.message || 'Upload failed. Try again.')
      setState('error')
    }
  }

  function reset() { setFile(null); setState('idle'); setError('') }

  const isUploading = state === 'uploading'
  const isSuccess   = state === 'success'

  return (
    <>
      <AuroraBackground />
      <Navbar />

      {/* ── Page layout: two columns ─────────────────────────────────────── */}
      <div style={{
        position:   'relative',
        zIndex:     1,
        minHeight:  '100vh',
        display:    'flex',
        paddingTop: 65,
      }}>

        {/* ══════════════════════════════════════════════════════════════════
            LEFT — Document History Sidebar
        ══════════════════════════════════════════════════════════════════ */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x:   0 }}
          transition={{ duration: 0.5 }}
          className="history-sidebar"
          style={{
            width:        300,
            flexShrink:   0,
            borderRight:  '1px solid rgba(255,255,255,0.07)',
            display:      'flex',
            flexDirection:'column',
            background:   'rgba(255,255,255,0.015)',
            backdropFilter: 'blur(12px)',
            overflowY:    'auto',
          }}
        >
          {/* Header */}
          <div style={{
            padding:      '24px 20px 16px',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize:   '0.95rem',
                color:      'var(--text-primary)',
              }}>
                Recent documents
              </p>
              <p style={{
                fontSize:   '0.72rem',
                color:      'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop:  2,
              }}>
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Refresh button */}
            <motion.button
              onClick={fetchDocuments}
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.4 }}
              style={{
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                color:      'var(--text-muted)',
                padding:    4,
                display:    'flex',
              }}
            >
              <RefreshCw size={14} />
            </motion.button>
          </div>

          {/* Document list */}
          <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>

            {loadingDocs ? (
              /* Loading shimmer */
              [...Array(3)].map((_, i) => (
                <div key={i} className="shimmer" style={{
                  height: 72, borderRadius: 12,
                }} />
              ))
            ) : documents.length === 0 ? (
              /* Empty state */
              <div style={{
                flex:          1,
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                justifyContent:'center',
                padding:       '40px 20px',
                textAlign:     'center',
                color:         'var(--text-muted)',
              }}>
                <FileText size={32} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                  No documents yet.<br />Upload your first PDF.
                </p>
              </div>
            ) : (
              /* Document cards */
              <AnimatePresence>
                {documents.map((doc, i) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => openDocument(doc)}
                    style={{
                      padding:      '12px 14px',
                      borderRadius: 12,
                      background:   'rgba(255,255,255,0.03)',
                      border:       '1px solid rgba(255,255,255,0.07)',
                      cursor:       'pointer',
                      display:      'flex',
                      alignItems:   'center',
                      gap:          12,
                      transition:   'background 0.2s, border-color 0.2s',
                      position:     'relative',
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background    = 'rgba(124,107,255,0.07)'
                      e.currentTarget.style.borderColor   = 'rgba(124,107,255,0.2)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background    = 'rgba(255,255,255,0.03)'
                      e.currentTarget.style.borderColor   = 'rgba(255,255,255,0.07)'
                    }}
                  >
                    {/* File icon */}
                    <div style={{
                      width:          34, height: 34,
                      borderRadius:   9, flexShrink: 0,
                      background:     'linear-gradient(135deg, rgba(124,107,255,0.2), rgba(56,189,248,0.15))',
                      border:         '1px solid rgba(124,107,255,0.2)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                    }}>
                      <FileText size={15} color="#a78bfa" strokeWidth={1.5} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize:     '0.82rem',
                        fontFamily:   'var(--font-display)',
                        fontWeight:   600,
                        color:        'var(--text-primary)',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                        marginBottom: 3,
                      }}>
                        {doc.filename}
                      </p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {doc.total_pages}p
                        </span>
                        {doc.doc_type && (
                          <span style={{
                            fontSize:     '0.62rem',
                            fontFamily:   'var(--font-mono)',
                            color:        '#a78bfa',
                            background:   'rgba(124,107,255,0.1)',
                            padding:      '1px 6px',
                            borderRadius: 4,
                            textTransform:'capitalize',
                          }}>
                            {doc.doc_type}
                          </span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {formatDate(doc.uploaded_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {/* Open chat */}
                      <div style={{
                        width:          26, height: 26,
                        borderRadius:   7,
                        background:     'rgba(56,189,248,0.1)',
                        border:         '1px solid rgba(56,189,248,0.2)',
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                      }}>
                        <MessageSquare size={12} color="#38bdf8" />
                      </div>

                      {/* Delete */}
                      <motion.div
                        onClick={e => handleDelete(e, doc.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        style={{
                          width:          26, height: 26,
                          borderRadius:   7,
                          background:     'rgba(239,68,68,0.08)',
                          border:         '1px solid rgba(239,68,68,0.15)',
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          cursor:         'pointer',
                        }}
                      >
                        {deletingId === doc.id
                          ? <LoadingSpinner variant="ring" size={10} color="#f87171" />
                          : <Trash2 size={11} color="#f87171" />
                        }
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.aside>

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT — Upload area
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '40px 32px',
          minWidth:       0,
        }}>

          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: 40, maxWidth: 500 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          8,
                padding:      '6px 16px',
                borderRadius: 999,
                background:   'rgba(124,107,255,0.12)',
                border:       '1px solid rgba(124,107,255,0.25)',
                marginBottom: 20,
                fontSize:     '0.8rem',
                fontFamily:   'var(--font-mono)',
                color:        '#a78bfa',
              }}
            >
              <Sparkles size={13} />
              RAG-powered document intelligence
            </motion.div>

            <h1 style={{
              fontFamily:    'var(--font-display)',
              fontWeight:    700,
              fontSize:      'clamp(2rem, 4vw, 3rem)',
              letterSpacing: '-0.03em',
              lineHeight:    1.1,
              marginBottom:  14,
              color:         'var(--text-primary)',
            }}>
              Chat with any{' '}
              <span className="gradient-text">document</span>
            </h1>

            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Upload a PDF and ask anything in natural language.
              Get answers with exact page citations.
            </p>
          </motion.div>

          {/* Upload card */}
          <GlassCard
            glow={isDragActive || isSuccess}
            tilt={!isUploading && !isSuccess}
            style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden' }}
          >
            {/* Dropzone */}
            <div
              {...getRootProps()}
              style={{
                padding: '36px 28px 28px',
                cursor:  isUploading || isSuccess ? 'default' : 'pointer',
                outline: 'none',
              }}
            >
              <input {...getInputProps()} />

              {/* Icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <AnimatePresence mode="wait">
                  {isSuccess ? (
                    <motion.div key="ok"
                      initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                      <CheckCircle2 size={48} color="#34d399" strokeWidth={1.5} />
                    </motion.div>
                  ) : isUploading ? (
                    <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <LoadingSpinner variant="pulse" size={48} color="var(--accent)" />
                    </motion.div>
                  ) : file ? (
                    <motion.div key="file"
                      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      style={{
                        width: 60, height: 60, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(124,107,255,0.2), rgba(56,189,248,0.15))',
                        border: '1px solid rgba(124,107,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <FileText size={26} color="#a78bfa" strokeWidth={1.5} />
                    </motion.div>
                  ) : (
                    <motion.div key="idle"
                      animate={isDragActive
                        ? { scale: 1.15 }
                        : { scale: [1, 1.04, 1] }}
                      transition={isDragActive
                        ? { duration: 0.3 }
                        : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: 60, height: 60, borderRadius: 18,
                        background:  isDragActive ? 'linear-gradient(135deg, rgba(124,107,255,0.3), rgba(56,189,248,0.25))' : 'rgba(255,255,255,0.05)',
                        border: `2px dashed ${isDragActive ? 'rgba(124,107,255,0.7)' : 'rgba(255,255,255,0.15)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s ease',
                      }}>
                      <Upload size={24} color={isDragActive ? '#a78bfa' : 'var(--text-muted)'} strokeWidth={1.5} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Text */}
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div key="ok-t" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: '#34d399', marginBottom: 4 }}>Upload successful!</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Redirecting to processing...</p>
                  </motion.div>
                ) : isUploading ? (
                  <motion.div key="upl-t" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 4 }}>Uploading...</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Extracting text from PDF</p>
                  </motion.div>
                ) : file ? (
                  <motion.div key="file-t" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320, margin: '0 auto 3px' }}>{file.name}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB · PDF</p>
                  </motion.div>
                ) : (
                  <motion.div key="idle-t" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: isDragActive ? '#a78bfa' : 'var(--text-primary)', marginBottom: 5 }}>
                      {isDragActive ? 'Drop it here' : 'Drop your PDF here'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>or click to browse · max 50MB</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action bar */}
            <div style={{ padding: '12px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.8rem', color: '#fca5a5' }}
                  >
                    <AlertCircle size={13} />{error}
                  </motion.div>
                )}
              </AnimatePresence>

              {file && !isSuccess && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button
                    className="btn-glow"
                    onClick={handleUpload}
                    disabled={isUploading}
                    whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, padding: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: isUploading ? 0.7 : 1 }}
                  >
                    {isUploading
                      ? <><LoadingSpinner variant="ring" size={15} color="white" />Uploading...</>
                      : <><Upload size={15} />Upload & Analyze</>}
                  </motion.button>
                  {!isUploading && (
                    <motion.button onClick={reset} whileTap={{ scale: 0.97 }}
                      style={{ padding: '12px 14px', borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}>
                      Clear
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {[
              { icon: '⚡', text: 'Instant answers' },
              { icon: '📄', text: 'Page citations' },
              { icon: '☁️', text: 'Cloud storage' },
            ].map(p => (
              <div key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>{p.icon}</span>{p.text}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Responsive — hide history sidebar on mobile */}
      <style>{`
        @media (max-width: 700px) {
          .history-sidebar { display: none !important; }
        }
      `}</style>
    </>
  )
}
