import { Tournament } from '../models/Tournament.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { ResultCase } from '../models/ResultCase.js'
import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { config } from '../config/index.js'
import { resolveMatchTeams, statsSeries, frozenRoster, writeStatsHistory } from './matchStats.service.js'
import { readEvidence, extractMatchStats } from './matchStatsVision.service.js'
import { writeSeriesResult, rewriteSeriesResult } from './bracketSync.service.js'
import { notifyUsers } from './tournamentTeams.service.js'
import { enqueueIntegrationEvent } from './integrationEvents.service.js'
import { onReportDeadlineClosed } from './reportDeadline.service.js'
import { staffTabAccess } from '../controllers/tournament.controller.js'
import { isMobileLegends, matchExtractedStats, validateStats, compareStats } from '../../../shared/matchStats.mjs'
import { reportScreenshotsFor } from '../../../shared/reportScreenshots.mjs'

// Lectura automática y avance del bracket (spec-lector-resultados, sección 4).
//
// Cada /report con bracketMatchId + gameNumber alimenta un ResultCase. En
// Mobile Legends la IA lee en segundo plano las capturas de cada equipo; al
// tener los dos lados se cruzan entre sí, con lo declarado y con el roster
// congelado. Solo si todo cuadra (🟢) se escribe el resultado; cualquier duda
// (⚪) o contradicción (🟠) abre un caso para el árbitro. En otros juegos,
// sin lectura, dos declaraciones que coinciden validan la partida.
// La serie (BO3/BO5) se escribe en el bracket cuando un equipo llega a la meta.

const idOf = v => String(v?._id || v || '')
const SYSTEM = { actor: 'system', actorName: 'Sistema' }
const REVIEW_PATH = '/organizador/resultados'

// Motivo -> texto para humanos (árbitro, equipos, auditoría).
export const REASON_TEXT = {
  awaiting_rival: 'Esperando el reporte del rival',
  only_one_team: 'Solo reportó un equipo',
  rival_no_report: 'El rival no reportó a tiempo',
  missing_screenshots: 'Faltan capturas obligatorias',
  ai_unavailable: 'Lectura automática no disponible',
  ai_disabled: 'Lectura automática desactivada',
  not_game_screenshot: 'Una imagen no es una captura del juego',
  winner_unreadable: 'No se ve el ganador en la captura',
  low_confidence: 'Lectura con baja confianza',
  nickname_mismatch: 'Jugador no reconocido en el roster',
  roster_not_ready: 'El roster congelado está incompleto',
  stats_differ: 'Las capturas difieren en algunas cifras',
  draw_declared: 'Se declaró empate',
  declaration_mismatch: 'Los equipos declaran resultados distintos',
  ai_vs_declared: 'La captura contradice lo declarado',
  winner_mismatch: 'Las capturas muestran ganadores distintos',
  stats_mismatch: 'Las capturas muestran K/D/A distintos',
  duplicate_image: 'Captura ya usada en otra partida',
  editing_suspected: 'Posible captura editada',
  appeal: 'Apelación de un equipo',
  capture_requested: 'Se pidió una nueva captura',
}
// Contradicciones: prioridad alta (🟠). El resto es ⚪, salvo los avisos que
// no bloquean (spec 4.3: la edición detectada por la IA es solo un aviso).
const ARBITRATION = new Set(['declaration_mismatch', 'ai_vs_declared', 'winner_mismatch', 'stats_mismatch', 'duplicate_image'])
const NON_BLOCKING = new Set(['rival_no_report', 'editing_suspected'])
export const reasonsText = reasons => reasons.map(r => REASON_TEXT[r] || r).join(' · ')

function audit(doc, action, detail = '', who = SYSTEM) {
  doc.audit.push({ at: new Date(), actor: who.actor, actorName: who.actorName, action, detail: String(detail).slice(0, 1000) })
}

/** Organizador + staff con permiso de arbitrar (pestaña "resultados" en edición). */
export function arbiterIds(tournament) {
  const ids = new Set([idOf(tournament.organizer)].filter(Boolean))
  for (const member of tournament.staffMembers || []) {
    if (member.status === 'accepted' && member.user && staffTabAccess(member, 'resultados') === 'edit') ids.add(idOf(member.user))
  }
  return [...ids]
}

