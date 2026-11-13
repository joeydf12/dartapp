import { describe, it, expect } from 'vitest'
import { replayCricket } from '../games/cricket.js'
import { replayClock } from '../games/aroundClock.js'
import { replayBobs } from '../games/bobs27.js'
import { replaySolo } from '../games/x01solo.js'
import { replayMatch } from '../darts/engine.js'
import { botX01Turn, botCricketTurn, botClockTurn } from '../bot.js'
import { computePlayerStats } from '../darts/stats.js'

const T = (m, n) => ({ m, n })
const lcg = seed => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

describe('cricket', () => {
  it('telt marks en punten, en wint pas met alles dicht en genoeg punten', () => {
    const r = replayCricket([
      { id: 'a', darts: [T(3, 20), T(1, 20), T(0, 0)] },       // me: 20 dicht (3), 1 extra mark → 20 punten (opp heeft 20 nog open)
    ], { mode: 'pvp' })
    expect(r.state.me.marks[20]).toBe(3)
    expect(r.state.me.points).toBe(20)
    expect(r.current).toBe('opp')
  })
  it('solo: klaar zodra alles gesloten is', () => {
    const turns = [
      { id: 1, darts: [T(3, 20), T(3, 19), T(3, 18)] },
      { id: 2, darts: [T(3, 17), T(3, 16), T(3, 15)] },
      { id: 3, darts: [T(2, 25), T(1, 25)] },
    ]
    const r = replayCricket(turns, { mode: 'solo' })
    expect(r.finished).toBe(true)
    expect(r.winner).toBe('me')
    expect(r.turns[2].dartsThrown).toBe(2)
  })
  it('bull telt maximaal 2 marks per dart', () => {
    const r = replayCricket([{ id: 1, darts: [T(3, 25)] }], { mode: 'solo' })
    expect(r.state.me.marks[25]).toBe(2)
  })
  it('geen darts meer na winst', () => {
    const t = [
      { id: 1, darts: [T(3, 20), T(3, 19), T(3, 18)] }, { id: 2, darts: [T(3, 17), T(3, 16), T(3, 15)] },
      { id: 3, darts: [T(2, 25), T(1, 25)] }, { id: 4, darts: [T(1, 20)] },
    ]
    expect(() => replayCricket(t, { mode: 'solo' })).toThrow()
  })
})

describe('around the clock', () => {
  it('gaat stap voor stap en raakt alleen het huidige nummer', () => {
    const r = replayClock([{ id: 1, darts: [T(1, 1), T(2, 3), T(3, 2)] }], { mode: 'solo' })
    expect(r.progress.me).toBe(2) // S1 raak, D3 mis (doel is 2), T2 raak
  })
  it('klaar na 21 hits', () => {
    const turns = []
    for (let i = 1; i <= 20; i++) turns.push({ id: i, darts: [T(1, i)] })
    turns.push({ id: 21, darts: [T(2, 25)] })
    const r = replayClock(turns, { mode: 'solo' })
    expect(r.finished).toBe(true)
  })
})

describe("bob's 27", () => {
  it('raak = erbij, mis = eraf', () => {
    const r = replayBobs([{ id: 1, hits: 1 }, { id: 2, hits: 0 }])
    expect(r.score).toBe(27 + 2 - 4)
  })
  it('af bij score ≤ 0', () => {
    const r = replayBobs([{ id: 1, hits: 0 }, { id: 2, hits: 0 }, { id: 3, hits: 0 }, { id: 4, hits: 0 }, { id: 5, hits: 0 }])
    expect(r.finished).toBe(true)
    expect(r.busted).toBe(true)
  })
})

describe('x01 solo', () => {
  it('uitgooien met per-dart invoer telt dubbelkansen mee', () => {
    const r = replaySolo({ startScore: 101, legs: 1 }, [
      { id: 1, mode: 'darts', darts: [T(3, 20), T(1, 1), T(0, 0)] },       // 61 → rest 40
      { id: 2, mode: 'darts', darts: [T(0, 0), T(2, 20)] },                // mis, dan D20 uit
    ])
    expect(r.finished).toBe(true)
    expect(r.turns[1].isCheckout).toBe(true)
    const s = computePlayerStats(r.turns).get('me')
    expect(s.doublesAttempted).toBe(3)
    expect(s.doublesHit).toBe(1)
  })
})

describe('dartbot', () => {
  const avgFor = (level, n = 400) => {
    const rnd = lcg(level * 977 + 1)
    let points = 0, darts = 0
    for (let g = 0; g < n; g++) {
      let rem = 501
      while (rem > 0) {
        const input = botX01Turn(rem, level, true, rnd)
        const setup = { format: { legsToWin: 1, startScore: rem }, lineup: { home: ['me'], away: ['x'] }, bullOff: { homePlayerId: 'me', awayPlayerId: 'x', winner: 'home' }, firstThrower: { home: 'me', away: 'x' } }
        const st = replayMatch(setup, [{ id: 't', ...input }])
        const t = st.turns[0]
        points += t.score; darts += t.dartsThrown
        rem = t.remainingAfter
      }
    }
    return (points / darts) * 3
  }
  it('geeft altijd geldige beurten en wordt sterker per niveau', () => {
    const a1 = avgFor(1, 120), a5 = avgFor(5, 120), a10 = avgFor(10, 120)
    console.log('bot gemiddelden', a1.toFixed(1), a5.toFixed(1), a10.toFixed(1))
    expect(a1).toBeLessThan(a5)
    expect(a5).toBeLessThan(a10)
    expect(a1).toBeGreaterThan(15)
    expect(a10).toBeLessThan(120)
  })
  it('cricket- en klokbeurten zijn geldig', () => {
    const rnd = lcg(5)
    const c = replayCricket(Array.from({ length: 30 }, (_, i) => ({ id: i })).map(() => botCricketTurn({ me: { marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 } }, opp: { marks: {} } }, 'me', 5, rnd)).slice(0, 3).map((t, i) => ({ id: i, ...t })), { mode: 'solo' })
    expect(c.turns.length).toBe(3)
    const k = botClockTurn(0, 5, rnd)
    expect(k.darts.length).toBeGreaterThan(0)
  })
})
