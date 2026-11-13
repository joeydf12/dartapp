// Dartbord als SVG. Twee standen:
//  • invoer: tik op een vak → onHit({ m, n }); buiten het bord = mis
//  • heatmap: counts per vak ('m-n' → aantal) kleuren de vakken (lichter = vaker)
// Maten volgen een echt bord (mm): bull 6.35, outer bull 15.9, treble 99–107, dubbel 162–170.
import React, { useMemo, useState } from 'react'

export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const R = { bull: 6.35, outer: 15.9, tIn: 99, tOut: 107, dIn: 162, dOut: 170, edge: 195 }
const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return [r * Math.sin(a), -r * Math.cos(a)] }
function sector(r1, r2, a1, a2) {
  const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1)
  return `M${x1.toFixed(2)},${y1.toFixed(2)}A${r2},${r2} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}L${x3.toFixed(2)},${y3.toFixed(2)}A${r1},${r1} 0 0 0 ${x4.toFixed(2)},${y4.toFixed(2)}Z`
}
const label = (m, n) => (m === 0 ? 'Mis' : n === 25 ? (m === 2 ? 'Bull' : '25') : `${['', 'S', 'D', 'T'][m]}${n}`)

export default function Dartboard({ onHit, counts, highlight, size = 320, disabled }) {
  const [flash, setFlash] = useState(null)
  const heat = !!counts
  const max = useMemo(() => (counts ? Math.max(1, ...Object.values(counts)) : 1), [counts])
  const fill = (m, n, base) => {
    if (!heat) return base
    const c = counts[`${m}-${n}`] || 0
    if (!c) return 'var(--card2)'
    return `color-mix(in srgb, var(--series) ${Math.round(20 + (c / max) * 80)}%, var(--card2))`
  }
  const hit = (m, n) => e => {
    e.stopPropagation()
    if (disabled || !onHit) return
    setFlash(`${m}-${n}`); setTimeout(() => setFlash(null), 180)
    onHit({ m, n })
  }
  const isHl = (m, n) => highlight && highlight.m === m && highlight.n === n
  const cls = (m, n) => `seg ${flash === `${m}-${n}` ? 'flash' : ''} ${isHl(m, n) ? 'hl' : ''}`
  const title = (m, n) => (heat ? `${label(m, n)}: ${counts[`${m}-${n}`] || 0}×` : label(m, n))

  return (
    <svg className={`dartboard ${heat ? 'heat' : ''}`} viewBox={`${-R.edge} ${-R.edge} ${R.edge * 2} ${R.edge * 2}`} width="100%" style={{ maxWidth: size }} role={onHit ? 'group' : 'img'} aria-label={heat ? 'Heatmap van je darts' : 'Dartbord: tik waar je dart zit'}>
      <circle r={R.edge} className={`seg miss ${flash === '0-0' ? 'flash' : ''}`} onClick={hit(0, 0)}><title>Mis</title></circle>
      <circle r={R.dOut} fill="#0b0f19" />
      {BOARD_ORDER.map((n, i) => {
        const a1 = i * 18 - 9, a2 = a1 + 18, dark = i % 2 === 0
        const single = dark ? '#1c1f26' : '#e9dfc4', ring = dark ? '#c0392b' : '#1e8449'
        const [lx, ly] = pt(182, i * 18)
        return (
          <g key={n}>
            <path d={sector(R.dIn, R.dOut, a1, a2)} fill={fill(2, n, ring)} className={cls(2, n)} onClick={hit(2, n)}><title>{title(2, n)}</title></path>
            <path d={sector(R.tOut, R.dIn, a1, a2)} fill={fill(1, n, single)} className={cls(1, n)} onClick={hit(1, n)}><title>{title(1, n)}</title></path>
            <path d={sector(R.tIn, R.tOut, a1, a2)} fill={fill(3, n, ring)} className={cls(3, n)} onClick={hit(3, n)}><title>{title(3, n)}</title></path>
            <path d={sector(R.outer, R.tIn, a1, a2)} fill={fill(1, n, single)} className={cls(1, n)} onClick={hit(1, n)}><title>{title(1, n)}</title></path>
            <text x={lx} y={ly + 5} textAnchor="middle" className="bnum">{n}</text>
          </g>
        )
      })}
      <circle r={R.outer} fill={fill(1, 25, '#1e8449')} className={cls(1, 25)} onClick={hit(1, 25)}><title>{title(1, 25)}</title></circle>
      <circle r={R.bull + 2} fill={fill(2, 25, '#c0392b')} className={cls(2, 25)} onClick={hit(2, 25)}><title>{title(2, 25)}</title></circle>
    </svg>
  )
}
