// Invoer voor X01-achtige beurten (X01 en de uitgooi-trainingen).
// rules = turnRules(rest, { out, in, isIn }) uit darts/x01rules.js.
import React, { useEffect, useRef, useState } from 'react'
import { dartPoints, doubleTarget } from '../../lib/darts/rules.js'
import { BOGEY_CHECKOUTS } from '../../lib/darts/rules.js'
import { checkoutRoute } from '../../lib/darts/checkouts.js'
import { Card } from '../../components/ui.jsx'
import { savePrefs, loadPrefs } from '../../lib/store.js'
import Dartboard from '../../components/Dartboard.jsx'
import { InputStyleToggle, useInputStyle } from '../../components/DartInput.jsx'
import VoiceButton from '../../components/VoiceButton.jsx'
import { dartLabelShort } from './Shared.jsx'

export const dLabel = n => (n === 25 ? 'Bull' : `D${n}`)
export const vibrate = ms => { try { navigator.vibrate?.(ms) } catch { /* */ } }

// Korte uitleg: uitgooiroute, op een dubbel, bogey, of niet uit te gooien.
export function finishInfo(remaining, out = 'double', dartsLeft = 3, isIn = true) {
  if (!isIn) return { kind: 'setup', text: 'Nog niet in: gooi eerst een dubbel (of bij master in: dubbel/treble).' }
  if (out === 'straight') return remaining <= 60 ? { kind: 'route', text: 'Straight uit: elke dart die precies op 0 komt is uit.' } : null
  const route = checkoutRoute(remaining, dartsLeft)
  const dt = doubleTarget(remaining)
  if (route) return { kind: dt ? 'double' : 'route', route, text: dt ? `Je staat op ${dLabel(dt)}` : out === 'master' ? 'Master uit: ook een treble als laatste dart' : null }
  if (out === 'master' && remaining <= 60 && remaining % 3 === 0 && remaining / 3 <= 20 && dartsLeft >= 1) return { kind: 'route', route: [{ m: 3, n: remaining / 3 }], text: 'Master uit' }
  if (remaining <= 170 && BOGEY_CHECKOUTS.includes(remaining)) return { kind: 'bogey', text: `${remaining} is een bogey-getal: niet uit in 3 darts. Laat een mooie rest staan (bijv. 40 of 32).` }
  if (remaining <= 170 && dartsLeft < 3) return { kind: 'setup', text: `Met ${dartsLeft} dart${dartsLeft > 1 ? 's' : ''} niet uit: zet een dubbel klaar.` }
  return null
}

export function FinishInfo({ info, onDart }) {
  return (
    <div className={`finishinfo ${info.kind}`}>
      {info.text && <span>{info.text}</span>}
      {info.route && (
        <span className="route">
          {info.route.map((d, i) => onDart
            ? <button key={i} type="button" className="routedart" onClick={() => onDart(d)} aria-label={`Gooi ${dartLabelShort(d)}`}>{dartLabelShort(d)}</button>
            : <b key={i}>{dartLabelShort(d)}</b>)}
        </span>
      )}
    </div>
  )
}

