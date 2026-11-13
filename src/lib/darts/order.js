// ── Bull-off en beurtvolgorde ────────────────────────────────────────────────
// Alles wordt afgeleid uit de bevestigde beginvolgorde:
//   lineup:  { home: [spelerA, spelerB], away: [spelerC, spelerD] }  (competitie: altijd 2 tegen 2)
//            { home: [spelerA], away: [spelerC] }                    (vrij oefenpotje: 1 tegen 1)
//   bullOff: { homePlayerId, awayPlayerId, winner: 'home' | 'away' }
//   firstThrower: { home: spelerId, away: spelerId }  (eerste werper in leg 1)
// Regels:
//   - Leg 1 begint het team dat de bull-off won; daarna wisselt de beginnende kant elke leg.
//   - Binnen een team begint in leg 1 de gekozen eerste werper; dat wisselt elke leg.
//   - Binnen een leg gooien de teams om en om, en binnen een team de twee spelers om en om.

export const SIDES = ['home', 'away']
export const otherSide = s => (s === 'home' ? 'away' : 'home')

export class OrderError extends Error {}

export function validateOrder(lineup, bullOff, firstThrower) {
  for (const side of SIDES) {
    const players = lineup?.[side]
    const valid = Array.isArray(players) && (players.length === 1 || players.length === 2) && players.every(Boolean) && new Set(players).size === players.length
    if (!valid) throw new OrderError(`Team ${side} moet één of twee verschillende spelers hebben.`)
    if (!players.includes(firstThrower?.[side])) throw new OrderError(`Eerste werper van ${side} hoort niet bij het team.`)
  }
  const all = [...lineup.home, ...lineup.away]
  if (lineup.home.length !== lineup.away.length) throw new OrderError('Beide teams moeten evenveel spelers hebben.')
  if (new Set(all).size !== all.length) throw new OrderError('Een speler kan niet in beide teams staan.')
  if (!bullOff || !SIDES.includes(bullOff.winner)) throw new OrderError('Kies de winnaar van de bull-off.')
  if (!lineup.home.includes(bullOff.homePlayerId)) throw new OrderError('Bull-off speler thuis hoort niet bij het team.')
  if (!lineup.away.includes(bullOff.awayPlayerId)) throw new OrderError('Bull-off speler uit hoort niet bij het team.')
}

export function teammate(lineup, side, playerId) {
  const [a, b] = lineup[side]
  if (b === undefined) return a // 1 tegen 1: je teamgenoot ben je zelf
  return playerId === a ? b : a
}

export function legStartSide(bullOff, legNumber) {
  return legNumber % 2 === 1 ? bullOff.winner : otherSide(bullOff.winner)
}

export function legFirstThrower(lineup, firstThrower, side, legNumber) {
  const first = firstThrower[side]
  return legNumber % 2 === 1 ? first : teammate(lineup, side, first)
}

// Wie is aan de beurt bij beurt `turnIndex` (0-based, beide teams samen) in leg `legNumber`?
export function expectedThrower(setup, legNumber, turnIndex) {
  const { lineup, bullOff, firstThrower } = setup
  const start = legStartSide(bullOff, legNumber)
  const side = turnIndex % 2 === 0 ? start : otherSide(start)
  const teamTurn = Math.floor(turnIndex / 2)
  const first = legFirstThrower(lineup, firstThrower, side, legNumber)
  const playerId = teamTurn % 2 === 0 ? first : teammate(lineup, side, first)
  return { side, playerId }
}

// De gooivolgorde van een leg (één ronde van vier beurten), om vóór de leg te tonen.
export function legPlan(setup, legNumber) {
  return {
    legNumber,
    startSide: legStartSide(setup.bullOff, legNumber),
    sequence: [0, 1, 2, 3].map(i => expectedThrower(setup, legNumber, i)),
  }
}
