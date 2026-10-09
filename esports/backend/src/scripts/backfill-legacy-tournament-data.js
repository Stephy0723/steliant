import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'

// Dos derives de datos legacy que bloquean el save de torneos viejos, ambos
// encontrados probando el fix de identidad (ver backfill-legacy-tournament-
// identity.js) contra Mongo real:
//
//  1. mapPool se guardaba como Array<string> antes de que el schema lo
//     volviera un String simple (ver frontend, se muestra como un solo
//     texto) -- Mongoose tira CastError al intentar guardar el documento tal
//     cual viene de la base.
//  2. 'points_table' era un valor valido de `format` (ver AdminTournaments,
//     "Tabla de Puntos") que salio del enum en algun punto (aparenta ser
//     perdida de un merge, no un borrado intencional) -- se migra al
//     equivalente actual mas cercano, round_robin.
//  3. staff era antes un array [{userId, role}] (permisos de staff via
//     assertCanManageTournament/staffPermissions.js); el schema actual lo
//     reemplazo por un objeto {director, admin, arbitros, casters} (ver
//     tournament.controller.js, que ya solo lee staff.casters). Ningun
//     endpoint vivo lee la forma array -- se resetea al objeto vacio nuevo,
//     no se migra el contenido porque no representa lo mismo (nombres libres
//     vs asignaciones de usuario reales).
//
//   node src/scripts/backfill-legacy-tournament-data.js            (dry-run, no escribe)
//   node src/scripts/backfill-legacy-tournament-data.js --apply    (aplica)
//
// Idempotente: solo toca documentos cuyo mapPool sigue siendo array o cuyo
// format sigue siendo 'points_table'.
//
// Antes de --apply: mongodump --uri "$MONGO_URI" --collection tournaments --out ./backups/pre-legacy-data-$(date +%F)

const APPLY = process.argv.includes('--apply')

async function main() {
  await mongoose.connect(config.mongoUri)

  const raw = mongoose.connection.collection('tournaments')
  const docs = await raw.find({
    $or: [{ mapPool: { $type: 'array' } }, { format: 'points_table' }, { staff: { $type: 'array' } }],
  }).toArray()

  console.log(`[legacy-data] ${APPLY ? 'APPLYING' : 'DRY-RUN'} — ${docs.length} torneo(s) con drift de datos`)

  for (const t of docs) {
    const patch = {}
    if (Array.isArray(t.mapPool)) patch.mapPool = t.mapPool.join(', ')
    if (t.format === 'points_table') patch.format = 'round_robin'
    if (Array.isArray(t.staff)) patch.staff = { director: '', admin: '', arbitros: [], casters: [] }

    console.log(`  ${APPLY ? 'FIXED' : 'WOULD FIX'} ${t.tournamentCode || t._id}  "${t.title}"  ${Object.entries(patch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`)
    if (APPLY) await raw.updateOne({ _id: t._id }, { $set: patch })
  }

  if (!APPLY && docs.length) console.log('\nCorre de nuevo con --apply para escribir los cambios.')
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await mongoose.disconnect() })
