// Spraakinvoer: zeg je score ("honderdveertig", "26", "bust", "uit").
// Gebruikt de spraakherkenning van de browser (Chrome/Android/Edge; iOS Safari beperkt).
import React, { useRef, useState } from 'react'

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
export const canListen = () => !!SR

const UNITS = { nul: 0, een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18, negentien: 19 }
const TENS = { twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90 }

// Nederlandse getalwoorden (tot 180) → getal. "honderdzesentwintig" → 126.
export function parseDutchNumber(word) {
  let w = word.toLowerCase().replace(/[^a-zë é]/g, '').replace(/\s+/g, '')
  if (!w) return null
  let total = 0
  if (w.startsWith('honderd')) { total = 100; w = w.slice(7) }
  else if (w.startsWith('eenhonderd')) { total = 100; w = w.slice(10) }
  if (!w) return total
  if (w.startsWith('en')) w = w.slice(2)
  if (UNITS[w] != null) return total + UNITS[w]
  if (TENS[w] != null) return total + TENS[w]
  const m = w.match(/^(een|één|twee|drie|vier|vijf|zes|zeven|acht|negen)(en|ën)(twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig)$/)
  if (m) return total + UNITS[m[1]] + TENS[m[3]]
  return null
}

// Tekst → { score } | { action: 'bust' | 'out' | 'zero' } | null
export function parseSpoken(text) {
  const t = text.toLowerCase().trim()
  if (/\b(bust|kapot)\b/.test(t)) return { action: 'bust' }
  if (/\b(uit|game ?shot|check ?out)\b/.test(t)) return { action: 'out' }
  if (/\b(geen score|no score|niks|niets)\b/.test(t)) return { action: 'zero' }
  const digits = t.match(/\d{1,3}/)
  if (digits) return { score: Number(digits[0]) }
  for (const part of [t.replace(/\s+/g, ''), ...t.split(/\s+/)]) {
    const n = parseDutchNumber(part)
    if (n != null) return { score: n }
  }
  return null
}

export default function VoiceButton({ onResult, disabled }) {
  const [on, setOn] = useState(false)
  const [heard, setHeard] = useState('')
  const rec = useRef(null)
  if (!SR) return null
  const start = () => {
    try {
      const r = new SR()
      r.lang = 'nl-NL'; r.interimResults = false; r.maxAlternatives = 3
      r.onresult = e => {
        const alts = [...e.results[0]].map(a => a.transcript)
        setHeard(alts[0])
        const parsed = alts.map(parseSpoken).find(Boolean)
        onResult(parsed, alts[0])
      }
      r.onerror = () => setOn(false)
      r.onend = () => setOn(false)
      rec.current = r
      r.start(); setOn(true); setHeard('')
    } catch { setOn(false) }
  }
  return (
    <button type="button" className={`key small voice ${on ? 'on' : ''}`} onClick={on ? () => rec.current?.stop() : start} disabled={disabled} aria-label="Score inspreken" title={heard ? `Gehoord: ${heard}` : 'Score inspreken'}>
      {on ? '🎙️ luistert…' : '🎙️'}
    </button>
  )
}
