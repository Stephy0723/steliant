// ─────────────────────────────────────────────────────────────
// src/data/communities.js  — Mock data for Communities / Games
// ─────────────────────────────────────────────────────────────

// ── Roles ──────────────────────────────────────────────────────
import { GAMES, GAME_BY_ID, normalizeGameId } from './games.js'
import { getPublicCommunities, getPublicCommunityBySlug } from '../lib/communityStore.js'

export const ROLES = {
  member:               { label: 'Miembro',               color: '#8b938e',  icon: 'user' },
  creator:              { label: 'Creador de contenido',  color: '#818cf8',  icon: 'play' },
  'event-organizer':    { label: 'Organizador de eventos',color: '#f59e0b',  icon: 'bolt' },
  'tournament-organizer':{ label: 'Org. de torneos',      color: '#00E676',  icon: 'trophy' },
  moderator:            { label: 'Moderador',             color: '#38bdf8',  icon: 'shield' },
  admin:                { label: 'Admin',                 color: '#f87171',  icon: 'crown' },
}

// What each role can publish in the Composer
export const ROLE_PERMISSIONS = {
  member:               ['post'],
  creator:              ['post'],
  'event-organizer':    ['post', 'event'],
  'tournament-organizer':['post', 'tournament'],
  moderator:            ['post', 'event', 'tournament', 'poll'],
  admin:                ['post', 'event', 'tournament', 'poll'],
}

