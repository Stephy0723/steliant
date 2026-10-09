import { defaultModalityFor, modalitiesFor, isSoloModality } from '../../../shared/games.mjs'

export { modalitiesFor, isSoloModality }

const VERIFIED_AT = '2026-09-08'
const options = rows => rows.map(row => Array.isArray(row) ? { value: row[0], label: row[1] } : { value: row, label: row })
const patch = (version, source) => ({ version, source, verifiedAt: VERIFIED_AT })
const riotPlatforms = options([
  ['LA1', 'Latinoamerica Norte (LA1)'], ['LA2', 'Latinoamerica Sur (LA2)'],
  ['NA1', 'Norteamerica (NA1)'], ['BR1', 'Brasil (BR1)'],
  ['EUW1', 'Europa Oeste (EUW1)'], ['EUN1', 'Europa Nordica y Este (EUN1)'],
  ['KR', 'Corea (KR)'], ['JP1', 'Japon (JP1)'], ['OC1', 'Oceania (OC1)'],
  ['TR1', 'Turquia (TR1)'], ['RU', 'Rusia (RU)'], ['SG2', 'Singapur (SG2)'],
  ['TW2', 'Taiwan (TW2)'], ['VN2', 'Vietnam (VN2)'],
])
const riotSource = 'https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends'
// Organizer-defined regions are not account Zone IDs or measured datacenters.
const declaredRegions = options(['LATAM Norte', 'LATAM Sur', 'Brasil', 'Norteamerica', 'Europa', 'Sudeste Asiatico', 'Medio Oriente'].map(name => [`${name} (region declarada)`, name]))

// Map lists are catalog suggestions for custom tournaments, not certified active rotations.
export const TOURNAMENT_GAME_CONFIG = {
  'league-of-legends': {
    platform: 'pc', modality: '5v5', servers: riotPlatforms, serverSource: riotSource,
    maps: ['Grieta del Invocador', 'Abismo de los Lamentos'],
    mapSource: 'https://www.leagueoflegends.com/en-us/how-to-play/',
    patch: patch('26.17', 'https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-17-notes/'),
  },
  'league-of-legends-wild-rift': {
    platform: 'mobile', modality: '5v5',
    servers: options(['Americas', 'Europa y Asia']),
    serverSource: 'https://support-wildrift.riotgames.com/hc/en-us/articles/360061650574-Wild-Rift-Americas-Server-Launch',
    maps: ['Grieta Salvaje', 'Abismo de los Lamentos'],
    mapSource: 'https://wildrift.leagueoflegends.com/en-us/',
    patch: patch('7.2d', 'https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-7-2d/'),
  },
  'mobile-legends-bang-bang': {
    platform: 'mobile', modality: '5v5', servers: declaredRegions, declaredRegions: true,
    maps: ['Land of Dawn', 'Dangerous Grass', 'Broken Walls', 'Flying Cloud', 'Expanding Rivers'],
    mapSource: 'https://en.moonton.com/news/237.html',
  },
  'honor-of-kings': {
    platform: 'mobile', modality: '5v5', servers: declaredRegions, declaredRegions: true,
    maps: [],
  },
  valorant: {
    platform: 'pc', modality: '5v5',
    servers: options(['LATAM', 'NA', 'BR', 'EU', 'AP', 'KR']),
    serverSource: 'https://support-valorant.riotgames.com/hc/en-us/articles/360047379834-Changing-Your-Region-of-Residence-for-Your-Riot-Account',
    maps: ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss', 'Corrode', 'Summit'],
    mapSource: 'https://playvalorant.com/en-us/maps/',
    patch: patch('13.05', 'https://playvalorant.com/en-us/news/tags/patch-notes/'),
  },
  'teamfight-tactics': {
    platform: 'cross', modality: 'Todos contra todos', servers: riotPlatforms, serverSource: riotSource,
    maps: [],
    patch: patch('18.1', 'https://teamfighttactics.leagueoflegends.com/en-sg/news/game-updates/teamfight-tactics-patch-18-1/'),
  },
  'rocket-league': {
    platform: 'cross', modality: '3v3',
    servers: options([
      ['USE', 'Estados Unidos Este (USE)'], ['USC', 'Estados Unidos Centro (USC)'], ['USW', 'Estados Unidos Oeste (USW)'],
      ['SAM', 'Sudamerica (SAM)'], ['EU', 'Europa (EU)'], ['ASC', 'Asia Sudeste continental (ASC)'],
      ['ASM', 'Asia Sudeste maritima (ASM)'], ['JPN', 'Asia Este (JPN)'], ['ME', 'Medio Oriente (ME)'],
      ['OCE', 'Oceania (OCE)'], ['SAF', 'Sudafrica (SAF)'], ['IND', 'India (IND)'],
    ]),
    serverSource: 'https://www.epicgames.com/help/c-202300000001622/c-202300000001682/welche-region-sollte-ich-auswahlen-um-rocket-league-zu-spielen-a202300000012391',
    maps: ['DFH Stadium', 'Mannfield', 'Champions Field', 'Utopia Coliseum', 'Beckwith Park'],
    mapSource: 'https://www.rocketleague.com/',
    patch: patch('2.72', 'https://www.rocketleague.com/news/rocket-league-patch-notes-v2-72'),
  },
}

export function gameConfig(gameId) {
  return TOURNAMENT_GAME_CONFIG[gameId] || { maps: [], servers: [] }
}

export function suggestedPatch(config, now = Date.now()) {
  if (!config.patch) return ''
  const age = now - Date.parse(`${config.patch.verifiedAt}T00:00:00Z`)
  return age >= 0 && age <= 30 * 86400000 ? config.patch.version : ''
}

export function defaultGameBanner(game) {
  return game?.images?.horizontal || game?.image || ''
}

export function gameSelection(form, game, now = Date.now(), previousGame) {
  const config = gameConfig(game?.id)
  const customBanner = form.banner && (form.bannerName || form.banner !== defaultGameBanner(previousGame))
  return {
    ...form, gameId: game?.id || '', game: game?.name || '', categoryId: game?.categoryId || '',
    patch: suggestedPatch(config, now), server: '',
    mapPool: '', mapMode: 'fixed', platform: config.platform || 'pc',
    modality: game ? (config.modality || defaultModalityFor(game.id)) : '',
    banner: customBanner ? form.banner : defaultGameBanner(game), bannerName: customBanner ? form.bannerName : '',
  }
}

export function mapNames(value) {
  const names = String(value || '').split(',').map(name => name.trim()).filter(Boolean)
  return names.filter((name, index) => names.findIndex(other => other.toLowerCase() === name.toLowerCase()) === index)
}

export function changeMapMode(form, mode) {
  return { ...form, mapMode: mode, mapPool: mode === 'fixed' && mapNames(form.mapPool).length > 1 ? '' : form.mapPool }
}

