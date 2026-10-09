import { Router } from 'express'
import {
  activateChallengerMode,
  deactivateChallengerMode,
  createChallengerTicket,
  respondChallengerTicket,
  reportResult,
  getTeamTickets,
  getChallengerDashboard,
  listChallengerTeams
} from '../controllers/challenger.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.use(requireAuth)

// Challenger mode activation/deactivation
router.post('/activate', generalLimiter, activateChallengerMode)
router.post('/deactivate', generalLimiter, deactivateChallengerMode)

// List of pro teams with active challenger mode
router.get('/pro-teams', generalLimiter, listChallengerTeams)

// Ticket endpoints
router.post('/tickets', generalLimiter, createChallengerTicket)
router.patch('/tickets/:id/respond', generalLimiter, respondChallengerTicket)
router.patch('/tickets/:id/result', generalLimiter, reportResult)
router.get('/tickets/team/:teamId', generalLimiter, getTeamTickets)

// Pro team dashboard
router.get('/dashboard/:teamId', generalLimiter, getChallengerDashboard)

export default router
