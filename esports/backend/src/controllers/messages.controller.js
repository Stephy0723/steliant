import mongoose from 'mongoose'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Community } from '../models/Community.js'
import { Conversation } from '../models/Conversation.js'
import { Message } from '../models/Message.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { emitConversationMessage } from '../realtime/messagesRealtime.js'
import { sendNotif } from '../services/notifications.service.js'
import { isBlockedEitherWay } from '../services/blocks.service.js'
import { applyPeer, loadPeers, unreadFor } from '../services/conversationView.service.js'
import { STAFF_ROOM_TYPE, canPostStaffReport } from '../services/tournamentStaffRoom.service.js'

const isObjectId = value => mongoose.Types.ObjectId.isValid(String(value || ''))
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max)
const userId = req => req.user?._id
const userName = user => user?.nick || user?.username || user?.name || user?.firstName || user?.email?.split('@')[0] || 'Jugador'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MESSAGE_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'messages')
const ATTACHMENT_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

function uniqIds(values = []) {
  return [...new Set(values.filter(Boolean).map(value => String(value)))].map(value => new mongoose.Types.ObjectId(value))
}

function canAccess(conversation, user) {
  const id = String(user?._id || '')
  if (!id) return false
  if (user?.role === 'admin') return true
  return (conversation.participants || []).some(participant => String(participant) === id)
}


function mapConversation(conversation, messages = [], viewerId = null) {
  return {
    id: String(conversation._id),
    type: conversation.type,
    title: conversation.title,
    subtitle: conversation.subtitle,
    image: conversation.image,
    cover: conversation.cover,
    color: conversation.color,
    context: conversation.context,
    participants: (conversation.participants || []).map(String),
    unread: viewerId ? unreadFor(conversation, viewerId) : 0,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    messages: messages.map(mapMessage),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  }
}

function mapMessage(message) {
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    sender: message.sender ? String(message.sender) : null,
    senderName: message.senderName,
    senderRole: message.senderRole,
    kind: message.kind,
    text: message.text,
    card: message.card,
    attachments: message.attachments || [],
    relatedTicket: message.relatedTicket ? String(message.relatedTicket) : null,
    readBy: (message.readBy || []).map(String),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  }
}

// Respuesta de conversaciones ya personalizada para quien la pide (ver
// conversationView.service.js: titulo/foto del otro en chats privados).
async function viewConversations(conversations, viewerId, messagesById = {}) {
  const peers = await loadPeers(conversations, viewerId)
  return conversations.map(conversation => applyPeer(
    mapConversation(conversation, messagesById[String(conversation._id)] || [], viewerId),
    conversation, viewerId, peers,
  ))
}

export async function viewConversation(conversation, messages, viewerId) {
  const [view] = await viewConversations([conversation], viewerId, { [String(conversation._id)]: messages })
  return view
}

// ── Envio de mensajes (API y socket comparten esta logica) ────────────────
// Antes el socket tenia su propia copia y se saltaba el bloqueo entre
// usuarios: alguien bloqueado podia seguir escribiendo por el socket.

// Tipos que puede mandar un usuario; 'system'/'ticket' solo los crea el
// backend. Un kind desconocido rompia el enum del modelo (500).
const USER_MESSAGE_KINDS = new Set(['text', 'share', 'invite', 'poll', 'tournament', 'attachment'])
const MAX_ATTACHMENTS = 10

// Solo URLs http(s) o rutas del propio sitio: el frontend pinta estas URLs
// como enlaces/imagenes, y un "javascript:..." mandado a mano era un XSS.
function safeUrl(value, max = 1000) {
  const text = clean(value, max)
  if (!text) return ''
  if (text.startsWith('/') && !text.startsWith('//')) return text
  return /^https?:\/\//i.test(text) ? text : ''
}

function sanitizeAttachments(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter(item => item && typeof item === 'object')
    // Solo archivos subidos por POST /messages/attachments.
    .filter(item => String(item.url || '').startsWith('/uploads/messages/'))
    .slice(0, MAX_ATTACHMENTS)
    .map(item => ({
      id: clean(item.id, 80),
      name: clean(item.name, 180),
      mime: clean(item.mime, 80),
      size: Number(item.size) || 0,
      url: clean(item.url, 300),
    }))
}

function sanitizeCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return null
  const out = { ...card }
  for (const key of ['url', 'image', 'logo', 'link', 'cover']) {
    if (key in out) out[key] = safeUrl(out[key])
  }
  if (out.title !== undefined) out.title = clean(out.title, 200)
  if (out.summary !== undefined) out.summary = clean(out.summary, 1000)
  return out
}

export async function postMessage(conversation, sender, data = {}) {
  if (conversation.type === 'private') {
    const others = (conversation.participants || []).map(String).filter(id => id !== String(sender._id))
    for (const participantId of others) {
      if (await isBlockedEitherWay(sender._id, participantId)) {
        throw Object.assign(new Error('No puedes enviar mensajes a este usuario'), { status: 403 })
      }
    }
  }

  const text = clean(data.text ?? data.content ?? data.message, 4000)
  const card = sanitizeCard(data.card)
  const attachments = sanitizeAttachments(data.attachments)
  if (!text && !card && !attachments.length) {
    throw Object.assign(new Error('Message is required'), { status: 400 })
  }
  const requestedKind = clean(data.kind ?? data.msgType, 40)
  // Reporte formal en la sala de staff: solo dueno, admin y los roles de
  // staff que lo pueden hacer (el front solo esconde la casilla).
  if (requestedKind === 'staff_report') {
    if (!(await canPostStaffReport(conversation, sender))) {
      throw Object.assign(new Error('Tu rol no puede marcar mensajes como reporte en esta sala.'), { status: 403 })
    }
  }
  const kind = requestedKind === 'staff_report' || USER_MESSAGE_KINDS.has(requestedKind)
    ? requestedKind
    : card ? 'share' : attachments.length && !text ? 'attachment' : 'text'

  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    senderName: userName(sender),
    senderRole: sender.role || '',
    kind,
    text,
    card,
    attachments,
    readBy: [sender._id],
  })
  conversation.lastMessageAt = message.createdAt
  conversation.lastMessagePreview = clean(text || card?.title || attachments[0]?.name || 'Mensaje', 180)
  conversation.readState = [
    ...(conversation.readState || []).filter(item => String(item.user) !== String(sender._id)),
    { user: sender._id, lastReadAt: new Date() },
  ]
  await conversation.save()
  await notifyRecipients(conversation, message, sender._id)
  await emitConversationMessage(conversation, message)
  return message
}

// Mensajes: preferencias ("Mensajes y menciones"), codigo interno y tiempo
// real los resuelve sendNotif. groupKey = la conversacion, para que un chat
// activo acumule en UNA notificacion sin leer en vez de una por mensaje.
export async function notifyRecipients(conversation, message, senderId) {
  const recipients = (conversation.participants || [])
    .map(String)
    .filter(id => id !== String(senderId))

  await Promise.all(recipients.map(async id => {
    if (await isBlockedEitherWay(senderId, id)) return
    await sendNotif(id, {
      type: 'message',
      title: conversation.title || 'Nuevo mensaje',
      message: String(message.text || message.card?.title || 'Tienes una nueva tarjeta compartida.').slice(0, 400),
      // La sala de staff vive en el panel del torneo, no en /mensajes.
      link: conversation.type === STAFF_ROOM_TYPE
        ? `/organizador/torneo/${conversation.context?.targetId}/gestionar/sala`
        : `/mensajes?thread=${conversation._id}`,
      meta: {
        conversationId: String(conversation._id),
        messageId: String(message._id),
        conversationType: conversation.type,
        context: conversation.context,
      },
    }, { groupKey: `conversation:${conversation._id}` })
  }))
}

