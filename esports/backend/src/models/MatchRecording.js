import mongoose from 'mongoose'

// Grabación de voz de una partida oficial jugada por Discord: la sala de UN
// equipo desde /start-match hasta /report o /cancelar. Una pista .ogg por
// jugador, todas alineadas al inicio de la grabación.
//
// Queda enlazada a todo lo que identifica la partida: torneo, partida del
// bracket (bracketMatchId), número de partida de la serie (gameNumber),
// equipo y el reporte (TournamentMatch). Los archivos viven fuera de
// /uploads, en <dir>/<torneo>/<bracketMatchId>/P<n>-<equipo>-<reporte>/,
// y solo los escucha el árbitro del torneo (services/matchRecordings.service.js).
const trackSchema = new mongoose.Schema({
  discordUserId: { type: String, required: true },
  username:      { type: String, default: '' },
  displayName:   { type: String, default: '' },
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  file:          { type: String, default: '' },   // relativo a la carpeta de la grabación
  bytes:         { type: Number, default: 0 },
  sha256:        { type: String, default: '' },
  durationMs:    { type: Number, default: 0 },
  // Paquetes de voz reales: 0 = el jugador no habló (la pista es solo silencio).
  voicePackets:  { type: Number, default: 0 },
  receivedAt:    { type: Date, default: null },
}, { _id: false })

const matchRecordingSchema = new mongoose.Schema({
  tournamentMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', required: true, unique: true },
  tournament:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  team:            { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamName:        { type: String, default: '' },
  rivalName:       { type: String, default: '' },
  bracketMatchId:  { type: String, default: '' },
  gameNumber:      { type: Number, default: null },
  matchStatus:     { type: String, default: '' },   // completed | cancelled al subirla

  botRecordId:     { type: String, default: '' },
  guildId:         { type: String, default: '' },
  channelId:       { type: String, default: '' },
  channelName:     { type: String, default: '' },
  startedAt:       { type: Date, default: null },
  stoppedAt:       { type: Date, default: null },
  durationMs:      { type: Number, default: 0 },
  format:          { type: String, default: 'ogg-opus' },
  folder:          { type: String, default: '' },   // relativa a config.matchRecordings.dir
  screenShareLog:  { type: [mongoose.Schema.Types.Mixed], default: [] },

  tracks: { type: [trackSchema], default: [] },
  status: { type: String, enum: ['uploading', 'stored', 'deleted'], default: 'uploading', index: true },
  // Se borra sola al vencer, salvo que su partida tenga un caso abierto.
  expiresAt: { type: Date, default: null, index: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false })

matchRecordingSchema.index({ tournament: 1, bracketMatchId: 1, gameNumber: 1 })

export const MatchRecording = mongoose.model('MatchRecording', matchRecordingSchema)
