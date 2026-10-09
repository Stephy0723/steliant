import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { GameAccount } from '../models/GameAccount.js'
import { Tournament } from '../models/Tournament.js'
import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { updateMyRosterSlot, createTeamForUser } from './team.controller.js'
import {
  sendGameCode, verifyGameCode, confirmGameAccount, disconnectGameAccount, getMyGameAccounts, getGameAccountStatus,
} from './gameAccount.controller.js'

const call = async (handler, req) => {
  let result, error, status = 200
  await handler(req, { status(code) { status = code; return this }, json: value => { result = value; if (status >= 400) error = Object.assign(new Error(value.message), { status }) } }, e => { error = e })
  if (error) throw error
  return result
}

// Servicio del juego simulado: el codigo correcto es 4821 para cualquier cuenta.
function stubGameApi() {
  const original = globalThis.fetch
  const sent = []
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname.replace(/^\/api/, '')
    const body = init.body ? JSON.parse(init.body) : {}
    const reply = (status, data) => ({ status, json: async () => data })
    if (path === '/user/auth/send-vc') { sent.push(body); return reply(200, { code: 0 }) }
    if (path === '/user/auth/login') {
      return body.vc === 4821 ? reply(200, { code: 0, data: { jwt: `jwt-${body.role_id}`, roleid: body.role_id, zoneid: body.zone_id } }) : reply(500, { status: 'error' })
    }
    if (path === '/user/info') return reply(200, { code: 0, data: { name: 'xX_Neo_Xx', level: 87, rank_level: 120 } })
    if (path === '/user/auth/logout') return reply(200, { code: 0 })
    throw new Error(`ruta no simulada ${path}`)
  }
  return { sent, restore: () => { globalThis.fetch = original } }
}