function teamChannel(tournament, teamId) {
  const reg = (tournament.registrations || []).find(r => idOf(r.team) === idOf(teamId))
  return reg?.discordProvision?.textChannelId || ''
}

export async function discordNotice(tournament, channelId, { title, description, tone = 'info' }) {
  if (!tournament.discordEnabled || !channelId) return
  await enqueueIntegrationEvent({
    type: 'discord.match.notice', entityType: 'tournament', entityId: tournament._id, dedupe: false,
    payload: { tournamentId: idOf(tournament._id), channelId, title, description, tone },
  })
}

const gameLabel = c => `${c.teams[0]?.name} vs ${c.teams[1]?.name} · partida ${c.gameNumber}`
const teamName = (c, teamId) => c.teams.find(t => t.id === idOf(teamId))?.name || 'Equipo'

/** Estado de cada partida de una serie, para mostrar en la web. */
export function publicCase(c) {
  return {
    id: idOf(c._id), bracketMatchId: c.bracketMatchId, gameNumber: c.gameNumber, state: c.state,
    reasons: (c.reasons || []).map(r => REASON_TEXT[r] || r),
    winnerName: c.winnerTeamId ? teamName(c, c.winnerTeamId) : '', source: c.source || '',
    assignedName: c.case?.assignedName || '', appealed: Boolean(c.case?.appealedAt), updatedAt: c.updatedAt,
  }
}

export async function casesByMatch(tournamentId, matchId = null) {
  const docs = await ResultCase.find({ tournament: tournamentId, ...(matchId ? { bracketMatchId: matchId } : {}) })
    .select('bracketMatchId gameNumber state reasons winnerTeamId teams source case.assignedName case.appealedAt updatedAt').sort({ gameNumber: 1 }).lean()
  const map = new Map()
  for (const c of docs) map.set(c.bracketMatchId, [...(map.get(c.bracketMatchId) || []), publicCase(c)])
  return map
}

// ─── Registro de reportes ────────────────────────────────────────────────

/**
 * Se llama al guardar un /report (o al agregarle capturas). Crea o
 * actualiza el caso de la partida, encola la lectura si hace falta y
 * evalúa. Devuelve el estado para la respuesta del bot, o null si el
 * reporte no se pudo ubicar en el bracket (camino viejo por nombre).
 */
export async function recordReport(reportDoc) {
  if (!reportDoc.bracketMatchId || !reportDoc.gameNumber) return null
  const tournament = await Tournament.findById(reportDoc.tournament).lean()
  if (!tournament) return null
  const resolved = await resolveMatchTeams(tournament, reportDoc.bracketMatchId).catch(() => null)
  if (!resolved) return null
  const teams = resolved.teams.map(t => ({ id: idOf(t._id), name: t.bracketName }))
  if (!teams.some(t => t.id === idOf(reportDoc.team))) return null

  const key = { tournament: tournament._id, bracketMatchId: reportDoc.bracketMatchId, gameNumber: reportDoc.gameNumber }
  await ResultCase.updateOne(key, { $setOnInsert: { ...key, teams, series: statsSeries(tournament, resolved.match) } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error })
  const doc = await ResultCase.findOne(key)

  const evidence = (reportDoc.report?.evidence || []).map(e => ({ key: e.key || 'overview', url: e.url, sha256: e.sha256 || '' }))
  const entry = {
    team: reportDoc.team, reportId: reportDoc._id, declared: reportDoc.result || '',
    evidence, missing: reportDoc.report?.missing || [], reportedAt: reportDoc.report?.createdAt || new Date(),
  }
  const previous = doc.reports.find(r => idOf(r.team) === idOf(reportDoc.team))
  const evidenceChanged = !previous || JSON.stringify(previous.evidence.map(e => e.url)) !== JSON.stringify(evidence.map(e => e.url))
  doc.reports = [...doc.reports.filter(r => idOf(r.team) !== idOf(reportDoc.team)), entry]
  if (reportDoc.report?.deadlineAt) doc.deadlineAt = reportDoc.report.deadlineAt
  const name = teamName(doc, reportDoc.team)
  audit(doc, previous ? 'report_updated' : 'report', `${name}: ${entry.declared || 'sin resultado'} · ${evidence.length} captura(s)${entry.missing.length ? ` · faltan ${entry.missing.length}` : ''}`)

  if (['validated', 'rejected'].includes(doc.state)) {
    audit(doc, 'late_report', `${name} reportó después de la decisión; no cambia el resultado.`)
    await doc.save()
    return summary(doc)
  }

  // Lectura en segundo plano: solo MLBB, con lectura activa y capturas nuevas.
  if (isMobileLegends(tournament.game) && config.matchResults.autoReadEnabled && evidenceChanged && evidence.length) {
    doc.reads = [...doc.reads.filter(r => idOf(r.team) !== idOf(reportDoc.team)), { team: reportDoc.team, reportId: reportDoc._id, status: 'queued', queuedAt: new Date() }]
  }
  await doc.save()
  const evaluated = await evaluateCase(doc._id)
  if (doc.reads.some(r => r.status === 'queued')) setImmediate(() => { void tickReads() })
  return evaluated
}

