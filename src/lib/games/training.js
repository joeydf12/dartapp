// ── Trainings- en feestspellen ───────────────────────────────────────────────
// Elk spel: pure replay-functie (invoer → stand). Spelers: cfg.players (1..6),
// beurt van speler i heeft side 'me' als het jouw beurt is, anders 'opp'.
import { evalDarts, evalTotal, minDarts } from '../darts/x01rules.js'

export class GameError extends Error {}
const sideOf = (players, p) => (players[p]?.type === 'me' ? 'me' : 'opp')
const checkDarts = (t, max = 3) => {
  if (!Array.isArray(t.darts) || t.darts.length < 1 || t.darts.length > max) throw new GameError(`Een beurt heeft 1 tot ${max} darts.`)
  for (const d of t.darts) if (!d || !Number.isInteger(d.m) || !Number.isInteger(d.n) || d.m < 0 || d.m > 3) throw new GameError('Ongeldige dart.')
}

// ── Doelen raken op volgorde (Around the Clock, Doubles/Trebles Training) ──
// need: 'any' | 'single' | 'double' | 'treble'
export const hitsTarget = (d, target, need = 'any') => {
  if (d.m === 0 || d.n !== target) return false
  if (target === 25) return need === 'double' || need === 'treble' ? d.m === 2 : d.m >= 1
  return need === 'any' ? true : need === 'single' ? d.m === 1 : need === 'double' ? d.m === 2 : d.m === 3
}

export function replayTargets(cfg, inputs) {
  const { targets, need = 'any', players } = cfg
  const n = players.length
  const progress = Array(n).fill(0), darts = Array(n).fill(0), hits = Array(n).fill(0)
  const perTarget = {} // target → { attempted, hit } (alleen jij)
  const out = []
  let p = cfg.starter || 0, winner = null
  const finished = () => winner != null || (n > 1 ? false : progress[0] >= targets.length)
  for (const t of inputs) {
    if (winner != null || (n === 1 && progress[0] >= targets.length)) throw new GameError('Het spel is al afgelopen.')
    checkDarts(t)
    const rec = []
    let adv = 0
    for (let i = 0; i < t.darts.length; i++) {
      const d = t.darts[i], target = targets[progress[p]]
      const hit = hitsTarget(d, target, need)
      if (players[p].type === 'me') { const o = perTarget[target] ||= { attempted: 0, hit: 0 }; o.attempted++; if (hit) o.hit++ }
      darts[p]++
      if (hit) { progress[p]++; hits[p]++; adv++ }
      rec.push({ m: d.m, n: d.n, points: hit ? 1 : 0, target })
      if (progress[p] >= targets.length) {
        if (i < t.darts.length - 1) throw new GameError('Na de laatste treffer kunnen geen darts meer volgen.')
        if (n > 1) winner = p
        break
      }
    }
    out.push({ id: t.id, seq: out.length + 1, player: p, side: sideOf(players, p), score: adv, darts: rec, dartsThrown: rec.length })
    if (!finished() && n > 1) p = (p + 1) % n
  }
  const done = finished()
  return {
    players, n, targets, need, progress, darts, hits, perTarget, turns: out,
    finished: done, winner: n === 1 ? (done ? 0 : null) : winner, current: done ? null : p,
    target: i => targets[progress[i]] ?? null,
    summary: { progress, darts, dartsMe: darts[players.findIndex(x => x.type === 'me')] ?? null, total: targets.length, hitPct: darts[0] ? hits[0] / darts[0] : null },
  }
}

