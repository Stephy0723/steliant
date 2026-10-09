import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { registerTeam, registerTeamForUser } from './tournament.controller.js'
import { registerTournamentAsDiscordUser } from './bots.controller.js'

test('Mongo: consentimiento obligatorio de MLBB, persistencia y otros juegos', { skip: process.env.GAME_ACCOUNT_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_consent_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  try {
    const oid = () => new mongoose.Types.ObjectId()
    const user = { _id: oid(), nick: 'Capitan', emailVerified: true }
    await User.collection.insertOne({ ...user, discord: { id: '123456789' }, playerCode: 'CONSENT-PLAYER' })
    const makeTournament = async (game, index) => {
      const teamId = oid(), tournamentId = oid()
      await Team.collection.insertOne({ _id: teamId, publicCode: String(teamId), internalCode: String(teamId), teamInviteCode: String(teamId), name: `Equipo ${index}`, tag: `C${index}`, game, leader: user._id, members: [user._id], rosterSlots: { 'titular-1': { userId: String(user._id), nick: user.nick, gameId: '123456 (1234)', discordId: '123456789' } } })
      await Tournament.collection.insertOne({ _id: tournamentId, publicId: `CONSENT-${index}`, tournamentCode: `CONSENT-${index}`, organizerCode: 'CONSENT-ORG', gameCode: 'MLBB', countryCode: 'DO', title: `Copa ${index}`, organizer: user._id, game, modality: '1v1', status: 'open', maxSlots: 8, currentSlots: 0, date: new Date(Date.now() + 86400000), registrationWindow: { start: new Date(Date.now() - 60000), end: new Date(Date.now() + 3600000) }, registrations: [], discordEnabled: false })
      return { teamId, tournamentId }
    }
    for (const [index, game] of ['Mobile Legends: Bang Bang', 'mobile-legends-bang-bang'].entries()) {
      const { teamId, tournamentId } = await makeTournament(game, index)
      for (const dataConsent of [undefined, false, 'true', 1]) {
        await assert.rejects(registerTeamForUser(user, String(tournamentId), { teamId, dataConsent }), error => error.status === 400 && error.payload?.code === 'DATA_CONSENT_REQUIRED')
      }
      assert.equal((await Tournament.findById(tournamentId)).registrations.length, 0)
      let result, failure
      await registerTeam({ user, params: { id: String(tournamentId) }, body: { teamId, dataConsent: true } }, { json: value => { result = value } }, error => { failure = error })
      if (failure) throw failure
      assert.ok(result.tournament)
      const registration = (await Tournament.findById(tournamentId).lean()).registrations[0]
      assert.equal(String(registration.dataConsent.acceptedBy), String(user._id))
      assert.ok(registration.dataConsent.acceptedAt instanceof Date)
    }
    const { teamId, tournamentId } = await makeTournament('valorant', 2)
    await registerTeamForUser(user, String(tournamentId), { teamId })
    assert.equal((await Tournament.findById(tournamentId).lean()).registrations[0].dataConsent, undefined)

    // Discord no tiene casilla de consentimiento: manda a la web con el enlace.
    const mlbb = await makeTournament('Mobile Legends: Bang Bang', 3)
    let botError
    await registerTournamentAsDiscordUser({ params: { id: 'CONSENT-3' }, body: { discordId: '123456789' } }, { json: () => assert.fail('no debia inscribir') }, error => { botError = error })
    assert.equal(botError?.status, 400)
    assert.equal(botError.payload.code, 'DATA_CONSENT_REQUIRED')
    assert.match(botError.payload.url, /\/torneos\/CONSENT-3\/inscripcion$/)
    assert.ok(botError.message.includes(botError.payload.url))
    assert.equal((await Tournament.findById(mlbb.tournamentId).lean()).registrations.length, 0)
  } finally {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
