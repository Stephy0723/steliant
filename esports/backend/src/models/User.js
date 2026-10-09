import mongoose from 'mongoose'

function specializedProfileSchema(publicField, internalField) {
  return new mongoose.Schema({
    [publicField]:   { type: String, uppercase: true, trim: true, immutable: true },
    [internalField]: { type: String, uppercase: true, trim: true, immutable: true },
    approvedAt:      { type: Date, default: null, immutable: true },
    applicationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'RoleApplication', default: null, immutable: true },
    details:         { type: mongoose.Schema.Types.Mixed, default: {} },
  }, { _id: false, versionKey: false })
}

const organizerProfileSchema = specializedProfileSchema('organizerCode', 'organizerInternalCode')
const creatorProfileSchema   = specializedProfileSchema('creatorCode',   'creatorInternalCode')
const coachProfileSchema     = specializedProfileSchema('coachCode',     'coachInternalCode')
const casterProfileSchema    = specializedProfileSchema('casterCode',    'casterInternalCode')
const analystProfileSchema   = specializedProfileSchema('analystCode',   'analystInternalCode')
const moderatorProfileSchema = specializedProfileSchema('moderatorCode', 'moderatorInternalCode')
const sponsorProfileSchema   = specializedProfileSchema('sponsorCode',   'sponsorInternalCode')

