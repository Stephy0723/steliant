// Ejecutar: node scripts/seed-brands.js
import 'dotenv/config'
import mongoose from 'mongoose'
import { Brand } from '../src/models/Brand.js'

const SEED_BRANDS = [
  {
    code: 'BRD-001',
    name: 'Federacion Dominicana de Videojuegos',
    industry: 'Esports y videojuegos',
    tier: 'platinum',
    logo: '/brands/fdde.jpg',
    logoInitials: 'FDV',
    color: '#0B4F8A',
    tagline: 'Impulsando el ecosistema competitivo dominicano.',
    website: 'https://www.facebook.com/fdde.do',
    contactEmail: 'contacto@glitchgang.net',
    status: 'active',
    since: new Date('2026-01-01'),
  },
  {
    code: 'BRD-002',
    name: 'NPC Latino',
    industry: 'Medios y comunidad gaming',
    tier: 'platinum',
    logo: '/brands/npc-latino.png',
    logoInitials: 'NPC',
    color: '#F47B20',
    tagline: 'Noticias, cultura y esports para la comunidad latina.',
    website: 'https://npclatino.com/',
    contactEmail: 'contacto@npclatino.com',
    status: 'active',
    since: new Date('2026-01-01'),
  },
]

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glitchgang'
  console.log(`Conectando a ${uri}...`)
  await mongoose.connect(uri)

  const existing = await Brand.countDocuments()
  if (existing > 0) {
    console.log(`Ya existen ${existing} marca(s). Borrando y re-seeding...`)
    await Brand.deleteMany({})
  }

  const inserted = await Brand.insertMany(SEED_BRANDS)
  console.log('\nMarcas creadas en MongoDB:\n')
  inserted.forEach(b => {
    console.log(`  ${b.code}  ${b.name.padEnd(42)}  tier: ${b.tier.padEnd(8)}  _id: ${b._id}`)
  })

  await mongoose.disconnect()
  console.log('\nDone.')
}

run().catch(e => { console.error(e); process.exit(1) })
