import mongoose from 'mongoose'
import { AdminActionLog } from '../models/AdminActionLog.js'
import { AdminResponseTemplate } from '../models/AdminResponseTemplate.js'
import { SystemTicket } from '../models/SystemTicket.js'
import { GameRequest } from '../models/GameRequest.js'
import { RoleApplication } from '../models/RoleApplication.js'
import { BrandApplication } from '../models/BrandApplication.js'
import { Campaign } from '../models/Campaign.js'
import { Creative } from '../models/Creative.js'
import { Invoice } from '../models/Invoice.js'
import { Ticket } from '../models/Ticket.js'
import { Tournament } from '../models/Tournament.js'
import { UniversityApplication } from '../models/UniversityApplication.js'
import { appendAdminTicketReply, ensureSystemTicketForSource, mapSystemTicket } from '../services/systemTickets.service.js'

const DEFAULT_TEMPLATES = [
  {
    key: 'NEED_MORE_INFO',
    title: 'Pedir mas informacion',
    module: 'all',
    tone: 'neutral',
    body: 'Para continuar con "{{subject}}", necesitamos capturas, enlaces o IDs relacionados. Responde desde mensajes para mantener el seguimiento del ticket.',
  },
  {
    key: 'UNDER_REVIEW',
    title: 'En revision',
    module: 'all',
    tone: 'neutral',
    body: 'Estamos revisando "{{subject}}". Tu caso quedo asignado y te avisaremos por notificaciones cuando exista una actualizacion.',
  },
  {
    key: 'RESOLVED',
    title: 'Caso resuelto',
    module: 'all',
    tone: 'positive',
    body: 'Tu caso "{{subject}}" se resolvio correctamente. Si necesitas continuar, responde en el mismo ticket desde mensajes.',
  },
  {
    key: 'POLICY_WARNING',
    title: 'Advertencia de politica',
    module: 'report',
    tone: 'warning',
    body: 'Detectamos actividad que requiere correccion en "{{subject}}". Revisa las reglas de la plataforma y responde si tienes evidencia adicional.',
  },
]

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 }

function clean(value = '', max = 800) {
  return String(value || '').trim().slice(0, max)
}

function docId(doc) {
  return String(doc?._id || doc?.id || '')
}

function actorName(user) {
  return user?.nick || user?.email || user?.name || 'Admin'
}

async function logAction(req, payload) {
  req._adminAudited = true // ver services/adminAudit.js
  try {
    await AdminActionLog.create({
      actor: req.user?._id || null,
      actorName: actorName(req.user),
      ...payload,
    })
  } catch (error) {
    console.error('[adminOperations] log error:', error.message)
  }
}

function requesterFromUser(user, fallback = 'Usuario') {
  if (!user) return fallback
  return user.nick || user.email || user.playerCode || fallback
}

function systemTicketItem(ticket) {
  return {
    id: docId(ticket),
    module: 'system_ticket',
    kind: ticket.purpose || 'help',
    title: ticket.subject || 'Ticket del sistema',
    description: ticket.messages?.at?.(-1)?.body || ticket.sourceLabel || '',
    status: ticket.status,
    priority: ticket.priority || 'medium',
    requesterName: ticket.requesterName || requesterFromUser(ticket.requester),
    requesterId: ticket.requester ? docId(ticket.requester) : null,
    sourceId: ticket.sourceId || '',
    sourceType: ticket.sourceType || 'system',
    ticketCode: ticket.publicCode || ticket.internalCode || docId(ticket),
    assignedTo: ticket.assignedTo ? docId(ticket.assignedTo) : null,
    assignedName: ticket.assignedTo?.nick || ticket.assignedTo?.email || '',
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    unread: ticket.unreadByAdmin || 0,
    actionPath: `/admin/reportes?ticket=${encodeURIComponent(ticket.publicCode || docId(ticket))}`,
    actions: ['assign', 'reply', 'status'],
    meta: {
      countryCode: ticket.countryCode,
      creatorCode: ticket.creatorCode,
      createdYmd: ticket.createdYmd,
      sourceCode: ticket.sourceCode,
      searchCode: ticket.searchCode,
    },
  }
}

