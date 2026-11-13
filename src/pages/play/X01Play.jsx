// X01 voor 1–6 spelers: scorebord, invoer (totaal / per dart / bord / spraak),
// beurt corrigeren, wedstrijdstats, caller.
import React, { useEffect, useRef, useState } from 'react'
import { doubleTarget } from '../../lib/darts/rules.js'
import { turnRules, canFinish, OUT_LABEL, IN_LABEL } from '../../lib/darts/x01rules.js'
import { Card } from '../../components/ui.jsx'
import { savePrefs, loadPrefs } from '../../lib/store.js'
import { playerName } from '../../lib/model.js'
import { ResultCard, dartLabelShort } from './Shared.jsx'
import { say, callX01 } from '../../lib/caller.js'
import { TotalPad, DartPad, FinishInfo, finishInfo, dLabel, vibrate } from './x01pads.jsx'

const avg3 = (turns, p) => {
  const own = turns.filter(t => t.player === p)
  const darts = own.reduce((a, t) => a + t.dartsThrown, 0)
  return darts ? (own.reduce((a, t) => a + t.score, 0) / darts) * 3 : null
}
const tsClass = t => `ts ${t.isBust ? 'bust' : t.isCheckout ? 'out' : t.score >= 100 ? 'high' : ''}`

export default function X01Play({ game, view, apply, undoLast, replace, rematch, err, user, done, setGame }) {
  const raw = view.raw
  const players = view.players
  const n = players.length
  const solo = n === 1
  const leg = raw.currentLeg
  const current = view.current
  const botTurn = view.currentBot != null
  const remNow = current != null ? raw.remaining[current] : 0
  const entry = game.config.entry || 'total'
  const last = view.turns[view.turns.length - 1]
  const legTurns = view.turns.filter(t => t.legNumber === leg.number)
  const [editing, setEditing] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const names = players.map(p => playerName(p, user))
  const rulesFor = (rem, p) => turnRules(rem, { out: raw.out, in: raw.in, isIn: raw.isIn[p] })
  const rules = current != null ? rulesFor(remNow, current) : null

  const setEntry = e => { savePrefs({ entry: e }); setGame({ ...game, config: { ...game.config, entry: e } }) }
  const info = !view.finished && entry === 'total' && current != null ? finishInfo(remNow, raw.out, 3, raw.isIn[current]) : null
  const canEdit = t => players[t.player]?.type !== 'bot'
  const dartsInLeg = p => legTurns.filter(t => t.player === p).reduce((a, t) => a + t.dartsThrown, 0)

  // Caller + trillen na elke nieuwe beurt.
  const seen = useRef(view.turns.length)
  useEffect(() => {
    if (view.turns.length <= seen.current) { seen.current = view.turns.length; return }
    seen.current = view.turns.length
    const t = view.turns[view.turns.length - 1]
    if (t?.isBust) vibrate([40, 60, 40])
    if (!loadPrefs().sound) return
    const nextRem = current != null ? raw.remaining[current] : null
    say(callX01(t, { gameShot: view.finished, nextRemaining: nextRem, nextOnFinish: raw.out !== 'straight' && nextRem != null && nextRem <= 170 && canFinish(nextRem, raw.out) && !botTurn }))
  }, [view.turns.length])

  const legMsg = last?.isCheckout && !view.finished
    ? `${names[last.player]} gooit ${last.score} uit · leg in ${view.turns.filter(t => t.legNumber === last.legNumber && t.player === last.player).reduce((a, t) => a + t.dartsThrown, 0)} darts`
    : null
  const format = [raw.startScore, raw.setsToWin > 1 ? `first to ${raw.setsToWin} sets (${raw.legsToWin} legs)` : solo ? `${raw.legsToWin} leg${raw.legsToWin > 1 ? 's' : ''}` : `first to ${raw.legsToWin}`, raw.in !== 'straight' ? IN_LABEL[raw.in] : null, OUT_LABEL[raw.out]].filter(Boolean).join(' · ')

  return (
    <>
      <div className="muted small center">{format}</div>
      <div className={`board ${solo ? 'solo' : n > 2 ? 'multi' : ''}`}>
        {players.map((pl, p) => {
          const rem = raw.remaining[p]
          const dt = raw.out === 'double' && raw.isIn[p] ? doubleTarget(rem) : null
          const own = legTurns.filter(t => t.player === p)
          return (
            <div key={p} className={`side ${current === p ? 'active' : ''}`}>
              <div className="name">{leg.starter === p && !solo && <span className="starter" title="Begon deze leg">●</span>}{pl.type === 'bot' ? '🤖 ' : ''}{names[p]}</div>
              <div className="rem">{rem}</div>
              {!raw.isIn[p] ? <div className="ondouble warnbg">nog niet in</div>
                : dt && !view.finished ? <div className="ondouble">op {dLabel(dt)}</div>
                : <div className="meta">gem. {avg3(view.turns, p)?.toFixed(1) ?? '–'} · {dartsInLeg(p)} dts</div>}
              {!solo && <div className="legs">{raw.setsToWin > 1 && <><span title="sets">{raw.setsWon[p]}</span><span className="muted small"> s · </span></>}{raw.legsInSet[p]} <span className="muted small">{raw.setsToWin > 1 ? 'l' : `/ ${raw.legsToWin}`}</span></div>}
              {solo && <div className="meta">leg {leg.number} van {raw.legsToWin * raw.setsToWin}</div>}
              {n > 2 && own.length > 0 && <div className="mini-turns">{own.slice(-3).map(t => <span key={t.seq} className={tsClass(t)}>{t.isBust ? 'B' : t.score}</span>)}</div>}
            </div>
          )
        })}
      </div>

      {n <= 2 && <LegTurns turns={legTurns} players={players} onEdit={view.finished ? null : setEditing} canEdit={canEdit} />}
      {legMsg && <div className="ok center small">🎯 {legMsg}</div>}
      {err && <div className="err">{err}</div>}

      {view.finished ? (
        <ResultCard game={game} view={view} names={names} done={done} undoLast={undoLast} rematch={rematch}
          extra={<MatchStats view={view} names={names} />} />
      ) : editing ? (
        <Card title={`Beurt corrigeren (was ${editing.isBust ? 'bust' : editing.score})`} className="ask">
          <div className="muted small">{names[editing.player]} · leg {editing.legNumber} · rest vooraf {editing.remainingBefore}. Vul de juiste score in.</div>
          <TotalPad remaining={editing.remainingBefore} rules={rulesFor(editing.remainingBefore, editing.player)} onSubmit={inp => { if (replace(editing.id, inp)) setEditing(null) }} />
          <button className="btn ghost block" onClick={() => setEditing(null)}>Annuleren</button>
        </Card>
      ) : (
        <>
          {botTurn ? <div className="hint center" aria-live="polite">🤖 {names[current]} gooit…</div> : (
            <>
              {!solo && <div className="muted small center">Aan de beurt: <b>{names[current]}</b></div>}
              {info && <FinishInfo info={info} />}
            </>
          )}
          <div className={botTurn ? 'overlay' : ''}>
            {entry === 'total'
              ? <TotalPad key={view.turns.length} remaining={remNow} rules={rules} onSubmit={apply} disabled={botTurn} />
              : <DartPad key={view.turns.length} remaining={remNow} rules={rules} onSubmit={apply} disabled={botTurn} />}
          </div>
          {last && <div className="lastturn small center">Vorige · {names[last.player]}: <b>{last.isBust ? 'bust' : last.score}</b>{last.darts?.length ? <span className="muted"> ({last.darts.map(dartLabelShort).join(' · ')})</span> : null}{canEdit(last) && n <= 2 && <span className="muted"> · tik een score hierboven om te corrigeren</span>}</div>}
          <div className="row between">
            <button className="btn" onClick={undoLast} disabled={!game.inputs.length}>↶ Ongedaan</button>
            <button className="btn ghost small" onClick={() => setShowStats(s => !s)} aria-expanded={showStats}>📊 Stats</button>
            <button className="btn ghost small" onClick={() => setEntry(entry === 'total' ? 'darts' : 'total')}>
              {entry === 'total' ? '🎯 Per dart' : '🔢 Totaal'}
            </button>
          </div>
          {showStats && <Card title="Dit spel"><MatchStats view={view} names={names} /></Card>}
        </>
      )}
    </>
  )
}

