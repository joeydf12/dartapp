// ── Around the Clock ─────────────────────────────────────────────────────────
// Gooi in volgorde 1, 2, … 20 en als laatste de bull. Elke dart die het
// huidige nummer raakt (single, double of treble) brengt je een stap verder.
// Beurt = { id, darts: [{ m, n }] } met 1 tot 3 darts. Eerst klaar wint.

export const CLOCK_TARGETS = [...Array.from({ length: 20 }, (_, i) => i + 1), 25]
const other = s => (s === 'me' ? 'opp' : 'me')

export class ClockError extends Error {}

export function replayClock(turns, { mode = 'pvp', first = 'me' } = {}) {
  const progress = { me: 0, opp: 0 }
  const out = []
  let side = first, winner = null
  for (const t of turns) {
    if (winner) throw new ClockError('Het spel is al afgelopen.')
    if (!Array.isArray(t.darts) || t.darts.length < 1 || t.darts.length > 3) throw new ClockError('Een beurt heeft 1 tot 3 darts.')
    let advanced = 0
    const darts = []
    for (let i = 0; i < t.darts.length; i++) {
      const d = t.darts[i]
      const target = CLOCK_TARGETS[progress[side]]
      const hit = d.m > 0 && d.n === target
      if (hit) { progress[side]++; advanced++ }
      darts.push({ m: d.m, n: d.n, points: hit ? 1 : 0, target })
      if (progress[side] >= CLOCK_TARGETS.length) {
        winner = side
        if (i < t.darts.length - 1) throw new ClockError('Na het winnen kunnen geen darts meer volgen.')
        break
      }
    }
    out.push({ id: t.id, seq: out.length + 1, side, score: advanced, darts, dartsThrown: darts.length })
    if (!winner && mode !== 'solo') side = other(side)
  }
  return {
    progress, turns: out, winner, finished: !!winner, current: winner ? null : side,
    target: side2 => CLOCK_TARGETS[progress[side2]] ?? null,
    summary: { progressMe: progress.me, progressOpp: progress.opp, dartsMe: out.filter(x => x.side === 'me').reduce((a, x) => a + x.dartsThrown, 0) },
  }
}
