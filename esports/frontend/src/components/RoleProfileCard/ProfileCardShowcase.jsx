import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import RoleProfileCard from './RoleProfileCard.jsx'
import { PLATFORM_ROLES } from '../../data/roleApplications.js'
import { availableCards, resolveShowcase, saveShowcase } from '../../lib/showcaseCards.js'
import { toast } from '../../lib/toast.js'
import './ProfileCardShowcase.css'

const labelFor = (id) => (id === 'player' ? 'Jugador' : id === 'proplayer' ? 'Jugador Pro' : PLATFORM_ROLES.find(r => r.id === id)?.label || id)

// Tarjeta del perfil principal: la de jugador (`playerCard`, ya armada por
// Profile.jsx) y/o la tarjeta profesional de cada rol. Con varias elegidas se
// cambia entre ellas con pestanas; el dueno elige cuales mostrar.
export default function ProfileCardShowcase({ user, isOwner, playerCard, updateUser }) {
  const selection = resolveShowcase(user, { owner: isOwner })
  const [active, setActive] = useState(selection[0])
  const [managing, setManaging] = useState(false)
  const [draft, setDraft] = useState(selection)
  const [saving, setSaving] = useState(false)
  const available = availableCards(user)

  const key = selection.join('|')
  useEffect(() => {
    setDraft(selection)
    setActive(current => (selection.includes(current) ? current : selection[0]))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setDraft(prev => {
    if (prev.includes(id)) return prev.length > 1 ? prev.filter(x => x !== id) : prev
    return [...prev, id]
  })

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const { persisted } = await saveShowcase(draft, user, updateUser)
      // El servidor sí guarda showcaseCards; "no persistido" solo pasa cuando
      // descarta tarjetas de un rol que la persona aún no tiene aprobado.
      toast(persisted ? 'Tarjetas del perfil actualizadas' : 'Guardado. Algunas tarjetas no se muestran porque requieren un rol aprobado.', persisted ? 'success' : 'info')
      setManaging(false)
    } catch (err) {
      toast(err?.message || 'No se pudo guardar la selección de tarjetas', 'error')
    } finally {
      setSaving(false)
    }
  }

  const shown = selection.includes(active) ? active : selection[0]

  return (
    <div className="pcs">
      {selection.length > 1 && (
        <div className="pcs__tabs" role="tablist" aria-label="Tarjetas del perfil">
          {selection.map(id => (
            <button key={id} type="button" role="tab" aria-selected={shown === id} className={`pcs__tab${shown === id ? ' is-on' : ''}`} onClick={() => setActive(id)}>
              {labelFor(id)}
            </button>
          ))}
        </div>
      )}

      {shown === 'player' ? playerCard : <RoleProfileCard role={shown} user={user} width={300} />}

      {isOwner && available.length > 1 && (
        <div className="pcs__manage">
          <button type="button" className="pcs__link" onClick={() => setManaging(v => !v)} aria-expanded={managing}>
            {Icon.edit} {managing ? 'Cerrar' : 'Elegir tarjetas del perfil'}
          </button>
          {managing && (
            <div className="pcs__panel">
              <p>Elige cuáles tarjetas se muestran en tu perfil principal. Con varias, quien te visite puede cambiar entre ellas.</p>
              <div className="pcs__opts">
                {available.map(id => (
                  <label key={id} className={`pcs__opt${draft.includes(id) ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={draft.includes(id)} onChange={() => toggle(id)} />
                    {labelFor(id)}
                  </label>
                ))}
              </div>
              <button type="button" className="pcs__save" onClick={save} disabled={saving}>{Icon.check} {saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

