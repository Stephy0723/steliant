// Rutas / accesos OCULTOS en la beta: vistas que todavia no tienen
// funcionalidad real (salen como "Proximamente" o usan datos de ejemplo).
// NO se borraron: la ruta y el codigo siguen ahi; solo se quitan de los menus
// (Navbar, Sidebar, Topbar, paneles de rol) y de los botones que llevan a ellas.
//
// Para volver a mostrar una: borra su linea de HIDDEN_PATHS (o pon BETA_MODE en
// false para mostrar TODO de golpe). El detalle de que se oculto, por que y que
// falta para reactivarlo esta en BETA-OCULTO.md (raiz del repo).

export const BETA_MODE = true

const HIDDEN_PATHS = new Set([
  // Topbar
  'section:topbar-sound', // boton de sonido ambiental
  // Publico / sidebar principal
  '/noticias',            // Noticias publicas ocultas de navegacion por ahora
  '/ranking',             // Ranking publico oculto de navegacion por ahora
  '/planes',              // Planes y precios -> "Proximamente"
  '/premium',             // GlitchGang Pro -> "Proximamente"
  '/tv',                  // GlitchGang TV -> "Proximamente"
  '/creadores',           // Directorio de creadores -> "Proximamente"
  '/redes',               // Redes sociales -> "Proximamente"
  '/recompensas',         // Progreso y logros -> "Proximamente"
  '/organizadores',       // Directorio de organizadores: datos de ejemplo fijos
  // Panel de jugador
  'section:player-achievements', // tarjeta "Logros" del resumen: lista fija inventada, sin backend
  '/jugador/rendimiento', // Mi rendimiento -> "Proximamente"
  // Panel de equipo
  '/mi-equipo/calendario', // Cronograma: actividades y scrims solo en localStorage (no compartido)
  'section:teams-find',    // /equipos: tabs "Buscar Equipo" y "Buscar Jugadores" (datos de ejemplo + local)
  'section:teams-scrims',  // /equipos: tab "Scrims" (lista local, sin backend)
  // Panel de organizador
  '/organizador/finanzas',
  '/organizador/crm',
  '/organizador/integraciones',
  '/organizador/configuracion',
  // Panel de creador (solo "Perfil profesional" funciona)
  '/creador',
  '/creador/contenido',
  '/creador/analiticas',
  '/creador/monetizacion',
  // Panel de marca
  '/marca/inventario',
  '/marca/naming-rights',
  '/marca/creatividades',
  '/marca/reportes',
  // Panel de comunidad
  '/mi-comunidad/operaciones',
  '/mi-comunidad/web',
])

// Prefijos: /organizadores/:id (perfil publico con datos de ejemplo).
const HIDDEN_PREFIXES = ['/organizadores/']

const cleanPath = (path) => path.split(/[?#]/)[0].replace(/(.)\/+$/, '$1')

/** ¿Este destino esta oculto en la beta? Ignora query string y "/" final. */
export function isBetaHidden(path) {
  if (!BETA_MODE || !path || typeof path !== 'string') return false
  const clean = cleanPath(path)
  return HIDDEN_PATHS.has(clean) || HIDDEN_PREFIXES.some(prefix => clean.startsWith(prefix))
}

// Quitados SOLO del sidebar principal (la pagina sigue viva y enlazada desde
// otros lados: barra superior, botones, URL). No van en HIDDEN_PATHS porque esa
// lista oculta el destino en TODOS los menus (paneles de rol incluidos).
const SIDEBAR_HIDDEN = new Set([
  '/marcas',
  '/comunidad',
  '/mi-comunidad', // panel de comunidad
])

/** ¿Este destino esta quitado del sidebar principal en la beta? */
export function isSidebarHidden(path) {
  if (!BETA_MODE || !path || typeof path !== 'string') return false
  return SIDEBAR_HIDDEN.has(cleanPath(path))
}

/** Quita de un menu los items cuyo destino (item[key]) esta oculto. */
export function hideInBeta(items, key = 'path') {
  return BETA_MODE ? (items || []).filter(item => !isBetaHidden(item?.[key])) : items
}

/** Idem para secciones { section, items:[{ path }] }: tambien quita las que quedan vacias. */
export function hideInBetaSections(sections) {
  if (!BETA_MODE) return sections
  return (sections || [])
    .map(section => ({ ...section, items: hideInBeta(section.items) }))
    .filter(section => section.items.length > 0)
}

