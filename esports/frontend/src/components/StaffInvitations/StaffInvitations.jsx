import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import GGLoader from '../GGLoader/GGLoader.jsx'
import { tournamentsApi } from '../../lib/serverApi.js'
import './StaffInvitations.css'

// Invitaciones de staff pendientes para el usuario actual. `compact` para
// incrustar arriba de un panel de rol; sin `compact` es la vista de pagina.
export default function StaffInvitations({ compact = false }) {
  const [items, setItems] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notes, setNotes] = useState({})

  const load = useCallback(() => {
    tournamentsApi.staffMine('pending')
      .then(data => setItems(data.tournaments || []))
      .catch(() => setItems([]))
  }, [])
  useEffect(load, [load])

  const respond = async (tournament, decision) => {
    setBusyId(tournament._id)
    setError('')
    try {
      await tournamentsApi.respondStaffInvite(tournament.publicId || tournament._id, decision, notes[tournament._id] || '')
      setItems(list => list.filter(t => t._id !== tournament._id))
      setNotes(current => {
        const next = { ...current }
        delete next[tournament._id]
        return next
      })
    } catch (err) {
      setError(err.message || 'No se pudo responder la invitacion.')
    } finally {
      setBusyId('')
    }
  }

  if (items === null) return compact ? null : <GGLoader label="Sincronizando invitaciones" size="sm" className="gg-staff-inv__empty" />
  if (!items.length) {
    return compact ? null : <p className="gg-staff-inv__empty">No tienes invitaciones de staff pendientes.</p>
  }

  return (
    <section className={`gg-staff-inv${compact ? ' gg-staff-inv--compact' : ''}`}>
      <header className="gg-staff-inv__head">
        {Icon.team}
        <div>
          <h3>Invitaciones para tu panel de rol{items.length > 1 ? ` (${items.length})` : ''}</h3>
          <p>Responde desde aqui antes de coordinar horario, reglas o produccion.</p>
        </div>
      </header>
      {error && <p className="gg-staff-inv__error" role="alert">{error}</p>}
      <ul>
        {items.map(t => (
          <li key={t._id}>
            <div className="gg-staff-inv__info">
              <div className="gg-staff-inv__eyebrow">
                <span>{t.staffRole || 'Staff'}</span>
                {t.game && <span>{t.game}</span>}
              </div>
              <b><Link to={`/torneos/${t.publicId || t._id}`}>{t.title}</Link></b>
              <p>
                {t.organizer?.nick || 'El organizador'} te invito a formar parte del staff de este torneo como <strong>{t.staffRole || 'staff'}</strong>.
                Revisa disponibilidad, responsabilidades y reglas antes de responder.
              </p>
              <label className="gg-staff-inv__note">
                <span>Mensaje opcional para el organizador</span>
                <textarea
                  rows={2}
                  value={notes[t._id] || ''}
                  onChange={e => setNotes(current => ({ ...current, [t._id]: e.target.value }))}
                  placeholder="Ej. Puedo cubrir la final, pero necesito confirmar el horario."
                />
              </label>
            </div>
            <div className="gg-staff-inv__actions">
              <button type="button" className="gg-staff-inv__accept" disabled={busyId === t._id}
                onClick={() => respond(t, 'accept')}>{Icon.check} Aceptar</button>
              <button type="button" className="gg-staff-inv__decline" disabled={busyId === t._id}
                onClick={() => respond(t, 'decline')}>{Icon.x} Rechazar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

