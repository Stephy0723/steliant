// Uso: node scripts/_tmp-create-test-tournament.mjs
// Crea/ajusta el organizerCode de steliantsoft@gmail.com y crea un torneo
// 1v1 de prueba que inicia y cierra hoy. Borralo despues de usarlo:
// rm scripts/_tmp-create-test-tournament.mjs
import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { Tournament } from '../src/models/Tournament.js'

const EMAIL = 'steliantsoft@gmail.com'

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glitchgang'
  await mongoose.connect(uri)

  const user = await User.findOne({ email: EMAIL })
  if (!user) {
    console.error(`No existe cuenta con ${EMAIL}. Debe registrarse primero.`)
    process.exit(1)
  }

  const updates = { nick: 'Tester Admin' }
  if (!user.roleProfiles?.organizer?.organizerCode) {
    updates['roleProfiles.organizer.organizerCode'] = 'ORG-900-01'
    updates['roleProfiles.organizer.organizerInternalCode'] = 'ORG-900-01'
  }
  // Los campos immutable de Mongoose bloquean $set vía findByIdAndUpdate,
  // así que se escribe directo con el driver.
  await User.collection.updateOne({ _id: user._id }, { $set: updates })
  const fresh = await User.findById(user._id)
  console.log(`Usuario listo: ${fresh.nick} / organizerCode=${fresh.roleProfiles?.organizer?.organizerCode}`)

  const now = new Date()
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 0, 0)

  const tournament = await Tournament.create({
    title: 'Duelo Rapido 1v1 (Prueba)',
    game: 'Valorant',
    description: 'Torneo de prueba 1v1, inicia y cierra hoy.',
    date: now,
    registrationWindow: { start: now, end: endOfDay },
    format: 'single_elimination',
    modality: '1v1',
    platform: 'pc',
    region: 'LATAM',
    maxSlots: 2,
    prizePool: 0,
    entryFee: 0,
    organizer: user._id,
    status: 'open',
    visibility: 'public',
  })

  console.log('\nTorneo creado:')
  console.log(`  publicId: ${tournament.publicId}`)
  console.log(`  title: ${tournament.title}`)
  console.log(`  maxSlots: ${tournament.maxSlots}`)
  console.log(`  fecha: ${tournament.date}`)
  console.log(`\nEntra como ${EMAIL} -> Mis Torneos -> deberia aparecer ahi.`)

  await mongoose.disconnect()
}

run().catch(e => { console.error(e); process.exit(1) })
