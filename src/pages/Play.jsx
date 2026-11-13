import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { loadActive, saveActive, clearActive, enqueue, dropFromOutbox, loadPrefs } from '../lib/store.js'
import { replayGame, withInput, undo, toPayload, replaceInput, rematchOf, botMove, KINDS, playerName } from '../lib/model.js'
import { Screen, Card, go } from '../components/ui.jsx'
import X01Play from './play/X01Play.jsx'
import DartsPlay from './play/DartsPlay.jsx'
import BobsPlay from './play/BobsPlay.jsx'
import { TargetsPlay, RoundsPlay, ScorePlay, CheckoutPlay, HalvePlay, KillerPlay } from './play/Games.jsx'

const SCREENS = {
  x01: X01Play, cricket: DartsPlay, bobs27: BobsPlay,
  around_clock: TargetsPlay, doubles: TargetsPlay, singles: RoundsPlay, shanghai: RoundsPlay,
  score_training: ScorePlay, checkout121: CheckoutPlay, checkout170: CheckoutPlay, catch40: CheckoutPlay, random_checkout: CheckoutPlay,
  halve_it: HalvePlay, killer: KillerPlay,
}

// Bull-off: wie het dichtst bij de bull gooit, begint.
function BullOff({ view, user, onPick }) {
  return (
    <Card title="🎯 Bull-off" className="ask">
      <div className="ask-q">Iedereen gooit één dart op de bull. Wie zat het dichtst bij?</div>
      <div className="grid2">{view.players.map((p, i) => <button key={i} className="key" onClick={() => onPick(i)}>{p.type === 'bot' ? '🤖 ' : ''}{playerName(p, user)}</button>)}</div>
      <button className="btn ghost block" onClick={() => onPick(Math.floor(Math.random() * view.players.length))}>🎲 Laat de app loten</button>
    </Card>
  )
}

export default function Play({ user }) {
  const [game, setGame] = useState(loadActive)
  const [err, setErr] = useState('')
  const [confirmQuit, setConfirmQuit] = useState(false)
  const view = useMemo(() => { try { return game ? replayGame(game) : null } catch (e) { return null } }, [game])
  const needBullOff = !!(game?.config?.bullOff && !game.config.bullOffDone && !game.inputs.length && (view?.players?.length || 0) > 1)

  useEffect(() => { if (!game) go('/') }, [game])

  // Scherm aan houden tijdens het spelen (telefoon ligt vaak op tafel / hangt aan de muur).
  useEffect(() => {
    let lock = null, alive = true
    const get = async () => { try { if (alive && document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen') } catch { /* niet ondersteund */ } }
    get()
    document.addEventListener('visibilitychange', get)
    return () => { alive = false; document.removeEventListener('visibilitychange', get); lock?.release?.().catch(() => {}) }
  }, [])

  const persist = g => {
    setGame(g); saveActive(g)
    const p = toPayload(g)
    enqueue(p.game, p.turns)
  }

  const apply = input => {
    try { persist(withInput(game, input)); setErr(''); return true }
    catch (e) { setErr(e.message); return false }
  }
  const undoLast = () => { setErr(''); persist({ ...undo(game), finishedAt: null }) }
  // Eerdere beurt corrigeren.
  const replace = (id, input) => {
    try { persist(replaceInput(game, id, input)); setErr(''); return true }
    catch (e) { setErr(e.message); return false }
  }
  const rematch = () => { const g = rematchOf(game); setErr(''); setGame(g); saveActive(g); window.scrollTo(0, 0) }
  // Handmatig afronden (bijv. Score Training zonder vast aantal rondes).
  const finish = () => { persist({ ...game, finishedAt: new Date().toISOString() }); clearActive(); go('/') }
  const pickStarter = i => { const g = { ...game, config: { ...game.config, starter: i, bullOffDone: true } }; setGame(g); saveActive(g) }

  // Bot aan de beurt: na een korte pauze gooit hij.
  useEffect(() => {
    if (!game || !view || view.finished || view.currentBot == null || needBullOff) return
    const t = setTimeout(() => {
      try { const input = botMove(game, view); if (input) persist(withInput(game, input)) } catch (e) { setErr(e.message) }
    }, loadPrefs().botDelay ?? 900)
    return () => clearTimeout(t)
  }, [game, view, needBullOff])

  // Spel klaar: meteen vastleggen (undo kan het weer openen).
  useEffect(() => {
    if (game && view?.finished && !game.finishedAt) persist({ ...game, finishedAt: new Date().toISOString() })
  }, [view?.finished])

  const done = () => { clearActive(); go('/') }
  const discard = async () => {
    clearActive(); dropFromOutbox(game.id)
    try { await api.deleteGame(game.id) } catch { /* nog niet opgeslagen of geen verbinding */ }
    go('/')
  }

  if (!game) return null
  if (!view) return <Screen title="Spel" back="/"><div className="err">Dit spel kan niet worden afgespeeld (ongeldige invoer). Je kunt het verwijderen.</div><button className="btn danger" onClick={discard}>Verwijderen</button></Screen>

  const common = { game, view, apply, undoLast, replace, rematch, finish, err, setErr, user, done, discard, setGame: persist }
  const others = view.players.filter(p => p.type !== 'me').map(p => playerName(p, user))
  const title = `${KINDS[game.kind]?.short || game.kind}${others.length ? ` · ${others.length > 2 ? `${others.length + 1} spelers` : `vs ${others.join(', ')}`}` : ''}`
  const Comp = SCREENS[game.kind]

  return (
    <Screen title={title} back="/" right={<button className="btn ghost icon" onClick={() => setConfirmQuit(q => !q)} aria-label="Spelmenu" aria-expanded={confirmQuit}>⋯</button>}>
      {confirmQuit && (
        <Card title="Spel">
          <div className="grid2">
            <button className="btn" onClick={() => setConfirmQuit(false)}>Verder spelen</button>
            <button className="btn" onClick={() => go('/')}>Later verder</button>
          </div>
          {!view.finished && game.inputs.length > 0 && <button className="btn block" style={{ marginTop: 10 }} onClick={finish}>✓ Stoppen en opslaan zoals het nu staat</button>}
          {confirmQuit === 'discard'
            ? <div className="grid2" style={{ marginTop: 10 }}><button className="btn" onClick={() => setConfirmQuit(true)}>Annuleren</button><button className="btn danger" onClick={discard}>Ja, weggooien</button></div>
            : <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => setConfirmQuit('discard')}>Stoppen en niet bewaren</button>}
        </Card>
      )}
      {needBullOff ? <BullOff view={view} user={user} onPick={pickStarter} /> : Comp ? <Comp {...common} /> : <div className="err">Onbekend spel.</div>}
    </Screen>
  )
}
