// Que roles de staff de un torneo pertenecen a cada panel de rol. Un torneo
// donde te contrataron como Caster va al panel de Caster, no al de Analista:
// /tournaments/staff/mine devuelve TODOS los torneos donde eres staff aceptado
// (cada fila trae `staffRole`), asi que cada panel debe quedarse con los suyos.
// Claves normalizadas (minusculas, sin acentos).
const PANEL_STAFF_ROLES = {
  caster: ['caster'],
  analyst: ['analista'],
  coach: ['coach'],
  moderator: ['moderador', 'arbitro', 'produccion'],
}

const norm = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function filterStaffTournamentsForPanel(tournaments, panelRole) {
  const allowed = PANEL_STAFF_ROLES[panelRole]
  const list = Array.isArray(tournaments) ? tournaments : []
  if (!allowed) return list
  return list.filter(t => allowed.includes(norm(t.staffRole)))
}

