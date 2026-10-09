// ════════════════════════════════════════════════════════════
//  Datos del Panel del Jugador — Centro de Rendimiento (Player HQ)
//  Métricas individuales, por equipo, historial y carrera.
//  (Mock data — reemplazar por API real cuando esté disponible)
// ════════════════════════════════════════════════════════════

// ── Identidad y resumen de carrera del jugador autenticado ──
export const PLAYER_PROFILE = {
  nick: 'Brooklyn',
  realName: 'Brooklyn García',
  avatar: 'https://i.pravatar.cc/120?img=12',
  country: 'DO',
  mainGame: 'Valorant',
  role: 'IGL · Estratega',
  joinDate: 'Enero 2024',
  plan: 'Pro Trial',
  level: 47,
  xp: 8420,
  xpNext: 10000,
  globalRank: 1204,
  regionRank: 38,           // ranking en su país/región
  careerEarnings: 4820,     // USD ganados en torneos
  trophies: 5,
  verified: true,
}

// ── KPIs principales (tarjetas del dashboard) ──
export const PLAYER_KPIS = [
  { key: 'winrate', label: 'Win rate global',  value: '68%',     delta: '+4.2% esta semana', down: false, icon: 'trend' },
  { key: 'kda',     label: 'KDA promedio',     value: '2.84',    delta: '+0.12 este mes',    down: false, icon: 'target' },
  { key: 'rank',    label: 'Ranking global',   value: '#1,204',  delta: '+86 posiciones',    down: false, icon: 'bolt' },
  { key: 'rating',  label: 'Rating GG',        value: '3,840',   delta: '+120 pts',          down: false, icon: 'gem' },
  { key: 'matches', label: 'Partidas totales', value: '555',     delta: '+12 esta semana',   down: false, icon: 'gamepad' },
  { key: 'earn',    label: 'Ganancias',        value: '$4,820',  delta: '−3% vs mes',        down: true,  icon: 'creditCard' },
]

// ── Evolución de rating (últimos 9 meses) para la gráfica ──
export const RATING_TIMELINE = {
  labels: ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
  rating: [2980, 3120, 3050, 3300, 3420, 3380, 3560, 3720, 3840],
  winrate: [54, 58, 56, 61, 63, 60, 64, 66, 68],
}

// ── Rendimiento por juego ──
export const GAME_STATS = [
  {
    game: 'Valorant', color: '#FF4655',
    rank: 'Diamante II', peak: 'Inmortal I',
    winrate: 68, wins: 218, losses: 103, matches: 321,
    kda: 2.84, hours: 640, mainPick: 'Omen',
  },
  {
    game: 'League of Legends', color: '#1E9DE3',
    rank: 'Platino I', peak: 'Diamante IV',
    winrate: 61, wins: 89, losses: 56, matches: 145,
    kda: 3.10, hours: 410, mainPick: 'Thresh',
  },
  {
    game: 'CS2', color: '#F0A500',
    rank: 'Águila', peak: 'Supremo',
    winrate: 54, wins: 48, losses: 41, matches: 89,
    kda: 1.18, hours: 230, mainPick: 'Mirage',
  },
]

// ── Picks/personajes más usados (juego principal) ──
export const TOP_PICKS = [
  { name: 'Omen',    role: 'Controlador', matches: 142, winrate: 72, kda: 3.10 },
  { name: 'Astra',   role: 'Controlador', matches: 78,  winrate: 65, kda: 2.70 },
  { name: 'Viper',   role: 'Controlador', matches: 54,  winrate: 61, kda: 2.40 },
  { name: 'Brimstone', role: 'Controlador', matches: 47, winrate: 58, kda: 2.20 },
]

// ── Rendimiento por mapa (juego principal) ──
export const MAP_STATS = [
  { map: 'Ascent', winrate: 74, matches: 64 },
  { map: 'Bind',   winrate: 69, matches: 52 },
  { map: 'Haven',  winrate: 66, matches: 48 },
  { map: 'Icebox', winrate: 51, matches: 41 },
  { map: 'Pearl',  winrate: 47, matches: 33 },
]

// ── Radar de habilidades (0-100) ──
export const SKILL_RADAR = [
  { label: 'Puntería',     value: 78 },
  { label: 'Game sense',   value: 92 },
  { label: 'Clutch',       value: 85 },
  { label: 'Comunicación', value: 95 },
  { label: 'Consistencia', value: 80 },
  { label: 'Mecánica',     value: 74 },
]

