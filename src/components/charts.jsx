// Kleine grafieken zonder bibliotheek. Eén reeks per grafiek (dus geen legenda nodig;
// de titel noemt de reeks), dunne lijnen, rustige assen, en een tooltip bij
// aanraken / hover. Kleur: één blauwe tint voor data; tekst blijft in tekstkleur.
import React, { useMemo, useRef, useState } from 'react'

const dateShort = iso => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })

function niceRange(min, max) {
  if (min === max) { min -= 1; max += 1 }
  const span = max - min, step = Math.pow(10, Math.floor(Math.log10(span))) / 2
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step]
}

// Lijngrafiek: points = [{ y, at?, label? }]. ref = optionele stippellijn (bijv. je gemiddelde).
export function LineChart({ points, label, unit = '', digits = 1, refLine, refLabel, height = 150 }) {
  const box = useRef(null)
  const [hover, setHover] = useState(null)
  const pts = points.filter(p => p.y != null && !Number.isNaN(p.y))
  const geo = useMemo(() => {
    if (pts.length < 2) return null
    const W = 320, H = height, L = 30, R = 8, T = 10, B = 20
    const ys = pts.map(p => p.y).concat(refLine != null ? [refLine] : [])
    const [lo, hi] = niceRange(Math.min(...ys), Math.max(...ys))
    const x = i => L + (i / (pts.length - 1)) * (W - L - R)
    const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
    return { W, H, L, R, T, B, lo, hi, x, y, ticks: [lo, (lo + hi) / 2, hi] }
  }, [pts, refLine, height])
  if (!geo) return <div className="muted small chart-empty">Nog te weinig spellen voor een grafiek (minimaal 2).</div>
  const { W, H, L, R, x, y, ticks } = geo
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('')
  const area = `${path}L${x(pts.length - 1)},${y(geo.lo)}L${x(0)},${y(geo.lo)}Z`

  const onMove = e => {
    const r = box.current.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - L) / (W - L - R)) * (pts.length - 1))
    setHover(Math.max(0, Math.min(pts.length - 1, i)))
  }
  const h = hover != null ? pts[hover] : null

  return (
    <div className="chart">
      <svg ref={box} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--series)" stopOpacity=".28" /><stop offset="1" stopColor="var(--series)" stopOpacity="0" /></linearGradient></defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 5} y={y(t) + 3} className="axis" textAnchor="end">{t.toFixed(t % 1 ? 1 : 0)}</text>
          </g>
        ))}
        {refLine != null && <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} className="refline" />}
        <path d={area} fill="url(#lc-fill)" />
        <path d={path} fill="none" stroke="var(--series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.length <= 30 && pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.y)} r="3" fill="var(--series)" stroke="var(--card)" strokeWidth="2" />)}
        {pts[0].at && <text x={L} y={H - 4} className="axis">{dateShort(pts[0].at)}</text>}
        {pts[pts.length - 1].at && <text x={W - R} y={H - 4} className="axis" textAnchor="end">{dateShort(pts[pts.length - 1].at)}</text>}
        {h && <>
          <line x1={x(hover)} x2={x(hover)} y1={geo.T} y2={H - geo.B} className="crosshair" />
          <circle cx={x(hover)} cy={y(h.y)} r="5" fill="var(--series)" stroke="var(--text)" strokeWidth="2" />
        </>}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${Math.min(80, Math.max(20, (x(hover) / W) * 100))}%` }}>
          <b>{h.y.toFixed(digits)}{unit}</b>{h.at && <span>{dateShort(h.at)}</span>}{h.label && <span>{h.label}</span>}
        </div>
      )}
      {refLine != null && <div className="muted small chart-note"><span className="dash" /> {refLabel || 'gemiddelde'} {refLine.toFixed(digits)}{unit}</div>}
    </div>
  )
}

// Staafdiagram (verticaal): bars = [{ label, value, sub? }]
export function BarChart({ bars, label, height = 130, unit = '×' }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div className="chart">
      <div className="bars" style={{ height }} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        {bars.map((b, i) => (
          <button key={b.label} type="button" className={`bar ${hover === i ? 'on' : ''}`} onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} aria-label={`${b.label}: ${b.value}${unit}`}>
            <span className="fill" style={{ height: `${(b.value / max) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="bar-labels">{bars.map((b, i) => <span key={b.label} className={i % Math.ceil(bars.length / 7) ? 'hide' : ''}>{b.label}</span>)}</div>
      {hover != null && <div className="tip static"><b>{bars[hover].value}{unit}</b><span>{bars[hover].label}</span>{bars[hover].sub && <span>{bars[hover].sub}</span>}</div>}
    </div>
  )
}

// Horizontale balken met waarde: rows = [{ label, value, max?, text }]
export function HBars({ rows, max }) {
  const m = max ?? Math.max(1, ...rows.map(r => r.value))
  return (
    <div className="hbars">
      {rows.map(r => (
        <div key={r.label} className="hbar">
          <span className="hbar-l">{r.label}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${Math.max(0, (r.value / m) * 100)}%` }} /></span>
          <span className="hbar-v">{r.text ?? r.value}</span>
        </div>
      ))}
    </div>
  )
}

// Dubbelkaart: D1..D20 + Bull met raak-% (kleurintensiteit = percentage).
export function DoubleBoard({ doubles, onPick }) {
  const keys = [...Array.from({ length: 20 }, (_, i) => i + 1), 25]
  return (
    <div className="dboard">
      {keys.map(n => {
        const d = doubles[n] || doubles[String(n)]
        const p = d?.attempted ? d.hit / d.attempted : null
        return (
          <button key={n} type="button" className={`dcell ${p == null ? 'none' : ''}`} onClick={() => onPick?.(n)}
            style={p == null ? undefined : { '--p': p.toFixed(2) }} aria-label={`${n === 25 ? 'Bull' : `D${n}`}: ${d ? `${d.hit} van ${d.attempted}` : 'geen data'}`}>
            <b>{n === 25 ? 'Bull' : `D${n}`}</b>
            <span>{p == null ? '–' : `${Math.round(p * 100)}%`}</span>
            <small>{d ? `${d.hit}/${d.attempted}` : ''}</small>
          </button>
        )
      })}
    </div>
  )
}
