// ── Statistieken uit de opgeslagen data ──────────────────────────────────────
// Alles wordt hier uit de ruwe beurten en darts berekend, met dezelfde
// telregels als de competitie (darts/stats.js). Niets wordt apart bijgehouden.
//
// Twee soorten uitgooi-percentage (zoals de grote dart-apps):
//  • dubbel-% per dart: geraakte dubbels / darts gegooid terwijl je op een dubbel stond
//  • uitgooi-% per kans: uitgegooide beurten / beurten die begonnen op een uitgooibare rest
import { computePlayerStats, SCORE_BANDS } from './darts/stats.js'
import { canCheckout, isOnDouble } from './darts/rules.js'
import { CRICKET_NUMBERS } from './games/cricket.js'

const pct = (a, b) => (b ? (a / b) * 100 : null)
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0)
const mean = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
const avg3 = (pts, darts) => (darts ? (pts / darts) * 3 : null)

export const PERIODS = [
  { value: 'all', label: 'Alles' }, { value: '7', label: '7 dagen' }, { value: '30', label: '30 dagen' },
  { value: '90', label: '3 mnd' }, { value: '365', label: 'Jaar' },
]

export const outModeOf = g => g.config?.out || (g.config?.doubleOut === false ? 'straight' : 'double')
export function filterGames(data, { kind = 'x01', mode = 'all', period = 'all', startScore = 'all', out = 'all' } = {}) {
  const since = period === 'all' ? null : Date.now() - Number(period) * 864e5
  return (data?.games || []).filter(g =>
    g.kind === kind && (mode === 'all' || g.mode === mode) &&
    (!since || new Date(g.startedAt).getTime() >= since) &&
    (kind !== 'x01' || startScore === 'all' || g.config?.startScore === Number(startScore)) &&
    (kind !== 'x01' || out === 'all' || outModeOf(g) === out))
}

function overviewOf(games) {
  const finished = games.filter(g => g.finishedAt)
  const won = finished.filter(g => g.result === 'won').length
  const lost = finished.filter(g => g.result === 'lost').length
  // Reeksen (alleen spellen met een tegenstander), op volgorde van datum.
  const duels = finished.filter(g => g.result === 'won' || g.result === 'lost').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  let best = 0, run = 0
  for (const g of duels) { run = g.result === 'won' ? run + 1 : 0; best = Math.max(best, run) }
  let current = 0
  for (let i = duels.length - 1; i >= 0 && duels[i].result === duels[duels.length - 1].result; i--) current++
  return {
    games: games.length, finished: finished.length, won, lost, winPct: pct(won, won + lost),
    solo: finished.filter(g => g.result === 'solo').length,
    bestStreak: best, streak: duels.length ? { kind: duels[duels.length - 1].result, n: current } : null,
    form: duels.slice(-10).map(g => g.result),
  }
}

function opponents(finished) {
  const out = {}
  for (const g of finished.filter(g => g.result === 'won' || g.result === 'lost')) {
    const name = g.mode === 'bot' ? `Bot niveau ${g.botLevel}` : (g.opponentName || 'Tegenstander')
    const o = out[name] ||= { name, won: 0, lost: 0, bot: g.mode === 'bot', level: g.botLevel || 0 }
    g.result === 'won' ? o.won++ : o.lost++
  }
  return Object.values(out).sort((a, b) => (a.bot - b.bot) || (a.level - b.level) || (b.won + b.lost - a.won - a.lost))
}

