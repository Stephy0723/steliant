import mongoose from 'mongoose'

const postSchema = new mongoose.Schema({
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorNick:   { type: String, required: true },
  authorAvatar: { type: String },
  text:         { type: String, required: true }, // Removed 280 length limit for professional posts
  kind:         { 
    type: String, 
    enum: ['mensaje', 'anuncio', 'encuesta', 'foto', 'torneo', 'evento', 'documento', 'guia', 'clip', 'logro', 'reto', 'reclutamiento', 'compartir_equipo'], 
    default: 'mensaje' 
  },
  title:        { type: String }, // For polls, achievements, events, etc.
  pinned:       { type: Boolean, default: false },
  likes:        { type: Number, default: 0 },
  likedBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments:     { type: Number, default: 0 },
  timeString:   { type: String, default: 'Ahora' },
  
  // Multimedia / Attachments
  photoUrl:     { type: String },
  fileUrl:      { type: String },
  fileName:     { type: String },
  
  // Poll Options
  pollOptions:  [{
    text: String,
    votes: { type: Number, default: 0 },
    votedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  
  // Bookmarks & Moderation
  savedBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reports:      [{
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  reported:     { type: Boolean, default: false },
  blockedBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who blocked/muted this post
  
  // Associations
  communitySlug: { type: String }, // e.g., 'lol', 'valorant'
  tournamentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
  teamId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  
  // Event & Tournament Specifics
  eventData: {
    title: String,
    description: String,
    date: Date,
    time: String,
    link: String
  },
  tournamentData: {
    game: String,
    format: String,
    slots: Number,
    filledSlots: { type: Number, default: 0 },
    prize: String,
    date: Date,
    publicId: String
  },
  
  // Retos, Reclutamiento & Compartido de Equipos
  challengeData: {
    game: String,
    stake: String
  },
  recruitmentData: {
    teamName: String,
    game: String,
    roleNeeded: String
  },
  teamData: {
    name: String,
    tag: String,
    logo: String,
    game: String
  }
}, {
  timestamps: true,
  versionKey: false
})

// GET /posts/saved filtra por savedBy.
postSchema.index({ savedBy: 1, createdAt: -1 })

export const Post = mongoose.model('Post', postSchema)

