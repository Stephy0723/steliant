import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { ResultCase } from '../models/ResultCase.js'
import { Infraction } from '../models/Infraction.js'
import { GameAccount } from '../models/GameAccount.js'
import { config } from '../config/index.js'
import { staffTabAccess } from '../controllers/tournament.controller.js'
import { statsMatches, frozenRoster, statsError } from './matchStats.service.js'
import { rewriteSeriesResult } from './bracketSync.service.js'
import { notifyUsers } from './tournamentTeams.service.js'
import {
  REASON_TEXT, reasonsText, arbiterIds, discordNotice, applyDecision, seriesFrom, evaluateCase,
} from './matchResults.service.js'
import { recordingsForCase, caseTrackFile } from './matchRecordings.service.js'
import { compareStats, STAT_FIELDS, isMobileLegends } from '../../../shared/matchStats.mjs'
import { reportScreenshotsFor } from '../../../shared/reportScreenshots.mjs'
import { matchStatsReviewPath } from '../../../shared/matchStatsContract.mjs'

// Arbitraje de resultados (spec-lector-resultados 4.2): "Resultados por
// revisar", tomar caso, decidir, apelar. Arbitra el organizador y su staff
// con la pestaña "resultados" en edición; el admin de GG solo mira.

const idOf = v => String(v?._id || v || '')
const OPEN = ['pending_review', 'arbitration']
const MATCH_PATH = '/mi-equipo/enfrentamiento'
const isAdmin = user => String(user?.role || '').toLowerCase() === 'admin' || (user?.roles || []).map(String).includes('admin')

export function caseAccess(tournament, user) {
  const owner = idOf(tournament.organizer) === idOf(user._id)
  const member = (tournament.staffMembers || []).find(m => m.user && idOf(m.user) === idOf(user._id) && m.status === 'accepted')
  const level = owner ? 'edit' : staffTabAccess(member, 'resultados')
  return { owner, admin: isAdmin(user), canView: owner || isAdmin(user) || level !== 'none', canArbitrate: owner || level === 'edit' }
}

function who(user) { return { actor: idOf(user._id), actorName: user.nick || 'Árbitro' } }
function pushAudit(doc, user, action, detail) {
  doc.audit.push({ at: new Date(), ...who(user), action, detail: String(detail || '').slice(0, 1000) })
}

// "Cuartos #2 · P1": ronda + posición en la ronda + partida de la serie.
function matchLabels(tournament) {
  const byRound = new Map()
  const labels = new Map()
  for (const m of statsMatches(tournament)) {
    const round = m.roundName || m.round || 'Partida'
    const n = (byRound.get(round) || 0) + 1
    byRound.set(round, n)
    labels.set(m.id, `${round} #${n}`)
  }
  return labels
}

/** Torneos cuyos casos puede ver este usuario (todos, si es admin). */
async function visibleTournaments(user, tournamentId = null) {
  const filter = isAdmin(user) ? {} : { $or: [{ organizer: user._id }, { staffMembers: { $elemMatch: { user: user._id, status: 'accepted' } } }] }
  if (tournamentId) {
    const ids = [{ publicId: String(tournamentId).toUpperCase() }]
    if (mongoose.isValidObjectId(tournamentId)) ids.push({ _id: tournamentId })
    filter.$and = [{ $or: ids }]
  }
  const list = await Tournament.find(filter).select('title publicId organizer staffMembers game bracketDoc competition format registrations').lean()
  return list.filter(t => caseAccess(t, user).canView)
}

/**
 * Lista de "Resultados por revisar": por defecto lo abierto, lo más viejo
 * primero. Filtros: torneo, estado (pending_review | arbitration |
 * decided), sinArbitro.
 */
