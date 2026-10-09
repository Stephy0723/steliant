// Busca usuarios cuyo email contenga el texto dado (case-insensitive) —
// solo lectura, no modifica nada. Util para encontrar typos o variantes.
// Uso: node scripts/find-user.js stelian
import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/User.js'

const query = process.argv[2]
if (!query) { console.error('Uso: node scripts/find-user.js texto-a-buscar'); process.exit(1) }

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glitchgang'
  await mongoose.connect(uri)

  const users = await User.find({ email: { $regex: query, $options: 'i' } })
    .select('nick email role createdAt')
    .lean()

  if (!users.length) {
    console.log(`\nNo se encontró ningún usuario cuyo email contenga "${query}".`)
  } else {
    console.log(`\nEncontrados ${users.length}:`)
    users.forEach((u) => console.log(`  - nick: ${u.nick} | email: ${u.email} | role: ${u.role} | creado: ${u.createdAt}`))
  }

  await mongoose.disconnect()
}

run().catch((e) => { console.error(e); process.exit(1) })
