import mongoose from 'mongoose'

const countrySchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true, min: 1 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  number: { type: String, required: true, unique: true, trim: true },
}, {
  timestamps: true,
  versionKey: false,
})

export const Country = mongoose.model('Country', countrySchema)
