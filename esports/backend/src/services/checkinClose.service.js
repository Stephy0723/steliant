import { Tournament } from '../models/Tournament.js'
import { sendNotif } from './notifications.service.js'
import { autoGenerateBracketIfReady } from './bracketSync.service.js'
import { buildSingleBracket } from '../../../shared/bracketEngine.mjs'
import { teamIdOf, tournamentLink, registrationsByBracketName, notifyTeam } from './tournamentTeams.service.js'

const CHECK_INTERVAL_MS = 2 * 60 * 1000 // cada 2 min, ver BACKEND-PENDIENTE.md #checkin-cierre-automatico
// Un torneo cuyo cierre paso hace mas de esto no se toca: son torneos viejos
// que quedaron en 'open' (o el servidor estuvo caido mucho tiempo), y
// descalificar/notificar ahora solo confundiria. Se loguean y se dejan al organizador.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

// Cierre = checkinDeadline + tolerancia. Solo torneos que el organizador
// configuro con hora limite: sin checkinDeadline no hay cierre automatico
// (muchos organizadores no usan check-in y armar el bracket a mano).
export function checkinCloseAt(tournament) {
  if (!tournament?.checkinDeadline) return null
  const toleranceMins = Number(tournament.checkinConfig?.toleranceMins ?? 10)
  return new Date(new Date(tournament.checkinDeadline).getTime() + toleranceMins * 60 * 1000)
}

function bracketAlreadyBuilt(doc = {}) {
  return doc.status === 'running' || doc.status === 'finished' ||
    (doc.results && Object.keys(doc.results).length > 0) ||
    (Array.isArray(doc.teams) && doc.teams.length > 0)
}

// Rival de primera ronda por equipo. Solo eliminacion (simple/doble): en
// round robin/suizo/grupos no hay "un" rival, ahi se avisa sin nombre.
function firstRoundOpponents(bracketDoc) {
  const format = bracketDoc?.format
  if (!['single', 'double'].includes(format)) return new Map()
  const { rounds } = buildSingleBracket(bracketDoc.teams || [], {}, format === 'double' ? 'wb' : 'se')
  const map = new Map()
  for (const m of rounds[0]?.matches || []) {
    map.set(m.a, m.b)
    map.set(m.b, m.a)
  }
  return map
}