// Fysiek toetsenbord (laptop/tablet met toetsenbord) naast de knoppen.
export function useKeys(handler, active = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const on = e => {
      if (e.target.closest?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return
      if (ref.current(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active])
}

// ── Totaalinvoer ────────────────────────────────────────────────────────────
// Snelscores, Uit/Bust in één tik, rest invoeren, spraak.
export function TotalPad({ remaining, rules, onSubmit, disabled, simple }) {
  const prefs = loadPrefs()
  const [val, setVal] = useState('')
  const [typing, setTyping] = useState(!simple && prefs.typing === 'rest' ? 'rest' : 'scored')
  const [ask, setAsk] = useState(null) // { kind: 'finish', score, min } | { kind: 'double', input, range }
  const [msg, setMsg] = useState('')
  const typed = val === '' ? null : parseInt(val, 10)
  const score = typed == null ? null : typing === 'rest' ? remaining - typed : typed
  const check = score == null ? null : typing === 'rest' && typed > remaining ? { ok: false, error: `Rest kan niet hoger zijn dan ${remaining}.` } : rules.check(score)
  const quick = (prefs.quick?.length ? prefs.quick : [0, 26, 41, 45, 60, 81, 85, 100, 140, 180]).slice(0, 10)
  const canOut = rules.canOut && rules.isIn !== false
  const bust = rules.bust()
  const outMode = rules.out || 'double'

  const commit = input => { vibrate(15); onSubmit({ mode: 'total', at: new Date().toISOString(), ...input }) }
  const askDoubles = input => {
    const range = rules.doubleRange(input)
    if (range.max === 0) return commit({ ...input, dartsAtDouble: 0 })
    if (range.min === range.max) return commit({ ...input, dartsAtDouble: range.min })
    setAsk({ kind: 'double', input, range })
  }
  const send = (n = score) => {
    if (n == null) return
    if (typing === 'rest' && n === score && typed > remaining) { setMsg(check.error); return }
    const c = rules.check(n)
    if (!c.ok) { setMsg(c.error); vibrate([30, 40, 30]); return }
    if (c.needsFinishInfo) {
      const min = c.minDarts
      if (min === 3) return askDoubles({ score: n, dartsAtFinish: 3 })
      setAsk({ kind: 'finish', score: n, min }); return
    }
    askDoubles({ score: n })
  }
  const press = d => { setMsg(''); setVal(v => (v.length >= 3 ? v : (v === '0' ? d : v + d))) }
  const toggleTyping = () => { const t = typing === 'rest' ? 'scored' : 'rest'; setTyping(t); savePrefs({ typing: t }); setVal(''); setMsg('') }
  const onVoice = (p, heard) => {
    if (!p) { setMsg(`Niet verstaan: "${heard}"`); return }
    if (p.action === 'bust') return bust != null ? send(bust) : setMsg('Hier kan geen bust.')
    if (p.action === 'out') return canOut ? send(remaining) : setMsg('Je kunt hier niet uit.')
    if (p.action === 'zero') return send(0)
    send(p.score)
  }

  useKeys(k => {
    if (ask) {
      if (k === 'Escape') { setAsk(null); return true }
      if (/^[0-3]$/.test(k)) { const b = document.querySelector(`[data-ask="${k}"]`); if (b) { b.click(); return true } }
      return false
    }
    if (/^[0-9]$/.test(k)) { press(k); return true }
    if (k === 'Backspace') { setVal(v => v.slice(0, -1)); setMsg(''); return true }
    if (k === 'Enter') { send(); return true }
    if (k === 'u' && canOut) { send(remaining); return true }
    if (k === 'b' && bust != null) { send(bust); return true }
    if (k === 'r') { toggleTyping(); return true }
    return false
  }, !disabled)

  if (ask?.kind === 'finish') {
    const opts = [1, 2, 3].filter(n => n >= ask.min)
    return (
      <Card title={`🎯 Uit met ${ask.score}!`} className="ask">
        <div className="ask-q">In hoeveel darts?</div>
        <div className="grid3">{opts.map(n => <button key={n} data-ask={n} className="key" onClick={() => { setAsk(null); askDoubles({ score: ask.score, dartsAtFinish: n }) }}>{n}</button>)}</div>
        <div className="muted small center">Telt mee voor je gemiddelde en darts per leg.</div>
        <button className="btn ghost block" onClick={() => setAsk(null)}>Terug</button>
      </Card>
    )
  }
  if (ask?.kind === 'double') {
    const opts = []; for (let n = ask.range.min; n <= ask.range.max; n++) opts.push(n)
    const out = ask.input.score === remaining
    return (
      <Card title={out ? `🎯 Uit met ${ask.input.score}` : 'Darts op de dubbel'} className="ask">
        <div className="ask-q">Hoeveel darts gooide je <b>op een dubbel</b>?</div>
        <div className="grid4">{opts.map(n => <button key={n} data-ask={n} className="key" onClick={() => { const i = ask.input; setAsk(null); commit({ ...i, dartsAtDouble: n }) }}>{n}</button>)}</div>
        <div className="muted small">Een dart telt als "op de dubbel" als je rest op dat moment met één dart uit kon (2–40 even, of 50). {out ? 'De laatste dart (raak) telt ook mee.' : 'Ook een dart die je net mist.'}</div>
        <button className="btn ghost block" onClick={() => setAsk(null)}>Terug</button>
      </Card>
    )
  }

  const status = msg ? <span className="warn">{msg}</span>
    : check && !check.ok ? <span className="warn">{check.error}</span>
    : check?.warnings?.[0] ? <span className="warn">{check.warnings[0]}</span>
    : check?.needsFinishInfo ? <span className="good">Uitgooien!</span>
    : check ? <span className="muted">{typing === 'rest' ? `gegooid ${score}` : `rest ${remaining - score}`}</span>
    : <span className="muted">{rules.isIn === false ? 'Nog niet in: typ de punten die telden' : typing === 'rest' ? 'Typ wat er over is' : 'Typ je score of tik een snelscore'}</span>

  return (
    <div className="pad-wrap">
      <div className="display-row">
        {!simple && <button type="button" className={`typing ${typing}`} onClick={toggleTyping} title="Wissel: gegooide score of rest invoeren (toets R)">{typing === 'rest' ? 'rest' : 'gegooid'}</button>}
        <div className="display" aria-live="polite">{val === '' ? <span className="muted">{typing === 'rest' ? 'rest' : 'score'}</span> : val}</div>
        <VoiceButton onResult={onVoice} disabled={disabled} />
      </div>
      <div className="status small center">{status}</div>
      <div className="quick">{quick.map(q => <button key={q} className="key" onClick={() => send(q)} disabled={q > remaining || (outMode !== 'straight' && remaining - q === 1)}>{q}</button>)}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} className="key" onClick={() => press(d)}>{d}</button>)}
        <button className="key small" onClick={() => { setVal(v => v.slice(0, -1)); setMsg('') }} aria-label="Wissen">⌫</button>
        <button className="key" onClick={() => press('0')}>0</button>
        <button className="key send" onClick={() => send()} disabled={score == null}>OK</button>
      </div>
      {!simple && (
        <div className="grid2">
          <button className="key small bust" onClick={() => send(bust)} disabled={bust == null}>Bust</button>
          <button className="key small out" onClick={() => send(remaining)} disabled={!canOut}>Uit ({remaining})</button>
        </div>
      )}
    </div>
  )
}

