import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Tournament } from '../models/Tournament.js'
import { TeamInvitation } from '../models/TeamInvitation.js'
import { TeamMembershipHistory } from '../models/TeamMembershipHistory.js'
import {
  inviteToTeam, respondTeamInvitation, requestToJoin, respondJoinRequest,
  removeTeamMember, changeTeamMemberRole, updateMyTeam, updateMyRosterSlot, leaveTeam, createTeamForUser, getInviteSuggestions, getUserTeams,
  memberTeamRole, teamRoleCounts,
} from './team.controller.js'
import { participantRestrictions } from '../services/tournamentSetup.service.js'

// Llama un controller con req/res de prueba y devuelve { status, body }.
function call(fn, req) {
  return new Promise(resolve => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(body) { resolve({ status: this.statusCode, body }) },
    }
    fn({ params: {}, query: {}, body: {}, ...req }, res, err => resolve({ status: err.status || 500, body: { message: err.message, ...(err.payload || {}) } }))
  })
}

test('participantRestrictions: pais y edad son de jugadores, el staff no cuenta', () => {
  const adult = { _id: new mongoose.Types.ObjectId(), nick: 'Titular', countryCode: 'RD', birthDate: new Date('2000-01-01') }
  const minorCoach = { _id: new mongoose.Types.ObjectId(), nick: 'CoachJoven', countryCode: 'MX', birthDate: new Date('2012-01-01') }
  const tournament = { minAge: 18, date: new Date('2026-12-01'), participationScope: 'regional', allowedCountries: ['RD'] }
  const asCoach = { members: [adult, minorCoach], rosterSlots: { 'titular-1': { userId: String(adult._id), nick: 'Titular' }, coach: { userId: String(minorCoach._id), nick: 'CoachJoven' } } }
  assert.deepEqual(participantRestrictions(asCoach, tournament), [])
  const asSub = { members: [adult, minorCoach], rosterSlots: { 'titular-1': { userId: String(adult._id), nick: 'Titular' }, 'sub-1': { userId: String(minorCoach._id), nick: 'CoachJoven' } } }
  assert.equal(participantRestrictions(asSub, tournament).length, 2)
})

