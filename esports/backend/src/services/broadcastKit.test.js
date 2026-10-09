import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBroadcastTeams, broadcastKitUserIds } from './broadcastKit.service.js'

const LEADER = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const MEMBER = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const NEWBIE = 'cccccccccccccccccccccccc'
const SOLO = 'dddddddddddddddddddddddd'

const users = new Map([
  [LEADER, { nick: 'Capi', avatar: '/uploads/capi-cuenta.png' }],
  [MEMBER, { nick: 'Miembro', avatar: '/uploads/miembro.png' }],
  [NEWBIE, { nick: 'Nuevo', avatar: '/uploads/nuevo.png' }],
  [SOLO, { nick: 'Solista', avatar: '/uploads/solo.png' }],
])

const team = (rosterSlots) => ({
  _id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Glitch', tag: 'GLT', color: '#f0f', logo: '/uploads/logo.png',
  leader: LEADER, members: [LEADER, MEMBER], rosterSlots,
})

test('usa el roster congelado del check-in, ordenado titulares -> suplentes -> staff', () => {
  const [kit] = buildBroadcastTeams([{
    _id: 'r1', status: 'checked_in',
    team: team({ 'titular-1': { userId: LEADER, nick: 'Capi', avatar: '/uploads/capi-equipo.png' } }),
    rosterSnapshot: [
      { userId: null, nick: 'CoachSinCuenta', slot: 'coach-1' },
      { userId: MEMBER, nick: 'Miembro', slot: 'sub-1' },
      { userId: LEADER, nick: 'Capi', slot: 'titular-1' },
    ],
  }], users)

  assert.equal(kit.source, 'checkin')
  assert.equal(kit.logo, '/uploads/logo.png')
  assert.deepEqual(kit.players.map(p => [p.nick, p.role]), [['Capi', 'Titular'], ['Miembro', 'Suplente'], ['CoachSinCuenta', 'Coach']])
  // La foto que subio para el equipo gana sobre la de la cuenta.
  assert.equal(kit.players[0].avatar, '/uploads/capi-equipo.png')
  assert.equal(kit.players[0].captain, true)
  assert.equal(kit.players[1].avatar, '/uploads/miembro.png')
  assert.equal(kit.players[2].avatar, '')
})

test('si otro ocupa el puesto despues del check-in, no se le pone su foto al jugador congelado', () => {
  const [kit] = buildBroadcastTeams([{
    _id: 'r1', status: 'checked_in',
    team: team({ 'titular-2': { userId: NEWBIE, nick: 'Nuevo', avatar: '/uploads/nuevo-equipo.png' } }),
    rosterSnapshot: [{ userId: MEMBER, nick: 'Miembro', slot: 'titular-2' }],
  }], users)
  assert.equal(kit.players[0].avatar, '/uploads/miembro.png')
})

test('sin check-in usa los puestos actuales; sin puestos, las cuentas miembro', () => {
  const [withSlots, withoutSlots] = buildBroadcastTeams([
    { _id: 'r1', status: 'registered', team: team({ 'titular-1': { userId: NEWBIE, nick: 'Nuevo' }, 'titular-2': null }) },
    { _id: 'r2', status: 'registered', team: team(undefined) },
  ], users)
  assert.equal(withSlots.source, 'roster')
  assert.deepEqual(withSlots.players.map(p => p.nick), ['Nuevo'])
  assert.equal(withSlots.players[0].avatar, '/uploads/nuevo.png')
  assert.deepEqual(withoutSlots.players.map(p => p.nick), ['Capi', 'Miembro'])
})

test('inscripcion individual y retirados', () => {
  const regs = [
    { _id: 'r1', status: 'registered', team: null, user: SOLO },
    { _id: 'r2', status: 'withdrawn', team: team(undefined) },
  ]
  const kit = buildBroadcastTeams(regs, users)
  assert.equal(kit.length, 1)
  assert.equal(kit[0].source, 'individual')
  assert.equal(kit[0].name, 'Solista')
  assert.deepEqual(kit[0].players.map(p => p.avatar), ['/uploads/solo.png'])
  assert.deepEqual(broadcastKitUserIds(regs), [SOLO])
})
