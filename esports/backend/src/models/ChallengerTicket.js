import mongoose from 'mongoose'

// Tickets de reto del Modo Retador.
// Un equipo amateur/principiante/semi-pro crea un ticket retando a un
// equipo profesional que tenga el Modo Retador activo.
// El equipo PRO debe cumplir 7 tickets por mes para mantener beneficios.

const resultSchema = new mongoose.Schema({
  winner:     { type: String, enum: ['challenger', 'pro', 'draw', ''], default: '' },
  score:      { type: String, default: '' },
  reportedByChallenger: { type: Boolean, default: false },
  reportedByPro:        { type: Boolean, default: false },
  confirmedAt:          { type: Date, default: null },
}, { _id: false })

const challengerTicketSchema = new mongoose.Schema({
  publicCode:   { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },

  // Equipo que reta (amateur / principiante / semi-pro)
  challengerTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  challengerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Equipo profesional retado (debe tener challengerMode.active = true)
  proTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

  // Detalles del reto
  game:          { type: String, required: true, trim: true },
  format:        { type: String, default: 'BO3', trim: true },
  scheduledDate: { type: Date, default: null },
  scheduledTime: { type: String, default: '', trim: true },
  message:       { type: String, default: '', maxlength: 500 },

  // Estado del ticket
  status: {
    type: String,
    enum: ['pending', 'accepted', 'scheduled', 'played', 'completed', 'rejected', 'expired', 'cancelled'],
    default: 'pending',
  },

  // Resultado del enfrentamiento
  result: { type: resultSchema, default: () => ({}) },

  // Tracking mensual
  month: { type: String, required: true }, // "2026-07"

  // Fechas clave
  acceptedAt:  { type: Date, default: null },
  playedAt:    { type: Date, default: null },
  completedAt: { type: Date, default: null },
  rejectedAt:  { type: Date, default: null },
  expiresAt:   { type: Date, default: null },

}, { timestamps: true, versionKey: false })

challengerTicketSchema.index({ proTeam: 1, month: 1, status: 1 })
challengerTicketSchema.index({ challengerTeam: 1, status: 1 })
challengerTicketSchema.index({ status: 1, month: 1 })

export const ChallengerTicket = mongoose.model('ChallengerTicket', challengerTicketSchema)
