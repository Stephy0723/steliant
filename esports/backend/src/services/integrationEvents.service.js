import { IntegrationEvent } from '../models/IntegrationEvent.js'
import { DiscordProvisionLog } from '../models/DiscordProvisionLog.js'

const ACTIVE_STATUSES = ['pending', 'processing']

export async function enqueueIntegrationEvent({ type, entityType, entityId, payload = {}, dedupe = true }) {
  if (!type || !entityType || !entityId) return null

  if (dedupe) {
    // Un mismo equipo puede tener un evento 'discord.team.provision' pendiente
    // por torneo a la vez -- sin filtrar por payload.tournamentId, inscribir
    // el mismo equipo en 2 torneos casi al mismo tiempo hacía que el segundo
    // evento devolviera el evento del PRIMER torneo (mismo entityId=teamId),
    // dejando la inscripcion del segundo torneo en 'pending' para siempre.
    const query = {
      type,
      entityType,
      entityId,
      status: { $in: ACTIVE_STATUSES },
    }
    if (payload?.tournamentId) query['payload.tournamentId'] = payload.tournamentId

    const existing = await IntegrationEvent.findOne(query).sort({ createdAt: -1 })

    if (existing) return existing
  }

  return IntegrationEvent.create({
    type,
    entityType,
    entityId,
    payload,
    status: 'pending',
    nextRunAt: new Date(),
  })
}

export async function logDiscordProvision({ event, tournament, team, action, status = 'info', message = '', discordObjectType = '', discordObjectId = '' }) {
  return DiscordProvisionLog.create({
    event,
    tournament,
    team,
    action,
    status,
    message,
    discordObjectType,
    discordObjectId,
  })
}