function summary(doc, extra = {}) {
  return {
    caseId: idOf(doc._id), state: doc.state, reasons: doc.reasons, gameNumber: doc.gameNumber,
    winnerTeamId: doc.winnerTeamId, winnerName: doc.winnerTeamId ? teamName(doc, doc.winnerTeamId) : '',
    teams: doc.teams.map(t => ({ id: t.id, name: t.name })), reportedTeams: doc.reports.map(r => idOf(r.team)), ...extra,
  }
}

/** Resumen del caso en el formato `sync` que entiende /report del bot. */
export function syncStatusFor(outcome, teamId) {
  const rival = outcome.teams.find(t => t.id !== idOf(teamId))
  const base = { caseId: outcome.caseId, gameNumber: outcome.gameNumber, rivalTeamName: rival?.name || '', reasons: (outcome.reasons || []).map(r => REASON_TEXT[r] || r) }
  if (outcome.series?.status === 'synced') return { ...base, status: 'synced', justFinished: outcome.series.justFinished, podium: outcome.series.podium, winnerName: outcome.series.winner }
  if (outcome.state === 'validated') return { ...base, status: 'game_validated', winnerName: outcome.winnerName, scoreA: outcome.series?.scoreA, scoreB: outcome.series?.scoreB }
  if (outcome.state === 'arbitration') return { ...base, status: 'disputed' }
  if (outcome.state === 'pending_review') return { ...base, status: 'review' }
  if (outcome.reportedTeams.length < 2) return { ...base, status: 'awaiting_rival' }
  return { ...base, status: 'analyzing' }
}

// ─── Lectura automática ──────────────────────────────────────────────────

// Capturas en el orden de la configuración del juego (resumen primero).
function orderedEvidence(game, evidence) {
  const order = reportScreenshotsFor(game).map(s => s.key)
  return [...evidence].sort((a, b) => (order.indexOf(a.key) + 99) % 99 - (order.indexOf(b.key) + 99) % 99)
}

async function runRead(caseDoc, read, tournament) {
  const report = caseDoc.reports.find(r => idOf(r.team) === idOf(read.team))
  if (!report?.evidence?.length) throw Object.assign(new Error('Sin capturas para leer.'), { status: 422 })
  const images = []
  for (const e of orderedEvidence(tournament.game, report.evidence)) images.push(await readEvidence(e.url, [e.url]))
  const { raw, model } = await extractMatchStats(images, { withModel: true })
  const teamIds = caseDoc.teams.map(t => t.id)
  const { roster } = frozenRoster(caseDoc.teams.map(t => ({ _id: t.id })), tournament.registrations || [])
  // A = equipo que tomó la captura: se orienta al bracket con firstSideTeamId.
  const matched = matchExtractedStats(raw, roster, teamIds, idOf(read.team))
  const { data } = validateStats(matched, roster, teamIds)
  const flags = []
  if (raw?.notGameScreenshot) flags.push('not_game_screenshot')
  if (raw?.editingSuspected) flags.push('editing_suspected')
  return { raw, model, data, flags, confidence: num(raw?.confidence), winnerConfidence: num(raw?.winnerConfidence) }
}
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)

