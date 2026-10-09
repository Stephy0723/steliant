// Datos de los torneos del organizador.
// FUENTE ÚNICA: se derivan de la lista pública `TOURNAMENTS` (data/tournaments.js)
// para que el panel del organizador muestre exactamente los mismos torneos que
// la página pública /torneos. Encima de cada torneo se aplica un "overlay" con
// datos ricos del organizador (premios, colaboradores, integraciones, reglas,
// reglamento). Lo que no tenga overlay usa valores por defecto sensatos.

import { TOURNAMENTS, TOURNAMENT_DETAILS } from './tournaments.js'
import { GAMES } from './games.js'

// ── Arte por juego (imagen horizontal + logo + color) tomado del catálogo ──
const ART_BY_NAME = GAMES.reduce((map, g) => {
  const art = { name: g.name, image: g.image, logo: g.images?.logo || null, color: g.color }
  map[g.id] = art
  map[g.name] = art
  return map
}, {})

const GAME_ALIASES = {
  val: 'valorant',
  valo: 'valorant',
  VAL: 'valorant',
  Valorant: 'valorant',
  lol: 'league-of-legends',
  LOL: 'league-of-legends',
  LoL: 'league-of-legends',
  'League of Legends': 'league-of-legends',
  cs2: 'counter-strike-2',
  CS2: 'counter-strike-2',
  'Counter-Strike 2': 'counter-strike-2',
}

const MANUAL_ART = {
  'league-of-legends': {
    name: 'League of Legends',
    image: '/demos/steliant-esports/ImaHorizontal/lol.jpg',
    logo: '/demos/steliant-esports/Logo/lol.png',
    color: '#C89B3C',
  },
  valorant: {
    name: 'Valorant',
    image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    logo: '/demos/steliant-esports/Logo/Valorant.png',
    color: '#FF4655',
  },
  'counter-strike-2': {
    name: 'Counter-Strike 2',
    image: '/demos/steliant-esports/ImaHorizontal/cs2.jpg',
    logo: '/demos/steliant-esports/Logo/cs2.png',
    color: '#F3A800',
  },
}

export function getGameArt(game) {
  const key = String(game || '').trim()
  const normalized = GAME_ALIASES[key] || key.toLowerCase()
  return ART_BY_NAME[key] || MANUAL_ART[normalized] || ART_BY_NAME[normalized] || { ...MANUAL_ART.valorant, logo: null }
}

// Compat: mapa juego -> arte (algunos módulos lo importaban)
export const GAME_ART = ART_BY_NAME

export const STATUS_LABEL = {
  draft: 'Borrador',
  upcoming: 'Proximo',
  live: 'En vivo',
  finished: 'Finalizado',
}

const FORMAT_LABEL = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  round_robin: 'Round Robin',
  swiss: 'Swiss',
}

const toNum = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0
export const formatLabel = (f) => FORMAT_LABEL[f] || (f ? String(f).replace(/_/g, ' ') : 'Single Elimination')

// Reglas por defecto cuando el torneo no tiene reglas propias en TOURNAMENT_DETAILS.
function defaultRules() {
  return []
}

// Reparto de premios por defecto (60/30/10) cuando no hay tabla propia.
function defaultPrizes(pool) {
  if (!pool) return [{ place: '1er Lugar', amount: 0, extra: 'Trofeo + reconocimiento' }]
  return [
    { place: '1er Lugar', amount: Math.round(pool * 0.6), extra: 'Trofeo + clasificacion' },
    { place: '2do Lugar', amount: Math.round(pool * 0.3), extra: 'Medalla de plata' },
    { place: '3er Lugar', amount: Math.round(pool * 0.1), extra: 'Medalla de bronce' },
  ]
}

// Texto del check-in según el plan del organizador (inamovible en todo torneo).
// Aclara los DOS tipos de check-in para evitar confusiones.
export function checkinRegulationBody(plan, ci = {}) {
  const presence = ci.presenceDeadline ? ` Hora limite definida por el organizador: ${ci.presenceDeadline}.` : ' La hora limite la define el organizador y queda publicada en este reglamento.'
  const base = [
    'El check-in es obligatorio y se realiza en Discord mediante el bot oficial de GlitchGang. Existen dos check-ins distintos:',
    `1) Check-in de presencia: un boton de presencia en el bot para confirmar que el equipo si participara.${presence}`,
    `2) Check-in previo al torneo: usualmente ${ci.prematchMins ?? 30} minutos antes del inicio, para preparar el evento, revisar lobby, asignar salas y verificar rosters.`,
    'Sin el check-in de presencia confirmado, el equipo no entra al bracket.',
    'Cualquier cambio que el organizador haga sobre las horas de check-in se notifica automaticamente a los participantes.',
  ]
  if (plan === 'pro') {
    base.push('Plan PRO: el check-in puede ejecutarse en el Discord propio del organizador, con el bot de GlitchGang invitado a ese servidor.')
  } else {
    base.push('Plan GRATIS: el organizador debe coordinar con la administracion de GlitchGang para habilitar el bot y el canal de Discord donde se hara el check-in.')
  }
  return base
}

