import React from 'react'
import { Card } from '../../components/ui.jsx'
import { resultOf } from '../../lib/model.js'

export function ResultCard({ game, view, done, undoLast, rematch, extra }) {
  const r = resultOf(game, view)
  const title = r === 'won' ? '🏆 Gewonnen!' : r === 'lost' ? `${game.opponentName || 'Tegenstander'} wint` : '✅ Klaar'
  return (
    <Card className="result">
      <h2>{title}</h2>
      {extra}
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn" onClick={undoLast}>↶ Laatste beurt terug</button>
        <button className="btn primary" onClick={done}>Afronden</button>
      </div>
      {rematch && <button className="btn block" style={{ marginTop: 10 }} onClick={rematch}>🔁 {game.mode === 'solo' ? 'Nog een keer' : 'Revanche'} (zelfde instellingen)</button>}
    </Card>
  )
}

export const dartLabelShort = d => (d.m === 0 ? 'Mis' : d.n === 25 ? (d.m === 2 ? 'Bull' : '25') : `${['', 'S', 'D', 'T'][d.m]}${d.n}`)
