// Repara solicitudes de rol que quedaron "aprobadas" sin que el usuario
// recibiera nunca el codigo real (organizerCode, creatorCode, etc.).
//
// Causa: los campos del subdocumento roleProfiles.<rol> son `immutable`
// en el schema (no se pueden RE-asignar una vez aprobados), pero Mongoose
// bloquea en silencio CUALQUIER $set sobre un path immutable via
// updateOne/findOneAndUpdate -- incluida la primera vez que se escribe, con
// el campo todavia undefined. adminReviewApplication no pasaba
// `overwriteImmutable: true`, asi que el updateOne reportaba modifiedCount:1
// (por el $addToSet de `roles`) pero roleProfiles.<rol> se quedaba vacio.
// Resultado: la solicitud queda `approved`, el usuario gana el rol, pero
// createTournament (u otro endpoint que exija el codigo) lo rechaza para
// siempre con "codigo de organizador aprobado requerido".
//
// Este script busca esas solicitudes ya aprobadas y les asigna el codigo
// real que nunca llegaron a tener, reusando la misma logica de
// createSpecializedRoleCodes que usa la aprobacion normal.
import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { RoleApplication } from '../models/RoleApplication.js'
import { User } from '../models/User.js'
import { createSpecializedRoleCodes, SPECIALIZED_ROLE_PREFIX } from '../services/codes.service.js'

const ROLE_CODE_FIELDS = Object.freeze({
  organizer: ['organizerCode', 'organizerInternalCode'],
  creator: ['creatorCode', 'creatorInternalCode'],
  coach: ['coachCode', 'coachInternalCode'],
  caster: ['casterCode', 'casterInternalCode'],
  analyst: ['analystCode', 'analystInternalCode'],
  moderator: ['moderatorCode', 'moderatorInternalCode'],
  sponsor: ['sponsorCode', 'sponsorInternalCode'],
})

async function backfillRoleApplicationCodes() {
  await connectDatabase()

  const apply = process.argv.includes('--apply')
  const approved = await RoleApplication.find({ status: 'approved' }).populate('userId', 'countryCode roleProfiles role roles')

  let fixed = 0
  let alreadyOk = 0
  let skippedNoUser = 0

  for (const app of approved) {
    const user = app.userId
    if (!user) { skippedNoUser += 1; console.log(`SIN USUARIO: solicitud ${app.publicCode} (${app._id}) -- el usuario ya no existe.`); continue }

    const fields = ROLE_CODE_FIELDS[app.roleId]
    if (!fields || !SPECIALIZED_ROLE_PREFIX[app.roleId]) continue
    const [publicField, internalField] = fields

    const existing = user.roleProfiles?.[app.roleId]
    if (existing?.[publicField]) { alreadyOk += 1; continue }

    if (!apply) {
      console.log(`FALTA (dry-run): @${user._id} -- rol ${app.roleId}, solicitud ${app.publicCode}`)
      fixed += 1
      continue
    }

    // Un fallo puntual (ej. colision de indice unico contra un codigo ya
    // asignado por otra via) no debe abortar el resto del lote.
    try {
      const codes = await createSpecializedRoleCodes(app.roleId, user.countryCode, app.reviewedAt || app.updatedAt || new Date())
      const profilePath = `roleProfiles.${app.roleId}`
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            [`${profilePath}.${publicField}`]: codes.publicCode,
            [`${profilePath}.${internalField}`]: codes.internalCode,
            [`${profilePath}.approvedAt`]: codes.approvedAt,
            [`${profilePath}.applicationId`]: app._id,
            [`${profilePath}.details`]: app.formData || {},
          },
          $addToSet: { roles: app.roleId },
        },
        { runValidators: true, overwriteImmutable: true },
      )
      console.log(`REPARADO: usuario ${user._id} -- ${app.roleId} -> ${codes.publicCode} (solicitud ${app.publicCode})`)
      fixed += 1
    } catch (error) {
      console.error(`ERROR reparando usuario ${user._id} (${app.roleId}): ${error.message}`)
    }
  }

  console.log(`\n${apply ? 'Aplicado' : 'Dry-run'}: ${fixed} reparado(s), ${alreadyOk} ya tenian codigo, ${skippedNoUser} sin usuario.`)
  if (!apply && fixed > 0) console.log('Corre con --apply para escribir los cambios.')
}

backfillRoleApplicationCodes()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
