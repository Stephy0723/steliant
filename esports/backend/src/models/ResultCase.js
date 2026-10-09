import mongoose from 'mongoose'

// Resultado de UNA partida de una serie (bracketMatchId + gameNumber),
// armado con los /report de los dos equipos (spec-lector-resultados, 4).
// Es la unidad que valida la IA, que ve el árbitro y que lista "Resultados
// por revisar". Las estadísticas siguen en MatchStatsDraft/PlayerMatch;
// aquí solo queda el enlace (statsDraft).
//
// Estados: analyzing ⏳, validated 🟢, pending_review ⚪, arbitration 🟠,
// rejected 🔴. Nada avanza el bracket salvo validated (IA o árbitro).
export const RESULT_STATES = ['analyzing', 'validated', 'pending_review', 'arbitration', 'rejected']

const reportSchema = new mongoose.Schema({
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  reportId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', required: true },
  declared:   { type: String, enum: ['win', 'lose', 'draw', ''], default: '' },
  evidence:   [{ _id: false, key: String, url: String, sha256: String }],
  missing:    [{ type: String }],
  reportedAt: { type: Date, default: null },
}, { _id: false })

const readSchema = new mongoose.Schema({
  team:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', required: true },
  status:   { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  attempts: { type: Number, default: 0 },
  error:    { type: String, default: '', maxlength: 300 },
  model:    { type: String, default: '' },
  // Lectura cruda de Gemini (A = equipo que reportó) y la misma ya cruzada
  // con el roster congelado y orientada al bracket (winnerTeamId, playerId).
  raw:      { type: mongoose.Schema.Types.Mixed, default: null },
  data:     { type: mongoose.Schema.Types.Mixed, default: null },
  confidence:       { type: Number, default: null },
  winnerConfidence: { type: Number, default: null },
  flags:    [{ type: String }],
  queuedAt: { type: Date, default: Date.now },
  readAt:   { type: Date, default: null },
}, { _id: false })

const auditSchema = new mongoose.Schema({
  at:        { type: Date, default: Date.now },
  actor:     { type: String, default: 'system' },
  actorName: { type: String, default: 'Sistema' },
  action:    { type: String, required: true },
  detail:    { type: String, default: '', maxlength: 1000 },
}, { _id: false })

const resultCaseSchema = new mongoose.Schema({
  tournament:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  bracketMatchId: { type: String, required: true },
  gameNumber:     { type: Number, required: true, min: 1 },
  series:         { type: String, default: 'BO1' },
  teams: [{ _id: false, id: String, name: String }],   // [A, B] como en el bracket
  state:   { type: String, enum: RESULT_STATES, default: 'analyzing', index: true },
  reasons: [{ type: String }],
  reports: { type: [reportSchema], default: [] },
  reads:   { type: [readSchema], default: [] },
  deadlineAt:     { type: Date, default: null },
  deadlineClosed: { type: Boolean, default: false },

  // Decisión final de esta partida.
  winnerTeamId: { type: String, default: '' },
  source:       { type: String, enum: ['', 'ai-validated', 'declarations', 'arbiter'], default: '' },
  decidedBy:    { type: String, default: '' },
  decidedAt:    { type: Date, default: null },
  statsDraft:   { type: mongoose.Schema.Types.ObjectId, ref: 'MatchStatsDraft', default: null },

  // Arbitraje (fase 5): quién lo tiene, decisión y apelación.
  case: {
    assignedTo:     { type: String, default: '' },
    assignedName:   { type: String, default: '' },
    assignedAt:     { type: Date, default: null },
    openedAt:       { type: Date, default: null },
    decision:       { type: String, default: '' },
    reason:         { type: String, default: '', maxlength: 1000 },
    firstArbiter:   { type: String, default: '' },
    appealedBy:     { type: String, default: '' },
    appealTeam:     { type: String, default: '' },
    appealedAt:     { type: Date, default: null },
    appealReason:   { type: String, default: '', maxlength: 1000 },
    escalatedAt:    { type: Date, default: null },
    escalations:    { type: Number, default: 0 },
    requestedTeam:  { type: String, default: '' },
    requestDeadline:{ type: Date, default: null },
  },
  // Intentos anteriores de esta partida (repetida o reporte rechazado): se
  // guardan tal cual para la auditoría y el caso vuelve a empezar.
  history: { type: [mongoose.Schema.Types.Mixed], default: [] },
  audit: { type: [auditSchema], default: [] },
}, { timestamps: true, versionKey: 'version' })

resultCaseSchema.index({ tournament: 1, bracketMatchId: 1, gameNumber: 1 }, { unique: true })
resultCaseSchema.index({ 'reads.status': 1, 'reads.queuedAt': 1 })
resultCaseSchema.index({ tournament: 1, state: 1, updatedAt: 1 })

export const ResultCase = mongoose.model('ResultCase', resultCaseSchema)
