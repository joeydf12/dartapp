import React, { useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { KINDS, playersOf } from '../lib/model.js'
import { loadActive, clearActive, dropFromOutbox } from '../lib/store.js'
import { useData } from '../lib/data.js'
import { Screen, Card, dateNl, timeNl, Chips } from '../components/ui.jsx'

const label = g => {
  const s = g.summary || {}
  const c = g.config || {}
  switch (g.kind) {
    case 'x01': {
      const fmt = [c.startScore, (c.sets || 1) > 1 ? `${c.sets} sets` : null, c.in && c.in !== 'straight' ? `${c.in} in` : null, c.out && c.out !== 'double' ? `${c.out} uit` : null].filter(Boolean).join(' · ')
      if (g.mode === 'solo') return `${fmt} · ${c.legs} leg${c.legs > 1 ? 's' : ''}`
      return s.legs?.length > 2 ? `${fmt} · legs ${s.legs.join('–')}` : `${fmt} · ${(c.sets || 1) > 1 ? `sets ${s.setsMe ?? 0}–${s.setsOpp ?? 0}` : `${s.legsMe ?? 0}–${s.legsOpp ?? 0}`}`
    }
    case 'bobs27': return `score ${s.finalScore ?? '–'}`
    case 'cricket': return g.mode === 'solo' ? `${s.marksMe ?? 0} marks` : `${s.pointsMe ?? 0}–${s.pointsOpp ?? 0} punten`
    case 'around_clock': case 'doubles': return g.mode === 'solo' ? `${s.dartsMe ?? '–'} darts · ${s.progressMe ?? 0}/${s.total ?? 21}` : `${s.progressMe ?? 0}–${s.progressOpp ?? 0}`
    case 'singles': case 'shanghai': return `score ${s.scoreMe ?? '–'}`
    case 'score_training': return `gem. ${s.avgMe != null ? s.avgMe.toFixed(1) : '–'} · ${s.turnsMe ?? 0} beurten`
    case 'checkout121': case 'checkout170': case 'random_checkout': return `${s.successes ?? 0}/${s.attempts ?? 0} gelukt${s.highest ? ` · hoogste ${s.highest}` : ''}`
    case 'catch40': return `${s.points ?? 0} punten · ${s.successes ?? 0}/${s.attempts ?? 0}`
    case 'halve_it': return `score ${s.scoreMe ?? '–'}`
    case 'killer': return s.winner ? `winnaar ${s.winner}` : 'bezig'
    default: return ''
  }
}

const tsClass = t => `ts ${t.isBust ? 'bust' : t.isCheckout ? 'out' : t.score >= 100 ? 'high' : ''}`
const playerIdx = t => t.input?.p ?? (t.side === 'me' ? 0 : 1)

function Detail({ g, turns, user }) {
  const players = playersOf(g)
  const names = players.map(p => (p.type === 'me' ? user?.displayName || 'Ik' : p.name))
  const meIdx = Math.max(0, players.findIndex(p => p.type === 'me'))
  const mine = turns.filter(t => t.side === 'me')
  const darts = mine.reduce((a, t) => a + t.dartsThrown, 0)
  const pts = mine.reduce((a, t) => a + t.score, 0)
  const best = mine.reduce((a, t) => Math.max(a, t.isBust ? 0 : t.score), 0)
  const [review, setReview] = useState(false)
  const items = g.kind === 'x01'
    ? [['gem. (3 darts)', darts ? ((pts / darts) * 3).toFixed(1) : '–'], ['hoogste beurt', best || '–'], ['darts', darts],
       ['uitgegooid', mine.filter(t => t.isCheckout).length], ['hoogste uitgooi', mine.filter(t => t.isCheckout).reduce((a, t) => Math.max(a, t.score), 0) || '–'], ['bust', mine.filter(t => t.isBust).length]]
    : [['beurten', mine.length], ['darts', darts], ['punten', pts]]
  const legs = g.kind === 'x01' ? [...new Set(turns.map(t => t.legNumber))].sort((a, b) => a - b) : []
  return (
    <>
      <div className="detail">
        {items.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
      </div>
      {legs.length > 0 && (
        <div className="legs-detail">
          {legs.map(l => {
            const lt = turns.filter(t => t.legNumber === l && playerIdx(t) === meIdx)
            const winner = turns.find(t => t.legNumber === l && t.isCheckout)
            return (
              <div key={l} className="leg-row">
                <span className="muted small">Leg {l}{winner ? (playerIdx(winner) === meIdx ? ' ✓' : '') : ''}</span>
                <span className="legturns-col left">{lt.map(t => <span key={t.seq} className={tsClass(t)}>{t.isBust ? 'bust' : t.score}</span>)}</span>
                <span className="muted small">{lt.reduce((a, t) => a + t.dartsThrown, 0)} dts</span>
              </div>
            )
          })}
          {players.length > 1 && <button className="btn ghost small" onClick={() => setReview(r => !r)}>{review ? 'Verberg' : '🔍 Wedstrijd terugkijken (per ronde)'}</button>}
        </div>
      )}
      {review && legs.map(l => <LegReview key={l} leg={l} turns={turns.filter(t => t.legNumber === l)} names={names} />)}
    </>
  )
}

// Ronde voor ronde: alle spelers naast elkaar, score en rest.
function LegReview({ leg, turns, names }) {
  const n = names.length
  const ordered = [...turns].sort((a, b) => a.seq - b.seq)
  const rounds = []
  for (const t of ordered) {
    const p = playerIdx(t)
    let r = rounds.find(x => !x[p])
    if (!r) { r = Array(n).fill(null); rounds.push(r) }
    r[p] = t
  }
  const winner = ordered.find(t => t.isCheckout)
  return (
    <div className="review">
      <div className="review-head">Leg {leg}{winner ? ` · ${names[playerIdx(winner)]} uit met ${winner.score}` : ''}</div>
      <div className="table-scroll">
        <table className="vs review-table">
          <thead><tr><th>#</th>{names.map((nm, i) => <th key={i}>{nm}</th>)}</tr></thead>
          <tbody>{rounds.map((r, i) => (
            <tr key={i}><th>{i + 1}</th>{r.map((t, p) => <td key={p}>{t ? <><b className={t.isBust ? 'warn' : t.isCheckout ? 'good' : ''}>{t.isBust ? 'bust' : t.score}</b><span className="muted small"> {t.remainingAfter}</span></> : ''}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

export default function History({ user }) {
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
  const played = useMemo(() => [...new Set((data?.games || []).map(g => g.kind))], [data])
  const games = useMemo(() => (data ? [...data.games].reverse().filter(g => kind === 'all' || g.kind === kind) : []), [data, kind])
  const turnsOf = useMemo(() => {
    const m = new Map()
    for (const t of data?.turns || []) { if (!m.has(t.gameId)) m.set(t.gameId, []); m.get(t.gameId).push(t) }
    return m
  }, [data])

  return (
    <Screen title="Geschiedenis" nav>
      {err && <div className="err">{err} <button className="btn ghost small" onClick={load}>Opnieuw</button></div>}
      {played.length > 1 && (
        <Chips small value={kind} onChange={setKind} options={[{ value: 'all', label: 'Alles' }, ...played.map(k => ({ value: k, label: KINDS[k]?.short || k }))]} />
      )}
      {!data && !err && <div className="skeleton" aria-label="Laden" />}
      {data && games.length === 0 && <Card><div className="empty">🎯<div>Nog geen spellen{kind !== 'all' ? ' van dit soort' : ''}.</div></div></Card>}
      {games.length > 0 && (
        <Card>
          {games.map(g => (
            <div key={g.id} className="list-item-wrap">
              <div className="list-item">
                <button className="list-main" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id}>
                  <div><span aria-hidden="true">{KINDS[g.kind]?.icon} </span><b>{KINDS[g.kind]?.short || g.kind}</b>{g.opponentName ? <span className="muted"> · vs {g.opponentName}</span> : ''}</div>
                  <div className="muted small">{dateNl(g.startedAt)} {timeNl(g.startedAt)} · {label(g)}</div>
                </button>
                <div className="row">
                  {!g.finishedAt ? <span className="tag">bezig</span> : g.result === 'won' ? <span className="tag won">gewonnen</span> : g.result === 'lost' ? <span className="tag lost">verloren</span> : g.result === 'draw' ? <span className="tag">gelijk</span> : <span className="tag">klaar</span>}
                  {del === g.id
                    ? <><button className="btn danger small" onClick={() => remove(g.id)}>Verwijder</button><button className="btn ghost small" onClick={() => setDel(null)}>Nee</button></>
                    : <button className="btn ghost icon" onClick={() => setDel(g.id)} aria-label="Verwijderen">🗑</button>}
                </div>
              </div>
              {open === g.id && <Detail g={g} turns={turnsOf.get(g.id) || []} user={user} />}
            </div>
          ))}
        </Card>
      )}
    </Screen>
  )
}
