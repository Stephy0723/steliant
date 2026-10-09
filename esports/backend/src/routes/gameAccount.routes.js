import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import {
  getMyGameAccounts, sendGameCode, verifyGameCode, confirmGameAccount, disconnectGameAccount, getGameAccountStatus,
} from '../controllers/gameAccount.controller.js'

const router = Router()
const byUser = req => String(req.user._id)
// Cada envio manda un correo dentro del juego: pocos por usuario para que
// nadie lo use para llenarle el buzon a otra cuenta.
const sendLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 4, standardHeaders: true, legacyHeaders: false, keyGenerator: byUser,
  message: { code: 'GAME_CODE_RATE_LIMIT', message: 'Ya pediste varios códigos. Espera unos minutos antes de pedir otro.' } })
const verifyLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false, keyGenerator: byUser,
  message: { code: 'GAME_CODE_RATE_LIMIT', message: 'Demasiados intentos. Espera unos minutos.' } })

router.use(requireAuth, requireDatabase)
router.get('/me', getMyGameAccounts)
router.get('/status', getGameAccountStatus)
router.post('/mlbb/send-code', sendLimit, sendGameCode)
router.post('/mlbb/verify', verifyLimit, verifyGameCode)
router.post('/mlbb/confirm', confirmGameAccount)
router.delete('/mlbb', disconnectGameAccount)
export default router
