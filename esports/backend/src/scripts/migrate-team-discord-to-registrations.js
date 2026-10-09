import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'

// El estado de sala Discord de un equipo vivia en Team.discordProvision (un
// solo objeto por equipo) hasta 2026-09-22, cuando se movio a
// Tournament.registrations[].discordProvision: un equipo puede estar
// inscrito en varios torneos activos a la vez, cada uno con su propia
// categoria/canales, y guardarlo en el equipo hacia que solo el primer
// torneo tuviera sala real -- los demas se confundian entre si (canal de
// equipo -> "cualquiera" de sus torneos activos, sin desambiguar).
//
// Esta migracion copia los datos existentes (canales/rol ya creados en
// Discord de verdad) a la inscripcion que mas probablemente los origino,
// para que el bot no intente crear canales duplicados la proxima vez que
// reintente. El campo salio del schema de Team.js, asi que se lee crudo
// via .lean() (Mongo igual devuelve lo guardado, este o no en el schema).
// Idempotente: una vez migrado un equipo, Team.discordProvision queda
// $unset (o el caso ambiguo se deja para revision manual), asi que correrla
// de nuevo sobre equipos ya migrados no hace nada. Por eso es segura de
// llamar en cada arranque del backend (ver server.js) ademas de a mano via
// `npm run migrate:team-discord-to-registrations`.
export async function migrateTeamDiscordToRegistrations() {
  const teams = await Team.find({}).select('_id name discordProvision').lean()
  const withLegacyRoom = teams.filter(t => t.discordProvision && t.discordProvision.status && t.discordProvision.status !== 'none')

  console.log(`${withLegacyRoom.length} equipo(s) con sala Discord legacy para revisar.`)

  let migrated = 0
  let ambiguous = 0
  let skipped = 0

  for (const team of withLegacyRoom) {
    const tournaments = await Tournament.find({
      'registrations.team': team._id,
      discordEnabled: true,
    }).select('_id title registrations').sort({ createdAt: 1 })

    if (tournaments.length === 0) {
      console.warn(`- ${team.name} (${team._id}): sala legacy pero no esta en ningun torneo con Discord activo. Se omite (queda el dato viejo intacto).`)
      skipped++
      continue
    }

    if (tournaments.length > 1) {
      console.warn(`- ${team.name} (${team._id}): esta en ${tournaments.length} torneos con Discord activo a la vez -- se asigna al MAS ANTIGUO por prudencia. REVISAR A MANO si corresponde a otro: ${tournaments.map(t => t.title).join(' | ')}`)
      ambiguous++
    }

    const target = tournaments[0]
    const registration = target.registrations.find(r => String(r.team) === String(team._id))
    if (!registration) {
      console.warn(`- ${team.name}: no se encontro su inscripcion en "${target.title}" (inesperado). Se omite.`)
      skipped++
      continue
    }

    // updateOne posicional y no target.save(): save() revalida el torneo
    // entero, y en produccion hay torneos viejos sin `organizer` (requerido)
    // -- la migracion fallaba en cada arranque con "Tournament organizer is
    // required" sin llegar a copiar nada. Solo se toca esta inscripcion.
    await Tournament.updateOne(
      { _id: target._id, 'registrations._id': registration._id },
      { $set: { 'registrations.$.discordProvision': team.discordProvision } },
    )
    // Solo se limpia el dato viejo cuando la migracion fue clara (un unico
    // torneo candidato) -- en el caso ambiguo se deja por si hay que
    // reasignarlo a mano a otro torneo despues de revisar.
    if (tournaments.length === 1) {
      await Team.collection.updateOne({ _id: team._id }, { $unset: { discordProvision: '' } })
    }
    console.log(`- ${team.name} -> "${target.title}" (status: ${team.discordProvision.status})`)
    migrated++
  }

  console.log(`\nMigracion completa: ${migrated} migrados, ${ambiguous} ambiguos (revisar a mano), ${skipped} omitidos.`)
  return { migrated, ambiguous, skipped }
}

// Ejecucion directa (`node migrate-team-discord-to-registrations.js` o
// `npm run migrate:team-discord-to-registrations`) sigue funcionando igual
// que antes, manejando su propia conexion. Al importarse desde server.js
// la conexion ya la maneja el arranque del backend.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  connectDatabase()
    .then(migrateTeamDiscordToRegistrations)
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
    .finally(disconnectDatabase)
}
