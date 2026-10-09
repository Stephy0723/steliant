import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Badge from '../Badge/Badge.jsx'
import { Icon } from '../icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import TermsAccept from '../TermsAccept/TermsAccept.jsx'
import { PLATFORM_ROLES } from '../../data/roleApplications.js'
import { api } from '../../lib/api.js'
import RoleFieldInput, { ExperienceSection } from '../RoleFieldInput/RoleFieldInput.jsx'
import { isFieldOptional } from '../../lib/roleProfileCompleteness.js'
import { NO_EXPERIENCE } from '../../data/roleFieldOptions.js'
import './RoleApplications.css'

function RoleTag({ role, size = 'sm' }) {
  return (
    <span className={`gg-role-tag gg-role-tag--${role.id} gg-role-tag--${size}`} data-text={role.tag}>
      <i>{Icon[role.icon] || Icon.star}</i>
      <b>{role.tag}</b>
    </span>
  )
}

function ApplicationForm({ role, user, onClose, onSubmit }) {
  const fileInputRef = useRef(null)
  // Nombre legal real (nombre + apellido de la cuenta) -- el nick es un
  // gamertag, no sirve para un formulario de verificación de identidad.
  const legalName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()

  // State for all form fields
  const [form, setForm] = useState(() => {
    const initial = { dni: '', documentFile: null, acceptTerms: false }
    role.profileFields.forEach(f => { initial[f.id] = '' })
    role.experienceFields.forEach(f => { initial[f.id] = '' })
    return initial
  })
  
  const [errors, setErrors] = useState({})
  const setField = (id, value) => {
    setForm(prev => ({ ...prev, [id]: value }))
    setErrors(prev => (prev[id] || prev.experienceChoice ? { ...prev, [id]: '', experienceChoice: '' } : prev))
  }
  const [selectedFileName, setSelectedFileName] = useState('Ningún archivo seleccionado')

  const handleFileClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, documentFile: 'El archivo supera el límite de 5MB.' }))
        return
      }
      setForm(prev => ({ ...prev, documentFile: file }))
      setSelectedFileName(file.name)
      setErrors(prev => {
        const next = { ...prev }
        delete next.documentFile
        return next
      })
    }
  }

  const submit = event => {
    event.preventDefault()
    const nextErrors = {}

    // Validation
    if (!legalName) nextErrors.legalName = 'Completa tu nombre y apellido en tu perfil antes de solicitar un rol.'
    if (!form.dni.trim()) nextErrors.dni = 'Este campo es obligatorio.'
    if (!form.documentFile) nextErrors.documentFile = 'Debes subir una foto o escaneo de tu identificación.'

    role.profileFields.forEach(field => {
      const value = String(form[field.id] || '').trim()
      if (!value && !isFieldOptional(field)) nextErrors[field.id] = 'Este campo es obligatorio.'
    })

    // Quien aun no tiene experiencia lo indica (yearsExp = "Sin experiencia") y
    // no tiene que inventarla: en ese caso el resto de la seccion no se exige.
    const noExperience = role.experienceToggle && String(form.yearsExp || '').trim() === NO_EXPERIENCE
    if (!noExperience) {
      const allEmpty = role.experienceFields.every(f => !String(form[f.id] || '').trim())
      if (role.experienceToggle && allEmpty) nextErrors.experienceChoice = 'Indica si tienes experiencia previa en este rol.'
      else {
        role.experienceFields.forEach(field => {
          const value = String(form[field.id] || '').trim()
          if (!value && !isFieldOptional(field)) nextErrors[field.id] = 'Este campo es obligatorio.'
        })
      }
    }

    if (!form.acceptTerms) nextErrors.acceptTerms = 'Debes aceptar los Términos y Condiciones.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(role, form, selectedFileName)
    }
  }

  return (
    <motion.div className="gg-role-modal__overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form 
        className="gg-role-modal" 
        initial={{ opacity: 0, scale: .96, y: 16 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: .96 }} 
        onSubmit={submit} 
        onClick={event => event.stopPropagation()} 
        noValidate
      >
        <div className="gg-role-modal__head">
          <div>
            <span className="gg-role-modal__pretitle">VERIFICACIÓN OFICIAL</span>
            <h3 className="gg-role-modal__title">Solicitud de {role.label}</h3>
            <p className="gg-role-modal__intro">
              Para garantizar la seguridad de la comunidad, requerimos validar tu identidad antes de permitirte gestionar eventos y premios.
            </p>
          </div>
          <button type="button" className="gg-role-modal__close-btn" onClick={onClose} aria-label="Cerrar">{Icon.x}</button>
        </div>

        <div className="gg-role-modal__notice-banner">
          <b>Revisión por administración</b>
          <p>Completa este formulario y tu solicitud queda pendiente de revisión. Te avisamos por notificación dentro de la plataforma en cuanto un admin la apruebe o la rechace — no se envía ningún correo.</p>
        </div>

        <div className="gg-role-form-sections">
          
          {/* SECTION 1: Datos del Representante */}
          <div className="gg-role-form-section">
            <h4 className="gg-role-section-header">{role.repTitle || 'Datos del Representante'}</h4>
            <div className="gg-role-form-grid">
              
              {/* Nombre legal real (nombre + apellido de la cuenta, no el nick/gamertag) */}
              <div className="gg-role-modal__legal-name-box">
                <div className="gg-role-modal__legal-name">
                  {legalName || 'Completa tu nombre y apellido en tu perfil'}
                </div>
                <div className="gg-role-modal__legal-label">Nombre Legal Completo</div>
                <div className="gg-role-modal__legal-note">Completado desde tu perfil</div>
                {errors.legalName && <small className="error">{errors.legalName}</small>}
              </div>

              {/* DNI Field */}
              <label className="wide">
                <span>DNI / Pasaporte / ID</span>
                <input 
                  type="text" 
                  value={form.dni} 
                  placeholder="Ingresa tu número de documento"
                  onChange={event => {
                    setForm(prev => ({ ...prev, dni: event.target.value }))
                    if (errors.dni) setErrors(prev => ({ ...prev, dni: '' }))
                  }} 
                />
                {errors.dni && <small className="error">{errors.dni}</small>}
              </label>

              {/* Document Scan Upload */}
              <div className="gg-role-modal__file-upload wide">
                <span>Documento de Identidad (Foto/Scan)</span>
                <div className="gg-file-upload-row">
                  <span className="gg-file-upload-name">{selectedFileName}</span>
                  <button type="button" className="gg-btn gg-btn--ghost gg-btn--sm" onClick={handleFileClick}>
                    Subir Archivo
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                </div>
                <small className="file-info-note">Formatos: PDF, JPG, PNG. Máx 5MB. (Tus datos están encriptados)</small>
                {errors.documentFile && <small className="error" style={{ display: 'block', marginTop: '4px' }}>{errors.documentFile}</small>}
              </div>

            </div>
          </div>

          {/* SECTION 2: Perfil de Organización */}
          <div className="gg-role-form-section">
            <h4 className="gg-role-section-header">{role.profileTitle}</h4>
            <div className="gg-role-form-grid">
              {role.profileFields.map(field => (
                <RoleFieldInput key={field.id} field={field} value={form[field.id]} onChange={v => setField(field.id, v)} error={errors[field.id]} user={user} />
              ))}
            </div>
          </div>

          {/* SECTION 3: Experiencia en eSports */}
          <div className="gg-role-form-section">
            <h4 className="gg-role-section-header">{role.expTitle}</h4>
            <div className="gg-role-form-grid">
              {role.experienceToggle ? (
                <ExperienceSection fields={role.experienceFields} values={form} setValue={setField} errors={errors} user={user} />
              ) : role.experienceFields.map(field => (
                <RoleFieldInput key={field.id} field={field} value={form[field.id]} onChange={v => setField(field.id, v)} error={errors[field.id]} user={user} />
              ))}
            </div>
          </div>

        </div>

        <div className="gg-role-modal__terms">
          <TermsAccept
            id="role-terms"
            checked={form.acceptTerms}
            error={!!errors.acceptTerms}
            onChange={v => { setForm(prev => ({ ...prev, acceptTerms: v })); if (errors.acceptTerms) setErrors(prev => ({ ...prev, acceptTerms: '' })) }}
          />
          {errors.acceptTerms && <small className="error">{errors.acceptTerms}</small>}
        </div>

        <div className="gg-role-modal__actions-wrapper">
          <div className="gg-role-modal__actions">
            <button type="button" className="gg-btn gg-btn--ghost gg-btn--sm" onClick={onClose}>Cancelar</button>
            <button className="gg-btn gg-btn--primary gg-btn--sm">{Icon.send} Enviar solicitud</button>
          </div>
          <p className="gg-role-modal__legal-note-bottom">
            {role.legalDisclaimer}
          </p>
        </div>
      </motion.form>
    </motion.div>
  )
}

