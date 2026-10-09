import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config/index.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { getMatchStats, extractStats, importStatsEvidence, saveMatchStats, confirmMatchStats } from '../controllers/matchStats.controller.js'

// Mounted after tournamentRoutes.requireAuth. Parent identifiers remain available.
const router = Router({ mergeParams: true })
const reads = rateLimit({ windowMs: 60000, max: config.matchStats.requestsPerMinute, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => String(req.user._id), message: { message: 'Límite de lecturas alcanzado. Espera un minuto o completa el borrador manualmente.' } })
const writes = rateLimit({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => String(req.user._id), message: { message: 'Demasiados cambios seguidos. Espera un minuto antes de guardar de nuevo.' } })
router.use(requireDatabase)
router.get('/', getMatchStats)
router.post('/extract', reads, extractStats)
router.post('/evidence', reads, importStatsEvidence)
router.put('/', writes, saveMatchStats)
router.post('/confirm', writes, confirmMatchStats)
export default router