// ── Communities / Games ─────────────────────────────────────────
export const COMMUNITIES = [
  // ── VALORANT ────────────────────────────────────────────────
  {
    id: 'valorant', slug: 'valorant',
    name: 'Valorant', genre: 'FPS TÁCTICO',
    description: 'Shooter táctico 5vs5 de Riot Games. Mueve a tus agentes, domina las mecánicas y lleva a tu equipo al Radiant. La comunidad más activa de GlitchGang.',
    tags: ['Competitivo', '5vs5', 'Torneos', 'Ranked', 'FPS', 'Táctico', 'Creadores'],
    members: 8200, activePlayers: 3100,
    color: '#FF4655', gameColor: '#0F1923',
    poster: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Valo5.jpg',
    railImages: {
      torneos:   '/demos/steliant-esports/ImaHorizontal/Valo2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Valo3.jpg',
      noticias:  '/demos/steliant-esports/ImaHorizontal/Valo4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Valo5.jpg',
    },
    railData: {
      torneos:   { title: 'GG Valorant Open #12', prize: '€1,200', date: '15 Jun 2026' },
      creadores: { title: 'VexonTV', followers: '48.2K', live: true },
      noticias:  { title: 'VCT Champions Latam', date: '01 Jul 2026' },
      rules:     { title: '5vs5 · Eliminación doble' },
    },
    joined: true,
    userRole: 'tournament-organizer',
    posts: [
      {
        id: 'val-1', type: 'post',
        author: { nick: 'Vexon', avatar: 'https://i.pravatar.cc/48?img=5', role: 'creator' },
        time: 'hace 12 min',
        content: 'Acabo de llegar a Radiant por primera vez. GlitchGang fue clave en mi progreso. Gracias a todo el squad. #Valorant #Radiant',
        likes: 142, liked: false, comments: 18,
      },
      {
        id: 'val-2', type: 'tournament',
        author: { nick: 'GGAdmin', avatar: 'https://i.pravatar.cc/48?img=3', role: 'tournament-organizer' },
        time: 'hace 2h',
        title: 'GG Valorant Open #12',
        game: 'Valorant', format: '5vs5 — Eliminación doble',
        slots: 16, filledSlots: 12,
        prize: '€1,200', date: '2026-06-15',
        likes: 87, liked: false, comments: 24,
      },
      {
        id: 'val-3', type: 'poll',
        author: { nick: 'Miraya', avatar: 'https://i.pravatar.cc/48?img=29', role: 'moderator' },
        time: 'hace 4h',
        question: '¿Qué rol juegas principalmente en Valorant?',
        options: [
          { id: 1, text: 'Duelista', votes: 312 },
          { id: 2, text: 'Controlador', votes: 198 },
          { id: 3, text: 'Centinela', votes: 145 },
          { id: 4, text: 'Iniciador', votes: 227 },
        ],
        likes: 55, liked: false, comments: 11,
      },
      {
        id: 'val-4', type: 'event',
        author: { nick: 'EventGirl', avatar: 'https://i.pravatar.cc/48?img=47', role: 'event-organizer' },
        time: 'hace 1 día',
        title: 'Valorant Scrim Night',
        description: 'Noche de scrims abiertos para equipos de Gold+. ¡Únete a nuestro Discord y busca rivales!',
        date: '2026-06-08', time_str: '21:00 CET',
        link: 'https://discord.gg/bZTsanNB3G',
        likes: 73, liked: true, comments: 19,
      },
    ],
    creators: [
      { id: 'c1', nick: 'VexonTV', avatar: 'https://i.pravatar.cc/64?img=5',  platform: 'twitch',    followers: '48.2K', live: true,  game: 'Valorant', description: 'Radiant peak. VODs, guías y ranked en vivo.' },
      { id: 'c2', nick: 'MirayaGG', avatar: 'https://i.pravatar.cc/64?img=29', platform: 'youtube',   followers: '122K',  live: false, game: 'Valorant', description: 'Guías, tier lists y highlights de alto nivel.' },
      { id: 'c3', nick: 'AimLabQueen', avatar: 'https://i.pravatar.cc/64?img=44', platform: 'tiktok', followers: '91.4K',  live: false, game: 'Valorant', description: 'Clips virales y tutoriales de aim en formato corto.' },
    ],
    news: ['3'],
    info: {
      modes: ['Competitivo', 'Sin clasificar', 'Spike Rush', 'Deathmatch', 'Escalada'],
      rules: 'Los equipos compiten en rondas de ataque/defensa. El primero en ganar 13 rondas gana el mapa.',
      links: [{ label: 'Web oficial', url: 'https://playvalorant.com' }, { label: 'VCT', url: 'https://valorantesports.com' }],
      events: [{ date: '2026-06-15', title: 'GG Valorant Open #12' }, { date: '2026-07-01', title: 'VCT Champions Latam' }],
    },
  },

  // ── CS2 ─────────────────────────────────────────────────────
  {
    id: 'cs2', slug: 'cs2',
    name: 'CS2', genre: 'FPS TÁCTICO',
    description: 'Counter-Strike 2: el rey del FPS competitivo. Estrategia, mecánicas y trabajo en equipo en mapas icónicos. Compite en la liga Premier de GlitchGang.',
    tags: ['Competitivo', '5vs5', 'Premier', 'FPS', 'Torneos', 'Casual'],
    members: 6100, activePlayers: 2400,
    color: '#F3A800', gameColor: '#1A1A2E',
    poster: '/demos/steliant-esports/ImaHorizontal/cs2.jpg', video: null,
    joined: true,
    userRole: 'moderator',
    posts: [
      {
        id: 'cs2-1', type: 'post',
        author: { nick: 'Krypto99', avatar: 'https://i.pravatar.cc/48?img=17', role: 'creator' },
        time: 'hace 3h',
        content: 'El nuevo mapa Dust III es una obra maestra. Los ángulos de la B-site son perfectos para el meta actual. ¿Quién más está practicando los flashes nuevos?',
        likes: 65, liked: true, comments: 31,
      },
      {
        id: 'cs2-2', type: 'poll',
        author: { nick: 'ProMod', avatar: 'https://i.pravatar.cc/48?img=68', role: 'moderator' },
        time: 'hace 6h',
        question: '¿Cuál es tu mapa favorito en CS2?',
        options: [
          { id: 1, text: 'Dust II', votes: 441 },
          { id: 2, text: 'Mirage',  votes: 298 },
          { id: 3, text: 'Inferno', votes: 387 },
          { id: 4, text: 'Nuke',    votes: 155 },
        ],
        likes: 44, liked: false, comments: 22,
      },
      {
        id: 'cs2-3', type: 'tournament',
        author: { nick: 'GGAdmin', avatar: 'https://i.pravatar.cc/48?img=3', role: 'admin' },
        time: 'hace 8h',
        title: 'GG CS2 Premier Cup',
        game: 'CS2', format: '5vs5 — Grupos + Play-offs',
        slots: 8, filledSlots: 6,
        prize: '€800', date: '2026-06-22',
        likes: 92, liked: false, comments: 14,
      },
    ],
    creators: [
      { id: 'c4', nick: 'KryptoCS', avatar: 'https://i.pravatar.cc/64?img=17', platform: 'twitch',  followers: '34.7K', live: true,  game: 'CS2', description: 'Premier ranked y análisis de demos profesionales.' },
      { id: 'c5', nick: 'FlashKing', avatar: 'https://i.pravatar.cc/64?img=56', platform: 'youtube', followers: '78.3K', live: false, game: 'CS2', description: 'Tutoriales de utilitys, configuraciones y VOD reviews.' },
    ],
    news: ['5'],
    info: {
      modes: ['Competitivo', 'Premier', 'Deathmatch', 'Casual', 'Wingman'],
      rules: 'Pistolas a armas. El equipo que gana 16 rondas gana. En Premier se usa formato de mapas al mejor de 3.',
      links: [{ label: 'Web oficial', url: 'https://store.steampowered.com/app/730' }, { label: 'HLTV', url: 'https://hltv.org' }],
      events: [{ date: '2026-06-22', title: 'GG CS2 Premier Cup' }, { date: '2026-07-10', title: 'BLAST Premier Fall' }],
    },
  },

  // ── LEAGUE OF LEGENDS ────────────────────────────────────────
  {
    id: 'lol', slug: 'lol',
    name: 'League of Legends', genre: 'MOBA',
    description: 'El MOBA más jugado del mundo. Más de 160 campeones, estrategia en equipo y ranked sin fin. Únete a la comunidad y sube del Hierro al Challenger.',
    tags: ['MOBA', '5vs5', 'Ranked', 'Guías', 'Casual', 'Torneos'],
    members: 12400, activePlayers: 4800,
    color: '#C89B3C', gameColor: '#0A1628',
    poster: '/demos/steliant-esports/ImaHorizontal/lol.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Lol5.jpg',
    railImages: {
      torneos:   '/demos/steliant-esports/ImaHorizontal/Lol2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Lol3.jpg',
      noticias:  '/demos/steliant-esports/ImaHorizontal/Lol4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Lol5.jpg',
    },
    railData: {
      torneos:   { title: 'LoL Clash — Equipo GG', prize: '€500', date: '14 Jun 2026' },
      creadores: { title: 'MirayaMain', followers: '122K', live: false },
      noticias:  { title: 'LEC Summer Finals', date: '20 Jul 2026' },
      rules:     { title: '5vs5 · Destruye el Nexus' },
    },
    joined: true,
    userRole: 'member',
    posts: [
      {
        id: 'lol-1', type: 'post',
        author: { nick: 'Miraya', avatar: 'https://i.pravatar.cc/48?img=29', role: 'creator' },
        time: 'hace 1h',
        content: 'Guía completa de Lux Support Season 14 ya disponible en mi perfil. Cubro runas, build situacional y wave management. ¡Espero que les sirva!',
        likes: 87, liked: false, comments: 24,
      },
      {
        id: 'lol-2', type: 'event',
        author: { nick: 'LolManager', avatar: 'https://i.pravatar.cc/48?img=33', role: 'event-organizer' },
        time: 'hace 5h',
        title: 'LoL Clash — Equipo GlitchGang',
        description: 'Buscamos 5 para Clash el próximo fin de semana. Requisito mínimo Oro. Comunicación por Discord obligatoria.',
        date: '2026-06-14', time_str: '19:00 CET',
        link: 'https://discord.gg/bZTsanNB3G',
        likes: 51, liked: false, comments: 38,
      },
    ],
    creators: [
      { id: 'c6', nick: 'MirayaMain', avatar: 'https://i.pravatar.cc/64?img=29', platform: 'youtube', followers: '122K', live: false, game: 'LoL', description: 'Guías de support, tier lists y highlights de LEC.' },
      { id: 'c7', nick: 'ChallGR', avatar: 'https://i.pravatar.cc/64?img=62', platform: 'twitch',  followers: '25.1K', live: true,  game: 'LoL', description: 'Challenger OTP. Ranked en vivo todos los días.' },
    ],
    news: ['4'],
    info: {
      modes: ['Solo/Dúo', 'Flexible', 'ARAM', 'Arena', 'Clash'],
      rules: 'Destruye el Nexus rival antes de que destruyan el tuyo. Partidas de unos 35-45 min en el mapa Summoner\'s Rift.',
      links: [{ label: 'Web oficial', url: 'https://leagueoflegends.com' }, { label: 'LEC', url: 'https://lolesports.com' }],
      events: [{ date: '2026-06-14', title: 'Clash GG Equipo' }, { date: '2026-07-20', title: 'LEC Summer Finals' }],
    },
  },

  // ── MOBILE LEGENDS ──────────────────────────────────────────
  {
    id: 'mlbb', slug: 'mlbb',
    name: 'Mobile Legends', genre: 'MOBA MÓVIL',
    description: 'El MOBA para móvil más popular de España. Partidas rápidas de 10 minutos, 100+ héroes y un meta siempre cambiante.',
    tags: ['Mobile', 'MOBA', '5vs5', 'Ranked', 'Casual', 'Torneos'],
    members: 5400, activePlayers: 1900,
    color: '#4F46E5', gameColor: '#0D0D2B',
    poster: '/demos/steliant-esports/ImaHorizontal/Mlbb.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Mlbb5.jpg',
    railImages: {
      torneos:   '/demos/steliant-esports/ImaHorizontal/Mlbb2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Mlbb3.jpg',
      noticias:  '/demos/steliant-esports/ImaHorizontal/Mlbb4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Mlbb5.jpg',
    },
    railData: {
      torneos:   { title: 'MLBB Ranked Cup', prize: '$1,000', date: '10 Jul 2026' },
      creadores: { title: 'MLBBPro', followers: '67K', live: false },
      noticias:  { title: 'Nuevo héroe Mitológico', date: '25 Jun 2026' },
      rules:     { title: '5vs5 · Destruye la base' },
    },
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'mlbb-1', type: 'post',
        author: { nick: 'MLBBKing', avatar: 'https://i.pravatar.cc/48?img=14', role: 'member' },
        time: 'hace 2h',
        content: 'Finalmente llegué a Mitológico esta temporada. El sistema de ligas de GlitchGang me ayudó a encontrar el equipo ideal. ¡100% recomendado!',
        likes: 44, liked: false, comments: 12,
      },
    ],
    creators: [
      { id: 'c8', nick: 'MLBBPro', avatar: 'https://i.pravatar.cc/64?img=14', platform: 'tiktok', followers: '67K', live: false, game: 'MLBB', description: 'Tips rápidos y highlights de Mitológico.' },
    ],
    news: [],
    info: {
      modes: ['Ranked', 'Clásico', 'Brawl', 'Campo de entrenamiento'],
      rules: 'Destruye la base rival. Partidas de 10-15 minutos con 5 jugadores por equipo.',
      links: [{ label: 'Web oficial', url: 'https://mobilelegends.com' }],
      events: [],
    },
  },

  // ── FREE FIRE ──────────────────────────────────────────────
  {
    id: 'freefire', slug: 'freefire',
    name: 'Free Fire', genre: 'BATTLE ROYALE',
    description: 'El Battle Royale más jugado en dispositivos móviles. Supervivencia, loot y combate en tiempo real con 50 jugadores en una isla.',
    tags: ['Mobile', 'Battle Royale', 'Solo', 'Dúo', 'Squad', 'Ranked'],
    members: 4200, activePlayers: 1500,
    color: '#FF6B35', gameColor: '#1A0A00',
    poster: '/demos/steliant-esports/ImaHorizontal/Frefire.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Frefire5.jpg',
    railImages: {
      torneos:   '/demos/steliant-esports/ImaHorizontal/Frefire2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Frefire3.jpg',
      noticias:  '/demos/steliant-esports/ImaHorizontal/Frefire4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Frefire5.jpg',
    },
    railData: {
      torneos:   { title: 'Free Fire Open #3', prize: '$2,500', date: '15 Jul 2026' },
      creadores: { title: 'FireClips', followers: '134K', live: false },
      noticias:  { title: 'Nuevo personaje OP', date: '28 Jun 2026' },
      rules:     { title: 'Battle Royale · 50 jugadores' },
    },
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'ff-1', type: 'post',
        author: { nick: 'FireStorm', avatar: 'https://i.pravatar.cc/48?img=22', role: 'member' },
        time: 'hace 3h',
        content: '17 kills en ranked solo esta mañana. El nuevo personaje está roto, ya esperando el nerf. #FreeFire #Ranked',
        likes: 38, liked: false, comments: 9,
      },
    ],
    creators: [
      { id: 'c9', nick: 'FireClips', avatar: 'https://i.pravatar.cc/64?img=22', platform: 'tiktok', followers: '134K', live: false, game: 'Free Fire', description: 'Los mejores highlights de Free Fire España.' },
    ],
    news: [],
    info: {
      modes: ['Battle Royale', 'Clash Squad', 'Lone Wolf'],
      rules: '50 jugadores en una isla. El último en pie gana. Círculo de zona que se reduce gradualmente.',
      links: [{ label: 'Web oficial', url: 'https://ff.garena.com' }],
      events: [],
    },
  },

  // ── APEX LEGENDS ────────────────────────────────────────────
  {
    id: 'apex', slug: 'apex',
    name: 'Apex Legends', genre: 'BATTLE ROYALE',
    description: 'Battle Royale de héroes con habilidades únicas. 60 jugadores, 20 escuadras y el mejor sistema de movimiento del género.',
    tags: ['Battle Royale', 'Squad', 'Ranked', 'FPS', 'Héroes', 'Torneos'],
    members: 4800, activePlayers: 1700,
    color: '#CD3333', gameColor: '#1A0A0A',
    poster: '/demos/steliant-esports/ImaHorizontal/Apex.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Apex5.jpg',
    railImages: {
      torneos: '/demos/steliant-esports/ImaHorizontal/Apex2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Apex3.jpg',
      noticias: '/demos/steliant-esports/ImaHorizontal/Apex4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Apex5.jpg',
    },
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'apex-1', type: 'post',
        author: { nick: 'ApexPred', avatar: 'https://i.pravatar.cc/48?img=36', role: 'creator' },
        time: 'hace 5h',
        content: 'El movimiento de Apex es simplemente incomparable. Después de 3,000 horas aún descubro mecánicas nuevas. ¿Cuál es vuestro movimiento favorito?',
        likes: 71, liked: false, comments: 27,
      },
    ],
    creators: [
      { id: 'c10', nick: 'ApexTV', avatar: 'https://i.pravatar.cc/64?img=36', platform: 'twitch', followers: '52.8K', live: true, game: 'Apex', description: 'Ranked Predator en vivo. Análisis de movimiento y mecánicas.' },
    ],
    news: [],
    info: {
      modes: ['Battle Royale', 'Mixtape', 'Control', 'Ranked'],
      rules: '60 jugadores en 20 escuadras de 3. Última escuadra en pie gana. Cada leyenda tiene habilidades pasivas, tácticas y definitivas.',
      links: [{ label: 'Web oficial', url: 'https://ea.com/games/apex-legends' }],
      events: [],
    },
  },

  // ── ROCKET LEAGUE ────────────────────────────────────────────
  {
    id: 'rocketleague', slug: 'rocketleague',
    name: 'Rocket League', genre: 'SPORT / VEHICULAR',
    description: 'Fútbol con coches cohete. El juego de habilidad puro donde el techo mecánico no tiene límite. El scene competitivo más intenso de los deportes electrónicos.',
    tags: ['Sport', '3vs3', 'Ranked', 'Mecánicas', 'Torneos', 'FreeToPlay'],
    members: 3500, activePlayers: 1200,
    color: '#0082CA', gameColor: '#001230',
    poster: '/demos/steliant-esports/ImaHorizontal/rocket.jpg', video: null,
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'rl-1', type: 'post',
        author: { nick: 'ZeroGravity', avatar: 'https://i.pravatar.cc/48?img=60', role: 'creator' },
        time: 'hace 6h',
        content: 'Compilé todos mis resets aéreos de esta semana. 47 minutos de contenido puro de mecánicas avanzadas. Link en bio para el VOD completo.',
        likes: 203, liked: false, comments: 45,
      },
    ],
    creators: [
      { id: 'c11', nick: 'ZeroGravityRL', avatar: 'https://i.pravatar.cc/64?img=60', platform: 'youtube', followers: '89.4K', live: false, game: 'Rocket League', description: 'Mecánicas avanzadas, análisis y VODs de GC+.' },
    ],
    news: [],
    info: {
      modes: ['Competitivo (1v1/2v2/3v3)', 'Casual', 'Extras'],
      rules: 'Marca goles con tu coche cohete. 5 minutos por partido. Sistema de ranking de Bronce a Supersónico Legendario.',
      links: [{ label: 'Web oficial', url: 'https://rocketleague.com' }, { label: 'RLCS', url: 'https://rocketleague.com/esports' }],
      events: [],
    },
  },

  // ── DOTA 2 ──────────────────────────────────────────────────
  {
    id: 'dota2', slug: 'dota2',
    name: 'Dota 2', genre: 'MOBA',
    description: 'El MOBA más complejo y profundo. Partidas de alto nivel mental, heroes complejos y torneos con millones en premios. The International te espera.',
    tags: ['MOBA', '5vs5', 'Ranked', 'TI', 'Complejo', 'Torneos'],
    members: 2100, activePlayers: 800,
    color: '#C23B22', gameColor: '#1A1208',
    poster: '/demos/steliant-esports/ImaHorizontal/Dota2.jpg', video: null,
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'dota-1', type: 'post',
        author: { nick: 'DotaPhilosopher', avatar: 'https://i.pravatar.cc/48?img=52', role: 'member' },
        time: 'hace 8h',
        content: 'Dota 2 es el único juego donde llevas 5,000 horas y aún sientes que eres un noob. Eso es lo que lo hace eterno.',
        likes: 156, liked: false, comments: 63,
      },
    ],
    creators: [
      { id: 'c12', nick: 'DotaMind', avatar: 'https://i.pravatar.cc/64?img=52', platform: 'youtube', followers: '41.2K', live: false, game: 'Dota 2', description: 'Análisis profundos de Dota 2, draft y estrategia de alto nivel.' },
    ],
    news: [],
    info: {
      modes: ['All Pick', 'Captain\'s Mode', 'Turbo', 'Single Draft'],
      rules: 'Destruye el Ancient rival. Partidas de 40-90 minutos. 119+ héroes con roles definidos.',
      links: [{ label: 'Web oficial', url: 'https://dota2.com' }, { label: 'The International', url: 'https://dota2.com/esports' }],
      events: [],
    },
  },

  // ── HONOR OF KINGS ──────────────────────────────────────────
  {
    id: 'honor-of-kings', slug: 'honor-of-kings',
    name: 'Honor of Kings', genre: 'MOBA',
    description: 'El MOBA 5vs5 más popular del mundo. Héroes únicos, combates épicos y una escena competitiva global que crece cada temporada.',
    tags: ['Mobile', 'MOBA', '5vs5', 'Ranked', 'Torneos', 'Competitivo'],
    members: 3800, activePlayers: 2100,
    color: '#29C5F6', gameColor: '#071B2C',
    poster: '/demos/steliant-esports/ImaHorizontal/hok.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Hok5.jpg',
    railImages: {
      torneos:   '/demos/steliant-esports/ImaHorizontal/Hok2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Hok3.jpg',
      noticias:  '/demos/steliant-esports/ImaHorizontal/Hok4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Hok5.jpg',
    },
    railData: {
      torneos:   { title: 'HOK Pro League', prize: '$5,000', date: '20 Jul 2026' },
      creadores: { title: 'HokClips', followers: '210K', live: false },
      noticias:  { title: 'Nuevo parche de héroes', date: '30 Jun 2026' },
      rules:     { title: '5vs5 · Destruye el Nexo' },
    },
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'hok-1', type: 'post',
        author: { nick: 'HokKing', avatar: 'https://i.pravatar.cc/48?img=18', role: 'member' },
        time: 'hace 2h',
        content: 'Nuevo parche, nuevos héroes rotos. ¿Ya vieron el rework de Zanis? Va a cambiar todo el meta de la jungla. #HonorOfKings',
        likes: 52, liked: false, comments: 14,
      },
    ],
    creators: [
      { id: 'c13', nick: 'HokClips', avatar: 'https://i.pravatar.cc/64?img=18', platform: 'tiktok', followers: '210K', live: false, game: 'Honor of Kings', description: 'Highlights, guías de héroes y análisis de parche.' },
    ],
    news: [],
    info: {
      modes: ['Clásico ranked', 'Draft pick', 'Abyssal', 'Brawl'],
      rules: 'Destruye el Nexo enemigo en partidas 5vs5. Cada héroe tiene habilidades únicas y roles definidos.',
      links: [{ label: 'Web oficial', url: 'https://levelinfinite.com/games/honor-of-kings/' }],
      events: [],
    },
  },

  // ── TEAMFIGHT TACTICS ───────────────────────────────────────
  {
    id: 'teamfight-tactics', slug: 'teamfight-tactics',
    name: 'Teamfight Tactics', genre: 'ESTRATEGIA Y CARTAS',
    description: 'El auto battler de Riot Games. Construye sinergias, posiciona tus campeones y adapta tu estrategia ronda a ronda para ser el último en pie.',
    tags: ['Auto Battler', 'Estrategia', 'Rounds', 'Ranked', 'Competitivo'],
    members: 2800, activePlayers: 1650,
    color: '#B68CFF', gameColor: '#140D25',
    poster: '/demos/steliant-esports/ImaHorizontal/TFT.jpg',
    video: '',
    lowFpsImage: '/demos/steliant-esports/ImaHorizontal/Tft5.jpg',
    railImages: {
      torneos:   '/demos/steliant-esports/ImaHorizontal/Tft2.jpg',
      creadores: '/demos/steliant-esports/ImaHorizontal/Tft3.jpg',
      noticias:  '/demos/steliant-esports/ImaHorizontal/Tft4.jpg',
      'mas-info': '/demos/steliant-esports/ImaHorizontal/Tft5.jpg',
    },
    railData: {
      torneos:   { title: 'TFT Set Championship', prize: '€800', date: '18 Jul 2026' },
      creadores: { title: 'TFTGuides', followers: '76K', live: false },
      noticias:  { title: 'Nuevo Set 14 anunciado', date: '22 Jun 2026' },
      rules:     { title: '8 jugadores · Auto battler' },
    },
    joined: false,
    userRole: 'member',
    posts: [
      {
        id: 'tft-1', type: 'post',
        author: { nick: 'TFTMaster', avatar: 'https://i.pravatar.cc/48?img=37', role: 'member' },
        time: 'hace 4h',
        content: 'Forzando Invocadores + Noxus me subí de Platino a Diamante en un día. El eco de Annie es una locura si le das doble Shojin. #TFT',
        likes: 41, liked: false, comments: 11,
      },
    ],
    creators: [
      { id: 'c14', nick: 'TFTGuides', avatar: 'https://i.pravatar.cc/64?img=37', platform: 'youtube', followers: '76K', live: false, game: 'Teamfight Tactics', description: 'Composiciones meta, guías de económia y posicionamiento.' },
    ],
    news: [],
    info: {
      modes: ['Ranked', 'Normal', 'Hyper Roll', 'Double Up'],
      rules: 'Compite contra 7 jugadores. Compra, combina y posiciona campeones para ganar rondas automáticas.',
      links: [{ label: 'Web oficial', url: 'https://teamfighttactics.leagueoflegends.com' }],
      events: [],
    },
  },
]

