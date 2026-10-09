import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'
import { gameIdFromName } from '../../../shared/games.mjs'
import { FORMAT_TO_SYSTEM, normalizeCompetition, initialCompetition } from '../../../shared/tournamentSetup.mjs'

// Rellena gameId, seriesId y competition en torneos creados antes de la Etapa 2.
//
//   node src/scripts/backfill-tournament-identity.js            (dry-run, no escribe)
//   node src/scripts/backfill-tournament-identity.js --apply    (aplica)
//
// Idempotente: no re-escribe lo que ya tiene gameId/seriesId/competition.system.
// Antes de --apply: mongodump --uri "$MONGO_URI" --collection tournaments --out ./backups/pre-identity-$(date +%F)

const APPLY = process.argv.includes('--apply')

const bestOfFromSeries = value => {
  const m = /bo\s*([1357])/i.exec(String(value || ''))
  return m ? `BO${m[1]}` : 'BO1'
}

async function main() {
  await mongoose.connect(config.mongoUri)
  const tournaments = await Tournament.find({}).lean()

  // 1. Agrupar en series siguiendo la cadena sourceTournament.
  const byId = new Map(tournaments.map(t => [String(t._id), t]))
  const seriesOf = new Map()
  const rootOf = (t) => {
    const seen = new Set()
    let cur = t
    while (cur?.sourceTournament && byId.has(String(cur.sourceTournament)) && !seen.has(String(cur._id))) {
      seen.add(String(cur._id))
      cur = byId.get(String(cur.sourceTournament))
    }
    return cur
  }
  for (const t of tournaments) {
    const root = rootOf(t)
    const key = String(root._id)
    if (!seriesOf.has(key)) seriesOf.set(key, root.seriesId || new mongoose.Types.ObjectId().toString())
    seriesOf.set(String(t._id), seriesOf.get(key))
  }

  let scanned = 0
  let updated = 0
  const unmatched = []

  for (const t of tournaments) {
    scanned += 1
    const patch = {}

    if (!t.gameId) {
      const id = gameIdFromName(t.game)
      if (id) patch.gameId = id
      else unmatched.push(`${t.publicId || t._id}  game="${t.game}"`)
    }

    if (!t.seriesId) patch.seriesId = seriesOf.get(String(t._id))

    if (!t.competition?.system) {
      const system = FORMAT_TO_SYSTEM[t.format] || 'single_elim'
      patch.competition = normalizeCompetition(
        { ...initialCompetition(), system, defaultSeries: bestOfFromSeries(t.series) },
        t.maxSlots,
      )
    }

    if (!Object.keys(patch).length) continue
    updated += 1
    if (APPLY) await Tournament.updateOne({ _id: t._id }, { $set: patch })
  }

  console.log(`[tournament-identity] ${APPLY ? 'APPLIED' : 'DRY-RUN'} scanned=${scanned} toUpdate=${updated}`)
  if (unmatched.length) {
    console.log(`\n[!] ${unmatched.length} torneos sin gameId resuelto (revisar a mano):`)
    unmatched.forEach(line => console.log('    ' + line))
  }
  if (!APPLY && updated) console.log('\nCorre de nuevo con --apply para escribir los cambios.')
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await mongoose.disconnect() })
