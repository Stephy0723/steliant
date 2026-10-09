import { Organization } from '../models/Organization.js'
import { User } from '../models/User.js'
import { sendNotif } from '../services/notifications.service.js'

function mapOrganization(org) {
  return {
    id: String(org._id),
    name: org.name,
    discordGuildId: org.discordGuildId,
    welcomeChannelId: org.welcomeChannelId || '',
    status: org.status,
    createdAt: org.createdAt,
  }
}

// GET /api/organizations/mine — la organizacion del organizador logueado
// (dueno o admin de ella), o null si todavia no tiene una activa.
export async function getMyOrganization(req, res, next) {
  try {
    const org = await Organization.findOne({
      $or: [{ owner: req.user._id }, { admins: req.user._id }],
    }).lean()
    res.json({ organization: org ? mapOrganization(org) : null })
  } catch (error) { next(error) }
}

// GET /api/organizations/discord-access — estado del acceso del organizador al
// Discord de GlitchGang para sus torneos.
export async function getDiscordAccess(req, res, next) {
  try {
    const d = req.user.organizerDiscord || {}
    res.json({ status: d.status || 'none', requestedAt: d.requestedAt || null, enabledAt: d.enabledAt || null })
  } catch (error) { next(error) }
}

// POST /api/organizations/discord-access — el organizador solicita el acceso.
export async function requestDiscordAccess(req, res, next) {
  try {
    if (!req.user.roleProfiles?.organizer?.organizerCode) {
      return res.status(403).json({ message: 'Necesitas un organizerCode aprobado.' })
    }
    const current = req.user.organizerDiscord?.status
    if (current === 'enabled') return res.json({ status: 'enabled' })
    if (current === 'pending') return res.json({ status: 'pending' })

    const note = String(req.body?.note || '').trim().slice(0, 500)
    await User.updateOne({ _id: req.user._id }, {
      $set: { 'organizerDiscord.status': 'pending', 'organizerDiscord.requestedAt': new Date(), 'organizerDiscord.note': note },
    })

    const admins = await User.find({ role: 'admin' }).select('_id').lean()
    await Promise.all(admins.map(a => sendNotif(a._id, {
      type: 'organizer_discord_request',
      title: 'Solicitud de acceso a Discord',
      message: `${req.user.nick || req.user.email} pide habilitar Discord de GlitchGang para sus torneos.${note ? ` Nota: ${note}` : ''}`,
      link: '/admin/organizaciones',
      meta: { requesterId: String(req.user._id), requesterNick: req.user.nick || '', requesterAvatar: req.user.avatar || '', note: note || '' },
    }).catch(() => {})))

    res.json({ status: 'pending' })
  } catch (error) { next(error) }
}

// GET /api/admin/discord-access?status=pending — lista para el admin.
export async function adminListDiscordAccess(req, res, next) {
  try {
    const status = String(req.query.status || 'pending')
    const filter = status === 'all' ? { 'organizerDiscord.status': { $in: ['pending', 'enabled', 'revoked'] } } : { 'organizerDiscord.status': status }
    const users = await User.find(filter)
      .select('nick email playerCode organizerDiscord roleProfiles.organizer.organizerCode')
      .sort({ 'organizerDiscord.requestedAt': -1 })
      .lean()
    res.json({ requests: users.map(u => ({
      userId: String(u._id), nick: u.nick, email: u.email, playerCode: u.playerCode,
      organizerCode: u.roleProfiles?.organizer?.organizerCode || '',
      status: u.organizerDiscord?.status || 'none',
      requestedAt: u.organizerDiscord?.requestedAt || null,
      note: u.organizerDiscord?.note || '',
    })) })
  } catch (error) { next(error) }
}

// POST /api/admin/discord-access/:userId/review  { decision: 'enable' | 'reject' }
export async function adminReviewDiscordAccess(req, res, next) {
  try {
    const decision = String(req.body?.decision || '')
    if (!['enable', 'reject'].includes(decision)) return res.status(400).json({ message: 'decision invalida' })
    const target = await User.findById(req.params.userId).select('_id nick organizerDiscord')
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado' })

    if (decision === 'enable') {
      target.organizerDiscord.status = 'enabled'
      target.organizerDiscord.enabledAt = new Date()
      target.organizerDiscord.enabledBy = req.user._id
    } else {
      target.organizerDiscord.status = target.organizerDiscord.status === 'enabled' ? 'revoked' : 'none'
    }
    await target.save()

    sendNotif(target._id, {
      type: 'organizer_discord_reviewed',
      title: decision === 'enable' ? 'Discord habilitado para tus torneos' : 'Solicitud de Discord rechazada',
      message: decision === 'enable'
        ? 'Ya puedes activar Discord al crear o editar tus torneos. Se juegan en el servidor de GlitchGang.'
        : 'Tu solicitud para usar Discord en los torneos fue rechazada. Puedes volver a solicitarla.',
      link: '/torneos/crear',
      meta: { decision, status: target.organizerDiscord?.status || '', actorNick: req.user.nick || 'Admin' },
    }).catch(() => {})

    res.json({ status: target.organizerDiscord.status })
  } catch (error) { next(error) }
}
