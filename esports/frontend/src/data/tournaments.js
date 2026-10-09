// Torneos de ejemplo para la plataforma
// IDs según convención oficial (país RD = 01):
//   publicId   → TOR-{JUEGO}-{secuencia}-{país}
//   internalId → TOR-{JUEGO}-{YYMMDD}-{secuencia}-{país}  (extenso, con la fecha)
export const TOURNAMENTS = [
  { id: 1,  status: 'live',     game: 'val',  gameCode: 'VAL',  name: 'GG Spring Split',     prize: '5,000',   date: 'En vivo ahora',     slots: 16,  filled: 16, color: '#FF4655', publicId: 'TOR-VAL-002-01',  internalId: 'TOR-VAL-260601-002-01', time: '18:00', format: 'single_elimination', platform: 'PC', cost: 'Gratis', category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 2,  status: 'live',     game: 'lol',  gameCode: 'LOL',  name: 'Challenger Series S1', prize: '2,500',   date: 'En vivo ahora',     slots: 8,   filled: 8,  color: '#C89B3C', publicId: 'TOR-LOL-002-01',  internalId: 'TOR-LOL-260601-002-01', time: '20:00', format: 'single_elimination', platform: 'PC', cost: 'Gratis', category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 3,  status: 'upcoming', game: 'cs2',  gameCode: 'CS2',  name: 'GG Invitational',     prize: '10,000',  date: '2026-06-05',        slots: 32,  filled: 24, color: '#F3A800', publicId: 'TOR-CS2-001-01',  internalId: 'TOR-CS2-260605-001-01', time: '18:00', format: 'single_elimination', platform: 'PC', cost: '$10', entryFee: 10, category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 4,  status: 'upcoming', game: 'apex', gameCode: 'APEX', name: 'Apex GlitchCup',      prize: '1,200',   date: '2026-06-07',        slots: 20,  filled: 11, color: '#CD3333', publicId: 'TOR-APEX-001-01', internalId: 'TOR-APEX-260607-001-01', time: '20:00', format: 'single_elimination', platform: 'PC', cost: '$5', entryFee: 5, category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 5,  status: 'upcoming', game: 'rl',   gameCode: 'RL',   name: 'RL Open Season 2',    prize: '800',     date: '2026-06-10',        slots: 16,  filled: 3,  color: '#0082CA', publicId: 'TOR-RL-001-01',   internalId: 'TOR-RL-260610-001-01',  time: '17:00', format: 'single_elimination', platform: 'PC', cost: 'Gratis', category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 6,  status: 'finished', game: 'val',  gameCode: 'VAL',  name: 'GG Winter Cup',       prize: '3,000',   date: '2026-05-12',        slots: 16,  filled: 16, color: '#FF4655', winner: 'Team Volt',   publicId: 'TOR-VAL-001-01',  internalId: 'TOR-VAL-260512-001-01', time: '18:00', format: 'single_elimination', platform: 'PC', cost: 'Gratis', category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 7,  status: 'finished', game: 'lol',  gameCode: 'LOL',  name: 'Ranked Rumble S0',    prize: '1,500',   date: '2026-04-03',        slots: 8,   filled: 8,  color: '#C89B3C', winner: 'Nyx Esports', publicId: 'TOR-LOL-001-01',  internalId: 'TOR-LOL-260403-001-01', time: '19:00', format: 'single_elimination', platform: 'PC', cost: 'Gratis', category: 'Mixto', creator: 'GlitchGang_Admin' },
  { id: 8,  status: 'upcoming', game: 'mlbb', gameCode: 'MLBB', name: 'MLBB Caribbean Clash 2026', prize: '250000', date: '2026-06-05',    slots: 32,  filled: 0,  color: '#00E676', publicId: 'TOR-MLBB-001-01', internalId: 'TOR-MLBB-260605-001-01', time: '19:00', format: 'single_elimination', platform: 'Mobile', cost: '$15', entryFee: 15, category: 'Mixto', creator: 'Steliant_Admin' },
]

