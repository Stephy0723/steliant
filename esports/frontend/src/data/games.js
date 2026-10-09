// Catálogo canónico de videojuegos. Los formularios deben consumir esta fuente
// en vez de mantener listas locales que se desactualizan o se truncarán.
import { GAME_CATALOG as CATALOG, gameIdFromName } from '../../../shared/games.mjs'
export const GAME_CATEGORIES = [
  { id: 'esports', name: 'eSports' },
  { id: 'moba', name: 'MOBA' },
  { id: 'shooters-battle-royale', name: 'Shooters / Battle Royale' },
  { id: 'fighting-games', name: 'Fighting Games' },
  { id: 'strategy-cards', name: 'Estrategia y Cartas' },
  { id: 'rts', name: 'Estrategia / RTS' },
  { id: 'sports-racing', name: 'Deportes y Carreras' },
  { id: 'simulators', name: 'Simuladores' },
  { id: 'mmo-competitivo', name: 'MMORPG' },
  { id: 'party-casual', name: 'Party / Casual' },
]

const CATEGORY_ART = {
  esports: { image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg', color: '#00E676', colorB: '#0a1a10' },
  moba: { image: '/demos/steliant-esports/ImaHorizontal/hok.jpg', color: '#29c5f6', colorB: '#071b2c' },
  'shooters-battle-royale': { image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg', color: '#ff4655', colorB: '#170b12' },
  'fighting-games': { image: '/demos/steliant-esports/ImaHorizontal/sf6.jpg', color: '#ff7a18', colorB: '#1e0c07' },
  'strategy-cards': { image: '/demos/steliant-esports/ImaHorizontal/TFT.jpg', color: '#b68cff', colorB: '#140d25' },
  rts: { image: '/demos/steliant-esports/ImaHorizontal/Starcraft.jpg', color: '#ffaa00', colorB: '#1f1300' },
  'sports-racing': { image: '/demos/steliant-esports/ImaHorizontal/rocket.jpg', color: '#38bdf8', colorB: '#07192b' },
  simulators: { image: '/demos/steliant-esports/ImaHorizontal/rocket.jpg', color: '#00bcd4', colorB: '#001a1e' },
  'mmo-competitivo': { image: '/demos/steliant-esports/ImaHorizontal/Runeterra.jpg', color: '#e040fb', colorB: '#1b0520' },
  'party-casual': { image: '/demos/steliant-esports/ImaHorizontal/ClashRoyal.jpg', color: '#ffd600', colorB: '#1f1a00' },
}

const GAME_ART = {
  'league-of-legends': '/demos/steliant-esports/ImaHorizontal/lol.jpg',
  'dota-2': '/demos/steliant-esports/ImaHorizontal/Dota2.jpg',
  'honor-of-kings': '/demos/steliant-esports/ImaHorizontal/hok.jpg',
  'mobile-legends-bang-bang': '/demos/steliant-esports/ImaHorizontal/Mlbb.jpg',
  'league-of-legends-wild-rift': '/demos/steliant-esports/ImaHorizontal/Wildrift.jpg',
  'arena-of-valor': '/demos/steliant-esports/ImaHorizontal/Arenaofvalor.jpg',
  'pokemon-unite': '/demos/steliant-esports/ImaHorizontal/Pokemon.jpg',
  'valorant': '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
  'counter-strike-2': '/demos/steliant-esports/ImaHorizontal/cs2.jpg',
  'fortnite': '/demos/steliant-esports/ImaHorizontal/fornite.jpg',
  'apex-legends': '/demos/steliant-esports/ImaHorizontal/Apex.jpg',
  'call-of-duty-warzone-mobile': '/demos/steliant-esports/ImaHorizontal/Cod.jpg',
  'free-fire': '/demos/steliant-esports/ImaHorizontal/Frefire.jpg',
  'pubg-mobile': '/demos/steliant-esports/ImaHorizontal/pubg.jpg',
  'farlight-84': '/demos/steliant-esports/ImaHorizontal/Farlight84.jpg',
  overwatch: '/demos/steliant-esports/ImaHorizontal/Overwatch.jpg',
  'street-fighter-6': '/demos/steliant-esports/ImaHorizontal/sf6.jpg',
  'tekken-8': '/demos/steliant-esports/ImaHorizontal/tekken8.webp',
  'mortal-kombat-1': '/demos/steliant-esports/ImaHorizontal/Mk1.jpg',
  'guilty-gear-strive': '/demos/steliant-esports/ImaHorizontal/Guilty Gear Strive.jpg',
  'teamfight-tactics': '/demos/steliant-esports/ImaHorizontal/TFT.jpg',
  'marvel-snap': '/demos/steliant-esports/ImaHorizontal/TFT.jpg',
  'clash-royale': '/demos/steliant-esports/ImaHorizontal/ClashRoyal.jpg',
  'rocket-league': '/demos/steliant-esports/ImaHorizontal/rocket.jpg',
  'ea-sports-fc-25': '/demos/steliant-esports/ImaHorizontal/fifa.png',
  'ea-sports-fc-mobile': '/demos/steliant-esports/ImaHorizontal/fifa.png',
  'rocket-league-sideswipe': '/demos/steliant-esports/ImaHorizontal/rocket.jpg',
  'efootball-mobile': '/demos/steliant-esports/ImaHorizontal/Efootball.jpg',
  'brawlhalla-comunitario': '/demos/steliant-esports/ImaHorizontal/sf6.jpg',
  'fall-guys': '/demos/steliant-esports/ImaHorizontal/Fallguys.jpg',
  'overwatch-2': '/demos/steliant-esports/ImaHorizontal/Overwatc2.png',
  'rainbow-six-siege': '/demos/steliant-esports/ImaHorizontal/6Siege.jpg',
  'starcraft-ii': '/demos/steliant-esports/ImaHorizontal/Starcraft.jpg',
  'hearthstone': '/demos/steliant-esports/ImaHorizontal/Hearthstone.jpg',
  'legends-of-runeterra': '/demos/steliant-esports/ImaHorizontal/Runeterra.jpg',
  'smite': '/demos/steliant-esports/ImaHorizontal/Smite.jpg',
  genshin: '/demos/steliant-esports/ImaHorizontal/Genshin.jpg',
  // Antes WoW y GW2 usaban la foto de Legends of Runeterra, Among Us la de
  // Clash Royale y eFootball la de FIFA; los simuladores no tenian ninguna.
  'world-of-warcraft-arena': '/demos/steliant-esports/ImaHorizontal/WorldOfWarcraft.jpg',
  'wuthering-waves': '/demos/steliant-esports/ImaHorizontal/Wuwa.jpg',
  'guild-wars-2-pvp': '/demos/steliant-esports/ImaHorizontal/GuildWars2.jpg',
  'among-us-competitivo': '/demos/steliant-esports/ImaHorizontal/AmongUs.jpg',
  iracing: '/demos/steliant-esports/ImaHorizontal/Iracing.jpg',
  'assetto-corsa-competizione': '/demos/steliant-esports/ImaHorizontal/AssettoCorsaComp.jpg',
  'microsoft-flight-simulator-2024': '/demos/steliant-esports/ImaHorizontal/FlightSim2024.jpg',
  'super-smash-bros-ultimate': '/demos/steliant-esports/ImaHorizontal/SmashUltimate.jpg',
  'nba-2k': '/demos/steliant-esports/ImaHorizontal/Nba2k.jpg',
}

const GAME_MEDIA = {
  'league-of-legends': {
    poster: '/demos/steliant-esports/ImaHorizontal/lol.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Lol5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Lol2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Lol3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Lol4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Lol5.jpg' },
  },
  'dota-2': {
    poster: '/demos/steliant-esports/ImaHorizontal/Dota2.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Dota25.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Dota22.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Dota23.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Dota24.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Dota25.jpg' },
  },
  'honor-of-kings': {
    poster: '/demos/steliant-esports/ImaHorizontal/hok.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Hok5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Hok2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Hok3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Hok4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Hok5.jpg' },
  },
  'mobile-legends-bang-bang': {
    poster: '/demos/steliant-esports/ImaHorizontal/Mlbb.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Mlbb5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Mlbb2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Mlbb3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Mlbb4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Mlbb5.jpg' },
  },
  'league-of-legends-wild-rift': {
    poster: '/demos/steliant-esports/ImaHorizontal/Wildrift.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Wildrift5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Wildrift2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Wildrift3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Wildrift4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Wildrift5.jpg' },
  },
  'arena-of-valor': {
    poster: '/demos/steliant-esports/ImaHorizontal/Arenaofvalor.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Arenaofvalor5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Arenaofvalor2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Arenaofvalor3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Arenaofvalor4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Arenaofvalor5.jpg' },
  },
  'pokemon-unite': {
    poster: '/demos/steliant-esports/ImaHorizontal/Pokemon.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Pokemon5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Pokemon2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Pokemon3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Pokemon4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Pokemon5.jpg' },
  },
  valorant: {
    poster: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Valo5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Valo2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Valo3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Valo4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Valo5.jpg' },
  },
  'apex-legends': {
    poster: '/demos/steliant-esports/ImaHorizontal/Apex.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Apex5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Apex2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Apex3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Apex4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Apex5.jpg' },
  },
  'call-of-duty-warzone-mobile': {
    poster: '/demos/steliant-esports/ImaHorizontal/Cod.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Cod5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Cod2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Cod3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Cod4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Cod5.jpg' },
  },
  'free-fire': {
    poster: '/demos/steliant-esports/ImaHorizontal/Frefire.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Frefire5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Frefire2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Frefire3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Frefire4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Frefire5.jpg' },
  },
  'farlight-84': {
    poster: '/demos/steliant-esports/ImaHorizontal/Farlight84.jpg',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Farlight845.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Farlight842.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Farlight843.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Farlight844.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Farlight845.jpg' },
  },
  'rainbow-six-siege': {
    poster: '/demos/steliant-esports/ImaHorizontal/6Siege.jpg',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/6Siege5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/6Siege2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/6Siege3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/6Siege4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/6Siege5.jpg' },
  },
  'teamfight-tactics': {
    poster: '/demos/steliant-esports/ImaHorizontal/TFT.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Tft5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Tft2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Tft3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Tft4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Tft5.jpg' },
  },
  'clash-royale': {
    poster: '/demos/steliant-esports/ImaHorizontal/ClashRoyal.jpg',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Clashroyale5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Clashroyal2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Clashroyal3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Clashroyal4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Clashroyale5.jpg' },
  },
  overwatch: {
    poster: '/demos/steliant-esports/ImaHorizontal/Overwatch.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Overwatch5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Overwatch2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Overwatch3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Overwatch4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Overwatch5.jpg' },
  },
  'overwatch-2': {
    poster: '/demos/steliant-esports/ImaHorizontal/Overwatc2.png',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Overwatc25.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Overwatc21.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Overwatc23.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Overwatc24.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Overwatc25.jpg' },
  },
  'pubg-mobile': {
    poster: '/demos/steliant-esports/ImaHorizontal/pubg.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/pubg5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/pubg2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/pubg3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/pubg4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/pubg5.jpg' },
  },
  'fall-guys': {
    poster: '/demos/steliant-esports/ImaHorizontal/Fallguys.jpg',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Fallguys5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Fallguys2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Fallguys3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Fallguys4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Fallguys5.jpg' },
  },
  genshin: {
    poster: '/demos/steliant-esports/ImaHorizontal/Genshin.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/genshin5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/genshin2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/genshin3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/genshin4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/genshin5.jpg' },
  },
  'wuthering-waves': {
    poster: '/demos/steliant-esports/ImaHorizontal/Wuwa.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Wuwa5.jpg',
    railImages: { torneos: '/demos/steliant-esports/ImaHorizontal/Wuwa2.jpg', creadores: '/demos/steliant-esports/ImaHorizontal/Wuwa3.jpg', noticias: '/demos/steliant-esports/ImaHorizontal/Wuwa4.jpg', 'mas-info': '/demos/steliant-esports/ImaHorizontal/Wuwa5.jpg' },
  },
}

