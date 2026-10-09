import { IntegrationEvent } from '../models/IntegrationEvent.js'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { memberTeamRole } from './team.controller.js'
import { enqueueIntegrationEvent, logDiscordProvision } from '../services/integrationEvents.service.js'
import { notifyDiscordSyncFailed } from '../services/matchNotifications.service.js'

const BOT_LOCK_TTL_MS = 2 * 60 * 1000
// Tope de reintentos automaticos -- pasado esto, el evento se queda en
// 'failed' esperando intervencion humana (boton "Reintentar" o
// adminRetryIntegrationEvent) en vez de reintentar para siempre un error
// permanente (ej. GUILD_ID mal configurado).
const MAX_AUTO_RETRY_ATTEMPTS = 8

function retryDate(attempts) {
  const delayMs = Math.min(10 * 60 * 1000, Math.max(10_000, attempts * 30_000))
  return new Date(Date.now() + delayMs)
}

export async function getPendingIntegrationEvents(req, res, next) {
  try {
    const limit = Math.min(10, Math.max(1, Number(req.query.limit || 5)))
    const now = new Date()
    const staleLock = new Date(Date.now() - BOT_LOCK_TTL_MS)

    const events = await IntegrationEvent.find({
      $or: [
        { status: 'pending', nextRunAt: { $lte: now } },
        { status: 'processing', lockedAt: { $lte: staleLock } },
        // 'failed' con nextRunAt vencido y todavia dentro del tope de
        // reintentos automaticos -- antes esto nunca se consultaba, asi que
        // retryDate()/nextRunAt quedaban como codigo muerto y un evento
        // fallido no se recuperaba solo (habia que tocar "Reintentar").
        { status: 'failed', nextRunAt: { $lte: now }, attempts: { $lt: MAX_AUTO_RETRY_ATTEMPTS } },
      ],
    }).sort({ createdAt: 1 }).limit(limit).lean()

    res.json({ events })
  } catch (err) { next(err) }
}

export async function startIntegrationEvent(req, res, next) {
  try {
    const workerId = String(req.body?.workerId || 'discord-bot').slice(0, 120)
    const event = await IntegrationEvent.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['pending', 'processing', 'failed'] } },
      {
        $set: { status: 'processing', lockedAt: new Date(), lockedBy: workerId, lastError: '' },
        $inc: { attempts: 1 },
      },
      { new: true },
    )
    if (!event) return res.status(404).json({ message: 'Evento no disponible.' })
    res.json({ event })
  } catch (err) { next(err) }
}

