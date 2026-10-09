import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'

// Limpia `Team.members` de ids que ya no corresponden a ningun usuario real
// (ej. cuentas de prueba borradas directo de la base mientras el equipo
// seguia apuntandoles). Ver BACKEND-PENDIENTE.md #eliminar-equipo-miembro-fantasma:
// esos ids huerfanos hacian que leaveTeam bloqueara a un lider que, para el
// frontend, ya se veia como el unico miembro del equipo.
async function cleanupStaleTeamMembers() {
  await connectDatabase()

  const teams = await Team.find({ members: { $exists: true, $not: { $size: 0 } } }).select('_id name members').lean()

  let teamsTouched = 0
  let staleTotal = 0

  for (const team of teams) {
    const memberIds = (team.members || []).map(id => String(id))
    if (!memberIds.length) continue

    const validIds = new Set(
      (await User.find({ _id: { $in: memberIds } }).select('_id').lean()).map(u => String(u._id))
    )
    const staleIds = memberIds.filter(id => !validIds.has(id))
    if (!staleIds.length) continue

    await Team.updateOne({ _id: team._id }, { $pull: { members: { $in: staleIds } } })
    teamsTouched += 1
    staleTotal += staleIds.length
    console.log(`${team.name || team._id}: se quitaron ${staleIds.length} miembro(s) fantasma (${staleIds.join(', ')})`)
  }

  console.log(`Listo: ${staleTotal} referencia(s) huerfana(s) eliminadas en ${teamsTouched} equipo(s) (de ${teams.length} equipo(s) con miembros).`)
}

cleanupStaleTeamMembers()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
