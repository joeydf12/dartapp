// ── X01-regels met in- en uitgooi-varianten ─────────────────────────────────
// out: 'double' (standaard) | 'master' (dubbel of treble) | 'straight' (elke dart)
// in:  'straight' (standaard) | 'double' | 'master'
// Voor double out + straight in worden exact de bestaande regels (rules.js) gebruikt.
import {
  dartPoints, isValidDart, isOnDouble, doubleTarget, isPossibleTurnScore, IMPOSSIBLE_TURN_SCORES,
  evaluateDartsTurn, evaluateTotalTurn, checkTotalInput, doubleDartsRange, minDartsToFinish, bustScore,
} from './rules.js'

export const OUT_LABEL = { double: 'Dubbel uit', master: 'Master uit', straight: 'Straight uit' }
export const IN_LABEL = { straight: 'Straight in', double: 'Dubbel in', master: 'Master in' }

const ALL = (() => { const l = []; for (let n = 1; n <= 20; n++) for (let m = 1; m <= 3; m++) l.push({ m, n }); l.push({ m: 1, n: 25 }, { m: 2, n: 25 }); return l })()
const VALUES = [...new Set(ALL.map(dartPoints))]
const finishOk = (d, out) => (out === 'straight' ? d.m > 0 : out === 'master' ? d.m >= 2 : d.m === 2)
const opensOk = (d, inn) => (inn === 'straight' ? d.m > 0 : inn === 'master' ? d.m >= 2 : d.m === 2)
const finishValues = out => new Set(ALL.filter(d => finishOk(d, out)).map(dartPoints))
const FIN = { double: finishValues('double'), master: finishValues('master'), straight: finishValues('straight') }

export function onFinish1(r, out = 'double') { return FIN[out].has(r) }

export function minDarts(remaining, out = 'double') {
  if (out === 'double') return minDartsToFinish(remaining, true)
  if (!Number.isInteger(remaining) || remaining < 1) return null
  if (FIN[out].has(remaining)) return 1
  const ok = r => r > 0 && FIN[out].has(r) && (out === 'straight' || r >= 2)
  for (const v of VALUES) if (ok(remaining - v) && (out === 'straight' || remaining - v !== 1)) return 2
  for (const a of VALUES) for (const b of VALUES) if (ok(remaining - a - b)) return 3
  return null
}
export const canFinish = (r, out = 'double') => minDarts(r, out) != null
const leavesBust = (r, out) => r < 0 || (out !== 'straight' && r === 1)

// ── Per dart ────────────────────────────────────────────────────────────────
// opts: { out, in, isIn } → zelfde vorm als evaluateDartsTurn + becameIn
export function evalDarts(remaining, darts, { out = 'double', in: inn = 'straight', isIn = true } = {}) {
  if (out === 'double' && (inn === 'straight' || isIn)) return { ...evaluateDartsTurn(remaining, darts, true), becameIn: false }
  if (!Array.isArray(darts) || darts.length < 1 || darts.length > 3) return { error: 'Een beurt heeft 1 tot 3 darts.' }
  if (!darts.every(isValidDart)) return { error: 'Ongeldige dart in de beurt.' }
  let rem = remaining, inNow = isIn || inn === 'straight', becameIn = false
  const annotated = []
  for (let i = 0; i < darts.length; i++) {
    const d = darts[i]
    const before = rem
    if (!inNow && opensOk(d, inn)) { inNow = true; becameIn = true }
    const points = inNow ? dartPoints(d) : 0
    const target = out === 'double' && inNow ? doubleTarget(before) : null
    rem -= points
    const bust = leavesBust(rem, out) || (rem === 0 && !finishOk(d, out))
    const checkout = rem === 0 && !bust
    annotated.push({ m: d.m, n: d.n, points, remainingBefore: before, doubleTarget: target, doubleHit: target !== null ? checkout : null })
    const last = i === darts.length - 1
    if ((bust || checkout) && !last) return { error: 'Na een uitgooi of bust kunnen geen darts meer volgen.' }
    const atD = annotated.filter(x => x.doubleTarget !== null).length
    if (bust) return { score: 0, dartsThrown: 3, isBust: true, isCheckout: false, remainingBefore: remaining, remainingAfter: remaining, darts: annotated, dartsAtDouble: atD, becameIn: false }
    if (checkout) return { score: remaining, dartsThrown: i + 1, isBust: false, isCheckout: true, remainingBefore: remaining, remainingAfter: 0, darts: annotated, dartsAtDouble: atD, becameIn }
  }
  if (darts.length < 3) return { error: 'Vul de beurt aan tot 3 darts (gebruik Mis).' }
  return { score: remaining - rem, dartsThrown: 3, isBust: false, isCheckout: false, remainingBefore: remaining, remainingAfter: rem, darts: annotated, dartsAtDouble: annotated.filter(d => d.doubleTarget !== null).length, becameIn }
}

