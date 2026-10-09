import { Router } from 'express'
import {
  assignOperationItem,
  createOperationTemplate,
  getOperationLogs,
  getOperationsQueue,
  listOperationTemplates,
  replyOperationItem,
  updateOperationItemStatus,
  updateOperationTemplate,
} from '../controllers/adminOperations.controller.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js'

const router = Router()

// Sin esto, cualquiera sin sesión podía leer la cola completa (tickets,
// solicitudes de marca, facturas pendientes, reportes de torneo) -- faltaba
// en la versión de main, se agrega acá antes de montar la ruta.
router.use(requireAuth, requireAdmin, requireDatabase)
router.get('/queue', getOperationsQueue)
router.get('/logs', getOperationLogs)
router.get('/templates', listOperationTemplates)
router.post('/templates', createOperationTemplate)
router.patch('/templates/:id', updateOperationTemplate)
router.post('/items/:module/:id/assign', assignOperationItem)
router.post('/items/:module/:id/status', updateOperationItemStatus)
router.post('/items/:module/:id/reply', replyOperationItem)

export default router