export async function listReview(user, { tournament = null, state = '', unassigned = false } = {}) {
  const tournaments = await visibleTournaments(user, tournament)
  if (!tournaments.length) return { cases: [], tournaments: [] }
  const byId = new Map(tournaments.map(t => [idOf(t._id), t]))
  const decided = state === 'decided'
  const query = { tournament: { $in: [...byId.keys()] }, state: decided ? { $in: ['validated', 'rejected'] } : OPEN.includes(state) ? state : { $in: OPEN } }
  if (unassigned && !decided) query['case.assignedTo'] = ''
  const docs = await ResultCase.find(query).sort(decided ? { decidedAt: -1 } : { 'case.openedAt': 1, createdAt: 1 }).limit(decided ? 50 : 200).lean()
  const labels = new Map()
  const { escalateUrgentMinutes } = config.matchResults
  const rows = []
  for (const c of docs) {
    const t = byId.get(idOf(c.tournament))
    // Lo que el organizador ya resolvió a mano en el bracket deja de estar pendiente.
    if (!decided && t.bracketDoc?.results?.[c.bracketMatchId]?.confirmed && c.state !== 'arbitration') continue
    if (!labels.has(idOf(t._id))) labels.set(idOf(t._id), matchLabels(t))
    const openedAt = c.case?.openedAt || c.createdAt
    const access = caseAccess(t, user)
    rows.push({
      id: idOf(c._id),
      tournament: { id: idOf(t._id), publicId: t.publicId || '', title: t.title },
      matchLabel: `${labels.get(idOf(t._id)).get(c.bracketMatchId) || c.bracketMatchId} · P${c.gameNumber}`,
      teams: c.teams.map(x => x.name), state: c.state, reasons: c.reasons.map(r => REASON_TEXT[r] || r),
      assignedName: c.case?.assignedName || '', assignedToMe: c.case?.assignedTo === idOf(user._id),
      openedAt, decidedAt: c.decidedAt, winnerName: c.winnerTeamId ? c.teams.find(x => x.id === c.winnerTeamId)?.name : '',
      appealed: Boolean(c.case?.appealedAt),
      urgent: !decided && !c.case?.assignedTo && (c.case?.escalations >= 2 || (c.state === 'arbitration' && Date.now() - new Date(openedAt) > escalateUrgentMinutes * 60000)),
      canArbitrate: access.canArbitrate,
    })
  }
  return { cases: rows, tournaments: tournaments.map(t => ({ id: idOf(t._id), title: t.title })) }
}

async function loadCase(caseId, user) {
  if (!mongoose.isValidObjectId(caseId)) throw statsError('Caso no encontrado.', 404)
  const doc = await ResultCase.findById(caseId)
  if (!doc) throw statsError('Caso no encontrado.', 404)
  const tournament = await Tournament.findById(doc.tournament).lean()
  if (!tournament) throw statsError('Torneo no encontrado.', 404)
  return { doc, tournament, access: caseAccess(tournament, user) }
}

// Lectura de un equipo, fila por fila, con el nick del roster congelado.
function readView(read, roster) {
  if (!read) return null
  const nickOf = id => roster.find(p => p.playerId === id)?.nick || ''
  return {
    team: idOf(read.team), status: read.status, error: read.error, model: read.model, confidence: read.confidence,
    winnerConfidence: read.winnerConfidence, flags: (read.flags || []).map(f => REASON_TEXT[f] || f), readAt: read.readAt,
    winnerTeamId: read.data?.winnerTeamId || '', scoreA: read.data?.scoreA ?? null, scoreB: read.data?.scoreB ?? null,
    players: (read.data?.players || []).map(p => ({ ...p, rosterNick: nickOf(p.playerId) })),
  }
}

