import { SystemTicket } from '../models/SystemTicket.js'
import { User } from '../models/User.js'
import { formatYYYYMMDD, reserveSequence, userRef } from './codes.service.js'
import { sendNotif } from './notifications.service.js'
import { syncTicketConversation, syncTicketMessageToConversation } from './messageConversations.service.js'

const PURPOSE_PREFIX = {
  bot: 'BOT',
  representative: 'REP',
  complaint: 'QUE',
  help: 'AYU',
  bug: 'BUG',
  account: 'CTA',
  payment: 'PAG',
  tournament: 'TOR',
  community: 'COM',
  brand: 'BRD',
  moderation: 'MOD',
  other: 'GEN',
}

export function cleanTicketValue(value = '', max = 300) {
  return String(value || '').trim().slice(0, max)
}

// "Soporte prioritario" (beneficio anunciado del plan Pro) -- la prioridad
// la decide el servidor según el plan real del usuario, nunca el cliente
// (antes se aceptaba `priority` libre en el body de creación del ticket).
export function priorityForPlan(plan) {
  return plan && plan !== 'Free' ? 'high' : 'medium'
}

function ticketSegment(value = '', fallback = 'NA', max = 18) {
  const cleaned = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, max)
  return cleaned || fallback
}

function sourceSegment(sourceType = '', sourceLabel = '') {
  const known = {
    'game-request': 'GAMEREQ',
    'brand-ticket': 'BRAND',
    'admin-notice': 'NOTICE',
    'system': 'SYS',
    'support': 'SUPPORT',
    'bot': 'BOT',
  }
  return ticketSegment(known[sourceType] || sourceType || sourceLabel || 'SYS', 'SYS', 12)
}

async function resolveRequesterUser(requester, requesterUser) {
  if ((requesterUser?.playerCode && requesterUser?.countryCode) || !requester) {
    return requesterUser
  }
  if (!requester) return requesterUser || null
  try {
    return User.findById(requester)
      .select('playerCode nick email countryCode')
      .lean()
  } catch {
    return requesterUser || null
  }
}

function buildSearchCode(values = []) {
  return ticketSegment(values.filter(Boolean).join(' '), '', 800)
}

export async function createSystemTicketCodes({
  purpose = 'help',
  createdAt = new Date(),
  requester = null,
  requesterUser = null,
  requesterName = '',
  requesterEmail = '',
  sourceType = 'system',
  sourceLabel = '',
  subject = '',
  metadata = null,
} = {}) {
  const user = await resolveRequesterUser(requester, requesterUser)
  const createdYmd = formatYYYYMMDD(createdAt)
  const prefix = PURPOSE_PREFIX[purpose] || PURPOSE_PREFIX.other
  const countryCode = ticketSegment(
    user?.countryCode || metadata?.countryCode || metadata?.country || 'XX',
    'XX',
    3,
  )
  const creatorCode = ticketSegment(
    userRef(user?.playerCode) || user?._id || requester || requesterName || requesterEmail?.split('@')[0] || 'GUEST',
    'GUEST',
    18,
  )
  const sourceCode = sourceSegment(sourceType, sourceLabel)
  const sequenceCode = await reserveSequence(`system-ticket:${createdYmd}:${countryCode}:${prefix}`, 4)
  const base = `TCK-${prefix}-${createdYmd}-${countryCode}-${creatorCode}-${sourceCode}-${sequenceCode}`
  const searchCode = buildSearchCode([
    base,
    prefix,
    purpose,
    createdYmd,
    countryCode,
    creatorCode,
    sourceCode,
    sourceType,
    sourceLabel,
    subject,
    requesterName,
    requesterEmail,
    metadata?.gameName,
    metadata?.category,
    metadata?.publicCode,
    metadata?.brandId,
  ])
  return {
    publicCode: base,
    internalCode: `${base}-SYS-${createdAt.getTime()}`,
    createdYmd,
    countryCode,
    creatorCode,
    sourceCode,
    sequenceCode,
    searchCode,
  }
}

