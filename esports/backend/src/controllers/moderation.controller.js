import { Sanction } from '../models/Sanction.js'
import { User } from '../models/User.js'
import { sendNotif } from '../services/notifications.service.js'
import { AdminActionLog } from '../models/AdminActionLog.js'

function actorName(user) {
  return user?.nick || user?.email || 'Admin'
}

async function logAdminAction(req, payload) {
  req._adminAudited = true // ver services/adminAudit.js
  try {
    await AdminActionLog.create({ actor: req.user?._id || null, actorName: actorName(req.user), ...payload })
  } catch (error) {
    console.error('[moderation] log error:', error.message)
  }
}

// Reutilizado por admin.controller.js -> setUserStatus para que banear o
// desbanear desde /admin/usuarios deje registro real en /admin/moderacion,
// en vez de que cada pantalla lleve su propio historial por separado.
export async function recordSanction(req, { targetUser, targetNick, type, action, reason }) {
  try {
    const sanction = await Sanction.create({
      targetUser: targetUser || null,
      targetNick,
      type,
      action,
      reason: reason || '',
      moderator: req.user?._id || null,
      moderatorName: actorName(req.user),
    })
    await logAdminAction(req, {
      action: 'sanction_created', module: 'moderation', targetId: String(sanction._id), targetCode: targetNick,
      summary: `${type}: ${action}`,
    })
    return sanction
  } catch (error) {
    console.error('[moderation] recordSanction error:', error.message)
    return null
  }
}

function mapSanction(s) {
  return {
    id: String(s._id),
    user: s.targetNick,
    userId: s.targetUser ? String(s.targetUser) : null,
    type: s.type,
    action: s.action,
    reason: s.reason,
    mod: s.moderatorName,
    date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-ES') : '—',
  }
}

// GET /admin/moderation
export async function listSanctions(req, res, next) {
  try {
    const rows = await Sanction.find().sort({ createdAt: -1 }).limit(500).lean()
    res.json({ sanctions: rows.map(mapSanction) })
  } catch (error) { next(error) }
}

// Busca la cuenta real a la que apunta una accion manual: por id, email,
// nick (sin distinguir mayusculas) o ID publico de jugador.
async function resolveTargetUser({ targetUserId, user }) {
  if (targetUserId) return User.findById(targetUserId)
  const identifier = String(user || '').trim()
  if (!identifier) return null
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return User.findOne({
    deleted: { $ne: true },
    $or: [
      { email: identifier.toLowerCase() },
      { nick: new RegExp(`^${escaped}$`, 'i') },
      { playerCode: identifier.toUpperCase() },
    ],
  })
}