let readTimes = []
/** Procesa lecturas en cola respetando la cuota del sistema. */
export async function processQueuedReads({ max = 5 } = {}) {
  const done = []
  for (let i = 0; i < max; i++) {
    const now = Date.now()
    readTimes = readTimes.filter(t => now - t < 60000)
    if (readTimes.length >= config.matchResults.readsPerMinute) break
    const claimed = await ResultCase.findOneAndUpdate(
      { reads: { $elemMatch: { status: 'queued', queuedAt: { $lte: new Date() } } } },
      { $set: { 'reads.$.status': 'running' }, $inc: { 'reads.$.attempts': 1 } },
      { new: true, sort: { updatedAt: 1 } },
    )
    if (!claimed) break
    readTimes.push(now)
    const read = claimed.reads.find(r => r.status === 'running')
    const tournament = await Tournament.findById(claimed.tournament).lean()
    let patch
    try {
      const out = await runRead(claimed, read, tournament)
      patch = { status: 'done', error: '', model: out.model, raw: out.raw, data: out.data, flags: out.flags, confidence: out.confidence, winnerConfidence: out.winnerConfidence, readAt: new Date() }
    } catch (error) {
      // Gemini saturado: un reintento en un minuto. Lo demás queda ⚪ para el árbitro.
      const retry = [429, 503].includes(error.status) && read.attempts < 2
      patch = retry ? { status: 'queued', queuedAt: new Date(Date.now() + 60000), error: String(error.message).slice(0, 300) } : { status: 'failed', error: String(error.message || 'Error').slice(0, 300), readAt: new Date() }
    }
    const set = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`reads.$[r].${k}`, v]))
    await ResultCase.updateOne({ _id: claimed._id }, {
      $set: set,
      $push: { audit: { at: new Date(), ...SYSTEM, action: patch.status === 'done' ? 'ai_read' : patch.status === 'queued' ? 'ai_retry' : 'ai_failed',
        detail: patch.status === 'done' ? `Lectura IA de ${teamName(claimed, read.team)} (confianza ${patch.confidence ?? '?'})` : `${teamName(claimed, read.team)}: ${patch.error}` } },
    }, { arrayFilters: [{ 'r.team': read.team }] })
    if (patch.status !== 'queued') done.push(await evaluateCase(claimed._id))
  }
  return done
}

// ─── Evaluación ──────────────────────────────────────────────────────────

const consistent = (a, b) => (a === 'win' && b === 'lose') || (a === 'lose' && b === 'win')

async function duplicateImage(doc) {
  const perTeam = doc.reports.map(r => new Set(r.evidence.map(e => e.sha256).filter(Boolean)))
  const hashes = perTeam.flatMap(set => [...set])
  if (!hashes.length) return false
  // Los dos equipos mandando el mismo archivo tampoco es normal: cada uno
  // toma su propia captura.
  if (perTeam.length === 2 && [...perTeam[0]].some(h => perTeam[1].has(h))) return true
  const ownReports = doc.reports.map(r => r.reportId)
  return Boolean(await TournamentMatch.exists({ _id: { $nin: ownReports }, 'report.evidence.sha256': { $in: hashes } }))
}

/**
 * Decide el estado de la partida con lo que hay. Nunca deshace una decisión
 * final (validated/rejected). Devuelve el resumen para quien la llamó.
 */
