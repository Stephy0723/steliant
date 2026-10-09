import { useEffect, useState } from 'react'

// true cuando el scroll vertical supera `offset`.
export function useScrolled(offset = 40) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return scrolled
}