export async function caseDetail(caseId, user) {
  const { doc, tournament, access } = await loadCase(caseId, user)
  if (!access.canView) throw statsError('No tienes acceso a los resultados de este torneo.', 403)
  const c = doc.toObject()
  const teamsIds = c.teams.map(t => t.id)
  const { roster } = frozenRoster(c.teams.map(t => ({ _id: t.id })), tournament.registrations || [])
  const accounts = isMobileLegends(tournament.game) && roster.length
    ? await GameAccount.find({ user: { $in: roster.map(p => p.playerId).filter(mongoose.isValidObjectId) }, game: 'mlbb', status: 'verified' }).select('user').lean()
    : []
  const verified = new Set(accounts.map(a => idOf(a.user)))
  const snapshot = new Map((tournament.registrations || []).flatMap(r => (r.rosterSnapshot || []).map(p => [idOf(p.userId), p])))
  const reads = c.teams.map(t => readView(c.reads.find(r => idOf(r.team) === t.id), roster))
  // Diferencias entre las dos lecturas, por jugador y campo, para resaltarlas.
  const diff = {}
  const [ra, rb] = c.reads.filter(r => r.status === 'done')
  if (ra && rb) {
    for (const p of ra.data?.players || []) {
      const q = rb.data?.players?.find(x => x.playerId && x.playerId === p.playerId)
      if (!q) continue
      const fields = [...Object.keys(STAT_FIELDS), 'mvp'].filter(k => p[k] != null && q[k] != null && p[k] !== q[k])
      if (fields.length) diff[p.playerId] = fields
    }
  }
  const series = seriesFrom(c, await ResultCase.find({ tournament: c.tournament, bracketMatchId: c.bracketMatchId, state: 'validated' }).select('winnerTeamId source').lean())
  // Voz de las salas: solo quien arbitra (organizador o staff con
  // "resultados" en edición). El admin de GG y el staff de solo lectura no.
  const voice = await recordingsForCase(c, { canListen: access.canArbitrate })
  return {
    id: idOf(c._id), state: c.state, reasons: c.reasons.map(r => REASON_TEXT[r] || r), reasonKeys: c.reasons,
    tournament: { id: idOf(tournament._id), publicId: tournament.publicId || '', title: tournament.title, game: tournament.game },
    matchLabel: `${matchLabels(tournament).get(c.bracketMatchId) || c.bracketMatchId} · Partida ${c.gameNumber}`,
    bracketMatchId: c.bracketMatchId, gameNumber: c.gameNumber, series: c.series, seriesScore: series,
    teams: c.teams,
    screenshots: reportScreenshotsFor(tournament.game).map(s => ({ key: s.key, label: s.label, required: s.required })),
    reports: c.teams.map(t => {
      const r = c.reports.find(x => idOf(x.team) === t.id)
      return r ? { team: t.id, declared: r.declared, evidence: r.evidence.map(e => ({ key: e.key, url: e.url })), missing: r.missing, reportedAt: r.reportedAt } : null
    }),
    reads, diff, conflicts: ra && rb ? compareStats(ra.data, rb.data) : [],
    roster: roster.map(p => ({ ...p, gameId: snapshot.get(p.playerId)?.gameId || '', verified: verified.has(p.playerId) })),
    winnerTeamId: c.winnerTeamId, source: c.source, decidedAt: c.decidedAt,
    case: { ...c.case, assignedToMe: c.case.assignedTo === idOf(user._id) },
    history: c.history || [], audit: c.audit,
    recordings: voice.recordings, hiddenRecordings: voice.hiddenRecordings,
    statsPath: isMobileLegends(tournament.game) ? matchStatsReviewPath(tournament.publicId || idOf(tournament._id), c.bracketMatchId, c.gameNumber) : '',
    bracketConfirmed: Boolean(tournament.bracketDoc?.results?.[c.bracketMatchId]?.confirmed),
    permissions: { canArbitrate: access.canArbitrate && OPEN.includes(c.state), canTake: access.canArbitrate && OPEN.includes(c.state) && canTake(c, tournament, user, access).ok, isAdmin: access.admin && !access.owner },
    teamIds: teamsIds,
  }
}

/** Pista de voz de una grabación del caso, solo para quien arbitra. */
export async function caseRecordingTrack(caseId, recordingId, discordUserId, user, { audit = true } = {}) {
  const { doc, access } = await loadCase(caseId, user)
  if (!access.canArbitrate) throw statsError('Solo el árbitro del torneo puede escuchar las grabaciones.', 403)
  return caseTrackFile(doc.toObject(), recordingId, discordUserId, user, { audit })
}

// Tras una apelación lo debe tomar otra persona; si el organizador es el
// único árbitro, lo decide él y queda anotado.
function canTake(c, tournament, user, access) {
  const me = idOf(user._id)
  if (c.case?.assignedTo && c.case.assignedTo !== me && !access.owner) return { ok: false, message: `Lo revisa ${c.case.assignedName || 'otra persona'}.` }
  if (c.case?.appealedAt && c.case.firstArbiter === me) {
    const others = arbiterIds(tournament).filter(id => id !== me)
    if (others.length) return { ok: false, message: 'Esta apelación la debe revisar otra persona distinta de quien decidió.' }
    return { ok: true, onlyArbiter: true }
  }
  return { ok: true }
}

