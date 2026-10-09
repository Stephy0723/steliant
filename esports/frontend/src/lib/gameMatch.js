// Utilidades para cruzar jugadores y equipos: los equipos guardan el NOMBRE del
// juego (ej. "Mobile Legends") y los perfiles el id canonico.
import { GAMES, normalizeGameId } from '../data/games.js'
import { ranksFor } from '../data/gameRanks.js'

export const plain = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Id canonico de un juego a partir de su nombre o alias ('' si no se reconoce). */
export function gameIdOf(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const direct = normalizeGameId(text, '')
  if (direct) return direct
  const wanted = plain(text)
  const found = GAMES.find(g => plain(g.name) === wanted) || GAMES.find(g => plain(g.name).includes(wanted) || wanted.includes(plain(g.name)))
  return found?.id || ''
}

/** ¿Mi rango entra en el rango que pide una vacante? true/false, o null si no se puede saber. */
export function rankFits(gameId, myRank, min, max) {
  if (!min && !max) return null
  const order = ranksFor(gameId)
  const mine = order.indexOf(myRank)
  if (mine < 0) return null
  const lo = min ? order.indexOf(min) : -1
  const hi = max ? order.indexOf(max) : -1
  if (min && lo < 0 && max && hi < 0) return null
  if (lo >= 0 && mine < lo) return false
  if (hi >= 0 && mine > hi) return false
  return true
}