// ── Rondes met een vast doel (Shanghai, Singles Training) ───────────────────
// scoring 'shanghai': punten = n × m; S+D+T in één ronde = direct gewonnen.
// scoring 'singles' : punten = m (single 1, dubbel 2, treble 3).
export function replayRounds(cfg, inputs) {
  const { rounds, scoring, players } = cfg
  const n = players.length
  const score = Array(n).fill(0), hits = Array(n).fill(0), darts = Array(n).fill(0)
  const out = []
  let idx = 0, winner = null
  const startP = cfg.starter || 0
  const total = rounds.length * n
  for (const t of inputs) {
    if (winner != null || idx >= total) throw new GameError('Het spel is al afgelopen.')
    checkDarts(t)
    const p = (startP + idx) % n, round = Math.floor(idx / n), target = rounds[round]
    let gained = 0
    const mults = new Set()
    const rec = t.darts.map(d => {
      const hit = d.m > 0 && d.n === target
      const pts = hit ? (scoring === 'shanghai' ? (target === 25 ? 25 : target) * d.m : d.m) : 0
      if (hit) { hits[p]++; mults.add(d.m) }
      gained += pts
      return { m: d.m, n: d.n, points: pts, target }
    })
    darts[p] += 3
    score[p] += gained
    const shanghai = scoring === 'shanghai' && target !== 25 && mults.has(1) && mults.has(2) && mults.has(3)
    out.push({ id: t.id, seq: out.length + 1, player: p, side: sideOf(players, p), round: round + 1, target, score: gained, darts: rec, dartsThrown: 3, shanghai })
    if (shanghai) winner = p
    idx++
  }
  const done = winner != null || idx >= total
  if (done && winner == null) {
    const best = Math.max(...score)
    const top = score.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0)
    winner = n > 1 ? (top.length === 1 ? top[0] : -1) : 0 // -1 = gelijkspel
  }
  return {
    players, n, rounds, scoring, score, hits, darts, turns: out, finished: done, winner,
    current: done ? null : (startP + idx) % n, round: Math.min(rounds.length, Math.floor(idx / n) + 1),
    target: done ? null : rounds[Math.floor(idx / n)],
    summary: { score, hits, darts, rounds: rounds.length, scoreMe: score[players.findIndex(x => x.type === 'me')] ?? null },
  }
}

// ── Score Training: vrij scoren, N rondes (0 = onbeperkt) ───────────────────
export function replayScore(cfg, inputs) {
  const { rounds = 10, players } = cfg
  const n = players.length
  const pts = Array(n).fill(0), darts = Array(n).fill(0)
  const out = []
  let idx = 0
  for (const t of inputs) {
    if (rounds && idx >= rounds * n) throw new GameError('Het spel is al afgelopen.')
    const p = idx % n
    let score, rec = null
    if (t.mode === 'darts') { checkDarts(t); rec = t.darts.map(d => ({ m: d.m, n: d.n, points: d.m * d.n })); score = rec.reduce((a, d) => a + d.points, 0) }
    else { score = t.score; if (!Number.isInteger(score) || score < 0 || score > 180) throw new GameError('Score 0 t/m 180.') }
    pts[p] += score; darts[p] += 3
    out.push({ id: t.id, seq: out.length + 1, player: p, side: sideOf(players, p), round: Math.floor(idx / n) + 1, score, darts: rec, dartsThrown: 3, mode: t.mode === 'darts' ? 'darts' : 'total' })
    idx++
  }
  const done = rounds > 0 && idx >= rounds * n
  const avg = pts.map((s, i) => (darts[i] ? (s / darts[i]) * 3 : null))
  let winner = null
  if (done) { const best = Math.max(...pts); const top = pts.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0); winner = n > 1 ? (top.length === 1 ? top[0] : -1) : 0 }
  return {
    players, n, rounds, points: pts, darts, avg, turns: out, finished: done, winner, current: done ? null : idx % n,
    round: Math.floor(idx / n) + 1,
    summary: { points: pts, avg, rounds, avgMe: avg[players.findIndex(x => x.type === 'me')] ?? null, turnsMe: out.filter(x => x.side === 'me').length },
  }
}