// ── Helpers ────────────────────────────────────────────────────
// Las fichas de arriba solo aportan presentación (nombre, arte, géneros,
// reglas). Miembros, "unido", rol, posts, torneos y creadores de ejemplo NO se
// muestran: lo real sale de /communities (memberCount/joined) y /posts. Antes
// salían cifras inventadas (8.2K miembros) y el "unirse" vivía en localStorage.
export function withCommunityMembership(community) {
  if (!community) return null
  return {
    ...community,
    joined: false,
    members: 0,
    activePlayers: 0,
    userRole: 'member',
    posts: [],
    railData: {},
    creators: [],
    news: [],
  }
}

/** Mezcla una ficha local con su documento real de /communities. */
export function withRemoteCommunity(local, remote) {
  if (!remote) return local
  return {
    ...(local || {}),
    _id: remote._id,
    remoteId: remote._id,
    id: local?.id || remote.slug || remote._id,
    slug: local?.slug || remote.slug,
    name: local?.name || remote.name,
    description: remote.description || local?.description || '',
    members: Number(remote.memberCount ?? (Array.isArray(remote.members) ? remote.members.length : 0)) || 0,
    joined: Boolean(remote.joined),
    creatorId: remote.creator?._id || remote.creator || null,
    official: Boolean(remote.official),
  }
}

