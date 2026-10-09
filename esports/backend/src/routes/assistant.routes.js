import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { chatWithGG, status } from '../controllers/assistant.controller.js'

const router = Router()

// Limite por usuario (no por IP): protege la cuota gratuita de Gemini.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => String(req.user?._id || req.ip),
  handler: (_req, res) => res.status(429).json({ message: 'Vas muy rapido. Espera unos segundos e intenta de nuevo.' }),
})

router.use(requireAuth)
router.get('/status', status)
router.post('/chat', requireDatabase, chatLimiter, chatWithGG)

export default router
