import React, { useMemo, useState } from 'react'
import { useData } from '../lib/data.js'
import { buildStats, profileSummary, fmt, fmtPct, PERIODS, compareKinds, heatCounts } from '../lib/statsAgg.js'
import { bandLabel } from '../lib/darts/stats.js'
import { KINDS, MODE_LABEL, CATS } from '../lib/model.js'
import Dartboard from '../components/Dartboard.jsx'
import { Screen, Card, Stat, Chips, Tabs, dateNl, go } from '../components/ui.jsx'
import { LineChart, BarChart, HBars, DoubleBoard } from '../components/charts.jsx'

const OUT_OPTS = [{ value: 'all', label: 'Elke uitgooi' }, { value: 'double', label: 'Dubbel uit' }, { value: 'master', label: 'Master uit' }, { value: 'straight', label: 'Straight uit' }]
const X01_TABS = [
  { value: 'overview', label: 'Overzicht' }, { value: 'scoring', label: 'Scoren' }, { value: 'finish', label: 'Uitgooien' },
  { value: 'darts', label: 'Per dart' }, { value: 'trend', label: 'Verloop' }, { value: 'records', label: 'Records' }, { value: 'top', label: 'Top 25' },
]
const initials = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
const dLabel = n => (Number(n) === 25 ? 'Bull' : `D${n}`)

export default function Stats({ user }) {
  const { data, err, loading, reload } = useData()
  const [kind, setKind] = useState('all')
  const [out, setOut] = useState('all')
  const [mode, setMode] = useState('all')
  const [period, setPeriod] = useState('all')
  const [startScore, setStartScore] = useState('all')
  const [tab, setTab] = useState('overview')

  const prof = useMemo(() => (data ? profileSummary(data) : null), [data])
  const st = useMemo(() => (data && kind !== 'all' ? buildStats(data, { kind, mode, period, startScore, out }) : null), [data, kind, mode, period, startScore, out])
  const played = useMemo(() => new Set((data?.games || []).map(g => g.kind)), [data])
  const kindOpts = [{ value: 'all', label: 'Alle spellen' }, ...Object.entries(KINDS).filter(([k]) => k === 'x01' || played.has(k)).map(([value, k]) => ({ value, label: k.short }))]
  const modes = kind !== 'all' && KINDS[kind].players[1] > 1 ? ['solo', 'pvp', 'bot'].filter(m => m !== 'bot' || KINDS[kind].bot) : []
  const scores = useMemo(() => [...new Set((data?.games || []).filter(g => g.kind === 'x01').map(g => g.config?.startScore))].sort(), [data])

  return (
    <Screen title="Mijn statistieken" nav right={<button className="btn ghost icon" onClick={reload} aria-label="Verversen" disabled={loading}>{loading ? '…' : '↻'}</button>}>
      {err && <div className={data ? 'banner' : 'err'}>{err}</div>}
      {!data && !err && <div className="skeleton" aria-label="Laden" />}
      {prof && <ProfileHero user={user} p={prof} />}

      {data && (
        <>
          <Tabs tabs={kindOpts} value={kind} onChange={k => { setKind(k); setMode('all'); setTab('overview') }} />
          <div className="filters">
            <Chips small label="Periode" value={period} onChange={setPeriod} options={PERIODS} />
            {modes.length > 0 && <Chips small label="Tegenstander" value={mode} onChange={setMode} options={[{ value: 'all', label: 'Alle' }, ...modes.map(m => ({ value: m, label: MODE_LABEL[m] }))]} />}
            {kind === 'x01' && scores.length > 1 && <Chips small label="Startscore" value={startScore} onChange={setStartScore} options={[{ value: 'all', label: 'Elke start' }, ...scores.map(s => ({ value: String(s), label: String(s) }))]} />}
            {kind === 'x01' && <Chips small label="Uitgooien" value={out} onChange={setOut} options={OUT_OPTS} />}
          </div>
        </>
      )}

      {data && kind === 'all' && <AllOverview data={data} period={period} onPick={k => setKind(k)} />}
      {st && st.empty && (
        <Card><div className="empty">🎯<div>Nog geen worpen met deze filters.</div><button className="btn primary" style={{ marginTop: 12 }} onClick={() => go('/new')}>Speel een spel</button></div></Card>
      )}
      {st && !st.empty && kind === 'x01' && st.stats && (
        <>
          <Tabs tabs={X01_TABS} value={tab} onChange={setTab} />
          {tab === 'overview' && <X01Overview st={st} />}
          {tab === 'scoring' && <X01Scoring st={st} />}
          {tab === 'finish' && <X01Finish st={st} />}
          {tab === 'darts' && <X01Darts st={st} />}
          {tab === 'trend' && <X01Trend st={st} />}
          {tab === 'records' && <X01Records st={st} />}
          {tab === 'top' && <X01Top st={st} />}
        </>
      )}
      {st && !st.empty && kind === 'cricket' && <CricketStats st={st} />}
      {st && !st.empty && (kind === 'around_clock' || kind === 'doubles') && <ClockStats st={st} kind={kind} />}
      {st && !st.empty && (kind === 'singles' || kind === 'shanghai') && <RoundsStats st={st} kind={kind} />}
      {st && !st.empty && kind === 'score_training' && <ScoreStats st={st} />}
      {st && !st.empty && st.co && <CheckoutStats st={st} kind={kind} />}
      {st && !st.empty && kind === 'halve_it' && <HalveStats st={st} />}
      {st && !st.empty && kind === 'killer' && <SimpleOverview st={st} />}
      {st && !st.empty && kind === 'bobs27' && <BobsStats st={st} />}
    </Screen>
  )
}

