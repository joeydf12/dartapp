import React, { Suspense, lazy, useEffect, useState } from 'react'
import { getToken, getUser, setSession } from './lib/api.js'
import { flush, loadPrefs } from './lib/store.js'
import { setFavouriteDouble } from './lib/darts/checkouts.js'

setFavouriteDouble(loadPrefs().favDouble)
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import NewGame from './pages/NewGame.jsx'
import Play from './pages/Play.jsx'
// Minder vaak gebruikte schermen pas laden als je ze opent.
const Stats = lazy(() => import('./pages/Stats.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

const path = () => location.hash.replace(/^#/, '') || '/'

export default function App() {
  const [route, setRoute] = useState(path())
  const [user, setUser] = useState(getToken() ? getUser() : null)

  useEffect(() => {
    const onHash = () => { setRoute(path()); window.scrollTo(0, 0) }
    const onLogout = () => setUser(null)
    const onOnline = () => flush()
    window.addEventListener('hashchange', onHash)
    window.addEventListener('dartapp:logout', onLogout)
    window.addEventListener('online', onOnline)
    flush()
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('dartapp:logout', onLogout)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!user) return <Login onLogin={s => { setSession(s); setUser(s.user); location.hash = '#/'; flush() }} />

  return <Suspense fallback={<div className="screen"><div className="skeleton" aria-label="Laden" /></div>}>{page(route, user, setUser)}</Suspense>
}

function page(route, user, setUser) {
  switch (route) {
    case '/new': return <NewGame user={user} />
    case '/play': return <Play user={user} />
    case '/stats': return <Stats user={user} />
    case '/history': return <History />
    case '/settings': return <Settings user={user} onLoggedOut={() => setUser(null)} />
    default: return <Home user={user} />
  }
}
