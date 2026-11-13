import React, { useMemo, useState } from 'react'
import { KINDS, CATS, newGame, uid } from '../lib/model.js'
import { loadPrefs, savePrefs, saveActive, loadActive } from '../lib/store.js'
import { BOT_LEVELS, LEVEL_AVG, botName, levelForAverage } from '../lib/bot.js'
import { cachedData } from '../lib/data.js'
import { profileSummary } from '../lib/statsAgg.js'
import { CRICKET_VARIANTS } from '../lib/games/cricket.js'
import { Screen, Card, Chips, Tabs, go } from '../components/ui.jsx'

const DEFAULTS = {
  x01: { startScore: 501, format: 'firstto', legs: 1, sets: 1, in: 'straight', out: 'double', entry: 'total' },
  cricket: { variant: 'standard' },
  around_clock: { need: 'any', order: 'asc', bull: true },
  doubles: { order: 'asc', bull: true },
  singles: { bull: true },
  shanghai: { roundsCount: 7 },
  score_training: { rounds: 10 },
  checkout121: { start: 121, attempts: 10, entry: 'total' },
  checkout170: { attempts: 10, entry: 'total' },
  catch40: { entry: 'total' },
  random_checkout: { ranges: ['2-40', '41-80', '81-120', '121-170'], attempts: 20, visits: 1, entry: 'total' },
  killer: { lives: 3 },
}

const opt = (arr, fmt = String) => arr.map(v => ({ value: v, label: fmt(v) }))

