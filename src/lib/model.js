// ── Spelmodel ────────────────────────────────────────────────────────────────
// Een spel is: { id, kind, mode, config, opponentName, botLevel, startedAt,
// finishedAt, inputs: [...] }. Alles (stand, wie aan de beurt is, einde) volgt
// uit het opnieuw afspelen van de invoer — er wordt niets apart bijgehouden.
//
// Nieuwe spellen hebben config.players: [{ id, name, type: 'me'|'guest'|'bot', botLevel }].
// Oude spellen (zonder players) worden daar bij het afspelen naar omgezet.
import { replayX01 } from './games/x01.js'
import { replayCricket, CRICKET_NUMBERS, TACTICS_NUMBERS } from './games/cricket.js'
import { CLOCK_TARGETS } from './games/aroundClock.js'
import { replayBobs } from './games/bobs27.js'
import { replayTargets, replayRounds, replayScore, replayCheckout, replayHalveIt, replayKiller, HALVE_IT_STANDARD } from './games/training.js'
import { botName, legacyLevel, botX01Turn, botCricketTurn, botTargetsTurn, botRoundsTurn, botKillerTurn } from './bot.js'

// ── Spellen ─────────────────────────────────────────────────────────────────
// cat: 'match' | 'training' | 'party'. players: [min, max]. bot: bot mogelijk.
export const KINDS = {
  x01: { label: 'X01 (501 / 301 …)', short: 'X01', cat: 'match', players: [1, 6], bot: true, icon: '🎯', desc: 'Van 501 (of 101–1501) naar 0. Legs, sets, dubbel/master in en uit.' },
  cricket: { label: 'Cricket', short: 'Cricket', cat: 'match', players: [1, 2], bot: true, icon: '🏏', desc: '15–20 en bull sluiten en punten maken. Ook Cut-Throat, No Score, Tactics.' },
  around_clock: { label: 'Around the Clock', short: 'Clock', cat: 'training', players: [1, 6], bot: true, icon: '🕐', desc: '1 t/m 20 en bull op volgorde. Ook alleen dubbels of trebles, of achteruit.' },
  doubles: { label: 'Doubles Training', short: 'Dubbels', cat: 'training', players: [1, 6], bot: true, icon: '✌️', desc: 'Alle dubbels op volgorde (of willekeurig): blijf op een dubbel tot je hem raakt.' },
  singles: { label: 'Singles Training', short: 'Singles', cat: 'training', players: [1, 6], bot: true, icon: '1️⃣', desc: 'Per ronde één nummer, 3 darts. Single 1 punt, dubbel 2, treble 3.' },
  score_training: { label: 'Score Training', short: 'Scoren', cat: 'training', players: [1, 6], bot: false, icon: '💯', desc: 'Vrij scoren: 10, 20 of onbeperkt rondes van 3 darts. Werk aan je gemiddelde.' },
  checkout121: { label: '121 Checkout', short: '121', cat: 'training', players: [1, 1], bot: false, icon: '🪜', desc: 'Gooi 121 uit in 9 darts. Gelukt: volgende is 122. Mis: terug naar start.' },
  checkout170: { label: '170 Checkout', short: '170', cat: 'training', players: [1, 1], bot: false, icon: '🔥', desc: 'Steeds 170 uitgooien in 9 darts. Hoe vaak lukt het?' },
  catch40: { label: 'Catch 40', short: 'Catch 40', cat: 'training', players: [1, 1], bot: false, icon: '🎣', desc: '61 t/m 100 uitgooien in 6 darts. ≤3 darts = 3 pt, 4–6 = 2 pt.' },
  random_checkout: { label: 'Random Checkout', short: 'Random', cat: 'training', players: [1, 1], bot: false, icon: '🎲', desc: 'Willekeurige uitgooiers uit de bereiken die jij kiest. Eén beurt per poging.' },
  bobs27: { label: "Bob's 27 (dubbels)", short: "Bob's 27", cat: 'training', players: [1, 1], bot: false, icon: '🎯', desc: 'Start op 27. Per dubbel 3 darts: raak = erbij, alles mis = eraf.' },
  shanghai: { label: 'Shanghai', short: 'Shanghai', cat: 'party', players: [1, 6], bot: true, icon: '🀄', desc: 'Ronde 1 op de 1, ronde 2 op de 2 … Single+dubbel+treble in één ronde = direct winst.' },
  halve_it: { label: 'Halve-It', short: 'Halve-It', cat: 'party', players: [1, 6], bot: false, icon: '✂️', desc: '12 uitdagingen. Niet gehaald? Je totaal wordt gehalveerd.' },
  killer: { label: 'Killer', short: 'Killer', cat: 'party', players: [2, 6], bot: true, icon: '💀', desc: 'Raak je eigen dubbel om killer te worden, haal dan de levens van de anderen weg.' },
}
export const CATS = { match: 'Wedstrijd', training: 'Training', party: 'Feest' }
export const MODE_LABEL = { solo: 'Solo', pvp: 'Tegen spelers', bot: 'Tegen bot' }
export const kindLabel = k => KINDS[k]?.short || k
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16) }))

