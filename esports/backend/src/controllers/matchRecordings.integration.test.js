import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { ResultCase } from '../models/ResultCase.js'
import { MatchRecording } from '../models/MatchRecording.js'
import { saveRecordingMetadata, receiveRecordingTrack, purgeExpiredRecordings } from '../services/matchRecordings.service.js'
import { caseDetail, caseRecordingTrack } from '../services/resultArbitration.service.js'

// Una pista Ogg mínima válida (OpusHead + OpusTags + audio): basta con que
// empiece con "OggS"; la reproducción real se probó aparte en Chrome.
const ogg = (seed) => Buffer.concat([Buffer.from('OggS'), crypto.createHash('sha256').update(seed).digest(), Buffer.alloc(200, seed.length)])
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex')
const upload = (buffer, headers = {}) => Object.assign(Readable.from([buffer]), {
  headers: { 'content-type': 'audio/ogg', ...headers },
  is: type => (type === 'audio/ogg' ? 'audio/ogg' : false),
})

test('Mongo: la voz de la partida queda guardada con partida y equipo, solo la oye el árbitro y vence', { skip: process.env.MATCH_STATS_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_recordings_test_${process.pid}_${Date.now()}`
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gg-recordings-'))
  const previousDir = config.matchRecordings.dir
  config.matchRecordings.dir = dir
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  try {
    const oid = () => new mongoose.Types.ObjectId()
    const owner = oid(), viewer = oid(), admin = oid(), player = oid(), tid = oid(), a = oid(), b = oid()
    // playerCode/internalCode propios: si el indice unico de Mongoose ya se
    // construyo, varios null chocan (E11000) y el test fallaba a ratos.
    await User.collection.insertMany([
      { _id: owner, nick: 'Orga', email: 'orga@t.gg', role: 'user' },
      { _id: viewer, nick: 'Mira', email: 'mira@t.gg', role: 'user' },
      { _id: admin, nick: 'Admin', email: 'admin@t.gg', role: 'admin' },
      { _id: player, nick: 'ShadowKing', email: 'p@t.gg', role: 'user', discord: { id: '100000001', username: 'shadow' } },
    ].map((u, i) => ({ ...u, playerCode: `REC-U${i}`, internalCode: `REC-U${i}` })))
    await Team.collection.insertMany([
      { _id: a, name: 'Neoxis', tag: 'NEO', leader: player, members: [player], publicCode: 'REC-A', internalCode: 'REC-A', teamInviteCode: 'REC-A' },
      { _id: b, name: 'Red Wolves', tag: 'RW', leader: oid(), members: [], publicCode: 'REC-B', internalCode: 'REC-B', teamInviteCode: 'REC-B' },
    ])
    await Tournament.collection.insertOne({
      _id: tid, publicId: 'REC-TEST', organizer: owner, title: 'Legends', game: 'Mobile Legends: Bang Bang', status: 'ongoing',
      staffMembers: [{ user: viewer, status: 'accepted', role: 'Moderador', permissions: { resultados: 'view' } }],
      bracketDoc: { format: 'single', published: true, status: 'running', teams: ['Neoxis', 'Red Wolves'], results: {} },
      registrations: [{ team: a, status: 'checked_in' }, { team: b, status: 'checked_in' }],
    })
    const match = await TournamentMatch.create({
      tournament: tid, team: a, teamNameSnapshot: 'Neoxis', rivalName: 'Red Wolves', status: 'completed',
      bracketMatchId: 'se-r0-m0', gameNumber: 1, voiceChannelId: '555', channelName: 'Neoxis voz', startedAt: new Date(),
    })
    const rc = await ResultCase.create({
      tournament: tid, bracketMatchId: 'se-r0-m0', gameNumber: 1, teams: [{ id: String(a), name: 'Neoxis' }, { id: String(b), name: 'Red Wolves' }],
      state: 'arbitration', reports: [{ team: a, reportId: match._id, declared: 'win' }],
    })

    // 1. El bot registra la grabación: dos pistas, una de un jugador vinculado.
    const t1 = ogg('uno'), t2 = ogg('dos')
    const startedAt = new Date(Date.now() - 30 * 60000), stoppedAt = new Date()
    const meta = {
      recordId: 'abc', startedAt, stoppedAt, durationMs: stoppedAt - startedAt, channelName: 'Neoxis voz',
      screenShareLog: [{ userId: '100000002', username: 'rojo', event: 'screen_off', at: new Date() }],
      tracks: [
        { discordUserId: '100000001', username: 'shadow', displayName: 'Shadow', sha256: sha(t1), bytes: t1.length, durationMs: 1800000, voicePackets: 900 },
        { discordUserId: '100000002', username: 'rojo', displayName: 'Rojo', sha256: sha(t2), bytes: t2.length, durationMs: 1800000, voicePackets: 0 },
        { discordUserId: '../../etc', username: 'x' },
      ],
    }
    let state = await saveRecordingMetadata(String(match._id), meta)
    assert.deepEqual(state.missingTracks.sort(), ['100000001', '100000002'])
    assert.equal(state.folder, `${tid}/se-r0-m0/P1-${a}-${match._id}`)

    // 2. Una pista que llega mal (sha distinto) se rechaza y no queda archivo.
    await assert.rejects(receiveRecordingTrack(String(match._id), '100000001', upload(t2, { 'x-track-sha256': sha(t1) })), e => e.status === 422)
    await assert.rejects(receiveRecordingTrack(String(match._id), '100000001', upload(Buffer.from('nope, not ogg'))), e => e.status === 422)
    const maxTrackMb = config.matchRecordings.maxTrackMb
    config.matchRecordings.maxTrackMb = 100 / (1024 * 1024)   // 100 bytes
    await assert.rejects(receiveRecordingTrack(String(match._id), '100000001', upload(t1)), e => e.status === 413)
    config.matchRecordings.maxTrackMb = maxTrackMb
    const folder = path.join(dir, state.folder)
    assert.deepEqual((await fs.readdir(folder)).filter(f => f.endsWith('.ogg') || f.endsWith('.part')), [])

    // 3. Llegan las dos: queda 'stored', con su ficha legible junto a los .ogg.
    await receiveRecordingTrack(String(match._id), '100000001', upload(t1, { 'x-track-sha256': sha(t1) }))
    state = await receiveRecordingTrack(String(match._id), '100000002', upload(t2, { 'x-track-sha256': sha(t2) }))
    assert.equal(state.status, 'stored')
    assert.deepEqual(state.missingTracks, [])
    assert.deepEqual(await fs.readFile(path.join(folder, '100000001.ogg')), t1)
    const manifest = JSON.parse(await fs.readFile(path.join(folder, 'recording.json'), 'utf-8'))
    assert.equal(manifest.team.name, 'Neoxis')
    assert.equal(manifest.tournament.title, 'Legends')
    assert.equal(manifest.bracketMatchId, 'se-r0-m0')
    assert.equal(manifest.gameNumber, 1)
    assert.equal(manifest.tracks.find(t => t.discordUserId === '100000001').userId, String(player))

    // Reintento del bot tras subir todo: no pide nada otra vez.
    state = await saveRecordingMetadata(String(match._id), meta)
    assert.deepEqual(state.missingTracks, [])
    assert.equal(await MatchRecording.countDocuments(), 1)

    // 4. El organizador (árbitro) la ve en el caso; staff de solo lectura y admin no.
    const asOwner = await caseDetail(String(rc._id), { _id: owner, nick: 'Orga' })
    assert.equal(asOwner.recordings.length, 1)
    const [rec] = asOwner.recordings
    assert.equal(rec.teamName, 'Neoxis')
    assert.equal(rec.gameNumber, 1)
    assert.equal(rec.tracks.find(t => t.discordUserId === '100000001').name, 'ShadowKing')
    assert.equal(rec.tracks.find(t => t.discordUserId === '100000002').spoke, false)
    assert.equal(rec.screenShareOff.length, 1)
    const asViewer = await caseDetail(String(rc._id), { _id: viewer, nick: 'Mira' })
    assert.deepEqual([asViewer.recordings.length, asViewer.hiddenRecordings], [0, 1])
    const asAdmin = await caseDetail(String(rc._id), { _id: admin, nick: 'Admin', role: 'admin' })
    assert.deepEqual([asAdmin.recordings.length, asAdmin.hiddenRecordings], [0, 1])

    // 5. Descargar la pista: el árbitro sí (y queda en la auditoría), los demás no.
    await assert.rejects(caseRecordingTrack(String(rc._id), rec.id, '100000001', { _id: viewer, nick: 'Mira' }), e => e.status === 403)
    await assert.rejects(caseRecordingTrack(String(rc._id), rec.id, '100000001', { _id: admin, nick: 'Admin', role: 'admin' }), e => e.status === 403)
    const file = await caseRecordingTrack(String(rc._id), rec.id, '100000001', { _id: owner, nick: 'Orga' })
    assert.equal(file.filePath, path.join(folder, '100000001.ogg'))
    assert.match(file.fileName, /^Neoxis-P1-shadow\.ogg$/)
    const audited = await ResultCase.findById(rc._id).lean()
    assert.equal(audited.audit.at(-1).action, 'recording_listened')
    assert.match(audited.audit.at(-1).detail, /Shadow.*Neoxis/)
    // Una grabación de otra partida no se puede pedir desde este caso.
    const other = await MatchRecording.create({ tournamentMatch: oid(), tournament: tid, team: b, bracketMatchId: 'se-r1-m0', gameNumber: 1, status: 'stored', folder: 'x', tracks: [{ discordUserId: '100000009', file: '100000009.ogg', receivedAt: new Date() }] })
    await assert.rejects(caseRecordingTrack(String(rc._id), String(other._id), '100000009', { _id: owner, nick: 'Orga' }), e => e.status === 404)
    await other.deleteOne()

    // 6. Vencimiento: con el caso abierto se conserva; decidido sin reclamo, se borra.
    await MatchRecording.updateOne({ tournamentMatch: match._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    let purge = await purgeExpiredRecordings()
    assert.equal(purge.deleted, 0)
    assert.ok((await MatchRecording.findOne({ tournamentMatch: match._id }).lean()).expiresAt > new Date())
    assert.ok(existsSync(folder))

    // Decidido por árbitro: el plazo cuenta desde la decisión.
    await ResultCase.updateOne({ _id: rc._id }, { $set: { state: 'validated', source: 'arbiter', decidedAt: new Date() } })
    await MatchRecording.updateOne({ tournamentMatch: match._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    purge = await purgeExpiredRecordings()
    assert.equal(purge.deleted, 0)
    const kept = await MatchRecording.findOne({ tournamentMatch: match._id }).lean()
    assert.ok(kept.expiresAt > new Date(Date.now() + (config.matchRecordings.retentionDays - 1) * 86400000))

    await ResultCase.updateOne({ _id: rc._id }, { $set: { source: 'ai-validated' } })
    await MatchRecording.updateOne({ tournamentMatch: match._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    purge = await purgeExpiredRecordings()
    assert.equal(purge.deleted, 1)
    assert.equal(existsSync(folder), false)
    assert.equal((await MatchRecording.findOne({ tournamentMatch: match._id }).lean()).status, 'deleted')
    assert.equal((await caseDetail(String(rc._id), { _id: owner, nick: 'Orga' })).recordings.length, 0)
    await assert.rejects(saveRecordingMetadata(String(match._id), meta), e => e.status === 410)

    // Partida que no existe en el backend: 404 con código para que el bot no reintente.
    await assert.rejects(saveRecordingMetadata(String(oid()), meta), e => e.status === 404 && e.payload?.error === 'match_not_found')
  } finally {
    config.matchRecordings.dir = previousDir
    await mongoose.connection.dropDatabase().catch(() => {})
    await mongoose.disconnect()
    await fs.rm(dir, { recursive: true, force: true })
  }
})
