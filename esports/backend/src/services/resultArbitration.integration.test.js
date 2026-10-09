import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { ResultCase } from '../models/ResultCase.js'
import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { Infraction } from '../models/Infraction.js'
import { Notification } from '../models/Notification.js'
import { startMatch, reportMatch } from '../controllers/tournamentMatches.controller.js'
import { getMatchReport } from '../controllers/matchReports.controller.js'
import { drainReads, escalateCases } from './matchResults.service.js'
import { listReview, caseDetail, takeCase, decideCase, appealCase } from './resultArbitration.service.js'
import { UPLOAD_DIR } from '../controllers/upload.controller.js'
import { config } from '../config/index.js'

const call = async (handler, req) => {
  let result, error, status = 200
  await handler(req, { status(code) { status = code; return this }, json: value => { result = value; if (status >= 400) error = Object.assign(new Error(value.message), { status }) } }, e => { error = e })
  if (error) throw error
  return result
}
const PNG_HEAD = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
let seq = 0
const shots = mark => ['overview', 'damage_dealt', 'damage_taken'].map(key => ({ key, url: `https://cdn.discordapp.com/attachments/8/${++seq}/${mark}-${key}.png` }))
const NICKS = { A: ['a0', 'a1', 'a2', 'a3', 'a4'], B: ['b0', 'b1', 'b2', 'b3', 'b4'] }
function reading(reporter, winner, confidence = 0.95) {
  const other = reporter === 'A' ? 'B' : 'A'
  const row = (side, nick) => ({ side, rawName: nick, character: 'Chou', kills: 2, deaths: 1, assists: 3, damageDealt: 1000, damageTaken: 2000, towerDamage: null, teamfightParticipation: 50, gold: 9000, mvp: null, uncertain: [] })
  return { winnerSide: winner === reporter ? 'A' : 'B', scoreA: 10, scoreB: 10, players: [...NICKS[reporter].map(n => row('A', n)), ...NICKS[other].map(n => row('B', n))], confidence, winnerConfidence: confidence }
}

