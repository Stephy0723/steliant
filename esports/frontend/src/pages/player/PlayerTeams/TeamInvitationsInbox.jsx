import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { teamRoleLabel } from '../../../../../shared/teamRoles.mjs'

// Invitaciones que el jugador recibio de lideres de equipo (por su nick).
// Cada una dice con que rol entra (jugador, coach, analista o manager).
// Solo aparece si hay alguna pendiente. Al aceptar el backend vuelve a revisar
// todas las reglas (universidad, un equipo por juego, cupo, roster congelado).
export default function TeamInvitationsInbox({ onJoined }) {
  const navigate = useNavigate()
  const [invitations, setInvitations] = useState([])
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    api('/teams/invitations/mine')
      .then(data => setInvitations(data.invitations || []))
      .catch(() => setInvitations([]))
  }, [])

  const respond = async (inv, accept) => {
    setBusyId(inv.id)
    try {
      const result = await api(`/teams/invitations/${inv.id}/respond`, { method: 'POST', body: { accept } })
      setInvitations(prev => prev.filter(item => item.id !== inv.id))
      const asRole = inv.role && inv.role !== 'player' ? ` como ${teamRoleLabel(inv.role).toLowerCase()}` : ''
      toast(accept ? `Ya eres parte de ${inv.team.name}${asRole}` : 'Invitación rechazada', accept ? 'success' : 'info')
      if (accept) {
        onJoined?.(result.team)
        navigate(`/jugador/equipos?perfilEquipo=${encodeURIComponent(inv.team.publicCode || inv.team.id)}`)
      }
    } catch (err) {
      // El motivo exacto viene del servidor (ya estas en otro equipo de ese juego, equipo lleno...).
      toast(err.message || 'No se pudo responder la invitación.', 'error')
      if (err?.status === 404 || err?.status === 410) setInvitations(prev => prev.filter(item => item.id !== inv.id))
    } finally {
      setBusyId('')
    }
  }

  if (!invitations.length) return null

  return (
    <section className="pp-invites">
      <div className="pp-invites__head">
        <b>{Icon.mail} Invitaciones de equipos</b>
        <span>{invitations.length}</span>
      </div>
      {invitations.map(inv => (
        <article className="pp-invite" key={inv.id}>
          <div className="pp-invite__logo">
            {inv.team.logo ? <img src={inv.team.logo} alt="" /> : <span>{(inv.team.tag || inv.team.name || '?').slice(0, 3)}</span>}
          </div>
          <div className="pp-invite__body">
            <b data-no-translate>{inv.team.name}</b>
            <span className={`pp-invite__role pp-invite__role--${inv.role || 'player'}`}>
              {inv.role && inv.role !== 'player' ? `Te invitan como ${teamRoleLabel(inv.role).toLowerCase()} · staff` : 'Te invitan como jugador'}
            </span>
            <small>
              {[inv.team.game, inv.team.university ? `Equipo universitario · ${inv.team.university}` : ''].filter(Boolean).join(' · ')}
            </small>
            {inv.message && <p>“{inv.message}”</p>}
          </div>
          <div className="pp-invite__actions">
            <button type="button" className="pp-invite__btn pp-invite__btn--ghost" onClick={() => navigate(`/equipos/${inv.team.publicCode || inv.team.id}`)}>
              {Icon.eye} Ver equipo
            </button>
            <button type="button" className="pp-invite__btn pp-invite__btn--ghost" disabled={busyId === inv.id} onClick={() => respond(inv, false)}>
              {Icon.x} Rechazar
            </button>
            <button type="button" className="pp-invite__btn" disabled={busyId === inv.id} onClick={() => respond(inv, true)}>
              {Icon.check} Aceptar
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}

