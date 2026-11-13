// ── Uitgooi-hints (170 en lager, dubbel uit) ─────────────────────────────────
// Berekend in plaats van een handgeschreven tabel, zodat elke restscore een
// route heeft. Voorkeur: zo min mogelijk darts; daarna een veilige opzet
// (single vóór treble) en een "fijne" dubbel (D20, D16, D18, ...).

import { dartLabel, isOnDouble } from './rules.js'

const DOUBLE_PREF = [20, 16, 18, 12, 10, 8, 19, 17, 15, 14, 13, 11, 9, 7, 6, 4, 5, 3, 2, 1, 25]
const SETUP_PREF = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ m: 1, n })),
  { m: 1, n: 25 },
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ m: 3, n })),
  { m: 2, n: 25 },
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ m: 2, n })),
]
// Eerste dart van een 3-darts finish: zo veel mogelijk scoren.
const FIRST_PREF = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10].map(n => ({ m: 3, n })),
  { m: 2, n: 25 }, { m: 1, n: 25 },
  ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ m: 3, n })),
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ m: 1, n })),
]

const pts = d => d.m * d.n
const finishDart = r => (r === 50 ? { m: 2, n: 25 } : { m: 2, n: r / 2 })
// Favoriete dubbel (instelling) gaat vóór de standaardvolgorde.
let favourite = null
export function setFavouriteDouble(n) { favourite = Number.isInteger(n) ? n : null }
const doubleRank = r => {
  const n = r === 50 ? 25 : r / 2
  if (favourite && n === favourite) return -1
  return DOUBLE_PREF.indexOf(n)
}

function twoDart(rem) {
  let best = null
  for (const [i, d] of SETUP_PREF.entries()) {
    const r = rem - pts(d)
    if (r < 2 || !isOnDouble(r)) continue
    // Single-opzet wint altijd van treble; binnen een soort telt de dubbel het zwaarst.
    const key = (d.m === 1 ? 0 : 1000) + doubleRank(r) * 50 + i
    if (!best || key < best.key) best = { key, route: [d, finishDart(r)] }
  }
  return best?.route || null
}

export function checkoutRoute(remaining, dartsLeft = 3) {
  if (!Number.isInteger(remaining) || remaining < 2 || remaining > 170) return null
  if (isOnDouble(remaining)) return [finishDart(remaining)]
  if (dartsLeft >= 2) {
    const two = twoDart(remaining)
    if (two) return two
  }
  if (dartsLeft >= 3) {
    for (const d of FIRST_PREF) {
      const r = remaining - pts(d)
      if (r < 2) continue
      if (isOnDouble(r)) return [d, finishDart(r)]
      const two = twoDart(r)
      if (two) return [d, ...two]
    }
  }
  return null
}

export function checkoutHint(remaining, dartsLeft = 3) {
  const route = checkoutRoute(remaining, dartsLeft)
  return route ? route.map(dartLabel).join(' · ') : null
}