// ─── Detalles extendidos por torneo ───────────────────────────────────────────
const TEAMS_VALORANT_16 = [
  { id:1,  name:'Team Volt',    tag:'VLT', seed:1,  record:'12-2', eliminated:false },
  { id:2,  name:'Nyx Esports',  tag:'NYX', seed:2,  record:'11-3', eliminated:false },
  { id:3,  name:'Static Squad', tag:'STS', seed:3,  record:'10-4', eliminated:true  },
  { id:4,  name:'GhostFire',    tag:'GHF', seed:4,  record:'9-5',  eliminated:true  },
  { id:5,  name:'Zero Lag',     tag:'ZLG', seed:5,  record:'9-5',  eliminated:true  },
  { id:6,  name:'Apex Venom',   tag:'APX', seed:6,  record:'8-6',  eliminated:true  },
  { id:7,  name:'Phantom IX',   tag:'PHX', seed:7,  record:'8-6',  eliminated:true  },
  { id:8,  name:'IronPulse',    tag:'IPL', seed:8,  record:'7-7',  eliminated:true  },
  { id:9,  name:'DarkMatter',   tag:'DKM', seed:9,  record:'7-7',  eliminated:true  },
  { id:10, name:'ShadowPlay',   tag:'SHP', seed:10, record:'6-8',  eliminated:true  },
  { id:11, name:'VoidWave',     tag:'VDW', seed:11, record:'6-8',  eliminated:true  },
  { id:12, name:'CyberClash',   tag:'CYB', seed:12, record:'5-9',  eliminated:true  },
  { id:13, name:'NeonBurst',    tag:'NNB', seed:13, record:'5-9',  eliminated:true  },
  { id:14, name:'LaserEdge',    tag:'LSR', seed:14, record:'4-10', eliminated:true  },
  { id:15, name:'TechBreak',    tag:'TBK', seed:15, record:'3-11', eliminated:true  },
  { id:16, name:'CodeRed',      tag:'CDR', seed:16, record:'2-12', eliminated:true  },
]

