// A donde mandar a cada rol cuando no puede quedarse donde estaba
// (ej. staff que intenta entrar a un torneo que no le corresponde, o al
// panel de cuenta del organizador sin serlo). Compartido entre el guard de
// staff de torneo y el layout del organizador para no duplicar el mapa.
const ROLE_DASHBOARD_PATH = {
  admin: '/organizador',
  organizer: '/organizador',
  caster: '/caster',
  analyst: '/analista',
  moderator: '/moderador',
  coach: '/coach',
  creator: '/creador',
  brand: '/marca',
}

export function roleDashboardPath(role) {
  return ROLE_DASHBOARD_PATH[role] || '/dashboard'
}