export async function takeCase(caseId, user, { to = '' } = {}) {
  const { doc, tournament, access } = await loadCase(caseId, user)
  if (!access.canArbitrate) throw statsError('No tienes permiso para arbitrar resultados en este torneo.', 403)
  if (!OPEN.includes(doc.state)) throw statsError('Este caso ya no está abierto.', 409)
  let target = user
  let check = { ok: true }
  if (to && to !== idOf(user._id)) {
    if (!access.owner) throw statsError('Solo el organizador puede reasignar casos.', 403)
    if (!arbiterIds(tournament).includes(String(to))) throw statsError('Esa persona no puede arbitrar en este torneo.', 422)
    if (doc.case.appealedAt && doc.case.firstArbiter === String(to) && arbiterIds(tournament).some(id => id !== String(to))) {
      throw statsError('Esta apelación la debe revisar otra persona distinta de quien decidió.', 409)
    }
    const person = await User.findById(to).select('nick').lean()
    target = { _id: to, nick: person?.nick || 'Árbitro' }
  } else {
    check = canTake(doc, tournament, user, access)
    if (!check.ok) throw statsError(check.message, 409)
  }
  const previous = doc.case.assignedName
  doc.case.assignedTo = idOf(target._id)
  doc.case.assignedName = target.nick || 'Árbitro'
  doc.case.assignedAt = new Date()
  pushAudit(doc, user, previous ? 'reassigned' : 'taken', previous ? `Reasignado de ${previous} a ${doc.case.assignedName}` : `${doc.case.assignedName} tomó el caso${check.onlyArbiter ? ' (único árbitro del torneo, también decidió antes)' : ''}`)
  await doc.save()
  return caseDetail(caseId, user)
}

async function teamLeaders(teamIds) {
  const teams = await Team.find({ _id: { $in: teamIds } }).select('leader').lean()
  return teams.map(t => idOf(t.leader)).filter(Boolean)
}

async function tellTeams(doc, tournament, { title, message, tone = 'info' }) {
  await notifyUsers(await teamLeaders(doc.teams.map(t => t.id)), {
    type: 'tournament_result_decision', title, message: `${tournament.title} · ${doc.teams.map(t => t.name).join(' vs ')}, partida ${doc.gameNumber}: ${message}`.slice(0, 400),
    link: MATCH_PATH, meta: { tournamentId: idOf(tournament._id), matchId: doc.bracketMatchId, gameNumber: doc.gameNumber, caseId: idOf(doc._id) },
  })
  for (const team of doc.teams) {
    const reg = (tournament.registrations || []).find(r => idOf(r.team) === team.id)
    await discordNotice(tournament, reg?.discordProvision?.textChannelId, { title, description: `Partida ${doc.gameNumber}: ${message}`, tone })
  }
}

// Guarda el intento actual en history y deja la partida lista para un
// nuevo reporte (repetir partida o reporte rechazado).
async function resetAttempt(doc, user, decision, reason) {
  doc.history.push({
    decision, reason, by: idOf(user._id), byName: user.nick || '', at: new Date(),
    state: doc.state, reasons: doc.reasons, reports: doc.reports.map(r => r.toObject?.() || r), reads: doc.reads.map(r => r.toObject?.() || r),
  })
  await TournamentMatch.updateMany({ _id: { $in: doc.reports.map(r => r.reportId) } }, { $set: { voidedAt: new Date() } })
  Object.assign(doc, { state: 'analyzing', reasons: [], reports: [], reads: [], deadlineAt: null, deadlineClosed: false, winnerTeamId: '', source: '', decidedBy: '', decidedAt: null })
  Object.assign(doc.case, { assignedTo: '', assignedName: '', assignedAt: null, openedAt: null, escalations: 0, escalatedAt: null, requestedTeam: '', requestDeadline: null })
}

/**
 * Decisión del árbitro: confirm | request_capture | replay | reject.
 * Motivo (10+ caracteres) obligatorio salvo al confirmar lo que ya
 * coincide con la lectura y con lo declarado por los dos equipos.
 */
