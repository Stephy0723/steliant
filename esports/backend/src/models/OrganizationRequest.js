import mongoose from 'mongoose'

// Solicitud de un organizador para activar su servidor de Discord.
// Al aprobarse, se convierte en una Organization real (ver
// organizationRequests.controller.js). Mismo patron que RoleApplication.
const organizationRequestSchema = new mongoose.Schema({
  requester:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:            { type: String, required: true, trim: true, maxlength: 120 },
  discordGuildId:  { type: String, required: true, trim: true },
  message:         { type: String, default: '', trim: true, maxlength: 500 },

  status:          { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: '' },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:      { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
})

organizationRequestSchema.index({ requester: 1, status: 1 })

export const OrganizationRequest = mongoose.model('OrganizationRequest', organizationRequestSchema)
