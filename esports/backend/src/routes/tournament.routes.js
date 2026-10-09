import { Router } from 'express'
import matchStatsRoutes from './matchStats.routes.js'
import {
  createTournament, listTournaments, searchTournaments,
  getTournament, getMyTournaments, getMyStaffTournaments, getTournamentsByTeam, updateTournament,
  registerTeam, cancelRegistration,
  getBracket, saveBracket,
  listRegistrations, updateRegistrationCheckin, getBroadcastKit,
  listReports, createReport, updateReportStatus,
  getTournamentDiscordSummary, getTournamentDiscordLog, retryTeamDiscordProvision, retryTournamentDiscordProvision,
  addTournamentCaster, removeTournamentCaster, respondStaffInvitation,
  addStaffMember, getTournamentStaffRoom, applyForStaff, updateStaffMember, removeStaffMember,
  getTournamentAuditLog,
} from '../controllers/tournament.controller.js'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { tournamentBannerUpload } from '../middleware/multer.js'
import { generalLimiter } from '../middleware/rateLimit.js'
import { getTournamentDraft, saveTournamentDraft, deleteTournamentDraft } from '../controllers/tournamentDraft.controller.js'
import { getMatchReport, submitMatchReport, listMatchReports } from '../controllers/matchReports.controller.js'
import { listSupportTickets, resolveSupportTicket } from '../controllers/supportTickets.controller.js'

const router = Router()

// Public
router.get('/', generalLimiter, optionalAuth, listTournaments)
router.get('/search', generalLimiter, optionalAuth, searchTournaments)
router.get('/mine', requireAuth, getMyTournaments)
router.get('/staff/mine', requireAuth, getMyStaffTournaments)
router.get('/by-team/:teamId', requireAuth, getTournamentsByTeam)
router.get('/draft/current', requireAuth, getTournamentDraft)
router.put('/draft/current', requireAuth, saveTournamentDraft)
router.delete('/draft/:key', requireAuth, deleteTournamentDraft)
router.get('/:id', optionalAuth, getTournament)

// Authenticated
router.use(requireAuth)
router.use('/:id/matches/:matchId/stats/:gameNumber', matchStatsRoutes)

router.post('/', tournamentBannerUpload, createTournament)
router.put('/:id', updateTournament)
router.get('/:id/bracket', getBracket)
router.put('/:id/bracket', saveBracket)
router.get('/:id/bracket/reports', listMatchReports)
router.get('/:id/bracket/matches/:matchId/report', getMatchReport)
router.post('/:id/bracket/matches/:matchId/report', generalLimiter, submitMatchReport)
router.get('/:id/registrations', listRegistrations)
router.get('/:id/broadcast-kit', getBroadcastKit)
router.get('/:id/discord-summary', getTournamentDiscordSummary)
router.get('/:id/discord-log', getTournamentDiscordLog)
router.post('/:id/discord/teams/:teamId/retry', retryTeamDiscordProvision)
router.post('/:id/discord/retry', retryTournamentDiscordProvision)
router.get('/:id/support-tickets', listSupportTickets)
router.post('/:id/support-tickets/:ticketId/resolve', resolveSupportTicket)
router.post('/:id/registrations/:rid/checkin', updateRegistrationCheckin)
router.get('/:id/reports', listReports)
router.post('/:id/reports', createReport)
router.patch('/:id/reports/:rid', updateReportStatus)
router.post('/:id/register', registerTeam)
router.delete('/:id/register', cancelRegistration)
router.get('/:id/staff-room', getTournamentStaffRoom)
router.post('/:id/staff', addStaffMember)
router.post('/:id/staff/apply', applyForStaff)
router.post('/:id/staff/casters', addTournamentCaster)
router.delete('/:id/staff/casters/:userId', removeTournamentCaster)
router.patch('/:id/staff/response', respondStaffInvitation)
router.patch('/:id/staff/:userId', updateStaffMember)
router.delete('/:id/staff/:userId', removeStaffMember)
router.get('/:id/audit-log', getTournamentAuditLog)

export default router
