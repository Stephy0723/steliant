import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  internalCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:    { type: String, required: true, trim: true },
  title:   { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 400 },
  read:    { type: Boolean, default: false },
  archived:{ type: Boolean, default: false },
  saved:   { type: Boolean, default: false },
  link:    { type: String, default: '' },
  meta:    { type: mongoose.Schema.Types.Mixed, default: null },
}, {
  timestamps: true,
  versionKey: false,
})

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

export const Notification = mongoose.model('Notification', notificationSchema)