// ── Uitgooi-trainingen: 121 Checkout, 170, Catch 40, Random Checkout ───────
// variant: 'ladder' (bij uit +1, bij mis terug), 'fixed' (steeds hetzelfde),
//          'sequence'/'random' (lijst cfg.targets af). visits = beurten per poging.
export function replayCheckout(cfg, inputs) {
  const { variant = 'ladder', start = 121, visits = 3, attempts = 10, safehouse = false, out = 'double' } = cfg
  const list = cfg.targets || []
  const total = variant === 'sequence' || variant === 'random' ? list.length : attempts
  const res = [] // per poging: { target, success, darts, visits }
  const turns = []
  let target = variant === 'sequence' || variant === 'random' ? list[0] : start
  let safe = start, rem = target, visit = 0, dartsIn = 0, highest = null, points = 0
  for (const t of inputs) {
    if (res.length >= total) throw new GameError('De training is klaar.')
    const r = t.mode === 'darts' ? evalDarts(rem, t.darts, { out }) : evalTotal(rem, t, { out })
    if (r.error) throw new GameError(r.error)
    visit++; dartsIn += r.dartsThrown
    turns.push({
      id: t.id, seq: turns.length + 1, player: 0, side: 'me', attempt: res.length + 1, target, visit,
      mode: t.mode === 'darts' ? 'darts' : 'total', remainingBefore: rem, remainingAfter: r.remainingAfter,
      score: r.score, dartsThrown: r.dartsThrown, isBust: r.isBust, isCheckout: r.isCheckout, darts: r.darts, dartsAtDouble: r.dartsAtDouble ?? null, input: t,
    })
    rem = r.remainingAfter
    const success = r.isCheckout
    if (success || visit >= visits) {
      res.push({ target, success, darts: dartsIn, visits: visit })
      if (success) {
        highest = Math.max(highest ?? 0, target)
        points += cfg.points === 'catch40' ? (dartsIn <= 3 ? 3 : dartsIn <= 6 ? 2 : 1) : 1
      }
      const k = res.length
      if (variant === 'ladder') { if (success) { if (safehouse) safe = target; target = Math.min(170, target + 1) } else target = safehouse ? safe : start }
      else if (variant === 'sequence' || variant === 'random') target = list[k]
      rem = target; visit = 0; dartsIn = 0
    }
  }
  const done = res.length >= total
  const ok = res.filter(x => x.success)
  return {
    variant, visits, out, attempts: res, total, turns, finished: done, winner: done ? 0 : null, current: done ? null : 0,
    target, remaining: rem, visit: visit + 1, dartsLeft: (visits - visit) * 3,
    summary: { attempts: res.length, successes: ok.length, pct: res.length ? ok.length / res.length : null, highest, points, avgDarts: ok.length ? ok.reduce((a, x) => a + x.darts, 0) / ok.length : null },
  }
}
export const canCheckoutTarget = (r, out = 'double') => minDarts(r, out) != null

// ── Halve-It ────────────────────────────────────────────────────────────────
// Ronde = { key, label, max }. Invoer: { score } (0 = niet gehaald → totaal gehalveerd).
export function replayHalveIt(cfg, inputs) {
  const { rounds, players, startPoints = 40 } = cfg
  const n = players.length
  const total = Array(n).fill(startPoints), fails = Array(n).fill(0), ok = Array(n).fill(0)
  const out = [], history = players.map(() => [startPoints])
  let idx = 0
  for (const t of inputs) {
    if (idx >= rounds.length * n) throw new GameError('Het spel is al afgelopen.')
    const p = idx % n, round = rounds[Math.floor(idx / n)]
    const s = t.score
    if (!Number.isInteger(s) || s < 0 || s > (round.max ?? 180)) throw new GameError(`Score 0 t/m ${round.max ?? 180}.`)
    if (round.exact != null && s !== 0 && s !== round.exact) throw new GameError(`Precies ${round.exact} of 0.`)
    const before = total[p]
    if (s === 0) { total[p] = Math.ceil(total[p] / 2); fails[p]++ } else { total[p] += s; ok[p]++ }
    history[p].push(total[p])
    out.push({ id: t.id, seq: out.length + 1, player: p, side: sideOf(players, p), round: Math.floor(idx / n) + 1, key: round.key, score: s, delta: total[p] - before, totalAfter: total[p], halved: s === 0, darts: null, dartsThrown: 3 })
    idx++
  }
  const done = idx >= rounds.length * n
  let winner = null
  if (done) { const best = Math.max(...total); const top = total.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0); winner = n > 1 ? (top.length === 1 ? top[0] : -1) : 0 }
  return {
    players, n, rounds, total, fails, ok, history, turns: out, finished: done, winner,
    current: done ? null : idx % n, round: done ? null : rounds[Math.floor(idx / n)], roundNo: Math.floor(idx / n) + 1,
    summary: { total, fails, ok, scoreMe: total[players.findIndex(x => x.type === 'me')] ?? null },
  }
}