export async function decideCase(caseId, user, body = {}) {
  const { doc, tournament, access } = await loadCase(caseId, user)
  if (!access.canArbitrate) throw statsError('No tienes permiso para arbitrar resultados en este torneo.', 403)
  if (!OPEN.includes(doc.state)) throw statsError('Este caso ya no está abierto.', 409)
  const me = idOf(user._id)
  if (doc.case.assignedTo && doc.case.assignedTo !== me && !access.owner) throw statsError(`Lo revisa ${doc.case.assignedName}. Tómalo antes de decidir.`, 409)
  if (!doc.case.assignedTo) {
    const check = canTake(doc, tournament, user, access)
    if (!check.ok) throw statsError(check.message, 409)
    Object.assign(doc.case, { assignedTo: me, assignedName: user.nick || 'Árbitro', assignedAt: new Date() })
    pushAudit(doc, user, 'taken', `${user.nick || 'Árbitro'} tomó el caso`)
  }
  const decision = String(body.decision || '')
  const reason = String(body.reason || '').trim().slice(0, 1000)
  const teamIds = doc.teams.map(t => t.id)
  const nameOf = id => doc.teams.find(t => t.id === id)?.name || ''

  if (decision === 'confirm') {
    const winnerTeamId = String(body.winnerTeamId || '')
    if (!teamIds.includes(winnerTeamId)) throw statsError('Elige el equipo ganador.')
    const readWinners = doc.reads.filter(r => r.status === 'done').map(r => r.data?.winnerTeamId).filter(Boolean)
    const declaredWinners = doc.reports.map(r => (r.declared === 'win' ? idOf(r.team) : r.declared === 'lose' ? teamIds.find(id => id !== idOf(r.team)) : '')).filter(Boolean)
    const against = readWinners.some(w => w !== winnerTeamId) || declaredWinners.some(w => w !== winnerTeamId) || doc.reports.length < 2 || Boolean(doc.case.appealedAt)
    if (against && reason.length < 10) throw statsError('Explica el motivo de la decisión (mínimo 10 caracteres).')
    // Con la serie ya en el bracket (apelación), primero se comprueba que se pueda corregir.
    const others = await ResultCase.find({ _id: { $ne: doc._id }, tournament: doc.tournament, bracketMatchId: doc.bracketMatchId, state: 'validated' }).select('winnerTeamId source').lean()
    const prospective = seriesFrom(doc, [...others, { winnerTeamId, source: 'arbiter' }])
    if (tournament.bracketDoc?.results?.[doc.bracketMatchId]?.confirmed) {
      const dry = await rewriteSeriesResult(doc.tournament, doc.bracketMatchId, prospective, { dryRun: true })
      if (dry.status === 'blocked') throw statsError('El bracket ya avanzó con el resultado anterior. Corrige esas partidas desde la pestaña Bracket antes de cambiar este ganador.', 409)
    }
    const previousWinner = doc.winnerTeamId
    Object.assign(doc, { state: 'validated', winnerTeamId, source: 'arbiter', decidedBy: me, decidedAt: new Date() })
    Object.assign(doc.case, { decision: 'confirm', reason, firstArbiter: doc.case.firstArbiter || me })
    pushAudit(doc, user, 'decided', `Confirmó ganador ${nameOf(winnerTeamId)}${previousWinner && previousWinner !== winnerTeamId ? ` (antes ${nameOf(previousWinner)})` : ''}.${reason ? ` Motivo: "${reason}"` : ''}`)
    await doc.save()
    const effects = await applyDecision(doc, tournament, { who: { actor: me, actorName: user.nick || 'Árbitro' }, role: 'arbiter' })
    await tellTeams(doc, tournament, { title: '🟢 Resultado decidido', message: `el árbitro confirmó la victoria de ${nameOf(winnerTeamId)}.${reason ? ` Motivo: ${reason}` : ''}`, tone: 'success' })
    return { ...(await caseDetail(caseId, user)), effects }
  }

  if (reason.length < 10) throw statsError('Explica el motivo de la decisión (mínimo 10 caracteres).')
  if (decision === 'request_capture') {
    const teamId = String(body.teamId || '')
    if (!teamIds.includes(teamId)) throw statsError('Elige el equipo que debe mandar la captura.')
    const minutes = Math.min(120, Math.max(5, Number(body.minutes) || 15))
    Object.assign(doc.case, { requestedTeam: teamId, requestDeadline: new Date(Date.now() + minutes * 60000), decision: 'request_capture', reason })
    doc.reasons = [...new Set([...doc.reasons, 'capture_requested'])]
    pushAudit(doc, user, 'capture_requested', `Pidió nueva captura a ${nameOf(teamId)} (${minutes} min). Motivo: "${reason}"`)
    await doc.save()
    const reg = (tournament.registrations || []).find(r => idOf(r.team) === teamId)
    const text = `el árbitro pide una nueva captura a ${nameOf(teamId)} en ${minutes} minutos: ${reason}. Usa /report solo con la captura, sin resultado.`
    await notifyUsers(await teamLeaders([teamId]), { type: 'tournament_result_decision', title: '📸 Nueva captura pedida', message: `${tournament.title}, partida ${doc.gameNumber}: ${text}`.slice(0, 400), link: MATCH_PATH, meta: { tournamentId: idOf(tournament._id), caseId: idOf(doc._id) } })
    await discordNotice(tournament, reg?.discordProvision?.textChannelId, { title: '📸 Nueva captura pedida', description: `Partida ${doc.gameNumber}: ${text}`, tone: 'warning' })
    return caseDetail(caseId, user)
  }
  if (decision === 'replay') {
    await resetAttempt(doc, user, 'replay', reason)
    pushAudit(doc, user, 'replay', `Ordenó repetir la partida ${doc.gameNumber}. Motivo: "${reason}"`)
    await doc.save()
    await tellTeams(doc, tournament, { title: '🔁 Repetir partida', message: `el árbitro ordenó repetirla: ${reason}. Usen /start-match y luego /report como siempre.`, tone: 'warning' })
    return caseDetail(caseId, user)
  }
  if (decision === 'reject') {
    const teamId = String(body.teamId || '')
    if (!teamIds.includes(teamId)) throw statsError('Elige el equipo cuyo reporte se rechaza.')
    try {
      await Infraction.create({ tournament: doc.tournament, team: teamId, bracketMatchId: doc.bracketMatchId, gameNumber: doc.gameNumber, type: 'rejected_report', detail: reason, createdBy: me })
    } catch (error) { if (error.code !== 11000) throw error }
    await resetAttempt(doc, user, 'reject', reason)
    pushAudit(doc, user, 'rejected', `Rechazó el reporte de ${nameOf(teamId)} (falta registrada). Motivo: "${reason}"`)
    await doc.save()
    await tellTeams(doc, tournament, { title: '🔴 Reporte rechazado', message: `el árbitro rechazó el reporte de ${nameOf(teamId)}: ${reason}. Quedó como falta. Los dos equipos deben reportar de nuevo esta partida.`, tone: 'danger' })
    return caseDetail(caseId, user)
  }
  throw statsError('Decisión no válida.')
}

