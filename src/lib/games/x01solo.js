// ── X01 solo ─────────────────────────────────────────────────────────────────
// Eén speler, N legs. Zelfde regels en invoer als de wedstrijd-engine (bust,
// uitgooien, per dart of totaal), maar zonder tegenstander.
import { evaluateDartsTurn, evaluateTotalTurn } from '../darts/rules.js'
import { TurnError } from '../darts/engine.js'

export function replaySolo(format, inputs) {
  const { startScore = 501, doubleOut = true, legs: legsTarget = 1 } = format
  const legs = []
  const flat = []
  let leg = { number: 1, remaining: startScore, turns: [], done: false }
  let legsDone = 0
  for (const t of inputs) {
    if (legsDone >= legsTarget) throw new TurnError('Het spel is al afgelopen.', t.id)
    const before = leg.remaining
    const res = t.mode === 'darts' ? evaluateDartsTurn(before, t.darts, doubleOut) : evaluateTotalTurn(before, t, doubleOut)
    if (res.error) throw new TurnError(res.error, t.id)
    const turn = {
      id: t.id, seq: flat.length + 1, legNumber: leg.number, indexInLeg: leg.turns.length, side: 'home', playerId: 'me',
      mode: t.mode === 'darts' ? 'darts' : 'total', remainingBefore: before, remainingAfter: res.remainingAfter,
      score: res.score, dartsThrown: res.dartsThrown, isBust: res.isBust, isCheckout: res.isCheckout,
      darts: res.darts, dartsAtDouble: res.dartsAtDouble ?? null, input: t,
    }
    leg.turns.push(turn); flat.push(turn); leg.remaining = res.remainingAfter
    if (res.isCheckout) {
      leg.done = true; legs.push(leg); legsDone++
      if (legsDone < legsTarget) leg = { number: leg.number + 1, remaining: startScore, turns: [], done: false }
    }
  }
  const finished = legsDone >= legsTarget
  if (!finished) legs.push(leg)
  return { legs, turns: flat, legsDone, finished, remaining: finished ? 0 : leg.remaining, legNumber: leg.number }
}
