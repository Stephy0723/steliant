// ════════════════════════════════════════════════════════════
//  Efectos de sonido (SFX) glitch generados con Web Audio, sin archivos.
//  Cortos y a volumen bajo; respetan Ajustes → Sonido (efectos + volumen)
//  y se silencian con el modo rendimiento.
//
//  Uso:  import { sfx } from '../../lib/sfx.js'
//        sfx('success')   // success | error | denied | click | register | victory
//  toast() ya los dispara según su tipo; llamar sfx() solo para momentos propios.
// ════════════════════════════════════════════════════════════
import { getUiPrefs } from './uiPrefs.js'

let ctx = null
let out = null
let crusher = null
let noiseBuffer = null
const lastAt = {}

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  out = ctx.createGain()
  out.connect(ctx.destination)
  // "Bitcrush" suave: cuantiza la onda para el toque pixelado/glitch.
  crusher = ctx.createWaveShaper()
  const steps = 10, curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.round(x * steps) / steps
  }
  crusher.curve = curve
  crusher.connect(out)
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

// Una nota con envolvente rápida. `to` = frecuencia final (barrido de tono).
function tone(t, { freq, to, dur = 0.08, type = 'square', vol = 0.5, crush = true }) {
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g); g.connect(crush ? crusher : out)
  osc.start(t); osc.stop(t + dur + 0.02)
}

// Ráfaga de ruido filtrado: el "chasquido" glitch.
function noise(t, { dur = 0.04, vol = 0.3, freq = 3000 }) {
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain()
  src.buffer = noiseBuffer
  filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 1.2
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter); filter.connect(g); g.connect(out)
  src.start(t); src.stop(t + dur + 0.02)
}

const SOUNDS = {
  // Clic digital corto para botones principales.
  click: t => {
    tone(t, { freq: 1800, to: 900, dur: 0.035, vol: 0.25 })
    noise(t, { dur: 0.02, vol: 0.12, freq: 5000 })
  },
  // Listo: dos blips que suben + coletilla glitch.
  success: t => {
    tone(t, { freq: 880, dur: 0.06, vol: 0.35 })
    tone(t + 0.07, { freq: 1320, dur: 0.1, vol: 0.35 })
    noise(t + 0.15, { dur: 0.03, vol: 0.12, freq: 6000 })
    tone(t + 0.17, { freq: 2640, dur: 0.025, vol: 0.12 })
  },
  // Error: zumbido que baja con tartamudeo.
  error: t => {
    noise(t, { dur: 0.05, vol: 0.2, freq: 1200 })
    for (let i = 0; i < 3; i++) tone(t + i * 0.055, { freq: 320 - i * 60, to: 200 - i * 40, dur: 0.045, type: 'sawtooth', vol: 0.3 })
    tone(t + 0.17, { freq: 140, to: 90, dur: 0.14, type: 'sawtooth', vol: 0.28 })
  },
  // Denegado: dos "bonk" graves y secos.
  denied: t => {
    tone(t, { freq: 220, dur: 0.09, vol: 0.38 })
    tone(t + 0.13, { freq: 165, dur: 0.14, vol: 0.38 })
    noise(t + 0.13, { dur: 0.03, vol: 0.1, freq: 900 })
  },
  // Inscripción a torneo: power-up que sube con glitch.
  register: t => {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => tone(t + i * 0.07, { freq: f, dur: 0.09, vol: 0.32 }))
    noise(t + 0.29, { dur: 0.05, vol: 0.14, freq: 7000 })
    tone(t + 0.3, { freq: 1046.5, to: 2093, dur: 0.22, type: 'triangle', vol: 0.3, crush: false })
    tone(t + 0.36, { freq: 2093, dur: 0.03, vol: 0.12 })
    tone(t + 0.42, { freq: 2093, dur: 0.03, vol: 0.08 })
  },
  // Campeón: fanfarria corta con brillo glitch.
  victory: t => {
    const fanfare = [[523.25, 0], [523.25, 0.1], [523.25, 0.2], [698.46, 0.3], [880, 0.45]]
    fanfare.forEach(([f, d]) => tone(t + d, { freq: f, dur: 0.09, vol: 0.32 }))
    // Acorde final (Fa mayor) sostenido, sin bitcrush para que brille.
    ;[698.46, 880, 1046.5].forEach(f => tone(t + 0.6, { freq: f, dur: 0.7, type: 'triangle', vol: 0.22, crush: false }))
    tone(t + 0.6, { freq: 349.23, dur: 0.7, vol: 0.18 })
    for (let i = 0; i < 4; i++) {
      noise(t + 0.62 + i * 0.12, { dur: 0.025, vol: 0.1, freq: 6000 + i * 800 })
      tone(t + 0.64 + i * 0.12, { freq: 2093 + i * 260, dur: 0.03, vol: 0.08 })
    }
  },
}

export const SFX_NAMES = Object.keys(SOUNDS)

// `force` ignora el interruptor (para el botón "Probar" de Ajustes).
export function sfx(name, { force = false } = {}) {
  try {
    const prefs = getUiPrefs()
    if (!SOUNDS[name] || prefs.perfMode || (!force && prefs.sfx === false)) return
    // Varios avisos iguales a la vez (p. ej. tres errores de carga) suenan una vez.
    const now = performance.now()
    if (!force && now - (lastAt[name] || 0) < 150) return
    lastAt[name] = now
    const c = ensure()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})
    out.gain.value = Math.max(0, Math.min(1, prefs.volume ?? 0.35)) * 0.55
    SOUNDS[name](c.currentTime + 0.01)
  } catch { /* el sonido nunca debe romper la UI */ }
}

