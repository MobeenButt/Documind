import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, FileText, ChevronLeft, Sparkles, User, Copy, Check } from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'
import LoadingSpinner from '../components/LoadingSpinner'
import CitationBadge from '../components/CitationBadge'
import Navbar from '../components/Navbar'
import { sendMessage } from '../services/api'

// ─── Message shape ────────────────────────────────────────────────────────────
// { id, role: 'user'|'assistant', content, citations: [], chunks_used, isLoading }

export default function ChatPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const { doc_id, filename, total_pages, doc_type, total_chunks } =
    location.state || {}

  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [copiedId, setCopiedId]   = useState(null)

  const bottomRef   = useRef(null)   // auto-scroll anchor
  const inputRef    = useRef(null)   // focus input on mount
  const messagesRef = useRef(null)   // scroll container

  // ── Guard ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!doc_id) navigate('/', { replace: true })
  }, [doc_id, navigate])

  // ── Auto-focus input on mount ───────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Auto-scroll to bottom on new messages ──────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const question = input.trim()
    if (!question || isThinking) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: question,
      citations: [],
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    try {
      const result = await sendMessage(doc_id, question)

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.answer,
        citations: result.citations || [],
        chunks_used: result.chunks_used,
        model: result.model,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          citations: [],
          isError: true,
        },
      ])
    } finally {
      setIsThinking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, isThinking, doc_id])

  // ── Enter key to send ───────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Copy answer text ────────────────────────────────────────────────────────
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
        position: 'relative',
        zIndex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 65,          // navbar height
      }}>

        {/* ── Main split layout ─────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          gap: 0,
        }}>

          {/* ════════════════════════════════════════════════════════════════
              LEFT PANEL — Document info sidebar
          ════════════════════════════════════════════════════════════════ */}
          <motion.aside
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              width: 280,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.07)',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.015)',
              backdropFilter: 'blur(12px)',
              // Hide on small screens via inline media (handled by JS below)
            }}
            className="sidebar"
          >
            {/* Back button */}
            <motion.button
              onClick={() => navigate('/')}
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-body)',
                padding: 0,
              }}
            >
              <ChevronLeft size={15} />
              New document
            </motion.button>

            {/* Document card */}
            <div style={{
              padding: '16px',
              borderRadius: 14,
              background: 'rgba(124,107,255,0.08)',
              border: '1px solid rgba(124,107,255,0.18)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, marginBottom: 12,
                background: 'linear-gradient(135deg, rgba(124,107,255,0.3), rgba(56,189,248,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={18} color="#a78bfa" strokeWidth={1.5} />
              </div>

              <p style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                marginBottom: 8,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
              }}>
                {filename}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Pages',   value: total_pages },
                  { label: 'Chunks',  value: total_chunks },
                  { label: 'Type',    value: doc_type || 'document', style: { textTransform: 'capitalize' } },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      ...(row.style || {}),
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested questions */}
            <div>
              <p style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 10,
              }}>
                Try asking
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'What is the main topic?',
                  'Summarize this document',
                  'What are the key points?',
                ].map((q) => (
                  <motion.button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      transition: 'background 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                    }}
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Bottom spacer */}
            <div style={{ flex: 1 }} />

            {/* Model badge */}
            <div style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Sparkles size={11} color="var(--accent)" />
              Powered by Groq LLM
            </div>
          </motion.aside>

          {/* ════════════════════════════════════════════════════════════════
              RIGHT PANEL — Chat area
          ════════════════════════════════════════════════════════════════ */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}>

            {/* Messages scroll area */}
            <div
              ref={messagesRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '28px 28px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* Empty state */}
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: 64, height: 64, borderRadius: 20, marginBottom: 20,
                      background: 'rgba(124,107,255,0.1)',
                      border: '1px solid rgba(124,107,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={28} color="#a78bfa" strokeWidth={1.5} />
                  </motion.div>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}>
                    Ask anything about this document
                  </p>
                  <p style={{ fontSize: '0.85rem', maxWidth: 320, lineHeight: 1.5 }}>
                    I have read the entire document and can answer questions
                    with exact page references.
                  </p>
                </motion.div>
              )}

              {/* Message bubbles */}
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    copied={copiedId === msg.id}
                    onCopy={() => handleCopy(msg.id, msg.content)}
                  />
                ))}
              </AnimatePresence>

              {/* Thinking indicator */}
              <AnimatePresence>
                {isThinking && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(124,107,255,0.25), rgba(56,189,248,0.2))',
                      border: '1px solid rgba(124,107,255,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sparkles size={14} color="#a78bfa" />
                    </div>
                    <div style={{
                      padding: '14px 18px',
                      borderRadius: '4px 16px 16px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <LoadingSpinner variant="dots" size={20} color="var(--accent)" />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Searching document...
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ──────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                padding: '16px 24px 20px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(6,6,15,0.6)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
                maxWidth: 860,
                margin: '0 auto',
              }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 10,
                }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(124,107,255,0.45)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about this document..."
                    rows={1}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.92rem',
                      lineHeight: 1.5,
                      resize: 'none',
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                    onInput={e => {
                      // Auto-grow textarea
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                  />
                </div>

                {/* Send button */}
                <motion.button
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                  whileHover={input.trim() && !isThinking ? { scale: 1.05 } : {}}
                  whileTap={input.trim() && !isThinking ? { scale: 0.95 } : {}}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 13,
                    background: input.trim() && !isThinking
                      ? 'linear-gradient(135deg, var(--accent), #5b4fcf)'
                      : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: input.trim() && !isThinking ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                    boxShadow: input.trim() && !isThinking
                      ? '0 4px 20px var(--accent-glow)'
                      : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isThinking
                    ? <LoadingSpinner variant="ring" size={18} color="var(--accent)" />
                    : <Send size={17} color={input.trim() ? 'white' : 'var(--text-muted)'} strokeWidth={2} />
                  }
                </motion.button>
              </div>

              {/* Hint */}
              <p style={{
                textAlign: 'center',
                marginTop: 8,
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                Enter to send · Shift+Enter for new line
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Responsive sidebar hide on mobile */}
      <style>{`
        @media (max-width: 640px) {
          .sidebar { display: none !important; }
        }
      `}</style>
    </>
  )
}

