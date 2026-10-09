import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { I } from '../SocialKit/SocialKit.jsx'
import { TEAM_ROLES, teamRoleLabel } from '../../../../shared/teamRoles.mjs'
import './UserActions.css'

// "Invitar a mi equipo" desde el menu de un amigo: los equipos que lidero y,
// para cada uno, si este jugador cumple los requisitos (universidad
// verificada, un equipo por juego, cupo...). El backend decide y da el motivo.
// Se elige con que rol entra: jugador o staff (coach, analista, manager).
export default function InviteToTeamModal({ user, open, onClose }) {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  const navigate = useNavigate()
  const userId = String(user?._id || user?.id || '')
  const nick = user?.nick || user?.name || ''
  const [teams, setTeams] = useState(null)
  const [busyTeam, setBusyTeam] = useState('')
  const [role, setRole] = useState('player')

  useEffect(() => {
    if (!open || !userId) return undefined
    let cancelled = false
    setTeams(null)
    api(`/teams/invite-options/${encodeURIComponent(userId)}?role=${role}`)
      .then(data => { if (!cancelled) setTeams(data.teams || []) })
      .catch(() => { if (!cancelled) setTeams([]) })
    return () => { cancelled = true }
  }, [open, userId, role])

  if (!open) return null

  const roleName = item => teamRoleLabel(item, isEs ? 'es' : 'en')
  const invite = async (team) => {
    setBusyTeam(team.teamId)
    try {
      await api(`/teams/${encodeURIComponent(team.teamId)}/invitations`, { method: 'POST', body: { userId, role } })
      setTeams(prev => (prev || []).map(t => (t.teamId === team.teamId ? { ...t, canInvite: false, code: 'invited', reason: isEs ? 'Invitación enviada' : 'Invitation sent' } : t)))
      const asRole = role === 'player' ? '' : (isEs ? ` como ${roleName(role).toLowerCase()}` : ` as ${roleName(role).toLowerCase()}`)
      toast(isEs ? `Invitaste a @${nick} a ${team.name}${asRole}` : `You invited @${nick} to ${team.name}${asRole}`, 'success')
    } catch (err) {
      toast(err.message || (isEs ? 'No se pudo invitar' : 'Could not invite'), 'error')
    } finally {
      setBusyTeam('')
    }
  }

  return (
    <div className="ua-modal" role="presentation" onMouseDown={onClose}>
      <div className="ua-dialog ua-invite" role="dialog" aria-modal="true" aria-label={isEs ? 'Invitar a mi equipo' : 'Invite to my team'} onMouseDown={event => event.stopPropagation()}>
        <button type="button" className="ua-close" aria-label={isEs ? 'Cerrar' : 'Close'} onClick={onClose}><I name="x" size={18} /></button>
        <h2>{isEs ? `Invitar a @${nick}` : `Invite @${nick}`}</h2>
        <p>{isEs ? 'Elige uno de los equipos que lideras. Le llegará una notificación y podrá aceptar desde Mis equipos.' : 'Pick one of the teams you lead. They get a notification and can accept from My teams.'}</p>
        <div className="ua-invite__roles" role="radiogroup" aria-label={isEs ? 'Invitar como' : 'Invite as'}>
          {TEAM_ROLES.map(item => (
            <button key={item} type="button" role="radio" aria-checked={role === item} className={'ua-invite__role' + (role === item ? ' is-active' : '')} onClick={() => setRole(item)}>
              {roleName(item)}
            </button>
          ))}
        </div>
        {role !== 'player' && (
          <p className="ua-invite__note">{isEs ? 'El staff tiene su propio cupo: no le quita lugar a ningún jugador.' : 'Staff has its own slots: it never takes a player spot.'}</p>
        )}

        {teams === null ? (
          <p className="ua-invite__empty">{isEs ? 'Cargando tus equipos…' : 'Loading your teams…'}</p>
        ) : teams.length === 0 ? (
          <div className="ua-invite__empty">
            <p>{isEs ? 'No eres líder de ningún equipo.' : 'You do not lead any team.'}</p>
            <button type="button" className="ua-btn ua-btn--ghost" onClick={() => { onClose(); navigate('/equipos') }}>{isEs ? 'Crear un equipo' : 'Create a team'}</button>
          </div>
        ) : (
          <div className="ua-invite__list">
            {teams.map(team => (
              <div className={'ua-invite__row' + (team.canInvite ? '' : ' is-blocked')} key={team.teamId}>
                <div className="ua-invite__logo">{team.logo ? <img src={team.logo} alt="" /> : <span>{(team.tag || team.name || '?').slice(0, 3)}</span>}</div>
                <div className="ua-invite__info">
                  <b data-no-translate>{team.name}</b>
                  <small>
                    {team.canInvite
                      ? [team.game, team.university ? (isEs ? `Universitario · ${team.university}` : `University · ${team.university}`) : ''].filter(Boolean).join(' · ')
                      : team.reason}
                  </small>
                </div>
                <button type="button" className="ua-btn ua-btn--primary ua-invite__btn" disabled={!team.canInvite || busyTeam === team.teamId} onClick={() => invite(team)}>
                  {team.code === 'invited' ? (isEs ? 'Invitado' : 'Invited') : (isEs ? 'Invitar' : 'Invite')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

