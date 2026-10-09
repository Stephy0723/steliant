import mongoose from 'mongoose'

const integrationEventSchema = new mongoose.Schema({
  type:       { type: String, required: true, index: true, trim: true },
  status:     { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
  attempts:   { type: Number, default: 0, min: 0 },
  nextRunAt:  { type: Date, default: Date.now, index: true },
  lockedAt:   { type: Date, default: null },
  lockedBy:   { type: String, default: '', trim: true },
  lastError:  { type: String, default: '', trim: true, maxlength: 2000 },

  entityType: { type: String, required: true, trim: true },
  entityId:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  payload: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  result:  { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  processedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false })

integrationEventSchema.index({ status: 1, nextRunAt: 1, createdAt: 1 })
integrationEventSchema.index({ type: 1, entityType: 1, entityId: 1, status: 1 })

export const IntegrationEvent = mongoose.model('IntegrationEvent', integrationEventSchema)