// ─── MessageBubble sub-component ─────────────────────────────────────────────
function MessageBubble({ msg, copied, onCopy }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        flexShrink: 0,
        background: isUser
          ? 'rgba(56,189,248,0.15)'
          : 'linear-gradient(135deg, rgba(124,107,255,0.25), rgba(56,189,248,0.2))',
        border: `1px solid ${isUser ? 'rgba(56,189,248,0.25)' : 'rgba(124,107,255,0.25)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isUser
          ? <User size={14} color="#38bdf8" strokeWidth={2} />
          : <Sparkles size={14} color="#a78bfa" strokeWidth={1.5} />
        }
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: 'min(680px, 78%)', minWidth: 0 }}>
        <div style={{
          padding: '13px 17px',
          borderRadius: isUser
            ? '16px 4px 16px 16px'
            : '4px 16px 16px 16px',
          background: isUser
            ? 'rgba(56,189,248,0.08)'
            : msg.isError
              ? 'rgba(239,68,68,0.07)'
              : 'rgba(255,255,255,0.04)',
          border: `1px solid ${
            isUser
              ? 'rgba(56,189,248,0.18)'
              : msg.isError
                ? 'rgba(239,68,68,0.2)'
                : 'rgba(255,255,255,0.08)'
          }`,
          position: 'relative',
        }}>
          {/* Copy button — only on assistant messages */}
          {!isUser && !msg.isError && (
            <motion.button
              onClick={onCopy}
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {copied
                ? <><Check size={11} color="#34d399" /> Copied</>
                : <><Copy size={11} /> Copy</>
              }
            </motion.button>
          )}

          {/* Message text */}
          <p style={{
            fontSize: '0.9rem',
            color: msg.isError ? '#fca5a5' : 'var(--text-primary)',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            paddingRight: !isUser ? 60 : 0,   // space for copy button
          }}>
            {msg.content}
          </p>
        </div>

        {/* Citations row */}
        {!isUser && msg.citations?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
              paddingLeft: 4,
            }}
          >
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              alignSelf: 'center',
            }}>
              sources:
            </span>
            {msg.citations.map((page, i) => (
              <CitationBadge key={page} page={page} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