export function buildStats(data, filter = {}) {
  const kind = filter.kind || 'x01'
  const games = filterGames(data, { ...filter, kind }).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const ids = new Set(games.map(g => g.id))
  const turns = (data?.turns || []).filter(t => ids.has(t.gameId))
  const mine = turns.filter(t => t.side === 'me')
  const finished = games.filter(g => g.finishedAt)
  const base = { kind, overview: overviewOf(games), games, opponents: opponents(finished), empty: mine.length === 0 }
  if (kind === 'cricket') return { ...base, cricket: cricketStats(games, mine) }
  if (kind === 'around_clock' || kind === 'doubles') return { ...base, clock: clockStats(games, mine) }
  if (kind === 'bobs27') return { ...base, bobs: bobsStats(games, mine) }
  if (kind === 'singles' || kind === 'shanghai') return { ...base, rounds: roundsStats(games, mine, kind) }
  if (kind === 'score_training') return { ...base, score: scoreStats(games, mine) }
  if (['checkout121', 'checkout170', 'catch40', 'random_checkout'].includes(kind)) return { ...base, empty: !games.some(g => g.summary?.list?.length), co: checkoutStats(games) }
  if (kind === 'halve_it') return { ...base, halve: halveStats(games, mine) }
  if (kind === 'killer') return { ...base, empty: !games.length, killer: { games: games.length } }
  return { ...base, ...x01Stats(games, mine) }
}

