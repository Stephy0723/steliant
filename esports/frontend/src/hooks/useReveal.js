import { useEffect, useRef, useState } from 'react'

// [ref, visible] cuando el elemento entra en viewport.
// once=false => vuelve a animar cada vez que entra (animación viva al hacer scroll).
export function useReveal(threshold = 0.18, once = false) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true)
        else if (!once) setVisible(false)
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, once])
  return [ref, visible]
}

