import { PublicationRequest } from '../models/PublicationRequest.js'
import { AdminActionLog } from '../models/AdminActionLog.js'

export const FREE_PUB_LIMIT = 3

function actorName(user) {
  return user?.nick || user?.email || 'Admin'
}

async function logAdminAction(req, payload) {
  req._adminAudited = true // ver services/adminAudit.js
  try {
    await AdminActionLog.create({ actor: req.user?._id || null, actorName: actorName(req.user), ...payload })
  } catch (error) {
    console.error('[publicationRequests] log error:', error.message)
  }
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

async function countThisMonth(userId) {
  return PublicationRequest.countDocuments({ user: userId, createdAt: { $gte: startOfMonth() } })
}

function mapRequest(r) {
  return {
    id: String(r._id),
    userId: r.user ? String(r.user) : null,
    userNick: r.userNick,
    userAvatar: r.userAvatar,
    type: r.type,
    title: r.title,
    description: r.description,
    images: r.images || [],
    link: r.link,
    message: r.message,
    status: r.status,
    submittedAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewNote: r.reviewNote,
  }
}

// GET /publication-requests/me/count — cuenta real (server-side) de
// publicaciones gratuitas usadas este mes, en vez del contador de
// localStorage que cualquiera podia resetear cambiando de navegador.
export async function getMyPublicationCount(req, res, next) {
  try {
    const count = await countThisMonth(req.user._id)
    res.json({ count, limit: FREE_PUB_LIMIT, remaining: Math.max(0, FREE_PUB_LIMIT - count), isOver: count >= FREE_PUB_LIMIT })
  } catch (error) { next(error) }
}

// POST /publication-requests — { type, title, description?, images?, link?, message? }
export async function createPublicationRequest(req, res, next) {
  try {
    const type = String(req.body?.type || '').trim()
    const title = String(req.body?.title || '').trim()
    if (!['tournament', 'team', 'event', 'creator', 'brand', 'profile'].includes(type)) {
      return res.status(400).json({ message: 'Tipo de publicacion invalido' })
    }
    if (!title) return res.status(400).json({ message: 'El titulo es requerido' })

    const request = await PublicationRequest.create({
      user: req.user._id,
      userNick: req.user.nick || 'Usuario',
      userAvatar: req.user.avatar || '',
      type,
      title,
      description: String(req.body?.description || '').trim().slice(0, 400),
      images: Array.isArray(req.body?.images) ? req.body.images.slice(0, 3).map(String) : [],
      link: String(req.body?.link || '').trim().slice(0, 300),
      message: String(req.body?.message || '').trim().slice(0, 200),
    })

    res.status(201).json({ request: mapRequest(request) })
  } catch (error) { next(error) }
}

// GET /admin/publication-requests
export async function listPublicationRequests(req, res, next) {
  try {
    const rows = await PublicationRequest.find().sort({ createdAt: -1 }).limit(500).lean()
    res.json({ requests: rows.map(mapRequest) })
  } catch (error) { next(error) }
}

// PATCH /admin/publication-requests/:id — { status: 'approved'|'rejected', reviewNote? }
export async function reviewPublicationRequest(req, res, next) {
  try {
    const status = String(req.body?.status || '').trim()
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Estado invalido' })
    }

    const request = await PublicationRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Solicitud no encontrada' })

    request.status = status
    request.reviewedAt = new Date()
    request.reviewedBy = req.user?._id || null
    request.reviewNote = String(req.body?.reviewNote || '').trim().slice(0, 400)
    await request.save()

    await logAdminAction(req, {
      action: status === 'approved' ? 'publication_request_approved' : 'publication_request_rejected',
      module: 'publication', targetId: String(request._id), targetCode: request.title,
      summary: request.reviewNote || `Solicitud ${status}`,
    })

    res.json({ request: mapRequest(request) })
  } catch (error) { next(error) }
}