// ── X01 ─────────────────────────────────────────────────────────────────────
function x01Stats(games, mine) {
  const gameById = new Map(games.map(g => [g.id, g]))
  const dOut = t => gameById.get(t.gameId)?.config?.doubleOut !== false
  const asEngine = mine.map(t => ({
    playerId: 'me', matchId: t.gameId, legNumber: t.legNumber, score: t.score, dartsThrown: t.dartsThrown,
    isBust: t.isBust, isCheckout: t.isCheckout, remainingBefore: t.remainingBefore, mode: t.mode,
    darts: t.mode === 'darts' ? (t.darts || []) : undefined,
    dartsAtDouble: t.mode === 'darts' ? undefined : (t.input?.dartsAtDouble ?? null),
  }))
  const s = computePlayerStats(asEngine).get('me') || null
  if (!s) return { stats: null }

  // Uitgooikansen: beurten die begonnen op een rest die in één beurt uit kon.
  const chance = t => t.remainingBefore != null && t.remainingBefore <= 170 && canCheckout(t.remainingBefore, dOut(t))
  const chances = mine.filter(chance)
  const RANGES = [[2, 40, '2–40'], [41, 80, '41–80'], [81, 120, '81–120'], [121, 170, '121–170']]
  const byRange = RANGES.map(([lo, hi, label]) => {
    const c = chances.filter(t => t.remainingBefore >= lo && t.remainingBefore <= hi)
    return { label, chances: c.length, hit: c.filter(t => t.isCheckout).length, pct: pct(c.filter(t => t.isCheckout).length, c.length) }
  })
  const checkoutsList = {}
  for (const t of mine.filter(t => t.isCheckout)) checkoutsList[t.score] = (checkoutsList[t.score] || 0) + 1
  const topCheckouts = Object.entries(checkoutsList).map(([v, n]) => ({ value: Number(v), n })).sort((a, b) => b.value - a.value).slice(0, 12)

  // Darts op de dubbel per dart, ook uit totaalinvoer (dan is de dubbel zelf onbekend).
  const doubleDarts = s.doublesAttempted, doubleHits = s.doublesHit

  // Legs
  const legs = new Map()
  for (const t of mine) {
    const k = `${t.gameId}|${t.legNumber}`
    const o = legs.get(k) || { gameId: t.gameId, darts: 0, won: false, turns: [] }
    o.darts += t.dartsThrown; o.turns.push(t); if (t.isCheckout) o.won = true
    legs.set(k, o)
  }
  const wonLegs = [...legs.values()].filter(l => l.won)
  const legDarts = wonLegs.map(l => l.darts)
  const legDist = {}
  for (const d of legDarts) { const k = d <= 12 ? '≤12' : d <= 15 ? '13–15' : d <= 18 ? '16–18' : d <= 21 ? '19–21' : d <= 24 ? '22–24' : d <= 30 ? '25–30' : '31+'; legDist[k] = (legDist[k] || 0) + 1 }

  // Per spel (trend + records)
  const perGame = games.map(g => {
    const own = mine.filter(t => t.gameId === g.id)
    if (!own.length) return null
    const pts = sum(own, t => t.score), dts = sum(own, t => t.dartsThrown)
    const legsOf = [...legs.values()].filter(l => l.gameId === g.id)
    const f9 = legsOf.flatMap(l => l.turns.slice(0, 3))
    const c = own.filter(chance)
    return {
      id: g.id, at: g.startedAt, avg3: avg3(pts, dts), first9: avg3(sum(f9, t => t.score), sum(f9, t => t.dartsThrown)),
      darts: dts, s180: own.filter(t => !t.isBust && t.score === 180).length, s100: own.filter(t => !t.isBust && t.score >= 100).length,
      checkoutPct: pct(own.filter(t => t.isCheckout).length, c.length), highest: Math.max(0, ...own.filter(t => !t.isBust).map(t => t.score)),
      label: g.mode === 'bot' ? `bot ${g.botLevel}` : g.mode === 'pvp' ? g.opponentName : 'solo', result: g.result,
    }
  }).filter(Boolean)
  const best = (arr, f) => arr.reduce((b, x) => (f(x) != null && (b == null || f(x) > f(b)) ? x : b), null)
  const records = {
    bestAvg: best(perGame, x => x.avg3), bestFirst9: best(perGame, x => x.first9),
    most180: best(perGame.filter(x => x.s180 > 0), x => x.s180), bestLeg: legDarts.length ? Math.min(...legDarts) : null,
  }
  const ranked = [...perGame].filter(x => x.avg3 != null).sort((a, b) => b.avg3 - a.avg3)
  const recent = perGame.slice(-10)
  const form = { recentAvg: mean(recent.map(x => x.avg3)), allAvg: s.avg3, n: recent.length }

  // Hoe vaak welke score
  const exact = {}
  for (const t of mine) if (!t.isBust) exact[t.score] = (exact[t.score] || 0) + 1
  const buckets = Array.from({ length: 19 }, (_, i) => ({ from: i * 10, to: i === 18 ? 180 : i * 10 + 9, count: 0 }))
  for (const [sc, n] of Object.entries(exact)) buckets[Math.min(18, Math.floor(Number(sc) / 10))].count += n
  const topScores = Object.entries(exact).map(([v, n]) => ({ value: Number(v), n })).sort((a, b) => b.n - a.n || b.value - a.value).slice(0, 10)

  // Losse darts (alleen waar per dart is ingevoerd)
  const darts = mine.flatMap(t => (t.darts || []).map(d => ({ ...d, rem: d.remainingBefore ?? t.remainingBefore })))
  let dartStats = null
  if (darts.length) {
    const seg = {}
    for (const d of darts) if (d.m > 0) { const o = seg[d.n] ||= { n: d.n, s: 0, d: 0, t: 0, total: 0 }; o[['', 's', 'd', 't'][d.m]]++; o.total++ }
    // Scoorfase: rest > 170, dan mik je bijna altijd op T20 (of T19).
    const scoring = darts.filter(d => d.rem == null || d.rem > 170)
    const in20 = scoring.filter(d => d.n === 20 && d.m > 0).length
    const nb20 = scoring.filter(d => (d.n === 1 || d.n === 5) && d.m > 0).length
    dartStats = {
      total: darts.length, miss: darts.filter(d => d.m === 0).length, singles: darts.filter(d => d.m === 1).length,
      doubles: darts.filter(d => d.m === 2).length, trebles: darts.filter(d => d.m === 3).length,
      t20: darts.filter(d => d.m === 3 && d.n === 20).length, t19: darts.filter(d => d.m === 3 && d.n === 19).length,
      bulls: darts.filter(d => d.n === 25 && d.m === 2).length, outerBulls: darts.filter(d => d.n === 25 && d.m === 1).length,
      segments: Object.values(seg).sort((a, b) => b.total - a.total),
      scoring: { darts: scoring.length, in20, t20: scoring.filter(d => d.n === 20 && d.m === 3).length, neighbours: nb20 },
    }
  }

  // Extra details
  const outs = mine.filter(t => t.isCheckout)
  const byDarts = [1, 2, 3].map(n => ({ n, count: outs.filter(t => t.dartsThrown === n).length }))
  // Rest na 9 darts (alleen legs waarin je 3 volle beurten gooide zonder uit te gooien)
  const after9 = [...legs.values()].map(l => l.turns.slice(0, 3)).filter(ts => ts.length === 3 && !ts.some(t => t.isCheckout)).map(ts => ts[2].remainingAfter).filter(Number.isFinite)
  // Gemiddelde per beurt in de leg (1e, 2e, … beurt)
  const visit = Array.from({ length: 8 }, (_, i) => {
    const ts = [...legs.values()].map(l => l.turns[i]).filter(Boolean)
    return { n: i + 1, avg: ts.length ? sum(ts, t => t.score) / ts.length : null, count: ts.length }
  }).filter(v => v.count > 0)
  // Per startscore
  const perStart = [...new Set(games.map(g => g.config?.startScore))].sort((a, b) => a - b).map(ss => {
    const ids = new Set(games.filter(g => g.config?.startScore === ss).map(g => g.id))
    const ts = mine.filter(t => ids.has(t.gameId))
    const ld = [...legs.values()].filter(l => ids.has(l.gameId) && l.won).map(l => l.darts)
    return { start: ss, games: ids.size, avg: avg3(sum(ts, t => t.score), sum(ts, t => t.dartsThrown)), legDarts: mean(ld) }
  })

  return {
    stats: s, bust: s.busts, bustPct: pct(s.busts, s.turns), ppd: s.darts ? s.points / s.darts : null,
    top25: ranked.slice(0, 25), bottom25: ranked.slice(-25).reverse(),
    extra: { byDarts, dartsPerCheckout: outs.length ? doubleDarts / outs.length : null, after9: mean(after9), after9n: after9.length, visit, perStart },
    checkout: { doubleDarts, doubleHits, dartPct: pct(doubleHits, doubleDarts), chances: chances.length, turnPct: pct(s.checkouts, chances.length), byRange, top: topCheckouts },
    legs: { won: wonLegs.length, played: legs.size, avgDarts: mean(legDarts), best: records.bestLeg, worst: legDarts.length ? Math.max(...legDarts) : null, dist: legDist },
    perGame, records, form, exact, buckets, topScores, dartStats, bands: SCORE_BANDS,
    countExact: n => exact[n] || 0,
  }
}

