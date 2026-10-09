import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, FileText, ChevronLeft, Sparkles,
  User, Copy, Check, Clock, AlertTriangle,
} from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'
import LoadingSpinner from '../components/LoadingSpinner'
import CitationBadge from '../components/CitationBadge'
import Navbar from '../components/Navbar'
import { sendMessage, getChatHistory, checkIngestStatus } from '../services/api'

export default function ChatPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const { doc_id, filename, total_pages, doc_type, total_chunks } =
    location.state || {}

  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [isThinking, setIsThinking]   = useState(false)
  const [copiedId, setCopiedId]       = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError]     = useState(false)
  const [notIngested, setNotIngested]       = useState(false)

  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)

  // ── Guard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!doc_id) navigate('/', { replace: true })
  }, [doc_id, navigate])

  // ── Load chat history from Supabase on mount ──────────────────────────────
  useEffect(() => {
    if (!doc_id) return

    async function loadHistory() {
      setLoadingHistory(true)
      try {
        // Check if document is ingested in pgvector
        const status = await checkIngestStatus(doc_id)
        if (!status.ingested_in_pgvector) {
          setNotIngested(true)
          setLoadingHistory(false)
          return
        }

        const res = await getChatHistory(doc_id)
        // Map Supabase rows to local message shape
        const loaded = (res.messages || []).map(row => ({
          id:        row.id,
          role:      row.role,
          content:   row.content,
          citations: row.citations || [],
          fromDB:    true,   // mark so we know it's historical
        }))
        setMessages(loaded)
      } catch {
        setHistoryError(true)
      } finally {
        setLoadingHistory(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }

    loadHistory()
  }, [doc_id])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const question = input.trim()
    if (!question || isThinking) return

    const userMsg = {
      id:        Date.now(),
      role:      'user',
      content:   question,
      citations: [],
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    try {
      const result = await sendMessage(doc_id, question)
      setMessages(prev => [...prev, {
        id:         Date.now() + 1,
        role:       'assistant',
        content:    result.answer,
        citations:  result.citations || [],
        chunks_used: result.chunks_used,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id:        Date.now() + 1,
        role:      'assistant',
        content:   err.message || 'Something went wrong. Please try again.',
        citations: [],
        isError:   true,
      }])
    } finally {
      setIsThinking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, isThinking, doc_id])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleCopy(id, text) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!doc_id) return null

  return (
    <>
      <AuroraBackground />
      <Navbar />

      <div style={{
        position: 'relative', zIndex: 1,
        height: '100vh', display: 'flex', flexDirection: 'column',
        paddingTop: 65,
      }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ══════════════════════════════════════════════════════════════
              LEFT SIDEBAR
          ══════════════════════════════════════════════════════════════ */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x:  0 }}
            transition={{ duration: 0.5 }}
            className="sidebar"
            style={{
              width: 270, flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.07)',
              padding: '20px 16px',
              display: 'flex', flexDirection: 'column', gap: 16,
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.015)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Back */}
            <motion.button
              onClick={() => navigate('/')}
              whileHover={{ x: -3 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)', padding: 0 }}
            >
              <ChevronLeft size={14} /> All documents
            </motion.button>

            {/* Document info card */}
            <div style={{ padding: '14px', borderRadius: 13, background: 'rgba(124,107,255,0.08)', border: '1px solid rgba(124,107,255,0.18)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, marginBottom: 10, background: 'linear-gradient(135deg,rgba(124,107,255,0.3),rgba(56,189,248,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={16} color="#a78bfa" strokeWidth={1.5} />
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
                {filename}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: 'Pages',   value: total_pages },
                  { label: 'Chunks',  value: total_chunks },
                  { label: 'Type',    value: doc_type || 'document', capitalize: true },
                  { label: 'History', value: `${messages.length} msgs` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{row.label}</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: row.capitalize ? 'capitalize' : 'none' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* History indicator */}
            {!loadingHistory && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}
              >
                <Clock size={12} />
                Previous conversation loaded
              </motion.div>
            )}

            {/* Suggested questions */}
            <div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Try asking
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {['What is the main topic?', 'Summarize this document', 'What are the key points?'].map(q => (
                  <motion.button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
                    style={{ textAlign: 'left', padding: '8px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-secondary)', fontSize: '0.78rem', fontFamily: 'var(--font-body)', cursor: 'pointer', lineHeight: 1.4 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            {/* Model badge */}
            <div style={{ padding: '7px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={10} color="var(--accent)" />
              Powered by Groq LLM · Supabase
            </div>
          </motion.aside>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT — Chat area
          ══════════════════════════════════════════════════════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Not ingested warning */}
              {notIngested && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', textAlign: 'center', padding: '60px 24px', flex: 1,
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, marginBottom: 18,
                    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AlertTriangle size={24} color="#fbbf24" strokeWidth={1.5} />
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 8,
                  }}>
                    Document not processed yet
                  </p>
                  <p style={{
                    fontSize: '0.83rem', color: 'var(--text-secondary)',
                    lineHeight: 1.6, maxWidth: 320, marginBottom: 20,
                  }}>
                    This document exists in history but hasn't been ingested into the vector database.
                    You need to re-upload and process it before chatting.
                  </p>
                  <button
                    onClick={() => navigate('/')}
                    style={{
                      padding: '11px 24px', borderRadius: 12,
                      background: 'linear-gradient(135deg, var(--accent), #5b4fcf)',
                      border: 'none', color: 'white',
                      fontFamily: 'var(--font-display)', fontWeight: 600,
                      fontSize: '0.88rem', cursor: 'pointer',
                    }}
                  >
                    Upload again
                  </button>
                </motion.div>
              )}

              {/* History loading */}
              {loadingHistory && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <LoadingSpinner variant="ring" size={28} color="var(--accent)" />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Loading conversation history...
                    </p>
                  </div>
                </div>
              )}

              {/* Empty state — no messages, not loading */}
              {!loadingHistory && messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px' }}
                >
                  <motion.div
                    style={{ width: 60, height: 60, borderRadius: 18, marginBottom: 18, background: 'rgba(124,107,255,0.1)', border: '1px solid rgba(124,107,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Sparkles size={26} color="#a78bfa" strokeWidth={1.5} />
                  </motion.div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Ask anything about this document
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.5 }}>
                    Answers come with exact page citations from your PDF.
                  </p>
                </motion.div>
              )}

              {/* Messages */}
              {!loadingHistory && (
                <AnimatePresence initial={false}>
                  {messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      copied={copiedId === msg.id}
                      onCopy={() => handleCopy(msg.id, msg.content)}
                    />
                  ))}
                </AnimatePresence>
              )}

              {/* Thinking */}
              <AnimatePresence>
                {isThinking && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'linear-gradient(135deg,rgba(124,107,255,0.25),rgba(56,189,248,0.2))', border: '1px solid rgba(124,107,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={13} color="#a78bfa" />
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LoadingSpinner variant="dots" size={18} color="var(--accent)" />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Searching document...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,6,15,0.6)', backdropFilter: 'blur(20px)' }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 860, margin: '0 auto' }}>
                <div
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 13, padding: '11px 14px', transition: 'border-color 0.2s', display: 'flex', alignItems: 'flex-end' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(124,107,255,0.45)'}
                  onBlur={e => e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.1)'}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={notIngested ? "Document not processed — upload again" : "Ask anything about this document..."}
                    rows={1}
                    disabled={notIngested}
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.5, resize: 'none', maxHeight: 120, overflowY: 'auto' }}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                  />
                </div>

                <motion.button
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  whileHover={input.trim() && !isThinking ? { scale: 1.05 } : {}}
                  whileTap={input.trim()   && !isThinking ? { scale: 0.95 } : {}}
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: input.trim() && !isThinking ? 'linear-gradient(135deg, var(--accent), #5b4fcf)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() && !isThinking ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                    boxShadow: input.trim() && !isThinking ? '0 4px 18px var(--accent-glow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {isThinking
                    ? <LoadingSpinner variant="ring" size={16} color="var(--accent)" />
                    : <Send size={16} color={input.trim() ? 'white' : 'var(--text-muted)'} strokeWidth={2} />
                  }
                </motion.button>
              </div>

              <p style={{ textAlign: 'center', marginTop: 6, fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) { .sidebar { display: none !important; } }
      `}</style>
    </>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, copied, onCopy }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y:  0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}
    >
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: isUser ? 'rgba(56,189,248,0.15)' : 'linear-gradient(135deg,rgba(124,107,255,0.25),rgba(56,189,248,0.2))',
        border: `1px solid ${isUser ? 'rgba(56,189,248,0.25)' : 'rgba(124,107,255,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={13} color="#38bdf8" strokeWidth={2} />
          : <Sparkles size={13} color="#a78bfa" strokeWidth={1.5} />
        }
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: 'min(680px, 78%)', minWidth: 0 }}>
        <div style={{
          padding: '12px 15px',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          background: isUser ? 'rgba(56,189,248,0.08)' : msg.isError ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isUser ? 'rgba(56,189,248,0.18)' : msg.isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
          position: 'relative',
          opacity: msg.fromDB ? 0.85 : 1,   // slightly dim historical messages
        }}>
          {/* Copy button */}
          {!isUser && !msg.isError && (
            <motion.button
              onClick={onCopy}
              initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
              style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {copied ? <><Check size={10} color="#34d399" />Copied</> : <><Copy size={10} />Copy</>}
            </motion.button>
          )}

          {/* Historical badge */}
          {msg.fromDB && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              <Clock size={9} /> previous
            </span>
          )}

          <p style={{ fontSize: '0.88rem', color: msg.isError ? '#fca5a5' : 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingRight: !isUser ? 56 : 0 }}>
            {msg.content}
          </p>
        </div>

        {/* Citations */}
        {!isUser && msg.citations?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, paddingLeft: 3 }}
          >
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>sources:</span>
            {msg.citations.map((page, i) => (
              <CitationBadge key={page} page={page} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
