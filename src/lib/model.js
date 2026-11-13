// ── Spelmodel ────────────────────────────────────────────────────────────────
// Een spel is: { id, kind, mode, config, opponentName, botLevel, startedAt,
// finishedAt, inputs: [...] }. Alles (stand, wie aan de beurt is, einde) volgt
// uit het opnieuw afspelen van de invoer — er wordt niets apart bijgehouden.
import { replayMatch } from './darts/engine.js'
import { replaySolo } from './games/x01solo.js'
import { replayCricket } from './games/cricket.js'
import { replayClock } from './games/aroundClock.js'
import { replayBobs } from './games/bobs27.js'
import { botName } from './bot.js'

export const KINDS = {
  x01: { label: 'X01 (501 / 301 …)', modes: ['solo', 'pvp', 'bot'] },
  cricket: { label: 'Cricket', modes: ['solo', 'pvp', 'bot'] },
  around_clock: { label: 'Around the Clock', modes: ['solo', 'pvp', 'bot'] },
  bobs27: { label: "Bob's 27 (dubbels)", modes: ['solo'] },
}
export const MODE_LABEL = { solo: 'Solo', pvp: '1 tegen 1', bot: 'Tegen bot' }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16) }))

export function newGame({ kind, mode, config, opponentName, botLevel }) {
  return {
    id: uid(), kind, mode, config, botLevel: mode === 'bot' ? botLevel : null,
    opponentName: mode === 'bot' ? botName(botLevel) : mode === 'pvp' ? (opponentName || 'Tegenstander') : null,
    startedAt: new Date().toISOString(), finishedAt: null, inputs: [],
  }
}

export const x01Setup = g => ({
  format: { legsToWin: g.config.legs, startScore: g.config.startScore, doubleOut: g.config.doubleOut },
  lineup: { home: ['me'], away: ['opp'] },
  bullOff: { homePlayerId: 'me', awayPlayerId: 'opp', winner: g.config.starter === 'opp' ? 'away' : 'home' },
  firstThrower: { home: 'me', away: 'opp' },
})

const sideName = s => (s === 'home' ? 'me' : 'opp')

// Normaliseert alle spelsoorten naar één vorm: { turns, finished, winner, current, raw, summary }.
// Gooit een Error bij ongeldige invoer (de UI toont de melding).
export function replayGame(g) {
  switch (g.kind) {
    case 'x01': {
      if (g.mode === 'solo') {
        const r = replaySolo(g.config, g.inputs)
        return { kind: 'x01', solo: true, raw: r, turns: r.turns.map(t => ({ ...t, side: 'me' })), finished: r.finished, winner: null, current: r.finished ? null : 'me', summary: { legs: r.legsDone } }
      }
      const r = replayMatch(x01Setup(g), g.inputs)
      return {
        kind: 'x01', solo: false, raw: r,
        turns: r.turns.map(t => ({ ...t, side: sideName(t.side) })),
        finished: r.finished, winner: r.winnerSide ? sideName(r.winnerSide) : null,
        current: r.current ? sideName(r.current.side) : null,
        summary: { legsMe: r.legsWon.home, legsOpp: r.legsWon.away },
      }
    }
    case 'cricket': {
      const r = replayCricket(g.inputs, { mode: g.mode, first: g.config.starter === 'opp' ? 'opp' : 'me' })
      return { kind: 'cricket', raw: r, turns: r.turns, finished: r.finished, winner: g.mode === 'solo' ? null : r.winner, current: r.current, summary: r.summary }
    }
    case 'around_clock': {
      const r = replayClock(g.inputs, { mode: g.mode, first: g.config.starter === 'opp' ? 'opp' : 'me' })
      return { kind: 'around_clock', raw: r, turns: r.turns, finished: r.finished, winner: g.mode === 'solo' ? null : r.winner, current: r.current, summary: r.summary }
    }
    case 'bobs27': {
      const r = replayBobs(g.inputs)
      return { kind: 'bobs27', raw: r, turns: r.turns, finished: r.finished, winner: null, current: r.finished ? null : 'me', summary: r.summary }
    }
    default: throw new Error('Onbekend spel.')
  }
}

