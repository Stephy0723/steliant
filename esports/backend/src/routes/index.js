import { Router } from 'express'
import { health } from '../controllers/health.controller.js'
import { getCsrfToken } from '../controllers/auth.controller.js'
import authRoutes from './auth.routes.js'
import profileRoutes from './profile.routes.js'
import teamRoutes from './team.routes.js'
import tournamentRoutes from './tournament.routes.js'
import rankingRoutes from './ranking.routes.js'
import newsRoutes from './news.routes.js'
import notificationRoutes from './notification.routes.js'
import countriesRoutes from './countries.routes.js'
import universityRoutes from './university.routes.js'
import brandsRoutes from './brands.routes.js'
import roleApplicationsRoutes from './roleApplications.routes.js'
import uploadRoutes from './upload.routes.js'
import adminRoutes from './admin.routes.js'
import postRoutes from './post.routes.js'
import playerRoutes from './player.routes.js'
import challengerRoutes from './challenger.routes.js'
import gameRequestsRoutes from './gameRequests.routes.js'
import systemTicketsRoutes from './systemTickets.routes.js'
import messagesRoutes from './messages.routes.js'
import communityRoutes from './community.routes.js'
import botsRoutes from './bots.routes.js'
import organizationRoutes from './organization.routes.js'
import organizerReviewRoutes from './organizerReview.routes.js'
import usersRoutes from './users.routes.js'
import paymentRoutes from './payment.routes.js'
import rewardsRoutes from './rewards.routes.js'
import adsRoutes from './ads.routes.js'
import searchRoutes from './search.routes.js'
import settingsRoutes from './settings.routes.js'
import siteAdsRoutes from './siteAds.routes.js'
import publicationRequestsRoutes from './publicationRequests.routes.js'
import assistantRoutes from './assistant.routes.js'
import raffleRoutes from './raffle.routes.js'
import siteContentRoutes from './siteContent.routes.js'
import coachRoutes from './coach.routes.js'
import gameAccountRoutes from './gameAccount.routes.js'
import resultCasesRoutes from './resultCases.routes.js'
import { auditAdminMutations } from '../services/adminAudit.js'
import { writeLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get('/health', health)
router.get('/csrf-token', getCsrfToken)
// Bitacora de staff: registra al terminar cada cambio exitoso de un admin en
// rutas de gestion (ver services/adminAudit.js).
router.use(auditAdminMutations)
// Límite global de escrituras por usuario (anti-spam de bots); ver rateLimit.js.
router.use(writeLimiter)
router.use('/auth', authRoutes)
router.use('/profile', profileRoutes)
router.use('/teams', teamRoutes)
router.use('/challenger', challengerRoutes)
router.use('/tournaments', tournamentRoutes)
router.use('/rankings', rankingRoutes)
router.use('/news', newsRoutes)
router.use('/notifications', notificationRoutes)
router.use('/countries', countriesRoutes)
router.use('/university', universityRoutes)
router.use('/brands', brandsRoutes)
router.use('/role-applications', roleApplicationsRoutes)
router.use('/uploads', uploadRoutes)
router.use('/admin', adminRoutes)
router.use('/posts', postRoutes)
router.use('/players', playerRoutes)
router.use('/game-requests', gameRequestsRoutes)
router.use('/system-tickets', systemTicketsRoutes)
router.use('/messages', messagesRoutes)
router.use('/communities', communityRoutes)
router.use('/bots', botsRoutes)
router.use('/organizations', organizationRoutes)
router.use('/organizers', organizerReviewRoutes)
router.use('/users', usersRoutes)
router.use('/payments', paymentRoutes)
router.use('/rewards', rewardsRoutes)
router.use('/ads', adsRoutes)
router.use('/search', searchRoutes)
router.use('/settings', settingsRoutes)
router.use('/game-accounts', gameAccountRoutes)
router.use('/results', resultCasesRoutes)
router.use(siteAdsRoutes)
router.use('/publication-requests', publicationRequestsRoutes)
router.use('/assistant', assistantRoutes)
router.use('/raffles', raffleRoutes)
router.use('/site', siteContentRoutes)
router.use('/coach', coachRoutes)

export default router
