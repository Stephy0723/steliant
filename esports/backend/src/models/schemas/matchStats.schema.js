import mongoose from 'mongoose'
import { STAT_FIELDS } from '../../../../shared/matchStats.mjs'
import { MATCH_STATS_LIMITS } from '../../../../shared/matchStatsContract.mjs'

const options = { _id: false, strict: 'throw' }
const count = key => ({ type: Number, default: null, min: 0, max: key === 'teamfightParticipation' ? 100 : 100000000,
  validate: { validator: value => value == null || (Number.isFinite(value) && (key === 'teamfightParticipation' || Number.isInteger(value))), message: 'Estadística numérica inválida.' } })
export const statsPlayerSchema = new mongoose.Schema({
  playerId: { type: String, default: '', maxlength: 24 },
  teamId: { type: String, default: '', maxlength: 24 },
  rawName: { type: String, default: '', maxlength: 100 },
  character: { type: String, default: '', maxlength: 80 },
  mvp: { type: Boolean, default: null },
  uncertain: [{ type: String, enum: [...Object.keys(STAT_FIELDS), 'rawName', 'mvp', 'character'] }],
  ...Object.fromEntries(Object.keys(STAT_FIELDS).map(key => [key, count(key)])),
}, options)
export const statsDataSchema = new mongoose.Schema({
  winnerTeamId: { type: String, default: '', maxlength: 24 },
  scoreA: count('scoreA'), scoreB: count('scoreB'),
  players: { type: [statsPlayerSchema], default: [], validate: rows => rows.length <= MATCH_STATS_LIMITS.players },
}, options)
export const statsTeamSchema = new mongoose.Schema({
  id: { type: String, required: true }, name: { type: String, required: true, maxlength: 100 },
}, options)
export const statsRosterSchema = new mongoose.Schema({
  playerId: { type: String, required: true }, teamId: { type: String, required: true }, nick: { type: String, default: '', maxlength: 100 },
}, options)
const submissionFields = {
  source: { type: String, required: true }, authorId: { type: String, required: true }, at: { type: Date, required: true },
  evidenceUrls: { type: [{ type: String, maxlength: 2000 }], default: [], validate: rows => rows.length <= MATCH_STATS_LIMITS.images },
  data: { type: statsDataSchema, required: true },
}
export const statsSubmissionSchema = new mongoose.Schema(submissionFields, options)
export const statsRevisionSchema = new mongoose.Schema({ ...submissionFields, revision: { type: Number, required: true, min: 1 } }, options)
export const statsConfirmationSchema = new mongoose.Schema({
  source: { type: String, required: true }, data: { type: statsDataSchema, required: true },
  userId: { type: String, required: true }, role: { type: String, enum: ['organizer', 'opponent', 'system', 'arbiter'], required: true },
  at: { type: Date, required: true }, revision: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '', maxlength: 1000 }, conflicts: [{ type: String, maxlength: 200 }],
  reviewed: { type: Boolean, required: true, validate: value => value === true },
}, options)
