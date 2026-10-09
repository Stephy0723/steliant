// Helpers compartidos por los jobs de torneo (checkinClose, matchReminders):
// pasar de un nombre del bracket a su inscripcion y avisar a sus cuentas.
import { Team } from '../models/Team.js'
import { sendNotif } from './notifications.service.js'

export const teamIdOf = (reg) => String(reg?.team?._id || reg?.team || '')

export function tournamentLink(tournament) {
  return `/torneos/${tournament.publicId || tournament._id}`
}

// Mismo nombre que le da resolveBracketTeams a cada inscripcion (incluido el
// sufijo " (2)" de nombres repetidos), para saber a que equipo le toca quien.
// Requiere registrations.team poblado con 'name tag' si falta teamMeta.
export function registrationsByBracketName(registrations) {
  const seen = {}
  const map = new Map()
  for (const reg of registrations) {
    const base = (reg.teamMeta?.name || reg.team?.name || reg.teamMeta?.tag || reg.team?.tag || 'Equipo').trim()
    seen[base] = (seen[base] || 0) + 1
    map.set(seen[base] > 1 ? `${base} (${seen[base]})` : base, reg)
  }
  return map
}

export async function teamUserIds(teamId) {
  if (!teamId) return []
  const team = await Team.findById(teamId).select('leader members').lean()
  if (!team) return []
  return [...new Set([team.leader, ...(team.members || [])].filter(Boolean).map(String))]
}

export async function notifyUsers(userIds, payload) {
  await Promise.all([...new Set(userIds.map(String))].map(id => sendNotif(id, payload).catch(() => {})))
}

export async function notifyTeam(teamId, payload) {
  await notifyUsers(await teamUserIds(teamId), payload)
}
