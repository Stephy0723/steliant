import mongoose from 'mongoose'

const roleApplicationSchema = new mongoose.Schema({
  publicCode:  { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode:{ type: String, unique: true, sparse: true, uppercase: true, trim: true },

  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  systemTicket:{ type: mongoose.Schema.Types.ObjectId, ref: 'SystemTicket', default: null },
  roleId:      { type: String, required: true }, // 'organizer' | 'creator' | 'coach' | 'caster' | 'analyst' | 'sponsor'
  roleLabel:   { type: String, required: true },

  // Verificación de identidad
  dni:              { type: String, required: true, trim: true },
  documentFileName: { type: String, default: '' },
  documentUrl:      { type: String, default: '' },

  // Campos dinámicos del formulario (profileFields + experienceFields por rol)
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Estado
  status:          { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: '' },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:      { type: Date, default: null },
}, { timestamps: true, versionKey: false })

export const RoleApplication = mongoose.model('RoleApplication', roleApplicationSchema)
