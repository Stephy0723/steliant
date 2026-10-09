import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { subscribeToasts } from '../../lib/toast.js'
import './ToastHost.css'

const ICONS = { success: 'check', error: 'x', info: 'bell', warn: 'alert' }

export default function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => subscribeToasts(item => {
    setItems(prev => [...prev, item])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== item.id))
    }, item.duration)
  }), [])

  const dismiss = (id) => setItems(prev => prev.filter(t => t.id !== id))
  const runAction = (event, toastItem) => {
    event.stopPropagation()
    dismiss(toastItem.id)
    const link = toastItem.action?.link
    if (link) window.location.assign(link)
  }

  return (
    <div className="gg-toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map(t => (
          <motion.div
            key={t.id}
            className={`gg-toast gg-toast--${t.type}`}
            initial={{ opacity: 0, x: 60, scale: .9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: .9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={() => dismiss(t.id)}
          >
            <span className="gg-toast__icon">{Icon[ICONS[t.type]] || Icon.bell}</span>
            <div className="gg-toast__body">
              {t.title && <b>{t.title}</b>}
              <span>{t.message}</span>
              {t.action?.label && (
                <button className="gg-toast__action" onClick={(event) => runAction(event, t)}>
                  {t.action.label}
                </button>
              )}
            </div>
            <button className="gg-toast__close" onClick={(e) => { e.stopPropagation(); dismiss(t.id) }} aria-label="Cerrar">{Icon.x}</button>
            <span className="gg-toast__bar" style={{ animationDuration: `${t.duration}ms` }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

