import { RoleApplication } from '../models/RoleApplication.js'
import { User } from '../models/User.js'
import { sendNotif } from '../services/notifications.service.js'
import { createSpecializedRoleCodes, createRoleApplicationCodes, SPECIALIZED_ROLE_PREFIX } from '../services/codes.service.js'
import {
  appendAdminTicketReply,
  createSystemTicketRecord,
  ensureSystemTicketForSource,
} from '../services/systemTickets.service.js'


const VALID_ROLES = ['organizer', 'creator', 'coach', 'caster', 'analyst', 'moderator', 'sponsor']
const ROLE_CODE_FIELDS = Object.freeze({
  organizer: ['organizerCode', 'organizerInternalCode'],
  creator: ['creatorCode', 'creatorInternalCode'],
  coach: ['coachCode', 'coachInternalCode'],
  caster: ['casterCode', 'casterInternalCode'],
  analyst: ['analystCode', 'analystInternalCode'],
  moderator: ['moderatorCode', 'moderatorInternalCode'],
  sponsor: ['sponsorCode', 'sponsorInternalCode'],
})

// POST /role-applications — usuario autenticado envía solicitud
export async function submitApplication(req, res, next) {
  try {
    const { roleId, roleLabel, dni, documentFileName, documentUrl, formData } = req.body

    if (!VALID_ROLES.includes(roleId)) {
      return res.status(400).json({ error: 'Rol no válido' })
    }
    if (!dni?.trim()) {
      return res.status(400).json({ error: 'El campo DNI es obligatorio' })
    }

    // Evitar duplicados: no puede haber una solicitud pending o approved para el mismo rol
    const existing = await RoleApplication.findOne({
      userId: req.user._id,
      roleId,
      status: { $in: ['pending', 'approved'] },
    })
    if (existing) {
      return res.status(409).json({ error: 'Ya tienes una solicitud activa para este rol', status: existing.status })
    }

    const codes = await createRoleApplicationCodes(req.user.playerCode, req.user._id, roleId)
    const app = await RoleApplication.create({
      publicCode: codes.publicCode,
      internalCode: codes.internalCode,
      userId: req.user._id,
      roleId,
      roleLabel,
      dni: dni.trim(),
      documentFileName: documentFileName || '',
      documentUrl:      documentUrl      || '',
      formData: formData || {},
    })

    const ticket = await createSystemTicketRecord({
      requester: req.user._id,
      requesterUser: req.user,
      requesterName: req.user.nick || req.user.email || 'Usuario',
      requesterEmail: req.user.email || '',
      purpose: 'account',
      priority: 'medium',
      subject: `Solicitud de rol: ${roleLabel || roleId}`,
      message: [
        `El usuario solicito acceso al rol ${roleLabel || roleId}.`,
        `DNI: ${dni.trim()}`,
        documentFileName ? `Documento: ${documentFileName}` : '',
      ].filter(Boolean).join('\n'),
      author: 'user',
      authorId: req.user._id,
      sourceType: 'role-application',
      sourceId: String(app._id),
      sourceLabel: roleLabel || roleId,
      metadata: {
        roleId,
        roleLabel,
        publicCode: app.publicCode,
        documentFileName: documentFileName || '',
        documentUrl: documentUrl || '',
      },
    })
    app.systemTicket = ticket._id
    await app.save()

    res.status(201).json({ ok: true, id: app._id, publicCode: app.publicCode, status: 'pending' })
  } catch (e) { next(e) }
}

// GET /role-applications/my — solicitudes del usuario autenticado
export async function myApplications(req, res, next) {
  try {
    const apps = await RoleApplication.find({ userId: req.user._id }).sort({ createdAt: -1 })
    res.json(apps)
  } catch (e) { next(e) }
}

// GET /role-applications/admin — admin lista todas las solicitudes
export async function adminListApplications(req, res, next) {
  try {
    const { status = 'pending' } = req.query
    const filter = status === 'all' ? {} : { status }
    const apps = await RoleApplication
      .find(filter)
      .populate('userId', 'nick email playerCode roleProfiles')
      .sort({ createdAt: -1 })
      .lean()

    // app.publicCode/internalCode son el codigo de ESTA solicitud (formato
    // RAP-...), no el codigo real del rol -- eso vive en el perfil del
    // usuario y solo existe una vez aprobada. Se adjunta aparte (roleCode)
    // para que el admin no confunda uno con otro en la tabla.
    const withRoleCode = apps.map(app => {
      const fields = ROLE_CODE_FIELDS[app.roleId]
      const profile = fields ? app.userId?.roleProfiles?.[app.roleId] : null
      return {
        ...app,
        roleCode: profile?.[fields?.[0]] || null,
        roleInternalCode: profile?.[fields?.[1]] || null,
      }
    })

    res.json(withRoleCode)
  } catch (e) { next(e) }
}

