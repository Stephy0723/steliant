import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jti:         { type: String, required: true, unique: true },
  userAgent:   { type: String, default: '' },
  ip:          { type: String, default: '' },
  deviceLabel: { type: String, default: '' },
  expiresAt:   { type: Date, required: true },
  lastActiveAt:{ type: Date, default: Date.now },
  revokedAt:   { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
})

// TTL — MongoDB auto-deletes expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
sessionSchema.index({ userId: 1, revokedAt: 1 })

export const Session = mongoose.model('Session', sessionSchema)
