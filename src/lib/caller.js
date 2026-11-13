// Caller: spreekt scores uit met de spraak van het toestel (Web Speech API).
// Werkt offline op de meeste telefoons; zonder Nederlandse stem wordt de standaardstem gebruikt.
let voice = null
function pickVoice() {
  try {
    const vs = window.speechSynthesis?.getVoices?.() || []
    voice = vs.find(v => /^nl(-|_|$)/i.test(v.lang)) || null
  } catch { voice = null }
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice()
  window.speechSynthesis.onvoiceschanged = pickVoice
}

export const canSpeak = () => typeof window !== 'undefined' && !!window.speechSynthesis

export function say(text) {
  if (!canSpeak() || !text) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = voice?.lang || 'nl-NL'
    if (voice) u.voice = voice
    u.rate = 1.05
    window.speechSynthesis.speak(u)
  } catch { /* geen spraak */ }
}

// Tekst voor een X01-beurt, zoals een caller het zou zeggen.
export function callX01(turn, { gameShot, nextRemaining, nextOnFinish }) {
  if (!turn) return ''
  const parts = []
  if (turn.isBust) parts.push('Bust')
  else if (turn.isCheckout) parts.push(gameShot ? 'Game shot, en de wedstrijd!' : 'Game shot!')
  else if (turn.score === 0) parts.push('Geen score')
  else parts.push(String(turn.score))
  if (!turn.isCheckout && nextOnFinish && nextRemaining != null) parts.push(`Je hebt ${nextRemaining} over`)
  return parts.join('. ')
}
