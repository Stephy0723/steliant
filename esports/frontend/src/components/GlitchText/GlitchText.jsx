import { useEffect, useRef } from 'react'
import './GlitchText.css'

// Texto con glitch sutil que se dispara en bucle suave.
export default function GlitchText({ children, interval = 4200, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fire = () => { el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire') }
    const t0 = setTimeout(fire, 500)
    const id = setInterval(fire, interval)
    return () => { clearTimeout(t0); clearInterval(id) }
  }, [interval])
  return (
    <span ref={ref} className={`gg-glitch ${className}`} data-text={children}>
      {children}
    </span>
  )
}

export function GlitchGangText({ children, interval, className = '' }) {
  return String(children).split(/(gang)/gi).map((part, index) => (
    /^gang$/i.test(part)
      ? <GlitchText key={`${part}-${index}`} interval={interval} className={className}>{part}</GlitchText>
      : part
  ))
}

