// ── X01 spelregels ───────────────────────────────────────────────────────────
// Pure functies, los van de interface: bust, uitgooien, invoercontrole.
// Een dart is { m, n }: m = 0 (mis) | 1 (single) | 2 (double) | 3 (treble),
// n = 1..20 of 25 (bull). Outer bull = { m: 1, n: 25 } (25), bull = { m: 2, n: 25 } (50).

// Beurtscores die met drie darts niet te gooien zijn.
export const IMPOSSIBLE_TURN_SCORES = [163, 166, 169, 172, 173, 175, 176, 178, 179]

// Restscores ≤ 170 die met dubbel uit niet in drie darts uit te gooien zijn.
export const BOGEY_CHECKOUTS = [159, 162, 163, 165, 166, 168, 169]

export const MISS = Object.freeze({ m: 0, n: 0 })

export function dartPoints(d) {
  return d.m * d.n
}

export function isValidDart(d) {
  if (!d || !Number.isInteger(d.m) || !Number.isInteger(d.n)) return false
  if (d.m === 0) return d.n === 0
  if (d.m < 1 || d.m > 3) return false
  if (d.n === 25) return d.m <= 2
  return d.n >= 1 && d.n <= 20
}

export function dartLabel(d) {
  if (d.m === 0) return 'Mis'
  if (d.n === 25) return d.m === 2 ? 'Bull' : '25'
  return `${['', 'S', 'D', 'T'][d.m]}${d.n}`
}

// Staat de speler op een dubbel (één dart van uitgooien)?
export function isOnDouble(remaining) {
  return remaining === 50 || (remaining >= 2 && remaining <= 40 && remaining % 2 === 0)
}

// Op welke dubbel staat de speler? 1..20, 25 voor de bull, null als niet op een dubbel.
export function doubleTarget(remaining) {
  if (!isOnDouble(remaining)) return null
  return remaining === 50 ? 25 : remaining / 2
}

const ALL_DARTS = (() => {
  const list = []
  for (let n = 1; n <= 20; n++) for (let m = 1; m <= 3; m++) list.push({ m, n })
  list.push({ m: 1, n: 25 }, { m: 2, n: 25 })
  return list
})()
const ALL_VALUES = new Set(ALL_DARTS.map(dartPoints))

// Minimaal aantal darts om `remaining` uit te gooien, of null als het niet kan.
export function minDartsToFinish(remaining, doubleOut = true) {
  if (!Number.isInteger(remaining) || remaining < 1) return null
  const finishes1 = r => (doubleOut ? isOnDouble(r) : ALL_VALUES.has(r))
  if (finishes1(remaining)) return 1
  for (const v of ALL_VALUES) if (remaining - v > 0 && finishes1(remaining - v)) return 2
  for (const v1 of ALL_VALUES) {
    for (const v2 of ALL_VALUES) {
      const r = remaining - v1 - v2
      if (r > 0 && finishes1(r)) return 3
    }
  }
  return null
}

export function canCheckout(remaining, doubleOut = true) {
  return minDartsToFinish(remaining, doubleOut) !== null
}

// Kan een beurt van drie darts precies deze score opleveren?
export function isPossibleTurnScore(score) {
  return Number.isInteger(score) && score >= 0 && score <= 180 && !IMPOSSIBLE_TURN_SCORES.includes(score)
}

// ── Controle van totaalinvoer (vóór het indienen) ───────────────────────────
// Geeft { ok, error, warnings, needsFinishInfo }. `error` blokkeert de invoer;
// `warnings` vragen om bevestiging; bij `needsFinishInfo` moet de UI vragen of
// er op een dubbel is uitgegooid en met hoeveel darts.
export function checkTotalInput(score, remaining, doubleOut = true) {
  const warnings = []
  if (!Number.isInteger(score) || score < 0) return { ok: false, error: 'Voer een geldige score in.' }
  if (score > 180) return { ok: false, error: 'Een beurt is maximaal 180.' }
  if (IMPOSSIBLE_TURN_SCORES.includes(score)) {
    return { ok: false, error: `${score} is met drie darts niet te gooien. Typefout?` }
  }
  const after = remaining - score
  if (after < 0) warnings.push(`${score} is hoger dan de restscore (${remaining}). Dit wordt een bust.`)
  else if (doubleOut && after === 1) warnings.push('Dan blijft er 1 over. Dit wordt een bust.')
  else if (after === 0) {
    if (!canCheckout(remaining, doubleOut)) {
      return { ok: false, error: `${remaining} is niet uit te gooien.` }
    }
    return { ok: true, warnings, needsFinishInfo: true, minDarts: minDartsToFinish(remaining, doubleOut) }
  }
  return { ok: true, warnings, needsFinishInfo: false }
}

