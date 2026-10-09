import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'
import { Organization } from '../models/Organization.js'
import { User } from '../models/User.js'

// Asigna la Organization "GlitchGang" (servidor unico y compartido) a los
// torneos que quedaron con organization: null antes de que createTournament
// empezara a asignarla (ver getGlitchGangOrganizationId en
// tournament.controller.js). Sin esto, el bot de Discord no encuentra los
// torneos creados antes de este fix.
//
//   node src/scripts/backfill-tournament-organization.js            (dry-run, no escribe)
//   node src/scripts/backfill-tournament-organization.js --apply    (aplica)
//
// Requiere DISCORD_GUILD_ID en .env. Idempotente: no toca torneos que ya
// tienen organization.
//
// Antes de --apply: mongodump --uri "$MONGO_URI" --collection tournaments --out ./backups/pre-organization-$(date +%F)

const APPLY = process.argv.includes('--apply')

async function main() {
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) {
    console.error('[!] Falta DISCORD_GUILD_ID en .env -- no hay a que servidor asignar los torneos.')
    process.exitCode = 1
    return
  }

  await mongoose.connect(config.mongoUri)

  let org = await Organization.findOne({ discordGuildId: guildId })
  if (!org) {
    const admin = await User.findOne({ role: 'admin' }).select('_id').lean()
    if (!admin) {
      console.error('[!] No existe ninguna Organization "GlitchGang" todavia y no hay ningun usuario admin para usar como owner.')
      process.exitCode = 1
      return
    }
    console.log(`[tournament-organization] Organization "GlitchGang" no existe -- ${APPLY ? 'creando' : 'se crearia'} con owner=${admin._id}`)
    if (APPLY) org = await Organization.create({ name: 'GlitchGang', discordGuildId: guildId, owner: admin._id })
  }

  const filter = { organization: null }
  const toUpdate = await Tournament.countDocuments(filter)
  console.log(`[tournament-organization] ${APPLY ? 'APPLIED' : 'DRY-RUN'} torneos sin organization: ${toUpdate}`)

  if (APPLY && org) {
    const result = await Tournament.updateMany(filter, { $set: { organization: org._id } })
    console.log(`[tournament-organization] actualizados: ${result.modifiedCount}`)
  } else if (!APPLY && toUpdate) {
    console.log('\nCorre de nuevo con --apply para escribir los cambios.')
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await mongoose.disconnect() })
