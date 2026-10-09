import { OrganizationRequest } from '../models/OrganizationRequest.js'
import { Organization } from '../models/Organization.js'
import { User } from '../models/User.js'
import { sendNotif } from '../services/notifications.service.js'

async function notifyAdmins(payload) {
  const admins = await User.find({ role: 'admin' }).select('_id').lean()
  await Promise.all(admins.map(a => sendNotif(a._id, payload)))
}

function mapRequest(reqDoc) {
  return {
    id: String(reqDoc._id),
    name: reqDoc.name,
    discordGuildId: reqDoc.discordGuildId,
    message: reqDoc.message || '',
    status: reqDoc.status,
    rejectionReason: reqDoc.rejectionReason || '',
    requester: reqDoc.requester?.nick || reqDoc.requester?.email || String(reqDoc.requester?._id || reqDoc.requester),
    requesterId: String(reqDoc.requester?._id || reqDoc.requester),
    createdAt: reqDoc.createdAt,
    reviewedAt: reqDoc.reviewedAt,
  }
}

// POST /api/organizations/requests — el organizador pide activar su Discord.
export async function submitRequest(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim()
    const discordGuildId = String(req.body?.discordGuildId || '').trim()
    const message = String(req.body?.message || '').trim()

    if (!name || !discordGuildId) {
      return res.status(400).json({ message: 'name y discordGuildId son requeridos' })
    }

    const activeOrg = await Organization.findOne({
      $or: [{ owner: req.user._id }, { admins: req.user._id }],
    })
    if (activeOrg) {
      return res.status(409).json({ message: 'Ya tienes una organización activa' })
    }

    const pending = await OrganizationRequest.findOne({ requester: req.user._id, status: 'pending' })
    if (pending) {
      return res.status(409).json({ message: 'Ya tienes una solicitud pendiente de revisión' })
    }

    // El staff de GlitchGang (role admin) no pide permiso para activar su
    // propio Discord — se aprueba solo, al instante.
    if (req.user.role === 'admin') {
      const existingOrg = await Organization.findOne({ discordGuildId })
      if (existingOrg) {
        return res.status(409).json({ message: 'Ya existe una organización registrada para ese servidor de Discord' })
      }
      const org = await Organization.create({ name, discordGuildId, owner: req.user._id })
      const created = await OrganizationRequest.create({
        requester: req.user._id, name, discordGuildId, message,
        status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date(),
      })
      return res.status(201).json({ ...mapRequest(created), organizationId: String(org._id) })
    }

    const created = await OrganizationRequest.create({
      requester: req.user._id,
      name,
      discordGuildId,
      message,
    })

    await notifyAdmins({
      type: 'organization_request',
      title: 'Nueva solicitud de organización',
      message: `${req.user.nick || req.user.email} solicitó activar el servidor de Discord "${name}" (${discordGuildId}). Revísalo en Organizaciones.`,
      link: '/admin/organizaciones',
    })

    res.status(201).json(mapRequest(created))
  } catch (error) { next(error) }
}

// GET /api/organizations/mine/request — la ultima solicitud del organizador.
export async function myRequest(req, res, next) {
  try {
    const last = await OrganizationRequest.findOne({ requester: req.user._id }).sort({ createdAt: -1 })
    res.json({ request: last ? mapRequest(last) : null })
  } catch (error) { next(error) }
}

// GET /api/admin/organization-requests — staff lista las solicitudes.
export async function adminListRequests(req, res, next) {
  try {
    const { status = 'pending' } = req.query
    const filter = status === 'all' ? {} : { status }
    const requests = await OrganizationRequest
      .find(filter)
      .populate('requester', 'nick email')
      .sort({ createdAt: -1 })
    res.json({ requests: requests.map(mapRequest) })
  } catch (error) { next(error) }
}

// POST /api/admin/organization-requests/:id/review — staff aprueba o rechaza.
export async function adminReviewRequest(req, res, next) {
  try {
    const { action, rejectionReason } = req.body
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action debe ser "approve" o "reject"' })
    }

    const pending = await OrganizationRequest.findOne({ _id: req.params.id, status: 'pending' })
    if (!pending) {
      const exists = await OrganizationRequest.exists({ _id: req.params.id })
      return res.status(exists ? 409 : 404).json({ message: exists ? 'Solicitud ya procesada' : 'Solicitud no encontrada' })
    }

    const reviewedAt = new Date()

    if (action === 'reject') {
      await OrganizationRequest.updateOne(
        { _id: pending._id, status: 'pending' },
        { $set: { status: 'rejected', rejectionReason: rejectionReason || '', reviewedBy: req.user._id, reviewedAt } },
      )

      await sendNotif(pending.requester, {
        type: 'organization_request_rejected',
        title: 'Solicitud de organización rechazada',
        message: rejectionReason
          ? `Tu solicitud para activar "${pending.name}" fue rechazada. Motivo: ${rejectionReason}.`
          : `Tu solicitud para activar "${pending.name}" fue rechazada. Puedes volver a solicitarlo.`,
        link: '/organizador/crm',
        meta: { requestId: String(pending._id), organizationName: pending.name || '', reason: rejectionReason || '' },
      })

      return res.json({ ok: true, status: 'rejected' })
    }

    // action === 'approve'
    const existingOrg = await Organization.findOne({ discordGuildId: pending.discordGuildId })
    if (existingOrg) {
      return res.status(409).json({ message: 'Ya existe una organización registrada para ese servidor de Discord' })
    }

    const org = await Organization.create({
      name: pending.name,
      discordGuildId: pending.discordGuildId,
      owner: pending.requester,
    })

    await OrganizationRequest.updateOne(
      { _id: pending._id, status: 'pending' },
      { $set: { status: 'approved', rejectionReason: '', reviewedBy: req.user._id, reviewedAt } },
    )

    await sendNotif(pending.requester, {
      type: 'organization_request_approved',
      title: '¡Tu organización fue activada!',
      message: `Tu solicitud para activar "${pending.name}" fue aprobada. Tu Discord ya está conectado a GlitchGang.`,
      link: '/organizador/crm',
      meta: { requestId: String(pending._id), organizationId: String(org._id), organizationName: pending.name || '' },
    })

    res.json({ ok: true, status: 'approved', organizationId: String(org._id) })
  } catch (error) { next(error) }
}
