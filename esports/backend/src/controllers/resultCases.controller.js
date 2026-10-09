import { listReview, caseDetail, takeCase, decideCase, appealCase, caseRecordingTrack } from '../services/resultArbitration.service.js'

// "Resultados por revisar" y arbitraje (ver services/resultArbitration.service.js).

/** GET /api/results/review?torneo=&estado=&sinArbitro=1 */
export async function getReview(req, res, next) {
  try {
    res.json(await listReview(req.user, {
      tournament: req.query.torneo || null,
      state: String(req.query.estado || ''),
      unassigned: req.query.sinArbitro === '1',
    }))
  } catch (err) { next(err) }
}

/** GET /api/results/cases/:id */
export async function getCase(req, res, next) {
  try { res.json(await caseDetail(req.params.id, req.user)) } catch (err) { next(err) }
}

/** POST /api/results/cases/:id/take { to? } — tomar (o, el organizador, reasignar). */
export async function postTake(req, res, next) {
  try { res.json(await takeCase(req.params.id, req.user, { to: String(req.body?.to || '') })) } catch (err) { next(err) }
}

/** POST /api/results/cases/:id/decide { decision, winnerTeamId?, teamId?, minutes?, reason } */
export async function postDecide(req, res, next) {
  try { res.json(await decideCase(req.params.id, req.user, req.body || {})) } catch (err) { next(err) }
}

/** POST /api/results/cases/:id/appeal { reason } — capitán de uno de los equipos. */
export async function postAppeal(req, res, next) {
  try { res.json(await appealCase(req.params.id, req.user, req.body || {})) } catch (err) { next(err) }
}

/**
 * GET /api/results/cases/:id/recordings/:recordingId/tracks/:discordUserId
 * Pista .ogg para el árbitro. Cada descarga completa queda en la auditoría
 * del caso (las peticiones Range del reproductor no la repiten).
 */
export async function getRecordingTrack(req, res, next) {
  try {
    const range = String(req.headers.range || '')
    const audit = !range || /^bytes=0-$/.test(range)
    const { filePath, fileName } = await caseRecordingTrack(req.params.id, req.params.recordingId, req.params.discordUserId, req.user, { audit })
    res.set('Cache-Control', 'private, no-store')
    res.set('Content-Disposition', `inline; filename="${fileName}"`)
    res.type('audio/ogg')
    res.sendFile(filePath, { dotfiles: 'deny' }, err => { if (err && !res.headersSent) next(err) })
  } catch (err) { next(err) }
}
