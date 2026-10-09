import { useEffect, useState } from 'react'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { TEAM_ROLES, teamRoleLabel } from '../../../../../shared/teamRoles.mjs'
import NickSuggest from '../../../components/NickSuggest/NickSuggest.jsx'

// Que significa cada rol al invitar (cupos y reglas de shared/teamRoles.mjs).
const ROLE_HINT = {
  player: 'Ocupa un lugar de jugador (titular o suplente) y debe cumplir las reglas del equipo.',
  coach: 'Entra al staff con su propio cupo: no le quita lugar a ningún jugador. Máximo 2 (principal y asistente).',
  analyst: 'Entra al staff con su propio cupo. Máximo 2.',
  manager: 'Entra al staff con su propio cupo. Uno por equipo.',
}

const STATUS_LABEL = {
  pending: 'Esperando respuesta',
  accepted: 'Aceptó',
  declined: 'Rechazó',
  cancelled: 'Cancelada',
  expired: 'Venció',
}

// El lider invita a un jugador por su nick; el jugador acepta o rechaza desde
// Mis equipos (/jugador/equipos). En un equipo universitario solo se puede
// invitar a estudiantes verificados de la misma universidad (lo valida el
// backend con las mismas reglas que una solicitud).
export default function TeamInvitations({ team }) {
  const teamId = team?.id || team?._id
  const university = team?.university?.isUniversityTeam ? (team.university.universityName || team.university.universityTag) : ''
  const [nick, setNick] = useState('')
  // Sugerencia elegida (NickSuggest): se invita por su id exacto, no por el texto.
  const [picked, setPicked] = useState(null)
  const [message, setMessage] = useState('')
  // Con que rol se invita: jugador o staff (coach, analista, manager).
  const [role, setRole] = useState('player')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [invitations, setInvitations] = useState(null)
  const [busyId, setBusyId] = useState('')
  // Amigos del lider con si cumplen o no (y por que), calculado en el backend
  // con las mismas reglas que invitar por nick.
  const [friends, setFriends] = useState(null)
  const [showBlocked, setShowBlocked] = useState(false)

  const load = () => api(`/teams/${encodeURIComponent(teamId)}/invitations`)
    .then(data => setInvitations(data.invitations || []))
    .catch(() => setInvitations([]))
  const loadFriends = (forRole = role) => api(`/teams/${encodeURIComponent(teamId)}/invitable-friends?role=${forRole}`)
    .then(data => setFriends(data.friends || []))
    .catch(() => setFriends([]))

  useEffect(() => {
    if (teamId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // Quien puede entrar depende del rol (el staff no tiene las reglas de jugador).
  useEffect(() => {
    if (!teamId) return
    setFriends(null)
    loadFriends(role)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, role])

  const inviteFriend = async (friend) => {
    setBusyId(friend.id)
    try {
      const { invitation } = await api(`/teams/${encodeURIComponent(teamId)}/invitations`, {
        method: 'POST',
        body: { userId: friend.id, role },
      })
      setInvitations(prev => [invitation, ...(prev || [])])
      setFriends(prev => (prev || []).map(f => (f.id === friend.id ? { ...f, canInvite: false, code: 'invited', reason: 'Invitación enviada' } : f)))
      toast(`Invitación enviada a ${friend.nick}${role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}`}`)
    } catch (err) {
      toast(err.message || 'No se pudo invitar.', 'error')
      loadFriends()
    } finally {
      setBusyId('')
    }
  }

  const send = async (event) => {
    event.preventDefault()
    if (!nick.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const { invitation } = await api(`/teams/${encodeURIComponent(teamId)}/invitations`, {
        method: 'POST',
        body: { ...(picked ? { userId: picked.id } : { nick: nick.trim() }), message: message.trim(), role },
      })
      setInvitations(prev => [invitation, ...(prev || [])])
      setNick('')
      setPicked(null)
      setMessage('')
      toast(`Invitación enviada a ${invitation.user?.nick || nick}${role === 'player' ? '' : ` como ${teamRoleLabel(role).toLowerCase()}`}`)
      loadFriends()
    } catch (err) {
      // El motivo exacto (otra universidad, ya esta en otro equipo del juego...) viene del servidor.
      setError(err.message || 'No se pudo enviar la invitación.')
    } finally {
      setSending(false)
    }
  }

  const cancel = async (inv) => {
    setBusyId(inv.id)
    try {
      const { invitation } = await api(`/teams/${encodeURIComponent(teamId)}/invitations/${inv.id}`, { method: 'DELETE' })
      setInvitations(prev => (prev || []).map(item => (item.id === inv.id ? invitation : item)))
    } catch (err) {
      toast(err.message || 'No se pudo cancelar.', 'error')
      load()
    } finally {
      setBusyId('')
    }
  }

  const pending = (invitations || []).filter(inv => inv.status === 'pending')
  const history = (invitations || []).filter(inv => inv.status !== 'pending').slice(0, 8)
  const invitable = (friends || []).filter(f => f.canInvite)
  // Los que ya estan en el equipo no aportan nada en la lista.
  const blocked = (friends || []).filter(f => !f.canInvite && f.code !== 'member')

  return (
    <div className="mtp-invite">
      <div className="mtp-invite__roles" role="radiogroup" aria-label="Invitar como">
        <span>Invitar como</span>
        {TEAM_ROLES.map(item => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={role === item}
            className={`mtp-invite__role ${role === item ? 'is-active' : ''}`}
            onClick={() => { setRole(item); setError('') }}
          >
            {teamRoleLabel(item)}
          </button>
        ))}
      </div>
      <p className="mtp-invite__hint">
        {role !== 'player'
          ? <>{ROLE_HINT[role]} Le llega una notificación y acepta desde <b>Mis equipos</b>.</>
          : university
            ? <>Invita por su nick a estudiantes <b>verificados de {university}</b>. Le llega una notificación y acepta desde <b>Mis equipos</b>.</>
            : <>Invita a un jugador por su nick. {ROLE_HINT.player} Le llega una notificación y acepta desde <b>Mis equipos</b>.</>}
      </p>
      <form className="mtp-invite__form" onSubmit={send}>
        <NickSuggest
          teamId={teamId}
          role={role}
          value={nick}
          onChange={text => { setNick(text); setError('') }}
          onPick={setPicked}
          placeholder={`${role === 'player' ? 'Nick del jugador' : `Nick del ${teamRoleLabel(role).toLowerCase()}`}: tus amigos salen primero`}
        />
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Mensaje (opcional)"
          maxLength={280}
        />
        <button type="submit" className="pnl-btn pnl-btn--primary" disabled={!nick.trim() || sending}>
          {Icon.send} {sending ? 'Enviando...' : 'Invitar'}
        </button>
      </form>
      {error && <p className="mtp-invite__error">{Icon.alert} {error}</p>}

      <div className="mtp-invite__list">
        <b>Tus amigos {friends ? `(${invitable.length} pueden entrar)` : ''}</b>
        {friends === null ? (
          <small className="mtp-invite__hint">Cargando amigos...</small>
        ) : friends.length === 0 ? (
          <small className="mtp-invite__hint">Todavía no tienes amigos en GlitchGang. Agrégalos desde <b>Amigos</b> y aparecerán aquí.</small>
        ) : (
          <>
            {invitable.map(friend => (
              <div className="mtp-invite__row" key={friend.id}>
                <span data-no-translate>{friend.nick}</span>
                <small>{friend.university || 'Cumple los requisitos'}</small>
                <button type="button" className="pnl-btn pnl-btn--primary" disabled={busyId === friend.id} onClick={() => inviteFriend(friend)}>
                  {Icon.send} Invitar
                </button>
              </div>
            ))}
            {invitable.length === 0 && <small className="mtp-invite__hint">Ninguno de tus amigos cumple los requisitos de este equipo ahora mismo.</small>}
            {blocked.length > 0 && (
              <button type="button" className="mtp-invite__toggle" onClick={() => setShowBlocked(v => !v)}>
                {showBlocked ? 'Ocultar' : `Ver ${blocked.length} que no pueden entrar y por qué`}
              </button>
            )}
            {showBlocked && blocked.map(friend => (
              <div className="mtp-invite__row mtp-invite__row--blocked" key={friend.id}>
                <span data-no-translate>{friend.nick}</span>
                <small>{friend.reason}</small>
              </div>
            ))}
          </>
        )}
      </div>

      {invitations === null ? (
        <p className="mtp-invite__hint">Cargando invitaciones...</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mtp-invite__list">
              <b>Pendientes ({pending.length})</b>
              {pending.map(inv => (
                <div className="mtp-invite__row" key={inv.id}>
                  <span data-no-translate>{inv.user?.nick || 'Jugador'}</span>
                  <small>
                    {inv.role && inv.role !== 'player' && <em className="mtp-invite__role-tag">{teamRoleLabel(inv.role)}</em>}
                    Vence {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' }) : ''}
                  </small>
                  <button type="button" className="pnl-btn pnl-btn--danger" disabled={busyId === inv.id} onClick={() => cancel(inv)}>
                    {Icon.x} Cancelar
                  </button>
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <div className="mtp-invite__list">
              <b>Recientes</b>
              {history.map(inv => (
                <div className={`mtp-invite__row mtp-invite__row--${inv.status}`} key={inv.id}>
                  <span data-no-translate>{inv.user?.nick || 'Jugador'}</span>
                  <small>
                    {inv.role && inv.role !== 'player' && <em className="mtp-invite__role-tag">{teamRoleLabel(inv.role)}</em>}
                    {STATUS_LABEL[inv.status] || inv.status}
                  </small>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

