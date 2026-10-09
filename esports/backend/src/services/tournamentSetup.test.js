import test from 'node:test'
import assert from 'node:assert/strict'
import { initialTournamentForm, initialCompetition, nextSeason, normalizeCompetition, competitionPhases, validateCompetition, scheduleErrors, scheduleWarnings, tournamentPayload, validateSetupStep } from '../../../shared/tournamentSetup.mjs'
import { participantRestrictions, validateTournamentSetup } from './tournamentSetup.service.js'

const now = Date.parse('2030-01-01T00:00:00Z')
const schedule = () => ({ timezone: '-04:00', registrationStart: '2030-01-02T12:00', registrationEnd: '2030-01-04T12:00', date: '2030-01-04T18:00', endDate: '2030-01-04T22:00', checkinDeadline: '2030-01-04T17:00' })

test('a same-day schedule with a short registration window is valid', () => {
  assert.deepEqual(scheduleErrors(schedule(), now), {})
  assert.deepEqual(scheduleErrors({ ...schedule(), registrationEnd: '2030-01-04T11:59' }, now), {})
})
test('opening and start must be at least 2 hours out; 48h is only a recommendation', () => {
  assert.ok(scheduleErrors({ ...schedule(), registrationStart: '2030-01-01T01:00:00Z' }, now).registrationStart)
  assert.ok(scheduleErrors({ ...schedule(), date: '2030-01-01T01:30:00Z', endDate: '2030-01-01T05:00:00Z', registrationEnd: '2030-01-01T01:00:00Z' }, now).date)
  assert.deepEqual(scheduleWarnings({ ...schedule(), registrationEnd: '2030-01-04T11:59' }), { registrationEnd: 'Recomendado: dejar las inscripciones abiertas al menos 48 horas.' })
  assert.deepEqual(scheduleWarnings(schedule()), {})
})
test('rejects past opening, reversed registration, tournament ending before it starts and invalid dates', () => {
  assert.ok(scheduleErrors({ ...schedule(), registrationStart: '2020-01-01T12:00' }, now).registrationStart)
  assert.ok(scheduleErrors({ ...schedule(), registrationStart: '2030-01-04T13:00', registrationEnd: '2030-01-04T12:00' }, now).registrationEnd)
  assert.ok(scheduleErrors({ ...schedule(), endDate: '2030-01-04T15:00' }, now).endDate)
  assert.ok(scheduleErrors({ ...schedule(), date: 'invalid' }, now).date)
})
test('checkin is between registration close and tournament start', () => {
  assert.ok(scheduleErrors({ ...schedule(), checkinDeadline: '2030-01-04T19:00' }, now).checkinDeadline)
  assert.ok(scheduleErrors({ ...schedule(), checkinDeadline: '2030-01-03T19:00' }, now).checkinDeadline)
})
test('payload preserves timezone as an unambiguous UTC instant', () => {
  const result = tournamentPayload({ ...initialTournamentForm(), ...schedule() })
  assert.equal(result.date, '2030-01-04T22:00:00.000Z')
  assert.equal(result.endDate, '2030-01-05T02:00:00.000Z')
})
test('random maps require explicit map names', () => {
  const errors = validateSetupStep({ ...initialTournamentForm(), mapMode: 'random' }, 1)
  assert.match(errors.mapPool, /sorteo/)
})
test('season copy preserves reusable configuration and resets all dates and consent', () => {
  const source = { ...initialTournamentForm(), ...schedule(), _id: 'old-id', title: 'Liga Caribe', seasonNumber: 2, acceptTerms: true, rules: 'Reglas', sponsors: [{ name: 'Marca' }], registrations: [{ team: 'old-team' }] }
  const next = nextSeason(source, {})
  assert.equal(next.seasonNumber, 3)
  assert.equal(next.sourceTournament, 'old-id')
  assert.equal(next.rules, 'Reglas')
  assert.equal(next.date, '')
  assert.equal(next.registrationStart, '')
  assert.equal(next.acceptTerms, false)
  assert.equal(next.registrations, undefined)
})
test('prizes accept placement and special-award rows and check the pool adds up', () => {
  const base = { ...initialTournamentForm(), prizeType: 'Mixto', prizePool: 150, currency: 'USD', prizes: [
    { kind: 'placement', place: '1º lugar', amount: 100, items: '' },
    { kind: 'award', place: 'MVP', amount: 50, items: 'Trofeo' },
  ] }
  assert.deepEqual(validateSetupStep(base, 3), {})
  assert.ok(validateSetupStep({ ...base, prizePool: 200 }, 3).prizePool)
  assert.ok(validateSetupStep({ ...base, prizes: [{ kind: 'award', place: 'MVP', amount: 75, items: '' }, { kind: 'award', place: 'mvp', amount: 75, items: '' }] }, 3).prizes)
  assert.ok(validateSetupStep({ ...base, prizes: [{ kind: 'award', place: '', amount: 150, items: '' }] }, 3).prizes)
})
test('payload normalises prize kind and amount', () => {
  const payload = tournamentPayload({ ...initialTournamentForm(), prizeType: 'Dinero', prizePool: 50, currency: 'USD',
    prizes: [{ place: 'MVP', amount: '50', items: '', kind: 'award' }] })
  assert.equal(payload.prizes[0].kind, 'award')
  assert.equal(payload.prizes[0].amount, 50)
  assert.equal(payload.prizes[0].currency, 'USD')
})
test('empty and duplicate sponsor / staff rows are rejected', () => {
  const form = { ...initialTournamentForm(), sponsors: [{ name: 'A', link: '', tier: 'Principal' }, { name: 'a', link: '', tier: 'Oficial' }], staffMembers: [{ name: '', role: 'Arbitro' }] }
  const e = validateSetupStep(form, 4)
  assert.ok(e.sponsors)
  assert.ok(e.staffMembers)
  assert.ok(validateSetupStep({ ...form, staffMembers: [
    { user: 'aaaaaaaaaaaaaaaaaaaaaaaa', nick: 'Cast', name: 'Cast', role: 'Caster' },
    { user: 'aaaaaaaaaaaaaaaaaaaaaaaa', nick: 'Cast', name: 'Cast', role: 'Moderador' },
  ] }, 4).staffMembers, 'la misma persona no puede repetirse')
})
test('the API keeps only real linked staff profiles and maps their tournament role to staff.arbitros', () => {
  const { form } = validateTournamentSetup({ ...tournamentPayload({ ...initialTournamentForm(), ...schedule(),
    title: 'Copa', gameId: 'valorant', game: 'Valorant', description: 'x'.repeat(40), banner: '/b.png',
    server: 'LAN', mapPool: 'Ascent', organizerBrandName: 'Org', organizationContact: 'Resp', contactEmail: 'a@b.co',
    complaintsChannel: 'a@b.co', rules: 'Reglas', acceptTerms: true,
    staffMembers: [
      { user: 'bbbbbbbbbbbbbbbbbbbbbbbb', nick: 'Ref', name: 'Ref', avatar: '/a.png', playerCode: 'R1-99', platformRole: 'analyst', role: 'Arbitro' },
      { name: 'Solo nombre', role: 'Director' },
    ] }) })
  assert.equal(form.staffMembers.length, 1, 'el integrante sin perfil real se descarta')
  assert.equal(form.staffMembers[0].user, 'bbbbbbbbbbbbbbbbbbbbbbbb')
  assert.equal(form.staffMembers[0].nick, 'Ref')
})
test('API rejects malformed nested data without throwing', () => {
  assert.ok(validateTournamentSetup({ sponsors: [null] }).issues.sponsors)
  assert.ok(validateTournamentSetup({ allowedCountries: 'RD' }).issues.allowedCountries)
})
const player = (id, country = 'RD', birth = '2000-01-01') => ({ _id: id, playerCode: id, nick: id, countryCode: country, birthDate: birth })
const restricted = { setupVersion: 1, participationScope: 'regional', allowedCountries: ['RD'], date: '2030-01-04T18:00:00Z', minAge: 18, minorsAllowed: false }
test('region enforced per player including substitutes; team region does not override it', () => {
  const team = { region: 'RD', members: [player('A'), player('B', 'MX')], rosterSlots: { 'sub-1': { id: 'B' } } }
  assert.match(participantRestrictions(team, restricted).join(' '), /B.*pais/)
})
test('country aliases DO/RD accepted; missing profile/country fails closed', () => {
  assert.deepEqual(participantRestrictions({ members: [player('A', 'DO')] }, restricted), [])
  assert.ok(participantRestrictions({ members: [player('A', '')] }, restricted).length)
  assert.ok(participantRestrictions({ members: [player('A')], rosterSlots: { 'titular-2': { nick: 'Anonimo', countryCode: 'RD' } } }, restricted).length)
})
test('age is evaluated at event date and absence is rejected', () => {
  assert.equal(participantRestrictions({ members: [player('A', 'RD', '2012-01-04')] }, restricted).length, 0)
  assert.ok(participantRestrictions({ members: [player('A', 'RD', '2012-01-05')] }, restricted).length)
  assert.ok(participantRestrictions({ members: [player('A', 'RD', '')] }, restricted).length)
})
test('single elimination for 16 slots derives octavos through final', () => {
  const keys = competitionPhases({ ...initialCompetition(), system: 'single_elim' }, 16).flatMap(p => p.rounds.map(r => r.key))
  assert.deepEqual(keys, ['octavos', 'cuartos', 'semifinal', 'final'])
})
test('per-round series only keep valid keys and drop values equal to the default', () => {
  const c = normalizeCompetition({ ...initialCompetition(), system: 'single_elim', defaultSeries: 'BO1', seriesByRound: { final: 'BO5', semifinal: 'BO1', ronda_9999: 'BO3' } }, 16)
  assert.deepEqual(c.seriesByRound, { final: 'BO5' })
})
test('points scoring requires a win worth more than a loss and at least one tiebreaker', () => {
  const base = { ...initialCompetition(), system: 'round_robin', scoring: { model: 'match_points', win: 1, draw: 1, loss: 3, allowDraw: true, tiebreakers: [] } }
  assert.ok(validateCompetition(base, 8).scoring)
  assert.deepEqual(validateCompetition({ ...base, scoring: { model: 'match_points', win: 3, draw: 1, loss: 0, allowDraw: true, tiebreakers: ['wins'] } }, 8), {})
})
test('groups + playoffs must split the field evenly and leave room to advance', () => {
  assert.ok(validateCompetition({ ...initialCompetition(), system: 'groups_playoffs', groups: 3 }, 16).groups)
  assert.ok(validateCompetition({ ...initialCompetition(), system: 'groups_playoffs', groups: 4, advancePerGroup: 4 }, 16).advancePerGroup)
  assert.deepEqual(validateCompetition({ ...initialCompetition(), system: 'groups_playoffs', groups: 4, advancePerGroup: 2 }, 16), {})
})
test('season copy carries the competitive structure and stays in the same series', () => {
  const source = { ...initialTournamentForm(), _id: 'old', title: 'Liga', seriesId: 'series-1', gameId: 'league-of-legends',
    competition: { ...initialCompetition(), system: 'swiss', swissRounds: 6, defaultSeries: 'BO3' } }
  const next = nextSeason(source, {})
  assert.equal(next.seriesId, 'series-1')
  assert.equal(next.gameId, 'league-of-legends')
  assert.equal(next.competition.system, 'swiss')
  assert.equal(next.competition.swissRounds, 6)
})
test('allowing minors still enforces the configured minimum age', () => {
  assert.equal(participantRestrictions({ members: [player('A', 'RD', '2015-01-01')] }, { ...restricted, minorsAllowed: true, minAge: 13 }).length, 0)
  assert.ok(participantRestrictions({ members: [player('A', 'RD', '2020-01-01')] }, { ...restricted, minorsAllowed: true, minAge: 13 }).length)
})