export async function evaluateCase(caseId, { attempt = 0 } = {}) {
  const doc = await ResultCase.findById(caseId)
  if (!doc) return null
  if (['validated', 'rejected'].includes(doc.state)) return summary(doc)
  // Una apelación la decide una persona: nada automático la cierra.
  if (doc.case?.appealedAt) return summary(doc)
  const tournament = await Tournament.findById(doc.tournament).lean()
  if (!tournament) return summary(doc)
  if (tournament.bracketDoc?.results?.[doc.bracketMatchId]?.confirmed) return summary(doc, { bracketConfirmed: true })

  const [A, B] = doc.teams
  const reportOf = id => doc.reports.find(r => idOf(r.team) === id)
  const readOf = id => doc.reads.find(r => idOf(r.team) === id)
  const reported = [A, B].map(t => reportOf(t.id)).filter(Boolean)
  const mlbb = isMobileLegends(tournament.game)
  const reasons = new Set()
  let winnerTeamId = ''
  let state = 'analyzing'

  if (doc.reads.some(r => ['queued', 'running'].includes(r.status))) {
    return finish(doc, tournament, 'analyzing', [], '', attempt)
  }

  if (reported.length === 0) return summary(doc)
  if (reported.length === 1) {
    if (!doc.deadlineClosed) return finish(doc, tournament, 'analyzing', ['awaiting_rival'], '', attempt)
    const [only] = reported
    if (only.declared === 'win') winnerTeamId = idOf(only.team)
    else if (only.declared === 'lose') winnerTeamId = [A, B].find(t => t.id !== idOf(only.team)).id
    // Opción A (auto_win) solo si se sabe quién ganó; si no, siempre árbitro.
    const autoWin = (tournament.competition?.singleReportRule || 'arbiter') === 'auto_win' && winnerTeamId
    reasons.add(autoWin ? 'rival_no_report' : 'only_one_team')
  } else {
    const [ra, rb] = [reportOf(A.id), reportOf(B.id)]
    if (ra.declared === 'draw' || rb.declared === 'draw') reasons.add('draw_declared')
    else if (!consistent(ra.declared, rb.declared)) reasons.add('declaration_mismatch')
    else winnerTeamId = ra.declared === 'win' ? A.id : B.id
  }

  if (mlbb) {
    if (!config.matchResults.autoReadEnabled) reasons.add('ai_disabled')
    if (!frozenRoster(doc.teams.map(t => ({ _id: t.id })), tournament.registrations || []).rosterReady) reasons.add('roster_not_ready')
    const winners = []
    for (const r of reported) {
      const id = idOf(r.team)
      if (r.missing.length) reasons.add('missing_screenshots')
      const read = readOf(id)
      if (!config.matchResults.autoReadEnabled) continue
      if (!read || read.status === 'failed') { reasons.add('ai_unavailable'); continue }
      for (const flag of read.flags || []) reasons.add(flag)
      const readWinner = read.data?.winnerTeamId || ''
      if (!readWinner) reasons.add('winner_unreadable')
      else {
        winners.push(readWinner)
        const declaredWinner = r.declared === 'win' ? id : r.declared === 'lose' ? doc.teams.find(t => t.id !== id).id : ''
        if (declaredWinner && declaredWinner !== readWinner) reasons.add('ai_vs_declared')
      }
      const threshold = config.matchResults.confidence
      if (read.confidence == null || read.confidence < threshold || read.winnerConfidence == null || read.winnerConfidence < threshold) reasons.add('low_confidence')
      const players = read.data?.players || []
      if (players.length !== 10 || players.some(p => !p.playerId)) reasons.add('nickname_mismatch')
    }
    if (winners.length === 2 && winners[0] !== winners[1]) reasons.add('winner_mismatch')
    const [readA, readB] = [readOf(A.id), readOf(B.id)]
    if (readA?.status === 'done' && readB?.status === 'done') {
      const conflicts = compareStats(readA.data, readB.data)
      if (conflicts.some(c => /: (Kills|Muertes|Asistencias)$/.test(c))) reasons.add('stats_mismatch')
      else if (conflicts.length) reasons.add('stats_differ')
    }
  }
  if (await duplicateImage(doc)) reasons.add('duplicate_image')

  const blocking = [...reasons].filter(r => !NON_BLOCKING.has(r))
  if (blocking.some(r => ARBITRATION.has(r))) state = 'arbitration'
  else if (blocking.length || !winnerTeamId) state = 'pending_review'
  else state = 'validated'
  return finish(doc, tournament, state, [...reasons], winnerTeamId, attempt)
}