export async function completeIntegrationEvent(req, res, next) {
  try {
    const result = req.body?.result || {}
    const event = await IntegrationEvent.findById(req.params.id)
    if (!event) return res.status(404).json({ message: 'Evento no encontrado.' })

    event.status = 'done'
    event.result = result
    event.processedAt = new Date()
    event.lockedAt = null
    event.lockedBy = ''
    event.lastError = ''
    await event.save()

    if (event.type === 'discord.tournament.provision' && result.tournamentDiscord) {
      await Tournament.updateOne(
        { _id: event.entityId },
        {
          $set: {
            discordProvision: {
              ...result.tournamentDiscord,
              status: 'ready',
              provisionedAt: new Date(),
              lastSyncAt: new Date(),
              error: '',
            },
          },
        },
      )
    }

    // Si el bot logro crear el canal/rol pero el embed de bienvenida no
    // salio (welcomeSent: false), el evento sigue siendo un "exito" para
    // discordProvision.status (el equipo ya tiene su sala) pero el registro
    // que ve el organizador en la pestaña Mensajes debe decirlo distinto de
    // un exito silencioso -- si no, retryTeamDiscordProvision es la unica
    // forma de enterarse de que falta reenviar la bienvenida.
    const welcomeFailed = event.type === 'discord.team.provision'
      && result.teamDiscord
      && result.teamDiscord.welcomeSent === false

    // La sala de un equipo es por INSCRIPCION (Tournament.registrations),
    // no por equipo -- un equipo puede estar en varios torneos activos a
    // la vez, cada uno con su propia sala. tournamentId/registrationId
    // vienen en el payload desde que se encolo el evento (ver
    // tournament.controller.js: registerTeamForUser / retryTeamDiscordProvision).
    if (event.type === 'discord.team.provision' && result.teamDiscord) {
      const tournamentId = event.payload?.tournamentId
      const registrationId = event.payload?.registrationId
      if (tournamentId && registrationId) {
        const update = await Tournament.updateOne(
          { _id: tournamentId, 'registrations._id': registrationId },
          {
            $set: {
              'registrations.$.discordProvision': {
                ...result.teamDiscord,
                status: result.teamDiscord.status || 'ready',
                lastSyncAt: new Date(),
                error: '',
              },
            },
          },
        )
        if (!update.matchedCount && (result.teamDiscord.roleId || result.teamDiscord.categoryId)) {
          await enqueueIntegrationEvent({
            type: 'discord.team.deprovision',
            entityType: 'team',
            entityId: event.payload?.teamId || event.entityId,
            payload: {
              guildId: result.teamDiscord.guildId || event.payload?.guildId || '',
              roleId: result.teamDiscord.roleId || '',
              categoryId: result.teamDiscord.categoryId || '',
              textChannelId: result.teamDiscord.textChannelId || '',
              bracketChannelId: result.teamDiscord.bracketChannelId || '',
              voiceChannelId: result.teamDiscord.voiceChannelId || '',
              teamName: result.teamDiscord.teamName || '',
            },
            dedupe: false,
          })
          await logDiscordProvision({
            event: event._id,
            tournament: tournamentId,
            team: event.payload?.teamId || event.entityId,
            action: 'discord.team.deprovision',
            status: 'warning',
            message: 'La sala se creo despues de cancelar la inscripcion; limpieza automatica encolada.',
          })
        }
      }
    }

    await logDiscordProvision({
      event: event._id,
      tournament: event.payload?.tournamentId || (event.entityType === 'tournament' ? event.entityId : null),
      team: event.payload?.teamId || (event.entityType === 'team' ? event.entityId : null),
      action: event.type,
      status: welcomeFailed ? 'warning' : 'success',
      message: welcomeFailed
        ? 'La sala del equipo se creo, pero el mensaje de bienvenida no se pudo publicar. Reintenta desde la pestaña Discord.'
        : 'Evento procesado por el bot.',
    })

    res.json({ ok: true, event })
  } catch (err) { next(err) }
}

// Vuelca lo que SÍ se llegó a crear en Discord antes de que algo fallara a
// mitad de camino (roles/canales ya creados) encima del status/error/fecha
// -- sin esto, un fallo parcial perdía esos IDs y el proximo intento volvia
// a crear TODO de cero, duplicando lo que ya existia en Discord.
function partialSetFields(prefix, message, partial) {
  const fields = {
    [`${prefix}.status`]: 'failed',
    [`${prefix}.error`]: message,
    [`${prefix}.lastSyncAt`]: new Date(),
  }
  if (partial && typeof partial === 'object') {
    for (const [key, value] of Object.entries(partial)) {
      if (key === 'status' || key === 'error' || value === undefined || value === null) continue
      fields[`${prefix}.${key}`] = value
    }
  }
  return fields
}

export async function failIntegrationEvent(req, res, next) {
  try {
    const message = String(req.body?.message || 'Error procesando evento.').slice(0, 2000)
    const partial = req.body?.partial
    const event = await IntegrationEvent.findById(req.params.id)
    if (!event) return res.status(404).json({ message: 'Evento no encontrado.' })

    event.status = 'failed'
    event.lockedAt = null
    event.lockedBy = ''
    event.lastError = message
    event.nextRunAt = retryDate(event.attempts || 1)
    await event.save()

    if (event.type === 'discord.tournament.provision') {
      await Tournament.updateOne(
        { _id: event.entityId },
        { $set: partialSetFields('discordProvision', message, partial) },
      )
    }

    if (event.type === 'discord.team.provision') {
      const tournamentId = event.payload?.tournamentId
      const registrationId = event.payload?.registrationId
      if (tournamentId && registrationId) {
        // El evento se reintenta solo: avisar al lider solo la primera vez que
        // la sala de su equipo pasa a 'failed', no en cada reintento.
        const before = await Tournament.findOne(
          { _id: tournamentId, 'registrations._id': registrationId },
          { 'registrations.$': 1 },
        ).lean()
        const wasFailed = before?.registrations?.[0]?.discordProvision?.status === 'failed'
        await Tournament.updateOne(
          { _id: tournamentId, 'registrations._id': registrationId },
          { $set: partialSetFields('registrations.$.discordProvision', message, partial) },
        )
        const teamId = event.payload?.teamId || before?.registrations?.[0]?.team
        if (!wasFailed && teamId) {
          await notifyDiscordSyncFailed({ tournamentId, teamId, message }).catch((error) => {
            console.error('[integration] No se pudo avisar el fallo de Discord:', error.message)
          })
        }
      }
    }

    await logDiscordProvision({
      event: event._id,
      tournament: event.payload?.tournamentId || (event.entityType === 'tournament' ? event.entityId : null),
      team: event.payload?.teamId || (event.entityType === 'team' ? event.entityId : null),
      action: event.type,
      status: 'error',
      message,
    })

    res.json({ ok: true, event })
  } catch (err) { next(err) }
}

