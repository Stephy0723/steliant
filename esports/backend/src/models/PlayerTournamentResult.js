import mongoose from 'mongoose'

const playerTournamentResultSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null, index: true },

  name: { type: String, required: true, trim: true, maxlength: 140 },
  game: { type: String, required: true, trim: true },
  teamName: { type: String, default: '', trim: true },
  placement: { type: Number, required: true, min: 1 },
  totalTeams: { type: Number, default: 0, min: 0 },
  prize: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'USD', trim: true, uppercase: true },
  date: { type: Date, default: Date.now, index: true },
  source: { type: String, enum: ['manual', 'tournament', 'import'], default: 'manual' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  versionKey: false,
})

playerTournamentResultSchema.index({ player: 1, date: -1 })
playerTournamentResultSchema.index({ player: 1, game: 1 })

export const PlayerTournamentResult = mongoose.model('PlayerTournamentResult', playerTournamentResultSchema)