async function closeTournamentCheckin(tournament, now) {
  const link = tournamentLink(tournament)
  const baseMeta = { tournamentId: String(tournament._id), tournamentTitle: tournament.title, tournamentPath: link }
  const regs = tournament.registrations || []
  const pending = regs.filter(r => r.status === 'registered')
  const checkedIn = regs.filter(r => r.status === 'checked_in')

  // El organizador ya armo/edito el bracket a mano: no tocar nada.
  if (bracketAlreadyBuilt(tournament.bracketDoc)) {
    tournament.checkinClosedAt = now
    await tournament.save()
    return { action: 'skipped_bracket_built' }
  }

  // Walkover apagado, o nadie hizo check-in (lo mas probable es que el
  // organizador no este usando check-in): no descalificar a nadie en masa,
  // solo avisarle para que decida desde el panel.
  const autoWalkover = tournament.checkinConfig?.autoWalkover !== false
  if (!autoWalkover || checkedIn.length === 0) {
    tournament.checkinClosedAt = now
    await tournament.save()
    if (pending.length) {
      await sendNotif(tournament.organizer, {
        type: 'tournament_checkin_closed',
        title: 'Terminó el check-in',
        message: checkedIn.length === 0
          ? `Ningún equipo hizo check-in en ${tournament.title}. No se descalificó a nadie: revisa el check-in desde el panel.`
          : `${pending.length} equipo(s) no hicieron check-in en ${tournament.title}. El walkover automático está apagado: decide desde el panel.`,
        link,
        meta: { ...baseMeta, checkedIn: checkedIn.length, missing: pending.length, autoWalkover },
      }).catch(() => {})
    }
    return { action: 'organizer_notified' }
  }

  for (const reg of pending) {
    reg.status = 'disqualified'
    reg.statusReason = 'no_checkin'
  }
  tournament.checkin = {
    aTiempo: regs.filter(r => r.status === 'checked_in').length,
    tarde: Number(tournament.checkin?.tarde || 0),
    noShow: regs.filter(r => r.status === 'disqualified').length,
  }
  tournament.checkinClosedAt = now
  await tournament.save()

  await Promise.all(pending.map(reg => notifyTeam(teamIdOf(reg), {
    type: 'tournament_checkin_missed',
    title: 'Quedaste fuera del torneo',
    message: `Tu equipo no hizo check-in a tiempo en ${tournament.title} y quedó descalificado.`,
    link,
    meta: { ...baseMeta, teamId: teamIdOf(reg), reason: 'no_checkin' },
  })))

  // Con los que quedan (todos con check-in) el bracket ya se puede armar.
  const bracket = checkedIn.length >= 2
    ? await autoGenerateBracketIfReady(tournament._id).catch((error) => {
      console.error('[checkin-close] Auto-generacion de bracket fallo:', error.message)
      return null
    })
    : null

  if (bracket) {
    const opponents = firstRoundOpponents(bracket)
    const byName = registrationsByBracketName(checkedIn)
    await Promise.all([...byName.entries()].map(([name, reg]) => {
      const rival = opponents.get(name)
      const message = !rival
        ? `El bracket de ${tournament.title} ya está listo. Revisa tu primera partida.`
        : rival === 'BYE'
          ? `El bracket de ${tournament.title} ya está listo: pasas directo a la siguiente ronda.`
          : `El bracket de ${tournament.title} ya está listo. Tu rival en la primera ronda es ${rival}.`
      return notifyTeam(teamIdOf(reg), {
        type: 'tournament_bracket_ready',
        title: 'Bracket listo',
        message,
        link,
        meta: { ...baseMeta, teamId: teamIdOf(reg), teamName: name, opponent: rival || '', scheduledAt: tournament.date || null },
      })
    }))
  }

  await sendNotif(tournament.organizer, {
    type: 'tournament_checkin_closed',
    title: 'Check-in cerrado',
    message: bracket
      ? `Se cerró el check-in de ${tournament.title}: ${checkedIn.length} equipos juegan, ${pending.length} descalificados. El bracket se armó solo.`
      : `Se cerró el check-in de ${tournament.title}: ${checkedIn.length} equipo(s) con check-in, ${pending.length} descalificados. No hay suficientes equipos para armar el bracket.`,
    link,
    meta: { ...baseMeta, checkedIn: checkedIn.length, missing: pending.length, bracketGenerated: Boolean(bracket) },
  }).catch(() => {})

  return { action: bracket ? 'closed_bracket_generated' : 'closed_no_bracket', disqualified: pending.length }
}

export async function closeDueCheckins(now = new Date()) {
  // Filtro grueso en Mongo (la tolerancia maxima es 60 min); el cierre
  // exacto por torneo se calcula abajo con su propia tolerancia.
  const candidates = await Tournament.find({
    status: { $in: ['open', 'registration_closed'] },
    checkinClosedAt: null,
    checkinDeadline: { $ne: null, $lte: now },
  }).populate('registrations.team', 'name tag')

  const results = []
  for (const tournament of candidates) {
    const closeAt = checkinCloseAt(tournament)
    if (!closeAt || closeAt > now) continue
    if (now - closeAt > STALE_AFTER_MS) {
      // Se marca como procesado sin tocar inscripciones, para no volver a
      // consultarlo (ni loguearlo) cada 2 minutos para siempre.
      console.warn('[checkin-close] cierre vencido hace mas de 24h, se marca sin cambios', String(tournament._id))
      await Tournament.updateOne({ _id: tournament._id }, { $set: { checkinClosedAt: now } })
      continue
    }
    try {
      results.push({ id: String(tournament._id), ...(await closeTournamentCheckin(tournament, now)) })
    } catch (err) {
      console.error('[checkin-close] failed for tournament', String(tournament._id), err.message)
    }
  }
  return results
}

let intervalHandle = null

export function startCheckinCloseJob() {
  if (intervalHandle) return
  intervalHandle = setInterval(() => { closeDueCheckins().catch(err => console.error('[checkin-close] tick failed:', err.message)) }, CHECK_INTERVAL_MS)
  intervalHandle.unref?.()
  closeDueCheckins().catch(err => console.error('[checkin-close] initial tick failed:', err.message))
}

export function stopCheckinCloseJob() {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
}
