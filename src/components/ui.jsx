import React from 'react'

export const go = path => { location.hash = '#' + path }
const current = () => location.hash.replace(/^#/, '') || '/'

const NAV = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/new', label: 'Spelen', icon: '🎯' },
  { path: '/stats', label: 'Statistieken', icon: '📊' },
  { path: '/history', label: 'Geschiedenis', icon: '🕘' },
]

export function BottomNav() {
  const here = current()
  return (
    <nav className="bottomnav" aria-label="Hoofdmenu">
      {NAV.map(n => (
        <button key={n.path} className={here === n.path ? 'on' : ''} onClick={() => go(n.path)} aria-current={here === n.path ? 'page' : undefined}>
          <span aria-hidden="true">{n.icon}</span>{n.label}
        </button>
      ))}
    </nav>
  )
}

export function Screen({ title, back, right, children, nav = false, wide = false }) {
  return (
    <div className={`screen ${nav ? 'has-nav' : ''} ${wide ? 'wide' : ''}`}>
      <div className="topbar">
        {back && <button className="back" onClick={() => (back === true ? history.back() : go(back))} aria-label="Terug">‹</button>}
        <h1 title={typeof title === 'string' ? title : undefined}>{title}</h1>
        {right}
      </div>
      {children}
      {nav && <BottomNav />}
    </div>
  )
}

export const Card = ({ title, children, className = '', right }) => (
  <section className={`card ${className}`}>
    {(title || right) && <div className="card-head">{title && <h2>{title}</h2>}{right}</div>}
    {children}
  </section>
)

export const Stat = ({ label, value, sub, accent }) => (
  <div className={`stat ${accent ? 'accent' : ''}`}><b>{value}</b><span>{label}{sub ? <em> · {sub}</em> : null}</span></div>
)

export function Chips({ options, value, onChange, small, label }) {
  return (
    <div className={`chips ${small ? 'small' : ''}`} role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} type="button" className={`chip ${value === o.value ? 'on' : ''}`} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

// Gesegmenteerde tabs (één rij, scrollt horizontaal als het niet past).
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  )
}

export const dateNl = iso => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
export const timeNl = iso => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
