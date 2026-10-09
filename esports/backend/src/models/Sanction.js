import mongoose from 'mongoose'

// Registro de moderacion (/admin/moderacion). Compartido con el ban/unban de
// /admin/usuarios: banear o desbanear a alguien desde el censo crea una fila
// aca automaticamente (ver admin.controller.js -> setUserStatus), ademas de
// las entradas manuales ("Nueva accion") que arma un moderador a mano.
const sanctionSchema = new mongoose.Schema({
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  targetNick: { type: String, required: true, trim: true, maxlength: 60 },
  type:       { type: String, enum: ['ban', 'warning', 'mute', 'unban'], required: true },
  action:     { type: String, required: true, trim: true, maxlength: 160 },
  reason:     { type: String, default: '', trim: true, maxlength: 500 },
  moderator:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatorName: { type: String, default: 'Admin', trim: true, maxlength: 80 },
}, { timestamps: true, versionKey: false })

sanctionSchema.index({ createdAt: -1 })

export const Sanction = mongoose.model('Sanction', sanctionSchema)
