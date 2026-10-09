import mongoose from 'mongoose'

const gameRequestSchema = new mongoose.Schema({
  gameName: { type: String, required: true, trim: true, maxlength: 120 },
  genre: { type: String, default: '', trim: true, maxlength: 80 },
  platform: { type: String, default: '', trim: true, maxlength: 120 },
  links: { type: String, default: '', trim: true, maxlength: 300 },
  message: { type: String, required: true, trim: true, maxlength: 1200 },
  requesterName: { type: String, default: 'Invitado', trim: true, maxlength: 80 },
  requesterEmail: { type: String, default: '', trim: true, lowercase: true, maxlength: 160 },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  systemTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'SystemTicket', default: null },
  status: { type: String, enum: ['pending', 'reviewing', 'approved', 'rejected'], default: 'pending' },
  reviewNote: { type: String, default: '', trim: true, maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false })

export const GameRequest = mongoose.model('GameRequest', gameRequestSchema)
