import { config } from '../config/index.js'

const wa = config.whatsapp

export function isWhatsappConfigured() {
  return Boolean(wa.phoneNumberId && wa.accessToken)
}

/** Normalise a phone to digits only, keeping a leading country code. */
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  return digits
}

export function isValidPhone(raw) {
  const d = normalizePhone(raw)
  return d.length >= 8 && d.length <= 15
}

/**
 * Send a verification code to `phone` over WhatsApp via the Meta Cloud API.
 * Resolves silently on success. Throws on a real send failure. If the API is
 * not configured it returns { sent: false } so the caller can fall back to the
 * dev flow (returning the code in the HTTP response).
 */
export async function sendWhatsappCode(phone, code) {
  const to = normalizePhone(phone)
  if (!isWhatsappConfigured()) return { sent: false, reason: 'not-configured' }

  const url = `https://graph.facebook.com/${wa.graphVersion}/${wa.phoneNumberId}/messages`
  const body = wa.otpTemplate
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: wa.otpTemplate,
          language: { code: 'es' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: `GlitchGang: tu codigo de verificacion es ${code}. Vence en 10 minutos.` },
      }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wa.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  return { sent: true }
}
