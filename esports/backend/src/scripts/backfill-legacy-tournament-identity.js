import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { Tournament } from '../models/Tournament.js'
import { User } from '../models/User.js'
import { createSpecializedRoleCodes, sanitizeGameCode } from '../services/codes.service.js'

// Torneos creados antes de que publicId/organizerCode/countryCode existieran
// en el schema quedaron con solo tournamentCode. ensureTournamentIdentity
// (Tournament.js) intenta regenerar la identidad completa en cada save, lo
// que exige que el organizador tenga un organizerCode aprobado -- ninguno de
// los organizadores de estos torneos legacy lo tiene, asi que CUALQUIER save
// (check-in, bracket, editar) les tira 403 hoy.
//
// Este script:
//  1. Le asigna un organizerCode real (mismo flujo que una aprobacion normal,
//     ver roleApplications.controller.js) a cada organizador legacy que
//     todavia no tenga uno.
//  2. Completa publicId/organizerCode/countryCode/gameCode en el torneo,
//     reusando el tournamentCode ya existente como publicId (ya era el
//     codigo publico de facto antes de que se separaran los dos campos).
//
// Torneos cuyo organizador ya no existe (cuenta borrada) se listan pero NO
// se tocan -- requieren una decision (borrar el torneo huerfano o
// reasignarlo), no un backfill automatico.
//
//   node src/scripts/backfill-legacy-tournament-identity.js            (dry-run, no escribe)
//   node src/scripts/backfill-legacy-tournament-identity.js --apply    (aplica)
//
// Idempotente: no toca torneos que ya tienen publicId.
//
// Antes de --apply: mongodump --uri "$MONGO_URI" --collection tournaments --out ./backups/pre-legacy-identity-$(date +%F)
//                    mongodump --uri "$MONGO_URI" --collection users       --out ./backups/pre-legacy-identity-$(date +%F)

const APPLY = process.argv.includes('--apply')

// Cache por organizador dentro de esta corrida -- sin esto, cada torneo del
// mismo organizador legacy disparaba una generacion de codigo distinta (y en
// dry-run, cada llamada a createSpecializedRoleCodes ya consume de verdad el
// contador atomico aunque no se escriba nada mas -- ver reserveSequence en
// codes.service.js).
const organizerCodeCache = new Map()

async function ensureOrganizerCode(user) {
  const cacheKey = String(user._id)
  if (organizerCodeCache.has(cacheKey)) return organizerCodeCache.get(cacheKey)

  const existing = user.roleProfiles?.organizer?.organizerCode
  if (existing) {
    const result = { organizerCode: existing, created: false }
    organizerCodeCache.set(cacheKey, result)
    return result
  }

  if (!APPLY) {
    const result = { organizerCode: '(nuevo, se generara con --apply)', created: true }
    organizerCodeCache.set(cacheKey, result)
    return result
  }

  const codes = await createSpecializedRoleCodes('organizer', user.countryCode, user.createdAt || new Date())
  const update = {
    $set: {
      'roleProfiles.organizer.organizerCode': codes.publicCode,
      'roleProfiles.organizer.organizerInternalCode': codes.internalCode,
      'roleProfiles.organizer.approvedAt': codes.approvedAt,
      'roleProfiles.organizer.applicationId': null,
      'roleProfiles.organizer.details': { backfilledFrom: 'legacy-tournament', reason: 'organizer pre-existente al sistema de organizerCode' },
    },
    $addToSet: { roles: 'organizer' },
  }
  if (!['admin', 'brand'].includes(user.role)) update.$set.role = 'organizer'
  await User.updateOne({ _id: user._id }, update, { runValidators: true, overwriteImmutable: true })

  const result = { organizerCode: codes.publicCode, created: true }
  organizerCodeCache.set(cacheKey, result)
  return result
}

async function main() {
  await mongoose.connect(config.mongoUri)

  const tournaments = await Tournament.find({ publicId: { $exists: false } }).lean()
  console.log(`[legacy-identity] ${APPLY ? 'APPLYING' : 'DRY-RUN'} — ${tournaments.length} torneo(s) sin publicId`)

  let fixed = 0
  const orphaned = []

  for (const t of tournaments) {
    const organizer = t.organizer ? await User.findById(t.organizer) : null
    if (!organizer) {
      orphaned.push(`${t.tournamentCode || t._id}  "${t.title}"  (organizador ${t.organizer} ya no existe)`)
      continue
    }

    const { organizerCode, created } = await ensureOrganizerCode(organizer)
    const patch = {
      publicId: t.tournamentCode,
      organizerCode,
      countryCode: organizer.countryCode,
      gameCode: sanitizeGameCode(t.gameCode || t.game),
    }

    console.log(`  ${APPLY ? 'FIXED' : 'WOULD FIX'} ${t.tournamentCode}  "${t.title}"  organizerCode=${organizerCode}${created ? ' (nuevo)' : ''}`)
    if (APPLY) {
      await Tournament.updateOne({ _id: t._id }, { $set: patch }, { runValidators: true, overwriteImmutable: true })
    }
    fixed += 1
  }

  console.log(`\n[legacy-identity] ${APPLY ? 'aplicados' : 'a aplicar'}: ${fixed}`)
  if (orphaned.length) {
    console.log(`\n[!] ${orphaned.length} torneo(s) con organizador inexistente -- requieren decision manual, no tocados:`)
    orphaned.forEach(line => console.log('    ' + line))
  }
  if (!APPLY && fixed) console.log('\nCorre de nuevo con --apply para escribir los cambios.')
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await mongoose.disconnect() })
