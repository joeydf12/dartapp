import React, { useEffect, useRef, useState } from 'react'
import { checkTotalInput, doubleDartsRange, evaluateDartsTurn, padDarts, dartPoints, doubleTarget, canCheckout, bustScore, BOGEY_CHECKOUTS } from '../../lib/darts/rules.js'
import { checkoutRoute } from '../../lib/darts/checkouts.js'
import { Card } from '../../components/ui.jsx'
import { savePrefs, loadPrefs } from '../../lib/store.js'
import { ResultCard, dartLabelShort } from './Shared.jsx'
import { say, callX01 } from '../../lib/caller.js'

const avg3 = (turns, side) => {
  const own = turns.filter(t => t.side === side)
  const darts = own.reduce((a, t) => a + t.dartsThrown, 0)
  return darts ? (own.reduce((a, t) => a + t.score, 0) / darts) * 3 : null
}
const dLabel = n => (n === 25 ? 'Bull' : `D${n}`)
const vibrate = ms => { try { navigator.vibrate?.(ms) } catch { /* */ } }

// Korte uitleg onder het scorebord: uitgooiroute, op een dubbel, bogey, of niet uit te gooien.
function finishInfo(remaining, doubleOut, dartsLeft = 3) {
  if (!doubleOut) return remaining <= 60 ? { kind: 'route', text: 'Straight out: elke dart die precies op 0 komt is uit.' } : null
  const route = checkoutRoute(remaining, dartsLeft)
  const dt = doubleTarget(remaining)
  if (route) return { kind: dt ? 'double' : 'route', route, text: dt ? `Je staat op ${dLabel(dt)}` : null }
  if (remaining <= 170 && BOGEY_CHECKOUTS.includes(remaining)) return { kind: 'bogey', text: `${remaining} is een bogey-getal: niet uit in 3 darts. Laat een mooie rest staan (bijv. 40 of 32).` }
  if (remaining <= 170 && dartsLeft < 3) return { kind: 'setup', text: `Met ${dartsLeft} dart${dartsLeft > 1 ? 's' : ''} niet uit: zet een dubbel klaar.` }
  return null
}

