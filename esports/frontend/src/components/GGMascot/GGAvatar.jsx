import { useMemo } from 'react'
import { GG_AVATARS, ggAvatarSvg } from './ggAvatars'

const prefersStill = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('gg-perf'))

/* Avatar GG por defecto, inline (animado con SMIL).
   <GGAvatar id="senal" size={48} round />
   <GGAvatar id="corte" mood="happy" />       ← cambia la faceta (p. ej. al elegirlo)
   still: sin animación (miniaturas repetidas en listas largas). Respeta prefers-reduced-motion. */
export default function GGAvatar({ id = 'senal', mood, size = 48, round = false, still = false, label, className = '' }) {
  const a = GG_AVATARS.find(x => x.id === id) || GG_AVATARS[0]
  const svg = useMemo(
    () => ggAvatarSvg({ ...a, mood: mood || a.mood, label: label || `Avatar GG ${a.name}`, still: still || prefersStill() }),
    [a, mood, label, still],
  )
  return (
    <span
      className={className}
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0, flex: 'none', overflow: 'hidden', borderRadius: round ? '50%' : 4 }}
      // El SVG lo genera ggAvatarSvg con datos propios (sin input de usuario).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

