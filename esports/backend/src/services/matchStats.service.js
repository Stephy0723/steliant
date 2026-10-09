import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { PlayerMatch } from '../models/PlayerMatch.js'
import { buildSingleBracket, buildDoubleBracket, roundRobinMatches, groupStage, swissPairings, computeStandings, normalizeFormat } from '../../../shared/bracketEngine.mjs'
import { isMobileLegends, STAT_FIELDS } from '../../../shared/matchStats.mjs'
import { discordReportsByMatch } from './discordReports.service.js'

export const statsError = (message, status = 400) => Object.assign(new Error(message), { status })
const idOf = v => String(v?._id || v || '')
const flattenRounds = rounds => rounds.flatMap(r => r.matches.map(m => ({ ...m, roundName: r.name })))
export function statsSeries(t, match) {
  const name = String(match.roundName || '').toLowerCase()
  const key = name.includes('gran final') || name === 'final' ? 'final' : name.includes('semi') ? 'semifinal' : name.includes('cuartos') ? 'cuartos' : name.includes('octavos') ? 'octavos' : /ronda de (\d+)/.test(name) ? `ronda_${/ronda de (\d+)/.exec(name)[1]}` : null
  return (key && t.competition?.seriesByRound?.[key]) || t.competition?.defaultSeries || 'BO1'
}
export function statsMatches(t) {
  const doc = t.bracketDoc || {}, teams = doc.teams || [], results = doc.results || {}, c = t.competition || {}
  if (teams.length < 2) return []
  const format = doc.format || normalizeFormat(t.format)
  if (format === 'roundrobin') return roundRobinMatches(teams)
  if (format === 'swiss') return flattenRounds(swissPairings(teams, results, c.swissRounds || Math.max(3, Math.ceil(Math.log2(teams.length)) + 1)).rounds)
  if (format === 'double') {
    const b = buildDoubleBracket(teams, results)
    return flattenRounds([...b.wbRounds, ...b.lbRounds]).concat({ ...b.grandFinal, roundName: 'Gran Final' })
  }
  if (format === 'groups') {
    const groups = groupStage(teams, c.groups || Math.max(1, Math.round(teams.length / 4)))
    const standings = groups.map(g => computeStandings(g.teams, results, g.matches.map(m => m.id), c.scoring || {}))
    const qualifiers = []
    for (let pos = 0; pos < (c.advancePerGroup || 2); pos++) for (const rows of standings) if (rows[pos]) qualifiers.push(rows[pos].name)
    const groupMatches = groups.flatMap(g => g.matches)
    // Playoffs become eligible only after the group stage is confirmed.
    return groupMatches.concat(qualifiers.length >= 2 && groupMatches.every(m => results[m.id]?.confirmed) ? flattenRounds(buildSingleBracket(qualifiers, results, 'gpo').rounds) : [])
  }
  return flattenRounds(buildSingleBracket(teams, results, 'se').rounds)
}
export function statsAccess(t, teams, user) {
  const organizer = idOf(t.organizer) === idOf(user._id) || user.role === 'admin' || user.isAdmin === true
  const captainTeams = teams.filter(team => idOf(team.leader) === idOf(user._id)).map(team => idOf(team._id))
  return { organizer, captainTeams, userId: idOf(user._id) }
}
// Partida del bracket + los dos equipos inscritos que la juegan (por nombre o
// tag del bracket). Lo usan las estadísticas y el reporte de resultados web.
export async function resolveMatchTeams(tournament, matchId) {
  const match = statsMatches(tournament).find(m => m.id === matchId)
  if (!match || [match.a, match.b].some(n => !n || ['BYE', 'Por definir'].includes(n))) throw statsError('El enfrentamiento todavía no tiene dos equipos definidos.', 409)
  const registrations = (tournament.registrations || []).filter(r => !['withdrawn', 'disqualified'].includes(r.status))
  const docs = await Team.find({ _id: { $in: registrations.map(r => r.team).filter(Boolean) } }).select('name tag leader').lean()
  const teams = [match.a, match.b].map(name => {
    const hits = docs.filter(team => {
      const reg = registrations.find(r => idOf(r.team) === idOf(team._id))
      return [team.name, team.tag, reg?.teamMeta?.name, reg?.teamMeta?.tag].includes(name)
    })
    if (hits.length !== 1) throw statsError('No se pudo identificar inequívocamente a los equipos inscritos.', 409)
    return { ...hits[0], bracketName: name }
  })
  if (idOf(teams[0]._id) === idOf(teams[1]._id)) throw statsError('Equipos inválidos.', 409)
  return { match, registrations, teams }
}
// Titulares del roster congelado en el check-in (rosterSnapshot) de los dos equipos.
export function frozenRoster(teams, registrations) {
  const roster = teams.flatMap(team => {
    const reg = registrations.find(r => idOf(r.team) === idOf(team._id))
    const snapshot = reg?.rosterSnapshot || []
    const starters = snapshot.filter(p => /^titular-[1-5]$/.test(p.slot) || (snapshot.length === 5 && !p.slot))
    return starters.map(p => ({ playerId: idOf(p.userId), nick: p.nick, teamId: idOf(team._id) }))
  })
  const rosterReady = roster.length === 10 && new Set(roster.map(p => p.playerId)).size === 10 && roster.every(p => mongoose.isValidObjectId(p.playerId)) && teams.every(t => roster.filter(p => p.teamId === idOf(t._id)).length === 5)
  return { roster, rosterReady }
}
export async function statsContext(tid, matchId, user) {
  const ids = [{ publicId: String(tid).toUpperCase() }, { tournamentCode: String(tid).toUpperCase() }, { legacyPublicId: String(tid).toUpperCase() }]
  if (mongoose.isValidObjectId(tid)) ids.push({ _id: tid })
  const tournament = await Tournament.findOne({ $or: ids }).lean()
  if (!tournament) throw statsError('Torneo no encontrado.', 404)
  if (!isMobileLegends(tournament.game)) throw statsError('Las estadísticas por captura están disponibles para Mobile Legends.', 422)
  const { match, registrations, teams } = await resolveMatchTeams(tournament, matchId)
  const access = statsAccess(tournament, teams, user)
  if (!access.organizer && !access.captainTeams.length) throw statsError('Solo los capitanes de estos equipos o el organizador pueden revisar estadísticas.', 403)
  return { tournament, match, teams, access, ...frozenRoster(teams, registrations) }
}
// Capturas de /report de esta partida (ya copiadas a /uploads cuando se pudo).
export async function discordEvidence(ctx) {
  const reports = (await discordReportsByMatch(ctx.tournament, { matchId: ctx.match.id })).get(ctx.match.id) || []
  return reports.slice(-30).reverse().flatMap(r => r.evidence.map((e, i) => ({
    id: `${r.id}:${i}`, teamId: r.team, url: e.url, name: e.name || e.key, key: e.key, gameNumber: r.gameNumber, date: r.reportedAt,
  })))
}
export async function writeStatsHistory(draft, tournament) {
  // The immutable confirmation is committed first. Retrying after a partial
  // failure only upserts the same ten keys; extraction never reaches here.
  if (draft.status !== 'confirmed' || !draft.confirmation) throw statsError('Falta confirmación humana.', 409)
  const { data, userId, at } = draft.confirmation
  for (const row of data.players) {
    const opponent = draft.teams.find(t => t.id !== row.teamId)
    const values = {
      player: row.playerId, team: row.teamId, tournament: draft.tournament,
      statsDraft: draft._id, bracketMatchId: draft.bracketMatchId, gameNumber: draft.gameNumber,
      game: tournament.game, mode: 'Torneo', source: 'tournament', opponentName: opponent.name,
      result: data.winnerTeamId === row.teamId ? 'win' : 'loss', character: row.character,
      ...Object.fromEntries(Object.keys(STAT_FIELDS).map(k => [k, row[k]])), mvp: row.mvp,
      kda: ['kills', 'deaths', 'assists'].map(k => row[k] ?? '—').join('/'),
      rating: null, durationMinutes: null, playedAt: at, createdBy: mongoose.isValidObjectId(userId) ? userId : null,
      notes: `Estadísticas confirmadas · ${tournament.title} · partida ${draft.gameNumber}`,
    }
    try { await PlayerMatch.updateOne({ statsDraft: draft._id, player: row.playerId }, { $setOnInsert: values }, { upsert: true, runValidators: true }) }
    catch (error) { if (error.code !== 11000) throw error }
  }
  await MatchStatsDraft.updateOne({ _id: draft._id, status: 'confirmed' }, { $set: { historyWrittenAt: new Date(), historyRetryAt: null, historyError: '' } })
}
