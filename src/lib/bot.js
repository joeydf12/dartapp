// ── Dartbot ──────────────────────────────────────────────────────────────────
// Niveau 1..10. Gooit dart voor dart op het bord: mikt op de beste dart
// (T20, of de uitgooiroute) en raakt met een kans die met het niveau stijgt;
// mis je, dan land je op een buurvak. Geeft invoer in dezelfde vorm als jij.
import { evaluateDartsTurn, dartPoints } from './darts/rules.js'
import { checkoutRoute } from './darts/checkouts.js'
import { cricketTarget } from './games/cricket.js'
import { CLOCK_TARGETS } from './games/aroundClock.js'

const BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const MISS = { m: 0, n: 0 }
export const BOT_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1)
export const botName = level => `Bot niveau ${level}`

const skill = level => (Math.min(10, Math.max(1, level)) - 1) / 9

function neighbours(n) {
  const i = BOARD.indexOf(n)
  return [BOARD[(i + BOARD.length - 1) % BOARD.length], BOARD[(i + 1) % BOARD.length]]
}

// Eén dart op `aim` ({ m, n }) gooien.
export function throwDart(aim, level, rnd = Math.random) {
  const s = skill(level)
  const r = rnd()
  if (aim.n === 25) {
    const p = aim.m === 2 ? 0.07 + 0.38 * s : 0.30 + 0.45 * s
    if (r < p) return { m: aim.m, n: 25 }
    const q = rnd()
    if (q < 0.45) return { m: 1, n: 25 }
    if (q < 0.55) return { ...MISS }
    return { m: 1, n: BOARD[Math.floor(rnd() * 20)] }
  }
  const p = aim.m === 3 ? 0.08 + 0.42 * s : aim.m === 2 ? 0.10 + 0.40 * s : 0.62 + 0.33 * s
  if (r < p) return { m: aim.m, n: aim.n }
  const [a, b] = neighbours(aim.n)
  const q = rnd()
  if (aim.m === 3) return q < 0.55 ? { m: 1, n: aim.n } : q < 0.77 ? { m: 1, n: a } : q < 0.99 ? { m: 1, n: b } : { ...MISS }
  if (aim.m === 2) return q < 0.35 ? { ...MISS } : q < 0.70 ? { m: 1, n: aim.n } : q < 0.85 ? { m: 1, n: a } : { m: 1, n: b }
  return q < 0.5 ? { m: 1, n: a } : { m: 1, n: b }
}

// Straight out: elke dart die precies op 0 komt is uit. Anders zo hoog mogelijk zonder bust.
function aimStraight(r) {
  if (r <= 20) return { m: 1, n: r }
  if (r === 25 || r === 50) return { m: r / 25, n: 25 }
  if (r <= 40 && r % 2 === 0) return { m: 2, n: r / 2 }
  if (r <= 60 && r % 3 === 0) return { m: 3, n: r / 3 }
  if (r > 60) return { m: 3, n: 20 }
  return { m: 1, n: Math.min(20, r - 2) } // laat een makkelijke rest over
}

function aimFor(remaining, dartsLeft, doubleOut) {
  if (!doubleOut) return aimStraight(remaining)
  if (remaining <= 170) {
    const route = checkoutRoute(remaining, dartsLeft)
    if (route) return route[0]
    // Geen route (bogey): zet een veilige score neer.
    if (remaining > 100) return { m: 3, n: 20 }
    return { m: 1, n: remaining > 60 ? 20 : 19 }
  }
  return { m: 3, n: 20 }
}

// Een X01-beurt voor de bot: geeft engine-invoer { mode: 'darts', darts }.
export function botX01Turn(remaining, level, doubleOut = true, rnd = Math.random) {
  const darts = []
  let rem = remaining
  for (let i = 0; i < 3; i++) {
    const d = throwDart(aimFor(rem, 3 - i, doubleOut), level, rnd)
    darts.push(d)
    const res = evaluateDartsTurn(remaining, darts, doubleOut)
    // Klaar zodra de beurt eindigt (bust, uitgooi of drie darts); anders gewoon door.
    if (!res.error) return { mode: 'darts', darts }
    rem -= dartPoints(d)
  }
  return { mode: 'darts', darts }
}

export function botCricketTurn(state, side, level, rnd = Math.random) {
  const darts = []
  for (let i = 0; i < 3; i++) {
    const n = cricketTarget(state, side)
    darts.push(throwDart({ m: n === 25 ? 2 : 3, n }, level, rnd))
  }
  return { darts }
}

export function botClockTurn(progress, level, rnd = Math.random) {
  const darts = []
  let p = progress
  for (let i = 0; i < 3; i++) {
    const n = CLOCK_TARGETS[p]
    if (n === undefined) break
    const d = throwDart({ m: n === 25 ? 2 : 1, n }, level, rnd)
    darts.push(d)
    if (d.m > 0 && d.n === n) p++
  }
  return { darts }
}
