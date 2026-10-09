import { useState } from 'react'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { rosterSlotPositionLabel } from '../../../data/rosterSlots.js'
import NickSuggest from '../../../components/NickSuggest/NickSuggest.jsx'
import { staffRoleOfSlot, teamRoleLabel } from '../../../../../shared/teamRoles.mjs'

// "Asignar" un puesto vacio del plantel. Un puesto de jugador o staff solo lo
// ocupa una cuenta que ACEPTO entrar y paso las reglas del equipo, asi que hay
// dos caminos (escribir un nick a mano no valida nada y el servidor lo rechaza):
//   1. Un miembro del equipo: se mueve a este puesto (mismo rol) o se le
//      cambia el rol (jugador <-> staff, con sus reglas).
//   2. Alguien de afuera: se le manda una invitacion con el rol del puesto;
//      entra cuando acepta.
export default function SlotAssignPanel({ slot, team, members = [], leaderId = '', busy = false, onMove, onChangeRole, onClose }) {
  const [nick, setNick] = useState('')
  // Sugerencia elegida: se invita por su id exacto, no por el texto.
  const [picked, setPicked] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const teamId = team?.id || team?._id
  const slotRole = staffRoleOfSlot(slot) || 'player'
  const roleName = teamRoleLabel(slotRole).toLowerCase()
  const slotLabel = rosterSlotPositionLabel(slot, team?.game)
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}

  // Donde esta hoy cada miembro (y con que rol).
  const rows = members
    .filter(m => m && (m._id || m.id))
    .map(m => {
      const id = String(m._id || m.id)
      const current = Object.entries(slots).find(([, value]) => String(value?.userId || '') === id)?.[0] || ''
      return { id, nick: m.nick || 'Miembro', avatar: m.avatar || '', current, role: staffRoleOfSlot(current) || 'player', isLeader: id === leaderId }
    })
    // El lider (quien esta asignando) no aparece: asi no se mueve de puesto
    // por accidente. Su puesto lo cambia desde su propia ficha.
    .filter(row => row.current !== slot && !row.isLeader)
  const sameRole = rows.filter(row => row.role === slotRole)
  const otherRole = rows.filter(row => row.role !== slotRole)

  const invite = async (event) => {
    event.preventDefault()
    if (!nick.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const { invitation } = await api(`/teams/${encodeURIComponent(teamId)}/invitations`, {
        method: 'POST',
        body: { ...(picked ? { userId: picked.id } : { nick: nick.trim() }), message: message.trim(), role: slotRole },
      })
      toast(`Invitación enviada a ${invitation?.user?.nick || nick} como ${roleName}`, 'success')
      setNick('')
      setPicked(null)
      setMessage('')
    } catch (err) {
      // Motivo real del servidor: no existe, no cumple las reglas, cupo lleno...
      setError(err?.message || 'No se pudo enviar la invitación.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mtp-assign">
      <h3 className="mtp-section-heading mtp-roster-heading mtp-roster-heading--editor">
        <span className="mtp-title-icon">{Icon.plus}</span> Asignar
        <button className="mtp-roster-editor__close" type="button" aria-label="Cerrar" onClick={onClose}>{Icon.x}</button>
      </h3>
      <p className="mtp-assign__lead">
        Este puesto es de <b>{roleName}</b>. Solo lo ocupa alguien con cuenta que aceptó entrar al equipo: así se revisan las reglas y nadie aparece en tu plantel sin saberlo.
      </p>

      <section className="mtp-assign__block">
        <b>{Icon.users} Alguien que ya está en el equipo</b>
        {sameRole.length === 0 && otherRole.length === 0 && (
          <small className="mtp-assign__hint">Todavía no hay otros miembros. Invita a alguien abajo.</small>
        )}
        {sameRole.map(row => (
          <div className="mtp-assign__row" key={row.id}>
            <span data-no-translate>{row.nick}</span>
            <small>{row.current ? `Hoy: ${rosterSlotPositionLabel(row.current, team?.game)}` : 'Sin puesto'}</small>
            <button type="button" className="pnl-btn pnl-btn--primary pnl-btn--small" disabled={busy} onClick={() => onMove?.(row.id, slot)}>
              {Icon.check} Poner aquí
            </button>
          </div>
        ))}
        {otherRole.map(row => (
          <div className="mtp-assign__row" key={row.id}>
            <span data-no-translate>{row.nick}</span>
            <small>Hoy es {teamRoleLabel(row.role).toLowerCase()}</small>
            <button type="button" className="pnl-btn pnl-btn--small" disabled={busy} onClick={() => onChangeRole?.(row.current, row.id, slotRole)}>
              {Icon.refresh || Icon.check} Pasar a {roleName}
            </button>
          </div>
        ))}
      </section>

      <form className="mtp-assign__block" onSubmit={invite}>
        <b>{Icon.send} Invitar a alguien a este puesto</b>
        <small className="mtp-assign__hint">
          Le llega una notificación “te invitan como {roleName}”. Cuando acepte entra al primer puesto libre de {roleName}; si quieres, después lo mueves aquí.
        </small>
        <NickSuggest
          teamId={teamId}
          role={slotRole}
          value={nick}
          onChange={text => { setNick(text); setError('') }}
          onPick={setPicked}
          placeholder={`Nick del ${roleName}: tus amigos salen primero`}
        />
        <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Mensaje (opcional)" maxLength={280} />
        {error && <p className="mtp-assign__error">{Icon.alert} {error}</p>}
        <button type="submit" className="pnl-btn pnl-btn--primary" disabled={!nick.trim() || sending}>
          {Icon.send} {sending ? 'Enviando…' : `Invitar como ${roleName}`}
        </button>
      </form>
    </div>
  )
}

