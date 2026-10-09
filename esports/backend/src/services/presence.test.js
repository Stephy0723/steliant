import test from 'node:test'
import assert from 'node:assert/strict'
import { presenceId, publicPresence, withPublicPresence } from '../../../shared/presence.mjs'

test('presencia: conectado muestra el estado elegido; desconectado o invisible, "offline"', () => {
  assert.equal(presenceId({ status: 'online', activeStatus: 'dnd' }), 'dnd')
  assert.equal(presenceId({ status: 'online', activeStatus: 'playing' }), 'playing')
  assert.equal(presenceId({ status: 'online' }), 'online')
  assert.equal(presenceId({ status: 'online', activeStatus: 'invisible' }), 'online') // el socket ya lo pone offline; nunca se muestra "Invisible"
  assert.equal(presenceId({ status: 'offline', activeStatus: 'dnd' }), 'offline')
  assert.equal(presenceId({ status: 'ban', activeStatus: 'online' }), 'offline')
  assert.equal(presenceId({ presence: 'afk' }), 'afk')
})

test('presencia publica: no revela el estado elegido de alguien desconectado', () => {
  const offline = withPublicPresence({ nick: 'A', status: 'offline', activeStatus: 'invisible', lastSeenAt: new Date('2026-10-07') })
  assert.equal(offline.activeStatus, undefined)
  assert.equal(offline.presence, 'offline')
  assert.equal(offline.online, false)
  assert.ok(offline.lastSeenAt)
  const online = publicPresence({ status: 'online', activeStatus: 'live', lastSeenAt: new Date() })
  assert.deepEqual(online, { online: true, presence: 'live', lastSeenAt: null })
  // Ya resuelto (lista de miembros): se respeta.
  assert.equal(publicPresence({ presence: 'torneo', online: true }).presence, 'torneo')
})
