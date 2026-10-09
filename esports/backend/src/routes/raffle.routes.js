import { Router } from 'express'
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { listPublicRaffles, joinRaffle } from '../controllers/raffle.controller.js'

const router = Router()

router.get('/', requireDatabase, optionalAuth, listPublicRaffles)
router.post('/:id/join', requireDatabase, requireAuth, joinRaffle)

export default router
