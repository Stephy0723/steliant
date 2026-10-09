import { SystemTicket } from '../models/SystemTicket.js'
import {
  appendAdminTicketReply,
  appendUserTicketReply,
  cleanTicketValue as clean,
  createSystemTicketRecord,
  findSystemTicketByKey,
  mapSystemTicket as mapTicket,
  priorityForPlan,
  systemTicketKeyFilter,
} from '../services/systemTickets.service.js'
import { syncTicketConversation } from '../services/messageConversations.service.js'

export async function createSystemTicket(req, res, next) {
  try {
    const purpose = clean(req.body?.purpose, 40) || 'help'
    const subject = clean(req.body?.subject, 160)
    const message = clean(req.body?.message, 2400)
    if (!subject) return res.status(400).json({ message: 'Subject is required' })
    if (!message) return res.status(400).json({ message: 'Message is required' })

    const ticket = await createSystemTicketRecord({
      requester: req.user?._id || null,
      requesterUser: req.user || null,
      requesterName: clean(req.user?.nick || req.body?.requesterName || 'Invitado', 80),
      requesterEmail: clean(req.user?.email || req.body?.requesterEmail || '', 160),
      purpose,
      subject,
      priority: priorityForPlan(req.user?.plan),
      message,
      author: 'user',
      authorId: req.user?._id || null,
      sourceType: clean(req.body?.sourceType || req.body?.source || 'system', 80),
      sourceId: clean(req.body?.sourceId || '', 120),
      sourceLabel: clean(req.body?.sourceLabel || '', 160),
      metadata: req.body?.metadata || null,
    })

    res.status(201).json({ ticket: mapTicket(ticket) })
  } catch (error) {
    next(error)
  }
}

export async function mySystemTickets(req, res, next) {
  try {
    const tickets = await SystemTicket
      .find({ requester: req.user._id })
      .select('-messages')
      .sort({ updatedAt: -1 })
      .lean()
    res.json({ tickets: tickets.map(mapTicket) })
  } catch (error) {
    next(error)
  }
}

export async function getMySystemTicket(req, res, next) {
  try {
    const key = clean(req.params.id, 80)
    const ticket = await findSystemTicketByKey(key, { requester: req.user._id })
      .populate('requester', 'nick email playerCode')
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    ticket.unreadByUser = 0
    await ticket.save()
    await syncTicketConversation(ticket)
    res.json({ ticket: mapTicket(ticket) })
  } catch (error) {
    next(error)
  }
}

export async function summarySystemTicketsAdmin(req, res, next) {
  try {
    const [total, unread, urgent, open, waitingUser, byPurpose] = await Promise.all([
      SystemTicket.countDocuments({}),
      SystemTicket.countDocuments({ unreadByAdmin: { $gt: 0 } }),
      SystemTicket.countDocuments({ priority: 'urgent', status: { $ne: 'closed' } }),
      SystemTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      SystemTicket.countDocuments({ status: 'waiting_user' }),
      SystemTicket.aggregate([
        { $group: { _id: '$purpose', count: { $sum: 1 }, unread: { $sum: '$unreadByAdmin' } } },
        { $sort: { count: -1 } },
      ]),
    ])

    res.json({
      total,
      unread,
      urgent,
      open,
      waitingUser,
      byPurpose: byPurpose.map(item => ({
        purpose: item._id || 'other',
        count: item.count || 0,
        unread: item.unread || 0,
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function listSystemTicketsAdmin(req, res, next) {
  try {
    const { status = 'all', q = '', country = '', purpose = '', creator = '' } = req.query
    const filter = status === 'all' ? {} : { status }
    if (purpose) filter.purpose = clean(purpose, 40)
    if (country) filter.countryCode = clean(country, 3).toUpperCase()
    if (creator) filter.creatorCode = clean(creator, 18).toUpperCase()

    const query = clean(q, 120).toUpperCase()
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(escaped, 'i')
      filter.$or = [
        { publicCode: rx },
        { internalCode: rx },
        { searchCode: rx },
        { subject: rx },
        { requesterName: rx },
        { requesterEmail: rx },
        { sourceLabel: rx },
      ]
    }

    const tickets = await SystemTicket
      .find(filter)
      .populate('requester', 'nick email playerCode')
      .lean()

    // `.sort({ priority: -1 })` ordenaba alfabético (urgent > medium > low >
    // high), NO por severidad real -- "high" terminaba último, por debajo de
    // "low". Con "soporte prioritario" ahora siendo un beneficio real del
    // plan, que el orden esté mal rompe justo lo que se supone que hace.
    const PRIORITY_RANK = { urgent: 3, high: 2, medium: 1, low: 0 }
    tickets.sort((a, b) => {
      if ((b.unreadByAdmin || 0) !== (a.unreadByAdmin || 0)) return (b.unreadByAdmin || 0) - (a.unreadByAdmin || 0)
      const byPriority = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
      if (byPriority !== 0) return byPriority
      return new Date(b.updatedAt) - new Date(a.updatedAt)
    })

    res.json({ tickets: tickets.map(mapTicket) })
  } catch (error) {
    next(error)
  }
}

export async function getSystemTicketAdmin(req, res, next) {
  try {
    const ticket = await findSystemTicketByKey(req.params.id)
      .populate('requester', 'nick email playerCode')
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    ticket.unreadByAdmin = 0
    await ticket.save()
    await syncTicketConversation(ticket)
    res.json({ ticket: mapTicket(ticket) })
  } catch (error) {
    next(error)
  }
}

export async function updateSystemTicketAdmin(req, res, next) {
  try {
    const update = {}
    for (const key of ['status', 'priority', 'assignedTo']) {
      if (req.body?.[key] !== undefined) update[key] = req.body[key]
    }
    if (update.status === 'closed') update.closedAt = new Date()
    if (update.status && update.status !== 'closed') update.closedAt = null

    const ticket = await SystemTicket.findOneAndUpdate(systemTicketKeyFilter(req.params.id), { $set: update }, { new: true })
      .populate('requester', 'nick email playerCode')
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    res.json({ ticket: mapTicket(ticket) })
  } catch (error) {
    next(error)
  }
}

export async function replySystemTicketAdmin(req, res, next) {
  try {
    const message = clean(req.body?.message, 2400)
    if (!message) return res.status(400).json({ message: 'Message is required' })
    const ticket = await appendAdminTicketReply(req.params.id, req.user, message)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    res.json({ ticket: mapTicket(ticket) })
  } catch (error) {
    next(error)
  }
}

export async function replySystemTicketUser(req, res, next) {
  try {
    const message = clean(req.body?.message, 2400)
    if (!message) return res.status(400).json({ message: 'Message is required' })
    const ticket = await findSystemTicketByKey(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    if (String(ticket.requester || '') !== String(req.user?._id || '')) {
      return res.status(403).json({ message: 'You cannot reply to this ticket' })
    }
    const updated = await appendUserTicketReply(ticket, req.user, message)
    res.json({ ticket: mapTicket(updated) })
  } catch (error) {
    next(error)
  }
}
