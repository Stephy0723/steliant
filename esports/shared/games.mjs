// Catalogo canonico de juegos, compartido por frontend y backend.
// El frontend (frontend/src/data/games.js) importa GAME_CATALOG y le agrega
// arte, tags y descripciones. El backend lo usa para validar `gameId` y para
// resolver la modalidad permitida sin depender del bundle del frontend.
//
// Cada fila: [id, name, categoryId, logo, officialLogo?]

export const GAME_CATALOG = [
  // MOBA
  ['league-of-legends', 'League of Legends', 'moba', '/demos/steliant-esports/Logo/WildRift.png'],
  ['dota-2', 'Dota 2', 'moba', '/demos/steliant-esports/Logo/Dota2.png'],
  ['honor-of-kings', 'Honor of Kings', 'moba', '/demos/steliant-esports/Logo/download.png'],
  ['mobile-legends-bang-bang', 'Mobile Legends: Bang Bang', 'moba', '/demos/steliant-esports/Logo/mlbb.png'],
  ['league-of-legends-wild-rift', 'League of Legends: Wild Rift', 'moba', '/demos/steliant-esports/Logo/WildRift.png'],
  ['arena-of-valor', 'Arena of Valor', 'moba', '/demos/steliant-esports/Logo/ArenaOfValor.webp'],
  ['pokemon-unite', 'Pokémon Unite', 'moba', null],
  ['smite', 'Smite', 'moba', null],

  // Shooters / Battle Royale
  ['valorant', 'Valorant', 'shooters-battle-royale', '/demos/steliant-esports/Logo/Valorant.png'],
  ['counter-strike-2', 'Counter-Strike 2', 'shooters-battle-royale', '/demos/steliant-esports/Logo/cs2.png'],
  ['fortnite', 'Fortnite', 'shooters-battle-royale', null],
  ['apex-legends', 'Apex Legends', 'shooters-battle-royale', '/demos/steliant-esports/Logo/Apex_Legends_logo.png'],
  ['overwatch', 'Overwatch', 'shooters-battle-royale', '/demos/steliant-esports/Logo/Overwatch.webp'],
  ['overwatch-2', 'Overwatch 2', 'shooters-battle-royale', null],
  ['rainbow-six-siege', 'Rainbow Six Siege', 'shooters-battle-royale', null],
  ['call-of-duty-warzone-mobile', 'Call of Duty: Warzone Mobile', 'shooters-battle-royale', '/demos/steliant-esports/Logo/CallofDutyWarzone.png'],
  ['free-fire', 'Free Fire', 'shooters-battle-royale', '/demos/steliant-esports/Logo/FF.png'],
  ['pubg-mobile', 'PUBG Mobile', 'shooters-battle-royale', '/demos/steliant-esports/Logo/PubgMobile.jpg'],
  ['farlight-84', 'Farlight 84', 'shooters-battle-royale', null],

  // Fighting Games
  ['street-fighter-6', 'Street Fighter 6', 'fighting-games', '/demos/steliant-esports/Logo/sf6.png'],
  ['tekken-8', 'Tekken 8', 'fighting-games', '/demos/steliant-esports/Logo/Tekken8.png'],
  ['mortal-kombat-1', 'Mortal Kombat 1', 'fighting-games', null],
  ['guilty-gear-strive', 'Guilty Gear Strive', 'fighting-games', null],
  // Disciplina de la Copa Universitaria Popular (Banco Popular, RD).
  ['super-smash-bros-ultimate', 'Super Smash Bros. Ultimate', 'fighting-games', null],
  ['brawlhalla-comunitario', 'Brawlhalla Comunitario', 'fighting-games', null, false],

  // Strategy / Cards
  ['teamfight-tactics', 'Teamfight Tactics (TFT)', 'strategy-cards', '/demos/steliant-esports/Logo/teamfight.png'],
  ['hearthstone', 'Hearthstone', 'strategy-cards', null],
  ['legends-of-runeterra', 'Legends of Runeterra', 'strategy-cards', null],
  ['marvel-snap', 'Marvel Snap', 'strategy-cards', null],
  ['clash-royale', 'Clash Royale', 'strategy-cards', '/demos/steliant-esports/Logo/clashroyale.png'],
  // RTS
  ['starcraft-ii', 'StarCraft II', 'rts', null],

  // Sports / Racing
  ['rocket-league', 'Rocket League', 'sports-racing', '/demos/steliant-esports/Logo/RocketLeague.png'],
  ['ea-sports-fc-25', 'EA Sports FC 25', 'sports-racing', '/demos/steliant-esports/Logo/Fifa.png'],
  ['ea-sports-fc-mobile', 'EA Sports FC Mobile', 'sports-racing', '/demos/steliant-esports/Logo/Fifa.png'],
  ['rocket-league-sideswipe', 'Rocket League Sideswipe', 'sports-racing', '/demos/steliant-esports/Logo/RocketLeague.png'],
  ['efootball-mobile', 'eFootball Mobile', 'sports-racing', null],
  // Disciplina de la Copa Universitaria Popular. Sin año en el id: cada
  // temporada sale una edición nueva (2K25, 2K26, 2K27...).
  ['nba-2k', 'NBA 2K', 'sports-racing', null],

  // Simulators
  ['iracing', 'iRacing', 'simulators', null],
  ['assetto-corsa-competizione', 'Assetto Corsa Competizione', 'simulators', null],
  ['microsoft-flight-simulator-2024', 'Microsoft Flight Simulator 2024', 'simulators', null],
  // MMORPG
  ['genshin', 'Genshin Impact', 'mmo-competitivo', '/demos/steliant-esports/Logo/genshinImpact.png'],
  ['world-of-warcraft-arena', 'World of Warcraft (Arena)', 'mmo-competitivo', null],
  ['wuthering-waves', 'Wuthering Waves', 'mmo-competitivo', '/demos/steliant-esports/Logo/WutheringWaves.png'],
  ['guild-wars-2-pvp', 'Guild Wars 2 (PvP)', 'mmo-competitivo', null],

  // Party / Casual
  ['fall-guys', 'Fall Guys', 'party-casual', null],
  ['among-us-competitivo', 'Among Us Competitivo', 'party-casual', null],
]