test('Mongo: coach de la invitacion al plantel, cupos separados, expulsar y cambiar de rol', { skip: process.env.TEAM_TEST_MONGO !== '1' }, async () => {
  const dbName = `gg_team_roles_test_${process.pid}_${Date.now()}`
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 })
  try {
    const oid = () => new mongoose.Types.ObjectId()
    let n = 0
    const makeUser = async (nick, extra = {}) => {
      n += 1
      const doc = { _id: oid(), nick, email: `${nick.toLowerCase()}@t.gg`, playerCode: `TR-${n}`, internalCode: `TR-I-${n}`, countryCode: 'RD', gender: 'female', emailVerified: true, ...extra }
      await User.collection.insertOne(doc)
      return User.findById(doc._id)
    }
    const MLBB = 'Mobile Legends: Bang Bang'
    const leader = await makeUser('Capitana')
    const coach = await makeUser('CoachPro', { gender: 'male', roleProfiles: { coach: { coachCode: 'COA-1', approvedAt: new Date() } } })
    const player2 = await makeUser('Jugadora2')
    const player3 = await makeUser('Jugadora3')
    const analyst = await makeUser('Analista1', { gender: 'male' })
    const coach2 = await makeUser('CoachNuevo', { gender: 'male' })
    const manager = await makeUser('Manager1', { gender: 'male' })
    const otherLeader = await makeUser('OtroLider', { gender: 'male' })
    const outsider = await makeUser('Ajeno', { gender: 'male' })

    const teamId = oid(), otherTeamId = oid()
    await Team.collection.insertMany([
      { _id: teamId, publicCode: 'TEAM-R1', internalCode: 'TEAM-RI1', teamInviteCode: 'INV-R1', name: 'Las Glitch', tag: 'LGL', game: MLBB, gender: 'Femenino', leader: leader._id, members: [leader._id], maxMembers: 2, acceptRequests: true, joinRequests: [], rosterSlots: { 'titular-1': { userId: String(leader._id), nick: 'Capitana' } } },
      // El coach es JUGADOR de otro equipo del mismo juego: como staff igual puede entrar.
      { _id: otherTeamId, publicCode: 'TEAM-R2', internalCode: 'TEAM-RI2', teamInviteCode: 'INV-R2', name: 'Otro Equipo', tag: 'OTR', game: MLBB, leader: otherLeader._id, members: [otherLeader._id, coach._id], maxMembers: 10, acceptRequests: true, joinRequests: [], rosterSlots: { 'titular-1': { userId: String(otherLeader._id), nick: 'OtroLider' }, 'titular-2': { userId: String(coach._id), nick: 'CoachPro' } } },
    ])
    await User.updateOne({ _id: coach._id }, { team: otherTeamId })
    const asLeader = { user: leader, params: { teamId: String(teamId) } }
    const invite = (who, role) => call(inviteToTeam, { ...asLeader, body: { userId: String(who._id), role } })
    const accept = async (who, invitationId) => call(respondTeamInvitation, { user: await User.findById(who._id), params: { invId: invitationId }, body: { accept: true } })

    // 1. Como jugador no entra (equipo femenino); como coach si.
    assert.equal((await invite(coach, 'player')).status, 400)
    const coachInvite = await invite(coach, 'coach')
    assert.equal(coachInvite.status, 201)
    assert.equal(coachInvite.body.invitation.role, 'coach')
    const coachAccepted = await accept(coach, coachInvite.body.invitation.id)
    assert.equal(coachAccepted.status, 200, coachAccepted.body.message)
    assert.equal(coachAccepted.body.team.role, 'coach')
    let team = await Team.findById(teamId).lean()
    assert.equal(team.rosterSlots.coach.userId, String(coach._id))
    assert.equal(team.rosterSlots.coach.roleVerified, true)
    assert.equal(memberTeamRole(team, coach._id), 'coach')
    assert.deepEqual({ player: teamRoleCounts(team).player, staff: teamRoleCounts(team).staff }, { player: 1, staff: 1 })
    // Su "equipo" sigue siendo donde juega.
    assert.equal(String((await User.findById(coach._id).lean()).team), String(otherTeamId))

    // 2. El staff no ocupa cupo de jugador: con 2/2 jugadores entra el analista.
    const p2 = await invite(player2, 'player')
    assert.equal((await accept(player2, p2.body.invitation.id)).status, 200)
    const full = await invite(player3, 'player')
    assert.equal(full.status, 400)
    assert.equal(full.body.code, 'full')
    const an = await invite(analyst, 'analyst')
    assert.equal(an.status, 201, an.body.message)
    assert.equal((await accept(analyst, an.body.invitation.id)).status, 200)

    // 3. Cupo de staff: no se puede bajar por debajo del staff actual; lleno, no entra nadie mas.
    assert.equal((await call(updateMyTeam, { ...asLeader, body: { maxStaff: 1 } })).status, 400)
    assert.equal((await call(updateMyTeam, { ...asLeader, body: { maxStaff: 2 } })).status, 200)
    const staffFull = await invite(manager, 'manager')
    assert.equal(staffFull.status, 400)
    assert.equal(staffFull.body.code, 'staff_full')
    assert.equal((await call(updateMyTeam, { ...asLeader, body: { maxStaff: 4 } })).status, 200)

    // 4. Solicitud "como coach": guarda el rol y la tarjeta (sin verificar), al aceptar va a coach-2.
    const requested = await call(requestToJoin, { user: coach2, params: { teamId: String(teamId) }, body: { role: 'coach', message: 'Fui coach en MPL' } })
    assert.equal(requested.status, 200, requested.body.message)
    team = await Team.findById(teamId)
    const request = team.joinRequests.find(r => String(r.user) === String(coach2._id))
    assert.equal(request.role, 'coach')
    assert.equal(request.card.verified, false)
    assert.equal((await call(respondJoinRequest, { ...asLeader, params: { teamId: String(teamId), reqId: String(request._id) }, body: { accept: true } })).status, 200)
    team = await Team.findById(teamId).lean()
    assert.equal(team.rosterSlots['coach-2'].userId, String(coach2._id))
    assert.equal(team.rosterSlots['coach-2'].roleVerified, false)

    // 5. Maximo 2 coaches por equipo aunque sobre cupo de staff.
    const thirdCoach = await invite(manager, 'coach')
    assert.equal(thirdCoach.status, 400)
    assert.equal(thirdCoach.body.code, 'role_full')

    // 6. Cambiar de rol: a jugador respeta el cupo de jugadores; analista -> manager si.
    const toPlayer = await call(changeTeamMemberRole, { ...asLeader, params: { teamId: String(teamId), userId: String(coach2._id) }, body: { role: 'player' } })
    assert.equal(toPlayer.status, 400)
    const toManager = await call(changeTeamMemberRole, { ...asLeader, params: { teamId: String(teamId), userId: String(analyst._id) }, body: { role: 'manager' } })
    assert.equal(toManager.status, 200, toManager.body.message)
    team = await Team.findById(teamId).lean()
    assert.equal(team.rosterSlots.manager.userId, String(analyst._id))
    assert.ok(!team.rosterSlots.analyst || team.rosterSlots.analyst.userId !== String(analyst._id))
    assert.equal((await call(changeTeamMemberRole, { ...asLeader, params: { teamId: String(teamId), userId: String(leader._id) }, body: { role: 'coach' } })).status, 400)
    assert.equal((await call(changeTeamMemberRole, { ...asLeader, params: { teamId: String(teamId), userId: String(analyst._id) }, body: { role: 'jefe' } })).status, 400)

    // 7. Plantel a mano: nadie que no sea miembro entra a un puesto, ni con su
    //    cuenta ni con un nick escrito (no valida reglas ni consentimiento).
    for (const intruder of [{ userId: String(outsider._id), nick: 'Ajeno', playerCode: outsider.playerCode }, { nick: 'Random123', gameId: '999 (1)' }]) {
      const manual = await call(updateMyTeam, { ...asLeader, body: { rosterSlots: { ...team.rosterSlots, 'sub-1': intruder } } })
      assert.equal(manual.status, 400, JSON.stringify(manual.body))
      assert.equal(manual.body.code, 'NOT_A_MEMBER')
    }
    // Patrocinador (marca, no persona) si se escribe a mano; datos personales nunca se guardan.
    const sponsor = await call(updateMyTeam, { ...asLeader, body: { rosterSlots: { ...team.rosterSlots, 'patrocinador-1': { nick: 'Marca X' }, 'titular-1': { ...team.rosterSlots['titular-1'], cedula: '001-1234567-8', whatsapp: '8095550000' } } } })
    assert.equal(sponsor.status, 200, sponsor.body.message)
    team = await Team.findById(teamId).lean()
    assert.equal(team.rosterSlots['patrocinador-1'].nick, 'Marca X')
    assert.equal(team.rosterSlots['titular-1'].cedula, undefined)
    assert.equal(team.rosterSlots['titular-1'].whatsapp, undefined)
    // ...y una persona no puede ocupar dos puestos.
    const twice = { ...team.rosterSlots, 'sub-2': { ...team.rosterSlots.coach } }
    assert.equal((await call(updateMyTeam, { ...asLeader, body: { rosterSlots: twice } })).status, 400)
    // Nadie se nombra coach solo.
    const selfCoach = await call(updateMyRosterSlot, { user: await User.findById(player2._id), params: { teamId: String(teamId) }, body: { slot: 'coach' } })
    assert.ok(selfCoach.status === 200 || selfCoach.status === 403) // tiene puesto: se queda en el suyo
    team = await Team.findById(teamId).lean()
    assert.notEqual(team.rosterSlots.coach?.userId, String(player2._id))

    // 8. Expulsar: sale de miembros y del plantel, queda en el historial y se le avisa.
    assert.equal((await call(removeTeamMember, { ...asLeader, params: { teamId: String(teamId), userId: String(leader._id) } })).status, 400)
    const kicked = await call(removeTeamMember, { ...asLeader, params: { teamId: String(teamId), userId: String(coach._id) }, body: { reason: 'Fin de temporada' } })
    assert.equal(kicked.status, 200, kicked.body.message)
    assert.equal(kicked.body.removed.role, 'coach')
    team = await Team.findById(teamId).lean()
    assert.ok(!team.members.some(id => String(id) === String(coach._id)))
    assert.ok(!Object.values(team.rosterSlots).some(slot => slot?.userId === String(coach._id)))
    const history = await TeamMembershipHistory.findOne({ user: coach._id }).lean()
    assert.equal(history.reason, 'removed')
    assert.equal(history.teamRole, 'coach')
    const notifs = await mongoose.connection.db.collection('notifications').find({ userId: coach._id }).toArray()
    assert.ok(notifs.some(x => x.type === 'team_member_removed' && /Fin de temporada/.test(x.message)), JSON.stringify(notifs.map(x => x.type)))

    // 9. Salir por su cuenta: el lider se entera.
    assert.equal((await call(leaveTeam, { user: coach2, body: { teamId: String(teamId) } })).status, 200)
    const leaderNotifs = await mongoose.connection.db.collection('notifications').find({ userId: leader._id, type: 'team_member_left' }).toArray()
    assert.equal(leaderNotifs.length, 1)

    // 10. Ser staff de un equipo no impide crear el propio. Al crear solo queda
    //     el puesto del lider: los compañeros escritos en el asistente no entran
    //     (se invitan despues) y su cedula/WhatsApp no se guarda.
    const own = await createTeamForUser(await User.findById(analyst._id), {
      name: 'Equipo Analista', tag: 'ANL', game: MLBB, country: 'RD',
      rosterSlots: {
        'titular-1': { userId: String(analyst._id), nick: 'Capi', cedula: '001-0000000-1', whatsapp: '8090000000' },
        'titular-2': { nick: 'Amigo', cedula: '001-0000000-2', gameId: '123 (4)' },
        'patrocinador-1': { nick: 'Sponsor' },
      },
    })
    const ownTeam = await Team.findById(own?._id || own?.team?._id).lean()
    assert.equal(ownTeam.rosterSlots['titular-1'].userId, String(analyst._id))
    assert.equal(ownTeam.rosterSlots['titular-1'].cedula, undefined)
    assert.equal(ownTeam.rosterSlots['titular-2'], undefined)
    assert.equal(ownTeam.rosterSlots['patrocinador-1'].nick, 'Sponsor')

    // 10b. Sugerencias al invitar: amigos primero, despues nicks parecidos
    //      (tambien con errores de tipeo), nunca uno mismo ni quien lo bloqueo.
    const friendCoach = await makeUser('CoachZeta', { gender: 'male' })
    const strangerCoach = await makeUser('CoachAlfa', { gender: 'male' })
    const blocker = await makeUser('CoachBloqueo', { gender: 'male', blockedUsers: [leader._id] })
    await User.updateOne({ _id: leader._id }, { $set: { friends: [friendCoach._id] } })
    const sugg = await call(getInviteSuggestions, { ...asLeader, query: { q: 'coach', role: 'coach' } })
    assert.equal(sugg.status, 200, sugg.body.message)
    const nicks = sugg.body.suggestions.map(s => s.nick)
    assert.equal(nicks[0], 'CoachZeta')
    assert.equal(sugg.body.suggestions[0].friend, true)
    assert.ok(nicks.includes('CoachAlfa'))
    assert.ok(!nicks.includes('CoachBloqueo') && !nicks.includes('Capitana'))
    assert.ok(sugg.body.suggestions.every(s => typeof s.canInvite === 'boolean'))
    const typo = await call(getInviteSuggestions, { ...asLeader, query: { q: 'cchzt', role: 'coach' } })
    assert.ok(typo.body.suggestions.some(s => s.nick === 'CoachZeta'))
    void strangerCoach; void blocker

    // 10c. Perfil ajeno: muestra el equipo REAL de esa persona (antes salia el
    //      de quien miraba), con su rol; respeta plantel oculto y privacidad.
    const seen = await call(getUserTeams, { user: outsider, params: { userId: String(player2._id) } })
    assert.equal(seen.status, 200)
    assert.deepEqual(seen.body.teams.map(t => t.name), ['Las Glitch'])
    assert.equal(seen.body.teams[0].memberRole, 'player')
    assert.equal(seen.body.teams[0].teamInviteCode, undefined)
    await Team.updateOne({ _id: teamId }, { $set: { showRoster: false } })
    assert.deepEqual((await call(getUserTeams, { user: outsider, params: { userId: String(player2._id) } })).body.teams, [])
    assert.equal((await call(getUserTeams, { user: await User.findById(leader._id), params: { userId: String(player2._id) } })).body.teams.length, 1)
    await Team.updateOne({ _id: teamId }, { $set: { showRoster: true } })
    await User.updateOne({ _id: player2._id }, { $set: { 'privacy.teamsVisibility': 'nobody' } })
    const hidden = await call(getUserTeams, { user: outsider, params: { userId: String(player2._id) } })
    assert.equal(hidden.body.private, true)
    assert.deepEqual(hidden.body.teams, [])

    // 11. Roster congelado tras el check-in: nadie entra ni sale.
    await Tournament.collection.insertOne({ _id: oid(), title: 'Copa Congelada', status: 'ongoing', registrations: [{ team: teamId, status: 'checked_in' }] })
    const locked = await call(removeTeamMember, { ...asLeader, params: { teamId: String(teamId), userId: String(player2._id) } })
    assert.equal(locked.status, 409)
    assert.equal(locked.body.code, 'ROSTER_LOCKED')
    const lockedInvite = await invite(manager, 'coach')
    assert.equal(lockedInvite.status, 201, lockedInvite.body.message) // invitar se puede; aceptar no
    assert.equal((await accept(manager, lockedInvite.body.invitation.id)).status, 409)
    assert.equal(await TeamInvitation.countDocuments({ user: manager._id, status: 'pending' }), 1)
  } finally {
    if (/^gg_team_roles_test_\d+_\d+$/.test(mongoose.connection.name)) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
