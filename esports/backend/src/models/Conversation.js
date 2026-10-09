import mongoose from 'mongoose'

const readStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date, default: null },
}, { _id: false })

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'system', 'team', 'community', 'ticket', 'support', 'tournament_staff'],
    required: true,
    index: true,
  },
  title: { type: String, default: '', trim: true, maxlength: 140 },
  subtitle: { type: String, default: '', trim: true, maxlength: 180 },
  image: { type: String, default: '', trim: true },
  cover: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },
  context: {
    kind: { type: String, default: '', trim: true, index: true },
    targetId: { type: String, default: '', trim: true, index: true },
    publicCode: { type: String, default: '', trim: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readState: { type: [readStateSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, default: '', trim: true, maxlength: 240 },
  archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true, versionKey: false })

conversationSchema.index({ participants: 1, lastMessageAt: -1 })
conversationSchema.index({ type: 1, 'context.targetId': 1 })

export const Conversation = mongoose.model('Conversation', conversationSchema)
