import { createContext, useContext, useEffect, useState } from 'react'
import { ACCENTS, BACKGROUNDS } from './themeConfig.js'

const ThemeContext = createContext(null)
export const useTheme = () => useContext(ThemeContext)
const LIGHT = ['Claro', 'Blanco', 'Crema']

export function ThemeProvider({ children }) {
  const [accent, setAccent] = useState(() => localStorage.getItem('gg-accent') || 'Verde')
  const [background, setBackground] = useState(() => localStorage.getItem('gg-bg') || 'AMOLED')

  // Persistir en localStorage cuando cambian
  useEffect(() => { localStorage.setItem('gg-accent', accent) }, [accent])
  useEffect(() => { localStorage.setItem('gg-bg', background) }, [background])

  // modo derivado del fondo, para el toggle rápido dark/light del sidebar
  const mode = LIGHT.includes(background) ? 'light' : 'dark'
  const setMode = (m) => setBackground(m === 'light' ? 'Blanco' : 'AMOLED')

  useEffect(() => {
    const a = ACCENTS[accent]
    const b = BACKGROUNDS[background]
    const r = document.documentElement.style
    r.setProperty('--accent', a.color)
    r.setProperty('--accent-rgb', a.rgb)
    r.setProperty('--bg', b.bg)
    r.setProperty('--bg-elev', b.elev)
    r.setProperty('--bg-card', b.card)
    r.setProperty('--line', b.line)
    r.setProperty('--text', b.text)
    r.setProperty('--text-dim', b.dim)
    // Texto de aviso (ambar). #ffcc66 no se lee sobre fondos claros.
    r.setProperty('--warn-text', mode === 'light' ? '#946200' : '#ffcc66')
    // Sin esto, los popups nativos (opciones de <select>, date/time pickers)
    // se dibujan con el tema claro/oscuro del sistema operativo en vez del
    // tema elegido en la app -- por eso se veian con fondo blanco y texto
    // gris casi ilegible cuando el sitio esta en modo oscuro.
    document.documentElement.style.colorScheme = mode
  }, [accent, background, mode])

  return (
    <ThemeContext.Provider value={{ accent, setAccent, background, setBackground, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

