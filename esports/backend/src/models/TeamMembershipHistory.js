import mongoose from 'mongoose'

// El filtro "Anteriores" en /jugador/equipos nunca podia mostrar nada porque
// el backend no rastreaba cuando un jugador salia de un equipo -- Team.members
// es solo un array de ids del roster ACTUAL, sin historial. Ver
// BACKEND-PENDIENTE.md #jugador-equipos-anteriores. Snapshot de nombre/tag/
// logo porque el equipo puede disolverse (el ref `team` queda null en ese
// caso) o cambiar de nombre despues.
const teamMembershipHistorySchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  team:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamName: { type: String, required: true },
  teamTag:  { type: String, default: '' },
  teamLogo: { type: String, default: '' },
  teamColor:{ type: String, default: '' },
  game:     { type: String, default: '' },
  role:     { type: String, enum: ['leader', 'member'], required: true },
  // Puesto que ocupaba (shared/teamRoles.mjs): jugador o staff (coach...).
  teamRole: { type: String, enum: ['player', 'coach', 'analyst', 'manager'], default: 'player' },
  // removed = lo saco el lider.
  reason:   { type: String, enum: ['left', 'disbanded', 'removed'], required: true },
  leftAt:   { type: Date, default: Date.now },
}, {
  timestamps: true,
  versionKey: false,
})

teamMembershipHistorySchema.index({ user: 1, leftAt: -1 })

export const TeamMembershipHistory = mongoose.model('TeamMembershipHistory', teamMembershipHistorySchema)
