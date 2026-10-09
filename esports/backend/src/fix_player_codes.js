import { connectDatabase, disconnectDatabase } from './database/mongo.js'
import { User } from './models/User.js'
import { formatPlayerCode, formatPlayerInternalCode } from './services/codes.service.js'

await connectDatabase()

const users = await User.find({})
let fixed = 0

for (const u of users) {
  // Extrae secuencia y número de país del playerCode actual: {Inicial}{seq}-{pais}
  const m = String(u.playerCode || '').match(/^(.)(\d+)-(\d+)$/)
  if (!m) { console.log('  (omitido, formato raro):', u.nick, u.playerCode); continue }
  const seq = m[2]
  const countryNum = m[3]

  const newPublic = formatPlayerCode(u.firstName, seq, countryNum)
  const newInternal = formatPlayerInternalCode(u.firstName, u.birthDate, u.lastName, seq, countryNum)

  if (newPublic !== u.playerCode || newInternal !== u.internalCode) {
    console.log(`  ${u.nick}: ${u.playerCode} -> ${newPublic} | ${u.internalCode} -> ${newInternal}`)
    u.playerCode = newPublic
    u.internalCode = newInternal
    await u.save()
    fixed++
  }
}

console.log(`\nUsuarios corregidos: ${fixed} de ${users.length}`)
await disconnectDatabase()
process.exit(0)
