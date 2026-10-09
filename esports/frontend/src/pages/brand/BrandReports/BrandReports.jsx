import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { toast } from '../../../lib/toast.js'
import { getBrandReports, getBrandReportFile, markReportRead } from '../../../lib/brandApi.js'
import './BrandReports.css'

const TYPE_META = {
  stats:     { label: 'Estadísticas',    icon: 'chartBar', color: '#3b82f6' },
  alcance:   { label: 'Alcance',         icon: 'eye',      color: '#8b5cf6' },
  document:  { label: 'Documento',       icon: 'fileText', color: '#f59e0b' },
  message:   { label: 'Mensaje',         icon: 'chat',     color: '#22c55e' },
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatsPanel({ report }) {
  const s = report.statsData || {}
  return (
    <div className="brp-stats">
      {[
        { label: 'Impresiones', value: (s.impressions || 0).toLocaleString(), icon: 'eye' },
        { label: 'Clics',       value: (s.clicks || 0).toLocaleString(),       icon: 'globe' },
        { label: 'CTR',         value: `${(s.ctr || 0).toFixed(1)}%`,          icon: 'chartBar' },
        { label: 'Alcance',     value: (s.reach || 0).toLocaleString(),         icon: 'users' },
      ].map(k => (
        <div key={k.label} className="brp-stat">
          <span className="brp-stat__icon">{Icon[k.icon]}</span>
          <b>{k.value}</b>
          <small>{k.label}</small>
        </div>
      ))}
      {s.period && <div className="brp-stats__period">{Icon.clock} Período: <strong>{s.period}</strong></div>}
    </div>
  )
}

function ReportModal({ report, onClose }) {
  const [full, setFull] = useState(null)
  const meta = TYPE_META[report.type] || TYPE_META.message

  useEffect(() => {
    if (report.type === 'document') {
      getBrandReportFile(report._id).then(setFull).catch(() => {})
    }
  }, [report._id, report.type])

  return (
    <motion.div className="brp-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="brp-modal"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>

        <div className="brp-modal__head" style={{ '--mc': meta.color }}>
          <div className="brp-modal__type">
            <span className="brp-modal__type-icon">{Icon[meta.icon]}</span>
            {meta.label}
          </div>
          <h2>{report.title}</h2>
          <p className="brp-modal__date">{fmtDate(report.createdAt)}</p>
          <button className="brp-modal__close" onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="brp-modal__body">
          {report.body && <p className="brp-modal__text">{report.body}</p>}

          {(report.type === 'stats' || report.type === 'alcance') && <StatsPanel report={report} />}

          {report.type === 'document' && (
            <div className="brp-doc">
              {full?.fileData ? (
                <>
                  <p className="brp-doc__name">{Icon.fileText} {full.fileName || 'Documento'}</p>
                  <a
                    href={full.fileData}
                    download={full.fileName || 'reporte.pdf'}
                    className="pnl-btn pnl-btn--primary"
                  >
                    {Icon.download} Descargar documento
                  </a>
                </>
              ) : (
                <GGLoader label="Preparando documento" size="sm" />
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function BrandReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel,     setSel]     = useState(null)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    getBrandReports()
      .then(setReports)
      .catch(() => toast('Error cargando reportes', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const openReport = async (report) => {
    setSel(report)
    if (!report.readAt) {
      await markReportRead(report._id).catch(() => {})
      setReports(prev => prev.map(r => r._id === report._id ? { ...r, readAt: new Date() } : r))
    }
  }

  const unread  = reports.filter(r => !r.readAt).length
  const filtered = filter === 'all' ? reports : reports.filter(r => r.type === filter)

  return (
    <div className="brp-page">
      <div className="pnl-head">
        <div>
          <h1>Mis Reportes</h1>
          <p>Reportes, estadísticas y documentos enviados por el equipo de GlitchGang.</p>
        </div>
        {unread > 0 && (
          <span className="brp-unread-badge">{unread} sin leer</span>
        )}
      </div>

      {/* Filter chips */}
      <div className="brp-filters">
        {[
          { key: 'all',       label: 'Todos' },
          { key: 'stats',     label: 'Estadísticas' },
          { key: 'alcance',   label: 'Alcance' },
          { key: 'document',  label: 'Documentos' },
          { key: 'message',   label: 'Mensajes' },
        ].map(({ key, label }) => (
          <button key={key}
            className={`brp-chip ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}>
            {label}
            {key === 'all' && reports.length > 0 && <span className="brp-chip__count">{reports.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="pnl-empty"><GGLoader label="Sincronizando reportes" size="sm" /></div>
      ) : filtered.length === 0 ? (
        <div className="pnl-empty">
          <div className="pnl-empty__icon">{Icon.fileText}</div>
          <h3>Sin reportes {filter !== 'all' ? 'en esta categoría' : 'todavía'}</h3>
          <p>El equipo de GlitchGang te enviará estadísticas y actualizaciones aquí.</p>
        </div>
      ) : (
        <div className="brp-list">
          {filtered.map(report => {
            const meta = TYPE_META[report.type] || TYPE_META.message
            const isUnread = !report.readAt
            return (
              <motion.button
                key={report._id}
                className={`brp-item ${isUnread ? 'brp-item--unread' : ''}`}
                style={{ '--mc': meta.color }}
                onClick={() => openReport(report)}
                whileHover={{ x: 2 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="brp-item__icon">{Icon[meta.icon]}</div>
                <div className="brp-item__body">
                  <div className="brp-item__top">
                    <span className="brp-item__type">{meta.label}</span>
                    <span className="brp-item__date">{fmtDate(report.createdAt)}</span>
                  </div>
                  <h3 className="brp-item__title">{report.title}</h3>
                  {report.body && <p className="brp-item__preview">{report.body.slice(0, 100)}{report.body.length > 100 ? '…' : ''}</p>}
                  {(report.type === 'stats' || report.type === 'alcance') && report.statsData?.period && (
                    <p className="brp-item__meta">{Icon.clock} {report.statsData.period}</p>
                  )}
                </div>
                {isUnread && <span className="brp-item__dot" />}
                <span className="brp-item__arrow">{Icon.chevronRight}</span>
              </motion.button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {sel && <ReportModal report={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  )
}

