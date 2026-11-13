// @vitest-environment jsdom
// Eindtest tegen de echte database (Supabase). Draait alleen met DB_TEST=1:
//   DB_TEST=1 npx vitest run src/lib/__tests__/db.integration.test.js
// Maakt een tijdelijk testaccount aan en verwijdert het aan het eind weer.
import { describe, it, expect, afterAll } from 'vitest'
import { api, setSession, clearSession, getToken } from '../api.js'
import { newGame, withInput, toPayload } from '../model.js'
import { buildStats } from '../statsAgg.js'

const run = !!process.env.DB_TEST
const username = `test_${Date.now().toString(36)}`
const password = 'test-' + Math.random().toString(36).slice(2, 12)
const T = (m, n) => ({ m, n })
let deleted = false

describe.skipIf(!run)('database (echte Supabase)', () => {
  afterAll(async () => { if (!deleted && getToken()) await api.deleteAccount(password).catch(() => {}); clearSession() })

  it('registreren, uitloggen, fout wachtwoord, inloggen', async () => {
    const s = await api.register(username, password, 'Test')
    expect(s.token).toBeTruthy()
    expect(s.user.username).toBe(username)
    setSession(s)
    await expect(api.register(username, password, 'x')).rejects.toThrow(/al in gebruik/)
    await api.logout()
    await expect(api.login(username, 'fout-wachtwoord')).rejects.toThrow(/klopt niet/)
    const s2 = await api.login(username.toUpperCase(), password)   // hoofdletters maken niet uit
    setSession(s2)
    expect(s2.user.displayName).toBe('Test')
  })

  let x01
  it('X01-spel opslaan (per dart + totaal), ophalen en statistieken berekenen', async () => {
    x01 = newGame({ kind: 'x01', mode: 'solo', config: { startScore: 101, legs: 1, doubleOut: true, starter: 'me', entry: 'darts' } })
    x01 = withInput(x01, { mode: 'darts', darts: [T(3, 20), T(1, 1), T(0, 0)] })   // 61 → rest 40
    x01 = withInput(x01, { mode: 'darts', darts: [T(1, 20), T(2, 10)] })           // 20 → rest 20 (mis D20? nee: D10 = uit op 20)
    x01.finishedAt = new Date().toISOString()
    const p = toPayload(x01)
    const r = await api.syncGame(p.game, p.turns)
    expect(r.ok).toBe(true)
    expect(r.turns).toBe(2)
    // Nog een keer opslaan is idempotent.
    await api.syncGame(p.game, p.turns)

    const data = await api.getData()
    expect(data.games.length).toBe(1)
    expect(data.turns.length).toBe(2)
    expect(data.turns[1].darts.length).toBe(2)
    const st = buildStats(data, { kind: 'x01' })
    expect(st.stats.checkouts).toBe(1)
    expect(st.stats.highestCheckout).toBe(40)
    expect(st.overview.finished).toBe(1)
  })

  it('cricket tegen bot, around the clock en bob\'s 27 opslaan', async () => {
    let c = newGame({ kind: 'cricket', mode: 'bot', botLevel: 3, config: { starter: 'me' } })
    c = withInput(c, { darts: [T(3, 20), T(3, 20), T(0, 0)] })
    let a = newGame({ kind: 'around_clock', mode: 'solo', config: { starter: 'me' } })
    a = withInput(a, { darts: [T(1, 1), T(1, 2), T(0, 0)] })
    let b = newGame({ kind: 'bobs27', mode: 'solo', config: { starter: 'me' } })
    b = withInput(b, { hits: 2 })
    for (const g of [c, a, b]) { const p = toPayload(g); await api.syncGame(p.game, p.turns) }
    const data = await api.getData()
    expect(data.games.map(g => g.kind).sort()).toEqual(['around_clock', 'bobs27', 'cricket', 'x01'])
    expect(data.games.find(g => g.kind === 'cricket').botLevel).toBe(3)
  })

  it('nieuwe spelsoorten en bot-niveau 15 worden geaccepteerd (migratie 003)', async () => {
    let k = newGame({ kind: 'killer', players: [{ id: 'me', name: 'Ik', type: 'me' }, { id: 'b', name: 'Bot 15', type: 'bot', botLevel: 15 }] })
    k = withInput(k, { darts: [T(0, 0), T(0, 0), T(0, 0)] })
    let s = newGame({ kind: 'checkout121', players: [{ id: 'me', name: 'Ik', type: 'me' }] })
    s = withInput(s, { mode: 'total', score: 60 })
    for (const g of [k, s]) { const p = toPayload(g); const r = await api.syncGame(p.game, p.turns); expect(r.ok).toBe(true) }
    const data = await api.getData()
    expect(data.games.find(g => g.kind === 'killer').botLevel).toBe(15)
    await api.deleteGame(k.id); await api.deleteGame(s.id)
  })

  it('spel verwijderen, backup terugzetten', async () => {
    const backup = await api.getData()
    await api.deleteGame(x01.id)
    expect((await api.getData()).games.length).toBe(3)
    const r = await api.importData(backup)
    expect(r.games).toBe(4)
    const after = await api.getData()
    expect(after.games.length).toBe(4)
    expect(after.turns.length).toBe(backup.turns.length)
  })

  it('wissen en account verwijderen vragen het wachtwoord', async () => {
    await expect(api.deleteMyData('fout')).rejects.toThrow(/klopt niet/)
    const r = await api.deleteMyData(password)
    expect(r.gamesDeleted).toBe(4)
    await api.deleteAccount(password)
    deleted = true
    await expect(api.getData()).rejects.toThrow(/uitgelogd/)
  })
})
