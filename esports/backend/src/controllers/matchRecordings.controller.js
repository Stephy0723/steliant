import { saveRecordingMetadata, receiveRecordingTrack } from '../services/matchRecordings.service.js'

// Grabaciones de voz que sube el bot por el CRM (ver services/matchRecordings.service.js).

/** POST /api/bots/matches/:matchId/recording — metadata + pistas esperadas. */
export async function postRecording(req, res, next) {
  try { res.json(await saveRecordingMetadata(req.params.matchId, req.body || {})) } catch (err) { next(err) }
}

/** PUT /api/bots/matches/:matchId/recording/tracks/:discordUserId — cuerpo audio/ogg. */
export async function putRecordingTrack(req, res, next) {
  try { res.json(await receiveRecordingTrack(req.params.matchId, req.params.discordUserId, req)) } catch (err) { next(err) }
}
