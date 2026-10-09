// Aviso previo por partida (#avisos-por-partida): con el ritmo que configura
// el organizador (matchSchedule), cada partida de eliminacion simple tiene
// una hora = inicio del torneo + ronda x (duracion + descanso), salvo que el
// organizador le haya puesto una hora a mano (results[id].scheduledAt). Un
// job avisa a los dos equipos `reminderMins` antes, una sola vez por partida.
import { Tournament } from '../models/Tournament.js'
import { buildSingleBracket, normalizeFormat } from '../../../shared/bracketEngine.mjs'
import { tournamentLink, registrationsByBracketName, teamUserIds, notifyUsers } from './tournamentTeams.service.js'

const CHECK_INTERVAL_MS = 60 * 1000
// Partidas cuya hora paso hace mas de esto no se avisan (torneos viejos que
// quedaron en 'ongoing', o el servidor estuvo caido): avisar ahora confunde.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
const OUT = new Set(['withdrawn', 'rejected', 'disqualified', 'cancelled'])
const isRealTeam = (name) => Boolean(name) && name !== 'BYE' && name !== 'Por definir'

// Partidas de eliminacion simple con su hora. Otros formatos todavia no: no
// hay un "orden de ronda" unico que mapear a horas (queda en el pendiente).
export function scheduledMatches(tournament) {
  const doc = tournament.bracketDoc || {}
  const schedule = tournament.matchSchedule
  if (!schedule || (doc.format || normalizeFormat(tournament.format)) !== 'single') return []
  const teams = Array.isArray(doc.teams) ? doc.teams : []
  if (teams.length < 2) return []
  const results = doc.results || {}
  const start = tournament.date ? new Date(tournament.date).getTime() : NaN
  const stepMs = (Number(schedule.durationMins) + Number(schedule.breakMins)) * 60 * 1000

  const { rounds } = buildSingleBracket(teams, results, 'se')
  return rounds.flatMap((round, roundIdx) => round.matches.map((m) => {
    const manual = results[m.id]?.scheduledAt ? new Date(results[m.id].scheduledAt).getTime() : NaN
    const at = Number.isFinite(manual) ? manual : (Number.isFinite(start) ? start + roundIdx * stepMs : NaN)
    return { id: m.id, a: m.a, b: m.b, round: round.name, confirmed: Boolean(results[m.id]?.confirmed), scheduledAt: Number.isFinite(at) ? new Date(at) : null }
  }))
}

// Quien juega por ese equipo: la lista congelada en el check-in si existe
// (rosterLock.service.js), si no las cuentas actuales del equipo.
async function playersOf(reg) {
  const snapshotIds = (reg.rosterSnapshot || []).map(p => p.userId).filter(Boolean).map(String)
  if (snapshotIds.length) return snapshotIds
  return teamUserIds(reg.team?._id || reg.team)
}

function reminderMessage(tournament, rival, scheduledAt, now) {
  const mins = Math.round((scheduledAt.getTime() - now.getTime()) / 60000)
  return mins > 0
    ? `Tu partida contra ${rival} en ${tournament.title} empieza en ~${mins} min. Prepárate.`
    : `Tu partida contra ${rival} en ${tournament.title} ya está lista para jugarse.`
}

async function remindTournament(tournament, now) {
  const reminderMs = Number(tournament.matchSchedule.reminderMins) * 60 * 1000
  const sent = tournament.bracketDoc?.remindersSent || {}
  const due = scheduledMatches(tournament).filter(m =>
    !m.confirmed && !sent[m.id] && m.scheduledAt &&
    isRealTeam(m.a) && isRealTeam(m.b) &&
    m.scheduledAt.getTime() - reminderMs <= now.getTime() &&
    now.getTime() - m.scheduledAt.getTime() <= STALE_AFTER_MS
  )
  if (!due.length) return 0

  const regs = tournament.registrations || []
  const inPlay = regs.filter(r => !OUT.has(r.status))
  const checked = inPlay.filter(r => r.status === 'checked_in')
  const byName = registrationsByBracketName(checked.length >= 2 ? checked : inPlay)
  const link = tournamentLink(tournament)

  for (const match of due) {
    // Se marca antes de avisar: si el aviso falla a medias, mejor no repetir
    // que mandar dos veces el mismo aviso a la mitad del equipo.
    const marked = await Tournament.updateOne(
      { _id: tournament._id, [`bracketDoc.remindersSent.${match.id}`]: { $exists: false } },
      { $set: { [`bracketDoc.remindersSent.${match.id}`]: now } },
    )
    if (!marked.modifiedCount) continue

    for (const [team, rival] of [[match.a, match.b], [match.b, match.a]]) {
      const reg = byName.get(team)
      if (!reg) continue
      await notifyUsers(await playersOf(reg), {
        type: 'tournament_match_soon',
        title: 'Tu partida empieza pronto',
        message: reminderMessage(tournament, rival, match.scheduledAt, now),
        link,
        meta: {
          tournamentId: String(tournament._id), tournamentTitle: tournament.title, tournamentPath: link,
          matchId: match.id, round: match.round, teamName: team, opponent: rival,
          scheduledAt: match.scheduledAt, durationMins: tournament.matchSchedule.durationMins,
        },
      })
    }
  }
  return due.length
}

export async function sendDueMatchReminders(now = new Date()) {
  const tournaments = await Tournament.find({
    status: 'ongoing',
    'bracketDoc.status': 'running',
    matchSchedule: { $exists: true, $ne: null },
  }).populate('registrations.team', 'name tag')

  let total = 0
  for (const tournament of tournaments) {
    try {
      total += await remindTournament(tournament, now)
    } catch (err) {
      console.error('[match-reminders] failed for tournament', String(tournament._id), err.message)
    }
  }
  return total
}

let intervalHandle = null

export function startMatchRemindersJob() {
  if (intervalHandle) return
  intervalHandle = setInterval(() => { sendDueMatchReminders().catch(err => console.error('[match-reminders] tick failed:', err.message)) }, CHECK_INTERVAL_MS)
  intervalHandle.unref?.()
  sendDueMatchReminders().catch(err => console.error('[match-reminders] initial tick failed:', err.message))
}

export function stopMatchRemindersJob() {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
}
