import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  senderName: { type: String, default: 'Sistema GlitchGang', trim: true, maxlength: 100 },
  senderRole: { type: String, default: '', trim: true, maxlength: 50 },
  kind: {
    type: String,
    enum: ['text', 'system', 'share', 'invite', 'poll', 'tournament', 'attachment', 'ticket', 'staff_report'],
    default: 'text',
  },
  text: { type: String, default: '', trim: true, maxlength: 4000 },
  card: { type: mongoose.Schema.Types.Mixed, default: null },
  attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  relatedTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'SystemTicket', default: null },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true, versionKey: false })

messageSchema.index({ conversation: 1, createdAt: 1 })

export const Message = mongoose.model('Message', messageSchema)
