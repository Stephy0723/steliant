import mongoose from 'mongoose'

// Bitacora de exportaciones del panel admin (Centro de Exportacion y
// /admin/usuarios/exportar). Antes vivia en memoria del navegador.
const exportLogSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName:  { type: String, default: 'Admin', trim: true, maxlength: 120 },
  role:      { type: String, default: 'Administrador', trim: true, maxlength: 60 },
  action:    { type: String, default: 'Exportacion', trim: true, maxlength: 120 },
  entity:    { type: String, default: '-', trim: true, maxlength: 80 },
  recordId:  { type: String, default: '-', trim: true, maxlength: 160 },
  fileType:  { type: String, default: 'PDF', trim: true, maxlength: 20 },
  period:    { type: String, default: '-', trim: true, maxlength: 80 },
  season:    { type: String, default: '-', trim: true, maxlength: 40 },
  count:     { type: Number, default: 0, min: 0 },
  printCode: { type: String, default: '-', trim: true, maxlength: 80 },
  ip:        { type: String, default: '', trim: true, maxlength: 80 },
}, { timestamps: true, versionKey: false })

exportLogSchema.index({ createdAt: -1 })

export const ExportLog = mongoose.model('ExportLog', exportLogSchema)
