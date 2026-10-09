import { useEffect, useState } from 'react'
import { getUiPrefs, subscribeUi, setSound } from '../../lib/uiPrefs.js'
import { startAmbient, stopAmbient, setSoundVolume } from '../../lib/sound.js'

const SpeakerOn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
  </svg>
)
const SpeakerOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H2v6h4l5 4z" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" />
  </svg>
)

export default function SoundToggle() {
  const [prefs, setPrefs] = useState(getUiPrefs())
  useEffect(() => subscribeUi(setPrefs), [])

  // Apaga el ambiente si se activa el modo rendimiento
  useEffect(() => {
    if (prefs.perfMode) stopAmbient()
    else if (prefs.sound) { setSoundVolume(prefs.volume); startAmbient(prefs.volume) }
  }, [prefs.perfMode, prefs.sound, prefs.volume])

  const on = prefs.sound && !prefs.perfMode

  const toggle = () => {
    const next = !prefs.sound
    setSound(next)                       // persiste + emite
    if (next && !prefs.perfMode) startAmbient(prefs.volume) // el clic es el gesto que desbloquea audio
    else stopAmbient()
  }

  return (
    <button
      className="gg-iconbtn"
      title={on ? 'Silenciar' : 'Sonido ambiental'}
      aria-pressed={on}
      onClick={toggle}
      style={on ? { color: 'var(--accent)' } : undefined}
    >
      {on ? <SpeakerOn /> : <SpeakerOff />}
    </button>
  )
}

