import { Team } from '../models/Team.js'
import { ChallengerTicket } from '../models/ChallengerTicket.js'
import { config } from '../config/index.js'
import { getTeamCompetitiveSnapshot } from '../services/competitive.service.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function yymmdd() {
  const d = new Date()
  return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

async function nextSeq() {
  const count = await ChallengerTicket.countDocuments()
  return String(count + 1).padStart(3, '0')
}

async function getCompetitiveAccess(team) {
  const competitive = await getTeamCompetitiveSnapshot(team)
  return {
    competitive,
    canChallenge: Boolean(competitive?.eligibility?.canChallenge),
    canBeChallenged: Boolean(competitive?.eligibility?.canBeChallenged),
  }
}

function teamSelect() {
  return 'publicCode name tag logo game tiers level region rankPts wins losses challengerMode slogan'
}

async function attachCompetitive(team) {
  if (!team) return team
  const plain = typeof team.toObject === 'function' ? team.toObject() : team
  return { ...plain, competitive: await getTeamCompetitiveSnapshot(plain) }
}

async function populateTicket(ticket) {
  if (!ticket) return ticket
  return ticket.populate([
    { path: 'challengerTeam', select: teamSelect() },
    { path: 'proTeam', select: teamSelect() },
  ])
}

// ─── Activate Challenger Mode ────────────────────────────────────────────────
export async function activateChallengerMode(req, res) {
  try {
    const userId = req.user._id || req.user.id
    const team = await Team.findOne({ leader: userId })
    if (!team) return res.status(404).json({ message: 'No tienes un equipo.' })

    const access = await getCompetitiveAccess(team)
    if (!access.canBeChallenged) {
      return res.status(403).json({
        message: access.competitive?.eligibility?.reason || 'Solo equipos Pro o Elite pueden activar el Modo Retador.',
        competitive: access.competitive,
      })
    }

    team.challengerMode = {
      ...team.challengerMode,
      active: true,
      activatedAt: new Date(),
      currentMonthTickets: team.challengerMode?.currentMonthTickets || 0,
      requiredMonthlyTickets: 7,
      lastResetDate: team.challengerMode?.lastResetDate || new Date(),
      streak: team.challengerMode?.streak || 0,
      totalTicketsCompleted: team.challengerMode?.totalTicketsCompleted || 0,
      benefits: {
        priorityListing: true,
        badgeActive: true,
        publicitySlots: 2,
      },
      history: team.challengerMode?.history || [],
    }
    await team.save()
    res.json({ message: 'Modo Retador activado.', challengerMode: team.challengerMode, team: await attachCompetitive(team) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── Deactivate Challenger Mode ──────────────────────────────────────────────
export async function deactivateChallengerMode(req, res) {
  try {
    const userId = req.user._id || req.user.id
    const team = await Team.findOne({ leader: userId })
    if (!team) return res.status(404).json({ message: 'No tienes un equipo.' })

    if (team.challengerMode) {
      team.challengerMode.active = false
      team.challengerMode.benefits = { priorityListing: false, badgeActive: false, publicitySlots: 0 }
    }
    await team.save()
    res.json({ message: 'Modo Retador desactivado.', challengerMode: team.challengerMode, team: await attachCompetitive(team) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── Create Challenger Ticket (amateur → pro) ───────────────────────────────
export async function createChallengerTicket(req, res) {
  try {
    const userId = req.user._id || req.user.id
    const { proTeamId, game, format, scheduledDate, scheduledTime, message } = req.body

    const myTeam = await Team.findOne({ $or: [{ leader: userId }, { members: userId }] })
    if (!myTeam) return res.status(400).json({ message: 'Necesitas un equipo para enviar retos.' })
    const myAccess = await getCompetitiveAccess(myTeam)
    if (!myAccess.canChallenge) {
      return res.status(403).json({
        message: myAccess.competitive?.eligibility?.reason || 'Tu equipo todavia no puede enviar retos competitivos.',
        competitive: myAccess.competitive,
      })
    }

    const proTeam = await Team.findById(proTeamId)
    if (!proTeam) return res.status(404).json({ message: 'Equipo profesional no encontrado.' })
    const proAccess = await getCompetitiveAccess(proTeam)
    if (!proAccess.canBeChallenged) {
      return res.status(403).json({
        message: proAccess.competitive?.eligibility?.reason || 'Ese equipo no esta habilitado para recibir retos.',
        competitive: proAccess.competitive,
      })
    }
    if (!proTeam.challengerMode?.active) {
      return res.status(400).json({ message: 'Ese equipo no tiene el Modo Retador activo.' })
    }

    if (String(myTeam._id) === String(proTeam._id)) {
      return res.status(400).json({ message: 'No puedes retar a tu propio equipo.' })
    }

    // Only same game allowed
    if (game && proTeam.game && game.toLowerCase() !== proTeam.game.toLowerCase()) {
      return res.status(400).json({ message: 'Solo puedes retar equipos del mismo juego.' })
    }

    const month = currentMonth()
    const seq = await nextSeq()
    const publicCode = `CHKT-${seq}-${month.replace('-', '')}`
    const internalCode = `CHKT-${yymmdd()}-${seq}-${month.replace('-', '')}`

    const ticket = await ChallengerTicket.create({
      publicCode,
      internalCode,
      challengerTeam: myTeam._id,
      challengerUser: userId,
      proTeam: proTeam._id,
      game: game || proTeam.game || '',
      format: format || 'BO3',
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || '',
      message: message || '',
      month,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days to respond
    })

    await populateTicket(ticket)
    res.status(201).json({ message: 'Ticket de reto creado.', ticket })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── Accept / Reject ticket ─────────────────────────────────────────────────
export async function respondChallengerTicket(req, res) {
  try {
    const { id } = req.params
    const { action, scheduledDate, scheduledTime } = req.body
    const userId = req.user._id || req.user.id

    const ticket = await ChallengerTicket.findById(id)
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado.' })

    const proTeam = await Team.findById(ticket.proTeam)
    if (!proTeam || String(proTeam.leader) !== String(userId)) {
      return res.status(403).json({ message: 'Solo el líder del equipo puede responder retos.' })
    }

    if (action === 'accept') {
      ticket.status = scheduledDate ? 'scheduled' : 'accepted'
      ticket.acceptedAt = new Date()
      if (scheduledDate) ticket.scheduledDate = scheduledDate
      if (scheduledTime) ticket.scheduledTime = scheduledTime
    } else if (action === 'reject') {
      ticket.status = 'rejected'
      ticket.rejectedAt = new Date()
    } else {
      return res.status(400).json({ message: 'Acción inválida. Usa "accept" o "reject".' })
    }

    await ticket.save()
    await populateTicket(ticket)
    res.json({ message: `Reto ${action === 'accept' ? 'aceptado' : 'rechazado'}.`, ticket })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── Report result ──────────────────────────────────────────────────────────
export async function reportResult(req, res) {
  try {
    const { id } = req.params
    const { winner, score } = req.body
    const side = req.body.side || req.body.role // side: 'challenger' | 'pro'
    const userId = req.user._id || req.user.id

    const ticket = await ChallengerTicket.findById(id)
    if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado.' })
    if (!['accepted', 'scheduled'].includes(ticket.status)) {
      return res.status(400).json({ message: 'El ticket no está en estado aceptado/agendado.' })
    }

    if (!ticket.result) ticket.result = {}
    ticket.result.winner = winner || ticket.result.winner
    ticket.result.score = score || ticket.result.score

    if (side === 'challenger') ticket.result.reportedByChallenger = true
    if (side === 'pro') ticket.result.reportedByPro = true

    // When both sides report, mark as completed and count toward monthly quota
    if (ticket.result.reportedByChallenger && ticket.result.reportedByPro) {
      ticket.status = 'completed'
      ticket.completedAt = new Date()
      ticket.result.confirmedAt = new Date()

      // Update pro team's monthly counter
      const proTeam = await Team.findById(ticket.proTeam)
      if (proTeam?.challengerMode) {
        proTeam.challengerMode.currentMonthTickets = (proTeam.challengerMode.currentMonthTickets || 0) + 1
        proTeam.challengerMode.totalTicketsCompleted = (proTeam.challengerMode.totalTicketsCompleted || 0) + 1
        await proTeam.save()
      }
    } else {
      ticket.status = 'played'
      ticket.playedAt = new Date()
    }

    ticket.markModified('result')
    await ticket.save()
    await populateTicket(ticket)
    res.json({ message: 'Resultado reportado.', ticket })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── Get tickets for a team ─────────────────────────────────────────────────
export async function getTeamTickets(req, res) {
  try {
    const { teamId } = req.params
    const { month, status } = req.query
    const query = { $or: [{ proTeam: teamId }, { challengerTeam: teamId }] }
    if (month) query.month = month
    if (status) query.status = status

    const tickets = await ChallengerTicket.find(query)
      .populate('challengerTeam', teamSelect())
      .populate('proTeam', teamSelect())
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({ tickets })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── Dashboard (for pro team) ───────────────────────────────────────────────
export async function getChallengerDashboard(req, res) {
  try {
    const { teamId } = req.params
    const team = await Team.findById(teamId).select('name tag logo game tiers level region rankPts wins losses challengerMode')
    if (!team) return res.status(404).json({ message: 'Equipo no encontrado.' })

    const month = currentMonth()
    const tickets = await ChallengerTicket.find({ proTeam: teamId, month })
      .populate('challengerTeam', teamSelect())
      .sort({ createdAt: -1 })

    const completed = tickets.filter(t => t.status === 'completed').length
    const pending = tickets.filter(t => ['pending', 'accepted', 'scheduled'].includes(t.status)).length
    const played = tickets.filter(t => t.status === 'played').length

    res.json({
      team: {
        id: team._id,
        name: team.name,
        tag: team.tag,
        logo: team.logo,
        game: team.game,
        tiers: team.tiers,
        rankPts: team.rankPts,
      },
      competitive: await getTeamCompetitiveSnapshot(team),
      challengerMode: team.challengerMode || {},
      month,
      stats: { completed, pending, played, total: tickets.length },
      tickets,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── List pro teams with active challenger mode ─────────────────────────────
export async function listChallengerTeams(req, res) {
  try {
    const { game } = req.query
    const query = { 'challengerMode.active': true }
    if (game) query.game = { $regex: new RegExp(game, 'i') }

    const teams = await Team.find(query)
      .select(teamSelect())
      .sort({ rankPts: -1 })
      .limit(50)
      .lean()

    const teamsWithCompetitive = await Promise.all(teams.map(attachCompetitive))
    res.json({ teams: teamsWithCompetitive.filter(team => team.competitive?.eligibility?.canBeChallenged) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
