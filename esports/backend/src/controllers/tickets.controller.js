import { Ticket } from '../models/Ticket.js'
import { Brand }  from '../models/Brand.js'
import { createTicketCodes } from '../services/codes.service.js'
import {
  appendAdminTicketReply,
  appendUserTicketReply,
  createSystemTicketRecord,
  ensureSystemTicketForSource,
} from '../services/systemTickets.service.js'

const TICKET_CATEGORIES = new Set(['billing', 'campaign', 'technical', 'creative', 'other'])
const LEGACY_TICKET_CATEGORY = { campana: 'campaign', torneo: 'campaign', reporte: 'campaign', banner: 'creative', facturacion: 'billing', tecnico: 'technical', otro: 'other' }

function normalizeTicketCategory(value) {
  const key = String(value || '').trim().toLowerCase()
  if (TICKET_CATEGORIES.has(key)) return key
  return LEGACY_TICKET_CATEGORY[key] || 'other'
}

// ── Brand: crear ticket ───────────────────────────────────────────────────────
// POST /brands/me/tickets
export async function createTicket(req, res, next) {
  try {
    const brandId = req.user.brandId
    if (!brandId) return res.status(403).json({ error: 'Sin marca asignada' })

    const { subject, message, priority } = req.body
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'subject y message son requeridos' })
    }
    // Categoria fuera del enum (o ids viejos del formulario en español) ya no
    // tumba la creacion con un 500: se normaliza, y lo desconocido va a 'other'.
    const category = normalizeTicketCategory(req.body.category)

    // Obtener code de la marca para generar IDs del ticket
    const brand = await Brand.findById(brandId).select('code').lean()
    const codes = await createTicketCodes(brand?.code || '', brandId)

    const ticket = await Ticket.create({
      publicCode: codes.publicCode,
      internalCode: codes.internalCode,
      brandId,
      authorId: req.user._id,
      subject:  subject.trim(),
      category,
      priority: priority || 'low',
      messages: [{ author: 'brand', authorId: req.user._id, body: message.trim() }],
      unreadByAdmin: 1,
      unreadByBrand: 0,
    })

    const systemTicket = await createSystemTicketRecord({
      requester: req.user._id,
      requesterUser: req.user,
      requesterName: req.user.nick || req.user.email || 'Marca',
      requesterEmail: req.user.email || '',
      purpose: 'brand',
      priority: priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low',
      subject: subject.trim(),
      message: message.trim(),
      author: 'user',
      authorId: req.user._id,
      sourceType: 'brand-ticket',
      sourceId: String(ticket._id),
      sourceLabel: brand?.code || 'Marca',
      metadata: { brandId: String(brandId), category, publicCode: ticket.publicCode },
    })
    ticket.systemTicket = systemTicket._id
    await ticket.save()

    res.status(201).json(ticket)
  } catch (e) { next(e) }
}

// ── Brand: ver sus tickets ────────────────────────────────────────────────────
// GET /brands/me/tickets
export async function getMyTickets(req, res, next) {
  try {
    const brandId = req.user.brandId
    if (!brandId) return res.status(403).json({ error: 'Sin marca asignada' })

    const tickets = await Ticket.find({ brandId })
      .select('-messages')
      .sort({ updatedAt: -1 })
    res.json(tickets)
  } catch (e) { next(e) }
}

// GET /brands/me/tickets/:tid
export async function getTicketDetail(req, res, next) {
  try {
    const brandId = req.user.brandId
    if (!brandId) return res.status(403).json({ error: 'Sin marca asignada' })

    const ticket = await Ticket.findOne({ _id: req.params.tid, brandId })
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' })

    // Marca como leído por la marca
    if (ticket.unreadByBrand > 0) {
      ticket.unreadByBrand = 0
      await ticket.save()
    }

    res.json(ticket)
  } catch (e) { next(e) }
}

// ── Brand: responder a un ticket ──────────────────────────────────────────────
// POST /brands/me/tickets/:tid/reply
export async function replyTicket(req, res, next) {
  try {
    const { message } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'message es requerido' })

    const brandId = req.user.brandId
    const isAdmin = req.user.role === 'admin'

    const ticket = await Ticket.findById(req.params.tid)
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' })

    // Verifica acceso
    if (!isAdmin && String(ticket.brandId) !== String(brandId)) {
      return res.status(403).json({ error: 'Acceso denegado' })
    }

    const author = isAdmin ? 'admin' : 'brand'
    ticket.messages.push({ author, authorId: req.user._id, body: message.trim() })
    ticket.status = ticket.status === 'open' ? 'in_progress' : ticket.status

    if (isAdmin) {
      ticket.unreadByBrand++
      ticket.unreadByAdmin = 0
      ticket.assignedTo = req.user._id
    } else {
      ticket.unreadByAdmin++
      ticket.unreadByBrand = 0
    }

    const systemTicket = ticket.systemTicket || await ensureSystemTicketForSource('brand-ticket', String(ticket._id), async () => ({
      requester: ticket.authorId,
      requesterUser: req.user,
      requesterName: 'Marca',
      requesterEmail: '',
      purpose: 'brand',
      priority: ticket.priority === 'high' ? 'high' : ticket.priority === 'medium' ? 'medium' : 'low',
      subject: ticket.subject,
      message: ticket.messages?.[0]?.body || ticket.subject,
      author: 'user',
      authorId: ticket.authorId,
      sourceType: 'brand-ticket',
      sourceId: String(ticket._id),
      sourceLabel: ticket.publicCode,
      metadata: { brandId: String(ticket.brandId), category: ticket.category, publicCode: ticket.publicCode },
    }))
    if (!ticket.systemTicket) ticket.systemTicket = systemTicket._id
    if (isAdmin) await appendAdminTicketReply(systemTicket, req.user, message.trim())
    else await appendUserTicketReply(systemTicket, req.user, message.trim())

    await ticket.save()
    res.json(ticket)
  } catch (e) { next(e) }
}

// ── Admin: ver todos los tickets ──────────────────────────────────────────────
// GET /brands/admin/tickets?status=open
export async function adminGetTickets(req, res, next) {
  try {
    const { status } = req.query
    const filter = status && status !== 'all' ? { status } : {}
    const tickets = await Ticket.find(filter)
      .populate('brandId', 'name code color logoInitials')
      .select('-messages')
      .sort({ priority: -1, updatedAt: -1 })
    res.json(tickets)
  } catch (e) { next(e) }
}

// GET /brands/admin/tickets/:tid
export async function adminGetTicketDetail(req, res, next) {
  try {
    const ticket = await Ticket.findById(req.params.tid)
      .populate('brandId', 'name code color logoInitials')
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' })

    if (ticket.unreadByAdmin > 0) {
      ticket.unreadByAdmin = 0
      await ticket.save()
    }

    res.json(ticket)
  } catch (e) { next(e) }
}

// PATCH /brands/admin/tickets/:tid — cambiar status, prioridad, asignar
export async function adminUpdateTicket(req, res, next) {
  try {
    const ALLOWED = ['status', 'priority', 'assignedTo']
    const update = {}
    for (const k of ALLOWED) if (req.body[k] !== undefined) update[k] = req.body[k]
    if (update.status === 'closed') update.closedAt = new Date()

    const ticket = await Ticket.findByIdAndUpdate(req.params.tid, { $set: update }, { new: true })
      .populate('brandId', 'name code')
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' })
    res.json(ticket)
  } catch (e) { next(e) }
}
