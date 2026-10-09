import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { Icon } from '../icons/Icons.jsx'
import { toast } from '../../lib/toast.js'
import './PaymentTicket.css'

const METHOD_LABEL = { card: 'Tarjeta', paypal: 'PayPal', transfer: 'Transferencia' }

// URL que codifica el QR — al escanear abre la página de verificación.
function verifyUrl(code) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://glitchgang.gg'
  return `${origin}/verificar?c=${encodeURIComponent(code)}`
}

export default function PaymentTicket({ payment, tournament, compact = false, onClose }) {
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (!payment?.code) return
    let alive = true
    QRCode.toDataURL(verifyUrl(payment.code), {
      margin: 1, width: 220, errorCorrectionLevel: 'M',
      color: { dark: '#0a0a0a', light: '#ffffff' },
    }).then(url => { if (alive) setQr(url) }).catch(() => {})
    return () => { alive = false }
  }, [payment?.code])

  if (!payment) return null
  const color = tournament?.color || '#00E676'
  const date = new Date(payment.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const copyCode = () => {
    try { navigator.clipboard.writeText(payment.code) } catch { /* noop */ }
    toast('Código de validación copiado', 'success')
  }

  return (
    <motion.div
      className={`pt-ticket${compact ? ' pt-ticket--compact' : ''}`}
      style={{ '--tc': color }}
      initial={{ opacity: 0, y: 20, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <div className="pt-glow" />

      <div className="pt-head">
        <div className="pt-brand">
          <span className="pt-brand__logo">{Icon.bolt}</span>
          <div>
            <b>STELIANT ESPORTS</b>
            <small>Comprobante de inscripción</small>
          </div>
        </div>
        <span className="pt-status">{Icon.check} VALIDADO</span>
        {onClose && <button className="pt-close" onClick={onClose} aria-label="Cerrar">{Icon.x}</button>}
      </div>

      <div className="pt-body">
        <div className="pt-main">
          <span className="pt-event-label">EVENTO</span>
          <h3 className="pt-event">{tournament?.name || payment.tournamentName}</h3>
          <div className="pt-meta">
            <div><span>Juego</span><b>{tournament?.game || '—'}</b></div>
            <div><span>Fecha torneo</span><b>{tournament?.date || '—'}</b></div>
            <div><span>Participante</span><b>{payment.buyer}</b></div>
            <div><span>Método</span><b>{METHOD_LABEL[payment.method] || payment.method}</b></div>
          </div>
          <div className="pt-amount">
            <span>Pagado</span>
            <strong>${Number(payment.amount).toLocaleString()}</strong>
            <small>{date}</small>
          </div>
        </div>

        <div className="pt-perf"><i /><i /><i /><i /><i /><i /><i /><i /></div>

        {/* Stub con QR real escaneable + código copiable (estilo authenticator) */}
        <div className="pt-stub">
          <div className="pt-qr">
            {qr ? <img src={qr} alt="QR de verificación" /> : <div className="pt-qr__ph">{Icon.bolt}</div>}
          </div>
          <div className="pt-stub__right">
            <div className="pt-code">
              <span>CÓDIGO DE VALIDACIÓN</span>
              <b>{payment.code}</b>
            </div>
            <button type="button" className="pt-copy" onClick={copyCode}>
              {Icon.fileText} Copiar código
            </button>
            <p className="pt-scan-hint">Escanea el QR para verificar la autenticidad del ticket.</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