/** Apelación de un capitán: una sola vez por partida, después de una decisión. */
export async function appealCase(caseId, user, { reason = '' } = {}) {
  if (!mongoose.isValidObjectId(caseId)) throw statsError('Caso no encontrado.', 404)
  const doc = await ResultCase.findById(caseId)
  if (!doc) throw statsError('Caso no encontrado.', 404)
  const teams = await Team.find({ _id: { $in: doc.teams.map(t => t.id) } }).select('leader').lean()
  const mine = teams.find(t => idOf(t.leader) === idOf(user._id))
  if (!mine) throw statsError('Solo el capitán de uno de los dos equipos puede apelar.', 403)
  if (doc.state !== 'validated') throw statsError('Solo se puede apelar una partida ya decidida.', 409)
  if (doc.case.appealedAt) throw statsError('Esta partida ya fue apelada una vez.', 409)
  const text = String(reason || '').trim().slice(0, 1000)
  if (text.length < 10) throw statsError('Explica el motivo de la apelación (mínimo 10 caracteres).')
  const tournament = await Tournament.findById(doc.tournament).lean()
  Object.assign(doc.case, {
    appealedBy: idOf(user._id), appealTeam: idOf(mine._id), appealedAt: new Date(), appealReason: text,
    firstArbiter: doc.case.firstArbiter || doc.decidedBy || 'system',
    assignedTo: '', assignedName: '', assignedAt: null, openedAt: new Date(), escalations: 0, escalatedAt: null,
  })
  doc.state = 'arbitration'
  doc.reasons = ['appeal']
  pushAudit(doc, user, 'appealed', `${doc.teams.find(t => t.id === idOf(mine._id))?.name} apeló: "${text}". El resultado sigue en el bracket hasta la nueva decisión.`)
  await doc.save()
  const message = `${tournament.title} · ${doc.teams.map(t => t.name).join(' vs ')}, partida ${doc.gameNumber}: apelación de ${doc.teams.find(t => t.id === idOf(mine._id))?.name}. Debe revisarla otra persona.`.slice(0, 400)
  await notifyUsers(arbiterIds(tournament), { type: 'tournament_result_review', title: 'Apelación de resultado', message, link: `/organizador/resultados?caso=${idOf(doc._id)}`, meta: { tournamentId: idOf(tournament._id), caseId: idOf(doc._id), urgent: true } })
  await discordNotice(tournament, tournament.discordProvision?.channels?.staffId, { title: '🟠 Apelación de resultado', description: message, tone: 'danger' })
  return { state: doc.state, appealedAt: doc.case.appealedAt }
}

// Recarga de capturas tras "pedir nueva captura": el caso vuelve a evaluarse
// solo (recordReport -> evaluateCase); aquí no hay nada más que hacer.
export { evaluateCase, reasonsText }
