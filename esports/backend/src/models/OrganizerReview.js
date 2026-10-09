import mongoose from 'mongoose'

// Reputacion/calificacion de organizadores, pedida por Stephanie para el
// directorio de Organizadores del Centro de Marcas (BrandOrganizers.jsx) --
// hoy ese directorio muestra datos 100% reales de torneos (prize pool,
// equipos alcanzados) pero nada de que tan bien organizaron. Alcance basico
// (sin moderacion todavia): rating 1-5 + comentario, solo de un equipo que
// de verdad jugo un torneo de ese organizador. Ver BACKEND-PENDIENTE.md
// #brand-organizador-reputacion.
const organizerReviewSchema = new mongoose.Schema({
  organizer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  comment:    { type: String, default: '', trim: true, maxlength: 800 },
}, {
  timestamps: true,
  versionKey: false,
})

// Una resena por equipo+torneo (no por persona -- si el lider cambia, la
// resena del equipo para ESE torneo sigue siendo una sola). Se puede editar
// via upsert, no duplicar.
organizerReviewSchema.index({ team: 1, tournament: 1 }, { unique: true })
organizerReviewSchema.index({ organizer: 1, createdAt: -1 })

export const OrganizerReview = mongoose.model('OrganizerReview', organizerReviewSchema)
