import React, { useState } from 'react'
import { KINDS, MODE_LABEL, newGame } from '../lib/model.js'
import { loadPrefs, savePrefs, saveActive, loadActive } from '../lib/store.js'
import { BOT_LEVELS } from '../lib/bot.js'
import { Screen, Card, Chips, go } from '../components/ui.jsx'

export default function NewGame({ user }) {
  const p = loadPrefs()
  const [kind, setKind] = useState('x01')
  const [mode, setMode] = useState('solo')
  const [startScore, setStartScore] = useState(p.startScore)
  const [legs, setLegs] = useState(p.legs)
  const [doubleOut, setDoubleOut] = useState(p.doubleOut)
  const [botLevel, setBotLevel] = useState(p.botLevel)
  const [opponent, setOpponent] = useState('')
  const [starter, setStarter] = useState('me')
  const [entry, setEntry] = useState(p.entry)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const modes = KINDS[kind].modes
  const effMode = modes.includes(mode) ? mode : 'solo'

  function start() {
    const act = loadActive()
    if (act && !act.finishedAt && act.inputs?.length && !confirmReplace) { setConfirmReplace(true); return }
    const who = starter === 'random' ? (Math.random() < 0.5 ? 'me' : 'opp') : starter
    const config = kind === 'x01'
      ? { startScore, legs, doubleOut, starter: effMode === 'solo' ? 'me' : who, entry }
      : { starter: effMode === 'solo' ? 'me' : who, entry }
    savePrefs({ startScore, legs, doubleOut, botLevel, entry })
    saveActive(newGame({ kind, mode: effMode, config, opponentName: opponent, botLevel }))
    go('/play')
  }

  const num = (opts, v, set) => <Chips value={v} onChange={set} options={opts.map(o => ({ value: o, label: String(o) }))} />

  return (
    <Screen title="Nieuw spel" nav>
      <Card title="Spel">
        <Chips value={kind} onChange={setKind} options={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))} />
      </Card>
      <Card title="Tegen wie">
        <Chips value={effMode} onChange={setMode} options={modes.map(m => ({ value: m, label: MODE_LABEL[m] }))} />
        {effMode === 'pvp' && <div className="field" style={{ marginTop: 10 }}><label>Naam tegenstander</label><input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Tegenstander" /></div>}
        {effMode === 'bot' && (
          <div style={{ marginTop: 10 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>Niveau van de bot (1 = beginner, 10 = zeer sterk)</div>
            {num(BOT_LEVELS, botLevel, setBotLevel)}
          </div>
        )}
        {effMode !== 'solo' && (
          <div style={{ marginTop: 12 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>Wie begint?</div>
            <Chips value={starter} onChange={setStarter} options={[{ value: 'me', label: user.displayName }, { value: 'opp', label: effMode === 'bot' ? 'Bot' : 'Tegenstander' }, { value: 'random', label: 'Loten' }]} />
          </div>
        )}
      </Card>
      {kind === 'x01' && (
        <Card title="X01-instellingen">
          <div className="muted small" style={{ marginBottom: 6 }}>Startscore</div>
          {num([301, 501, 701], startScore, setStartScore)}
          <div className="muted small" style={{ margin: '12px 0 6px' }}>{effMode === 'solo' ? 'Aantal legs' : 'Eerste tot … legs'}</div>
          {num([1, 2, 3, 4, 5], legs, setLegs)}
          <div className="muted small" style={{ margin: '12px 0 6px' }}>Uitgooien</div>
          <Chips value={doubleOut} onChange={setDoubleOut} options={[{ value: true, label: 'Dubbel uit' }, { value: false, label: 'Straight out' }]} />
        </Card>
      )}
      {(kind === 'x01') && (
        <Card title="Score invoeren">
          <Chips value={entry} onChange={setEntry} options={[{ value: 'total', label: 'Totaal per beurt' }, { value: 'darts', label: 'Per dart (meer statistieken)' }]} />
          <div className="muted small" style={{ marginTop: 8 }}>Per dart houdt bij hoe vaak je mist en welke dubbels je raakt. Je kunt tijdens het spel wisselen.</div>
        </Card>
      )}
      {confirmReplace && <div className="warnbox">Er loopt nog een spel. Start je nu, dan stopt dat spel (het blijft wel bewaard in je geschiedenis zoals het was).</div>}
      <div className="sticky-cta">
        <button className="btn primary block hero" onClick={start}>{confirmReplace ? 'Toch nieuw spel starten' : 'Start spel'}</button>
      </div>
    </Screen>
  )
}