// Texto del sobre cupo + segundo check-in (ventana de 6 a 12 horas).
export function overcupRegulationBody(overcup) {
  if (overcup?.enabled) {
    const hrs = overcup.secondCheckinHours ?? 6
    const deadline = overcup.secondCheckinDeadline ? ` Hora limite: ${overcup.secondCheckinDeadline}.` : ''
    return [
      `Este torneo admite sobre cupo: pueden registrarse mas equipos que las plazas disponibles (${overcup.capacity ?? 'cupo'} plazas).`,
      'Si en el check-in de presencia faltan equipos, los de la lista de espera entran por orden de inscripcion.',
      `A esos equipos se les abre un segundo check-in de presencia con una ventana de ${hrs} horas para confirmar en el bot.${deadline}`,
      'La hora limite del segundo check-in la define el organizador y queda publicada en el reglamento.',
      'Quien no confirme dentro de la ventana cede su lugar al siguiente equipo en la cola.',
    ]
  }
  return [
    'El cupo es fijo: solo entran los equipos hasta llenar las plazas; el resto queda en lista de espera por si hay bajas en el check-in.',
    'El organizador puede activar el sobre cupo con un segundo check-in para reemplazar ausencias automaticamente.',
  ]
}

// Reglamento estructurado (secciones) — "el reglamento y todo lo importante".
// Las secciones con `fixed: true` son INAMOVIBLES (no se pueden editar/quitar).
export function buildRegulation(t, formatTxt, prizes) {
  const prizeLines = prizes.map(p => `${p.place}: ${Number(p.amount).toLocaleString()}${p.extra ? ` - ${p.extra}` : ''}`)
  return [
    { title: '1. Elegibilidad', body: [
      `Abierto a equipos de la region ${t.region || 'LATAM'} registrados en GlitchGang.`,
      `Plataforma: ${t.platform || 'PC'}. Categoria: ${t.category || 'Mixto'}.`,
      `Cuota de inscripcion: ${t.entryFee ? `${t.entryFee}` : 'Gratis'}.`,
    ] },
    { title: '2. Formato de competicion', body: [
      `Sistema: ${formatTxt}.`,
      `Capacidad: ${t.capacity} equipos. Inicio: ${t.startDate} - ${t.startTime}.`,
      'El seeding se determina por ranking o sorteo publico supervisado por el staff.',
    ] },
    { title: '3. Check-in oficial (Discord + Bot)', fixed: true, body: checkinRegulationBody(t.plan, t.checkin) },
    { title: '4. Sobre cupo y segundo check-in', fixed: !!(t.overcup?.enabled && t.overcup?.locked), body: overcupRegulationBody({ ...t.overcup, capacity: t.capacity }) },
    { title: '5. Puntualidad', body: [
      'La ventana de check-in abre 30 minutos antes de la partida.',
      'Tolerancia maxima de 10 minutos; pasado ese tiempo se aplica walkover (W.O.).',
    ] },
    { title: '6. Conducta', body: [
      'Prohibido el uso de cheats, exploits o software de terceros.',
      'Lenguaje respetuoso obligatorio dentro y fuera del juego.',
      'El staff puede descalificar por conducta antideportiva sin reembolso.',
    ] },
    { title: '7. Reporte de resultados y disputas', body: [
      'Cada equipo reporta su resultado en la plataforma dentro de los 10 minutos posteriores.',
      'Ante discrepancias, adjuntar evidencia. El fallo del staff es inapelable.',
    ] },
    { title: '8. Premios', body: prizeLines.length ? prizeLines : ['Por anunciar.'] },
  ]
}

