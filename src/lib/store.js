// Lokaal bewaren: het lopende spel en een outbox met nog niet verstuurde spellen.
// Zo gaat er niets verloren zonder verbinding; zodra het kan wordt alles doorgestuurd.
// Lopend spel en outbox staan per gebruiker, zodat een ander account op hetzelfde
// toestel nooit spellen van iemand anders verstuurt.
import { api, getUser } from './api.js'

const ACTIVE = 'dartapp.active', OUTBOX = 'dartapp.outbox', PREFS = 'dartapp.prefs'
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* opslag vol of geblokkeerd */ } }

// Sleutel per gebruiker; neemt eenmalig oude (gedeelde) data over.
function key(base) {
  const u = getUser()?.username
  if (!u) return base
  const k = `${base}.${u}`
  try {
    if (localStorage.getItem(k) == null && localStorage.getItem(base) != null) {
      localStorage.setItem(k, localStorage.getItem(base))
      localStorage.removeItem(base)
    }
  } catch { /* geen opslag */ }
  return k
}

export const loadActive = () => read(key(ACTIVE), null)
export const saveActive = g => write(key(ACTIVE), g)
export const clearActive = () => { try { localStorage.removeItem(key(ACTIVE)) } catch { /* */ } }

export const DEFAULT_QUICK = [0, 26, 41, 45, 60, 81, 85, 100, 140, 180]
export const loadPrefs = () => ({
  entry: 'total', startScore: 501, legs: 1, doubleOut: true, botLevel: 5,
  quick: DEFAULT_QUICK, favDouble: null, typing: 'scored', sound: false, ...read(PREFS, {}),
})
export const savePrefs = p => write(PREFS, { ...loadPrefs(), ...p })

const outbox = () => read(key(OUTBOX), {})
const saveBox = box => write(key(OUTBOX), box)
const changed = () => window.dispatchEvent(new Event('dartapp:outbox'))
export const outboxCount = () => Object.keys(outbox()).length

export function enqueue(gameMeta, turns) {
  const box = outbox()
  box[gameMeta.id] = { game: gameMeta, turns }
  saveBox(box)
  changed()
  return flush()
}

// Verstuurt de outbox. Komt er tijdens het versturen iets nieuws bij, dan gaat
// er nog een ronde overheen. Een spel dat de server weigert blokkeert de rest niet.
let running = null, again = false
export function flush() {
  if (running) { again = true; return running }
  running = (async () => {
    await null // pas na de toewijzing van `running` beginnen (anders blijft die bij een lege outbox hangen)
    try {
      do {
        again = false
        for (const [id, item] of Object.entries(outbox())) {
          try { await api.syncGame(item.game, item.turns) }
          catch (e) { if (e.network) return; continue }
          const box = outbox()
          // Alleen weghalen als er intussen niets nieuws voor dit spel is klaargezet.
          if (JSON.stringify(box[id]) === JSON.stringify(item)) { delete box[id]; saveBox(box) } else again = true
        }
      } while (again)
    } finally { running = null; changed() }
  })()
  return running
}

export function clearOutbox() { saveBox({}); changed() }

export function dropFromOutbox(id) {
  const box = outbox()
  delete box[id]
  saveBox(box)
  changed()
}