export default function NewGame({ user }) {
  const p = loadPrefs()
  const last = p.lastSetup || {}
  const [cat, setCat] = useState(KINDS[p.lastKind]?.cat || 'match')
  const [kind, setKind] = useState(p.lastKind && KINDS[p.lastKind] ? p.lastKind : 'x01')
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS[kind], ...(last[kind]?.settings || {}) }))
  const [others, setOthers] = useState(() => last[kind]?.others || [])
  const [starter, setStarter] = useState(last[kind]?.starter ?? 0)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [guestName, setGuestName] = useState('')
  const guests = p.guests || []
  const meta = KINDS[kind]
  const maxOthers = meta.players[1] - 1
  const minOthers = meta.players[0] - 1
  const myAvg = useMemo(() => { try { const d = cachedData(); return d?.games?.length ? profileSummary(d).avg3 : null } catch { return null } }, [])

  const pick = k => {
    setKind(k)
    setSettings({ ...DEFAULTS[k], ...(last[k]?.settings || {}) })
    const keep = (last[k]?.others || others).filter(o => o.type !== 'bot' || KINDS[k].bot).slice(0, KINDS[k].players[1] - 1)
    setOthers(keep)
    setStarter(0)
  }
  const set = patch => setSettings(s => ({ ...s, ...patch }))
  const addGuest = name => {
    const nm = (name || '').trim() || `Speler ${others.length + 2}`
    if (others.length >= maxOthers) return
    setOthers([...others, { id: uid(), name: nm, type: 'guest' }])
    if (!guests.includes(nm) && name) savePrefs({ guests: [nm, ...guests].slice(0, 12) })
    setGuestName('')
  }
  const addBot = level => { if (others.length < maxOthers) setOthers([...others, { id: uid(), name: botName(level), type: 'bot', botLevel: level }]) }
  const setBot = (i, level) => setOthers(others.map((o, j) => (j === i ? { ...o, botLevel: level, name: botName(level) } : o)))
  const remove = i => { setOthers(others.filter((_, j) => j !== i)); setStarter(0) }

  const allPlayers = [{ id: 'me', name: user.displayName, type: 'me' }, ...others]
  const tooFew = others.length < minOthers

  function start() {
    if (tooFew) return
    const act = loadActive()
    if (act && !act.finishedAt && act.inputs?.length && !confirmReplace) { setConfirmReplace(true); return }
    let cfg = { ...settings }
    if (kind === 'x01') {
      const legs = cfg.format === 'bestof' && allPlayers.length > 1 ? Math.ceil(cfg.legs / 2) : cfg.legs
      const sets = cfg.format === 'bestof' && allPlayers.length > 1 && cfg.sets > 1 ? Math.ceil(cfg.sets / 2) : cfg.sets
      cfg = { ...cfg, legs, sets, legsShown: cfg.legs, setsShown: cfg.sets, doubleOut: cfg.out === 'double' }
    }
    const players = allPlayers.map(pl => (pl.type === 'me' ? { id: 'me', name: 'Ik', type: 'me' } : pl))
    let st = starter
    if (starter === 'random') st = Math.floor(Math.random() * players.length)
    const bullOff = starter === 'bull'
    const g = newGame({ kind, players, config: { ...cfg, starter: bullOff || starter === 'random' ? (typeof st === 'number' ? st : 0) : st, bullOff } })
    savePrefs({ lastKind: kind, lastSetup: { ...last, [kind]: { settings, others, starter: typeof starter === 'number' ? 0 : starter } }, ...(kind === 'x01' ? { startScore: cfg.startScore, legs: settings.legs, doubleOut: cfg.out === 'double', entry: cfg.entry } : {}) })
    saveActive(g)
    go('/play')
  }

  const games = Object.entries(KINDS).filter(([, k]) => k.cat === cat)

  return (
    <Screen title="Nieuw spel" nav>
      <Tabs tabs={Object.entries(CATS).map(([value, label]) => ({ value, label }))} value={cat} onChange={setCat} />
      <div className="gamecards">
        {games.map(([k, g]) => (
          <button key={k} className={`gamecard ${kind === k ? 'on' : ''}`} onClick={() => pick(k)} aria-pressed={kind === k}>
            <span className="gc-ico" aria-hidden="true">{g.icon}</span>
            <b>{g.label.split(' (')[0]}</b>
            <span>{g.desc}</span>
          </button>
        ))}
      </div>

      {maxOthers > 0 && (
        <Card title={`Spelers (${allPlayers.length}${meta.players[1] > 1 ? ` van max. ${meta.players[1]}` : ''})`}>
          <div className="plist">
            {allPlayers.map((pl, i) => (
              <div key={pl.id} className="prow">
                <span className="pnum">{i + 1}</span>
                <span className="pname">{pl.type === 'bot' ? '🤖 ' : pl.type === 'me' ? '⭐ ' : '👤 '}{pl.name}</span>
                {pl.type === 'bot' && (
                  <select aria-label="Niveau" value={pl.botLevel} onChange={e => setBot(i - 1, Number(e.target.value))}>
                    {BOT_LEVELS.map(l => <option key={l} value={l}>Niveau {l} · ±{LEVEL_AVG[l - 1]} gem.</option>)}
                  </select>
                )}
                {pl.type !== 'me' && <button className="btn ghost icon" onClick={() => remove(i - 1)} aria-label={`${pl.name} verwijderen`}>✕</button>}
              </div>
            ))}
          </div>
          {others.length < maxOthers && (
            <>
              <div className="row" style={{ marginTop: 10 }}>
                <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Naam speler" onKeyDown={e => e.key === 'Enter' && addGuest(guestName)} aria-label="Naam speler" />
                <button className="btn" onClick={() => addGuest(guestName)}>+ Speler</button>
              </div>
              {guests.filter(gn => !others.some(o => o.name === gn)).length > 0 && (
                <div className="chips small" style={{ marginTop: 8 }}>{guests.filter(gn => !others.some(o => o.name === gn)).map(gn => <button key={gn} className="chip" onClick={() => addGuest(gn)}>+ {gn}</button>)}</div>
              )}
              {meta.bot && (
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => addBot(p.botLevel && p.botLevel <= 20 ? p.botLevel : 8)}>+ 🤖 Bot</button>
                  {myAvg != null && <button className="btn ghost" onClick={() => addBot(levelForAverage(myAvg))}>+ 🤖 Bot zoals ik (±{Math.round(myAvg)})</button>}
                </div>
              )}
            </>
          )}
          {tooFew && <div className="warn small" style={{ marginTop: 8 }}>{meta.label} heeft minstens {meta.players[0]} spelers nodig.</div>}
          {allPlayers.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>Wie begint?</div>
              <Chips small value={starter} onChange={setStarter} options={[...allPlayers.map((pl, i) => ({ value: i, label: pl.type === 'me' ? 'Ik' : pl.name })), { value: 'random', label: '🎲 Loten' }, { value: 'bull', label: '🎯 Bull-off' }]} />
            </div>
          )}
        </Card>
      )}

      <Settings kind={kind} s={settings} set={set} multi={allPlayers.length > 1} />

      {confirmReplace && <div className="warnbox">Er loopt nog een spel. Start je nu, dan stopt dat spel (het blijft wel bewaard in je geschiedenis zoals het was).</div>}
      <div className="sticky-cta">
        <button className="btn primary block hero" onClick={start} disabled={tooFew}>{confirmReplace ? 'Toch nieuw spel starten' : `Start ${meta.label.split(' (')[0]}`}</button>
      </div>
    </Screen>
  )
}

function Field({ label, children, hint }) {
  return <div className="field set-field"><label>{label}</label>{children}{hint && <div className="muted small">{hint}</div>}</div>
}

