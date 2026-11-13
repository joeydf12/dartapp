// ── Wedstrijdverloop ─────────────────────────────────────────────────────────
// De wedstrijd is een lijst beurten (in volgorde). replayMatch() rekent daaruit
// alles af: legs, restscores, legstand, wie er gooit, einde van de wedstrijd.
// Er wordt niets "bijgehouden" dat kan afwijken: undo = laatste beurt weghalen,
// correctie = beurt aanpassen en opnieuw afspelen.
//
// setup: { format: { legsToWin, startScore, doubleOut }, lineup, bullOff, firstThrower }
// beurt (invoer): {
//   id,                         uniek beurt-id (idempotent opslaan)
//   mode: 'total' | 'darts',
//   score?, finishedOnDouble?, dartsAtFinish?    bij 'total'
//   darts?: [{ m, n }]                            bij 'darts'
//   playerOverride?: spelerId   "Verkeerde speler": wie er echt gooide (teamgenoot)
// }

import { evaluateDartsTurn, evaluateTotalTurn } from './rules.js'
import { expectedThrower, validateOrder, SIDES } from './order.js'

export const DEFAULT_FORMAT = Object.freeze({ legsToWin: 3, startScore: 501, doubleOut: true })

export class TurnError extends Error {
  constructor(message, turnId) {
    super(message)
    this.turnId = turnId
  }
}

export function normalizeFormat(format = {}) {
  const f = { ...DEFAULT_FORMAT, ...format }
  if (!Number.isInteger(f.legsToWin) || f.legsToWin < 1) throw new TurnError('Ongeldig aantal legs.')
  if (!Number.isInteger(f.startScore) || f.startScore < 2) throw new TurnError('Ongeldige startscore.')
  return f
}

function newLeg(number, startScore, startSide) {
  return { number, startSide, remaining: { home: startScore, away: startScore }, turns: [], winnerSide: null }
}

export function replayMatch(setup, turns = []) {
  const format = normalizeFormat(setup.format)
  validateOrder(setup.lineup, setup.bullOff, setup.firstThrower)

  const legs = []
  const legsWon = { home: 0, away: 0 }
  const flat = []
  let winnerSide = null
  let leg = newLeg(1, format.startScore, expectedThrower(setup, 1, 0).side)
  const seenIds = new Set()

  for (const t of turns) {
    if (winnerSide) throw new TurnError('De wedstrijd is al afgelopen; er kan geen beurt meer bij.', t.id)
    if (t.id != null) {
      if (seenIds.has(t.id)) throw new TurnError('Dubbele beurt.', t.id)
      seenIds.add(t.id)
    }
    const indexInLeg = leg.turns.length
    const expected = expectedThrower(setup, leg.number, indexInLeg)
    const side = expected.side
    let playerId = expected.playerId
    if (t.playerOverride != null && t.playerOverride !== expected.playerId) {
      if (!setup.lineup[side].includes(t.playerOverride)) {
        throw new TurnError('De gecorrigeerde speler hoort niet bij dit team.', t.id)
      }
      playerId = t.playerOverride
    }

    const remainingBefore = leg.remaining[side]
    const res = t.mode === 'darts'
      ? evaluateDartsTurn(remainingBefore, t.darts, format.doubleOut)
      : evaluateTotalTurn(remainingBefore, t, format.doubleOut)
    if (res.error) throw new TurnError(res.error, t.id)

    const enriched = {
      id: t.id,
      seq: flat.length + 1,
      legNumber: leg.number,
      indexInLeg,
      side,
      playerId,
      expectedPlayerId: expected.playerId,
      overridden: playerId !== expected.playerId,
      mode: t.mode === 'darts' ? 'darts' : 'total',
      remainingBefore,
      remainingAfter: res.remainingAfter,
      score: res.score,
      dartsThrown: res.dartsThrown,
      isBust: res.isBust,
      isCheckout: res.isCheckout,
      darts: res.darts,
      dartsAtDouble: res.dartsAtDouble ?? null,
      input: t,
    }
    leg.turns.push(enriched)
    flat.push(enriched)
    leg.remaining[side] = res.remainingAfter

    if (res.isCheckout) {
      leg.winnerSide = side
      legsWon[side]++
      legs.push(leg)
      if (legsWon[side] >= format.legsToWin) {
        winnerSide = side
      } else {
        const n = leg.number + 1
        leg = newLeg(n, format.startScore, expectedThrower(setup, n, 0).side)
      }
    }
  }
  if (!winnerSide) legs.push(leg)

  const current = winnerSide
    ? null
    : {
        legNumber: leg.number,
        ...expectedThrower(setup, leg.number, leg.turns.length),
        remaining: { ...leg.remaining },
      }

  return { format, setup, legs, legsWon, winnerSide, finished: !!winnerSide, current, turns: flat }
}

// Voeg een beurt toe; geeft de nieuwe beurtenlijst + nieuwe stand, of gooit TurnError.
export function addTurn(setup, turns, turn) {
  const next = [...turns, turn]
  return { turns: next, state: replayMatch(setup, next) }
}

// Onbeperkt undo: haal de laatste beurt weg (ook als die een leg of de wedstrijd afsloot).
export function undoTurn(setup, turns) {
  const next = turns.slice(0, -1)
  return { turns: next, state: replayMatch(setup, next) }
}

// "Verkeerde speler": wijs een beurt toe aan de teamgenoot die echt gooide. Score blijft gelijk.
export function reassignTurn(setup, turns, turnId, playerId) {
  const next = turns.map(t => (t.id === turnId ? { ...t, playerOverride: playerId } : t))
  return { turns: next, state: replayMatch(setup, next) }
}

// Per team: gemiddelde (3 darts) en laatste score in de wedstrijd, voor het scorescherm.
export function sideSummary(state) {
  const out = {}
  for (const side of SIDES) {
    const own = state.turns.filter(t => t.side === side)
    const points = own.reduce((a, t) => a + t.score, 0)
    const darts = own.reduce((a, t) => a + t.dartsThrown, 0)
    const last = own[own.length - 1]
    out[side] = { avg3: darts ? (points / darts) * 3 : 0, lastScore: last ? last.score : null, lastBust: !!last?.isBust }
  }
  return out
}