async function finish(doc, tournament, state, reasons, winnerTeamId, attempt) {
  const before = doc.state
  const sameReasons = JSON.stringify([...doc.reasons].sort()) === JSON.stringify([...reasons].sort())
  if (before === state && sameReasons && state !== 'validated') return summary(doc)
  doc.state = state
  doc.reasons = reasons
  const opening = ['pending_review', 'arbitration'].includes(state) && !['pending_review', 'arbitration'].includes(before)
  if (opening) doc.case.openedAt = new Date()
  if (state === 'validated') {
    Object.assign(doc, { winnerTeamId, source: isMobileLegends(tournament.game) ? 'ai-validated' : 'declarations', decidedBy: 'system', decidedAt: new Date() })
    audit(doc, 'validated', isMobileLegends(tournament.game)
      ? `Las capturas de ${doc.teams.map(t => t.name).join(' y ')} coinciden: gana ${teamName(doc, winnerTeamId)} (🟢).`
      : `Los dos equipos coinciden: gana ${teamName(doc, winnerTeamId)} (🟢).`)
  } else if ((before !== state || !sameReasons) && (state !== 'analyzing' || reasons.length)) {
    audit(doc, `state_${state}`, reasonsText(reasons))
  }
  try {
    await doc.save()
  } catch (error) {
    // Otro proceso tocó el caso al mismo tiempo: se reevalúa con lo nuevo.
    if (error.name === 'VersionError' && attempt < 3) return evaluateCase(doc._id, { attempt: attempt + 1 })
    throw error
  }
  if (state === 'validated') return { ...summary(doc), ...(await applyDecision(doc, tournament)) }
  if (opening) await announceCase(doc, tournament)
  return summary(doc)
}

// ─── Efectos de una decisión ─────────────────────────────────────────────

async function announceCase(doc, tournament) {
  const urgent = doc.state === 'arbitration'
  const title = urgent ? 'Resultado en arbitraje' : 'Resultado por confirmar'
  const message = `${tournament.title} · ${gameLabel(doc)}: ${reasonsText(doc.reasons)}.`.slice(0, 400)
  await notifyUsers(arbiterIds(tournament), {
    type: 'tournament_result_review', title, message, link: `${REVIEW_PATH}?caso=${idOf(doc._id)}`,
    meta: { tournamentId: idOf(tournament._id), matchId: doc.bracketMatchId, gameNumber: doc.gameNumber, caseId: idOf(doc._id), urgent },
  })
  await discordNotice(tournament, tournament.discordProvision?.channels?.staffId, {
    title: `${urgent ? '🟠' : '⚪'} ${title}`, description: message, tone: urgent ? 'danger' : 'warning',
  })
}

/**
 * Partida validada (por la IA, por declaraciones o por el árbitro):
 * confirma la ficha de estadísticas, avisa a los equipos y, si la serie
 * quedó decidida, la escribe en el bracket.
 */
export async function applyDecision(doc, tournament, { who = SYSTEM, role = 'system' } = {}) {
  if (isMobileLegends(tournament.game)) {
    await confirmStatsDraft(doc, tournament, { who, role }).catch(error => console.error('[match-results] estadísticas:', error.message))
  }
  const description = `Partida ${doc.gameNumber}: victoria de **${teamName(doc, doc.winnerTeamId)}**${doc.source === 'arbiter' ? ' (decisión del árbitro)' : doc.source === 'ai-validated' ? ' (confirmada por las capturas de los dos equipos)' : ''}.`
  for (const team of doc.teams) await discordNotice(tournament, teamChannel(tournament, team.id), { title: '🟢 Resultado validado', description, tone: 'success' })
  const series = await syncSeries(doc)
  return { series }
}

/** Marcador de la serie con las partidas validadas (ganador '' si sigue). */
export function seriesFrom(doc, games) {
  const max = Number(String(doc.series).replace(/\D/g, '')) || 1
  const target = Math.ceil((max + 1) / 2)
  const [A, B] = doc.teams
  const scoreA = games.filter(g => g.winnerTeamId === A.id).length
  const scoreB = games.filter(g => g.winnerTeamId === B.id).length
  const winner = scoreA >= target ? A.name : scoreB >= target ? B.name : ''
  const source = games.some(g => g.source === 'arbiter') ? 'arbiter' : games.length && games.every(g => g.source === 'ai-validated') ? 'ai-validated' : 'declarations'
  return { winner, scoreA, scoreB, target, source }
}