export function padTurn(remaining, darts, opts = {}) {
  const padded = [...darts]
  const r = evalDarts(remaining, padded, opts)
  if (!r.error) return padded
  while (padded.length < 3) padded.push({ m: 0, n: 0 })
  return padded
}

// ── Totaalinvoer ────────────────────────────────────────────────────────────
// Bij dubbel/master in voer je de punten in die telden (na de opening).
export function evalTotal(remaining, input, { out = 'double', in: inn = 'straight', isIn = true } = {}) {
  if (out === 'double') {
    const r = evaluateTotalTurn(remaining, input, true)
    return r.error ? r : { ...r, becameIn: !isIn && inn !== 'straight' && r.score > 0 }
  }
  const { score } = input
  if (!isPossibleTurnScore(score)) return { error: `Ongeldige beurtscore: ${score}` }
  const after = remaining - score
  const becameIn = !isIn && inn !== 'straight' && score > 0
  if (leavesBust(after, out)) return { score: 0, dartsThrown: 3, isBust: true, isCheckout: false, remainingBefore: remaining, remainingAfter: remaining, darts: null, dartsAtDouble: 0, becameIn: false }
  if (after === 0) {
    const min = minDarts(remaining, out)
    if (min == null) return { error: `${remaining} is niet uit te gooien.` }
    const used = input.dartsAtFinish ?? 3
    if (!Number.isInteger(used) || used < min || used > 3) return { error: `${remaining} uitgooien kan niet met ${used} dart(s).` }
    return { score, dartsThrown: used, isBust: false, isCheckout: true, remainingBefore: remaining, remainingAfter: 0, darts: null, dartsAtDouble: 0, becameIn }
  }
  return { score, dartsThrown: 3, isBust: false, isCheckout: false, remainingBefore: remaining, remainingAfter: after, darts: null, dartsAtDouble: 0, becameIn }
}

// Alles wat het invoerscherm moet weten voor één beurt.
export function turnRules(remaining, { out = 'double', in: inn = 'straight', isIn = true } = {}) {
  const dbl = out === 'double'
  return {
    out, in: inn, isIn,
    check(score) {
      if (dbl) return checkTotalInput(score, remaining, true)
      if (!Number.isInteger(score) || score < 0) return { ok: false, error: 'Voer een geldige score in.' }
      if (score > 180) return { ok: false, error: 'Een beurt is maximaal 180.' }
      if (IMPOSSIBLE_TURN_SCORES.includes(score)) return { ok: false, error: `${score} is met drie darts niet te gooien. Typefout?` }
      const after = remaining - score
      if (after < 0) return { ok: true, warnings: [`${score} is hoger dan de restscore (${remaining}). Dit wordt een bust.`] }
      if (out !== 'straight' && after === 1) return { ok: true, warnings: ['Dan blijft er 1 over. Dit wordt een bust.'] }
      if (after === 0) {
        if (!canFinish(remaining, out)) return { ok: false, error: `${remaining} is niet uit te gooien.` }
        return { ok: true, warnings: [], needsFinishInfo: true, minDarts: minDarts(remaining, out) }
      }
      return { ok: true, warnings: [], needsFinishInfo: false }
    },
    doubleRange(input) { return dbl && isIn ? doubleDartsRange(remaining, input, true) : { min: 0, max: 0 } },
    bust() {
      if (dbl) return bustScore(remaining, true)
      for (let s = remaining + 1; s <= 180; s++) if (isPossibleTurnScore(s)) return s
      if (out === 'master' && remaining - 1 >= 0 && isPossibleTurnScore(remaining - 1)) return remaining - 1
      return null
    },
    canOut: remaining <= 180 && canFinish(remaining, out) && isPossibleTurnScore(remaining),
    onFinish: r => onFinish1(r, out),
    evalDarts: darts => evalDarts(remaining, darts, { out, in: inn, isIn }),
    pad: darts => padTurn(remaining, darts, { out, in: inn, isIn }),
  }
}

export { isOnDouble }
