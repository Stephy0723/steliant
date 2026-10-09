import mongoose from 'mongoose'

// Sorteos (/admin/sorteos + pagina publica /sorteos). Participa cualquier
// cuenta logueada (una entrada por cuenta) mientras el sorteo esta 'active';
// el admin sortea el ganador en el backend entre los participantes reales.
const raffleSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true, maxlength: 120 },
  type:         { type: String, enum: ['Comunidad', 'Evento', 'Torneo', 'Marca'], default: 'Comunidad' },
  prize:        { type: String, required: true, trim: true, maxlength: 160 },
  description:  { type: String, default: '', trim: true, maxlength: 600 },
  coverImage:   { type: String, default: '', trim: true },
  closesAt:     { type: String, default: '', trim: true, maxlength: 60 },
  entrants: [{
    _id: false,
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
  }],
  status:       { type: String, enum: ['draft', 'scheduled', 'active', 'closed'], default: 'draft' },
  winner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  drawnAt:      { type: Date, default: null },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, versionKey: false })

raffleSchema.index({ createdAt: -1 })
raffleSchema.index({ status: 1, createdAt: -1 })

export const Raffle = mongoose.model('Raffle', raffleSchema)
