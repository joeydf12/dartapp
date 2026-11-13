// ── X01 voor 1 tot 6 spelers ─────────────────────────────────────────────────
// Eén engine voor solo, 1 tegen 1, tegen bot(s) en meerdere spelers.
// Alles volgt uit het opnieuw afspelen van de invoer (geen losse stand).
//
// cfg: {
//   startScore, players: [{ id, name, type: 'me'|'guest'|'bot', botLevel? }],
//   legs:  legs nodig om een set te winnen (solo: aantal legs per set),
//   sets:  sets nodig om de wedstrijd te winnen (1 = alleen legs),
//   out: 'double'|'master'|'straight', in: 'straight'|'double'|'master',
//   starter: index van de speler die de eerste leg begint
// }
// Beginner wisselt per leg (doorlopend over sets): leg k begint bij starter + k.
import { evalDarts, evalTotal } from '../darts/x01rules.js'
import { TurnError } from '../darts/engine.js'

export function replayX01(cfg, inputs) {
  const players = cfg.players
  const n = players.length
  const legsToWin = Math.max(1, cfg.legs || 1)
  const setsToWin = Math.max(1, cfg.sets || 1)
  const solo = n === 1
  const out = cfg.out || 'double', inn = cfg.in || 'straight'
  const start = cfg.startScore

  const legs = []
  const flat = []
  const setsWon = Array(n).fill(0)
  const legsWonTotal = Array(n).fill(0)
  let legsInSet = Array(n).fill(0)
  let setNo = 1, globalLeg = 0, winner = null
  const newLeg = () => {
    const starter = ((cfg.starter || 0) + globalLeg) % n
    return { number: globalLeg + 1, set: setNo, legInSet: legsInSet.reduce((a, b) => a + b, 0) + 1, starter, remaining: Array(n).fill(start), isIn: Array(n).fill(inn === 'straight'), turns: [], winner: null }
  }
  let leg = newLeg()
  const seen = new Set()

  for (const t of inputs) {
    if (winner != null) throw new TurnError('Het spel is al afgelopen.', t.id)
    if (t.id != null) { if (seen.has(t.id)) throw new TurnError('Dubbele beurt.', t.id); seen.add(t.id) }
    const p = (leg.starter + leg.turns.length) % n
    const before = leg.remaining[p]
    const opts = { out, in: inn, isIn: leg.isIn[p] }
    const res = t.mode === 'darts' ? evalDarts(before, t.darts, opts) : evalTotal(before, t, opts)
    if (res.error) throw new TurnError(res.error, t.id)
    if (res.becameIn || (res.score > 0 && !leg.isIn[p])) leg.isIn[p] = true
    const turn = {
      id: t.id, seq: flat.length + 1, legNumber: leg.number, setNumber: leg.set, indexInLeg: leg.turns.length,
      player: p, side: players[p].type === 'me' ? 'me' : 'opp',
      mode: t.mode === 'darts' ? 'darts' : 'total', remainingBefore: before, remainingAfter: res.remainingAfter,
      score: res.score, dartsThrown: res.dartsThrown, isBust: res.isBust, isCheckout: res.isCheckout,
      darts: res.darts, dartsAtDouble: res.dartsAtDouble ?? null, input: t,
    }
    leg.turns.push(turn); flat.push(turn)
    leg.remaining[p] = res.remainingAfter

    if (res.isCheckout) {
      leg.winner = p
      legs.push(leg)
      legsWonTotal[p]++
      legsInSet[p]++
      globalLeg++
      const setDone = solo ? legsInSet[p] >= legsToWin : legsInSet[p] >= legsToWin
      if (setDone) {
        setsWon[p]++
        if (setsWon[p] >= setsToWin) { winner = p; break }
        setNo++
        legsInSet = Array(n).fill(0)
      }
      leg = newLeg()
    }
  }
  if (winner == null) legs.push(leg)
  const current = winner == null ? (leg.starter + leg.turns.length) % n : null
  const me = players.findIndex(pl => pl.type === 'me')
  const others = players.map((_, i) => i).filter(i => i !== me)
  const best = arr => (others.length ? Math.max(...others.map(i => arr[i])) : 0)

  return {
    kind: 'x01', players, n, solo, out, in: inn, startScore: start, legsToWin, setsToWin,
    legs, turns: flat, finished: winner != null, winner,
    current, currentLeg: legs[legs.length - 1],
    remaining: winner == null ? leg.remaining : legs[legs.length - 1].remaining,
    isIn: leg.isIn, legsInSet: winner == null ? legsInSet : legsInSet, setsWon, legsWonTotal, setNo,
    summary: {
      legsMe: me >= 0 ? legsWonTotal[me] : 0, legsOpp: best(legsWonTotal),
      setsMe: me >= 0 ? setsWon[me] : 0, setsOpp: best(setsWon),
      legs: legsWonTotal, sets: setsWon, names: players.map(pl => pl.name),
      winner: winner == null ? null : players[winner].name,
    },
  }
}
