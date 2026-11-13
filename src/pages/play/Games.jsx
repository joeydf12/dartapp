// Speelschermen voor de trainings- en feestspellen.
import React, { useState } from 'react'
import { Card } from '../../components/ui.jsx'
import DartInput from '../../components/DartInput.jsx'
import { playerName } from '../../lib/model.js'
import { turnRules } from '../../lib/darts/x01rules.js'
import { ResultCard, PlayersBar, useDartTurn, DartChips, dartLabelShort } from './Shared.jsx'
import { TotalPad, DartPad, FinishInfo, finishInfo } from './x01pads.jsx'

const tName = (n, need) => (n === 25 ? (need === 'double' || need === 'treble' ? 'Bull' : 'Bull/25') : `${need === 'double' ? 'D' : need === 'treble' ? 'T' : ''}${n}`)
const NEED_LABEL = { any: 'elk vak telt', single: 'alleen single', double: 'alleen dubbel', treble: 'alleen treble' }

function Footer({ game, undoLast, onBack, extra }) {
  return (
    <div className="row between">
      <button className="btn" onClick={() => { onBack?.(); undoLast() }} disabled={!game.inputs.length}>↶ Vorige beurt</button>
      {extra}
    </div>
  )
}

// ── Around the Clock / Doubles Training ─────────────────────────────────────
export function TargetsPlay({ game, view, apply, undoLast, rematch, err, user, done }) {
  const names = view.players.map(p => playerName(p, user))
  const turn = useDartTurn(game, apply)
  const raw = (turn.live || view).raw
  const cur = view.current
  const target = cur != null ? raw.targets[raw.progress[cur]] : null
  const botTurn = view.currentBot != null
  const need = raw.need
  const hl = target == null ? null : { m: need === 'double' ? 2 : need === 'treble' ? (target === 25 ? 2 : 3) : 1, n: target }
  return (
    <>
      <div className="muted small center">{raw.targets.length} doelen · {NEED_LABEL[need]}</div>
      <PlayersBar view={view} names={names} value={i => (raw.targets[raw.progress[i]] != null ? tName(raw.targets[raw.progress[i]], need) : '✓')} sub={i => `${raw.progress[i]}/${raw.targets.length} · ${raw.darts[i]} darts`} />
      <div className="progress"><span style={{ width: `${(raw.progress[cur ?? 0] / raw.targets.length) * 100}%` }} /></div>
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} names={names} done={done} undoLast={undoLast} rematch={rematch}
          extra={<TargetsSummary raw={view.raw} names={names} />} />
      ) : (
        <>
          <div className="hint center">{botTurn ? `🤖 ${names[cur]} gooit…` : `Gooi op ${tName(target, need)}`}</div>
          <div className={botTurn ? 'overlay' : ''}>
            <DartChips darts={turn.darts} />
            <div className="grid2" style={{ margin: '8px 0' }}>
              <button className="key hit" onClick={() => turn.add(hl)}>Raak {tName(target, need)}</button>
              <button className="key miss" onClick={() => turn.add({ m: 0, n: 0 })}>Mis</button>
            </div>
            <details className="more-input"><summary>Andere dart invoeren (bord / knoppen)</summary>
              <DartInput onDart={turn.add} onBack={turn.back} canBack={turn.darts.length > 0} highlight={hl} />
            </details>
            <div className="grid2" style={{ marginTop: 8 }}>
              <button className="btn" onClick={turn.back} disabled={!turn.darts.length}>⌫ dart</button>
              <button className="btn" onClick={turn.end} disabled={!turn.darts.length}>Beurt klaar</button>
            </div>
          </div>
          <Footer game={game} undoLast={undoLast} onBack={turn.reset} />
        </>
      )}
    </>
  )
}

function TargetsSummary({ raw, names }) {
  const me = raw.players.findIndex(p => p.type === 'me')
  const pt = raw.perTarget
  const worst = Object.entries(pt).map(([t, o]) => ({ t: Number(t), pct: o.hit / o.attempted, ...o })).sort((a, b) => a.pct - b.pct).slice(0, 3)
  return (
    <>
      <div className="detail" style={{ marginTop: 8 }}>
        <div><b>{raw.darts[me]}</b><span>darts</span></div>
        <div><b>{raw.darts[me] ? Math.round((raw.hits[me] / raw.darts[me]) * 100) : 0}%</b><span>raak</span></div>
        <div><b>{raw.progress[me]}/{raw.targets.length}</b><span>gehaald</span></div>
      </div>
      {worst.length > 0 && <div className="tipline">Lastigst: {worst.map(w => `${tName(w.t, raw.need)} (${w.hit}/${w.attempted})`).join(', ')}</div>}
      {names.length > 1 && <div className="muted small">{names.map((nm, i) => `${nm}: ${raw.progress[i]}/${raw.targets.length}`).join(' · ')}</div>}
    </>
  )
}