const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

// ── Spelers ─────────────────────────────────────────────────────────────────
export function playersOf(g) {
  if (Array.isArray(g.config?.players) && g.config.players.length) return g.config.players
  const me = { id: 'me', name: 'Ik', type: 'me' }
  if (g.mode === 'solo') return [me]
  if (g.mode === 'bot') return [me, { id: 'bot', name: g.opponentName || botName(g.botLevel), type: 'bot', botLevel: g.config?.botScale === 20 ? g.botLevel : legacyLevel(g.botLevel || 5) }]
  return [me, { id: 'opp', name: g.opponentName || 'Tegenstander', type: 'guest' }]
}
export const playerName = (p, user) => (p?.type === 'me' ? (user?.displayName || 'Ik') : p?.name || 'Speler')
const starterIndex = (g, players) => (Number.isInteger(g.config?.starter) ? g.config.starter : g.config?.starter === 'opp' ? Math.min(1, players.length - 1) : 0)

// ── Nieuw spel ──────────────────────────────────────────────────────────────
// opts: { kind, players, starter, settings } → spel met volledige config.
export function newGame({ kind, mode, config = {}, opponentName, botLevel, players }) {
  // Oude aanroep (mode + opponentName/botLevel) blijft werken.
  if (!players) {
    players = [{ id: 'me', name: 'Ik', type: 'me' }]
    if (mode === 'bot') players.push({ id: 'bot', name: botName(botLevel), type: 'bot', botLevel })
    if (mode === 'pvp') players.push({ id: 'opp', name: opponentName || 'Tegenstander', type: 'guest' })
  }
  const others = players.filter(p => p.type !== 'me')
  const bots = others.filter(p => p.type === 'bot')
  const m = others.length === 0 ? 'solo' : bots.length === others.length ? 'bot' : 'pvp'
  const cfg = { ...config, players, botScale: 20 }
  if (typeof cfg.starter === 'string') cfg.starter = cfg.starter === 'opp' ? 1 : 0
  cfg.starter = Math.min(players.length - 1, Math.max(0, cfg.starter || 0))
  // Spelspecifieke voorbereiding (willekeur vastleggen zodat afspelen altijd hetzelfde geeft).
  if (kind === 'x01') {
    cfg.out ||= cfg.doubleOut === false ? 'straight' : 'double'
    cfg.doubleOut = cfg.out === 'double'
    cfg.in ||= 'straight'; cfg.sets ||= 1; cfg.legs ||= 1
  }
  if (kind === 'cricket') {
    cfg.variant ||= 'standard'
    if (cfg.variant === 'tactics') cfg.numbers = TACTICS_NUMBERS
    else if (cfg.variant === 'random') cfg.numbers = [...shuffle(range(1, 20)).slice(0, 6).sort((a, b) => b - a), 25]
  }
  if (kind === 'around_clock' || kind === 'doubles') {
    const base = range(1, 20)
    const order = cfg.order || 'asc'
    let t = order === 'desc' ? [...base].reverse() : order === 'random' ? shuffle(base) : base
    if (cfg.bull !== false) t = [...t, 25]
    cfg.targets = t
    cfg.need = kind === 'doubles' ? 'double' : (cfg.need || 'any')
  }
  if (kind === 'singles') cfg.rounds = cfg.bull === false ? range(1, 20) : [...range(1, 20), 25]
  if (kind === 'shanghai') cfg.rounds = range(1, cfg.roundsCount || 7)
  if (kind === 'score_training') cfg.rounds ??= 10
  if (kind === 'halve_it') {
    const ex = cfg.exact || 41 + Math.floor(Math.random() * 80)
    cfg.rounds = HALVE_IT_STANDARD.map(r => (r.key === 'exact' ? { ...r, exact: ex, label: `Precies ${ex}` } : r))
  }
  if (kind === 'killer') { cfg.numbers = shuffle(range(1, 20)).slice(0, players.length); cfg.lives ||= 3 }
  if (kind === 'checkout121') Object.assign(cfg, { variant: 'ladder', start: cfg.start || 121, visits: 3, attempts: cfg.attempts || 10 })
  if (kind === 'checkout170') Object.assign(cfg, { variant: 'fixed', start: 170, visits: 3, attempts: cfg.attempts || 10 })
  if (kind === 'catch40') Object.assign(cfg, { variant: 'sequence', targets: range(61, 100), visits: 2, points: 'catch40' })
  if (kind === 'random_checkout') {
    const ranges = cfg.ranges?.length ? cfg.ranges : ['2-40', '41-80', '81-120', '121-170']
    const pool = ranges.flatMap(r => { const [a, b] = r.split('-').map(Number); return range(a, b) }).filter(v => ![159, 162, 163, 165, 166, 168, 169].includes(v))
    cfg.targets = Array.from({ length: cfg.attempts || 20 }, () => pool[Math.floor(Math.random() * pool.length)])
    Object.assign(cfg, { variant: 'random', visits: cfg.visits || 1, ranges })
  }
  return {
    id: uid(), kind, mode: m, config: cfg,
    botLevel: bots.length ? Math.max(...bots.map(b => b.botLevel || 1)) : null,
    opponentName: others.length ? others.map(o => o.name).join(', ') : null,
    startedAt: new Date().toISOString(), finishedAt: null, inputs: [],
  }
}

