// Candado de la estructura competitiva una vez que el bracket existe. Lo usan
// la pestana Competencia del panel (frontend/src/lib/competitionChanges.js) y
// updateTournament/saveBracket en el backend: misma regla en los dos lados.
import { competitionPhases, initialCompetition, bracketRoundKeys } from './tournamentSetup.mjs'

/**
 * Estado del bracket guardado para decidir que se bloquea:
 * - generated: el bracket ya se publico o arranco -> sistema, cupos, grupos y
 *   puntuacion quedan fijos (cambiarlos exige regenerar el bracket).
 * - playedRounds: claves de ronda (las mismas de competitionPhases) con al
 *   menos un resultado confirmado -> su serie (BO) ya no se toca.
 */
export function bracketLock(bracket, competition, maxSlots) {
  const c = { ...initialCompetition(), ...(competition || {}) }
  const results = bracket?.results || {}
  const confirmed = Object.keys(results).filter(id => results[id]?.confirmed)
  const teamCount = (bracket?.teams || []).filter(name => name && name !== 'BYE').length || Number(maxSlots) || 2
  const played = new Set()
  let leaguePlayed = false

  // Los IDs de partido los genera shared/bracketEngine.mjs: `<prefijo>-r<N>-m<M>`
  // en las llaves (N = ronda desde la primera), `gf` la gran final, y
  // `rr-*` / `grp<G>-*` los partidos de liga (sin jornada en el ID).
  for (const id of confirmed) {
    let m
    if ((m = /^(se|wb)-r(\d+)-/.exec(id))) {
      const key = bracketRoundKeys(teamCount)[Number(m[2])]
      if (key) played.add(key)
    } else if ((m = /^gpo-r(\d+)-/.exec(id))) {
      const key = bracketRoundKeys(c.groups * c.advancePerGroup)[Number(m[1])]
      if (key) played.add(key)
    } else if ((m = /^sw-r(\d+)-/.exec(id))) {
      played.add(`suiza_${Number(m[1]) + 1}`)
    } else if (id === 'gf') {
      played.add('grand_final')
    } else if (/^(rr|grp\d+)-/.test(id)) {
      leaguePlayed = true
    }
  }
  // Los partidos de liga no dicen a que jornada pertenecen: con uno jugado,
  // la fase de liga entera cuenta como en juego.
  if (leaguePlayed) {
    for (const phase of competitionPhases(c, maxSlots)) {
      if (phase.id === 'playoffs') continue
      for (const round of phase.rounds) played.add(round.key)
    }
  }

  return {
    generated: Boolean(bracket?.published) || ['running', 'finished'].includes(bracket?.status),
    finished: bracket?.status === 'finished',
    confirmedCount: confirmed.length,
    playedRounds: played,
  }
}

// Campos de `competition` que quedan fijos con el bracket generado (el BO,
// defaultSeries/seriesByRound, si se puede cambiar mientras la ronda no se jugo).
export const LOCKED_COMPETITION_FIELDS = [
  'system', 'groups', 'advancePerGroup', 'groupsPhaseSystem', 'playoffsSystem',
  'swissRounds', 'legs', 'thirdPlace', 'grandFinalReset', 'scoring',
]

/**
 * Motivo por el que no se puede pasar de `before` a `after` con este bracket,
 * o null si se puede. `before`/`after` = { competition, maxSlots }.
 */
export function competitionLockViolation(bracket, before, after) {
  const lock = bracketLock(bracket, before.competition, before.maxSlots)
  const a = { ...initialCompetition(), ...(before.competition || {}) }
  const b = { ...initialCompetition(), ...(after.competition || {}) }
  if (lock.generated) {
    const field = LOCKED_COMPETITION_FIELDS.find(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    if (field) return `El bracket ya esta generado: no se puede cambiar "${field}" sin regenerarlo.`
    if (Number(before.maxSlots) !== Number(after.maxSlots)) return 'El bracket ya esta generado: no se pueden cambiar los cupos sin regenerarlo.'
  }
  if (lock.confirmedCount > 0 && a.defaultSeries !== b.defaultSeries) {
    return 'Ya hay resultados confirmados: la serie por defecto no se puede cambiar.'
  }
  for (const key of lock.playedRounds) {
    const was = a.seriesByRound?.[key] || a.defaultSeries
    const now = b.seriesByRound?.[key] || b.defaultSeries
    if (was !== now) return 'Esa ronda ya tiene resultados confirmados: su serie no se puede cambiar.'
  }
  return null
}