function linkedTicketData(doc) {
  const ticket = doc.systemTicket && typeof doc.systemTicket === 'object' ? doc.systemTicket : null
  return ticket ? {
    systemTicketId: docId(ticket),
    ticketCode: ticket.publicCode || ticket.internalCode,
    unread: ticket.unreadByAdmin || 0,
  } : { systemTicketId: doc.systemTicket ? String(doc.systemTicket) : null, ticketCode: '', unread: 0 }
}

function genericItem(doc, module, values) {
  const link = linkedTicketData(doc)
  const code = values.code || link.ticketCode || doc.publicCode || doc.internalCode || doc.invoiceNumber || doc.tournamentCode || doc.publicId || docId(doc)
  return {
    id: docId(doc),
    module,
    kind: values.kind || module,
    title: values.title || 'Solicitud',
    description: values.description || '',
    status: values.status || doc.status || 'pending',
    priority: values.priority || doc.priority || 'medium',
    requesterName: values.requesterName || 'Usuario',
    requesterId: values.requesterId || null,
    sourceId: docId(doc),
    sourceType: module.replaceAll('_', '-'),
    ticketCode: code,
    systemTicketId: link.systemTicketId,
    assignedTo: doc.assignedTo ? docId(doc.assignedTo) : null,
    assignedName: doc.assignedTo?.nick || doc.assignedTo?.email || '',
    createdAt: values.createdAt || doc.createdAt || doc.submittedAt,
    updatedAt: values.updatedAt || doc.updatedAt || doc.reviewedAt || doc.createdAt,
    unread: link.unread || doc.unreadByAdmin || 0,
    actionPath: values.actionPath || '/admin',
    actions: values.actions || ['open'],
    meta: values.meta || {},
  }
}

function sortQueue(items) {
  return items.sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.priority] || 0
    const pb = PRIORITY_WEIGHT[b.priority] || 0
    if (pb !== pa) return pb - pa
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  })
}

async function ensureDefaultTemplates() {
  const count = await AdminResponseTemplate.countDocuments()
  if (count > 0) return
  await AdminResponseTemplate.insertMany(DEFAULT_TEMPLATES.map(t => ({ ...t })), { ordered: false }).catch(() => {})
}

