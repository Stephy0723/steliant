import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { Team } from '../src/models/Team.js'

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/glitchgang')
    console.log('Connected to MongoDB...')

    // Find user tephygg
    const user = await User.findOne({ 
      $or: [
        { nick: 'tephygg' },
        { email: 'salylopez0723@gmail.com' }
      ]
    })

    if (!user) {
      console.log('User tephygg not found!')
      process.exit(1)
    }

    // Find Glitch Elite team
    const team = await Team.findOne({ name: 'Glitch Elite' })
    if (!team) {
      console.log('Team Glitch Elite not found!')
      process.exit(1)
    }

    // Associate user with team
    user.team = team._id
    await user.save()

    // Add user to team members if not already there
    const memberExists = team.members.some(mId => mId.toString() === user._id.toString())
    if (!memberExists) {
      team.members.push(user._id)
      await team.save()
    }

    console.log(`Successfully added user ${user.nick} (${user.email}) to team ${team.name}!`)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

run()
