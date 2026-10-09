import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyStats, validateStats, matchExtractedStats, compareStats, isMobileLegends } from '../../../shared/matchStats.mjs'
import { isLocalEvidence, isDiscordEvidence, readEvidence, imageMime, extractMatchStats } from './matchStatsVision.service.js'
import { statsAccess, statsMatches, statsSeries } from './matchStats.service.js'
import { config } from '../config/index.js'

const roster = Array.from({ length: 10 }, (_, i) => ({ playerId: `p${i}`, teamId: i < 5 ? 'a' : 'b', nick: i === 0 ? 'ꜱᴛᴇᴘʜʏ々' : `player${i}` }))
const valid = () => ({ ...emptyStats(roster), winnerTeamId: 'a', scoreA: 5, scoreB: 5, players: emptyStats(roster).players.map(p => ({ ...p, kills: 1, deaths: 1, assists: 0 })) })

test('unknown stats stay null and visible zero stays zero', () => {
  const value = valid(); value.players[0].gold = 0
  const result = validateStats(value, roster, ['a', 'b'])
  assert.deepEqual(result.errors, [])
  assert.equal(result.data.players[0].gold, 0)
  assert.equal(result.data.players[1].gold, null)
  assert.equal(result.data.players[0].mvp, null)
  assert.ok(isMobileLegends('mobile-legends-bang-bang'))
})
test('only unique names inside the correct five-player roster resolve', () => {
  const raw = { winnerSide: 'B', scoreA: 9, scoreB: 5, players: [
    { side: 'A', rawName: 'ꜱᴛᴇᴘʜʏ々' }, { side: 'B', rawName: 'ꜱᴛᴇᴘʜʏ々' }, { side: 'A', rawName: 'Stephyyy' },
  ] }
  const matched = matchExtractedStats(raw, roster, ['a', 'b'], 'a')
  assert.equal(matched.players[0].playerId, 'p0')
  assert.equal(matched.players[1].playerId, '')
  assert.equal(matched.players[2].playerId, '')
  assert.equal(matched.winnerTeamId, 'b')
  const duplicate = [...roster, { ...roster[0], playerId: 'other' }]
  assert.equal(matchExtractedStats(raw, duplicate, ['a', 'b'], 'a').players[0].playerId, '')
  const reversed = matchExtractedStats(raw, roster, ['a', 'b'], 'b')
  assert.equal(reversed.scoreA, 5)
  assert.equal(reversed.scoreB, 9)
  assert.equal(reversed.winnerTeamId, 'a')
})
test('invalid identities, duplicate players, fractional counts and impossible scores block confirmation', () => {
  for (const change of [
    d => { d.players[0].playerId = 'outsider' },
    d => { d.players[0].playerId = d.players[1].playerId },
    d => { d.players[0].gold = -1 },
    d => { d.players[0].kills = 1.1 },
    d => { d.players[0].teamfightParticipation = 101 },
    d => { d.scoreA = 88 },
    d => { d.winnerTeamId = 'outsider' },
    d => { d.players.pop() },
    d => { d.players[0].mvp = 'true' },
  ]) {
    const d = valid(); change(d)
    assert.ok(validateStats(d, roster, ['a', 'b']).errors.length)
  }
})
test('reports compare overlapping known stats without treating absent data as zero', () => {
  const a = valid(), b = valid()
  b.players[0].gold = 100
  assert.deepEqual(compareStats(a, b), [])
  a.players[0].gold = 0
  b.winnerTeamId = 'b'
  assert.equal(compareStats(a, b).length, 2)
})
test('captain and organizer permissions are tied to server identities', () => {
  const teams = [{ _id: 'a', leader: 'leaderA' }, { _id: 'b', leader: 'leaderB' }]
  assert.deepEqual(statsAccess({ organizer: 'owner' }, teams, { _id: 'leaderA' }).captainTeams, ['a'])
  assert.equal(statsAccess({ organizer: 'owner' }, teams, { _id: 'stranger', role: 'organizer' }).organizer, false)
  assert.equal(statsAccess({ organizer: 'owner' }, teams, { _id: 'owner' }).organizer, true)
})
test('resolved bracket participants and per-round series come from server bracket', () => {
  const t = { competition: { defaultSeries: 'BO1', seriesByRound: { final: 'BO3' } }, bracketDoc: { teams: ['A', 'B', 'C', 'D'], format: 'single', results: {} } }
  const matches = statsMatches(t)
  assert.equal(matches[0].a, 'A')
  assert.equal(matches[0].b, 'B')
  assert.equal(matches[2].a, 'Por definir')
  assert.equal(statsSeries(t, matches[0]), 'BO1')
  assert.equal(statsSeries(t, matches[2]), 'BO3')
})
test('evidence rejects traversal, arbitrary remote URLs and spoofed image types', async () => {
  assert.ok(isLocalEvidence('/uploads/123-012345abcdef.png'))
  assert.equal(isLocalEvidence('/uploads/../secret.png'), false)
  assert.equal(isLocalEvidence('/uploads/123-012345abcdef.svg'), false)
  assert.ok(isDiscordEvidence('https://cdn.discordapp.com/attachments/123/456/photo.png?ex=123'))
  for (const url of ['http://127.0.0.1/x', 'https://cdn.discordapp.com.evil.test/attachments/1/2/a', 'https://user@cdn.discordapp.com/attachments/1/2/a', 'https://cdn.discordapp.com:443/elsewhere']) assert.equal(isDiscordEvidence(url), false)
  await assert.rejects(readEvidence('http://127.0.0.1/private'), /no autorizada/)
  await assert.rejects(readEvidence('https://cdn.discordapp.com/attachments/1/2/a'), /no autorizada/)
  assert.throws(() => imageMime(Buffer.from('<svg/>')), /válida/)
  assert.throws(() => imageMime(Buffer.alloc(5 * 1024 * 1024 + 1)), /5 MB/)
})
test('group playoffs only expose real pairings after all group results are confirmed', () => {
  const tournament = { competition: { groups: 2, advancePerGroup: 2 }, bracketDoc: { format: 'groups', teams: ['A', 'B', 'C', 'D', 'E', 'F'], results: {} } }
  const groups = statsMatches(tournament)
  assert.equal(groups.some(m => m.id.startsWith('gpo')), false)
  for (const match of groups) tournament.bracketDoc.results[match.id] = { ...match, confirmed: true, winner: match.a, scoreA: 1, scoreB: 0 }
  const playoffs = statsMatches(tournament).filter(m => m.id.startsWith('gpo'))
  assert.ok(playoffs.length > 0)
  assert.notEqual(playoffs[0].a, 'Por definir')
  assert.notEqual(playoffs[0].b, 'Por definir')
})
test('Gemini request sends only image and extraction instructions; failures stay retryable', async () => {
  const previous = config.ai.providers.gemini.key
  config.ai.providers.gemini.key = 'test-key-not-real'
  try {
    const image = { mimeType: 'image/png', data: 'test-image' }
    const result = await extractMatchStats(image, { fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.tools, undefined)
      assert.equal(body.generationConfig.responseMimeType, 'application/json')
      assert.deepEqual(body.contents[0].parts[0].inlineData, image)
      assert.equal(JSON.stringify(body).includes('playerId'), false)
      return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"players":[]}' }] } }] }) }
    } })
    assert.deepEqual(result.players, [])
    await assert.rejects(extractMatchStats(image, { fetchImpl: async () => ({ ok: false, status: 503 }) }), e => e.status === 503)
    await assert.rejects(extractMatchStats(image, { fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) }) }), /completar/)
  } finally { config.ai.providers.gemini.key = previous }
})
