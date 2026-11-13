// ── Cricket ──────────────────────────────────────────────────────────────────
// Nummers 20..15 en de bull. Drie marks sluit een nummer; daarna scoor je
// punten zolang de tegenstander het nummer nog niet gesloten heeft.
// Winnaar: alles gesloten én minstens evenveel punten. Solo: alles sluiten.
// Een beurt = { id, darts: [{ m, n }] } met 1 tot 3 darts. Kant: 'me' | 'opp'.

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25]
const other = s => (s === 'me' ? 'opp' : 'me')

const emptySide = () => ({ marks: Object.fromEntries(CRICKET_NUMBERS.map(n => [n, 0])), points: 0 })
const allClosed = s => CRICKET_NUMBERS.every(n => s.marks[n] >= 3)

export class CricketError extends Error {}

export function replayCricket(turns, { mode = 'pvp', first = 'me' } = {}) {
  const state = { me: emptySide(), opp: emptySide() }
  const out = []
  let side = first
  let winner = null
  const solo = mode === 'solo'
  for (const t of turns) {
    if (winner) throw new CricketError('Het spel is al afgelopen.')
    if (!Array.isArray(t.darts) || t.darts.length < 1 || t.darts.length > 3) throw new CricketError('Een beurt heeft 1 tot 3 darts.')
    const mine = state[side], theirs = state[other(side)]
    let gained = 0
    const darts = []
    for (let i = 0; i < t.darts.length; i++) {
      const d = t.darts[i]
      let points = 0
      if (d.m > 0 && CRICKET_NUMBERS.includes(d.n)) {
        const marks = d.n === 25 ? Math.min(d.m, 2) : d.m
        for (let k = 0; k < marks; k++) {
          if (mine.marks[d.n] < 3) mine.marks[d.n]++
          else if (!solo && theirs.marks[d.n] < 3) points += d.n
        }
      }
      mine.points += points
      gained += points
      darts.push({ m: d.m, n: d.n, points })
      if (allClosed(mine) && (solo || mine.points >= theirs.points)) {
        winner = side
        if (i < t.darts.length - 1) throw new CricketError('Na het winnen kunnen geen darts meer volgen.')
        break
      }
    }
    out.push({ id: t.id, seq: out.length + 1, side, score: gained, darts, dartsThrown: darts.length })
    if (!winner && !solo) side = other(side)
  }
  const marksTotal = s => CRICKET_NUMBERS.reduce((a, n) => a + Math.min(s.marks[n], 3), 0)
  return {
    state, turns: out, winner, finished: !!winner, current: winner ? null : side,
    summary: { marksMe: marksTotal(state.me), marksOpp: marksTotal(state.opp), pointsMe: state.me.points, pointsOpp: state.opp.points },
  }
}

// Voor de dartbot: welk nummer pakt `side` het liefst aan?
export function cricketTarget(state, side) {
  const mine = state[side].marks, theirs = state[other(side)].marks
  const open = CRICKET_NUMBERS.filter(n => mine[n] < 3)
  if (open.length) return open[0]
  const scoring = CRICKET_NUMBERS.filter(n => theirs[n] < 3)
  return scoring.length ? scoring[0] : 20
}