// POST /admin/moderation  { user|targetUserId, type, action, reason, durationDays? }
// La accion tiene efecto real sobre la cuenta, no es solo un registro:
//   ban     -> isBanned (requireAuth rechaza cada request, no puede loguear)
//   unban   -> levanta el baneo y cualquier restriccion vigente
//   mute    -> mutedUntil (no puede publicar/comentar/mandar mensajes)
//   warning -> aviso in-app + correo al usuario
export async function createSanction(req, res, next) {
  try {
    const type = String(req.body?.type || '').trim()
    if (!['ban', 'warning', 'mute', 'unban'].includes(type)) {
      return res.status(400).json({ message: 'Tipo de accion invalido' })
    }
    const target = await resolveTargetUser(req.body || {})
    if (!target) return res.status(404).json({ message: 'No existe una cuenta con ese nick, email o ID' })
    if (String(target._id) === String(req.user?._id)) {
      return res.status(403).json({ message: 'No puedes sancionar tu propia cuenta' })
    }
    if (target.role === 'admin' && ['ban', 'mute'].includes(type)) {
      return res.status(403).json({ message: 'No se puede sancionar a un administrador. Quitale el rol primero.' })
    }

    const reason = String(req.body?.reason || '').trim().slice(0, 500)
    const days = Math.min(Math.max(Number(req.body?.durationDays) || 7, 1), 365)
    let action = String(req.body?.action || '').trim().slice(0, 160)

    if (type === 'ban') {
      if (target.isBanned) return res.status(409).json({ message: `${target.nick} ya esta baneado` })
      target.isBanned = true
      target.status = 'ban'
      target.banReason = reason
      action = action || 'Baneo administrativo'
    } else if (type === 'unban') {
      const muted = target.mutedUntil && new Date(target.mutedUntil) > new Date()
      if (!target.isBanned && !muted) return res.status(409).json({ message: `${target.nick} no tiene sanciones activas` })
      target.isBanned = false
      if (target.status === 'ban') target.status = 'activo'
      target.banReason = ''
      target.mutedUntil = null
      target.muteReason = ''
      action = action || 'Cuenta reactivada'
    } else if (type === 'mute') {
      target.mutedUntil = new Date(Date.now() + days * 86400000)
      target.muteReason = reason
      action = action || `Restriccion de ${days} dia${days === 1 ? '' : 's'} (sin publicar ni mensajes)`
    } else {
      action = action || 'Advertencia'
    }
    await target.save()

    const sanction = await Sanction.create({
      targetUser: target._id,
      targetNick: target.nick,
      type,
      action,
      reason,
      moderator: req.user?._id || null,
      moderatorName: actorName(req.user),
    })

    await logAdminAction(req, {
      action: 'sanction_created', module: 'moderation', targetId: String(target._id), targetCode: target.playerCode,
      summary: `${type}: ${action}`,
    })

    const NOTICE = {
      warning: ['Advertencia de moderacion', reason || 'Recibiste una advertencia del equipo de moderacion de GlitchGang.'],
      mute: ['Restriccion temporal de tu cuenta', `No puedes publicar, comentar ni mandar mensajes hasta el ${target.mutedUntil?.toLocaleDateString('es-DO')}.${reason ? ` Motivo: ${reason}` : ''}`],
      unban: ['Tu cuenta fue reactivada', 'El equipo de moderacion levanto las sanciones de tu cuenta.'],
    }
    if (NOTICE[type]) {
      sendNotif(target._id, {
        type: 'admin_notice', title: NOTICE[type][0], message: NOTICE[type][1].slice(0, 400), link: '/',
        meta: { kind: 'sanction', sanctionType: type, sanctionId: String(sanction._id) },
      }, { email: true }).catch(() => {})
    }

    res.status(201).json({ sanction: mapSanction(sanction) })
  } catch (error) { next(error) }
}

// DELETE /admin/moderation/:id
export async function deleteSanction(req, res, next) {
  try {
    const sanction = await Sanction.findById(req.params.id)
    if (!sanction) return res.status(404).json({ message: 'Registro no encontrado' })
    // Borrar una restriccion por error tambien la levanta (si sigue vigente).
    // Un baneo no se deshace borrando la fila: eso es una "Reactivacion".
    if (sanction.type === 'ban') {
      const target = sanction.targetUser ? await User.findById(sanction.targetUser).select('isBanned').lean() : null
      if (target?.isBanned) return res.status(409).json({ message: 'La cuenta sigue baneada. Registra una Reactivacion en vez de borrar el baneo.' })
    }
    if (sanction.type === 'mute' && sanction.targetUser) {
      await User.updateOne({ _id: sanction.targetUser, mutedUntil: { $gt: new Date() } }, { mutedUntil: null, muteReason: '' })
    }
    await Sanction.deleteOne({ _id: sanction._id })
    await logAdminAction(req, {
      action: 'sanction_deleted', module: 'moderation', targetId: String(sanction._id), targetCode: sanction.targetNick,
      summary: `Eliminado: ${sanction.action}`,
    })
    res.json({ message: 'Accion eliminada' })
  } catch (error) { next(error) }
}
