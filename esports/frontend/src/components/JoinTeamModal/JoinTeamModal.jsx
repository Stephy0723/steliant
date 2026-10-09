import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { teamColor } from '../../lib/teamColor.js'
import { TEAM_ROLES, teamRoleLabel } from '../../../../shared/teamRoles.mjs'
import './JoinTeamModal.css'

// Que implica postularse con cada rol (reglas de shared/teamRoles.mjs).
const ROLE_COPY = {
  player: 'Titular o suplente. Tienes que cumplir las reglas del equipo y solo puedes jugar en un equipo por juego.',
  coach: 'Staff del equipo: no ocupas lugar de jugador. Puedes ser coach de varios equipos, pero de uno solo por torneo.',
  analyst: 'Staff del equipo: no ocupas lugar de jugador. Revisas partidas y rivales; uno solo por torneo.',
  manager: 'Staff del equipo: organizas horarios, inscripciones y comunicación. Uno solo por torneo.',
}

/**
 * Solicitud para unirse a un equipo eligiendo el rol: jugador o staff
 * (coach, analista, manager). El lider la ve con el rol y, si es staff, con
 * el sello "verificado" cuando el rol esta aprobado en GlitchGang.
 * Props: open, team { id|_id, name, tag, logo, color }, teamId (para la API),
 * defaultRole, playerBlockedReason (si no cumple las reglas de jugador: esa
 * opcion queda deshabilitada con el motivo, el staff sigue disponible),
 * onClose, onSent(role)
 */
export default function JoinTeamModal({ open, team, teamId, defaultRole = 'player', playerBlockedReason = '', onClose, onSent }) {
  const initialRole = playerBlockedReason && defaultRole === 'player' ? 'coach' : defaultRole
  const [role, setRole] = useState(initialRole)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const name = team?.name || 'este equipo'
  const tone = teamColor(team?.color)

  useEffect(() => {
    if (!open) return
    setRole(initialRole)
    setMessage('')
  }, [open, initialRole])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  async function send(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    const asRole = role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}`
    try {
      await api(`/teams/${encodeURIComponent(teamId || team?._id || team?.id)}/requests`, {
        method: 'POST',
        body: { role, message: message.trim() || `Quiero unirme a ${name}${asRole}.` },
      })
      toast(`Solicitud enviada${asRole}. El líder la verá en su buzón.`, 'success')
      onSent?.(role)
    } catch (err) {
      // 409 = ya habia una pendiente: es la misma accion ya hecha, no un error.
      if (err?.status === 409) {
        toast('Tu solicitud ya estaba pendiente.')
        onSent?.(role)
      } else {
        toast(err?.message || 'No se pudo enviar la solicitud.', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="gg-join"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose?.()}
        >
          <motion.form
            className="gg-join__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gg-join-title"
            style={{ '--jt-team': tone }}
            initial={{ opacity: 0, y: 16, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: .98 }}
            transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            onSubmit={send}
          >
            <span className="gg-join__eyebrow">{Icon.send} // Solicitud de ingreso</span>

            <div className="gg-join__team">
              <div className="gg-join__crest">
                {team?.logo ? <img src={team.logo} alt="" /> : <b>{String(team?.tag || name).slice(0, 3).toUpperCase()}</b>}
              </div>
              <div>
                <h3 id="gg-join-title" data-no-translate>Unirme a {name}</h3>
                <small>{team?.tag ? `[${team.tag}] · ` : ''}El líder acepta o rechaza</small>
              </div>
            </div>

            <fieldset className="gg-join__roles">
              <legend>¿Con qué rol?</legend>
              {TEAM_ROLES.map(item => {
                const disabled = item === 'player' && Boolean(playerBlockedReason)
                return (
                  <label key={item} className={`gg-join__role ${role === item ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}>
                    <input type="radio" name="gg-join-role" value={item} checked={role === item} disabled={disabled} onChange={() => setRole(item)} />
                    <span>{teamRoleLabel(item)}</span>
                    {item !== 'player' && <em>Staff</em>}
                  </label>
                )
              })}
            </fieldset>
            {playerBlockedReason && <p className="gg-join__blocked">{Icon.alert} Como jugador no: {playerBlockedReason}</p>}
            <p className="gg-join__copy">{ROLE_COPY[role]}</p>

            <label className="gg-join__message">
              <span>Mensaje para el líder (opcional)</span>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={role === 'player' ? 'Tu rol en el juego, rango, horarios…' : 'Tu experiencia, equipos que llevaste, disponibilidad…'}
              />
            </label>

            <div className="gg-join__actions">
              <button type="button" className="gg-join__btn" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="gg-join__btn gg-join__btn--primary" disabled={busy}>
                {Icon.send} {busy ? 'Enviando…' : `Enviar como ${teamRoleLabel(role).toLowerCase()}`}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

