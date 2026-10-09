import { isBetaHidden } from '../../../config/betaHidden.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { getMyBrand, getSponsorableTourneys } from '../../../lib/brandApi.js'
import { downloadBrandReportPdf } from '../../../lib/brandDoc.js'
import './BrandDashboard.css'

const fmtN = n => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : String(n || 0)

const TIER_LABEL = { platinum: 'Platino', gold: 'Oro', silver: 'Plata' }
const STATUS_COLOR = { active: '#22c55e', pending: '#f59e0b', ended: '#6b7280', rejected: '#ef4444', approved: '#3b82f6', draft: '#9ca3af' }

const TIER_INFO = {
  silver: {
    color: '#94a3b8',
    price: '$150 USD/mes',
    features: ['Carrusel en página principal', 'Ficha de marca autogestionable', 'Directorio oficial de socios', 'Logo en cierre de transmisiones', 'Reporte de alcance mensual'],
    locked: ['Campañas activas', 'Banner en dashboard de jugadores', 'Logo en brackets', 'Naming rights'],
    upgrade: { label: 'Subir a Oro — $450 USD/mes', tier: 'Oro', color: '#F59E0B' },
  },
  gold: {
    color: '#F59E0B',
    price: '$450 USD/mes',
    features: ['Todo lo de Plata', 'Campañas de publicidad activas', 'Banner en dashboard de jugadores', 'Logo en brackets de torneos', 'Menciones en vivo (3×)', 'Reporte de impacto (PDF)'],
    locked: ['Naming rights del torneo', 'Branding inmersivo en stream', 'Formulario de captación directa'],
    upgrade: { label: 'Subir a Platino — desde $1,200 USD/torneo', tier: 'Platino', color: '#a78bfa' },
  },
  platinum: {
    color: '#a78bfa',
    price: 'desde $1,200 USD/torneo',
    features: ['Todo lo de Oro', 'Naming rights del torneo', 'Branding inmersivo en overlay', 'Formulario de captación directa', 'Analíticas avanzadas de impresiones', 'Logo fijo durante todas las partidas'],
    locked: [],
    upgrade: null,
  },
}

