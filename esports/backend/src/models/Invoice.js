import mongoose from 'mongoose'

// Factura/recibo generado por cada pago de campaña aprobado.
// El admin verifica el comprobante de pago en el Centro de Marcas.
// La marca descarga el recibo en su sección de Facturación.

const invoiceSchema = new mongoose.Schema({
  brandId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Brand',    required: true },
  campaignId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },

  // Número de factura secuencial: INV-2026-0001
  invoiceNumber:   { type: String, required: true, unique: true, uppercase: true, trim: true },
  internalCode:    { type: String, unique: true, sparse: true, uppercase: true, trim: true },

  // Monto y moneda
  amount:          { type: Number, required: true },
  currency:        { type: String, default: 'USD' },

  // Comprobante de pago enviado por la marca
  proofUrl:        { type: String, default: '' },       // base64 o URL
  proofType:       { type: String, enum: ['transfer', 'card', 'cash', 'other', ''], default: '' },
  brandNotes:      { type: String, default: '' },       // nota libre de la marca

  // Estado de verificación
  status:          { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  rejectedReason:  { type: String, default: '' },

  // Trazabilidad del admin que verificó
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:      { type: Date, default: null },

  // Nota interna del admin
  adminNotes:      { type: String, default: '' },

}, { timestamps: true, versionKey: false })

invoiceSchema.index({ brandId: 1, createdAt: -1 })
invoiceSchema.index({ status: 1 })

export const Invoice = mongoose.model('Invoice', invoiceSchema)
