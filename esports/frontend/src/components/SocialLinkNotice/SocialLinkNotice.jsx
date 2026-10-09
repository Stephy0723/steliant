import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { subscribeSocialLinkNotices } from '../../lib/socialLinkNotice.js'
import './SocialLinkNotice.css'

const META = {
  discord: {
    label: 'Discord',
    icon: Icon.discord,
    accent: '#5865F2',
    successTitle: 'Discord vinculado',
    successMessage: 'Tu cuenta quedo conectada correctamente. Ya puedes usar roles, check-in y avisos del torneo.',
    errorTitle: 'No se pudo vincular Discord',
    errorMessage: 'Revisa la autorizacion o intenta conectar de nuevo.',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: Icon.whatsapp,
    accent: '#25D366',
    successTitle: 'WhatsApp vinculado',
    successMessage: 'Tu numero quedo validado correctamente. Ya puedes recibir avisos importantes del torneo.',
    errorTitle: 'No se pudo vincular WhatsApp',
    errorMessage: 'Revisa el codigo o solicita uno nuevo.',
  },
}

export default function SocialLinkNotice() {
  const [notice, setNotice] = useState(null)

  useEffect(() => subscribeSocialLinkNotices(setNotice), [])

  useEffect(() => {
    if (!notice) return undefined
    const t = window.setTimeout(() => setNotice(null), notice.duration)
    return () => window.clearTimeout(t)
  }, [notice])

  const meta = useMemo(() => META[notice?.network] || META.discord, [notice?.network])
  const isError = notice?.status === 'error'

  return (
    <AnimatePresence>
      {notice && (
        <motion.aside
          className={`gg-social-notice gg-social-notice--${notice.network} ${isError ? 'is-error' : 'is-success'}`}
          style={{ '--network-accent': meta.accent }}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <div className="gg-social-notice__signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div className="gg-social-notice__icon">
            {isError ? Icon.alert || Icon.x : meta.icon}
          </div>

          <div className="gg-social-notice__body">
            <span className="gg-social-notice__eyebrow">{meta.label}</span>
            <h3>{notice.title || (isError ? meta.errorTitle : meta.successTitle)}</h3>
            <p>{notice.message || (isError ? meta.errorMessage : meta.successMessage)}</p>
            {notice.detail && <small>{notice.detail}</small>}
          </div>

          <button type="button" className="gg-social-notice__close" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            {Icon.x}
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

