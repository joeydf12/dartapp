import React, { useEffect, useMemo, useState } from 'react'
import { loadActive, outboxCount, flush, loadPrefs, saveActive } from '../lib/store.js'
import { replayGame, KINDS, newGame } from '../lib/model.js'
import { useData } from '../lib/data.js'
import { profileSummary, fmt, fmtPct } from '../lib/statsAgg.js'
import { Screen, Card, go, dateNl } from '../components/ui.jsx'
import { LineChart } from '../components/charts.jsx'

const resultTag = g => (!g.finishedAt ? <span className="tag">bezig</span> : g.result === 'won' ? <span className="tag won">W</span> : g.result === 'lost' ? <span className="tag lost">V</span> : <span className="tag">✓</span>)

export default function Home({ user }) {
  const [active] = useState(loadActive)
  const [pending, setPending] = useState(outboxCount())
  const { data } = useData()
  useEffect(() => {
    const on = () => setPending(outboxCount())
    window.addEventListener('dartapp:outbox', on)
    flush()
    return () => window.removeEventListener('dartapp:outbox', on)
  }, [])

  const prof = useMemo(() => (data?.games?.length ? profileSummary(data) : null), [data])
  const recent = useMemo(() => (data?.games || []).slice(-3).reverse(), [data])

  let activeInfo = null, finished = false
  if (active) {
    try {
      const v = replayGame(active)
      finished = v.finished
      activeInfo = `${KINDS[active.kind]?.short || active.kind}${active.opponentName ? ` · vs ${active.opponentName}` : ''} · ${v.turns.length} beurten`
    } catch { activeInfo = 'Lopend spel' }
  }

  const p = loadPrefs()
  const quickStart = (kind, mode) => {
    const cfg = kind === 'x01'
      ? { startScore: p.startScore, legs: p.legs, doubleOut: p.doubleOut, starter: 'me', entry: p.entry }
      : { starter: 'me', entry: p.entry }
    if (active && !active.finishedAt && active.inputs?.length) { go('/new'); return }
    saveActive(newGame({ kind, mode, config: cfg, botLevel: p.botLevel }))
    go('/play')
  }

  return (
    <Screen title={`Hoi ${user.displayName} 👋`} nav right={<button className="btn ghost icon" onClick={() => go('/settings')} aria-label="Instellingen">⚙️</button>}>
      {pending > 0 && <div className="banner">⏳ {pending === 1 ? '1 spel wacht' : `${pending} spellen wachten`} op verbinding. Alles staat veilig op dit toestel en wordt automatisch verstuurd.</div>}
      {active && (
        <Card title={finished ? 'Laatste spel (afgelopen)' : 'Lopend spel'} className="highlight">
          <div style={{ marginBottom: 10 }}>{activeInfo}</div>
          <button className={`btn block ${finished ? '' : 'primary'}`} onClick={() => go('/play')}>{finished ? 'Uitslag bekijken' : 'Verder spelen'}</button>
        </Card>
      )}
      <button className="btn primary block hero" onClick={() => go('/new')}>🎯 Nieuw spel</button>
      <div className="quickstart" aria-label="Snel starten">
        <button className="qs" onClick={() => quickStart('x01', 'solo')}><b>{p.startScore}</b><span>solo · {p.doubleOut ? 'dubbel uit' : 'straight'}</span></button>
        <button className="qs" onClick={() => quickStart('x01', 'bot')}><b>{p.startScore}</b><span>vs bot {p.botLevel}</span></button>
        <button className="qs" onClick={() => quickStart('bobs27', 'solo')}><b>Bob's 27</b><span>dubbels</span></button>
        <button className="qs" onClick={() => quickStart('cricket', 'solo')}><b>Cricket</b><span>solo</span></button>
      </div>

      {prof ? (
        <Card title="Jouw X01" right={<button className="btn ghost small" onClick={() => go('/stats')}>Alles ›</button>}>
          <div className="stats-grid four">
            <div className="stat accent"><b>{fmt(prof.avg3)}</b><span>gemiddelde</span></div>
            <div className="stat"><b>{fmt(prof.first9)}</b><span>first 9</span></div>
            <div className="stat"><b>{fmtPct(prof.checkoutPct)}</b><span>uitgooi-%</span></div>
            <div className="stat"><b>{prof.s180}</b><span>180's</span></div>
          </div>
          {prof.trend.length >= 2 && <div style={{ marginTop: 10 }}><LineChart label="Gemiddelde laatste spellen" height={110} points={prof.trend} refLine={prof.avg3} refLabel="totaal" /></div>}
        </Card>
      ) : data && (
        <Card><div className="empty">📊<div>Speel je eerste spel. Daarna zie je hier je gemiddelde, uitgooi-% en verloop.</div></div></Card>
      )}

      {recent.length > 0 && (
        <Card title="Laatste spellen" right={<button className="btn ghost small" onClick={() => go('/history')}>Alles ›</button>}>
          {recent.map(g => (
            <div key={g.id} className="list-item compact">
              <div>{KINDS[g.kind]?.icon} <b>{KINDS[g.kind]?.short || g.kind}</b> <span className="muted">{g.opponentName ? `· vs ${g.opponentName}` : ''}</span><div className="muted small">{dateNl(g.startedAt)}</div></div>
              {resultTag(g)}
            </div>
          ))}
        </Card>
      )}
    </Screen>
  )
}
