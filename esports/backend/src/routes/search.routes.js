import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { globalSearch } from '../controllers/search.controller.js'

const router = Router()
router.get('/', requireAuth, globalSearch)
export default router
