// Color de identidad de un equipo. Se guarda en Team.color y pinta todo el
// Team HQ (--accent / --panel-accent). Tiene que ser un hex real: equipos
// viejos quedaron con 'var(--accent)' (el wizard guardaba el valor de CSS),
// que en el shell se vuelve --accent: var(--accent) -> invalido -> negro.
// Un acento casi negro tampoco sirve: botones y etiquetas llevan texto oscuro
// encima, y sobre el fondo oscuro del panel desaparece todo.

export const TEAM_DEFAULT_COLOR = '#00E676'

export function parseHexColor(value) {
  const raw = String(value || '').trim()
  const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(raw)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  const full = /^#?([a-f\d]{6})$/i.exec(raw)
  return full ? `#${full[1]}`.toUpperCase() : ''
}

// Luminancia relativa WCAG (0 = negro, 1 = blanco).
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function isTeamColorTooDark(value) {
  const hex = parseHexColor(value)
  return Boolean(hex) && luminance(hex) < 0.06
}

// Siempre devuelve un hex usable: el del equipo si sirve, si no el verde GG.
export function teamColor(value) {
  const hex = parseHexColor(value)
  return hex && !isTeamColorTooDark(hex) ? hex : TEAM_DEFAULT_COLOR
}

