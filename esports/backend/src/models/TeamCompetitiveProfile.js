import mongoose from 'mongoose'

export const COMPETITIVE_DIVISIONS = ['academia', 'amateur', 'semi_pro', 'pro', 'elite']

const teamCompetitiveProfileSchema = new mongoose.Schema({
  team:   { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  season: { type: mongoose.Schema.Types.ObjectId, ref: 'Season', required: true },

  game:   { type: String, default: '', trim: true },
  region: { type: String, default: '', trim: true },

  division: { type: String, enum: COMPETITIVE_DIVISIONS, default: 'academia' },
  points:   { type: Number, default: 0, min: 0 },
  rank:     { type: Number, default: null },
  wins:     { type: Number, default: 0, min: 0 },
  losses:   { type: Number, default: 0, min: 0 },

  eligibility: {
    canChallenge:   { type: Boolean, default: false },
    canBeChallenged:{ type: Boolean, default: false },
    reason:         { type: String, default: '' },
  },

  status: { type: String, enum: ['active', 'inactive', 'sanctioned', 'vetoed'], default: 'active' },
  lastCalculatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  versionKey: false,
})

teamCompetitiveProfileSchema.index({ season: 1, game: 1, region: 1, points: -1 })
teamCompetitiveProfileSchema.index({ team: 1, season: 1 }, { unique: true })

export const TeamCompetitiveProfile = mongoose.model('TeamCompetitiveProfile', teamCompetitiveProfileSchema)
