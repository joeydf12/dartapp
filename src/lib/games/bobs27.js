// ── Bob's 27 (dubbels trainen) ───────────────────────────────────────────────
// Start met 27 punten. Gooi per ronde 3 darts op één dubbel: D1, D2, … D20 en D-bull.
// Elke raak: + de waarde van de dubbel. Geen enkele raak: − de waarde van de dubbel.
// Je score ≤ 0 = af. Solo. Beurt = { id, hits: 0..3 }.

export const BOBS_TARGETS = [...Array.from({ length: 20 }, (_, i) => i + 1), 25]
export class BobsError extends Error {}

export function replayBobs(turns) {
  let score = 27
  const out = []
  let over = false
  for (const t of turns) {
    if (over) throw new BobsError('Het spel is al afgelopen.')
    if (!Number.isInteger(t.hits) || t.hits < 0 || t.hits > 3) throw new BobsError('Aantal geraakt moet 0 tot 3 zijn.')
    const target = BOBS_TARGETS[out.length]
    if (target === undefined) throw new BobsError('Alle dubbels zijn gegooid.')
    const value = target === 25 ? 50 : target * 2
    const delta = t.hits > 0 ? value * t.hits : -value
    score += delta
    const darts = Array.from({ length: 3 }, (_, i) => (i < t.hits ? { m: 2, n: target, points: value } : { m: 0, n: 0, points: 0 }))
    out.push({ id: t.id, seq: out.length + 1, side: 'me', score: delta, darts, dartsThrown: 3, target, hits: t.hits, scoreAfter: score })
    if (score <= 0) over = true
  }
  const finished = over || out.length >= BOBS_TARGETS.length
  return {
    score, turns: out, finished, busted: over, winner: null,
    nextTarget: finished ? null : BOBS_TARGETS[out.length],
    summary: { finalScore: score, rounds: out.length, hits: out.reduce((a, t) => a + t.hits, 0), busted: over },
  }
}
