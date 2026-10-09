// Datos del perfil del usuario autenticado
export const PROFILE = {
  nick: 'Brooklyn',
  realName: 'Brooklyn García',
  bio: 'IGL y estratega competitivo. 3 años en la escena de Valorant. Fundador de GLITCH CORE. Apasionado por el desarrollo táctico y el meta game.',
  avatar: 'https://i.pravatar.cc/120?img=12',
  banner: '#00E676',
  bannerColor: '#00E676',
  rank: 'Player',
  game: 'val',
  country: 'RD',
  joinDate: 'Enero 2024',
  plan: 'Pro Trial',
  winrate: '68%',
  wins: 218,
  losses: 103,
  rankPts: 3840,
  stats: {
    winrate: '68%',
    wins: 218,
    losses: 103,
    rankPts: 3840,
    kda: '2.8',
    topChamp: 'Omen',
  },
  games: [
    { id: 'val', name: 'Valorant',          winrate: '68%', matches: 321 },
    { id: 'cs2', name: 'CS2',               winrate: '54%', matches: 89  },
    { id: 'lol', name: 'League of Legends', winrate: '61%', matches: 145 },
  ],
}

export const RECENT_MATCHES_PROFILE = [
  { id: 1,  game: 'val', mode: 'Ranked',  map: 'Ascent',  vs: 'Team Volt',   result: 'Victoria', kda: '22/10/8',  rp: '+24', pts: 24,  win: true  },
  { id: 2,  game: 'val', mode: 'Torneo',  map: 'Bind',    vs: 'Nyx Esports', result: 'Victoria', kda: '18/9/12',  rp: '+31', pts: 31,  win: true  },
  { id: 3,  game: 'val', mode: 'Ranked',  map: 'Icebox',  vs: 'Cipher Clan', result: 'Derrota',  kda: '14/18/6',  rp: '−18', pts: -18, win: false },
  { id: 4,  game: 'val', mode: 'Scrim',   map: 'Haven',   vs: 'Phantom',     result: 'Victoria', kda: '20/8/14',  rp: '+12', pts: 12,  win: true  },
  { id: 5,  game: 'val', mode: 'Ranked',  map: 'Pearl',   vs: 'Zero Latency',result: 'Derrota',  kda: '11/15/9',  rp: '−9',  pts: -9,  win: false },
]

export const ACHIEVEMENTS = [
  { id: 1, icon: 'trophy', name: 'Campeón GG Winter Cup', title: 'Campeón GG Winter Cup', desc: 'Ganó el primer torneo de la plataforma', date: 'May 2026', unlocked: true },
  { id: 2, icon: 'gem', name: 'Diamond Player', title: 'Diamond Player', desc: 'Alcanzó Diamond en Valorant Ranked', date: 'Abr 2026', unlocked: true },
  { id: 3, icon: 'trend', name: 'Racha de 10', title: 'Racha de 10', desc: '10 victorias consecutivas en ranked', date: 'Mar 2026', unlocked: true },
  { id: 4, icon: 'target', name: 'Clutch King', title: 'Clutch King', desc: '25 clutches 1vX en torneos', date: 'Feb 2026', unlocked: true },
  { id: 5, icon: 'bolt', name: 'Early Adopter', title: 'Early Adopter', desc: 'Uno de los primeros 500 usuarios', date: 'Ene 2026', unlocked: true },
  { id: 6, icon: 'globe', name: 'Top 50 RD', title: 'Top 50 RD', desc: 'Alcanzó el top 50 en República Dominicana', date: '—', unlocked: false },
  { id: 7, icon: 'crown', name: 'Leyenda', title: 'Leyenda', desc: 'Llega al top 10 de la plataforma', date: '—', unlocked: false },
]