const GAME_COMPANIES = {
  'league-of-legends': 'Riot Games',
  'dota-2': 'Valve',
  'honor-of-kings': 'Level Infinite / TiMi Studio Group',
  'mobile-legends-bang-bang': 'Moonton',
  'league-of-legends-wild-rift': 'Riot Games',
  'arena-of-valor': 'Level Infinite / TiMi Studio Group',
  'pokemon-unite': 'The Pokemon Company / TiMi Studio Group',
  'smite': 'Hi-Rez Studios / Titan Forge',
  'valorant': 'Riot Games',
  'counter-strike-2': 'Valve',
  'fortnite': 'Epic Games',
  'apex-legends': 'Respawn Entertainment / Electronic Arts',
  overwatch: 'Blizzard Entertainment',
  'overwatch-2': 'Blizzard Entertainment',
  'rainbow-six-siege': 'Ubisoft',
  'call-of-duty-warzone-mobile': 'Activision',
  'free-fire': 'Garena',
  'pubg-mobile': 'Tencent / KRAFTON',
  'farlight-84': 'Farlight / Lilith Games',
  'street-fighter-6': 'Capcom',
  'tekken-8': 'Bandai Namco',
  'mortal-kombat-1': 'NetherRealm Studios / Warner Bros. Games',
  'guilty-gear-strive': 'Arc System Works',
  'brawlhalla-comunitario': 'Ubisoft / Blue Mammoth Games',
  'teamfight-tactics': 'Riot Games',
  'hearthstone': 'Blizzard Entertainment',
  'legends-of-runeterra': 'Riot Games',
  'marvel-snap': 'Second Dinner / Nuverse',
  'clash-royale': 'Supercell',
  genshin: 'HoYoverse',
  'starcraft-ii': 'Blizzard Entertainment',
  'rocket-league': 'Psyonix / Epic Games',
  'ea-sports-fc-25': 'EA Sports',
  'ea-sports-fc-mobile': 'EA Sports',
  'rocket-league-sideswipe': 'Psyonix / Epic Games',
  'efootball-mobile': 'Konami',
  'wuthering-waves': 'Kuro Games',
  'world-of-warcraft-arena': 'Blizzard Entertainment',
  'guild-wars-2-pvp': 'ArenaNet',
  'fall-guys': 'Mediatonic / Epic Games',
  'super-smash-bros-ultimate': 'Nintendo / Bandai Namco Studios',
  'nba-2k': 'Visual Concepts / 2K',
  'among-us-competitivo': 'Innersloth',
}

