// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

vi.mock('../lib/api.js', () => ({
  api: { syncGame: vi.fn().mockResolvedValue({ ok: true }), deleteGame: vi.fn().mockResolvedValue(), getData: vi.fn() },
  getToken: () => 't', getUser: () => ({ displayName: 'Joey', username: 'joey' }), setSession: () => {}, clearSession: () => {},
}))
import { api } from '../lib/api.js'
import Play from '../pages/Play.jsx'
import Stats from '../pages/Stats.jsx'
import { newGame, toPayload, withInput } from '../lib/model.js'
import { saveActive, loadActive } from '../lib/store.js'

const user = { displayName: 'Joey', username: 'joey' }
const btn = name => screen.getByRole('button', { name })

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); location.hash = '#/play'; vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers() })

const start = (o) => { saveActive(newGame(o)); return render(<Play user={user} />) }
const tick = async ms => { await act(async () => { vi.advanceTimersByTime(ms) }) }

describe('scherm: X01 tegen bot, totaalinvoer', () => {
  it('score invoeren, bot gooit terug, undo haalt beide beurten weg', async () => {
    start({ kind: 'x01', mode: 'bot', botLevel: 8, config: { startScore: 501, legs: 1, doubleOut: true, starter: 'me', entry: 'total' } })
    expect(screen.getAllByText('501').length).toBe(2)
    fireEvent.click(btn('100'))
    expect(screen.getByText('401')).toBeTruthy()
    expect(screen.getByText(/Bot gooit/)).toBeTruthy()
    await tick(1000)
    expect(loadActive().inputs.length).toBe(2)
    fireEvent.click(btn(/Ongedaan/))
    expect(loadActive().inputs.length).toBe(0)
    expect(api.syncGame).toHaveBeenCalled()
  })
  it('uitgooien vraagt hoeveel darts en hoeveel op de dubbel', async () => {
    start({ kind: 'x01', mode: 'solo', config: { startScore: 101, legs: 1, doubleOut: true, starter: 'me', entry: 'total' } })
    fireEvent.click(btn('60'))
    if (screen.queryByText(/op een dubbel/)) fireEvent.click(btn('0'))
    fireEvent.click(btn('41'))   // 101-60-41 → uit
    expect(screen.getByText(/hoeveel darts\?/)).toBeTruthy()
    fireEvent.click(btn('3'))
    expect(screen.getByText(/op een dubbel/)).toBeTruthy()
  })
  it('onmogelijke score wordt geweigerd', () => {
    start({ kind: 'x01', mode: 'solo', config: { startScore: 501, legs: 1, doubleOut: true, starter: 'me', entry: 'total' } })
    fireEvent.click(btn('1')); fireEvent.click(btn('7')); fireEvent.click(btn('9'))
    fireEvent.click(btn('OK'))
    expect(screen.getByText(/niet te gooien/)).toBeTruthy()
  })
})

describe('scherm: X01 per dart', () => {
  it('treble 20 + single 20 + mis maakt een beurt van 80', () => {
    start({ kind: 'x01', mode: 'solo', config: { startScore: 501, legs: 1, doubleOut: true, starter: 'me', entry: 'darts' } })
    fireEvent.click(btn('Treble')); fireEvent.click(screen.getAllByRole('button', { name: 'T20' })[1])   // raster
    fireEvent.click(screen.getAllByRole('button', { name: '20' })[0])                                       // snel-dart
    fireEvent.click(btn('Mis'))
    expect(screen.getAllByText('421').length).toBeGreaterThan(0)
    const turn = toPayload(loadActive()).turns[0]
    expect(turn.score).toBe(80)
    expect(turn.darts.length).toBe(3)
  })
  it('uitgooiroute is aan te tikken en telt darts op de dubbel', () => {
    start({ kind: 'x01', mode: 'solo', config: { startScore: 40, legs: 1, doubleOut: true, starter: 'me', entry: 'darts' } })
    expect(screen.getByText(/Je staat op D20/)).toBeTruthy()
    fireEvent.click(btn('Gooi D20'))
    const t = toPayload(loadActive()).turns[0]
    expect(t.isCheckout).toBe(true)
    expect(t.darts[0].doubleHit).toBe(true)
  })
})

describe('scherm: corrigeren en revanche', () => {
  const x01 = (startScore, extra = {}) => start({ kind: 'x01', mode: 'solo', config: { startScore, legs: 1, doubleOut: true, starter: 'me', entry: 'total', ...extra } })
  it('tik op een eerdere score om die te corrigeren', () => {
    x01(501)
    fireEvent.click(btn('60')); fireEvent.click(btn('100'))
    fireEvent.click(btn('Beurt 60 corrigeren'))
    expect(screen.getByText(/Beurt corrigeren/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '85' })[0])
    const turns = toPayload(loadActive()).turns
    expect(turns.map(t => t.score)).toEqual([85, 100])
    expect(turns[1].remainingAfter).toBe(316)
  })
  it('correctie die het verloop verandert wordt geweigerd', () => {
    x01(101)
    fireEvent.click(btn('60')); if (screen.queryByText(/op een dubbel/)) fireEvent.click(btn('0'))
    fireEvent.click(btn('26')); if (screen.queryByText(/op een dubbel/)) fireEvent.click(btn('0'))
    fireEvent.click(btn('Beurt 60 corrigeren'))
    fireEvent.click(screen.getAllByRole('button', { name: '1' }).at(-1)); fireEvent.click(screen.getAllByRole('button', { name: '0' }).at(-1)); fireEvent.click(screen.getAllByRole('button', { name: '1' }).at(-1))
    fireEvent.click(btn('OK'))            // 101 = uit → latere beurt past niet meer
    if (screen.queryByText(/hoeveel darts/i)) fireEvent.click(screen.getAllByRole('button', { name: '3' }).at(-1))
    if (screen.queryByText(/op een dubbel/)) fireEvent.click(screen.getAllByRole('button', { name: /^[0-3]$/ })[0])
    expect(screen.getByText(/past niet bij de rest|verandert het verloop/)).toBeTruthy()
    expect(toPayload(loadActive()).turns[0].score).toBe(60)
  })
  it('revanche start hetzelfde spel opnieuw', () => {
    x01(40)
    fireEvent.click(btn('Uit (40)')); fireEvent.click(btn('1'))
    const first = loadActive().id
    fireEvent.click(btn(/Nog een keer/))
    expect(loadActive().id).not.toBe(first)
    expect(loadActive().config.startScore).toBe(40)
    expect(loadActive().inputs.length).toBe(0)
  })
})