export default function X01Play({ game, view, apply, undoLast, replace, rematch, err, user, done, setGame }) {
  const cfg = game.config
  const solo = game.mode === 'solo'
  const raw = view.raw
  const leg = raw.legs[raw.legs.length - 1]
  const remMe = solo ? leg.remaining : leg.remaining.home
  const remOpp = solo ? null : leg.remaining.away
  const current = view.current
  const botTurn = game.mode === 'bot' && current === 'opp'
  const remNow = current === 'opp' ? remOpp : remMe
  const entry = cfg.entry || 'total'
  const last = view.turns[view.turns.length - 1]
  const legTurns = view.turns.filter(t => t.legNumber === leg.number)
  const [editing, setEditing] = useState(null) // beurt die gecorrigeerd wordt
  const [showStats, setShowStats] = useState(false)

  const setEntry = e => { savePrefs({ entry: e }); setGame({ ...game, config: { ...cfg, entry: e } }) }
  const names = { me: user.displayName, opp: game.opponentName || 'Tegenstander' }
  const legsOf = side => (side === 'me' ? view.summary.legsMe : view.summary.legsOpp)
  const dartsInLeg = side => legTurns.filter(t => t.side === side).reduce((a, t) => a + t.dartsThrown, 0)
  const info = !view.finished && entry === 'total' ? finishInfo(remNow, cfg.doubleOut) : null
  const canEdit = t => t.side === 'me' || game.mode === 'pvp'

  // Caller + trillen na elke nieuwe beurt.
  const seen = useRef(view.turns.length)
  useEffect(() => {
    if (view.turns.length <= seen.current) { seen.current = view.turns.length; return }
    seen.current = view.turns.length
    const t = view.turns[view.turns.length - 1]
    if (t?.isBust) vibrate([40, 60, 40])
    if (!loadPrefs().sound) return
    const nextRem = view.current === 'opp' ? remOpp : remMe
    say(callX01(t, { gameShot: view.finished, nextRemaining: nextRem, nextOnFinish: cfg.doubleOut && nextRem <= 170 && canCheckout(nextRem) && !botTurn }))
  }, [view.turns.length])

  // Melding bij een uitgegooide leg (niet de laatste).
  const legMsg = last?.isCheckout && !view.finished
    ? `${names[last.side]} gooit ${last.score} uit · leg ${last.legNumber} in ${view.turns.filter(t => t.legNumber === last.legNumber && t.side === last.side).reduce((a, t) => a + t.dartsThrown, 0)} darts`
    : null

  const lastText = last && (
    <>{names[last.side]}: <b>{last.isBust ? 'bust' : last.score}</b>{last.darts?.length ? <span className="muted"> ({last.darts.map(dartLabelShort).join(' · ')})</span> : null}</>
  )

  return (
    <>
      <div className={`board ${solo ? 'solo' : ''}`}>
        {['me', ...(solo ? [] : ['opp'])].map(side => {
          const rem = side === 'me' ? remMe : remOpp
          const dt = cfg.doubleOut ? doubleTarget(rem) : null
          return (
            <div key={side} className={`side ${current === side ? 'active' : ''}`}>
              <div className="name">{!solo && leg.startSide === (side === 'me' ? 'home' : 'away') && <span className="starter" title="Begon deze leg">●</span>}{names[side]}</div>
              <div className="rem">{rem}</div>
              {dt && !view.finished ? <div className="ondouble">op {dLabel(dt)}</div> : <div className="meta">gem. {avg3(view.turns, side)?.toFixed(1) ?? '–'} · {dartsInLeg(side)} dts</div>}
              {solo ? <div className="meta">leg {leg.number} van {cfg.legs}</div> : <div className="legs">{legsOf(side)} <span className="muted small">/ {cfg.legs}</span></div>}
            </div>
          )
        })}
      </div>

      <LegTurns turns={legTurns} sides={solo ? ['me'] : ['me', 'opp']} onEdit={view.finished ? null : setEditing} canEdit={canEdit} />
      {legMsg && <div className="ok center small">🎯 {legMsg}</div>}
      {err && <div className="err">{err}</div>}

      {view.finished ? (
        <ResultCard game={game} view={view} done={done} undoLast={undoLast} rematch={rematch}
          extra={<MatchStats view={view} solo={solo} names={names} />} />
      ) : editing ? (
        <Card title={`Beurt corrigeren (was ${editing.isBust ? 'bust' : editing.score})`} className="ask">
          <div className="muted small">{names[editing.side]} · leg {editing.legNumber} · rest vooraf {editing.remainingBefore}. Vul de juiste score in.</div>
          <TotalPad remaining={editing.remainingBefore} doubleOut={cfg.doubleOut} onSubmit={inp => { if (replace(editing.id, inp)) setEditing(null) }} />
          <button className="btn ghost block" onClick={() => setEditing(null)}>Annuleren</button>
        </Card>
      ) : (
        <>
          {botTurn ? <div className="hint center" aria-live="polite">🤖 Bot gooit…</div> : (
            <>
              {!solo && <div className="muted small center">Aan de beurt: <b>{names[current]}</b></div>}
              {info && <FinishInfo info={info} />}
            </>
          )}
          <div className={botTurn ? 'overlay' : ''}>
            {entry === 'total'
              ? <TotalPad key={view.turns.length} remaining={remNow} doubleOut={cfg.doubleOut} onSubmit={apply} disabled={botTurn} />
              : <DartPad key={view.turns.length} remaining={remNow} doubleOut={cfg.doubleOut} onSubmit={apply} disabled={botTurn} />}
          </div>
          {last && <div className="lastturn small center">Vorige · {lastText}{canEdit(last) && <span className="muted"> · tik een score hierboven om te corrigeren</span>}</div>}
          <div className="row between">
            <button className="btn" onClick={undoLast} disabled={!game.inputs.length}>↶ Ongedaan</button>
            <button className="btn ghost small" onClick={() => setShowStats(s => !s)} aria-expanded={showStats}>📊 Stats</button>
            <button className="btn ghost small" onClick={() => setEntry(entry === 'total' ? 'darts' : 'total')}>
              {entry === 'total' ? '🎯 Per dart' : '🔢 Totaal'}
            </button>
          </div>
          {showStats && <Card title="Dit spel"><MatchStats view={view} solo={solo} names={names} /></Card>}
        </>
      )}
    </>
  )
}