function TierCard({ brand, onContact }) {
  const info = TIER_INFO[brand.tier] || TIER_INFO.silver
  const checkIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M20 6 9 17l-5-5"/></svg>
  const lockIcon  = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

  return (
    <motion.div className="bd-tier-card" style={{ '--tc': info.color }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .03 }}>
      <div className="bd-tier-card__head">
        <div>
          <div className="bd-tier-card__name">{TIER_LABEL[brand.tier] || 'Plata'}</div>
          <div className="bd-tier-card__price">{info.price}</div>
        </div>
        {info.upgrade && (
          <button className="bd-tier-card__upgrade" onClick={onContact}>
            ↑ {info.upgrade.label}
          </button>
        )}
      </div>
      <div className="bd-tier-card__cols">
        <div>
          <div className="bd-tier-card__sec">Incluido</div>
          <ul className="bd-tier-card__list">
            {info.features.map(f => (
              <li key={f} className="bd-tier-card__feat ok">
                <span style={{ color: info.color }}>{checkIcon}</span>{f}
              </li>
            ))}
          </ul>
        </div>
        {info.locked.length > 0 && (
          <div>
            <div className="bd-tier-card__sec">Disponible en plan superior</div>
            <ul className="bd-tier-card__list">
              {info.locked.map(f => (
                <li key={f} className="bd-tier-card__feat off">
                  <span>{lockIcon}</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="bd-kpi" style={{ '--kc': color }}>
      <span className="bd-kpi__icon">{Icon[icon] || Icon.bolt}</span>
      <b>{value}</b>
      <small>{label}</small>
      {sub && <span className="bd-kpi__delta">{sub}</span>}
    </div>
  )
}

function NoBrand() {
  const navigate = useNavigate()
  return (
    <div className="pnl-empty" style={{ minHeight: 320 }}>
      <div className="pnl-empty__icon">{Icon.bolt}</div>
      <h3>No tienes una marca asignada</h3>
      <p>Contacta con el equipo GlitchGang para configurar tu cuenta de patrocinador.</p>
      <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/marcas')}>
        {Icon.send} Contactar equipo
      </button>
    </div>
  )
}

export default function BrandDashboard() {
  const navigate = useNavigate()
  const [data,       setData]       = useState(null)
  const [tourneys,   setTourneys]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [noBrand,    setNoBrand]    = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([getMyBrand(), getSponsorableTourneys()])
      .then(([d, t]) => {
        if (!alive) return
        setData(d)
        setTourneys(Array.isArray(t) ? t : [])
      })
      .catch(err => {
        if (!alive) return
        if (err?.message?.includes('Sin marca')) setNoBrand(true)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div className="pnl-empty"><GGLoader label="Sincronizando marca" size="sm" /></div>
  if (noBrand || !data) return <NoBrand />

  const { brand, campaigns = [], creatives = [] } = data

  const active    = campaigns.filter(c => c.status === 'active').length
  const pending   = campaigns.filter(c => c.status === 'pending').length
  const approved  = campaigns.filter(c => c.status === 'approved').length
  const ended     = campaigns.filter(c => c.status === 'ended').length
  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
  const totalClicks      = campaigns.reduce((s, c) => s + (c.clicks || 0), 0)
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0'

  const creReview   = creatives.filter(c => c.status === 'review').length
  const creApproved = creatives.filter(c => c.status === 'approved').length

  return (
    <div>
      {/* Hero */}
      <motion.div className="bd-hero" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="bd-hero__logo" style={{ background: brand.color || '#F0A500' }}>
          {brand.logoInitials || brand.name?.[0] || '?'}
        </span>
        <div className="bd-hero__main">
          <div className="bd-hero__nameline">
            <h1>{brand.name}</h1>
            <span className="bd-hero__tier">{TIER_LABEL[brand.tier] || brand.tier}</span>
          </div>
          <p className="bd-hero__sub">
            {brand.industry} · Socio desde {brand.since ? new Date(brand.since).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
        <div className="bd-hero__cta">
          <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/marca/campanas')}>
            {Icon.plus} Nueva campaña
          </button>
{!isBetaHidden('/marca/creatividades') && (
          <button className="pnl-btn" onClick={() => navigate('/marca/creatividades')}>
            {Icon.upload} Subir creatividad
          </button>
)}
          <button className="pnl-btn" disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true)
              try { await downloadBrandReportPdf(brand, campaigns) }
              catch { /* silent */ }
              finally { setPdfLoading(false) }
            }}>
            {Icon.download} {pdfLoading ? 'Generando…' : 'Descargar reporte'}
          </button>
        </div>
      </motion.div>

      {/* Tier info */}
      <TierCard brand={brand} onContact={() => navigate('/marca/contacto')} />

      {/* KPIs */}
      <motion.div className="bd-kpis" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }}>
        <StatCard label="Campañas activas"    value={String(active + approved)}  sub={`${pending} pendiente(s)`}    icon="bolt"     color="var(--panel-accent)" />
        <StatCard label="Impresiones totales" value={fmtN(totalImpressions)}     sub="acumuladas en campañas"       icon="eye"      color="#3b82f6" />
        <StatCard label="Clicks totales"      value={fmtN(totalClicks)}          sub={`CTR: ${avgCTR}%`}            icon="target"   color="#f59e0b" />
        <StatCard label="Creatividades"       value={String(creApproved)}         sub={`${creReview} en revisión`}   icon="palette"  color="#ec4899" />
        <StatCard label="Campañas finalizadas" value={String(ended)}             sub="historial completado"          icon="check"    color="#22c55e" />
      </motion.div>

      {/* Campañas recientes */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .08 }}>
        <div className="pnl-card__title">
          {Icon.bolt} Campañas recientes
          <button className="pnl-link pnl-card__action" onClick={() => navigate('/marca/campanas')}>
            Ver todas {Icon.chevronRight}
          </button>
        </div>
        {campaigns.length === 0 ? (
          <div className="pnl-empty" style={{ padding: '1.5rem 0' }}>
            <p>Aún no tienes campañas. <button className="pnl-link" onClick={() => navigate('/marca/campanas')}>Crea la primera →</button></p>
          </div>
        ) : (
          <table className="pnl-table">
            <thead>
              <tr><th>Campaña</th><th>Estado</th><th>Impresiones</th><th>Clicks</th><th>CTR</th></tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 5).map(c => {
                const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(1) : '—'
                const STATUS_LABEL = { draft:'Borrador', pending:'En revisión', active:'Activa', expired:'Expirada', rejected:'Rechazada' }
                return (
                  <tr key={c._id}>
                    <td><b>{c.name}</b></td>
                    <td>
                      <span className="pnl-tag" style={{ background: `${STATUS_COLOR[c.status]}22`, color: STATUS_COLOR[c.status] }}>
                        {STATUS_LABEL[c.status] || c.status}
                      </span>
                    </td>
                    <td>{c.impressions?.toLocaleString() || '0'}</td>
                    <td>{c.clicks?.toLocaleString() || '0'}</td>
                    <td>{ctr}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Torneos disponibles para patrocinar */}
      <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
        <div className="pnl-card__title">
          {Icon.trophy} Torneos disponibles para patrocinar
          <button className="pnl-link pnl-card__action" onClick={() => navigate('/marca/campanas')}>
            Crear campaña {Icon.chevronRight}
          </button>
        </div>
        {tourneys.length === 0 ? (
          <p style={{ color: 'var(--pnl-sub)', padding: '.5rem 0' }}>No hay torneos próximos en este momento.</p>
        ) : (
          <div className="bd-tourneys">
            {tourneys.map(t => (
              <div key={t._id} className="bd-tourney">
                <div className="bd-tourney__info">
                  <b>{t.title}</b>
                  <small>
                    {t.game} · {t.startDate || 'Fecha por confirmar'}
                    {t.capacity ? ` · ${t.registered || 0}/${t.capacity} equipos` : ''}
                    {t.prizePool ? ` · $${t.prizePool.toLocaleString()} en premios` : ''}
                  </small>
                </div>
                <div className="bd-tourney__right">
                  <span className={`pnl-tag ${t.status === 'live' ? 'pnl-tag--ok' : 'pnl-tag--accent'}`}>
                    {t.status === 'live' ? '● EN VIVO' : 'Próximo'}
                  </span>
                  <button className="pnl-link" onClick={() => navigate('/marca/campanas')}>
                    Patrocinar {Icon.chevronRight}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Creatividades recientes */}
      {creatives.length > 0 && (
        <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .12 }}>
          <div className="pnl-card__title">
            {Icon.palette} Creatividades recientes
{!isBetaHidden('/marca/creatividades') && (
            <button className="pnl-link pnl-card__action" onClick={() => navigate('/marca/creatividades')}>
              Ver todas {Icon.chevronRight}
            </button>
)}
          </div>
          <table className="pnl-table">
            <thead><tr><th>Archivo</th><th>Formato</th><th>Campaña</th><th>Estado</th></tr></thead>
            <tbody>
              {creatives.slice(0, 4).map(c => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td>{c.format || '—'}</td>
                  <td>{c.campaignId?.name || '—'}</td>
                  <td>
                    <span className={`pnl-tag ${c.status === 'approved' ? 'pnl-tag--ok' : c.status === 'rejected' ? 'pnl-tag--live' : 'pnl-tag--warn'}`}>
                      {c.status === 'approved' ? 'Aprobada' : c.status === 'rejected' ? 'Rechazada' : 'En revisión'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Quick actions */}
      <motion.div className="pnl-grid pnl-grid--3 pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .14 }}>
        {[
          { label: 'Nueva campaña', sub: 'Envía material para publicación', icon: 'plus', path: '/marca/campanas', primary: true },
          { label: 'Ver inventario', sub: 'Espacios disponibles con precios', icon: 'layoutGrid', path: '/marca/inventario', primary: false },
          { label: 'Subir creatividad', sub: 'Banners, overlays y piezas', icon: 'upload', path: '/marca/creatividades', primary: false },
        ].filter(a => !isBetaHidden(a.path)).map(a => (
          <div key={a.label} className="pnl-card bd-qaction" onClick={() => navigate(a.path)}>
            <span className="bd-qaction__icon" style={{ color: a.primary ? 'var(--panel-accent)' : undefined }}>{Icon[a.icon]}</span>
            <b>{a.label}</b>
            <small>{a.sub}</small>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

