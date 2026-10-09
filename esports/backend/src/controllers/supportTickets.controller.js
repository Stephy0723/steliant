import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { TournamentSupportTicket } from '../models/TournamentSupportTicket.js'
import { enqueueIntegrationEvent } from '../services/integrationEvents.service.js'
import { notifyUsers } from '../services/tournamentTeams.service.js'
import { assertTabAccess, staffTabAccess, tournamentIdentityFilter } from './tournament.controller.js'

// Tickets de #soporte del torneo (Discord). El bot los crea al elegir una
// categoria del menu y los cierra con el boton "Marcar resuelto"; la web los
// lista en la pestana Discord del panel y tambien puede cerrarlos (el bot
// archiva el hilo via el evento discord.support.resolved).

export const SUPPORT_CATEGORY_LABELS = {
  room: 'Mi sala no carga',
  voice: 'El voice no funciona',
  bot: 'El bot no entra',
  connection: 'Problema de energia/conexion',
  other: 'Otro problema',
}

const clip = (value, max) => String(value ?? '').trim().slice(0, max)
const idOf = v => String(v?._id || v || '')

function publicTicket(t) {
  return {
    id: String(t._id),
    category: t.category,
    categoryLabel: SUPPORT_CATEGORY_LABELS[t.category] || SUPPORT_CATEGORY_LABELS.other,
    detail: t.detail,
    requesterName: t.requesterName,
    requesterDiscordId: t.requesterDiscordId,
    teamName: t.teamName,
    status: t.status,
    resolvedAt: t.resolvedAt,
    resolvedByName: t.resolvedByName,
    resolvedFrom: t.resolvedFrom,
    discord: t.discord || {},
    createdAt: t.createdAt,
  }
}

// Equipo inscrito (no retirado) al que pertenece este usuario en el torneo.
async function findRequesterTeam(tournament, userId) {
  if (!userId) return null
  const teamIds = (tournament.registrations || [])
    .filter(reg => reg.status !== 'withdrawn' && reg.team)
    .map(reg => idOf(reg.team))
  if (!teamIds.length) return null
  return Team.findOne({
    _id: { $in: teamIds },
    $or: [{ leader: userId }, { members: userId }],
  }).select('name').lean()
}

// Organizador + staff aceptado que tiene acceso a la pestana Discord.
function ticketRecipients(tournament) {
  const staff = (tournament.staffMembers || [])
    .filter(m => m.status === 'accepted' && m.user && staffTabAccess(m, 'discord') !== 'none')
    .map(m => idOf(m.user))
  return [...new Set([idOf(tournament.organizer), ...staff].filter(Boolean))]
}

function manageLink(tournament) {
  return `/organizador/torneo/${tournament._id}/gestionar/discord`
}

// ── Bot (/api/bots, requireBotAuth) ──

export async function createSupportTicketForBot(req, res, next) {
  try {
    const { tournamentId, discordId, requesterName, category, detail, guildId, channelId } = req.body || {}
    if (!tournamentId) return res.status(400).json({ message: 'Falta el torneo.' })
    if (!discordId) return res.status(400).json({ message: 'Falta discordId.' })

    const tournament = await Tournament.findOne(tournamentIdentityFilter(String(tournamentId)))
      .select('title publicId organizer staffMembers registrations discordProvision')
      .lean()
    if (!tournament) return res.status(404).json({ message: 'Torneo no encontrado.' })

    const user = await User.findOne({ 'discord.id': String(discordId) }).select('nick').lean()
    const team = await findRequesterTeam(tournament, user?._id)
    const safeCategory = SUPPORT_CATEGORY_LABELS[category] ? category : 'other'

    const ticket = await TournamentSupportTicket.create({
      tournament: tournament._id,
      category: safeCategory,
      detail: clip(detail, 500),
      requester: user?._id || null,
      requesterDiscordId: clip(discordId, 32),
      requesterName: clip(user?.nick || requesterName, 80),
      team: team?._id || null,
      teamName: clip(team?.name, 120),
      discord: { guildId: clip(guildId, 32), channelId: clip(channelId, 32) },
    })

    const label = SUPPORT_CATEGORY_LABELS[safeCategory]
    await notifyUsers(ticketRecipients(tournament), {
      type: 'tournament_support_ticket',
      title: 'Nuevo ticket de soporte',
      message: `${tournament.title}: ${ticket.teamName || ticket.requesterName || 'Un jugador'} — ${label}${ticket.detail ? `: ${ticket.detail}` : ''}`.slice(0, 400),
      link: manageLink(tournament),
      meta: {
        tournamentId: String(tournament._id),
        tournamentTitle: tournament.title,
        ticketId: String(ticket._id),
        category: safeCategory,
        categoryLabel: label,
        teamName: ticket.teamName,
        requesterName: ticket.requesterName,
      },
    })

    res.status(201).json({
      ticket: publicTicket(ticket),
      tournament: {
        id: String(tournament._id),
        title: tournament.title,
        staffRoleId: tournament.discordProvision?.staffRoleId || '',
        organizerRoleId: tournament.discordProvision?.organizerRoleId || '',
      },
    })
  } catch (err) { next(err) }
}