// Statistieken van één kant in dit spel.
function sideStats(turns, side) {
  const own = turns.filter(t => t.side === side)
  const darts = own.reduce((a, t) => a + t.dartsThrown, 0)
  const legs = [...new Set(own.map(t => t.legNumber))]
  const f9 = legs.flatMap(l => own.filter(t => t.legNumber === l).slice(0, 3))
  const chances = own.filter(t => t.remainingBefore <= 170 && canCheckout(t.remainingBefore)).length
  const outs = own.filter(t => t.isCheckout)
  const atD = own.reduce((a, t) => a + (t.dartsAtDouble ?? 0), 0)
  const legDarts = legs.map(l => own.filter(t => t.legNumber === l)).filter(ts => ts.some(t => t.isCheckout)).map(ts => ts.reduce((a, t) => a + t.dartsThrown, 0))
  const sc = own.filter(t => !t.isBust)
  return {
    avg: avg3(turns, side), first9: f9.length ? (f9.reduce((a, t) => a + t.score, 0) / f9.reduce((a, t) => a + t.dartsThrown, 0)) * 3 : null,
    darts, outPct: chances ? (outs.length / chances) * 100 : null, outs: outs.length, chances, atD,
    s180: sc.filter(t => t.score === 180).length, s140: sc.filter(t => t.score >= 140).length, s100: sc.filter(t => t.score >= 100).length,
    high: sc.length ? Math.max(...sc.map(t => t.score)) : null, highOut: outs.length ? Math.max(...outs.map(t => t.score)) : null,
    bestLeg: legDarts.length ? Math.min(...legDarts) : null,
  }
}

// Wedstrijdstatistieken: solo als tegels, met tegenstander naast elkaar.
function MatchStats({ view, solo, names }) {
  const me = sideStats(view.turns, 'me')
  const f = (v, d = 1) => (v == null ? '–' : typeof v === 'number' && d ? v.toFixed(d) : v)
  const rows = [
    ['Gemiddelde', s => f(s.avg), s => s.avg ?? 0],
    ['First 9', s => f(s.first9), s => s.first9 ?? 0],
    ['Uitgooi-%', s => (s.outPct == null ? '–' : `${Math.round(s.outPct)}% (${s.outs}/${s.chances})`), s => s.outPct ?? 0],
    ['Dubbels raak / gegooid', s => `${s.outs} / ${s.atD}`, null],
    ['Beste leg', s => (s.bestLeg ? `${s.bestLeg} dts` : '–'), s => -(s.bestLeg ?? 999)],
    ['Hoogste uitgooi', s => f(s.highOut, 0), s => s.highOut ?? 0],
    ['Hoogste beurt', s => f(s.high, 0), s => s.high ?? 0],
    ["180's", s => s.s180, s => s.s180],
    ['140+', s => s.s140, s => s.s140],
    ['100+', s => s.s100, s => s.s100],
    ['Darts', s => s.darts, null],
  ]
  if (solo) {
    return <div className="detail" style={{ marginTop: 8 }}>{rows.slice(0, 9).map(([k, v]) => <div key={k}><b>{v(me)}</b><span>{k.toLowerCase()}</span></div>)}</div>
  }
  const opp = sideStats(view.turns, 'opp')
  return (
    <>
      <div className="muted center" style={{ marginTop: 4 }}>Stand {view.summary.legsMe} – {view.summary.legsOpp}</div>
      <table className="vs">
        <thead><tr><th>{names.me}</th><th></th><th>{names.opp}</th></tr></thead>
        <tbody>{rows.map(([k, v, cmp]) => {
          const a = cmp?.(me), b = cmp?.(opp)
          return <tr key={k}><td className={cmp && a > b ? 'better' : ''}>{v(me)}</td><th>{k}</th><td className={cmp && b > a ? 'better' : ''}>{v(opp)}</td></tr>
        })}</tbody>
      </table>
    </>
  )
}

