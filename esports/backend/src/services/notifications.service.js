import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { sendEventEmail } from './email.service.js'
import { emitToUser } from '../realtime/messagesRealtime.js'
import { createNotificationCode } from './codes.service.js'

// Ajustes/Notificaciones ("Torneos e inscripciones" / "Mensajes y menciones")
// -- a qué categoría de user.notificationPrefs corresponde cada `type` de
// Notification. Lo que no matchea (moderación, tickets, solicitudes de rol,
// 2FA, seguridad...) se considera crítico y se manda siempre, sin importar
// las preferencias: no tiene sentido dejar que alguien se pierda un baneo o
// una respuesta de soporte por un toggle de "torneos".
function categoryOf(type) {
  const value = String(type || '')
  if (value.startsWith('tournament_')) return 'tournaments'
  if (value === 'message') return 'messages'
  return null
}

// Verdadero si esta notificación debe entregarse por el canal dado (push =
// in-app/tiempo real, email = correo espejo) según las preferencias del
// usuario. Categorías no reconocidas (null) siempre se entregan.
export async function shouldNotify(userId, { category, channel }) {
  if (!category) return true
  try {
    const user = await User.findById(userId).select('notificationPrefs').lean()
    const prefs = user?.notificationPrefs || {}
    if (prefs[channel] === false) return false
    if (prefs[category] === false) return false
    return true
  } catch {
    return true // si falla la lectura, no bloqueamos el aviso
  }
}

// Hasta 3 intentos si el internalCode choca (E11000): pasa si dos avisos al
// mismo usuario se crean a la vez justo cuando su contador de notificaciones
// todavia no existe, o si el contador se reinicio (purga de DB) y quedaron
// avisos viejos con el mismo codigo del dia. Antes la segunda notificacion se
// perdia con un console.error. Como ultimo recurso se guarda sin internalCode
// (el indice es sparse): perder el codigo interno es mejor que perder el aviso.
const CODE_ATTEMPTS = 3

function isInternalCodeClash(error) {
  return error?.code === 11000 && Boolean(error?.keyPattern?.internalCode || /internalCode/.test(error?.message || ''))
}

async function createWithCode(userId, playerCode, data) {
  if (playerCode) {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      let internalCode
      try {
        internalCode = await createNotificationCode(playerCode, userId)
      } catch {
        break // sin contador disponible: se guarda sin codigo
      }
      try {
        return await Notification.create({ ...data, userId, internalCode })
      } catch (error) {
        if (!isInternalCodeClash(error)) throw error
      }
    }
  }
  return Notification.create({ ...data, userId })
}

// opts.groupKey: si el usuario ya tiene un aviso SIN LEER del mismo tipo y la
// misma clave (ej. la conversacion de un chat), se actualiza ese en vez de
// crear otro -- 10 mensajes seguidos en un chat eran 10 notificaciones.
// Sube al tope de la lista (createdAt = ahora) y lleva meta.count.
async function mergeIntoGroup(userId, payload, groupKey) {
  const now = new Date()
  const set = { title: payload.title, message: payload.message, createdAt: now, updatedAt: now }
  if (payload.link !== undefined) set.link = payload.link
  for (const [key, value] of Object.entries(payload.meta || {})) set[`meta.${key}`] = value

  const grouped = await Notification.findOneAndUpdate(
    { userId, type: payload.type, read: false, archived: false, 'meta.groupKey': groupKey },
    { $set: set, $inc: { 'meta.count': 1 } },
    { new: true, timestamps: false },
  )
  if (!grouped) return null

  const count = grouped.meta?.count || 2
  const title = `${payload.title} (${count})`.slice(0, 120)
  await Notification.updateOne({ _id: grouped._id }, { $set: { title } }, { timestamps: false })
  grouped.title = title
  return grouped
}

// opts.email = true: además de la Notification in-app, manda un correo con el
// mismo title/message/link -- para eventos donde perderse el aviso in-app
// importa de verdad (bracket publicado, check-in, invitación, disputa). No se
// hace para todo tipo de notificación a propósito, solo donde se pidió.
// opts.groupKey: ver mergeIntoGroup. Devuelve la Notification (o null).
export async function sendNotif(userId, payload, opts = {}) {
  if (!userId || !payload?.type) return null
  const category = categoryOf(payload.type)

  // Una sola lectura del usuario para preferencias, codigo y correo (antes
  // eran hasta 3 findById por aviso).
  let user = null
  try {
    user = await User.findById(userId).select('notificationPrefs playerCode email nick').lean()
  } catch { /* si falla la lectura, no bloqueamos el aviso */ }
  if (!user) return null

  const allowed = (channel) => {
    if (!category) return true
    const prefs = user.notificationPrefs || {}
    return prefs[channel] !== false && prefs[category] !== false
  }

  let notification = null
  if (allowed('push')) {
    try {
      if (opts.groupKey) notification = await mergeIntoGroup(userId, payload, opts.groupKey)
      if (!notification) {
        const data = opts.groupKey
          ? { ...payload, meta: { ...(payload.meta || {}), groupKey: opts.groupKey, count: 1 } }
          : payload
        notification = await createWithCode(userId, user.playerCode, data)
      }
      emitToUser(userId, 'notification', notification.toObject())
    } catch (e) {
      console.error('[notifications] Error al crear notificación:', e.message)
    }
  }

  if (!opts.email || !user.email || !allowed('email')) return notification
  try {
    await sendEventEmail({ to: user.email, nick: user.nick, title: payload.title, message: payload.message, link: payload.link })
  } catch (e) {
    console.error('[notifications] Error al enviar email de evento:', e.message)
  }
  return notification
}

// Ajustes/Seguridad "Alertas de inicio de sesión": antes el toggle no
// disparaba nada -- no había ninguna alerta de login en todo el backend.
// Se llama desde auth.service.js#createSession solo cuando el user-agent no
// coincide con ninguna sesión previa (dispositivo nuevo).
export async function notifyNewLogin(user, { ip, userAgent } = {}) {
  if (!user?._id || user.security?.loginAlerts === false) return
  const message = `Se detectó un inicio de sesión nuevo en tu cuenta${ip ? ` desde la IP ${ip}` : ''}. Si no fuiste tú, cambia tu contraseña desde Ajustes de inmediato.`
  const title = 'Nuevo inicio de sesión'
  const link = '/ajustes?tab=seguridad'

  try {
    const notification = await createWithCode(user._id, user.playerCode, {
      type: 'security_new_login',
      title,
      message,
      link,
      meta: { ip: ip || '', userAgent: userAgent || '' },
    })
    emitToUser(user._id, 'notification', notification.toObject())
  } catch (e) {
    console.error('[notifications] Error al crear alerta de login:', e.message)
  }

  if (!user.email) return
  try {
    await sendEventEmail({ to: user.email, nick: user.nick, title, message, link })
  } catch (e) {
    console.error('[notifications] Error al enviar email de alerta de login:', e.message)
  }
}
