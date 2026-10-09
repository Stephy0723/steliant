import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { Counter } from '../models/Counter.js'
import { RoleApplication } from '../models/RoleApplication.js'
import { User } from '../models/User.js'
import { Tournament } from '../models/Tournament.js'
import {
  SPECIALIZED_ROLE_PREFIX,
  createSpecializedRoleCodes,
  createTournamentCodes,
  sanitizeGameCode,
} from '../services/codes.service.js'

const ROLE_FIELDS = Object.freeze({
  organizer: ['organizerCode', 'organizerInternalCode'],
  creator: ['creatorCode', 'creatorInternalCode'],
  coach: ['coachCode', 'coachInternalCode'],
  caster: ['casterCode', 'casterInternalCode'],
  analyst: ['analystCode', 'analystInternalCode'],
  sponsor: ['sponsorCode', 'sponsorInternalCode'],
})

const specializedRoles = Object.keys(SPECIALIZED_ROLE_PREFIX)

function sequenceFromRoleCode(role, value) {
  const prefix = SPECIALIZED_ROLE_PREFIX[role]
  const match = new RegExp(`^${prefix}-(\\d+)-\\d{2,3}$`).exec(String(value || ''))
  return match ? Number(match[1]) : 0
}

async function initializeRoleCounters() {
  const users = await User.find().select('countryCode roleProfiles').lean()
  const maxima = new Map()
  for (const user of users) {
    for (const role of specializedRoles) {
      const [publicField] = ROLE_FIELDS[role]
      const value = user.roleProfiles?.[role]?.[publicField]
      const sequence = sequenceFromRoleCode(role, value)
      if (!sequence || !user.countryCode) continue
      const key = `${role}:${user.countryCode}`
      maxima.set(key, Math.max(maxima.get(key) || 0, sequence))
    }
  }
  for (const [key, value] of maxima) {
    await Counter.updateOne({ key }, { $max: { value } }, { upsert: true })
  }
}

async function ensureRoleProfile(userId, role, approvedAt, applicationId = null) {
  const user = await User.findById(userId).select('countryCode role roles roleProfiles createdAt').lean()
  if (!user) throw new Error(`Usuario ${userId} no encontrado durante la migración.`)

  const [publicField, internalField] = ROLE_FIELDS[role]
  const existing = user.roleProfiles?.[role]?.[publicField]
  if (existing) return User.findById(userId).lean()

  const effectiveDate = approvedAt || user.createdAt || new Date()
  const codes = await createSpecializedRoleCodes(role, user.countryCode, effectiveDate)
  const profilePath = `roleProfiles.${role}`
  const update = {
    $set: {
      [`${profilePath}.${publicField}`]: codes.publicCode,
      [`${profilePath}.${internalField}`]: codes.internalCode,
      [`${profilePath}.approvedAt`]: codes.approvedAt,
      [`${profilePath}.applicationId`]: applicationId,
    },
    $addToSet: { roles: role },
  }
  if (!['admin', 'brand'].includes(user.role)) update.$set.role = role

  await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, update)
  console.log(`Rol ${role} / usuario ${userId}: ${codes.publicCode} | ${codes.internalCode}`)
  return User.findById(userId).lean()
}

async function migrateRoleProfiles() {
  await initializeRoleCounters()

  const approved = await RoleApplication.find({ status: 'approved', roleId: { $in: specializedRoles } })
    .sort({ reviewedAt: 1, createdAt: 1, _id: 1 })
    .lean()
  for (const app of approved) {
    await ensureRoleProfile(app.userId, app.roleId, app.reviewedAt || app.createdAt, app._id)
  }

  const roleUsers = await User.find({ role: { $in: specializedRoles } }).select('_id role createdAt').lean()
  for (const user of roleUsers) await ensureRoleProfile(user._id, user.role, user.createdAt)

  const organizerIds = await Tournament.collection.distinct('organizer')
  for (const organizerId of organizerIds.filter(Boolean)) {
    const firstTournament = await Tournament.collection.findOne({ organizer: organizerId }, { projection: { createdAt: 1 } })
    await ensureRoleProfile(organizerId, 'organizer', firstTournament?.createdAt)
  }
}

