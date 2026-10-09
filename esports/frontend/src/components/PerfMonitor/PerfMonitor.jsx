import { useEffect, useRef, useState } from 'react'
import { getUiPrefs, setPerfMode } from '../../lib/uiPrefs.js'
import { toast } from '../../lib/toast.js'
import './PerfMonitor.css'

const DISMISS_KEY = 'gg-perf-suggest-dismissed'
const SAMPLE_MS = 3500     // mide ~3.5s
const FPS_THRESHOLD = 42   // por debajo => sugerir
const TYPE_STEP = 2        // caracteres por tick
const TYPE_TICK = 18       // ms por tick
const OUT_MS = 220

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* Guion de la consola. Cada línea: { p: prefijo, t: texto, tag?, tone? }.
   El texto de la sugerencia es el mismo de siempre; lo demás es el diagnóstico real. */
function buildScript(fps) {
  return [
    { p: '$', t: 'gg diag --render', tone: 'cmd' },
    { p: ' ', t: 'muestreo ........ 3.5 s', tone: 'dim' },
    { p: ' ', t: `fps medidos ..... ${fps} / 60`, tag: 'BAJO', tone: 'dim' },
    { p: '!', t: '¿La web va lenta?', tone: 'alert' },
    { p: ' ', t: 'Activa el modo rendimiento para que funcione más fluido en tu dispositivo.' },
    { p: '$', t: 'activar modo rendimiento?', tone: 'cmd' },
  ]
}

export default function PerfMonitor() {
  const [fps, setFps] = useState(null)   // null = oculto
  const [typed, setTyped] = useState(0)  // caracteres revelados
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    const prefs = getUiPrefs()
    if (!prefs.autoReduce || prefs.perfMode) return
    try { if (sessionStorage.getItem(DISMISS_KEY) === '1') return } catch { return }

    let frames = 0
    let raf
    let start = 0
    const loop = (now) => {
      if (!start) start = now
      frames++
      if (now - start >= SAMPLE_MS) {
        const measured = (frames / (now - start)) * 1000
        if (measured < FPS_THRESHOLD) setFps(Math.round(measured))
        return
      }
      raf = requestAnimationFrame(loop)
    }
    // arranca tras un pequeño margen para no medir el montaje inicial
    const t = setTimeout(() => { raf = requestAnimationFrame(loop) }, 1500)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [])

  const script = fps == null ? [] : buildScript(fps)
  const total = script.reduce((n, l) => n + l.t.length, 0)
  const done = typed >= total

  // Escribe el guion como una consola; con movimiento reducido aparece entero.
  useEffect(() => {
    if (fps == null) return
    if (reducedMotion()) { setTyped(Infinity); return }
    timer.current = setInterval(() => setTyped(n => n + TYPE_STEP), TYPE_TICK)
    return () => clearInterval(timer.current)
  }, [fps])
  useEffect(() => { if (done) clearInterval(timer.current) }, [done])

  if (fps == null) return null

  const close = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
    setClosing(true)
    setTimeout(() => setFps(null), OUT_MS)
  }
  const enable = () => {
    setPerfMode(true)
    toast('Modo rendimiento activado · animaciones reducidas', 'success')
    close()
  }
  const skip = () => { if (!done) setTyped(Infinity) }

  // Reparte los caracteres revelados entre las líneas.
  let left = typed
  const lines = []
  for (const line of script) {
    if (left <= 0) break
    const shown = line.t.slice(0, left)
    lines.push({ ...line, shown, full: shown.length === line.t.length })
    left -= line.t.length
  }

  return (
    <section className="gg-perf-suggest" data-state={closing ? 'closing' : undefined} role="alertdialog" aria-label="¿La web va lenta?">
      <header className="gg-perf-suggest__bar">
        <span className="gg-perf-suggest__led" aria-hidden="true" />
        <span className="gg-perf-suggest__path">GG://SISTEMA<i>/monitor</i></span>
        <span className="gg-perf-suggest__state">{done ? 'ESPERANDO' : 'ANALIZANDO'}</span>
        <button type="button" className="gg-perf-suggest__x" onClick={close} aria-label="Cerrar">×</button>
      </header>

      <div className="gg-perf-suggest__screen" onClick={skip}>
        <span className="gg-perf-suggest__sr">¿La web va lenta? Activa el modo rendimiento para que funcione más fluido en tu dispositivo.</span>
        <ol aria-hidden="true">
          {lines.map((l, i) => (
            <li key={i} className={l.tone ? `is-${l.tone}` : undefined}>
              <b>{l.p}</b>
              <span>
                {l.shown}
                {l.tag && l.full && <em>{l.tag}</em>}
                {i === lines.length - 1 && <u className="gg-perf-suggest__cur" />}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className={`gg-perf-suggest__actions${done ? ' is-on' : ''}`}>
        <button type="button" className="gg-perf-suggest__btn gg-perf-suggest__btn--go" onClick={enable} tabIndex={done ? 0 : -1}>
          <span>[</span>Activar<span>]</span>
        </button>
        <button type="button" className="gg-perf-suggest__btn" onClick={close} tabIndex={done ? 0 : -1}>
          <span>[</span>Ahora no<span>]</span>
        </button>
      </div>
    </section>
  )
}

