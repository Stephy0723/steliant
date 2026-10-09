import crypto from 'node:crypto'
import { Raffle } from '../models/Raffle.js'
import { AdminActionLog } from '../models/AdminActionLog.js'
import { sendNotif } from '../services/notifications.service.js'

function actorName(user) {
  return user?.nick || user?.email || 'Admin'
}

async function logAdminAction(req, payload) {
  req._adminAudited = true // ver services/adminAudit.js
  try {
    await AdminActionLog.create({ actor: req.user?._id || null, actorName: actorName(req.user), ...payload })
  } catch (error) {
    console.error('[raffle] log error:', error.message)
  }
}

const TYPES = ['Comunidad', 'Evento', 'Torneo', 'Marca']
const STATUSES = ['draft', 'scheduled', 'active', 'closed']
const POPULATE = [
  { path: 'winner', select: 'nick avatar playerCode' },
  { path: 'entrants.user', select: 'nick avatar playerCode' },
]

function mapRaffle(r, { viewerId = null, withEntrants = false } = {}) {
  const entrants = r.entrants || []
  const winner = r.winner && typeof r.winner === 'object'
    ? { id: String(r.winner._id), nick: r.winner.nick, avatar: r.winner.avatar || '', publicId: r.winner.playerCode || '' }
    : null
  return {
    id: String(r._id),
    title: r.title,
    type: r.type,
    prize: r.prize,
    description: r.description || '',
    coverImage: r.coverImage || '',
    closesAt: r.closesAt,
    status: r.status,
    participants: entrants.length,
    joined: viewerId ? entrants.some(e => String(e.user?._id || e.user) === String(viewerId)) : false,
    winner,
    drawnAt: r.drawnAt,
    createdAt: r.createdAt,
    ...(withEntrants ? {
      entrants: entrants.map(e => ({
        id: String(e.user?._id || e.user),
        nick: e.user?.nick || 'Cuenta eliminada',
        publicId: e.user?.playerCode || '',
        joinedAt: e.joinedAt,
      })),
    } : {}),
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

// GET /admin/raffles
export async function listRaffles(req, res, next) {
  try {
    const rows = await Raffle.find().sort({ createdAt: -1 }).populate(POPULATE).lean()
    res.json({ raffles: rows.map(r => mapRaffle(r, { withEntrants: true })) })
  } catch (error) { next(error) }
}

// POST /admin/raffles  { title, type, prize, closesAt, description?, coverImage? }
export async function createRaffle(req, res, next) {
  try {
    const title = String(req.body?.title || '').trim()
    const prize = String(req.body?.prize || '').trim()
    if (!title || !prize) return res.status(400).json({ message: 'Titulo y premio son requeridos' })

    const raffle = await Raffle.create({
      title,
      prize,
      type: TYPES.includes(req.body?.type) ? req.body.type : 'Comunidad',
      description: String(req.body?.description || '').trim().slice(0, 600),
      coverImage: String(req.body?.coverImage || '').trim(),
      closesAt: String(req.body?.closesAt || '').trim().slice(0, 60) || 'Sin fecha',
      createdBy: req.user?._id || null,
    })

    await logAdminAction(req, {
      action: 'raffle_created', module: 'raffle', targetId: String(raffle._id), targetCode: title,
      summary: `Borrador creado: ${title}`,
    })

    res.status(201).json({ raffle: mapRaffle(raffle, { withEntrants: true }) })
  } catch (error) { next(error) }
}

// PATCH /admin/raffles/:id  { status?, title?, prize?, closesAt?, type?, description?, coverImage? }
// Los participantes ya no se editan a mano: son las cuentas que se unieron.
export async function updateRaffle(req, res, next) {
  try {
    const raffle = await Raffle.findById(req.params.id)
    if (!raffle) return res.status(404).json({ message: 'Sorteo no encontrado' })

    const before = raffle.status
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Estado invalido' })
      if (raffle.winner && req.body.status !== 'closed') {
        return res.status(409).json({ message: 'Este sorteo ya tiene ganador; no se puede reabrir' })
      }
    }
    if (req.body.type !== undefined && !TYPES.includes(req.body.type)) return res.status(400).json({ message: 'Tipo invalido' })
    ;['status', 'title', 'prize', 'closesAt', 'type', 'description', 'coverImage'].forEach(field => {
      if (req.body[field] !== undefined) raffle[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field]
    })
    await raffle.save()

    if (req.body.status && req.body.status !== before) {
      await logAdminAction(req, {
        action: 'raffle_status_changed', module: 'raffle', targetId: String(raffle._id), targetCode: raffle.title,
        summary: `${before} -> ${raffle.status}`,
      })
    }

    await raffle.populate(POPULATE)
    res.json({ raffle: mapRaffle(raffle, { withEntrants: true }) })
  } catch (error) { next(error) }
}

// POST /admin/raffles/:id/draw — elige el ganador al azar (crypto) entre los
// participantes reales, cierra el sorteo y avisa al ganador.
export async function drawRaffle(req, res, next) {
  try {
    const raffle = await Raffle.findById(req.params.id)
    if (!raffle) return res.status(404).json({ message: 'Sorteo no encontrado' })
    if (raffle.winner) return res.status(409).json({ message: 'Este sorteo ya tiene ganador' })
    if (!raffle.entrants.length) return res.status(409).json({ message: 'No hay participantes para sortear' })

    const pick = raffle.entrants[crypto.randomInt(raffle.entrants.length)]
    raffle.winner = pick.user
    raffle.drawnAt = new Date()
    raffle.status = 'closed'
    await raffle.save()
    await raffle.populate(POPULATE)

    await logAdminAction(req, {
      action: 'raffle_drawn', module: 'raffle', targetId: String(raffle._id), targetCode: raffle.title,
      summary: `Ganador: ${raffle.winner?.nick || pick.user} (${raffle.entrants.length} participantes)`,
    })
    sendNotif(pick.user, {
      type: 'raffle_won',
      title: 'Ganaste un sorteo',
      message: `Ganaste "${raffle.title}": ${raffle.prize}. El equipo de GlitchGang te contactara para la entrega.`,
      link: '/sorteos',
      meta: { raffleId: String(raffle._id), raffleTitle: raffle.title || '', prize: raffle.prize || '', image: raffle.coverImage || '', entrants: (raffle.entrants || []).length },
    }, { email: true }).catch(() => {})

    res.json({ raffle: mapRaffle(raffle, { withEntrants: true }) })
  } catch (error) { next(error) }
}

// ─── Publico ─────────────────────────────────────────────────────────────────

// GET /raffles — sorteos activos + los ultimos cerrados (con ganador).
export async function listPublicRaffles(req, res, next) {
  try {
    const rows = await Raffle.find({ status: { $in: ['active', 'closed'] } })
      .sort({ createdAt: -1 }).limit(60).populate('winner', 'nick avatar playerCode').lean()
    res.json({ raffles: rows.map(r => mapRaffle(r, { viewerId: req.user?._id })) })
  } catch (error) { next(error) }
}

// POST /raffles/:id/join — una entrada por cuenta, solo si esta activo.
export async function joinRaffle(req, res, next) {
  try {
    const userId = req.user._id
    const updated = await Raffle.findOneAndUpdate(
      { _id: req.params.id, status: 'active', 'entrants.user': { $ne: userId } },
      { $push: { entrants: { user: userId, joinedAt: new Date() } } },
      { new: true },
    ).lean()
    if (!updated) {
      const raffle = await Raffle.findById(req.params.id).select('status entrants.user').lean()
      if (!raffle) return res.status(404).json({ message: 'Sorteo no encontrado' })
      if (raffle.status !== 'active') return res.status(409).json({ message: 'Este sorteo no esta abierto' })
      return res.status(409).json({ message: 'Ya estas participando' })
    }
    res.json({ joined: true, participants: updated.entrants.length })
  } catch (error) { next(error) }
}
