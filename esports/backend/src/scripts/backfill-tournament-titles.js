import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Tournament } from '../models/Tournament.js'
import { syncTitlesIfChanged } from '../services/bracketSync.service.js'

// Torneos terminados antes del 3/oct no tienen titulos guardados (Team.titles,
// User.titles) ni sus rankPts: se otorgaban recien al confirmar resultados.
// Este script los otorga igual que onResultsConfirmed. Idempotente
// (bracketDoc.titlesKey): correrlo dos veces no duplica nada.
//
//   node src/scripts/backfill-tournament-titles.js          -> solo muestra (dry-run)
//   node src/scripts/backfill-tournament-titles.js --apply  -> aplica

const apply = process.argv.includes('--apply')

async function run() {
  await connectDatabase()
  const tournaments = await Tournament.find({
    status: 'finished',
    $or: [{ 'bracketDoc.champion': { $nin: ['', null] } }, { winner: { $type: 'string', $ne: '' } }],
  }).sort({ date: 1 })
  let touched = 0
  for (const tournament of tournaments) {
    const result = await syncTitlesIfChanged(tournament, { dryRun: !apply })
    if (!result) continue
    touched += 1
    const { champion, runnerUp, thirdPlace } = result.podium || {}
    const awardedText = result.awarded
      ? ` -> ${result.awarded.length} equipo(s) con titulo${result.awarded.length < [champion, runnerUp, ...(thirdPlace || [])].filter(Boolean).length ? ' (algunos nombres del bracket no tienen equipo inscrito)' : ''}`
      : ''
    console.log(`${tournament.title}: campeon ${champion || '-'}, 2do ${runnerUp || '-'}, 3ro ${(thirdPlace || []).join(', ') || '-'}${awardedText}`)
  }
  console.log(`${touched} torneo(s) ${apply ? 'actualizados' : 'a actualizar (dry-run, usa --apply)'} de ${tournaments.length} terminados.`)
  await disconnectDatabase()
}

run().catch(async (error) => {
  console.error(error)
  await disconnectDatabase().catch(() => {})
  process.exit(1)
})
