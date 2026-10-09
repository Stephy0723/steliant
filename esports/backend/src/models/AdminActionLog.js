import mongoose from 'mongoose'

const adminActionLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: 'Admin', trim: true, maxlength: 120 },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  module: { type: String, required: true, trim: true, maxlength: 80 },
  targetId: { type: String, required: true, trim: true, maxlength: 120 },
  targetCode: { type: String, default: '', uppercase: true, trim: true, maxlength: 160 },
  summary: { type: String, default: '', trim: true, maxlength: 400 },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true, versionKey: false })

adminActionLogSchema.index({ module: 1, createdAt: -1 })
adminActionLogSchema.index({ targetId: 1, createdAt: -1 })
adminActionLogSchema.index({ actor: 1, createdAt: -1 })

export const AdminActionLog = mongoose.model('AdminActionLog', adminActionLogSchema)
