export const CARD_THEMES = [
  {
    id: 'tech-orange',
    name: 'Circuit Cut',
    tone: 'Franjas tech verticales',
    accent: '#ff7a00',
    dark: '#050505',
    light: '#f7f4ef',
    className: 'card-theme--tech-orange',
  },
  {
    id: 'white-system',
    name: 'System Label',
    tone: 'Blanco, X y marcas print',
    accent: '#111111',
    dark: '#f4f0ef',
    light: '#0a0a0a',
    className: 'card-theme--white-system',
  },
  {
    id: 'cyan-interface',
    name: 'HUD Scan',
    tone: 'Lineas y terminal azul',
    accent: '#22d3ee',
    dark: '#061018',
    light: '#e6fbff',
    className: 'card-theme--cyan-interface',
  },
  {
    id: 'red-terminal',
    name: 'Error Mark',
    tone: 'Cortes rojos y alerta',
    accent: '#ff334e',
    dark: '#090509',
    light: '#fff2f4',
    className: 'card-theme--red-terminal',
  },
  {
    id: 'lime-grid',
    name: 'Tactical Mesh',
    tone: 'Reticula militar',
    accent: '#a3e635',
    dark: '#061006',
    light: '#f1ffe0',
    className: 'card-theme--lime-grid',
  },
  {
    id: 'violet-holo',
    name: 'Holo Slice',
    tone: 'Cortes diagonales premium',
    accent: '#a78bfa',
    dark: '#0d0718',
    light: '#f6f0ff',
    className: 'card-theme--violet-holo',
  },
]

export const CARD_THEME_BY_ID = Object.fromEntries(CARD_THEMES.map(theme => [theme.id, theme]))

export function getCardTheme(id) {
  return CARD_THEME_BY_ID[id] || CARD_THEMES[0]
}

export function cardThemeVars(theme) {
  return {
    '--card-theme-accent': theme.accent,
    '--card-theme-dark': theme.dark,
    '--card-theme-light': theme.light,
  }
}

