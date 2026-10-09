import { gameIdFromName } from './games.mjs'

export const SETUP_STEPS = ['Identidad', 'Competencia', 'Calendario', 'Premios', 'Organizacion', 'Revision']
export const REMINDER_INTERVAL = 5 * 60 * 1000
// 48h abierto es la recomendacion (scheduleWarnings), ya no un minimo que bloquee.
export const MIN_REGISTRATION_MS = 48 * 60 * 60 * 1000
// Anticipacion minima desde que se crea el torneo: la apertura de inscripciones
// y el inicio deben ser al menos 2h despues.
export const MIN_LEAD_MS = 2 * 60 * 60 * 1000
export const STAFF_ROLES = ['Director', 'Administrador', 'Arbitro', 'Moderador', 'Caster', 'Produccion', 'Coach', 'Analista']
// El staff del torneo son perfiles reales de GlitchGang con rol aprobado. El
// rol de torneo se propone segun su rol de plataforma y el organizador lo
// puede ajustar. Ver components/RoleStaffSearch + GET /profile/staff.
export const PLATFORM_STAFF_ROLES = ['organizer', 'caster', 'moderator', 'analyst', 'creator', 'coach']
export const STAFF_ROLE_BY_PLATFORM = {
  organizer: 'Administrador', caster: 'Caster', moderator: 'Moderador', analyst: 'Analista', creator: 'Produccion', coach: 'Coach',
}
export const SPONSOR_TIERS = ['Principal', 'Oficial', 'Colaborador']
// 'none' = solo panel web. 'glitchgang' = el bot arma el torneo en el Discord
// de GlitchGang. 'own' = servidor propio (feature con costo, aun no disponible).
export const DISCORD_MODES = ['none', 'glitchgang', 'own']
// Premios por puesto final vs premios especiales (MVP, mejor novato, fair play...).
export const PRIZE_KINDS = ['placement', 'award']
export const AWARD_PRESETS = ['MVP', 'MVP de la final', 'Mejor novato', 'Jugador revelacion', 'Fair play', 'Mejor jugada']
export const REGION_PRESETS = {
  Caribe: ['RD', 'PR', 'CU', 'HT', 'JM', 'TT', 'BS', 'BB', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC'],
  Norteamerica: ['CA', 'US', 'MX'],
  Centroamerica: ['BZ', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA'],
  Sudamerica: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'],
}

// ── Estructura competitiva ─────────────────────────────────────────────────
// Sistema → Fases → Rondas, y cada ronda tiene su serie. La puntuacion va por
// fase. El motor que ejecuta (avanzar rondas, calcular tablas) es una etapa
// posterior: aca solo capturamos, validamos y guardamos la configuracion.

export const COMPETITION_SYSTEMS = {
  single_elim:     { label: 'Eliminacion simple',    scoring: 'wins',         hint: 'Pierdes y quedas fuera. Llave rapida y directa.' },
  double_elim:     { label: 'Eliminacion doble',     scoring: 'wins',         hint: 'Segunda oportunidad: caes al cuadro inferior antes de quedar eliminado.' },
  round_robin:     { label: 'Todos contra todos',    scoring: 'match_points', hint: 'Cada equipo juega contra todos. Gana el de mas puntos.' },
  swiss:           { label: 'Suizo',                 scoring: 'match_points', hint: 'Rondas contra rivales de record parecido, sin eliminar hasta el final.' },
  groups_playoffs: { label: 'Grupos + eliminatoria', scoring: 'match_points', hint: 'Fase de grupos y luego llave con los clasificados.' },
}

export const SCORING_MODELS = { wins: 'Por victorias', match_points: 'Por puntos', placement: 'Por posicion', time: 'Por tiempo' }
export const SERIES_OPTIONS = ['BO1', 'BO3', 'BO5', 'BO7']
export const DEFAULT_TIEBREAKERS = ['head_to_head', 'map_diff', 'round_diff', 'wins']
export const TIEBREAKER_LABELS = {
  head_to_head: 'Enfrentamiento directo', map_diff: 'Diferencia de mapas',
  round_diff: 'Diferencia de rondas', wins: 'Numero de victorias',
}
export const SYSTEM_TO_FORMAT = { single_elim: 'single_elimination', double_elim: 'double_elimination', round_robin: 'round_robin', swiss: 'swiss', groups_playoffs: 'custom' }
export const FORMAT_TO_SYSTEM = { single_elimination: 'single_elim', double_elimination: 'double_elim', round_robin: 'round_robin', swiss: 'swiss', custom: 'groups_playoffs' }

export function initialCompetition() {
  return {
    system: 'single_elim', configVersion: 2, defaultSeries: 'BO1',
    thirdPlace: false, grandFinalReset: true,
    legs: 1, swissRounds: 5,
    groups: 1, groupsPhaseSystem: 'round_robin', advancePerGroup: 2, playoffsSystem: 'single_elim',
    scoring: { model: 'wins', win: 3, draw: 1, loss: 0, allowDraw: true, tiebreakers: [...DEFAULT_TIEBREAKERS] },
    seriesByRound: {},
  }
}

const ROUND_LABELS = {
  final: 'Final', semifinal: 'Semifinal', cuartos: 'Cuartos de final', octavos: 'Octavos de final',
  tercer_puesto: 'Partido por el 3er puesto', upper_final: 'Final del cuadro superior',
  lower_final: 'Final del cuadro inferior', grand_final: 'Gran final',
}
export function roundLabel(key) {
  if (ROUND_LABELS[key]) return ROUND_LABELS[key]
  const rn = /^ronda_(\d+)$/.exec(key); if (rn) return `Ronda de ${rn[1]}`
  const up = /^upper_(\d+)$/.exec(key); if (up) return `Cuadro superior · ronda ${up[1]}`
  const jr = /^jornada_(\d+)$/.exec(key); if (jr) return `Jornada ${jr[1]}`
  const sw = /^suiza_(\d+)$/.exec(key); if (sw) return `Ronda suiza ${sw[1]}`
  return key
}

export function bracketRoundKeys(slots) {
  const n = Math.max(2, Math.min(1024, Math.round(Number(slots) || 2)))
  const rounds = Math.ceil(Math.log2(n))
  const keys = []
  for (let r = 0; r < rounds; r++) {
    const teamsIn = 2 ** (rounds - r)
    keys.push(teamsIn === 2 ? 'final' : teamsIn === 4 ? 'semifinal' : teamsIn === 8 ? 'cuartos' : teamsIn === 16 ? 'octavos' : `ronda_${teamsIn}`)
  }
  return keys
}

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

// Fases y rondas derivadas de la configuracion. Solo para la UI (mostrar las
// rondas reales) y para validar las claves de seriesByRound.
export function competitionPhases(competition = {}, maxSlots = 2) {
  const c = { ...initialCompetition(), ...competition }
  const slots = clampInt(maxSlots, 2, 1024, 2)
  const mk = (key) => ({ key, label: roundLabel(key) })
  const bracket = (system, slotCount, withThird, withGrandFinal) => {
    const keys = bracketRoundKeys(slotCount)
    const rounds = keys.map(mk)
    if (withThird) rounds.splice(rounds.length - 1, 0, mk('tercer_puesto'))
    if (system === 'double_elim') {
      rounds.splice(rounds.length - 1, 0, mk('upper_final'), mk('lower_final'))
      if (withGrandFinal) rounds.push(mk('grand_final'))
    }
    return rounds
  }
  const league = (count, legs, prefix) => {
    const perLeg = count % 2 === 0 ? count - 1 : count
    return Array.from({ length: perLeg * (legs === 2 ? 2 : 1) }, (_, i) => mk(`${prefix}_${i + 1}`))
  }

  if (c.system === 'single_elim') {
    return [{ id: 'principal', name: 'Cuadro principal', system: 'single_elim', scoring: { model: 'wins' }, rounds: bracket('single_elim', slots, c.thirdPlace) }]
  }
  if (c.system === 'double_elim') {
    return [{ id: 'principal', name: 'Cuadro doble', system: 'double_elim', scoring: { model: 'wins' }, rounds: bracket('double_elim', slots, false, c.grandFinalReset) }]
  }
  if (c.system === 'round_robin') {
    return [{ id: 'principal', name: 'Liga', system: 'round_robin', scoring: c.scoring, rounds: league(slots, c.legs, 'jornada') }]
  }
  if (c.system === 'swiss') {
    const k = clampInt(c.swissRounds, 3, 12, 5)
    return [{ id: 'principal', name: 'Suizo', system: 'swiss', scoring: c.scoring, rounds: Array.from({ length: k }, (_, i) => mk(`suiza_${i + 1}`)) }]
  }
  // groups_playoffs
  const groups = clampInt(c.groups, 1, 32, 1)
  const perGroup = groups > 0 ? Math.max(2, Math.floor(slots / groups)) : slots
  const advance = clampInt(c.advancePerGroup, 1, Math.max(1, perGroup - 1), 2)
  const groupRounds = c.groupsPhaseSystem === 'swiss'
    ? Array.from({ length: clampInt(c.swissRounds, 3, 12, 5) }, (_, i) => mk(`suiza_${i + 1}`))
    : league(perGroup, 1, 'jornada')
  return [
    { id: 'grupos', name: 'Fase de grupos', system: c.groupsPhaseSystem, scoring: c.scoring, groups, advancePerGroup: advance, rounds: groupRounds },
    { id: 'playoffs', name: 'Playoffs', system: c.playoffsSystem, scoring: { model: 'wins' }, rounds: bracket(c.playoffsSystem, groups * advance, false, c.grandFinalReset) },
  ]
}

// Devuelve una copia saneada: numeros coercionados, scoring coherente con el
// modelo, y seriesByRound sin claves que ya no existen para esta config.
export function normalizeCompetition(competition = {}, maxSlots = 2) {
  const c = { ...initialCompetition(), ...competition }
  const out = initialCompetition()
  out.system = COMPETITION_SYSTEMS[c.system] ? c.system : 'single_elim'
  out.defaultSeries = SERIES_OPTIONS.includes(c.defaultSeries) ? c.defaultSeries : 'BO1'
  out.thirdPlace = Boolean(c.thirdPlace)
  out.grandFinalReset = c.grandFinalReset !== false
  out.legs = Number(c.legs) === 2 ? 2 : 1
  out.swissRounds = clampInt(c.swissRounds, 3, 12, 5)
  out.groups = clampInt(c.groups, 1, 32, 1)
  out.groupsPhaseSystem = ['round_robin', 'swiss'].includes(c.groupsPhaseSystem) ? c.groupsPhaseSystem : 'round_robin'
  out.advancePerGroup = clampInt(c.advancePerGroup, 1, 512, 2)
  out.playoffsSystem = ['single_elim', 'double_elim'].includes(c.playoffsSystem) ? c.playoffsSystem : 'single_elim'

  const sc = c.scoring || {}
  const systemModel = COMPETITION_SYSTEMS[out.system].scoring
  out.scoring.model = SCORING_MODELS[sc.model] ? sc.model : systemModel
  if (out.system === 'single_elim' || out.system === 'double_elim') out.scoring.model = 'wins'
  out.scoring.win = clampInt(sc.win, 0, 100, 3)
  out.scoring.draw = clampInt(sc.draw, 0, 100, 1)
  out.scoring.loss = clampInt(sc.loss, 0, 100, 0)
  out.scoring.allowDraw = sc.allowDraw !== false
  out.scoring.tiebreakers = Array.isArray(sc.tiebreakers) && sc.tiebreakers.some(t => DEFAULT_TIEBREAKERS.includes(t))
    ? DEFAULT_TIEBREAKERS.filter(t => sc.tiebreakers.includes(t))
    : [...DEFAULT_TIEBREAKERS]

  const valid = new Set(competitionPhases(out, maxSlots).flatMap(p => p.rounds.map(r => r.key)))
  out.seriesByRound = {}
  for (const [key, value] of Object.entries(c.seriesByRound || {})) {
    if (valid.has(key) && SERIES_OPTIONS.includes(value) && value !== out.defaultSeries) out.seriesByRound[key] = value
  }
  return out
}

export function validateCompetition(competition = {}, maxSlots = 2) {
  const e = {}
  const c = competition || {}
  if (!COMPETITION_SYSTEMS[c.system]) { e.system = 'Elige un sistema competitivo valido.'; return e }
  if (!SERIES_OPTIONS.includes(c.defaultSeries)) e.defaultSeries = 'Elige una serie por defecto valida.'
  const slots = Math.round(Number(maxSlots))
  if (!Number.isInteger(slots) || slots < 2 || slots > 1024) e.maxSlots = 'Elige entre 2 y 1024 cupos.'

  if (c.system === 'swiss' || (c.system === 'groups_playoffs' && c.groupsPhaseSystem === 'swiss')) {
    const k = Math.round(Number(c.swissRounds))
    if (!Number.isInteger(k) || k < 3 || k > 12) e.swissRounds = 'Las rondas suizas deben ser entre 3 y 12.'
  }
  if (c.system === 'round_robin' && ![1, 2].includes(Number(c.legs))) e.legs = 'Elige ida, o ida y vuelta.'
  if (c.system === 'groups_playoffs') {
    const g = Math.round(Number(c.groups))
    if (!Number.isInteger(g) || g < 1 || g > 32) e.groups = 'Elige entre 1 y 32 grupos.'
    else if (Number.isInteger(slots) && slots % g !== 0) e.groups = 'Los cupos deben repartirse en partes iguales entre los grupos.'
    else if (Number.isInteger(slots) && slots / g < 3) e.groups = 'Cada grupo necesita al menos 3 equipos.'
    const adv = Math.round(Number(c.advancePerGroup))
    const groupSize = g > 0 && Number.isInteger(slots) ? slots / g : 0
    if (!Number.isInteger(adv) || adv < 1 || (groupSize && adv >= groupSize)) e.advancePerGroup = 'Deben avanzar entre 1 y el tamano del grupo menos uno.'
    if (!['round_robin', 'swiss'].includes(c.groupsPhaseSystem)) e.groupsPhaseSystem = 'Sistema de la fase de grupos invalido.'
    if (!['single_elim', 'double_elim'].includes(c.playoffsSystem)) e.playoffsSystem = 'Sistema de playoffs invalido.'
  }

  const sc = c.scoring || {}
  if (!SCORING_MODELS[sc.model]) e.scoring = 'Elige un modelo de puntuacion valido.'
  if (sc.model === 'match_points') {
    for (const k of ['win', 'draw', 'loss']) {
      if (!Number.isFinite(Number(sc[k])) || Number(sc[k]) < 0 || Number(sc[k]) > 100) e.scoring = 'Los puntos por victoria, empate y derrota deben ser numeros entre 0 y 100.'
    }
    if (Number(sc.win) <= Number(sc.loss)) e.scoring = 'La victoria debe valer mas que la derrota.'
    if (!Array.isArray(sc.tiebreakers) || !sc.tiebreakers.length || sc.tiebreakers.some(t => !DEFAULT_TIEBREAKERS.includes(t))) {
      e.scoring = 'Configura al menos un criterio de desempate valido.'
    }
  }

  const valid = new Set(competitionPhases(c, slots).flatMap(p => p.rounds.map(r => r.key)))
  for (const [key, value] of Object.entries(c.seriesByRound || {})) {
    if (valid.has(key) && !SERIES_OPTIONS.includes(value)) { e.seriesByRound = 'Cada serie personalizada debe ser BO1, BO3, BO5 o BO7.'; break }
  }
  return e
}

export function initialTournamentForm(user = {}) {
  return {
    title: '', categoryId: '', gameId: '', game: '', description: '', banner: '', bannerName: '',
    logo: '', primaryColor: '',
    discordMode: 'none', discordConsent: false,
    seasonName: '', seasonNumber: 1, seriesId: '', sourceTournament: '',
    platform: 'pc', server: '', modality: '5v5', patch: '', mapMode: 'fixed', mapPool: '',
    maxSlots: 32, competition: initialCompetition(),
    participationScope: 'global', allowedCountries: [],
    timezone: '-04:00', date: '', endDate: '', registrationStart: '', registrationEnd: '', checkinDeadline: '',
    overcupEnabled: false, overcupLocked: false, secondCheckinHours: 6, secondCheckinDeadline: '',
    minAge: 18, minorsAllowed: false, notes: '',
    entryFee: 0, prizeType: 'Sin premio', prizePool: 0, currency: 'DOP', prizes: [],
    organizerBrandName: '', organizationContact: '', organizationAddress: '', jurisdiction: 'Republica Dominicana',
    contactEmail: user.email || '', contactPhone: '', contactDiscord: '',
    streamUrl: '', streamLang: 'Espanol', sponsors: [], staffMembers: [],
    rules: '', rulesDocument: '', rulesName: '', complaintsChannel: user.email || '',
    mediaChannels: '', mediaRetentionMonths: 12, acceptTerms: false,
  }
}

export function httpUrl(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}

export function instant(value, offset = '+00:00') {
  if (!value) return NaN
  const text = String(value)
  return Date.parse(/[zZ]$|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}${offset}`)
}

// Reloj de pared en la zona `offset` (ej. '-04:00') como string para
// <input type="datetime-local"> — misma convencion que los valores del form.
export function inputDateTime(ms, offset = '+00:00') {
  if (!Number.isFinite(ms)) return ''
  const sign = String(offset)[0] === '-' ? -1 : 1
  const [oh = 0, om = 0] = String(offset).slice(1).split(':').map(Number)
  return new Date(ms + sign * ((oh * 60 + om) * 60000)).toISOString().slice(0, 16)
}

export function scheduleErrors(form, now = Date.now(), { requireFuture = true } = {}) {
  const errors = {}
  const times = {}
  for (const key of ['date', 'endDate', 'registrationStart', 'registrationEnd']) {
    times[key] = instant(form[key], form.timezone)
    if (!Number.isFinite(times[key])) errors[key] = 'Selecciona una fecha y hora validas.'
  }
  if (requireFuture && times.date < now + MIN_LEAD_MS) errors.date = 'El inicio debe ser al menos 2 horas despues de crear el torneo.'
  if (requireFuture && times.registrationStart < now + MIN_LEAD_MS) errors.registrationStart = 'La apertura de inscripciones debe ser al menos 2 horas despues de crear el torneo.'
  if (!requireFuture && times.date <= now) errors.date = 'El inicio debe ser posterior al momento actual.'
  if (times.registrationEnd <= times.registrationStart) errors.registrationEnd = 'El cierre de inscripciones debe ser posterior a la apertura.'
  if (times.registrationEnd > times.date) errors.registrationEnd = 'Las inscripciones deben cerrar antes de iniciar el torneo.'
  if (times.endDate <= times.date) errors.endDate = 'El cierre del torneo debe ser posterior al inicio.'
  if (form.checkinDeadline) {
    const checkin = instant(form.checkinDeadline, form.timezone)
    if (!Number.isFinite(checkin) || checkin < times.registrationEnd || checkin > times.date) errors.checkinDeadline = 'El check-in debe cerrar entre las inscripciones y el inicio.'
  }
  if (form.overcupEnabled) {
    if (!Number.isInteger(Number(form.secondCheckinHours)) || Number(form.secondCheckinHours) < 6 || Number(form.secondCheckinHours) > 12) errors.secondCheckinHours = 'La ventana debe ser de 6 a 12 horas.'
    const deadline = instant(form.secondCheckinDeadline, form.timezone)
    if (!Number.isFinite(deadline) || deadline < times.registrationEnd || deadline > times.date) errors.secondCheckinDeadline = 'Indica un limite entre cierre de inscripciones e inicio.'
  }
  if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(form.timezone || '')) errors.timezone = 'Selecciona una zona horaria valida.'
  return errors
}

// Avisos que NO bloquean publicar (se muestran en el formulario).
export function scheduleWarnings(form) {
  const warnings = {}
  const start = instant(form.registrationStart, form.timezone)
  const end = instant(form.registrationEnd, form.timezone)
  if (Number.isFinite(start) && Number.isFinite(end) && end > start && end - start < MIN_REGISTRATION_MS) {
    warnings.registrationEnd = 'Recomendado: dejar las inscripciones abiertas al menos 48 horas.'
  }
  return warnings
}

export function validateSetupStep(form, step, now = Date.now()) {
  const e = {}
  const required = (key, label) => { if (!String(form[key] ?? '').trim()) e[key] = `${label} es obligatorio.` }
  if (step === 0) {
    for (const [k, label] of [['title', 'El nombre'], ['gameId', 'El juego'], ['description', 'La descripcion']]) required(k, label)
    if (form.title.length > 120) e.title = 'Maximo 120 caracteres.'
    if (String(form.primaryColor || '') && !/^#[0-9a-fA-F]{6}$/.test(form.primaryColor)) e.primaryColor = 'Usa un color hexadecimal como #1E90FF.'
    if (!DISCORD_MODES.includes(form.discordMode)) e.discordMode = 'Elige como se gestiona el torneo.'
    if (form.discordMode === 'own') e.discordMode = 'El servidor propio es una funcion de pago que aun no esta disponible.'
    if (!Number.isInteger(Number(form.seasonNumber)) || Number(form.seasonNumber) < 1) e.seasonNumber = 'Usa un numero entero desde 1.'
    if (form.sourceTournament && !form.seasonName.trim()) e.seasonName = 'Indica el nombre de la serie de torneos.'
  }
  if (step === 1) {
    required('server', 'El servidor')
    required('modality', 'La modalidad')
    if (String(form.modality || '').length > 40) e.modality = 'Maximo 40 caracteres.'
    required('mapPool', form.mapMode === 'random' ? 'La lista de mapas del sorteo' : 'El nombre del mapa')
    const maps = String(form.mapPool || '').split(',').map(name => name.trim()).filter(Boolean)
    if (!['fixed', 'random', 'veto'].includes(form.mapMode)) e.mapMode = 'Selecciona un modo de mapas valido.'
    if (!maps.length && form.mapPool) e.mapPool = 'Indica al menos un nombre de mapa.'
    if (form.mapMode === 'fixed' && maps.length > 1) e.mapPool = 'El mapa fijo debe contener un solo nombre.'
    if (String(form.mapPool || '').length > 1500) e.mapPool = 'La lista de mapas admite hasta 1500 caracteres.'
    for (const key of ['patch', 'server']) if (String(form[key] || '').length > 160) e[key] = 'Maximo 160 caracteres.'
    Object.assign(e, validateCompetition(form.competition, form.maxSlots))
    if (form.participationScope === 'regional' && !form.allowedCountries.length) e.allowedCountries = 'Selecciona al menos un pais permitido.'
  }
  if (step === 2) {
    Object.assign(e, scheduleErrors(form, now))
    if (!Number.isInteger(Number(form.minAge)) || Number(form.minAge) < (form.minorsAllowed ? 1 : 18) || Number(form.minAge) > 99) e.minAge = form.minorsAllowed ? 'Indica una edad minima valida.' : 'Sin menores, la edad minima debe ser de 18 anos o mas.'
  }
  if (step === 3) {
    if (!Number.isFinite(Number(form.entryFee)) || Number(form.entryFee) < 0) e.entryFee = 'La inscripcion no puede ser negativa.'
    if (form.prizeType !== 'Sin premio') {
      if (!Number.isFinite(Number(form.prizePool)) || Number(form.prizePool) < 0) e.prizePool = 'Indica un premio valido.'
      if (!form.prizes.length) e.prizes = 'Agrega al menos un premio.'
      else if (form.prizes.some(p => !String(p.place ?? '').trim() || !Number.isFinite(Number(p.amount)) || Number(p.amount) < 0 || (!Number(p.amount) && !String(p.items ?? '').trim()))) e.prizes = 'Cada premio necesita nombre o puesto, e importe o detalle del articulo.'
      else {
        const awards = form.prizes.filter(p => p.kind === 'award').map(p => String(p.place).trim().toLowerCase())
        if (new Set(awards).size !== awards.length) e.prizes = 'Hay premios especiales con el mismo nombre.'
      }
      if (Math.abs(form.prizes.reduce((n, p) => n + Number(p.amount || 0), 0) - Number(form.prizePool)) > 0.001) e.prizePool = 'El total debe coincidir con la distribucion de premios.'
    }
  }
  if (step === 4) {
    required('organizerBrandName', 'El nombre de la organizacion')
    required('organizationContact', 'El responsable')
    required('contactEmail', 'El correo')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) e.contactEmail = 'Introduce un correo valido.'
    for (const key of ['contactDiscord', 'streamUrl']) if (form[key] && !httpUrl(form[key])) e[key] = 'Usa una URL http o https valida.'
    if (form.sponsors.some(p => !p.name.trim() || (p.link && !httpUrl(p.link)) || !SPONSOR_TIERS.includes(p.tier))) e.sponsors = 'Revisa el nombre, nivel y enlace de cada patrocinador.'
    if (new Set(form.sponsors.map(p => p.name.trim().toLowerCase())).size !== form.sponsors.length) e.sponsors = 'Hay patrocinadores repetidos.'
    if (form.staffMembers.some(p => !String(p.name || p.nick || '').trim() || !STAFF_ROLES.includes(p.role))) e.staffMembers = 'Cada integrante del staff necesita un perfil y un rol.'
    else {
      const keys = form.staffMembers.map(p => String(p.user || p.nick || p.name || '').toLowerCase())
      if (new Set(keys).size !== keys.length) e.staffMembers = 'Esa persona ya esta en el staff.'
    }
  }
  if (step === 5) {
    required('jurisdiction', 'El pais de organizacion')
    required('complaintsChannel', 'El contacto para consultas y reclamaciones')
    if (!form.rules.trim() && !form.rulesDocument) e.rules = 'Escribe el reglamento o adjunta su PDF.'
    if (!form.acceptTerms) e.acceptTerms = 'Acepta los terminos para publicar.'
    if (form.minorsAllowed) {
      required('organizationAddress', 'El domicilio de la organizacion responsable')
      required('mediaChannels', 'Los canales previstos para imagen y contenido')
      if (!Number.isInteger(Number(form.mediaRetentionMonths)) || Number(form.mediaRetentionMonths) < 1 || Number(form.mediaRetentionMonths) > 120) e.mediaRetentionMonths = 'Indica un plazo entre 1 y 120 meses.'
    }
  }
  return e
}

export function tournamentPayload(form) {
  const competition = normalizeCompetition(form.competition, form.maxSlots)
  const payload = {
    ...form, setupVersion: 1, visibility: 'public', status: 'open',
    competition,
    format: SYSTEM_TO_FORMAT[competition.system] || 'single_elimination',
    series: competition.defaultSeries,
  }
  for (const key of ['date', 'endDate', 'registrationStart', 'registrationEnd', 'checkinDeadline']) {
    payload[key] = form[key] ? new Date(instant(form[key], form.timezone)).toISOString() : null
  }
  payload.allowedCountries = form.participationScope === 'regional' ? form.allowedCountries : []
  payload.prizes = form.prizes.map(p => ({ ...p, currency: form.currency, kind: p.kind === 'award' ? 'award' : 'placement', amount: Number(p.amount) || 0 }))
  payload.overcup = { enabled: form.overcupEnabled, locked: form.overcupLocked, secondCheckinHours: Number(form.secondCheckinHours), secondCheckinDeadline: form.overcupEnabled && form.secondCheckinDeadline ? new Date(instant(form.secondCheckinDeadline, form.timezone)).toISOString() : null }
  if (form.prizeType === 'Sin premio') { payload.prizePool = 0; payload.prizes = [] }
  payload.staffMembers = form.staffMembers.map(s => ({
    user: s.user || null, nick: s.nick || s.name || '', name: s.nick || s.name || '',
    avatar: s.avatar || '', playerCode: s.playerCode || '', platformRole: s.platformRole || '',
    role: STAFF_ROLES.includes(s.role) ? s.role : 'Moderador',
  }))
  const staffName = s => s.nick || s.name || ''
  payload.staff = {
    director: payload.staffMembers.filter(s => s.role === 'Director').map(staffName).join(', '),
    admin: payload.staffMembers.filter(s => s.role === 'Administrador').map(staffName).join(', '),
    arbitros: payload.staffMembers.filter(s => s.role === 'Arbitro').map(staffName),
  }
  return payload
}

export function nextSeason(tournament, user) {
  const base = initialTournamentForm(user)
  const reset = new Set(['date', 'endDate', 'registrationStart', 'registrationEnd', 'checkinDeadline', 'secondCheckinDeadline', 'acceptTerms', 'discordConsent'])
  for (const key of Object.keys(base)) if (!reset.has(key) && tournament[key] !== undefined && tournament[key] !== null) base[key] = tournament[key]
  base.seasonName = tournament.seasonName || tournament.title
  base.seasonNumber = Number(tournament.seasonNumber || 1) + 1
  base.sourceTournament = String(tournament._id)
  base.seriesId = tournament.seriesId || tournament.seriesId || ''
  base.gameId = tournament.gameId || gameIdFromName(tournament.game) || base.gameId
  base.competition = normalizeCompetition(
    tournament.competition && typeof tournament.competition.toObject === 'function' ? tournament.competition.toObject() : tournament.competition,
    tournament.maxSlots,
  )
  base.overcupEnabled = Boolean(tournament.overcup?.enabled)
  base.overcupLocked = Boolean(tournament.overcup?.locked)
  base.secondCheckinHours = Number(tournament.overcup?.secondCheckinHours) || 6
  base.sponsors = (base.sponsors || []).map(s => ({ ...s, name: s.name || '', link: s.url || s.link || '', contribution: s.contribution || '', logo: s.logo || s.image || '', tier: SPONSOR_TIERS.includes(s.tier) ? s.tier : 'Colaborador' }))
  base.prizes = (base.prizes || []).map(p => ({ ...p, place: p.place || '', items: p.items || '', amount: p.amount || 0, kind: p.kind === 'award' ? 'award' : 'placement' }))
  if (!base.staffMembers.length && tournament.staff) {
    base.staffMembers = [
      ...(tournament.staff.director ? [{ name: tournament.staff.director, role: 'Director' }] : []),
      ...(tournament.staff.admin ? [{ name: tournament.staff.admin, role: 'Administrador' }] : []),
      ...(tournament.staff.arbitros || []).map(name => ({ name, role: 'Arbitro' })),
    ]
  }
  base.title = `${base.seasonName} - Temporada ${base.seasonNumber}`.slice(0, 120)
  if (!/^[+-]\d{2}:\d{2}$/.test(base.timezone)) base.timezone = '+00:00'
  return base
}

