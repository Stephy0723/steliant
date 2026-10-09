import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { toast } from '../../lib/toast.js'
import { teamColor } from '../../lib/teamColor.js'
import './LeaveTeamModal.css'

/**
 * Confirmación HUD para que un jugador (no líder) salga de su equipo.
 * Hace la llamada él mismo y avisa con onLeft() cuando termina bien.
 * Props: open, team { id|_id, name, tag, logo, color }, onClose, onLeft
 */
export default function LeaveTeamModal({ open, team, onClose, onLeft }) {
  const { refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const name = team?.name || 'este equipo'
  const tone = teamColor(team?.color)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  async function leave() {
    if (busy) return
    setBusy(true)
    try {
      // teamId: el backend sale de ESTE equipo aunque estés en varios.
      await api('/teams/leave', { method: 'POST', body: { teamId: String(team?._id || team?.id || '') } })
      try {
        if (localStorage.getItem('gg-active-team-id') === String(team?._id || team?.id || '')) {
          localStorage.removeItem('gg-active-team-id')
        }
      } catch {}
      await refreshUser()
      toast(`Saliste de ${name}`, 'success')
      onLeft?.()
    } catch (err) {
      toast(err?.message || 'No se pudo salir del equipo', 'error')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="gg-leave"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose?.()}
        >
          <motion.div
            className="gg-leave__card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="gg-leave-title"
            style={{ '--lt-team': tone }}
            initial={{ opacity: 0, y: 16, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: .98 }}
            transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
          >
            <span className="gg-leave__eyebrow">{Icon.alert} // Confirmar salida</span>

            <div className="gg-leave__team">
              <div className="gg-leave__crest">
                {team?.logo ? <img src={team.logo} alt="" /> : <b>{String(team?.tag || name).slice(0, 3).toUpperCase()}</b>}
              </div>
              <div>
                <h3 id="gg-leave-title" data-text={`¿Salir de ${name}?`}>¿Salir de {name}?</h3>
                <small>{team?.tag ? `[${team.tag}] · ` : ''}Esta acción es inmediata</small>
              </div>
            </div>

            <ul className="gg-leave__list">
              <li>{Icon.users} Dejas de aparecer en el roster del equipo.</li>
              <li>{Icon.discord} Pierdes las salas y avisos del equipo en Discord.</li>
              <li>{Icon.trophy} No podrás jugar sus torneos con este equipo.</li>
              <li>{Icon.refresh} Para volver necesitas una invitación o enviar solicitud.</li>
            </ul>

            <div className="gg-leave__actions">
              <button type="button" className="gg-leave__btn" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="gg-leave__btn gg-leave__btn--danger" onClick={leave} disabled={busy}>
                {Icon.logout} {busy ? 'Saliendo…' : 'Sí, salir del equipo'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

