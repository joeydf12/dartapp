import { describe, it, expect } from 'vitest'
import { newGame, withInput, replayGame, toPayload, undo, rematchOf, botMove } from '../model.js'
import { replayMatch } from '../darts/engine.js'
import { evalDarts, evalTotal, minDarts, turnRules } from '../darts/x01rules.js'
import { parseSpoken, parseDutchNumber } from '../../components/VoiceButton.jsx'

const T = (m, n) => ({ m, n })
const me = { id: 'me', name: 'Ik', type: 'me' }
const guest = name => ({ id: name, name, type: 'guest' })
const bot = level => ({ id: 'b' + level, name: 'Bot ' + level, type: 'bot', botLevel: level })
const play = (g, inputs) => inputs.reduce((acc, i) => withInput(acc, i), g)

describe('X01: in/uit-varianten', () => {
  it('master uit: uitgooien met een treble mag', () => {
    expect(evalDarts(60, [T(3, 20)], { out: 'master' }).isCheckout).toBe(true)
    expect(evalDarts(60, [T(3, 20)], { out: 'double' }).isBust).toBe(true)
    expect(minDarts(57, 'master')).toBe(1)
  })
  it('straight uit: rest 1 is geen bust', () => {
    expect(evalDarts(3, [T(1, 2), T(0, 0), T(0, 0)], { out: 'straight' }).remainingAfter).toBe(1)
    expect(evalDarts(3, [T(1, 2)], { out: 'double' }).isBust).toBe(true)
  })
  it('dubbel in: punten tellen pas vanaf de eerste dubbel', () => {
    const r = evalDarts(501, [T(3, 20), T(2, 20), T(1, 20)], { out: 'double', in: 'double', isIn: false })
    expect(r.score).toBe(60)
    expect(r.becameIn).toBe(true)
    const t = evalTotal(501, { score: 0 }, { in: 'double', isIn: false })
    expect(t.becameIn).toBe(false)
  })
  it('turnRules: Uit-knop alleen als het kan', () => {
    expect(turnRules(40, {}).canOut).toBe(true)
    expect(turnRules(169, {}).canOut).toBe(false)
    expect(turnRules(60, { out: 'master' }).canOut).toBe(true)
  })
})

describe('X01: meerdere spelers en sets', () => {
  it('3 spelers, beurtvolgorde en beginner wisselt per leg', () => {
    const g = newGame({ kind: 'x01', players: [me, guest('Anna'), guest('Bob')], config: { startScore: 101, legs: 2, starter: 1 } })
    let v = replayGame(g)
    expect(v.current).toBe(1)
    const g2 = play(g, [{ mode: 'total', score: 60 }, { mode: 'total', score: 60 }, { mode: 'total', score: 60 }, { mode: 'total', score: 41, dartsAtFinish: 2, dartsAtDouble: 1 }])
    v = replayGame(g2)
    expect(v.raw.legsWonTotal).toEqual([0, 1, 0]) // Anna gooide 41 uit
    expect(v.current).toBe(2)                      // leg 2 begint de volgende speler
  })
  it('sets: first to 2 sets van first to 1 leg', () => {
    let g = newGame({ kind: 'x01', players: [me, guest('Anna')], config: { startScore: 40, legs: 1, sets: 2 } })
    g = play(g, [{ mode: 'darts', darts: [T(2, 20)] }])            // ik set 1
    let v = replayGame(g)
    expect(v.raw.setsWon).toEqual([1, 0])
    expect(v.finished).toBe(false)
    g = play(g, [{ mode: 'darts', darts: [T(2, 20)] }])            // Anna begint leg 2 en gooit uit → set 2 voor Anna
    v = replayGame(g)
    expect(v.raw.setsWon).toEqual([1, 1])
    g = play(g, [{ mode: 'darts', darts: [T(2, 20)] }])            // ik → wedstrijd
    v = replayGame(g)
    expect(v.finished).toBe(true)
    expect(v.winnerSide).toBe('me')
    expect(toPayload({ ...g, finishedAt: 'x' }).game.result).toBe('won')
  })
  it('oude 1-tegen-1 spellen spelen exact hetzelfde af als met de oude engine', () => {
    const old = { id: 'o', kind: 'x01', mode: 'pvp', opponentName: 'Piet', botLevel: null, config: { startScore: 101, legs: 2, doubleOut: true, starter: 'opp', entry: 'total' }, inputs: [] }
    const inputs = [
      { id: 'a', mode: 'total', score: 60 }, { id: 'b', mode: 'total', score: 45 }, { id: 'c', mode: 'total', score: 41, dartsAtFinish: 2, dartsAtDouble: 1 },
      { id: 'd', mode: 'darts', darts: [T(3, 20), T(1, 1), T(0, 0)] }, { id: 'e', mode: 'total', score: 100 },
    ]
    const v = replayGame({ ...old, inputs })
    const ref = replayMatch({ format: { legsToWin: 2, startScore: 101, doubleOut: true }, lineup: { home: ['me'], away: ['opp'] }, bullOff: { homePlayerId: 'me', awayPlayerId: 'opp', winner: 'away' }, firstThrower: { home: 'me', away: 'opp' } }, inputs)
    expect(v.turns.map(t => [t.side, t.score, t.remainingAfter, t.legNumber])).toEqual(ref.turns.map(t => [t.side === 'home' ? 'me' : 'opp', t.score, t.remainingAfter, t.legNumber]))
  })
  it('undo tegen bots haalt mijn beurt en alle botbeurten erna weg', () => {
    let g = newGame({ kind: 'x01', players: [me, bot(10), bot(12)], config: { startScore: 501 } })
    g = withInput(g, { mode: 'total', score: 60 })
    for (let i = 0; i < 2; i++) g = withInput(g, botMove(g, replayGame(g)))
    expect(g.inputs.length).toBe(3)
    expect(undo(g).inputs.length).toBe(0)
  })
  it('revanche: zelfde spelers, volgende speler begint', () => {
    const g = newGame({ kind: 'x01', players: [me, guest('Anna'), guest('Bob')], config: { startScore: 301, starter: 2 } })
    const r = rematchOf(g)
    expect(r.config.players.length).toBe(3)
    expect(r.config.starter).toBe(0)
  })
})