/**
 * Cuenta las partidas validadas de la serie y la escribe si ya hay ganador.
 * Si la serie ya estaba en el bracket (apelación), la corrige.
 */
export async function syncSeries(doc) {
  const games = await ResultCase.find({ tournament: doc.tournament, bracketMatchId: doc.bracketMatchId, state: 'validated' }).select('winnerTeamId source').lean()
  const s = seriesFrom(doc, games)
  const t = await Tournament.findById(doc.tournament).select('bracketDoc.results').lean()
  if (t?.bracketDoc?.results?.[doc.bracketMatchId]?.confirmed) return rewriteSeriesResult(doc.tournament, doc.bracketMatchId, s)
  if (!s.winner) return { status: 'series_in_progress', scoreA: s.scoreA, scoreB: s.scoreB, target: s.target }
  return writeSeriesResult(doc.tournament, doc.bracketMatchId, s)
}

// Ficha de estadísticas de la partida confirmada por el sistema (o el
// árbitro) con la lectura de mayor confianza. Respeta una confirmación humana previa.
async function confirmStatsDraft(doc, tournament, { data = null, who = SYSTEM, role = 'system' } = {}) {
  const teams = doc.teams.map(t => ({ _id: t.id }))
  const { roster, rosterReady } = frozenRoster(teams, tournament.registrations || [])
  if (!rosterReady) return null
  const teamIds = doc.teams.map(t => t.id)
  const reads = doc.reads.filter(r => r.status === 'done' && r.data).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  const chosen = data || reads[0]?.data
  if (!chosen) return null
  const validation = validateStats({ ...chosen, winnerTeamId: doc.winnerTeamId }, roster, teamIds)
  const key = { tournament: doc.tournament, bracketMatchId: doc.bracketMatchId, gameNumber: doc.gameNumber }
  const at = new Date().toISOString()
  const submissions = reads.slice(0, 2).map(r => ({ source: idOf(r.team), authorId: 'system', at, evidenceUrls: (doc.reports.find(x => idOf(x.team) === idOf(r.team))?.evidence || []).map(e => e.url).slice(0, 4), data: validateStats(r.data, roster, teamIds).data }))
  let draft = await MatchStatsDraft.findOne(key)
  if (draft?.status === 'confirmed') return draft
  if (!draft) {
    draft = await MatchStatsDraft.create({ ...key, teams: doc.teams.map(t => ({ id: t.id, name: t.name })), roster, submissions, revisions: submissions.map((s, i) => ({ revision: i + 1, ...s })), revision: submissions.length })
  }
  if (validation.errors.length) {
    // Sin datos completos no se confirma: queda el borrador para revisión humana.
    await ResultCase.updateOne({ _id: doc._id }, { $set: { statsDraft: draft._id }, $push: { audit: { at: new Date(), ...SYSTEM, action: 'stats_pending', detail: `Estadísticas sin confirmar: ${validation.errors.slice(0, 3).join(' ')}` } } })
    return draft
  }
  const confirmed = await MatchStatsDraft.findOneAndUpdate({ _id: draft._id, status: 'draft' }, {
    $set: { status: 'confirmed', confirmation: { source: submissions[0]?.source || teamIds[0], data: validation.data, userId: who.actor, role, at: new Date(), revision: Math.max(1, draft.revision), reason: role === 'system' ? 'Capturas de ambos equipos coinciden.' : doc.case?.reason || '', conflicts: [], reviewed: true } },
    $inc: { revision: 1 },
  }, { new: true, runValidators: true }).lean()
  await ResultCase.updateOne({ _id: doc._id }, { $set: { statsDraft: draft._id } })
  if (confirmed) await writeStatsHistory(confirmed, tournament)
  return confirmed
}
export { confirmStatsDraft }

// ─── Plazo vencido y trabajo en segundo plano ────────────────────────────

onReportDeadlineClosed(async ({ tournament, match, gameNumber }) => {
  const doc = await ResultCase.findOneAndUpdate({ tournament: tournament._id, bracketMatchId: match.id, gameNumber }, { $set: { deadlineClosed: true } }, { new: true })
  if (doc) await evaluateCase(doc._id)
})

