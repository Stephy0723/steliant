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
import { PlayerMatch } from '../models/PlayerMatch.js'
import { startMatch, reportMatch } from '../controllers/tournamentMatches.controller.js'
import { drainReads } from './matchResults.service.js'
import { processReportDeadlines } from './reportDeadline.service.js'
import { UPLOAD_DIR } from '../controllers/upload.controller.js'
import { config } from '../config/index.js'

const call = async (handler, req) => {
  let result, error, status = 200
  await handler(req, { status(code) { status = code; return this }, json: value => { result = value; if (status >= 400) error = Object.assign(new Error(value.message), { status }) } }, e => { error = e })
  if (error) throw error
  return result
}

// Cada "captura" es un PNG valido con una marca al final: el Gemini falso
// decide que leer segun la marca (equipo y escenario).
const PNG_HEAD = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const png = mark => Buffer.concat([PNG_HEAD, Buffer.from(`|${mark}|`)])
let seq = 0
const shots = (mark, keys = ['overview', 'damage_dealt', 'damage_taken']) =>
  keys.map(key => ({ key, url: `https://cdn.discordapp.com/attachments/9/${++seq}/${mark}-${key}.png`, name: `${key}.png` }))

const NICKS = { A: ['a0', 'a1', 'a2', 'a3', 'a4'], B: ['b0', 'b1', 'b2', 'b3', 'b4'] }
// Lectura desde el punto de vista de quien captura: su equipo es el lado A.
function reading({ reporter, winner, confidence = 0.95, kills = 2, swapNick = false }) {
  const own = reporter, other = reporter === 'A' ? 'B' : 'A'
  const row = (side, nick) => ({ side, rawName: nick, character: 'Chou', kills, deaths: 1, assists: 3, damageDealt: 1000, damageTaken: 2000, towerDamage: null, teamfightParticipation: 50, gold: 9000, mvp: null, uncertain: [] })
  const players = [...NICKS[own].map(n => row('A', n)), ...NICKS[other].map(n => row('B', n))]
  if (swapNick) players[0].rawName = 'Impostor'
  return { winnerSide: winner === own ? 'A' : 'B', scoreA: kills * 5, scoreB: kills * 5, players, confidence, winnerConfidence: confidence, notGameScreenshot: false, editingSuspected: false }
}

