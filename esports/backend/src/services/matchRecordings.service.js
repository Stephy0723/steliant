import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { DATA_DIR } from './dataStore.service.js'
import { MatchRecording } from '../models/MatchRecording.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { Tournament } from '../models/Tournament.js'
import { ResultCase } from '../models/ResultCase.js'
import { User } from '../models/User.js'
import { statsError } from './matchStats.service.js'

// Grabaciones de voz de las partidas (sala de cada equipo, /start-match →
// /report). El bot las sube por el CRM (discord-bot/services/recordingUploader.js);
// aquí se guardan en disco con su partida y su equipo, se entregan solo al
// árbitro del torneo desde el caso de "Resultados por revisar" y se borran
// solas al vencer el plazo de conservación.

const idOf = v => String(v?._id || v || '')
const DISCORD_ID = /^\d{5,25}$/
const OPEN_CASE = ['analyzing', 'pending_review', 'arbitration']
const safeSegment = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)

// Una ruta relativa cuenta desde backend/, igual que en scripts/backup.sh.
export function recordingsRoot() {
  return config.matchRecordings.dir ? path.resolve(path.dirname(DATA_DIR), config.matchRecordings.dir) : path.join(DATA_DIR, 'recordings')
}

// Al arrancar: la carpeta tiene que existir y aceptar escritura. Si no, las
// subidas del bot fallarian una por una en silencio; mejor avisarlo una vez.
export async function checkRecordingsDir() {
  const root = recordingsRoot()
  try {
    await fsp.mkdir(root, { recursive: true })
    const probe = path.join(root, `.write-test-${process.pid}`)
    await fsp.writeFile(probe, 'ok')
    await fsp.rm(probe, { force: true })
    console.log(`[match-recordings] Grabaciones de voz en ${root} (se borran a los ${config.matchRecordings.retentionDays} dias sin reclamo)`)
    return { ok: true, root }
  } catch (error) {
    console.error(`[match-recordings] ERROR: no se puede escribir en ${root} (${error.message}). Las grabaciones de voz NO se van a guardar hasta corregir MATCH_RECORDINGS_DIR o los permisos.`)
    return { ok: false, root, error: error.message }
  }
}

// <raíz>/<torneo>/<partida del bracket>/P<n>-<equipo>-<reporte>
function folderFor(match) {
  const bracket = safeSegment(match.bracketMatchId) || 'sin-bracket'
  return path.posix.join(idOf(match.tournament), bracket, `P${match.gameNumber || 0}-${idOf(match.team)}-${idOf(match._id)}`)
}

function absolute(folder, file = '') {
  const root = recordingsRoot()
  const target = path.resolve(root, folder, file)
  if (target !== root && !target.startsWith(root + path.sep)) throw statsError('Ruta de grabación inválida.', 400)
  return target
}

function state(doc) {
  return {
    id: idOf(doc._id),
    status: doc.status,
    folder: doc.folder,
    missingTracks: doc.tracks.filter(t => !t.receivedAt).map(t => t.discordUserId),
  }
}

// Ficha legible junto a los .ogg: la carpeta se entiende sola aunque se
// copie fuera del servidor (torneo, partida, equipo, quién es cada pista).
async function writeManifest(doc) {
  const tournament = await Tournament.findById(doc.tournament).select('title publicId').lean()
  const manifest = {
    tournament: { id: idOf(doc.tournament), publicId: tournament?.publicId || '', title: tournament?.title || '' },
    tournamentMatchId: idOf(doc.tournamentMatch),
    bracketMatchId: doc.bracketMatchId,
    gameNumber: doc.gameNumber,
    team: { id: idOf(doc.team), name: doc.teamName },
    rivalName: doc.rivalName,
    matchStatus: doc.matchStatus,
    voiceChannel: { id: doc.channelId, name: doc.channelName },
    startedAt: doc.startedAt,
    stoppedAt: doc.stoppedAt,
    durationMs: doc.durationMs,
    format: doc.format,
    expiresAt: doc.expiresAt,
    tracks: doc.tracks.map(t => ({
      file: t.file, discordUserId: t.discordUserId, username: t.username, displayName: t.displayName,
      userId: t.user ? idOf(t.user) : '', bytes: t.bytes, sha256: t.sha256, durationMs: t.durationMs,
      spoke: t.voicePackets > 0, received: Boolean(t.receivedAt),
    })),
    screenShareLog: doc.screenShareLog,
  }
  await fsp.mkdir(absolute(doc.folder), { recursive: true })
  await fsp.writeFile(absolute(doc.folder, 'recording.json'), JSON.stringify(manifest, null, 2), 'utf-8')
}