// ── Andere spellen ──────────────────────────────────────────────────────────
function cricketStats(games, mine) {
  const numsOf = new Map(games.map(g => [g.id, g.config?.numbers || CRICKET_NUMBERS]))
  const marksOf = t => sum(t.darts || [], d => (d.m > 0 && (numsOf.get(t.gameId) || CRICKET_NUMBERS).includes(d.n) ? (d.n === 25 ? Math.min(d.m, 2) : d.m) : 0))
  const perGame = games.map(g => {
    const own = mine.filter(t => t.gameId === g.id)
    if (!own.length) return null
    return { at: g.startedAt, mpr: sum(own, marksOf) / own.length, rounds: own.length, result: g.result }
  }).filter(Boolean)
  const rounds = mine.length, marks = sum(mine, marksOf)
  const dist = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ n, count: mine.filter(t => marksOf(t) === n).length }))
  return {
    rounds, marks, mpr: rounds ? marks / rounds : null, points: sum(mine, t => t.score),
    bestMpr: perGame.length ? Math.max(...perGame.map(x => x.mpr)) : null,
    fastestSolo: (() => { const s = games.filter(g => g.mode === 'solo' && g.finishedAt).map(g => mine.filter(t => t.gameId === g.id).length).filter(Boolean); return s.length ? Math.min(...s) : null })(),
    perGame, dist,
    bulls: sum(mine, t => (t.darts || []).filter(d => d.n === 25 && d.m > 0).length),
  }
}