export async function getOperationsQueue(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 120), 20), 250)
    const [
      systemTickets,
      gameRequests,
      roleApplications,
      brandApplications,
      brandTickets,
      invoices,
      campaigns,
      creatives,
      tournaments,
      universities,
    ] = await Promise.all([
      SystemTicket.find({ status: { $ne: 'closed' } }).populate('requester', 'nick email playerCode').populate('assignedTo', 'nick email').sort({ unreadByAdmin: -1, updatedAt: -1 }).limit(limit).lean(),
      GameRequest.find({ status: { $in: ['pending', 'reviewing'] } }).populate('requester', 'nick email playerCode').populate('systemTicket').sort({ updatedAt: -1 }).limit(40).lean(),
      RoleApplication.find({ status: 'pending' }).populate('userId', 'nick email playerCode').populate('systemTicket').sort({ updatedAt: -1 }).limit(40).lean(),
      BrandApplication.find({ status: 'pending' }).populate('systemTicket').sort({ updatedAt: -1 }).limit(40).lean(),
      Ticket.find({ status: { $ne: 'closed' } }).populate('brandId', 'name code').populate('systemTicket').populate('assignedTo', 'nick email').sort({ unreadByAdmin: -1, updatedAt: -1 }).limit(40).lean(),
      Invoice.find({ status: 'pending' }).populate('brandId', 'name code').populate('campaignId', 'name publicCode').sort({ updatedAt: -1 }).limit(40).lean(),
      Campaign.find({ $or: [{ status: 'pending' }, { 'payment.status': 'pending' }] }).populate('brandId', 'name code').sort({ updatedAt: -1 }).limit(40).lean(),
      Creative.find({ status: 'review' }).populate('brandId', 'name code').sort({ updatedAt: -1 }).limit(40).lean(),
      Tournament.find({ $or: [{ status: 'draft' }, { reports: { $elemMatch: { status: { $in: ['pending', 'open', 'reviewing', 'in_review'] } } } }] }).populate('organizer', 'nick email playerCode').sort({ updatedAt: -1 }).limit(40).lean(),
      UniversityApplication.find({ status: 'pending' }).populate('user', 'nick email playerCode').populate('systemTicket').sort({ updatedAt: -1 }).limit(40).lean(),
    ])

    const items = [
      ...systemTickets.map(systemTicketItem),
      ...gameRequests.map(doc => genericItem(doc, 'game_request', {
        kind: 'solicitud_juego',
        title: `Solicitud de juego: ${doc.gameName}`,
        description: doc.message,
        requesterName: doc.requesterName || requesterFromUser(doc.requester),
        requesterId: doc.requester ? docId(doc.requester) : null,
        actionPath: `/admin/reportes?source=game-request&id=${docId(doc)}`,
        actions: ['reply', 'status'],
        meta: { genre: doc.genre, platform: doc.platform, links: doc.links },
      })),
      ...roleApplications.map(doc => genericItem(doc, 'role_application', {
        kind: 'solicitud_rol',
        title: `Solicitud de rol: ${doc.roleLabel}`,
        description: doc.formData?.experience || doc.formData?.bio || doc.dni || '',
        requesterName: requesterFromUser(doc.userId),
        requesterId: doc.userId ? docId(doc.userId) : null,
        actionPath: '/admin/autorizaciones',
        actions: ['reply', 'open'],
        meta: { roleId: doc.roleId, publicCode: doc.publicCode },
      })),
      ...brandApplications.map(doc => genericItem(doc, 'brand_application', {
        kind: 'solicitud_marca',
        title: `Marca pendiente: ${doc.companyName}`,
        description: doc.message || doc.tagline || doc.industry,
        requesterName: doc.contactName || doc.companyName,
        actionPath: '/admin/marcas',
        actions: ['reply', 'open'],
        meta: { email: doc.contactEmail, tier: doc.tierInterest, website: doc.website },
      })),
      ...brandTickets.map(doc => genericItem(doc, 'brand_ticket', {
        kind: doc.category || 'brand',
        title: doc.subject,
        description: doc.messages?.at?.(-1)?.body || '',
        requesterName: doc.brandId?.name || 'Marca',
        requesterId: doc.authorId ? docId(doc.authorId) : null,
        priority: doc.priority || 'low',
        actionPath: '/admin/marcas',
        actions: ['assign', 'reply', 'status'],
        meta: { brand: doc.brandId?.code || doc.brandId?.name || '', publicCode: doc.publicCode },
      })),
      ...invoices.map(doc => genericItem(doc, 'payment', {
        kind: 'factura',
        title: `Pago pendiente: ${doc.invoiceNumber}`,
        description: doc.brandNotes || doc.campaignId?.name || '',
        requesterName: doc.brandId?.name || 'Marca',
        priority: 'high',
        actionPath: '/admin/marcas',
        actions: ['open'],
        meta: { amount: doc.amount, currency: doc.currency, campaign: doc.campaignId?.name || '' },
      })),
      ...campaigns.map(doc => genericItem(doc, 'payment', {
        kind: doc.payment?.status === 'pending' ? 'comprobante_campana' : 'campana',
        title: doc.name,
        description: doc.objective || doc.adminNotes || '',
        requesterName: doc.brandId?.name || 'Marca',
        priority: doc.payment?.status === 'pending' ? 'high' : 'medium',
        actionPath: '/admin/marcas',
        actions: ['open'],
        meta: { budget: doc.budget, paymentStatus: doc.payment?.status || '', brand: doc.brandId?.code || '' },
      })),
      ...creatives.map(doc => genericItem(doc, 'brand_application', {
        kind: 'creatividad',
        title: `Creatividad en revision: ${doc.name}`,
        description: doc.format || doc.adType || '',
        requesterName: doc.brandId?.name || 'Marca',
        actionPath: '/admin/marcas',
        actions: ['open'],
        meta: { adType: doc.adType, sizeBytes: doc.sizeBytes, brand: doc.brandId?.code || '' },
      })),
      ...tournaments.map(doc => genericItem(doc, 'tournament', {
        kind: doc.status === 'draft' ? 'revision_torneo' : 'reporte_torneo',
        title: doc.title,
        description: doc.description || doc.reports?.find(r => ['pending', 'open', 'reviewing', 'in_review'].includes(r.status))?.detail || '',
        requesterName: requesterFromUser(doc.organizer, 'Organizador'),
        requesterId: doc.organizer ? docId(doc.organizer) : null,
        priority: doc.reports?.some(r => ['pending', 'open', 'reviewing', 'in_review'].includes(r.status)) ? 'high' : 'medium',
        actionPath: '/admin/torneos',
        actions: ['open'],
        meta: { game: doc.game, publicId: doc.publicId, tournamentCode: doc.tournamentCode, status: doc.status },
      })),
      ...universities.map(doc => genericItem(doc, 'university', {
        kind: 'validacion_universitaria',
        title: `Universidad: ${doc.universityName}`,
        description: `${doc.program || ''} ${doc.campus || ''}`.trim(),
        requesterName: requesterFromUser(doc.user),
        requesterId: doc.user ? docId(doc.user) : null,
        actionPath: '/admin/universidades',
        actions: ['reply', 'open'],
        meta: { publicCode: doc.publicCode, studentId: doc.studentId, city: doc.city, region: doc.region },
      })),
    ]

    res.json({ items: sortQueue(items).slice(0, limit), generatedAt: new Date().toISOString() })
  } catch (error) {
    next(error)
  }
}