function ProfileHero({ user, p }) {
  return (
    <section className="hero-card">
      <div className="row">
        <div className="avatar" aria-hidden="true">{initials(user?.displayName)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="hero-name">{user?.displayName}</div>
          <div className="muted small">{p.games} spellen · {p.darts.toLocaleString('nl-NL')} darts gegooid</div>
        </div>
      </div>
      <div className="hero-stats">
        <div><b>{fmt(p.avg3)}</b><span>gemiddelde</span></div>
        <div><b>{fmtPct(p.checkoutPct)}</b><span>uitgooi-%</span></div>
        <div><b>{fmtPct(p.winPct)}</b><span>gewonnen</span></div>
        <div><b>{p.s180}</b><span>180's</span></div>
      </div>
    </section>
  )
}

function Form({ o, form }) {
  if (!o.form.length && !form?.n) return null
  const diff = form?.recentAvg != null && form?.allAvg ? form.recentAvg - form.allAvg : null
  return (
    <Card title="Vorm">
      {form?.n > 0 && (
        <div className="row between" style={{ marginBottom: o.form.length ? 12 : 0 }}>
          <Stat label={`gem. laatste ${form.n} spellen`} value={fmt(form.recentAvg)} />
          {diff != null && <span className={`delta ${diff >= 0 ? 'up' : 'down'}`}>{diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} t.o.v. totaal</span>}
        </div>
      )}
      {o.form.length > 0 && (
        <>
          <div className="formdots" aria-label="Laatste uitslagen">{o.form.map((r, i) => <span key={i} className={r} title={r === 'won' ? 'gewonnen' : 'verloren'}>{r === 'won' ? 'W' : 'V'}</span>)}</div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {o.streak && `${o.streak.kind === 'won' ? 'Winstreeks' : 'Verliesreeks'}: ${o.streak.n}`}{o.bestStreak ? ` · langste winstreeks ${o.bestStreak}` : ''}
          </div>
        </>
      )}
    </Card>
  )
}

function Opponents({ list }) {
  if (!list.length) return null
  return (
    <Card title="Tegen wie">
      <table><thead><tr><th>Tegenstander</th><th className="n">W</th><th className="n">V</th><th className="n">%</th></tr></thead>
        <tbody>{list.map(o => <tr key={o.name}><td>{o.name}</td><td className="n">{o.won}</td><td className="n">{o.lost}</td><td className="n">{fmtPct((o.won / (o.won + o.lost)) * 100)}</td></tr>)}</tbody></table>
    </Card>
  )
}

function X01Overview({ st }) {
  const s = st.stats, o = st.overview
  return (
    <>
      <Card title="Kerncijfers">
        <div className="stats-grid">
          <Stat accent label="3-dart gemiddelde" value={fmt(s.avg3)} />
          <Stat label="first 9" value={fmt(s.first9Avg)} />
          <Stat label="darts per leg" value={fmt(st.legs.avgDarts, 1)} />
          <Stat label="PPD (punten per dart)" value={fmt(st.ppd, 2)} />
          <Stat accent label="uitgooi-% per kans" value={fmtPct(st.checkout.turnPct)} sub={`${s.checkouts}/${st.checkout.chances}`} />
          <Stat label="dubbel-% per dart" value={fmtPct(st.checkout.dartPct)} sub={`${st.checkout.doubleHits}/${st.checkout.doubleDarts}`} />
          <Stat label="hoogste uitgooi" value={s.highestCheckout ?? '–'} />
          <Stat label="180's" value={s.scores180} />
          <Stat label="140+" value={s.scores140Plus} />
          <Stat label="100+" value={s.scores100Plus} />
        </div>
      </Card>
      <Card title="Spellen">
        <div className="stats-grid">
          <Stat label="gespeeld" value={o.games} />
          <Stat label="gewonnen" value={o.won} sub={o.winPct == null ? '' : fmtPct(o.winPct)} />
          <Stat label="verloren" value={o.lost} />
          <Stat label="legs uitgegooid" value={st.legs.won} sub={`van ${st.legs.played}`} />
          <Stat label="beste leg" value={st.legs.best ? `${st.legs.best} dts` : '–'} />
          <Stat label="busts" value={st.bust} sub={fmtPct(st.bustPct)} />
        </div>
      </Card>
      <Form o={o} form={st.form} />
      <Opponents list={st.opponents} />
    </>
  )
}

function X01Scoring({ st }) {
  const s = st.stats
  const [look, setLook] = useState('')
  return (
    <>
      <Card title="Beurten">
        <div className="stats-grid">
          <Stat label="beurten" value={s.turns} />
          <Stat label="hoogste beurt" value={s.highestTurn ?? '–'} />
          <Stat label="laagste beurt" value={s.lowestTurn ?? '–'} />
          <Stat label="last 9" value={fmt(s.last9Avg)} />
          <Stat label="80+" value={s.scores80Plus} />
          <Stat label="60+" value={s.scores60Plus} />
        </div>
      </Card>
      <Card title="Per beurt in de leg">
        <div className="stats-grid two" style={{ marginBottom: 12 }}>
          <Stat accent label="gem. rest na 9 darts" value={fmt(st.extra.after9, 0)} sub={`${st.extra.after9n} legs`} />
          <Stat label="first 9 vs. last 9" value={`${fmt(s.first9Avg)} / ${fmt(s.last9Avg)}`} />
        </div>
        <BarChart label="Gemiddelde score per beurt in de leg" unit=" gem." bars={st.extra.visit.map(v => ({ label: `${v.n}e`, value: Math.round(v.avg), sub: `${v.n}e beurt · ${v.count} legs` }))} />
        <div className="muted small" style={{ marginTop: 6 }}>Zakt je score na de eerste beurten? Dan verlies je focus of ga je te vroeg op een uitgooi spelen.</div>
      </Card>
      {st.extra.perStart.length > 1 && (
        <Card title="Per startscore">
          <table><thead><tr><th>Start</th><th className="n">Spellen</th><th className="n">Gem.</th><th className="n">Darts/leg</th></tr></thead>
            <tbody>{st.extra.perStart.map(p => <tr key={p.start}><td>{p.start}</td><td className="n">{p.games}</td><td className="n">{fmt(p.avg)}</td><td className="n">{fmt(p.legDarts, 1)}</td></tr>)}</tbody></table>
        </Card>
      )}
      <Card title="Verdeling van je beurtscores">
        <BarChart label="Aantal beurten per scorebereik" bars={st.buckets.map(b => ({ label: String(b.from), value: b.count, sub: `${b.from}–${b.to}` }))} />
      </Card>
      <Card title="Hoe vaak minstens …">
        <HBars rows={st.bands.map(b => ({ label: bandLabel(b), value: s.bands[b], text: `${s.bands[b]} · ${fmtPct((s.bands[b] / Math.max(1, s.turns - st.bust)) * 100)}` }))} />
      </Card>
      <Card title="Je meest gegooide scores">
        <HBars rows={st.topScores.map(x => ({ label: String(x.value), value: x.n, text: `${x.n}×` }))} />
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="look">Hoe vaak gooide je precies …</label>
          <div className="row"><input id="look" type="number" inputMode="numeric" min="0" max="180" value={look} onChange={e => setLook(e.target.value)} placeholder="bijv. 26" />
            <b className="lookup">{look === '' ? '' : `${st.countExact(Number(look))}×`}</b></div>
        </div>
      </Card>
    </>
  )
}

function X01Finish({ st }) {
  const s = st.stats, c = st.checkout
  const [pick, setPick] = useState(null)
  const d = pick != null ? s.doubles[pick] : null
  return (
    <>
      <Card title="Uitgooien">
        <div className="stats-grid two">
          <Stat accent label="uitgooi-% per kans" value={fmtPct(c.turnPct)} sub={`${s.checkouts} van ${c.chances} beurten`} />
          <Stat accent label="dubbel-% per dart" value={fmtPct(c.dartPct)} sub={`${c.doubleHits} van ${c.doubleDarts} darts`} />
        </div>
        <details className="explain">
          <summary>Hoe wordt dit geteld?</summary>
          <p><b>Op een dubbel</b> sta je als je rest één dart van uit is: een even getal van 2 t/m 40 (D1–D20) of 50 (bull).
            Elke dart die je gooit terwijl je daar staat, is een <b>dart op de dubbel</b>. Raak je hem, dan ben je uit.</p>
          <p><b>Dubbel-% per dart</b> = geraakte dubbels ÷ darts op de dubbel. <b>Uitgooi-% per kans</b> = uitgegooide beurten ÷ beurten
            die begonnen op een rest die nog in één beurt uit kon (≤ 170, geen bogey-getal).</p>
          <p>Bij invoer per totaal vraagt de app na zo'n beurt hoeveel darts op de dubbel gingen (alleen als dat niet vaststaat).</p>
        </details>
      </Card>
      <Card title="Hoe je uitgooit">
        <div className="stats-grid">
          <Stat label="darts op dubbel per uitgooi" value={fmt(st.extra.dartsPerCheckout, 1)} />
          <Stat label="uitgegooid" value={s.checkouts} />
          <Stat label="hoogste uitgooi" value={s.highestCheckout ?? '–'} />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted small" style={{ marginBottom: 6 }}>Uitgooibeurten per aantal gebruikte darts</div>
          <HBars rows={st.extra.byDarts.map(b => ({ label: `${b.n} dart${b.n > 1 ? 's' : ''}`, value: b.count, text: `${b.count}× · ${fmtPct((b.count / Math.max(1, s.checkouts)) * 100)}` }))} />
        </div>
      </Card>
      <Card title="Uitgooi-% per rest">
        <HBars max={100} rows={c.byRange.map(r => ({ label: r.label, value: r.pct ?? 0, text: r.chances ? `${fmtPct(r.pct)} · ${r.hit}/${r.chances}` : '–' }))} />
      </Card>
      <Card title="Dubbelkaart" right={<span className="muted small">tik voor details</span>}>
        {Object.keys(s.doubles).length ? (
          <>
            <DoubleBoard doubles={s.doubles} onPick={setPick} />
            {pick != null && <div className="muted small" style={{ marginTop: 8 }}>{dLabel(pick)}: {d ? `${d.hit} raak van ${d.attempted} darts (${fmtPct((d.hit / d.attempted) * 100)})` : 'nog niet op gegooid'}</div>}
            {s.mostMissedDouble && <div className="tipline">Vaakst gemist: <b>{dLabel(s.mostMissedDouble.target)}</b> ({s.mostMissedDouble.missed}× mis). Oefen deze met Bob's 27 of in een solo-leg.</div>}
          </>
        ) : <div className="muted small">De dubbelkaart vult zich als je <b>per dart</b> invoert (dan weet de app op welke dubbel je stond).</div>}
        {s.doubleUnknown > 0 && <div className="muted small" style={{ marginTop: 6 }}>Bij {s.doubleUnknown} oudere beurt(en) is het aantal darts op de dubbel onbekend.</div>}
      </Card>
      <Card title="Legs">
        <div className="stats-grid">
          <Stat label="gem. darts per leg" value={fmt(st.legs.avgDarts, 1)} />
          <Stat label="beste leg" value={st.legs.best ?? '–'} />
          <Stat label="slechtste leg" value={st.legs.worst ?? '–'} />
        </div>
        {st.legs.won > 0 && <div style={{ marginTop: 12 }}><BarChart label="Legs per aantal darts" unit=" legs" bars={['≤12', '13–15', '16–18', '19–21', '22–24', '25–30', '31+'].map(k => ({ label: k, value: st.legs.dist[k] || 0 }))} /></div>}
      </Card>
      {c.top.length > 0 && (
        <Card title="Je uitgooiers">
          <div className="pills">{c.top.map(x => <span key={x.value} className={`pill ${x.value >= 100 ? 'hi' : ''}`}>{x.value}{x.n > 1 ? <em>×{x.n}</em> : null}</span>)}</div>
        </Card>
      )}
    </>
  )
}

function X01Darts({ st }) {
  const d = st.dartStats
  if (!d) return <Card><div className="empty">🎯<div>Kies bij een spel <b>per dart</b> invoeren. Dan zie je hier hoe vaak je single, dubbel, treble of mis gooit, en waar je darts landen.</div></div></Card>
  const sc = d.scoring
  const counts = {}
  for (const x of d.segments) { if (x.s) counts[`1-${x.n}`] = x.s; if (x.d) counts[`2-${x.n}`] = x.d; if (x.t) counts[`3-${x.n}`] = x.t }
  return (
    <>
      <Card title="Heatmap" right={<span className="muted small">lichter = vaker · tik/hover een vak</span>}>
        <div className="board-wrap"><Dartboard counts={counts} /></div>
      </Card>
      <Card title="Waar landen je darts">
        <div className="stats-grid">
          <Stat label="darts" value={d.total} />
          <Stat label="mis" value={fmtPct((d.miss / d.total) * 100)} sub={`${d.miss}×`} />
          <Stat label="treble" value={fmtPct((d.trebles / d.total) * 100)} sub={`${d.trebles}×`} />
          <Stat label="T20" value={d.t20} />
          <Stat label="T19" value={d.t19} />
          <Stat label="bull" value={d.bulls} sub={`${d.outerBulls}× 25`} />
        </div>
        <div style={{ marginTop: 12 }}>
          <HBars max={d.total} rows={[['Single', d.singles], ['Dubbel', d.doubles], ['Treble', d.trebles], ['Mis', d.miss]].map(([l, v]) => ({ label: l, value: v, text: `${fmtPct((v / d.total) * 100)}` }))} />
        </div>
      </Card>
      {sc.darts > 0 && (
        <Card title="Scoren (rest boven 170)">
          <div className="stats-grid">
            <Stat accent label="in het 20-vak" value={fmtPct((sc.in20 / sc.darts) * 100)} />
            <Stat label="T20 geraakt" value={fmtPct((sc.t20 / sc.darts) * 100)} />
            <Stat label="in 1 of 5" value={fmtPct((sc.neighbours / sc.darts) * 100)} />
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Als je nog niet kunt uitgooien mik je meestal op T20. Veel darts in 1 of 5? Dan trek je links of rechts weg.</div>
        </Card>
      )}
      <Card title="Meest geraakte vakken">
        <HBars rows={d.segments.slice(0, 10).map(x => ({ label: x.n === 25 ? 'Bull' : String(x.n), value: x.total, text: `${x.total} · ${x.t ? `T${x.t} ` : ''}${x.d ? `D${x.d}` : ''}`.trim() }))} />
      </Card>
    </>
  )
}

function X01Trend({ st }) {
  const pg = st.perGame
  return (
    <>
      <Card title="Gemiddelde per spel"><LineChart label="3-dart gemiddelde per spel" points={pg.map(p => ({ y: p.avg3, at: p.at, label: p.label }))} refLine={st.stats.avg3} refLabel="totaal gemiddelde" /></Card>
      <Card title="First 9 per spel"><LineChart label="first 9 per spel" points={pg.map(p => ({ y: p.first9, at: p.at, label: p.label }))} refLine={st.stats.first9Avg} refLabel="totaal first 9" /></Card>
      <Card title="Uitgooi-% per spel"><LineChart label="uitgooi-% per spel" unit="%" digits={0} points={pg.filter(p => p.checkoutPct != null).map(p => ({ y: p.checkoutPct, at: p.at, label: p.label }))} refLine={st.checkout.turnPct} refLabel="totaal" /></Card>
    </>
  )
}

function X01Records({ st }) {
  const r = st.records, s = st.stats
  const row = (label, value, sub) => <div className="record"><span>{label}</span><b>{value}</b>{sub && <em>{sub}</em>}</div>
  return (
    <Card title="Persoonlijke records">
      <div className="records">
        {row('Hoogste gemiddelde (spel)', r.bestAvg ? fmt(r.bestAvg.avg3) : '–', r.bestAvg && `${dateNl(r.bestAvg.at)} · ${r.bestAvg.label}`)}
        {row('Beste first 9', r.bestFirst9 ? fmt(r.bestFirst9.first9) : '–', r.bestFirst9 && dateNl(r.bestFirst9.at))}
        {row('Beste leg', r.bestLeg ? `${r.bestLeg} darts` : '–')}
        {row('Hoogste uitgooi', s.highestCheckout ?? '–')}
        {row('Hoogste beurt', s.highestTurn ?? '–')}
        {row("Meeste 180's in één spel", r.most180 ? r.most180.s180 : '–', r.most180 && dateNl(r.most180.at))}
        {row('Langste winstreeks', st.overview.bestStreak || '–')}
      </div>
    </Card>
  )
}

function CricketStats({ st }) {
  const c = st.cricket
  return (
    <>
      <Card title="Cricket">
        <div className="stats-grid">
          <Stat accent label="marks per ronde (MPR)" value={fmt(c.mpr, 2)} />
          <Stat label="beste MPR (spel)" value={fmt(c.bestMpr, 2)} />
          <Stat label="rondes" value={c.rounds} />
          <Stat label="marks" value={c.marks} />
          <Stat label="punten" value={c.points} />
          <Stat label="snelste solo" value={c.fastestSolo ? `${c.fastestSolo} rondes` : '–'} />
        </div>
      </Card>
      <Card title="MPR per spel"><LineChart label="MPR per spel" digits={2} points={c.perGame.map(p => ({ y: p.mpr, at: p.at }))} refLine={c.mpr} refLabel="totaal" /></Card>
      <Card title="Marks per ronde"><BarChart label="Rondes per aantal marks" unit=" rondes" bars={c.dist.map(d => ({ label: String(d.n), value: d.count, sub: `${d.n} marks` }))} /></Card>
      <SimpleOverview st={st} />
    </>
  )
}

function ClockStats({ st, kind }) {
  const c = st.clock
  const doubles = kind === 'doubles'
  return (
    <>
      <Card title={doubles ? 'Doubles Training' : 'Around the Clock'}>
        <div className="stats-grid">
          <Stat label="uitgespeeld (solo)" value={c.done} />
          <Stat accent label="minste darts" value={c.best ?? '–'} />
          <Stat label="gem. darts" value={fmt(c.avg, 0)} />
          <Stat label="raak-%" value={fmtPct(c.hitPct)} sub={`${c.darts} darts`} />
        </div>
      </Card>
      <Card title="Darts per spel (lager is beter)"><LineChart label="darts per spel" digits={0} points={c.perGame.map(p => ({ y: p.darts, at: p.at }))} refLine={c.avg} /></Card>
      {Object.keys(c.perTarget || {}).length > 0 && (doubles
        ? <Card title="Raak-% per dubbel"><DoubleBoard doubles={c.perTarget} /></Card>
        : <Card title="Raak-% per doel"><HBars max={100} rows={Object.entries(c.perTarget).sort((a, b) => Number(a[0]) - Number(b[0])).map(([t, o]) => ({ label: t === '25' ? 'Bull' : t, value: (o.hit / o.attempted) * 100, text: fmtPct((o.hit / o.attempted) * 100) + ' · ' + o.hit + '/' + o.attempted }))} /></Card>)}
      <SimpleOverview st={st} />
    </>
  )
}

function BobsStats({ st }) {
  const b = st.bobs
  return (
    <>
      <Card title="Bob's 27">
        <div className="stats-grid">
          <Stat label="gespeeld" value={b.games} />
          <Stat accent label="beste score" value={b.best ?? '–'} />
          <Stat label="gemiddeld" value={fmt(b.avg, 0)} />
          <Stat label="uitgespeeld" value={b.completed} />
          <Stat label="dubbel-raak" value={fmtPct(b.hitPct)} />
        </div>
      </Card>
      <Card title="Score per spel"><LineChart label="eindscore per spel" digits={0} points={b.perGame.map(p => ({ y: p.score, at: p.at }))} refLine={b.avg} /></Card>
      <Card title="Dubbelkaart (Bob's 27)"><DoubleBoard doubles={b.doubles} /></Card>
    </>
  )
}

function SimpleOverview({ st }) {
  const o = st.overview
  if (!o.won && !o.lost) return null
  return (
    <>
      <Card title="Uitslagen"><div className="stats-grid"><Stat label="gewonnen" value={o.won} sub={fmtPct(o.winPct)} /><Stat label="verloren" value={o.lost} /><Stat label="langste reeks" value={o.bestStreak} /></div></Card>
      <Opponents list={st.opponents} />
    </>
  )
}

// ── Alle spellen ────────────────────────────────────────────────────────────
function AllOverview({ data, period, onPick }) {
  const rows = useMemo(() => compareKinds(data, KINDS), [data])
  const heat = useMemo(() => heatCounts(data, 'all', period), [data, period])
  return (
    <>
      <Card title="Per spelsoort">
        {rows.length ? (
          <table><thead><tr><th>Spel</th><th className="n">Gespeeld</th><th className="n">Winst</th><th className="n">Laatst</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.kind} className="clickrow" onClick={() => onPick(r.kind)}><td><b>{r.label}</b> <span className="muted small">{CATS[KINDS[r.kind].cat]}</span></td><td className="n">{r.games}</td><td className="n">{fmtPct(r.winPct)}</td><td className="n small">{dateNl(r.last)}</td></tr>)}</tbody></table>
        ) : <div className="muted">Nog geen spellen.</div>}
        <div className="muted small" style={{ marginTop: 6 }}>Tik een spel voor alle details.</div>
      </Card>
      <Card title="Waar landen je darts" right={<span className="muted small">{heat.total} darts · {fmtPct((heat.miss / Math.max(1, heat.total)) * 100)} mis</span>}>
        {heat.total ? <div className="board-wrap"><Dartboard counts={heat.counts} /></div> : <div className="muted small">Kies bij een spel <b>per dart</b> of <b>bord</b> invoeren, dan kleurt hier je bord: hoe lichter, hoe vaker geraakt.</div>}
      </Card>
    </>
  )
}

