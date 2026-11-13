import React, { useState } from 'react'
import { api } from '../lib/api.js'
import { Card, Chips } from '../components/ui.jsx'

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const s = tab === 'login' ? await api.login(username, password) : await api.register(username, password, displayName)
      onLogin(s)
    } catch (e2) { setErr(e2.network ? 'Geen verbinding. Probeer het zo opnieuw.' : e2.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: '3rem' }}>🎯</div>
        <h1 style={{ margin: 0 }}>Mijn Darts</h1>
        <div className="muted">Al je worpen, je eigen statistieken.</div>
      </div>
      <Chips value={tab} onChange={t => { setTab(t); setErr('') }}options={[{ value: 'login', label: 'Inloggen' }, { value: 'register', label: 'Account maken' }]} />
      <Card>
        <form onSubmit={submit} className="field" style={{ gap: 12 }}>
          <div className="field"><label>Gebruikersnaam</label>
            <input type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={2} /></div>
          {tab === 'register' && (
            <div className="field"><label>Naam in de app</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Bijv. Joey" /></div>
          )}
          <div className="field"><label>Wachtwoord{tab === 'register' ? ' (minimaal 6 tekens)' : ''}</label>
            <input type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={tab === 'register' ? 6 : 1} /></div>
          {err && <div className="err">{err}</div>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Even geduld…' : tab === 'login' ? 'Inloggen' : 'Account maken'}</button>
        </form>
      </Card>
    </div>
  )
}