async function migrateTournaments() {
  const tournaments = await Tournament.collection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
  let migrated = 0

  for (const tournament of tournaments) {
    const normalizedFormat = {
      'single elimination': 'single_elimination',
      'double elimination': 'double_elimination',
      single_elimination: 'single_elimination',
      double_elimination: 'double_elimination',
      round_robin: 'round_robin',
      swiss: 'swiss',
      custom: 'custom',
    }[String(tournament.format || '').trim().toLowerCase()] || 'single_elimination'
    const tournamentDate = new Date(tournament.date || tournament.startDate || tournament.createdAt || Date.now())
    const registrationStart = new Date(tournament.registrationWindow?.start || tournament.createdAt || tournamentDate)
    const registrationEnd = new Date(tournament.registrationWindow?.end || tournamentDate)
    const schemaAlignment = {
      date: tournamentDate,
      registrationWindow: { start: registrationStart, end: registrationEnd },
      format: normalizedFormat,
      platform: ['pc', 'mobile', 'console', 'cross'].includes(String(tournament.platform || '').toLowerCase())
        ? String(tournament.platform).toLowerCase()
        : 'pc',
      maxSlots: Number(tournament.maxSlots || tournament.capacity || 2),
      currentSlots: Number(tournament.currentSlots ?? tournament.registered ?? 0),
      visibility: tournament.visibility || 'public',
    }
    const isCurrent = /^TOR-[A-Z0-9]{1,4}-ORG\d{3,}-\d{3,}-\d{2,3}$/.test(String(tournament.publicId || ''))
      && /^TOR-[A-Z0-9]{1,4}-\d{6}-ORG\d{3,}-\d{3,}-\d{2,3}$/.test(String(tournament.tournamentCode || ''))
    if (isCurrent) {
      await Tournament.collection.updateOne({ _id: tournament._id }, { $set: schemaAlignment })
      continue
    }

    const organizer = await User.findById(tournament.organizer)
      .select('countryCode roleProfiles.organizer.organizerCode')
      .lean()
    const organizerCode = organizer?.roleProfiles?.organizer?.organizerCode
    if (!organizerCode) throw new Error(`Torneo ${tournament._id}: organizador sin organizerCode.`)

    const createdAt = tournament.createdAt || new Date()
    const identity = await createTournamentCodes({
      countryCode: organizer.countryCode,
      gameCode: sanitizeGameCode(tournament.gameCode || tournament.game),
      organizerCode,
      organizerId: tournament.organizer,
      createdAt,
    })

    await Tournament.collection.updateOne(
      { _id: tournament._id },
      {
        $set: {
          ...schemaAlignment,
          legacyPublicId: tournament.legacyPublicId || tournament.publicId || '',
          publicId: identity.publicId,
          tournamentCode: identity.tournamentCode,
          gameCode: identity.gameCode,
          organizerCode,
          countryCode: identity.countryCode,
        },
      },
    )
    migrated += 1
    console.log(`${tournament.title}: ${identity.publicId} | ${identity.tournamentCode}`)
  }

  return migrated
}

async function ensureStrictIndex(collection, key, name) {
  const indexes = await collection.indexes()
  const current = indexes.find(index => index.name === name)
  if (current && (!current.unique || current.sparse)) await collection.dropIndex(name)
  await collection.createIndex(key, { unique: true, name })
}

async function migrate() {
  await connectDatabase()
  await migrateRoleProfiles()
  const tournaments = await migrateTournaments()

  await ensureStrictIndex(Tournament.collection, { publicId: 1 }, 'publicId_1')
  await ensureStrictIndex(Tournament.collection, { tournamentCode: 1 }, 'tournamentCode_1')

  console.log(`Migración completa: ${tournaments} torneo(s) reidentificados.`)
}

migrate()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
