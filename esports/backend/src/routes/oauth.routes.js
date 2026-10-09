import { Router } from 'express'
import { oauthStatus, oauthStart, oauthCallback } from '../controllers/oauth.controller.js'

const router = Router()
router.get('/status', oauthStatus)
router.get('/:provider/start', oauthStart)
router.get('/:provider/callback', oauthCallback)
export default router
