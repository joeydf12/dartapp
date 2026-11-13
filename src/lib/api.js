// Alle communicatie met de database loopt via de dartapp_*-functies. Geen
// rechtstreekse tabeltoegang, geen Supabase-accounts.
import { createClient } from '@supabase/supabase-js'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const TOKEN = 'dartapp.token', USER = 'dartapp.user'
export const getToken = () => localStorage.getItem(TOKEN)
export const getUser = () => { try { return JSON.parse(localStorage.getItem(USER)) } catch { return null } }
export function setSession({ token, user }) { localStorage.setItem(TOKEN, token); localStorage.setItem(USER, JSON.stringify(user)) }
export function clearSession() { localStorage.removeItem(TOKEN); localStorage.removeItem(USER) }

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args)
  if (error) {
    const err = new Error(error.message || 'Er ging iets mis.')
    err.network = !error.code && /fetch|network|failed/i.test(error.message || '')
    if (/uitgelogd/i.test(error.message || '')) { clearSession(); window.dispatchEvent(new Event('dartapp:logout')) }
    throw err
  }
  return data
}
const t = () => ({ p_token: getToken() })

export const api = {
  register: (username, password, displayName) => rpc('dartapp_register', { p_username: username, p_password: password, p_display_name: displayName }),
  login: (username, password) => rpc('dartapp_login', { p_username: username, p_password: password }),
  logout: () => rpc('dartapp_logout', t()).catch(() => {}),
  syncGame: (game, turns) => rpc('dartapp_sync_game', { ...t(), p_game: game, p_turns: turns }),
  deleteGame: id => rpc('dartapp_delete_game', { ...t(), p_game_id: id }),
  getData: () => rpc('dartapp_get_data', t()),
  importData: payload => rpc('dartapp_import', { ...t(), p_payload: payload }),
  deleteMyData: password => rpc('dartapp_delete_my_data', { ...t(), p_password: password }),
  deleteAccount: password => rpc('dartapp_delete_account', { ...t(), p_password: password }),
}