const asDate = value => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

/**
 * POST /api/bots/matches/:matchId/recording — el bot avisa que terminó una
 * grabación y qué pistas trae. Responde qué pistas faltan por subir.
 * Idempotente: un reintento solo pide lo que todavía no llegó.
 */
export async function saveRecordingMetadata(matchId, body = {}) {
  if (!mongoose.isValidObjectId(matchId)) throw Object.assign(statsError('Partida no encontrada.', 404), { payload: { error: 'match_not_found' } })
  const match = await TournamentMatch.findById(matchId).lean()
  if (!match) throw Object.assign(statsError('Partida no encontrada.', 404), { payload: { error: 'match_not_found' } })

  const incoming = (Array.isArray(body.tracks) ? body.tracks : [])
    .filter(t => DISCORD_ID.test(String(t?.discordUserId || '')))
    .slice(0, 20)
  const users = await User.find({ 'discord.id': { $in: incoming.map(t => String(t.discordUserId)) } }).select('_id discord.id').lean()
  const userByDiscord = new Map(users.map(u => [u.discord.id, u._id]))

  let doc = await MatchRecording.findOne({ tournamentMatch: match._id })
  if (doc?.status === 'deleted') throw statsError('Esta grabación ya se borró por vencimiento.', 410)
  if (!doc) doc = new MatchRecording({ tournamentMatch: match._id, folder: folderFor(match) })

  const stoppedAt = asDate(body.stoppedAt) || new Date()
  Object.assign(doc, {
    tournament: match.tournament,
    team: match.team,
    teamName: match.teamNameSnapshot || '',
    rivalName: match.rivalName || '',
    bracketMatchId: match.bracketMatchId || '',
    gameNumber: match.gameNumber || null,
    matchStatus: match.status,
    botRecordId: String(body.recordId || '').slice(0, 40),
    guildId: String(body.guildId || match.guildId || '').slice(0, 40),
    channelId: String(body.channelId || match.voiceChannelId || '').slice(0, 40),
    channelName: String(body.channelName || match.channelName || '').slice(0, 120),
    startedAt: asDate(body.startedAt) || match.startedAt,
    stoppedAt,
    durationMs: Math.max(0, Number(body.durationMs) || 0),
    format: 'ogg-opus',
    screenShareLog: (Array.isArray(body.screenShareLog) ? body.screenShareLog : []).slice(0, 500).map(e => ({
      userId: String(e?.userId || '').slice(0, 25), username: String(e?.username || '').slice(0, 80),
      event: String(e?.event || '').slice(0, 20), at: asDate(e?.at),
    })),
    expiresAt: doc.expiresAt || new Date(stoppedAt.getTime() + config.matchRecordings.retentionDays * 86400000),
  })

  const previous = new Map(doc.tracks.map(t => [t.discordUserId, t]))
  doc.tracks = incoming.map((t) => {
    const discordUserId = String(t.discordUserId)
    const sha256 = /^[a-f0-9]{64}$/.test(String(t.sha256 || '')) ? String(t.sha256) : ''
    const before = previous.get(discordUserId)
    // Si la pista ya llegó con el mismo contenido, no se vuelve a pedir.
    const kept = before?.receivedAt && before.sha256 === sha256
    return {
      discordUserId,
      username: String(t.username || '').slice(0, 80),
      displayName: String(t.displayName || '').slice(0, 80),
      user: userByDiscord.get(discordUserId) || null,
      file: `${discordUserId}.ogg`,
      bytes: kept ? before.bytes : Math.max(0, Number(t.bytes) || 0),
      sha256,
      durationMs: Math.max(0, Number(t.durationMs) || 0),
      voicePackets: Math.max(0, Number(t.voicePackets) || 0),
      receivedAt: kept ? before.receivedAt : null,
    }
  })
  doc.status = doc.tracks.every(t => t.receivedAt) ? 'stored' : 'uploading'
  await doc.save()
  await writeManifest(doc)
  return state(doc)
}

/**
 * PUT /api/bots/matches/:matchId/recording/tracks/:discordUserId — una
 * pista .ogg (cuerpo crudo audio/ogg). Se escribe en streaming, se verifica
 * el sha256 y recién entonces reemplaza al archivo final.
 */