test('Mongo: arbitraje, apelacion, repetir/rechazar y escalado', { skip: process.env.MATCH_STATS_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_arbiter_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  const realFetch = globalThis.fetch
  const prevKey = config.ai.providers.gemini.key
  config.ai.providers.gemini.key = 'test-key-not-real'
  const scenarios = {}
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('cdn.discordapp.com')) {
      const mark = /\/([^/]+)-[a-z_]+\.png/.exec(String(url))[1]
      return new Response(Buffer.concat([PNG_HEAD, Buffer.from(`|${mark}|${seq}|`)]), { status: 200 })
    }
    const body = JSON.parse(options.body)
    const mark = /\|([^|]+)\|/.exec(Buffer.from(body.contents[0].parts[0].inlineData.data, 'base64').toString('latin1'))[1]
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(scenarios[mark]) }] } }] }), { status: 200 })
  }
  try {
    const oid = () => new mongoose.Types.ObjectId()
    const owner = oid(), referee = oid(), referee2 = oid(), moderator = oid(), stranger = oid(), admin = oid(), leaderA = oid(), leaderB = oid()
    const players = { A: NICKS.A.map(oid), B: NICKS.B.map(oid) }
    const people = { owner, referee, referee2, moderator, stranger, admin, leaderA, leaderB }
    await mongoose.connection.db.collection('users').insertMany([...Object.entries(people).map(([nick, _id]) => ({ _id, nick, email: `${nick}@test.local`, playerCode: `AR-${nick}`, internalCode: `AR-${nick}` })), ...[...players.A, ...players.B].map((_id, i) => ({ _id, nick: `p${i}`, email: `p${i}@test.local`, playerCode: `AR-P${i}`, internalCode: `AR-P${i}` }))])
    const user = (id, extra = {}) => ({ _id: id, nick: Object.entries(people).find(([, v]) => v.equals(id))?.[0] || 'x', role: 'player', ...extra })
    const staffMembers = [
      { user: referee, role: 'Arbitro', status: 'accepted' },
      { user: referee2, role: 'Arbitro', status: 'accepted' },
      { user: moderator, role: 'Moderador', status: 'accepted' },
    ]
    let n = 0
    async function setup() {
      n++
      const a = oid(), b = oid(), tid = oid()
      await Team.collection.insertMany([
        { _id: a, name: `Alfa${n}`, tag: `AF${n}`, leader: leaderA, members: players.A, publicCode: `AR-A${n}`, internalCode: `AR-A${n}`, teamInviteCode: `AR-A${n}` },
        { _id: b, name: `Beta${n}`, tag: `BT${n}`, leader: leaderB, members: players.B, publicCode: `AR-B${n}`, internalCode: `AR-B${n}`, teamInviteCode: `AR-B${n}` },
      ])
      const snap = side => players[side].map((userId, i) => ({ userId, nick: NICKS[side][i], slot: `titular-${i + 1}` }))
      await Tournament.collection.insertOne({
        _id: tid, publicId: `ARB-${n}`, tournamentCode: `ARB-${n}`, organizer: owner, title: `Copa ${n}`, game: 'Mobile Legends: Bang Bang', status: 'ongoing', format: 'single',
        competition: { defaultSeries: 'BO1' }, staffMembers,
        bracketDoc: { format: 'single', published: true, status: 'running', teams: [`Alfa${n}`, `Beta${n}`], results: {} },
        registrations: [{ team: a, status: 'checked_in', rosterSnapshot: snap('A') }, { team: b, status: 'checked_in', rosterSnapshot: snap('B') }],
      })
      const report = async (teamId, body) => {
        const started = await call(startMatch, { body: { tournamentId: String(tid), teamId: String(teamId), startedBy: 'x' } })
        return call(reportMatch, { params: { matchId: started.id }, body })
      }
      return { tid, a: String(a), b: String(b), A: body => report(a, body), B: body => report(b, body) }
    }

    // Caso 🟠: las capturas muestran ganadores distintos.
    const t = await setup()
    scenarios.x1 = reading('A', 'A'); scenarios.x2 = reading('B', 'B')
    await t.A({ result: 'win', evidence: shots('x1') })
    await t.B({ result: 'win', evidence: shots('x2') })
    await drainReads()
    const opened = await ResultCase.findOne({ tournament: t.tid }).lean()
    assert.equal(opened.state, 'arbitration')
    const caseId = String(opened._id)

    // Quién lo ve y quién puede arbitrar.
    assert.equal((await listReview(user(owner))).cases.length, 1)
    const asModerator = await listReview(user(moderator))
    assert.equal(asModerator.cases.length, 1)
    assert.equal(asModerator.cases[0].canArbitrate, false)
    assert.equal((await listReview(user(stranger))).cases.length, 0)
    assert.equal((await listReview(user(admin, { role: 'admin' }))).cases.length, 1)
    await assert.rejects(caseDetail(caseId, user(stranger)), e => e.status === 403)
    const detail = await caseDetail(caseId, user(referee))
    assert.equal(detail.reads.length, 2)
    assert.equal(detail.reads[0].winnerTeamId, t.a)
    assert.equal(detail.reads[1].winnerTeamId, t.b)
    assert.equal(detail.roster.length, 10)
    assert.equal(detail.permissions.canArbitrate, true)
    assert.equal((await caseDetail(caseId, user(admin, { role: 'admin' }))).permissions.canArbitrate, false)

    // Tomar caso: el moderador no puede; un árbitro sí; el otro ve "Lo revisa".
    await assert.rejects(takeCase(caseId, user(moderator)), e => e.status === 403)
    const taken = await takeCase(caseId, user(referee))
    assert.equal(taken.case.assignedName, 'referee')
    await assert.rejects(takeCase(caseId, user(referee2)), /Lo revisa referee/)
    await assert.rejects(decideCase(caseId, user(referee2), { decision: 'confirm', winnerTeamId: t.a, reason: 'Motivo suficiente aquí' }), /Lo revisa/)

    // Decidir contra una lectura exige motivo.
    await assert.rejects(decideCase(caseId, user(referee), { decision: 'confirm', winnerTeamId: t.a }), /motivo/)
    const decided = await decideCase(caseId, user(referee), { decision: 'confirm', winnerTeamId: t.a, reason: 'La captura de Beta muestra la pantalla de otra partida.' })
    assert.equal(decided.state, 'validated')
    assert.equal(decided.source, 'arbiter')
    let bracket = (await Tournament.findById(t.tid).lean()).bracketDoc
    assert.equal(bracket.results['se-r0-m0'].winner, 'Alfa1')
    assert.equal(bracket.results['se-r0-m0'].source, 'arbiter')
    assert.equal(bracket.champion, 'Alfa1')
    assert.equal((await MatchStatsDraft.findOne({ tournament: t.tid }).lean()).confirmation.role, 'arbiter')
    assert.ok(await Notification.exists({ userId: leaderB, type: 'tournament_result_decision' }))

    // El capitán ve la partida decidida y puede apelar una vez.
    const card = await call(getMatchReport, { params: { id: String(t.tid), matchId: 'se-r0-m0' }, user: { _id: leaderB } })
    assert.equal(card.cases[0].canAppeal, true)
    await assert.rejects(appealCase(caseId, user(stranger), { reason: 'No estoy de acuerdo con esto' }), e => e.status === 403)
    await assert.rejects(appealCase(caseId, user(leaderB), { reason: 'corto' }), /motivo/)
    await appealCase(caseId, user(leaderB), { reason: 'Tenemos la grabación: ganamos nosotros.' })
    const appealed = await ResultCase.findById(caseId).lean()
    assert.equal(appealed.state, 'arbitration')
    assert.deepEqual(appealed.reasons, ['appeal'])
    // Mientras tanto el resultado sigue en el bracket y nada automático lo toca.
    assert.equal((await Tournament.findById(t.tid).lean()).bracketDoc.results['se-r0-m0'].winner, 'Alfa1')

    // La apelación la revisa otra persona.
    await assert.rejects(takeCase(caseId, user(referee)), /otra persona/)
    await assert.rejects(takeCase(caseId, user(owner), { to: String(referee) }), /otra persona/)
    await takeCase(caseId, user(owner), { to: String(referee2) })
    await assert.rejects(decideCase(caseId, user(referee2), { decision: 'confirm', winnerTeamId: t.b }), /motivo/)
    const reversed = await decideCase(caseId, user(referee2), { decision: 'confirm', winnerTeamId: t.b, reason: 'La grabación confirma la victoria de Beta.' })
    assert.equal(reversed.winnerTeamId, t.b)
    bracket = (await Tournament.findById(t.tid).lean()).bracketDoc
    assert.equal(bracket.results['se-r0-m0'].winner, 'Beta1')
    assert.equal(bracket.champion, 'Beta1')
    await assert.rejects(appealCase(caseId, user(leaderA), { reason: 'Queremos apelar otra vez' }), /ya fue apelada/)
    const audit = (await ResultCase.findById(caseId).lean()).audit
    for (const action of ['taken', 'decided', 'appealed']) assert.ok(audit.some(e => e.action === action), action)
    // Tras la apelación el caso vuelve sin dueño: el organizador se lo asignó a referee2.
    assert.ok(audit.some(e => e.action === 'taken' && /referee2 tomó/.test(e.detail) && e.actorName === 'owner'))

    // Segundo torneo: ⚪ por baja confianza -> pedir captura, repetir, rechazar.
    const u = await setup()
    scenarios.y1 = reading('A', 'A', 0.5); scenarios.y2 = reading('B', 'A', 0.5)
    await u.A({ result: 'win', evidence: shots('y1') })
    await u.B({ result: 'lose', evidence: shots('y2') })
    await drainReads()
    const review = await ResultCase.findOne({ tournament: u.tid }).lean()
    assert.equal(review.state, 'pending_review')
    const id2 = String(review._id)

    // Escalado: sin tomar 10 min -> aviso al organizador (una vez).
    const later = new Date(new Date(review.case.openedAt).getTime() + 11 * 60000)
    assert.equal(await escalateCases(later), 1)
    assert.equal(await escalateCases(later), 0)
    assert.equal((await ResultCase.findById(id2).lean()).case.escalations, 1)
    assert.ok(await Notification.exists({ userId: owner, title: 'Caso sin tomar' }))

    const requested = await decideCase(id2, user(referee), { decision: 'request_capture', teamId: u.a, minutes: 10, reason: 'La captura de daño está borrosa.' })
    assert.equal(requested.case.requestedTeam, u.a)
    assert.ok(requested.reasonKeys.includes('capture_requested'))

    const replay = await decideCase(id2, user(referee), { decision: 'replay', reason: 'Desconexión de un jugador al minuto 2.' })
    assert.equal(replay.state, 'analyzing')
    assert.equal(replay.history.length, 1)
    assert.equal(await TournamentMatch.countDocuments({ tournament: u.tid, voidedAt: { $ne: null } }), 2)
    // Se vuelve a reportar la MISMA partida 1.
    scenarios.y3 = reading('A', 'A'); scenarios.y4 = reading('B', 'A')
    const again = await u.A({ result: 'win', evidence: shots('y3') })
    assert.equal(again.gameNumber, 1)
    await u.B({ result: 'lose', evidence: shots('y4') })
    await drainReads()
    assert.equal((await ResultCase.findById(id2).lean()).state, 'validated')
    assert.equal((await Tournament.findById(u.tid).lean()).bracketDoc.results['se-r0-m0'].source, 'ai-validated')

    // Rechazar un reporte deja falta y reinicia la partida.
    const v = await setup()
    scenarios.z1 = reading('A', 'A', 0.5); scenarios.z2 = reading('B', 'A', 0.5)
    await v.A({ result: 'win', evidence: shots('z1') })
    await v.B({ result: 'lose', evidence: shots('z2') })
    await drainReads()
    const id3 = String((await ResultCase.findOne({ tournament: v.tid }).lean())._id)
    await assert.rejects(decideCase(id3, user(referee), { decision: 'reject', teamId: v.b, reason: 'corto' }), /motivo/)
    const rejected = await decideCase(id3, user(referee), { decision: 'reject', teamId: v.b, reason: 'Captura de otra partida (fecha distinta).' })
    assert.equal(rejected.history[0].decision, 'reject')
    assert.equal((await Infraction.findOne({ tournament: v.tid }).lean()).type, 'rejected_report')
  } finally {
    globalThis.fetch = realFetch
    config.ai.providers.gemini.key = prevKey
    const files = (await TournamentMatch.find().lean().catch(() => [])).flatMap(d => d.report?.evidence || []).filter(e => e.archived)
    for (const e of files) await fs.rm(path.join(UPLOAD_DIR, path.basename(e.url)), { force: true })
    if (mongoose.connection.name !== dbName || !/^gg_arbiter_test_\d+_\d+$/.test(dbName)) throw new Error('Unexpected test database')
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
