import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { Tournament } from '../src/models/Tournament.js'

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/glitchgang')
    console.log('Connected to MongoDB for seeding tournaments...')

    // 1. Find admin user
    let admin = await User.findOne({ email: 'admin@gg.gg' })
    if (!admin) {
      console.log('Admin user not found. Please run reset-admin.js first.')
      process.exit(1)
    }

    // Update admin user using native MongoDB driver to bypass Mongoose's immutability checks
    // The organizerCode MUST match: /^ORG-(\d{3,})-\d{2,3}$/ (e.g. ORG-100-01)
    const db = mongoose.connection.db
    const updateResult = await db.collection('users').updateOne(
      { _id: admin._id },
      { 
        $set: { 
          'roleProfiles.organizer.organizerCode': 'ORG-100-01',
          'roleProfiles.organizer.organizerInternalCode': 'ORG-100-01-INT',
          'roleProfiles.organizer.approvedAt': new Date()
        } 
      }
    )
    console.log('Native MongoDB update result:', updateResult)

    // Re-fetch and log to verify
    const verifiedAdmin = await db.collection('users').findOne({ _id: admin._id })
    console.log('Verified Admin document via native driver:', JSON.stringify(verifiedAdmin, null, 2))

    // 2. Clear existing tournaments to start fresh
    await Tournament.deleteMany({})
    console.log('Cleared existing tournaments.')

    // Add registration for the admin's team (Glitch Elite - 6a40b28f4e41c33ec75e7f60)
    const adminTeamId = new mongoose.Types.ObjectId('6a40b28f4e41c33ec75e7f60')
    const reg = {
      team: adminTeamId,
      registeredBy: admin._id,
      status: 'registered',
      registeredAt: new Date()
    }

    // 3. Create 3 professional tournaments
    const now = new Date()
    const t1 = new Tournament({
      title: 'GlitchGang Valorant Cup #1',
      game: 'Valorant',
      gameCode: 'VAL',
      format: 'single_elimination',
      maxSlots: 16,
      prizePool: 500,
      currency: 'USD',
      date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      registrationWindow: {
        start: now,
        end: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)
      },
      status: 'open',
      organizer: admin._id,
      registrations: [reg],
      description: 'El torneo de Valorant más competitivo de la comunidad GlitchGang. Regístrate con tu equipo y compite por el premio acumulado.',
      prizeType: 'Efectivo',
      prizes: [
        { place: '1st', amount: 350, items: 'Trofeo de Campeón' },
        { place: '2nd', amount: 150, items: 'Medalla de plata' }
      ]
    })

    const t2 = new Tournament({
      title: 'Championship League of Legends Latino',
      game: 'League of Legends',
      gameCode: 'LOL',
      format: 'double_elimination',
      maxSlots: 32,
      prizePool: 1000,
      currency: 'USD',
      date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      registrationWindow: {
        start: now,
        end: new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000)
      },
      status: 'open',
      organizer: admin._id,
      registrations: [reg],
      description: 'Compite en la grieta del invocador en este torneo de eliminación doble. Abierto para todos los rangos.',
      prizeType: 'Efectivo',
      prizes: [
        { place: '1st', amount: 700, items: 'Skins Legendarias + Copa' },
        { place: '2nd', amount: 300, items: 'Skins Épicas' }
      ]
    })

    const t3 = new Tournament({
      title: 'CS2 Masters Series - Glitch',
      game: 'CS2',
      gameCode: 'CS2',
      format: 'single_elimination',
      maxSlots: 16,
      prizePool: 250,
      currency: 'USD',
      date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      registrationWindow: {
        start: now,
        end: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      },
      status: 'open',
      organizer: admin._id,
      registrations: [reg],
      description: 'El torneo rápido de CS2 de mitad de semana. 16 equipos, eliminación directa.',
      prizeType: 'Efectivo',
      prizes: [
        { place: '1st', amount: 200, items: 'Medallas de oro' },
        { place: '2nd', amount: 50, items: 'Medallas de plata' }
      ]
    })

    await t1.save()
    await t2.save()
    await t3.save()

    console.log('Successfully seeded 3 tournaments:')
    console.log(`- ${t1.title} | ID: ${t1._id} | Public ID: ${t1.publicId}`)
    console.log(`- ${t2.title} | ID: ${t2._id} | Public ID: ${t2.publicId}`)
    console.log(`- ${t3.title} | ID: ${t3._id} | Public ID: ${t3.publicId}`)

    process.exit(0)
  } catch (err) {
    console.error('Error seeding tournaments:', err)
    process.exit(1)
  }
}

run()
