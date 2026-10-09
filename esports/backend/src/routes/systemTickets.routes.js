import { Router } from 'express'
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import {
  createSystemTicket,
  getMySystemTicket,
  getSystemTicketAdmin,
  listSystemTicketsAdmin,
  mySystemTickets,
  replySystemTicketAdmin,
  replySystemTicketUser,
  summarySystemTicketsAdmin,
  updateSystemTicketAdmin,
} from '../controllers/systemTickets.controller.js'

const router = Router()

router.post('/', requireDatabase, optionalAuth, createSystemTicket)
router.get('/my', requireDatabase, requireAuth, mySystemTickets)
router.get('/admin/summary', requireDatabase, requireAuth, requireAdmin, summarySystemTicketsAdmin)
router.get('/admin', requireDatabase, requireAuth, requireAdmin, listSystemTicketsAdmin)
router.get('/admin/:id', requireDatabase, requireAuth, requireAdmin, getSystemTicketAdmin)
router.patch('/admin/:id', requireDatabase, requireAuth, requireAdmin, updateSystemTicketAdmin)
router.post('/admin/:id/reply', requireDatabase, requireAuth, requireAdmin, replySystemTicketAdmin)
router.get('/:id', requireDatabase, requireAuth, getMySystemTicket)
router.post('/:id/reply', requireDatabase, requireAuth, replySystemTicketUser)

export default router