// ── Equipos del jugador (actuales e históricos) ──
export const PLAYER_TEAMS = [
  {
    id: 1, name: 'GLITCH CORE', tag: 'GGC', color: '#00E676',
    game: 'Valorant', status: 'active', myRole: 'IGL · Capitán',
    joined: 'Mar 2024', winrate: 71, wins: 42, losses: 17,
    rankPts: 3840, rank: 4, founder: true,
    myContribution: { kda: 2.9, mvpRate: 38, matchesWithTeam: 59 },
    roster: [
      { nick: 'Brooklyn',    role: 'IGL',     avatar: 'https://i.pravatar.cc/48?img=12', online: true,  me: true },
      { nick: 'Vexon',       role: 'Duelist', avatar: 'https://i.pravatar.cc/48?img=5',  online: true },
      { nick: 'Miraya',      role: 'Support', avatar: 'https://i.pravatar.cc/48?img=29', online: false },
      { nick: 'Krypto99',    role: 'Tank',    avatar: 'https://i.pravatar.cc/48?img=17', online: true },
      { nick: 'ZeroGravity', role: 'Flex',    avatar: 'https://i.pravatar.cc/48?img=60', online: false },
    ],
  },
  {
    id: 2, name: 'Nightfall Academy', tag: 'NFA', color: '#8B5CF6',
    game: 'League of Legends', status: 'active', myRole: 'Support',
    joined: 'Sep 2024', winrate: 63, wins: 27, losses: 16,
    rankPts: 2410, rank: 11, founder: false,
    myContribution: { kda: 3.4, mvpRate: 21, matchesWithTeam: 43 },
    roster: [
      { nick: 'Solaris',  role: 'Top',     avatar: 'https://i.pravatar.cc/48?img=33', online: false },
      { nick: 'Kaze',     role: 'Jungla',  avatar: 'https://i.pravatar.cc/48?img=8',  online: true },
      { nick: 'Lumen',    role: 'Mid',     avatar: 'https://i.pravatar.cc/48?img=15', online: true },
      { nick: 'Riftcat',  role: 'ADC',     avatar: 'https://i.pravatar.cc/48?img=44', online: false },
      { nick: 'Brooklyn', role: 'Support', avatar: 'https://i.pravatar.cc/48?img=12', online: true, me: true },
    ],
  },
  {
    id: 3, name: 'Velocity Five', tag: 'VL5', color: '#F59E0B',
    game: 'CS2', status: 'former', myRole: 'Entry Fragger',
    joined: 'Ene 2023', left: 'Dic 2023', winrate: 49, wins: 22, losses: 23,
    rankPts: 1680, rank: 27, founder: false,
    myContribution: { kda: 1.1, mvpRate: 14, matchesWithTeam: 45 },
    roster: [
      { nick: 'Brooklyn', role: 'Entry',  avatar: 'https://i.pravatar.cc/48?img=12', online: false, me: true },
      { nick: 'Dusty',    role: 'AWP',    avatar: 'https://i.pravatar.cc/48?img=51', online: false },
      { nick: 'Norok',    role: 'Support', avatar: 'https://i.pravatar.cc/48?img=22', online: false },
    ],
  },
]

