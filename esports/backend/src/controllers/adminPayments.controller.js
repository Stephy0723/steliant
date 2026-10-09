import { Order } from '../models/Order.js'
import { AdminActionLog } from '../models/AdminActionLog.js'

function actorName(user) {
  return user?.nick || user?.email || 'Admin'
}

async function logAdminAction(req, payload) {
  req._adminAudited = true // ver services/adminAudit.js
  try {
    await AdminActionLog.create({ actor: req.user?._id || null, actorName: actorName(req.user), ...payload })
  } catch (error) {
    console.error('[adminPayments] log error:', error.message)
  }
}

const STATUS_TO_LABEL = {
  paid: 'pagado', demo_paid: 'pagado',
  refunded: 'reembolso',
  failed: 'fallido', canceled: 'fallido',
  requires_payment: 'pendiente',
}
const LABEL_TO_STATUS = { pagado: 'paid', reembolso: 'refunded', fallido: 'failed', pendiente: 'requires_payment' }
const METHOD_LABEL = { paypal: 'PayPal', stripe: 'Tarjeta', transfer: 'Transferencia' }

function mapOrder(o) {
  return {
    id: String(o._id),
    orderCode: o.id,
    user: o.user?.nick || o.user?.email || 'Cuenta eliminada',
    email: o.user?.email || '',
    userId: o.user ? String(o.user._id || o.user) : null,
    concept: o.concept,
    plan: o.planId || '',
    amount: o.amount,
    currency: o.currency || 'USD',
    method: METHOD_LABEL[o.provider] || o.provider,
    date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-ES') : '—',
    status: STATUS_TO_LABEL[o.status] || o.status,
    rawStatus: o.status,
    mode: o.mode,
  }
}

// GET /admin/payments — pagos reales (Order: planes + entradas de torneo).
export async function listAdminPayments(req, res, next) {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(500).populate('user', 'nick email').lean()
    res.json({ payments: orders.map(mapOrder) })
  } catch (error) { next(error) }
}

// PATCH /admin/payments/:id/status  { status: 'pagado'|'reembolso'|'fallido'|'pendiente' }
// Corrige el registro para conciliacion/soporte (ej. un reembolso hecho a
// mano en el dashboard de PayPal). No dispara ningun cobro/reembolso real
// contra la pasarela -- eso todavia no existe, ver BACKEND-PENDIENTE.md.
export async function setOrderStatusAdmin(req, res, next) {
  try {
    const label = String(req.body?.status || '').trim()
    if (!LABEL_TO_STATUS[label]) return res.status(400).json({ message: 'Estado invalido' })

    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pago no encontrado' })

    const before = order.status
    let next = LABEL_TO_STATUS[label]
    if (next === 'paid' && order.mode === 'demo') next = 'demo_paid'
    order.status = next
    await order.save()

    await logAdminAction(req, {
      action: 'payment_status_changed', module: 'payment', targetId: String(order._id), targetCode: order.id,
      summary: `${before} -> ${order.status}`, before: { status: before }, after: { status: order.status },
    })

    res.json(mapOrder(await order.populate('user', 'nick email')))
  } catch (error) { next(error) }
}
