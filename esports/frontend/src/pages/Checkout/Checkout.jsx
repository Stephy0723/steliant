import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { PLANS } from '../../data/billing.js'
import Button from '../../components/Button/Button.jsx'
import PaymentMethods from '../../components/PaymentMethods/PaymentMethods.jsx'
import PaymentTicket from '../../components/PaymentTicket/PaymentTicket.jsx'
import { paymentsApi } from '../../lib/serverApi.js'
import { toast } from '../../lib/toast.js'
import { Icon } from '../../components/icons/Icons.jsx'
import './Checkout.css'

export default function Checkout() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const planId = search.get('plan') || 'pro'
  const billing = search.get('billing') || 'monthly'
  // updateUser hacía falta en finishPayment: sin él, tras pagar se lanzaba un
  // ReferenceError y no se mostraba el comprobante (el cobro sí ocurría).
  const { user, updateUser } = useAuth()

  const plan = PLANS.find(p => p.id === planId) || PLANS[1]
  const price = billing === 'annual' ? plan.price.annual : plan.price.monthly

  const [step, setStep] = useState(1)   // 1: resumen | 2: pago | 3: éxito
  const [method, setMethod] = useState('card')
  const [loading, setLoading] = useState(false)
  const [payment, setPayment] = useState(null)
  // "aun no cobraremos": el backend (payment.controller.js) ya rechaza
  // cualquier cobro real, esto es solo para no dejar llegar al usuario a un
  // formulario de pago que de todos modos va a fallar.
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)
  useEffect(() => {
    let cancelled = false
    paymentsApi.config().then(({ enabled }) => { if (!cancelled) setPaymentsEnabled(enabled !== false) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Sin esto, nada impedía pagar de nuevo por una suscripción que ya está
  // activa -- el backend también lo bloquea (payment.controller.js), esto es
  // solo para no dejar llegar al usuario al formulario de pago en primer lugar.
  const targetLabel = plan.id === 'free' ? 'Free' : plan.name
  if (user?.plan === targetLabel) {
    return (
      <div className="gg-page gg-checkout">
        <button className="gg-checkout__back" onClick={() => navigate('/premium')}>
          {Icon.x} Volver a planes
        </button>
        <div className="gg-checkout__block">
          <h3>Ya tienes este plan</h3>
          <p>Tu cuenta ya tiene activo el plan <b>{plan.name}</b>. No hace falta pagarlo de nuevo.</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>Ir al dashboard</Button>
        </div>
      </div>
    )
  }

  if (!paymentsEnabled && price > 0) {
    return (
      <div className="gg-page gg-checkout">
        <button className="gg-checkout__back" onClick={() => navigate('/premium')}>
          {Icon.x} Volver a planes
        </button>
        <div className="gg-checkout__block">
          <h3>Los pagos todavía no están activos</h3>
          <p>GlitchGang Pro está casi listo. Por ahora no estamos cobrando nada — vuelve pronto para suscribirte.</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>Volver al dashboard</Button>
        </div>
      </div>
    )
  }

  // Torneo "sintético" para reutilizar el ticket con un plan Pro
  const planTicket = {
    name: `${plan.name} · STELIANT ESPORTS PRO`,
    game: 'Suscripción',
    color: '#F0A500',
    date: billing === 'annual' ? 'Anual' : 'Mensual',
  }

  // El plan se activa cuando el backend confirma el pago -- en demo eso pasa
  // al instante (order.status === 'demo_paid'); en real, `order` ya llega con
  // status 'paid' porque este callback solo se dispara después de que
  // capturePaypalOrder confirmó el cobro server-to-server con PayPal.
  function finishPayment(order) {
    if (order.status === 'demo_paid' || order.status === 'paid') {
      updateUser({ plan: plan.id === 'free' ? 'Free' : plan.name })
    }
    // La orden real (Order de Mongo, ver payment.controller.js) ya trae todo
    // lo que el ticket necesita -- no hay que armar un registro local aparte.
    setPayment({
      id: order._id || order.id,
      code: order.id,
      amount: order.amount,
      method: order.provider || method,
      createdAt: order.createdAt,
      buyer: user.nick,
      tournamentName: order.concept,
      status: order.status,
    })
    setStep(3)
  }

  async function handleTransferPay(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await paymentsApi.checkout({
        provider: 'transfer',
        kind: 'plan',
        planId: plan.id,
        billingCycle: billing,
      })
      const status = data?.order?.status
      if (status !== 'paid' && status !== 'demo_paid') {
        toast(data?.message || 'Orden creada. Falta confirmar el pago con el proveedor.', 'info', { title: 'Pago pendiente' })
        return
      }
      finishPayment(data.order)
    } catch (error) {
      toast(error.message || 'No se pudo iniciar el pago real', 'error', { title: 'Pago no procesado' })
    } finally {
      setLoading(false)
    }
  }

  if (step === 3) {
    return (
      <div className="gg-page gg-checkout-success">
        <motion.div
          className="gg-checkout-success__head"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="gg-checkout-success__icon">{Icon.check}</div>
          <h2>¡Suscripción activada!</h2>
          <p>Tu plan <b>{plan.name}</b> ({billing === 'annual' ? 'anual' : 'mensual'}) está activo. Guarda tu comprobante.</p>
        </motion.div>

        {payment && <PaymentTicket payment={payment} tournament={planTicket} />}

        <div className="gg-checkout-success__btns">
          <Button variant="primary" onClick={() => window.print()}>{Icon.printer} Descargar / Imprimir</Button>
          <Button variant="ghost" onClick={() => navigate('/ajustes?tab=comprobantes')}>Mis comprobantes</Button>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>Ir al dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="gg-page gg-checkout">
      {/* Back */}
      <button className="gg-checkout__back" onClick={() => navigate('/premium')}>
        {Icon.x} Volver a planes
      </button>

      {/* Steps indicator */}
      <div className="gg-checkout__steps">
        {['Resumen', 'Pago'].map((label, i) => (
          <div key={label} className={`gg-checkout__step ${step >= i+1 ? 'active' : ''} ${step > i+1 ? 'done' : ''}`}>
            <span className="gg-checkout__step-num">{step > i+1 ? Icon.check : i+1}</span>
            <span className="gg-checkout__step-label">{label}</span>
            {i < 1 && <div className="gg-checkout__step-line" />}
          </div>
        ))}
      </div>

      <div className="gg-checkout__layout">
        {/* Left: form */}
        <motion.div
          className="gg-checkout__main"
          key={step}
          initial={{ opacity:0, x:12 }}
          animate={{ opacity:1, x:0 }}
          transition={{ duration:.25 }}
        >
          {step === 1 && (
            <div className="gg-checkout__block">
              <h3>Resumen del plan</h3>
              <div className="gg-checkout__plan-row">
                <div>
                  <b>{plan.name}</b>
                  <span>{billing === 'annual' ? 'Facturación anual' : 'Facturación mensual'}</span>
                </div>
                <b className="price">${price}/mo</b>
              </div>
              <ul className="gg-checkout__features">
                {plan.features.map(f => (
                  <li key={f}><span className="check">{Icon.check}</span>{f}</li>
                ))}
              </ul>
              <Button variant="primary" size="lg" className="gg-btn--full" onClick={() => setStep(2)}>
                Continuar al pago →
              </Button>
            </div>
          )}

          {step === 2 && (
            <form className="gg-checkout__block" onSubmit={method === 'transfer' ? handleTransferPay : e => e.preventDefault()}>
              <h3>Método de pago</h3>
              <PaymentMethods
                value={method}
                onChange={setMethod}
                amount={price}
                user={user}
                reference={`PRO-${plan.name}-${user?.nick || 'YOU'}`}
                checkoutBody={{ kind: 'plan', planId: plan.id, billingCycle: billing }}
                onPaid={finishPayment}
                onPayError={msg => msg && toast(msg, 'error', { title: 'Pago no procesado' })}
                payDisabled={loading}
              />
              <Button variant="primary" size="lg" type="submit" className="gg-btn--full" style={{ marginTop: 16 }}>
                {loading ? 'Procesando…' : `Pagar $${price}/mo`}
              </Button>
              <p className="gg-checkout__disclaimer">
                {Icon.lock} {method === 'transfer' ? 'Demo — no se procesa ningún pago real.' : 'Pago real vía PayPal.'} Puedes cancelar en cualquier momento.
              </p>
            </form>
          )}
        </motion.div>

        {/* Right: order summary */}
        <div className="gg-checkout__sidebar">
          <div className="gg-checkout__summary">
            <h4>Tu pedido</h4>
            <div className="gg-checkout__summary-row">
              <span>Plan {plan.name}</span><span>${price}</span>
            </div>
            <div className="gg-checkout__summary-row">
              <span>Periodo</span><span>{billing === 'annual' ? 'Anual' : 'Mensual'}</span>
            </div>
            {billing === 'annual' && (
              <div className="gg-checkout__summary-row saving">
                <span>Ahorro anual</span>
                <span>-${((plan.price.monthly - plan.price.annual) * 12).toFixed(2)}</span>
              </div>
            )}
            <div className="gg-checkout__summary-divider" />
            <div className="gg-checkout__summary-total">
              <span>Total/mes</span><b>${price}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