const COMMUNITY_ALIASES = {
  'mobile-legends-bang-bang': 'mlbb',
  'free-fire': 'freefire',
  'rocket-league-sideswipe': 'rocketleague',
  'honor-of-kings': 'hok',
}

function resolveCommunitySlug(slug) {
  const raw = String(slug || '').trim()
  if (!raw) return ''
  if (COMMUNITY_ALIASES[raw]) return COMMUNITY_ALIASES[raw]
  const normalized = normalizeGameId(raw, raw)
  return COMMUNITY_ALIASES[normalized] || raw
}

function buildDefaultInfoTitle(game) {
  const namesByCategory = {
    moba: 'Modos, roles y escena competitiva',
    'shooters-battle-royale': 'Mapas, formatos y escena activa',
    'fighting-games': 'Matchups, formatos y comunidad',
    'strategy-cards': 'Compos, meta y recursos clave',
    rts: 'Estrategia, build orders y eventos',
    'sports-racing': 'Formatos, ranked y competición',
    simulators: 'Ligas, reglamento y calendario',
    'mmo-competitivo': 'PvP, builds y recursos clave',
    'party-casual': 'Modos, eventos y comunidad',
  }
  return namesByCategory[game?.categoryId] || 'Guía rápida de la comunidad'
}

function buildDefaultHeadline(game, section) {
  const bySection = {
    torneos: {
      moba: `Clash y cups de ${game.name}`,
      'shooters-battle-royale': `Scrims y cups de ${game.name}`,
      'fighting-games': `Brackets abiertos de ${game.name}`,
      'strategy-cards': `Cups y ladders de ${game.name}`,
      'sports-racing': `Rankeds y opens de ${game.name}`,
    },
    creadores: {
      moba: `Guías y clips de ${game.name}`,
      'shooters-battle-royale': `Highlights y análisis de ${game.name}`,
      'fighting-games': `Tech, combos y sets de ${game.name}`,
      'strategy-cards': `Meta y compos de ${game.name}`,
      'sports-racing': `Mecánicas y partidas de ${game.name}`,
    },
    noticias: {
      moba: `Parche y competitivo de ${game.name}`,
      'shooters-battle-royale': `Meta y novedades de ${game.name}`,
      'fighting-games': `Escena y updates de ${game.name}`,
      'strategy-cards': `Set, balance y novedades de ${game.name}`,
      'sports-racing': `Temporada y novedades de ${game.name}`,
    },
  }
  return bySection[section]?.[game?.categoryId] || `${section === 'torneos' ? 'Actividad' : section === 'creadores' ? 'Contenido' : 'Novedades'} de ${game.name}`
}

