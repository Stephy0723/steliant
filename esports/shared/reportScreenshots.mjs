// Capturas que pide /report por juego (spec-lector-resultados, sección 5).
// El backend decide con esto qué falta y la web lo usa para las etiquetas.
// `option` es el nombre de la opción del comando /report: el bot tiene la
// misma tabla fija en discord-bot/commands/report.js (los comandos de
// Discord se registran estáticos). Las pantallas de MLBB hay que
// confirmarlas con capturas reales.
import { isMobileLegends } from './matchStats.mjs'

export const REPORT_SCREENSHOTS = Object.freeze({
  mlbb: Object.freeze([
    { key: 'overview', option: 'resumen', label: 'Resumen (Victoria/Derrota y marcador)', required: true },
    { key: 'damage_dealt', option: 'dano', label: 'Daño infligido', required: true },
    { key: 'damage_taken', option: 'recibido', label: 'Daño recibido', required: true },
    { key: 'teamfight', option: 'participacion', label: 'Participación', required: false },
  ]),
  default: Object.freeze([
    { key: 'overview', option: 'resumen', label: 'Resultado final', required: true },
  ]),
})

// Plazo de cada partida: corre desde el primer /report de cualquiera de los
// dos equipos (ahí se sabe que terminó). Aviso cuando faltan reminderMinutes.
export const REPORT_DEADLINE = Object.freeze({ minutes: 15, reminderMinutes: 5 })

export const reportScreenshotsFor = game => (isMobileLegends(game) ? REPORT_SCREENSHOTS.mlbb : REPORT_SCREENSHOTS.default)

/** Claves requeridas que no están en las capturas recibidas. */
export function missingScreenshots(game, evidence = []) {
  // Reportes del bot anterior: una sola imagen sin clave = el resumen.
  const have = new Set(evidence.map(e => e.key || 'overview'))
  return reportScreenshotsFor(game).filter(s => s.required && !have.has(s.key)).map(s => s.key)
}

// Nombre corto para pies de foto ("Resumen" sirve igual en cualquier juego).
const SHORT = { overview: 'Resumen', damage_dealt: 'Daño infligido', damage_taken: 'Daño recibido', teamfight: 'Participación' }
export const reportScreenshotLabel = key => SHORT[key] || 'Captura'

