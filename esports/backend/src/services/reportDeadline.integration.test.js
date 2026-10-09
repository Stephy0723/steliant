import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { Infraction } from '../models/Infraction.js'
import { IntegrationEvent } from '../models/IntegrationEvent.js'
import { Notification } from '../models/Notification.js'
import { startMatch, reportMatch, addReportEvidence } from '../controllers/tournamentMatches.controller.js'
import { processReportDeadlines } from './reportDeadline.service.js'
import { UPLOAD_DIR } from '../controllers/upload.controller.js'
import { REPORT_DEADLINE } from '../../../shared/reportScreenshots.mjs'

const call = async (handler, req) => {
  let result, error, status = 200
  await handler(req, { status(code) { status = code; return this }, json: value => { result = value; if (status >= 400) error = Object.assign(new Error(value.message), { status }) } }, e => { error = e })
  if (error) throw error
  return result
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
let n = 0
const shot = key => ({ key, url: `https://cdn.discordapp.com/attachments/111/${++n}/${key}.png`, name: `${key}.png` })

test('Mongo: capturas faltantes, plazo, aviso y falta por partida', { skip: process.env.MATCH_STATS_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_deadline_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(PNG, { status: 200 })
  try {
    const oid = () => new mongoose.Types.ObjectId()
    const owner = oid(), leaderA = oid(), leaderB = oid(), tid = oid(), a = oid(), b = oid()
    await mongoose.connection.db.collection('users').insertMany([owner, leaderA, leaderB].map((_id, i) => ({ _id, nick: `dl${i}`, email: `dl${i}@test.local`, playerCode: `DL-${i}`, internalCode: `DL-${i}` })))
    await Team.collection.insertMany([
      { _id: a, name: 'Neoxis', tag: 'NEO', leader: leaderA, members: [leaderA], publicCode: 'DL-A', internalCode: 'DL-A', teamInviteCode: 'DL-A' },
      { _id: b, name: 'Red Wolves', tag: 'RW', leader: leaderB, members: [leaderB], publicCode: 'DL-B', internalCode: 'DL-B', teamInviteCode: 'DL-B' },
    ])
    await Tournament.collection.insertOne({
      _id: tid, publicId: 'DEADLINE-TEST', organizer: owner, title: 'Legends', game: 'Mobile Legends: Bang Bang', status: 'ongoing', discordEnabled: true,
      competition: { defaultSeries: 'BO3' },
      bracketDoc: { format: 'single', published: true, status: 'running', teams: ['Neoxis', 'Red Wolves'], results: {} },
      registrations: [
        { team: a, status: 'checked_in', discordProvision: { textChannelId: 'chan-a' } },
        { team: b, status: 'checked_in', discordProvision: { textChannelId: 'chan-b' } },
      ],
    })
    const play = async (teamId, body) => {
      const started = await call(startMatch, { body: { tournamentId: String(tid), teamId: String(teamId), startedBy: 'x' } })
      return call(reportMatch, { params: { matchId: started.id }, body })
    }

    // Neoxis reporta solo el resumen: le faltan los dos de daño.
    const repA = await play(a, { result: 'win', evidence: [shot('overview')] })
    assert.equal(repA.gameNumber, 1)
    assert.deepEqual(repA.report.missing, ['damage_dealt', 'damage_taken'])
    const deadline = new Date(repA.report.deadlineAt)
    assert.ok(Math.abs(deadline - Date.now() - REPORT_DEADLINE.minutes * 60000) < 5000)

    // Red Wolves reporta completo: comparte el plazo de la partida.
    const repB = await play(b, { result: 'lose', evidence: [shot('overview'), shot('damage_dealt'), shot('damage_taken')] })
    assert.deepEqual(repB.report.missing, [])
    assert.equal(new Date(repB.report.deadlineAt).getTime(), deadline.getTime())

    // /report solo con una captura faltante: se agrega al mismo reporte.
    const added = await call(addReportEvidence, { params: { teamId: String(a) }, body: { evidence: [shot('damage_dealt')] } })
    assert.equal(added.id, repA.id)
    assert.deepEqual(added.report.missing, ['damage_taken'])
    assert.equal(added.report.evidence.length, 2)
    // La misma clave reemplaza, no duplica.
    const replaced = await call(addReportEvidence, { params: { teamId: String(a) }, body: { evidence: [shot('damage_dealt')] } })
    assert.equal(replaced.report.evidence.length, 2)
    await assert.rejects(call(addReportEvidence, { params: { teamId: String(oid()) }, body: { evidence: [shot('overview')] } }), e => e.status === 404)

    // Partida 2 (BO3): solo Neoxis reporta, con partida explícita.
    const game2 = await play(a, { result: 'win', gameNumber: 2, evidence: [shot('overview'), shot('damage_dealt'), shot('damage_taken')] })
    assert.equal(game2.gameNumber, 2)

    // Faltando 4 minutos: aviso a quien le falta algo, una sola vez.
    const remindAt = new Date(deadline.getTime() - 4 * 60000)
    const reminded = await processReportDeadlines({ now: remindAt })
    assert.deepEqual(reminded.map(o => o.status).sort(), ['reminded', 'reminded'])
    const notices = await IntegrationEvent.find({ type: 'discord.match.notice' }).lean()
    // Partida 1: Neoxis (le falta daño recibido). Partida 2: Red Wolves (no reportó).
    assert.deepEqual(notices.map(e => e.payload.channelId).sort(), ['chan-a', 'chan-b'])
    assert.equal(await Notification.countDocuments({ type: 'tournament_report_reminder' }), 2)
    assert.deepEqual(await processReportDeadlines({ now: remindAt }), [])

    // Vencido: falta registrada y aviso al organizador; repetir no duplica.
    const closeAt = new Date(deadline.getTime() + 60000)
    const closed = await processReportDeadlines({ now: closeAt })
    assert.deepEqual(closed.map(o => o.status), ['closed', 'closed'])
    const faltas = await Infraction.find().sort({ gameNumber: 1 }).lean()
    assert.equal(faltas.length, 2)
    assert.deepEqual([faltas[0].type, String(faltas[0].team), faltas[0].gameNumber], ['missing_screenshots', String(a), 1])
    assert.match(faltas[0].detail, /Daño recibido/)
    assert.deepEqual([faltas[1].type, String(faltas[1].team), faltas[1].gameNumber], ['no_report', String(b), 2])
    assert.equal(await Notification.countDocuments({ userId: owner, type: 'tournament_result_review' }), 2)
    assert.deepEqual(await processReportDeadlines({ now: closeAt }), [])
    assert.equal(await Infraction.countDocuments(), 2)

    // Una captura tardía se acepta (el árbitro la ve) pero queda marcada.
    const late = await call(addReportEvidence, { params: { teamId: String(a) }, body: { gameNumber: 1, evidence: [shot('damage_taken')] } })
    assert.equal(late.late, true)
    assert.deepEqual(late.report.missing, [])

    // Con el resultado ya confirmado en el bracket no se agregan capturas.
    await Tournament.collection.updateOne({ _id: tid }, { $set: { 'bracketDoc.results.se-r0-m0': { a: 'Neoxis', b: 'Red Wolves', winner: 'Neoxis', confirmed: true } } })
    await assert.rejects(call(addReportEvidence, { params: { teamId: String(a) }, body: { evidence: [shot('teamfight')] } }), e => e.status === 409)
  } finally {
    globalThis.fetch = realFetch
    const files = (await TournamentMatch.find().lean().catch(() => [])).flatMap(d => d.report?.evidence || []).filter(e => e.archived)
    for (const e of files) await fs.rm(path.join(UPLOAD_DIR, path.basename(e.url)), { force: true })
    if (mongoose.connection.name !== dbName || !/^gg_deadline_test_\d+_\d+$/.test(dbName)) throw new Error('Unexpected test database')
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
