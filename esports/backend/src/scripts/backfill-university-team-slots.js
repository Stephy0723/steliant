import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Team } from '../models/Team.js'
import { gameKeyOf } from '../../../shared/games.mjs'

// Prepara los equipos universitarios para el cupo "uno por universidad y juego":
//   1. Rellena university.gameKey en los equipos oficiales (gameKeyOf(team.game)).
//   2. Si una universidad tiene mas de un oficial del mismo juego (pasaba por la
//      carrera de dos creaciones simultaneas o por cambiar el juego al editar),
//      se queda el mas antiguo y los demas pasan a equipo normal.
//   3. Crea el indice unico university_official_slot.
//   4. Lista (sin tocar) los equipos con la etiqueta "universitario" que no son
//      oficiales: la web ya no los muestra en el filtro universitario.
//
//   node src/scripts/backfill-university-team-slots.js            (dry-run, no escribe)
//   node src/scripts/backfill-university-team-slots.js --apply    (aplica)
//
// Idempotente. Antes de --apply: mongodump --uri "$MONGO_URI" --collection teams --out ./backups/pre-uni-slots-$(date +%F)

const APPLY = process.argv.includes('--apply')

async function main() {
  await mongoose.connect(config.mongoUri)
  const official = await Team.find({ 'university.isUniversityTeam': true })
    .select('name game university createdAt')
    .sort({ createdAt: 1 })
    .lean()

  const keyFixes = []
  const demote = []
  const seen = new Map() // universityId|gameKey -> team mas antiguo
  for (const team of official) {
    const gameKey = gameKeyOf(team.game)
    if (team.university.gameKey !== gameKey) keyFixes.push({ team, gameKey })
    const slot = `${team.university.universityId}|${gameKey}`
    if (seen.has(slot)) demote.push({ team, keeps: seen.get(slot) })
    else seen.set(slot, team)
  }

  const labelOnly = await Team.find({ tiers: 'universitario', 'university.isUniversityTeam': { $ne: true } })
    .select('name game').lean()

  console.log(`Equipos oficiales: ${official.length}`)
  console.log(`  gameKey a rellenar/corregir: ${keyFixes.length}`)
  for (const { team, gameKey } of keyFixes) console.log(`    - ${team.name} (${team.game || 'sin juego'}) -> "${gameKey}"`)
  console.log(`  Duplicados que pasan a equipo normal: ${demote.length}`)
  for (const { team, keeps } of demote) console.log(`    - ${team.name} (${team.game}) -- se queda el oficial "${keeps.name}"`)
  console.log(`Con etiqueta "universitario" pero sin cupo oficial (solo informativo): ${labelOnly.length}`)
  for (const team of labelOnly) console.log(`    - ${team.name} (${team.game || 'sin juego'})`)

  if (!APPLY) {
    console.log('\nDry-run: no se escribio nada. Corre con --apply para aplicar.')
    return
  }

  const demotedIds = new Set(demote.map(d => String(d.team._id)))
  for (const { team, gameKey } of keyFixes) {
    if (demotedIds.has(String(team._id))) continue
    await Team.updateOne({ _id: team._id }, { $set: { 'university.gameKey': gameKey } })
  }
  for (const { team } of demote) {
    await Team.updateOne({ _id: team._id }, { $set: { 'university.isUniversityTeam': false, 'university.gameKey': '' } })
  }
  await Team.collection.createIndex(
    { 'university.universityId': 1, 'university.gameKey': 1 },
    { unique: true, partialFilterExpression: { 'university.isUniversityTeam': true }, name: 'university_official_slot' },
  )
  console.log('\nAplicado. Indice university_official_slot creado.')
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