// ── Singles Training / Shanghai ─────────────────────────────────────────────
export function RoundsPlay({ game, view, apply, undoLast, rematch, err, user, done }) {
  const names = view.players.map(p => playerName(p, user))
  const turn = useDartTurn(game, apply)
  const raw = view.raw
  const cur = view.current
  const target = raw.target
  const botTurn = view.currentBot != null
  const shanghai = raw.scoring === 'shanghai'
  const tl = n => (n === 25 ? 'Bull' : n)
  const pts = d => (d.m > 0 && d.n === target ? (shanghai ? (target === 25 ? 25 : target) * d.m : d.m) : 0)
  return (
    <>
      <div className="muted small center">{shanghai ? 'Shanghai' : 'Singles Training'} · ronde {raw.round} van {raw.rounds.length}{shanghai ? ' · S+D+T in één ronde = winst' : ' · single 1 · dubbel 2 · treble 3'}</div>
      <PlayersBar view={view} names={names} value={i => raw.score[i]} sub={i => `${raw.hits[i]} raak`} />
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} names={names} done={done} undoLast={undoLast} rematch={rematch}
          extra={<div className="muted">{view.turns.some(t => t.shanghai) ? '🀄 Shanghai!' : names.map((nm, i) => `${nm}: ${raw.score[i]}`).join(' · ')}</div>} />
      ) : (
        <>
          <div className="hint center">{botTurn ? `🤖 ${names[cur]} gooit…` : `Gooi op de ${tl(target)}`}</div>
          <div className={botTurn ? 'overlay' : ''}>
            <DartChips darts={turn.darts} label={d => (d.m === 0 || d.n !== target ? 'Mis' : `${['', 'S', 'D', 'T'][d.m]}${tl(target)} · ${pts(d)}`)} />
            <div className="grid4" style={{ margin: '8px 0' }}>
              <button className="key miss" onClick={() => turn.add({ m: 0, n: 0 })}>Mis</button>
              {[1, 2, 3].map(m => <button key={m} className="key hit" onClick={() => turn.add({ m: target === 25 ? Math.min(m, 2) : m, n: target })} disabled={target === 25 && m === 3}>{['', 'S', 'D', 'T'][m]}{tl(target)}</button>)}
            </div>
            <div className="grid2">
              <button className="btn" onClick={turn.back} disabled={!turn.darts.length}>⌫ dart</button>
              <button className="btn" onClick={() => { const d = [...turn.darts]; while (d.length < 3) d.push({ m: 0, n: 0 }); apply({ darts: d }); turn.reset() }} disabled={!turn.darts.length}>Beurt klaar (rest mis)</button>
            </div>
          </div>
          <Footer game={game} undoLast={undoLast} onBack={turn.reset} />
        </>
      )}
    </>
  )
}

// ── Score Training ──────────────────────────────────────────────────────────
export function ScorePlay({ game, view, apply, undoLast, rematch, err, user, done, finish }) {
  const names = view.players.map(p => playerName(p, user))
  const raw = view.raw
  const rules = turnRules(999, { out: 'straight' })
  return (
    <>
      <div className="muted small center">Score Training · {raw.rounds ? `ronde ${Math.min(raw.round, raw.rounds)} van ${raw.rounds}` : `ronde ${raw.round} (onbeperkt)`}</div>
      <PlayersBar view={view} names={names} value={i => (raw.avg[i] == null ? '–' : raw.avg[i].toFixed(1))} sub={i => `${raw.points[i]} punten · gem.`} />
      <ScoreStrip turns={view.turns} />
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} names={names} done={done} undoLast={undoLast} rematch={rematch}
          extra={<div className="detail" style={{ marginTop: 8 }}>
            <div><b>{raw.avg[0]?.toFixed(1) ?? '–'}</b><span>gemiddelde</span></div>
            <div><b>{Math.max(0, ...view.turns.filter(t => t.player === 0).map(t => t.score))}</b><span>hoogste</span></div>
            <div><b>{view.turns.filter(t => t.player === 0 && t.score >= 100).length}</b><span>100+</span></div>
          </div>} />
      ) : (
        <>
          {names.length > 1 && <div className="muted small center">Aan de beurt: <b>{names[view.current]}</b></div>}
          <TotalPad key={view.turns.length} remaining={999} rules={{ ...rules, canOut: false, bust: () => null, doubleRange: () => ({ min: 0, max: 0 }) }} onSubmit={inp => apply({ score: inp.score })} simple />
          <div className="row between">
            <button className="btn" onClick={undoLast} disabled={!game.inputs.length}>↶ Ongedaan</button>
            {!raw.rounds && <button className="btn primary" onClick={finish} disabled={!game.inputs.length}>✓ Klaar, opslaan</button>}
          </div>
        </>
      )}
    </>
  )
}
function ScoreStrip({ turns }) {
  if (!turns.length) return null
  return <div className="legturns solo"><div className="legturns-col">{turns.slice(-12).map(t => <span key={t.seq} className={`ts ${t.score >= 100 ? 'high' : ''}`}>{t.score}</span>)}</div></div>
}

