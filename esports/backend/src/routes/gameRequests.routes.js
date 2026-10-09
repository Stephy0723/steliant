import { Router } from 'express'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { createGameRequest, listGameRequests, reviewGameRequest } from '../controllers/gameRequests.controller.js'

const router = Router()

router.post('/', requireDatabase, optionalAuth, createGameRequest)
router.get('/admin', requireDatabase, requireAuth, requireAdmin, listGameRequests)
router.patch('/admin/:id', requireDatabase, requireAuth, requireAdmin, reviewGameRequest)

export default router
