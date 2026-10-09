import mongoose from 'mongoose'

// Plan de trabajo del coach para uno de sus equipos (/coach/sesiones). Antes
// vivia solo en localStorage. Flujo: draft -> sent (avisa al capitan) ->
// seen (el capitan lo abrio) -> approved; archived lo saca de la lista.
// `notes` son notas internas del coach: el equipo nunca las ve.
const text = (max) => ({ type: String, default: '', trim: true, maxlength: max })

const coachWorkPlanSchema = new mongoose.Schema({
  coach:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamName:    text(120),
  game:        text(80),
  roster:      text(400),
  tournament:  text(160),
  nextMatch:   text(160),
  opponent:    text(160),
  weekGoal:    text(2000),
  studyPlan:   text(4000),
  sessionPlan: text(4000),
  homework:    text(2000),
  notes:       text(2000),
  status:      { type: String, enum: ['draft', 'sent', 'seen', 'approved', 'archived'], default: 'draft' },
  sentAt:      { type: Date, default: null },
  seenAt:      { type: Date, default: null },
  approvedAt:  { type: Date, default: null },
}, { timestamps: true, versionKey: false })

coachWorkPlanSchema.index({ coach: 1, updatedAt: -1 })
coachWorkPlanSchema.index({ team: 1, status: 1, sentAt: -1 })

export const CoachWorkPlan = mongoose.model('CoachWorkPlan', coachWorkPlanSchema)
