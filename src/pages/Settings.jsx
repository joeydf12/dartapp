import React, { useRef, useState } from 'react'
import { api, clearSession } from '../lib/api.js'
import { clearActive, clearOutbox, outboxCount, loadPrefs, savePrefs, DEFAULT_QUICK } from '../lib/store.js'
import { clearCache } from '../lib/data.js'
import { setFavouriteDouble, checkoutHint } from '../lib/darts/checkouts.js'
import { say, canSpeak } from '../lib/caller.js'
import { isPossibleTurnScore } from '../lib/darts/rules.js'
import { Screen, Card, Chips } from '../components/ui.jsx'

const DOUBLES = [null, 20, 16, 18, 12, 10, 8, 25]

function Preferences() {
  const [p, setP] = useState(loadPrefs)
  const [text, setText] = useState(p.quick.join(' '))
  const [qErr, setQErr] = useState('')
  const set = patch => { savePrefs(patch); setP(loadPrefs()) }
  const saveQuick = () => {
    const nums = text.split(/[^0-9]+/).filter(Boolean).map(Number)
    const bad = nums.filter(n => !isPossibleTurnScore(n))
    if (bad.length) return setQErr(`Niet te gooien: ${bad.join(', ')}`)
    if (!nums.length || nums.length > 10) return setQErr('Kies 1 tot 10 scores.')
    setQErr(''); set({ quick: [...new Set(nums)] }); setText([...new Set(nums)].join(' '))
  }
  return (
    <Card title="Invoer en uitgooien">
      <div className="field"><label>Standaard invoer bij X01</label>
        <Chips value={p.entry} onChange={v => set({ entry: v })} options={[{ value: 'total', label: 'Totaal per beurt' }, { value: 'darts', label: 'Per dart' }]} /></div>
      <div className="field" style={{ marginTop: 12 }}><label>Bij totaal typ ik</label>
        <Chips value={p.typing} onChange={v => set({ typing: v })} options={[{ value: 'scored', label: 'Wat ik gooide' }, { value: 'rest', label: 'Wat er over is' }]} /></div>
      <div className="field" style={{ marginTop: 12 }}><label htmlFor="quick">Snelscores (max. 10, met spaties)</label>
        <div className="row"><input id="quick" type="text" inputMode="numeric" value={text} onChange={e => setText(e.target.value)} />
          <button className="btn" onClick={saveQuick}>Opslaan</button></div>
        {qErr && <div className="warn small">{qErr}</div>}
        <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => { set({ quick: DEFAULT_QUICK }); setText(DEFAULT_QUICK.join(' ')); setQErr('') }}>Standaard terugzetten</button></div>
      <div className="field" style={{ marginTop: 12 }}><label>Favoriete dubbel (uitgooi-tips kiezen die als het kan)</label>
        <Chips value={p.favDouble} onChange={v => { set({ favDouble: v }); setFavouriteDouble(v) }} options={DOUBLES.map(d => ({ value: d, label: d == null ? 'Geen' : d === 25 ? 'Bull' : `D${d}` }))} />
        <div className="muted small">Voorbeeld: 81 → {checkoutHint(81)} · 64 → {checkoutHint(64)} · 48 → {checkoutHint(48)}</div></div>
    </Card>
  )
}

function GameFeel() {
  const [p, setP] = useState(loadPrefs)
  const set = patch => { savePrefs(patch); setP(loadPrefs()) }
  return (
    <Card title="Spelen">
      <div className="field"><label>Caller (scores uitspreken)</label>
        <div className="row">
          <Chips value={!!p.sound} onChange={v => { set({ sound: v }); if (v) say('Honderdtachtig!') }} options={[{ value: false, label: 'Uit' }, { value: true, label: 'Aan' }]} />
          {p.sound && <button className="btn ghost small" onClick={() => say('Je hebt 40 over')}>▶ Test</button>}
        </div>
        {!canSpeak() && <div className="muted small">Dit toestel ondersteunt geen spraak.</div>}
      </div>
      <div className="field" style={{ marginTop: 12 }}><label>Snelheid van de bot</label>
        <Chips value={p.botDelay ?? 900} onChange={v => set({ botDelay: v })} options={[{ value: 300, label: 'Snel' }, { value: 900, label: 'Normaal' }, { value: 1600, label: 'Rustig' }]} /></div>
    </Card>
  )
}