// ── Darts op de dubbel (totaalinvoer, zoals DartCounter) ─────────────────────
// Een dart telt als "op de dubbel" als de rest vóór die dart uit te gooien was
// met één dart (2..40 even, of 50). Bij totaalinvoer weten we alleen de rest en
// de score; daarom lopen we alle mogelijke reeksen van 1–3 darts na die bij die
// invoer passen, en geven het kleinste en grootste mogelijke aantal terug.
//   max = 0      → er kan niet op een dubbel gegooid zijn: niets vragen
//   min = max    → staat vast: zonder vraag invullen
//   anders       → vragen, met alleen de knoppen min..max
// input: { score, finishedOnDouble?, dartsAtFinish? } (zoals bij evaluateTotalTurn)
const POINT_VALUES = [...ALL_VALUES, 0]
const NON_DOUBLE_VALUES = new Set(ALL_DARTS.filter(d => d.m !== 2).map(dartPoints))
const rangeCache = new Map()

export function doubleDartsRange(remaining, input, doubleOut = true) {
  if (!doubleOut || !Number.isInteger(remaining) || !Number.isInteger(input?.score)) return { min: 0, max: 0 }
  // Om op een dubbel te komen moet de rest binnen 2 darts ≤ 50 zijn.
  if (remaining > 170) return { min: 0, max: 0 }
  const { score } = input
  const after = remaining - score
  const kind = after === 0
    ? (input.finishedOnDouble === false ? 'nietdubbel' : 'uit')
    : (after < 0 || after === 1 ? 'bust' : 'gewoon')
  const used = kind === 'uit' ? (input.dartsAtFinish ?? 3) : 3
  const key = `${remaining}|${score}|${kind}|${used}`
  if (rangeCache.has(key)) return rangeCache.get(key)

  let min = Infinity, max = -Infinity
  const found = c => { if (c < min) min = c; if (c > max) max = c }
  // i = aantal gegooide darts, r = rest, sum = punten tot nu, c = darts op dubbel
  const walk = (i, r, sum, c) => {
    const onD = isOnDouble(r) ? 1 : 0
    for (const v of POINT_VALUES) {
      const nr = r - v, n = i + 1, nc = c + onD, ns = sum + v
      if (kind === 'uit') {
        if (nr === 0 && n === used && isOnDouble(r) && v === r) found(nc)      // laatste dart: precies die dubbel
        else if (nr >= 2 && n < used) walk(n, nr, ns, nc)
      } else if (kind === 'nietdubbel') {
        if (nr === 0 && NON_DOUBLE_VALUES.has(v)) found(nc)                   // op 0 maar niet met een dubbel
        else if (nr >= 2 && n < 3) walk(n, nr, ns, nc)
      } else if (kind === 'bust') {
        if ((nr < 0 || nr === 1) && ns === score) found(nc)                   // beurt eindigt met de bust
        else if (nr >= 2 && n < 3 && ns < score) walk(n, nr, ns, nc)
      } else {
        if (nr >= 2) { if (n === 3) { if (ns === score) found(nc) } else if (ns <= score) walk(n, nr, ns, nc) }
      }
    }
  }
  walk(0, remaining, 0, 0)
  const res = min === Infinity ? { min: 0, max: 0 } : { min, max }
  if (rangeCache.size > 20000) rangeCache.clear()
  rangeCache.set(key, res)
  return res
}

function bustResult(remaining, extra = {}) {
  return { score: 0, dartsThrown: 3, isBust: true, isCheckout: false, remainingBefore: remaining, remainingAfter: remaining, ...extra }
}

// ── Beurt evalueren: totaalinvoer ───────────────────────────────────────────
// input: { score, finishedOnDouble?, dartsAtFinish? }
export function evaluateTotalTurn(remaining, input, doubleOut = true) {
  const res = evaluateTotalTurnBase(remaining, input, doubleOut)
  if (res.error) return res
  // Darts op de dubbel: opgegeven (of vaststaand) aantal; null = onbekend (oude invoer).
  const range = doubleDartsRange(remaining, input, doubleOut)
  let dartsAtDouble = null
  if (input.dartsAtDouble != null) {
    if (!Number.isInteger(input.dartsAtDouble) || input.dartsAtDouble < range.min || input.dartsAtDouble > range.max) {
      return { error: `${input.dartsAtDouble} darts op de dubbel kan niet bij deze beurt.` }
    }
    dartsAtDouble = input.dartsAtDouble
  } else if (range.max === 0) dartsAtDouble = 0
  return { ...res, dartsAtDouble }
}

