import 'dotenv/config'
import { connectDatabase, disconnectDatabase } from '../database/mongo.js'
import { User } from '../models/User.js'

// Hasta el 3/oct el registro guardaba el codigo de invitacion que escribia
// la persona como SU PROPIO referralCode (en vez de "quien me invito"), asi
// que invitado e invitador quedaban con el MISMO codigo. Este script lo
// corrige: si dos o mas cuentas comparten codigo, la mas antigua es la
// duena; las demas pasan a referredBy = la duena y su codigo se borra (se
// regenera al pedirlo, codes.service.js). Los codigos unicos -- incluidos los
// viejos GG-NICK-NNN del sistema de agosto -- no se tocan.
//
//   node src/scripts/fix-referral-codes.js          -> solo muestra (dry-run)
//   node src/scripts/fix-referral-codes.js --apply  -> aplica

const apply = process.argv.includes('--apply')

async function run() {
  await connectDatabase()
  const users = await User.find({ referralCode: { $nin: ['', null] } })
    .select('_id nick referralCode referredBy createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean()
  const owners = new Map()
  let fixed = 0
  for (const user of users) {
    const code = String(user.referralCode).trim().toUpperCase()
    const owner = owners.get(code)
    if (!owner) { owners.set(code, user); continue }
    const referredBy = user.referredBy || owner._id
    console.log(`${user.nick}: comparte "${code}" con ${owner.nick} (mas antigua) -> invitado por ${owner.nick}`)
    if (apply) await User.updateOne({ _id: user._id }, { $set: { referralCode: '', referredBy } })
    fixed += 1
  }
  console.log(`${fixed} cuenta(s) ${apply ? 'corregidas' : 'a corregir (dry-run, usa --apply)'}.`)
  await disconnectDatabase()
}

run().catch(async (error) => {
  console.error(error)
  await disconnectDatabase().catch(() => {})
  process.exit(1)
})
