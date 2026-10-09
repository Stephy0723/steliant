import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { getMyPublicationCount, createPublicationRequest } from '../controllers/publicationRequests.controller.js'

const router = Router()

router.get ('/me/count', requireAuth, requireDatabase, getMyPublicationCount)
router.post('/',         requireAuth, requireDatabase, createPublicationRequest)

export default router