export default function RoleApplications({ compact = false }) {
  const { user } = useAuth()
  const [selectedRole, setSelectedRole] = useState(null)
  const [sentRole, setSentRole] = useState('')
  const [submitError, setSubmitError] = useState('')
  // { [roleId]: { status: 'pending'|'approved'|'rejected' } }
  const [myApps, setMyApps] = useState({})

  useEffect(() => {
    api('/role-applications/my')
      .then(apps => {
        const map = {}
        apps.forEach(app => {
          if (!map[app.roleId]) map[app.roleId] = app
        })
        setMyApps(map)
      })
      .catch(() => {}) // en modo demo no hay backend, se ignora
  }, [])

  const submit = async (role, form, fileName) => {
    setSubmitError('')
    const formData = {}
    // El nombre legal (nombre + apellido de la cuenta) va junto al resto de
    // la solicitud, para que quien la revise lo vea al lado del documento
    // de identidad -- antes se mostraba en el formulario pero nunca se
    // mandaba al backend.
    formData.legalName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    role.profileFields.forEach(f => { formData[f.id] = form[f.id] })
    role.experienceFields.forEach(f => { formData[f.id] = form[f.id] })

    try {
      // 1. Subir el documento de identidad si existe
      let documentUrl = ''
      if (form.documentFile) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsDataURL(form.documentFile)
        })
        const uploadRes = await api('/uploads', {
          method: 'POST',
          body: JSON.stringify({ dataUrl, filename: fileName }),
        })
        documentUrl = uploadRes.url || ''
      }

      // 2. Enviar la solicitud con la URL del documento
      await api('/role-applications', {
        method: 'POST',
        body: JSON.stringify({
          roleId: role.id,
          roleLabel: role.label,
          dni: form.dni,
          documentFileName: fileName,
          documentUrl,
          formData,
        }),
      })
      setMyApps(prev => ({ ...prev, [role.id]: { roleId: role.id, status: 'pending' } }))
      setSelectedRole(null)
      setSentRole(role.label)
      setTimeout(() => setSentRole(''), 3500)
    } catch (err) {
      setSubmitError(err.message || 'No se pudo enviar la solicitud.')
    }
  }

  return (
    <section className={`gg-role-apps ${compact ? 'compact' : ''}`}>
      <div className="gg-role-apps__head">
        <div>
          <h3>Roles en la Plataforma</h3>
          <p>Solicita roles adicionales para desbloquear herramientas especiales.</p>
        </div>
        <span>Revisión por administración</span>
      </div>
      
      {sentRole && (
        <div className="gg-role-apps__success">
          {Icon.check} Solicitud de {sentRole} registrada. El Admin la revisará pronto.
        </div>
      )}

      {submitError && (
        <div className="gg-role-apps__error">{submitError}</div>
      )}

      <div className="gg-role-grid">
        {PLATFORM_ROLES.map(role => {
          const request = myApps[role.id]
          return (
            <article className={`gg-role-card ${role.active ? 'active' : ''}`} key={role.id}>
              <RoleTag role={role} />
              <div>
                <b>{role.label}</b>
                <small>{role.desc}</small>
              </div>
              {role.active ? (
                <Badge variant="accent">Activo</Badge>
              ) : request?.status === 'approved' ? (
                <Badge variant="accent">Aprobado</Badge>
              ) : request?.status === 'pending' ? (
                <Badge variant="muted">Pendiente</Badge>
              ) : (
                <button
                  className="gg-btn gg-btn--ghost gg-btn--sm"
                  onClick={() => setSelectedRole(role)}
                >
                  {request?.status === 'rejected' ? 'Solicitar de nuevo' : 'Solicitar'}
                </button>
              )}
            </article>
          )
        })}
      </div>
      
      <p className="gg-role-apps__foot">Cada solicitud queda en cola para revisión de administración dentro de la plataforma — te avisamos por notificación cuando se resuelva, no por correo.</p>
      
      <AnimatePresence>
        {selectedRole && (
          <ApplicationForm 
            role={selectedRole} 
            user={user} 
            onClose={() => setSelectedRole(null)} 
            onSubmit={submit} 
          />
        )}
      </AnimatePresence>
    </section>
  )
}

