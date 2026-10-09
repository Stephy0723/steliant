import mongoose from 'mongoose'

// Invitacion del lider a un jugador concreto (por nick). Es el camino inverso
// de Team.joinRequests (el jugador pide, el lider acepta): aqui el lider
// invita y el jugador acepta. En equipos universitarios es, junto a la
// solicitud, la unica forma de entrar (el codigo/link esta bloqueado).
const teamInvitationSchema = new mongoose.Schema({
  team:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:   { type: String, default: '', trim: true, maxlength: 280 },
  // Con que rol entra al aceptar (shared/teamRoles.mjs): jugador o staff.
  role:      { type: String, enum: ['player', 'coach', 'analyst', 'manager'], default: 'player' },
  status:    { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  respondedAt: { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
})

// Una sola invitacion pendiente por equipo y jugador.
teamInvitationSchema.index({ team: 1, user: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })
teamInvitationSchema.index({ user: 1, status: 1, createdAt: -1 })

export const TeamInvitation = mongoose.model('TeamInvitation', teamInvitationSchema)