// ── Uitgooi-trainingen ──────────────────────────────────────────────────────
const CO_TITLE = { checkout121: '121 Checkout', checkout170: '170 Checkout', catch40: 'Catch 40', random_checkout: 'Random Checkout' }
export function CheckoutPlay({ game, view, apply, undoLast, rematch, err, done }) {
  const raw = view.raw
  const [entry, setEntry] = useState(game.config.entry || 'total')
  const rules = turnRules(raw.remaining, { out: 'double' })
  const s = raw.summary
  const last = raw.attempts[raw.attempts.length - 1]
  return (
    <>
      <div className="muted small center">{CO_TITLE[game.kind]} · poging {Math.min(raw.attempts.length + 1, raw.total)} van {raw.total} · {raw.visits * 3} darts per poging</div>
      <div className="board solo">
        <div className="side active">
          <div className="name">Uitgooien: {raw.target}</div>
          <div className="rem">{raw.remaining}</div>
          <div className="meta">beurt {raw.visit} van {raw.visits} · nog {raw.dartsLeft} darts</div>
        </div>
      </div>
      <div className="attempts">{raw.attempts.slice(-12).map((a, i) => <span key={i} className={`ts ${a.success ? 'out' : 'bust'}`} title={`${a.target}: ${a.success ? `uit in ${a.darts}` : 'mis'}`}>{a.target}{a.success ? '✓' : '✗'}</span>)}</div>
      {last && !view.finished && <div className={`small center ${last.success ? 'good' : 'warn'}`}>{last.success ? `✓ ${last.target} uit in ${last.darts} darts` : `✗ ${last.target} niet gelukt`}{game.kind === 'checkout121' ? ` → nu ${raw.target}` : ''}</div>}
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} done={done} undoLast={undoLast} rematch={rematch}
          extra={<div className="detail" style={{ marginTop: 8 }}>
            <div><b>{s.successes}/{s.attempts}</b><span>gelukt</span></div>
            <div><b>{s.pct == null ? '–' : `${Math.round(s.pct * 100)}%`}</b><span>succes</span></div>
            <div><b>{game.kind === 'catch40' ? s.points : s.highest ?? '–'}</b><span>{game.kind === 'catch40' ? 'punten (max 120)' : 'hoogste'}</span></div>
            <div><b>{s.avgDarts?.toFixed(1) ?? '–'}</b><span>darts per uitgooi</span></div>
          </div>} />
      ) : (
        <>
          {entry === 'total' && <FinishInfo info={finishInfo(raw.remaining, 'double', 3) || { kind: 'setup', text: 'Geen route: zet een dubbel klaar.' }} />}
          {entry === 'total'
            ? <TotalPad key={view.turns.length} remaining={raw.remaining} rules={rules} onSubmit={apply} />
            : <DartPad key={view.turns.length} remaining={raw.remaining} rules={rules} onSubmit={apply} />}
          <div className="row between">
            <button className="btn" onClick={undoLast} disabled={!game.inputs.length}>↶ Ongedaan</button>
            <button className="btn ghost small" onClick={() => setEntry(entry === 'total' ? 'darts' : 'total')}>{entry === 'total' ? '🎯 Per dart' : '🔢 Totaal'}</button>
          </div>
        </>
      )}
    </>
  )
}