test('Mongo: codigo, confirmacion, dueno real, bloqueo en torneo y desconexion', { skip: process.env.GAME_ACCOUNT_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_gameacc_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  const api = stubGameApi()
  try {
    await GameAccount.init()
    const oid = () => new mongoose.Types.ObjectId()
    const ana = oid(), luis = oid()
    await User.collection.insertMany([
      { _id: ana, nick: 'ana', email: 'ana@test.local', playerCode: 'GAMEACC-ANA', internalCode: 'GAMEACC-ANA', gamerProfile: { pro: { entries: [{ gameId: 'mobile-legends-bang-bang', accountId: '1 (1)', role: 'Tirador' }] } } },
      { _id: luis, nick: 'luis', email: 'luis@test.local', playerCode: 'GAMEACC-LUIS', internalCode: 'GAMEACC-LUIS' },
    ])
    const req = (user, body = {}, query = {}) => ({ user: { _id: user }, body, query })
    // Ana juega en dos equipos de MLBB: uno libre y otro con check-in en un torneo en curso.
    const freeTeam = oid(), lockedTeam = oid(), valoTeam = oid()
    const slot = (gameId) => ({ 'titular-1': { userId: String(ana), nick: 'ana', gameId, role: 'Tirador' } })
    await Team.collection.insertMany([
      { _id: freeTeam, name: 'Libre', tag: 'LIB', game: 'mobile-legends-bang-bang', leader: ana, members: [ana], rosterSlots: slot(''), publicCode: 'GA-1', internalCode: 'GA-1', teamInviteCode: 'GA-1' },
      { _id: lockedTeam, name: 'Congelado', tag: 'CON', game: 'Mobile Legends: Bang Bang', leader: luis, members: [luis, ana], rosterSlots: slot('111111 (1)'), publicCode: 'GA-2', internalCode: 'GA-2', teamInviteCode: 'GA-2' },
      { _id: valoTeam, name: 'Valo', tag: 'VAL', game: 'valorant', leader: ana, members: [ana], rosterSlots: slot('ana#LAT'), publicCode: 'GA-3', internalCode: 'GA-3', teamInviteCode: 'GA-3' },
    ])
    await Tournament.collection.insertOne({ _id: oid(), title: 'Copa Congelada', status: 'ongoing', registrations: [{ team: lockedTeam, status: 'checked_in' }] })

    // Luis registra primero el ID de Ana (no es suyo, pero tiene el codigo de prueba).
    await call(sendGameCode, req(luis, { roleId: '123456789', zoneId: '2045' }))
    await call(verifyGameCode, req(luis, { code: '4821' }))
    await call(confirmGameAccount, req(luis, { accept: true }))

    // Ana: codigo malo, luego bueno, ve sus datos y confirma.
    const sent = await call(sendGameCode, req(ana, { roleId: '123456789', zoneId: '(2045)' }))
    assert.equal(sent.claimedByOther, true)
    await assert.rejects(call(verifyGameCode, req(ana, { code: '0000' })), e => e.status === 400)
    const checked = await call(verifyGameCode, req(ana, { code: '4821' }))
    assert.equal(checked.pending.status, 'pending_confirm')
    assert.equal(checked.pending.nickname, 'xX_Neo_Xx')
    assert.equal(checked.pending.rank, 'Leyenda')
    const confirmed = await call(confirmGameAccount, req(ana, { accept: true }))
    assert.equal(confirmed.account.status, 'verified')

    // Quien demostro el codigo despues gana: Luis pierde la cuenta y recibe aviso.
    const luisAccount = await GameAccount.findOne({ user: luis, status: { $ne: 'pending_code' } }).sort({ updatedAt: -1 }).lean()
    assert.equal(luisAccount.status, 'revoked')
    assert.equal(luisAccount.revokedReason, 'claimed_by_owner')
    assert.equal(await GameAccount.countDocuments({ roleId: '123456789', zoneId: '2045', status: 'verified' }), 1)

    // Su puesto en el equipo libre de MLBB recibe ID y nick del juego; el
    // congelado y el de otro juego no se tocan.
    const teamsAfter = Object.fromEntries((await Team.find({ _id: { $in: [freeTeam, lockedTeam, valoTeam] } }).lean()).map(t => [t.name, t.rosterSlots['titular-1']]))
    assert.equal(teamsAfter.Libre.gameId, '123456789 (2045)')
    assert.equal(teamsAfter.Libre.nick, 'xX_Neo_Xx')
    assert.equal(teamsAfter.Libre.role, 'Tirador')
    assert.equal(teamsAfter.Congelado.gameId, '111111 (1)')
    assert.equal(teamsAfter.Valo.gameId, 'ana#LAT')

    // Editar su ficha del equipo no deja escribir otro ID: se usa el verificado.
    const edited = await call(updateMyRosterSlot, { params: { teamId: String(freeTeam) }, user: { _id: ana, nick: 'ana', email: 'ana@test.local' }, body: { gameId: '999999 (9)', nick: 'Otro nick' } })
    assert.equal(edited.rosterSlots['titular-1'].gameId, '123456789 (2045)')
    assert.equal(edited.rosterSlots['titular-1'].nick, 'Otro nick')
    // Abrir la web despues solo corrige el ID, no pisa el nick que eligio.
    await Team.collection.updateOne({ _id: freeTeam }, { $set: { 'rosterSlots.titular-1.gameId': '' } })
    await call(getMyGameAccounts, req(ana))
    const backfilled = (await Team.findById(freeTeam).lean()).rosterSlots['titular-1']
    assert.equal(backfilled.gameId, '123456789 (2045)')
    assert.equal(backfilled.nick, 'Otro nick')
    await Tournament.collection.deleteMany({ title: 'Copa Congelada' })

    // Crear un equipo de MLBB: el puesto del fundador sale con su ID verificado
    // aunque el formulario no lo traiga.
    const anaDoc = { ...(await User.findById(ana).lean()), countryCode: 'DO' }
    const created = await createTeamForUser(anaDoc, { name: 'Nuevo ML', tag: 'NML', game: 'mobile-legends-bang-bang', allowMultipleTeams: true, rosterSlots: { 'titular-1': { nick: 'ana', userId: String(ana), gameId: '' } } })
    assert.equal(created.rosterSlots['titular-1'].gameId, '123456789 (2045)')

    // La tarjeta de jugador queda con el ID verificado.
    const anaUser = await User.findById(ana).lean()
    assert.equal(anaUser.gamerProfile.pro.entries[0].accountId, '123456789 (2045)')
    assert.equal(anaUser.gamerProfile.pro.entries[0].role, 'Tirador')

    // Insignia publica: verificada, sin ID.
    const status = await call(getGameAccountStatus, req(luis, {}, { users: `${ana},${luis},basura` }))
    assert.equal(status.statuses[String(ana)].mlbb.verified, true)
    assert.equal(status.statuses[String(luis)].mlbb, null)
    assert.ok(!JSON.stringify(status).includes('123456789'))

    // Ya verificada la misma cuenta -> 409.
    await assert.rejects(call(sendGameCode, req(ana, { roleId: '123456789', zoneId: '2045' })), e => e.status === 409)

    // En un torneo activo con check-in no puede desconectar ni cambiar.
    const tid = oid()
    await Tournament.collection.insertOne({ _id: tid, title: 'Copa Test', status: 'ongoing', registrations: [{ team: oid(), status: 'checked_in', rosterSnapshot: [{ userId: ana, nick: 'ana' }] }] })
    await assert.rejects(call(disconnectGameAccount, req(ana)), e => e.status === 409 && /Copa Test/.test(e.message))
    await assert.rejects(call(sendGameCode, req(ana, { roleId: '555555555', zoneId: '2045' })), e => e.status === 409)

    // Termina el torneo: ya puede desconectar.
    await Tournament.collection.updateOne({ _id: tid }, { $set: { status: 'finished' } })
    await call(disconnectGameAccount, req(ana))
    const mine = await call(getMyGameAccounts, req(ana))
    assert.equal(mine.mlbb.account, null)

    // "No es mi cuenta": se descarta sin verificar.
    await call(sendGameCode, req(ana, { roleId: '777777777', zoneId: '1' }))
    await call(verifyGameCode, req(ana, { code: '4821' }))
    await call(confirmGameAccount, req(ana, { accept: false }))
    assert.equal(await GameAccount.countDocuments({ user: ana, roleId: '777777777' }), 0)

    // Demasiados intentos con un codigo.
    await call(sendGameCode, req(ana, { roleId: '888888888', zoneId: '1' }))
    for (let i = 0; i < 5; i++) await assert.rejects(call(verifyGameCode, req(ana, { code: '0000' })), e => e.status === 400)
    await assert.rejects(call(verifyGameCode, req(ana, { code: '4821' })), e => e.status === 429)
    // Los intentos bloqueados (ya verificada, torneo activo) no llegan a mandar correo al juego.
    assert.equal(api.sent.length, 4)
  } finally {
    api.restore()
    if (mongoose.connection.name !== dbName || !/^gg_gameacc_test_\d+_\d+$/.test(dbName)) throw new Error('Unexpected test database')
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
