// Sala de staff por torneo (pestana "Sala de staff" del panel). Es una
// Conversation type 'tournament_staff' que solo crea y modifica el servidor:
// los miembros salen del torneo, nunca del cliente.
//   miembros = dueno + staffMembers aceptados + casters activos + admins de GlitchGang
import { Conversation } from '../models/Conversation.js'
import { User } from '../models/User.js'
import { Tournament } from '../models/Tournament.js'

export const STAFF_ROOM_TYPE = 'tournament_staff'
// Roles de staff que pueden marcar un mensaje como reporte formal (mismo
// REPORTER_ROLES que TabSalaStaff.jsx). Dueno y admin tambien pueden.
export const STAFF_REPORTER_ROLES = ['Director', 'Administrador', 'Arbitro', 'Moderador']

const idOf = value => String(value?._id || value || '')

async function adminIds() {
  const admins = await User.find({ $or: [{ role: 'admin' }, { roles: 'admin' }], isBanned: { $ne: true } }).select('_id').lean()
  return admins.map(admin => String(admin._id))
}

export async function staffRoomMemberIds(tournament) {
  const staff = (tournament.staffMembers || [])
    .filter(member => member.status === 'accepted' && member.user)
    .map(member => idOf(member.user))
  const casters = (tournament.staff?.casters || [])
    .filter(caster => caster.user && !caster.removedAt)
    .map(caster => idOf(caster.user))
  const ids = [idOf(tournament.organizer), ...staff, ...casters, ...(await adminIds())].filter(Boolean)
  return [...new Set(ids)]
}

function roomTitle(tournament) {
  return `Staff · ${tournament.title || 'Torneo'}`.slice(0, 140)
}

/** Busca o crea la sala y deja los miembros al dia. */
export async function ensureStaffRoom(tournament) {
  const participants = await staffRoomMemberIds(tournament)
  const targetId = String(tournament._id)
  let room = await Conversation.findOne({ type: STAFF_ROOM_TYPE, 'context.targetId': targetId })
  if (!room) {
    return Conversation.create({
      type: STAFF_ROOM_TYPE,
      title: roomTitle(tournament),
      subtitle: 'Chat interno del staff',
      image: tournament.logo || '',
      context: { kind: STAFF_ROOM_TYPE, targetId, publicCode: tournament.publicId || '' },
      participants,
      admins: [tournament.organizer].filter(Boolean),
      readState: participants.map(user => ({ user, lastReadAt: null })),
    })
  }
  const current = (room.participants || []).map(String).sort().join()
  if (current !== [...participants].sort().join() || room.title !== roomTitle(tournament)) {
    room.participants = participants
    room.title = roomTitle(tournament)
    await room.save()
  }
  return room
}

/**
 * Sincroniza los miembros despues de aceptar/quitar staff o casters. Solo si
 * la sala ya existe (se crea la primera vez que alguien abre la pestana).
 * Nunca rompe la operacion que la llama.
 */
export async function syncStaffRoom(tournament) {
  try {
    const exists = await Conversation.exists({ type: STAFF_ROOM_TYPE, 'context.targetId': String(tournament._id) })
    if (exists) await ensureStaffRoom(tournament)
  } catch (error) {
    console.error('[staff-room] No se pudo sincronizar la sala:', error.message)
  }
}

/** Puede `user` mandar un mensaje kind 'staff_report' en esta sala? */
export async function canPostStaffReport(conversation, user) {
  if (conversation.type !== STAFF_ROOM_TYPE) return false
  const role = String(user?.role || '').toLowerCase()
  if (role === 'admin' || (user?.roles || []).map(String).includes('admin')) return true
  const tournament = await Tournament.findById(conversation.context?.targetId).select('organizer staffMembers').lean()
  if (!tournament) return false
  if (idOf(tournament.organizer) === idOf(user)) return true
  const member = (tournament.staffMembers || []).find(m => m.status === 'accepted' && idOf(m.user) === idOf(user))
  return Boolean(member && STAFF_REPORTER_ROLES.includes(member.role))
}