const GAME_COMPANY_TAGS = {
  'league-of-legends': 'Riot Games',
  'dota-2': 'Valve',
  'honor-of-kings': 'Level Infinite',
  'mobile-legends-bang-bang': 'Moonton',
  'league-of-legends-wild-rift': 'Riot Games',
  'arena-of-valor': 'Level Infinite',
  'pokemon-unite': 'Pokemon',
  'smite': 'Hi-Rez',
  'valorant': 'Riot Games',
  'counter-strike-2': 'Valve',
  'fortnite': 'Epic Games',
  'apex-legends': 'EA',
  overwatch: 'Blizzard',
  'overwatch-2': 'Blizzard',
  'rainbow-six-siege': 'Ubisoft',
  'call-of-duty-warzone-mobile': 'Activision',
  'free-fire': 'Garena',
  'pubg-mobile': 'Tencent',
  'farlight-84': 'Lilith Games',
  'street-fighter-6': 'Capcom',
  'tekken-8': 'Bandai Namco',
  'mortal-kombat-1': 'Warner Bros.',
  'guilty-gear-strive': 'Arc System Works',
  'brawlhalla-comunitario': 'Ubisoft',
  'teamfight-tactics': 'Riot Games',
  'hearthstone': 'Blizzard',
  'legends-of-runeterra': 'Riot Games',
  'marvel-snap': 'Second Dinner',
  'clash-royale': 'Supercell',
  genshin: 'HoYoverse',
  'starcraft-ii': 'Blizzard',
  'rocket-league': 'Psyonix',
  'ea-sports-fc-25': 'EA Sports',
  'ea-sports-fc-mobile': 'EA Sports',
  'rocket-league-sideswipe': 'Psyonix',
  'efootball-mobile': 'Konami',
  'wuthering-waves': 'Kuro Games',
  'world-of-warcraft-arena': 'Blizzard',
  'guild-wars-2-pvp': 'ArenaNet',
  'fall-guys': 'Epic Games',
  'among-us-competitivo': 'Innersloth',
}

