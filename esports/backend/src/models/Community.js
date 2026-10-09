import mongoose from 'mongoose'

const communitySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  slug:        { type: String, required: true, unique: true, trim: true, lowercase: true },
  game:        { type: String, default: '', trim: true, maxlength: 60 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  tags:        [{ type: String, trim: true, maxlength: 30 }],
  privacy:     { type: String, enum: ['public', 'private'], default: 'public' },
  // Comunidad oficial del catálogo de juegos de GlitchGang (sembrada por admin), no creada por un usuario.
  official:    { type: Boolean, default: false },

  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Usuarios expulsados: no pueden volver a unirse hasta que el creador los desbanee.
  bannedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Campos de Stephanie (rediseño CommunityOperations/CommunityWeb) -- no consumidos
  // todavía por ningún controller/JSX real, se mantienen en el modelo para no perder
  // el trabajo pero CommunityOperations.jsx/CommunityWeb.jsx real siguen usando solo
  // los campos de arriba (game/tags/privacy/getCommunityStats()).
  publicCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true, maxlength: 120 },
  game: { type: String, default: '', trim: true },
  games: [{ type: String, trim: true }],
  region: { type: String, default: '', trim: true },
  lang: { type: String, default: 'Español', trim: true },
  audience: { type: String, default: 'Mixto', trim: true },
  whoPublishes: { type: String, default: 'Todos', trim: true },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  logo: { type: String, default: '', trim: true },
  banner: { type: String, default: '', trim: true },
  video: { type: String, default: '', trim: true },
  gallery: [{
    url: { type: String, default: '', trim: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    title: { type: String, default: '', trim: true },
  }],
  color: { type: String, default: '', trim: true },
  accent: { type: String, default: '', trim: true },
  links: { type: mongoose.Schema.Types.Mixed, default: {} },
  rules: [{ type: String, trim: true }],
  rulesPdf: { type: String, default: '', trim: true },
  allowed: { type: String, default: '', trim: true },
  notAllowed: { type: String, default: '', trim: true },
  banned: { type: String, default: '', trim: true },
  features: { type: mongoose.Schema.Types.Mixed, default: {} },
  partnerBadge: {
    active:     { type: Boolean, default: false },
    label:      { type: String, default: 'GlitchGang Partner', trim: true, maxlength: 80 },
    status:     { type: String, enum: ['none', 'pending', 'verified', 'revoked'], default: 'none' },
    reason:     { type: String, default: '', trim: true, maxlength: 260 },
    verifiedAt: { type: Date, default: null },
    revokedAt:  { type: Date, default: null },
    updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  staff: [{
    role: { type: String, default: 'Moderador', trim: true },
    username: { type: String, default: '', trim: true },
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
}, {
  timestamps: true,
  versionKey: false,
})

communitySchema.index({ createdAt: -1 })
communitySchema.index({ members: 1 })
communitySchema.index({ game: 1, status: 1 })

export const Community = mongoose.model('Community', communitySchema)
