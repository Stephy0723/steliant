import mongoose from 'mongoose'

const universitySchema = new mongoose.Schema({
  // ── Cédulas universitarias ──
  publicCode: { type: String, unique: true, sparse: true, trim: true },   // ITLA-0614-0001
  internalCode: { type: String, unique: true, sparse: true, trim: true }, // ITLA-0614-071026-0001

  siglas: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, default: '', trim: true },
  matricula: { type: String, required: true, trim: true },
  matriculaTail: { type: String, trim: true },
  career: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  registeredOn: { type: Date, required: true },   // fecha de registro en la web (DDMMYY del ID)

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nick: { type: String, default: '', trim: true },
}, {
  timestamps: true,
  versionKey: false,
})

export const University = mongoose.model('University', universitySchema)