const GAME_SCENES = {
  'league-of-legends': 'Esports',
  'dota-2': 'Esports',
  'honor-of-kings': 'Competitivo',
  'mobile-legends-bang-bang': 'Esports',
  'league-of-legends-wild-rift': 'Competitivo',
  'arena-of-valor': 'Competitivo',
  'pokemon-unite': 'Competitivo',
  'smite': 'Esports',
  'valorant': 'Esports',
  'counter-strike-2': 'Esports',
  'fortnite': 'Esports',
  'apex-legends': 'Esports',
  overwatch: 'Competitivo',
  'overwatch-2': 'Esports',
  'rainbow-six-siege': 'Esports',
  'call-of-duty-warzone-mobile': 'Competitivo',
  'free-fire': 'Competitivo',
  'pubg-mobile': 'Competitivo',
  'farlight-84': 'Competitivo',
  'street-fighter-6': 'Esports',
  'tekken-8': 'Esports',
  'mortal-kombat-1': 'Competitivo',
  'guilty-gear-strive': 'Competitivo',
  'brawlhalla-comunitario': 'Comunitario',
  'teamfight-tactics': 'Esports',
  'hearthstone': 'Esports',
  'legends-of-runeterra': 'Competitivo',
  'marvel-snap': 'Competitivo',
  'clash-royale': 'Competitivo',
  genshin: 'Casual',
  'starcraft-ii': 'Esports',
  'rocket-league': 'Esports',
  'ea-sports-fc-25': 'Esports',
  'ea-sports-fc-mobile': 'Competitivo',
  'rocket-league-sideswipe': 'Competitivo',
  'efootball-mobile': 'Competitivo',
  'wuthering-waves': 'Casual',
  'world-of-warcraft-arena': 'Competitivo',
  'guild-wars-2-pvp': 'Competitivo',
  'fall-guys': 'Casual',
  'among-us-competitivo': 'Comunitario',
}

