import mongoose from 'mongoose'
import crypto from 'node:crypto'

const joinRequestSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:   { type: String, default: '' },
  // Postulacion desde el perfil profesional de jugador: vacante elegida (opcional)
  // y copia de la tarjeta (gamerProfile.pro) al momento de postularse.
  vacancyId: { type: String, default: '' },
  card:      { type: mongoose.Schema.Types.Mixed, default: null },
  // Rol con el que se postula (shared/teamRoles.mjs). Staff: `card` es la
  // copia de su perfil de coach/analista en vez de la tarjeta de jugador.
  role:      { type: String, enum: ['player', 'coach', 'analyst', 'manager'], default: 'player' },
  status:    { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true, versionKey: false })

const teamSchema = new mongoose.Schema({
  // Public identity generated atomically per country.
  //   publicCode:   TEAM-001-01
  //   internalCode: TEAM-260622-001-01
  publicCode:   { type: String, required: true, unique: true, uppercase: true, trim: true },
  internalCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

  name:  { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 60 },
  tag:   { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 2, maxlength: 5 },
  color: { type: String, default: '#00E676' },

  // Leadership
  leader:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Cupo de JUGADORES (titulares + suplentes). El staff tiene el suyo:
  // maxStaff (coach, analista, manager; ver shared/teamRoles.mjs).
  maxMembers: { type: Number, default: 10, min: 2, max: 50 },
  maxStaff:   { type: Number, default: 4, min: 0, max: 6 },

  // Join requests
  joinRequests: [joinRequestSchema],
  teamInviteCode: { type: String, unique: true },

  // Stats
  wins:    { type: Number, default: 0, min: 0 },
  losses:  { type: Number, default: 0, min: 0 },
  rankPts: { type: Number, default: 1000, min: 0 },
  // Titulos (podio) de torneos terminados -- los escribe
  // services/tournamentTitles.service.js al quedar el campeon. `current` =
  // campeon vigente de su serie (hasta que termine la siguiente edicion).
  titles: [{
    _id: false,
    tournament:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    publicId:        { type: String, default: '' },
    tournamentTitle: { type: String, default: '' },
    game:            { type: String, default: '' },
    seriesId:        { type: String, default: '' },
    placement:       { type: Number, enum: [1, 2, 3], required: true },
    rankPts:         { type: Number, default: 0 },
    current:         { type: Boolean, default: false },
    date:            { type: Date, default: Date.now },
  }],

  // Modo Retador -- equipos Pro/Elite lo activan para recibir retos de
  // equipos amateur (ver challenger.controller.js). Debe cumplir N tickets
  // mensuales para mantener los beneficios.
  challengerMode: {
    active:                 { type: Boolean, default: false },
    activatedAt:            { type: Date, default: null },
    currentMonthTickets:    { type: Number, default: 0, min: 0 },
    requiredMonthlyTickets: { type: Number, default: 7 },
    lastResetDate:          { type: Date, default: null },
    streak:                 { type: Number, default: 0 },
    totalTicketsCompleted:  { type: Number, default: 0 },
    benefits: {
      priorityListing: { type: Boolean, default: false },
      badgeActive:      { type: Boolean, default: false },
      publicitySlots:   { type: Number, default: 0 },
    },
    history: [{
      month:            { type: String },
      ticketsCompleted: { type: Number },
      ticketsRequired:  { type: Number },
      passed:           { type: Boolean },
    }],
  },

  // Media
  logo: { type: String, default: '' },
  banner: { type: String, default: '' },

  // Profile
  game:        { type: String, default: '', trim: true },
  tiers:       [{ type: String, trim: true }],
  region:      { type: String, default: '', trim: true },
  country:     { type: String, default: '', trim: true },
  slogan:      { type: String, default: '', maxlength: 120, trim: true },
  sponsor:     { type: String, default: '', trim: true },
  brand:       { type: String, default: '', trim: true },
  contactEmail:{ type: String, default: '', trim: true, lowercase: true },
  community:   { type: String, default: '', trim: true },
  level:       { type: String, default: '', trim: true },
  category:    { type: String, default: '', trim: true },
  lang:        { type: String, default: '', trim: true },
  gender:      { type: String, default: '', trim: true },
  // Quién puede unirse además de las reglas de género/universidad
  // (shared/teamEligibility.mjs): todos, solo del país o solo de la región.
  joinScope:   { type: String, enum: ['open', 'country', 'region'], default: 'open' },
  description: { type: String, default: '', maxlength: 500 },
  // Estado administrativo (/admin/equipos). 'Eliminado' bloquea inscribirse a
  // torneos nuevos (ver tournament.controller.js) sin borrar historial.
  status:      { type: String, enum: ['Activo', 'Eliminado'], default: 'Activo' },
  partnerBadge: {
    active:     { type: Boolean, default: false },
    label:      { type: String, default: 'GlitchGang Partner', trim: true, maxlength: 80 },
    status:     { type: String, enum: ['none', 'pending', 'verified', 'revoked'], default: 'none' },
    reason:     { type: String, default: '', trim: true, maxlength: 260 },
    verifiedAt: { type: Date, default: null },
    revokedAt:  { type: Date, default: null },
    updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  mainCharacters: [{ type: String, trim: true }],
  sponsors: [{
    name:        { type: String, default: '', trim: true },
    tier:        { type: String, default: '', trim: true },
    logo:        { type: String, default: '', trim: true },
    website:     { type: String, default: '', trim: true },
    since:       { type: String, default: '', trim: true },
    location:    { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true, maxlength: 260 },
    contact:     { type: String, default: '', trim: true },
    socials: {
      instagram: { type: String, default: '', trim: true },
      twitter:   { type: String, default: '', trim: true },
      x:         { type: String, default: '', trim: true },
      discord:   { type: String, default: '', trim: true },
      tiktok:    { type: String, default: '', trim: true },
      youtube:   { type: String, default: '', trim: true },
      linkedin:  { type: String, default: '', trim: true },
    },
  }],
  socials: {
    instagram: { type: String, default: '', trim: true },
    twitter:   { type: String, default: '', trim: true },
    tiktok:    { type: String, default: '', trim: true },
    twitch:    { type: String, default: '', trim: true },
    youtube:   { type: String, default: '', trim: true },
    discord:   { type: String, default: '', trim: true },
    website:   { type: String, default: '', trim: true },
  },

  // Privacy
  publicProfile:          { type: Boolean, default: true },
  acceptRequests:         { type: Boolean, default: true },

  // Reclutamiento (boton "Reclutar" del panel de equipo): que busca el equipo.
  recruitment: {
    open: { type: Boolean, default: false },
    vacancies: [{
      game:        { type: String, default: '', trim: true, maxlength: 60 },
      roles:       [{ type: String, trim: true, maxlength: 40 }],
      rankMin:     { type: String, default: '', trim: true, maxlength: 40 },
      rankMax:     { type: String, default: '', trim: true, maxlength: 40 },
      level:       { type: String, default: '', trim: true, maxlength: 30 },
      femaleOnly:  { type: Boolean, default: false },
      schedule:    { type: String, default: '', trim: true, maxlength: 400 },
      languages:   { type: String, default: '', trim: true, maxlength: 200 },
      description: { type: String, default: '', trim: true, maxlength: 300 },
      createdAt:   { type: Date, default: Date.now },
    }],
  },
  showRoster:             { type: Boolean, default: true },
  showStaff:              { type: Boolean, default: true },
  showSponsors:           { type: Boolean, default: true },
  showTournaments:        { type: Boolean, default: true },
  showSocials:            { type: Boolean, default: true },
  showContactEmail:       { type: Boolean, default: false },
  showCompetitiveSummary: { type: Boolean, default: true },
  hideEmails:             { type: Boolean, default: true },
  hideGameId:             { type: Boolean, default: false },

  // University team info (optional — only set for university teams)
  university: {
    isUniversityTeam: { type: Boolean, default: false },
    universityId:     { type: String, default: '' },
    universityTag:    { type: String, default: '' },
    universityName:   { type: String, default: '' },
    region:           { type: String, default: '' },
    // gameKeyOf(team.game) al momento de ocupar el cupo oficial. Con el
    // indice unico de abajo, una universidad tiene UN equipo oficial por juego
    // (estandar de las ligas universitarias: NACE Varsity, Riot College).
    gameKey:          { type: String, default: '' },
  },

  // Roster configuration (flexible per game)
  rosterSlots: { type: mongoose.Schema.Types.Mixed },

  // discordProvision se movio a Tournament.registrations[].discordProvision
  // (2026-09-22): un equipo puede estar inscrito en varios torneos activos
  // a la vez, cada uno con su propia sala -- guardarlo aca (uno solo por
  // equipo) hacia que solo el primer torneo tuviera sala real y los demas
  // se confundieran entre si. Ver scripts/migrate-team-discord-to-registrations.js
  // para la migracion de datos existentes.
}, {
  timestamps: true,
  versionKey: false,
})

teamSchema.pre('save', function (next) {
  if (!this.teamInviteCode) {
    this.teamInviteCode = crypto.randomBytes(4).toString('hex').toUpperCase()
  }
  next()
})

// teamInviteCode already indexed via unique:true in schema
teamSchema.index({ leader: 1 })
teamSchema.index({ members: 1 })
teamSchema.index({ rankPts: -1 })
// Cupo oficial universitario: lo garantiza Mongo, no solo un findOne previo
// (dos creaciones simultaneas pasaban las dos el chequeo).
teamSchema.index(
  { 'university.universityId': 1, 'university.gameKey': 1 },
  { unique: true, partialFilterExpression: { 'university.isUniversityTeam': true }, name: 'university_official_slot' },
)

export const Team = mongoose.model('Team', teamSchema)
