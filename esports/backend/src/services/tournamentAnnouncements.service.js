// Comunicado de cambios confirmados (pestana Competencia del panel y las que
// reusen el mismo `changeNotice`): avisa a los equipos inscritos y al staff,
// lo publica en el canal de noticias del torneo en Discord y lo guarda en
// Tournament.announcements para el historial del panel del equipo.
import { enqueueIntegrationEvent } from './integrationEvents.service.js'
import { notifyUsers, teamIdOf, teamUserIds, tournamentLink } from './tournamentTeams.service.js'

const MAX_ANNOUNCEMENTS = 50
const MAX_CHANGES = 30

const clip = (value, max) => String(value ?? '').trim().slice(0, max)

/** Normaliza lo que manda el front; null si no sirve (el cambio se guarda igual). */
export function sanitizeChangeNotice(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const changes = (Array.isArray(raw.changes) ? raw.changes : [])
    .slice(0, MAX_CHANGES)
    .filter(change => change && typeof change === 'object')
    .map(change => ({ label: clip(change.label, 140), before: clip(change.before, 140), after: clip(change.after, 140) }))
    .filter(change => change.label)
  const notice = {
    section: clip(raw.section, 40),
    sectionLabel: clip(raw.sectionLabel, 60),
    title: clip(raw.title, 140),
    message: clip(raw.message, 500),
    changes,
  }
  if (!notice.title || (!notice.changes.length && !notice.message)) return null
  return notice
}

async function recipientsFor(tournament, actorId) {
  const teamIds = [...new Set((tournament.registrations || [])
    .filter(reg => reg.status !== 'withdrawn')
    .map(teamIdOf)
    .filter(Boolean))]
  const players = (await Promise.all(teamIds.map(teamUserIds))).flat()
  const staff = (tournament.staffMembers || [])
    .filter(member => member.status === 'accepted' && member.user)
    .map(member => String(member.user?._id || member.user))
  return [...new Set([...players, ...staff])].filter(id => id !== String(actorId))
}

const changeLine = change => `${change.label}: ${change.before} → ${change.after}`

/**
 * Envia el comunicado. `tournament` ya guardado. Devuelve el resumen que lee
 * el front: { recipients, discord: 'queued' | 'skipped' | 'failed' }.
 */
export async function sendChangeNotice(tournament, actor, notice) {
  const recipients = await recipientsFor(tournament, actor?._id)
  const actorNick = actor?.nick || 'El organizador'
  const message = notice.message || notice.changes.slice(0, 3).map(changeLine).join(' · ')

  await notifyUsers(recipients, {
    type: 'tournament_changed',
    title: notice.title,
    message,
    link: tournamentLink(tournament),
    meta: {
      tournamentId: String(tournament._id),
      publicId: tournament.publicId || '',
      tournamentTitle: tournament.title,
      game: tournament.game || '',
      section: notice.section,
      sectionLabel: notice.sectionLabel,
      changes: notice.changes,
      note: notice.message,
      actorNick,
    },
  })

  let discord = 'skipped'
  if (tournament.discordEnabled && tournament.discordProvision?.channels?.newsId) {
    try {
      await enqueueIntegrationEvent({
        type: 'discord.tournament.changed',
        entityType: 'tournament',
        entityId: tournament._id,
        payload: {
          tournamentId: tournament._id,
          title: notice.title,
          sectionLabel: notice.sectionLabel,
          message: notice.message,
          changes: notice.changes,
        },
        dedupe: false,
      })
      discord = 'queued'
    } catch (error) {
      console.error('[changeNotice] No se pudo encolar el aviso de Discord:', error.message)
      discord = 'failed'
    }
  }

  return { recipients: recipients.length, discord }
}

/** Agrega el comunicado al historial del torneo (sin guardar; lo hace quien llama). */
export function pushAnnouncement(tournament, actor, notice) {
  const list = Array.isArray(tournament.announcements) ? tournament.announcements : []
  list.push({ at: new Date(), by: actor?._id || null, byNick: actor?.nick || '', ...notice })
  tournament.announcements = list.slice(-MAX_ANNOUNCEMENTS)
}

/** Resumen legible para el registro de actividad del staff. */
export function announcementSummary(notice) {
  const lines = notice.changes.slice(0, 3).map(changeLine)
  const more = notice.changes.length > 3 ? ` (+${notice.changes.length - 3})` : ''
  return `Comunicado ${notice.sectionLabel || notice.section || ''}: ${lines.join(', ') || notice.title}${more}`.replace(/\s+:/, ':')
}
