import test from 'node:test'
import assert from 'node:assert/strict'
import { Tournament } from '../models/Tournament.js'
import { TournamentDraft } from '../models/TournamentDraft.js'
import { createTournament, updateTournament, respondStaffInvitation } from './tournament.controller.js'
import { getTournamentDraft, saveTournamentDraft, deleteTournamentDraft } from './tournamentDraft.controller.js'
import { initialTournamentForm, tournamentPayload } from '../../../shared/tournamentSetup.mjs'
import { applyTournamentDefaults } from '../services/tournamentDefaults.service.js'

const user = { _id: '507f1f77bcf86cd799439011', roleProfiles: { organizer: { organizerCode: 'ORG-QA' } } }
const valid = () => ({ ...tournamentPayload({ ...initialTournamentForm(),
  title: 'Copa QA', categoryId: 'esports', gameId: 'valorant', game: 'Valorant',
  description: 'Torneo de prueba con una descripcion suficientemente larga.', banner: '/uploads/banner.png',
  server: 'LAN', mapPool: 'Ascent, Bind', mapMode: 'random',
  registrationStart: '2099-01-02T12:00', registrationEnd: '2099-01-04T12:00', date: '2099-01-04T18:00', endDate: '2099-01-04T22:00',
  organizerBrandName: 'Organizacion QA', organizationContact: 'Responsable QA', contactEmail: 'qa@example.test',
  complaintsChannel: 'qa@example.test', rulesDocument: '/uploads/rules.pdf', acceptTerms: true,
  sponsors: [{ name: 'Sponsor QA', link: 'https://example.test', tier: 'Principal', contribution: 'Trofeos' }],
  staffMembers: [{ user: 'cccccccccccccccccccccccc', nick: 'Arbitro QA', name: 'Arbitro QA', platformRole: 'analyst', role: 'Arbitro' }],
}), creationKey: 'test-create-key' })

async function call(handler, body = {}, params = {}, reqUser = user) {
  let status = 200
  let result
  let error
  const res = { status(code) { status = code; return this }, json(data) { result = data; return this } }
  await handler({ user: reqUser, body, params }, res, err => { error = err })
  if (error) throw error
  return { status, result }
}

