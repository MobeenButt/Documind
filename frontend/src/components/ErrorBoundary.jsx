import { Component } from 'react'

// ErrorBoundary — catches any unhandled React errors
// Without this, a JS error anywhere crashes the whole app to a blank white screen.
// With this, user sees a clean error card with a "Try again" button.
//
// Must be a class component — React has no hook equivalent for componentDidCatch yet.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  // Called when a child component throws — update state to show fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  // Called after error is caught — good place to log to a service
  componentDidCatch(error, info) {
    console.error('DocuMind caught an error:', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={{
        position:       'fixed',
        inset:          0,
        background:     '#06060f',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
        zIndex:         9999,
      }}>
        <div style={{
          maxWidth:     480,
          width:        '100%',
          padding:      '36px 32px',
          borderRadius: 20,
          background:   'rgba(255,255,255,0.04)',
          border:       '1px solid rgba(239,68,68,0.25)',
          textAlign:    'center',
        }}>
          {/* Icon */}
          <div style={{
            width:          56, height: 56,
            borderRadius:   16,
            background:     'rgba(239,68,68,0.1)',
            border:         '1px solid rgba(239,68,68,0.25)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            margin:         '0 auto 20px',
            fontSize:       24,
          }}>
            ⚠
          </div>

          <h2 style={{
            fontFamily:   "'Clash Display', sans-serif",
            fontWeight:   700,
            fontSize:     '1.3rem',
            color:        '#f0f0ff',
            marginBottom: 10,
          }}>
            Something went wrong
          </h2>

          <p style={{
            fontSize:     '0.85rem',
            color:        'rgba(240,240,255,0.5)',
            lineHeight:   1.6,
            marginBottom: 24,
            fontFamily:   "'Cabinet Grotesk', sans-serif",
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>

          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.href = '/'
            }}
            style={{
              padding:      '12px 28px',
              borderRadius: 12,
              background:   'linear-gradient(135deg, #7c6bff, #5b4fcf)',
              border:       'none',
              color:        'white',
              fontFamily:   "'Clash Display', sans-serif",
              fontWeight:   600,
              fontSize:     '0.9rem',
              cursor:       'pointer',
            }}
          >
            Go back to home
          </button>
        </div>
      </div>
    )
  }
}
