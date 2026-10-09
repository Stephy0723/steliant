import { Router } from 'express'
import { listNews, getNewsItem, createNews, updateNews, deleteNews, trackNews } from '../controllers/news.controller.js'
import { optionalAuth, requireAuth, requireAdmin } from '../middleware/auth.middleware.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get('/', generalLimiter, optionalAuth, listNews)
router.get('/:id', optionalAuth, getNewsItem)
router.post('/:id/track', generalLimiter, trackNews)

router.use(requireAuth, requireAdmin)
router.post('/', createNews)
router.put('/:id', updateNews)
router.delete('/:id', deleteNews)

export default router
