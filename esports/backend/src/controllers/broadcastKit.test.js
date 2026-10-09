import test from 'node:test'
import assert from 'node:assert/strict'
import { Tournament } from '../models/Tournament.js'
import { User } from '../models/User.js'
import { getBroadcastKit, staffTabAccess } from './tournament.controller.js'
import { ROLE_DEFAULT_ACCESS } from '../../../frontend/src/lib/staffPermissions.js'

const viewer = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }
const playerId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const tournament = () => ({
  _id: 'cccccccccccccccccccccccc', title: 'Copa', organizer: 'dddddddddddddddddddddddd',
  staffMembers: [{ user: viewer._id, role: 'Caster', status: 'accepted' }],
  registrations: [{
    _id: 'registration', status: 'checked_in',
    team: { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Equipo', logo: '/uploads/logo.png', publicProfile: false,
      leader: playerId, members: [playerId], rosterSlots: {} },
    rosterSnapshot: [{ userId: playerId, nick: 'Jugador del check-in', slot: 'titular-1' }],
  }],
})

function mockTournament(t, value) {
  const query = { select() { return this }, populate() { return this }, async lean() { return value } }
  t.mock.method(Tournament, 'findOne', () => query)
}

async function call(user = viewer) {
  let status = 200
  let body
  let error
  const res = { status(value) { status = value; return this }, json(value) { body = value; return this } }
  await getBroadcastKit({ params: { id: 'Copa' }, user }, res, err => { error = err })
  if (error) throw error
  return { status, body }
}

test('permisos de Equipos coinciden con el frontend para todos los roles', () => {
  for (const [role, permissions] of Object.entries(ROLE_DEFAULT_ACCESS)) {
    assert.equal(staffTabAccess({ role }, 'equipos'), permissions.equipos, role)
  }
})

test('caster recibe logos y fotos del roster congelado, incluso de un equipo privado', async t => {
  mockTournament(t, tournament())
  t.mock.method(User, 'find', () => ({ select() { return this }, async lean() {
    return [{ _id: playerId, nick: 'Nick actual', avatar: '/uploads/jugador.png' }]
  } }))
  const { status, body } = await call()
  assert.equal(status, 200)
  assert.equal(body.teams[0].source, 'checkin')
  assert.equal(body.teams[0].logo, '/uploads/logo.png')
  assert.equal(body.teams[0].players[0].nick, 'Jugador del check-in')
  assert.equal(body.teams[0].players[0].avatar, '/uploads/jugador.png')
})

test('usuario ajeno no recibe las fotos privadas del torneo', async t => {
  mockTournament(t, tournament())
  const response = await call({ _id: 'ffffffffffffffffffffffff' })
  assert.equal(response.status, 403)
  assert.equal(response.body.teams, undefined)
})

test('override sin acceso impide que un caster descargue el kit', async t => {
  const value = tournament()
  value.staffMembers[0].permissions = { equipos: 'none' }
  mockTournament(t, value)
  assert.equal((await call()).status, 403)
})

test('torneo inexistente devuelve 404', async t => {
  mockTournament(t, null)
  assert.equal((await call()).status, 404)
})
