/* Íconos del códec de GG (kit "Señal", gg-character.js → I).
   Trazo 24×24, sin relleno, color = currentColor. El tamaño lo da el CSS del contenedor
   (en el códec: .ggc__tool svg / .ggc-btn svg → 14–15px, stroke-width 1.8–2.2).
   <GGIcon name="copy" /> */
const PATHS = {
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
}

export const GG_ICON_NAMES = Object.keys(PATHS)

export function GGIcon({ name, size, strokeWidth = 2, ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {d}
    </svg>
  )
}

