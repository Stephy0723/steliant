import { Router } from 'express'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { requireBotAuth } from '../middleware/requireBotAuth.js'
import {
  getProviders,
  askAi,
  draftAi,
  getBotConfig,
  updateBotConfig,
  activateBots,
  linkStart,
  getPlayerProfile,
  listCrmUsers,
  getWhatsappPlayerProfile,
  confirmWhatsappLinkForBot,
  createTeamAsDiscordUser,
  joinTeamAsDiscordUser,
  getTeamForDiscordUser,
  listDiscordTournaments,
  listWhatsappTournaments,
  getWhatsappOrganizationForBot,
  getActiveWhatsappTournament,
  registerTournamentAsDiscordUser,
  registerTournamentAsWhatsappUser,
  getReferralCode,
} from '../controllers/bots.controller.js'
import {
  getActiveDiscordTournament,
  listActiveDiscordTournaments,
  getTeamByDiscordChannel,
  getOrganizationForBot,
  updateOrganizationWelcomeForBot,
  updateOrganizationTournamentsPanel,
  getTournamentTeamsForBot,
  getTournamentMatches,
  checkinMatch,
  startMatch,
  reportMatch,
  addReportEvidence,
  cancelMatchAsBot,
  disqualifyMatch,
  disputeReport,
  getTeamLatestOperation,
  getTeamActiveMatch,
  getTeamOpenCheckin,
  getTeamMatchHistory,
  getExpiredCheckinsForBot,
} from '../controllers/tournamentMatches.controller.js'
import {
  getPendingIntegrationEvents,
  startIntegrationEvent,
  completeIntegrationEvent,
  failIntegrationEvent,
  getTournamentProvisionState,
  getTeamProvisionState,
  completeTournamentProvisionDirect,
  failTournamentProvisionDirect,
} from '../controllers/integrationEvents.controller.js'
import {
  createSupportTicketForBot,
  attachSupportTicketDiscord,
  resolveSupportTicketForBot,
  getSupportTicketForBot,
} from '../controllers/supportTickets.controller.js'
import { postRecording, putRecordingTrack } from '../controllers/matchRecordings.controller.js'

const router = Router()

// Todas las rutas de /api/bots requieren el secreto compartido con el bot.
router.use(requireBotAuth)

// ── Cerebro IA ──
router.get('/ai/providers', getProviders)
router.post('/ai/ask', askAi)
router.post('/ai/draft', draftAi)

// ── Config de bots por torneo ──
router.get('/tournaments/:id/config', requireDatabase, getBotConfig)
router.put('/tournaments/:id/config', requireDatabase, updateBotConfig)
router.post('/tournaments/:id/activate', requireDatabase, activateBots)

// ── Eventos de integracion Discord (web -> backend -> bot) ──
router.get('/events/pending', requireDatabase, getPendingIntegrationEvents)
router.post('/events/:id/start', requireDatabase, startIntegrationEvent)
router.post('/events/:id/done', requireDatabase, completeIntegrationEvent)
router.post('/events/:id/fail', requireDatabase, failIntegrationEvent)
router.get('/provision/tournaments/:id', requireDatabase, getTournamentProvisionState)
router.post('/provision/tournaments/:id/done', requireDatabase, completeTournamentProvisionDirect)
router.post('/provision/tournaments/:id/fail', requireDatabase, failTournamentProvisionDirect)
router.get('/provision/teams/:id', requireDatabase, getTeamProvisionState)

// ── Vinculación de cuenta Discord ──
router.post('/link/start', requireDatabase, linkStart)

// ── Perfil / referidos ──
router.get('/crm/users', requireDatabase, listCrmUsers)
router.get('/players/:discordId', requireDatabase, getPlayerProfile)
router.get('/referral/:discordId', requireDatabase, getReferralCode)
router.get('/whatsapp/players/:phone', requireDatabase, getWhatsappPlayerProfile)
router.post('/whatsapp/link/confirm', requireDatabase, confirmWhatsappLinkForBot)

// ── Equipos ──
router.post('/teams', requireDatabase, createTeamAsDiscordUser)
router.post('/teams/join', requireDatabase, joinTeamAsDiscordUser)
router.get('/teams/:discordId', requireDatabase, getTeamForDiscordUser)

// ── Torneos (solo los habilitados para Discord) ──
router.get('/tournaments', requireDatabase, listDiscordTournaments)
router.post('/tournaments/:id/register', requireDatabase, registerTournamentAsDiscordUser)
router.get('/whatsapp/organizations/:groupId', requireDatabase, getWhatsappOrganizationForBot)
router.get('/whatsapp/tournaments', requireDatabase, listWhatsappTournaments)
router.get('/whatsapp/tournaments/active', requireDatabase, getActiveWhatsappTournament)
router.post('/whatsapp/tournaments/:id/register', requireDatabase, registerTournamentAsWhatsappUser)

// ── Organizaciones (clientes, uno por servidor de Discord) ──
router.get('/organizations/:guildId', requireDatabase, getOrganizationForBot)
router.patch('/organizations/:guildId/welcome', requireDatabase, updateOrganizationWelcomeForBot)
router.patch('/organizations/:guildId/tournaments-panel', requireDatabase, updateOrganizationTournamentsPanel)

// ── Partidas en vivo (check-in / start-match / report / cancelar / calendario) ──
router.get('/tournaments/active', requireDatabase, getActiveDiscordTournament)
router.get('/tournaments/active-list', requireDatabase, listActiveDiscordTournaments)
router.get('/tournaments/team-by-channel', requireDatabase, getTeamByDiscordChannel)
router.get('/tournaments/:id/teams', requireDatabase, getTournamentTeamsForBot)
router.get('/tournaments/:id/matches', requireDatabase, getTournamentMatches)
router.post('/matches/checkin', requireDatabase, checkinMatch)
router.post('/matches/start', requireDatabase, startMatch)
router.get('/matches/expired-checkins', requireDatabase, getExpiredCheckinsForBot)
router.post('/matches/:matchId/report', requireDatabase, reportMatch)
router.post('/teams/:teamId/report/evidence', requireDatabase, addReportEvidence)
router.post('/matches/:matchId/cancel', requireDatabase, cancelMatchAsBot)
router.post('/matches/:matchId/disqualify', requireDatabase, disqualifyMatch)
router.patch('/matches/:matchId/report/dispute', requireDatabase, disputeReport)
// Grabacion de voz de la partida (una pista .ogg por jugador).
router.post('/matches/:matchId/recording', requireDatabase, postRecording)
router.put('/matches/:matchId/recording/tracks/:discordUserId', requireDatabase, putRecordingTrack)
router.get('/teams/:teamId/latest-operation', requireDatabase, getTeamLatestOperation)
router.get('/teams/:teamId/active-match', requireDatabase, getTeamActiveMatch)
router.get('/teams/:teamId/open-checkin', requireDatabase, getTeamOpenCheckin)
router.get('/teams/:teamId/history', requireDatabase, getTeamMatchHistory)

// ── Tickets de #soporte del torneo ──
router.post('/support-tickets', requireDatabase, createSupportTicketForBot)
router.get('/support-tickets/:ticketId', requireDatabase, getSupportTicketForBot)
router.patch('/support-tickets/:ticketId/discord', requireDatabase, attachSupportTicketDiscord)
router.post('/support-tickets/:ticketId/resolve', requireDatabase, resolveSupportTicketForBot)

export default router
