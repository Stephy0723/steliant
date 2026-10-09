import { useEffect, useState, useRef } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import { uploadFile } from '../../lib/uploadsApi.js'
import { EXTRA_PUB_PRICE } from '../../lib/pubStore.js'
import { toast } from '../../lib/toast.js'
import './PublishModal.css'

const FALLBACK_LIMIT = 3

const TYPES = [
  { id: 'tournament', label: 'Torneo', icon: Icon.trophy, desc: 'Anuncia un torneo o liga', color: '#00E676' },
  { id: 'team',       label: 'Equipo',    icon: Icon.team,    desc: 'Presenta tu equipo',        color: '#7c3aed' },
  { id: 'event',      label: 'Evento',    icon: Icon.calendar, desc: 'Eventos y meetups',         color: '#f59e0b' },
  { id: 'creator',    label: 'Creador',   icon: Icon.camera,  desc: 'Tu canal o contenido',      color: '#ec4899' },
  { id: 'brand',      label: 'Marca',     icon: Icon.star,    desc: 'Tu marca o patrocinio',     color: '#3b82f6' },
  { id: 'profile',    label: 'Perfil',    icon: Icon.user,    desc: 'Tu perfil de jugador',      color: '#8b5cf6' },
]

function LimitModal({ limit, onClose, onCheckout, onUpgrade }) {
  return (
    <motion.div className="pm-limit-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="pm-limit-box"
        initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pm-limit-icon">{Icon.lock}</div>
        <h3>Límite mensual alcanzado</h3>
        <p>Ya usaste tus <b>{limit} publicaciones gratuitas</b> de este mes. Elige cómo continuar:</p>

        <div className="pm-limit-options">
          <button className="pm-limit-opt pm-limit-opt--primary" onClick={onCheckout}>
            <span className="pm-limit-opt__icon">{Icon.creditCard}</span>
            <div>
              <b>Pagar ${EXTRA_PUB_PRICE} por esta publicación</b>
              <small>Publicación única aprobada por el equipo</small>
            </div>
            {Icon.chevronRight}
          </button>

          <button className="pm-limit-opt pm-limit-opt--upgrade" onClick={onUpgrade}>
            <span className="pm-limit-opt__icon">{Icon.gem}</span>
            <div>
              <b>Subir a Plan Pro</b>
              <small>Publicaciones ilimitadas + beneficios exclusivos</small>
            </div>
            {Icon.chevronRight}
          </button>

          <button className="pm-limit-opt" onClick={onClose}>
            <span className="pm-limit-opt__icon">{Icon.chat}</span>
            <div>
              <b>Contactar al equipo</b>
              <small>Te ayudamos por Discord o WhatsApp</small>
            </div>
            {Icon.chevronRight}
          </button>
        </div>

        <button className="pm-limit-close" onClick={onClose}>{Icon.x} Cancelar</button>
      </motion.div>
    </motion.div>
  )
}