// ── Invoer per dart ─────────────────────────────────────────────────────────
// Snelle darts, aantikbare uitgooiroute, oplichtende dubbel, of tikken op het bord.
const QUICK_DARTS = [{ m: 3, n: 20 }, { m: 1, n: 20 }, { m: 1, n: 1 }, { m: 1, n: 5 }, { m: 3, n: 19 }, { m: 1, n: 19 }]

// Rest na de al ingevoerde darts (houdt rekening met dubbel/master in).
function restAfter(remaining, darts, rules) {
  let rem = remaining, isIn = rules.isIn !== false
  for (const d of darts) {
    if (!isIn && (rules.in === 'master' ? d.m >= 2 : d.m === 2)) isIn = true
    if (isIn) rem -= dartPoints(d)
  }
  return { rem, isIn }
}

export function DartPad({ remaining, rules, onSubmit, disabled }) {
  const [darts, setDarts] = useState([])
  const [mult, setMult] = useState(1)
  const [msg, setMsg] = useState('')
  const [style, setStyle] = useInputStyle()

  const add = d => {
    const next = [...darts, d]
    const res = rules.evalDarts(next)
    vibrate(10)
    if (!res.error) return onSubmit({ mode: 'darts', at: new Date().toISOString(), darts: next })   // beurt eindigt: uitgooi, bust of derde dart
    if (/Vul de beurt aan/.test(res.error)) { setDarts(next); setMsg(''); setMult(1); return }
    setMsg(res.error)
  }
  const { rem, isIn } = restAfter(remaining, darts, rules)
  const dartsLeft = 3 - darts.length
  const info = finishInfo(rem, rules.out, dartsLeft, isIn)
  const dt = rules.out === 'double' && isIn ? doubleTarget(rem) : null
  const numbers = Array.from({ length: 20 }, (_, i) => i + 1)

  useKeys(k => {
    const l = k.toLowerCase()
    if (l === 's') { setMult(1); return true }
    if (l === 'd') { setMult(2); return true }
    if (l === 't') { setMult(3); return true }
    if (l === 'm' || l === '0') { add({ m: 0, n: 0 }); return true }
    if (k === 'Backspace') { setDarts(darts.slice(0, -1)); setMsg(''); return true }
    return false
  }, !disabled)

  return (
    <div className="pad-wrap">
      <div className="row" style={{ minHeight: 56 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className={`dartchip ${darts[i] ? 'set' : ''} ${i === darts.length ? 'next' : ''}`}>
            <b>{darts[i] ? dartLabelShort(darts[i]) : '–'}</b>
            <span className="muted small">{darts[i] ? `${dartPoints(darts[i])} pt` : `dart ${i + 1}`}</span>
          </div>
        ))}
      </div>
      <div className="status small center">{msg ? <span className="warn">{msg}</span> : <span className="muted">rest <b className="restnum">{rem}</b>{darts.length ? ` · nog ${dartsLeft} dart${dartsLeft > 1 ? 's' : ''}` : ''}</span>}</div>
      {info && <FinishInfo info={info} onDart={add} />}
      <InputStyleToggle style={style} setStyle={setStyle} />
      {style === 'board' ? (
        <>
          <div className="board-wrap"><Dartboard onHit={add} highlight={info?.route?.[0]} disabled={disabled} /></div>
          <div className="grid2">
            <button className="key small miss" onClick={() => add({ m: 0, n: 0 })}>Mis</button>
            <button className="key small" onClick={() => { setDarts(darts.slice(0, -1)); setMsg('') }} disabled={!darts.length}>⌫ dart</button>
          </div>
        </>
      ) : (
        <>
          <div className="quick six">{QUICK_DARTS.map(d => <button key={`${d.m}${d.n}`} className="key" onClick={() => add(d)}>{dartLabelShort(d).replace(/^S/, '')}</button>)}</div>
          <div className="mult">
            {[[1, 'Single'], [2, 'Dubbel'], [3, 'Treble']].map(([m, l]) => <button key={m} className={`key small ${mult === m ? 'on' : ''}`} onClick={() => setMult(m)} aria-pressed={mult === m}>{l}</button>)}
          </div>
          <div className="dartgrid">
            {numbers.map(n => <button key={n} className={`key ${dt === n && mult === 2 ? 'target' : ''}`} onClick={() => add({ m: mult, n })}>{mult > 1 ? `${mult === 2 ? 'D' : 'T'}${n}` : n}</button>)}
            <button className={`key ${dt === 25 ? 'target' : ''}`} onClick={() => add({ m: mult === 1 ? 1 : 2, n: 25 })}>{mult === 1 ? '25' : 'Bull'}</button>
            <button className="key miss" style={{ gridColumn: 'span 2' }} onClick={() => add({ m: 0, n: 0 })}>Mis</button>
            <button className="key small" style={{ gridColumn: 'span 2' }} onClick={() => { setDarts(darts.slice(0, -1)); setMsg('') }} disabled={!darts.length}>⌫ dart</button>
          </div>
        </>
      )}
      {darts.length > 0 && (
        <button className="btn block" onClick={() => onSubmit({ mode: 'darts', at: new Date().toISOString(), darts: rules.pad(darts) })}>Beurt klaar (rest = mis)</button>
      )}
    </div>
  )
}
