import { useEffect, useRef, useState } from 'react'
import './GGVisor.css'

/* Cara de GG. mood: idle | hover | think | talk | happy | error | listen | peek
   <GGVisor mood={loading ? 'think' : 'idle'} size={60} follow /> */
export function GGVisor({ mood = 'idle', size = 60, follow = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!follow) return
    const onMove = e => {
      const f = ref.current; if (!f) return
      const r = f.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260)
      f.style.setProperty('--lx', (dx / d * 2.5 * k).toFixed(2))
      f.style.setProperty('--ly', (dy / d * 1.8 * k).toFixed(2))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [follow])
  return (
    <span ref={ref} className="ggf" data-mood={mood} style={{ '--s': size + 'px' }} aria-hidden="true">
      <svg viewBox="0 0 32 25.6">
        <g className="look"><g className="anim"><g className="eyes">
          <g className="m m-open"><rect x="9" y="7" width="5" height="8" /><rect x="18" y="7" width="5" height="8" /></g>
          <g className="m m-think"><rect x="9" y="7" width="5" height="4" /><rect x="18" y="7" width="5" height="4" /></g>
          <g className="m m-happy"><path d="M9 13 L11.5 9.5 L14 13 M18 13 L20.5 9.5 L23 13" /></g>
          <g className="m m-x"><path d="M9.5 8 L13.5 13 M13.5 8 L9.5 13 M18.5 8 L22.5 13 M22.5 8 L18.5 13" /></g>
          <g className="m m-flat"><rect x="9" y="11" width="5" height="2" /><rect x="18" y="11" width="5" height="2" /></g>
        </g></g></g>
        <g className="wave">{[11.5, 14, 16.5, 19, 21.5].map(x => <rect key={x} x={x} y="18" width="1.5" height="3" />)}</g>
        <g className="load"><rect x="6" y="20.5" width="4" height="1.5" /></g>
      </svg>
    </span>
  )
}

const GLYPHS = '▓▒░█<>/\\#%01Ξ'
const reducedMotion = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('gg-perf'))

/* Texto que se "descifra" de izquierda a derecha con ruido glitch delante del cursor. */
export function GlitchText({ text, speed = 32 }) {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0))
  useEffect(() => {
    if (n >= text.length) return
    const id = setTimeout(() => setN(v => v + 1), speed)
    return () => clearTimeout(id)
  }, [n, text, speed])
  const noise = Array.from({ length: Math.min(3, text.length - n) }, () => GLYPHS[Math.random() * GLYPHS.length | 0]).join('')
  return <><span aria-hidden="true">{text.slice(0, n)}<span className="ggc-noise">{noise}</span></span><span className="ggc-sr">{text}</span></>
}

/* Presencia flotante. Estados: open, notify, peek, msg, hop. lift = px que sube por un aviso.
   call = { id, text, heart?, options?: [{ label }] } — aviso HUD junto a GG.
   onCallPick(i) = eligió la opción i; onCallNo = "Ahora no". Un aviso sin opciones es un saludo:
   tocarlo abre GG como el propio dock. */
export function GGDock({ mood = 'idle', open, notify, peek, msg, warp, hop, lift = 0, side = 'right', upper = false, dragging, style, dragHandlers, call, onCallPick, onCallNo, onClick, onPointerEnter, onPointerLeave, dockRef }) {
  const cls = ['ggc-dock', open && 'ggc-dock--open', notify && 'ggc-dock--notify', peek && 'ggc-dock--peek', msg && 'ggc-dock--msg', call && 'ggc-dock--call', side === 'left' && 'ggc-dock--left', upper && 'ggc-dock--upper', dragging && 'ggc-dock--drag'].filter(Boolean).join(' ')
  const handleClick = e => {
    // Las acciones del aviso viven dentro del botón (no se anidan <button>), así que las distinguimos aquí.
    const pick = e.target.closest('[data-call]')?.dataset.call
    if (pick === 'no') { onCallNo?.(); return }
    if (pick != null) { onCallPick?.(Number(pick)); return }
    onClick?.(e)
  }
  const options = call?.options || []
  return (
    <button ref={dockRef} type="button" className={cls} style={{ ...style, '--lift': lift + 'px' }} onClick={handleClick} {...dragHandlers}
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} data-warp={warp ? '' : undefined} data-hop={hop ? '' : undefined}
      aria-label={open ? 'Cerrar GG' : 'Abrir GG, asistente'} aria-expanded={!!open}>
      <span className="ggc-dock__body">
        <GGVisor mood={open ? 'listen' : mood} size={60} follow />
        <span className="ggc-dock__x"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span>
        <span className="ggc-dock__pip">1</span>
      </span>
      <span className="ggc-dock__shadow" />
      {call && (
        <span key={call.id} className={`ggc-call${options.length ? '' : ' ggc-call--hello'}`} role="status">
          <small>GG ▸</small>
          <p><GlitchText text={call.text} />{call.heart && <span className="ggc-heart" aria-hidden="true" style={{ animationDelay: `${reducedMotion() ? 0 : call.text.length * 32}ms` }}>♥</span>}</p>
          {options.length > 0 && (
            <span className="ggc-call__act">
              {options.map((o, i) => <span key={o.label} data-call={i}>{o.label}</span>)}
              <span data-call="no">Ahora no</span>
            </span>
          )}
        </span>
      )}
    </button>
  )
}