export function mapSystemTicket(ticket) {
  return {
    id: String(ticket._id),
    _id: String(ticket._id),
    publicCode: ticket.publicCode,
    internalCode: ticket.internalCode,
    createdYmd: ticket.createdYmd,
    countryCode: ticket.countryCode,
    creatorCode: ticket.creatorCode,
    sourceCode: ticket.sourceCode,
    sequenceCode: ticket.sequenceCode,
    searchCode: ticket.searchCode,
    requesterName: ticket.requesterName || ticket.requester?.nick || 'Invitado',
    requesterEmail: ticket.requesterEmail || ticket.requester?.email || '',
    requester: ticket.requester ? {
      id: String(ticket.requester._id || ticket.requester),
      nick: ticket.requester.nick,
      email: ticket.requester.email,
      playerCode: ticket.requester.playerCode,
    } : null,
    purpose: ticket.purpose,
    subject: ticket.subject,
    sourceType: ticket.sourceType,
    sourceId: ticket.sourceId,
    sourceLabel: ticket.sourceLabel,
    metadata: ticket.metadata,
    priority: ticket.priority,
    status: ticket.status,
    messages: ticket.messages || [],
    unreadByAdmin: ticket.unreadByAdmin || 0,
    unreadByUser: ticket.unreadByUser || 0,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt,
  }
}

export function systemTicketKeyFilter(key, extra = {}) {
  const value = cleanTicketValue(key, 120)
  const filter = { ...extra, $or: [{ publicCode: value }, { internalCode: value }] }
  if (/^[a-f\d]{24}$/i.test(value)) filter.$or.push({ _id: value })
  return filter
}

// Sin `async` a propósito: los controllers encadenan .populate() sobre el
// Query que devuelve (SystemTicket.findOne(...)) -- si esto fuera async,
// devolvería una Promise<Query> y .populate() rompería con "is not a
// function". Sigue siendo awaitable igual (los Query de Mongoose son
// thenables), así que las llamadas que solo hacen `await` no cambian.
export function findSystemTicketByKey(key, extra = {}) {
  return SystemTicket.findOne(systemTicketKeyFilter(key, extra))
}

async function notifyAdminsForTicket(ticket, { title, message, type = 'system_ticket_update' } = {}) {
  try {
    const admins = await User.find({ $or: [{ role: 'admin' }, { isAdmin: true }] })
      .select('_id')
      .limit(50)
      .lean()
    await Promise.all(admins.map(admin => sendNotif(admin._id, {
      type,
      title: title || `Ticket pendiente - ${ticket.publicCode}`,
      message: cleanTicketValue(message || ticket.subject || 'Nuevo movimiento en tickets.', 400),
      link: `/admin/reportes?ticket=${encodeURIComponent(ticket.publicCode)}`,
      meta: {
        ticketId: String(ticket._id),
        publicCode: ticket.publicCode,
        purpose: ticket.purpose,
        priority: ticket.priority,
        sourceType: ticket.sourceType,
        sourceId: ticket.sourceId,
        requester: ticket.requester ? String(ticket.requester) : null,
      },
    })))
  } catch (error) {
    console.error('[systemTickets] Error al notificar admins:', error.message)
  }
}

export async function createSystemTicketRecord({
  requester = null,
  requesterUser = null,
  requesterName = '',
  requesterEmail = '',
  purpose = 'help',
  subject = '',
  priority = 'medium',
  message = '',
  author = 'user',
  authorId = null,
  sourceType = 'system',
  sourceId = '',
  sourceLabel = '',
  metadata = null,
}) {
  const createdAt = new Date()
  const codes = await createSystemTicketCodes({
    purpose,
    createdAt,
    requester,
    requesterUser,
    requesterName,
    requesterEmail,
    sourceType,
    sourceLabel,
    subject,
    metadata,
  })
  const ticket = await SystemTicket.create({
    ...codes,
    requester,
    requesterName: cleanTicketValue(requesterName, 80) || 'Invitado',
    requesterEmail: cleanTicketValue(requesterEmail, 160),
    purpose,
    subject: cleanTicketValue(subject, 160),
    priority,
    sourceType: cleanTicketValue(sourceType, 80),
    sourceId: cleanTicketValue(sourceId, 120),
    sourceLabel: cleanTicketValue(sourceLabel, 160),
    metadata,
    messages: [{ author, authorId, body: cleanTicketValue(message, 2400) }],
    unreadByAdmin: author === 'admin' ? 0 : 1,
    unreadByUser: author === 'admin' ? 1 : 0,
    createdAt,
  })
  if (author !== 'admin') {
    await notifyAdminsForTicket(ticket, {
      type: 'system_ticket_new',
      title: `Nuevo ticket - ${ticket.publicCode}`,
      message: `${ticket.requesterName}: ${ticket.subject}`,
    })
  }
  await syncTicketConversation(ticket)
  return ticket
}

