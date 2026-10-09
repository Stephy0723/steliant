import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import {
  submitApplication,
  myApplications,
  adminListApplications,
  adminRoleStats,
  adminReviewApplication,
} from '../controllers/roleApplications.controller.js'

const router = Router()

router.post('/',              authenticateToken,               submitApplication)
router.get('/my',             authenticateToken,               myApplications)
router.get('/admin/stats',    authenticateToken, requireAdmin, adminRoleStats)
router.get('/admin',          authenticateToken, requireAdmin, adminListApplications)
router.patch('/admin/:id',    authenticateToken, requireAdmin, adminReviewApplication)

export default router
