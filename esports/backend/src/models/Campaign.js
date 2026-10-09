import mongoose from 'mongoose'

// Una Campaña = un Contrato Publicitario Digital.
// Agrupa múltiples creatividades bajo un mismo presupuesto, duración y estado de aprobación.
// Las creatividades individuales (banners, strips, flotantes) viven en el modelo Creative.

const paymentSchema = new mongoose.Schema({
  amount:          { type: Number, default: 0 },
  currency:        { type: String, default: 'USD' },
  proofUrl:        { type: String, default: '' },   // base64 o URL del comprobante
  proofType:       { type: String, enum: ['transfer', 'card', 'cash', 'other', ''], default: '' },
  status:          { type: String, enum: ['', 'pending', 'verified', 'rejected'], default: '' },
  rejectedReason:  { type: String, default: '' },
  verifiedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt:      { type: Date, default: null },
}, { _id: false })

const STATUSES = ['draft', 'pending', 'active', 'expired', 'rejected', 'archived']

const campaignSchema = new mongoose.Schema({
  brandId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  tournamentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  publicCode:       { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode:     { type: String, unique: true, sparse: true, uppercase: true, trim: true },

  // Datos del contrato
  name:             { type: String, required: true, trim: true },
  objective:        { type: String, default: '' },        // descripción del objetivo
  budget:           { type: Number, default: 0 },         // valor total del contrato
  startDate:        { type: Date, default: null },
  endDate:          { type: Date, default: null },

  // Estado del ciclo de vida
  status:           { type: String, enum: STATUSES, default: 'draft' },
  rejectionReason:  { type: String, default: '' },        // motivo de rechazo (obligatorio al rechazar)
  adminNotes:       { type: String, default: '' },

  // Trazabilidad de revisión
  reviewedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:       { type: Date, default: null },
  activatedAt:      { type: Date, default: null },        // cuando el admin aprobó y los banners se publicaron
  expiredAt:        { type: Date, default: null },        // cuando venció la vigencia

  // Pago del contrato (comprobante enviado por la marca)
  payment:          { type: paymentSchema, default: () => ({}) },

  // Métricas agregadas (suma de todas las creatividades de esta campaña)
  // Se calculan on-demand desde las creatividades; estos campos son cache de conveniencia
  impressions:      { type: Number, default: 0 },
  clicks:           { type: Number, default: 0 },

}, { timestamps: true, versionKey: false })

export const Campaign = mongoose.model('Campaign', campaignSchema)