function Settings({ kind, s, set, multi }) {
  const entry = <Field label="Invoer"><Chips small value={s.entry || 'total'} onChange={v => set({ entry: v })} options={[{ value: 'total', label: 'Totaal per beurt' }, { value: 'darts', label: 'Per dart' }]} /></Field>
  switch (kind) {
    case 'x01': return (
      <Card title="X01-instellingen">
        <Field label="Startscore">
          <Chips small value={[101, 170, 301, 501, 701, 1001].includes(s.startScore) ? s.startScore : 'eigen'} onChange={v => (v === 'eigen' ? set({ custom: true }) : set({ startScore: v, custom: false }))} options={[...opt([101, 170, 301, 501, 701, 1001]), { value: 'eigen', label: 'Eigen…' }]} />
          {![101, 170, 301, 501, 701, 1001].includes(s.startScore) || s.custom ? (
            <input type="number" inputMode="numeric" min="2" max="1501" value={s.startScore} onChange={e => set({ startScore: Math.max(2, Math.min(1501, parseInt(e.target.value || '0', 10) || 2)), custom: true })} aria-label="Eigen startscore" />
          ) : <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => set({ custom: true })}>Eigen startscore (2–1501)</button>}
        </Field>
        {multi && <Field label="Wedstrijdvorm"><Chips small value={s.format} onChange={v => set({ format: v })} options={[{ value: 'firstto', label: 'First to' }, { value: 'bestof', label: 'Best of' }]} /></Field>}
        {multi && <Field label="Sets" hint={s.sets > 1 ? `${s.format === 'bestof' ? 'Best of' : 'First to'} ${s.sets} sets, elke set ${s.format === 'bestof' ? 'best of' : 'first to'} ${s.legs} legs.` : 'Geen sets: alleen legs.'}><Chips small value={s.sets} onChange={v => set({ sets: v })} options={opt(s.format === 'bestof' ? [1, 3, 5, 7] : [1, 2, 3, 4, 5])} /></Field>}
        <Field label={multi ? `Legs ${s.sets > 1 ? 'per set' : ''} (${s.format === 'bestof' ? 'best of' : 'first to'})` : 'Aantal legs'}>
          <Chips small value={s.legs} onChange={v => set({ legs: v })} options={opt(multi && s.format === 'bestof' ? [1, 3, 5, 7, 9, 11, 13] : [1, 2, 3, 4, 5, 6, 7, 10])} />
        </Field>
        <Field label="Ingooien"><Chips small value={s.in} onChange={v => set({ in: v })} options={[{ value: 'straight', label: 'Straight in' }, { value: 'double', label: 'Dubbel in' }, { value: 'master', label: 'Master in' }]} /></Field>
        <Field label="Uitgooien" hint={s.out === 'master' ? 'Laatste dart een dubbel of treble.' : s.out === 'straight' ? 'Elke dart die precies op 0 komt.' : null}><Chips small value={s.out} onChange={v => set({ out: v })} options={[{ value: 'double', label: 'Dubbel uit' }, { value: 'master', label: 'Master uit' }, { value: 'straight', label: 'Straight uit' }]} /></Field>
        {entry}
      </Card>
    )
    case 'cricket': return (
      <Card title="Cricket-variant">
        <Chips small value={s.variant} onChange={v => set({ variant: v })} options={Object.entries(CRICKET_VARIANTS).map(([value, label]) => ({ value, label }))} />
        <div className="muted small" style={{ marginTop: 8 }}>{{ standard: 'Sluit 15–20 en bull; extra marks zijn punten zolang de ander het nummer niet dicht heeft.', cutthroat: 'Extra marks zijn strafpunten voor de ander. Laagste score wint.', noscore: 'Alleen sluiten, geen punten. Wie eerst alles dicht heeft wint.', tactics: 'Zoals standaard, maar met 10 t/m 20 en bull.', random: '6 willekeurige nummers en bull.' }[s.variant]}</div>
      </Card>
    )
    case 'around_clock': return (
      <Card title="Around the Clock">
        <Field label="Wat telt als raak"><Chips small value={s.need} onChange={v => set({ need: v })} options={[{ value: 'any', label: 'Elk vak' }, { value: 'single', label: 'Alleen single' }, { value: 'double', label: 'Alleen dubbel' }, { value: 'treble', label: 'Alleen treble' }]} /></Field>
        <Field label="Volgorde"><Chips small value={s.order} onChange={v => set({ order: v })} options={[{ value: 'asc', label: '1 → 20' }, { value: 'desc', label: '20 → 1' }, { value: 'random', label: 'Willekeurig' }]} /></Field>
        <Field label="Bull als laatste"><Chips small value={s.bull} onChange={v => set({ bull: v })} options={[{ value: true, label: 'Ja' }, { value: false, label: 'Nee' }]} /></Field>
      </Card>
    )
    case 'doubles': return (
      <Card title="Doubles Training">
        <Field label="Volgorde"><Chips small value={s.order} onChange={v => set({ order: v })} options={[{ value: 'asc', label: 'D1 → D20' }, { value: 'desc', label: 'D20 → D1' }, { value: 'random', label: 'Willekeurig' }]} /></Field>
        <Field label="Bull als laatste"><Chips small value={s.bull} onChange={v => set({ bull: v })} options={[{ value: true, label: 'Ja' }, { value: false, label: 'Nee' }]} /></Field>
      </Card>
    )
    case 'singles': return <Card title="Singles Training"><Field label="Bull als laatste ronde"><Chips small value={s.bull} onChange={v => set({ bull: v })} options={[{ value: true, label: 'Ja' }, { value: false, label: 'Nee' }]} /></Field></Card>
    case 'shanghai': return <Card title="Shanghai"><Field label="Rondes"><Chips small value={s.roundsCount} onChange={v => set({ roundsCount: v })} options={[{ value: 7, label: '1 t/m 7' }, { value: 10, label: '1 t/m 10' }, { value: 20, label: '1 t/m 20' }]} /></Field></Card>
    case 'score_training': return <Card title="Score Training"><Field label="Rondes"><Chips small value={s.rounds} onChange={v => set({ rounds: v })} options={[{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 33, label: '33 (≈100 darts)' }, { value: 0, label: 'Onbeperkt' }]} /></Field></Card>
    case 'checkout121': return (
      <Card title="121 Checkout">
        <Field label="Startscore"><Chips small value={s.start} onChange={v => set({ start: v })} options={opt([61, 81, 101, 121])} /></Field>
        <Field label="Pogingen"><Chips small value={s.attempts} onChange={v => set({ attempts: v })} options={opt([10, 20, 30])} /></Field>
        <Field label="Safehouse" hint="Aan: bij een mis ga je terug naar je laatste gelukte score i.p.v. naar de start."><Chips small value={!!s.safehouse} onChange={v => set({ safehouse: v })} options={[{ value: false, label: 'Uit' }, { value: true, label: 'Aan' }]} /></Field>
        {entry}
      </Card>
    )
    case 'checkout170': return <Card title="170 Checkout"><Field label="Pogingen"><Chips small value={s.attempts} onChange={v => set({ attempts: v })} options={opt([5, 10, 20])} /></Field>{entry}</Card>
    case 'catch40': return <Card title="Catch 40"><div className="muted small">40 pogingen (61 t/m 100), 6 darts per poging. Max 120 punten.</div>{entry}</Card>
    case 'random_checkout': return (
      <Card title="Random Checkout">
        <Field label="Bereiken (meerdere mogelijk)">
          <div className="chips small">{['2-40', '41-80', '81-120', '121-170'].map(r => {
            const on = s.ranges.includes(r)
            return <button key={r} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ ranges: on ? (s.ranges.length > 1 ? s.ranges.filter(x => x !== r) : s.ranges) : [...s.ranges, r] })}>{r.replace('-', '–')}</button>
          })}</div>
        </Field>
        <Field label="Pogingen"><Chips small value={s.attempts} onChange={v => set({ attempts: v })} options={opt([10, 20, 30])} /></Field>
        <Field label="Darts per poging"><Chips small value={s.visits} onChange={v => set({ visits: v })} options={[{ value: 1, label: '3 darts' }, { value: 2, label: '6 darts' }, { value: 3, label: '9 darts' }]} /></Field>
        {entry}
      </Card>
    )
    case 'killer': return <Card title="Killer"><Field label="Levens"><Chips small value={s.lives} onChange={v => set({ lives: v })} options={opt([3, 5])} /></Field><div className="muted small">Iedereen krijgt een willekeurig nummer.</div></Card>
    case 'halve_it': return <Card title="Halve-It"><div className="muted small">12 rondes: 20, elke dubbel, 19, elke treble, 18, 3 kleuren, 17, precies een getal, 16, zelfde kleur, 15, bull. Start met 40 punten.</div></Card>
    case 'bobs27': return <Card title="Bob's 27"><div className="muted small">D1 t/m D20 en bull. Per dubbel 3 darts. Start op 27, onder 0 ben je af.</div></Card>
    default: return null
  }
}
