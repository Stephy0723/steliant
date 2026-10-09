import { Router } from 'express'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { getAdsVisibility } from '../controllers/settings.controller.js'

const router = Router()

router.get('/ads', requireDatabase, getAdsVisibility)

export default router
