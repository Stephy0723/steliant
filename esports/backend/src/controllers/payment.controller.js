// Pagos — Stripe descartado (no opera en República Dominicana); el proveedor
// real es PayPal (Guest Checkout confirmado y activo en la cuenta business).
// Sin credenciales de PayPal configuradas, /payments corre en modo DEMO
// (registra la orden y la marca como pagada al instante) para no bloquear
// el flujo mientras se terminan de configurar.
import { getPlan, getPlanPrice, getPlanLabel } from '../config/billingPlans.js'
import { Tournament } from '../models/Tournament.js'
import { User } from '../models/User.js'
import { Order } from '../models/Order.js'
import { sendEventEmail } from '../services/email.service.js'
import { createPayPalOrder, capturePayPalOrder, verifyWebhookSignature } from '../services/paypal.service.js'

// Módulo de pago DESACTIVADO A PROPÓSITO -- "aun no cobraremos" (el equipo
// todavía no anunció el cobro real a los usuarios). Las credenciales de
// PayPal ya están configuradas en el servidor, así que sin este freno
// createOrder/capturePaypalOrder cobrarían de verdad. Mismo patrón que
// WHATSAPP_ENABLED en frontend/src/config/featureFlags.js: un solo valor que
// se cambia a true cuando el equipo esté listo para cobrar. No toca
// listOrders/verifyOrder/cancelSubscription (solo lectura o autoservicio de
// baja, sin riesgo de cobro).
const PAYMENTS_ENABLED = false
const PAYMENTS_DISABLED_MESSAGE = 'Los pagos en GlitchGang todavía no están activos.'

const PROVIDERS = ['stripe', 'paypal', 'transfer']

// 'transfer' (banco/QR) no tiene pasarela externa que "activar" -- el propio
// PaymentMethods.jsx ya deja claro que se valida al instante en demo, eso no
// cambia aquí. Solo stripe/paypal pasan a modo live cuando hay credenciales.
function providerConfigured(provider) {
  if (provider === 'stripe') return !!process.env.STRIPE_SECRET_KEY
  if (provider === 'paypal') return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  return false
}

export function paymentConfig(_req, res) {
  res.json({
    enabled: PAYMENTS_ENABLED,
    providers: {
      stripe:   { configured: providerConfigured('stripe'), publicKey: process.env.STRIPE_PUBLIC_KEY || null, mode: providerConfigured('stripe') ? 'live' : 'demo' },
      paypal:   { configured: providerConfigured('paypal'), clientId: process.env.PAYPAL_CLIENT_ID || null, mode: providerConfigured('paypal') ? 'live' : 'demo' },
      transfer: { configured: true, mode: 'demo' },
    },
  })
}

// El monto y el concepto SIEMPRE se calculan aquí, del lado del servidor --
// nunca se toman del body del cliente. Un usuario podría manipular la
// petición y "pagar" lo que quisiera si confiáramos en req.body.amount.
async function resolveOrderCharge(body = {}) {
  if (body.kind === 'plan') {
    const plan = getPlan(String(body.planId || ''))
    if (!plan) return { error: 'Plan no válido.' }
    const amount = getPlanPrice(plan.id, body.billingCycle)
    if (amount === null) return { error: 'Plan no válido.' }
    return { amount, currency: 'USD', concept: `${plan.name} · GLITCH GANG PRO` }
  }

  if (body.kind === 'tournament') {
    const tournament = await Tournament.findById(body.tournamentId).select('title entryFee currency').lean().catch(() => null)
    if (!tournament) return { error: 'Torneo no encontrado.' }
    const entryFee = Number(tournament.entryFee) || 0
    const serviceFee = Math.round(entryFee * 0.08 * 100) / 100
    return {
      amount: Math.round((entryFee + serviceFee) * 100) / 100, currency: tournament.currency || 'USD',
      concept: tournament.title, tournamentId: String(tournament._id),
    }
  }

  return { error: 'Tipo de orden no válido.' }
}

async function activatePlanIfNeeded(order) {
  if (order.kind === 'plan' && order.user) {
    const label = getPlanLabel(order.planId)
    if (label) await User.findByIdAndUpdate(order.user, { plan: label }, { runValidators: true })
  }
}

