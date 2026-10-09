import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import {
  listMyWorkPlans, createWorkPlan, updateWorkPlan, sendWorkPlan, listTeamWorkPlans, approveWorkPlan,
} from '../controllers/coach.controller.js'

const router = Router()

router.use(requireDatabase, requireAuth)
router.get('/work-plans', listMyWorkPlans)
router.post('/work-plans', createWorkPlan)
router.get('/work-plans/team/:teamId', listTeamWorkPlans)
router.patch('/work-plans/:id', updateWorkPlan)
router.post('/work-plans/:id/send', sendWorkPlan)
router.post('/work-plans/:id/approve', approveWorkPlan)

export default router
