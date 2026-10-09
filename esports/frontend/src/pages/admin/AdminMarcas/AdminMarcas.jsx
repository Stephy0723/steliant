import { useState, useEffect, useCallback } from 'react'
import { safeHref } from '../../../lib/safeUrl.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { toast } from '../../../lib/toast.js'
import {
  adminGetAllBrands, adminGetApplications, adminReviewApplication,
  adminUpdateBrand, adminApproveBrandChanges,
  adminGetPendingCreatives, adminReviewCreative,
  adminGetCampaigns, adminApproveCampaign, adminRejectCampaign, adminReviewCampaignPayment,
  adminSendReport, adminGetBrandReports, adminLinkBrandUser,
  adminGetTickets, adminGetTicketDetail, adminUpdateTicket, adminReplyTicket,
} from '../../../lib/brandApi.js'
import { downloadBrandReportPdf } from '../../../lib/brandDoc.js'
import './AdminMarcas.css'

const TIER_COLOR = { platinum: '#00E676', gold: '#F3A800', silver: '#94a3b8' }
const TIER_LABEL = { platinum: 'Platino', gold: 'Oro', silver: 'Plata' }
const STATUS_LABEL = { active: 'Activa', inactive: 'Inactiva', pending: 'Pendiente' }

// ── Shared helpers ────────────────────────────────────────────────────────────
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
function TierBadge({ tier }) {
  return <span className="am-tier" style={{ '--tc': TIER_COLOR[tier] || '#94a3b8' }}>{TIER_LABEL[tier] || tier}</span>
}
function StatusDot({ status }) {
  return <span className={`am-dot am-dot--${status}`}>{STATUS_LABEL[status] || status}</span>
}