// ── Afspelen: alle spelsoorten → één vorm ───────────────────────────────────
// { kind, raw, players, turns, finished, winner (index | -1 gelijk | null), winnerSide,
//   current (index | null), currentSide, currentBot (niveau | null), summary }
export function replayGame(g) {
  const players = playersOf(g)
  const cfg = { ...g.config, players, starter: starterIndex(g, players) }
  let raw, turns, finished, winner, current, summary
  switch (g.kind) {
    case 'x01': {
      const legacyLegs = g.config.legs || 1
      raw = replayX01({ ...cfg, out: cfg.out || (g.config.doubleOut === false ? 'straight' : 'double'), in: cfg.in || 'straight', legs: legacyLegs, sets: cfg.sets || 1 }, g.inputs)
      ;({ turns, finished, winner, current, summary } = raw)
      break
    }
    case 'cricket': {
      const numbers = cfg.numbers || CRICKET_NUMBERS
      raw = replayCricket(g.inputs, { mode: players.length === 1 ? 'solo' : 'pvp', first: cfg.starter === 1 ? 'opp' : 'me', variant: cfg.variant === 'tactics' || cfg.variant === 'random' ? 'standard' : cfg.variant, numbers })
      turns = raw.turns.map(t => ({ ...t, player: t.side === 'me' ? 0 : 1 }))
      finished = raw.finished; winner = raw.winner == null ? null : raw.winner === 'me' ? 0 : 1
      current = raw.current == null ? null : raw.current === 'me' ? 0 : 1
      summary = raw.summary
      break
    }
    case 'around_clock': case 'doubles': {
      raw = replayTargets({ ...cfg, targets: cfg.targets || CLOCK_TARGETS, need: cfg.need || (g.kind === 'doubles' ? 'double' : 'any') }, g.inputs)
      ;({ turns, finished, winner, current } = raw)
      const me = players.findIndex(p => p.type === 'me')
      summary = { ...raw.summary, progressMe: raw.progress[me], progressOpp: players.length > 1 ? Math.max(...raw.progress.filter((_, i) => i !== me)) : 0, dartsMe: raw.darts[me], hitsMe: raw.hits[me], total: raw.targets.length, need: raw.need, perTarget: raw.perTarget }
      break
    }
    case 'singles': case 'shanghai': {
      raw = replayRounds({ ...cfg, scoring: g.kind === 'shanghai' ? 'shanghai' : 'singles' }, g.inputs)
      ;({ turns, finished, winner, current, summary } = raw)
      break
    }
    case 'score_training': raw = replayScore(cfg, g.inputs); ({ turns, finished, winner, current, summary } = raw); break
    case 'checkout121': case 'checkout170': case 'catch40': case 'random_checkout':
      raw = replayCheckout(cfg, g.inputs); ({ turns, finished, winner, current } = raw)
      summary = { ...raw.summary, list: raw.attempts.map(a => [a.target, a.success ? 1 : 0, a.darts]) }
      break
    case 'halve_it': raw = replayHalveIt(cfg, g.inputs); ({ turns, finished, winner, current, summary } = raw); break
    case 'killer': raw = replayKiller(cfg, g.inputs); ({ turns, finished, winner, current, summary } = raw); break
    case 'bobs27': {
      raw = replayBobs(g.inputs)
      turns = raw.turns.map(t => ({ ...t, player: 0 })); finished = raw.finished; winner = finished ? 0 : null; current = finished ? null : 0; summary = raw.summary
      break
    }
    default: throw new Error('Onbekend spel.')
  }
  const sideOf = i => (i == null || i < 0 ? null : players[i]?.type === 'me' ? 'me' : 'opp')
  turns = turns.map(t => ({ ...t, side: t.side || sideOf(t.player) }))
  return {
    kind: g.kind, raw, players, turns, finished, winner, winnerSide: sideOf(winner), solo: players.length === 1,
    current, currentSide: sideOf(current), currentBot: current != null && players[current]?.type === 'bot' ? (players[current].botLevel || 5) : null,
    summary,
  }
}

