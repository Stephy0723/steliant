import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
// Sin backend para analytics de creadores todavía
const AUDIENCE_TIMELINE = { followers: [0, 0], labels: ['—', '—'], views: [0, 0] }
const TOP_CONTENT = []
const AUDIENCE_GEO = []
const CREATOR_KPIS = []
import './CreatorAnalytics.css'

function BarChart({ data, labels, suffix = 'K' }) {
  const W = 560, H = 200, pad = 30
  const max = Math.max(...data)
  const bw = (W - pad * 2) / data.length * 0.55
  const step = (W - pad * 2) / data.length
  return (
    <svg className="pnl-chart" viewBox={`0 0 ${W} ${H}`}>
      {data.map((v, i) => {
        const h = (v / max) * (H - pad * 2)
        const x = pad + i * step + (step - bw) / 2
        const y = H - pad - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx="4" fill="rgba(var(--panel-accent-rgb), .55)" />
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" className="pnl-chart__lbl">{v}{suffix}</text>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" className="pnl-chart__lbl">{labels[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function CreatorAnalytics() {
  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Analíticas</h1>
          <p>Rendimiento de tu contenido y audiencia en los últimos 30 días.</p>
        </div>
        <button className="pnl-btn">{Icon.download} Exportar CSV</button>
      </div>

      {/* KPIs resumidos */}
      <motion.div className="pnl-kpis" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {CREATOR_KPIS.slice(0, 4).map(k => (
          <div key={k.key} className="pnl-kpi">
            <div className="pnl-kpi__icon">{Icon[k.icon]}</div>
            <div className="pnl-kpi__value">{k.value}</div>
            <div className="pnl-kpi__label">{k.label}</div>
            <div className={`pnl-kpi__delta ${k.down ? 'down' : ''}`}>{k.down ? '▼' : '▲'} {k.delta}</div>
          </div>
        ))}
      </motion.div>

      <div className="pnl-grid pnl-grid--2 pnl-section-gap">
        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .08 }}>
          <div className="pnl-card__title">{Icon.chartBar} Vistas por mes (miles)</div>
          <BarChart data={AUDIENCE_TIMELINE.views} labels={AUDIENCE_TIMELINE.labels} />
        </motion.div>

        <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
          <div className="pnl-card__title">{Icon.globe} Audiencia por país</div>
          <div className="ca-geo">
            {AUDIENCE_GEO.map(g => (
              <div key={g.country} className="ca-geo__row">
                <span className="ca-geo__name">{g.country}</span>
                <div className="ca-geo__bar"><div className="pnl-bar"><div className="pnl-bar__fill" style={{ width: `${g.pct}%` }} /></div></div>
                <span className="ca-geo__pct">{g.pct}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .12 }}>
        <div className="pnl-card__title">{Icon.trophy} Top contenido por rendimiento</div>
        <table className="pnl-table">
          <thead><tr><th>Contenido</th><th>Vistas</th><th>CTR</th><th>Rendimiento</th></tr></thead>
          <tbody>
            {TOP_CONTENT.map((c, i) => (
              <tr key={i}>
                <td>{c.title}</td>
                <td>{c.views.toLocaleString()}</td>
                <td>{c.ctr}%</td>
                <td style={{ width: 160 }}>
                  <div className="pnl-bar"><div className="pnl-bar__fill" style={{ width: `${(c.views / TOP_CONTENT[0].views) * 100}%` }} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}