const GAME_PLATFORM_TAGS = {
  'league-of-legends': ['PC'],
  'dota-2': ['PC'],
  'honor-of-kings': ['Móvil'],
  'mobile-legends-bang-bang': ['Móvil'],
  'league-of-legends-wild-rift': ['Móvil'],
  'arena-of-valor': ['Móvil'],
  'pokemon-unite': ['Móvil'],
  'smite': ['PC'],
  'valorant': ['PC'],
  'counter-strike-2': ['PC'],
  'fortnite': ['Cross-platform'],
  'apex-legends': ['Cross-platform'],
  overwatch: ['Cross-platform'],
  'overwatch-2': ['Cross-platform'],
  'rainbow-six-siege': ['PC'],
  'call-of-duty-warzone-mobile': ['Móvil'],
  'free-fire': ['Móvil'],
  'pubg-mobile': ['Móvil'],
  'farlight-84': ['Móvil'],
  'street-fighter-6': ['PC'],
  'tekken-8': ['PC'],
  'mortal-kombat-1': ['PC'],
  'guilty-gear-strive': ['PC'],
  'brawlhalla-comunitario': ['Cross-platform'],
  'teamfight-tactics': ['PC'],
  'hearthstone': ['PC'],
  'legends-of-runeterra': ['PC'],
  'marvel-snap': ['Móvil'],
  'clash-royale': ['Móvil'],
  genshin: ['Cross-platform'],
  'starcraft-ii': ['PC'],
  'rocket-league': ['Cross-platform'],
  'ea-sports-fc-25': ['Consola'],
  'ea-sports-fc-mobile': ['Móvil'],
  'rocket-league-sideswipe': ['Móvil'],
  'efootball-mobile': ['Móvil'],
  'wuthering-waves': ['Cross-platform'],
  'world-of-warcraft-arena': ['PC'],
  'guild-wars-2-pvp': ['PC'],
  'fall-guys': ['Cross-platform'],
  'among-us-competitivo': ['Móvil'],
  'super-smash-bros-ultimate': ['Consola'],
  'nba-2k': ['Consola'],
}

const CATEGORY_TAGS = {
  moba: ['MOBA'],
  'shooters-battle-royale': ['Shooter'],
  'fighting-games': ['FGC'],
  'strategy-cards': ['Estrategia'],
  rts: ['RTS'],
  'sports-racing': ['Sports'],
  simulators: ['Simulación'],
  'mmo-competitivo': ['Arena'],
  'party-casual': ['Party'],
}

const GAME_RELATED_TAGS = {
  'league-of-legends': ['5v5', 'Ranked'],
  'dota-2': ['5v5', 'Ranked'],
  'honor-of-kings': ['5v5', 'Mobile MOBA'],
  'mobile-legends-bang-bang': ['5v5', 'Mobile MOBA'],
  'league-of-legends-wild-rift': ['5v5', 'Mobile MOBA'],
  'arena-of-valor': ['5v5', 'Mobile MOBA'],
  'pokemon-unite': ['5v5', 'Arena'],
  'smite': ['Arena', '3ra persona'],
  'valorant': ['FPS Táctico', '5v5'],
  'counter-strike-2': ['FPS Táctico', '5v5'],
  'fortnite': ['Battle Royale', 'Builds'],
  'apex-legends': ['Battle Royale', 'Squads'],
  overwatch: ['Hero Shooter', '6v6'],
  'overwatch-2': ['Hero Shooter', '5v5'],
  'rainbow-six-siege': ['FPS Táctico', '5v5'],
  'call-of-duty-warzone-mobile': ['Battle Royale', 'Shooter Móvil'],
  'free-fire': ['Battle Royale', 'Shooter Móvil'],
  'pubg-mobile': ['Battle Royale', 'Shooter Móvil'],
  'farlight-84': ['Battle Royale', 'Hero Shooter'],
  'street-fighter-6': ['1v1', 'Majors'],
  'tekken-8': ['1v1', 'Majors'],
  'mortal-kombat-1': ['1v1', 'FGC'],
  'guilty-gear-strive': ['1v1', 'FGC'],
  'brawlhalla-comunitario': ['1v1', 'Comunidad'],
  'teamfight-tactics': ['Auto Battler', 'Draft'],
  'hearthstone': ['Cartas', '1v1'],
  'legends-of-runeterra': ['Cartas', '1v1'],
  'marvel-snap': ['Cartas', 'Rápido'],
  'clash-royale': ['Cartas', '1v1'],
  genshin: ['RPG', 'Open World', 'PvE'],
  'starcraft-ii': ['Macro', '1v1'],
  'rocket-league': ['3v3', 'Mecánicas'],
  'ea-sports-fc-25': ['1v1', 'Clubes'],
  'ea-sports-fc-mobile': ['1v1', 'Fútbol'],
  'rocket-league-sideswipe': ['2v2', 'Móvil'],
  'efootball-mobile': ['1v1', 'Fútbol'],
  'wuthering-waves': ['Action RPG', 'Open World', 'PvE'],
  'world-of-warcraft-arena': ['Arena 3v3', 'MMO PvP'],
  'guild-wars-2-pvp': ['Conquest', 'MMO PvP'],
  'fall-guys': ['Party', 'Minijuegos'],
  'among-us-competitivo': ['Social', 'Deducción'],
}

