import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Arrastrar a GG por la pantalla (ratón o dedo). Al soltar se pega al borde
   izquierdo o derecho más cercano y conserva la altura donde lo dejaste.
   La posición se recuerda en este navegador (localStorage). */

const POS_KEY = 'gg-assistant-pos'
const DRAG_PX = 6     // menos que esto es un toque, no un arrastre
const TOP_MIN = 70    // no se mete debajo de la barra superior

const isMobile = () => window.matchMedia('(max-width: 640px)').matches
const edgeGap = () => (isMobile() ? 14 : 22)
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

function readPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    return p && (p.side === 'left' || p.side === 'right') && Number.isFinite(p.y) ? p : null
  } catch { return null }
}

export function useDockDrag(dockRef) {
  const [pos, setPos] = useState(readPos) // { side, y } · y = fracción del alto de la ventana
  const [drag, setDrag] = useState(null)  // { x, y } en px mientras se arrastra
  const [, setViewport] = useState(0)
  const start = useRef(null)
  const moved = useRef(false)

  useEffect(() => {
    const onResize = () => setViewport(v => v + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // El primer render no conoce el tamaño real del dock: se vuelve a calcular ya montado.
  useLayoutEffect(() => { if (pos) setViewport(v => v + 1) }, [])

  const size = () => ({ w: dockRef.current?.offsetWidth || 60, h: dockRef.current?.offsetHeight || 48 })

  const onPointerDown = e => {
    if (e.button !== 0 || e.target.closest('[data-call]')) return
    const r = dockRef.current.getBoundingClientRect()
    start.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, id: e.pointerId }
    moved.current = false
  }

  const onPointerMove = e => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.px, dy = e.clientY - s.py
    if (!moved.current) {
      if (Math.hypot(dx, dy) < DRAG_PX) return
      moved.current = true
      try { dockRef.current.setPointerCapture(e.pointerId) } catch { /* sin captura */ }
    }
    const { w, h } = size()
    setDrag({ x: clamp(s.x + dx, 0, window.innerWidth - w), y: clamp(s.y + dy, TOP_MIN, window.innerHeight - h) })
  }

  const onPointerUp = e => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    if (!moved.current || !drag) { setDrag(null); return }
    const { w } = size()
    const next = { side: drag.x + w / 2 < window.innerWidth / 2 ? 'left' : 'right', y: drag.y / window.innerHeight }
    setPos(next)
    setDrag(null)
    try { localStorage.setItem(POS_KEY, JSON.stringify(next)) } catch { /* sin almacenamiento */ }
  }

  // El click llega justo después de soltar: si fue un arrastre, se ignora.
  const consumeDrag = () => {
    if (!moved.current) return false
    moved.current = false
    return true
  }

  // Posición en px ya pegada al borde (o null = la esquina por defecto del CSS).
  const place = () => {
    if (!pos) return null
    const { w, h } = size()
    const gap = edgeGap()
    const top = clamp(pos.y * window.innerHeight, TOP_MIN, window.innerHeight - h - gap)
    return { side: pos.side, top, h, left: pos.side === 'left' ? gap : window.innerWidth - w - gap }
  }

  const placed = place()
  const side = drag ? (drag.x + size().w / 2 < window.innerWidth / 2 ? 'left' : 'right') : placed?.side || 'right'

  const dockStyle = ({ peek } = {}) => {
    if (drag) return { left: drag.x, top: drag.y, right: 'auto', bottom: 'auto' }
    if (!placed) return null
    const { w } = size()
    // Asomado por el borde (como el peek del CSS), pero del lado donde vive.
    const left = peek ? (placed.side === 'left' ? -20 : window.innerWidth - w + 20) : placed.left
    return { left, top: placed.top, right: 'auto', bottom: 'auto' }
  }

  // El panel de chat se abre junto a GG: mismo lado, y encima o debajo según la mitad en la que esté.
  const panelStyle = () => {
    if (!placed || isMobile()) return null
    const gap = edgeGap()
    const horiz = placed.side === 'left' ? { left: gap, right: 'auto' } : { right: gap, left: 'auto' }
    const vh = window.innerHeight
    if (placed.top < vh / 2) {
      const top = placed.top + placed.h + 14
      return { ...horiz, top, bottom: 'auto', height: Math.min(680, vh - top - gap) }
    }
    const bottom = vh - placed.top + 14
    return { ...horiz, bottom, top: 'auto', height: Math.min(680, placed.top - 14 - TOP_MIN) }
  }

  // Los toasts salen abajo a la derecha: solo hay que esquivarlos si GG está ahí.
  const avoidsToasts = !placed || (placed.side === 'right' && placed.top > window.innerHeight / 2)

  // En la mitad de arriba el aviso de GG crece hacia abajo (si no, se sale por arriba).
  const upper = Boolean(placed && placed.top < window.innerHeight / 2)

  return {
    dragging: !!drag,
    custom: !!placed,
    side,
    upper,
    avoidsToasts,
    dockStyle,
    panelStyle,
    consumeDrag,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}

