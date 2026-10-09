import { Tournament } from '../models/Tournament.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { Infraction } from '../models/Infraction.js'
import { resolveMatchTeams } from './matchStats.service.js'
import { notifyUsers } from './tournamentTeams.service.js'
import { enqueueIntegrationEvent } from './integrationEvents.service.js'
import { REPORT_DEADLINE, reportScreenshotLabel } from '../../../shared/reportScreenshots.mjs'

// Plazo de capturas de cada partida (spec-lector-resultados, sección 5).
// Agrupa los /report por bracketMatchId + gameNumber: cuando faltan
// REPORT_DEADLINE.reminderMinutes avisa a quien le falta algo (web y canal
// del equipo en Discord); al vencer registra la falta y avisa al
// organizador. La sanción no es automática.

const idOf = v => String(v?._id || v || '')
const MATCH_PATH = '/mi-equipo/enfrentamiento'
const listLabels = keys => keys.map(reportScreenshotLabel).join(', ')
let onClosedHooks = []

/** Lo usa la lectura automática para evaluar la partida al cerrar el plazo. */
export function onReportDeadlineClosed(hook) { onClosedHooks.push(hook) }

// Lado pendiente de cada equipo de la partida: sin /report o con capturas faltantes.
function sideStatus(teams, group) {
  return teams.map(team => {
    const docs = group.filter(d => idOf(d.team) === idOf(team._id))
    const last = docs[docs.length - 1]
    return { team, doc: last || null, reported: Boolean(last), missing: last?.report?.missing || [] }
  })
}

async function discordNotice(tournament, teamId, { title, description }) {
  if (!tournament.discordEnabled) return
  const reg = (tournament.registrations || []).find(r => idOf(r.team) === idOf(teamId))
  const channelId = reg?.discordProvision?.textChannelId
  if (!channelId) return
  await enqueueIntegrationEvent({
    type: 'discord.match.notice', entityType: 'tournament', entityId: tournament._id, dedupe: false,
    payload: { tournamentId: String(tournament._id), channelId, title, description, tone: 'warning' },
  })
}

async function remind(tournament, match, gameNumber, sides, deadline) {
  const at = deadline.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  for (const side of sides) {
    const description = side.reported
      ? `Te falta: ${listLabels(side.missing)}. Usa /report solo con esa captura antes de las ${at}.`
      : `Tu equipo no ha reportado la partida ${gameNumber} contra ${side.rivalName}. Usa /report con el resultado y las capturas antes de las ${at}.`
    await notifyUsers([idOf(side.team.leader)], {
      type: 'tournament_report_reminder', title: `Faltan ${REPORT_DEADLINE.reminderMinutes} minutos para reportar`,
      message: `${tournament.title}: ${description}`.slice(0, 400), link: MATCH_PATH,
      meta: { tournamentId: idOf(tournament._id), matchId: match.id, gameNumber, deadline: deadline.toISOString() },
    })
    await discordNotice(tournament, side.team._id, { title: `⏰ Faltan ${REPORT_DEADLINE.reminderMinutes} minutos`, description })
  }
}

async function close(tournament, match, gameNumber, sides) {
  const late = []
  for (const side of sides) {
    const type = side.reported ? 'missing_screenshots' : 'no_report'
    const detail = side.reported ? `Capturas incompletas: faltó ${listLabels(side.missing)}.` : 'No envió /report dentro del plazo.'
    try {
      await Infraction.create({ tournament: tournament._id, team: side.team._id, bracketMatchId: match.id, gameNumber, type, detail })
    } catch (error) { if (error.code !== 11000) throw error }
    late.push(`${side.team.bracketName}: ${detail}`)
    await notifyUsers([idOf(side.team.leader)], {
      type: 'tournament_report_late', title: 'Venció el plazo de reporte',
      message: `${tournament.title}, partida ${gameNumber}: ${detail} Quedó registrado como falta; la organización decide si hay sanción.`,
      link: MATCH_PATH, meta: { tournamentId: idOf(tournament._id), matchId: match.id, gameNumber },
    })
  }
  if (late.length && tournament.organizer) {
    await notifyUsers([idOf(tournament.organizer)], {
      type: 'tournament_result_review', title: 'Reporte incompleto',
      message: `${tournament.title} · ${match.a} vs ${match.b}, partida ${gameNumber}. ${late.join(' ')}`.slice(0, 400),
      link: `/organizador/torneo/${tournament.publicId || tournament._id}/gestionar/bracket`,
      meta: { tournamentId: idOf(tournament._id), matchId: match.id, gameNumber },
    })
  }
}

