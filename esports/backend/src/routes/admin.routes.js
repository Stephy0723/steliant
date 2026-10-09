import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import {
  getAdminSummary, getCensus, getTeams, updateTeamAdmin, deleteTeamAdmin, getTournaments, setTournamentDiscordEnabled,
  setTournamentOrganization, listOrganizations, createOrganization, updateOrganization, sendUserNotice,
  setUserStatus, setUserVerified, deleteUserAdmin, getStaff, promoteStaff, removeStaffRole, openUserCase, getUserActivity,
  adminListCommunityPosts, adminDeleteCommunityPost,
} from '../controllers/admin.controller.js'
import { adminCreateCatalogCommunity, adminDeleteCommunity, adminListCommunities, adminUpdateCommunity } from '../controllers/community.controller.js'
import { adminListRequests, adminReviewRequest } from '../controllers/organizationRequests.controller.js'
import { adminListDiscordAccess, adminReviewDiscordAccess } from '../controllers/organization.controller.js'
import { adminListIntegrationEvents, adminRetryIntegrationEvent } from '../controllers/integrationEvents.controller.js'
import {
  getDiscordServer, getDiscordChannels, getDiscordConfig, updateDiscordConfig,
  listDiscordPublications, createDiscordPublication, updateDiscordPublication,
  publishDiscordPublication, archiveDiscordPublication,
  listDiscordTemplates, createDiscordTemplate, updateDiscordTemplate, deleteDiscordTemplate,
  createDiscordChannel, editDiscordChannel, deleteDiscordChannel, listDiscordChannelLog,
  retractDiscordPublication, getDiscordAutomations, updateDiscordAutomations, testDiscordAutomation,
  listDiscordForumThreads, deleteDiscordThread,
} from '../controllers/discordControl.controller.js'
import { updateAdsVisibility } from '../controllers/settings.controller.js'
import {
  createSiteAd, updateSiteAd, deleteSiteAd, reorderSiteAds,
  createSitePromo, updateSitePromo, deleteSitePromo,
} from '../controllers/siteAds.controller.js'
import { listSanctions, createSanction, deleteSanction } from '../controllers/moderation.controller.js'
import { listAdminPayments, setOrderStatusAdmin } from '../controllers/adminPayments.controller.js'
import { listRaffles, createRaffle, updateRaffle, drawRaffle } from '../controllers/raffle.controller.js'
import { listPublicationRequests, reviewPublicationRequest } from '../controllers/publicationRequests.controller.js'
import {
  listAnnouncementsAdmin, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  listChangelog, createChangelogEntry, deleteChangelogEntry,
} from '../controllers/siteContent.controller.js'
import { validateCode } from '../controllers/adminValidate.controller.js'
import { getExportEntity, getExportCounts, listExportLogs, createExportLog, getSystemExport } from '../controllers/adminExport.controller.js'
import adminOperationsRoutes from './adminOperations.routes.js'
import rateLimit from 'express-rate-limit'
import { config } from '../config/index.js'
import { extractLabStats } from '../controllers/matchStatsLab.controller.js'

const router = Router()

router.use(authenticateToken, requireAdmin)
router.use('/operations', adminOperationsRoutes)
// TEMPORAL — laboratorio de capturas; borrar junto con matchStatsLab.controller.js.
router.post('/match-stats-lab', rateLimit({ windowMs: 60000, max: config.matchStats.requestsPerMinute, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => String(req.user._id), message: { message: 'Límite de lecturas alcanzado. Espera un minuto.' } }), extractLabStats)
router.get('/summary', requireDatabase, getAdminSummary)
router.get('/census', requireDatabase, getCensus)
router.get('/teams', requireDatabase, getTeams)
router.patch('/teams/:id', requireDatabase, updateTeamAdmin)
router.delete('/teams/:id', requireDatabase, deleteTeamAdmin)
router.get('/tournaments', requireDatabase, getTournaments)
router.patch('/tournaments/:id/discord', requireDatabase, setTournamentDiscordEnabled)
router.patch('/tournaments/:id/organization', requireDatabase, setTournamentOrganization)
router.get('/organizations', requireDatabase, listOrganizations)
router.post('/organizations', requireDatabase, createOrganization)
router.patch('/organizations/:id', requireDatabase, updateOrganization)
router.get('/organization-requests', requireDatabase, adminListRequests)
router.post('/organization-requests/:id/review', requireDatabase, adminReviewRequest)
router.get('/communities', requireDatabase, adminListCommunities)
router.post('/communities/catalog', requireDatabase, adminCreateCatalogCommunity)
router.patch('/communities/:id', requireDatabase, adminUpdateCommunity)
router.delete('/communities/:id', requireDatabase, adminDeleteCommunity)
router.get('/community-posts', requireDatabase, adminListCommunityPosts)
router.delete('/community-posts/:id', requireDatabase, adminDeleteCommunityPost)