// GET /role-applications/admin/stats — resumen por rol
export async function adminRoleStats(req, res, next) {
  try {
    const [appStats, userStats] = await Promise.all([
      RoleApplication.aggregate([
        { $group: { _id: { roleId: '$roleId', status: '$status' }, count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: { $nin: ['player', 'admin', 'brand'] } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ])

    const result = {}
    appStats.forEach(({ _id, count }) => {
      if (!result[_id.roleId]) result[_id.roleId] = { pending: 0, approved: 0, rejected: 0, users: 0 }
      result[_id.roleId][_id.status] = count
    })
    userStats.forEach(({ _id, count }) => {
      if (!result[_id]) result[_id] = { pending: 0, approved: 0, rejected: 0, users: 0 }
      result[_id].users = count
    })

    res.json(result)
  } catch (e) { next(e) }
}

// PATCH /role-applications/admin/:id — admin aprueba o rechaza
export async function adminReviewApplication(req, res, next) {
  try {
    const { action, rejectionReason } = req.body // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action debe ser "approve" o "reject"' })
    }

    const pending = await RoleApplication.findOne({ _id: req.params.id, status: 'pending' }).populate('userId', 'nick email playerCode countryCode')
    if (!pending) {
      const exists = await RoleApplication.exists({ _id: req.params.id })
      return res.status(exists ? 409 : 404).json({ error: exists ? 'Solicitud ya procesada' : 'Solicitud no encontrada' })
    }

    const reviewedAt = new Date()

    if (action === 'reject') {
      const app = await RoleApplication.findOneAndUpdate(
        { _id: pending._id, status: 'pending' },
        { $set: { status: 'rejected', rejectionReason: rejectionReason || '', reviewedBy: req.user._id, reviewedAt } },
        { new: true, runValidators: true },
      )
      if (!app) return res.status(409).json({ error: 'Solicitud ya procesada' })

      const ticket = pending.systemTicket || await ensureSystemTicketForSource('role-application', String(pending._id), async () => ({
        requester: pending.userId?._id || pending.userId,
        requesterUser: pending.userId,
        requesterName: pending.userId?.nick || pending.userId?.email || 'Usuario',
        requesterEmail: pending.userId?.email || '',
        purpose: 'account',
        priority: 'medium',
        subject: `Solicitud de rol: ${pending.roleLabel || pending.roleId}`,
        message: `El usuario solicito acceso al rol ${pending.roleLabel || pending.roleId}.`,
        author: 'user',
        authorId: pending.userId?._id || pending.userId,
        sourceType: 'role-application',
        sourceId: String(pending._id),
        sourceLabel: pending.roleLabel || pending.roleId,
        metadata: { roleId: pending.roleId, roleLabel: pending.roleLabel, publicCode: pending.publicCode },
      }))
      if (!pending.systemTicket) {
        await RoleApplication.updateOne({ _id: pending._id }, { $set: { systemTicket: ticket._id } })
      }
      await appendAdminTicketReply(ticket, req.user, rejectionReason
        ? `Tu solicitud de ${app.roleLabel} fue rechazada. Motivo: ${rejectionReason}.`
        : `Tu solicitud de ${app.roleLabel} fue rechazada. Puedes volver a solicitarla con nueva documentacion.`, { close: true })

      await sendNotif(app.userId, {
        type: 'role_application_rejected',
        title: `Solicitud de ${app.roleLabel} rechazada`,
        message: rejectionReason
          ? `Tu solicitud para el rol de ${app.roleLabel} fue rechazada. Motivo: ${rejectionReason}. Puedes volver a solicitarlo con nueva documentación.`
          : `Tu solicitud para el rol de ${app.roleLabel} fue rechazada. Puedes volver a solicitarlo con nueva documentación.`,
        link: '/solicitar-rol',
        meta: { applicationId: String(app._id), roleId: app.roleId || '', roleLabel: app.roleLabel || '', reason: rejectionReason || '' },
      })

      return res.json({ ok: true, status: 'rejected' })
    }

    if (action === 'approve') {
      const user = await User.findById(pending.userId?._id || pending.userId)
      if (!user) return res.status(404).json({ error: 'Usuario de la solicitud no encontrado' })
      if (!SPECIALIZED_ROLE_PREFIX[pending.roleId]) return res.status(400).json({ error: 'Rol especializado no soportado' })

      const [publicField, internalField] = ROLE_CODE_FIELDS[pending.roleId]
      const existingProfile = user.roleProfiles?.[pending.roleId]
      const codes = existingProfile?.[publicField]
        ? {
            publicCode: existingProfile[publicField],
            internalCode: existingProfile[internalField],
            approvedAt: existingProfile.approvedAt || reviewedAt,
          }
        : await createSpecializedRoleCodes(pending.roleId, user.countryCode, reviewedAt)

      const app = await RoleApplication.findOneAndUpdate(
        { _id: pending._id, status: 'pending' },
        { $set: { status: 'approved', rejectionReason: '', reviewedBy: req.user._id, reviewedAt } },
        { new: true, runValidators: true },
      )
      if (!app) return res.status(409).json({ error: 'Solicitud ya procesada' })

      const ticket = pending.systemTicket || await ensureSystemTicketForSource('role-application', String(pending._id), async () => ({
        requester: pending.userId?._id || pending.userId,
        requesterUser: pending.userId,
        requesterName: pending.userId?.nick || pending.userId?.email || 'Usuario',
        requesterEmail: pending.userId?.email || '',
        purpose: 'account',
        priority: 'medium',
        subject: `Solicitud de rol: ${pending.roleLabel || pending.roleId}`,
        message: `El usuario solicito acceso al rol ${pending.roleLabel || pending.roleId}.`,
        author: 'user',
        authorId: pending.userId?._id || pending.userId,
        sourceType: 'role-application',
        sourceId: String(pending._id),
        sourceLabel: pending.roleLabel || pending.roleId,
        metadata: { roleId: pending.roleId, roleLabel: pending.roleLabel, publicCode: pending.publicCode },
      }))
      if (!pending.systemTicket) {
        await RoleApplication.updateOne({ _id: pending._id }, { $set: { systemTicket: ticket._id } })
      }

      try {
        const profilePath = `roleProfiles.${app.roleId}`
        const update = {
          $set: {
            [`${profilePath}.${publicField}`]: codes.publicCode,
            [`${profilePath}.${internalField}`]: codes.internalCode,
            [`${profilePath}.approvedAt`]: codes.approvedAt,
            [`${profilePath}.applicationId`]: app._id,
            [`${profilePath}.details`]: pending.formData || {},
          },
          $addToSet: { roles: app.roleId },
        }
        if (!['admin', 'brand'].includes(user.role)) update.$set.role = app.roleId

        // organizerCode/internalCode/approvedAt/applicationId son immutable en
        // el schema (no se pueden RE-asignar una vez aprobados) -- pero Mongoose
        // bloquea en silencio CUALQUIER $set sobre un path immutable via
        // updateOne/findOneAndUpdate, incluida la primera vez que se escribe
        // (el campo viene undefined). Sin overwriteImmutable, este updateOne
        // reportaba modifiedCount:1 (por el $addToSet de roles) pero
        // roleProfiles.<rol> se quedaba vacio -- la solicitud quedaba
        // "aprobada" y el usuario ganaba el rol, pero nunca el codigo real.
        await User.updateOne({ _id: app.userId }, update, { runValidators: true, overwriteImmutable: true })
      } catch (error) {
        await RoleApplication.updateOne(
          { _id: app._id, status: 'approved', reviewedBy: req.user._id },
          { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } },
        )
        throw error
      }

      const panelPath = `/${app.roleId === 'organizer' ? 'organizador' : app.roleId === 'creator' ? 'creador' : app.roleId === 'analyst' ? 'analista' : app.roleId === 'moderator' ? 'moderador' : app.roleId}`
      // Tarjeta de accion (NotificationActionCard): con roleId/roleLabel/profilePublic
      // ya lleva "Configurar tarjeta profesional" como boton principal, asi que
      // reemplaza al antiguo segundo aviso role_profile_complete_reminder.
      const approvedUser = await User.findById(app.userId).select('showcaseCards').lean()
      await sendNotif(app.userId, {
        type: 'role_application_approved',
        title: `¡Rol de ${app.roleLabel} aprobado!`,
        message: `Tu solicitud para el rol de ${app.roleLabel} fue aprobada por la administración. Tu panel ya está disponible en el menú lateral.`,
        link: panelPath,
        meta: {
          roleId: app.roleId,
          roleLabel: app.roleLabel,
          profilePublic: (approvedUser?.showcaseCards || []).includes(app.roleId),
        },
      })
      await appendAdminTicketReply(ticket, req.user, `Tu solicitud para el rol de ${app.roleLabel} fue aprobada. Tu panel ya esta disponible.`, { close: true })

      return res.json({
        ok: true,
        status: 'approved',
        roleIdentity: { role: app.roleId, publicCode: codes.publicCode, internalCode: codes.internalCode },
      })
    }
  } catch (e) { next(e) }
}
