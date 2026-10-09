import mongoose from 'mongoose'

// Reporte de resultado que manda el capitán de UN lado de una partida del
// bracket web (Tournament.bracketDoc). Vive en su propia colección y no dentro
// de bracketDoc.results: el panel del organizador reenvía `results` entero en
// cada guardado y borraría cualquier reporte que no tenga en su pantalla.
// El marcador se guarda ya orientado al bracket (scoreA = equipo de arriba),
// así comparar los dos lados es comparar los mismos campos.
const matchResultReportSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  matchId:    { type: String, required: true, trim: true, maxlength: 40 },
  side:       { type: String, enum: ['A', 'B'], required: true },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  a:          { type: String, required: true, trim: true, maxlength: 120 },
  b:          { type: String, required: true, trim: true, maxlength: 120 },
  scoreA:     { type: Number, required: true, min: 0, max: 99 },
  scoreB:     { type: Number, required: true, min: 0, max: 99 },
  evidenceUrl: { type: String, required: true, trim: true, maxlength: 300 },
  note:       { type: String, default: '', trim: true, maxlength: 500 },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedNick: { type: String, default: '', trim: true, maxlength: 80 },
}, {
  timestamps: true,
  versionKey: false,
})

matchResultReportSchema.index({ tournament: 1, matchId: 1, side: 1 }, { unique: true })

export const MatchResultReport = mongoose.model('MatchResultReport', matchResultReportSchema)
