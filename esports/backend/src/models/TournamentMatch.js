import mongoose from 'mongoose'

// Check-in / partida en vivo de un torneo jugado por Discord (canal de voz).
// Equivalente a la tabla `matches` de la SQLite local del bot, pero con
// referencias reales a Tournament/Team en vez de nombres sueltos.
const tournamentMatchSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  teamNameSnapshot: { type: String, default: '' },
  rivalName:        { type: String, default: '' },

  // IDs de Discord — opacos para el backend, solo los usa el bot.
  guildId:               { type: String, default: '' },
  channelId:             { type: String, default: '' },
  voiceChannelId:        { type: String, default: '' },
  notificationChannelId: { type: String, default: '' },
  channelName:           { type: String, default: '' },

  status: {
    type: String,
    enum: ['checking_in', 'ready', 'in_progress', 'completed', 'cancelled', 'disqualified'],
    default: 'checking_in',
    index: true,
  },

  requestedBy: { type: String, default: '' },
  requestedAt: { type: Date, default: Date.now },
  checkinWindowMs:   { type: Number, default: 20 * 60 * 1000 },
  checkinDeadlineAt: { type: Date, default: null },
  readyAt:           { type: Date, default: null },

  startedBy: { type: String, default: '' },
  startedAt: { type: Date, default: null },

  completedAt: { type: Date, default: null },
  result:      { type: String, default: null },

  disqualifiedAt:         { type: Date, default: null },
  disqualificationReason: { type: String, default: '' },

  attendance: {
    presentCount:     { type: Number, default: 0 },
    totalCount:        { type: Number, default: 0 },
    presentPlayers:    [{ type: String }],
    missingPlayers:    [{ type: String }],
    unexpectedPlayers: [{ type: String }],
  },

  // Partida del bracket web (Tournament.bracketDoc) que juega este equipo y,
  // en series BO3/BO5, que juego de la serie es. Se resuelve al iniciar o al
  // reportar; antes solo existia rivalName (texto libre) y la web no podia
  // saber a que partida pertenecia un /report.
  bracketMatchId: { type: String, default: '' },
  gameNumber:     { type: Number, default: null, min: 1 },
  // El arbitro ordeno repetir la partida o rechazo este reporte: deja de
  // contar para la serie y para el plazo, pero se conserva como evidencia.
  voidedAt:       { type: Date, default: null },

  report: {
    // evidenceUrl: primera captura, absoluta (el CRM la muestra tal cual).
    // evidence[]: todas, copiadas a /uploads al recibirlas -- las URLs de
    // Discord vencen en ~24 h. sourceUrl es la original de Discord.
    evidenceUrl:      { type: String, default: '' },
    evidenceName:      { type: String, default: '' },
    evidence: {
      type: [{
        _id: false,
        key:       { type: String, default: '' },
        url:       { type: String, default: '' },
        sourceUrl: { type: String, default: '' },
        name:      { type: String, default: '' },
        sha256:    { type: String, default: '' },
        archived:  { type: Boolean, default: false },
      }],
      default: [],
    },
    // Capturas requeridas que faltan (claves de shared/reportScreenshots.mjs).
    missing:          [{ type: String }],
    // Plazo de la partida (bracketMatchId + gameNumber): lo fija el primer
    // /report de cualquiera de los dos equipos. Lo cierra reportDeadline.service.
    deadlineAt:       { type: Date, default: null },
    reminderSentAt:   { type: Date, default: null },
    deadlineClosedAt: { type: Date, default: null },
    reporterDiscordId: { type: String, default: '' },
    reporterUsername:  { type: String, default: '' },
    disputed:          { type: Boolean, default: false },
    disputedAt:        { type: Date, default: null },
    createdAt:         { type: Date, default: null },
  },
}, {
  timestamps: true,
  versionKey: false,
})

tournamentMatchSchema.index({ tournament: 1, status: 1 })
tournamentMatchSchema.index({ team: 1, status: 1 })
tournamentMatchSchema.index({ status: 1, checkinDeadlineAt: 1 })
tournamentMatchSchema.index({ tournament: 1, bracketMatchId: 1 })
tournamentMatchSchema.index({ 'report.deadlineClosedAt': 1, 'report.deadlineAt': 1 })

export const TournamentMatch = mongoose.model('TournamentMatch', tournamentMatchSchema)