function buildDefaultRailData(game) {
  if (!game) return {}
  return {
    torneos: { title: buildDefaultHeadline(game, 'torneos') },
    creadores: { title: buildDefaultHeadline(game, 'creadores') },
    noticias: { title: buildDefaultHeadline(game, 'noticias') },
    rules: { title: buildDefaultInfoTitle(game) },
  }
}

function withCommunityMedia(community) {
  if (!community) return null
  const normalizedId = normalizeGameId(community.slug || community.id, community.slug || community.id)
  const game = GAME_BY_ID[normalizedId]
  if (!game) return community

  const communityRailImages = community.railImages || {}
  const gameRailImages = game.railImages || {}
  const communityRailData = community.railData || {}
  const fallbackRailData = buildDefaultRailData(game)

  return {
    ...community,
    poster: community.poster || game.poster || game.images?.horizontal || game.image || '',
    video: community.video || game.video || null,
    lowFpsImage: community.lowFpsImage || game.lowFpsImage || null,
    railImages: Object.keys(communityRailImages).length ? { ...gameRailImages, ...communityRailImages } : gameRailImages,
    railData: Object.keys(communityRailData).length ? { ...fallbackRailData, ...communityRailData } : fallbackRailData,
  }
}

function buildGameCommunity(game) {
  if (!game) return null
  const infoModes = [game.genre || game.category || 'Competitivo']
  const infoLinks = []
  const infoEvents = []

  if (game.categoryId === 'shooters-battle-royale') {
    infoModes.push('Ranked', 'Casual')
  } else if (game.categoryId === 'moba') {
    infoModes.push('Ranked', 'Casual', 'Clash')
  } else if (game.categoryId === 'fighting-games') {
    infoModes.push('Versus', 'Ranked', 'Bracket')
  } else if (game.categoryId === 'strategy-cards') {
    infoModes.push('Ranked', 'Meta', 'Torneos')
  } else if (game.categoryId === 'sports-racing') {
    infoModes.push('Ranked', 'Open', 'Temporada')
  }

  return {
    id: game.id,
    slug: game.id,
    name: game.name,
    genre: game.genre || game.category || 'Videojuego',
    description: game.description || `${game.name}, comunidad competitiva de GlitchGang.`,
    tags: [...new Set([...(game.tags || []), game.genre || game.category, 'Comunidad'].filter(Boolean))],
    members: 0,
    activePlayers: 0,
    color: game.color || '#00E676',
    gameColor: game.colorB || '#07192b',
    poster: game.poster || game.images?.horizontal || game.image || '',
    video: game.video || null,
    lowFpsImage: game.lowFpsImage || null,
    railImages: game.railImages || {},
    railData: buildDefaultRailData(game),
    joined: false,
    userRole: 'member',
    posts: [],
    creators: [],
    news: [],
    info: {
      modes: [...new Set(infoModes)],
      rules: `${game.name} tiene un espacio dedicado para partidas, comunidad y seguimiento competitivo dentro de GlitchGang. Entra para descubrir sus modos, creadores y próximos eventos cuando estén disponibles.`,
      links: infoLinks,
      events: infoEvents,
    },
  }
}

