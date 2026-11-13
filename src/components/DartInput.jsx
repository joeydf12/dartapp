// Dart-voor-dart invoer: knoppen (S/D/T + nummer) of tikken op het dartbord.
// De gekozen stand wordt onthouden (voorkeur 'dartInput').
import React, { useState } from 'react'
import Dartboard from './Dartboard.jsx'
import { loadPrefs, savePrefs } from '../lib/store.js'

export function useInputStyle() {
  const [style, setStyle] = useState(() => loadPrefs().dartInput || 'keys')
  const set = s => { setStyle(s); savePrefs({ dartInput: s }) }
  return [style, set]
}

export function InputStyleToggle({ style, setStyle }) {
  return (
    <div className="seg-toggle" role="group" aria-label="Invoer">
      <button type="button" className={style === 'keys' ? 'on' : ''} onClick={() => setStyle('keys')} aria-pressed={style === 'keys'}>🔢 Knoppen</button>
      <button type="button" className={style === 'board' ? 'on' : ''} onClick={() => setStyle('board')} aria-pressed={style === 'board'}>🎯 Bord</button>
    </div>
  )
}

// numbers: welke nummers als knop (standaard 1..20). highlight: { m, n } licht op.
export default function DartInput({ onDart, onBack, canBack, numbers, highlight, keyClass, bull = true, disabled, style: forced }) {
  const [pref, setPref] = useInputStyle()
  const style = forced || pref
  const [mult, setMult] = useState(1)
  const nums = numbers || Array.from({ length: 20 }, (_, i) => i + 1)
  const add = d => { onDart(d); setMult(1) }
  return (
    <div className="pad-wrap">
      {!forced && <InputStyleToggle style={style} setStyle={setPref} />}
      {style === 'board' ? (
        <>
          <div className="board-wrap"><Dartboard onHit={add} highlight={highlight} disabled={disabled} /></div>
          <div className="grid2">
            <button className="key small miss" onClick={() => add({ m: 0, n: 0 })} disabled={disabled}>Mis</button>
            <button className="key small" onClick={onBack} disabled={!canBack}>⌫ dart</button>
          </div>
        </>
      ) : (
        <>
          <div className="mult">
            {[[1, 'Single'], [2, 'Dubbel'], [3, 'Treble']].map(([m, l]) => <button key={m} className={`key small ${mult === m ? 'on' : ''}`} onClick={() => setMult(m)} aria-pressed={mult === m}>{l}</button>)}
          </div>
          <div className="dartgrid">
            {nums.map(n => {
              const extra = keyClass?.(n, mult) || ''
              return <button key={n} className={`key ${extra} ${highlight && highlight.n === n && highlight.m === mult ? 'target' : ''}`} onClick={() => add({ m: mult, n })} disabled={disabled}>{mult > 1 ? `${mult === 2 ? 'D' : 'T'}${n}` : n}</button>
            })}
            {bull && <button className={`key ${highlight?.n === 25 ? 'target' : ''}`} onClick={() => add({ m: mult === 1 ? 1 : 2, n: 25 })} disabled={disabled}>{mult === 1 ? '25' : 'Bull'}</button>}
            <button className="key miss" style={{ gridColumn: 'span 2' }} onClick={() => add({ m: 0, n: 0 })} disabled={disabled}>Mis</button>
            <button className="key small" style={{ gridColumn: bull ? 'span 2' : 'span 3' }} onClick={onBack} disabled={!canBack}>⌫ dart</button>
          </div>
        </>
      )}
    </div>
  )
}