async function resolveUserLookups(values = []) {
  const lookups = values
    .map(value => clean(value, 160))
    .filter(Boolean)
  if (!lookups.length) return []
  const objectIds = lookups.filter(isObjectId)
  const textValues = lookups.filter(value => !isObjectId(value))
  const or = []
  if (objectIds.length) or.push({ _id: { $in: objectIds } })
  if (textValues.length) {
    const escaped = textValues.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    or.push(
      { nick: { $in: textValues } },
      { email: { $in: textValues.map(value => value.toLowerCase()) } },
      { playerCode: { $in: textValues } },
      { nick: { $in: textValues.map(value => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } },
      { playerCode: { $in: escaped.map(value => new RegExp(`^${value}$`, 'i')) } },
    )
  }
  if (!or.length) return []
  return User.find({ $or: or }).select('_id').limit(80).lean()
}

async function resolveParticipants({ type, targetId, participantIds = [], participantLookups = [], requester }) {
  const ids = [requester?._id, ...participantIds.filter(isObjectId)]

  if (type === 'team' && targetId) {
    const query = isObjectId(targetId)
      ? { _id: targetId }
      : { $or: [{ publicCode: targetId }, { internalCode: targetId }, { name: targetId }, { tag: String(targetId).toUpperCase() }] }
    const team = await Team.findOne(query).select('leader members').lean()
    if (team) ids.push(team.leader, ...(team.members || []))
  }

  if (type === 'private') {
    const existingUsers = await resolveUserLookups([targetId, ...participantIds, ...participantLookups])
    ids.push(...existingUsers.map(user => user._id))
  }

  if (type === 'community' && targetId) {
    const normalized = clean(targetId, 160)
    const query = isObjectId(normalized)
      ? { _id: normalized }
      : {
          $or: [
            { publicCode: normalized.toUpperCase() },
            { slug: normalized.toLowerCase() },
            { name: normalized },
            { game: normalized },
          ],
        }
    const community = await Community.findOne({ ...query, status: { $ne: 'archived' } })
      .select('owner moderators members')
      .lean()
    if (community) ids.push(community.owner, ...(community.moderators || []), ...(community.members || []))
  }

  return uniqIds(ids)
}

// Ajustes/Privacidad "Recibir mensajes directos" -- antes solo vivía en
// localStorage y no bloqueaba nada. Solo aplica a chats privados NUEVOS (no
// retroactivo a conversaciones existentes) y se salta si ya son amigos o si
// quien escribe es admin.
async function assertPrivateDmAllowed(requester, participantIds) {
  const otherIds = participantIds
    .map(id => String(id))
    .filter(id => id !== String(requester._id))
  if (!otherIds.length || requester.role === 'admin') return

  const targets = await User.find({ _id: { $in: otherIds } }).select('nick privacy').lean()
  const friendIds = new Set((requester.friends || []).map(String))

  for (const target of targets) {
    if (await isBlockedEitherWay(requester._id, target._id)) {
      const err = new Error('No puedes enviar mensajes a este usuario')
      err.status = 403
      throw err
    }
    if (target.privacy?.allowDMs === false && !friendIds.has(String(target._id))) {
      const err = new Error(`${target.nick} no acepta mensajes directos de quienes no son sus amigos`)
      err.status = 403
      throw err
    }
  }
}

async function findOrCreateConversation({ requester, type, targetId = '', title = '', subtitle = '', image = '', cover = '', color = '', context = {}, participantIds = [], participantLookups = [] }) {
  const participants = await resolveParticipants({ type, targetId, participantIds, participantLookups, requester })
  const normalizedTarget = clean(targetId, 160)
  // Privado: se busca por la pareja de participantes, sin importar quien abrio
  // el chat. Antes se buscaba por targetId, y si B abria chat con A despues de
  // que A lo abriera con B (targetId distinto), se creaba un chat duplicado.
  const query = type === 'private'
    ? { type, participants: { $all: participants, $size: participants.length } }
    : normalizedTarget
      ? { type, 'context.targetId': normalizedTarget, participants: requester._id }
      : { type, participants: { $all: participants } }
  if (type === 'private' && participants.length < 2) {
    throw Object.assign(new Error('No se encontro al usuario para este chat'), { status: 404 })
  }

  if (type === 'private') await assertPrivateDmAllowed(requester, participants)

  let conversation = await Conversation.findOne(query)
  if (conversation) return conversation

  conversation = await Conversation.create({
    type,
    title: clean(title, 140) || (type === 'private' ? 'Chat privado' : 'Conversacion GlitchGang'),
    subtitle: clean(subtitle, 180),
    image: clean(image, 500),
    cover: clean(cover, 500),
    color: clean(color, 40),
    context: {
      kind: clean(context.kind || type, 60),
      targetId: normalizedTarget,
      publicCode: clean(context.publicCode || '', 100),
      metadata: context.metadata || null,
    },
    participants,
    readState: participants.map(user => ({ user, lastReadAt: null })),
  })
  return conversation
}

export async function listConversations(req, res, next) {
  try {
    // Las salas de staff de torneo se abren desde el panel del torneo
    // (pestana Sala de staff); en /mensajes saldrian como "soporte".
    const conversations = await Conversation.find({ participants: req.user._id, archivedBy: { $ne: req.user._id }, type: { $ne: STAFF_ROOM_TYPE } })
      .sort({ lastMessageAt: -1 })
      .limit(80)
      .lean()
    res.json({ conversations: await viewConversations(conversations, req.user._id) })
  } catch (err) { next(err) }
}

export async function getConversation(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !canAccess(conversation, req.user)) return res.status(404).json({ message: 'Conversation not found' })
    // Los 200 MAS RECIENTES (antes sort ascendente + limit devolvia los 200
    // mas viejos: en un chat largo nunca se veian los mensajes nuevos).
    const latest = await Message.find({ conversation: conversation._id, deletedFor: { $ne: req.user._id } }).sort({ createdAt: -1 }).limit(200).lean()
    res.json({ conversation: await viewConversation(conversation.toObject(), latest.reverse(), req.user._id) })
  } catch (err) { next(err) }
}

