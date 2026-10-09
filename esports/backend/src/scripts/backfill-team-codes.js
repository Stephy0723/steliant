import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { createTeamCode } from '../services/codes.service.js'

async function backfillTeamCodes() {
  await connectDatabase()

  const teams = await Team.find({
    $and: [
      { $or: [{ publicCode: { $exists: false } }, { publicCode: '' }] },
      { $or: [{ internalCode: { $exists: false } }, { internalCode: '' }] },
    ],
  }).sort({ createdAt: 1, _id: 1 })

  const partial = await Team.find({
    $or: [
      { publicCode: { $nin: [null, ''] }, internalCode: { $in: [null, ''] } },
      { publicCode: { $in: [null, ''] }, internalCode: { $nin: [null, ''] } },
    ],
  }).select('_id publicCode internalCode').lean()

  if (partial.length) {
    throw new Error(`Hay ${partial.length} equipo(s) con un par de IDs incompleto; revísalos antes de migrar.`)
  }

  for (const team of teams) {
    const leader = await User.findById(team.leader).select('countryCode').lean()
    if (!leader?.countryCode) {
      throw new Error(`El equipo ${team._id} no tiene un líder con countryCode válido.`)
    }

    const { publicCode, internalCode } = await createTeamCode(leader.countryCode)
    await Team.collection.updateOne(
      { _id: team._id, publicCode: { $exists: false }, internalCode: { $exists: false } },
      { $set: { publicCode, internalCode } },
    )
    console.log(`${team.name}: ${publicCode} | ${internalCode}`)
  }

  const remaining = await Team.collection.countDocuments({
    $or: [
      { publicCode: { $in: [null, ''] } },
      { publicCode: { $exists: false } },
      { internalCode: { $in: [null, ''] } },
      { internalCode: { $exists: false } },
    ],
  })
  if (remaining) throw new Error(`La migración dejó ${remaining} equipo(s) sin el par completo de IDs.`)

  // Older deployments used sparse unique indexes while IDs were optional.
  // Once every team is backfilled, replace them with strict unique indexes.
  const indexes = await Team.collection.indexes()
  for (const name of ['publicCode_1', 'internalCode_1']) {
    const current = indexes.find(index => index.name === name)
    if (current?.sparse) await Team.collection.dropIndex(name)
  }

  await Team.collection.createIndex({ publicCode: 1 }, { unique: true, name: 'publicCode_1' })
  await Team.collection.createIndex({ internalCode: 1 }, { unique: true, name: 'internalCode_1' })

  console.log(`Migración completa: ${teams.length} equipo(s) actualizados.`)
}

backfillTeamCodes()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
