import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Nieuwe versie online? Dan direct overschakelen (en elk uur even controleren).
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000) },
  })
}

// Vangt onverwachte fouten op: liever een duidelijke melding dan een wit scherm.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[dartapp]', error, info?.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🎯</div>
        <h1 style={{ margin: 0 }}>Er ging iets mis</h1>
        <div className="muted">Je spellen staan veilig op dit toestel. Herlaad de app om verder te gaan.</div>
        <div className="err small" style={{ textAlign: 'left' }}>{String(this.state.error?.message || this.state.error)}</div>
        <button className="btn primary block" onClick={() => location.reload()}>Opnieuw laden</button>
        <button className="btn ghost block" onClick={() => { location.hash = '#/'; location.reload() }}>Naar het begin</button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
