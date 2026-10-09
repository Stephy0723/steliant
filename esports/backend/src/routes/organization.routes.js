import { Router } from 'express'
import { getMyOrganization, getDiscordAccess, requestDiscordAccess } from '../controllers/organization.controller.js'
import { submitRequest, myRequest } from '../controllers/organizationRequests.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'

const router = Router()

router.use(requireAuth, requireDatabase)

router.get('/mine', getMyOrganization)
router.get('/mine/request', myRequest)
router.post('/requests', submitRequest)
router.get('/discord-access', getDiscordAccess)
router.post('/discord-access', requestDiscordAccess)

export default router
