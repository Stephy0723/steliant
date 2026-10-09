import { motion, AnimatePresence } from 'framer-motion'
import Button from '../Button/Button.jsx'
import './ConfirmModal.css'

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel, variant = 'danger' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="gg-modal-overlay"
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          exit={{ opacity:0 }}
          onClick={onCancel}
        >
          <motion.div
            className="gg-modal"
            initial={{ scale:.9, opacity:0, y:12 }}
            animate={{ scale:1, opacity:1, y:0 }}
            exit={{ scale:.9, opacity:0 }}
            transition={{ type:'spring', stiffness:300, damping:24 }}
            onClick={e => e.stopPropagation()}
          >
            <h3>{title}</h3>
            {message && <p>{message}</p>}
            <div className="gg-modal__btns">
              <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
              <button
                className={`gg-btn gg-btn--sm gg-modal__confirm gg-modal__confirm--${variant}`}
                onClick={onConfirm}
              >{confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