function clockStats(games, mine) {
  const done = games.filter(g => g.mode === 'solo' && g.finishedAt && g.summary?.progressMe >= (g.summary?.total || 21))
  const perTarget = {}
  for (const g of games) for (const [t, o] of Object.entries(g.summary?.perTarget || {})) { const x = perTarget[t] ||= { attempted: 0, hit: 0 }; x.attempted += o.attempted; x.hit += o.hit }
  const dartsPerGame = done.map(g => g.summary.dartsMe).filter(Number.isFinite)
  const all = mine.flatMap(t => t.darts || [])
  return {
    done: done.length, best: dartsPerGame.length ? Math.min(...dartsPerGame) : null, avg: mean(dartsPerGame),
    hitPct: pct(all.filter(d => d.points > 0).length, all.length), darts: all.length,
    perGame: done.map(g => ({ at: g.startedAt, darts: g.summary.dartsMe })), perTarget,
  }
}

function roundsStats(games, mine, kind) {
  const fin = games.filter(g => g.finishedAt)
  const scores = fin.map(g => { const own = mine.filter(t => t.gameId === g.id); return { at: g.startedAt, score: sum(own, t => t.score), rounds: own.length } }).filter(x => x.rounds)
  const darts = mine.flatMap(t => t.darts || [])
  const hits = darts.filter(d => d.points > 0)
  return {
    games: scores.length, best: scores.length ? Math.max(...scores.map(x => x.score)) : null, avg: mean(scores.map(x => x.score)),
    hitPct: pct(hits.length, darts.length), trebles: hits.filter(d => d.m === 3).length, doubles: hits.filter(d => d.m === 2).length, darts: darts.length,
    perGame: scores, wins: kind === 'shanghai' ? fin.filter(g => g.result === 'won').length : null,
  }
}

function scoreStats(games, mine) {
  const perGame = games.map(g => { const own = mine.filter(t => t.gameId === g.id); const d = sum(own, t => t.dartsThrown); return own.length ? { at: g.startedAt, avg: d ? (sum(own, t => t.score) / d) * 3 : null } : null }).filter(Boolean)
  const d = sum(mine, t => t.dartsThrown)
  return {
    turns: mine.length, avg: d ? (sum(mine, t => t.score) / d) * 3 : null, best: perGame.length ? Math.max(...perGame.map(x => x.avg ?? 0)) : null,
    high: mine.length ? Math.max(...mine.map(t => t.score)) : null, s100: mine.filter(t => t.score >= 100).length, s140: mine.filter(t => t.score >= 140).length, s180: mine.filter(t => t.score === 180).length, perGame,
  }
}

function checkoutStats(games) {
  const all = games.flatMap(g => (g.summary?.list || []).map(([target, ok, darts]) => ({ target, ok: !!ok, darts, at: g.startedAt })))
  const per = {}
  for (const a of all) { const o = per[a.target] ||= { attempted: 0, hit: 0 }; o.attempted++; if (a.ok) o.hit++ }
  const RANGES = [[2, 40], [41, 80], [81, 120], [121, 170]]
  const byRange = RANGES.map(([lo, hi]) => { const r = all.filter(a => a.target >= lo && a.target <= hi); const h = r.filter(a => a.ok).length; return { label: lo + '–' + hi, n: r.length, hit: h, pct: pct(h, r.length) } }).filter(r => r.n)
  const perGame = games.filter(g => g.summary?.attempts).map(g => ({ at: g.startedAt, pct: g.summary.pct != null ? g.summary.pct * 100 : null }))
  const ok = all.filter(a => a.ok)
  return {
    attempts: all.length, successes: ok.length, pct: pct(ok.length, all.length), avgDarts: mean(ok.map(a => a.darts)),
    highest: Math.max(0, ...games.map(g => g.summary?.highest || 0)) || null, bestPoints: Math.max(0, ...games.map(g => g.summary?.points || 0)) || null,
    per, byRange, perGame,
    hardest: Object.entries(per).filter(([, o]) => o.attempted >= 2).map(([t, o]) => ({ t: Number(t), ...o, pct: o.hit / o.attempted })).sort((a, b) => a.pct - b.pct).slice(0, 8),
  }
}

function halveStats(games, mine) {
  const fin = games.filter(g => g.finishedAt)
  const scores = fin.map(g => { const own = mine.filter(t => t.gameId === g.id); return own.length ? { at: g.startedAt, score: g.summary?.scoreMe ?? null } : null }).filter(x => x && x.score != null)
  return { games: fin.length, best: scores.length ? Math.max(...scores.map(x => x.score)) : null, avg: mean(scores.map(x => x.score)), okPct: pct(mine.filter(t => t.score > 0).length, mine.length), perGame: scores }
}