function X01Top({ st }) {
  const row = (x, i) => <tr key={x.id}><td className="n muted">{i + 1}</td><td>{dateNl(x.at)}<div className="muted small">{x.label}</div></td><td className="n"><b>{fmt(x.avg3)}</b></td><td className="n">{fmt(x.first9)}</td><td className="n">{x.darts}</td></tr>
  const head = <thead><tr><th className="n">#</th><th>Spel</th><th className="n">Gem.</th><th className="n">F9</th><th className="n">Darts</th></tr></thead>
  return (
    <>
      <Card title="Top 25 spellen (gemiddelde)"><div className="table-scroll"><table>{head}<tbody>{st.top25.map(row)}</tbody></table></div></Card>
      {st.bottom25.length > 5 && <Card title="Bottom 25"><div className="table-scroll"><table>{head}<tbody>{st.bottom25.map(row)}</tbody></table></div></Card>}
    </>
  )
}

function RoundsStats({ st, kind }) {
  const r = st.rounds
  return (
    <>
      <Card title={kind === 'shanghai' ? 'Shanghai' : 'Singles Training'}>
        <div className="stats-grid">
          <Stat label="gespeeld" value={r.games} />
          <Stat accent label="beste score" value={r.best ?? '–'} />
          <Stat label="gemiddeld" value={fmt(r.avg, 0)} />
          <Stat label="raak-%" value={fmtPct(r.hitPct)} sub={r.darts + ' darts'} />
          <Stat label="trebles" value={r.trebles} />
          <Stat label="dubbels" value={r.doubles} />
        </div>
      </Card>
      <Card title="Score per spel"><LineChart label="score per spel" digits={0} points={r.perGame.map(p => ({ y: p.score, at: p.at }))} refLine={r.avg} /></Card>
      <SimpleOverview st={st} />
    </>
  )
}

