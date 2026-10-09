import { Router } from 'express'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { listPublicAnnouncements, listChangelog } from '../controllers/siteContent.controller.js'

const router = Router()

router.get('/announcements', requireDatabase, listPublicAnnouncements)
router.get('/changelog', requireDatabase, listChangelog)

export default router
