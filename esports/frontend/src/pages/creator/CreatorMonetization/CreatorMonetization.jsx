import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
const REVENUE_SOURCES = []
const PAYOUT_HISTORY = []
const PAYOUT_STATUS_LABEL = { paid: 'Pagado', pending: 'Pendiente', processing: 'Procesando' }
const BRAND_DEALS = []
const DEAL_STATUS_LABEL = { active: 'Activo', invited: 'Invitado', completed: 'Completado' }
import './CreatorMonetization.css'

export default function CreatorMonetization() {
  const total = REVENUE_SOURCES.reduce((s, r) => s + r.amount, 0)
  const pending = PAYOUT_HISTORY.find(p => p.status === 'pending')

  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Monetización</h1>
          <p>Tus ingresos, fuentes de ganancia, pagos y acuerdos de marca.</p>
        </div>
        <button className="pnl-btn pnl-btn--primary">{Icon.creditCard} Configurar cobros</button>
      </div>

      {/* Resumen */}
      <div className="cm-summary">
        <motion.div className="cm-balance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="cm-balance__label">Ingresos del mes</span>
          <strong className="cm-balance__value">${total.toLocaleString()}</strong>
          <span className="cm-balance__sub">{pending ? `Próximo pago: $${pending.amount} · pendiente` : 'Sin pagos pendientes'}</span>
        </motion.div>

        <motion.div className="pnl-card cm-sources" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .06 }}>
          <div className="pnl-card__title">{Icon.chartBar} Fuentes de ingreso</div>
          <div className="cm-sources__bar">
            {REVENUE_SOURCES.map(r => (
              <div key={r.id} className="cm-sources__seg" style={{ width: `${r.pct}%`, background: r.color }} title={`${r.label} · ${r.pct}%`} />
            ))}
          </div>
          <div className="cm-sources__list">
            {REVENUE_SOURCES.map(r => (
              <div key={r.id} className="cm-source">
                <span className="cm-source__icon" style={{ background: `color-mix(in srgb, ${r.color} 18%, transparent)`, color: r.color }}>{Icon[r.icon]}</span>
                <div className="cm-source__info">
                  <b>{r.label}</b>
                  <small>{r.pct}% del total</small>
                </div>
                <strong>${r.amount}</strong>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Acuerdos de marca */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
        <div className="pnl-card__title">{Icon.star} Acuerdos de marca</div>
        <div className="cm-deals">
          {BRAND_DEALS.map(d => (
            <div key={d.id} className="cm-deal" style={{ '--dc': d.color }}>
              <span className="cm-deal__logo">{d.brand[0]}</span>
              <div className="cm-deal__info">
                <b>{d.brand}</b>
                <small>{d.type} · vence {d.deadline}</small>
              </div>
              <div className="cm-deal__right">
                <strong>${d.payout}</strong>
                <span className={`pnl-tag ${d.status === 'active' ? 'pnl-tag--ok' : d.status === 'invited' ? 'pnl-tag--accent' : 'pnl-tag--warn'}`}>
                  {DEAL_STATUS_LABEL[d.status]}
                </span>
              </div>
              {d.status === 'invited'
                ? <button className="pnl-btn pnl-btn--primary cm-deal__btn">Aceptar</button>
                : <button className="pnl-btn cm-deal__btn">Detalles</button>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Historial de pagos */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .12 }}>
        <div className="pnl-card__title">{Icon.creditCard} Historial de pagos</div>
        <table className="pnl-table">
          <thead><tr><th>Periodo</th><th>Monto</th><th>Método</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody>
            {PAYOUT_HISTORY.map(p => (
              <tr key={p.id}>
                <td>{p.period}</td>
                <td><strong>${p.amount.toLocaleString()}</strong></td>
                <td>{p.method}</td>
                <td>{p.date}</td>
                <td><span className={`pnl-tag ${p.status === 'paid' ? 'pnl-tag--ok' : 'pnl-tag--warn'}`}>{PAYOUT_STATUS_LABEL[p.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}

