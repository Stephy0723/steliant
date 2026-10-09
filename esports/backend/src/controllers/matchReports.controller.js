import { Tournament } from '../models/Tournament.js'
import { MatchResultReport } from '../models/MatchResultReport.js'
import { resolveMatchTeams, statsSeries, statsError } from '../services/matchStats.service.js'
import { isLocalEvidence } from '../services/matchStatsVision.service.js'
import { notifyUsers } from '../services/tournamentTeams.service.js'
import { assertTabAccess, tournamentIdentityFilter } from './tournament.controller.js'
import { discordReportsByMatch, splitBySide } from '../services/discordReports.service.js'
import { casesByMatch } from '../services/matchResults.service.js'

// Reporte de resultados desde la web: el capitán (líder) de cada equipo
// reporta el marcador de su partida con una captura. Si los dos lados
// coinciden queda "listo para confirmar"; si no, "en disputa". En ningún
// caso se escribe el bracket: lo publica el organizador desde la pestaña
// Bracket (mismo camino que sus propios resultados -> onResultsConfirmed).
// El /report de Discord sigue funcionando aparte (TournamentMatch).

const MATCH_PATH = '/mi-equipo/enfrentamiento'
const MATCH_ID_RE = /^[a-z]{2,3}[0-9]*(-r\d+-m\d+|-\d+-\d+)?$|^gf$/
const idOf = v => String(v?._id || v || '')

function seriesRule(series) {
  const max = Number(String(series || 'BO1').replace(/\D/g, '')) || 1
  return { series: `BO${max}`, max, win: Math.ceil((max + 1) / 2) }
}

// Mismas reglas que el JustifyModal del organizador: sin empates, el ganador
// llega exactamente a la meta de la serie y no se pasa del máximo de juegos.
function scoreError(scoreA, scoreB, rule) {
  if (![scoreA, scoreB].every(n => Number.isInteger(n) && n >= 0)) return 'El marcador tiene que ser un número entero.'
  if (scoreA === scoreB) return 'El marcador no puede quedar empatado.'
  if (Math.max(scoreA, scoreB) !== rule.win) return `Serie ${rule.series}: el ganador debe llegar a ${rule.win}.`
  if (scoreA + scoreB > rule.max) return `Una serie ${rule.series} son máximo ${rule.max} partidas.`
  return null
}

function stateOf(reports) {
  const A = reports.find(r => r.side === 'A') || null
  const B = reports.find(r => r.side === 'B') || null
  let status = 'none'
  if (A && B) status = A.scoreA === B.scoreA && A.scoreB === B.scoreB ? 'agreed' : 'disputed'
  else if (A || B) status = 'waiting_rival'
  return { status, A, B }
}

function publicReport(r) {
  if (!r) return null
  return {
    side: r.side, team: idOf(r.team), scoreA: r.scoreA, scoreB: r.scoreB,
    evidenceUrl: r.evidenceUrl, note: r.note, reportedNick: r.reportedNick, updatedAt: r.updatedAt,
  }
}

async function loadTournament(id) {
  const tournament = await Tournament.findOne(tournamentIdentityFilter(id)).lean()
  if (!tournament) throw statsError('Torneo no encontrado.', 404)
  return tournament
}

function assertMatchId(matchId) {
  if (!MATCH_ID_RE.test(String(matchId || ''))) throw statsError('Partida inválida.')
}

