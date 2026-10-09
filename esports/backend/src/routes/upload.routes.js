import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { uploadLimiter } from '../middleware/rateLimit.js'
import { uploadFile } from '../controllers/upload.controller.js'

const router = Router()
// uploadLimiter: sin él una cuenta podía llenar el disco en bucle.
router.post('/', authenticateToken, uploadLimiter, uploadFile)
export default router