export default function PublishModal({ open, onClose }) {
  const { lang } = useLang()
  const isEs = lang === 'es'

  const [step, setStep] = useState(1)
  const [type, setType] = useState(null)
  const [title, setTitle]   = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink]   = useState('')
  const [message, setMessage] = useState('')
  const [images, setImages] = useState(['', '', ''])
  const [uploading, setUploading] = useState([false, false, false])
  const [showLimit, setShowLimit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quota, setQuota] = useState({ count: 0, limit: FALLBACK_LIMIT, remaining: FALLBACK_LIMIT, isOver: false })
  const fileRefs = [useRef(), useRef(), useRef()]

  useEffect(() => {
    if (!open) return
    api('/publication-requests/me/count')
      .then(setQuota)
      .catch(() => {})
  }, [open])

  const { count, limit, remaining, isOver } = quota

  const reset = () => {
    setStep(1); setType(null); setTitle(''); setDescription('')
    setLink(''); setMessage(''); setImages(['', '', '']); setShowLimit(false)
  }
  const handleClose = () => { reset(); onClose() }

  const handleFileChange = async (idx, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(prev => { const next = [...prev]; next[idx] = true; return next })
    try {
      const res = await uploadFile(file)
      setImages(prev => { const next = [...prev]; next[idx] = res.url; return next })
    } catch {
      toast('No se pudo subir la imagen', 'error')
    } finally {
      setUploading(prev => { const next = [...prev]; next[idx] = false; return next })
    }
  }

  const canSubmit = title.trim() && type

  const handleSubmit = async () => {
    if (isOver) { setShowLimit(true); return }
    setSubmitting(true)
    try {
      await api('/publication-requests', {
        method: 'POST',
        body: {
          type,
          title: title.trim(),
          description: description.trim(),
          images: images.filter(Boolean),
          link: link.trim(),
          message: message.trim(),
        },
      })
      toast('¡Solicitud enviada! El equipo la revisará pronto.', 'success')
      window.dispatchEvent(new CustomEvent('gg:notify', { detail: { type: 'info', msg: 'Nueva solicitud de publicación pendiente' } }))
      handleClose()
    } catch (error) {
      toast(error.message || 'No se pudo enviar la solicitud', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckout = () => {
    setShowLimit(false)
    window.location.href = '/premium/checkout?product=pub_extra'
  }
  const handleUpgrade = () => {
    setShowLimit(false)
    window.location.href = '/premium'
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pm-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            className="pm-panel"
            initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="pm-head">
              <div className="pm-head__info">
                <span className="pm-head__badge">{Icon.send} PUBLICAR</span>
                <h2>Nueva Publicación</h2>
                <p>Llena el formulario — lo revisamos y publicamos en 24-48 h</p>
              </div>
              <button className="pm-head__close" onClick={handleClose}>{Icon.x}</button>
            </div>

            {/* Counter bar */}
            <div className={`pm-counter ${isOver ? 'pm-counter--over' : ''}`}>
              <div className="pm-counter__track">
                <div className="pm-counter__fill" style={{ width: `${Math.min(100, (count / limit) * 100)}%` }} />
              </div>
              <span>
                {isOver
                  ? `⚠️ Límite alcanzado · ${count}/${limit} gratuitas`
                  : `${remaining} publicación${remaining !== 1 ? 'es' : ''} gratuita${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} este mes`}
              </span>
            </div>

            {/* Step indicators */}
            <div className="pm-steps">
              {['Tipo', 'Contenido', 'Confirmar'].map((s, i) => (
                <div key={s} className={`pm-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
                  <span className="pm-step__dot">{step > i + 1 ? Icon.check : i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            {/* Steps body */}
            <div className="pm-body">
              {/* STEP 1: TYPE */}
              {step === 1 && (
                <div className="pm-types">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      className={`pm-type-card ${type === t.id ? 'selected' : ''}`}
                      style={{ '--tc': t.color }}
                      onClick={() => setType(t.id)}
                    >
                      <span className="pm-type-card__icon">{t.icon}</span>
                      <b>{t.label}</b>
                      <small>{t.desc}</small>
                    </button>
                  ))}
                </div>
              )}

              {/* STEP 2: FORM */}
              {step === 2 && (
                <div className="pm-form">
                  <label className="pm-field">
                    <span>Título <em>*</em></span>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Nombre de tu publicación..."
                      maxLength={80}
                    />
                    <small className="pm-field__hint">{title.length}/80</small>
                  </label>

                  <label className="pm-field">
                    <span>Descripción</span>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe tu torneo, equipo, evento o contenido..."
                      maxLength={400}
                    />
                    <small className="pm-field__hint">{description.length}/400</small>
                  </label>

                  <label className="pm-field">
                    <span>Link / URL</span>
                    <input
                      value={link}
                      onChange={e => setLink(e.target.value)}
                      placeholder="https://... o /torneos/123"
                    />
                  </label>

                  <div className="pm-field">
                    <span>Imágenes (hasta 3)</span>
                    <div className="pm-images">
                      {[0, 1, 2].map(idx => (
                        <div key={idx} className={`pm-img-slot ${images[idx] ? 'has-img' : ''}`}>
                          {images[idx]
                            ? <>
                                <img src={images[idx]} alt="" />
                                <button
                                  className="pm-img-slot__remove"
                                  onClick={() => setImages(p => { const n = [...p]; n[idx] = ''; return n })}
                                >{Icon.x}</button>
                              </>
                            : <button className="pm-img-slot__add" onClick={() => fileRefs[idx].current?.click()} disabled={uploading[idx]}>
                                {Icon.upload}
                                <span>{uploading[idx] ? 'Subiendo...' : 'Subir imagen'}</span>
                                <small>o pega una URL abajo</small>
                              </button>
                          }
                          <input
                            type="file"
                            accept="image/*"
                            ref={fileRefs[idx]}
                            style={{ display: 'none' }}
                            onChange={e => handleFileChange(idx, e)}
                          />
                          {!images[idx] && (
                            <input
                              className="pm-img-url"
                              placeholder="URL de imagen..."
                              onBlur={e => { if (e.target.value) setImages(p => { const n = [...p]; n[idx] = e.target.value; return n }) }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="pm-field">
                    <span>Mensaje al equipo (opcional)</span>
                    <textarea
                      rows={2}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="¿Algo que debamos saber sobre esta publicación?"
                      maxLength={200}
                    />
                  </label>
                </div>
              )}

              {/* STEP 3: CONFIRM */}
              {step === 3 && (
                <div className="pm-confirm">
                  <div className="pm-confirm__preview">
                    {images[0] && <img src={images[0]} alt="" className="pm-confirm__img" />}
                    <div className="pm-confirm__info">
                      <span className="pm-confirm__type" style={{ '--tc': TYPES.find(t => t.id === type)?.color }}>
                        {TYPES.find(t => t.id === type)?.icon}
                        {TYPES.find(t => t.id === type)?.label}
                      </span>
                      <h3>{title}</h3>
                      {description && <p>{description}</p>}
                      {link && <a href={safeHref(link)} target="_blank" rel="noreferrer">{link}</a>}
                    </div>
                  </div>

                  <div className="pm-confirm__meta">
                    {images.filter(Boolean).length > 0 && (
                      <div className="pm-confirm__imgs">
                        {images.filter(Boolean).map((src, i) => (
                          <img key={i} src={src} alt="" />
                        ))}
                      </div>
                    )}
                    <div className="pm-confirm__details">
                      <span>{Icon.clock} Revisión en 24-48 h</span>
                      <span>{Icon.check} Recibirás una notificación</span>
                      <span>{Icon.users} Publicado ante toda la comunidad</span>
                    </div>
                  </div>

                  {isOver && (
                    <div className="pm-confirm__limit-warn">
                      {Icon.alert} Límite alcanzado — se aplicará un cargo de <b>${EXTRA_PUB_PRICE}</b>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="pm-footer">
              {step > 1
                ? <button className="pm-btn pm-btn--ghost" onClick={() => setStep(s => s - 1)}>{Icon.chevronRight} Atrás</button>
                : <button className="pm-btn pm-btn--ghost" onClick={handleClose}>Cancelar</button>
              }
              {step < 3
                ? <button
                    className="pm-btn pm-btn--primary"
                    onClick={() => setStep(s => s + 1)}
                    disabled={step === 1 ? !type : step === 2 ? !canSubmit : false}
                  >
                    Siguiente {Icon.chevronRight}
                  </button>
                : <button className="pm-btn pm-btn--submit" onClick={handleSubmit} disabled={submitting}>
                    {Icon.send} {submitting ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
              }
            </div>
          </motion.div>

          {/* Limit modal */}
          <AnimatePresence>
            {showLimit && (
              <LimitModal
                limit={limit}
                onClose={() => setShowLimit(false)}
                onCheckout={handleCheckout}
                onUpgrade={handleUpgrade}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

