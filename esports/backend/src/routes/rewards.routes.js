import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { getRewards } from '../controllers/rewards.controller.js'

const router = Router()

router.use(requireAuth, requireDatabase)
router.get('/', getRewards)

export default router