function uniqTags(tags) {
  return [...new Set(tags.filter(Boolean))]
}

function buildGameTags(id, categoryId, categoryLabel) {
  return uniqTags([
    categoryLabel,
    ...(CATEGORY_TAGS[categoryId] || []),
    GAME_SCENES[id] || 'Competitivo',
    GAME_COMPANY_TAGS[id],
    ...(GAME_PLATFORM_TAGS[id] || []),
    ...(GAME_RELATED_TAGS[id] || []),
  ])
}

function buildGameDescription(name, company, categoryLabel, scene) {
  const sceneCopy = {
    Esports: 'con escena esports consolidada',
    Competitivo: 'con escena competitiva activa',
    Comunitario: 'con enfoque comunitario y eventos player-made',
    Casual: 'con enfoque casual y social',
  }
  return `${name}, título de ${company} dentro de ${categoryLabel} ${sceneCopy[scene] || 'con actividad competitiva'}.`
}

const GAME_IMAGE_OVERRIDES = {
  'league-of-legends': { vertical: '/demos/steliant-esports/ImaVertical/LoL.jpg', logo: '/demos/steliant-esports/Logo/lol.png' },
  'dota-2': { vertical: '/demos/steliant-esports/ImaVertical/Dota2.jpeg', logo: '/demos/steliant-esports/Logo/Dota2.png' },
  'honor-of-kings': { vertical: '/demos/steliant-esports/ImaVertical/HoK_V.jpg', logo: '/demos/steliant-esports/Logo/download.png' },
  'mobile-legends-bang-bang': { vertical: '/demos/steliant-esports/ImaVertical/MLBB.jpg', logo: '/demos/steliant-esports/Logo/mlbb.png' },
  'league-of-legends-wild-rift': { vertical: '/demos/steliant-esports/ImaVertical/WildRift.jpeg', logo: '/demos/steliant-esports/Logo/WildRift.png' },
  'arena-of-valor': { vertical: '/demos/steliant-esports/ImaVertical/AOV.jpg', logo: '/demos/steliant-esports/Logo/ArenaOfValor.webp' },
  'smite': { logo: '/demos/steliant-esports/Logo/smite2.png' },
  'valorant': { vertical: '/demos/steliant-esports/ImaVertical/valorant.jpg', logo: '/demos/steliant-esports/Logo/Valorant.png' },
  'counter-strike-2': { vertical: '/demos/steliant-esports/ImaVertical/CS2.jpg', logo: '/demos/steliant-esports/Logo/cs2.png' },
  'fortnite': { vertical: '/demos/steliant-esports/ImaVertical/Fortnite.jpg' },
  'apex-legends': { vertical: '/demos/steliant-esports/ImaVertical/Apex.jpg', logo: '/demos/steliant-esports/Logo/Apex_Legends_logo.png' },
  overwatch: { logo: '/demos/steliant-esports/Logo/Overwatch.webp' },
  'overwatch-2': { vertical: '/demos/steliant-esports/ImaVertical/OW2.jpeg', logo: '/demos/steliant-esports/Logo/Overwatch2.png' },
  'rainbow-six-siege': { vertical: '/demos/steliant-esports/ImaVertical/R6S.jpg', logo: '/demos/steliant-esports/Logo/Rainbow Six Siege.png' },
  'call-of-duty-warzone-mobile': { vertical: '/demos/steliant-esports/ImaVertical/Warzone.jpg', logo: '/demos/steliant-esports/Logo/CallofDutyWarzone.png' },
  'free-fire': { vertical: '/demos/steliant-esports/ImaVertical/FF.jpg', logo: '/demos/steliant-esports/Logo/FF.png' },
  'pubg-mobile': { horizontal: '/demos/steliant-esports/ImaHorizontal/pubg.jpg', vertical: '/demos/steliant-esports/ImaVertical/PUBGM.jpg', logo: '/demos/steliant-esports/Logo/PubgMobile.jpg' },
  'farlight-84': { vertical: '/demos/steliant-esports/ImaVertical/Farlight84.jpg', logo: '/demos/steliant-esports/Logo/farlight84.png' },
  'street-fighter-6': { vertical: '/demos/steliant-esports/ImaVertical/sf6.png', logo: '/demos/steliant-esports/Logo/sf6.png' },
  'tekken-8': { vertical: '/demos/steliant-esports/ImaVertical/Tekken8.jpg', logo: '/demos/steliant-esports/Logo/Tekken8.png' },
  'guilty-gear-strive': { vertical: '/demos/steliant-esports/ImaVertical/Guilty Gear Strive.jpg', logo: '/demos/steliant-esports/Logo/GuiltyGearStrive.png' },
  'brawlhalla-comunitario': { horizontal: '/demos/steliant-esports/ImaHorizontal/Brawlhalla.jpg', vertical: '/demos/steliant-esports/ImaVertical/Brawlhalla.jpg', logo: '/demos/steliant-esports/Logo/Brawlhalla.png' },
  'teamfight-tactics': { vertical: '/demos/steliant-esports/ImaVertical/TFT.webp', logo: '/demos/steliant-esports/Logo/teamfight.png' },
  'hearthstone': { vertical: '/demos/steliant-esports/ImaVertical/HS.webp', logo: '/demos/steliant-esports/Logo/Hearthstone-Emblem.png' },
  'legends-of-runeterra': { vertical: '/demos/steliant-esports/ImaVertical/LoR.jpg', logo: '/demos/steliant-esports/Logo/Runeterra.jpg' },
  'marvel-snap': { horizontal: '/demos/steliant-esports/ImaHorizontal/Marvelsnap.jpg', vertical: '/demos/steliant-esports/ImaVertical/Marvelsnap.jpg' },
  'clash-royale': { vertical: '/demos/steliant-esports/ImaVertical/CR.jpg', logo: '/demos/steliant-esports/Logo/clashroyale.png' },
  'starcraft-ii': { vertical: '/demos/steliant-esports/ImaVertical/SC2.jpg', logo: '/demos/steliant-esports/Logo/StarCraft.png' },
  'rocket-league': { vertical: '/demos/steliant-esports/ImaVertical/RL.jpg', logo: '/demos/steliant-esports/Logo/RocketLeague.png' },
  'ea-sports-fc-25': { logo: '/demos/steliant-esports/Logo/Fifa.png' },
  'ea-sports-fc-mobile': { logo: '/demos/steliant-esports/Logo/Fifa.png' },
  'rocket-league-sideswipe': { vertical: '/demos/steliant-esports/ImaVertical/RL.jpg', logo: '/demos/steliant-esports/Logo/RocketLeague.png' },
  genshin: { vertical: '/demos/steliant-esports/ImaVertical/genshin.jpg', logo: '/demos/steliant-esports/Logo/genshinImpact.png' },
  'fall-guys': { vertical: '/demos/steliant-esports/ImaVertical/portada.fallguy.jpg', logo: '/demos/steliant-esports/Logo/FallGuys.png' },
  'wuthering-waves': { vertical: '/demos/steliant-esports/ImaVertical/Wuwa.webp', logo: '/demos/steliant-esports/Logo/WutheringWaves.png' },
  'among-us-competitivo': { vertical: '/demos/steliant-esports/ImaVertical/amongus.jpg', logo: '/demos/steliant-esports/Logo/amongUs.png' },
  // NBA2K24.jpg ya estaba en el proyecto sin usar.
  'nba-2k': { vertical: '/demos/steliant-esports/ImaVertical/NBA2K24.jpg' },
  // Logos oficiales transparentes (Steam). Sin logo la UI muestra un icono generico.
  'mortal-kombat-1': { logo: '/demos/steliant-esports/Logo/MortalKombat1.png' },
  iracing: { logo: '/demos/steliant-esports/Logo/Iracing.png' },
  'assetto-corsa-competizione': { logo: '/demos/steliant-esports/Logo/AssettoCorsaComp.png' },
  'microsoft-flight-simulator-2024': { logo: '/demos/steliant-esports/Logo/FlightSim2024.png' },
  'guild-wars-2-pvp': { logo: '/demos/steliant-esports/Logo/GuildWars2.png' },
}


