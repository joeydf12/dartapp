import React, { useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { KINDS, MODE_LABEL } from '../lib/model.js'
import { loadActive, clearActive, dropFromOutbox } from '../lib/store.js'
import { useData } from '../lib/data.js'
import { Screen, Card, dateNl, timeNl, Chips } from '../components/ui.jsx'

const label = g => {
  const s = g.summary || {}
  if (g.kind === 'x01') return g.mode === 'solo' ? `${g.config.startScore} · ${g.config.legs} leg${g.config.legs > 1 ? 's' : ''}` : `${g.config.startScore} · ${s.legsMe ?? 0}–${s.legsOpp ?? 0}`
  if (g.kind === 'bobs27') return `score ${s.finalScore ?? '–'}`
  if (g.kind === 'cricket') return g.mode === 'solo' ? `${s.marksMe ?? 0} marks` : `${s.pointsMe ?? 0}–${s.pointsOpp ?? 0} punten`
  return g.mode === 'solo' ? `${s.dartsMe ?? '–'} darts` : `${s.progressMe ?? 0}–${s.progressOpp ?? 0}`
}

function Detail({ g, turns }) {
  const mine = turns.filter(t => t.side === 'me')
  const darts = mine.reduce((a, t) => a + t.dartsThrown, 0)
  const pts = mine.reduce((a, t) => a + t.score, 0)
  const best = mine.reduce((a, t) => Math.max(a, t.isBust ? 0 : t.score), 0)
  const items = g.kind === 'x01'
    ? [['gem. (3 darts)', darts ? ((pts / darts) * 3).toFixed(1) : '–'], ['hoogste beurt', best || '–'], ['darts', darts],
       ['uitgegooid', mine.filter(t => t.isCheckout).length], ['hoogste uitgooi', mine.filter(t => t.isCheckout).reduce((a, t) => Math.max(a, t.score), 0) || '–'], ['bust', mine.filter(t => t.isBust).length]]
    : [['beurten', mine.length], ['darts', darts]]
  const legs = g.kind === 'x01' ? [...new Set(mine.map(t => t.legNumber))] : []
  return (
    <>
      <div className="detail">
        {items.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
      </div>
      {legs.length > 0 && (
        <div className="legs-detail">
          {legs.map(l => {
            const lt = mine.filter(t => t.legNumber === l)
            return (
              <div key={l} className="leg-row">
                <span className="muted small">Leg {l}</span>
                <span className="legturns-col left">{lt.map(t => <span key={t.seq} className={`ts ${t.isBust ? 'bust' : t.isCheckout ? 'out' : t.score >= 100 ? 'high' : ''}`}>{t.isBust ? 'bust' : t.score}</span>)}</span>
                <span className="muted small">{lt.reduce((a, t) => a + t.dartsThrown, 0)} dts</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function History() {
  const { data, err: loadErr, reload: load } = useData()
  const [delErr, setErr] = useState('')
  const err = delErr || loadErr
  const [del, setDel] = useState(null)
  const [open, setOpen] = useState(null)
  const [kind, setKind] = useState('all')

  async function remove(id) {
    try {
      await api.deleteGame(id)
      if (loadActive()?.id === id) clearActive()
      dropFromOutbox(id)
      setDel(null); load()
    } catch (e) { setErr(e.network ? 'Geen verbinding.' : e.message) }
  }
  const games = useMemo(() => (data ? [...data.games].reverse().filter(g => kind === 'all' || g.kind === kind) : []), [data, kind])
  const turnsOf = useMemo(() => {
    const m = new Map()
    for (const t of data?.turns || []) { if (!m.has(t.gameId)) m.set(t.gameId, []); m.get(t.gameId).push(t) }
    return m
  }, [data])

  return (
    <Screen title="Geschiedenis" nav>
      {err && <div className="err">{err} <button className="btn ghost small" onClick={load}>Opnieuw</button></div>}
      {data && data.games.length > 0 && (
        <Chips value={kind} onChange={setKind} options={[{ value: 'all', label: 'Alles' }, ...Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label.split(' (')[0] }))]} />
      )}
      {!data && !err && <div className="skeleton" aria-label="Laden" />}
      {data && games.length === 0 && <Card><div className="empty">🎯<div>Nog geen spellen{kind !== 'all' ? ' van dit soort' : ''}.</div></div></Card>}
      {games.length > 0 && (
        <Card>
          {games.map(g => (
            <div key={g.id} className="list-item-wrap">
              <div className="list-item">
                <button className="list-main" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id}>
                  <div><b>{KINDS[g.kind]?.label.split(' (')[0]}</b> · {MODE_LABEL[g.mode]}{g.opponentName ? ` · ${g.opponentName}` : ''}</div>
                  <div className="muted small">{dateNl(g.startedAt)} {timeNl(g.startedAt)} · {label(g)}</div>
                </button>
                <div className="row">
                  {!g.finishedAt ? <span className="tag">bezig</span> : g.result === 'won' ? <span className="tag won">gewonnen</span> : g.result === 'lost' ? <span className="tag lost">verloren</span> : <span className="tag">klaar</span>}
                  {del === g.id
                    ? <><button className="btn danger small" onClick={() => remove(g.id)}>Verwijder</button><button className="btn ghost small" onClick={() => setDel(null)}>Nee</button></>
                    : <button className="btn ghost icon" onClick={() => setDel(g.id)} aria-label="Verwijderen">🗑</button>}
                </div>
              </div>
              {open === g.id && <Detail g={g} turns={turnsOf.get(g.id) || []} />}
            </div>
          ))}
        </Card>
      )}
    </Screen>
  )
}