export async function getOperationLogs(req, res, next) {
  try {
    const filter = {}
    if (req.query.module) filter.module = clean(req.query.module, 80)
    if (req.query.targetId) filter.targetId = clean(req.query.targetId, 120)
    const logs = await AdminActionLog.find(filter).populate('actor', 'nick email').sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 300, 1000)).lean()
    res.json(logs)
  } catch (error) {
    next(error)
  }
}

export async function listOperationTemplates(req, res, next) {
  try {
    await ensureDefaultTemplates()
    const filter = { active: true }
    if (req.query.module && req.query.module !== 'all') filter.module = { $in: ['all', req.query.module] }
    const templates = await AdminResponseTemplate.find(filter).sort({ module: 1, title: 1 }).lean()
    res.json(templates)
  } catch (error) {
    next(error)
  }
}

export async function createOperationTemplate(req, res, next) {
  try {
    const key = clean(req.body.key || req.body.title, 80).toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    const template = await AdminResponseTemplate.create({
      key,
      title: clean(req.body.title, 120),
      module: req.body.module || 'all',
      tone: req.body.tone || 'neutral',
      body: clean(req.body.body, 1600),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    })
    await logAction(req, { action: 'template_create', module: 'admin_operations', targetId: docId(template), targetCode: template.key, summary: `Plantilla creada: ${template.title}` })
    res.status(201).json(template)
  } catch (error) {
    next(error)
  }
}

export async function updateOperationTemplate(req, res, next) {
  try {
    const update = {}
    for (const key of ['title', 'module', 'tone', 'body', 'active']) {
      if (req.body[key] !== undefined) update[key] = key === 'body' ? clean(req.body[key], 1600) : req.body[key]
    }
    update.updatedBy = req.user?._id || null
    const template = await AdminResponseTemplate.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada.' })
    await logAction(req, { action: 'template_update', module: 'admin_operations', targetId: docId(template), targetCode: template.key, summary: `Plantilla actualizada: ${template.title}` })
    res.json(template)
  } catch (error) {
    next(error)
  }
}

async function findOperationalTarget(module, id) {
  if (!mongoose.isValidObjectId(id)) return null
  const map = {
    system_ticket: () => SystemTicket.findById(id),
    brand_ticket: () => Ticket.findById(id),
    game_request: () => GameRequest.findById(id).populate('systemTicket'),
    role_application: () => RoleApplication.findById(id).populate('systemTicket'),
    brand_application: () => BrandApplication.findById(id).populate('systemTicket'),
    university: () => UniversityApplication.findById(id).populate('systemTicket'),
    payment: () => Invoice.findById(id),
    tournament: () => Tournament.findById(id),
  }
  return map[module] ? map[module]() : null
}