const ESPORTS_IDS = [
  'valorant',
  'league-of-legends',
  'counter-strike-2',
  'dota-2',
  'fortnite',
  'rocket-league',
  'ea-sports-fc-25',
  'street-fighter-6',
  'tekken-8',
  'super-smash-bros-ultimate',
  'apex-legends',
  'teamfight-tactics',
  'mobile-legends-bang-bang',
  'rainbow-six-siege',
  'overwatch-2',
  'hearthstone',
  'starcraft-ii',
  'smite'
]

const categoryName = Object.fromEntries(GAME_CATEGORIES.map(category => [category.id, category.name]))

export const GAMES = CATALOG.map(([id, name, categoryId, logo, officialLogo = true]) => {
  const art = CATEGORY_ART[categoryId]
  const media = GAME_MEDIA[id] || null
  const assets = GAME_IMAGE_OVERRIDES[id] || {}
  const company = GAME_COMPANIES[id] || 'GlitchGang Community'
  const horizontalImage = assets.horizontal || media?.poster || GAME_ART[id] || null
  const verticalImage = assets.vertical || null
  const logoImage = assets.logo || logo || null
  const displayImage = horizontalImage || art.image
  const isEsport = ESPORTS_IDS.includes(id)
  const scene = GAME_SCENES[id] || (isEsport ? 'Esports' : 'Competitivo')
  const tags = buildGameTags(id, categoryId, categoryName[categoryId])
  return {
    id,
    slug: id,
    name,
    categoryId,
    category: categoryName[categoryId],
    genre: categoryName[categoryId],
    officialLogo,
    company,
    scene,
    isEsport,
    players: '—',
    active: '—',
    color: art.color,
    colorB: art.colorB,
    description: buildGameDescription(name, company, categoryName[categoryId], scene),
    tags,
    image: displayImage,
    poster: displayImage,
    video: media?.video || null,
    lowFpsImage: media?.lowFpsImage || null,
    railImages: media?.railImages || {},
    images: { horizontal: horizontalImage, vertical: verticalImage, logo: logoImage },
  }
})

