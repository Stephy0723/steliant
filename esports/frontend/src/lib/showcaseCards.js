// Que tarjetas muestra una persona en su perfil principal: la de jugador y/o
// la tarjeta profesional de cada rol que tenga aprobado. Se guarda en
// User.showcaseCards (publico, lo ven tambien los demas). Si el servidor aun no
// lo almacena, el dueno lo conserva en este navegador.
import { api } from './api.js'
import { availableRoleCards, hasProPlayerProfile } from './roleCard.js'

const localKey = (user) => `gg-showcase-cards:${user?._id || user?.id || 'me'}`

function readLocal(user) {
  try { return JSON.parse(localStorage.getItem(localKey(user)) || 'null') } catch { return null }
}
function writeLocal(user, ids) {
  try { localStorage.setItem(localKey(user), JSON.stringify(ids)) } catch { /* almacenamiento no disponible */ }
}

/** Ids de tarjetas que la persona puede mostrar: 'player' + roles aprobados con tarjeta. */
export const availableCards = (user) => ['player', ...(hasProPlayerProfile(user) ? ['proplayer'] : []), ...availableRoleCards(user)]

/** Ids de tarjetas que se muestran (en orden). Siempre al menos ['player']. */
export function resolveShowcase(user, { owner = false } = {}) {
  const available = availableCards(user)
  let saved = Array.isArray(user?.showcaseCards) && user.showcaseCards.length ? user.showcaseCards : null
  if (!saved && owner) saved = readLocal(user)
  const ids = (Array.isArray(saved) ? saved : []).filter(id => available.includes(id))
  return ids.length ? ids : ['player']
}

/** Guarda la seleccion. Devuelve { persisted } (false si solo quedo en este navegador). */
export async function saveShowcase(ids, user, updateUser) {
  writeLocal(user, ids)
  const result = await api('/profile/me', { method: 'PATCH', body: { showcaseCards: ids } })
  if (result?.user) updateUser?.(result.user)
  const stored = result?.user?.showcaseCards
  return { persisted: Array.isArray(stored) && stored.length === ids.length }
}

