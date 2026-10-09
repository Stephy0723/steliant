import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { startMatch, reportMatch } from './tournamentMatches.controller.js'
import { getMatchReport, listMatchReports } from './matchReports.controller.js'
import { UPLOAD_DIR } from './upload.controller.js'

const call = async (handler, req) => {
  let result, error, status = 200
  await handler(req, { status(code) { status = code; return this }, json: value => { result = value; if (status >= 400) error = Object.assign(new Error(value.message), { status }) } }, e => { error = e })
  if (error) throw error
  return result
}

// PNG de 1x1 valido: lo que "descarga" el fetch falso del CDN de Discord.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
const discordUrl = n => `https://cdn.discordapp.com/attachments/111/${n}/captura-${n}.png?ex=1&is=2&hm=3`

test('Mongo: /report de Discord queda en el bracket web con sus capturas copiadas', { skip: process.env.MATCH_STATS_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_reports_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  const realFetch = globalThis.fetch
  const written = []
  globalThis.fetch = async (url) => {
    if (String(url).includes('/222/')) return new Response('gone', { status: 404 })
    return new Response(PNG, { status: 200 })
  }
  try {
    const oid = () => new mongoose.Types.ObjectId()
    const owner = oid(), leaderA = oid(), leaderB = oid(), stranger = oid(), tid = oid(), a = oid(), b = oid()
    await Team.collection.insertMany([
      { _id: a, name: 'Neoxis', tag: 'NEO', leader: leaderA, members: [leaderA], publicCode: 'REP-A', internalCode: 'REP-A', teamInviteCode: 'REP-A' },
      { _id: b, name: 'Red Wolves', tag: 'RW', leader: leaderB, members: [leaderB], publicCode: 'REP-B', internalCode: 'REP-B', teamInviteCode: 'REP-B' },
    ])
    await Tournament.collection.insertOne({
      _id: tid, publicId: 'REPORTS-TEST', organizer: owner, title: 'Legends', game: 'Mobile Legends: Bang Bang', status: 'ongoing',
      competition: { defaultSeries: 'BO1' },
      bracketDoc: { format: 'single', published: true, status: 'running', teams: ['Neoxis', 'Red Wolves'], results: {} },
      registrations: [{ team: a, status: 'checked_in' }, { team: b, status: 'checked_in' }],
    })

    // /start-match sin escribir rival: igual se ubica la unica partida pendiente.
    const started = await call(startMatch, { body: { tournamentId: String(tid), teamId: String(a), teamName: 'Neoxis', startedBy: 'd1' } })
    assert.equal(started.bracketMatchId, 'se-r0-m0')

    const reported = await call(reportMatch, { params: { matchId: started.id }, body: {
      result: 'win', reporterDiscordId: 'd1', reporterUsername: 'capi',
      evidence: [{ key: 'overview', url: discordUrl(1), name: 'resumen.png' }, { key: 'damage_dealt', url: 'https://cdn.discordapp.com/attachments/111/222/vencida.png', name: 'vencida.png' }],
    } })
    assert.equal(reported.gameNumber, 1)
    const stored = await TournamentMatch.findById(started.id).lean()
    const [copied, expired] = stored.report.evidence
    written.push(copied.url)
    assert.equal(copied.archived, true)
    assert.match(copied.url, /^\/uploads\/\d+-[a-f0-9]{12}\.png$/)
    assert.equal(copied.sha256.length, 64)
    assert.ok(await fs.stat(path.join(UPLOAD_DIR, path.basename(copied.url))))
    // Una captura que no se pudo bajar no tumba el reporte: queda la original.
    assert.equal(expired.archived, false)
    assert.match(expired.url, /cdn\.discordapp\.com/)
    // El CRM recibe una URL absoluta que no vence.
    assert.match(stored.report.evidenceUrl, /\/uploads\//)

    // Reporte viejo, sin bracketMatchId: se ubica por el rival escrito.
    await TournamentMatch.collection.insertOne({ tournament: tid, team: b, teamNameSnapshot: 'Red Wolves', rivalName: 'neo', status: 'completed', result: 'lose', report: { evidenceUrl: discordUrl(9), evidenceName: 'old.png', createdAt: new Date() } })

    const params = { id: String(tid), matchId: 'se-r0-m0' }
    await assert.rejects(call(getMatchReport, { params, user: { _id: stranger } }), e => e.status === 403)
    const seenByRival = await call(getMatchReport, { params, user: { _id: leaderB } })
    assert.equal(seenByRival.discord.A.length, 1)
    assert.equal(seenByRival.discord.A[0].evidence[0].url, copied.url)
    assert.equal(seenByRival.discord.A[0].evidence[0].key, 'overview')
    assert.equal(seenByRival.discord.B.length, 1)
    assert.equal(seenByRival.discord.B[0].evidence[0].url, discordUrl(9))

    const listed = await call(listMatchReports, { params: { id: String(tid) }, user: { _id: owner } })
    assert.equal(listed.discord.length, 1)
    assert.equal(listed.discord[0].a, 'Neoxis')
    assert.equal(listed.discord[0].A[0].result, 'win')
    assert.equal(listed.discord[0].B[0].result, 'lose')
    await assert.rejects(call(listMatchReports, { params: { id: String(tid) }, user: { _id: stranger } }), e => e.status === 403)
  } finally {
    globalThis.fetch = realFetch
    for (const url of written) await fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true })
    if (mongoose.connection.name !== dbName || !/^gg_reports_test_\d+_\d+$/.test(dbName)) throw new Error('Unexpected test database')
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
