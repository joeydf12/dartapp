import React, { useMemo, useState } from 'react'
import { Card } from '../../components/ui.jsx'
import { replayGame } from '../../lib/model.js'
import { CRICKET_NUMBERS } from '../../lib/games/cricket.js'
import { CLOCK_TARGETS } from '../../lib/games/aroundClock.js'
import { ResultCard, dartLabelShort } from './Shared.jsx'

// Status van een cricketnummer voor de speler aan de beurt.
const CK_LABEL = { open: 'open', scoring: 'scoort', closed: 'dicht', dead: 'dood' }
function cricketKeyState(state, side, n, solo) {
  if (!side) return 'open'
  const mine = state[side].marks[n], theirs = state[side === 'me' ? 'opp' : 'me'].marks[n]
  if (mine < 3) return 'open'
  if (solo) return 'closed'
  return theirs < 3 ? 'scoring' : 'dead'
}

const markSym = n => (n >= 3 ? '⊗' : n === 2 ? '✕' : n === 1 ? '/' : '·')

// Cricket en Around the Clock: beurten van maximaal 3 darts, per dart ingevoerd.
export default function DartsPlay({ game, view, apply, undoLast, rematch, err, user, done }) {
  const solo = game.mode === 'solo'
  const cricket = game.kind === 'cricket'
  const names = { me: user.displayName, opp: game.opponentName || 'Tegenstander' }
  const current = view.current
  const botTurn = game.mode === 'bot' && current === 'opp'
  const [darts, setDarts] = useState([])
  const [mult, setMult] = useState(1)

  // Beëindigt de beurt automatisch bij drie darts of als het spel hiermee beslist is.
  const add = d => {
    const next = [...darts, d]
    let decided = false
    try { decided = replayGame({ ...game, inputs: [...game.inputs, { id: 'tmp', darts: next }] }).finished } catch { /* ongeldig, laat apply melden */ }
    if (next.length >= 3 || decided) { apply({ darts: next }); setDarts([]); setMult(1) } else { setDarts(next) }
  }
  const endTurn = () => { if (darts.length) { apply({ darts }); setDarts([]) } }

  const sides = solo ? ['me'] : ['me', 'opp']
  // Het bord beweegt per dart mee, nog vóór de beurt is opgeslagen.
  const live = useMemo(() => {
    if (!darts.length) return view
    try { return replayGame({ ...game, inputs: [...game.inputs, { id: 'tmp', darts }] }) } catch { return view }
  }, [darts, game, view])
  const target = side => (live.raw.target ? live.raw.target(side) : null)

  return (
    <>
      {cricket ? (
        <Card>
          <table className="cricket">
            <thead><tr>
              <th style={{ textAlign: 'center' }}>{names.me}{current === 'me' ? ' ◀' : ''}</th><th></th>
              {!solo && <th style={{ textAlign: 'center' }}>{names.opp}{current === 'opp' ? ' ◀' : ''}</th>}
            </tr></thead>
            <tbody>
              {CRICKET_NUMBERS.map(n => (
                <tr key={n}>
                  <td>{markSym(live.raw.state.me.marks[n])}</td>
                  <td className="num">{n === 25 ? 'B' : n}</td>
                  {!solo && <td>{markSym(live.raw.state.opp.marks[n])}</td>}
                </tr>
              ))}
              <tr><td><b>{live.raw.state.me.points}</b></td><td className="muted small">punten</td>{!solo && <td><b>{live.raw.state.opp.points}</b></td>}</tr>
            </tbody>
          </table>
        </Card>
      ) : (
        <div className={`board ${solo ? 'solo' : ''}`}>
          {sides.map(s => (
            <div key={s} className={`side ${current === s ? 'active' : ''}`}>
              <div className="name">{names[s]}</div>
              <div className="rem">{CLOCK_TARGETS[live.raw.progress[s]] === 25 ? 'Bull' : CLOCK_TARGETS[live.raw.progress[s]] ?? '✓'}</div>
              <div className="meta">{live.raw.progress[s]} / {CLOCK_TARGETS.length} gehaald</div>
            </div>
          ))}
        </div>
      )}
      {err && <div className="err">{err}</div>}

      {view.finished ? (
        <ResultCard game={game} view={view} done={done} undoLast={undoLast} rematch={rematch}
          extra={<div className="muted">{view.turns.filter(t => t.side === 'me').length} beurten</div>} />
      ) : (
        <>
          <div className="hint" style={{ textAlign: 'center' }}>{botTurn ? '🤖 Bot gooit…' : !solo ? `Aan de beurt: ${names[current]}` : ''}</div>
          <div className={botTurn ? 'overlay' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ minHeight: 56 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="dartchip" style={{ flex: 1, opacity: darts[i] ? 1 : 0.4 }}><b>{darts[i] ? dartLabelShort(darts[i]) : '–'}</b><span className="muted small">dart {i + 1}</span></div>
              ))}
            </div>
            {cricket ? (
              <>
                <div className="mult">{[[1, 'Single'], [2, 'Dubbel'], [3, 'Treble']].map(([m, l]) => <button key={m} className={`key small ${mult === m ? 'on' : ''}`} onClick={() => setMult(m)}>{l}</button>)}</div>
                <div className="dartgrid">
                  {CRICKET_NUMBERS.map(n => {
                    const st = cricketKeyState(live.raw.state, current, n, solo)
                    return <button key={n} className={`key ck ${st}`} onClick={() => add({ m: n === 25 && mult === 3 ? 2 : mult, n })} aria-label={`${n === 25 ? 'Bull' : n} (${CK_LABEL[st]})`}>{n === 25 ? 'Bull' : n}<small>{CK_LABEL[st]}</small></button>
                  })}
                  <button className="key" onClick={() => add({ m: 0, n: 0 })}>Mis</button>
                </div>
              </>
            ) : (
              <div className="grid2">
                <button className="key" style={{ background: 'var(--green)', color: '#06210f' }} onClick={() => add({ m: 1, n: target(current) })}>Raak {target(current) === 25 ? 'Bull' : target(current)}</button>
                <button className="key" onClick={() => add({ m: 0, n: 0 })}>Mis</button>
              </div>
            )}
            <div className="grid2">
              <button className="btn" onClick={() => setDarts(darts.slice(0, -1))} disabled={!darts.length}>⌫ dart</button>
              <button className="btn" onClick={endTurn} disabled={!darts.length}>Beurt klaar</button>
            </div>
          </div>
          <button className="btn" onClick={() => { setDarts([]); undoLast() }} disabled={!game.inputs.length}>↶ Vorige beurt ongedaan</button>
        </>
      )}
    </>
  )
}
