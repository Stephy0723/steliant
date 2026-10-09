import { Invoice }  from '../models/Invoice.js'
import { Campaign } from '../models/Campaign.js'
import { Brand }    from '../models/Brand.js'
import { createInvoiceNumber } from '../services/codes.service.js'

// ── Brand: enviar comprobante de pago ─────────────────────────────────────────
// POST /brands/me/campaigns/:cid/invoice
export async function submitPaymentProof(req, res, next) {
  try {
    const brandId = req.user.brandId
    if (!brandId) return res.status(403).json({ error: 'Sin marca asignada' })

    const brand = await Brand.findById(brandId)
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' })

    const campaign = await Campaign.findOne({ _id: req.params.cid, brandId }).populate('tournamentId')
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    const { amount, proofUrl, proofType, brandNotes } = req.body
    if (!amount || !proofUrl) return res.status(400).json({ error: 'amount y proofUrl son requeridos' })

    // Evitar duplicados: si ya existe factura pendiente para esta campaña
    const existing = await Invoice.findOne({ campaignId: campaign._id, status: 'pending' })
    if (existing) return res.status(409).json({ error: 'Ya existe un comprobante pendiente para esta campaña' })

    const codes = await createInvoiceNumber(
      brand.code,
      campaign.tournamentId?.publicId || null,
      brand._id,
      campaign.tournamentId?._id || null,
      new Date()
    )

    const invoice = await Invoice.create({
      brandId,
      campaignId: campaign._id,
      invoiceNumber: codes.invoiceNumber,
      internalCode: codes.internalCode,
      amount: Number(amount),
      proofUrl,
      proofType: proofType || 'other',
      brandNotes: brandNotes || '',
      status: 'pending',
    })

    // Actualiza el payment status en la campaña también
    campaign.payment.amount    = Number(amount)
    campaign.payment.proofUrl  = proofUrl
    campaign.payment.proofType = proofType || 'other'
    campaign.payment.status    = 'pending'
    await campaign.save()

    res.status(201).json({ ok: true, invoice })
  } catch (e) { next(e) }
}

// ── Brand: ver historial de facturas ─────────────────────────────────────────
// GET /brands/me/invoices
export async function getMyInvoices(req, res, next) {
  try {
    const brandId = req.user.brandId
    if (!brandId) return res.status(403).json({ error: 'Sin marca asignada' })

    const invoices = await Invoice.find({ brandId })
      .populate('campaignId', 'name startDate endDate status')
      .sort({ createdAt: -1 })
    res.json(invoices)
  } catch (e) { next(e) }
}

// ── Admin: ver facturas pendientes ────────────────────────────────────────────
// GET /brands/admin/invoices?status=pending
export async function adminGetInvoices(req, res, next) {
  try {
    const { status = 'pending' } = req.query
    const filter = status === 'all' ? {} : { status }
    const invoices = await Invoice.find(filter)
      .populate('brandId', 'name code color logoInitials')
      .populate('campaignId', 'name budget startDate endDate')
      .sort({ createdAt: -1 })
    res.json(invoices)
  } catch (e) { next(e) }
}

// ── Admin: verificar / rechazar pago ─────────────────────────────────────────
// Logica compartida entre PATCH /brands/admin/invoices/:invoiceId y
// PATCH /brands/admin/campaigns/:cid/payment (el modal de la campaña en
// AdminMarcas, donde el admin ya esta mirando el comprobante). Sin esta
// segunda via no habia NINGUNA pantalla para verificar pagos, y con el
// candado de adminApproveCampaignFull ninguna campaña podria publicarse.
async function reviewInvoice(invoice, { action, adminNotes, rejectedReason }, reviewer) {
  if (!['verify', 'reject'].includes(action)) {
    throw Object.assign(new Error('action debe ser verify o reject'), { status: 400 })
  }
  if (invoice.status !== 'pending') throw Object.assign(new Error('Factura ya procesada'), { status: 400 })

  if (action === 'reject') {
    if (!rejectedReason?.trim()) throw Object.assign(new Error('El motivo de rechazo es obligatorio'), { status: 400 })
    invoice.status         = 'rejected'
    invoice.rejectedReason = rejectedReason.trim()
    invoice.adminNotes     = adminNotes || ''
    await invoice.save()

    // Refleja en la campaña
    await Campaign.findByIdAndUpdate(invoice.campaignId, {
      'payment.status': 'rejected',
      'payment.rejectedReason': rejectedReason.trim(),
    })
    return { ok: true, status: 'rejected', invoice }
  }

  invoice.status     = 'verified'
  invoice.approvedBy = reviewer
  invoice.approvedAt = new Date()
  invoice.adminNotes = adminNotes || ''
  await invoice.save()

  await Campaign.findByIdAndUpdate(invoice.campaignId, {
    'payment.status':         'verified',
    'payment.rejectedReason': '',
    'payment.verifiedBy':     reviewer,
    'payment.verifiedAt':     new Date(),
  })
  return { ok: true, status: 'verified', invoice }
}

const sendReviewError = (res, e) => res.status(e.status).json({ error: e.message })

// PATCH /brands/admin/invoices/:invoiceId
export async function adminReviewInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' })
    res.json(await reviewInvoice(invoice, req.body, req.user._id))
  } catch (e) { e.status ? sendReviewError(res, e) : next(e) }
}

// PATCH /brands/admin/campaigns/:cid/payment — revisa el comprobante
// pendiente de esa campaña (el mas reciente).
export async function adminReviewCampaignPayment(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ campaignId: req.params.cid, status: 'pending' }).sort({ createdAt: -1 })
    if (!invoice) return res.status(404).json({ error: 'Esta campaña no tiene un comprobante pendiente de revisión' })
    res.json(await reviewInvoice(invoice, req.body, req.user._id))
  } catch (e) { e.status ? sendReviewError(res, e) : next(e) }
}