router.get('/discord-access', requireDatabase, adminListDiscordAccess)
router.post('/discord-access/:userId/review', requireDatabase, adminReviewDiscordAccess)
router.get('/discord/events', requireDatabase, adminListIntegrationEvents)
router.post('/discord/events/:id/retry', requireDatabase, adminRetryIntegrationEvent)
router.get('/discord/server', getDiscordServer)
router.get('/discord/channels', getDiscordChannels)
router.get('/discord/channels/log', requireDatabase, listDiscordChannelLog)
router.post('/discord/channels', requireDatabase, createDiscordChannel)
router.patch('/discord/channels/:id', requireDatabase, editDiscordChannel)
router.delete('/discord/channels/:id', requireDatabase, deleteDiscordChannel)
router.get('/discord/config', requireDatabase, getDiscordConfig)
router.patch('/discord/config', requireDatabase, updateDiscordConfig)
router.get('/discord/publications', requireDatabase, listDiscordPublications)
router.post('/discord/publications', requireDatabase, createDiscordPublication)
router.patch('/discord/publications/:id', requireDatabase, updateDiscordPublication)
router.post('/discord/publications/:id/publish', requireDatabase, publishDiscordPublication)
router.post('/discord/publications/:id/archive', requireDatabase, archiveDiscordPublication)
router.post('/discord/publications/:id/retract', requireDatabase, retractDiscordPublication)
router.get('/discord/automations', requireDatabase, getDiscordAutomations)
router.patch('/discord/automations', requireDatabase, updateDiscordAutomations)
router.post('/discord/automations/:kind/test', requireDatabase, testDiscordAutomation)
router.get('/discord/forums/:id/threads', listDiscordForumThreads)
router.delete('/discord/threads/:id', requireDatabase, deleteDiscordThread)
router.get('/discord/templates', requireDatabase, listDiscordTemplates)
router.post('/discord/templates', requireDatabase, createDiscordTemplate)
router.patch('/discord/templates/:id', requireDatabase, updateDiscordTemplate)
router.delete('/discord/templates/:id', requireDatabase, deleteDiscordTemplate)
router.post('/users/:id/notice', requireDatabase, sendUserNotice)
router.patch('/users/:id/status', requireDatabase, setUserStatus)
router.patch('/users/:id/verify', requireDatabase, setUserVerified)
router.delete('/users/:id', requireDatabase, deleteUserAdmin)
router.post('/users/:id/case', requireDatabase, openUserCase)
router.get('/users/:id/activity', requireDatabase, getUserActivity)

router.get('/staff', requireDatabase, getStaff)
router.post('/staff', requireDatabase, promoteStaff)
router.delete('/staff/:id/:role', requireDatabase, removeStaffRole)

router.get('/moderation', requireDatabase, listSanctions)
router.post('/moderation', requireDatabase, createSanction)
router.delete('/moderation/:id', requireDatabase, deleteSanction)

router.get('/payments', requireDatabase, listAdminPayments)
router.get('/validate', requireDatabase, validateCode)

router.get('/export-counts', requireDatabase, getExportCounts)
router.get('/export-system', requireDatabase, getSystemExport)
router.get('/export/:entity', requireDatabase, getExportEntity)
router.get('/export-logs', requireDatabase, listExportLogs)
router.post('/export-logs', requireDatabase, createExportLog)
router.patch('/payments/:id/status', requireDatabase, setOrderStatusAdmin)

router.get('/raffles', requireDatabase, listRaffles)
router.post('/raffles', requireDatabase, createRaffle)
router.patch('/raffles/:id', requireDatabase, updateRaffle)
router.post('/raffles/:id/draw', requireDatabase, drawRaffle)

router.get('/publication-requests', requireDatabase, listPublicationRequests)
router.patch('/publication-requests/:id', requireDatabase, reviewPublicationRequest)

router.patch('/settings/ads', requireDatabase, updateAdsVisibility)

router.post  ('/site-ads',           requireDatabase, createSiteAd)
router.patch ('/site-ads/reorder',   requireDatabase, reorderSiteAds)
router.patch ('/site-ads/:id',       requireDatabase, updateSiteAd)
router.delete('/site-ads/:id',       requireDatabase, deleteSiteAd)
router.post  ('/site-promos',        requireDatabase, createSitePromo)
router.patch ('/site-promos/:slug',  requireDatabase, updateSitePromo)
router.delete('/site-promos/:slug',  requireDatabase, deleteSitePromo)

router.get   ('/announcements',     requireDatabase, listAnnouncementsAdmin)
router.post  ('/announcements',     requireDatabase, createAnnouncement)
router.patch ('/announcements/:id', requireDatabase, updateAnnouncement)
router.delete('/announcements/:id', requireDatabase, deleteAnnouncement)
router.get   ('/changelog',         requireDatabase, listChangelog)
router.post  ('/changelog',         requireDatabase, createChangelogEntry)
router.delete('/changelog/:id',     requireDatabase, deleteChangelogEntry)

export default router
