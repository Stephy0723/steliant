import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { getPublicCreators } from '../controllers/users.controller.js'

const router = Router()

router.get('/creators', requireAuth, getPublicCreators)

export default router