function evaluateTotalTurnBase(remaining, input, doubleOut) {
  const { score } = input
  if (!isPossibleTurnScore(score)) return { error: `Ongeldige beurtscore: ${score}` }
  const after = remaining - score
  if (after < 0 || (doubleOut && after === 1)) return bustResult(remaining, { darts: null })
  if (after === 0) {
    if (doubleOut && input.finishedOnDouble === false) return bustResult(remaining, { darts: null })
    const min = minDartsToFinish(remaining, doubleOut)
    if (min === null) return { error: `${remaining} is niet uit te gooien.` }
    const used = input.dartsAtFinish ?? 3
    if (!Number.isInteger(used) || used < min || used > 3) {
      return { error: `${remaining} uitgooien kan niet met ${used} dart(s).` }
    }
    return { score, dartsThrown: used, isBust: false, isCheckout: true, remainingBefore: remaining, remainingAfter: 0, darts: null }
  }
  return { score, dartsThrown: 3, isBust: false, isCheckout: false, remainingBefore: remaining, remainingAfter: after, darts: null }
}

// ── Beurt evalueren: per dart ───────────────────────────────────────────────
// darts: 1..3 darts. Minder dan 3 mag alleen als de beurt eindigt
// (uitgegooid of bust); de UI vult een onvolledige beurt aan met missers.
// Elke dart krijgt doubleTarget/doubleHit: stond de speler op een dubbel en
// werd die geraakt? Zo ontstaat de dubbelkaart.
export function evaluateDartsTurn(remaining, darts, doubleOut = true) {
  if (!Array.isArray(darts) || darts.length < 1 || darts.length > 3) return { error: 'Een beurt heeft 1 tot 3 darts.' }
  if (!darts.every(isValidDart)) return { error: 'Ongeldige dart in de beurt.' }

  let rem = remaining
  const annotated = []
  for (let i = 0; i < darts.length; i++) {
    const d = darts[i]
    const before = rem
    const points = dartPoints(d)
    const target = doubleOut ? doubleTarget(before) : null
    rem -= points
    const bust = rem < 0 || (doubleOut && rem === 1) || (doubleOut && rem === 0 && d.m !== 2)
    const checkout = rem === 0 && !bust
    annotated.push({
      m: d.m, n: d.n, points,
      remainingBefore: before,
      doubleTarget: target,
      doubleHit: target !== null ? checkout : null,
    })
    const last = i === darts.length - 1
    if ((bust || checkout) && !last) return { error: 'Na een uitgooi of bust kunnen geen darts meer volgen.' }
    const atD = annotated.filter(x => x.doubleTarget !== null).length
    if (bust) return bustResult(remaining, { darts: annotated, dartsAtDouble: atD })
    if (checkout) {
      return { score: remaining, dartsThrown: i + 1, isBust: false, isCheckout: true, remainingBefore: remaining, remainingAfter: 0, darts: annotated, dartsAtDouble: atD }
    }
  }
  if (darts.length < 3) return { error: 'Vul de beurt aan tot 3 darts (gebruik Mis).' }
  return { score: remaining - rem, dartsThrown: 3, isBust: false, isCheckout: false, remainingBefore: remaining, remainingAfter: rem, darts: annotated, dartsAtDouble: annotated.filter(d => d.doubleTarget !== null).length }
}

// Afgebroken beurt per dart aanvullen met missers tot 3 darts, tenzij die al geëindigd is.
export function padDarts(remaining, darts, doubleOut = true) {
  const padded = [...darts]
  let rem = remaining
  for (const d of padded) {
    rem -= dartPoints(d)
    if (rem <= 0 || (doubleOut && rem === 1)) return padded // beurt al voorbij
  }
  while (padded.length < 3) padded.push({ ...MISS })
  return padded
}

// Een score die bij deze rest een bust oplevert (voor de knop "Bust" bij totaalinvoer).
// Voorkeur: net te veel gegooid. Kan dat niet, dan (dubbel uit) 1 overlaten. null = geen bust mogelijk.
export function bustScore(remaining, doubleOut = true) {
  for (let s = remaining + 1; s <= 180; s++) if (isPossibleTurnScore(s)) return s
  if (doubleOut && remaining - 1 >= 0 && isPossibleTurnScore(remaining - 1)) return remaining - 1
  return null
}
