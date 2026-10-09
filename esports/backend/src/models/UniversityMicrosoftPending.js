import mongoose from 'mongoose'

// Paso intermedio de la verificacion universitaria con Microsoft: el
// estudiante ya inicio sesion con su cuenta institucional (identidad
// comprobada) y falta que elija campus/carrera/nivel. Uno por usuario; se
// borra al confirmar y expira solo (TTL).
const UniversityMicrosoftPendingSchema = new mongoose.Schema(
  {
    user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    institutionalEmail: { type: String, required: true, lowercase: true, trim: true },
    universityId:       { type: String, required: true },
    microsoft: {
      id:          { type: String, default: '' },
      tenantId:    { type: String, default: '' },
      email:       { type: String, default: '' },
      displayName: { type: String, default: '' },
    },
    expiresAt:          { type: Date, required: true },
  },
  { timestamps: true }
)

UniversityMicrosoftPendingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const UniversityMicrosoftPending = mongoose.model('UniversityMicrosoftPending', UniversityMicrosoftPendingSchema)
