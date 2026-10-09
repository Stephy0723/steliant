import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { Team } from '../src/models/Team.js'

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/glitchgang')
    console.log('Connected to MongoDB for seeding teams...')

    // Find admin user
    let admin = await User.findOne({ email: 'admin@gg.gg' })
    if (!admin) {
      console.log('Admin user not found.')
      process.exit(1)
    }

    // Clear existing teams
    await Team.deleteMany({})
    console.log('Cleared existing teams.')

    // Create 2 teams
    const team1 = new Team({
      publicCode: 'TEAM-001-01',
      internalCode: 'TEAM-260628-001-01',
      name: 'Glitch Elite',
      tag: 'GLE',
      color: '#00E676',
      leader: admin._id,
      members: [admin._id],
      logo: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=120&auto=format&fit=crop',
      game: 'Valorant',
      slogan: 'Llegando a la cima de la escena competitiva.',
      description: 'El equipo de la división de élite de GlitchGang.'
    })

    const team2 = new Team({
      publicCode: 'TEAM-002-01',
      internalCode: 'TEAM-260628-002-01',
      name: 'Alpha Squad',
      tag: 'ALPH',
      color: '#ffd700',
      leader: admin._id,
      members: [admin._id],
      logo: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=120&auto=format&fit=crop',
      game: 'CS2',
      slogan: 'Estrategia y precisión en cada ronda.',
      description: 'Equipo de CS2 enfocado en torneos semanales y ligas de nivel medio.'
    })

    await team1.save()
    await team2.save()

    // Associate admin user with team1
    admin.team = team1._id
    await admin.save()

    console.log('Successfully seeded 2 teams:')
    console.log(`- ${team1.name} | ID: ${team1._id} | Tag: ${team1.tag}`)
    console.log(`- ${team2.name} | ID: ${team2._id} | Tag: ${team2.tag}`)

    process.exit(0)
  } catch (err) {
    console.error('Error seeding teams:', err)
    process.exit(1)
  }
}

run()
