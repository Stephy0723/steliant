// Como identifica cada juego a un jugador. Compartido por frontend (etiqueta,
// ejemplo y aviso al escribir) y backend (rechaza lo que no puede ser valido).
//
// strict: true  -> formato publico y estable; el backend rechaza lo que no cumple.
// strict: false -> solo se muestra la pista; no se bloquea (formato no oficial o
//                  que el juego cambia seguido -- mejor aceptar un ID raro que
//                  rechazar uno real).
import { GAME_CATALOG, gameKeyOf } from './games.mjs'

const digits = (min, max) => new RegExp(`^\\d{${min},${max}}$`)

export const ACCOUNT_FORMATS = {
  riot: {
    label: 'Riot ID',
    placeholder: 'Nombre#TAG',
    hint: 'Nombre (3-16) + # + tag de 3-5 letras o números. Lo ves en el cliente de Riot. Ej: Jugador#LAN',
    pattern: /^[^#]{3,16}#[A-Za-z0-9]{3,5}$/,
    strict: true,
  },
  battlenet: {
    label: 'BattleTag',
    placeholder: 'Nombre#12345',
    hint: 'Tu BattleTag de Battle.net: nombre + # + números. Ej: Jugador#1234',
    pattern: /^[^#\s]{3,12}#\d{4,6}$/,
    strict: true,
  },
  activision: {
    label: 'Activision ID',
    placeholder: 'Nombre#1234567',
    hint: 'Nombre + # + números (Perfil > Activision ID). Ej: Jugador#1234567',
    pattern: /^[^#]{2,16}#\d{4,8}$/,
    strict: true,
  },
  steam: {
    label: 'Steam ID / código de amigo',
    placeholder: '123456789',
    hint: 'Código de amigo de Steam (solo números) o SteamID64 (17 dígitos, empieza por 7656119).',
    pattern: /^(\d{3,10}|7656119\d{10})$/,
    strict: true,
  },
  mlbb: {
    label: 'ID + Zona',
    placeholder: '123456789 (1234)',
    hint: 'User ID y Zone ID tal como salen en tu perfil: 123456789 (1234).',
    pattern: /^\d{6,12}\s*\(\s*\d{3,6}\s*\)$/,
    normalize: v => v.replace(/^(\d{6,12})\s*\(?\s*(\d{3,6})\s*\)?$/, '$1 ($2)'),
    strict: true,
  },
  supercell: {
    label: 'Tag de jugador',
    placeholder: '#2PP0YLQ8',
    hint: 'El tag de tu perfil empieza con # (solo usa 0 2 8 9 P Y L Q G R J C U V).',
    pattern: /^#[0289PYLQGRJCUV]{3,12}$/,
    normalize: v => `#${v.replace(/^#/, '').toUpperCase()}`,
    strict: true,
  },
  nintendo: {
    label: 'Código de amigo (Switch)',
    placeholder: 'SW-1234-5678-9012',
    hint: 'Tu código de amigo de Nintendo Switch: SW + 12 números.',
    pattern: /^SW-\d{4}-\d{4}-\d{4}$/,
    normalize: (v) => {
      const d = v.replace(/\D/g, '')
      return d.length === 12 ? `SW-${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : v.toUpperCase()
    },
    strict: true,
  },
  gw2: {
    label: 'Nombre de cuenta',
    placeholder: 'Nombre.1234',
    hint: 'Nombre de cuenta de Guild Wars 2: nombre + punto + 4 números.',
    pattern: /^[^.]{3,27}\.\d{4}$/,
    strict: true,
  },
  uid: {
    label: 'UID',
    placeholder: '123456789',
    hint: 'El número de jugador (UID) que sale en tu perfil del juego.',
    pattern: digits(6, 12),
    strict: true,
  },
  epic: {
    label: 'Epic Games ID',
    placeholder: 'NombreEpic',
    hint: 'Tu nombre visible de Epic Games (3-16 caracteres).',
    pattern: /^.{3,16}$/,
    strict: false,
  },
  ea: {
    label: 'EA ID',
    placeholder: 'NombreEA',
    hint: 'Tu EA ID (cuenta de EA / EA app).',
    pattern: /^[A-Za-z0-9_.-]{4,16}$/,
    strict: false,
  },
  ubisoft: {
    label: 'Ubisoft ID',
    placeholder: 'NombreUbi',
    hint: 'Tu nombre de Ubisoft Connect.',
    pattern: /^[A-Za-z0-9._-]{3,15}$/,
    strict: false,
  },
  tekken: {
    label: 'TEKKEN ID',
    placeholder: '5LYQ-8aft-haM2',
    hint: 'El TEKKEN ID de tu tarjeta de jugador: 3 bloques de 4 caracteres.',
    pattern: /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/,
    strict: false,
  },
  capcom: {
    label: 'User Code (CFN)',
    placeholder: '1234567890',
    hint: 'Tu User Code de Capcom Fighters Network (Perfil > Fighter ID).',
    pattern: digits(8, 12),
    strict: false,
  },
  trainer: {
    label: 'ID de entrenador',
    placeholder: 'ABC1234',
    hint: 'El ID de entrenador de tu perfil de Pokémon Unite.',
    pattern: /^[A-Za-z0-9]{5,12}$/,
    strict: false,
  },
  amongus: {
    label: 'Código de amigo',
    placeholder: 'nombre#1234',
    hint: 'Tu código de amigo de Among Us.',
    pattern: /^[A-Za-z]+#\d{4}$/,
    strict: false,
  },
  wow: {
    label: 'Personaje-Reino',
    placeholder: 'Nombre-Ragnaros',
    hint: 'Tu personaje y su reino, separados por guion.',
    pattern: /^[^-\s]{2,12}-.{3,30}$/,
    strict: false,
  },
  iracing: {
    label: 'Customer ID',
    placeholder: '123456',
    hint: 'Tu Customer ID de iRacing (Account > Customer ID).',
    pattern: digits(3, 8),
    strict: false,
  },
  platform: {
    label: 'Usuario de tu plataforma',
    placeholder: 'PSN / Xbox / Steam',
    hint: 'Tu usuario en la plataforma donde juegas (PSN, Xbox, Steam o Switch).',
    pattern: /^.{3,32}$/,
    strict: false,
  },
  generic: {
    label: 'ID en el juego',
    placeholder: 'Tu ID o nombre dentro del juego',
    hint: '',
    pattern: /^.{2,40}$/,
    strict: false,
  },
}

// Plataforma de identidad por juego del catalogo (shared/games.mjs).
export const GAME_ACCOUNT_FORMAT = {
  'league-of-legends': 'riot',
  'league-of-legends-wild-rift': 'riot',
  valorant: 'riot',
  'teamfight-tactics': 'riot',
  'legends-of-runeterra': 'riot',
  'dota-2': 'steam',
  'counter-strike-2': 'steam',
  overwatch: 'battlenet',
  'overwatch-2': 'battlenet',
  hearthstone: 'battlenet',
  'starcraft-ii': 'battlenet',
  'world-of-warcraft-arena': 'wow',
  'call-of-duty-warzone-mobile': 'activision',
  'mobile-legends-bang-bang': 'mlbb',
  'clash-royale': 'supercell',
  'super-smash-bros-ultimate': 'nintendo',
  'guild-wars-2-pvp': 'gw2',
  'free-fire': 'uid',
  'pubg-mobile': 'uid',
  'honor-of-kings': 'uid',
  'arena-of-valor': 'uid',
  'farlight-84': 'uid',
  genshin: 'uid',
  'wuthering-waves': 'uid',
  fortnite: 'epic',
  'rocket-league': 'epic',
  'rocket-league-sideswipe': 'epic',
  'fall-guys': 'epic',
  'apex-legends': 'ea',
  'ea-sports-fc-25': 'ea',
  'ea-sports-fc-mobile': 'generic',
  'rainbow-six-siege': 'ubisoft',
  'tekken-8': 'tekken',
  'street-fighter-6': 'capcom',
  'pokemon-unite': 'trainer',
  'among-us-competitivo': 'amongus',
  iracing: 'iracing',
  'mortal-kombat-1': 'platform',
  'guilty-gear-strive': 'platform',
  'nba-2k': 'platform',
  'assetto-corsa-competizione': 'steam',
  'microsoft-flight-simulator-2024': 'platform',
  smite: 'generic',
  'marvel-snap': 'generic',
  'efootball-mobile': 'generic',
  'brawlhalla-comunitario': 'generic',
}

const CATALOG_IDS = new Set(GAME_CATALOG.map(([id]) => id))

/** Formato de ID para un juego (id del catalogo o nombre visible). */
export function gameAccountFormat(game) {
  const key = gameKeyOf(game)
  const formatKey = (CATALOG_IDS.has(key) && GAME_ACCOUNT_FORMAT[key]) || 'generic'
  return { key: formatKey, ...ACCOUNT_FORMATS[formatKey] }
}

/**
 * Valida/normaliza el ID de cuenta de `game`. Vacio es valido (es opcional).
 * { ok, value, message, strict } -- `ok:false` con strict:false es solo aviso.
 */
export function checkGameAccountId(game, raw) {
  const format = gameAccountFormat(game)
  let value = String(raw ?? '').trim().replace(/\s*#\s*/g, '#')
  if (!value) return { ok: true, value: '', message: '', strict: format.strict }
  if (format.normalize) value = format.normalize(value)
  if (format.pattern.test(value)) return { ok: true, value, message: '', strict: format.strict }
  return {
    ok: false,
    value,
    strict: format.strict,
    message: `Ese ${format.label} no tiene el formato esperado (${format.placeholder}). ${format.hint}`.trim(),
  }
}

