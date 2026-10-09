import { presenceId, OFFLINE_PRESENCE } from '../../../shared/presence.mjs'
import { STATUS_BY_ID } from '../data/cosmetics.js'

// Estado a mostrar de un usuario (shared/presence.mjs + catalogo de estados):
// si esta conectado, el que eligio (Jugando, AFK, No molestar...); si no, o si
// eligio Invisible, "Desconectado". Toda pantalla que pinte "en linea" usa esto.
export function presenceInfo(user, lang = 'es') {
  const id = presenceId(user)
  if (id === OFFLINE_PRESENCE) {
    return { id, online: false, label: lang === 'en' ? 'Offline' : 'Desconectado', color: '#6B7280', fx: '' }
  }
  const status = STATUS_BY_ID[id] || STATUS_BY_ID.online
  return { id, online: true, label: status.label, color: status.color, fx: status.fx || '' }
}

export { presenceId }

