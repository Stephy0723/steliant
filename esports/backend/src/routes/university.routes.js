import { Router } from 'express'
import {
  listUniversityCatalog,
  getUniversityCatalogDetail,
  getUniversityStandings,
  getMyUniversityStatus,
  listUniversityApplications,
  getUniversityMicrosoftStatus,
  unlinkUniversityMicrosoftConnection,
  unlinkUniversityVerification,
  startUniversityMicrosoftConnect,
  completeUniversityMicrosoftConnect,
  confirmUniversityMicrosoftVerification,
  adminUnlinkUniversity,
  getUniversityGamesCatalog,
  adminListUniversityCatalog,
  createUniversityCatalogEntry,
  updateUniversityCatalogEntry,
  setUniversityCatalogActive,
} from '../controllers/university.controller.js'
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

// ─── Public ───────────────────────────────────────────────────────────────────
// Microsoft redirige aqui el navegador tras iniciar sesion; la identidad del
// usuario viaja firmada en `state`, por eso no pasa por requireAuth.
router.get('/microsoft/callback', completeUniversityMicrosoftConnect)
router.get('/catalog',     generalLimiter, listUniversityCatalog)
router.get('/catalog/:id', generalLimiter, getUniversityCatalogDetail)
router.get('/standings',   generalLimiter, getUniversityStandings)
router.get('/games-catalog', generalLimiter, getUniversityGamesCatalog)

// ─── Authenticated ────────────────────────────────────────────────────────────
router.get('/me',            requireAuth, getMyUniversityStatus)
router.delete('/me',         requireAuth, unlinkUniversityVerification)
// Verificación universitaria: el estudiante inicia sesión con la cuenta
// Microsoft de su universidad (sin códigos), luego elige campus/carrera.
router.get('/microsoft/start',     requireAuth, generalLimiter, startUniversityMicrosoftConnect)
router.post('/microsoft/confirm',  requireAuth, generalLimiter, confirmUniversityMicrosoftVerification)
router.get('/microsoft/status',   requireAuth, getUniversityMicrosoftStatus)
router.delete('/microsoft',       requireAuth, unlinkUniversityMicrosoftConnection)

// ─── Admin only ───────────────────────────────────────────────────────────────
router.get('/applications',        requireAuth, requireAdmin, listUniversityApplications)
router.delete('/admin/users/:userId', requireAuth, requireAdmin, adminUnlinkUniversity)
router.get('/admin/catalog',          requireAuth, requireAdmin, adminListUniversityCatalog)
router.post('/catalog',               requireAuth, requireAdmin, createUniversityCatalogEntry)
router.put('/catalog/:id',            requireAuth, requireAdmin, updateUniversityCatalogEntry)
router.patch('/catalog/:id/active',   requireAuth, requireAdmin, setUniversityCatalogActive)

export default router