// Beurten in de huidige leg (1–2 spelers), aantikbaar om te corrigeren.
function LegTurns({ turns, players, onEdit, canEdit }) {
  if (!turns.length) return null
  return (
    <div className={`legturns ${players.length === 1 ? 'solo' : ''}`} aria-label="Beurten deze leg">
      {players.map((_, p) => (
        <div key={p} className="legturns-col">
          {turns.filter(t => t.player === p).slice(-8).map(t => (
            onEdit && canEdit(t)
              ? <button key={t.seq} type="button" className={tsClass(t)} onClick={() => onEdit(t)} aria-label={`Beurt ${t.isBust ? 'bust' : t.score} corrigeren`}>{t.isBust ? 'bust' : t.score}</button>
              : <span key={t.seq} className={tsClass(t)}>{t.isBust ? 'bust' : t.score}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

// Statistieken van één speler in dit spel.
export function playerStats(turns, p, out = 'double') {
  const own = turns.filter(t => t.player === p)
  const darts = own.reduce((a, t) => a + t.dartsThrown, 0)
  const pts = own.reduce((a, t) => a + t.score, 0)
  const legs = [...new Set(own.map(t => t.legNumber))]
  const f9 = legs.flatMap(l => own.filter(t => t.legNumber === l).slice(0, 3))
  const chances = own.filter(t => t.remainingBefore <= 170 && canFinish(t.remainingBefore, out)).length
  const outs = own.filter(t => t.isCheckout)
  const atD = own.reduce((a, t) => a + (t.dartsAtDouble ?? 0), 0)
  const legDarts = legs.map(l => own.filter(t => t.legNumber === l)).filter(ts => ts.some(t => t.isCheckout)).map(ts => ts.reduce((a, t) => a + t.dartsThrown, 0))
  const sc = own.filter(t => !t.isBust)
  return {
    avg: darts ? (pts / darts) * 3 : null, ppd: darts ? pts / darts : null,
    first9: f9.length ? (f9.reduce((a, t) => a + t.score, 0) / f9.reduce((a, t) => a + t.dartsThrown, 0)) * 3 : null,
    darts, outPct: chances ? (outs.length / chances) * 100 : null, outs: outs.length, chances, atD,
    s180: sc.filter(t => t.score === 180).length, s140: sc.filter(t => t.score >= 140).length, s100: sc.filter(t => t.score >= 100).length,
    high: sc.length ? Math.max(...sc.map(t => t.score)) : null, highOut: outs.length ? Math.max(...outs.map(t => t.score)) : null,
    bestLeg: legDarts.length ? Math.min(...legDarts) : null,
  }
}

// Wedstrijdstatistieken: solo als tegels, met tegenstanders in kolommen.
function MatchStats({ view, names }) {
  const out = view.raw.out
  const st = view.players.map((_, p) => playerStats(view.turns, p, out))
  const f = (v, d = 1) => (v == null ? '–' : typeof v === 'number' && d ? v.toFixed(d) : v)
  const rows = [
    ['Gemiddelde', s => f(s.avg), s => s.avg ?? 0],
    ['First 9', s => f(s.first9), s => s.first9 ?? 0],
    ['PPD', s => f(s.ppd, 2), s => s.ppd ?? 0],
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
  if (st.length === 1) return <div className="detail" style={{ marginTop: 8 }}>{rows.slice(0, 9).map(([k, v]) => <div key={k}><b>{v(st[0])}</b><span>{k.toLowerCase()}</span></div>)}</div>
  const raw = view.raw
  return (
    <>
      <div className="muted center" style={{ marginTop: 4 }}>{raw.setsToWin > 1 ? `Sets ${raw.setsWon.join(' – ')} · ` : ''}Legs {raw.legsWonTotal.join(' – ')}</div>
      <div className="table-scroll">
        <table className="vs">
          <thead><tr><th></th>{names.map((nm, i) => <th key={i}>{nm}</th>)}</tr></thead>
          <tbody>{rows.map(([k, v, cmp]) => {
            const vals = cmp ? st.map(cmp) : null
            const best = vals ? Math.max(...vals) : null
            return <tr key={k}><th>{k}</th>{st.map((s, i) => <td key={i} className={vals && vals[i] === best && vals.filter(x => x === best).length === 1 ? 'better' : ''}>{v(s)}</td>)}</tr>
          })}</tbody>
        </table>
      </div>
    </>
  )
}