// Casos sin tomar: a los escalateMinutes se avisa al organizador; si un 🟠
// sigue sin dueño a los escalateUrgentMinutes, se repite y queda en rojo.
export async function escalateCases(now = new Date()) {
  const { escalateMinutes, escalateUrgentMinutes } = config.matchResults
  const minutesAgo = m => new Date(now.getTime() - m * 60000)
  const due = await ResultCase.find({
    state: { $in: ['pending_review', 'arbitration'] }, 'case.assignedTo': '',
    $or: [
      { 'case.escalations': 0, 'case.openedAt': { $lte: minutesAgo(escalateMinutes) } },
      { state: 'arbitration', 'case.escalations': 1, 'case.openedAt': { $lte: minutesAgo(escalateUrgentMinutes) } },
    ],
  }).limit(50)
  for (const doc of due) {
    const level = doc.case.escalations + 1
    const claimed = await ResultCase.updateOne(
      { _id: doc._id, 'case.escalations': doc.case.escalations, 'case.assignedTo': '' },
      { $set: { 'case.escalations': level, 'case.escalatedAt': now }, $push: { audit: { at: now, ...SYSTEM, action: 'escalated', detail: level === 1 ? 'Nadie tomó el caso: aviso al organizador.' : 'Sigue sin árbitro: aviso urgente.' } } },
    )
    if (!claimed.modifiedCount) continue
    const tournament = await Tournament.findById(doc.tournament).select('title organizer publicId discordEnabled discordProvision').lean()
    if (!tournament) continue
    const minutes = Math.round((now - doc.case.openedAt) / 60000)
    const message = `${tournament.title} · ${gameLabel(doc)} lleva ${minutes} min sin árbitro. ${reasonsText(doc.reasons)}.`.slice(0, 400)
    await notifyUsers([idOf(tournament.organizer)], {
      type: 'tournament_result_review', title: level === 1 ? 'Caso sin tomar' : 'Caso urgente sin tomar', message,
      link: `${REVIEW_PATH}?caso=${idOf(doc._id)}`, meta: { tournamentId: idOf(tournament._id), caseId: idOf(doc._id), urgent: level > 1 },
    })
    await discordNotice(tournament, tournament.discordProvision?.channels?.staffId, { title: level === 1 ? '⏰ Caso sin tomar' : '🚨 Caso urgente sin tomar', description: message, tone: level > 1 ? 'danger' : 'warning' })
  }
  return due.length
}

let timer = null, running = false, lastEscalation = 0
async function tickReads() {
  if (running) return
  running = true
  try {
    await processQueuedReads()
    if (Date.now() - lastEscalation > 60000) { lastEscalation = Date.now(); await escalateCases() }
  }
  catch (error) { console.error('[match-results]', error.message) }
  finally { running = false }
}
export function startMatchResultsJob() {
  if (timer) return
  timer = setInterval(tickReads, 10000)
  timer.unref?.()
  // Lecturas que quedaron "running" por un reinicio vuelven a la cola.
  void ResultCase.updateMany({ 'reads.status': 'running' }, { $set: { 'reads.$[r].status': 'queued' } }, { arrayFilters: [{ 'r.status': 'running' }] })
    .catch(() => {}).then(tickReads)
}
export async function stopMatchResultsJob() {
  if (timer) clearInterval(timer)
  timer = null
  while (running) await new Promise(resolve => setTimeout(resolve, 50))
}

/** Espera la lectura en curso y procesa toda la cola (pruebas y scripts). */
export async function drainReads() {
  const pause = () => new Promise(resolve => setTimeout(resolve, 20))
  for (let i = 0; i < 200; i++) {
    while (running) await pause()
    await processQueuedReads()
    // La lectura que disparó /report en segundo plano puede seguir en curso.
    const pending = await ResultCase.exists({ reads: { $elemMatch: { $or: [{ status: 'running' }, { status: 'queued', queuedAt: { $lte: new Date() } }] } } })
    if (!pending && !running) return
    await pause()
  }
}
