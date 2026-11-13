// ── Spelersstatistieken uit beurtgegevens ────────────────────────────────────
// Alles volgt uit de beurten zelf (uitvoer van replayMatch of rijen uit de
// database met dezelfde velden). Er wordt niets opgeteld dat kan afwijken.
//
// Een beurt nodig: { matchId?, legNumber, playerId, score, dartsThrown, isBust,
//   isCheckout, remainingBefore, mode, darts? (met doubleTarget/doubleHit) }

// Score-categorieën voor het overzicht "hoe vaak 20+, 30+, …". Cumulatief:
// een 45 telt mee bij 20+, 30+ en 40+. Busts tellen nergens mee; 180 is exact.
export const SCORE_BANDS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180]
export const bandLabel = b => (b === 180 ? "180" : `${b}+`)

import { canCheckout } from './rules.js'

function emptyStats(playerId) {
  return {
    playerId,
    turns: 0, darts: 0, points: 0,
    avg3: 0, first9Avg: null, last9Avg: null,
    bands: Object.fromEntries(SCORE_BANDS.map(b => [b, 0])),
    scores60Plus: 0, scores80Plus: 0, scores100Plus: 0, scores140Plus: 0, scores180: 0,
    highestTurn: null, lowestTurn: null,
    highestCheckout: null, checkouts: 0, busts: 0,
    doublesAttempted: 0, doublesHit: 0, checkoutPct: null,
    doubles: {}, // { [target]: { attempted, hit } } — alleen uit invoer per dart
    mostMissedDouble: null,
    dartDataTurns: 0, // aantal beurten waarvan de losse darts bekend zijn
    doubleUnknown: 0, // beurten waarbij op een dubbel gegooid kan zijn maar het aantal onbekend is (oude invoer)
  }
}

const avg = (points, darts) => (darts ? (points / darts) * 3 : null)

export function computePlayerStats(turns) {
  const byPlayer = new Map()
  const legGroups = new Map() // speler|wedstrijd|leg → beurten in volgorde

  for (const t of turns) {
    if (!t.playerId) continue
    if (!byPlayer.has(t.playerId)) byPlayer.set(t.playerId, emptyStats(t.playerId))
    const s = byPlayer.get(t.playerId)
    s.turns++
    s.darts += t.dartsThrown
    s.points += t.score
    if (t.isBust) s.busts++
    else {
      for (const b of SCORE_BANDS) if (t.score >= b) s.bands[b]++
      if (t.score >= 60) s.scores60Plus++
      if (t.score >= 80) s.scores80Plus++
      if (t.score >= 100) s.scores100Plus++
      if (t.score >= 140) s.scores140Plus++
      if (t.score === 180) s.scores180++
      s.highestTurn = Math.max(s.highestTurn ?? 0, t.score)
      // Laagste beurt: busts en uitgooibeurten tellen niet mee (een uitgooi op 2 is geen slechte beurt).
      if (!t.isCheckout) s.lowestTurn = s.lowestTurn === null ? t.score : Math.min(s.lowestTurn, t.score)
    }
    if (t.mode !== 'darts' && t.dartsAtDouble == null && 'dartsAtDouble' in t) s.doubleUnknown++
    if (t.isCheckout) {
      s.checkouts++
      s.highestCheckout = Math.max(s.highestCheckout ?? 0, t.score)
    }
    // Totaalinvoer: aantal darts op de dubbel is gevraagd (of stond vast). Raak = uitgegooid.
    if (t.mode !== 'darts' && t.dartsAtDouble > 0) {
      s.doublesAttempted += t.dartsAtDouble
      if (t.isCheckout) s.doublesHit++
    }
    if (t.mode === 'darts' && Array.isArray(t.darts)) {
      s.dartDataTurns++
      for (const d of t.darts) {
        if (d.doubleTarget == null) continue
        s.doublesAttempted++
        if (d.doubleHit) s.doublesHit++
        const k = String(d.doubleTarget)
        s.doubles[k] ??= { attempted: 0, hit: 0 }
        s.doubles[k].attempted++
        if (d.doubleHit) s.doubles[k].hit++
      }
    }
    const key = `${t.playerId}|${t.matchId ?? ''}|${t.legNumber}`
    if (!legGroups.has(key)) legGroups.set(key, [])
    legGroups.get(key).push(t)
  }

  const nine = new Map() // speler → { fp, fd, lp, ld }
  for (const [key, list] of legGroups) {
    const pid = key.split('|')[0]
    const acc = nine.get(pid) || { fp: 0, fd: 0, lp: 0, ld: 0 }
    for (const t of list.slice(0, 3)) { acc.fp += t.score; acc.fd += t.dartsThrown }
    for (const t of list.slice(-3)) { acc.lp += t.score; acc.ld += t.dartsThrown }
    nine.set(pid, acc)
  }

  for (const s of byPlayer.values()) {
    s.avg3 = avg(s.points, s.darts) ?? 0
    const n = nine.get(s.playerId)
    s.first9Avg = avg(n.fp, n.fd)
    s.last9Avg = avg(n.lp, n.ld)
    s.checkoutPct = s.doublesAttempted ? (s.doublesHit / s.doublesAttempted) * 100 : null
    let worst = null
    for (const [target, d] of Object.entries(s.doubles)) {
      const missed = d.attempted - d.hit
      if (missed <= 0) continue
      if (!worst || missed > worst.missed || (missed === worst.missed && d.attempted > worst.attempted)) {
        worst = { target: Number(target), missed, attempted: d.attempted }
      }
    }
    s.mostMissedDouble = worst
  }
  return byPlayer
}

// ── Teamstatistieken voor het eindscherm ─────────────────────────────────────
// Zelfde berekening als per speler, maar dan per team (home/away) over de
// uitkomst van replayMatch. Daarbij: beste/slechtste gewonnen leg (in darts) en
// uitgooikansen = beurten die begonnen op een stand die uit te gooien was.
export function computeSideStats(state) {
  const doubleOut = state.format?.doubleOut ?? true
  const asSide = state.turns.map(t => ({ ...t, playerId: t.side, matchId: null }))
  const base = computePlayerStats(asSide)
  const out = {}
  for (const side of ['home', 'away']) {
    const s = base.get(side) || { ...emptyStats(side), avg3: 0 }
    const legDarts = state.legs
      .filter(l => l.winnerSide === side)
      .map(l => l.turns.filter(t => t.side === side).reduce((a, t) => a + t.dartsThrown, 0))
    const chances = state.turns.filter(t => t.side === side && canCheckout(t.remainingBefore, doubleOut)).length
    out[side] = {
      ...s,
      legsWon: state.legsWon?.[side] ?? 0,
      bestLeg: legDarts.length ? Math.min(...legDarts) : null,
      worstLeg: legDarts.length ? Math.max(...legDarts) : null,
      checkoutChances: chances,
      checkoutTurnPct: chances ? (s.checkouts / chances) * 100 : null,
    }
  }
  return out
}
