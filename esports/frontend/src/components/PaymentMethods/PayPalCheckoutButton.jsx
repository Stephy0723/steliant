import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api.js'
import { loadPayPalSdk } from '../../lib/paypalSdk.js'

/**
 * Botón real de PayPal (Smart Payment Buttons). `fundingSource` = 'paypal'
 * muestra el botón azul de PayPal; 'card' muestra el botón de "Tarjeta de
 * débito/crédito" (Guest Checkout, sin cuenta PayPal) -- ambos disparan el
 * mismo flujo server-to-server: crear orden en /payments/checkout y
 * capturarla en /payments/paypal/:id/capture, que es la única fuente de
 * verdad de que el cobro se hizo de verdad.
 */
export default function PayPalCheckoutButton({ clientId, currency = 'USD', fundingSource, checkoutBody, beforeCreateOrder, onSuccess, onError, disabled }) {
  const containerRef = useRef(null)
  const internalOrderIdRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | ineligible | error

  useEffect(() => {
    let cancelled = false
    let buttons = null

    loadPayPalSdk(clientId, currency)
      .then(paypal => {
        if (cancelled || !containerRef.current) return
        buttons = paypal.Buttons({
          fundingSource: paypal.FUNDING[fundingSource.toUpperCase()],
          style: { layout: 'vertical', height: 45, label: fundingSource === 'card' ? 'pay' : 'paypal' },
          createOrder: async () => {
            if (beforeCreateOrder) await beforeCreateOrder()
            const { order, paypalOrderId } = await api('/payments/checkout', { method: 'POST', body: checkoutBody })
            if (!paypalOrderId) throw new Error('PayPal no está configurado en el servidor.')
            internalOrderIdRef.current = order.id
            return paypalOrderId
          },
          onApprove: async () => {
            const { order } = await api(`/payments/paypal/${internalOrderIdRef.current}/capture`, { method: 'POST' })
            onSuccess(order)
          },
          onError: (err) => onError?.(err?.message || 'No se pudo procesar el pago con PayPal.'),
          onCancel: () => onError?.(''),
        })

        if (!buttons.isEligible()) return setStatus('ineligible')
        buttons.render(containerRef.current).then(() => !cancelled && setStatus('ready'))
      })
      .catch(err => { if (!cancelled) { setStatus('error'); onError?.(err.message) } })

    return () => { cancelled = true; buttons?.close?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, currency, fundingSource])

  return (
    <div className="gg-pm__paypal-btn">
      <div ref={containerRef} style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }} />
      {status === 'loading' && <p className="gg-pm__note">Cargando pasarela de pago…</p>}
      {status === 'ineligible' && <p className="gg-pm__note">Este método no está disponible en tu navegador/región ahora mismo.</p>}
      {status === 'error' && <p className="gg-pm__note">No se pudo cargar PayPal. Intenta de nuevo.</p>}
    </div>
  )
}

