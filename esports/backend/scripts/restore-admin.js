// Restaura el rol de admin a un usuario por email
// Uso: node scripts/restore-admin.js tu@correo.com
import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/User.js'

const email = process.argv[2]
if (!email) { console.error('Uso: node scripts/restore-admin.js tu@correo.com'); process.exit(1) }

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glitchgang'
  await mongoose.connect(uri)

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { role: 'admin' } },
    { new: true },
  ).select('nick email role brandId')

  if (!user) { console.error(`No se encontró usuario con email: ${email}`); process.exit(1) }

  console.log(`\n✅ Rol restaurado:\n  nick: ${user.nick}\n  email: ${user.email}\n  role: ${user.role}\n  brandId: ${user.brandId || '(ninguno)'}`)
  await mongoose.disconnect()
}

run().catch(e => { console.error(e); process.exit(1) })