export async function assignOperationItem(req, res, next) {
  try {
    const target = await findOperationalTarget(req.params.module, req.params.id)
    if (!target) return res.status(404).json({ message: 'Elemento no encontrado.' })
    if (!target.schema?.path('assignedTo')) return res.status(409).json({ message: 'Este modulo no soporta asignacion directa todavia.' })
    const before = { assignedTo: target.assignedTo ? String(target.assignedTo) : null }
    target.assignedTo = req.body.assignedTo || req.user?._id || null
    await target.save()
    await logAction(req, {
      action: 'assign',
      module: req.params.module,
      targetId: docId(target),
      targetCode: target.publicCode || target.internalCode || '',
      summary: `Asignado a ${actorName(req.user)}`,
      before,
      after: { assignedTo: target.assignedTo ? String(target.assignedTo) : null },
    })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

export async function updateOperationItemStatus(req, res, next) {
  try {
    const target = await findOperationalTarget(req.params.module, req.params.id)
    if (!target) return res.status(404).json({ message: 'Elemento no encontrado.' })
    const status = clean(req.body.status, 40)
    const before = { status: target.status }
    if (!status) return res.status(400).json({ message: 'status es requerido.' })
    if (target.schema?.path('status')?.enumValues?.length && !target.schema.path('status').enumValues.includes(status)) {
      return res.status(400).json({ message: 'Estado no valido para este modulo.' })
    }
    target.status = status
    if (status === 'closed' || status === 'approved' || status === 'rejected') {
      if ('closedAt' in target && status === 'closed') target.closedAt = new Date()
      if ('reviewedAt' in target) target.reviewedAt = new Date()
      if ('reviewedBy' in target) target.reviewedBy = req.user?._id || null
    }
    await target.save()
    await logAction(req, {
      action: 'status',
      module: req.params.module,
      targetId: docId(target),
      targetCode: target.publicCode || target.internalCode || target.invoiceNumber || '',
      summary: `Estado cambiado a ${status}`,
      before,
      after: { status: target.status },
    })
    res.json({ ok: true, status: target.status })
  } catch (error) {
    next(error)
  }
}

async function ensureTargetSystemTicket(target, module, req) {
  if (module === 'system_ticket') return target
  if (target.systemTicket) return target.systemTicket
  if (module === 'brand_ticket') {
    const systemTicket = await ensureSystemTicketForSource('brand-ticket', docId(target), async () => ({
      requester: target.authorId,
      requesterName: 'Marca',
      requesterEmail: '',
      purpose: 'brand',
      priority: target.priority === 'high' ? 'high' : 'medium',
      subject: target.subject,
      message: target.messages?.[0]?.body || target.subject,
      author: 'user',
      authorId: target.authorId,
      sourceType: 'brand-ticket',
      sourceId: docId(target),
      sourceLabel: target.publicCode,
      metadata: { brandId: String(target.brandId), category: target.category, publicCode: target.publicCode },
    }))
    target.systemTicket = systemTicket._id
    await target.save()
    return systemTicket
  }
  return null
}

export async function replyOperationItem(req, res, next) {
  try {
    const message = clean(req.body.message, 2400)
    if (!message) return res.status(400).json({ message: 'message es requerido.' })
    const target = await findOperationalTarget(req.params.module, req.params.id)
    if (!target) return res.status(404).json({ message: 'Elemento no encontrado.' })
    const systemTicket = await ensureTargetSystemTicket(target, req.params.module, req)
    if (!systemTicket) {
      return res.status(409).json({ message: 'Este elemento aun no tiene ticket formal para responder.' })
    }
    if (req.params.module === 'brand_ticket') {
      target.messages.push({ author: 'admin', authorId: req.user?._id || null, body: message })
      target.status = target.status === 'open' ? 'in_progress' : target.status
      target.unreadByBrand += 1
      target.unreadByAdmin = 0
      target.assignedTo = req.user?._id || target.assignedTo
      await target.save()
    }
    // close: true cuando se responde con la plantilla "Caso resuelto".
    const ticket = await appendAdminTicketReply(systemTicket, req.user, message, { close: req.body.close === true })
    await logAction(req, {
      action: 'reply',
      module: req.params.module,
      targetId: docId(target),
      targetCode: ticket?.publicCode || target.publicCode || target.internalCode || '',
      summary: message,
      metadata: { systemTicket: ticket ? mapSystemTicket(ticket) : null },
    })
    res.json({ ok: true, ticket: ticket ? mapSystemTicket(ticket) : null })
  } catch (error) {
    next(error)
  }
}