// ── Historial de partidas (completo, filtrable) ──
export const MATCH_HISTORY = [
  { id: 1,  game: 'Valorant', mode: 'Torneo',  map: 'Bind',   vs: 'Nyx Esports',  team: 'GGC', result: 'win',  kda: '18/9/12', rating: 1.34, rp: 31,  date: 'Hoy · 14:20' },
  { id: 2,  game: 'Valorant', mode: 'Ranked',  map: 'Ascent', vs: 'Team Volt',    team: 'GGC', result: 'win',  kda: '22/10/8', rating: 1.42, rp: 24,  date: 'Hoy · 11:05' },
  { id: 3,  game: 'LoL',      mode: 'Ranked',  map: 'Grieta',  vs: 'Cipher Clan',  team: 'NFA', result: 'win',  kda: '4/2/19',  rating: 1.28, rp: 19,  date: 'Ayer · 21:40' },
  { id: 4,  game: 'Valorant', mode: 'Ranked',  map: 'Icebox', vs: 'Cipher Clan',  team: 'GGC', result: 'loss', kda: '14/18/6', rating: 0.82, rp: -18, date: 'Ayer · 19:10' },
  { id: 5,  game: 'Valorant', mode: 'Scrim',   map: 'Haven',  vs: 'Phantom Squad',team: 'GGC', result: 'win',  kda: '20/8/14', rating: 1.51, rp: 12,  date: 'Ayer · 16:30' },
  { id: 6,  game: 'CS2',      mode: 'Premier', map: 'Mirage', vs: 'Dark Matter',  team: 'VL5', result: 'loss', kda: '15/19/3', rating: 0.91, rp: -14, date: 'Hace 2d' },
  { id: 7,  game: 'Valorant', mode: 'Ranked',  map: 'Pearl',  vs: 'Zero Latency', team: 'GGC', result: 'loss', kda: '11/15/9', rating: 0.78, rp: -9,  date: 'Hace 2d' },
  { id: 8,  game: 'LoL',      mode: 'Flex',    map: 'Grieta',  vs: 'Helios',       team: 'NFA', result: 'win',  kda: '2/1/24',  rating: 1.33, rp: 16,  date: 'Hace 3d' },
  { id: 9,  game: 'Valorant', mode: 'Torneo',  map: 'Split',  vs: 'Team Volt',    team: 'GGC', result: 'win',  kda: '24/11/7', rating: 1.47, rp: 28,  date: 'Hace 4d' },
  { id: 10, game: 'Valorant', mode: 'Ranked',  map: 'Lotus',  vs: 'Nyx Esports',  team: 'GGC', result: 'win',  kda: '19/12/10',rating: 1.21, rp: 20,  date: 'Hace 5d' },
  { id: 11, game: 'CS2',      mode: 'Premier', map: 'Inferno',vs: 'Phantom Squad',team: 'VL5', result: 'win',  kda: '21/14/4', rating: 1.18, rp: 13,  date: 'Hace 6d' },
  { id: 12, game: 'Valorant', mode: 'Ranked',  map: 'Ascent', vs: 'Cipher Clan',  team: 'GGC', result: 'loss', kda: '13/16/8', rating: 0.85, rp: -11, date: 'Hace 1sem' },
]

// ── Resultados en torneos (carrera / premios) ──
export const TOURNAMENT_RESULTS = [
  { id: 1, name: 'GG Winter Cup 2026',   game: 'Valorant', placement: 1, of: 64, prize: 2500, team: 'GLITCH CORE', date: 'May 2026' },
  { id: 2, name: 'Spring Showdown',      game: 'Valorant', placement: 3, of: 48, prize: 800,  team: 'GLITCH CORE', date: 'Abr 2026' },
  { id: 3, name: 'Rift Masters Latam',   game: 'LoL',      placement: 2, of: 32, prize: 1200, team: 'Nightfall Academy', date: 'Mar 2026' },
  { id: 4, name: 'GG Open #4',           game: 'Valorant', placement: 5, of: 128, prize: 320, team: 'GLITCH CORE', date: 'Feb 2026' },
  { id: 5, name: 'Clutch Series',        game: 'CS2',      placement: 9, of: 64, prize: 0,    team: 'Velocity Five', date: 'Nov 2023' },
]

// ── Logros / hitos ──
export const PLAYER_ACHIEVEMENTS = [
  { id: 1, icon: 'trophy', name: 'Campeón GG Winter Cup', desc: 'Ganó el primer torneo de la plataforma', date: 'May 2026', unlocked: true },
  { id: 2, icon: 'gem',    name: 'Inmortal',              desc: 'Alcanzó Inmortal en Valorant',           date: 'Abr 2026', unlocked: true },
  { id: 3, icon: 'trend',  name: 'Racha de 10',           desc: '10 victorias consecutivas en ranked',    date: 'Mar 2026', unlocked: true },
  { id: 4, icon: 'target', name: 'Clutch King',           desc: '25 clutches 1vX en torneos',             date: 'Feb 2026', unlocked: true },
  { id: 5, icon: 'bolt',   name: 'Early Adopter',         desc: 'Uno de los primeros 500 usuarios',       date: 'Ene 2026', unlocked: true },
  { id: 6, icon: 'globe',  name: 'Top 50 RD',             desc: 'Top 50 en República Dominicana',         date: '—',        unlocked: false },
  { id: 7, icon: 'crown',  name: 'Leyenda',               desc: 'Llega al top 10 de la plataforma',       date: '—',        unlocked: false },
]

