import React, { useState } from 'react'
import { Card } from '../../components/ui.jsx'
import { resultOf, replayGame, playerName } from '../../lib/model.js'

export const dartLabelShort = d => (d.m === 0 ? 'Mis' : d.n === 25 ? (d.m === 2 ? 'Bull' : '25') : `${['', 'S', 'D', 'T'][d.m]}${d.n}`)

export function ResultCard({ game, view, names, done, undoLast, rematch, extra }) {
  const r = resultOf(game, view)
  const nm = names || view.players?.map(p => playerName(p)) || []
  const title = r === 'won' ? '🏆 Gewonnen!' : r === 'draw' ? '🤝 Gelijkspel' : r === 'lost' ? `${nm[view.winner] || game.opponentName || 'Tegenstander'} wint` : '✅ Klaar'
  return (
    <Card className="result">
      <h2>{title}</h2>
      {extra}
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn" onClick={undoLast}>↶ Laatste beurt terug</button>
        <button className="btn primary" onClick={done}>Afronden</button>
      </div>
      {rematch && <button className="btn block" style={{ marginTop: 10 }} onClick={rematch}>🔁 {view.players?.length > 1 ? 'Revanche' : 'Nog een keer'} (zelfde instellingen)</button>}
    </Card>
  )
}

// Spelers-balk voor spellen met meerdere spelers: naam, waarde, wie aan de beurt is.
export function PlayersBar({ view, names, value, sub }) {
  const n = view.players.length
  return (
    <div className={`board ${n === 1 ? 'solo' : n > 2 ? 'multi' : ''}`}>
      {view.players.map((p, i) => (
        <div key={i} className={`side ${view.current === i ? 'active' : ''}`}>
          <div className="name">{p.type === 'bot' ? '🤖 ' : ''}{names[i]}</div>
          <div className="rem">{value(i)}</div>
          {sub && <div className="meta">{sub(i)}</div>}
        </div>
      ))}
    </div>
  )
}

// Darts verzamelen tot de beurt vol is (3) of het spel ermee beslist is.
export function useDartTurn(game, apply, max = 3) {
  const [darts, setDarts] = useState([])
  const add = d => {
    const next = [...darts, d]
    let decided = false
    try { decided = replayGame({ ...game, inputs: [...game.inputs, { id: 'tmp', darts: next }] }).finished } catch { /* laat apply melden */ }
    try { navigator.vibrate?.(10) } catch { /* */ }
    if (next.length >= max || decided) { apply({ darts: next }); setDarts([]) } else setDarts(next)
  }
  const back = () => setDarts(darts.slice(0, -1))
  const end = () => { if (darts.length) { apply({ darts }); setDarts([]) } }
  const live = (() => {
    if (!darts.length) return null
    try { return replayGame({ ...game, inputs: [...game.inputs, { id: 'tmp', darts }] }) } catch { return null }
  })()
  return { darts, add, back, end, live, reset: () => setDarts([]) }
}

export function DartChips({ darts, label }) {
  return (
    <div className="row" style={{ minHeight: 52 }}>
      {[0, 1, 2].map(i => (
        <div key={i} className={`dartchip ${darts[i] ? 'set' : ''} ${i === darts.length ? 'next' : ''}`}>
          <b>{darts[i] ? (label ? label(darts[i]) : dartLabelShort(darts[i])) : '–'}</b><span className="muted small">dart {i + 1}</span>
        </div>
      ))}
    </div>
  )
}
