// Mi equipo y ranking de equipos en la plataforma
export const MY_TEAM = {
  id: 1, name: 'GLITCH CORE', tag: 'GGC',
  winrate: '71%', wins: 42, losses: 17, rankPts: 3840, rank: 4,
  color: '#00E676',
  roster: [
    { id: 1, nick: 'Brooklyn',   role: 'IGL',     avatar: 'https://i.pravatar.cc/48?img=12', online: true  },
    { id: 2, nick: 'Vexon',      role: 'Duelist', avatar: 'https://i.pravatar.cc/48?img=5',  online: true  },
    { id: 3, nick: 'Miraya',     role: 'Support', avatar: 'https://i.pravatar.cc/48?img=29', online: false },
    { id: 4, nick: 'Krypto99',   role: 'Tank',    avatar: 'https://i.pravatar.cc/48?img=17', online: true  },
    { id: 5, nick: 'ZeroGravity',role: 'Flex',    avatar: 'https://i.pravatar.cc/48?img=60', online: false },
  ],
}

export const TEAM_RANKING = [
  { rank: 1, name: 'Team Volt',      tag: 'VLT', pts: 5200, wins: 60, losses: 12, color: '#FACC15' },
  { rank: 2, name: 'Nyx Esports',    tag: 'NYX', pts: 4980, wins: 55, losses: 18, color: '#8B5CF6' },
  { rank: 3, name: 'Cipher Clan',    tag: 'CIP', pts: 4310, wins: 48, losses: 20, color: '#3B82F6' },
  { rank: 4, name: 'GLITCH CORE',    tag: 'GGC', pts: 3840, wins: 42, losses: 17, color: '#00E676', mine: true },
  { rank: 5, name: 'Zero Latency',   tag: 'ZRL', pts: 3200, wins: 38, losses: 24, color: '#FF4FD8' },
  { rank: 6, name: 'Phantom Squad',  tag: 'PHT', pts: 2900, wins: 33, losses: 27, color: '#EF4444' },
  { rank: 7, name: 'Helios',         tag: 'HLS', pts: 2650, wins: 30, losses: 29, color: '#F97316' },
  { rank: 8, name: 'Dark Matter',    tag: 'DKM', pts: 2100, wins: 24, losses: 35, color: '#6B7280' },
]

