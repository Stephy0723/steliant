import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { requireDatabase } from '../middleware/requireDatabase.js'
import { paymentConfig, createOrder, capturePaypalOrder, listOrders, verifyOrder, emailOrderReceipt, stripeWebhook, paypalWebhook, cancelSubscription } from '../controllers/payment.controller.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()
router.get('/config', paymentConfig)
router.post('/checkout', requireAuth, requireDatabase, createOrder)
router.post('/paypal/:id/capture', requireAuth, requireDatabase, capturePaypalOrder)
router.post('/subscription/cancel', requireAuth, requireDatabase, cancelSubscription)
router.get('/orders', requireAuth, requireDatabase, listOrders)
router.get('/orders/:id/verify', requireDatabase, verifyOrder)
router.post('/orders/:id/receipt', requireAuth, requireDatabase, generalLimiter, emailOrderReceipt)
router.post('/webhook/stripe', stripeWebhook)
router.post('/webhook/paypal', paypalWebhook)
export default router
