import mongoose from 'mongoose'

// Faltas de un equipo (o de un jugador) en un torneo: quedan en su
// historial. La sanción nunca es automática: la decide el organizador
// (spec-lector-resultados, secciones 5 y 9). createdBy null = el sistema.
const infractionSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  player:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  bracketMatchId: { type: String, default: '' },
  gameNumber:     { type: Number, default: null },
  type: {
    type: String,
    enum: ['missing_screenshots', 'no_report', 'nickname_change', 'fake_id', 'rejected_report'],
    required: true,
  },
  detail:    { type: String, default: '', trim: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sanction:  { type: String, default: '', trim: true, maxlength: 300 },
}, { timestamps: true, versionKey: false })

// Una falta del mismo tipo por equipo y partida: el job puede repetirse.
infractionSchema.index(
  { tournament: 1, team: 1, bracketMatchId: 1, gameNumber: 1, type: 1 },
  { unique: true, partialFilterExpression: { bracketMatchId: { $type: 'string', $gt: '' } } },
)

export const Infraction = mongoose.model('Infraction', infractionSchema)
