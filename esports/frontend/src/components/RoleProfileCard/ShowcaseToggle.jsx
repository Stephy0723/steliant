import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { resolveShowcase, saveShowcase } from '../../lib/showcaseCards.js'
import { toast } from '../../lib/toast.js'
import './ProfileCardShowcase.css'

// "Mostrar esta tarjeta en mi perfil principal": agrega o quita `role` de las
// tarjetas que se ven en /perfil (ver ProfileCardShowcase). Guarda al instante.
export default function ShowcaseToggle({ role }) {
  const { user, updateUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const selection = resolveShowcase(user, { owner: true })
  const on = selection.includes(role)

  const change = async () => {
    if (busy) return
    const next = on ? selection.filter(id => id !== role) : [...selection, role]
    if (!next.length) next.push('player')
    setBusy(true)
    try {
      const { persisted } = await saveShowcase(next, user, updateUser)
      toast(
        on ? 'Tarjeta quitada de tu perfil principal' : 'Tarjeta agregada a tu perfil principal',
        persisted ? 'success' : 'info',
      )
    } catch (err) {
      toast(err?.message || 'No se pudo actualizar tu perfil principal', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="rpp__toggle">
      <input type="checkbox" checked={on} onChange={change} disabled={busy} />
      <span>Mostrar esta tarjeta en mi perfil principal</span>
    </label>
  )
}

