import mongoose from 'mongoose'

const passwordResetTokenSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, {
  timestamps: true,
  versionKey: false,
})

export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema)