test('Mongo: lectura automatica, cruce de capturas y avance del bracket', { skip: process.env.MATCH_STATS_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_results_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  const realFetch = globalThis.fetch
  const prev = { key: config.ai.providers.gemini.key, rpm: config.matchResults.readsPerMinute }
  config.ai.providers.gemini.key = 'test-key-not-real'
  config.matchResults.readsPerMinute = 60
  // escenario por marca -> respuesta de Gemini ('down' = 500)
  const scenarios = {}
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('cdn.discordapp.com')) {
      const mark = /\/([^/]+)-[a-z_]+\.png/.exec(String(url))[1]
      return new Response(png(mark), { status: 200 })
    }
    const body = JSON.parse(options.body)
    const mark = /\|([^|]+)\|/.exec(Buffer.from(body.contents[0].parts[0].inlineData.data, 'base64').toString('latin1'))[1]
    const answer = scenarios[mark]
    if (answer === 'down') return new Response('boom', { status: 500 })
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 })
  }
  try {
    const oid = () => new mongoose.Types.ObjectId()
    const owner = oid(), leaderA = oid(), leaderB = oid()
    const players = { A: NICKS.A.map(oid), B: NICKS.B.map(oid) }
    await mongoose.connection.db.collection('users').insertMany([owner, leaderA, leaderB, ...players.A, ...players.B].map((_id, i) => ({ _id, nick: `u${i}`, email: `u${i}@test.local`, playerCode: `MR-${i}`, internalCode: `MR-${i}` })))

    let n = 0
    // Torneo nuevo con dos equipos nuevos por escenario.
    async function setup({ game = 'Mobile Legends: Bang Bang', series = 'BO1', rule } = {}) {
      n++
      const a = oid(), b = oid(), tid = oid()
      await Team.collection.insertMany([
        { _id: a, name: `Alfa${n}`, tag: `AF${n}`, leader: leaderA, members: players.A, publicCode: `R-A${n}`, internalCode: `R-A${n}`, teamInviteCode: `R-A${n}` },
        { _id: b, name: `Beta${n}`, tag: `BT${n}`, leader: leaderB, members: players.B, publicCode: `R-B${n}`, internalCode: `R-B${n}`, teamInviteCode: `R-B${n}` },
      ])
      const snap = side => players[side].map((userId, i) => ({ userId, nick: NICKS[side][i], slot: `titular-${i + 1}` }))
      await Tournament.collection.insertOne({
        _id: tid, publicId: `RES-${n}`, tournamentCode: `RES-${n}`, organizer: owner, title: `Copa ${n}`, game, status: 'ongoing', format: 'single',
        competition: { defaultSeries: series, ...(rule ? { singleReportRule: rule } : {}) },
        bracketDoc: { format: 'single', published: true, status: 'running', teams: [`Alfa${n}`, `Beta${n}`], results: {} },
        registrations: [{ team: a, status: 'checked_in', rosterSnapshot: snap('A') }, { team: b, status: 'checked_in', rosterSnapshot: snap('B') }],
      })
      const report = async (teamId, body) => {
        const started = await call(startMatch, { body: { tournamentId: String(tid), teamId: String(teamId), startedBy: 'x' } })
        return call(reportMatch, { params: { matchId: started.id }, body })
      }
      return { tid, a, b, A: body => report(a, body), B: body => report(b, body), match: 'se-r0-m0' }
    }
    const bracket = async tid => (await Tournament.findById(tid).lean()).bracketDoc
    const caseOf = (tid, gameNumber = 1) => ResultCase.findOne({ tournament: tid, gameNumber }).lean()

    // 1) 🟢 Las dos capturas coinciden: avanza solo, ficha confirmada por el sistema.
    {
      const t = await setup()
      scenarios.ok1a = reading({ reporter: 'A', winner: 'A' }); scenarios.ok1b = reading({ reporter: 'B', winner: 'A' })
      const first = await t.A({ result: 'win', evidence: shots('ok1a') })
      assert.equal(first.sync.status, 'awaiting_rival')
      const second = await t.B({ result: 'lose', evidence: shots('ok1b') })
      assert.equal(second.sync.status, 'analyzing')
      await drainReads()
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'validated', JSON.stringify(c.reasons))
      assert.equal(c.source, 'ai-validated')
      const bk = await bracket(t.tid)
      assert.equal(bk.results[t.match].winner, 'Alfa1')
      assert.equal(bk.results[t.match].source, 'ai-validated')
      assert.equal(bk.results[t.match].scoreA, 1)
      assert.equal(bk.champion, 'Alfa1')
      const draft = await MatchStatsDraft.findOne({ tournament: t.tid }).lean()
      assert.equal(draft.status, 'confirmed')
      assert.equal(draft.confirmation.role, 'system')
      assert.equal(await PlayerMatch.countDocuments({ tournament: t.tid }), 10)
      assert.ok(c.audit.some(e => e.action === 'validated' && e.actorName === 'Sistema'))
    }

    // 2) 🟠 Las capturas muestran ganadores distintos: no avanza nada.
    {
      const t = await setup()
      scenarios.mm2a = reading({ reporter: 'A', winner: 'A' }); scenarios.mm2b = reading({ reporter: 'B', winner: 'B' })
      await t.A({ result: 'win', evidence: shots('mm2a') })
      await t.B({ result: 'lose', evidence: shots('mm2b') })
      await drainReads()
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'arbitration')
      assert.ok(c.reasons.includes('winner_mismatch'))
      assert.ok(c.reasons.includes('ai_vs_declared'))
      assert.equal((await bracket(t.tid)).results[t.match], undefined)
    }

    // 3) ⚪ Baja confianza y un nick que no está en el roster.
    {
      const t = await setup()
      scenarios.lc3a = reading({ reporter: 'A', winner: 'A', confidence: 0.6 }); scenarios.lc3b = reading({ reporter: 'B', winner: 'A', swapNick: true })
      await t.A({ result: 'win', evidence: shots('lc3a') })
      await t.B({ result: 'lose', evidence: shots('lc3b') })
      await drainReads()
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'pending_review')
      assert.deepEqual([...c.reasons].sort(), ['low_confidence', 'nickname_mismatch'])
      assert.equal((await bracket(t.tid)).results[t.match], undefined)
    }

    // 4) ⚪ Gemini caído: el torneo no se bloquea, queda para el árbitro.
    {
      const t = await setup()
      scenarios.dn4a = 'down'; scenarios.dn4b = reading({ reporter: 'B', winner: 'A' })
      await t.A({ result: 'win', evidence: shots('dn4a') })
      await t.B({ result: 'lose', evidence: shots('dn4b') })
      await drainReads()
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'pending_review')
      assert.ok(c.reasons.includes('ai_unavailable'))
    }

    // 5) Otro juego, BO3: cada partida se valida por declaraciones y la serie
    //    se escribe al llegar a 2. Una declaración contradictoria va a 🟠.
    {
      const t = await setup({ game: 'Valorant', series: 'BO3' })
      await t.A({ result: 'win', evidence: shots('v1', ['overview']) })
      const g1 = await t.B({ result: 'lose', evidence: shots('v2', ['overview']) })
      assert.equal(g1.sync.status, 'game_validated')
      assert.equal((await bracket(t.tid)).results[t.match], undefined)
      await t.A({ result: 'win', evidence: shots('v3', ['overview']) })
      const g2b = await t.B({ result: 'win', evidence: shots('v4', ['overview']) })
      assert.equal(g2b.sync.status, 'disputed')
      assert.equal((await caseOf(t.tid, 2)).state, 'arbitration')
      // El árbitro aún no decidió: la partida 3 se reporta igual.
      await t.A({ result: 'win', evidence: shots('v5', ['overview']) })
      const g3 = await t.B({ result: 'lose', evidence: shots('v6', ['overview']) })
      assert.equal(g3.sync.status, 'synced')
      const bk = await bracket(t.tid)
      assert.deepEqual([bk.results[t.match].winner, bk.results[t.match].scoreA, bk.results[t.match].scoreB], ['Alfa5', 2, 0])
    }

    // 6) Solo reporta un equipo y vence el plazo: por defecto ⚪ (opción B)...
    {
      const t = await setup({ game: 'Valorant' })
      const only = await t.A({ result: 'win', evidence: shots('s1', ['overview']) })
      await processReportDeadlines({ now: new Date(new Date(only.report.deadlineAt).getTime() + 1000) })
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'pending_review')
      assert.deepEqual(c.reasons, ['only_one_team'])
    }
    // ...y con la opción A configurada gana quien reportó.
    {
      const t = await setup({ game: 'Valorant', rule: 'auto_win' })
      const only = await t.A({ result: 'win', evidence: shots('s2', ['overview']) })
      await processReportDeadlines({ now: new Date(new Date(only.report.deadlineAt).getTime() + 1000) })
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'validated')
      assert.equal((await bracket(t.tid)).results[t.match].winner, 'Alfa7')
    }

    // 7) 🟠 Captura ya usada en otra partida (mismo archivo, mismo hash).
    {
      const t = await setup({ game: 'Valorant' })
      const reused = [{ key: 'overview', url: 'https://cdn.discordapp.com/attachments/9/777/v1-overview.png', name: 'x.png' }]
      await t.A({ result: 'win', evidence: reused })
      await t.B({ result: 'lose', evidence: shots('d2', ['overview']) })
      const c = await caseOf(t.tid)
      assert.equal(c.state, 'arbitration')
      assert.deepEqual(c.reasons, ['duplicate_image'])
    }
  } finally {
    globalThis.fetch = realFetch
    config.ai.providers.gemini.key = prev.key
    config.matchResults.readsPerMinute = prev.rpm
    const files = (await TournamentMatch.find().lean().catch(() => [])).flatMap(d => d.report?.evidence || []).filter(e => e.archived)
    for (const e of files) await fs.rm(path.join(UPLOAD_DIR, path.basename(e.url)), { force: true })
    if (mongoose.connection.name !== dbName || !/^gg_results_test_\d+_\d+$/.test(dbName)) throw new Error('Unexpected test database')
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