export async function getTournamentProvisionState(req, res, next) {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('organizer', 'nick discord roleProfiles.organizer.organizerCode')
      .populate('staffMembers.user', 'nick discord')
      .lean()
    if (!tournament) return res.status(404).json({ message: 'Torneo no encontrado.' })
    res.json({ tournament })
  } catch (err) { next(err) }
}

export async function getTeamProvisionState(req, res, next) {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leader', 'nick playerCode discord')
      .populate('members', 'nick playerCode discord')
      .lean()
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado.' })
    const tournament = req.query.tournamentId
      ? await Tournament.findById(req.query.tournamentId).select('title publicId discordProvision registrations').lean()
      : null
    // La sala de este equipo en ESTE torneo especifico -- no team.discordProvision
    // (removido: un equipo puede estar en varios torneos activos a la vez).
    const registration = tournament
      ? (tournament.registrations || []).find(r => String(r.team) === String(team._id))
      : null
    res.json({
      team,
      tournament: tournament ? { title: tournament.title, publicId: tournament.publicId, discordProvision: tournament.discordProvision } : null,
      registrationId: registration?._id || null,
      teamDiscordProvision: registration?.discordProvision || null,
      // Coach/analista/manager: el bot les da el rol de staff de equipo, no el de jugador.
      staffUserIds: [team.leader, ...(team.members || [])]
        .map(user => String(user?._id || user || ''))
        .filter(id => id && memberTeamRole(team, id) !== 'player'),
    })
  } catch (err) { next(err) }
}

export async function completeTournamentProvisionDirect(req, res, next) {
  try {
    const result = req.body?.result || {}
    if (!result.tournamentDiscord) return res.status(400).json({ message: 'Falta tournamentDiscord.' })

    const updated = await Tournament.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          discordProvision: {
            ...result.tournamentDiscord,
            status: 'ready',
            provisionedAt: new Date(),
            lastSyncAt: new Date(),
            error: '',
          },
        },
      },
      { new: true },
    )
    if (!updated) return res.status(404).json({ message: 'Torneo no encontrado.' })

    await logDiscordProvision({
      tournament: updated._id,
      action: 'discord.tournament.provision',
      status: 'success',
      message: 'Torneo provisionado via CRM.',
    })

    res.json({ ok: true, tournament: updated })
  } catch (err) { next(err) }
}

export async function failTournamentProvisionDirect(req, res, next) {
  try {
    const message = String(req.body?.message || 'Error provisionando torneo via CRM.').slice(0, 2000)
    const partial = req.body?.partial
    const updated = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $set: partialSetFields('discordProvision', message, partial) },
      { new: true },
    )
    if (!updated) return res.status(404).json({ message: 'Torneo no encontrado.' })

    await logDiscordProvision({
      tournament: updated._id,
      action: 'discord.tournament.provision',
      status: 'error',
      message,
    })

    res.json({ ok: true, tournament: updated })
  } catch (err) { next(err) }
}

export async function adminListIntegrationEvents(req, res, next) {
  try {
    const status = String(req.query.status || '').trim()
    const type = String(req.query.type || '').trim()
    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (type) filter.type = type

    const events = await IntegrationEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Math.max(1, Number(req.query.limit || 50))))
      .lean()
    res.json({ events })
  } catch (err) { next(err) }
}

export async function adminRetryIntegrationEvent(req, res, next) {
  try {
    const event = await IntegrationEvent.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'pending',
          nextRunAt: new Date(),
          lockedAt: null,
          lockedBy: '',
          lastError: '',
        },
      },
      { new: true },
    )
    if (!event) return res.status(404).json({ message: 'Evento no encontrado.' })
    res.json({ event })
  } catch (err) { next(err) }
}