export async function createConversation(req, res, next) {
  try {
    // La sala de staff de un torneo solo la crea el servidor
    // (GET /tournaments/:id/staff-room), con los miembros que el decide.
    if (clean(req.body.type, 40) === STAFF_ROOM_TYPE) {
      return res.status(403).json({ message: 'La sala de staff se abre desde el panel del torneo.' })
    }
    const conversation = await findOrCreateConversation({
      requester: req.user,
      type: clean(req.body.type, 40) || 'private',
      targetId: req.body.targetId,
      title: req.body.title,
      subtitle: req.body.subtitle,
      image: req.body.image,
      cover: req.body.cover,
      color: req.body.color,
      context: req.body.context || {},
      participantIds: Array.isArray(req.body.participantIds) ? req.body.participantIds : [],
      participantLookups: Array.isArray(req.body.participantLookups) ? req.body.participantLookups : [],
    })
    res.status(201).json({ conversation: await viewConversation(conversation.toObject(), [], req.user._id) })
  } catch (err) { next(err) }
}

export async function sendMessage(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !canAccess(conversation, req.user)) return res.status(404).json({ message: 'Conversation not found' })
    const message = await postMessage(conversation, req.user, req.body || {})
    res.status(201).json({ message: mapMessage(message), conversation: await viewConversation(conversation.toObject(), [message.toObject()], req.user._id) })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message })
    next(err)
  }
}

export async function markConversationRead(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !canAccess(conversation, req.user)) return res.status(404).json({ message: 'Conversation not found' })
    conversation.readState = [
      ...(conversation.readState || []).filter(item => String(item.user) !== String(req.user._id)),
      { user: req.user._id, lastReadAt: new Date() },
    ]
    await conversation.save()
    await Message.updateMany({ conversation: conversation._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } })
    res.json({ conversation: await viewConversation(conversation.toObject(), [], req.user._id) })
  } catch (err) { next(err) }
}

