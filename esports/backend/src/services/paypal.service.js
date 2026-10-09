// Integración real con la API REST de PayPal (Orders v2) — reemplaza a Stripe
// como pasarela real porque Stripe no opera en República Dominicana. Guest
// Checkout ya está activado en la cuenta business real (PayPal Account
// Optional = ON), así que el checkout estándar deja pagar con tarjeta sin
// necesitar cuenta PayPal.
const BASE_URL = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

let cachedToken = null // { value, expiresAt }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) return cachedToken.value

  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`PayPal auth falló (${res.status})`)
  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

async function paypalFetch(path, options = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || `PayPal API error (${res.status})`)
    err.details = data
    throw err
  }
  return data
}

// Crea una orden real en PayPal (intent CAPTURE). `internalOrderId` se manda
// como custom_id para poder reconciliar el webhook con nuestra Order local
// sin depender de que el cliente reporte nada.
export async function createPayPalOrder({ amount, currency = 'USD', concept, internalOrderId }) {
  return paypalFetch('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: internalOrderId,
        description: String(concept).slice(0, 127),
        amount: { currency_code: currency, value: Number(amount).toFixed(2) },
      }],
    }),
  })
}

// Captura server-to-server -- esta llamada (no lo que reporte el navegador)
// es la única fuente de verdad de que el dinero de verdad se cobró.
export async function capturePayPalOrder(paypalOrderId) {
  return paypalFetch(`/v2/checkout/orders/${paypalOrderId}/capture`, { method: 'POST', body: '{}' })
}

// Verificación de firma de webhook (requiere PAYPAL_WEBHOOK_ID configurado
// desde el dashboard de PayPal). Devuelve true solo si PayPal confirma que
// el evento es auténtico.
export async function verifyWebhookSignature(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) return false
  const data = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_sig: headers['paypal-transmission-sig'],
      webhook_id: webhookId,
      webhook_event: body,
    }),
  }).catch(() => null)
  return data?.verification_status === 'SUCCESS'
}
