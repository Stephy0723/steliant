// Espejo backend (ids + proposito) de frontend/src/data/cosmetics.js: estados,
// marcos, placas y cartas de logro. El motor que decide que tiene desbloqueado
// cada jugador es services/cosmetics.service.js. Si se agrega un cosmetico en
// el frontend hay que agregarlo aqui o el PATCH de perfil lo rechaza.

const DAY = 24 * 60 * 60 * 1000

// Duracion de los regalos temporales (los `days` de UNLOCK_SOURCES en el front).
export const SOURCE_DURATION_MS = {
  champion: 7 * DAY,
  mvp: 7 * DAY,
  birthday: 7 * DAY,
}

export const COSMETICS = {
  status: {
    online: 'base', playing: 'base', torneo: 'base', live: 'base',
    lfg: 'base', afk: 'base', dnd: 'base', invisible: 'base',
    hack: 'welcome', king: 'champion', surge: 'mvp', streak: 'streak',
    glitch: 'premium', virus: 'season', e404: 'referral',
    // 'bday' no va: es automatico el dia del cumpleanos y nunca se guarda.
  },
  frame: {
    none: 'base', rgb: 'welcome', hud: 'firstTournament', neko: 'profile',
    crystal: 'referral', storm: 'premium', error404: 'season', flames: 'streak',
    portal: 'ranking', virus: 'mvp', crown: 'champion',
  },
  plate: {
    0: 'base', 201: 'welcome', 202: 'firstTournament', 203: 'profile', 204: 'birthday',
    205: 'podium', 206: 'streak', 207: 'ranking', 208: 'season', 209: 'mvp', 210: 'founder',
  },
  card: {
    gold: 'winner', silver: 'finalist', bronze: 'podium', mvp: 'achievement',
    goat: 'achievement', rookie: 'achievement', clutch: 'achievement', wall: 'achievement',
    hawk: 'achievement', cap: 'achievement', fire: 'achievement', month: 'vote',
  },
}

// A lo que vuelve un cosmetico equipado que se vencio o ya no esta desbloqueado.
export const FALLBACK = { status: 'online', frame: 'rgb', plate: 201 }

// Fundadores: los primeros N jugadores registrados.
export const FOUNDER_LIMIT = 100

// "Invita 3": cuentas registradas con tu codigo.
export const REFERRALS_NEEDED = 3

export const VALID_BG_IDS = [
  'banner-basic-1', 'banner-basic-2', 'banner-basic-3', 'banner-basic-4', 'banner-basic-5',
  'bg1', 'bg2', 'bg12', 'bg15',
  'bg3', 'bg4', 'bg5', 'bg6', 'bg7', 'bg8', 'bg9', 'bg10', 'bg11', 'bg13', 'bg14',
  'bg16', 'bg17', 'bg18', 'bg19', 'bg20', 'custom',
]

export const PREMIUM_BG_IDS = ['bg3', 'bg13']
