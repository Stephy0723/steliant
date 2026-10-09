import { Router } from 'express'
import { requireDatabase } from '../middleware/requireDatabase.js'
import {
  listSiteAds, trackSiteAdImpression, trackSiteAdClick,
  listSitePromos,
} from '../controllers/siteAds.controller.js'

const router = Router()

// Públicos — sin auth, las páginas los consultan al renderizar
router.get ('/site-ads',                    requireDatabase, listSiteAds)
router.post('/site-ads/:id/impression',     requireDatabase, trackSiteAdImpression)
router.post('/site-ads/:id/click',          requireDatabase, trackSiteAdClick)
router.get ('/site-promos',                 requireDatabase, listSitePromos)

export default router