export async function ensureSystemTicketForSource(sourceType, sourceId, factory) {
  const existing = sourceId
    ? await SystemTicket.findOne({ sourceType, sourceId })
    : null
  if (existing) return existing
  return createSystemTicketRecord(await factory())
}

// Un ticket ya cargado (documento con `messages`) se usa tal cual. Si llega un
// ObjectId suelto (ej. `RoleApplication.systemTicket` sin populate) o un objeto
// sin `messages`, se carga el documento real; antes eso reventaba con
// "Cannot read properties of undefined (reading 'push')".
async function resolveTicketDoc(ticketOrId) {
  if (!ticketOrId) return null
  if (typeof ticketOrId === 'string') return findSystemTicketByKey(ticketOrId)
  if (Array.isArray(ticketOrId.messages)) return ticketOrId
  return SystemTicket.findById(ticketOrId._id || ticketOrId)
}

// opts.close = true: la respuesta es una decision final (aprobado, rechazado,
// caso resuelto) y el ticket se cierra. Antes todas las respuestas dejaban el
// ticket en 'in_progress' para siempre aunque el mensaje dijera "resuelto",
// y el panel admin los seguia contando como reportes abiertos.
export async function appendAdminTicketReply(ticketOrId, adminUser, message, opts = {}) {
  const ticket = await resolveTicketDoc(ticketOrId)
  if (!ticket) return null

  const body = cleanTicketValue(message, 2400)
  ticket.messages.push({ author: 'admin', authorId: adminUser?._id || null, body })
  ticket.status = opts.close ? 'closed' : (ticket.status === 'open' ? 'in_progress' : ticket.status)
  ticket.unreadByUser += 1
  ticket.unreadByAdmin = 0
  ticket.assignedTo = adminUser?._id || ticket.assignedTo
  await ticket.save()
  await syncTicketMessageToConversation(ticket, ticket.messages.at(-1))

  if (ticket.requester) {
    await sendNotif(ticket.requester, {
      type: 'admin_ticket_reply',
      title: `Respuesta admin - ${ticket.publicCode}`,
      message: body,
      link: `/mensajes?ticket=${encodeURIComponent(ticket.publicCode)}`,
      meta: {
        ticketId: String(ticket._id),
        publicCode: ticket.publicCode,
        purpose: ticket.purpose,
        sourceType: ticket.sourceType,
        sourceId: ticket.sourceId,
        status: ticket.status,
        subject: ticket.subject || '',
        adminNick: adminUser?.nick || '',
      },
    })
  }

  return ticket
}

export async function appendUserTicketReply(ticketOrId, user, message) {
  const ticket = await resolveTicketDoc(ticketOrId)
  if (!ticket) return null

  const body = cleanTicketValue(message, 2400)
  ticket.messages.push({ author: 'user', authorId: user?._id || null, body })
  ticket.status = ticket.status === 'closed' ? 'in_progress' : ticket.status
  ticket.unreadByAdmin += 1
  ticket.unreadByUser = 0
  await ticket.save()
  await syncTicketMessageToConversation(ticket, ticket.messages.at(-1))
  await notifyAdminsForTicket(ticket, {
    type: 'system_ticket_reply',
    title: `Respuesta de usuario - ${ticket.publicCode}`,
    message: body,
  })
  return ticket
}
