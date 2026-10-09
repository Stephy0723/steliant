import mongoose from 'mongoose'

const playerMatchSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null, index: true },

  game: { type: String, required: true, trim: true, index: true },
  mode: { type: String, default: 'Ranked', trim: true },
  map: { type: String, default: '', trim: true },
  opponentName: { type: String, default: '', trim: true },
  result: { type: String, enum: ['win', 'loss', 'draw'], required: true, index: true },

  character: { type: String, default: '', trim: true, index: true },
  characterRole: { type: String, default: '', trim: true },
  kills: { type: Number, default: 0, min: 0 },
  deaths: { type: Number, default: 0, min: 0 },
  assists: { type: Number, default: 0, min: 0 },
  damageDealt: { type: Number, default: null, min: 0 },
  damageTaken: { type: Number, default: null, min: 0 },
  towerDamage: { type: Number, default: null, min: 0 },
  teamfightParticipation: { type: Number, default: null, min: 0, max: 100 },
  gold: { type: Number, default: null, min: 0 },
  mvp: { type: Boolean, default: null },
  statsDraft: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchStatsDraft' },
  bracketMatchId: { type: String },
  gameNumber: { type: Number, min: 1 },
  kda: { type: String, default: '', trim: true },
  rating: { type: Number, default: 1, min: 0 },
  ratingChange: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 0, min: 0 },
  playedAt: { type: Date, default: Date.now, index: true },

  source: { type: String, enum: ['manual', 'tournament', 'import'], default: 'manual' },
  notes: { type: String, default: '', maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  versionKey: false,
})

playerMatchSchema.index({ player: 1, playedAt: -1 })
playerMatchSchema.index({ statsDraft: 1, player: 1 }, { unique: true, partialFilterExpression: { statsDraft: { $type: 'objectId' } } })
playerMatchSchema.index({ player: 1, game: 1, playedAt: -1 })
playerMatchSchema.index({ player: 1, character: 1 })

export const PlayerMatch = mongoose.model('PlayerMatch', playerMatchSchema)