export default function Settings({ user, onLoggedOut }) {
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pw, setPw] = useState('')
  const [danger, setDanger] = useState(null) // 'data' | 'account'
  const file = useRef(null)
  const fail = e => { setMsg(''); setErr(e.network ? 'Geen verbinding.' : e.message) }

  async function backup() {
    setErr(''); setMsg('')
    try {
      const data = await api.getData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `dartapp-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click(); URL.revokeObjectURL(a.href)
      setMsg(`Backup opgeslagen: ${data.games.length} spellen, ${data.turns.length} beurten.`)
    } catch (e) { fail(e) }
  }

  async function restore(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setErr(''); setMsg('')
    try {
      const r = await api.importData(JSON.parse(await f.text()))
      setMsg(`Teruggezet: ${r.games} spellen.`)
    } catch (e2) { fail(e2.name === 'SyntaxError' ? new Error('Dit bestand is geen geldige backup.') : e2) }
  }

  async function confirmDanger() {
    setErr(''); setMsg('')
    try {
      if (danger === 'data') { const r = await api.deleteMyData(pw); clearActive(); clearOutbox(); clearCache(); setMsg(`${r.gamesDeleted} spellen verwijderd. Je account blijft bestaan.`) }
      else { await api.deleteAccount(pw); clearActive(); clearOutbox(); clearCache(); clearSession(); onLoggedOut(); location.hash = '#/'; return }
      setDanger(null); setPw('')
    } catch (e) { fail(e) }
  }

  async function logout() { await api.logout(); clearCache(); clearSession(); onLoggedOut(); location.hash = '#/' }

  return (
    <Screen title="Instellingen" back="/">
      <Preferences />
      <GameFeel />
      <Card title="Account"><div>{user.displayName} <span className="muted">({user.username})</span></div>
        {outboxCount() > 0 && <div className="warn small" style={{ marginTop: 8 }}>Er {outboxCount() === 1 ? 'is nog 1 spel' : `zijn nog ${outboxCount()} spellen`} niet verstuurd. Die blijven op dit toestel en gaan mee zodra je weer inlogt.</div>}
        <button className="btn block" style={{ marginTop: 10 }} onClick={logout}>Uitloggen</button></Card>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}
      <Card title="Backup">
        <div className="muted small" style={{ marginBottom: 10 }}>Download al je spellen, beurten en darts als één bestand. Dit bestand kun je later weer terugzetten.</div>
        <div className="grid2">
          <button className="btn primary" onClick={backup}>⬇ Backup maken</button>
          <button className="btn" onClick={() => file.current?.click()}>⬆ Terugzetten</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={restore} />
      </Card>
      <Card title="Verwijderen">
        {!danger ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn danger" onClick={() => setDanger('data')}>Al mijn dart-gegevens wissen</button>
            <button className="btn danger" onClick={() => setDanger('account')}>Account én gegevens verwijderen</button>
          </div>
        ) : (
          <div className="field" style={{ gap: 10 }}>
            <div className="warn">{danger === 'data' ? 'Alle spellen en statistieken worden definitief gewist (maak eerst een backup).' : 'Je account en alle gegevens worden definitief gewist.'}</div>
            <input type="password" placeholder="Wachtwoord ter bevestiging" value={pw} onChange={e => setPw(e.target.value)} />
            <div className="grid2"><button className="btn" onClick={() => { setDanger(null); setPw('') }}>Annuleren</button><button className="btn danger" onClick={confirmDanger} disabled={!pw}>Definitief wissen</button></div>
          </div>
        )}
      </Card>
    </Screen>
  )
}
