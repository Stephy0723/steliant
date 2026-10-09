// Emisores de las tarjetas de accion de partida (#notificaciones-tarjetas-accion)
// que dependen del flujo del bot de Discord: check-in abierto, resultado
// reportado por el rival y fallo al sincronizar Discord. El `meta` sigue la
// referencia de frontend/src/data/notificationPreviews.js; si un dato no se
// conoce se omite (la tarjeta no pinta esa fila).
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { tournamentLink, teamUserIds, notifyUsers } from './tournamentTeams.service.js'
import { reportEvidence } from './discordReports.service.js'

const MATCH_PATH = '/mi-equipo/enfrentamiento'
const norm = (s) => String(s || '').trim().toLowerCase()

export function discordChannelUrl(guildId, channelId) {
  return guildId && channelId ? `https://discord.com/channels/${guildId}/${channelId}` : ''
}

/** Se abrio el check-in de un equipo (primer POST /bots/matches/checkin). */
export async function notifyCheckinOpen(doc) {
  const tournament = await Tournament.findById(doc.tournament).select('title publicId').lean()
  if (!tournament) return
  const team = await Team.findById(doc.team).select('name').lean()
  const voiceChannelUrl = discordChannelUrl(doc.guildId, doc.voiceChannelId)
  await notifyUsers(await teamUserIds(doc.team), {
    type: 'tournament_checkin_open',
    title: 'Check-in abierto',
    message: `El check-in de ${team?.name || doc.teamNameSnapshot || 'tu equipo'} en ${tournament.title} está abierto. Entren a la sala de voz antes de que cierre.`,
    link: MATCH_PATH,
    meta: {
      tournamentId: String(tournament._id),
      tournamentPublicId: tournament.publicId || '',
      tournamentTitle: tournament.title,
      teamName: team?.name || doc.teamNameSnapshot || '',
      ...(doc.channelName ? { voiceChannelName: doc.channelName } : {}),
      ...(voiceChannelUrl ? { voiceChannelUrl } : {}),
      ...(doc.checkinDeadlineAt ? { checkinDeadlineAt: new Date(doc.checkinDeadlineAt).toISOString() } : {}),
      matchPath: MATCH_PATH,
    },
  })
}

const RESULT_FOR_RIVAL = { win: 'lose', lose: 'win', draw: 'draw' }

/**
 * Un capitan reporto con /report y el rival todavia no: avisar al capitan
 * rival para que reporte el suyo (solo cuando los dos coinciden avanza la llave).
 */
export async function notifyResultReported(doc, sync) {
  if (sync?.status !== 'awaiting_rival' || !doc.rivalName || !RESULT_FOR_RIVAL[doc.result]) return
  const tournament = await Tournament.findById(doc.tournament)
    .select('title publicId registrations.team')
    .populate('registrations.team', 'name leader')
    .lean()
  if (!tournament) return
  const rival = (tournament.registrations || []).map(r => r.team).find(t => t && norm(t.name) === norm(doc.rivalName))
  if (!rival?.leader) return
  const reporter = await Team.findById(doc.team).select('name').lean()
  const reporterTeamName = reporter?.name || doc.teamNameSnapshot || 'Tu rival'
  const verb = { win: 'ganó', lose: 'perdió', draw: 'empató' }[doc.result]
  const evidenceUrls = reportEvidence(doc.report).map(e => e.url)
  await notifyUsers([rival.leader], {
    type: 'tournament_result_reported',
    title: 'Resultado reportado',
    message: `${reporterTeamName} reportó que ${verb} contra ${rival.name} en ${tournament.title}. Reporta tu resultado con /report en Discord para confirmarlo.`,
    link: MATCH_PATH,
    meta: {
      tournamentId: String(tournament._id),
      tournamentPublicId: tournament.publicId || '',
      tournamentTitle: tournament.title,
      teamName: rival.name,
      reporterTeamName,
      // Resultado desde el punto de vista de quien recibe el aviso.
      reportedResult: RESULT_FOR_RIVAL[doc.result],
      evidenceCount: evidenceUrls.length,
      ...(evidenceUrls.length ? { evidenceUrls } : {}),
      matchPath: MATCH_PATH,
    },
  })
}

// Texto de error del bot -> motivo que entiende la tarjeta (DISCORD_FAILURE_REASONS).
export function discordFailureReason(message) {
  const text = String(message || '')
  if (/missing permissions|50013|permis/i.test(text)) return 'missing_permissions'
  if (/unknown member|10007|not in guild|no est[aá] en el servidor|no es miembro/i.test(text)) return 'not_in_guild'
  if (/token|401|invalid_grant|expir|venci/i.test(text)) return 'token_expired'
  if (/vincul|not linked|linked|sin discord|discordId/i.test(text)) return 'not_linked'
  return ''
}

/** Fallo la sala/roles de Discord de un equipo inscrito: avisar al lider. */
export async function notifyDiscordSyncFailed({ tournamentId, teamId, message }) {
  const [tournament, team] = await Promise.all([
    Tournament.findById(tournamentId).select('title publicId').lean(),
    Team.findById(teamId).select('name leader').lean(),
  ])
  if (!team?.leader) return
  const reason = discordFailureReason(message)
  await notifyUsers([team.leader], {
    type: 'discord_sync_failed',
    title: 'Error de Discord',
    message: `No pudimos preparar la sala y los roles de Discord de ${team.name}${tournament ? ` en ${tournament.title}` : ''}.`,
    link: tournament ? tournamentLink(tournament) : '/ajustes',
    meta: {
      ...(reason ? { reason } : {}),
      errorDetail: String(message || '').slice(0, 300),
      teamName: team.name,
      ...(tournament ? { tournamentId: String(tournament._id), tournamentTitle: tournament.title } : {}),
    },
  })
}
