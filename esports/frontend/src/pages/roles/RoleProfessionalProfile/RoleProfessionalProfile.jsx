import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import ProfileCompletionBanner from '../../../components/ProfileCompletionBanner/ProfileCompletionBanner.jsx'
import RoleFieldInput, { ExperienceSection } from '../../../components/RoleFieldInput/RoleFieldInput.jsx'
import RoleProfileCard from '../../../components/RoleProfileCard/RoleProfileCard.jsx'
import ShowcaseToggle from '../../../components/RoleProfileCard/ShowcaseToggle.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { PLATFORM_ROLES } from '../../../data/roleApplications.js'
import { missingProfileFields } from '../../../lib/roleProfileCompleteness.js'
import './RoleProfessionalProfile.css'

// Perfil profesional de un rol especializado (caster, analista, ...): lo que
// ven los organizadores en el buscador de staff y lo que respalda una
// postulacion a un torneo. Mismo endpoint que Coach y Moderador:
// PATCH /profile/me con `role` + `professionalProfile`. Los campos vienen de
// data/roleApplications.js y se dibujan con RoleFieldInput -- los mismos que
// la solicitud de rol. A un lado se ve la TARJETA profesional en vivo (la
// misma tarjeta del perfil de jugador), que se puede mostrar en /perfil.
export default function RoleProfessionalProfile({ role, embedded = false }) {
  const { user, updateUser } = useAuth()
  const meta = useMemo(() => PLATFORM_ROLES.find(r => r.id === role), [role])
  const [details, setDetails] = useState(() => ({ ...(user?.roleProfiles?.[role]?.details || {}) }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (!meta?.profileFields) return null
  const missing = missingProfileFields(role, details)
  const setField = (id, value) => { setDetails(prev => ({ ...prev, [id]: value })); setSaved(false) }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const result = await api('/profile/me', {
        method: 'PATCH',
        body: { role, professionalProfile: details },
      })
      if (result.user) updateUser(result.user)
      setSaved(true)
      toast(missing.length ? 'Perfil guardado. Aún falta completar algunos datos.' : 'Perfil profesional guardado', missing.length ? 'info' : 'success')
      window.setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      const message = err?.message || 'No se pudo guardar el perfil.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const banner = { ...user, roleProfiles: { ...user?.roleProfiles, [role]: { ...user?.roleProfiles?.[role], details } } }

  return (
    <div className={embedded ? undefined : 'role-dashboard'}>
      {!embedded && <ProfileCompletionBanner role={role} user={banner} />}
      <div className="rpp">
        <div className="rpp__main">
          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.edit} {meta.profileTitle}</div>
            <p className="pnl-empty-hint">
              Este es tu perfil profesional de {meta.label}: lo ven los organizadores cuando buscan staff y es la carta con la que
              te postulas a un torneo. No es tu perfil de jugador.
            </p>
            <div className="role-form-grid">
              {meta.profileFields.map(field => (
                <RoleFieldInput key={field.id} field={field} value={details[field.id]} onChange={v => setField(field.id, v)} user={user} />
              ))}
            </div>
          </motion.div>

          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.trophy} {meta.expTitle}</div>
            <div className="role-form-grid">
              {meta.experienceToggle ? (
                <ExperienceSection fields={meta.experienceFields} values={details} setValue={setField} user={user} />
              ) : meta.experienceFields.map(field => (
                <RoleFieldInput key={field.id} field={field} value={details[field.id]} onChange={v => setField(field.id, v)} user={user} />
              ))}
            </div>
            {error && <p className="pnl-empty-hint" role="alert" style={{ color: '#ef4444' }}>{error}</p>}
            <div className="role-actions">
              {saved && <span className="rpp__saved">{Icon.check} Perfil guardado</span>}
              {!saved && missing.length > 0 && <span className="pnl-empty-hint">Falta: {missing.join(', ')}</span>}
              <button className="pnl-btn pnl-btn--primary" type="button" onClick={save} disabled={saving}>
                {Icon.check} {saving ? 'Guardando...' : 'Guardar perfil profesional'}
              </button>
            </div>
          </motion.div>
        </div>

        <aside className="rpp__side">
          <div className="rpp__side-title">Tu tarjeta de {meta.label}</div>
          <RoleProfileCard role={role} user={user} details={details} width={280} />
          <p className="rpp__hint">Así se ve tu tarjeta. Haz clic para girarla y ver el detalle. Se actualiza mientras editas.</p>
          {user?.roleProfiles?.[role]?.approvedAt && <ShowcaseToggle role={role} />}
        </aside>
      </div>
    </div>
  )
}

