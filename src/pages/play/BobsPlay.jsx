import React from 'react'
import { Card } from '../../components/ui.jsx'
import { ResultCard } from './Shared.jsx'

export default function BobsPlay({ game, view, apply, undoLast, rematch, err, done }) {
  const r = view.raw
  const target = r.nextTarget
  return (
    <>
      <div className="board solo">
        <div className="side active">
          <div className="name">{view.finished ? (r.busted ? 'Af!' : 'Alle dubbels gehad') : `Gooi op ${target === 25 ? 'Bull' : `D${target}`}`}</div>
          <div className="rem">{r.score}</div>
          <div className="meta">ronde {Math.min(r.turns.length + (view.finished ? 0 : 1), 21)} van 21</div>
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} done={done} undoLast={undoLast} rematch={rematch} extra={<div className="muted">Eindscore {r.score} · {r.summary.hits} dubbels geraakt</div>} />
      ) : (
        <>
          <Card title="Hoeveel van je 3 darts raakten de dubbel?">
            <div className="pad" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[0, 1, 2, 3].map(h => <button key={h} className="key" onClick={() => apply({ hits: h })}>{h}</button>)}
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>Raak: + waarde van de dubbel per treffer. Geen enkele raak: − die waarde. Bij 0 of lager ben je af.</div>
          </Card>
          <button className="btn" onClick={undoLast} disabled={!game.inputs.length}>↶ Vorige ronde ongedaan</button>
        </>
      )}
    </>
  )
}
