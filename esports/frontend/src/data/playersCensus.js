// ════════════════════════════════════════════════════════════
//  Censo de jugadores — dataset para el panel admin.
//  Datos enriquecidos por jugador (país, juego, nivel, estado…)
//  + IDs oficiales: jugador (público/extenso), país, comunidades,
//    equipos, universidad y plan. Ver lib/ids.js.
//  (Mock data — reemplazar por API real cuando esté disponible)
// ════════════════════════════════════════════════════════════
import {
  getCountryNumber, playerPublicCode, playerInternalCode,
  communityCode, teamPublicCode, teamInternalCode, universityCodes,
  pseudoUuid, shortIdFrom, makeVerifyId, formatYYMMDD,
} from '../lib/ids.js'

// ISO-2 country code → emoji bandera
export function flagOf(code) {
  if (!code || code.length !== 2) return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

const COUNTRY = {
  MX: 'México', AR: 'Argentina', CO: 'Colombia', DO: 'Rep. Dominicana',
  CL: 'Chile', PE: 'Perú', ES: 'España', US: 'EE. UU.', VE: 'Venezuela', EC: 'Ecuador',
}
export const COUNTRY_NAMES = COUNTRY

const G = ['val', 'lol', 'cs2', 'apex', 'rl', 'mlbb']
const PLANS = ['Básico', 'Pro', 'Team', 'Pro Trial']
const RANKS = ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Inmortal', 'Radiante']

// Plan → ID de plan oficial
export const PLAN_IDS = {
  'Básico': 'PLAN-BAS',
  'Pro': 'PLAN-PRO',
  'Team': 'PLAN-TEAM',
  'Pro Trial': 'PLAN-PROT',
}

// ── Comunidades oficiales (una por juego) ──
export const COMMUNITIES = [
  { game: 'val',  name: 'Radiant LATAM',     id: communityCode('Brooklyn',  new Date('2025-01-12'), 1) },
  { game: 'lol',  name: 'Rift Kings',        id: communityCode('NyxPro',     new Date('2025-03-02'), 2) },
  { game: 'cs2',  name: 'Clutch Masters',    id: communityCode('RavenClaw',  new Date('2025-08-23'), 3) },
  { game: 'apex', name: 'Apex Predators',    id: communityCode('IronCore',   new Date('2025-04-18'), 4) },
  { game: 'rl',   name: 'Aerial Demons',     id: communityCode('GlitchWolf', new Date('2025-09-04'), 5) },
  { game: 'mlbb', name: 'MLBB Reyes',        id: communityCode('SolarisX',   new Date('2025-06-04'), 6) },
]
const communityFor = (game) => COMMUNITIES.find(c => c.game === game) || COMMUNITIES[0]

// ── Equipos oficiales (pool) ──
export const TEAMS = [
  { name: 'RD Gang',        country: 'DO', id: teamPublicCode(1, 'DO'), internalId: teamInternalCode(new Date('2025-01-15'), 1, 'DO') },
  { name: 'Pampas Esports', country: 'AR', id: teamPublicCode(1, 'AR'), internalId: teamInternalCode(new Date('2025-02-10'), 1, 'AR') },
  { name: 'Aztech Lobos',   country: 'MX', id: teamPublicCode(1, 'MX'), internalId: teamInternalCode(new Date('2025-03-04'), 1, 'MX') },
  { name: 'Andes Crew',     country: 'CO', id: teamPublicCode(1, 'CO'), internalId: teamInternalCode(new Date('2025-03-20'), 1, 'CO') },
]
const teamFor = (cc) => TEAMS.find(t => t.country === cc) || TEAMS[0]

// ── Universidades (siglas + fecha de registro en la web) ──
export const UNIVERSITIES = [
  { siglas: 'ITLA',  name: 'Instituto Tecnológico de las Américas', country: 'DO', regDate: '2026-10-07' },
  { siglas: 'UASD',  name: 'Universidad Autónoma de Santo Domingo',  country: 'DO', regDate: '2026-02-14' },
  { siglas: 'PUCMM', name: 'Pontificia Universidad Católica Madre y Maestra', country: 'DO', regDate: '2025-11-30' },
  { siglas: 'INTEC', name: 'Instituto Tecnológico de Santo Domingo',  country: 'DO', regDate: '2026-01-20' },
  { siglas: 'UNAM',  name: 'Universidad Nacional Autónoma de México',  country: 'MX', regDate: '2025-09-15' },
  { siglas: 'UBA',   name: 'Universidad de Buenos Aires',             country: 'AR', regDate: '2026-03-05' },
]

// Secuencia ascendente por universidad (para el ID universitario)
const _uniSeq = {}
function makeUniversity(uni, matricula) {
  _uniSeq[uni.siglas] = (_uniSeq[uni.siglas] || 0) + 1
  const codes = universityCodes(uni.siglas, matricula, uni.regDate, _uniSeq[uni.siglas])
  return {
    siglas: uni.siglas, name: uni.name, matricula,
    regDate: uni.regDate,
    id: codes.publicCode,          // ITLA-0614-0001
    internalId: codes.internalCode, // ITLA-0614-071026-0001
  }
}

// Secuencia ascendente de jugadores por país (para el código público/extenso)
const _playerSeq = {}

function mk(id, nick, realName, cc, game, level, status, role, plan, joined, lastActive, matches, winrate, earnings, verified) {
  // birthdate determinista (mock) para el código extenso
  const birth = new Date(1998 + (id % 9), (id * 7) % 12, ((id * 3) % 27) + 1)
  _playerSeq[cc] = (_playerSeq[cc] || 0) + 1
  const seq = _playerSeq[cc]
  const firstName = realName.split(' ')[0]
  const lastName = realName.split(' ').slice(1).join(' ')

  // Comunidades: la de su juego + (jugadores Pro/Team) una segunda
  const communities = [communityFor(game)]
  if ((plan === 'Pro' || plan === 'Team') && game !== 'val') communities.push(communityFor('val'))

  // Equipos: plan Team → equipo de su país; algunos Pro también
  const teams = []
  if (plan === 'Team') teams.push(teamFor(cc))
  else if (plan === 'Pro' && id % 2 === 0) teams.push(teamFor(cc))

  // Universidad: ~40% de los jugadores (determinista)
  let university = null
  if (id % 5 < 2) {
    const uni = UNIVERSITIES[id % UNIVERSITIES.length]
    const matricula = `2023-${String(1000 + id).padStart(4, '0').slice(-4)}` // última parte = matriculaTail
    university = makeUniversity(uni, matricula)
  }

  const publicId = playerPublicCode(firstName, seq, cc)
  const initials = `${(firstName[0] || '')}${(lastName.split(' ').map(w => w[0]).join(''))}`.toUpperCase()

  let finalRole = role
  const rolesList = role === 'user' ? ['user'] : ['user', role]
  const roleProfiles = {}

  if (role === 'admin') {
    rolesList.push('organizer', 'creator')
    roleProfiles.organizer = {
      organizerCode: `ORG-00${id}-01`,
      organizerInternalCode: `ORG-250101-00${id}-01`,
      approvedAt: '2025-01-01T12:00:00Z'
    }
    roleProfiles.creator = {
      creatorCode: `CRE-00${id}-01`,
      creatorInternalCode: `CRE-250101-00${id}-01`,
      approvedAt: '2025-01-01T12:00:00Z'
    }
  }

  if (id === 2 || id === 10 || id === 18) {
    finalRole = 'organizer'
    rolesList.push('organizer')
    roleProfiles.organizer = {
      organizerCode: `ORG-0${id}-01`,
      organizerInternalCode: `ORG-${formatYYMMDD(birth)}-0${id}-01`,
      approvedAt: new Date(birth.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  if (id === 3 || id === 13 || id === 21) {
    finalRole = 'creator'
    rolesList.push('creator')
    roleProfiles.creator = {
      creatorCode: `CRE-0${id}-01`,
      creatorInternalCode: `CRE-${formatYYMMDD(birth)}-0${id}-01`,
      approvedAt: new Date(birth.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  if (id === 5 || id === 15 || id === 25) {
    finalRole = 'caster'
    rolesList.push('caster')
    roleProfiles.caster = {
      casterCode: `CAS-0${id}-01`,
      casterInternalCode: `CAS-${formatYYMMDD(birth)}-0${id}-01`,
      approvedAt: new Date(birth.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  return {
    id, nick, realName,
    publicId,
    internalId: playerInternalCode(firstName, lastName, birth, seq, cc),
    shortId: shortIdFrom(publicId),
    uuid: pseudoUuid(`${publicId}-${id}`),
    verifyId: makeVerifyId(initials, id),
    email: `${nick.toLowerCase()}@gg.gg`,
    phone: `+1 829${String(1000000 + id * 7919).slice(-7)}`,
    gender: ['male', 'female', 'non_binary', 'prefer_not_to_say'][id % 4],
    birthDate: birth.toLocaleDateString('es-DO'),
    age: Math.floor((Date.now() - birth.getTime()) / 31557600000),
    city: COUNTRY[cc] || '—',
    province: '—',
    avatar: `https://i.pravatar.cc/80?img=${(id % 70) + 1}`,
    country: cc, countryName: COUNTRY[cc], countryNumber: getCountryNumber(cc),
    mainGame: game, level,
    rank: RANKS[Math.min(RANKS.length - 1, Math.floor(level / 13))],
    status, role: finalRole, roles: rolesList, roleProfiles, plan, planId: PLAN_IDS[plan] || '—',
    joined, lastActive,
    matches, winrate, earnings, verified,
    communities, teams, university,
  }
}

export const PLAYERS_CENSUS = [
  mk(1,  'Brooklyn',    'Brooklyn García',   'DO', 'val',  47, 'activo',   'admin', 'Pro',       '12 Ene 2025', 'En línea',   555, 68, 4820, true),
  mk(2,  'VoltCarry',   'Mateo Ruiz',        'AR', 'val',  39, 'activo',   'user',  'Team',      '8 Feb 2025',  'Hace 2h',    410, 61, 1200, true),
  mk(3,  'NyxPro',      'Lucía Fernández',   'MX', 'lol',  52, 'activo',   'user',  'Pro',       '2 Mar 2025',  'En línea',   631, 64, 2300, true),
  mk(4,  'GhostZone',   'Diego Soto',        'CO', 'cs2',  21, 'ban',      'user',  'Básico',    '20 Mar 2025', 'Hace 6d',    142, 44, 0,    false),
  mk(5,  'PhantomX',    'Sofía Castro',      'CL', 'val',  33, 'activo',   'user',  'Básico',    '5 Abr 2025',  'Hace 1h',    288, 57, 320,  false),
  mk(6,  'IronCore',    'Bruno Medina',      'PE', 'apex', 45, 'activo',   'mod',   'Team',      '18 Abr 2025', 'Hace 3h',    372, 59, 980,  true),
  mk(7,  'CyberKing',   'Andrés Vela',       'VE', 'cs2',  28, 'inactivo', 'user',  'Básico',    '30 Abr 2025', 'Hace 21d',   201, 49, 0,    false),
  mk(8,  'DarkAce',     'Camila Ortiz',      'ES', 'val',  41, 'activo',   'mod',   'Pro Trial', '10 May 2025', 'En línea',   455, 66, 1640, true),
  mk(9,  'ZeroLatency', 'Tomás Herrera',     'MX', 'rl',   30, 'activo',   'user',  'Básico',    '14 May 2025', 'Hace 4h',    260, 53, 150,  false),
  mk(10, 'MirayaGG',    'Valentina Cruz',    'AR', 'lol',  36, 'activo',   'user',  'Pro',       '21 May 2025', 'Hace 30m',   318, 62, 740,  true),
  mk(11, 'Krypto99',    'Sebastián Mora',    'CO', 'val',  24, 'activo',   'user',  'Básico',    '1 Jun 2025',  'Hace 8h',    176, 51, 0,    false),
  mk(12, 'SolarisX',    'Mariana León',      'CL', 'mlbb', 38, 'activo',   'user',  'Team',      '4 Jun 2025',  'En línea',   340, 58, 510,  false),
  mk(13, 'RiftcatPro',  'Daniel Aguilar',    'PE', 'lol',  49, 'activo',   'user',  'Pro',       '9 Jun 2025',  'Hace 5h',    520, 63, 1320, true),
  mk(14, 'VexonGG',     'Nicolás Ríos',      'DO', 'val',  55, 'activo',   'user',  'Pro',       '15 Jun 2025', 'En línea',   702, 71, 4100, true),
  mk(15, 'NovaStrike',  'Paula Jiménez',     'US', 'cs2',  34, 'activo',   'user',  'Básico',    '20 Jun 2025', 'Hace 1d',    295, 55, 200,  false),
  mk(16, 'EchoFrost',   'Javier Núñez',      'EC', 'apex', 27, 'inactivo', 'user',  'Básico',    '25 Jun 2025', 'Hace 33d',   188, 47, 0,    false),
  mk(17, 'LunaWave',    'Antonia Vargas',    'MX', 'val',  42, 'activo',   'user',  'Pro Trial', '1 Jul 2025',  'Hace 2h',    430, 64, 880,  true),
  mk(18, 'HexBlade',    'Emiliano Paz',      'AR', 'rl',   31, 'activo',   'user',  'Básico',    '6 Jul 2025',  'Hace 11h',   254, 52, 60,   false),
  mk(19, 'StormByte',   'Renata Campos',     'CO', 'lol',  46, 'activo',   'mod',   'Team',      '12 Jul 2025', 'En línea',   488, 60, 1010, true),
  mk(20, 'NightOwl',    'Gael Suárez',       'CL', 'cs2',  23, 'ban',      'user',  'Básico',    '18 Jul 2025', 'Hace 9d',    133, 43, 0,    false),
  mk(21, 'PixelRogue',  'Isabela Méndez',    'PE', 'val',  37, 'activo',   'user',  'Pro',       '24 Jul 2025', 'Hace 6h',    351, 59, 620,  false),
  mk(22, 'TitanFall',   'Maximiliano Gil',   'VE', 'apex', 40, 'activo',   'user',  'Básico',    '30 Jul 2025', 'Hace 3h',    402, 61, 410,  true),
  mk(23, 'ByteQueen',   'Florencia Rojas',   'ES', 'mlbb', 29, 'activo',   'user',  'Básico',    '5 Ago 2025',  'Hace 1d',    230, 54, 90,   false),
  mk(24, 'OmegaShift',  'Thiago Castro',     'MX', 'val',  50, 'activo',   'user',  'Pro',       '11 Ago 2025', 'En línea',   610, 67, 2200, true),
  mk(25, 'FrostByte',   'Agustina Vera',     'AR', 'lol',  26, 'inactivo', 'user',  'Básico',    '17 Ago 2025', 'Hace 18d',   170, 48, 0,    false),
  mk(26, 'RavenClaw',   'Santiago Peña',     'CO', 'cs2',  44, 'activo',   'user',  'Team',      '23 Ago 2025', 'Hace 7h',    466, 62, 940,  true),
  mk(27, 'NeonViper',   'Martina Salas',     'US', 'val',  35, 'activo',   'user',  'Pro Trial', '29 Ago 2025', 'Hace 40m',   305, 58, 480,  false),
  mk(28, 'GlitchWolf',  'Benjamín Torres',   'DO', 'rl',   32, 'activo',   'user',  'Básico',    '4 Sep 2025',  'En línea',   270, 56, 130,  false),
]

export const CENSUS_GAMES = G
export const CENSUS_ROLES = {
  user: 'Jugador',
  mod: 'Moderador',
  admin: 'Admin',
  organizer: 'Organizador',
  creator: 'Creador',
  coach: 'Coach',
  caster: 'Caster',
  analyst: 'Analista',
  sponsor: 'Patrocinador'
}

// Normaliza una fila del censo que viene del backend (GET /admin/census)
// para que tenga la misma forma que los datos mock que usa el panel.
export function adaptCensusRow(r) {
  return {
    level: 1, rank: '—', matches: 0, winrate: 0, earnings: 0,
    ...r,
    roles: r.roles || [r.role || 'user'],
    countryName: COUNTRY[r.country] || r.country || '—',
    shortId: r.shortId || shortIdFrom(r.publicId),
    uuid: r.uuid || pseudoUuid(`${r.publicId}-${r.id}`),
    verifyId: r.verifyId || makeVerifyId(String(r.nick || 'GG').slice(0, 3), r.id),
    communities: r.communities || [],
    teams: r.teams || [],
    university: r.university || null,
    avatar: r.avatar || '/demos/steliant-esports/avatar-default.svg',
  }
}

