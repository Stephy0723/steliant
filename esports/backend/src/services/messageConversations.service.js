import { Conversation } from '../models/Conversation.js'
import { Message } from '../models/Message.js'
import { User } from '../models/User.js'
import { emitConversationMessage } from '../realtime/messagesRealtime.js'

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max)

async function adminIds() {
  const admins = await User.find({ $or: [{ role: 'admin' }, { isAdmin: true }] }).select('_id').limit(50).lean()
  return admins.map(admin => admin._id)
}

function uniqIds(values = []) {
  return [...new Set(values.filter(Boolean).map(value => String(value)))]
}

export async function ensureTicketConversation(ticket) {
  if (!ticket?.requester) return null
  const publicCode = ticket.publicCode || String(ticket._id)
  let conversation = await Conversation.findOne({ type: 'ticket', 'context.targetId': publicCode })
  if (conversation) return conversation

  const participants = uniqIds([ticket.requester, ...(await adminIds())])
  conversation = await Conversation.create({
    type: 'ticket',
    title: `Ticket ${publicCode}`,
    subtitle: ticket.subject || 'Seguimiento administrativo',
    image: '',
    cover: '',
    color: '#ff8a1f',
    context: {
      kind: 'ticket',
      targetId: publicCode,
      publicCode,
      metadata: {
        ticketId: String(ticket._id),
        purpose: ticket.purpose,
        priority: ticket.priority,
        status: ticket.status,
        sourceType: ticket.sourceType,
        sourceId: ticket.sourceId,
      },
    },
    participants,
    readState: participants.map(user => ({ user, lastReadAt: null })),
    lastMessageAt: ticket.updatedAt || ticket.createdAt || new Date(),
    lastMessagePreview: ticket.subject || '',
  })
  return conversation
}

export async function syncTicketMessageToConversation(ticket, message = {}) {
  if (!ticket?.requester) return null
  const conversation = await ensureTicketConversation(ticket)
  if (!conversation) return null

  const body = clean(message.body || message.text || '', 4000)
  if (!body) return conversation

  const existingFilter = {
    conversation: conversation._id,
    text: body,
    sender: message.authorId || null,
    relatedTicket: ticket._id,
  }
  if (message.sentAt || message.createdAt) {
    existingFilter.createdAt = message.sentAt || message.createdAt
  }
  const exists = await Message.findOne(existingFilter).catch(() => null)
  if (exists) return conversation

  const kind = message.author === 'system' ? 'system' : 'ticket'
  const senderName = message.author === 'admin'
    ? 'Admin GlitchGang'
    : message.author === 'user'
      ? (ticket.requesterName || 'Usuario')
      : 'Sistema GlitchGang'

  const msg = await Message.create({
    conversation: conversation._id,
    sender: message.authorId || null,
    senderName,
    senderRole: message.author || 'system',
    kind,
    text: body,
    relatedTicket: ticket._id,
    readBy: message.author === 'user' ? [ticket.requester] : [],
    createdAt: message.sentAt || new Date(),
  })

  conversation.lastMessageAt = msg.createdAt
  conversation.lastMessagePreview = body
  conversation.context = {
    ...conversation.context,
    metadata: {
      ...(conversation.context?.metadata || {}),
      status: ticket.status,
      priority: ticket.priority,
    },
  }
  await conversation.save()
  emitConversationMessage(conversation, msg)
  return conversation
}

export async function syncTicketConversation(ticket) {
  if (!ticket?.requester) return null
  const conversation = await ensureTicketConversation(ticket)
  for (const message of ticket.messages || []) {
    await syncTicketMessageToConversation(ticket, message)
  }
  return conversation
}