/** GET /api/tournaments/:id/bracket/matches/:matchId/report — estado del reporte (capitanes de la partida u organización). */
export async function getMatchReport(req, res, next) {
  try {
    assertMatchId(req.params.matchId)
    const tournament = await loadTournament(req.params.id)
    const { match, teams } = await resolveMatchTeams(tournament, req.params.matchId)
    const mySide = teams.findIndex(t => idOf(t.leader) === idOf(req.user._id))
    if (mySide === -1 && assertTabAccess(tournament, req.user, 'bracket', 'view')) {
      throw statsError('Solo los capitanes de esta partida o la organización pueden ver el reporte.', 403)
    }
    const reports = await MatchResultReport.find({ tournament: tournament._id, matchId: match.id }).lean()
    const state = stateOf(reports)
    const result = tournament.bracketDoc?.results?.[match.id] || null
    const discord = splitBySide((await discordReportsByMatch(tournament, { matchId: match.id })).get(match.id) || [], teams)
    res.json({
      discord,
      // Un capitán puede apelar una vez cada partida ya decidida.
      cases: ((await casesByMatch(tournament._id, match.id)).get(match.id) || [])
        .map(c => ({ ...c, canAppeal: mySide !== -1 && c.state === 'validated' && !c.appealed })),
      match: { id: match.id, a: match.a, b: match.b, series: seriesRule(statsSeries(tournament, match)).series },
      mySide: mySide === -1 ? null : (mySide === 0 ? 'A' : 'B'),
      canReport: tournament.bracketDoc?.status === 'running' && !result?.confirmed && mySide !== -1,
      confirmed: Boolean(result?.confirmed),
      status: state.status,
      A: publicReport(state.A),
      B: publicReport(state.B),
    })
  } catch (err) { next(err) }
}

/** POST /api/tournaments/:id/bracket/matches/:matchId/report — el capitán reporta (o corrige) su lado. */
export async function submitMatchReport(req, res, next) {
  try {
    assertMatchId(req.params.matchId)
    const tournament = await loadTournament(req.params.id)
    if (tournament.bracketDoc?.status !== 'running') {
      throw statsError('El reporte se habilita cuando la organización inicia el torneo.', 409)
    }
    const { match, teams } = await resolveMatchTeams(tournament, req.params.matchId)
    if (tournament.bracketDoc?.results?.[match.id]?.confirmed) {
      throw statsError('Este resultado ya fue confirmado por la organización.', 409)
    }
    const sideIndex = teams.findIndex(t => idOf(t.leader) === idOf(req.user._id))
    if (sideIndex === -1) throw statsError('Solo el capitán de uno de los dos equipos puede reportar esta partida.', 403)
    const side = sideIndex === 0 ? 'A' : 'B'

    const { scoreFor, scoreAgainst, evidenceUrl, note } = req.body || {}
    const mine = Number(scoreFor), theirs = Number(scoreAgainst)
    const scoreA = side === 'A' ? mine : theirs
    const scoreB = side === 'A' ? theirs : mine
    const rule = seriesRule(statsSeries(tournament, match))
    const invalid = scoreError(scoreA, scoreB, rule)
    if (invalid) throw statsError(invalid)
    if (typeof evidenceUrl !== 'string' || !isLocalEvidence(evidenceUrl)) {
      throw statsError('Sube una captura del resultado (JPG, PNG o WebP).')
    }

    const previous = stateOf(await MatchResultReport.find({ tournament: tournament._id, matchId: match.id }).lean())
    await MatchResultReport.findOneAndUpdate(
      { tournament: tournament._id, matchId: match.id, side },
      {
        $set: {
          team: teams[sideIndex]._id, a: match.a, b: match.b, scoreA, scoreB, evidenceUrl,
          note: String(note || '').trim().slice(0, 500),
          reportedBy: req.user._id, reportedNick: req.user.nick || '',
        },
      },
      { upsert: true, new: true, runValidators: true },
    )
    const state = stateOf(await MatchResultReport.find({ tournament: tournament._id, matchId: match.id }).lean())

    // Avisos solo cuando cambia algo que le importa al otro: no re-avisar al
    // organizador si un capitán reenvía el mismo marcador.
    const myTeam = teams[sideIndex], rival = teams[1 - sideIndex]
    const score = `${match.a} ${scoreA} - ${scoreB} ${match.b}`
    const meta = { tournamentId: String(tournament._id), tournamentPublicId: tournament.publicId || '', tournamentTitle: tournament.title, matchId: match.id }
    if (state.status === 'waiting_rival') {
      await notifyUsers([rival.leader], {
        type: 'tournament_result_reported',
        title: 'Resultado reportado',
        message: `${myTeam.bracketName} reportó ${score} en ${tournament.title}. Reporta tu marcador para confirmarlo.`,
        link: MATCH_PATH,
        meta: {
          ...meta, teamName: rival.bracketName, reporterTeamName: myTeam.bracketName,
          teamScore: side === 'A' ? scoreB : scoreA, reporterScore: mine,
          evidenceCount: 1, evidenceUrls: [evidenceUrl], matchPath: MATCH_PATH,
        },
      })
    } else if (state.status !== previous.status || state.status === 'disputed') {
      const link = `/organizador/torneo/${tournament._id}/gestionar/bracket`
      await notifyUsers([tournament.organizer].filter(Boolean), state.status === 'agreed'
        ? { type: 'tournament_result_review', title: 'Resultado listo para confirmar', message: `${tournament.title}: ambos capitanes reportaron ${score}. Solo falta que lo publiques.`, link, meta }
        : { type: 'tournament_result_review', title: 'Disputa de resultado', message: `${tournament.title}: ${match.a} vs ${match.b} reportaron marcadores distintos. Revisa las dos capturas.`, link, meta })
      if (state.status === 'disputed') {
        await notifyUsers([myTeam.leader, rival.leader], {
          type: 'tournament_result_disputed',
          title: 'Resultado en disputa',
          message: `Los marcadores de ${match.a} vs ${match.b} no coinciden. La organización revisará las capturas; puedes corregir tu reporte mientras tanto.`,
          link: MATCH_PATH,
          meta,
        })
      }
    }

    res.status(201).json({ status: state.status, mySide: side, A: publicReport(state.A), B: publicReport(state.B) })
  } catch (err) { next(err) }
}

