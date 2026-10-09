import mongoose from 'mongoose'

// Ticket que un jugador abre desde el menu de #soporte del torneo en Discord.
// Lo atiende el organizador/staff de ESE torneo (no el equipo de GlitchGang,
// que tiene SystemTicket). Discord es donde se conversa (un hilo por ticket);
// aca queda el historial para el panel web y el estado abierto/resuelto.
const tournamentSupportTicketSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  category:   { type: String, enum: ['room', 'voice', 'bot', 'connection', 'other'], default: 'other' },
  detail:     { type: String, default: '', trim: true, maxlength: 500 },

  // Quien lo abrio. `requester` solo si su Discord esta vinculado a GlitchGang.
  requester:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requesterDiscordId: { type: String, required: true, trim: true, maxlength: 32 },
  requesterName:    { type: String, default: '', trim: true, maxlength: 80 },

  // Equipo inscrito en el torneo al que pertenece quien reporta (si se encontro).
  team:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamName: { type: String, default: '', trim: true, maxlength: 120 },

  status:   { type: String, enum: ['open', 'resolved'], default: 'open' },
  resolvedAt:   { type: Date, default: null },
  resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedByName: { type: String, default: '', trim: true, maxlength: 80 },
  resolvedFrom: { type: String, enum: ['discord', 'web', ''], default: '' },

  discord: {
    guildId:   { type: String, default: '' },
    channelId: { type: String, default: '' },
    threadId:  { type: String, default: '' },
    messageId: { type: String, default: '' },
  },
}, {
  timestamps: true,
  versionKey: false,
})

tournamentSupportTicketSchema.index({ tournament: 1, status: 1, createdAt: -1 })

export const TournamentSupportTicket = mongoose.model('TournamentSupportTicket', tournamentSupportTicketSchema)
