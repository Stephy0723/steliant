import { User } from '../models/User.js'
import { publicPresence } from '../../../shared/presence.mjs'

// Vista de una conversacion para UN usuario concreto.
//
// En los chats privados el titulo y la imagen se guardaban una sola vez al
// crear la conversacion, con lo que mandaba quien la abria: el otro
// participante podia ver su PROPIO nombre como titulo, y si alguien cambiaba
// su foto el chat nunca se enteraba. Ahora, para 'private', el titulo y la
// foto son siempre los del otro participante, leidos en el momento.

const PEER_FIELDS = 'nick avatar status activeStatus lastSeenAt playerCode'

function counterpartOf(conversation, viewerId) {
  const viewer = String(viewerId || '')
  return (conversation.participants || []).map(String).find(id => id !== viewer) || null
}

export function unreadFor(conversation, viewerId) {
  const state = (conversation.readState || []).find(item => String(item.user) === String(viewerId))
  const lastRead = state?.lastReadAt ? new Date(state.lastReadAt).getTime() : 0
  const lastMessage = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0
  return lastMessage > lastRead ? 1 : 0
}

/** Carga (en una sola consulta) a los "otros" de varios chats privados. */
export async function loadPeers(conversations, viewerId) {
  const ids = [...new Set(conversations
    .filter(conversation => conversation?.type === 'private')
    .map(conversation => counterpartOf(conversation, viewerId))
    .filter(Boolean))]
  if (!ids.length) return new Map()
  const users = await User.find({ _id: { $in: ids } }).select(PEER_FIELDS).lean()
  return new Map(users.map(user => [String(user._id), user]))
}

/** Sobrescribe titulo/imagen de un chat privado con los datos del otro. */
export function applyPeer(view, conversation, viewerId, peers) {
  if (conversation?.type !== 'private') return view
  const peerId = counterpartOf(conversation, viewerId)
  const peer = peerId ? peers.get(peerId) : null
  if (!peer) return view
  return {
    ...view,
    title: peer.nick || view.title,
    image: peer.avatar || '',
    peer: {
      id: String(peer._id),
      nick: peer.nick || '',
      avatar: peer.avatar || '',
      status: peer.status || 'offline',
      // online + presence (estado elegido si esta conectado), shared/presence.mjs
      ...publicPresence(peer),
      playerCode: peer.playerCode || '',
    },
  }
}