// El bot guarda el hilo/mensaje que creo, para poder archivarlo si se cierra desde la web.
export async function attachSupportTicketDiscord(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(400).json({ message: 'Ticket invalido.' })
    const { threadId, messageId, channelId } = req.body || {}
    const update = {}
    if (threadId) update['discord.threadId'] = clip(threadId, 32)
    if (messageId) update['discord.messageId'] = clip(messageId, 32)
    if (channelId) update['discord.channelId'] = clip(channelId, 32)
    const ticket = await TournamentSupportTicket.findByIdAndUpdate(req.params.ticketId, { $set: update }, { new: true }).lean()
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado.' })
    res.json({ ticket: publicTicket(ticket) })
  } catch (err) { next(err) }
}

async function markResolved(ticket, { by = null, byName = '', from }) {
  ticket.status = 'resolved'
  ticket.resolvedAt = new Date()
  ticket.resolvedBy = by
  ticket.resolvedByName = clip(byName, 80)
  ticket.resolvedFrom = from
  await ticket.save()
  if (ticket.requester) {
    const tournament = await Tournament.findById(ticket.tournament).select('title publicId').lean()
    await notifyUsers([ticket.requester], {
      type: 'tournament_support_resolved',
      title: 'Ticket de soporte resuelto',
      message: `${tournament?.title || 'Torneo'}: el staff marco como resuelto tu ticket "${SUPPORT_CATEGORY_LABELS[ticket.category]}".`,
      link: tournament ? `/torneos/${tournament.publicId || tournament._id}` : '',
      meta: { tournamentId: idOf(ticket.tournament), ticketId: String(ticket._id) },
    })
  }
}

// El bot ya comprobo que quien aprieta el boton tiene el rol de staff/organizador.
export async function resolveSupportTicketForBot(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(400).json({ message: 'Ticket invalido.' })
    const ticket = await TournamentSupportTicket.findById(req.params.ticketId)
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado.' })
    if (ticket.status === 'resolved') return res.json({ ticket: publicTicket(ticket), alreadyResolved: true })

    const { discordId, name } = req.body || {}
    const user = discordId ? await User.findOne({ 'discord.id': String(discordId) }).select('nick').lean() : null
    await markResolved(ticket, { by: user?._id || null, byName: user?.nick || name, from: 'discord' })
    res.json({ ticket: publicTicket(ticket) })
  } catch (err) { next(err) }
}

// ── Web (panel del organizador, pestana Discord) ──

export async function listSupportTickets(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id)).lean()
    const denied = assertTabAccess(tournament, req.user, 'discord', 'view')
    if (denied) return res.status(denied.status).json({ message: denied.message })
    const tickets = await TournamentSupportTicket.find({ tournament: tournament._id })
      .sort({ status: 1, createdAt: -1 })
      .limit(100)
      .lean()
    res.json({ tickets: tickets.map(publicTicket) })
  } catch (err) { next(err) }
}

export async function resolveSupportTicket(req, res, next) {
  try {
    const tournament = await Tournament.findOne(tournamentIdentityFilter(req.params.id)).lean()
    const denied = assertTabAccess(tournament, req.user, 'discord', 'view')
    if (denied) return res.status(denied.status).json({ message: denied.message })
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(400).json({ message: 'Ticket invalido.' })

    const ticket = await TournamentSupportTicket.findOne({ _id: req.params.ticketId, tournament: tournament._id })
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado.' })
    if (ticket.status !== 'resolved') {
      await markResolved(ticket, { by: req.user._id, byName: req.user.nick, from: 'web' })
      if (ticket.discord?.threadId || ticket.discord?.messageId) {
        await enqueueIntegrationEvent({
          type: 'discord.support.resolved',
          entityType: 'tournament',
          entityId: tournament._id,
          payload: { tournamentId: String(tournament._id), ticketId: String(ticket._id) },
          dedupe: false,
        }).catch(error => console.error('[supportTickets] No se pudo encolar el cierre en Discord:', error.message))
      }
    }
    res.json({ ticket: publicTicket(ticket) })
  } catch (err) { next(err) }
}

// El worker del bot lee el ticket para saber que hilo archivar.
export async function getSupportTicketForBot(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.ticketId)) return res.status(400).json({ message: 'Ticket invalido.' })
    const ticket = await TournamentSupportTicket.findById(req.params.ticketId).lean()
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado.' })
    res.json({ ticket: publicTicket(ticket) })
  } catch (err) { next(err) }
}