export const GAMES_BY_CATEGORY = GAME_CATEGORIES.map(category => {
  let filteredGames = []
  if (category.id === 'esports') {
    filteredGames = GAMES.filter(game => game.isEsport)
  } else {
    filteredGames = GAMES.filter(game => game.categoryId === category.id)
  }
  return {
    ...category,
    games: filteredGames
  }
})

export const GAME_BY_ID = Object.fromEntries(GAMES.map(game => [game.id, game]))

const LEGACY_GAME_IDS = {
  val: 'valorant', cs2: 'counter-strike-2', csgo: 'counter-strike-2', mlbb: 'mobile-legends-bang-bang', ff: 'free-fire',
  rl: 'rocket-league', tft: 'teamfight-tactics', wr: 'league-of-legends-wild-rift',
  freefire: 'free-fire', lol: 'league-of-legends', apex: 'apex-legends', dota2: 'dota-2', hok: 'honor-of-kings',
  rocketleague: 'rocket-league', aov: 'arena-of-valor', pokemon: 'pokemon-unite', r6: 'rainbow-six-siege',
}

// Acepta id del catalogo, id legacy o NOMBRE visible ("League of Legends",
// que es lo que guardan Team.game y Tournament.game). Antes solo aceptaba ids:
// cualquier nombre caia al fallback 'valorant' y un torneo de LoL salia con
// la foto de Valorant.
export function normalizeGameId(value, fallback = 'valorant') {
  const id = LEGACY_GAME_IDS[value] || value
  if (GAME_BY_ID[id]) return id
  const byName = gameIdFromName(value)
  return GAME_BY_ID[byName] ? byName : fallback
}

// Imágenes para el carrusel del héroe.
export const HERO_SLIDES = [
  { id: 1, src: '/demos/steliant-esports/ImaHorizontal/Valo.jpg', label: 'Torneo en vivo' },
  { id: 2, src: '/demos/steliant-esports/ImaHorizontal/hok.jpg', label: 'Comunidad LATAM' },
  { id: 3, src: '/demos/steliant-esports/ImaHorizontal/sf6.jpg', label: 'Competencia de élite' },
  { id: 4, src: '/demos/steliant-esports/ImaHorizontal/TFT.jpg', label: 'Season 01' },
  { id: 5, src: '/demos/steliant-esports/ImaHorizontal/rocket.jpg', label: 'Únete hoy' },
]