describe('scherm: X01 snelscoren', () => {
  const x01 = (startScore, extra = {}) => start({ kind: 'x01', mode: 'solo', config: { startScore, legs: 1, doubleOut: true, starter: 'me', entry: 'total', ...extra } })
  it('Uit-knop gooit de rest uit en vraagt het aantal darts', () => {
    x01(32)
    fireEvent.click(btn('Uit (32)'))
    expect(screen.getByText(/In hoeveel darts/)).toBeTruthy()
    fireEvent.click(btn('1'))   // 1 dart op D16: darts op de dubbel staat dan vast (1)
    const t = toPayload(loadActive()).turns[0]
    expect(t.isCheckout).toBe(true)
    expect(t.dartsThrown).toBe(1)
    expect(t.input.dartsAtDouble).toBe(1)
  })
  it('snelscore die bust zou geven is uitgeschakeld; Bust-knop werkt', () => {
    x01(50)
    expect(btn('60').disabled).toBe(true)
    fireEvent.click(btn('Bust'))
    if (screen.queryByText(/op een dubbel/)) fireEvent.click(screen.getAllByRole('button', { name: /^[0-3]$/ })[0])
    const t = toPayload(loadActive()).turns[0]
    expect(t.isBust).toBe(true)
    expect(t.remainingAfter).toBe(50)
  })
  it('rest invoeren: 501, rest 401 → 100 gegooid', () => {
    x01(501)
    fireEvent.click(btn(/gegooid/))
    for (const d of '401') { const b = screen.getAllByRole('button', { name: d }); fireEvent.click(b[b.length - 1]) }   // toetsenblok (niet de snelscore 0)
    fireEvent.click(btn('OK'))
    expect(toPayload(loadActive()).turns[0].score).toBe(100)
  })
  it('vraagt darts op de dubbel als je op een dubbel kwam en het niet vaststaat', () => {
    x01(60)
    fireEvent.click(btn('26'))   // 60 → 34: onderweg kan je op 40/… hebben gestaan
    expect(screen.getByText(/op een dubbel/)).toBeTruthy()
  })
})

describe('scherm: andere spellen', () => {
  it('cricket solo: marks komen op het bord', () => {
    start({ kind: 'cricket', mode: 'solo', config: { starter: 'me' } })
    fireEvent.click(btn('Treble')); fireEvent.click(btn('20 (open)')); fireEvent.click(btn('Mis')); fireEvent.click(btn('Mis'))
    expect(screen.getAllByText('⊗').length).toBe(1)
    expect(btn('20 (dicht)')).toBeTruthy()   // solo: 20 is dicht
  })
  it('around the clock tegen bot: raak telt, bot reageert', async () => {
    start({ kind: 'around_clock', mode: 'bot', botLevel: 10, config: { starter: 'me' } })
    fireEvent.click(btn(/Raak 1/)); fireEvent.click(btn(/Raak 2/)); fireEvent.click(btn('Mis'))
    expect(screen.getByText('2 / 21 gehaald')).toBeTruthy()
    await tick(1000)
    expect(loadActive().inputs.length).toBe(2)
  })
  it("bob's 27: raak en mis", () => {
    start({ kind: 'bobs27', mode: 'solo', config: { starter: 'me' } })
    fireEvent.click(btn('2'))
    expect(screen.getByText('31')).toBeTruthy()  // 27 + 2×2
    fireEvent.click(btn('0'))
    expect(screen.getByText('27')).toBeTruthy()  // − D2 = 4
  })
})

describe('statistieken', () => {
  it('berekent uit opgeslagen data', async () => {
    let g = newGame({ kind: 'x01', mode: 'solo', config: { startScore: 101, legs: 1, doubleOut: true, starter: 'me', entry: 'darts' } })
    const T = (m, n) => ({ m, n })
    g = withInput(g, { mode: 'darts', darts: [T(3, 20), T(1, 1), T(0, 0)] })
    g = withInput(g, { mode: 'darts', darts: [T(0, 0), T(2, 20)] })
    g.finishedAt = new Date().toISOString()
    const p = toPayload(g)
    const data = { games: [p.game], turns: p.turns.map(t => ({ ...t, gameId: g.id })) }
    api.getData.mockResolvedValue(data)
    vi.useRealTimers()
    render(<Stats />)
    expect(await screen.findByText('Uitgooien')).toBeTruthy()
    expect(screen.getAllByText('33%').length).toBeGreaterThan(0)   // 1 van 3 dubbelkansen
  })
})
