import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { getReview, getCase, postTake, postDecide, postAppeal, getRecordingTrack } from '../controllers/resultCases.controller.js'

const router = Router()
router.use(requireAuth, requireDatabase)
router.get('/review', getReview)
router.get('/cases/:id', getCase)
router.post('/cases/:id/take', postTake)
router.post('/cases/:id/decide', postDecide)
router.post('/cases/:id/appeal', postAppeal)
router.get('/cases/:id/recordings/:recordingId/tracks/:discordUserId', getRecordingTrack)

export default router
