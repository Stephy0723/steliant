import { useEffect, useState } from 'react'
import { safeHref } from '../../../lib/safeUrl.js'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import {
  getMyBrand,
  getCampaigns, createCampaign, deleteCampaign,
  submitCampaignForReview,
  getCreatives, linkCreativeToCampaign, unlinkCreativeFromCampaign,
  submitPaymentProof,
} from '../../../lib/brandApi.js'
import './BrandCampaigns.css'

const FILTERS = [
  { key: 'all',      label: 'Todas' },
  { key: 'draft',    label: 'Borrador' },
  { key: 'pending',  label: 'En revisión' },
  { key: 'active',   label: 'Activa' },
  { key: 'expired',  label: 'Expirada' },
  { key: 'rejected', label: 'Rechazada' },
]

const STATUS_LABEL = {
  draft: 'Borrador', pending: 'En revisión', active: 'Activa',
  expired: 'Expirada', rejected: 'Rechazada', archived: 'Archivada',
}
const STATUS_TAG = {
  draft: '', pending: 'pnl-tag--warn', active: 'pnl-tag--ok',
  expired: '', rejected: 'pnl-tag--live',
}
const STATUS_BAR = {
  draft: 'var(--panel-accent)', pending: '#f59e0b',
  active: '#22c55e', expired: '#64748b', rejected: '#ef4444',
}

const AD_TYPE_OPTS = [
  { value: '',         label: '— Tipo de anuncio —' },
  { value: 'banner',   label: 'Banner principal' },
  { value: 'strip',    label: 'Strip de torneo' },
  { value: 'floating', label: 'Floating / Toast' },
]
const AD_TYPE_LABEL = { banner: 'Banner', strip: 'Strip torneo', floating: 'Floating' }

const PROOF_TYPE_OPTS = [
  { value: 'transfer', label: 'Transferencia bancaria' },
  { value: 'card',     label: 'Tarjeta de crédito/débito' },
  { value: 'cash',     label: 'Efectivo' },
  { value: 'other',    label: 'Otro método' },
]
const PAY_STATUS_CLASS  = { pending: 'bc-payment__status--pending', verified: 'bc-payment__status--verified', rejected: 'bc-payment__status--rejected' }
const PAY_STATUS_LABEL  = { pending: 'Pago en verificación',        verified: 'Pago verificado',              rejected: 'Pago rechazado' }

