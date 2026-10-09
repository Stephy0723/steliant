import { Icon } from '../icons/Icons.jsx'
import { missingProfileFields } from '../../lib/roleProfileCompleteness.js'
import './ProfileCompletionBanner.css'

/**
 * Aviso persistente en el panel de un rol (Coach/Caster/Analista/...) cuando
 * a `user.roleProfiles.<role>.details` le falta algun campo basico -- ese
 * mismo criterio es el que usa RoleStaffSearch para ocultar la ficha del
 * buscador de staff del organizador, asi que esto le explica a la persona
 * por que nadie la encuentra.
 */
export default function ProfileCompletionBanner({ role, user }) {
  const details = user?.roleProfiles?.[role]?.details || {}
  const missing = missingProfileFields(role, details)
  if (!missing.length) return null
  return (
    <div className="pnl-profile-banner">
      {Icon.alert}
      <p>
        Tu perfil profesional esta incompleto — te falta <b>{missing.join(', ')}</b>.
        Los organizadores no te van a poder encontrar en el buscador de staff hasta que lo completes.
      </p>
    </div>
  )
}