export const HALVE_IT_STANDARD = [
  { key: '20', label: '20', max: 180 }, { key: 'double', label: 'Elke dubbel', max: 150 }, { key: '19', label: '19', max: 171 },
  { key: 'treble', label: 'Elke treble', max: 180 }, { key: '18', label: '18', max: 162 }, { key: 'colors', label: '3 kleuren', max: 180, hint: 'Drie darts in drie verschillende kleuren (zwart/wit, rood, groen). Punten = som van de darts.' },
  { key: '17', label: '17', max: 153 }, { key: 'exact', label: 'Precies …', max: 180 }, { key: '16', label: '16', max: 144 },
  { key: 'same', label: 'Zelfde kleur', max: 180, hint: 'Alle drie darts in dezelfde kleur. Punten = som van de darts.' }, { key: '15', label: '15', max: 135 },
  { key: 'bull', label: 'Bull', max: 150 },
]

// ── Killer ──────────────────────────────────────────────────────────────────
// Iedere speler heeft een nummer. Raak je eigen dubbel = killer. Als killer
// haal je met hun dubbel een leven weg bij een ander (eigen dubbel = eigen leven).
export function replayKiller(cfg, inputs) {
  const { players, numbers, lives: L = 3 } = cfg
  const n = players.length
  const lives = Array(n).fill(L), killer = Array(n).fill(false)
  const out = []
  let p = cfg.starter || 0, winner = null
  const alive = () => lives.map((l, i) => (l > 0 ? i : -1)).filter(i => i >= 0)
  const next = from => { for (let k = 1; k <= n; k++) { const q = (from + k) % n; if (lives[q] > 0) return q } return from }
  for (const t of inputs) {
    if (winner != null) throw new GameError('Het spel is al afgelopen.')
    checkDarts(t)
    const rec = []
    for (let i = 0; i < t.darts.length; i++) {
      const d = t.darts[i]
      let effect = null
      if (d.m === 2) {
        const owner = numbers.indexOf(d.n)
        if (owner === p && !killer[p]) { killer[p] = true; effect = 'killer' }
        else if (owner >= 0 && killer[p] && lives[owner] > 0) { lives[owner]--; effect = owner === p ? 'self' : 'hit'; }
      }
      rec.push({ m: d.m, n: d.n, points: effect === 'hit' ? 1 : 0, effect })
      if (alive().length <= 1) { winner = alive()[0] ?? p; if (i < t.darts.length - 1) throw new GameError('Het spel is al beslist.'); break }
      if (lives[p] <= 0) break
    }
    out.push({ id: t.id, seq: out.length + 1, player: p, side: sideOf(players, p), score: rec.filter(r => r.effect === 'hit').length, darts: rec, dartsThrown: rec.length })
    if (winner == null) p = next(p)
  }
  return {
    players, n, numbers, lives, killer, turns: out, finished: winner != null, winner, current: winner != null ? null : p,
    summary: { lives, numbers, winner: winner == null ? null : players[winner].name },
  }
}