function ScoreStats({ st }) {
  const s = st.score
  return (
    <>
      <Card title="Score Training">
        <div className="stats-grid">
          <Stat accent label="gemiddelde" value={fmt(s.avg)} />
          <Stat label="beste sessie" value={fmt(s.best)} />
          <Stat label="hoogste beurt" value={s.high ?? '–'} />
          <Stat label="100+" value={s.s100} />
          <Stat label="140+" value={s.s140} />
          <Stat label="180's" value={s.s180} />
        </div>
      </Card>
      <Card title="Gemiddelde per sessie"><LineChart label="gemiddelde per sessie" points={s.perGame.map(p => ({ y: p.avg, at: p.at }))} refLine={s.avg} /></Card>
    </>
  )
}

function CheckoutStats({ st, kind }) {
  const c = st.co
  return (
    <>
      <Card title={KINDS[kind].label}>
        <div className="stats-grid">
          <Stat accent label="gelukt" value={fmtPct(c.pct)} sub={c.successes + '/' + c.attempts} />
          <Stat label="darts per uitgooi" value={fmt(c.avgDarts, 1)} />
          <Stat label={kind === 'catch40' ? 'beste score' : 'hoogste'} value={kind === 'catch40' ? (c.bestPoints ?? '–') : (c.highest ?? '–')} />
        </div>
      </Card>
      {c.byRange.length > 1 && <Card title="Gelukt per bereik"><HBars max={100} rows={c.byRange.map(r => ({ label: r.label, value: r.pct ?? 0, text: fmtPct(r.pct) + ' · ' + r.hit + '/' + r.n }))} /></Card>}
      {c.hardest.length > 0 && <Card title="Lastigste uitgooiers"><div className="pills">{c.hardest.map(h => <span key={h.t} className="pill">{h.t}<em>{h.hit}/{h.attempted}</em></span>)}</div></Card>}
      <Card title="Gelukt per sessie"><LineChart label="gelukt per sessie" unit="%" digits={0} points={c.perGame.filter(p => p.pct != null).map(p => ({ y: p.pct, at: p.at }))} refLine={c.pct} /></Card>
    </>
  )
}

function HalveStats({ st }) {
  const h = st.halve
  return (
    <>
      <Card title="Halve-It">
        <div className="stats-grid">
          <Stat label="gespeeld" value={h.games} />
          <Stat accent label="beste score" value={h.best ?? '–'} />
          <Stat label="gemiddeld" value={fmt(h.avg, 0)} />
          <Stat label="rondes gehaald" value={fmtPct(h.okPct)} />
        </div>
      </Card>
      <Card title="Score per spel"><LineChart label="score per spel" digits={0} points={h.perGame.map(p => ({ y: p.score, at: p.at }))} refLine={h.avg} /></Card>
      <SimpleOverview st={st} />
    </>
  )
}
