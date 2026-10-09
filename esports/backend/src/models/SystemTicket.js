import mongoose from 'mongoose'

const systemTicketMessageSchema = new mongoose.Schema({
  author: { type: String, enum: ['user', 'admin', 'bot', 'system'], required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  body: { type: String, required: true, trim: true, maxlength: 2400 },
  sentAt: { type: Date, default: Date.now },
}, { _id: false })

const systemTicketSchema = new mongoose.Schema({
  publicCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  internalCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  createdYmd: { type: String, default: '', trim: true, maxlength: 8 },
  countryCode: { type: String, default: 'XX', uppercase: true, trim: true, maxlength: 3 },
  creatorCode: { type: String, default: 'GUEST', uppercase: true, trim: true, maxlength: 18 },
  sourceCode: { type: String, default: 'SYS', uppercase: true, trim: true, maxlength: 18 },
  sequenceCode: { type: String, default: '0000', trim: true, maxlength: 8 },
  searchCode: { type: String, default: '', uppercase: true, trim: true, maxlength: 800 },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requesterName: { type: String, default: 'Invitado', trim: true, maxlength: 80 },
  requesterEmail: { type: String, default: '', trim: true, lowercase: true, maxlength: 160 },
  purpose: {
    type: String,
    enum: ['bot', 'representative', 'complaint', 'help', 'bug', 'account', 'payment', 'tournament', 'community', 'brand', 'moderation', 'other'],
    default: 'help',
  },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  sourceType: { type: String, default: 'system', trim: true, maxlength: 80 },
  sourceId: { type: String, default: '', trim: true, maxlength: 120 },
  sourceLabel: { type: String, default: '', trim: true, maxlength: 160 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'waiting_user', 'closed'], default: 'open' },
  messages: { type: [systemTicketMessageSchema], default: [] },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  unreadByAdmin: { type: Number, default: 1 },
  unreadByUser: { type: Number, default: 0 },
  closedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false })

systemTicketSchema.index({ status: 1, priority: -1, updatedAt: -1 })
systemTicketSchema.index({ purpose: 1, status: 1 })
systemTicketSchema.index({ requester: 1, status: 1 })
systemTicketSchema.index({ sourceType: 1, sourceId: 1 })
systemTicketSchema.index({ createdYmd: -1, countryCode: 1, purpose: 1 })
systemTicketSchema.index({ creatorCode: 1, updatedAt: -1 })
systemTicketSchema.index({ searchCode: 'text', subject: 'text', requesterName: 'text', requesterEmail: 'text' })

export const SystemTicket = mongoose.model('SystemTicket', systemTicketSchema)
