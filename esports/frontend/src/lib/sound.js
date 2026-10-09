// ════════════════════════════════════════════════════════════
//  Sonido ambiental generado con Web Audio (sin archivos).
//  Arpegios suaves en escala pentatónica = "melodía cool" de fondo.
//  Se enciende con un gesto del usuario (toggle). Volumen bajo.
// ════════════════════════════════════════════════════════════

let ctx = null
let master = null
let timer = null
let step = 0
let currentVol = 0.35

// Pentatónica menor (La) en varias octavas — suena agradable y "gamer-chill"
const SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33]

function ensureCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = currentVol * 0.18 // techo bajo: ambiente, no protagonista
  master.connect(ctx.destination)
  return ctx
}

function playNote(freq, when, dur = 1.6) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  // envolvente suave (fade in/out) para que no "clickee"
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(0.5, when + 0.25)
  g.gain.linearRampToValueAtTime(0, when + dur)
  osc.connect(g); g.connect(master)
  osc.start(when); osc.stop(when + dur + 0.05)
}

function tick() {
  if (!ctx) return
  const now = ctx.currentTime
  // nota base del arpegio
  const note = SCALE[step % SCALE.length]
  playNote(note, now, 1.8)
  // armonía ocasional una quinta arriba
  if (step % 4 === 0) playNote(SCALE[(step + 4) % SCALE.length], now + 0.4, 1.4)
  step++
}

export function isSoundOn() { return !!timer }

export function startAmbient(volume = currentVol) {
  currentVol = volume
  const c = ensureCtx()
  if (!c) return false
  if (c.state === 'suspended') c.resume()
  master.gain.value = currentVol * 0.18
  if (timer) return true
  step = 0
  tick()
  timer = setInterval(tick, 900) // un acorde cada ~0.9s
  return true
}

export function stopAmbient() {
  if (timer) { clearInterval(timer); timer = null }
  if (master) master.gain.value = 0
}

export function setSoundVolume(v) {
  currentVol = Math.max(0, Math.min(1, v))
  if (master) master.gain.value = currentVol * 0.18
}

// pequeño "blip" para confirmaciones (opcional)
export function blip() {
  const c = ensureCtx()
  if (!c) return
  const osc = c.createOscillator(), g = c.createGain()
  osc.type = 'sine'; osc.frequency.value = 880
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.12 * currentVol, c.currentTime + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18)
  osc.connect(g); g.connect(c.destination)
  osc.start(); osc.stop(c.currentTime + 0.2)
}

