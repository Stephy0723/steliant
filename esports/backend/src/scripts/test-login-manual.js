import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { config } from '../config/index.js'
import { User } from '../models/User.js'

async function run() {
  console.log(`Connecting to ${config.mongoUri}...`);
  await mongoose.connect(config.mongoUri);

  const user = await User.findOne({ email: 'admin@gg.gg' }).select('+passwordHash');
  if (!user) {
    console.error('User admin@gg.gg not found!');
  } else {
    console.log('User found:', {
      _id: user._id,
      email: user.email,
      nick: user.nick,
      role: user.role,
      isAdmin: user.isAdmin,
      status: user.status,
      passwordHash: user.passwordHash
    });
    
    const match = await bcrypt.compare('Seed1234!', user.passwordHash);
    console.log(`Bcrypt compare for 'Seed1234!': ${match}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