/** GET /api/tournaments/:id/bracket/reports — todos los reportes de equipos (pestaña Bracket). */
export async function listMatchReports(req, res, next) {
  try {
    const tournament = await loadTournament(req.params.id)
    const permissionError = assertTabAccess(tournament, req.user, 'bracket', 'view')
    if (permissionError) return res.status(permissionError.status).json({ message: permissionError.message })
    const reports = await MatchResultReport.find({ tournament: tournament._id }).sort({ updatedAt: -1 }).lean()
    const byMatch = new Map()
    for (const r of reports) byMatch.set(r.matchId, [...(byMatch.get(r.matchId) || []), r])
    const results = tournament.bracketDoc?.results || {}
    const matches = [...byMatch.entries()].map(([matchId, list]) => {
      const state = stateOf(list)
      const any = state.A || state.B
      return {
        matchId, a: any.a, b: any.b, status: state.status,
        confirmed: Boolean(results[matchId]?.confirmed),
        A: publicReport(state.A), B: publicReport(state.B),
        updatedAt: list[0].updatedAt,
      }
    })
    // /report de Discord, por partida del bracket y lado.
    const discord = []
    const cases = await casesByMatch(tournament._id)
    for (const [matchId, list] of await discordReportsByMatch(tournament)) {
      const teams = await resolveMatchTeams(tournament, matchId).then(r => r.teams).catch(() => null)
      if (!teams) continue
      discord.push({
        matchId, a: teams[0].bracketName, b: teams[1].bracketName,
        confirmed: Boolean(results[matchId]?.confirmed),
        ...splitBySide(list, teams),
        cases: cases.get(matchId) || [],
        updatedAt: list[list.length - 1].reportedAt,
      })
    }
    discord.sort((x, y) => new Date(y.updatedAt) - new Date(x.updatedAt))
    res.json({ reports: matches, discord })
  } catch (err) { next(err) }
}
