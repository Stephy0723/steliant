import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  form: { type: mongoose.Schema.Types.Mixed, required: true },
  step: { type: Number, min: 0, max: 5, default: 0 },
  creationKey: { type: String, required: true, maxlength: 80 },
  savedAt: { type: Number, required: true },
}, { timestamps: true, versionKey: false })

export const TournamentDraft = mongoose.model('TournamentDraft', schema)
