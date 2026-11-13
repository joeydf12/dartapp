import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { loadActive, saveActive, clearActive, enqueue, dropFromOutbox, loadPrefs } from '../lib/store.js'
import { replayGame, withInput, undo, toPayload, replaceInput, rematchOf, MODE_LABEL, KINDS } from '../lib/model.js'
import { botX01Turn, botCricketTurn, botClockTurn } from '../lib/bot.js'
import { Screen, Card, go } from '../components/ui.jsx'
import X01Play from './play/X01Play.jsx'
import DartsPlay from './play/DartsPlay.jsx'
import BobsPlay from './play/BobsPlay.jsx'

// Probeer de bot-darts af te kappen zodra het spel daarmee beslist is.
function truncateAtWin(game, input) {
  for (let k = 1; k <= input.darts.length; k++) {
    const cand = { ...input, darts: input.darts.slice(0, k) }
    try { if (replayGame({ ...game, inputs: [...game.inputs, { id: 'tmp', ...cand }] }).finished) return cand } catch { /* niet geldig */ }
  }
  return input
}

function botInput(game, view) {
  const level = game.botLevel || 5
  if (game.kind === 'x01') return botX01Turn(view.raw.current.remaining.away, level, game.config.doubleOut)
  if (game.kind === 'cricket') return truncateAtWin(game, botCricketTurn(view.raw.state, 'opp', level))
  return truncateAtWin(game, botClockTurn(view.raw.progress.opp, level))
}

export default function Play({ user }) {
  const [game, setGame] = useState(loadActive)
  const [err, setErr] = useState('')
  const [confirmQuit, setConfirmQuit] = useState(false)
  const view = useMemo(() => { try { return game ? replayGame(game) : null } catch (e) { return null } }, [game])

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

  // Bot aan de beurt: na een korte pauze gooit hij.
  useEffect(() => {
    if (!game || !view || game.mode !== 'bot' || view.finished || view.current !== 'opp') return
    const t = setTimeout(() => { try { persist(withInput(game, botInput(game, view))) } catch (e) { setErr(e.message) } }, loadPrefs().botDelay ?? 900)
    return () => clearTimeout(t)
  }, [game, view])

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

  const common = { game, view, apply, undoLast, replace, rematch, err, setErr, user, done, discard, setGame: persist }
  const title = `${KINDS[game.kind].label.split(' (')[0]} · ${MODE_LABEL[game.mode]}${game.opponentName ? ` · ${game.opponentName}` : ''}`

  return (
    <Screen title={title} back="/" right={<button className="btn ghost icon" onClick={() => setConfirmQuit(q => !q)} aria-label="Spelmenu" aria-expanded={confirmQuit}>⋯</button>}>
      {confirmQuit && (
        <Card title="Spel">
          <div className="grid2">
            <button className="btn" onClick={() => setConfirmQuit(false)}>Verder spelen</button>
            <button className="btn" onClick={() => go('/')}>Later verder</button>
          </div>
          {confirmQuit === 'discard'
            ? <div className="grid2" style={{ marginTop: 10 }}><button className="btn" onClick={() => setConfirmQuit(true)}>Annuleren</button><button className="btn danger" onClick={discard}>Ja, weggooien</button></div>
            : <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => setConfirmQuit('discard')}>Stoppen en niet bewaren</button>}
        </Card>
      )}
      {game.kind === 'x01' && <X01Play {...common} />}
      {(game.kind === 'cricket' || game.kind === 'around_clock') && <DartsPlay {...common} />}
      {game.kind === 'bobs27' && <BobsPlay {...common} />}
    </Screen>
  )
}
