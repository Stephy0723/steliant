const isBlank = value => (
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)
)

const normalize = value => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

function gameKey(tournament = {}) {
  const raw = normalize(`${tournament.game || ''} ${tournament.gameCode || ''} ${tournament.title || ''}`)
  if (raw.includes('valorant') || raw.includes(' val ') || raw.endsWith('val')) return 'valorant'
  if (raw.includes('counter') || raw.includes('strike') || raw.includes('cs2')) return 'cs2'
  if (raw.includes('league') || raw.includes('legends') || raw.includes('wild rift') || raw.includes('lol')) return 'lol'
  if (raw.includes('mobile legends') || raw.includes('mlbb')) return 'mlbb'
  if (raw.includes('apex')) return 'apex'
  if (raw.includes('rocket') || raw.includes(' rl ')) return 'rocket'
  return 'generic'
}

function prizeDefaults(tournament = {}) {
  const pool = Number(tournament.prizePool || 0)
  if (!pool) return []
  return [
    { place: '1er lugar', amount: Math.round(pool * 0.6), items: 'Campeon del torneo' },
    { place: '2do lugar', amount: Math.round(pool * 0.3), items: 'Finalista' },
    { place: '3er lugar', amount: Math.max(0, pool - Math.round(pool * 0.6) - Math.round(pool * 0.3)), items: 'Semifinalista destacado' },
  ].filter(prize => prize.amount > 0)
}

function baseDefaults(tournament = {}) {
  const pool = Number(tournament.prizePool || 0)
  const slots = Number(tournament.maxSlots || 0)
  const title = tournament.title || 'Torneo GlitchGang'
  return {
    description: `${title} es una competencia oficial de GlitchGang con administracion activa, calendario competitivo y cupos limitados para equipos verificados.`,
    notes: 'Check-in obligatorio antes del inicio. Los capitanes deben estar disponibles en Discord durante toda la jornada.',
    rules: [
      'Cada equipo debe jugar con el roster registrado.',
      'El capitan debe reportar resultados y evidencias al terminar cada partida.',
      'No se permiten cuentas prestadas, smurfing ni cambios de roster sin aprobacion del staff.',
      'El staff puede aplicar walkover si un equipo llega tarde al horario confirmado.',
    ].join('\n'),
    server: 'LATAM',
    series: 'GlitchGang Competitive',
    patch: 'Version competitiva vigente',
    mapPool: 'Se confirma en Discord antes del bracket.',
    prizeType: pool > 0 ? 'Prize pool' : 'Reconocimiento competitivo',
    prizes: prizeDefaults(tournament),
    contactDiscord: 'GlitchGang Staff',
    streamLang: 'ES',
    jurisdiction: 'Republica Dominicana',
    law: 'Reglamento competitivo GlitchGang',
    complaintsChannel: 'Canal de soporte del torneo',
    staff: {
      director: 'GlitchGang Esports',
      admin: 'Tournament Ops',
      arbitros: ['Mesa de control', 'Soporte competitivo'],
    },
    participants: [],
    maxSlots: slots || 16,
  }
}

