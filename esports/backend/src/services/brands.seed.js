import { Brand } from '../models/Brand.js'

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
    contactName: 'Federacion Dominicana de Videojuegos',
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
    contactName: 'NPC Latino',
    contactEmail: 'contacto@npclatino.com',
    status: 'active',
    since: new Date('2026-01-01'),
  },
]

export async function seedBrands() {
  const count = await Brand.countDocuments()
  if (count > 0) return

  await Brand.insertMany(SEED_BRANDS)
  console.log(`[seed] ${SEED_BRANDS.length} marcas creadas (BRD-001 -> BRD-002)`)
}
