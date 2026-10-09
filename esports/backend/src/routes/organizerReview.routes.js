import { Router } from 'express'
import {
  upsertOrganizerReview, listOrganizerReviews, organizerReviewsSummary, getMyOrganizerReview,
} from '../controllers/organizerReview.controller.js'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Estaticas ANTES de /:organizerId para evitar que 'reviews' se interprete
// como un organizerId.
router.get('/reviews/summary', generalLimiter, optionalAuth, organizerReviewsSummary)

router.get('/:organizerId/reviews', generalLimiter, optionalAuth, listOrganizerReviews)
router.get('/:organizerId/reviews/mine', requireAuth, getMyOrganizerReview)
router.post('/:organizerId/reviews', requireAuth, upsertOrganizerReview)

export default router
