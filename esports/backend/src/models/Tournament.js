import mongoose from 'mongoose'
import { User } from './User.js'
import { createTournamentCodes, sanitizeGameCode } from '../services/codes.service.js'

const registrationSchema = new mongoose.Schema({
  // Toda inscripcion (incluidas modalidades 1v1/individuales) usa team --
  // un torneo solo requiere un equipo de 1 titular, mismo camino que el
  // resto. `user` queda solo por inscripciones historicas hechas antes de
  // este cambio (20/sep), cuando lo individual se guardaba sin equipo.
  team:         { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:       { type: String, enum: ['registered', 'checked_in', 'disqualified', 'withdrawn'], default: 'registered' },
  // Por que la inscripcion cambio de estado sola (ej. 'no_checkin' del cierre automatico).
  statusReason: { type: String, default: '' },
  registeredAt: { type: Date, default: Date.now },
  dataConsent: {
    type: new mongoose.Schema({
      acceptedAt: { type: Date, required: true },
      acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    }, { _id: false }),
    default: undefined,
  },
  // Snapshot of team university info at registration time (used for standings)
  teamMeta: {
    // Nombre/tag al inscribirse: si el equipo se disuelve o renombra, el
    // historial del torneo (y mapRegistration) sigue mostrando quien jugo.
    name: { type: String, default: '' },
    tag:  { type: String, default: '' },
    university: {
      universityId:   { type: String, default: '' },
      universityTag:  { type: String, default: '' },
      universityName: { type: String, default: '' },
      region:         { type: String, default: '' },
    },
  },
  // Quien juega de verdad este torneo, congelado en el primer check-in
  // (ver rosterLock.service.js). Sirve para disputas y para las stats.
  rosterSnapshot: {
    type: [{
      _id: false,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      nick:   { type: String, default: '' },
      gameId: { type: String, default: '' },
      slot:   { type: String, default: '' },
    }],
    default: undefined,
  },
  rosterSnapshotAt: { type: Date, default: null },
  // Sala Discord de ESTE equipo en ESTE torneo -- un equipo puede estar
  // inscrito en varios torneos activos a la vez, cada uno con su propia
  // categoria/canales, asi que este estado no puede vivir en el equipo
  // (Team.discordProvision, ya removido) o solo la primera inscripcion se
  // provisiona y las demas se confunden con esa.
  discordProvision: {
    status:                 { type: String, enum: ['none', 'pending', 'processing', 'ready', 'partial', 'failed'], default: 'none' },
    roleId:                 { type: String, default: '', trim: true },
    categoryId:             { type: String, default: '', trim: true },
    textChannelId:          { type: String, default: '', trim: true },
    bracketChannelId:       { type: String, default: '', trim: true },
    voiceChannelId:         { type: String, default: '', trim: true },
    welcomeSent:            { type: Boolean, default: false },
    syncedPlayerDiscordIds: [{ type: String, trim: true }],
    missingDiscordUsers:    [{ type: String, trim: true }],
    lastSyncAt:             { type: Date, default: null },
    error:                  { type: String, default: '', trim: true, maxlength: 2000 },
  },
}, { _id: true, versionKey: false })

const tournamentSchema = new mongoose.Schema({
  // Corto público + extenso privado, ambos derivados del organizador padre.
  publicId:       { type: String, required: true, unique: true, uppercase: true, trim: true, immutable: true },
  tournamentCode:{ type: String, required: true, unique: true, uppercase: true, trim: true, immutable: true },
  legacyPublicId: { type: String, default: '', uppercase: true, trim: true },
  gameCode:       { type: String, required: true, uppercase: true, trim: true, maxlength: 4, immutable: true },
  organizerCode:  { type: String, required: true, uppercase: true, trim: true, immutable: true },
  countryCode:    { type: String, required: true, uppercase: true, trim: true, immutable: true },
  title:          { type: String, required: true, trim: true, maxlength: 120 },
  game:           { type: String, required: true, trim: true },
  gameId:         { type: String, default: '', trim: true },
  description:    { type: String, default: '', maxlength: 2000 },
  logo:           { type: String, default: '', trim: true },
  banner:         { type: String, default: '' },
  primaryColor:   { type: String, default: '', trim: true },
  organizerBrandName: { type: String, default: '', trim: true },
  organizationContact: { type: String, default: '', trim: true, maxlength: 160 },
  organizationAddress: { type: String, default: '', trim: true, maxlength: 500 },
  setupVersion: { type: Number },
  creationKey: { type: String, maxlength: 80 },
  categoryId: { type: String, default: '' },
  seasonName: { type: String, default: '', maxlength: 120 },
  seasonNumber: { type: Number, min: 1, default: 1 },
  // Cadena de ediciones de un mismo torneo ("temporada 2, serie 2"). La primera
  // edicion lo genera; nextSeason() lo copia y sube seasonNumber. Ver
  // scripts/backfill-tournament-identity.js.
  seriesId: { type: String, default: '', trim: true },
  sourceTournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },

  // Estructura competitiva (Etapa 2). El motor que la ejecuta llega despues;
  // aca solo se guarda la configuracion capturada por el asistente.
  competition: {
    system:         { type: String, enum: ['single_elim', 'double_elim', 'round_robin', 'swiss', 'groups_playoffs'], default: 'single_elim' },
    configVersion:  { type: Number, default: 2 },
    defaultSeries:  { type: String, enum: ['BO1', 'BO3', 'BO5', 'BO7'], default: 'BO1' },
    thirdPlace:     { type: Boolean, default: false },
    grandFinalReset:{ type: Boolean, default: true },
    legs:           { type: Number, enum: [1, 2], default: 1 },
    swissRounds:    { type: Number, default: 5 },
    groups:         { type: Number, default: 1 },
    groupsPhaseSystem: { type: String, enum: ['round_robin', 'swiss'], default: 'round_robin' },
    advancePerGroup:   { type: Number, default: 2 },
    playoffsSystem:    { type: String, enum: ['single_elim', 'double_elim'], default: 'single_elim' },
    scoring: {
      model:       { type: String, enum: ['wins', 'match_points', 'placement', 'time'], default: 'wins' },
      win:         { type: Number, default: 3 },
      draw:        { type: Number, default: 1 },
      loss:        { type: Number, default: 0 },
      allowDraw:   { type: Boolean, default: true },
      tiebreakers: [{ type: String }],
    },
    seriesByRound: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    // Si solo un equipo reporta y vence el plazo del otro (spec-lector-resultados 4.2):
    // 'arbiter' = queda por confirmar con un clic (opción B, por defecto);
    // 'auto_win' = gana quien reportó si su captura se lee bien (opción A).
    singleReportRule: { type: String, enum: ['arbiter', 'auto_win'], default: 'arbiter' },
  },
  endDate: { type: Date },
  participationScope: { type: String, enum: ['global', 'regional'], default: 'global' },
  minorsAllowed: { type: Boolean, default: false },
  mediaChannels: { type: String, default: '', maxlength: 1500 },
  mediaRetentionMonths: { type: Number, min: 1, max: 120, default: 12 },
  rulesDocument: { type: String, default: '' },
  rulesName: { type: String, default: '' },
  bannerName: { type: String, default: '' },
  mapMode: { type: String, enum: ['fixed', 'random', 'veto'], default: 'fixed' },
  sponsors: [{
    name: { type: String, required: true, maxlength: 120 },
    link: { type: String, default: '', maxlength: 1000 },
    tier: { type: String, default: 'Colaborador', maxlength: 80 },
    url: { type: String, default: '', maxlength: 1000 },
    logo: { type: String, default: '', maxlength: 1000 },
    contribution: { type: String, default: '', maxlength: 500 },
  }],
  // Staff del torneo: perfiles reales de GlitchGang con rol aprobado. `user`
  // enlaza la cuenta (se notifica al publicar); el resto es snapshot para
  // mostrar sin populate. `name` = nick, se conserva por compatibilidad.
  staffMembers: [{
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name:         { type: String, required: true, maxlength: 120 },
    nick:         { type: String, default: '', maxlength: 120 },
    avatar:       { type: String, default: '' },
    playerCode:   { type: String, default: '' },
    platformRole: { type: String, default: '' },
    role: { type: String, enum: ['Director', 'Administrador', 'Arbitro', 'Moderador', 'Caster', 'Produccion', 'Coach', 'Analista'], required: true },
    // 'pending' = el organizador invito, falta que la persona acepte/rechace
    // (respondStaffInvitation). 'requested' = la persona se postulo por su
    // cuenta (applyForStaff), falta que el organizador la acepte/rechace
    // (updateStaffMember). Distinguirlos evita que el organizador "acepte"
    // una invitacion que el mismo mando, o que la persona "acepte" su propia
    // postulacion -- cada direccion la resuelve quien no la inicio.
    status:      { type: String, enum: ['pending', 'requested', 'accepted', 'declined'], default: 'pending' },
    // Snapshot del perfil profesional al postularse (applyForStaff).
    applicationCard: { type: mongoose.Schema.Types.Mixed, default: null },
    invitedAt:   { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    // Mensaje opcional de quien responde la invitacion (aceptar/rechazar).
    responseReason: { type: String, default: '', trim: true, maxlength: 600 },
    // Override por persona de la matriz de default por rol (frontend/src/lib/staffPermissions.js).
    // Solo se guardan las pestanas customizadas; el resto usa el default del rol.
    permissions: { type: Map, of: String, default: () => new Map() },
  }],

  // Schedule
  date:     { type: Date, required: true },
  timezone: { type: String, default: 'UTC' },
  registrationWindow: {
    start: { type: Date, required: true },
    end:   { type: Date, required: true },
  },

  // Format
  format:   { type: String, enum: ['single_elimination', 'double_elimination', 'round_robin', 'swiss', 'custom'], default: 'single_elimination' },
  modality: { type: String, default: '5v5', trim: true },
  platform: { type: String, enum: ['pc', 'mobile', 'console', 'cross'], default: 'pc' },
  region:   { type: String, default: '', trim: true },

  // Capacity
  maxSlots:     { type: Number, required: true, min: 2 },
  currentSlots: { type: Number, default: 0, min: 0 },

  // Prize
  prizePool:  { type: Number, default: 0, min: 0 },
  currency:   { type: String, default: 'USD' },
  entryFee:   { type: Number, default: 0, min: 0 },

  // Eligibility
  minAge:           { type: Number, default: 0 },
  allowedCountries: [{ type: String }],
  eligibility: {
    universityOnly: { type: Boolean, default: false },
  },
  notes: { type: String, default: '' },

  // Organizer
  organizer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Status
  status: {
    type: String,
    enum: ['draft', 'open', 'registration_closed', 'ongoing', 'finished', 'cancelled'],
    default: 'draft',
  },

  visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },

  // Campeon al cerrar el bracket (saveBracket). Sin este campo Mongoose
  // (strict) descartaba `tournament.winner = ...` y el frontend
  // (tournamentAdapter/tournamentExport/sheetDoc) siempre lo leia vacio.
  winner: { type: String, default: '', trim: true },

  // Publicacion programada: un torneo en 'draft' con esta fecha se publica
  // solo (status -> open, visibility -> public) cuando llega el momento --
  // ver services/scheduledPublish.service.js. Pensado para organizadores
  // con torneos semanales recurrentes que arman la plantilla con anticipacion.
  scheduledPublishAt: { type: Date, default: null },

  // Inscripcion tardia: apagada por defecto. Encendida por el organizador
  // (Gestionar torneo -> Resumen), deja inscribirse aunque ya paso el cierre
  // de inscripciones o el inicio, mientras el torneo siga 'open', haya cupo
  // y el bracket no este publicado.
  lateRegistration: { type: Boolean, default: false },

  // Discord bot
  discordEnabled: { type: Boolean, default: false },
  discordProvision: {
    guildId:         { type: String, default: '', trim: true },
    status:          { type: String, enum: ['none', 'pending', 'processing', 'ready', 'failed'], default: 'none' },
    provisionedAt:   { type: Date, default: null },
    lastSyncAt:      { type: Date, default: null },
    error:           { type: String, default: '', trim: true, maxlength: 2000 },
    categoryId:      { type: String, default: '', trim: true },
    organizerRoleId: { type: String, default: '', trim: true },
    staffRoleId:     { type: String, default: '', trim: true },
    playerRoleId:    { type: String, default: '', trim: true },
    // Staff de los equipos (coach, analista, manager): rol aparte del de
    // jugador y del staff del organizador (staffRoleId).
    teamStaffRoleId: { type: String, default: '', trim: true },
    channels: {
      newsId:       { type: String, default: '', trim: true },
      rulesId:      { type: String, default: '', trim: true },
      bracketId:    { type: String, default: '', trim: true },
      checkinId:    { type: String, default: '', trim: true },
      resultsId:    { type: String, default: '', trim: true },
      supportId:    { type: String, default: '', trim: true },
      staffId:      { type: String, default: '', trim: true },
      lobbyVoiceId: { type: String, default: '', trim: true },
    },
  },
  // El organizador autoriza al bot a crear/administrar canales y roles de
  // este torneo en el servidor de GlitchGang.
  discordConsent: {
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  whatsappEnabled:{ type: Boolean, default: false },
  botConfig: {
    active:        { type: Boolean, default: false },
    knowledgeBase: { type: String, default: '' },
  },
  // A que cliente (servidor de Discord) pertenece este torneo. No es
  // obligatorio a nivel de esquema para no romper torneos existentes
  // creados antes de que existiera este concepto — ver
  // scripts/backfill-tournament-organization.js. Un torneo sin
  // organizacion simplemente no aparece por ningun bot de Discord.
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },

  // Registrations
  registrations: [registrationSchema],

  // Form Fields & Metadata
  server:          { type: String, default: '' },
  series:          { type: String, default: '' },
  patch:           { type: String, default: '' },
  mapPool:         { type: String, default: '' },
  checkinDeadline: { type: Date },
  // Cuando el job de checkinClose.service.js ya proceso este torneo (una sola vez).
  checkinClosedAt: { type: Date, default: null },
  checkinConfig: {
    prematchMins:  { type: Number, default: 30, min: 5, max: 180 },
    toleranceMins: { type: Number, default: 10, min: 0, max: 60 },
    autoWalkover:  { type: Boolean, default: true },
    botReminders:  { type: Boolean, default: true },
    dmCaptains:    { type: Boolean, default: true },
  },
  // Ritmo de partidas (panel del organizador -> Check-in -> "3 - Ritmo de
  // partidas"). Sin default a proposito: si el organizador nunca lo guardo,
  // no se mandan avisos de partida (ver matchReminders.service.js).
  matchSchedule: {
    type: new mongoose.Schema({
      durationMins: { type: Number, default: 30, min: 5, max: 240 },
      breakMins:    { type: Number, default: 15, min: 0, max: 120 },
      reminderMins: { type: Number, default: 15, min: 5, max: 120 },
    }, { _id: false }),
    default: undefined,
  },
  overcup: {
    enabled:               { type: Boolean, default: false },
    locked:                { type: Boolean, default: false },
    secondCheckinHours:    { type: Number, default: 6 },
    secondCheckinDeadline: { type: Date },
  },
  prizeType:        { type: String, default: 'Sin premio' },
  prizeFundingStatus: { type: String, enum: ['pending', 'funded', 'sponsored', 'escrow'], default: 'pending' },
  prizeSponsor:     { type: String, default: '', trim: true },
  prizeProofUrl:    { type: String, default: '', trim: true },
  prizeDelivery:    { type: String, enum: ['live', 'event', 'transfer'], default: 'transfer' },
  prizePayoutDeadline: { type: String, default: '', trim: true },
  prizeNotes:       { type: String, default: '', maxlength: 2000 },
  prizes: [{
    kind:           { type: String, enum: ['placement', 'award'], default: 'placement' },
    place:          { type: String },
    amount:         { type: Number, default: 0, min: 0 },
    currency:       { type: String, default: 'USD', trim: true, uppercase: true },
    items:          { type: String, default: '' },
    payoutMethod:   { type: String, default: 'transfer' },
    status:         { type: String, default: 'pending' },
    conditions:     { type: String, default: '' },
    proofImage:     { type: String, default: '' },
    signatureImage: { type: String, default: '' },
  }],
  contactEmail:     { type: String, default: '' },
  contactPhone:     { type: String, default: '' },
  contactDiscord:   { type: String, default: '' },
  streamUrl:        { type: String, default: '' },
  streamLang:       { type: String, default: '' },
  jurisdiction:     { type: String, default: '' },
  law:              { type: String, default: '' },
  complaintsChannel:{ type: String, default: '' },

  // Campos de Stephanie sin colisión de nombre -- aditivos, ningún controller
  // real los escribe todavía pero se conservan para no perder trabajo.
  server: { type: String, default: '' },
  checkinDeadline: { type: Date },
  contactEmail:      { type: String, default: '' },
  contactPhone:      { type: String, default: '' },
  contactDiscord:    { type: String, default: '' },
  streamUrl:         { type: String, default: '' },
  streamLang:        { type: String, default: '' },
  jurisdiction:      { type: String, default: '' },
  law:               { type: String, default: '' },
  complaintsChannel: { type: String, default: '' },
  participants: [{
    name:       { type: String },
    tag:        { type: String },
    id:         { type: String },
    seed:       { type: Number },
    record:     { type: String },
    placement:  { type: String },
    eliminated: { type: Boolean, default: false },
  }],
  checkin: {
    aTiempo: { type: Number, default: 0 },
    tarde:   { type: Number, default: 0 },
    noShow:  { type: Number, default: 0 },
  },
  staff: {
    director: { type: String, default: '' },
    admin:    { type: String, default: '' },
    arbitros: [{ type: String }],
    casters: [{
      user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      nick:          { type: String, default: '' },
      avatar:        { type: String, default: '' },
      assignedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      assignedAt:    { type: Date, default: Date.now },
      removedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      removedAt:     { type: Date, default: null },
      removedReason: { type: String, default: '' },
    }],
  },
  collaborators: [{ type: String }],
  evidences:     [{ type: String }],
  rules:         { type: String, default: '' },

  // Bracket persistido (antes se perdia: el controller lo asignaba a campos
  // que no existian en este schema y bracketStore.js del frontend lo
  // guardaba solo en memoria de proceso). Nombrado bracketDoc para no chocar
  // con el codigo viejo que escribe `bracket` directamente.
  // Comunicados de cambios confirmados (pestana Competencia y las que reusen
  // changeNotice). Se guardan los ultimos 50; GET /tournaments/:id los devuelve
  // para pintar "Comunicados del torneo" en el panel del equipo.
  announcements: [{
    _id: false,
    at:           { type: Date, default: Date.now },
    by:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byNick:       { type: String, default: '', trim: true },
    section:      { type: String, default: '', trim: true, maxlength: 40 },
    sectionLabel: { type: String, default: '', trim: true, maxlength: 60 },
    title:        { type: String, default: '', trim: true, maxlength: 140 },
    message:      { type: String, default: '', trim: true, maxlength: 500 },
    changes: [{
      _id: false,
      label:  { type: String, default: '', trim: true, maxlength: 140 },
      before: { type: String, default: '', trim: true, maxlength: 140 },
      after:  { type: String, default: '', trim: true, maxlength: 140 },
    }],
  }],

  bracketDoc: {
    published: { type: Boolean, default: false },
    status:    { type: String, enum: ['idle', 'running', 'finished'], default: 'idle' },
    format:    { type: String, default: '' },
    teams:     [{ type: String }],
    seedOrder: [{ type: String }],
    results:   { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    champion:  { type: String, default: '' },
    // matchId -> fecha en que se aviso "tu partida empieza pronto" (una vez).
    remindersSent: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    // matchId -> que efectos ya se aplicaron (avisos, stats, W/L). Sin default:
    // undefined = torneo anterior a este registro (ver onResultsConfirmed).
    processedResults: { type: mongoose.Schema.Types.Mixed, default: undefined },
    podiumNotifiedAt: { type: Date, default: null },
    // Podio con el que se otorgaron los titulos (ver tournamentTitles.service.js).
    titlesKey: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },

  reports: [{
    type:       { type: String, required: true },
    team:       { type: String, default: '' },
    severity:   { type: String, enum: ['baja', 'media', 'alta', 'urgente'], default: 'media' },
    detail:     { type: String, default: '', maxlength: 4000 },
    evidence:   [{ type: String }],
    status:     { type: String, enum: ['open', 'in_review', 'resolved'], default: 'open' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ticketId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    createdAt:  { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolution: { type: String, default: '' },
  }],
}, {
  timestamps: true,
  versionKey: false,
})

async function ensureTournamentIdentity() {
  if (this.publicId && this.tournamentCode) return
  if (!this.organizer) throw Object.assign(new Error('Tournament organizer is required'), { status: 400 })

  const organizer = await User.findById(this.organizer)
    .select('countryCode roleProfiles.organizer.organizerCode')
    .lean()
  const organizerCode = organizer?.roleProfiles?.organizer?.organizerCode
  if (!organizerCode) {
    throw Object.assign(new Error('The tournament creator must have an approved organizerCode'), { status: 403 })
  }

  if (!this.createdAt) this.createdAt = new Date()
  const identity = await createTournamentCodes({
    countryCode: organizer.countryCode,
    gameCode: this.gameCode || this.game,
    organizerCode,
    organizerId: this.organizer,
    createdAt: this.createdAt,
  })

  this.publicId = identity.publicId
  this.tournamentCode = identity.tournamentCode
  this.gameCode = identity.gameCode
  this.organizerCode = organizerCode
  this.countryCode = identity.countryCode
}

// Required validation runs before save middleware, so identity must be prepared
// during validation. The pre-save guard below enforces the invariant as well.
tournamentSchema.pre('validate', ensureTournamentIdentity)
tournamentSchema.pre('save', function () {
  if (!this.publicId || !this.tournamentCode || !this.organizerCode) {
    throw Object.assign(new Error('Tournament identity is incomplete'), { status: 500 })
  }
  this.gameCode = sanitizeGameCode(this.gameCode || this.game)
})

tournamentSchema.index({ status: 1, date: 1 })
tournamentSchema.index({ seriesId: 1, status: 1, date: 1 })
tournamentSchema.index({ game: 1 })
tournamentSchema.index({ organizer: 1 })
tournamentSchema.index({ organizer: 1, creationKey: 1 }, { unique: true, partialFilterExpression: { creationKey: { $type: 'string' } } })
tournamentSchema.index({ organization: 1, discordEnabled: 1, status: 1 })
tournamentSchema.index({ organization: 1, whatsappEnabled: 1, status: 1 })

export const Tournament = mongoose.model('Tournament', tournamentSchema)