function FinishInfo({ info, onDart }) {
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

// Beurten in de huidige leg, per kant (laatste 8).
function LegTurns({ turns, sides, onEdit, canEdit = () => true }) {
  if (!turns.length) return null
  return (
    <div className={`legturns ${sides.length === 1 ? 'solo' : ''}`} aria-label="Beurten deze leg">
      {sides.map(s => (
        <div key={s} className="legturns-col">
          {turns.filter(t => t.side === s).slice(-8).map(t => (
            onEdit && canEdit(t)
              ? <button key={t.seq} type="button" className={`ts ${t.isBust ? 'bust' : t.isCheckout ? 'out' : t.score >= 100 ? 'high' : ''}`} onClick={() => onEdit(t)} aria-label={`Beurt ${t.isBust ? 'bust' : t.score} corrigeren`}>{t.isBust ? 'bust' : t.score}</button>
              : <span key={t.seq} className={`ts ${t.isBust ? 'bust' : t.isCheckout ? 'out' : t.score >= 100 ? 'high' : ''}`}>{t.isBust ? 'bust' : t.score}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

// Fysiek toetsenbord (laptop/tablet met toetsenbord) naast de knoppen.
function useKeys(handler, active = true) {
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
// Snelscores, Uit/Bust in één tik, en (optioneel) rest invoeren i.p.v. gegooid.
function TotalPad({ remaining, doubleOut, onSubmit, disabled }) {
  const prefs = loadPrefs()
  const [val, setVal] = useState('')
  const [typing, setTyping] = useState(prefs.typing === 'rest' ? 'rest' : 'scored')
  const [ask, setAsk] = useState(null) // { kind: 'finish', score, min, darts? } | { kind: 'double', input, range }
  const [msg, setMsg] = useState('')
  const typed = val === '' ? null : parseInt(val, 10)
  const score = typed == null ? null : typing === 'rest' ? remaining - typed : typed
  const check = score == null ? null : typing === 'rest' && typed > remaining ? { ok: false, error: `Rest kan niet hoger zijn dan ${remaining}.` } : checkTotalInput(score, remaining, doubleOut)
  const quick = (prefs.quick?.length ? prefs.quick : [0, 26, 41, 45, 60, 81, 85, 100, 140, 180]).slice(0, 10)
  const canOut = remaining <= 180 && canCheckout(remaining, doubleOut) && checkTotalInput(remaining, remaining, doubleOut).ok
  const bust = bustScore(remaining, doubleOut)

  const commit = input => { vibrate(15); onSubmit({ mode: 'total', at: new Date().toISOString(), ...input }) }
  const askDoubles = input => {
    const range = doubleDartsRange(remaining, input, doubleOut)
    if (range.max === 0) return commit({ ...input, dartsAtDouble: 0 })
    if (range.min === range.max) return commit({ ...input, dartsAtDouble: range.min })
    setAsk({ kind: 'double', input, range })
  }
  const send = (n = score) => {
    if (n == null) return
    if (typing === 'rest' && n === score && typed > remaining) { setMsg(check.error); return }
    const c = checkTotalInput(n, remaining, doubleOut)
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
    : <span className="muted">{typing === 'rest' ? 'Typ wat er over is' : 'Typ je score of tik een snelscore'}</span>

  return (
    <div className="pad-wrap">
      <div className="display-row">
        <button type="button" className={`typing ${typing}`} onClick={toggleTyping} title="Wissel: gegooide score of rest invoeren (toets R)">{typing === 'rest' ? 'rest' : 'gegooid'}</button>
        <div className="display" aria-live="polite">{val === '' ? <span className="muted">{typing === 'rest' ? 'rest' : 'score'}</span> : val}</div>
      </div>
      <div className="status small center">{status}</div>
      <div className="quick">{quick.map(q => <button key={q} className="key" onClick={() => send(q)} disabled={q > remaining || (doubleOut && remaining - q === 1)}>{q}</button>)}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} className="key" onClick={() => press(d)}>{d}</button>)}
        <button className="key small" onClick={() => { setVal(v => v.slice(0, -1)); setMsg('') }} aria-label="Wissen">⌫</button>
        <button className="key" onClick={() => press('0')}>0</button>
        <button className="key send" onClick={() => send()} disabled={score == null}>OK</button>
      </div>
      <div className="grid2">
        <button className="key small bust" onClick={() => send(bust)} disabled={bust == null}>Bust</button>
        <button className="key small out" onClick={() => send(remaining)} disabled={!canOut}>Uit ({remaining})</button>
      </div>
    </div>
  )
}

// ── Invoer per dart ─────────────────────────────────────────────────────────
// Snelle darts (T20, 20, …), de uitgooiroute is aantikbaar, en de dubbel waar je op staat licht op.
const QUICK_DARTS = [{ m: 3, n: 20 }, { m: 1, n: 20 }, { m: 1, n: 1 }, { m: 1, n: 5 }, { m: 3, n: 19 }, { m: 1, n: 19 }]

function DartPad({ remaining, doubleOut, onSubmit, disabled }) {
  const [darts, setDarts] = useState([])
  const [mult, setMult] = useState(1)
  const [msg, setMsg] = useState('')

  const add = d => {
    const next = [...darts, d]
    const res = evaluateDartsTurn(remaining, next, doubleOut)
    vibrate(10)
    if (!res.error) return onSubmit({ mode: 'darts', at: new Date().toISOString(), darts: next })   // beurt eindigt: uitgooi, bust of derde dart
    if (/Vul de beurt aan/.test(res.error)) { setDarts(next); setMsg(''); setMult(1); return }
    setMsg(res.error)
  }
  let rem = remaining
  const chips = darts.map(d => { const before = rem; rem -= dartPoints(d); return { d, before } })
  const dartsLeft = 3 - darts.length
  const info = finishInfo(rem, doubleOut, dartsLeft)
  const dt = doubleOut ? doubleTarget(rem) : null
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
          <div key={i} className={`dartchip ${chips[i] ? 'set' : ''} ${i === darts.length ? 'next' : ''}`}>
            <b>{chips[i] ? dartLabelShort(chips[i].d) : '–'}</b>
            <span className="muted small">{chips[i] ? `${dartPoints(chips[i].d)} pt` : `dart ${i + 1}`}</span>
          </div>
        ))}
      </div>
      <div className="status small center">{msg ? <span className="warn">{msg}</span> : <span className="muted">rest <b className="restnum">{rem}</b>{darts.length ? ` · nog ${dartsLeft} dart${dartsLeft > 1 ? 's' : ''}` : ''}</span>}</div>
      {info && <FinishInfo info={info} onDart={add} />}
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
      {darts.length > 0 && (
        <button className="btn block" onClick={() => onSubmit({ mode: 'darts', at: new Date().toISOString(), darts: padDarts(remaining, darts, doubleOut) })}>Beurt klaar (rest = mis)</button>
      )}
    </div>
  )
}
