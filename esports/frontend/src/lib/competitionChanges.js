// Pestaña Competencia del panel del organizador: qué cambió en la estructura
// competitiva (para el comunicado a jugadores y staff) y qué ya no se puede
// tocar porque el bracket existe o esa ronda ya se jugó.
import {
  COMPETITION_SYSTEMS, TIEBREAKER_LABELS, competitionPhases, initialCompetition,
} from '../../../shared/tournamentSetup.mjs'

// bracketLock vive en shared/ porque el backend aplica el mismo candado.
export { bracketLock } from '../../../shared/competitionLock.mjs'

const SUB_SYSTEM = { round_robin: 'Todos contra todos', swiss: 'Suizo', single_elim: 'Eliminacion simple', double_elim: 'Eliminacion doble' }
const yesNo = value => (value ? 'Si' : 'No')
const NEEDS_POINTS = c => COMPETITION_SYSTEMS[c.system]?.scoring === 'match_points' || c.system === 'groups_playoffs'

// Parametros que solo existen para ciertos sistemas. Si el sistema cambio, el
// "antes" de un parametro que el sistema viejo no tenia se muestra como "—"
// (no el default escondido, que confundiria a los equipos).
const PARAMS = [
  { label: 'Enfrentamientos', systems: ['round_robin'], read: c => (Number(c.legs) === 2 ? 'Ida y vuelta' : 'Solo ida') },
  { label: 'Rondas suizas', systems: ['swiss', 'groups_playoffs'], when: c => c.system === 'swiss' || c.groupsPhaseSystem === 'swiss', read: c => c.swissRounds },
  { label: 'Partido por el 3er puesto', systems: ['single_elim'], read: c => yesNo(c.thirdPlace) },
  { label: 'Reinicio en la gran final', systems: ['double_elim'], read: c => yesNo(c.grandFinalReset) },
  { label: 'Grupos', systems: ['groups_playoffs'], read: c => c.groups },
  { label: 'Clasifican por grupo', systems: ['groups_playoffs'], read: c => c.advancePerGroup },
  { label: 'Fase de grupos', systems: ['groups_playoffs'], read: c => SUB_SYSTEM[c.groupsPhaseSystem] },
  { label: 'Playoffs', systems: ['groups_playoffs'], read: c => SUB_SYSTEM[c.playoffsSystem] },
]

function paramValue(param, c) {
  if (!param.systems.includes(c.system)) return '—'
  if (param.when && !param.when(c)) return '—'
  return param.read(c)
}

function scoringText(c) {
  if (!NEEDS_POINTS(c) || c.scoring?.model !== 'match_points') return 'Por victorias'
  const s = c.scoring
  return `Victoria ${s.win} · Empate ${s.allowDraw ? s.draw : 'no'} · Derrota ${s.loss}`
}

const tiebreakText = c => (NEEDS_POINTS(c) && c.scoring?.model === 'match_points'
  ? (c.scoring.tiebreakers || []).map(t => TIEBREAKER_LABELS[t] || t).join(' > ')
  : '—')

/** Lista de { label, before, after } con lo que cambia entre dos configuraciones. */
export function competitionChanges(before, after, slotsBefore, slotsAfter) {
  const a = { ...initialCompetition(), ...(before || {}) }
  const b = { ...initialCompetition(), ...(after || {}) }
  const out = []
  const push = (label, x, y) => {
    if (String(x) !== String(y)) out.push({ label, before: String(x), after: String(y) })
  }

  push('Sistema', COMPETITION_SYSTEMS[a.system]?.label || a.system, COMPETITION_SYSTEMS[b.system]?.label || b.system)
  push('Cupos', slotsBefore, slotsAfter)
  for (const param of PARAMS) {
    const after = paramValue(param, b)
    // Un parametro que el sistema nuevo ya no usa no es un cambio que avisar.
    if (after === '—' && a.system !== b.system) continue
    push(param.label, paramValue(param, a), after)
  }
  push('Serie por defecto', a.defaultSeries, b.defaultSeries)

  // Serie ronda por ronda: solo las rondas con serie propia (antes o ahora).
  // Las que siguen la serie por defecto ya quedan cubiertas por esa linea.
  const roundsBefore = new Set(competitionPhases(a, slotsBefore).flatMap(p => p.rounds.map(r => r.key)))
  for (const phase of competitionPhases(b, slotsAfter)) {
    for (const round of phase.rounds) {
      const custom = a.seriesByRound?.[round.key] || b.seriesByRound?.[round.key]
      if (!custom) continue
      const was = a.system === b.system && roundsBefore.has(round.key)
        ? (a.seriesByRound?.[round.key] || a.defaultSeries)
        : '—'
      push(round.label, was, b.seriesByRound?.[round.key] || b.defaultSeries)
    }
  }

  push('Puntuacion', scoringText(a), scoringText(b))
  push('Desempates', tiebreakText(a), tiebreakText(b))
  return out
}

/** Texto del comunicado que reciben equipos y staff. */
export function changeNoticeText(tournamentTitle, changes, note) {
  const title = `Cambios en la competencia de ${tournamentTitle}`
  const lines = changes.map(ch => `• ${ch.label}: ${ch.before} → ${ch.after}`)
  const body = [
    `El organizador actualizo la estructura competitiva de ${tournamentTitle}.`,
    '',
    ...lines,
    ...(note ? ['', note] : []),
  ].join('\n')
  return { title, body }
}

