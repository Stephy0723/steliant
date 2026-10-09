import { GameRequest } from '../models/GameRequest.js'
import {
  appendAdminTicketReply,
  createSystemTicketRecord,
  ensureSystemTicketForSource,
  mapSystemTicket,
} from '../services/systemTickets.service.js'

function clean(value = '', max = 300) {
  return String(value || '').trim().slice(0, max)
}

function mapRequest(item) {
  return {
    id: String(item._id),
    _id: String(item._id),
    gameName: item.gameName,
    genre: item.genre || '',
    platform: item.platform || '',
    links: item.links || '',
    message: item.message,
    requesterName: item.requesterName || item.requester?.nick || 'Invitado',
    requesterEmail: item.requesterEmail || item.requester?.email || '',
    requester: item.requester ? {
      id: String(item.requester._id || item.requester),
      nick: item.requester.nick,
      email: item.requester.email,
      playerCode: item.requester.playerCode,
    } : null,
    systemTicket: item.systemTicket ? String(item.systemTicket._id || item.systemTicket) : null,
    ticket: item.systemTicket?.publicCode ? mapSystemTicket(item.systemTicket) : null,
    status: item.status,
    reviewNote: item.reviewNote || '',
    reviewedAt: item.reviewedAt,
    createdAt: item.createdAt,
  }
}

export async function createGameRequest(req, res, next) {
  try {
    const gameName = clean(req.body?.gameName, 120)
    const message = clean(req.body?.message, 1200)
    if (!gameName) return res.status(400).json({ message: 'Game name is required' })
    if (!message) return res.status(400).json({ message: 'Message is required' })

    const request = await GameRequest.create({
      gameName,
      genre: clean(req.body?.genre, 80),
      platform: clean(req.body?.platform, 120),
      links: clean(req.body?.links, 300),
      message,
      requesterName: clean(req.user?.nick || req.body?.requesterName || 'Invitado', 80),
      requesterEmail: clean(req.user?.email || req.body?.requesterEmail || '', 160),
      requester: req.user?._id || null,
    })

    const ticket = await createSystemTicketRecord({
      requester: req.user?._id || null,
      requesterUser: req.user || null,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      purpose: 'community',
      priority: 'medium',
      subject: `Solicitud de juego: ${gameName}`,
      message: [
        message,
        request.genre ? `Genero: ${request.genre}` : '',
        request.platform ? `Plataforma: ${request.platform}` : '',
        request.links ? `Referencia: ${request.links}` : '',
      ].filter(Boolean).join('\n'),
      author: 'user',
      authorId: req.user?._id || null,
      sourceType: 'game-request',
      sourceId: String(request._id),
      sourceLabel: gameName,
      metadata: {
        gameName: request.gameName,
        genre: request.genre,
        platform: request.platform,
        links: request.links,
      },
    })
    request.systemTicket = ticket._id
    await request.save()
    request.systemTicket = ticket

    res.status(201).json({ ok: true, request: mapRequest(request) })
  } catch (error) {
    next(error)
  }
}

export async function listGameRequests(req, res, next) {
  try {
    const { status = 'all' } = req.query
    const filter = status === 'all' ? {} : { status }
    const requests = await GameRequest
      .find(filter)
      .populate('requester', 'nick email playerCode')
      .populate('systemTicket')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ requests: requests.map(mapRequest) })
  } catch (error) {
    next(error)
  }
}

export async function reviewGameRequest(req, res, next) {
  try {
    const status = clean(req.body?.status, 24)
    if (!['pending', 'reviewing', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const request = await GameRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewNote: clean(req.body?.reviewNote, 1000),
        reviewedBy: req.user?._id || null,
        reviewedAt: new Date(),
      },
      { new: true },
    ).populate('requester', 'nick email playerCode').populate('systemTicket')

    if (!request) return res.status(404).json({ message: 'Game request not found' })

    const ticket = request.systemTicket || await ensureSystemTicketForSource('game-request', String(request._id), async () => ({
      requester: request.requester?._id || request.requester || null,
      requesterUser: request.requester || null,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      purpose: 'community',
      priority: 'medium',
      subject: `Solicitud de juego: ${request.gameName}`,
      message: request.message,
      author: 'user',
      authorId: request.requester?._id || request.requester || null,
      sourceType: 'game-request',
      sourceId: String(request._id),
      sourceLabel: request.gameName,
      metadata: {
        gameName: request.gameName,
        genre: request.genre,
        platform: request.platform,
        links: request.links,
      },
    }))

    if (!request.systemTicket) {
      request.systemTicket = ticket._id
      await request.save()
    }

    const statusText = status === 'approved'
      ? 'La solicitud fue aprobada.'
      : status === 'rejected'
        ? 'La solicitud fue rechazada.'
        : `La solicitud cambio a estado ${status}.`
    await appendAdminTicketReply(ticket, req.user, [request.reviewNote || statusText, statusText].filter(Boolean).join('\n'), { close: ['approved', 'rejected'].includes(status) })
    request.systemTicket = ticket
    res.json({ ok: true, request: mapRequest(request) })
  } catch (error) {
    next(error)
  }
}