const userSchema = new mongoose.Schema({
  // GlitchGang identity
  playerCode:   { type: String, required: true, unique: true, trim: true },
  internalCode: { type: String, required: true, unique: true, trim: true },
  nick:         { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 32 },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },

  // Personal info
  firstName:        { type: String, required: true, trim: true, maxlength: 60 },
  lastName:         { type: String, required: true, trim: true, maxlength: 80 },
  countryCode:      { type: String, required: true, uppercase: true, trim: true },
  region:           { type: String, default: '', uppercase: true, trim: true },
  phoneCountryDial: { type: String, required: true, trim: true, maxlength: 5 },
  phoneNumber:      { type: String, required: true, trim: true, maxlength: 15 },
  birthDate:        { type: Date, required: true },
  gender:           { type: String, enum: ['male', 'female', 'non_binary', 'prefer_not_to_say', 'other'], required: true },
  languages:        [{ type: String, trim: true, default: ['es'] }],

  // Gaming profile
  games:           [{ type: String, trim: true }],
  experienceLevel: { type: String, enum: ['rookie', 'mid', 'pro'], required: true },
  mainPlatform:    { type: String, enum: ['pc', 'mobile', 'console'], required: true },
  lookingFor:      [{ type: String, enum: ['tournaments', 'team_duo', 'fun'] }],

  // Ficha de Jugador (Editar Perfil). "rank"/"mainCharacters" son la
  // compatibilidad plana con las lecturas existentes (PlayerCard, Profile,
  // MyTeamPanel, player.controller.js, team.controller.js); "ranks" y
  // "charactersByGame" son los mapas reales por juego que llena
  // EditProfile.jsx.
  gamerProfile: {
    mainGame:         { type: String, default: '', trim: true },
    secondGame:       { type: String, default: '', trim: true },
    mainRole:         { type: String, default: '', trim: true },
    rank:             { type: String, default: '', trim: true, maxlength: 40 },
    ranks:            { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    sensitivity:      { type: String, default: '', trim: true, maxlength: 20 },
    dpi:              { type: String, default: '', trim: true, maxlength: 20 },
    mainCharacters:   [{ type: String, trim: true }],
    charactersByGame: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    // PERFIL PROFESIONAL de jugador (panel de jugador, /jugador/perfil): la
    // tarjeta con la que se postula a equipos. Juegos con rango y rol, horario,
    // idiomas, contacto. Objeto libre acotado en normalizeProfileUpdates
    // (profile.controller.js). El contacto no sale en el perfil publico.
    pro:              { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    gameId:         { type: String, default: '', trim: true },
  },

  // Tarjetas que se muestran en el perfil principal: 'player' y/o ids de roles
  // con tarjeta profesional (caster, analyst, ...). Se valida en updateProfile.
  showcaseCards: [{ type: String, trim: true }],

  // Public profile
  bio:    { type: String, default: '', maxlength: 300 },
  banner: { type: String, default: '' },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['online', 'gaming', 'offline', 'activo', 'inactivo', 'ban'], default: 'offline' },
  // Ultima vez que cerro su ultimo socket (presencia, ver messagesRealtime.js).
  lastSeenAt: { type: Date, default: null },

  // Player-facing profile customization (separate from connection presence)
  // Marco/placa/estado: ids de config/cosmetics.js. Los exclusivos se
  // validan contra los desbloqueos en updateProfile (services/cosmetics.service.js).
  activeFrame:    { type: String, default: 'rgb', trim: true },
  activeBg:       { type: String, default: 'banner-basic-1', trim: true },
  activeStatus:   { type: String, enum: ['online', 'playing', 'torneo', 'live', 'lfg', 'afk', 'dnd', 'invisible', 'hack', 'king', 'surge', 'streak', 'glitch', 'virus', 'e404'], default: 'online' },
  activeBadge:    { type: Number, default: 201 },
  // Titulos de torneo del jugador (los del equipo con el que jugo, segun el
  // rosterSnapshot del check-in): se van con el si cambia de equipo.
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
    team:            { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    teamName:        { type: String, default: '' },
  }],
  // Cosmeticos otorgados a mano o por eventos que no se pueden deducir de
  // otros datos (MVP, racha, ranking, evento de temporada, votacion...).
  // Lo deducible (bienvenida, Premium, cumpleanos, torneos oficiales,
  // fundador) se calcula al vuelo y no se guarda aqui.
  cosmeticGrants: [{
    _id: false,
    kind:      { type: String, enum: ['status', 'frame', 'plate', 'card'], required: true },
    item:      { type: String, required: true, trim: true },
    source:    { type: String, required: true, trim: true },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    ref:       { type: mongoose.Schema.Types.ObjectId, default: null },
  }],
  activeCustomBg: { type: String, default: '' },
  activeCardDesign:   { type: String, default: 'crimson', trim: true },
  activeCardBg:       { type: String, default: 'tech-orange', trim: true },
  activeCardCustomBg: { type: String, default: '' },
  website:        { type: String, default: '', maxlength: 180, trim: true },
  social: {
    contactEmail: { type: String, default: '', maxlength: 120, trim: true },
    city:      { type: String, default: '', maxlength: 80, trim: true },
    whatsapp:  { type: String, default: '', maxlength: 40, trim: true },
    twitter:   { type: String, default: '', maxlength: 80, trim: true },
    instagram: { type: String, default: '', maxlength: 80, trim: true },
    twitch:    { type: String, default: '', maxlength: 80, trim: true },
    discord:   { type: String, default: '', maxlength: 80, trim: true },
    youtube:   { type: String, default: '', maxlength: 100, trim: true },
    tiktok:    { type: String, default: '', maxlength: 80, trim: true },
    kick:      { type: String, default: '', maxlength: 80, trim: true },
    facebook:  { type: String, default: '', maxlength: 100, trim: true },
    telegram:  { type: String, default: '', maxlength: 80, trim: true },
  },

  // Granular per-section visibility (Stephanie's EditProfile "Privacidad" tab).
  // Separate from settings.privacy below (older, simpler booleans) until the UI is consolidated.
  privacy: {
    publicProfile: { type: Boolean, default: true },
    showStats:     { type: Boolean, default: true },
    showGames:     { type: Boolean, default: true },
    allowFriends:  { type: Boolean, default: true },
    // Ajustes/Privacidad "Preferencias locales" (antes solo en localStorage,
    // nunca aplicados de verdad): ahora viven en el usuario y se hacen
    // cumplir en messages.controller.js (allowDMs) -- allowTeamInvite queda
    // guardado para cuando exista un flujo real de invitación por líder.
    allowDMs:        { type: Boolean, default: true },
    allowTeamInvite: { type: Boolean, default: true },
    personalVisibility:    { type: String, enum: ['public', 'friends', 'followers', 'nobody'], default: 'public' },
    statsVisibility:       { type: String, enum: ['public', 'friends', 'followers', 'nobody'], default: 'public' },
    gamesVisibility:       { type: String, enum: ['public', 'friends', 'followers', 'nobody'], default: 'public' },
    tournamentsVisibility: { type: String, enum: ['public', 'friends', 'followers', 'nobody'], default: 'public' },
    teamsVisibility:       { type: String, enum: ['public', 'friends', 'followers', 'nobody'], default: 'public' },
    socialVisibility:      { type: String, enum: ['public', 'friends', 'followers', 'nobody'], default: 'public' },
  },

  // Ajustes/Notificaciones: antes vivían solo en localStorage (settingsStore.js)
  // y nada en el backend las leía -- los toggles no hacían nada de verdad.
  // Ahora se guardan por usuario y notifications.service.js los respeta antes
  // de crear la notificación in-app o mandar el correo espejo.
  notificationPrefs: {
    email:       { type: Boolean, default: true },
    push:        { type: Boolean, default: true },
    tournaments: { type: Boolean, default: true },
    messages:    { type: Boolean, default: true },
    news:        { type: Boolean, default: false },
    marketing:   { type: Boolean, default: false },
  },

  // Ajustes/Seguridad: alerta por correo cuando se detecta un inicio de
  // sesión desde un dispositivo nuevo (ver auth.service.js createSession).
  security: {
    loginAlerts: { type: Boolean, default: true },
  },

  // GlitchGang economy
  plan: { type: String, enum: ['Free', 'Pro Trial', 'Team', 'Jugador Pro', 'Organizador', 'Creador de Contenido'], default: 'Free' },
  gp:   { type: Number, default: 1000, min: 0 }, // rating ELO individual (1000 = baseline, ver utils/elo.js)

  // Roles
  role:    { type: String, enum: ['player', 'admin', 'organizer', 'coach', 'caster', 'analyst', 'moderator', 'creator', 'brand', 'sponsor'], default: 'player' },
  roles:   [{ type: String, enum: ['player', 'organizer', 'coach', 'caster', 'analyst', 'moderator', 'creator', 'brand', 'sponsor'] }],
  isAdmin: { type: Boolean, default: false },
  isBanned:{ type: Boolean, default: false },
  // Insignia de "verificado" que un admin activa a mano desde /admin/usuarios
  // (distinta de emailVerified/whatsapp.verified/university.verified, que son
  // verificaciones de canal, no una insignia de cuenta).
  verified:  { type: Boolean, default: false },
  banReason: { type: String, default: '', trim: true, maxlength: 500 },
  // Restriccion de moderacion (/admin/moderacion tipo 'mute'): mientras este
  // vigente no puede publicar, comentar ni mandar mensajes (rejectIfMuted).
  mutedUntil: { type: Date, default: null },
  muteReason: { type: String, default: '', trim: true, maxlength: 500 },
  // Soft-delete desde /admin/usuarios ("Eliminar"): la cuenta no se borra de
  // verdad (tiene equipos/torneos/partidas asociadas), solo se desactiva y
  // deja de poder iniciar sesion ni aparecer en el censo por defecto.
  deleted:   { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },

  // IDs especializados asignados una sola vez al aprobar cada rol.
  roleProfiles: {
    organizer: { type: organizerProfileSchema, default: () => ({}) },
    creator:   { type: creatorProfileSchema,   default: () => ({}) },
    coach:     { type: coachProfileSchema,     default: () => ({}) },
    caster:    { type: casterProfileSchema,    default: () => ({}) },
    analyst:   { type: analystProfileSchema,   default: () => ({}) },
    moderator: { type: moderatorProfileSchema, default: () => ({}) },
    sponsor:   { type: sponsorProfileSchema,   default: () => ({}) },
  },

  // Acceso del organizador al Discord de GlitchGang para sus torneos. Lo
  // habilita un admin una vez; luego el organizador puede activar Discord en
  // cualquiera de sus torneos. El servidor propio del organizador es una
  // feature con costo aparte (no implementada).
  organizerDiscord: {
    status:     { type: String, enum: ['none', 'pending', 'enabled', 'revoked'], default: 'none' },
    requestedAt:{ type: Date, default: null },
    note:       { type: String, default: '', maxlength: 500, trim: true },
    enabledAt:  { type: Date, default: null },
    enabledBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },

  // Social
  followers:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friends:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: {
    sent:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    received: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Relations
  team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  // Codigo propio para invitar (se genera al pedirlo, codes.service.js).
  referralCode:{ type: String, trim: true, default: '' },
  // Quien lo invito (el codigo que escribio al registrarse).
  referredBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  acceptedTermsAt: { type: Date, required: true },

  // Email verification
  emailVerified:            { type: Boolean, default: false },
  emailVerificationToken:   { type: String, select: false, default: null },
  emailVerificationExpires: { type: Date, select: false, default: null },

  // Password reset
  passwordChangedAt: { type: Date, default: null },

  // Two-factor authentication
  twoFactorEnabled:     { type: Boolean, default: false },
  twoFactorSecret:      { type: String, select: false, default: null },
  twoFactorBackupCodes: { type: [String], select: false, default: [] },

  // Discord
  discord: {
    id:       { type: String, default: null },
    username: { type: String, default: null },
  },

  // WhatsApp
  whatsapp: {
    phone:        { type: String, default: '', trim: true },
    verified:     { type: Boolean, default: false },
    linkedAt:     { type: Date, default: null },
    linkCodeHash: { type: String, select: false, default: '' },
    linkCodeExpiresAt: { type: Date, select: false, default: null },
  },

  // Microsoft Entra ID (university institutional verification)
  microsoft: {
    id:          { type: String, default: '' },
    tenantId:    { type: String, default: '' },
    email:       { type: String, default: '' },
    displayName: { type: String, default: '' },
    verified:    { type: Boolean, default: false },
    linkedAt:    { type: Date, default: null },
  },

  // University verification
  university: {
    universityId:       { type: String, default: '' },
    universityTag:      { type: String, default: '' },
    universityName:     { type: String, default: '' },
    region:             { type: String, default: '' },
    city:               { type: String, default: '' },
    campus:             { type: String, default: '' },
    studentId:          { type: String, default: '' },
    program:            { type: String, default: '' },
    academicLevel:      { type: String, default: '' },
    admissionYear:      { type: Number, default: null },
    institutionalEmail: { type: String, default: '' },
    verificationSource: { type: String, default: 'none' },
    tenantId:           { type: String, default: '' },
    verificationStatus: {
      type: String,
      enum: ['unlinked', 'pending', 'verified', 'rejected'],
      default: 'unlinked',
    },
    verified:    { type: Boolean, default: false },
    appliedAt:   { type: Date, default: null },
    verifiedAt:  { type: Date, default: null },
    reviewedAt:  { type: Date, default: null },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectReason:{ type: String, default: '' },
    // Cuando el propio usuario se desvincula de su universidad (ver
    // unlinkUniversityVerification) -- gatilla el cooldown antes de poder
    // verificarse con otra.
    unlinkedAt:  { type: Date, default: null },
  },
}, {
  timestamps: true,
  versionKey: false,
})

// nick, email, playerCode already indexed via unique:true in schema
userSchema.index({ team: 1 })
userSchema.index(
  { 'whatsapp.phone': 1 },
  // $ne no se permite en un indice parcial (Mongo no lo crea); $gt: '' = no vacio.
  { unique: true, partialFilterExpression: { 'whatsapp.phone': { $type: 'string', $gt: '' } } },
)
for (const [role, [publicField, internalField]] of Object.entries({
  organizer: ['organizerCode', 'organizerInternalCode'],
  creator: ['creatorCode', 'creatorInternalCode'],
  coach: ['coachCode', 'coachInternalCode'],
  caster: ['casterCode', 'casterInternalCode'],
  analyst: ['analystCode', 'analystInternalCode'],
  moderator: ['moderatorCode', 'moderatorInternalCode'],
  sponsor: ['sponsorCode', 'sponsorInternalCode'],
})) {
  userSchema.index({ [`roleProfiles.${role}.${publicField}`]: 1 }, { unique: true, sparse: true })
  userSchema.index({ [`roleProfiles.${role}.${internalField}`]: 1 }, { unique: true, sparse: true })
}

export const User = mongoose.model('User', userSchema)
