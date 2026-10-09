import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { PlayerMatch } from '../models/PlayerMatch.js'
import { getMatchStats, saveMatchStats, confirmMatchStats, extractStats } from './matchStats.controller.js'
import { getTournamentsByTeam } from './tournament.controller.js'
import { getGameStats, getTopCharacters } from './player.controller.js'
import { emptyStats } from '../../../shared/matchStats.mjs'

const call = async (handler, req) => {
  let result, error, status = 200
  await handler(req, { status(code) { status = code; return this }, json: value => { result = value; if (status >= 400) error = Object.assign(new Error(value.message), { status }) } }, e => { error = e })
  if (error) throw error
  return result
}

test('Mongo: permissions, concurrent revisions, disputes and idempotent history', { skip: process.env.MATCH_STATS_TEST_MONGO !== '1' }, async () => {
  // Deliberately ignore application credentials/URI. Only an isolated local DB.
  const dbName = `gg_stats_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  try {
    await Promise.all([MatchStatsDraft.init(), PlayerMatch.init()])
    const oid = () => new mongoose.Types.ObjectId()
    const owner = oid(), leaderA = oid(), leaderB = oid(), stranger = oid(), tid = oid(), a = oid(), b = oid()
    const players = Array.from({ length: 10 }, oid)
    const roster = players.map((id, i) => ({ playerId: String(id), teamId: String(i < 5 ? a : b), nick: `p${i}` }))
    await Team.collection.insertMany([{ _id: a, name: 'A', tag: 'A', leader: leaderA, publicCode: 'STATS-A', internalCode: 'STATS-A', teamInviteCode: 'STATS-A' }, { _id: b, name: 'B', tag: 'B', leader: leaderB, publicCode: 'STATS-B', internalCode: 'STATS-B', teamInviteCode: 'STATS-B' }])
    await Tournament.collection.insertOne({ _id: tid, publicId: 'STATS-TEST', organizer: owner, title: 'Test', game: 'Mobile Legends: Bang Bang', competition: { defaultSeries: 'BO3' }, bracketDoc: { format: 'single', published: true, teams: ['A', 'B'], results: {} }, registrations: [a, b].map((id, index) => ({ team: id, status: 'checked_in', rosterSnapshot: roster.slice(index * 5, index * 5 + 5).map((p, i) => ({ userId: new mongoose.Types.ObjectId(p.playerId), nick: p.nick, slot: `titular-${i + 1}` })) })) })
    const req = (user, body = {}, gameNumber = '1') => ({ params: { id: String(tid), matchId: 'se-r0-m0', gameNumber }, user: { _id: user, role: 'player' }, body })
    const data = { ...emptyStats(roster), winnerTeamId: String(a), scoreA: 5, scoreB: 5 }
    data.players.forEach(p => { p.kills = 1; p.deaths = 1; p.assists = 0 })
    await assert.rejects(call(getMatchStats, req(stranger)), e => e.status === 403)
    await assert.rejects(call(extractStats, req(leaderA, { consent: false })), /aceptar/)
    await assert.rejects(call(extractStats, req(leaderA, { consent: true, firstSideTeamId: String(a), evidenceUrl: 'http://127.0.0.1/private' })), /no autorizada/)
    await assert.rejects(call(saveMatchStats, req(leaderA, { revision: 0, source: String(b), data })), e => e.status === 403)
    const saved = await call(saveMatchStats, req(leaderA, { revision: 0, source: String(a), data }))
    assert.equal(saved.draft.revision, 1)
    assert.equal(await PlayerMatch.countDocuments(), 0)
    await assert.rejects(call(confirmMatchStats, req(leaderB, { revision: 1, source: String(a), reviewed: false })), /revisaste/)
    await assert.rejects(call(confirmMatchStats, req(leaderA, { revision: 1, source: String(a), reviewed: true })), e => e.status === 403)
    await assert.rejects(call(confirmMatchStats, req(leaderB, { revision: 0, source: String(a), reviewed: true })), e => e.status === 409)
    const race = await Promise.allSettled([
      call(saveMatchStats, req(leaderA, { revision: 1, source: String(a), data })),
      call(saveMatchStats, req(leaderA, { revision: 1, source: String(a), data })),
    ])
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(race.filter(r => r.status === 'rejected' && r.reason.status === 409).length, 1)
    const conflictData = structuredClone(data); conflictData.players[0].gold = 100
    data.players[0].gold = 50
    await call(saveMatchStats, req(leaderA, { revision: 2, source: String(a), data }))
    await call(saveMatchStats, req(leaderB, { revision: 3, source: String(b), data: conflictData }))
    await assert.rejects(call(confirmMatchStats, req(leaderB, { revision: 4, source: String(a), reviewed: true })), /discrepan/)
    await assert.rejects(call(confirmMatchStats, req(owner, { revision: 4, source: String(a), reviewed: true })), /discrepan/)
    const confirmed = await call(confirmMatchStats, req(owner, { revision: 4, source: String(a), reviewed: true, reason: 'Verificado con la captura original del organizador.' }))
    assert.equal(confirmed.draft.status, 'confirmed')
    assert.equal(confirmed.draft.confirmation.revision, 4)
    assert.ok(confirmed.draft.historyWrittenAt)
    assert.equal(await PlayerMatch.countDocuments(), 10)
    await Promise.all([
      call(confirmMatchStats, req(owner, { revision: 4, source: String(a), reviewed: true })),
      call(confirmMatchStats, req(owner, { revision: 4, source: String(a), reviewed: true })),
    ])
    assert.equal(await PlayerMatch.countDocuments(), 10)
    const history = await PlayerMatch.findOne({ player: players[1] }).lean()
    assert.equal(history.gold, null)
    assert.equal(history.assists, 0)
    assert.equal(history.towerDamage, null)
    await assert.rejects(call(saveMatchStats, req(leaderA, { revision: 5, source: String(a), data })), /confirmadas/)
    assert.deepEqual((await Tournament.findById(tid).lean()).bracketDoc.results, {})
    // A clean rival confirmation works; a second game is a separate history key.
    const second = await call(saveMatchStats, req(leaderA, { revision: 0, source: String(a), data }, '2'))
    await call(confirmMatchStats, req(leaderB, { revision: second.draft.revision, source: String(a), reviewed: true }, '2'))
    assert.equal(await PlayerMatch.countDocuments(), 20)
    await assert.rejects(call(getMatchStats, req(leaderA, {}, '4')), /fuera de la serie/)
    const invalid = structuredClone(data); invalid.players[0].playerId = String(stranger)
    await call(saveMatchStats, req(leaderA, { revision: 0, source: String(a), data: invalid }, '3'))
    await assert.rejects(call(confirmMatchStats, req(owner, { revision: 1, source: String(a), reviewed: true }, '3')), e => e.status === 422)
    assert.equal(await PlayerMatch.countDocuments(), 20)
    await Tournament.collection.updateOne({ _id: tid }, { $set: { 'registrations.0.rosterSnapshot.0.userId': null } })
    await assert.rejects(call(saveMatchStats, req(leaderA, { revision: 1, source: String(a), data }, '3')), /titulares vinculados/)
    await Tournament.collection.updateOne({ _id: tid }, { $set: { status: 'finished' } })
    const teamRequest = { params: { teamId: String(a) }, query: { includeFinished: 'true' }, user: { _id: leaderA } }
    assert.equal((await call(getTournamentsByTeam, teamRequest)).tournaments.length, 1)
    assert.equal((await call(getTournamentsByTeam, { ...teamRequest, query: {} })).tournaments.length, 0)
    await assert.rejects(call(getTournamentsByTeam, { ...teamRequest, user: { _id: stranger } }), e => e.status === 403)
    await PlayerMatch.create({ player: players[0], game: 'Unknown stats', character: 'Unknown hero', result: 'win', kills: null, deaths: null, assists: null, durationMinutes: null, rating: null })
    const playerRequest = { params: { playerId: String(players[0]) }, user: { _id: players[0] }, query: {} }
    const unknown = (await call(getGameStats, playerRequest)).stats.find(s => s.game === 'Unknown stats')
    assert.equal(unknown.kda, null)
    assert.equal(unknown.rating, null)
    assert.equal(unknown.hours, null)
    assert.equal((await call(getTopCharacters, playerRequest)).characters[0].kda, null)
  } finally {
    if (mongoose.connection.name !== dbName || !/^gg_stats_test_\d+_\d+$/.test(dbName)) throw new Error('Unexpected test database')
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
