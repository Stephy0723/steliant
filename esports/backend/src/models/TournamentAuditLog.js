import mongoose from 'mongoose'

// Colección aparte (no embebida en Tournament) para no inflar ese documento
// con un log que puede crecer indefinidamente -- ver BACKEND-PENDIENTE.md
// #registro-actividad-staff.
const tournamentAuditLogSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userNick:   { type: String, default: '' },
  // Rol de staff en ese torneo AL MOMENTO de la accion -- copiado, no solo
  // referenciado, porque el rol puede cambiar despues.
  role:       { type: String, default: '' },
  action:     { type: String, required: true }, // 'create' | 'update' | 'delete' | 'respond'
  tabKey:     { type: String, default: null },
  summary:    { type: String, required: true, maxlength: 300 },
  meta:       { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt:  { type: Date, default: Date.now },
}, { versionKey: false })

tournamentAuditLogSchema.index({ tournament: 1, _id: -1 })

export const TournamentAuditLog = mongoose.model('TournamentAuditLog', tournamentAuditLogSchema)