export function getAllCommunities() {
  const manual = COMMUNITIES.map(withCommunityMedia).map(withCommunityMembership)
  const manualSlugs = new Set(manual.flatMap(c => [c.slug, ...Object.entries(COMMUNITY_ALIASES).filter(([, target]) => target === c.slug).map(([alias]) => alias)]))
  const generated = GAMES
    .filter(game => !manualSlugs.has(game.id))
    .map(game => withCommunityMembership(buildGameCommunity(game)))
  const userCreated = getPublicCommunities().map(withCommunityMembership)
  return [...userCreated, ...manual, ...generated]
}

export const getCommunityBySlug = (slug) => {
  const resolvedSlug = resolveCommunitySlug(slug)
  const userCreated = getPublicCommunityBySlug(resolvedSlug)
  if (userCreated) return withCommunityMembership(userCreated)
  const manual = COMMUNITIES.find(c => c.slug === resolvedSlug || c.id === resolvedSlug)
  if (manual) return withCommunityMembership(withCommunityMedia(manual))
  const game = GAME_BY_ID[normalizeGameId(resolvedSlug, resolvedSlug)] || GAME_BY_ID[resolvedSlug]
  return withCommunityMembership(buildGameCommunity(game))
}

export const COMMUNITY_TAGS = ['Todos', 'FPS', 'MOBA', 'Battle Royale', 'Sport', 'Mobile', 'Torneos', 'Ranked']

