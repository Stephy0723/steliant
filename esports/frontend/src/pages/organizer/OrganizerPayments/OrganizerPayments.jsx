import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import './OrganizerPayments.css'

const MOCK_PAYOUTS = [
  { id: 'PAY-001', event: 'GG Spring Split', amount: 6400, status: 'completed', date: '2026-06-20', method: 'Stripe', description: '64 equipos × $100' },
  { id: 'PAY-002', event: 'Copa Pro 2026', amount: 2800, status: 'pending', date: '2026-06-25', method: 'PayPal', description: '28 equipos × $100' },
  { id: 'PAY-003', event: 'Liga Amateurs', amount: 1500, status: 'completed', date: '2026-06-15', method: 'Stripe', description: 'Pago inicial' },
  { id: 'PAY-004', event: 'GG Spring Split', amount: -800, status: 'completed', date: '2026-06-18', method: 'Stripe', description: 'Reembolso (8 equipos)' },
]

function OrganizerPayments() {
  const [payouts] = useState(MOCK_PAYOUTS)
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateRange, setDateRange] = useState('month')

  const filteredPayouts = payouts.filter(p => filterStatus === 'all' || p.status === filterStatus)
  
  const totalIncome = filteredPayouts.filter(p => p.amount > 0 && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)
  const totalRefunds = Math.abs(filteredPayouts.filter(p => p.amount < 0).reduce((sum, p) => sum + p.amount, 0))
  const pendingAmount = filteredPayouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="org-payments">
      <motion.div className="org-payments__header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1>Pagos y Transacciones</h1>
          <p>Historial de ingresos y reembolsos</p>
        </div>
      </motion.div>

      <motion.div className="org-payments__stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="org-payment-card">
          <div className="org-payment-card__label">Ingresos (Completados)</div>
          <div className="org-payment-card__value" style={{ color: '#22c55e' }}>${totalIncome.toLocaleString()}</div>
        </div>
        <div className="org-payment-card">
          <div className="org-payment-card__label">Reembolsos</div>
          <div className="org-payment-card__value" style={{ color: '#ef4444' }}>-${totalRefunds.toLocaleString()}</div>
        </div>
        <div className="org-payment-card">
          <div className="org-payment-card__label">Pendientes</div>
          <div className="org-payment-card__value" style={{ color: '#f59e0b' }}>${pendingAmount.toLocaleString()}</div>
        </div>
        <div className="org-payment-card">
          <div className="org-payment-card__label">Balance Neto</div>
          <div className="org-payment-card__value" style={{ color: '#3b82f6' }}>${(totalIncome - totalRefunds).toLocaleString()}</div>
        </div>
      </motion.div>

      <motion.div className="org-payments__controls" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="org-payments__filters">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="org-select">
            <option value="all">Todos</option>
            <option value="completed">Completados</option>
            <option value="pending">Pendientes</option>
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="org-select">
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="year">Último año</option>
            <option value="all">Todo</option>
          </select>
        </div>
      </motion.div>

      <motion.div className="org-payments__table" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Evento</th>
              <th>Descripción</th>
              <th>Método</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayouts.map(p => (
              <tr key={p.id}>
                <td className="org-payment-id"><code>{p.id}</code></td>
                <td><strong>{p.event}</strong></td>
                <td>{p.description}</td>
                <td><span className="org-method">{p.method}</span></td>
                <td className={p.amount > 0 ? 'org-amount-positive' : 'org-amount-negative'}>
                  {p.amount > 0 ? '+' : ''} ${Math.abs(p.amount).toLocaleString()}
                </td>
                <td>
                  <span className={`org-status org-status--${p.status}`}>
                    {p.status === 'completed' && '✓ Completado'}
                    {p.status === 'pending' && '⏱ Pendiente'}
                  </span>
                </td>
                <td className="org-date">{p.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}

export { OrganizerPayments }
export default OrganizerPayments

