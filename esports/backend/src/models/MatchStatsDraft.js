import mongoose from 'mongoose'
import { statsTeamSchema, statsRosterSchema, statsSubmissionSchema, statsRevisionSchema, statsConfirmationSchema } from './schemas/matchStats.schema.js'
import { MATCH_STATS_LIMITS } from '../../../shared/matchStatsContract.mjs'

const schema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  bracketMatchId: { type: String, required: true },
  gameNumber: { type: Number, required: true, min: 1, max: MATCH_STATS_LIMITS.games },
  teams: { type: [statsTeamSchema], required: true, validate: rows => rows.length === 2 },
  roster: { type: [statsRosterSchema], required: true, validate: rows => rows.length === MATCH_STATS_LIMITS.players },
  submissions: { type: [statsSubmissionSchema], default: [], validate: rows => rows.length <= 3 },
  revisions: { type: [statsRevisionSchema], default: [], validate: rows => rows.length <= MATCH_STATS_LIMITS.revisions },
  revision: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'confirmed'], default: 'draft' },
  confirmation: { type: statsConfirmationSchema, default: null },
  historyWrittenAt: { type: Date, default: null },
  historyRetryAt: { type: Date, default: null },
  historyAttempts: { type: Number, default: 0, min: 0 },
  historyError: { type: String, default: '', maxlength: 200 },
}, { timestamps: true })
schema.index({ tournament: 1, bracketMatchId: 1, gameNumber: 1 }, { unique: true })
schema.index({ status: 1, historyWrittenAt: 1, historyRetryAt: 1 })
export const MatchStatsDraft = mongoose.model('MatchStatsDraft', schema)
