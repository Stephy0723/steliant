import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { AD_INVENTORY, AVAILABILITY_LABEL } from '../../../data/brandStats.js'
import { getMyBrand, getSponsorableTourneys, createCampaign } from '../../../lib/brandApi.js'
import '../BrandCampaigns/BrandCampaigns.css'
import './BrandInventory.css'

function ReserveModal({ item, brandId, tourneys, onClose, onReserved }) {
  const [form, setForm] = useState({
    name:         `${item.name} — ${new Date().toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}`,
    description:  item.desc,
    linkUrl:      '',
    budget:       item.price > 0 ? String(item.price) : '',
    tournamentId: '',
    startDate:    '',
    endDate:      '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const created = await createCampaign(brandId, {
        name:         form.name.trim(),
        description:  form.description,
        placement:    item.id,
        imageUrl:     '',
        linkUrl:      form.linkUrl,
        budget:       form.budget ? Number(form.budget) : 0,
        tournamentId: form.tournamentId || null,
        startDate:    form.startDate || null,
        endDate:      form.endDate   || null,
      })
      onReserved(created)
    } catch (err) {
      setError(err.message || 'Error al reservar')
      setSaving(false)
    }
  }

  return (
    <motion.div className="bc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.form className="bi-reserve-modal" onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: .95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }}>

        <div className="bc-modal__head">
          <div>
            <h3>Reservar: {item.name}</h3>
            <p>Alcance estimado: <b>{item.reach}</b> · {item.price > 0 ? `$${item.price.toLocaleString()}/${item.unit}` : 'Precio a medida'}</p>
          </div>
          <button type="button" onClick={onClose}>{Icon.x}</button>
        </div>

        <label className="bc-field">
          <span>Nombre de la campaña *</span>
          <input value={form.name} onChange={e => set('name', e.target.value)} required />
        </label>

        <label className="bc-field">
          <span>Descripción / objetivo</span>
          <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </label>

        {item.id === 'bracket' || item.id === 'stream-overlay' ? (
          <label className="bc-field">
            <span>Torneo vinculado</span>
            <select value={form.tournamentId} onChange={e => set('tournamentId', e.target.value)}>
              <option value="">— Sin torneo específico —</option>
              {tourneys.map(t => (
                <option key={t._id} value={t._id}>{t.title} · {t.game}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="bc-field-row">
          <label className="bc-field">
            <span>Presupuesto (USD)</span>
            <input type="number" min="0" value={form.budget} onChange={e => set('budget', e.target.value)}
              placeholder={item.price > 0 ? String(item.price) : '0'} />
          </label>
          <label className="bc-field">
            <span>Inicio</span>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </label>
          <label className="bc-field">
            <span>Fin</span>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
          </label>
        </div>

        <label className="bc-field">
          <span>Link de destino</span>
          <input type="url" value={form.linkUrl} onChange={e => set('linkUrl', e.target.value)}
            placeholder="https://tu-sitio.com/landing" />
        </label>

        {error && <p className="bc-error">{error}</p>}

        <div className="bc-modal__foot">
          <button type="button" className="pnl-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pnl-btn pnl-btn--primary" disabled={saving}>
            {saving ? 'Enviando…' : <>{Icon.send} Reservar y enviar</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

export default function BrandInventory() {
  const navigate = useNavigate()
  const [brandId,   setBrandId]   = useState(null)
  const [tourneys,  setTourneys]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [reserving, setReserving] = useState(null)
  const [toast,     setToast]     = useState('')
  const [noBrand,   setNoBrand]   = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 5000) }

  useEffect(() => {
    let alive = true
    Promise.all([getMyBrand(), getSponsorableTourneys()])
      .then(([d, t]) => {
        if (!alive) return
        setBrandId(d.brand._id)
        setTourneys(Array.isArray(t) ? t : [])
      })
      .catch(() => { if (alive) setNoBrand(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const handleReserved = (campaign) => {
    setReserving(null)
    showToast(`Campaña "${campaign.name}" enviada a revisión. Nuestro equipo la activará en 24-48h.`)
  }

  if (loading) return <div className="pnl-empty"><GGLoader label="Sincronizando inventario" size="sm" /></div>
  if (noBrand) return <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.layoutGrid}</div><h3>Sin marca asignada</h3></div>

  return (
    <div>
      <div className="pnl-head">
        <div>
          <h1>Inventario publicitario</h1>
          <p>Espacios disponibles dentro del ecosistema GlitchGang. Reserva y activa en 24-48h.</p>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="bc-sent" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {Icon.check} {toast}
            <button className="pnl-link" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => navigate('/marca/campanas')}>
              Ver campañas →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bi-grid">
        {AD_INVENTORY.map((a, i) => {
          const sold = a.availability === 'soldout'
          const limited = a.availability === 'limited'
          return (
            <motion.div
              key={a.id} className={`bi-card ${sold ? 'sold' : ''}`}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            >
              <div className="bi-card__top">
                <span className="bi-card__icon">{Icon[a.icon] || Icon.bolt}</span>
                <span className={`pnl-tag ${a.availability === 'available' ? 'pnl-tag--ok' : limited ? 'pnl-tag--warn' : ''}`}>
                  {AVAILABILITY_LABEL[a.availability]}
                </span>
              </div>
              <h3>{a.name}</h3>
              <p className="bi-card__desc">{a.desc}</p>
              <div className="bi-card__reach">{Icon.eye} Alcance estimado: <b>{a.reach}</b></div>
              <div className="bi-card__foot">
                <div className="bi-card__price">
                  {a.price > 0
                    ? <><strong>${a.price.toLocaleString()}</strong><span>/ {a.unit}</span></>
                    : <strong>A medida</strong>
                  }
                </div>
                <button
                  className="pnl-btn pnl-btn--primary bi-card__btn"
                  disabled={sold}
                  onClick={() => !sold && setReserving(a)}
                >
                  {sold ? 'Agotado' : limited ? 'Reservar plaza' : 'Reservar'}
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Torneos próximos como oportunidad */}
      {tourneys.length > 0 && (
        <div className="pnl-card pnl-section-gap">
          <div className="pnl-card__title">
            {Icon.trophy} Torneos próximos — oportunidades de patrocinio
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>
              Vincúlate a un torneo al reservar un espacio de bracket u overlay
            </span>
          </div>
          <div className="bd-tourneys">
            {tourneys.map(t => (
              <div key={t._id} className="bd-tourney">
                <div className="bd-tourney__info">
                  <b>{t.title}</b>
                  <small>
                    {t.game} · {t.startDate || 'Fecha por confirmar'}
                    {t.capacity ? ` · ${t.registered || 0}/${t.capacity} participantes` : ''}
                    {t.prizePool ? ` · $${t.prizePool.toLocaleString()} en premios` : ''}
                  </small>
                </div>
                <div className="bd-tourney__right">
                  <span className={`pnl-tag ${t.status === 'live' ? 'pnl-tag--ok' : 'pnl-tag--accent'}`}>
                    {t.status === 'live' ? '● EN VIVO' : 'Próximo'}
                  </span>
                  <button className="pnl-btn pnl-btn--primary" style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={() => setReserving(AD_INVENTORY.find(a => a.id === 'bracket'))}>
                    Patrocinar bracket
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bi-note">
        {Icon.lightbulb}
        <div>
          <b>¿Buscas una activación a medida?</b>
          <p>Combinamos varios espacios y creadores en un paquete adaptado a tus objetivos. Escríbenos.</p>
        </div>
        <button className="pnl-btn" onClick={() => navigate('/marca/contacto')}>{Icon.send} Contactar</button>
      </div>

      <AnimatePresence>
        {reserving && brandId && (
          <ReserveModal
            item={reserving}
            brandId={brandId}
            tourneys={tourneys}
            onClose={() => setReserving(null)}
            onReserved={handleReserved}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

