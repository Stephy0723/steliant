const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/glitchgang').then(async () => {
  const UserSchema = new mongoose.Schema({
    email: String,
    nick: String,
    firstName: String,
    lastName: String,
    countryCode: String,
    phoneCountryDial: String,
    phoneNumber: String,
    birthDate: Date,
    gender: String,
    experienceLevel: String,
    mainPlatform: String,
    acceptedTermsAt: Date,
    role: String,
    isAdmin: Boolean,
    passwordHash: String,
    status: String
  }, { collection: 'users' });
  
  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const hash = await bcrypt.hash('Seed1234!', 10);
  
  let admin = await User.findOne({ email: 'admin@gg.gg' });
  if (!admin) {
    console.log('Admin user admin@gg.gg not found, creating a new one.');
    admin = new User({
      email: 'admin@gg.gg',
      nick: 'admin',
      firstName: 'Admin',
      lastName: 'Glitch',
      countryCode: 'RD',
      phoneCountryDial: '+1',
      phoneNumber: '8095551234',
      birthDate: new Date('1990-01-01'),
      gender: 'male',
      experienceLevel: 'pro',
      mainPlatform: 'pc',
      acceptedTermsAt: new Date()
    });
  }
  
  admin.passwordHash = hash;
  admin.role = 'admin';
  admin.isAdmin = true;
  admin.status = 'activo';
  
  await admin.save();
  console.log('Successfully updated/created admin account:', admin.email);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