export function resultOf(g, view) {
  if (!view.finished) return null
  if (view.players.length === 1) return 'solo'
  if (view.winner === -1) return 'draw'
  return view.winnerSide === 'me' ? 'won' : 'lost'
}

// ── Bot aan de beurt: invoer bedenken ───────────────────────────────────────
export function botMove(g, view) {
  const level = view.currentBot
  if (!level) return null
  const raw = view.raw, p = view.current
  switch (g.kind) {
    case 'x01': return botX01Turn(raw.remaining[p], level, { out: raw.out, in: raw.in, isIn: raw.isIn[p] })
    case 'cricket': return truncateAtWin(g, botCricketTurn(raw.state, 'opp', level, Math.random, raw.numbers))
    case 'around_clock': case 'doubles': return truncateAtWin(g, botTargetsTurn(raw.targets, raw.progress[p], raw.need, level))
    case 'singles': case 'shanghai': return botRoundsTurn(raw.target, level)
    case 'killer': return truncateAtWin(g, botKillerTurn(raw, p, level))
    default: return null
  }
}
// Darts afkappen zodra het spel daarmee beslist is.
function truncateAtWin(g, input) {
  for (let k = 1; k <= input.darts.length; k++) {
    const cand = { ...input, darts: input.darts.slice(0, k) }
    try { if (replayGame({ ...g, inputs: [...g.inputs, { id: 'tmp', ...cand }] }).finished) return cand } catch { /* niet geldig */ }
  }
  return input
}