// Modalidades permitidas por juego. Por ahora solo MOBAs (decision de alcance:
// "solo trabajaremos con mobas por ahora"). La primera es la modalidad por
// defecto. Un juego sin entrada usa GENERIC_MODALITIES en el formulario.
export const GAME_MODALITIES = {
  'league-of-legends': ['5v5', '1v1', '2v2'],
  'dota-2': ['5v5', '1v1'],
  'honor-of-kings': ['5v5'],
  'mobile-legends-bang-bang': ['5v5'],
  'league-of-legends-wild-rift': ['5v5'],
  'arena-of-valor': ['5v5'],
  'pokemon-unite': ['5v5'],
  smite: ['5v5', '3v3'],
}

export const GENERIC_MODALITIES = ['1v1', '2v2', '3v3', '5v5', 'Individual', 'Por equipos']

const MOBA_IDS = GAME_CATALOG.filter(([, , categoryId]) => categoryId === 'moba').map(([id]) => id)

export function isMobaGame(gameId) {
  return MOBA_IDS.includes(String(gameId || ''))
}

const norm = value => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')

const BY_ID = new Map(GAME_CATALOG.map(row => [row[0], row]))
const BY_NAME = new Map(GAME_CATALOG.map(row => [norm(row[1]), row[0]]))