// ── Spelsoorten vergelijken ─────────────────────────────────────────────────
export function compareKinds(data, kinds) {
  return Object.entries(kinds).map(([kind, meta]) => {
    const games = (data?.games || []).filter(g => g.kind === kind)
    if (!games.length) return null
    const fin = games.filter(g => g.finishedAt)
    const won = fin.filter(g => g.result === 'won').length, lost = fin.filter(g => g.result === 'lost').length
    const last = games.reduce((a, g) => (g.startedAt > a ? g.startedAt : a), '')
    return { kind, label: meta.short || meta.label, games: games.length, winPct: pct(won, won + lost), last }
  }).filter(Boolean).sort((a, b) => b.games - a.games)
}

// Heatmap: hoe vaak elk vak geraakt is (alle spellen waar per dart is ingevoerd).
export function heatCounts(data, kind = 'all', period = 'all') {
  const since = period === 'all' ? null : Date.now() - Number(period) * 864e5
  const ids = new Set((data?.games || []).filter(g => (kind === 'all' || g.kind === kind) && (!since || new Date(g.startedAt).getTime() >= since)).map(g => g.id))
  const counts = {}
  let total = 0, miss = 0
  for (const t of data?.turns || []) {
    if (t.side !== 'me' || !ids.has(t.gameId)) continue
    for (const d of t.darts || []) { total++; if (d.m === 0) { miss++; continue } const k = d.m + '-' + d.n; counts[k] = (counts[k] || 0) + 1 }
  }
  return { counts, total, miss }
}

function bobsStats(games, mine) {
  const fin = games.filter(g => g.finishedAt)
  const scores = fin.map(g => g.summary?.finalScore).filter(Number.isFinite)
  // Per dubbel: 3 darts per ronde, input.hits geraakt.
  const per = {}
  for (const t of mine) {
    const k = t.seq <= 20 ? t.seq : 25 // ronde 1..20 = D1..D20, ronde 21 = bull
    const o = per[k] ||= { attempted: 0, hit: 0 }
    o.attempted += 3; o.hit += t.input?.hits ?? (t.darts || []).filter(d => d.m === 2).length
  }
  return {
    games: scores.length, best: scores.length ? Math.max(...scores) : null, avg: mean(scores),
    completed: fin.filter(g => !g.summary?.busted).length,
    hitPct: pct(sum(Object.values(per), o => o.hit), sum(Object.values(per), o => o.attempted)),
    doubles: per, perGame: fin.map(g => ({ at: g.startedAt, score: g.summary?.finalScore })).filter(x => Number.isFinite(x.score)),
  }
}

// ── Samenvatting voor de profielkop (alle spellen) ─────────────────────────
export function profileSummary(data) {
  const x = buildStats(data, { kind: 'x01' })
  const all = data?.games || []
  const fin = all.filter(g => g.finishedAt)
  const won = fin.filter(g => g.result === 'won').length, lost = fin.filter(g => g.result === 'lost').length
  return {
    games: all.length, darts: sum(data?.turns?.filter(t => t.side === 'me') || [], t => t.dartsThrown),
    winPct: pct(won, won + lost), avg3: x.stats?.avg3 ?? null, first9: x.stats?.first9Avg ?? null,
    checkoutPct: x.checkout?.turnPct ?? null, doublePct: x.checkout?.dartPct ?? null, s180: x.stats?.scores180 ?? 0,
    highestCheckout: x.stats?.highestCheckout ?? null, bestLeg: x.legs?.best ?? null,
    trend: (x.perGame || []).slice(-20).map(p => ({ at: p.at, y: p.avg3 })),
    form: x.form,
  }
}

export { isOnDouble }
export const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? '–' : Number(n).toFixed(d))
export const fmtPct = n => (n == null || Number.isNaN(n) ? '–' : `${Number(n).toFixed(0)}%`)