export async function processReportDeadlines({ now = new Date(), limit = 300 } = {}) {
  const soon = new Date(now.getTime() + REPORT_DEADLINE.reminderMinutes * 60000)
  const docs = await TournamentMatch.find({
    bracketMatchId: { $nin: [null, ''] }, gameNumber: { $ne: null }, voidedAt: null,
    'report.deadlineClosedAt': null, 'report.deadlineAt': { $ne: null, $lte: soon },
  }).select('tournament team bracketMatchId gameNumber report').sort({ 'report.createdAt': 1 }).limit(limit).lean()

  const groups = new Map()
  for (const doc of docs) {
    const key = `${idOf(doc.tournament)}|${doc.bracketMatchId}|${doc.gameNumber}`
    groups.set(key, [...(groups.get(key) || []), doc])
  }

  const outcomes = []
  for (const [key, partial] of groups) {
    const [tournamentId, bracketMatchId, gameText] = key.split('|')
    const gameNumber = Number(gameText)
    // Todos los reportes de la partida, no solo los que trajo el filtro.
    const group = await TournamentMatch.find({ tournament: tournamentId, bracketMatchId, gameNumber, 'report.createdAt': { $ne: null }, voidedAt: null })
      .sort({ 'report.createdAt': 1 }).lean()
    const ids = group.map(d => d._id)
    const deadline = new Date(Math.min(...partial.map(d => new Date(d.report.deadlineAt).getTime())))
    const tournament = await Tournament.findById(tournamentId).lean()
    const resolved = tournament && await resolveMatchTeams(tournament, bracketMatchId).catch(() => null)
    if (!resolved || tournament.bracketDoc?.results?.[bracketMatchId]?.confirmed) {
      // El organizador ya decidió (o la partida dejó de existir): no hay plazo que cobrar.
      await TournamentMatch.updateMany({ _id: { $in: ids } }, { $set: { 'report.deadlineClosedAt': now } })
      outcomes.push({ key, status: 'skipped' })
      continue
    }
    const { match, teams } = resolved
    const sides = sideStatus(teams, group).map((s, i) => ({ ...s, rivalName: teams[1 - i].bracketName }))
    const pending = sides.filter(s => !s.reported || s.missing.length)

    if (now >= deadline) {
      // Se marca antes de avisar: si el job se repite, no duplica avisos.
      const claimed = await TournamentMatch.updateMany({ _id: { $in: ids }, 'report.deadlineClosedAt': null }, { $set: { 'report.deadlineClosedAt': now } })
      if (!claimed.modifiedCount) continue
      if (pending.length) await close(tournament, match, gameNumber, pending)
      for (const hook of onClosedHooks) await hook({ tournament, match, gameNumber, sides }).catch(error => console.error('[report-deadline] hook:', error.message))
      outcomes.push({ key, status: 'closed', pending: pending.length })
    } else if (group.every(d => !d.report.reminderSentAt)) {
      const claimed = await TournamentMatch.updateMany({ _id: { $in: ids }, 'report.reminderSentAt': null }, { $set: { 'report.reminderSentAt': now } })
      if (!claimed.modifiedCount) continue
      if (pending.length) await remind(tournament, match, gameNumber, pending, deadline)
      outcomes.push({ key, status: 'reminded', pending: pending.length })
    }
  }
  return outcomes
}

let timer = null, running = false
async function tick() {
  if (running) return
  running = true
  try { await processReportDeadlines() }
  catch (error) { console.error('[report-deadline]', error.message) }
  finally { running = false }
}
export function startReportDeadlineJob() {
  if (timer) return
  timer = setInterval(tick, 30000)
  timer.unref?.()
}
export async function stopReportDeadlineJob() {
  if (timer) clearInterval(timer)
  timer = null
  while (running) await new Promise(resolve => setTimeout(resolve, 50))
}
