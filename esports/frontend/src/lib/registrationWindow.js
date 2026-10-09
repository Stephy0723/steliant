// ¿Las fechas permiten inscribirse ahora? Mismo criterio que el servidor
// (registerTeamForUser en tournament.controller.js):
//  - antes de la apertura: 'not_open'
//  - pasado el cierre o con el torneo ya empezado: 'closed' / 'started'
//  - con lateRegistration (lo enciende el organizador) el cierre y el inicio
//    no cuentan: 'late'
// Solo mira fechas; estado, cupo y equipo los revisa cada pantalla.
//
// t: { registrationStart, registrationEnd, startsAt, lateRegistration }
export function registrationDateState(t, now = Date.now()) {
  const opens = Date.parse(t?.registrationStart || '')
  const closes = Date.parse(t?.registrationEnd || '')
  const starts = Date.parse(t?.startsAt || '')

  if (Number.isFinite(opens) && now < opens) return 'not_open'
  const pastClose = Number.isFinite(closes) && now > closes
  const started = Number.isFinite(starts) && now >= starts
  if (!pastClose && !started) return 'open'
  if (t?.lateRegistration) return 'late'
  return started ? 'started' : 'closed'
}

/** true si por fechas se puede inscribir (incluye inscripcion tardia). */
export function registrationOpenByDate(t, now = Date.now()) {
  const state = registrationDateState(t, now)
  return state === 'open' || state === 'late'
}

