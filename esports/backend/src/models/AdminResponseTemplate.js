import mongoose from 'mongoose'

const adminResponseTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  module: {
    type: String,
    enum: ['all', 'system_ticket', 'game_request', 'role_application', 'brand_application', 'brand_ticket', 'payment', 'tournament', 'university', 'report'],
    default: 'all',
  },
  tone: { type: String, enum: ['positive', 'neutral', 'warning', 'negative'], default: 'neutral' },
  body: { type: String, required: true, trim: true, maxlength: 1600 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, versionKey: false })

adminResponseTemplateSchema.index({ module: 1, active: 1, title: 1 })

export const AdminResponseTemplate = mongoose.model('AdminResponseTemplate', adminResponseTemplateSchema)