test('creation writes complete tournament once, retains rules/sponsors/staff and clears its draft', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const create = t.mock.method(Tournament, 'create', async data => data)
  const remove = t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  const response = await call(createTournament, valid())
  assert.equal(response.status, 201)
  assert.equal(create.mock.callCount(), 1)
  assert.equal(response.result.status, 'open')
  assert.equal(response.result.rulesDocument, '/uploads/rules.pdf')
  assert.equal(response.result.sponsors[0].name, 'Sponsor QA')
  assert.deepEqual(response.result.staff.arbitros, ['Arbitro QA'])
  assert.equal(response.result.endDate.toISOString(), '2099-01-05T02:00:00.000Z')
  assert.equal(response.result.gameId, 'valorant')
  assert.equal(response.result.staffMembers[0].user, 'cccccccccccccccccccccccc')
  assert.equal(response.result.staffMembers[0].status, 'pending')
  assert.ok(response.result.seriesId, 'genera un seriesId para la primera edicion')
  assert.equal(response.result.competition.system, 'single_elim')
  assert.equal(response.result.format, 'single_elimination')
  assert.deepEqual(remove.mock.calls[0].arguments[0], { owner: user._id, creationKey: 'test-create-key' })
})
test('creation can save the tournament as an unpublished private draft', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const create = t.mock.method(Tournament, 'create', async data => data)
  t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  const response = await call(createTournament, { ...valid(), status: 'draft', visibility: 'private' })
  assert.equal(response.status, 201)
  assert.equal(response.result.status, 'draft')
  assert.equal(response.result.visibility, 'private')
  assert.equal(create.mock.callCount(), 1)
})
test('creation stores a per-round series and points scoring for a groups + playoffs setup', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const create = t.mock.method(Tournament, 'create', async data => data)
  t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  const body = { ...valid(), maxSlots: 16, competition: {
    system: 'groups_playoffs', defaultSeries: 'BO1', groups: 4, advancePerGroup: 2,
    groupsPhaseSystem: 'round_robin', playoffsSystem: 'single_elim',
    scoring: { model: 'match_points', win: 3, draw: 1, loss: 0, allowDraw: true, tiebreakers: ['head_to_head', 'map_diff'] },
    seriesByRound: { semifinal: 'BO3', final: 'BO5' },
  } }
  const response = await call(createTournament, body)
  assert.equal(response.status, 201)
  assert.equal(response.result.format, 'custom')
  assert.equal(response.result.competition.system, 'groups_playoffs')
  assert.equal(response.result.competition.scoring.model, 'match_points')
  assert.equal(response.result.competition.seriesByRound.final, 'BO5')
  assert.equal(create.mock.callCount(), 1)
})
const discordUser = { ...user, organizerDiscord: { status: 'enabled' } }
test('Discord stays off if the organizer was never enabled by an admin', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  t.mock.method(Tournament, 'create', async data => data)
  t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  const res = await call(createTournament, { ...valid(), discordMode: 'glitchgang', discordConsent: true })
  assert.equal(res.status, 201)
  assert.equal(res.result.discordEnabled, false)
})
test('an enabled organizer must consent before Discord turns on', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const res = await call(createTournament, { ...valid(), discordMode: 'glitchgang', discordConsent: false }, {}, discordUser)
  assert.equal(res.status, 400)
})
test('enabled organizer + consent turns Discord on and records who authorised it', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  // createTournament guarda el documento al marcar discordProvision: el mock
  // tiene que parecerse a un documento de Mongoose, no a un objeto plano.
  t.mock.method(Tournament, 'create', async data => ({ ...data, save: async () => {} }))
  t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  const res = await call(createTournament, { ...valid(), discordMode: 'glitchgang', discordConsent: true }, {}, discordUser)
  assert.equal(res.status, 201)
  assert.equal(res.result.discordEnabled, true)
  assert.equal(String(res.result.discordConsent.acceptedBy), discordUser._id)
})
test('creation rejects an incoherent group split', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const body = { ...valid(), maxSlots: 30, competition: { system: 'groups_playoffs', defaultSeries: 'BO1', groups: 4, advancePerGroup: 2 } }
  const response = await call(createTournament, body)
  assert.equal(response.status, 400)
})
test('idempotent retry returns previous tournament without creating another', async t => {
  t.mock.method(Tournament, 'findOne', async () => ({ _id: 'existing' }))
  const create = t.mock.method(Tournament, 'create', async () => { throw new Error('Should not create') })
  const response = await call(createTournament, valid())
  assert.equal(response.result._id, 'existing')
  assert.equal(create.mock.callCount(), 0)
})
test('creation rejects a start less than 2 hours out, including legacy clients', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const body = { ...valid(), setupVersion: undefined, registrationStart: soon }
  const response = await call(createTournament, body)
  assert.equal(response.status, 400)
  assert.match(response.result.message, /2 horas/)
})
test('creation accepts a same-day tournament that opens just over 2 hours out', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  const create = t.mock.method(Tournament, 'create', async data => data)
  t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  const h = ms => new Date(Date.now() + ms).toISOString()
  const body = { ...valid(),
    registrationStart: h(2.5 * 3600e3), registrationEnd: h(4 * 3600e3), date: h(6 * 3600e3), endDate: h(10 * 3600e3), checkinDeadline: h(5 * 3600e3),
  }
  const response = await call(createTournament, body)
  assert.equal(response.status, 201)
  assert.equal(create.mock.callCount(), 1)
})
test('another organizer cannot be used as season source', async t => {
  t.mock.method(Tournament, 'findOne', async () => null)
  t.mock.method(Tournament, 'exists', async () => null)
  const response = await call(createTournament, { ...valid(), seasonName: 'Copa', sourceTournament: '507f1f77bcf86cd799439012' })
  assert.equal(response.status, 403)
})
test('a staff invitee accepts once and cannot re-answer', async t => {
  const doc = { staffMembers: [{ user: { toString: () => user._id }, role: 'Caster', status: 'pending', respondedAt: null }], organizer: 'org1', title: 'Copa', publicId: 'TOR-X', save: async () => {} }
  t.mock.method(doc, 'save')
  t.mock.method(Tournament, 'findOne', async () => doc)
  const ok = await call(respondStaffInvitation, { decision: 'accept' }, { id: 'TOR-X' })
  assert.equal(ok.status, 200)
  assert.equal(ok.result.status, 'accepted')
  assert.equal(doc.staffMembers[0].status, 'accepted')
  const again = await call(respondStaffInvitation, { decision: 'decline' }, { id: 'TOR-X' })
  assert.equal(again.status, 409)
})
test('staff response rejects a bad decision and a non-invitee', async t => {
  t.mock.method(Tournament, 'findOne', async () => ({ staffMembers: [], organizer: 'o', save: async () => {} }))
  assert.equal((await call(respondStaffInvitation, { decision: 'maybe' }, { id: 'TOR-X' })).status, 400)
  assert.equal((await call(respondStaffInvitation, { decision: 'accept' }, { id: 'TOR-X' })).status, 404)
})
test('editing dates cannot close registration before it opens', async t => {
  const form = valid()
  const doc = new Tournament({ ...form, organizer: user._id, registrationWindow: { start: form.registrationStart, end: form.registrationEnd } })
  t.mock.method(Tournament, 'findOne', async () => doc)
  const save = t.mock.method(doc, 'save', async () => doc)
  const response = await call(updateTournament, { registrationEnd: '2099-01-01T00:00:00Z' }, { id: 'TOR-QA' })
  assert.equal(response.status, 400)
  assert.equal(save.mock.callCount(), 0)
})
test('new forms do not acquire invented staff or contact defaults', () => {
  const source = { setupVersion: 1, title: 'Copa', contactDiscord: '', staff: { arbitros: [] }, rules: '' }
  assert.deepEqual(applyTournamentDefaults(source), source)
})
test('private draft read is restricted to authenticated owner', async t => {
  const find = t.mock.method(TournamentDraft, 'findOne', () => ({ lean: async () => null }))
  await call(getTournamentDraft)
  assert.deepEqual(find.mock.calls[0].arguments[0], { owner: user._id })
})
test('draft save uses atomic timestamp condition and never accepts an owner from the body', async t => {
  t.mock.method(Tournament, 'exists', async () => null)
  const save = t.mock.method(TournamentDraft, 'findOneAndUpdate', async () => ({}))
  const body = { owner: 'someone-else', form: { title: 'Draft' }, step: 2, creationKey: 'draft-key', savedAt: Date.now() }
  assert.equal((await call(saveTournamentDraft, body)).status, 200)
  assert.deepEqual(save.mock.calls[0].arguments[0], { owner: user._id, savedAt: { $lte: body.savedAt } })
})
test('stale draft conflict is reported instead of overwriting', async t => {
  t.mock.method(Tournament, 'exists', async () => null)
  t.mock.method(TournamentDraft, 'findOneAndUpdate', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }) })
  assert.equal((await call(saveTournamentDraft, { form: {}, step: 0, creationKey: 'key', savedAt: Date.now() })).status, 409)
})
test('draft deletion is restricted to account and exact draft key', async t => {
  const remove = t.mock.method(TournamentDraft, 'deleteOne', async () => ({}))
  await call(deleteTournamentDraft, {}, { key: 'draft-key' })
  assert.deepEqual(remove.mock.calls[0].arguments[0], { owner: user._id, creationKey: 'draft-key' })
})
