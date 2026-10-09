// Roster congelado al check-in (#roster-congelado-checkin): desde que un
// equipo hace check-in en un torneo activo, nadie puede entrar, salir ni
// cambiar quien ocupa un puesto hasta que el torneo termine o esa
// inscripcion salga del torneo (withdrawn/disqualified). Las rutas admin
// quedan exentas a proposito (soporte) -- no llaman a este helper.
import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'

export const LOCKING_TOURNAMENT_STATUSES = ['open', 'registration_closed', 'ongoing']

export async function findRosterLockTournaments(teamId) {
  if (!teamId) return []
  const tournaments = await Tournament.find({
    status: { $in: LOCKING_TOURNAMENT_STATUSES },
    registrations: { $elemMatch: { team: teamId, status: 'checked_in' } },
  }).select('title').lean()
  return tournaments.map(t => ({ id: String(t._id), title: t.title || 'Torneo' }))
}

export function rosterLockedError(tournaments) {
  const names = tournaments.map(t => t.title).join(', ')
  return Object.assign(
    new Error(`El roster esta congelado: el equipo ya hizo check-in en ${names}. No se pueden sumar, quitar ni cambiar jugadores hasta que el torneo termine.`),
    { status: 409, payload: { code: 'ROSTER_LOCKED', tournaments } },
  )
}

export async function assertRosterNotLocked(teamId) {
  const tournaments = await findRosterLockTournaments(teamId)
  if (tournaments.length) throw rosterLockedError(tournaments)
}

function slotIdentity(slot) {
  if (!slot || typeof slot !== 'object') return ''
  const nick = String(slot.nick || '').trim().toLowerCase()
  const gameId = String(slot.gameId || '').trim().toLowerCase()
  return `${nick}|${gameId}`
}

// Cambia "quien" juega si aparece/desaparece un puesto ocupado, o si un
// puesto pasa a tener otro nick/gameId. Bio, avatar, redes, rango, etc. no.
export function rosterOccupantsChanged(prevSlots, nextSlots) {
  const prev = prevSlots && typeof prevSlots === 'object' ? prevSlots : {}
  const next = nextSlots && typeof nextSlots === 'object' ? nextSlots : {}
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  for (const key of keys) {
    if (slotIdentity(prev[key]) !== slotIdentity(next[key])) return true
  }
  return false
}

// Lista oficial de quien juega ese torneo (disputas, stats/PlayerMatch).
export async function buildRosterSnapshot(teamId) {
  const team = await Team.findById(teamId).select('leader members rosterSlots').lean()
  if (!team) return []
  const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const snapshot = Object.entries(slots)
    .filter(([, slot]) => slot && typeof slot === 'object' && (slot.nick || slot.gameId || slot.userId))
    .map(([key, slot]) => ({
      userId: mongoose.isValidObjectId(slot.userId) ? String(slot.userId) : null,
      nick: String(slot.nick || ''),
      gameId: String(slot.gameId || ''),
      slot: key,
    }))
  if (snapshot.length) return snapshot

  // Equipo sin rosterSlots: al menos dejar constancia de las cuentas miembro.
  const ids = [team.leader, ...(team.members || [])].map(String)
  const users = await User.find({ _id: { $in: [...new Set(ids)] } }).select('nick gamerProfile').lean()
  return users.map(u => ({ userId: String(u._id), nick: u.nick || '', gameId: u.gamerProfile?.gameId || '', slot: '' }))
}

// Guarda el snapshot solo si la inscripcion todavia no tiene uno: el primer
// check-in es el que cuenta (re-marcar check-in no reescribe la lista).
export async function saveRosterSnapshot(tournamentId, teamId) {
  if (!tournamentId || !teamId) return
  const snapshot = await buildRosterSnapshot(teamId)
  await Tournament.updateOne(
    {
      _id: tournamentId,
      registrations: { $elemMatch: { team: teamId, status: 'checked_in', 'rosterSnapshot.0': { $exists: false } } },
    },
    { $set: { 'registrations.$.rosterSnapshot': snapshot, 'registrations.$.rosterSnapshotAt': new Date() } },
  )
}
