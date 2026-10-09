import { useState, useEffect } from 'react'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { toast } from '../../../lib/toast.js'
import { getMyBrand, submitProfileChanges } from '../../../lib/brandApi.js'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import './BrandProfile.css'

const TIER_LABEL = { platinum: 'Platino', gold: 'Oro', silver: 'Plata' }
const TIER_COLOR = { platinum: '#00E676', gold: '#F3A800', silver: '#94a3b8' }

export default function BrandProfile() {
  const [brand,   setBrand]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState(null)
  const [dirty,   setDirty]   = useState(false)

  useEffect(() => {
    getMyBrand()
      .then(data => {
        setBrand(data.brand)
        setForm({
          logoInitials: data.brand.logoInitials || '',
          tagline:      data.brand.tagline      || '',
          website:      data.brand.website      || '',
          contactName:  data.brand.contactName  || '',
          contactEmail: data.brand.contactEmail || '',
          contactPhone: data.brand.contactPhone || '',
        })
      })
      .catch(() => toast('Error cargando datos de marca', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await submitProfileChanges(form)
      toast('Cambios enviados para revisión del administrador', 'success')
      setDirty(false)
    } catch (err) {
      toast(err?.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="bp-loading"><GGLoader label="Sincronizando marca" size="sm" /></div>
  if (!brand)  return <div className="bp-loading">No tienes una marca asignada.</div>

  const tc = TIER_COLOR[brand.tier] || 'var(--accent)'
  const hasPending = !!brand.pendingChanges?.submittedAt

  return (
    <div className="bp-page">
      <div className="pnl-head">
        <div>
          <h1>Mi Marca</h1>
          <p>Actualiza el perfil de tu marca. Los cambios son revisados por el equipo antes de publicarse.</p>
        </div>
      </div>

      {/* Brand identity card */}
      <div className="bp-identity bp-identity--role-id">
        <RoleIdentityCorner role="sponsor" profile={brand} isOwner />
        <div className="bp-identity__logo" style={{ background: brand.color }}>
          {brand.logoInitials || brand.name?.[0]}
        </div>
        <div className="bp-identity__info">
          <div className="bp-identity__name-row">
            <h2>{brand.name}</h2>
            <span className="bp-tier-badge" style={{ '--tc': tc }}>{TIER_LABEL[brand.tier]}</span>
            <span className={`bp-status bp-status--${brand.status}`}>
              {brand.status === 'active' ? 'Activa' : brand.status === 'pending' ? 'Pendiente' : 'Inactiva'}
            </span>
          </div>
          <p className="bp-identity__industry">{brand.industry}</p>
          <p className="bp-identity__code">{brand.code}</p>
        </div>
      </div>

      {hasPending && (
        <div className="bp-pending-notice">
          {Icon.clock}
          <span>Tienes cambios pendientes de aprobación enviados el {new Date(brand.pendingChanges.submittedAt).toLocaleDateString('es-DO')}. El equipo los revisará pronto.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bp-form">
        <div className="pnl-card">
          <div className="pnl-card__title">{Icon.user} Identidad de marca</div>
          <div className="bp-fields">
            <div className="bp-field">
              <label>Iniciales del logo</label>
              <input value={form.logoInitials} onChange={e => set('logoInitials', e.target.value)} maxLength={4} placeholder="Ej. HX, GG…" />
              <small>Se muestran cuando no hay imagen de logo disponible (máx. 4 caracteres)</small>
            </div>
            <div className="bp-field">
              <label>Slogan / tagline</label>
              <input value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Tu lema de marca" />
            </div>
            <div className="bp-field bp-field--full">
              <label>Sitio web</label>
              <input type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://tuempresa.com" />
            </div>
          </div>
        </div>

        <div className="pnl-card bp-form__card-gap">
          <div className="pnl-card__title">{Icon.chat} Datos de contacto</div>
          <div className="bp-fields">
            <div className="bp-field">
              <label>Nombre de contacto</label>
              <input value={form.contactName} onChange={e => set('contactName', e.target.value)} placeholder="Tu nombre" />
            </div>
            <div className="bp-field">
              <label>Correo electrónico</label>
              <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="hola@tuempresa.com" />
            </div>
            <div className="bp-field">
              <label>Teléfono</label>
              <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+1 000 000 0000" />
            </div>
          </div>
        </div>

        <div className="bp-form__footer">
          <p className="bp-form__note">
            {Icon.info} Los cambios son revisados por el administrador antes de actualizarse en la plataforma pública.
          </p>
          <button type="submit" className="pnl-btn pnl-btn--primary" disabled={!dirty || saving}>
            {saving ? 'Enviando…' : `${Icon.check} Enviar cambios para revisión`}
          </button>
        </div>
      </form>

      {/* Read-only info */}
      <div className="pnl-card bp-form__card-gap">
        <div className="pnl-card__title">{Icon.info} Información del plan</div>
        <div className="bp-readonly-grid">
          <div className="bp-readonly-item">
            <span>Plan</span>
            <b style={{ color: tc }}>{TIER_LABEL[brand.tier]}</b>
          </div>
          <div className="bp-readonly-item">
            <span>Código</span>
            <b>{brand.code}</b>
          </div>
          <div className="bp-readonly-item">
            <span>Industria</span>
            <b>{brand.industry}</b>
          </div>
          <div className="bp-readonly-item">
            <span>Miembro desde</span>
            <b>{brand.since ? new Date(brand.since).toLocaleDateString('es-DO', { year: 'numeric', month: 'long' }) : '—'}</b>
          </div>
        </div>
        <p className="bp-readonly-note">Para cambiar el plan o la industria, contacta al equipo desde la sección de soporte.</p>
      </div>
    </div>
  )
}

