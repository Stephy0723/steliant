import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import PaymentTicket from '../../components/PaymentTicket/PaymentTicket.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { paymentsApi } from '../../lib/serverApi.js'
import './MyPayments.css'

const PAID_STATUSES = ['paid', 'demo_paid']

function mapOrderToPayment(order, buyerNick) {
  return {
    id: order._id || order.id,
    code: order.id,
    amount: order.amount,
    method: order.provider,
    createdAt: order.createdAt,
    buyer: buyerNick || '—',
    tournamentName: order.concept,
    tournamentId: order.tournamentId || null,
    status: order.status,
  }
}

export default function MyPayments() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    paymentsApi.orders()
      .then(({ orders }) => {
        if (!alive) return
        const paid = (orders || []).filter(o => PAID_STATUSES.includes(o.status))
        setPayments(paid.map(o => mapOrderToPayment(o, user?.nick)))
      })
      .catch(() => { if (alive) setPayments([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.nick])

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <div className="gg-page gg-mp">
      <PageHeader title="Mis comprobantes" sub="Tus pagos de inscripción y tickets validables.">
        <span className="gg-mp-total">{Icon.creditCard} ${total.toLocaleString()} {payments.length > 0 && `· ${payments.length} pago${payments.length > 1 ? 's' : ''}`}</span>
      </PageHeader>

      {!loading && payments.length === 0 ? (
        <div className="gg-mp-empty">
          <span>{Icon.fileText}</span>
          <h3>Aún no tienes comprobantes</h3>
          <p>Cuando te inscribas en un torneo de pago, tu ticket aparecerá aquí.</p>
          <button className="gg-mp-cta" onClick={() => navigate('/torneos')}>{Icon.trophy} Ver torneos</button>
        </div>
      ) : (
        <div className="gg-mp-grid">
          {payments.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              style={{ cursor: 'pointer' }} onClick={() => navigate(`/comprobante/${encodeURIComponent(p.code)}`)}>
              <PaymentTicket payment={p} compact />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