export function resultOf(g, view) {
  if (!view.finished) return null
  if (g.mode === 'solo') return 'solo'
  return view.winner === 'me' ? 'won' : 'lost'
}

// Opslagvorm (zie dartapp_sync_game).
export function toPayload(g) {
  const view = replayGame(g)
  const turns = view.turns.map(t => ({
    id: t.id, seq: t.seq, legNumber: t.legNumber ?? 1, side: t.side,
    mode: t.mode === 'darts' ? 'darts' : g.kind === 'x01' ? 'total' : 'darts',
    score: t.score, remainingBefore: t.remainingBefore ?? null, remainingAfter: t.remainingAfter ?? null,
    dartsThrown: t.dartsThrown, isBust: !!t.isBust, isCheckout: !!t.isCheckout,
    input: g.kind === 'x01' ? { ...t.input, dartsAtDouble: t.dartsAtDouble ?? null } : (g.inputs[t.seq - 1] || {}),
    darts: Array.isArray(t.darts) ? t.darts.map(d => ({ m: d.m, n: d.n, points: d.points ?? 0, remainingBefore: d.remainingBefore ?? null, doubleTarget: d.doubleTarget ?? null, doubleHit: d.doubleHit ?? null })) : null,
  }))
  return {
    game: {
      id: g.id, kind: g.kind, mode: g.mode, config: g.config, opponentName: g.opponentName, botLevel: g.botLevel,
      startedAt: g.startedAt, finishedAt: g.finishedAt, result: g.finishedAt ? resultOf(g, view) : null,
      summary: view.summary,
    },
    turns,
  }
}

// Een beurt toevoegen; gooit bij ongeldige invoer.
export function withInput(g, input) {
  const next = { ...g, inputs: [...g.inputs, { id: uid(), at: new Date().toISOString(), ...input }] }
  replayGame(next)
  return next
}

// Een eerdere beurt corrigeren: invoer vervangen (zelfde id) en alles opnieuw afspelen.
// Gooit als de wedstrijd daarmee niet meer klopt (bijv. latere beurten na een nieuwe uitgooi).
export function replaceInput(g, id, input) {
  const i = g.inputs.findIndex(x => x.id === id)
  if (i < 0) throw new Error('Beurt niet gevonden.')
  const inputs = g.inputs.slice()
  inputs[i] = { ...input, id, at: g.inputs[i].at, editedAt: new Date().toISOString() }
  const next = { ...g, inputs }
  let view
  try { view = replayGame(next) } catch (e) { throw new Error(`Deze correctie past niet bij de rest van het spel: ${e.message} Gebruik "Ongedaan" tot die beurt als je dit wilt.`) }
  // Latere beurten moeten bij dezelfde leg en dezelfde speler blijven horen.
  const before = new Map(replayGame(g).turns.map(t => [t.id, `${t.legNumber ?? 1}|${t.side}`]))
  if (view.turns.some(t => before.get(t.id) !== `${t.legNumber ?? 1}|${t.side}`) || view.turns.length !== before.size) {
    throw new Error('Deze correctie verandert het verloop (bijv. een eerdere uitgooi). Gebruik "Ongedaan" tot die beurt.')
  }
  return { ...next, finishedAt: view.finished ? (g.finishedAt || new Date().toISOString()) : null }
}

// Revanche: zelfde spel en instellingen; de ander begint.
export function rematchOf(g) {
  const starter = g.mode === 'solo' ? 'me' : g.config.starter === 'opp' ? 'me' : 'opp'
  return newGame({ kind: g.kind, mode: g.mode, config: { ...g.config, starter }, opponentName: g.opponentName, botLevel: g.botLevel })
}

// Ongedaan maken: tegen de bot gaat je laatste beurt terug (inclusief de beurt van de bot erna).
export function undo(g) {
  if (!g.inputs.length) return g
  if (g.mode !== 'bot') return { ...g, inputs: g.inputs.slice(0, -1) }
  const view = replayGame(g)
  let idx = -1
  view.turns.forEach((t, i) => { if (t.side === 'me') idx = i })
  return idx < 0 ? g : { ...g, inputs: g.inputs.slice(0, idx) }
}