export async function voteOnPoll(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !canAccess(conversation, req.user)) return res.status(404).json({ message: 'Conversation not found' })

    const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id, kind: 'poll' })
    const poll = message?.card?.poll
    if (!poll || !Array.isArray(poll.options)) return res.status(404).json({ message: 'Poll not found' })

    const optionId = String(req.body.optionId ?? '')
    const options = poll.options.map(option => ({
      ...option,
      votes: (Array.isArray(option.votes) ? option.votes : []).map(String).filter(id => id !== String(req.user._id)),
    }))
    const selected = options.find(option => String(option.id) === optionId)
    if (!selected) return res.status(400).json({ message: 'Poll option not found' })

    const previous = poll.options.find(option => String(option.id) === optionId)
    const alreadySelected = (Array.isArray(previous?.votes) ? previous.votes : [])
      .some(id => String(id) === String(req.user._id))
    if (!alreadySelected) selected.votes.push(String(req.user._id))

    message.card = { ...message.card, poll: { ...poll, options } }
    message.markModified('card')
    await message.save()
    emitConversationMessage(conversation, message)
    res.json({ message: mapMessage(message) })
  } catch (err) { next(err) }
}

export async function uploadMessageAttachment(req, res, next) {
  try {
    const { dataUrl, filename = '' } = req.body || {}
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ message: 'dataUrl is required' })
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return res.status(400).json({ message: 'Invalid dataUrl' })
    const mime = clean(match[1], 80)
    const ext = ATTACHMENT_EXT[mime]
    if (!ext) return res.status(415).json({ message: 'Tipo de archivo no permitido (PNG, JPG, WEBP, GIF o PDF)' })
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ message: 'Attachment exceeds 12MB' })

    await fs.mkdir(MESSAGE_UPLOAD_DIR, { recursive: true })
    const storedName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`
    await fs.writeFile(path.join(MESSAGE_UPLOAD_DIR, storedName), buffer)
    const attachment = {
      id: crypto.randomUUID(),
      name: clean(filename || storedName, 180),
      mime,
      size: buffer.length,
      url: `/uploads/messages/${storedName}`,
      uploadedBy: String(req.user._id),
      uploadedAt: new Date().toISOString(),
    }
    res.status(201).json({ attachment })
  } catch (err) { next(err) }
}

export async function shareToDestinations(req, res, next) {
  try {
    const destinations = Array.isArray(req.body.destinations) ? req.body.destinations : []
    const payload = req.body.payload || {}
    if (!destinations.length) return res.status(400).json({ message: 'Destinations are required' })

    const results = []
    for (const destination of destinations) {
      const type = destination.kind === 'friend' ? 'private'
        : destination.kind === 'team' ? 'team'
          : destination.kind === 'community' ? 'community'
            : destination.kind === 'chat' ? 'support'
              : 'support'
      const conversation = await findOrCreateConversation({
        requester: req.user,
        type,
        targetId: destination.id || destination.publicCode || destination.name || '',
        title: destination.kind === 'team' ? 'Chat de equipo' : (destination.name || payload.title || 'Compartido'),
        subtitle: payload.title || destination.subtitle || payload.game || '',
        image: destination.avatar || payload.logo || payload.image || '',
        cover: destination.cover || payload.image || '',
        color: destination.color || '',
        context: { kind: destination.kind || type, publicCode: destination.publicCode || '', metadata: { destination } },
        participantIds: [destination.id, destination.userId].filter(isObjectId),
        participantLookups: [destination.id, destination.userId, destination.name, destination.nick, destination.email, destination.playerCode].filter(Boolean),
      })
      const message = await postMessage(conversation, req.user, {
        kind: req.body.shareKind === 'invite' ? 'invite' : 'share',
        text: payload.message || payload.url || payload.title,
        card: {
          title: clean(payload.title, 140),
          summary: clean(payload.summary, 500),
          game: clean(payload.game, 100),
          url: payload.url,
          image: payload.image,
          logo: payload.logo,
          kind: clean(req.body.shareKind || 'share', 40),
        },
      })
      results.push({ conversation: await viewConversation(conversation.toObject(), [message.toObject()], req.user._id), message: mapMessage(message) })
    }
    res.status(201).json({ results })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message })
    next(err)
  }
}
