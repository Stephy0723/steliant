import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorNick:   { type: String, default: '' },
  authorAvatar: { type: String, default: '' },
  text:         { type: String, required: true, trim: true, maxlength: 500 },
}, { timestamps: true })

const pollOptionSchema = new mongoose.Schema({
  text:  { type: String, required: true, trim: true, maxlength: 120 },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
})

const REPORT_REASONS = ['spam', 'inapropiado', 'acoso', 'otro']

const reportSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: REPORT_REASONS, default: 'otro' },
}, { timestamps: true })

const communityPostSchema = new mongoose.Schema({
  // Exactamente uno de los dos identifica a qué feed pertenece el post:
  // universityId (comunidad de universidad) o communityId (comunidad del hub /comunidad).
  universityId: { type: String, default: null, index: true },
  communityId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null, index: true },
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorNick:   { type: String, default: '' },
  authorAvatar: { type: String, default: '' },
  text:         { type: String, default: '', trim: true, maxlength: 2000 },
  kind:         { type: String, enum: ['text', 'poll', 'event', 'tournament'], default: 'text' },

  // kind: 'poll'
  pollOptions: [pollOptionSchema],

  // kind: 'event'
  eventTitle:    { type: String, default: '', trim: true, maxlength: 160 },
  eventDate:     { type: Date, default: null },
  eventLocation: { type: String, default: '', trim: true, maxlength: 160 },
  interested:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // kind: 'tournament'
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },

  likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments:  [commentSchema],
  editedAt:  { type: Date, default: null },
  reports:   [reportSchema],
}, {
  timestamps: true,
  versionKey: false,
})

communityPostSchema.index({ universityId: 1, createdAt: -1 })
communityPostSchema.index({ communityId: 1, createdAt: -1 })

export const CommunityPost = mongoose.model('CommunityPost', communityPostSchema)
export { REPORT_REASONS }
