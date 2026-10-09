// ============================================
// GlitchGang Bot - Iconos de juego
// ============================================
// Espejo reducido de GAME_IMAGE_OVERRIDES en frontend/src/data/games.js
// (solo los juegos mas comunes) — el bot no puede importar ese archivo
// directamente (es un modulo ESM de otro proyecto), asi que se mantiene
// esta copia curada. Si agregas un logo nuevo alla y quieres que tambien
// se use en la bienvenida de Discord, agregalo aqui tambien.

const WEBSITE_URL = (process.env.WEBSITE_URL || 'https://glitchgang.net').replace(/\/$/, '');

const GAME_LOGO_PATHS = {
  valorant: '/Logo/Valorant.png',
  'league-of-legends': '/Logo/WildRift.png',
  lol: '/Logo/WildRift.png',
  'league-of-legends-wild-rift': '/Logo/WildRift.png',
  wildrift: '/Logo/WildRift.png',
  'counter-strike-2': '/Logo/cs2.png',
  cs2: '/Logo/cs2.png',
  csgo: '/Logo/cs2.png',
  'mobile-legends-bang-bang': '/Logo/mlbb.png',
  mlbb: '/Logo/mlbb.png',
  'free-fire': '/Logo/FF.png',
  freefire: '/Logo/FF.png',
  ff: '/Logo/FF.png',
  'apex-legends': '/Logo/Apex_Legends_logo.png',
  apex: '/Logo/Apex_Legends_logo.png',
  'dota-2': '/Logo/Dota2.png',
  dota2: '/Logo/Dota2.png',
  'rocket-league': '/Logo/RocketLeague.png',
  rocketleague: '/Logo/RocketLeague.png',
  rl: '/Logo/RocketLeague.png',
  'arena-of-valor': '/Logo/ArenaOfValor.webp',
  aov: '/Logo/ArenaOfValor.webp',
  'teamfight-tactics': '/Logo/teamfight.png',
  tft: '/Logo/teamfight.png',
  'rainbow-six-siege': '/Logo/Rainbow Six Siege.png',
  r6: '/Logo/Rainbow Six Siege.png',
  'pubg-mobile': '/Logo/PubgMobile.jpg',
  'clash-royale': '/Logo/clashroyale.png',
  'honor-of-kings': '/Logo/download.png',
  hok: '/Logo/download.png',
  'street-fighter-6': '/Logo/sf6.png',
  sf6: '/Logo/sf6.png',
  'tekken-8': '/Logo/Tekken8.png',
};

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Devuelve la URL publica del logo del juego, o null si no esta en el mapa
 * (la bienvenida simplemente no muestra icono en ese caso, sin error).
 */
function resolveGameIconUrl(gameValue) {
  const key = normalize(gameValue);
  if (!key) return null;
  const path = GAME_LOGO_PATHS[key];
  return path ? `${WEBSITE_URL}${encodeURI(path)}` : null;
}

module.exports = { resolveGameIconUrl };