export async function receiveRecordingTrack(matchId, discordUserId, req) {
  if (!mongoose.isValidObjectId(matchId) || !DISCORD_ID.test(String(discordUserId))) throw statsError('Pista no encontrada.', 404)
  if (!req.is('audio/ogg')) throw statsError('La pista debe ser audio/ogg.', 415)
  const doc = await MatchRecording.findOne({ tournamentMatch: matchId })
  if (!doc || doc.status === 'deleted') throw Object.assign(statsError('Primero hay que registrar la grabación.', 404), { payload: { error: 'recording_not_found' } })
  const track = doc.tracks.find(t => t.discordUserId === String(discordUserId))
  if (!track) throw Object.assign(statsError('Esa pista no está en la grabación.', 404), { payload: { error: 'track_not_found' } })

  const maxBytes = config.matchRecordings.maxTrackMb * 1024 * 1024
  const finalPath = absolute(doc.folder, track.file)
  const partPath = `${finalPath}.${crypto.randomBytes(4).toString('hex')}.part`
  await fsp.mkdir(path.dirname(finalPath), { recursive: true })

  const hash = crypto.createHash('sha256')
  let bytes = 0
  let head = Buffer.alloc(0)
  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(partPath)
      let failure = null
      const fail = (error) => { failure ||= error; req.unpipe?.(out); out.destroy() }
      req.on('data', (chunk) => {
        if (failure) return
        bytes += chunk.length
        if (head.length < 4) head = Buffer.concat([head, chunk]).subarray(0, 4)
        if (bytes > maxBytes) return fail(statsError(`La pista supera ${config.matchRecordings.maxTrackMb} MB.`, 413))
        hash.update(chunk)
      })
      req.on('error', fail)
      out.on('error', fail)
      // Se resuelve en 'close' (no en 'finish'): recién ahí el archivo está
      // cerrado y se puede renombrar o borrar (en Windows, antes no).
      out.on('close', () => {
        if (failure) reject(failure)
        else if (out.writableFinished) resolve()
        else reject(statsError('La pista no se terminó de escribir.', 500))
      })
      req.pipe(out)
    })
    if (head.toString('ascii') !== 'OggS') throw statsError('El archivo no es un Ogg válido.', 422)
    const digest = hash.digest('hex')
    const expected = String(req.headers['x-track-sha256'] || track.sha256 || '')
    if (expected && expected !== digest) throw statsError('La pista llegó incompleta (sha256 distinto). Se reintenta.', 422)
    await fsp.rename(partPath, finalPath)

    const now = new Date()
    await MatchRecording.updateOne(
      { _id: doc._id, 'tracks.discordUserId': track.discordUserId },
      { $set: { 'tracks.$.receivedAt': now, 'tracks.$.bytes': bytes, 'tracks.$.sha256': digest } },
    )
  } catch (error) {
    await fsp.rm(partPath, { force: true }).catch(() => {})
    throw error
  }

  const fresh = await MatchRecording.findById(doc._id)
  if (fresh.tracks.every(t => t.receivedAt) && fresh.status !== 'stored') {
    fresh.status = 'stored'
    await fresh.save()
  }
  await writeManifest(fresh)
  return state(fresh)
}

// Todas las grabaciones de una partida de la serie (los dos equipos, y los
// intentos anteriores si el árbitro la mandó a repetir).
async function caseRecordings(c) {
  const reportIds = [
    ...(c.reports || []).map(r => r.reportId),
    ...(c.history || []).flatMap(h => (h.reports || []).map(r => r.reportId)),
  ].filter(Boolean)
  return MatchRecording.find({
    status: 'stored',
    $or: [
      { tournament: c.tournament, bracketMatchId: c.bracketMatchId, gameNumber: c.gameNumber },
      ...(reportIds.length ? [{ tournamentMatch: { $in: reportIds } }] : []),
    ],
  }).sort({ startedAt: 1 }).lean()
}

