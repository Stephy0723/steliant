import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { statsContext, statsError, statsSeries, discordEvidence, writeStatsHistory } from '../services/matchStats.service.js'
import { readEvidence, archiveEvidence, extractMatchStats, isLocalEvidence } from '../services/matchStatsVision.service.js'
import { validateStats, compareStats, matchExtractedStats } from '../../../shared/matchStats.mjs'
import { notifyUsers } from '../services/tournamentTeams.service.js'
import { config } from '../config/index.js'
import { MATCH_STATS_LIMITS, matchStatsReviewPath } from '../../../shared/matchStatsContract.mjs'

const context = req => statsContext(req.params.id, req.params.matchId, req.user)
function key(req, ctx) {
  const gameNumber = Number(req.params.gameNumber)
  const maxGames = Number(String(statsSeries(ctx.tournament, ctx.match)).replace(/\D/g, '')) || 1
  if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > Math.min(MATCH_STATS_LIMITS.games, maxGames)) throw statsError('Número de partida fuera de la serie.')
  return { tournament: ctx.tournament._id, bracketMatchId: ctx.match.id, gameNumber }
}
function sourceFor(ctx, source) {
  if (source === 'organizer' && ctx.access.organizer) return source
  if (ctx.access.captainTeams.includes(source)) return source
  throw statsError('No puedes enviar un borrador en nombre de ese equipo.', 403)
}
function assertRevision(value) { if (!Number.isInteger(value) || value < 0) throw statsError('Falta la versión del borrador.') }
function assertSameRoster(draft, ctx) {
  const identity = roster => roster.map(p => `${p.teamId}:${p.playerId}`).sort().join('|')
  if (draft.teams.map(t => t.id).join('|') !== ctx.teams.map(t => String(t._id)).join('|') || identity(draft.roster) !== identity(ctx.roster)) throw statsError('El enfrentamiento o el roster cambió. El organizador debe revisar el borrador original.', 409)
}
async function authorizedEvidence(ctx, urls) {
  if (!Array.isArray(urls) || urls.length > MATCH_STATS_LIMITS.images || urls.some(u => typeof u !== 'string' || u.length > 2000)) throw statsError('Máximo cuatro capturas por reporte.')
  const allowed = (await discordEvidence(ctx)).map(e => e.url)
  for (const url of urls) if (!isLocalEvidence(url) && !allowed.includes(url)) throw statsError('Evidencia no autorizada.')
  return allowed
}
export async function getMatchStats(req, res, next) {
  try {
    const ctx = await context(req), filter = key(req, ctx)
    const draft = await MatchStatsDraft.findOne(filter).lean()
    res.json({ draft, roster: ctx.roster, rosterReady: ctx.rosterReady, teams: ctx.teams.map(t => ({ id: String(t._id), name: t.bracketName })), access: ctx.access, discordEvidence: await discordEvidence(ctx),
      tournament: { id: String(ctx.tournament._id), title: ctx.tournament.title }, match: { id: ctx.match.id, a: ctx.match.a, b: ctx.match.b, series: statsSeries(ctx.tournament, ctx.match) },
      capabilities: { vision: config.matchStats.visionEnabled && Boolean(config.ai.providers.gemini.key) } })
  } catch (error) { next(error) }
}
export async function extractStats(req, res, next) {
  try {
    const ctx = await context(req); key(req, ctx)
    if (!ctx.rosterReady) throw statsError('Se necesitan los diez titulares vinculados en el roster congelado.', 409)
    if (req.body?.consent !== true) throw statsError('Debes aceptar el envío de esta captura a Google.')
    const teamIds = ctx.teams.map(t => String(t._id))
    if (!teamIds.includes(req.body.firstSideTeamId)) throw statsError('Indica qué equipo aparece arriba o a la izquierda.')
    const allowed = await authorizedEvidence(ctx, [req.body.evidenceUrl])
    const raw = await extractMatchStats(await readEvidence(req.body.evidenceUrl, allowed))
    const input = matchExtractedStats(raw, ctx.roster, teamIds, req.body.firstSideTeamId)
    const validation = validateStats(input, ctx.roster, teamIds)
    res.json({ ...validation, source: 'gemini', extractedAt: new Date().toISOString() })
  } catch (error) { next(error) }
}
export async function importStatsEvidence(req, res, next) {
  try {
    const ctx = await context(req); key(req, ctx)
    const allowed = await authorizedEvidence(ctx, [req.body?.evidenceUrl])
    res.json({ url: await archiveEvidence(req.body.evidenceUrl, allowed) })
  } catch (error) { next(error) }
}
export async function saveMatchStats(req, res, next) {
  try {
    const ctx = await context(req), filter = key(req, ctx), body = req.body || {}
    if (!ctx.rosterReady) throw statsError('Se necesitan los diez titulares vinculados en el roster congelado.', 409)
    assertRevision(body.revision)
    const source = sourceFor(ctx, body.source)
    if (Array.isArray(body.data?.players) && body.data.players.length > MATCH_STATS_LIMITS.players) throw statsError('El reporte no puede incluir más de diez jugadores.')
    await authorizedEvidence(ctx, body.evidenceUrls || [])
    const validation = validateStats(body.data, ctx.roster, ctx.teams.map(t => String(t._id)))
    if (validation.errors.some(e => e.includes('Valor inválido') || e.includes('MVP inválido'))) throw statsError('Corrige los números inválidos antes de guardar.')
    const submission = { source, authorId: ctx.access.userId, at: new Date().toISOString(), evidenceUrls: body.evidenceUrls || [], data: validation.data }
    let draft = await MatchStatsDraft.findOne(filter).lean()
    if (!draft) {
      if (body.revision !== 0) throw statsError('El borrador cambió. Recarga antes de guardar.', 409)
      try {
        draft = await MatchStatsDraft.create({ ...filter, teams: ctx.teams.map(t => ({ id: String(t._id), name: t.bracketName })), roster: ctx.roster, submissions: [submission], revisions: [{ revision: 1, ...submission }], revision: 1 })
      } catch (error) { if (error.code === 11000) throw statsError('Otro usuario creó el borrador. Recarga antes de guardar.', 409); throw error }
    } else {
      assertSameRoster(draft, ctx)
      if (draft.status !== 'draft') throw statsError('Las estadísticas ya están confirmadas.', 409)
      if (draft.revision >= MATCH_STATS_LIMITS.revisions) throw statsError('Se alcanzó el límite de revisiones de esta partida.', 409)
      draft = await MatchStatsDraft.findOneAndUpdate({ ...filter, revision: body.revision, status: 'draft' }, {
        $set: { submissions: [...draft.submissions.filter(s => s.source !== source), submission] }, $inc: { revision: 1 },
        $push: { revisions: { revision: body.revision + 1, ...submission } },
      }, { new: true, runValidators: true })
      if (!draft) throw statsError('Otro usuario modificó el borrador. Recarga antes de guardar.', 409)
    }
    await notifyUsers(ctx.teams.map(t => String(t.leader)).filter(id => id !== ctx.access.userId), {
      type: 'tournament_stats_pending', title: 'Estadísticas pendientes de revisión',
      message: `${ctx.match.a} vs ${ctx.match.b}: revisa la partida ${filter.gameNumber} de ${ctx.tournament.title}.`,
      link: matchStatsReviewPath(ctx.tournament.publicId || ctx.tournament._id, ctx.match.id, filter.gameNumber),
    }).catch(() => {})
    res.json({ draft, ...validation })
  } catch (error) { next(error) }
}
export async function confirmMatchStats(req, res, next) {
  try {
    const ctx = await context(req), filter = key(req, ctx), body = req.body || {}
    if (body.revision < 1) throw statsError('El borrador cambió. Recarga antes de confirmar.', 409)
    assertRevision(body.revision)
    let draft = await MatchStatsDraft.findOne(filter).lean()
    if (!draft) throw statsError('Guarda primero el borrador.', 404)
    assertSameRoster(draft, ctx)
    if (draft.status === 'confirmed') {
      // A retry can repair a failed history write, but cannot change the decision.
      if (draft.confirmation.userId !== ctx.access.userId) throw statsError('Ya fue confirmado por otra persona.', 409)
      await writeStatsHistory(draft, ctx.tournament)
      return res.json({ draft: await MatchStatsDraft.findById(draft._id).lean() })
    }
    if (body.revision !== draft.revision) throw statsError('El borrador cambió. Recarga antes de confirmar.', 409)
    if (body.reviewed !== true) throw statsError('Confirma que revisaste la captura y todos los datos.')
    const selected = draft.submissions.find(s => s.source === body.source)
    if (!selected) throw statsError('Selecciona el reporte que quieres confirmar.')
    const opponent = !ctx.access.captainTeams.includes(selected.source) && ctx.access.captainTeams.some(id => id !== selected.source)
    if (!ctx.access.organizer && (!opponent || selected.source === 'organizer' || selected.authorId === ctx.access.userId)) throw statsError('Debe confirmar el capitán rival o el organizador.', 403)
    const validation = validateStats(selected.data, draft.roster, draft.teams.map(t => t.id))
    if (validation.errors.length) throw statsError(validation.errors.join(' '), 422)
    const conflicts = draft.submissions.filter(s => s.source !== selected.source).flatMap(s => compareStats(selected.data, s.data))
    const reason = String(body.reason || '').trim().slice(0, 1000)
    if (conflicts.length && (!ctx.access.organizer || reason.length < 10)) throw statsError('Las capturas discrepan. El organizador debe resolverlas e indicar el motivo (mínimo 10 caracteres).', 409)
    const updated = await MatchStatsDraft.findOneAndUpdate({ ...filter, revision: body.revision, status: 'draft' }, {
      $set: { status: 'confirmed', confirmation: { source: selected.source, data: validation.data, userId: ctx.access.userId, role: ctx.access.organizer ? 'organizer' : 'opponent', at: new Date(), revision: body.revision, reason, conflicts, reviewed: true } },
      $inc: { revision: 1 },
    }, { new: true, runValidators: true }).lean()
    if (!updated) throw statsError('El borrador cambió. Recarga y vuelve a revisarlo.', 409)
    await writeStatsHistory(updated, ctx.tournament)
    res.json({ draft: await MatchStatsDraft.findById(updated._id).lean() })
  } catch (error) { next(error) }
}
