// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

let user = { username: 'anna' }
const syncGame = vi.fn()
vi.mock('../api.js', () => ({ api: { syncGame: (...a) => syncGame(...a) }, getUser: () => user }))
import { saveActive, loadActive, enqueue, outboxCount, flush, clearOutbox } from '../store.js'
import { botX01Turn } from '../bot.js'
import { evaluateDartsTurn } from '../darts/rules.js'

beforeEach(() => { localStorage.clear(); syncGame.mockReset(); user = { username: 'anna' } })

describe('lokale opslag per gebruiker', () => {
  it('lopend spel en outbox van de ene gebruiker zijn niet zichtbaar voor de andere', async () => {
    syncGame.mockRejectedValue(Object.assign(new Error('offline'), { network: true }))
    saveActive({ id: 'g1' })
    await enqueue({ id: 'g1' }, [])
    expect(outboxCount()).toBe(1)
    user = { username: 'bert' }
    expect(loadActive()).toBe(null)
    expect(outboxCount()).toBe(0)
    user = { username: 'anna' }
    expect(loadActive().id).toBe('g1')
    expect(outboxCount()).toBe(1)
  })
  it('neemt oude gedeelde data eenmalig over', () => {
    localStorage.setItem('dartapp.active', JSON.stringify({ id: 'oud' }))
    expect(loadActive().id).toBe('oud')
    expect(localStorage.getItem('dartapp.active')).toBe(null)
  })
})

describe('outbox', () => {
  it('na een flush met lege outbox wordt een nieuw spel nog steeds verstuurd', async () => {
    syncGame.mockResolvedValue({ ok: true })
    await flush()
    await enqueue({ id: 'na-leeg' }, [])
    expect(syncGame).toHaveBeenCalledWith({ id: 'na-leeg' }, [])
    expect(outboxCount()).toBe(0)
  })
  it('nieuwe beurt tijdens versturen wordt alsnog verstuurd', async () => {
    let release
    syncGame.mockImplementationOnce(() => new Promise(r => { release = r })).mockResolvedValue({ ok: true })
    const p1 = enqueue({ id: 'g' }, [1])
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const p2 = enqueue({ id: 'g' }, [1, 2])   // komt binnen terwijl de eerste nog loopt
    release({ ok: true })
    await p1; await p2
    expect(outboxCount()).toBe(0)
    expect(syncGame).toHaveBeenLastCalledWith({ id: 'g' }, [1, 2])
  })
  it('een geweigerd spel blokkeert de andere niet', async () => {
    syncGame.mockImplementation(g => (g.id === 'slecht' ? Promise.reject(new Error('Niet toegestaan.')) : Promise.resolve({ ok: true })))
    localStorage.setItem('dartapp.outbox.anna', JSON.stringify({ slecht: { game: { id: 'slecht' }, turns: [] }, goed: { game: { id: 'goed' }, turns: [] } }))
    await flush()
    expect(syncGame).toHaveBeenCalledWith({ id: 'goed' }, [])
    expect(outboxCount()).toBe(1)
    clearOutbox()
    expect(outboxCount()).toBe(0)
  })
})

describe('bot straight out', () => {
  it('gooit onder 60 zelden bust (mikt niet meer op T20)', () => {
    let busts = 0
    for (let i = 0; i < 300; i++) {
      const rem = 21 + (i % 39)
      const t = botX01Turn(rem, 10, false)
      if (evaluateDartsTurn(rem, t.darts, false).isBust) busts++
    }
    expect(busts).toBeLessThan(30)
  })
})
