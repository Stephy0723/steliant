import mongoose from 'mongoose'

const seasonSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 80 },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  game:        { type: String, default: '', trim: true },
  region:      { type: String, default: '', trim: true },
  startsAt:    { type: Date, required: true },
  endsAt:      { type: Date, required: true },
  status:      { type: String, enum: ['upcoming', 'active', 'closing', 'finished'], default: 'upcoming' },
  rules: {
    divisions: [{ type: String, trim: true }],
    pointsReset: { type: String, enum: ['soft', 'hard', 'none'], default: 'soft' },
  },
}, {
  timestamps: true,
  versionKey: false,
})

seasonSchema.index({ status: 1, startsAt: -1 })
seasonSchema.index({ game: 1, region: 1, status: 1 })

export const Season = mongoose.model('Season', seasonSchema)
