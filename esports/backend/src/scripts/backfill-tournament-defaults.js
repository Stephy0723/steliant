import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'
import { buildTournamentDefaultPatch } from '../services/tournamentDefaults.service.js'

async function main() {
  await mongoose.connect(config.mongoUri)

  let scanned = 0
  let updated = 0
  const tournaments = await Tournament.find({})

  for (const tournament of tournaments) {
    scanned += 1
    const patch = buildTournamentDefaultPatch(tournament.toObject())
    if (!Object.keys(patch).length) continue

    await Tournament.updateOne({ _id: tournament._id }, { $set: patch })
    updated += 1
  }

  console.log(`[tournaments] scanned=${scanned} updated=${updated}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
