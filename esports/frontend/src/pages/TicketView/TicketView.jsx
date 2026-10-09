import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { paymentsApi } from '../../lib/serverApi.js'
import PaymentTicket from '../../components/PaymentTicket/PaymentTicket.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { toast } from '../../lib/toast.js'
import './TicketView.css'

export default function TicketView() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [payment, setPayment] = useState(undefined) // undefined = cargando, null = no encontrado

  useEffect(() => {
    let alive = true
    paymentsApi.orders()
      .then(({ orders }) => {
        if (!alive) return
        const order = (orders || []).find(o => o.id === code)
        setPayment(order ? {
          id: order._id || order.id,
          code: order.id,
          amount: order.amount,
          method: order.provider,
          createdAt: order.createdAt,
          buyer: user?.nick || '—',
          tournamentName: order.concept,
          tournamentId: order.tournamentId || null,
          status: order.status,
        } : null)
      })
      .catch(() => { if (alive) setPayment(null) })
    return () => { alive = false }
  }, [code, user?.nick])

  if (payment === undefined) return null

  if (!payment) {
    return (
      <div className="gg-page gg-tv">
        <div className="gg-tv__empty">
          <span>{Icon.fileText}</span>
          <h2>Comprobante no encontrado</h2>
          <p>El código <b>{code}</b> no corresponde a ningún pago tuyo.</p>
          <div className="gg-tv__empty-btns">
            <button className="gg-tv__btn gg-tv__btn--primary" onClick={() => navigate('/mis-pagos')}>{Icon.creditCard} Mis comprobantes</button>
            <button className="gg-tv__btn" onClick={() => navigate(`/verificar?c=${encodeURIComponent(code)}`)}>{Icon.search} Verificar código</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gg-page gg-tv">
      <button className="gg-tv__back" onClick={() => navigate('/mis-pagos')}>{Icon.chevronRight} Mis comprobantes</button>
      <motion.div className="gg-tv__ticket" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <PaymentTicket payment={payment} />
      </motion.div>
      <div className="gg-tv__actions">
        <button className="gg-tv__btn gg-tv__btn--primary" onClick={() => window.print()}>{Icon.printer} Descargar / Imprimir</button>
        <button className="gg-tv__btn" onClick={() => paymentsApi.emailReceipt(payment.code)
          .then(res => toast(`Comprobante enviado a ${res?.email || user?.email || 'tu correo'}`, 'success', { title: 'Correo enviado' }))
          .catch(err => toast(err?.message || 'No se pudo enviar el comprobante', 'error'))}
        >{Icon.send} Enviar al correo</button>
        <button className="gg-tv__btn" onClick={() => navigate(`/verificar?c=${encodeURIComponent(payment.code)}`)}>{Icon.check} Verificar</button>
      </div>
    </div>
  )
}

