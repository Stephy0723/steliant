// ============================================
// Backfill: asigna los torneos existentes (creados antes de que existiera
// el concepto de "Organization"/cliente) a una organizacion por defecto —
// normalmente la tuya propia (GlitchGang), para que /torneo del bot los
// siga viendo despues de activar el multi-tenant.
//
// Uso:
//   node scripts/backfill-tournament-organization.js <discordGuildId> <ownerEmail> ["Nombre"]
//
// Ejemplo:
//   node scripts/backfill-tournament-organization.js 1462652759466577932 salylopez0723@gmail.com "GlitchGang"
// ============================================

import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { Organization } from '../src/models/Organization.js'
import { Tournament } from '../src/models/Tournament.js'

async function run() {
  const [discordGuildId, ownerEmail, name = 'GlitchGang'] = process.argv.slice(2)

  if (!discordGuildId || !ownerEmail) {
    console.error('Uso: node scripts/backfill-tournament-organization.js <discordGuildId> <ownerEmail> ["Nombre"]')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glitchgang')
    console.log('Conectado a MongoDB...')

    const owner = await User.findOne({ email: ownerEmail.toLowerCase().trim() })
    if (!owner) {
      console.error(`No existe una cuenta con el correo ${ownerEmail}.`)
      process.exit(1)
    }

    let org = await Organization.findOne({ discordGuildId })
    if (!org) {
      org = await Organization.create({ name, discordGuildId, owner: owner._id })
      console.log(`Organizacion creada: ${org.name} (${org._id}) -> guild ${discordGuildId}`)
    } else {
      console.log(`Organizacion ya existia: ${org.name} (${org._id})`)
    }

    const result = await Tournament.updateMany(
      { organization: null },
      { $set: { organization: org._id } }
    )
    console.log(`Torneos actualizados sin organizacion previa: ${result.modifiedCount}`)

    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

run()