/* ── Gallery Picker ─────────────────────────────────────────────────────────── */
function GalleryPicker({ creatives, onLink, onClose }) {
  const [sel,     setSel]     = useState(null)
  const [adType,  setAdType]  = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linking, setLinking] = useState(false)

  async function handleLink() {
    if (!sel || !adType) return
    setLinking(true)
    try { await onLink(sel, adType, linkUrl) }
    finally { setLinking(false) }
  }

  return (
    <div className="bc-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="bc-modal bc-picker"
        initial={{ opacity: 0, scale: .96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }}
        onClick={e => e.stopPropagation()}>

        <div className="bc-modal__head">
          <h3>Seleccionar creatividad</h3>
          <button className="bc-modal__close" onClick={onClose}>{Icon.x}</button>
        </div>
        <p className="bc-picker__hint">Se muestran creatividades aprobadas o en revisión, aún no vinculadas.</p>

        {creatives.length === 0 ? (
          <div className="bc-creatives-empty">
            Sin creatividades disponibles — súbelas en la sección Creatividades.
          </div>
        ) : (
          <div className="bc-gallery-grid">
            {creatives.map(cr => (
              <div key={cr._id} className={`bc-gallery-item ${sel?._id === cr._id ? 'selected' : ''}`}
                onClick={() => setSel(cr)}>
                {cr.imageUrl
                  ? <img src={cr.imageUrl} alt={cr.name} className="bc-gallery-item__img" />
                  : <div className="bc-gallery-item__placeholder">{Icon.camera}</div>
                }
                <p className="bc-gallery-item__name">{cr.name}</p>
                {cr.format && <span className="bc-gallery-item__format">{cr.format}</span>}
              </div>
            ))}
          </div>
        )}

        {sel && (
          <div className="bc-picker-form">
            <p className="bc-picker-form__title">Configurar "{sel.name}"</p>
            <label className="bc-field">
              <span>Tipo de anuncio *</span>
              <select value={adType} onChange={e => setAdType(e.target.value)}>
                {AD_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="bc-field">
              <span>URL de destino</span>
              <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://tu-sitio.com/landing" />
            </label>
          </div>
        )}

        <div className="bc-modal__foot">
          <button className="pnl-btn" onClick={onClose}>Cancelar</button>
          <button className="pnl-btn pnl-btn--primary" disabled={!sel || !adType || linking} onClick={handleLink}>
            {linking ? 'Vinculando…' : 'Vincular arte'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* ── Campaign Detail ─────────────────────────────────────────────────────────── */
function CampaignDetail({ initCampaign, brand, allCreatives, onBack, onUpdated, onDeleted, showToast }) {
  const [camp,       setCamp]       = useState(initCampaign)
  const [subTab,     setSubTab]     = useState('creatives')
  const [showPicker, setShowPicker] = useState(false)
  const [showDel,    setShowDel]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [payForm,    setPayForm]    = useState({
    amount:    String(initCampaign.budget || ''),
    proofType: 'transfer',
    proofUrl:  '',
    brandNotes: '',
  })
  const [payLoading, setPayLoading] = useState(false)

  const canEdit = ['draft', 'rejected'].includes(camp.status)
  const availableCreatives = allCreatives.filter(c => ['approved', 'review'].includes(c.status) && !c.campaignId)
  const hasValidCreative   = (camp.creatives || []).some(c => c.adType)
  const hasPayment         = !!camp.payment?.status
  const canSubmit          = canEdit && hasValidCreative && hasPayment

  async function handleLink(creative, adType, linkUrl) {
    try {
      await linkCreativeToCampaign(brand._id, creative._id, { campaignId: camp._id, adType, linkUrl })
      setCamp(c => ({ ...c, creatives: [...(c.creatives || []), { ...creative, adType, linkUrl, campaignId: camp._id }] }))
      setShowPicker(false)
      showToast('Arte vinculado a la campaña')
    } catch (e) { showToast(`Error: ${e.message}`) }
  }

  async function handleUnlink(crid) {
    try {
      await unlinkCreativeFromCampaign(brand._id, crid)
      setCamp(c => ({ ...c, creatives: (c.creatives || []).filter(cr => cr._id !== crid) }))
      showToast('Arte desvinculado')
    } catch (e) { showToast(`Error: ${e.message}`) }
  }

  async function handlePaySubmit(e) {
    e.preventDefault()
    if (!payForm.proofUrl.trim()) { showToast('La URL del comprobante es requerida'); return }
    setPayLoading(true)
    try {
      const result = await submitPaymentProof(brand._id, camp._id, {
        amount:     Number(payForm.amount) || camp.budget || 0,
        proofType:  payForm.proofType,
        proofUrl:   payForm.proofUrl.trim(),
        brandNotes: payForm.brandNotes,
      })
      const invoiceNumber = result?.invoice?.invoiceNumber || ''
      setCamp(c => ({ ...c, payment: { status: 'pending', proofUrl: payForm.proofUrl, proofType: payForm.proofType, amount: Number(payForm.amount), invoiceNumber } }))
      showToast(`Comprobante registrado${invoiceNumber ? ` · ${invoiceNumber}` : ''}`)
    } catch (e) { showToast(`Error: ${e.message}`) }
    finally { setPayLoading(false) }
  }

  async function handleSubmitForReview() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await submitCampaignForReview(brand._id, camp._id)
      setCamp(c => ({ ...c, status: 'pending', rejectionReason: '' }))
      onUpdated({ ...camp, status: 'pending', rejectionReason: '' })
      showToast('Campaña enviada a revisión · Respuesta en 24-48h')
    } catch (e) { showToast(`Error: ${e.message}`) }
    finally { setSubmitting(false) }
  }

  async function handleDelete() {
    try {
      await deleteCampaign(brand._id, camp._id)
      onDeleted(camp._id)
      showToast('Campaña eliminada')
    } catch (e) { showToast(`Error: ${e.message}`) }
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : null
  const ctr = camp.impressions > 0 ? (camp.clicks / camp.impressions * 100).toFixed(1) : '—'

  return (
    <div className="bc-detail">
      {/* Back + title */}
      <div className="bc-detail__header">
        <button className="bc-back" onClick={onBack}>← Campañas</button>
        <div className="bc-detail__title-row">
          <h2>{camp.name}</h2>
          <span className={`pnl-tag ${STATUS_TAG[camp.status] || ''}`}>{STATUS_LABEL[camp.status]}</span>
          {canEdit && (
            <button className="pnl-btn bc-card__del" style={{ padding: '6px 10px' }} onClick={() => setShowDel(true)}>
              {Icon.trash}
            </button>
          )}
        </div>
        <div className="bc-detail__meta">
          {fmtDate(camp.startDate) && (
            <span>{fmtDate(camp.startDate)} – {fmtDate(camp.endDate) || '?'}</span>
          )}
          {camp.budget > 0 && <span>${camp.budget.toLocaleString()} USD</span>}
          {camp.objective && <span>{camp.objective}</span>}
        </div>
      </div>

      {/* Rejection alert */}
      {camp.status === 'rejected' && camp.rejectionReason && (
        <div className="bc-alert bc-alert--red">
          {Icon.alert} <span><strong>Rechazada:</strong> {camp.rejectionReason}</span>
        </div>
      )}

      {/* Metrics (active / expired only) */}
      {['active', 'expired'].includes(camp.status) && (
        <div className="bc-metrics">
          <div><span>Impresiones</span><b>{(camp.impressions || 0).toLocaleString()}</b></div>
          <div><span>Clicks</span><b>{(camp.clicks || 0).toLocaleString()}</b></div>
          <div><span>CTR</span><b>{ctr}{ctr !== '—' ? '%' : ''}</b></div>
          <div><span>Creatividades</span><b>{camp.creatives?.length || 0}</b></div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="bc-detail__tabs">
        <button className={`bc-detail__tab ${subTab === 'creatives' ? 'active' : ''}`} onClick={() => setSubTab('creatives')}>
          Creatividades {camp.creatives?.length > 0 && <span className="bc-chip__count">{camp.creatives.length}</span>}
        </button>
        <button className={`bc-detail__tab ${subTab === 'payment' ? 'active' : ''}`} onClick={() => setSubTab('payment')}>
          Pago / Facturación {camp.payment?.status && <span className={`bc-chip__count ${PAY_STATUS_CLASS[camp.payment.status] || ''}`}>·</span>}
        </button>
      </div>

      <div className="bc-detail__content">
        {/* ── Creatividades tab ──────────────────────────────────── */}
        {subTab === 'creatives' && (
          <>
            {(camp.creatives || []).length === 0 ? (
              <div className="bc-creatives-empty">
                Aún no hay artes vinculados. Vincula al menos uno para enviar la campaña a revisión.
              </div>
            ) : (
              <div className="bc-creatives-list">
                {(camp.creatives || []).map(cr => (
                  <div key={cr._id} className="bc-creative-row">
                    <div className="bc-creative-row__thumb">
                      {cr.imageUrl ? <img src={cr.imageUrl} alt={cr.name} /> : Icon.camera}
                    </div>
                    <div className="bc-creative-row__info">
                      <p className="bc-creative-row__name">{cr.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {cr.adType && <span className="bc-creative-row__type">{AD_TYPE_LABEL[cr.adType] || cr.adType}</span>}
                        {cr.format && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cr.format}</span>}
                      </div>
                      {cr.linkUrl && <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0', wordBreak: 'break-all' }}>{cr.linkUrl}</p>}
                    </div>
                    {canEdit && (
                      <button className="pnl-btn bc-card__del" style={{ padding: '6px 10px', alignSelf: 'flex-start' }}
                        title="Desvincular" onClick={() => handleUnlink(cr._id)}>
                        {Icon.trash}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <button className="pnl-btn" onClick={() => setShowPicker(true)}>
                {Icon.plus} Vincular arte de la galería
              </button>
            )}

            <AnimatePresence>
              {showPicker && (
                <GalleryPicker
                  creatives={availableCreatives}
                  onLink={handleLink}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── Pago tab ───────────────────────────────────────────── */}
        {subTab === 'payment' && (
          <div className="bc-payment">
            {camp.payment?.status && (
              <>
                <div className={`bc-payment__status ${PAY_STATUS_CLASS[camp.payment.status] || ''}`}>
                  {camp.payment.status === 'verified' ? Icon.check : camp.payment.status === 'rejected' ? Icon.alert : Icon.clock}
                  {PAY_STATUS_LABEL[camp.payment.status]}
                </div>
                <div className="bc-payment__detail">
                  {camp.payment.invoiceNumber && (
                    <p>Factura: <b><code>{camp.payment.invoiceNumber}</code></b></p>
                  )}
                  {camp.payment.amount > 0 && (
                    <p>Monto: <b>${camp.payment.amount.toLocaleString()} {camp.payment.currency || 'USD'}</b></p>
                  )}
                  {camp.payment.proofType && (
                    <p>Método: <b>{PROOF_TYPE_OPTS.find(o => o.value === camp.payment.proofType)?.label || camp.payment.proofType}</b></p>
                  )}
                  {camp.payment.proofUrl && (
                    <p>Comprobante: <a href={safeHref(camp.payment.proofUrl)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--panel-accent)' }}>Ver enlace</a></p>
                  )}
                  {camp.payment.rejectedReason && (
                    <p style={{ color: '#ef4444' }}>Motivo rechazo: {camp.payment.rejectedReason}</p>
                  )}
                </div>
              </>
            )}

            {/* Show form if no payment yet OR if payment was rejected and campaign is still editable */}
            {canEdit && (!camp.payment?.status || camp.payment?.status === 'rejected') && (
              <form className="bc-payment__form" onSubmit={handlePaySubmit}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, fontFamily: 'var(--font-display)' }}>
                  {camp.payment?.status === 'rejected' ? 'Reenviar comprobante' : 'Registrar comprobante de pago'}
                </h4>
                <div className="bc-field-row">
                  <label className="bc-field">
                    <span>Monto (USD)</span>
                    <input type="number" min="0" value={payForm.amount}
                      onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder={String(camp.budget || '0')} />
                  </label>
                  <label className="bc-field">
                    <span>Método de pago</span>
                    <select value={payForm.proofType}
                      onChange={e => setPayForm(f => ({ ...f, proofType: e.target.value }))}>
                      {PROOF_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="bc-field">
                  <span>URL del comprobante *</span>
                  <input type="url" value={payForm.proofUrl}
                    onChange={e => setPayForm(f => ({ ...f, proofUrl: e.target.value }))}
                    placeholder="https://drive.google.com/..." required />
                </label>
                <label className="bc-field">
                  <span>Notas (opcional)</span>
                  <textarea rows={2} value={payForm.brandNotes}
                    onChange={e => setPayForm(f => ({ ...f, brandNotes: e.target.value }))}
                    placeholder="Referencia de la transferencia, banco emisor…" />
                </label>
                <div>
                  <button type="submit" className="pnl-btn pnl-btn--primary" disabled={payLoading}>
                    {payLoading ? 'Registrando…' : <>{Icon.upload} Registrar pago</>}
                  </button>
                </div>
              </form>
            )}

            {!canEdit && !camp.payment?.status && (
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No se registró comprobante de pago antes de enviar a revisión.</p>
            )}
          </div>
        )}
      </div>

      {/* Submit bar */}
      {canEdit && (
        <div className="bc-submit-bar">
          <div className="bc-submit-bar__hints">
            <span className={`bc-hint ${hasValidCreative ? 'bc-hint--ok' : 'bc-hint--pending'}`}>
              {hasValidCreative ? Icon.check : Icon.clock} Arte vinculado
            </span>
            <span className={`bc-hint ${hasPayment ? 'bc-hint--ok' : 'bc-hint--pending'}`}>
              {hasPayment ? Icon.check : Icon.clock} Pago registrado
            </span>
          </div>
          <button className="pnl-btn pnl-btn--primary" onClick={handleSubmitForReview}
            disabled={!canSubmit || submitting}
            title={canSubmit ? '' : 'Necesitas al menos un arte vinculado con tipo + comprobante de pago'}>
            {submitting ? 'Enviando…' : <>{Icon.send} Enviar a revisión</>}
          </button>
        </div>
      )}
      {camp.status === 'pending' && (
        <div className="bc-submit-bar bc-submit-bar--warn">
          {Icon.clock} Campaña en revisión — el equipo GG responderá en 24-48 horas
        </div>
      )}
      {camp.status === 'active' && (
        <div className="bc-submit-bar bc-submit-bar--ok">
          {Icon.check} Campaña activa — tus anuncios están publicados en la plataforma
        </div>
      )}
      {camp.status === 'expired' && (
        <div className="bc-submit-bar">
          {Icon.calendar} Campaña finalizada — revisa el reporte en la sección Reportes
        </div>
      )}

      {/* Delete confirm */}
      <AnimatePresence>
        {showDel && (
          <motion.div className="bc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowDel(false)}>
            <motion.div className="bc-modal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              onClick={e => e.stopPropagation()}>
              <div className="bc-modal__head"><h3>Eliminar campaña</h3></div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>
                Esta acción no se puede deshacer. Se eliminarán los datos de la campaña y sus vínculos.
              </p>
              <div className="bc-modal__foot">
                <button className="pnl-btn" onClick={() => setShowDel(false)}>Cancelar</button>
                <button className="pnl-btn pnl-btn--danger" onClick={handleDelete}>Eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── New Campaign Modal ──────────────────────────────────────────────────────── */
function NewCampaignModal({ brandId, onClose, onCreated }) {
  const [form,   setForm]   = useState({ name: '', objective: '', budget: '', startDate: '', endDate: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const camp = await createCampaign(brandId, {
        name:      form.name.trim(),
        objective: form.objective,
        budget:    form.budget ? Number(form.budget) : 0,
        startDate: form.startDate || null,
        endDate:   form.endDate   || null,
      })
      onCreated(camp)
    } catch (err) {
      setError(err.message || 'Error al crear campaña')
      setSaving(false)
    }
  }

  return (
    <motion.div className="bc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.form className="bc-modal" onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: .95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }}>

        <div className="bc-modal__head">
          <div>
            <h3>Nueva campaña</h3>
            <p>Crea el contrato. Después vinculas los artes y el pago.</p>
          </div>
          <button type="button" className="bc-modal__close" onClick={onClose}>{Icon.x}</button>
        </div>

        <label className="bc-field">
          <span>Nombre de la campaña *</span>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Ej. NPC Latino - Cobertura 2026" autoFocus required />
        </label>

        <label className="bc-field">
          <span>Objetivo / descripción</span>
          <textarea rows={2} value={form.objective} onChange={e => set('objective', e.target.value)}
            placeholder="Reconocimiento de marca, lanzamiento de producto…" />
        </label>

        <div className="bc-field-row">
          <label className="bc-field">
            <span>Presupuesto (USD)</span>
            <input type="number" min="0" value={form.budget}
              onChange={e => set('budget', e.target.value)} placeholder="0" />
          </label>
          <label className="bc-field">
            <span>Fecha de inicio</span>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </label>
          <label className="bc-field">
            <span>Fecha de fin</span>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
          </label>
        </div>

        {error && <p className="bc-error">{error}</p>}

        <div className="bc-modal__foot">
          <button type="button" className="pnl-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pnl-btn pnl-btn--primary" disabled={saving}>
            {saving ? 'Creando…' : <>{Icon.plus} Crear campaña</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
export default function BrandCampaigns() {
  const [filter,       setFilter]       = useState('all')
  const [campaigns,    setCampaigns]    = useState([])
  const [allCreatives, setAllCreatives] = useState([])
  const [brand,        setBrand]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [selCamp,      setSelCamp]      = useState(null)
  const [showNew,      setShowNew]      = useState(false)
  const [toast,        setToast]        = useState('')
  const [noBrand,      setNoBrand]      = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    let alive = true
    getMyBrand()
      .then(async d => {
        if (!alive) return
        const b = d.brand
        setBrand(b)
        const [camps, creatives] = await Promise.all([
          getCampaigns(b._id),
          getCreatives(b._id),
        ])
        if (!alive) return
        setCampaigns(Array.isArray(camps) ? camps : [])
        setAllCreatives(Array.isArray(creatives) ? creatives : [])
      })
      .catch(() => { if (alive) setNoBrand(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const handleCreated = camp => {
    setCampaigns(prev => [camp, ...prev])
    setShowNew(false)
    setSelCamp({ ...camp, creatives: [] })
    showToast('Campaña creada — vincula tus artes y registra el pago')
  }

  const handleUpdated = updated => {
    setCampaigns(prev => prev.map(c => c._id === updated._id ? { ...c, ...updated } : c))
  }

  const handleDeleted = cid => {
    setCampaigns(prev => prev.filter(c => c._id !== cid))
    setSelCamp(null)
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)

  if (loading) return (
    <div className="pnl-empty">
      <GGLoader label="Sincronizando campanas" size="sm" />
    </div>
  )
  if (noBrand) return (
    <div className="pnl-empty">
      <div className="pnl-empty__icon">{Icon.bolt}</div>
      <h3>Sin marca asignada</h3>
      <p>Contacta con el equipo GlitchGang.</p>
    </div>
  )

  /* Detail view */
  if (selCamp) {
    return (
      <>
        <AnimatePresence>
          {toast && (
            <motion.div className="bc-sent" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {Icon.check} {toast}
            </motion.div>
          )}
        </AnimatePresence>
        <CampaignDetail
          key={selCamp._id}
          initCampaign={selCamp}
          brand={brand}
          allCreatives={allCreatives}
          onBack={() => setSelCamp(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          showToast={showToast}
        />
      </>
    )
  }

  /* List view */
  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Campañas</h1>
          <p>Gestiona tus contratos publicitarios con GlitchGang.</p>
        </div>
        <button className="pnl-btn pnl-btn--primary" onClick={() => setShowNew(true)}>
          {Icon.plus} Nueva campaña
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="bc-sent" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {Icon.check} {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bc-filters">
        {FILTERS.map(f => {
          const count = f.key === 'all' ? campaigns.length : campaigns.filter(c => c.status === f.key).length
          return (
            <button key={f.key} className={`bc-chip ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}>
              {f.label}{count > 0 && <span className="bc-chip__count">{count}</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="pnl-empty">
          <div className="pnl-empty__icon">{Icon.bolt}</div>
          <h3>{filter === 'all' ? 'Sin campañas todavía' : `Sin campañas "${FILTERS.find(f => f.key === filter)?.label}"`}</h3>
          <p>{filter === 'all' ? 'Crea tu primera campaña y empieza a llegar a la comunidad gaming.' : 'Prueba otro filtro o crea una nueva campaña.'}</p>
          {filter === 'all' && (
            <button className="pnl-btn pnl-btn--primary" onClick={() => setShowNew(true)}>
              {Icon.plus} Crear campaña
            </button>
          )}
        </div>
      ) : (
        <div className="bc-list">
          {filtered.map(c => (
            <motion.div key={c._id} className={`bc-card ${c.status === 'pending' ? 'bc-card--pending' : ''}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelCamp(c)} style={{ cursor: 'pointer' }}>
              <div className="bc-card__bar" style={{ background: STATUS_BAR[c.status] || 'var(--panel-accent)' }} />
              <div className="bc-card__main">
                <div className="bc-card__head">
                  <h3>{c.name}</h3>
                  <span className={`pnl-tag ${STATUS_TAG[c.status] || ''}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                <div className="bc-card__metrics">
                  {c.creatives?.length > 0 && <div><span>Artes</span><b>{c.creatives.length}</b></div>}
                  {c.impressions > 0 && <div><span>Impresiones</span><b>{c.impressions.toLocaleString()}</b></div>}
                  {c.budget > 0 && <div><span>Presupuesto</span><b>${c.budget.toLocaleString()}</b></div>}
                  {(c.startDate || c.endDate) && (
                    <div><span>Período</span><b>
                      {c.startDate ? new Date(c.startDate).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' }) : '?'}
                      {' – '}
                      {c.endDate ? new Date(c.endDate).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' }) : '?'}
                    </b></div>
                  )}
                </div>
                {c.status === 'pending' && (
                  <p className="bc-card__note">{Icon.clock} En revisión — 24-48h</p>
                )}
                {c.status === 'rejected' && c.rejectionReason && (
                  <p className="bc-card__note bc-card__note--red">{Icon.alert} {c.rejectionReason}</p>
                )}
                {c.status === 'draft' && (!c.creatives?.length || !c.payment?.status) && (
                  <p className="bc-card__note">
                    {!c.creatives?.length && '⚠ Sin artes  '}
                    {!c.payment?.status && '⚠ Sin pago'}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', paddingLeft: 6 }}>
                {Icon.chevronRight}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNew && brand && (
          <NewCampaignModal
            brandId={brand._id}
            onClose={() => setShowNew(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