// Nombres cortos o antiguos que aparecen en torneos ya creados.
const NAME_ALIASES = {
  'cs2': 'counter-strike-2', 'csgo': 'counter-strike-2', 'counter strike': 'counter-strike-2',
  'lol': 'league-of-legends', 'league': 'league-of-legends',
  'wild rift': 'league-of-legends-wild-rift', 'lol wild rift': 'league-of-legends-wild-rift',
  'mlbb': 'mobile-legends-bang-bang', 'mobile legends': 'mobile-legends-bang-bang',
  'hok': 'honor-of-kings', 'aov': 'arena-of-valor', 'dota': 'dota-2',
  'tft': 'teamfight-tactics', 'pubgm': 'pubg-mobile', 'cod warzone mobile': 'call-of-duty-warzone-mobile',
  'rl': 'rocket-league', 'sf6': 'street-fighter-6', 'ea fc 25': 'ea-sports-fc-25', 'fc 25': 'ea-sports-fc-25',
  'fifa': 'ea-sports-fc-25', 'fifa 20': 'ea-sports-fc-25', 'fifa 21': 'ea-sports-fc-25', 'fifa 22': 'ea-sports-fc-25',
  'fifa 23': 'ea-sports-fc-25', 'ea fc': 'ea-sports-fc-25',
  'smash': 'super-smash-bros-ultimate', 'ssbu': 'super-smash-bros-ultimate', 'smash bros': 'super-smash-bros-ultimate',
  'smash ultimate': 'super-smash-bros-ultimate',
  'nba2k': 'nba-2k', '2k': 'nba-2k',
}

export function gameName(gameId) {
  return BY_ID.get(String(gameId || ''))?.[1] || ''
}

export function gameCategoryId(gameId) {
  return BY_ID.get(String(gameId || ''))?.[2] || ''
}

// Resuelve un id estable a partir del nombre visible. Usado por la migracion
// y como red de seguridad para borradores viejos que guardaban `game` (nombre).
export function gameIdFromName(name) {
  const key = norm(name)
  if (!key) return ''
  if (BY_ID.has(String(name || ''))) return String(name)
  if (BY_NAME.has(key)) return BY_NAME.get(key)
  if (NAME_ALIASES[key]) return NAME_ALIASES[key]
  // Ultimo recurso: el nombre del catalogo empieza por lo que nos pasaron
  // (p. ej. "Mobile Legends" -> "Mobile Legends: Bang Bang"). Con menos de 4
  // letras no: "a" acababa siendo "Arena of Valor".
  if (key.length < 4) return ''
  for (const [catName, id] of BY_NAME) {
    if (catName.startsWith(key) || key.startsWith(catName)) return id
  }
  return ''
}

// Clave estable para comparar juegos guardados como texto libre (Team.game,
// Tournament.game): "Valorant", "valorant" y "valorant" dan la misma clave.
// Un juego fuera del catalogo cae a su nombre normalizado; '' si no hay juego.
export function gameKeyOf(game) {
  return gameIdFromName(game) || norm(game)
}

export function isValidGameId(gameId) {
  return BY_ID.has(String(gameId || ''))
}

export function modalitiesFor(gameId) {
  return GAME_MODALITIES[String(gameId || '')] || GENERIC_MODALITIES
}

export function defaultModalityFor(gameId) {
  return modalitiesFor(gameId)[0] || '5v5'
}

// Cuantos titulares por equipo exige una modalidad ("1v1 (Duelo)" -> 1,
// "5v5" -> 5). null cuando el texto no dice nada reconocible -- el llamador
// debe tratarlo como torneo por equipos (comportamiento previo, no rompe
// nada existente).
export function parseRequiredRosterSize(modality) {
  const text = String(modality || '').toLowerCase()
  const versus = text.match(/(\d+)\s*v\s*\d+/)
  if (versus) return Math.max(1, Number(versus[1]) || 1)
  if (/\bindividual\b|\bsolo\b/.test(text)) return 1
  return null
}

// Un torneo es "individual" (se inscribe una persona, no un equipo) cuando
// su modalidad pide exactamente 1 titular.
export function isSoloModality(modality) {
  return parseRequiredRosterSize(modality) === 1
}

