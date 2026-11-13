// ── Dartbot ──────────────────────────────────────────────────────────────────
// Niveau 1..20. Gooit dart voor dart op het bord: mikt op de beste dart
// (T20, of de uitgooiroute) en raakt met een kans die met het niveau stijgt;
// mis je, dan land je op een buurvak. Geeft invoer in dezelfde vorm als jij.
// Oude spellen gebruikten niveau 1..10; die worden omgerekend (legacyLevel).
import { dartPoints } from './darts/rules.js'
import { evalDarts } from './darts/x01rules.js'
import { checkoutRoute } from './darts/checkouts.js'
import { cricketTarget } from './games/cricket.js'
import { CLOCK_TARGETS } from './games/aroundClock.js'
import { hitsTarget } from './games/training.js'

const BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const MISS = { m: 0, n: 0 }
export const MAX_LEVEL = 20
export const BOT_LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1)
export const botName = level => `Bot niveau ${level}`
// Oud niveau (1..10) → nieuwe schaal (1..20), zelfde sterkte.
export const legacyLevel = l => 1 + ((Math.min(10, Math.max(1, l)) - 1) * 19) / 9

// Verwacht 3-dart gemiddelde per niveau (gesimuleerd, 501 dubbel uit).
export const LEVEL_AVG = [31, 36, 40, 45, 46, 50, 54, 56, 60, 65, 69, 71, 78, 81, 87, 89, 94, 97, 104, 107]
export const levelForAverage = avg => {
  let best = 1
  for (let l = 1; l <= MAX_LEVEL; l++) if (Math.abs(LEVEL_AVG[l - 1] - avg) < Math.abs(LEVEL_AVG[best - 1] - avg)) best = l
  return best
}

const skill = level => (Math.min(MAX_LEVEL, Math.max(1, level)) - 1) / (MAX_LEVEL - 1)

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
  const p = aim.m === 3 ? 0.08 + 0.37 * s + 0.15 * s * s : aim.m === 2 ? 0.10 + 0.35 * s + 0.12 * s * s : 0.62 + 0.33 * s
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

function aimFor(remaining, dartsLeft, { out = 'double', in: inn = 'straight', isIn = true } = {}) {
  if (!isIn && inn !== 'straight') return inn === 'master' ? { m: 3, n: 20 } : { m: 2, n: 20 }
  if (out === 'straight') return aimStraight(remaining)
  if (out === 'master' && remaining <= 60 && remaining % 3 === 0 && remaining / 3 <= 20 && !(remaining <= 40 && remaining % 2 === 0)) return { m: 3, n: remaining / 3 }
  if (remaining <= 170) {
    const route = checkoutRoute(remaining, dartsLeft)
    if (route) return route[0]
    // Geen route (bogey): zet een veilige score neer.
    if (remaining > 100) return { m: 3, n: 20 }
    return { m: 1, n: remaining > 60 ? 20 : 19 }
  }
  return { m: 3, n: 20 }
}

// Een X01-beurt voor de bot. opts: true/false (dubbel uit, oud) of { out, in, isIn }.
export function botX01Turn(remaining, level, opts = true, rnd = Math.random) {
  const o = typeof opts === 'object' ? opts : { out: opts ? 'double' : 'straight' }
  const darts = []
  let rem = remaining, isIn = o.isIn ?? true
  for (let i = 0; i < 3; i++) {
    const d = throwDart(aimFor(rem, 3 - i, { ...o, isIn }), level, rnd)
    darts.push(d)
    const res = evalDarts(remaining, darts, o)
    // Klaar zodra de beurt eindigt (bust, uitgooi of drie darts); anders gewoon door.
    if (!res.error) return { mode: 'darts', darts }
    if (!isIn && (o.in === 'master' ? d.m >= 2 : d.m === 2)) isIn = true
    if (isIn) rem -= dartPoints(d)
  }
  return { mode: 'darts', darts }
}

export function botCricketTurn(state, side, level, rnd = Math.random, numbers) {
  const darts = []
  for (let i = 0; i < 3; i++) {
    const n = cricketTarget(state, side, numbers)
    darts.push(throwDart({ m: n === 25 ? 2 : 3, n }, level, rnd))
  }
  return { darts }
}

export function botClockTurn(progress, level, rnd = Math.random) {
  return botTargetsTurn(CLOCK_TARGETS, progress, 'any', level, rnd)
}

// Doelen op volgorde (Around the Clock-varianten, Doubles Training).
export function botTargetsTurn(targets, progress, need, level, rnd = Math.random) {
  const darts = []
  let p = progress
  for (let i = 0; i < 3; i++) {
    const n = targets[p]
    if (n === undefined) break
    const m = need === 'double' ? 2 : need === 'treble' ? (n === 25 ? 2 : 3) : n === 25 ? 1 : 1
    const d = throwDart({ m, n }, level, rnd)
    darts.push(d)
    if (hitsTarget(d, n, need)) p++
    if (p >= targets.length) break
  }
  return { darts: darts.length ? darts : [{ ...MISS }] }
}

// Shanghai / rondes: mik op de treble van het doel (bull: 25).
export function botRoundsTurn(target, level, rnd = Math.random) {
  return { darts: [0, 1, 2].map(() => throwDart(target === 25 ? { m: 1, n: 25 } : { m: 3, n: target }, level, rnd)) }
}

// Killer: eerst je eigen dubbel; als killer de dubbel van wie de meeste levens heeft.
export function botKillerTurn(raw, p, level, rnd = Math.random) {
  const darts = []
  let isKiller = raw.killer[p]
  const lives = [...raw.lives]
  for (let i = 0; i < 3; i++) {
    let aimN
    if (!isKiller) aimN = raw.numbers[p]
    else {
      const targets = lives.map((l, q) => (q !== p && l > 0 ? q : -1)).filter(q => q >= 0)
      if (!targets.length) break
      targets.sort((a, b) => lives[a] - lives[b])
      aimN = raw.numbers[targets[0]]
    }
    const d = throwDart({ m: 2, n: aimN }, level, rnd)
    darts.push(d)
    if (d.m === 2) {
      const owner = raw.numbers.indexOf(d.n)
      if (owner === p && !isKiller) isKiller = true
      else if (owner >= 0 && isKiller && lives[owner] > 0) { lives[owner]--; if (lives.filter(l => l > 0).length <= 1 || lives[p] <= 0) break }
    }
  }
  return { darts }
}
