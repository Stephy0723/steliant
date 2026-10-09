// ════════════════════════════════════════════════════════════
//  Preferencias de UI en vivo: Modo Rendimiento + Sonido.
//  Pub/sub ligero + aplica/quita la clase global `gg-perf`.
//  Persiste en el mismo store de ajustes (gg-settings).
// ════════════════════════════════════════════════════════════
import { loadSettings, saveSettings } from './settingsStore.js'

let state = {
  perfMode: false,
  autoReduce: true,
  sound: false,
  sfx: true,
  volume: 0.35,
}
try {
  const s = loadSettings()
  state = { perfMode: !!s.perfMode, autoReduce: s.autoReduce !== false, sound: !!s.sound, sfx: s.sfx !== false, volume: s.volume ?? 0.35 }
} catch { /* noop */ }

const listeners = new Set()

function applyBody() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('gg-perf', state.perfMode)
}
applyBody()

function persist() {
  try { saveSettings({ ...loadSettings(), ...state }) } catch { /* noop */ }
}

function emit() { listeners.forEach(cb => cb(state)) }

export function getUiPrefs() { return state }
export function subscribeUi(cb) { listeners.add(cb); return () => listeners.delete(cb) }

export function setPerfMode(on) {
  state = { ...state, perfMode: !!on }
  applyBody(); persist(); emit()
}
export function setSound(on) {
  state = { ...state, sound: !!on }
  persist(); emit()
}
export function setSfx(on) {
  state = { ...state, sfx: !!on }
  persist(); emit()
}
export function setVolume(v) {
  state = { ...state, volume: Math.max(0, Math.min(1, v)) }
  persist(); emit()
}
export function setAutoReduce(on) {
  state = { ...state, autoReduce: !!on }
  persist(); emit()
}