const GAME_DEFAULTS = {
  valorant: {
    description: 'Copa de Valorant para equipos 5v5 con bracket competitivo, partidas supervisadas y foco en ejecucion tactica.',
    modality: '5v5',
    platform: 'pc',
    region: 'LATAM',
    server: 'LATAM / Miami',
    series: 'Valorant Cup',
    mapPool: 'Ascent, Bind, Haven, Lotus, Split, Sunset y Icebox.',
    rules: [
      'Formato 5v5 con roster principal y suplentes declarados.',
      'Map veto administrado por staff antes de cada serie.',
      'Uso obligatorio de cuentas propias y Riot ID validado.',
      'Pausa tactica permitida segun reglamento del match.',
    ].join('\n'),
  },
  cs2: {
    description: 'Serie de Counter-Strike 2 para equipos competitivos con veto de mapas, anticheat requerido y partidas al mejor formato disponible.',
    modality: '5v5',
    platform: 'pc',
    region: 'LATAM',
    server: 'LATAM / US East',
    series: 'CS2 Masters Series',
    mapPool: 'Mirage, Inferno, Nuke, Ancient, Anubis, Dust II y Vertigo.',
    rules: [
      'Formato 5v5 con capitan responsable del lobby.',
      'Veto de mapas obligatorio antes de iniciar la partida.',
      'Demo, screenshot o enlace de resultado puede ser solicitado por staff.',
      'Conductas anticompetitivas o uso de software externo implican descalificacion.',
    ].join('\n'),
  },
  lol: {
    description: 'Campeonato de League of Legends para equipos 5v5 con partidas organizadas, draft competitivo y seguimiento de resultados.',
    modality: '5v5',
    platform: 'pc',
    region: 'LAN/LAS',
    server: 'LAN / LAS segun convocatoria',
    series: 'Liga de Leyendas Latino',
    mapPool: 'Grieta del Invocador.',
    rules: [
      'Formato 5v5 en Grieta del Invocador.',
      'Cada equipo debe confirmar region, invocadores y capitan antes del check-in.',
      'Draft y resultados se reportan por el canal oficial del torneo.',
      'Sustituciones solo con aprobacion previa del staff.',
    ].join('\n'),
  },
  mlbb: {
    description: 'Torneo mobile 5v5 para equipos de Mobile Legends con check-in rapido, salas privadas y seguimiento por staff.',
    modality: '5v5',
    platform: 'mobile',
    server: 'LATAM',
    series: 'Mobile Legends Clash',
    mapPool: 'Land of Dawn.',
  },
  apex: {
    description: 'Copa de Apex Legends con squads competitivos, puntuacion por rondas y control de resultados por staff.',
    modality: '3v3',
    platform: 'pc',
    server: 'LATAM / US East',
    series: 'Apex GlitchCup',
    mapPool: 'Rotacion competitiva confirmada por jornada.',
  },
  rocket: {
    description: 'Open de Rocket League para equipos 3v3 con series rapidas, bracket limpio y resultados verificados.',
    modality: '3v3',
    platform: 'pc',
    server: 'US East / LATAM',
    series: 'Rocket League Open',
    mapPool: 'Arenas estandar competitivas.',
  },
}

export function getTournamentDefaults(tournament = {}) {
  return {
    ...baseDefaults(tournament),
    ...(GAME_DEFAULTS[gameKey(tournament)] || {}),
  }
}

export function applyTournamentDefaults(tournament = {}) {
  const source = typeof tournament.toObject === 'function' ? tournament.toObject() : tournament
  if (source.setupVersion === 1) return { ...source }
  const defaults = getTournamentDefaults(source)
  const enriched = { ...source }

  for (const [field, value] of Object.entries(defaults)) {
    if (field === 'staff') {
      enriched.staff = {
        ...value,
        ...(source.staff || {}),
        arbitros: isBlank(source.staff?.arbitros) ? value.arbitros : source.staff.arbitros,
      }
      continue
    }
    if (isBlank(source[field])) enriched[field] = value
  }

  return enriched
}

export function buildTournamentDefaultPatch(tournament = {}) {
  if (tournament.setupVersion === 1) return {}
  const defaults = getTournamentDefaults(tournament)
  const patch = {}
  for (const [field, value] of Object.entries(defaults)) {
    if (field === 'staff') {
      const current = tournament.staff || {}
      if (isBlank(current.director)) patch['staff.director'] = value.director
      if (isBlank(current.admin)) patch['staff.admin'] = value.admin
      if (isBlank(current.arbitros)) patch['staff.arbitros'] = value.arbitros
      continue
    }
    if (isBlank(tournament[field])) patch[field] = value
  }
  return patch
}
