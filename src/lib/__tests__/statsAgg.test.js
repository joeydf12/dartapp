import { describe, it, expect } from 'vitest'
import { newGame, withInput, toPayload } from '../model.js'
import { buildStats, profileSummary } from '../statsAgg.js'

const T = (m, n) => ({ m, n })
const asData = games => {
  const ps = games.map(g => ({ g, p: toPayload(g) }))
  return { games: ps.map(x => x.p.game), turns: ps.flatMap(x => x.p.turns.map(t => ({ ...t, gameId: x.g.id }))) }
}
function x01(inputs, extra = {}) {
  let g = newGame({ kind: 'x01', mode: 'solo', config: { startScore: 101, legs: 1, doubleOut: true, starter: 'me', entry: 'darts' }, ...extra })
  for (const i of inputs) g = withInput(g, i)
  g.finishedAt = new Date().toISOString()
  return g
}

describe('statistieken', () => {
  const g1 = x01([
    { mode: 'darts', darts: [T(3, 20), T(1, 1), T(0, 0)] },   // 61 → 40 (op D20)
    { mode: 'darts', darts: [T(1, 20), T(0, 0), T(2, 10)] },  // D20 mis (S20 → 20, op D10), mis, D10 raak
  ])
  const g2 = x01([
    { mode: 'total', score: 60 },                              // 101 → 41
    { mode: 'total', score: 41, dartsAtFinish: 2, dartsAtDouble: 1 },
  ])
  const st = buildStats(asData([g1, g2]), { kind: 'x01' })

  it('telt uitgooi-% per kans en dubbel-% per dart apart', () => {
    // Kansen = beurten die begonnen op een uitgooibare rest: 101, 40 (g1) en 101, 41 (g2) → 4 kansen, 2 uit
    expect(st.checkout.chances).toBe(4)
    expect(st.checkout.turnPct).toBe(50)
    // Darts op de dubbel: g1 → mis op 40, S20 op 40, mis op 20, D10 raak = 4; g2 → 1 (opgegeven). Raak: 2
    expect(st.checkout.doubleDarts).toBe(5)
    expect(st.checkout.doubleHits).toBe(2)
  })
  it('dubbelkaart per dubbel', () => {
    expect(st.stats.doubles['20']).toEqual({ attempted: 2, hit: 0 })   // mis op 40 + S20 op 40
    expect(st.stats.doubles['10']).toEqual({ attempted: 2, hit: 1 })
  })
  it('legs, records en verdeling', () => {
    expect(st.legs.won).toBe(2)
    expect(st.legs.best).toBe(5)       // g2: 3 + 2 darts
    expect(st.records.bestAvg).toBeTruthy()
    expect(st.perGame.length).toBe(2)
    expect(st.dartStats.total).toBe(6)
    expect(st.countExact(60)).toBe(1)
  })
  it('extra details: uitgooi per aantal darts, rest na 9, per beurt', () => {
    expect(st.extra.byDarts.find(b => b.n === 3).count).toBe(1)
    expect(st.extra.byDarts.find(b => b.n === 2).count).toBe(1)
    expect(st.extra.dartsPerCheckout).toBe(2.5)
    expect(st.extra.visit[0].avg).toBe(60.5)
  })
  it('profiel-samenvatting', () => {
    const p = profileSummary(asData([g1, g2]))
    expect(p.games).toBe(2)
    expect(p.avg3).toBeGreaterThan(0)
  })
  it('periode-filter', () => {
    const old = x01([{ mode: 'total', score: 60 }])
    old.startedAt = '2020-01-01T00:00:00.000Z'
    const s = buildStats(asData([old, g1]), { kind: 'x01', period: '30' })
    expect(s.overview.games).toBe(1)
  })
})
