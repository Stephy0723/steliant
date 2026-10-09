import { PLATFORM_ROLES } from './roleApplications.mjs'

const ROLE_META = Object.fromEntries(PLATFORM_ROLES.map(r => [r.id, r]))

// "Lo basico" de un perfil de staff: todo profileField que el formulario de
// solicitud de rol no marca como "(Opcional)" en su propio label. Usado tanto
// para ocultar perfiles incompletos del buscador de staff como para el aviso
// en el panel de cada rol (Coach/Caster/Analista/...) de que le falta
// completar el suyo, y en el servidor para exigirlo al postularse a staff.
export const isFieldOptional = (field) => Boolean(field?.optional) || /\(opcional\)/i.test(field?.label || '')

export function requiredProfileFieldIds(role) {
  const fields = ROLE_META[role]?.profileFields || []
  return fields.filter(f => !isFieldOptional(f)).map(f => f.id)
}

export function missingProfileFields(role, details) {
  const fields = ROLE_META[role]?.profileFields || []
  return requiredProfileFieldIds(role)
    .filter(id => !details?.[id])
    .map(id => fields.find(f => f.id === id)?.label?.replace(/\s*\(opcional\)/i, '') || id)
}

export function isProfileComplete(role, details) {
  return missingProfileFields(role, details).length === 0
}

