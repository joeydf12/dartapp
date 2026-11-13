// Cricket (standaard, Cut-Throat, No Score, Tactics, willekeurige nummers).
import React, { useState } from 'react'
import { Card } from '../../components/ui.jsx'
import { playerName } from '../../lib/model.js'
import { CRICKET_VARIANTS } from '../../lib/games/cricket.js'
import Dartboard from '../../components/Dartboard.jsx'
import { InputStyleToggle, useInputStyle } from '../../components/DartInput.jsx'
import { ResultCard, useDartTurn, DartChips } from './Shared.jsx'

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

export default function DartsPlay({ game, view, apply, undoLast, rematch, err, user, done }) {
  const solo = view.players.length === 1
  const names = { me: playerName(view.players[0], user), opp: playerName(view.players[1], user) }
  const current = view.currentSide
  const botTurn = view.currentBot != null
  const [mult, setMult] = useState(1)
  const [style, setStyle] = useInputStyle()
  const turn = useDartTurn(game, apply)
  const live = turn.live || view
  const nums = live.raw.numbers
  const variant = game.config.variant || 'standard'
  const add = d => { turn.add(d); setMult(1) }

  return (
    <>
      {variant !== 'standard' && <div className="muted small center">{CRICKET_VARIANTS[variant]}{variant === 'cutthroat' ? ' · punten gaan naar de ander, laagste wint' : ''}</div>}
      <Card>
        <table className="cricket">
          <thead><tr>
            <th style={{ textAlign: 'center' }}>{names.me}{current === 'me' ? ' ◀' : ''}</th><th></th>
            {!solo && <th style={{ textAlign: 'center' }}>{names.opp}{current === 'opp' ? ' ◀' : ''}</th>}
          </tr></thead>
          <tbody>
            {nums.map(n => (
              <tr key={n}>
                <td>{markSym(live.raw.state.me.marks[n])}</td>
                <td className="num">{n === 25 ? 'B' : n}</td>
                {!solo && <td>{markSym(live.raw.state.opp.marks[n])}</td>}
              </tr>
            ))}
            {variant !== 'noscore' && <tr><td><b>{live.raw.state.me.points}</b></td><td className="muted small">punten</td>{!solo && <td><b>{live.raw.state.opp.points}</b></td>}</tr>}
          </tbody>
        </table>
      </Card>
      {err && <div className="err">{err}</div>}

      {view.finished ? (
        <ResultCard game={game} view={view} names={[names.me, names.opp]} done={done} undoLast={undoLast} rematch={rematch}
          extra={<div className="muted">{view.turns.filter(t => t.side === 'me').length} beurten · {(view.raw.summary.marksMe / Math.max(1, view.turns.filter(t => t.side === 'me').length)).toFixed(2)} marks per ronde</div>} />
      ) : (
        <>
          <div className="hint center">{botTurn ? `🤖 ${names.opp} gooit…` : !solo ? `Aan de beurt: ${names[current]}` : ''}</div>
          <div className={botTurn ? 'overlay' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DartChips darts={turn.darts} />
            <InputStyleToggle style={style} setStyle={setStyle} />
            {style === 'board' ? (
              <>
                <div className="board-wrap"><Dartboard onHit={add} /></div>
                <button className="key small miss" onClick={() => add({ m: 0, n: 0 })}>Mis</button>
              </>
            ) : (
              <>
                <div className="mult">{[[1, 'Single'], [2, 'Dubbel'], [3, 'Treble']].map(([m, l]) => <button key={m} className={`key small ${mult === m ? 'on' : ''}`} onClick={() => setMult(m)} aria-pressed={mult === m}>{l}</button>)}</div>
                <div className="dartgrid">
                  {nums.map(n => {
                    const st = cricketKeyState(live.raw.state, current, n, solo)
                    return <button key={n} className={`key ck ${st}`} onClick={() => add({ m: n === 25 && mult === 3 ? 2 : mult, n })} aria-label={`${n === 25 ? 'Bull' : n} (${CK_LABEL[st]})`}>{n === 25 ? 'Bull' : n}<small>{CK_LABEL[st]}</small></button>
                  })}
                  <button className="key miss" onClick={() => add({ m: 0, n: 0 })}>Mis</button>
                </div>
              </>
            )}
            <div className="grid2">
              <button className="btn" onClick={turn.back} disabled={!turn.darts.length}>⌫ dart</button>
              <button className="btn" onClick={turn.end} disabled={!turn.darts.length}>Beurt klaar</button>
            </div>
          </div>
          <button className="btn" onClick={() => { turn.reset(); undoLast() }} disabled={!game.inputs.length}>↶ Vorige beurt ongedaan</button>
        </>
      )}
    </>
  )
}
