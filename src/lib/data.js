// Al je data (spellen + beurten) ophalen, met een lokale kopie zodat statistieken
// meteen (en offline) zichtbaar zijn; op de achtergrond wordt ververst.
import { useCallback, useEffect, useState } from 'react'
import { api, getUser } from './api.js'
import { flush } from './store.js'

const key = () => `dartapp.cache.${getUser()?.username || ''}`
let mem = null, memKey = null

export function cachedData() {
  if (memKey === key() && mem) return mem
  try { mem = JSON.parse(localStorage.getItem(key())); memKey = key() } catch { mem = null }
  return mem
}
function store(d) {
  mem = d; memKey = key()
  try { localStorage.setItem(key(), JSON.stringify(d)) } catch { /* te groot of geblokkeerd: alleen in geheugen */ }
}
export function clearCache() { mem = null; try { localStorage.removeItem(key()) } catch { /* */ } }

export async function fetchData() {
  await flush()
  const d = await api.getData()
  store(d)
  window.dispatchEvent(new Event('dartapp:data'))
  return d
}

export function useData() {
  const [data, setData] = useState(cachedData)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    return fetchData().then(d => { setData(d); setErr('') })
      .catch(e => setErr(e.network ? (cachedData() ? 'Offline: je ziet de laatst opgehaalde gegevens.' : 'Geen verbinding.') : e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, err, loading, reload, setData }
}