describe('trainingen en feestspellen', () => {
  it('Doubles Training: blijven tot raak, alleen dubbels tellen', () => {
    let g = newGame({ kind: 'doubles', players: [me], config: { order: 'asc', bull: false } })
    g = play(g, [{ darts: [T(1, 1), T(2, 1), T(2, 2)] }])
    const v = replayGame(g)
    expect(v.raw.progress[0]).toBe(2)
    expect(v.summary.perTarget[1]).toEqual({ attempted: 2, hit: 1 })
  })
  it('Around the Clock alleen trebles, achteruit', () => {
    const g = newGame({ kind: 'around_clock', players: [me], config: { need: 'treble', order: 'desc', bull: false } })
    expect(g.config.targets[0]).toBe(20)
    const v = replayGame(play(g, [{ darts: [T(1, 20), T(3, 20), T(3, 19)] }]))
    expect(v.raw.progress[0]).toBe(2)
  })
  it('Shanghai: single + dubbel + treble = direct winst', () => {
    let g = newGame({ kind: 'shanghai', players: [me, guest('Anna')], config: { roundsCount: 7 } })
    g = play(g, [{ darts: [T(1, 1), T(2, 1), T(3, 1)] }])
    const v = replayGame(g)
    expect(v.finished).toBe(true)
    expect(v.winnerSide).toBe('me')
  })
  it('Singles: single 1, dubbel 2, treble 3 punten', () => {
    const v = replayGame(play(newGame({ kind: 'singles', players: [me] }), [{ darts: [T(1, 1), T(3, 1), T(0, 0)] }]))
    expect(v.raw.score[0]).toBe(4)
  })
  it('121 Checkout: gelukt → 122, mis → terug naar 121', () => {
    let g = newGame({ kind: 'checkout121', players: [me], config: { attempts: 5 } })
    g = play(g, [{ mode: 'total', score: 121, dartsAtFinish: 3, dartsAtDouble: 1 }])
    expect(replayGame(g).raw.target).toBe(122)
    g = play(g, [{ mode: 'total', score: 60 }, { mode: 'total', score: 0 }, { mode: 'total', score: 0 }])
    const v = replayGame(g)
    expect(v.raw.target).toBe(121)
    expect(v.summary.successes).toBe(1)
    expect(v.summary.list.length).toBe(2)
  })
  it('Catch 40: punten per poging', () => {
    let g = newGame({ kind: 'catch40', players: [me] })
    g = play(g, [{ mode: 'total', score: 61, dartsAtFinish: 2, dartsAtDouble: 1 }])
    expect(replayGame(g).summary.points).toBe(3)
  })
  it('Halve-It: 0 = halveren', () => {
    let g = newGame({ kind: 'halve_it', players: [me] })
    g = play(g, [{ score: 60 }, { score: 0 }])
    expect(replayGame(g).raw.total[0]).toBe(50)  // 40 + 60 = 100 → gehalveerd 50
  })
  it('Killer: killer worden en levens afpakken', () => {
    let g = newGame({ kind: 'killer', players: [me, guest('Anna')], config: { lives: 1 } })
    const [mine, hers] = g.config.numbers
    g = play(g, [{ darts: [T(2, mine), T(2, hers)] }])
    const v = replayGame(g)
    expect(v.finished).toBe(true)
    expect(v.winnerSide).toBe('me')
  })
  it('Cricket Cut-Throat: extra marks zijn punten voor de ander', () => {
    let g = newGame({ kind: 'cricket', players: [me, guest('Anna')], config: { variant: 'cutthroat' } })
    g = play(g, [{ darts: [T(3, 20), T(1, 20), T(0, 0)] }])
    const v = replayGame(g)
    expect(v.raw.state.opp.points).toBe(20)
    expect(v.raw.state.me.points).toBe(0)
  })
  it('Score Training: gemiddelde per beurt', () => {
    const v = replayGame(play(newGame({ kind: 'score_training', players: [me], config: { rounds: 2 } }), [{ score: 60 }, { score: 100 }]))
    expect(v.finished).toBe(true)
    expect(v.raw.avg[0]).toBe(80)
  })
  it('alle spellen geven een opslagvorm die de database accepteert', () => {
    for (const kind of ['x01', 'cricket', 'around_clock', 'doubles', 'singles', 'shanghai', 'score_training', 'checkout121', 'checkout170', 'catch40', 'random_checkout', 'halve_it', 'killer', 'bobs27']) {
      const g = newGame({ kind, players: kind === 'killer' ? [me, guest('A')] : [me] })
      const p = toPayload(g)
      expect(p.game.kind).toBe(kind)
      expect(['solo', 'pvp', 'bot']).toContain(p.game.mode)
    }
  })
})

describe('spraakinvoer', () => {
  it('getallen en woorden', () => {
    expect(parseSpoken('140')).toEqual({ score: 140 })
    expect(parseDutchNumber('honderdzesentwintig')).toBe(126)
    expect(parseDutchNumber('vijfenveertig')).toBe(45)
    expect(parseSpoken('bust')).toEqual({ action: 'bust' })
    expect(parseSpoken('geen score')).toEqual({ action: 'zero' })
  })
})
