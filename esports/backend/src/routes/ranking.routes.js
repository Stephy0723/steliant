import { Router } from 'express'
import { getGlobalRanking, getMyRanking, getRegionalRanking, getTeamRanking } from '../controllers/ranking.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/me', getMyRanking)
router.get('/regional', getRegionalRanking)
router.get('/', getGlobalRanking)
router.get('/teams', getTeamRanking)

export default router