// Overlays con datos ricos por torneo (clave = id público del torneo).
const OVERLAY = {
  1: {
    region: 'LATAM',
    entryFee: 0,
    plan: 'pro',
    overcup: { enabled: true, locked: true, secondCheckinHours: 12, secondCheckinDeadline: '2026-06-14 20:00' },
    description: 'El split de primavera mas competitivo de la region. Equipos de elite, fase de grupos y playoffs a eliminacion directa.',
    primaryColor: '#FF4655',
    collaborators: [
      { id: 1, name: 'CasterPro', role: 'Caster principal', avatar: 'https://i.pravatar.cc/64?img=11' },
      { id: 2, name: 'ModNova', role: 'Moderador', avatar: 'https://i.pravatar.cc/64?img=32' },
      { id: 3, name: 'AdminX', role: 'Arbitro', avatar: 'https://i.pravatar.cc/64?img=45' },
    ],
    integrations: {
      whatsapp: { connected: true, number: '+52 55 1234 5678', group: 'GG Spring Staff' },
      discord: { connected: true, server: 'GlitchGang Official', channel: '#spring-split' },
    },
  },
  3: {
    region: 'LATAM',
    integrations: {
      whatsapp: { connected: false, number: '', group: '' },
      discord: { connected: true, server: 'GG Invitational', channel: '#general' },
    },
  },
}

// ── Construcción de los torneos del organizador desde la fuente única ──
function buildOrgTournaments() {
  return TOURNAMENTS.map(t => {
    const detail = TOURNAMENT_DETAILS[t.id] || TOURNAMENT_DETAILS[Number(t.id)] || null
    const overlay = OVERLAY[t.id] || {}
    const art = getGameArt(t.game)
    const formatTxt = formatLabel(t.format)
    const prizePool = toNum(t.prize)
    const entryFee = overlay.entryFee != null ? overlay.entryFee : (t.cost && t.cost !== 'Gratis' ? toNum(t.cost) : 0)
    const prizes = overlay.prizes || defaultPrizes(prizePool)
    const rules = detail?.rules?.length ? detail.rules : defaultRules(t, formatTxt)
    // Plan del organizador: PRO (Discord propio) o GRATIS (coordinar con admins).
    const plan = overlay.plan || t.plan || (entryFee > 0 ? 'pro' : 'free')

    const built = {
      id: t.id,
      title: t.name,
      game: t.game,
      gameCode: t.gameCode,
      publicId: t.publicId,
      internalId: t.internalId,
      status: t.status,
      format: formatTxt,
      capacity: t.slots,
      registered: t.filled,
      prizePool,
      entryFee,
      startDate: t.date,
      startTime: t.time || '19:00',
      revenue: entryFee ? t.filled * entryFee : 0,
      region: overlay.region || 'LATAM',
      platform: t.platform || 'PC',
      category: t.category || 'Mixto',
      creator: t.creator || 'GlitchGang_Admin',
      winner: t.winner || null,
      description: overlay.description || detail?.desc || `Torneo de ${art.name || t.game} organizado en GlitchGang.`,
      banner: art.image,
      primaryColor: overlay.primaryColor || t.color || art.color,
      plan,
      // Sobre cupo: enabled = admite sobre cupo, locked = regla inamovible,
      // secondCheckinHours = ventana del 2º check-in (6-12 h), secondCheckinDeadline = hora límite que pone el organizador.
      overcup: overlay.overcup || t.overcup || { enabled: false, locked: false, secondCheckinHours: 6, secondCheckinDeadline: '' },
      // Check-in vía Discord + bot (regla inamovible en todo torneo). Dos tipos: presencia y previo al torneo.
      checkin: overlay.checkin || {
        provider: 'discord',
        presenceDeadline: '',   // hora/fecha límite del check-in de presencia (la pone el organizador)
        prematchMins: 30,       // minutos antes del inicio para el check-in previo
        toleranceMins: 10,
        botReminders: true,
        autoWalkover: true,
        ownDiscord: plan === 'pro',
        botEnabled: plan === 'pro',
      },
      prizes,
      rules,
      collaborators: overlay.collaborators || [],
      integrations: overlay.integrations || {
        whatsapp: { connected: false, number: '', group: '' },
        discord: { connected: false, server: '', channel: '' },
      },
    }
    built.regulation = overlay.regulation || buildRegulation(built, formatTxt, prizes)
    return built
  })
}

export const ORG_TOURNAMENTS = buildOrgTournaments()

export function getTournamentById(id) {
  return ORG_TOURNAMENTS.find(t => String(t.id) === String(id)) || null
}