// ── Halve-It ────────────────────────────────────────────────────────────────
export function HalvePlay({ game, view, apply, undoLast, rematch, err, user, done }) {
  const names = view.players.map(p => playerName(p, user))
  const raw = view.raw
  const [val, setVal] = useState('')
  const round = raw.round
  const send = s => { setVal(''); apply({ score: s }) }
  return (
    <>
      <div className="muted small center">Halve-It · ronde {Math.min(raw.roundNo, raw.rounds.length)} van {raw.rounds.length}</div>
      <PlayersBar view={view} names={names} value={i => raw.total[i]} sub={i => `${raw.ok[i]} gehaald · ${raw.fails[i]}× gehalveerd`} />
      <div className="halve-rounds">{raw.rounds.map((r, i) => <span key={r.key} className={`pill ${i === raw.roundNo - 1 && !view.finished ? 'hi' : ''}`}>{r.label}</span>)}</div>
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} names={names} done={done} undoLast={undoLast} rematch={rematch}
          extra={<div className="muted">{names.map((nm, i) => `${nm}: ${raw.total[i]}`).join(' · ')}</div>} />
      ) : (
        <Card title={`${names[view.current]}: ${round.label}`}>
          {round.hint && <div className="muted small" style={{ marginBottom: 8 }}>{round.hint}</div>}
          {round.exact != null ? (
            <div className="grid2">
              <button className="key hit" onClick={() => send(round.exact)}>Gehaald (+{round.exact})</button>
              <button className="key miss" onClick={() => send(0)}>Niet → halveren</button>
            </div>
          ) : (
            <>
              <div className="muted small">Punten die je in deze ronde op het doel gooide (0 = niets geraakt, je totaal halveert).</div>
              <div className="display" style={{ margin: '8px 0' }}>{val || <span className="muted">punten</span>}</div>
              <div className="pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} className="key" onClick={() => setVal(v => (v.length >= 3 ? v : v === '0' ? d : v + d))}>{d}</button>)}
                <button className="key small" onClick={() => setVal(v => v.slice(0, -1))}>⌫</button>
                <button className="key" onClick={() => setVal(v => (v.length >= 3 ? v : v + '0'))}>0</button>
                <button className="key send" onClick={() => send(parseInt(val || '0', 10))}>OK</button>
              </div>
              <button className="key small miss block" style={{ width: '100%', marginTop: 8 }} onClick={() => send(0)}>Niets geraakt → halveren</button>
            </>
          )}
        </Card>
      )}
      {!view.finished && <Footer game={game} undoLast={undoLast} />}
    </>
  )
}

// ── Killer ──────────────────────────────────────────────────────────────────
export function KillerPlay({ game, view, apply, undoLast, rematch, err, user, done }) {
  const names = view.players.map(p => playerName(p, user))
  const turn = useDartTurn(game, apply)
  const raw = (turn.live || view).raw
  const cur = view.current
  const botTurn = view.currentBot != null
  const hearts = l => '❤️'.repeat(Math.max(0, l)) + '🖤'.repeat(Math.max(0, (game.config.lives || 3) - l))
  return (
    <>
      <div className="muted small center">Killer · raak je eigen dubbel om killer te worden</div>
      <div className="killer-list">
        {view.players.map((p, i) => (
          <div key={i} className={`killer-row ${cur === i ? 'active' : ''} ${raw.lives[i] <= 0 ? 'dead' : ''}`}>
            <span className="kn">D{raw.numbers[i]}</span>
            <span className="kname">{p.type === 'bot' ? '🤖 ' : ''}{names[i]}{raw.killer[i] && raw.lives[i] > 0 ? ' 🔪' : ''}</span>
            <span className="klives" aria-label={`${raw.lives[i]} levens`}>{hearts(raw.lives[i])}</span>
          </div>
        ))}
      </div>
      {err && <div className="err">{err}</div>}
      {view.finished ? (
        <ResultCard game={game} view={view} names={names} done={done} undoLast={undoLast} rematch={rematch} />
      ) : (
        <>
          <div className="hint center">{botTurn ? `🤖 ${names[cur]} gooit…` : raw.killer[cur] ? `${names[cur]} is killer: raak de dubbel van een ander` : `${names[cur]}: raak D${raw.numbers[cur]} om killer te worden`}</div>
          <div className={botTurn ? 'overlay' : ''}>
            <DartChips darts={turn.darts} label={d => (d.m === 2 ? `D${d.n}` : 'Mis')} />
            <div className="dartgrid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 8 }}>
              {view.players.map((p, i) => raw.lives[i] > 0 && (
                <button key={i} className={`key ${i === cur ? 'target' : ''}`} onClick={() => turn.add({ m: 2, n: raw.numbers[i] })}>D{raw.numbers[i]}<small style={{ display: 'block', fontSize: '.6rem' }}>{names[i]}</small></button>
              ))}
              <button className="key miss" onClick={() => turn.add({ m: 0, n: 0 })}>Mis</button>
            </div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <button className="btn" onClick={turn.back} disabled={!turn.darts.length}>⌫ dart</button>
              <button className="btn" onClick={turn.end} disabled={!turn.darts.length}>Beurt klaar</button>
            </div>
          </div>
          <Footer game={game} undoLast={undoLast} onBack={turn.reset} />
        </>
      )}
    </>
  )
}

export { dartLabelShort }