/** Para el detalle del caso. Solo quien puede arbitrar ve (y oye) las pistas. */
export async function recordingsForCase(c, { canListen }) {
  const docs = await caseRecordings(c)
  if (!canListen) return { recordings: [], hiddenRecordings: docs.length }
  const voided = new Set((await TournamentMatch.find({ _id: { $in: docs.map(d => d.tournamentMatch) }, voidedAt: { $ne: null } }).select('_id').lean()).map(m => idOf(m._id)))
  const users = await User.find({ _id: { $in: docs.flatMap(d => d.tracks.map(t => t.user)).filter(Boolean) } }).select('nick').lean()
  const nickOf = new Map(users.map(u => [idOf(u._id), u.nick]))
  return {
    hiddenRecordings: 0,
    recordings: docs.map(d => ({
      id: idOf(d._id),
      teamId: idOf(d.team),
      teamName: d.teamName,
      gameNumber: d.gameNumber,
      matchStatus: d.matchStatus,
      voided: voided.has(idOf(d.tournamentMatch)),
      startedAt: d.startedAt,
      stoppedAt: d.stoppedAt,
      durationMs: d.durationMs,
      expiresAt: d.expiresAt,
      screenShareOff: (d.screenShareLog || []).filter(e => e.event === 'screen_off').map(e => ({ username: e.username, at: e.at })),
      tracks: d.tracks.filter(t => t.receivedAt).map(t => ({
        discordUserId: t.discordUserId,
        name: (t.user && nickOf.get(idOf(t.user))) || t.displayName || t.username || t.discordUserId,
        discordName: t.username,
        playerId: t.user ? idOf(t.user) : '',
        bytes: t.bytes,
        durationMs: t.durationMs,
        spoke: t.voicePackets > 0,
      })),
    })),
  }
}

/**
 * Archivo de una pista para el árbitro: valida que la grabación sea de la
 * partida del caso y deja constancia en la auditoría del caso.
 */
export async function caseTrackFile(c, recordingId, discordUserId, user, { audit = true } = {}) {
  if (!mongoose.isValidObjectId(recordingId) || !DISCORD_ID.test(String(discordUserId))) throw statsError('Grabación no encontrada.', 404)
  const docs = await caseRecordings(c)
  const doc = docs.find(d => idOf(d._id) === String(recordingId))
  const track = doc?.tracks.find(t => t.discordUserId === String(discordUserId) && t.receivedAt)
  if (!track) throw statsError('Grabación no encontrada.', 404)
  const filePath = absolute(doc.folder, track.file)
  if (!fs.existsSync(filePath)) throw statsError('El archivo de la grabación no está en el servidor.', 404)
  if (audit) {
    await ResultCase.updateOne({ _id: c._id }, {
      $push: { audit: { at: new Date(), actor: idOf(user._id), actorName: user.nick || 'Árbitro', action: 'recording_listened', detail: `Escuchó la grabación de ${track.displayName || track.username || discordUserId} (${doc.teamName}).` } },
    })
  }
  return { filePath, fileName: `${safeSegment(doc.teamName) || 'equipo'}-P${doc.gameNumber || 0}-${safeSegment(track.username) || discordUserId}.ogg` }
}

// ── Vencimiento ──
// Sin reclamo: se borra a los retentionDays de terminar la partida. Con
// caso abierto no se borra; si hubo árbitro o apelación, el plazo cuenta
// desde la decisión.
export async function purgeExpiredRecordings(now = new Date()) {
  const due = await MatchRecording.find({ status: { $ne: 'deleted' }, expiresAt: { $lte: now } }).limit(50)
  const keepMs = config.matchRecordings.retentionDays * 86400000
  let deleted = 0
  for (const doc of due) {
    const c = doc.bracketMatchId
      ? await ResultCase.findOne({ tournament: doc.tournament, bracketMatchId: doc.bracketMatchId, gameNumber: doc.gameNumber }).select('state source decidedAt case.appealedAt').lean()
      : null
    let keepUntil = null
    if (c && OPEN_CASE.includes(c.state)) keepUntil = new Date(now.getTime() + 86400000)
    else if (c && (c.source === 'arbiter' || c.case?.appealedAt) && c.decidedAt) keepUntil = new Date(new Date(c.decidedAt).getTime() + keepMs)
    if (keepUntil && keepUntil > now) {
      await MatchRecording.updateOne({ _id: doc._id }, { $set: { expiresAt: keepUntil } })
      continue
    }
    await fsp.rm(absolute(doc.folder), { recursive: true, force: true })
    await MatchRecording.updateOne({ _id: doc._id }, { $set: { status: 'deleted', deletedAt: now } })
    deleted += 1
  }
  return { checked: due.length, deleted }
}

let timer = null, running = false
async function tick() {
  if (running) return
  running = true
  try { await purgeExpiredRecordings() }
  catch (error) { console.error('[match-recordings]', error.message) }
  finally { running = false }
}
export function startRecordingRetentionJob() {
  if (timer) return
  checkRecordingsDir()
  timer = setInterval(tick, 60 * 60 * 1000)
  timer.unref?.()
  setTimeout(tick, 60 * 1000).unref?.()
}
export async function stopRecordingRetentionJob() {
  if (timer) clearInterval(timer)
  timer = null
  while (running) await new Promise(resolve => setTimeout(resolve, 50))
}