// ── TAB: Solicitudes ──────────────────────────────────────────────────────────
function TabApplications() {
  const [apps,    setApps]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('pending')
  const [sel,     setSel]     = useState(null)
  const [reason,  setReason]  = useState('')
  const [acting,  setActing]  = useState(false)

  const load = useCallback((s) => {
    setLoading(true)
    adminGetApplications(s).then(setApps).catch(() => toast('Error cargando solicitudes', 'error')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(filter) }, [filter, load])

  const review = async (action) => {
    if (!sel) return
    setActing(true)
    try {
      const res = await adminReviewApplication(sel._id, { action, rejectionReason: reason })
      toast(action === 'approve' ? `Marca aprobada${res.linkedUser ? ` · Usuario @${res.linkedUser} vinculado` : ' · Sin usuario vinculado (busca uno en Marcas activas)'}` : 'Solicitud rechazada', action === 'approve' ? 'success' : 'error')
      setSel(null); setReason('')
      load(filter)
    } catch (err) {
      toast(err?.message || 'Error', 'error')
    } finally { setActing(false) }
  }

  return (
    <div className="am-tab-body">
      <div className="am-filters">
        {[['pending','Pendientes'],['approved','Aprobadas'],['rejected','Rechazadas'],['all','Todas']].map(([k,l]) => (
          <button key={k} className={`am-chip ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="am-empty">Cargando…</div> : apps.length === 0 ? (
        <div className="am-empty">{Icon.check}<p>No hay solicitudes {filter !== 'all' ? `en estado "${filter}"` : ''}.</p></div>
      ) : (
        <div className="am-list">
          {apps.map(app => (
            <div key={app._id} className={`am-app-card am-app-card--${app.status}`}>
              <div className="am-app-card__logo" style={{ background: app.color || '#F0A500' }}>
                {app.logoInitials || app.companyName?.[0]}
              </div>
              <div className="am-app-card__info">
                <div className="am-app-card__top">
                  <h3>{app.companyName}</h3>
                  {app.publicCode && <code className="am-app-code" title={app.internalCode}>{app.publicCode}</code>}
                  <TierBadge tier={app.tierInterest} />
                  <StatusDot status={app.status} />
                </div>
                <p className="am-app-card__meta">{app.industry} · {app.contactName} · {app.contactEmail}</p>
                {app.website && <p className="am-app-card__web">{Icon.globe} {app.website}</p>}
                {app.message  && <p className="am-app-card__msg">"{app.message.slice(0,120)}{app.message.length>120?'…':''}"</p>}
                <p className="am-app-card__date">{fmtDate(app.createdAt)}</p>
              </div>
              {app.status === 'pending' && (
                <div className="am-app-card__actions">
                  <button className="am-btn am-btn--approve" onClick={() => setSel(app)}>{Icon.check} Aprobar</button>
                  <button className="am-btn am-btn--reject"  onClick={() => { setSel({...app, _rejecting: true}) }}>Rechazar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {sel && (
          <motion.div className="am-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => e.target===e.currentTarget && setSel(null)}>
            <motion.div className="am-confirm" initial={{ y:20,opacity:0 }} animate={{ y:0,opacity:1 }} exit={{ y:10,opacity:0 }}>
              <h3>{sel._rejecting ? 'Rechazar solicitud' : 'Aprobar solicitud'}</h3>
              <p>{sel._rejecting
                ? `¿Rechazar la solicitud de ${sel.companyName}?`
                : `¿Aprobar a ${sel.companyName} como marca socia? Se creará su perfil y se vinculará su cuenta si el correo ${sel.contactEmail} tiene usuario registrado.`}
              </p>
              {sel._rejecting && (
                <div className="am-field">
                  <label>Motivo del rechazo (opcional)</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explica brevemente el motivo…" />
                </div>
              )}
              <div className="am-confirm__actions">
                <button className="am-btn" onClick={() => { setSel(null); setReason('') }} disabled={acting}>Cancelar</button>
                <button className={`am-btn ${sel._rejecting ? 'am-btn--reject' : 'am-btn--approve'}`}
                  onClick={() => review(sel._rejecting ? 'reject' : 'approve')} disabled={acting}>
                  {acting ? 'Procesando…' : sel._rejecting ? 'Confirmar rechazo' : 'Confirmar aprobación'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TAB: Marcas activas ────────────────────────────────────────────────────────
function TabBrands() {
  const [brands,     setBrands]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [sel,        setSel]        = useState(null)
  const [editing,    setEditing]    = useState(false)
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [linkEmail,  setLinkEmail]  = useState('')
  const [linking,    setLinking]    = useState(false)

  useEffect(() => {
    adminGetAllBrands().then(setBrands).catch(() => toast('Error', 'error')).finally(() => setLoading(false))
  }, [])

  const openEdit = (brand) => {
    setSel(brand); setEditing(true); setLinkEmail('')
    setForm({
      status:       brand.status,
      tier:         brand.tier,
      tagline:      brand.tagline      || '',
      website:      brand.website      || '',
      contactName:  brand.contactName  || '',
      contactEmail: brand.contactEmail || '',
      contactPhone: brand.contactPhone || '',
    })
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const updated = await adminUpdateBrand(sel._id, form)
      setBrands(prev => prev.map(b => b._id === sel._id ? { ...b, ...updated } : b))
      toast('Marca actualizada', 'success')
      setEditing(false)
    } catch (err) { toast(err?.message || 'Error', 'error') } finally { setSaving(false) }
  }

  const linkUser = async () => {
    if (!linkEmail.trim()) return
    setLinking(true)
    try {
      const res = await adminLinkBrandUser(sel._id, linkEmail.trim())
      toast(`Usuario @${res.user.nick} vinculado · rol → brand`, 'success')
      setLinkEmail('')
    } catch (err) { toast(err?.message || 'Usuario no encontrado', 'error') }
    finally { setLinking(false) }
  }

  const approveChanges = async (brand, action) => {
    try {
      await adminApproveBrandChanges(brand._id, action)
      toast(action === 'approve' ? 'Cambios aplicados' : 'Cambios rechazados', 'success')
      adminGetAllBrands().then(setBrands)
    } catch (err) { toast(err?.message || 'Error', 'error') }
  }

  const filtered = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.industry.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="am-tab-body">
      <div className="am-search-bar">
        {Icon.search}
        <input placeholder="Buscar marca o industria…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="am-empty">Cargando…</div> : (
        <div className="am-brands-grid">
          {filtered.map(brand => {
            const tc = TIER_COLOR[brand.tier] || '#94a3b8'
            const hasPending = !!brand.pendingChanges?.submittedAt
            return (
              <div key={brand._id} className="am-brand-card" style={{ '--tc': tc }}>
                <div className="am-brand-card__bar" style={{ background: tc }} />
                <div className="am-brand-card__head">
                  <div className="am-brand-card__logo" style={{ background: brand.color || '#F0A500' }}>
                    {brand.logoInitials || brand.name?.[0]}
                  </div>
                  <div>
                    <TierBadge tier={brand.tier} />
                    <StatusDot status={brand.status} />
                  </div>
                </div>
                <div className="am-brand-card__codes">
                  <code>{brand.code}</code>
                  {brand.internalCode && <code className="am-brand-card__internal-code" title="Código Interno (Admin)">{brand.internalCode}</code>}
                </div>
                <h3>{brand.name}</h3>
                <p className="am-brand-card__industry">{brand.industry}</p>
                <div className="am-brand-card__stats">
                  <span>{brand._campaigns || 0} campañas</span>
                  <span>{brand._creatives || 0} creatividades</span>
                  {brand._pendingCreatives > 0 && <span className="am-brand-card__pending">{brand._pendingCreatives} pendientes</span>}
                </div>
                {hasPending && (
                  <div className="am-brand-card__changes">
                    <p>{Icon.clock} Cambios de perfil pendientes ({fmtDate(brand.pendingChanges.submittedAt)})</p>
                    <div className="am-brand-card__changes-actions">
                      <button className="am-btn am-btn--sm am-btn--approve" onClick={() => approveChanges(brand, 'approve')}>{Icon.check} Aplicar</button>
                      <button className="am-btn am-btn--sm am-btn--reject"  onClick={() => approveChanges(brand, 'reject')}>Rechazar</button>
                    </div>
                  </div>
                )}
                <div className="am-brand-card__actions">
                  <button className="am-btn am-btn--sm" onClick={() => openEdit(brand)}>{Icon.gear} Editar</button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="am-empty" style={{ gridColumn:'1/-1' }}>No hay marcas.</div>}
        </div>
      )}

      {/* Edit drawer */}
      <AnimatePresence>
        {editing && sel && (
          <motion.div className="am-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => e.target===e.currentTarget && setEditing(false)}>
            <motion.div className="am-drawer" initial={{ x:60,opacity:0 }} animate={{ x:0,opacity:1 }} exit={{ x:60,opacity:0 }}>
              <div className="am-drawer__head">
                <h3>Editar — {sel.name}</h3>
                <button className="am-close" onClick={() => setEditing(false)}>{Icon.x}</button>
              </div>
              <div className="am-drawer__body">
                <div className="am-field-row">
                  <div className="am-field">
                    <label>Estado</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Activa</option>
                      <option value="inactive">Inactiva</option>
                      <option value="pending">Pendiente</option>
                    </select>
                  </div>
                  <div className="am-field">
                    <label>Plan (tier)</label>
                    <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}>
                      <option value="silver">Plata</option>
                      <option value="gold">Oro</option>
                      <option value="platinum">Platino</option>
                    </select>
                  </div>
                </div>
                <div className="am-field">
                  <label>Tagline</label>
                  <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} />
                </div>
                <div className="am-field">
                  <label>Sitio web</label>
                  <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                </div>
                <div className="am-field-row">
                  <div className="am-field">
                    <label>Contacto</label>
                    <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
                  </div>
                  <div className="am-field">
                    <label>Email contacto</label>
                    <input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
                  </div>
                </div>
                <div className="am-field">
                  <label>Teléfono</label>
                  <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
                </div>

                <div className="am-field am-field--link-user">
                  <label>{Icon.user} Vincular usuario (correo de cuenta)</label>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 6px' }}>
                    Si el email del registro no coincidió con ninguna cuenta, vincúlala manualmente aquí.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      value={linkEmail}
                      onChange={e => setLinkEmail(e.target.value)}
                      placeholder="correo@cuenta.com"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="am-btn am-btn--primary"
                      onClick={linkUser}
                      disabled={linking || !linkEmail.trim()}
                    >
                      {linking ? 'Vinculando…' : `${Icon.check} Vincular`}
                    </button>
                  </div>
                </div>
              </div>
              <div className="am-drawer__foot">
                <button className="am-btn" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
                <button className="am-btn am-btn--primary" onClick={saveEdit} disabled={saving}>
                  {saving ? 'Guardando…' : `${Icon.check} Guardar`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TAB: Campañas ─────────────────────────────────────────────────────────────
function TabCampaigns() {
  const [filter,  setFilter]  = useState('pending')
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sel,     setSel]     = useState(null)
  const [notes,   setNotes]   = useState('')
  const [acting,  setActing]  = useState(false)

  const load = useCallback((s) => {
    setLoading(true)
    adminGetCampaigns(s).then(setItems).catch(() => toast('Error cargando campañas', 'error')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(filter) }, [filter, load])

  const decide = async (action) => {
    if (action === 'reject' && !notes.trim()) { toast('El motivo de rechazo es requerido', 'error'); return }
    setActing(true)
    try {
      if (action === 'approve') {
        await adminApproveCampaign(sel._id)
        toast('Campaña aprobada · anuncios activos en la plataforma', 'success')
      } else {
        await adminRejectCampaign(sel._id, notes)
        toast('Campaña rechazada', 'error')
      }
      setSel(null); setNotes('')
      load(filter)
    } catch (err) { toast(err?.message || 'Error', 'error') } finally { setActing(false) }
  }

  // Verificar/rechazar el comprobante desde el mismo modal: antes no habia
  // ninguna pantalla para hacerlo, y sin pago verificado no se puede publicar.
  const reviewPayment = async (action) => {
    if (action === 'reject' && !notes.trim()) { toast('Escribe el motivo de rechazo del pago', 'error'); return }
    setActing(true)
    try {
      await adminReviewCampaignPayment(sel._id, action === 'verify' ? { action } : { action, rejectedReason: notes.trim() })
      const status = action === 'verify' ? 'verified' : 'rejected'
      setSel(prev => prev && { ...prev, payment: { ...prev.payment, status } })
      if (action === 'reject') setNotes('')
      toast(action === 'verify' ? 'Pago verificado · ya puedes publicar la campaña' : 'Pago rechazado · la marca debe enviar otro comprobante', action === 'verify' ? 'success' : 'error')
      load(filter)
    } catch (err) { toast(err?.message || 'Error', 'error') } finally { setActing(false) }
  }

  const AD_TYPE_LABEL  = { banner: 'Banner', strip: 'Strip torneo', floating: 'Floating' }
  const PAY_STATUS_TAG = { pending: 'pnl-tag--warn', verified: 'pnl-tag--ok', rejected: 'pnl-tag--live' }
  const PAY_STATUS_LBL = { pending: 'En verificación', verified: 'Verificado', rejected: 'Rechazado' }

  return (
    <div className="am-tab-body">
      <div className="am-filters">
        {[['pending','Pendientes'],['active','Activas'],['rejected','Rechazadas'],['all','Todas']].map(([k,l]) => (
          <button key={k} className={`am-chip ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="am-empty">Cargando…</div> : items.length === 0 ? (
        <div className="am-empty">{Icon.check}<p>No hay campañas {filter !== 'all' ? `en estado "${filter}"` : ''}.</p></div>
      ) : (
        <div className="am-list">
          {items.map(c => (
            <div key={c._id} className="am-campaign-row">
              <div className="am-creative-row__brand">
                <div className="am-creative-row__logo" style={{ background: c.brandId?.color || '#F0A500' }}>
                  {c.brandId?.logoInitials || '?'}
                </div>
                <span>{c.brandId?.name}</span>
              </div>
              <div className="am-creative-row__info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b>{c.name}</b>
                  {c.publicCode && <code className="am-app-code" title={c.internalCode || 'Código Interno'}>{c.publicCode}</code>}
                </div>
                {c.objective && <span>{c.objective.slice(0,60)}{c.objective.length>60?'…':''}</span>}
                {(c.startDate || c.endDate) && (
                  <span>{Icon.clock} {c.startDate ? fmtDate(c.startDate) : '?'} → {c.endDate ? fmtDate(c.endDate) : '?'}</span>
                )}
                {c.creatives?.length > 0 && <span>{c.creatives.length} creatividad(es)</span>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {c.payment?.status && (
                  <div style={{ marginBottom: 4 }}>
                    <span className={`pnl-tag ${PAY_STATUS_TAG[c.payment.status] || ''}`}>
                      Pago: {PAY_STATUS_LBL[c.payment.status]}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  ${(c.budget || 0).toLocaleString()}
                </div>
              </div>
              <button className="am-btn am-btn--sm am-btn--primary" onClick={() => setSel(c)}>Revisar</button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {sel && (
          <motion.div className="am-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => e.target===e.currentTarget && setSel(null)}>
            <motion.div className="am-confirm am-confirm--wide" initial={{ y:20,opacity:0 }} animate={{ y:0,opacity:1 }}>
              <h3>Revisar campaña</h3>

              {/* Brand + campaign info */}
              <div className="am-camp-info">
                <div className="am-camp-info__brand">
                  <div className="am-creative-row__logo" style={{ background: sel.brandId?.color || '#F0A500', width:40, height:40, borderRadius:10 }}>
                    {sel.brandId?.logoInitials || '?'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize:15 }}>{sel.name}</b>
                      {sel.publicCode && <code className="am-app-code" title={sel.internalCode || 'Código Interno'}>{sel.publicCode}</code>}
                    </div>
                    <span style={{ fontSize:12, color:'var(--text-dim)', display:'block' }}>{sel.brandId?.name}</span>
                  </div>
                </div>
                {(sel.objective || sel.budget > 0 || sel.startDate) && (
                  <div className="am-camp-info__meta">
                    {sel.objective && <p>{sel.objective}</p>}
                    <p>${(sel.budget || 0).toLocaleString()} USD · {fmtDate(sel.startDate)} → {fmtDate(sel.endDate)}</p>
                  </div>
                )}
              </div>

              {/* Payment proof */}
              {!sel.payment?.status && (
                <div className="am-camp-payment">
                  <span className="pnl-tag">Pago: sin comprobante</span>
                  <span style={{ fontSize:12, color:'var(--text-dim)' }}>La marca todavía no envía el comprobante; no se puede publicar.</span>
                </div>
              )}
              {sel.payment?.status && (
                <div className="am-camp-payment">
                  <span className={`pnl-tag ${PAY_STATUS_TAG[sel.payment.status] || ''}`}>
                    Pago: {PAY_STATUS_LBL[sel.payment.status]}
                  </span>
                  {sel.payment.proofType && <span style={{ fontSize:12, color:'var(--text-dim)' }}> · {sel.payment.proofType}</span>}
                  {sel.payment.amount > 0 && <span style={{ fontSize:12, color:'var(--text-dim)' }}> · ${sel.payment.amount.toLocaleString()}</span>}
                  {sel.payment.proofUrl && (
                    <a href={safeHref(sel.payment.proofUrl)} target="_blank" rel="noopener noreferrer" className="am-camp-proof">
                      {Icon.fileText} Ver comprobante
                    </a>
                  )}
                  {sel.payment.status === 'pending' && (
                    <span className="am-camp-payment__actions">
                      <button type="button" className="am-btn am-btn--reject" onClick={() => reviewPayment('reject')} disabled={acting || !notes.trim()}
                        title={notes.trim() ? '' : 'Escribe el motivo abajo para rechazar el pago'}>Rechazar pago</button>
                      <button type="button" className="am-btn am-btn--approve" onClick={() => reviewPayment('verify')} disabled={acting}>{Icon.check} Verificar pago</button>
                    </span>
                  )}
                </div>
              )}

              {/* Creatives */}
              {sel.creatives?.length > 0 && (
                <div className="am-camp-creatives">
                  <p className="am-camp-creatives__label">{sel.creatives.length} creatividad(es) vinculada(s):</p>
                  <div className="am-camp-creatives__list">
                    {sel.creatives.map(cr => (
                      <div key={cr._id} className="am-camp-creative">
                        {cr.imageUrl && <img src={cr.imageUrl} alt={cr.name} className="am-camp-creative__img" />}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <b>{cr.name}</b>
                            {cr.adId && <code className="am-app-code" title={cr.internalCode || 'Código Interno'} style={{ fontSize: 10 }}>{cr.adId}</code>}
                          </div>
                          {cr.adType && (
                            <span className="am-type-badge am-type-badge--stats" style={{ marginTop:2, display:'inline-block' }}>
                              {AD_TYPE_LABEL[cr.adType] || cr.adType}
                            </span>
                          )}
                          {cr.linkUrl && (
                            <a href={safeHref(cr.linkUrl)} target="_blank" rel="noopener noreferrer"
                              style={{ display:'block', fontSize:11, color:'var(--accent)', marginTop:2 }}>
                              {cr.linkUrl.slice(0,50)}{cr.linkUrl.length>50?'…':''}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="am-field">
                <label>Motivo de rechazo (requerido si rechazas la campaña o el pago)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Indica qué debe corregir la marca…" />
              </div>
              <div className="am-confirm__actions">
                <button className="am-btn" onClick={() => { setSel(null); setNotes('') }} disabled={acting}>Cancelar</button>
                <button className="am-btn am-btn--reject"  onClick={() => decide('reject')}  disabled={acting || !notes.trim()}>Rechazar</button>
                <button className="am-btn am-btn--approve" onClick={() => decide('approve')} disabled={acting || sel.payment?.status !== 'verified'}
                  title={sel.payment?.status === 'verified' ? '' : 'Verifica primero el comprobante de pago'}>{Icon.check} Aprobar · Publicar</button>
              </div>
              {sel.status === 'pending' && sel.payment?.status !== 'verified' && (
                <p className="am-camp-gate">Para publicar, primero verifica el comprobante de pago de la campaña.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TAB: Creatividades ────────────────────────────────────────────────────────
function TabCreatives() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sel,     setSel]     = useState(null)
  const [reason,  setReason]  = useState('')
  const [acting,  setActing]  = useState(false)

  const load = () => {
    setLoading(true)
    adminGetPendingCreatives().then(setItems).catch(() => toast('Error', 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const decide = async (action) => {
    setActing(true)
    try {
      await adminReviewCreative(sel._id, action, reason)
      toast(action === 'approve' ? 'Creatividad aprobada y publicada' : 'Creatividad rechazada', action === 'approve' ? 'success' : 'error')
      setSel(null); setReason('')
      load()
    } catch (err) { toast(err?.message || 'Error', 'error') } finally { setActing(false) }
  }

  return (
    <div className="am-tab-body">
      {loading ? <div className="am-empty">Cargando…</div> : items.length === 0 ? (
        <div className="am-empty">{Icon.check}<p>No hay creatividades pendientes de revisión.</p></div>
      ) : (
        <div className="am-list">
          {items.map(c => (
            <div key={c._id} className="am-creative-row">
              <div className="am-creative-row__brand">
                <div className="am-creative-row__logo" style={{ background: c.brandId?.color || '#F0A500' }}>
                  {c.brandId?.logoInitials || '?'}
                </div>
                <span>{c.brandId?.name}</span>
              </div>
              <div className="am-creative-row__info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b>{c.name}</b>
                  {c.adId && <code className="am-app-code" title={c.internalCode || 'Código Interno'}>{c.adId}</code>}
                </div>
                <span>{c.format} · {c.mimeType}</span>
                {c.campaignId && <span>{Icon.bolt} {c.campaignId.name}</span>}
              </div>
              <span className="am-pnl-tag">{fmtDate(c.createdAt)}</span>
              <button className="am-btn am-btn--sm am-btn--primary" onClick={() => setSel(c)}>Revisar</button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {sel && (
          <motion.div className="am-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => e.target===e.currentTarget && setSel(null)}>
            <motion.div className="am-confirm" initial={{ y:20,opacity:0 }} animate={{ y:0,opacity:1 }}>
              <h3>Revisar creatividad</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
                <strong>{sel.name}</strong>
                {sel.adId && <code className="am-app-code" title={sel.internalCode || 'Código Interno'}>{sel.adId}</code>}
              </div>
              <p>de <strong>{sel.brandId?.name}</strong></p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{sel.format} · {sel.mimeType}</p>
              <div className="am-field">
                <label>Motivo de rechazo (solo si rechazas)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explica qué debe corregir…" />
              </div>
              <div className="am-confirm__actions">
                <button className="am-btn" onClick={() => { setSel(null); setReason('') }} disabled={acting}>Cancelar</button>
                <button className="am-btn am-btn--reject"  onClick={() => decide('reject')}  disabled={acting || !reason.trim()}>Rechazar</button>
                <button className="am-btn am-btn--approve" onClick={() => decide('approve')} disabled={acting}>{Icon.check} Aprobar y publicar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TAB: Enviar reporte ────────────────────────────────────────────────────────
function TabReports() {
  const [brands,   setBrands]   = useState([])
  const [selBrand, setSelBrand] = useState('')
  const [history,  setHistory]  = useState([])
  const [sending,  setSending]  = useState(false)
  const [form, setForm] = useState({ type: 'message', title: '', body: '', period: '', impressions: 0, clicks: 0, ctr: 0, reach: 0 })

  useEffect(() => {
    adminGetAllBrands().then(data => setBrands(data.filter(b => b.status === 'active'))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selBrand) { setHistory([]); return }
    adminGetBrandReports(selBrand).then(setHistory).catch(() => {})
  }, [selBrand])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSend = async (e) => {
    e.preventDefault()
    if (!selBrand) return toast('Selecciona una marca', 'error')
    setSending(true)
    try {
      const payload = {
        type:  form.type,
        title: form.title,
        body:  form.body,
        statsData: (form.type === 'stats' || form.type === 'alcance') ? {
          impressions: Number(form.impressions),
          clicks:      Number(form.clicks),
          ctr:         Number(form.ctr),
          reach:       Number(form.reach),
          period:      form.period,
        } : undefined,
      }
      await adminSendReport(selBrand, payload)
      toast('Reporte enviado a la marca', 'success')
      setForm({ type: 'message', title: '', body: '', period: '', impressions: 0, clicks: 0, ctr: 0, reach: 0 })
      adminGetBrandReports(selBrand).then(setHistory)
    } catch (err) { toast(err?.message || 'Error', 'error') } finally { setSending(false) }
  }

  return (
    <div className="am-tab-body am-reports">
      <div className="am-reports__layout">
        {/* Form */}
        <div className="am-reports__form-col">
          <h3 className="am-section-title">Enviar nuevo reporte</h3>
          <form onSubmit={handleSend} className="am-report-form">
            <div className="am-field">
              <label>Marca destinataria</label>
              <select value={selBrand} onChange={e => setSelBrand(e.target.value)} required>
                <option value="">Selecciona una marca…</option>
                {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>

            <div className="am-field-row">
              <div className="am-field">
                <label>Tipo</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="message">Mensaje</option>
                  <option value="stats">Estadísticas de campaña</option>
                  <option value="alcance">Reporte de alcance</option>
                  <option value="document">Documento PDF</option>
                </select>
              </div>
              <div className="am-field">
                <label>Título</label>
                <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej. Reporte junio 2026…" />
              </div>
            </div>

            {(form.type === 'stats' || form.type === 'alcance') && (
              <div className="am-report-stats">
                <div className="am-field">
                  <label>Período</label>
                  <input value={form.period} onChange={e => set('period', e.target.value)} placeholder="Ej. Junio 2026" />
                </div>
                <div className="am-field">
                  <label>Impresiones</label>
                  <input type="number" value={form.impressions} onChange={e => set('impressions', e.target.value)} min={0} />
                </div>
                <div className="am-field">
                  <label>Clics</label>
                  <input type="number" value={form.clicks} onChange={e => set('clicks', e.target.value)} min={0} />
                </div>
                <div className="am-field">
                  <label>CTR (%)</label>
                  <input type="number" value={form.ctr} onChange={e => set('ctr', e.target.value)} step="0.1" min={0} />
                </div>
                <div className="am-field">
                  <label>Alcance</label>
                  <input type="number" value={form.reach} onChange={e => set('reach', e.target.value)} min={0} />
                </div>
              </div>
            )}

            <div className="am-field">
              <label>Cuerpo del mensaje</label>
              <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={5}
                placeholder="Escribe el contenido del reporte o mensaje para la marca…" />
            </div>

            <button type="submit" className="am-btn am-btn--primary am-btn--full" disabled={sending || !selBrand || !form.title}>
              {sending ? 'Enviando…' : `${Icon.fileText} Enviar reporte`}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="am-reports__history-col">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 className="am-section-title" style={{ margin:0 }}>
              Reportes enviados
              {selBrand && brands.find(b => b._id === selBrand) && (
                <span className="am-section-title__sub"> · {brands.find(b => b._id === selBrand)?.name}</span>
              )}
            </h3>
            {selBrand && (
              <button className="am-btn am-btn--sm"
                onClick={async () => {
                  const brand = brands.find(b => b._id === selBrand)
                  if (!brand) return
                  try {
                    const { getCampaigns } = await import('../../../lib/brandApi.js')
                    const camps = await getCampaigns(selBrand)
                    await downloadBrandReportPdf(brand, camps)
                    toast('PDF generado', 'success')
                  } catch { toast('Error generando PDF', 'error') }
                }}>
                {Icon.download} PDF métricas
              </button>
            )}
          </div>
          {!selBrand ? (
            <div className="am-empty am-empty--sm">Selecciona una marca para ver su historial de reportes.</div>
          ) : history.length === 0 ? (
            <div className="am-empty am-empty--sm">Aún no hay reportes enviados a esta marca.</div>
          ) : (
            <div className="am-history-list">
              {history.map(r => (
                <div key={r._id} className="am-history-item">
                  <div className="am-history-item__top">
                    <span className={`am-type-badge am-type-badge--${r.type}`}>{r.type}</span>
                    {r.publicCode && <code className="am-report-code" title={r.internalCode}>{r.publicCode}</code>}
                    <span className="am-history-item__date">{fmtDate(r.createdAt)}</span>
                    {r.readAt && <span className="am-history-item__read">{Icon.check} Leído</span>}
                  </div>
                  <b>{r.title}</b>
                  {r.body && <p>{r.body.slice(0,80)}{r.body.length>80?'…':''}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── TAB: Soporte (Tickets) ───────────────────────────────────────────────────
function TabTickets() {
  const [tickets,   setTickets]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('open')
  const [sel,       setSel]       = useState(null)
  const [replyMsg,  setReplyMsg]  = useState('')
  const [acting,    setActing]    = useState(false)

  const load = useCallback((s) => {
    setLoading(true)
    adminGetTickets(s)
      .then(setTickets)
      .catch(() => toast('Error cargando tickets de soporte', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(filter) }, [filter, load])

  const handleOpenTicket = async (t) => {
    setSel(t)
    try {
      const detailed = await adminGetTicketDetail(t._id)
      setSel(detailed)
      load(filter)
    } catch {
      toast('Error al cargar detalle del ticket', 'error')
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyMsg.trim()) return
    setActing(true)
    try {
      const updated = await adminReplyTicket(sel._id, replyMsg.trim())
      setSel(updated)
      setReplyMsg('')
      load(filter)
      toast('Respuesta enviada', 'success')
    } catch {
      toast('Error al enviar respuesta', 'error')
    } finally {
      setActing(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setActing(true)
    try {
      const updated = await adminUpdateTicket(sel._id, { status: newStatus })
      setSel(updated)
      load(filter)
      toast(`Ticket marcado como ${newStatus === 'closed' ? 'cerrado' : 'abierto'}`, 'success')
    } catch {
      toast('Error al actualizar estado del ticket', 'error')
    } finally {
      setActing(false)
    }
  }

  const PRIORITY_LBL = { low: 'Baja', medium: 'Media', high: 'Alta' }
  const CATEGORY_LBL = { billing: 'Facturación', campaign: 'Campaña', technical: 'Técnico', creative: 'Creatividades', other: 'Otro' }

  return (
    <div className="am-tab-body">
      <div className="am-filters">
        {[['open','Abiertos'],['in_progress','En progreso'],['closed','Cerrados'],['all','Todos']].map(([k,l]) => (
          <button key={k} className={`am-chip ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="am-empty">Cargando…</div> : tickets.length === 0 ? (
        <div className="am-empty">{Icon.check}<p>No hay tickets {filter !== 'all' ? `en estado "${filter}"` : ''}.</p></div>
      ) : (
        <div className="am-list">
          {tickets.map(t => (
            <div key={t._id} className="am-campaign-row">
              <div className="am-creative-row__brand">
                <div className="am-creative-row__logo" style={{ background: t.brandId?.color || '#F0A500' }}>
                  {t.brandId?.logoInitials || '?'}
                </div>
                <span>{t.brandId?.name || 'Marca eliminada'}</span>
              </div>
              <div className="am-creative-row__info">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <b>{t.subject}</b>
                  {t.publicCode && <code className="am-report-code" title={t.internalCode}>{t.publicCode}</code>}
                </div>
                <span>Categoría: {CATEGORY_LBL[t.category] || t.category} · Prioridad: {PRIORITY_LBL[t.priority] || t.priority}</span>
                <span>Último cambio: {fmtDate(t.updatedAt)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {t.unreadByAdmin > 0 && <span className="am-tab__badge" style={{ position:'static' }}>{t.unreadByAdmin}</span>}
                <button className="am-btn am-btn--sm am-btn--primary" onClick={() => handleOpenTicket(t)}>Revisar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Chat Drawer */}
      <AnimatePresence>
        {sel && (
          <motion.div className="am-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => e.target===e.currentTarget && setSel(null)}>
            <motion.div className="am-drawer" initial={{ x:60,opacity:0 }} animate={{ x:0,opacity:1 }} exit={{ x:60,opacity:0 }}>
              <div className="am-drawer__head">
                <div>
                  <span className="bco-chat-drawer__pre">Ticket {sel.publicCode || '—'}</span>
                  <h3>{sel.subject}</h3>
                  <p style={{ fontSize:12, color:'var(--text-dim)', margin:0 }}>Marca: {sel.brandId?.name}</p>
                </div>
                <button className="am-close" onClick={() => setSel(null)}>{Icon.x}</button>
              </div>

              <div className="bco-chat-drawer__messages" style={{ maxHeight:'50vh' }}>
                {sel.messages?.map((m, idx) => (
                  <div key={idx} className={`bco-msg-bubble bco-msg-bubble--${m.author === 'admin' ? 'brand' : 'admin'}`} style={{ alignSelf: m.author === 'admin' ? 'flex-end' : 'flex-start' }}>
                    <div className="bco-msg-bubble__info">
                      <span>{m.author === 'admin' ? 'Tú (Soporte)' : 'Marca'}</span>
                      <span>{new Date(m.sentAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>

              <div className="am-drawer__body" style={{ borderTop:'1px solid var(--line)', gap:12 }}>
                <div style={{ display:'flex', gap:8, justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, color:'var(--text-dim)' }}>
                    Estado actual: <b style={{ color: sel.status === 'closed' ? 'var(--text-dim)' : 'var(--accent)' }}>
                      {{ open:'Abierto', in_progress:'En progreso', closed:'Cerrado' }[sel.status]}
                    </b>
                  </span>
                  <div style={{ display:'flex', gap:6 }}>
                    {sel.status !== 'closed' ? (
                      <button className="am-btn am-btn--sm am-btn--reject" onClick={() => handleStatusChange('closed')} disabled={acting}>
                        Cerrar ticket
                      </button>
                    ) : (
                      <button className="am-btn am-btn--sm am-btn--approve" onClick={() => handleStatusChange('in_progress')} disabled={acting}>
                        Reabrir ticket
                      </button>
                    )}
                  </div>
                </div>

                {sel.status !== 'closed' && (
                  <form onSubmit={handleReply} style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div className="am-field">
                      <textarea rows={3} value={replyMsg} onChange={e => setReplyMsg(e.target.value)} placeholder="Escribe la respuesta para la marca..." required disabled={acting} />
                    </div>
                    <button type="submit" className="am-btn am-btn--primary am-btn--full" disabled={acting || !replyMsg.trim()}>
                      {acting ? 'Enviando…' : `${Icon.send || Icon.check} Enviar respuesta`}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'apps',       label: 'Solicitudes',    icon: 'user' },
  { key: 'brands',     label: 'Marcas activas', icon: 'star' },
  { key: 'campaigns',  label: 'Campañas',       icon: 'bolt' },
  { key: 'creatives',  label: 'Creatividades',  icon: 'palette' },
  { key: 'reports',    label: 'Enviar reporte', icon: 'fileText' },
  { key: 'tickets',    label: 'Soporte',        icon: 'chat' },
]

export default function AdminMarcas() {
  const [tab, setTab] = useState('apps')
  const [counts, setCounts] = useState({ apps: 0, campaigns: 0, creatives: 0, tickets: 0 })

  useEffect(() => {
    Promise.allSettled([
      adminGetApplications('pending'),
      adminGetCampaigns('pending'),
      adminGetPendingCreatives(),
      adminGetTickets('open'),
    ]).then(([a, camp, c, t]) => setCounts({
      apps:      a.status    === 'fulfilled' ? a.value.length    : 0,
      campaigns: camp.status === 'fulfilled' ? camp.value.length : 0,
      creatives: c.status    === 'fulfilled' ? c.value.length    : 0,
      tickets:   t.status    === 'fulfilled' ? t.value.length    : 0,
    }))
  }, [tab])

  return (
    <div className="am-page">
      <div className="am-header">
        <div>
          <h2>{Icon.star} Centro de Marcas</h2>
          <p>Gestión unificada de solicitudes, marcas, creatividades y reportes</p>
        </div>
      </div>

      <div className="am-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`am-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {Icon[t.icon]} {t.label}
            {t.key === 'apps'      && counts.apps      > 0 && <span className="am-tab__badge">{counts.apps}</span>}
            {t.key === 'campaigns' && counts.campaigns > 0 && <span className="am-tab__badge">{counts.campaigns}</span>}
            {t.key === 'creatives' && counts.creatives > 0 && <span className="am-tab__badge">{counts.creatives}</span>}
            {t.key === 'tickets'   && counts.tickets   > 0 && <span className="am-tab__badge">{counts.tickets}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:.15 }}>
          {tab === 'apps'       && <TabApplications />}
          {tab === 'brands'     && <TabBrands />}
          {tab === 'campaigns'  && <TabCampaigns />}
          {tab === 'creatives'  && <TabCreatives />}
          {tab === 'reports'    && <TabReports />}
          {tab === 'tickets'    && <TabTickets />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

