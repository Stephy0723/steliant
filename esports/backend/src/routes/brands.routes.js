import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireAdmin }      from '../middleware/requireAdmin.js'
import { requireDatabase }   from '../middleware/requireDatabase.js'
import {
  listBrands, getBrandById, getPlatformStats,
  submitApplication,
  getMyBrand, getSponsorableTournaments, submitProfileChanges,
  getBrandReports, markReportRead, getBrandReportFile,
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  submitCampaignForReview,
  getCreatives, getCreativeFile, uploadCreative,
  linkCreativeToCampaign, unlinkCreativeFromCampaign, deleteCreative,
  createBrand, updateBrand,
  adminGetAllBrands, adminGetApplications, adminReviewApplication,
  adminGetPendingCampaigns, adminApproveCampaignFull, adminRejectCampaignFull,
  adminGetPendingCreatives, adminReviewCreative,
  adminApproveBrandChanges, adminSendReport, adminGetBrandReports, adminLinkBrandUser,
} from '../controllers/brands.controller.js'
import {
  submitPaymentProof, getMyInvoices,
  adminGetInvoices, adminReviewInvoice, adminReviewCampaignPayment,
} from '../controllers/invoices.controller.js'
import {
  createTicket, getMyTickets, getTicketDetail, replyTicket,
  adminGetTickets, adminGetTicketDetail, adminUpdateTicket,
} from '../controllers/tickets.controller.js'

const router = Router()
const db   = requireDatabase
const auth = authenticateToken
const adm  = requireAdmin

// ── Público ────────────────────────────────────────────────────────────────────
router.get ('/meta/stats', db, getPlatformStats)
router.post('/apply',      db, submitApplication)

// ── Admin: rutas estáticas (ANTES de /:id para evitar colisiones) ─────────────
router.get  ('/admin/all',                      auth, adm, db, adminGetAllBrands)
router.get  ('/admin/applications',             auth, adm, db, adminGetApplications)
router.patch('/admin/applications/:appId',      auth, adm, db, adminReviewApplication)

// Campañas en revisión (el paquete completo: contrato + pago + creatividades)
router.get  ('/admin/campaigns',                auth, adm, db, adminGetPendingCampaigns)
router.patch('/admin/campaigns/:cid/approve',   auth, adm, db, adminApproveCampaignFull)
router.patch('/admin/campaigns/:cid/payment',   auth, adm, db, adminReviewCampaignPayment)
router.patch('/admin/campaigns/:cid/reject',    auth, adm, db, adminRejectCampaignFull)

// Creatividades standalone en galería pendientes de revisión
router.get  ('/admin/pending-creatives',        auth, adm, db, adminGetPendingCreatives)
router.patch('/admin/creatives/:crid',          auth, adm, db, adminReviewCreative)

// Facturas / pagos
router.get  ('/admin/invoices',                 auth, adm, db, adminGetInvoices)
router.patch('/admin/invoices/:invoiceId',       auth, adm, db, adminReviewInvoice)

// Tickets de soporte
router.get  ('/admin/tickets',                  auth, adm, db, adminGetTickets)
router.get  ('/admin/tickets/:tid',             auth, adm, db, adminGetTicketDetail)
router.patch('/admin/tickets/:tid',             auth, adm, db, adminUpdateTicket)
router.post ('/admin/tickets/:tid/reply',       auth, adm, db, replyTicket)

// Gestión directa de marcas
router.post ('/admin/brands',                   auth, adm, db, createBrand)
router.patch('/admin/brands/:id',               auth, adm, db, updateBrand)
router.patch('/admin/brands/:id/changes',       auth, adm, db, adminApproveBrandChanges)
router.post ('/admin/brands/:id/reports',       auth, adm, db, adminSendReport)
router.get  ('/admin/brands/:id/reports',       auth, adm, db, adminGetBrandReports)
router.post ('/admin/brands/:id/link-user',     auth, adm, db, adminLinkBrandUser)

// ── Brand portal: "me" (ANTES de /:id) ────────────────────────────────────────
router.get  ('/me/brand',                       auth, db, getMyBrand)
router.get  ('/me/tournaments',                 auth, db, getSponsorableTournaments)
router.patch('/me/profile',                     auth, db, submitProfileChanges)

// Reportes del equipo GG a la marca
router.get  ('/me/reports',                     auth, db, getBrandReports)
router.get  ('/me/reports/:rid/file',           auth, db, getBrandReportFile)
router.patch('/me/reports/:rid/read',           auth, db, markReportRead)

// Facturación
router.get  ('/me/invoices',                    auth, db, getMyInvoices)

// Tickets de soporte
router.get  ('/me/tickets',                     auth, db, getMyTickets)
router.get  ('/me/tickets/:tid',                auth, db, getTicketDetail)
router.post ('/me/tickets',                     auth, db, createTicket)
router.post ('/me/tickets/:tid/reply',          auth, db, replyTicket)

// ── Público: directorio de marcas ─────────────────────────────────────────────
router.get('/',    db, listBrands)
router.get('/:id', db, getBrandById)

// ── Campañas de una marca ─────────────────────────────────────────────────────
router.get   ('/:id/campaigns',              auth, db, getCampaigns)
router.post  ('/:id/campaigns',              auth, db, createCampaign)
router.patch ('/:id/campaigns/:cid',         auth, db, updateCampaign)
router.delete('/:id/campaigns/:cid',         auth, db, deleteCampaign)
router.post  ('/:id/campaigns/:cid/submit',  auth, db, submitCampaignForReview)
// Pago de la campaña
router.post  ('/:id/campaigns/:cid/invoice', auth, db, submitPaymentProof)

// ── Creatividades de una marca ────────────────────────────────────────────────
router.get   ('/:id/creatives',              auth, db, getCreatives)
router.get   ('/:id/creatives/:crid/file',   auth, db, getCreativeFile)
router.post  ('/:id/creatives',              auth, db, uploadCreative)
router.delete('/:id/creatives/:crid',        auth, db, deleteCreative)
// Vincular / desvincular creatividad a campaña
router.post  ('/:id/creatives/:crid/link',   auth, db, linkCreativeToCampaign)
router.post  ('/:id/creatives/:crid/unlink', auth, db, unlinkCreativeFromCampaign)

export default router
