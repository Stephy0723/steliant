import { Router } from 'express'
import { listNotifications, markRead, markAllRead, archiveNotification, deleteNotification } from '../controllers/notification.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)

router.get('/', listNotifications)
router.patch('/:id/read', markRead)
router.patch('/read-all', markAllRead)
router.patch('/:id/archive', archiveNotification)
router.delete('/:id', deleteNotification)

export default router