export async function createOrder(req, res, next) {
  try {
    const provider = String(req.body.provider || '')
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ message: 'Método de pago no válido.' })

    const charge = await resolveOrderCharge(req.body)
    if (charge.error) return res.status(400).json({ message: charge.error })

    // Solo bloqueamos cobros de verdad (amount > 0) -- los torneos con
    // entryFee 0 (todos, hoy) siguen inscribiendo gratis sin pasar por aquí.
    if (!PAYMENTS_ENABLED && charge.amount > 0) {
      return res.status(503).json({ message: PAYMENTS_DISABLED_MESSAGE })
    }

    // No dejar comprar dos veces el mismo plan que ya está activo -- sin esto,
    // el checkout no tenía ningún freno y el usuario podía pagar de nuevo por
    // una suscripción que ya tiene.
    if (req.body.kind === 'plan') {
      const label = getPlanLabel(String(req.body.planId || ''))
      if (label && req.user?.plan === label) {
        return res.status(400).json({ message: `Ya tienes el plan ${label} activo.` })
      }
    }

    const configured = providerConfigured(provider)
    const status = configured ? 'requires_payment' : 'demo_paid'
    const order = await Order.create({
      id: `ord_${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
      kind: req.body.kind,
      provider,
      concept: charge.concept,
      amount: charge.amount,
      currency: charge.currency,
      planId: req.body.kind === 'plan' ? String(req.body.planId || '') : null,
      billingCycle: req.body.kind === 'plan' ? (req.body.billingCycle || 'monthly') : null,
      tournamentId: charge.tournamentId || null,
      user: req.user?._id || null,
      status,
      mode: configured ? 'live' : 'demo',
    })

    // Modo demo: la orden queda pagada al instante, así que el plan se activa
    // ya mismo. En modo live (PayPal configurado) el plan se activa recién en
    // capturePaypalOrder/paypalWebhook, cuando PayPal confirma el cobro real.
    if (order.status === 'demo_paid') await activatePlanIfNeeded(order)

    let paypalOrderId = null
    if (provider === 'paypal' && configured) {
      try {
        const ppOrder = await createPayPalOrder({
          amount: order.amount, currency: order.currency, concept: order.concept, internalOrderId: order.id,
        })
        paypalOrderId = ppOrder.id
        order.providerOrderId = paypalOrderId
        await order.save()
      } catch (e) {
        order.status = 'failed'
        await order.save()
        return res.status(502).json({ message: 'No se pudo crear la orden en PayPal.' })
      }
    }

    res.status(201).json({
      order,
      paypalOrderId,
      demo: !configured,
      message: configured
        ? `Orden creada. Confirma el pago con ${provider}.`
        : `Modo DEMO: configura las credenciales de ${provider} para cobros reales.`,
    })
  } catch (e) { next(e) }
}

// POST /payments/paypal/:id/capture — el frontend llama esto después de que
// el comprador aprueba en el botón de PayPal. La captura server-to-server
// (no lo que reporte el navegador) es la única fuente de verdad del cobro.
export async function capturePaypalOrder(req, res, next) {
  try {
    if (!PAYMENTS_ENABLED) return res.status(503).json({ message: PAYMENTS_DISABLED_MESSAGE })

    const order = await Order.findOne({ id: req.params.id, user: req.user?._id || null })
    if (!order) return res.status(404).json({ message: 'Orden no encontrada.' })
    if (order.provider !== 'paypal' || !order.providerOrderId) return res.status(400).json({ message: 'Orden no es de PayPal.' })
    if (order.status === 'paid') return res.json({ order }) // idempotente

    const capture = await capturePayPalOrder(order.providerOrderId)
    if (capture.status !== 'COMPLETED') {
      order.status = 'failed'
      await order.save()
      return res.status(402).json({ message: 'PayPal no confirmó el pago.' })
    }

    order.status = 'paid'
    await order.save()
    await activatePlanIfNeeded(order)

    res.json({ order })
  } catch (e) {
    if (e.details) return res.status(502).json({ message: 'PayPal rechazó la captura.' })
    next(e)
  }
}

export async function listOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user?._id || null }).sort({ createdAt: -1 }).lean()
    res.json({ orders })
  } catch (e) { next(e) }
}

// GET /payments/orders/:id/verify — verificación pública (sin login) del
// comprobante que se muestra al escanear el QR. Solo expone lo mínimo
// necesario para confirmar autenticidad (nunca el email del comprador).
export async function verifyOrder(req, res, next) {
  try {
    const order = await Order.findOne({ id: req.params.id }).lean()
    if (!order) return res.json({ valid: false, reason: 'No corresponde a ningún comprobante emitido por GlitchGang.' })

    const buyer = order.user ? await User.findById(order.user).select('nick').lean().catch(() => null) : null
    res.json({
      valid: true,
      reason: 'Comprobante verificado en el servidor.',
      order: {
        id: order.id,
        kind: order.kind,
        concept: order.concept,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
        tournamentId: order.tournamentId || null,
        buyerNick: buyer?.nick || null,
      },
    })
  } catch (e) { next(e) }
}

// POST /payments/orders/:id/receipt — reenvía al correo del dueño el
// comprobante de una orden suya ya pagada. Antes el botón "Reenviar
// comprobante" solo mostraba "Correo enviado" sin enviar nada.
export async function emailOrderReceipt(req, res, next) {
  try {
    const order = await Order.findOne({ id: req.params.id, user: req.user._id }).lean()
    if (!order) return res.status(404).json({ message: 'Comprobante no encontrado.' })
    if (!['paid', 'demo_paid'].includes(order.status)) {
      return res.status(400).json({ message: 'Esta orden todavía no está pagada.' })
    }
    if (!req.user.email) return res.status(400).json({ message: 'Tu cuenta no tiene correo.' })

    const amount = `${order.currency || 'USD'} ${Number(order.amount || 0).toFixed(2)}`
    const date = new Date(order.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
    await sendEventEmail({
      to: req.user.email,
      nick: req.user.nick || 'jugador',
      title: `Comprobante ${order.id}`,
      message: `este es tu comprobante de pago: ${order.concept} · ${amount} · ${date}. Puedes verificarlo con el código ${order.id}.`,
      link: `/comprobante/${encodeURIComponent(order.id)}`,
    })
    res.json({ message: 'Comprobante enviado.', email: req.user.email })
  } catch (e) { next(e) }
}

// POST /payments/subscription/cancel — autoservicio: el propio usuario apaga
// su plan pago y vuelve a Free. No es un reembolso (no hay reversión de
// cargo, es demo) -- eso lo hace el staff desde /admin/orders si aplica.
export async function cancelSubscription(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
    if (user.plan === 'Free') return res.status(400).json({ message: 'No tienes ninguna suscripción activa.' })

    const previousPlan = user.plan
    user.plan = 'Free'
    await user.save()

    // Marca la orden que activó el plan actual como cancelada, para que el
    // historial de facturas quede coherente con lo que de verdad pasó.
    const order = await Order.findOne({ user: user._id, kind: 'plan', status: { $in: ['demo_paid', 'paid'] } }).sort({ createdAt: -1 })
    if (order && getPlanLabel(order.planId) === previousPlan) {
      order.status = 'canceled'
      await order.save()
    }

    res.json({ plan: user.plan })
  } catch (e) { next(e) }
}

// Webhook listo para recibir eventos de Stripe (requiere STRIPE_WEBHOOK_SECRET).
export function stripeWebhook(_req, res) {
  if (!PAYMENTS_ENABLED) return res.status(503).json({ error: PAYMENTS_DISABLED_MESSAGE })
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: 'Webhook no configurado (STRIPE_WEBHOOK_SECRET)' })
  }
  // TODO: verificar firma (stripe.webhooks.constructEvent) y actualizar la orden.
  res.json({ received: true })
}

// Webhook de PayPal -- red de seguridad además de la captura server-to-server
// en capturePaypalOrder: cubre el caso de que el navegador del comprador se
// cierre justo después de aprobar, antes de que el frontend llame a capture.
// Requiere PAYPAL_WEBHOOK_ID (developer.paypal.com → tu app → Webhooks).
export async function paypalWebhook(req, res) {
  if (!PAYMENTS_ENABLED) return res.status(503).json({ error: PAYMENTS_DISABLED_MESSAGE })
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return res.status(501).json({ error: 'Webhook no configurado (PAYPAL_WEBHOOK_ID)' })
  }

  const verified = await verifyWebhookSignature(req.headers, req.body).catch(() => false)
  if (!verified) return res.status(400).json({ error: 'Firma inválida.' })

  const resource = req.body?.resource || {}
  const internalOrderId = resource.custom_id || resource.purchase_units?.[0]?.custom_id

  if (req.body?.event_type === 'PAYMENT.CAPTURE.COMPLETED' && internalOrderId) {
    const order = await Order.findOne({ id: internalOrderId })
    if (order && order.status !== 'paid') {
      order.status = 'paid'
      await order.save()
      await activatePlanIfNeeded(order)
    }
  }

  res.json({ received: true })
}
