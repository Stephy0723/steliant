import { Router } from 'express'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { getActiveAds, getAdById, trackImpression, trackClick } from '../controllers/ads.controller.js'

const router = Router()

// Públicos — no requieren auth (el frontend los llama al renderizar)
router.get ('/',        requireDatabase, getActiveAds)   // ?type=banner|strip|floating
router.get ('/:adId',  requireDatabase, getAdById)
router.post('/:adId/impression', requireDatabase, trackImpression)
router.post('/:adId/click',      requireDatabase, trackClick)

export default router
