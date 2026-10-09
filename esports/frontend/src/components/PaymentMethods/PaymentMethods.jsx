import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import PayPalCheckoutButton from './PayPalCheckoutButton.jsx'
import './PaymentMethods.css'

const METHODS = [
  { id: 'card',     label: 'Tarjeta',       icon: 'creditCard', desc: 'Visa, Mastercard, Amex' },
  { id: 'paypal',   label: 'PayPal',        icon: 'globe',      desc: 'Paga con tu cuenta PayPal' },
  { id: 'transfer', label: 'Transferencia', icon: 'fileText',   desc: 'Transferencia / QR bancario' },
]

/**
 * Selector + formularios de método de pago, reutilizable en cualquier
 * página de pago (checkout de torneo, Pro Plan, etc.).
 *
 * Controlado: value = método activo, onChange = setter.
 *
 * `checkoutBody`: payload sin `provider` para POST /payments/checkout
 * (ej. { kind:'plan', planId, billingCycle } o { kind:'tournament', tournamentId }).
 * `onPaid(order)`: se llama cuando PayPal confirma el cobro real.
 * `onPayError(msg)`: errores del botón de PayPal.
 * `beforeCreateOrder`: hook async opcional (ej. registrar el equipo antes de cobrar).
 */
export default function PaymentMethods({ value, onChange, amount, user, reference = '', checkoutBody, beforeCreateOrder, onPaid, onPayError, payDisabled }) {
  const [paypalConfig, setPaypalConfig] = useState({ loading: true, configured: false, clientId: null })
  // `enabled` viene del backend (payment.controller.js) -- "aun no
  // cobraremos": una sola fuente de verdad para que esta pantalla nunca
  // muestre un método de pago que el servidor de todos modos va a rechazar.
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    let cancelled = false
    api('/payments/config')
      .then(({ enabled: apiEnabled, providers }) => {
        if (cancelled) return
        setEnabled(apiEnabled !== false)
        setPaypalConfig({ loading: false, configured: !!providers.paypal?.configured, clientId: providers.paypal?.clientId || null })
      })
      .catch(() => { if (!cancelled) setPaypalConfig({ loading: false, configured: false, clientId: null }) })
    return () => { cancelled = true }
  }, [])

  // El backend solo bloquea cobros de verdad (amount > 0): una inscripción a
  // torneo con cuota $0 sigue funcionando igual que siempre.
  if (!enabled && Number(amount) > 0) {
    return (
      <div className="gg-pm gg-pm--disabled">
        <p className="gg-pm__note">{Icon.creditCard} Los pagos en GlitchGang todavía no están activos. Vuelve pronto — por ahora no se cobra nada.</p>
      </div>
    )
  }

  return (
    <div className="gg-pm">
      <div className="gg-pm__list">
        {METHODS.map(m => (
          <button key={m.id} type="button" className={`gg-pm__method${value === m.id ? ' active' : ''}`} onClick={() => onChange(m.id)}>
            <span className="gg-pm__icon">{Icon[m.icon]}</span>
            <span className="gg-pm__body"><b>{m.label}</b><small>{m.desc}</small></span>
            <span className="gg-pm__radio" />
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {(value === 'card' || value === 'paypal') && (
          <motion.div key={value} className="gg-pm__panel gg-pm__panel--center" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            {value === 'card' && <p>{Icon.creditCard} Paga con tarjeta de débito/crédito{amount ? <> · <b>${amount}</b></> : ''}. Se procesa vía PayPal (no necesitas cuenta PayPal).</p>}
            {value === 'paypal' && <p>{Icon.globe} Paga con tu cuenta PayPal{amount ? <> · <b>${amount}</b></> : ''}.</p>}

            {paypalConfig.loading && <p className="gg-pm__note">Cargando pasarela de pago…</p>}

            {!paypalConfig.loading && paypalConfig.configured && checkoutBody && (
              <PayPalCheckoutButton
                clientId={paypalConfig.clientId}
                fundingSource={value}
                checkoutBody={{ ...checkoutBody, provider: 'paypal' }}
                beforeCreateOrder={beforeCreateOrder}
                onSuccess={onPaid}
                onError={onPayError}
                disabled={payDisabled}
              />
            )}

            {!paypalConfig.loading && !paypalConfig.configured && (
              <p className="gg-pm__note">Modo demo — PayPal aún no está configurado en el servidor (faltan credenciales).</p>
            )}
          </motion.div>
        )}
        {value === 'transfer' && (
          <motion.div key="transfer" className="gg-pm__panel" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            <div className="gg-pm__transfer">
              <div className="gg-pm__qr">
                {Array.from({ length: 64 }).map((_, i) => <span key={i} className={(i * 7 + 3) % 3 === 0 ? 'on' : ''} />)}
              </div>
              <div className="gg-pm__bank">
                <div><span>Banco</span><b>GlitchGang Pay</b></div>
                <div><span>Cuenta</span><b>0023 4471 9920</b></div>
                <div><span>Beneficiario</span><b>GlitchGang Esports</b></div>
                <div><span>Referencia</span><b>{reference || 'GG-PAGO'}</b></div>
              </div>
            </div>
            <p className="gg-pm__note">Escanea el QR o transfiere y confirma. (Demo: se valida al instante.)</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