// ── Opslagvorm (zie dartapp_sync_game) ──────────────────────────────────────
export function toPayload(g) {
  const view = replayGame(g)
  const turns = view.turns.map((t, i) => ({
    id: t.id, seq: t.seq, legNumber: t.legNumber ?? t.attempt ?? 1, side: t.side,
    mode: Array.isArray(t.darts) && t.mode !== 'total' ? 'darts' : 'total',
    score: t.score ?? 0, remainingBefore: t.remainingBefore ?? null, remainingAfter: t.remainingAfter ?? null,
    dartsThrown: Math.min(3, t.dartsThrown ?? 3), isBust: !!t.isBust, isCheckout: !!t.isCheckout,
    input: { ...(t.input || g.inputs[i] || {}), ...(t.dartsAtDouble != null ? { dartsAtDouble: t.dartsAtDouble } : {}), p: t.player ?? 0, ...(t.setNumber ? { set: t.setNumber } : {}) },
    darts: Array.isArray(t.darts) ? t.darts.map(d => ({ m: d.m, n: d.n, points: Math.max(0, Math.min(60, d.points ?? 0)), remainingBefore: d.remainingBefore ?? null, doubleTarget: d.doubleTarget ?? null, doubleHit: d.doubleHit ?? null })) : null,
  }))
  return {
    game: {
      id: g.id, kind: g.kind, mode: g.mode, config: g.config, opponentName: g.opponentName, botLevel: g.botLevel,
      startedAt: g.startedAt, finishedAt: g.finishedAt, result: g.finishedAt ? resultOf(g, view) : null,
      summary: view.summary,
    },
    turns,
  }
}

// Een beurt toevoegen; gooit bij ongeldige invoer.
export function withInput(g, input) {
  const next = { ...g, inputs: [...g.inputs, { id: uid(), at: new Date().toISOString(), ...input }] }
  replayGame(next)
  return next
}

// Een eerdere beurt corrigeren: invoer vervangen (zelfde id) en alles opnieuw afspelen.
// Gooit als de wedstrijd daarmee niet meer klopt (bijv. latere beurten na een nieuwe uitgooi).
export function replaceInput(g, id, input) {
  const i = g.inputs.findIndex(x => x.id === id)
  if (i < 0) throw new Error('Beurt niet gevonden.')
  const inputs = g.inputs.slice()
  inputs[i] = { ...input, id, at: g.inputs[i].at, editedAt: new Date().toISOString() }
  const next = { ...g, inputs }
  let view
  try { view = replayGame(next) } catch (e) { throw new Error(`Deze correctie past niet bij de rest van het spel: ${e.message} Gebruik "Ongedaan" tot die beurt als je dit wilt.`) }
  // Latere beurten moeten bij dezelfde leg en dezelfde speler blijven horen.
  const key = t => `${t.legNumber ?? 1}|${t.player ?? t.side}`
  const before = new Map(replayGame(g).turns.map(t => [t.id, key(t)]))
  if (view.turns.some(t => before.get(t.id) !== key(t)) || view.turns.length !== before.size) {
    throw new Error('Deze correctie verandert het verloop (bijv. een eerdere uitgooi). Gebruik "Ongedaan" tot die beurt.')
  }
  return { ...next, finishedAt: view.finished ? (g.finishedAt || new Date().toISOString()) : null }
}

// Revanche: zelfde spel, spelers en instellingen; de volgende speler begint.
export function rematchOf(g) {
  const players = playersOf(g)
  const s = starterIndex(g, players)
  const cfg = { ...g.config }
  for (const k of ['targets', 'numbers', 'rounds']) if (['random_checkout', 'killer', 'halve_it', 'around_clock', 'doubles'].includes(g.kind) || (g.kind === 'cricket' && cfg.variant === 'random')) delete cfg[k]
  return newGame({ kind: g.kind, players, config: { ...cfg, starter: players.length > 1 ? (s + 1) % players.length : 0 } })
}

// Ongedaan maken: de laatste beurt van een mens (en alle botbeurten erna) gaat terug.
export function undo(g) {
  if (!g.inputs.length) return g
  const view = replayGame(g)
  let idx = -1
  view.turns.forEach((t, i) => { if (view.players[t.player]?.type !== 'bot') idx = i })
  return idx < 0 ? g : { ...g, inputs: g.inputs.slice(0, idx) }
}
