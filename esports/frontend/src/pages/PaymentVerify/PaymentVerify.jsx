import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { paymentsApi } from '../../lib/serverApi.js'
import { Icon } from '../../components/icons/Icons.jsx'
import './PaymentVerify.css'

const PAID_STATUSES = ['paid', 'demo_paid']

export default function PaymentVerify() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initial = params.get('c') || ''
  const [input, setInput] = useState(initial)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!initial) return
    verify(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verify = async (code) => {
    setLoading(true)
    try {
      const data = await paymentsApi.verify(code)
      const paid = data.valid && PAID_STATUSES.includes(data.order?.status)
      setResult({
        valid: paid,
        reason: !data.valid ? data.reason : (paid ? data.reason : 'La orden existe pero el pago no se completó.'),
        order: data.order || null,
      })
    } catch {
      setResult({ valid: false, reason: 'No se pudo verificar el código. Intenta de nuevo.', order: null })
    } finally {
      setLoading(false)
      setChecked(true)
    }
  }

  const submit = (e) => { e.preventDefault(); verify(input) }

  return (
    <div className="gg-verify">
      <motion.div
        className="gg-verify__card"
        initial={{ opacity: 0, y: 20, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      >
        <div className="gg-verify__head">
          <div className="gg-verify__brand">
            <span className="gg-verify__logo">{Icon.bolt}</span>
            <div><b>GlitchGang</b><small>Verificación de comprobante</small></div>
          </div>
          <button className="gg-verify__close" onClick={() => navigate('/')} aria-label="Cerrar">{Icon.x}</button>
        </div>

        <AnimatePresence mode="wait">
          {!checked || !result ? (
            <motion.form key="form" className="gg-verify__form" onSubmit={submit}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="gg-verify__scanicon">{Icon.search}</div>
              <h2>Verificar ticket</h2>
              <p>Escanea el QR del comprobante o introduce el código de validación manualmente.</p>
              <label className="gg-verify__field">
                <span>Código de validación</span>
                <input value={input} onChange={e => setInput(e.target.value.trim())} placeholder="ord_..." autoFocus />
              </label>
              <button type="submit" className="gg-verify__btn" disabled={loading || !input.trim()}>{Icon.check} {loading ? 'Verificando…' : 'Verificar'}</button>
            </motion.form>
          ) : (
            <motion.div key="result" className={`gg-verify__result ${result.valid ? 'ok' : 'bad'}`}
              initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="gg-verify__badge">{result.valid ? Icon.check : Icon.x}</div>
              <h2>{result.valid ? 'Ticket auténtico' : 'Ticket no válido'}</h2>
              <p className="gg-verify__reason">{result.reason}</p>

              {result.valid && result.order && (
                <div className="gg-verify__details">
                  <div><span>Concepto</span><b>{result.order.concept}</b></div>
                  <div><span>Monto pagado</span><b>${Number(result.order.amount).toLocaleString()}</b></div>
                  <div><span>Fecha de pago</span><b>{new Date(result.order.createdAt).toLocaleDateString('es-DO')}</b></div>
                  {result.order.buyerNick && <div><span>Participante</span><b>{result.order.buyerNick}</b></div>}
                  <div><span>Código</span><b className="mono">{result.order.id}</b></div>
                </div>
              )}

              <div className="gg-verify__actions">
                <button className="gg-verify__btn gg-verify__btn--ghost" onClick={() => { setChecked(false); setResult(null) }}>Verificar otro</button>
                {result.order?.tournamentId && <button className="gg-verify__btn" onClick={() => navigate(`/torneos/${result.order.tournamentId}`)}>Ver torneo</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="gg-verify__foot">{Icon.lock} La validez se verifica contra el registro real del servidor de GlitchGang.</p>
      </motion.div>
    </div>
  )
}