export const TOURNAMENT_DETAILS = {
  1: {
    desc: 'El torneo más importante de la plataforma. 16 equipos de élite compiten en formato de eliminación directa por $5,000 en premios. Partidas al mejor de 3 hasta semifinales, final al mejor de 5.',
    rules: [
      'Formato: Single Elimination, BO3 hasta SF, BO5 Final.',
      'Check-in obligatorio 30 min antes de cada partida.',
      'Se permite sustitución de 1 jugador por partido, previa validación.',
      'Resultado debe reportarse en la plataforma dentro de los 10 min posteriores.',
      'Cualquier conducta antideportiva resulta en descalificación inmediata.',
      'Los premios se distribuyen: 1º $3000 · 2º $1200 · 3º-4º $400 cada uno.',
    ],
    organizer: 'GlitchGang Staff',
    organizerId: 99,
    participants: TEAMS_VALORANT_16,
    bracket: {
      rounds: [
        {
          name: 'Ronda de 16', matches: [
            { id:'m1',  teamA:'Team Volt',   scoreA:2, teamB:'CodeRed',    scoreB:0, winner:'Team Volt'   },
            { id:'m2',  teamA:'Nyx Esports', scoreA:2, teamB:'TechBreak',  scoreB:1, winner:'Nyx Esports' },
            { id:'m3',  teamA:'Static Squad',scoreA:2, teamB:'LaserEdge',  scoreB:0, winner:'Static Squad'},
            { id:'m4',  teamA:'GhostFire',   scoreA:2, teamB:'NeonBurst',  scoreB:1, winner:'GhostFire'   },
            { id:'m5',  teamA:'Zero Lag',    scoreA:2, teamB:'CyberClash', scoreB:0, winner:'Zero Lag'    },
            { id:'m6',  teamA:'Apex Venom',  scoreA:2, teamB:'VoidWave',   scoreB:1, winner:'Apex Venom'  },
            { id:'m7',  teamA:'Phantom IX',  scoreA:2, teamB:'ShadowPlay', scoreB:0, winner:'Phantom IX'  },
            { id:'m8',  teamA:'IronPulse',   scoreA:2, teamB:'DarkMatter', scoreB:1, winner:'IronPulse'   },
          ]
        },
        {
          name: 'Cuartos de Final', matches: [
            { id:'q1', teamA:'Team Volt',   scoreA:2, teamB:'Nyx Esports',  scoreB:1, winner:'Team Volt'   },
            { id:'q2', teamA:'Static Squad',scoreA:1, teamB:'GhostFire',    scoreB:2, winner:'GhostFire'   },
            { id:'q3', teamA:'Zero Lag',    scoreA:2, teamB:'Apex Venom',   scoreB:0, winner:'Zero Lag'    },
            { id:'q4', teamA:'Phantom IX',  scoreA:2, teamB:'IronPulse',    scoreB:1, winner:'Phantom IX'  },
          ]
        },
        {
          name: 'Semifinales', matches: [
            { id:'s1', teamA:'Team Volt',  scoreA:2, teamB:'GhostFire',  scoreB:0, winner:'Team Volt'  },
            { id:'s2', teamA:'Zero Lag',   scoreA:1, teamB:'Phantom IX', scoreB:2, winner:'Phantom IX' },
          ]
        },
        {
          name: 'FINAL', matches: [
            { id:'f1', teamA:'Team Volt', scoreA:3, teamB:'Phantom IX', scoreB:1, winner:'Team Volt', isFinal:true },
          ]
        },
      ]
    }
  },
  3: {
    desc: 'El GG Invitational es el torneo más esperado del año. 32 equipos clasificados de torneos regionales compiten por $10,000. El bracket se completa con check-in de equipos el día del torneo.',
    rules: [
      'Formato: Single Elimination, 32 equipos, BO3 hasta SF, BO5 Final.',
      'Todos los equipos deben hacer check-in antes de las 17:00 del día del torneo.',
      'Mapas: Ancient, Anubis, Inferno, Mirage, Nuke, Overpass, Vertigo (votación).',
      'Prohibido el uso de cheats o software de terceros. VAC ban = descalificación.',
      'Comunicación obligatoria por Discord oficial del torneo.',
      'Se trasmite en vivo en STELIANT ESPORTS TV y en el canal de Twitch oficial.',
    ],
    organizer: 'GlitchGang Staff',
    organizerId: 99,
    participants: Array.from({length:24},(_,i)=>({ id:i+1, name:`Equipo ${i+1}`, tag:`E${String(i+1).padStart(2,'0')}`, seed:i+1, record:'?-?', eliminated:false })),
    bracket: { rounds: [] }
  },
  6: {
    desc: 'El GG Winter Cup fue el torneo de cierre de temporada 2024. Team Volt dominó toda la competencia con una actuación impecable, alzándose campeones sin perder un solo mapa en el bracket principal.',
    rules: [
      'Formato: Single Elimination, 16 equipos, BO3 hasta SF, BO5 Final.',
      'El torneo fue jugado en la patch 8.11 de Valorant.',
      'Mapa inicial sorteado, veto alternado entre equipos.',
      'Reglas de conducta aplicadas según el reglamento oficial de STELIANT ESPORTS.',
    ],
    organizer: 'GlitchGang Staff',
    organizerId: 99,
    participants: [
      { id:1, name:'Team Volt',   tag:'VLT', seed:1, record:'14-2', eliminated:false },
      { id:2, name:'Phantom IX',  tag:'PHX', seed:2, record:'12-4', eliminated:true  },
      { id:3, name:'Zero Lag',    tag:'ZLG', seed:3, record:'11-5', eliminated:true  },
      { id:4, name:'GhostFire',   tag:'GHF', seed:4, record:'10-6', eliminated:true  },
      { id:5, name:'Apex Venom',  tag:'APX', seed:5, record:'9-7',  eliminated:true  },
      { id:6, name:'IronPulse',   tag:'IPL', seed:6, record:'8-8',  eliminated:true  },
      { id:7, name:'Nyx Esports', tag:'NYX', seed:7, record:'8-8',  eliminated:true  },
      { id:8, name:'DarkMatter',  tag:'DKM', seed:8, record:'7-9',  eliminated:true  },
    ],
    bracket: {
      rounds: [
        {
          name: 'Cuartos de Final', matches: [
            { id:'w-q1', teamA:'Team Volt',  scoreA:2, teamB:'DarkMatter', scoreB:0, winner:'Team Volt'  },
            { id:'w-q2', teamA:'Phantom IX', scoreA:2, teamB:'Nyx Esports',scoreB:1, winner:'Phantom IX' },
            { id:'w-q3', teamA:'Zero Lag',   scoreA:2, teamB:'IronPulse',  scoreB:0, winner:'Zero Lag'   },
            { id:'w-q4', teamA:'GhostFire',  scoreA:2, teamB:'Apex Venom', scoreB:1, winner:'GhostFire'  },
          ]
        },
        {
          name: 'Semifinales', matches: [
            { id:'w-s1', teamA:'Team Volt',  scoreA:2, teamB:'GhostFire',  scoreB:0, winner:'Team Volt'  },
            { id:'w-s2', teamA:'Phantom IX', scoreA:2, teamB:'Zero Lag',   scoreB:1, winner:'Phantom IX' },
          ]
        },
        {
          name: 'FINAL', matches: [
            { id:'w-f1', teamA:'Team Volt', scoreA:3, teamB:'Phantom IX', scoreB:2, winner:'Team Volt', isFinal:true },
          ]
        },
      ]
    }
  },
}


