// ════════════════════════════════════════════════════════════
//  Organizaciones / empresas de esports y sus torneos.
//  Enfoque regional: RD · Caribe · LATAM.
//  Usado en el directorio de organizadores y su perfil público
//  (info, biografía, redes, torneos y noticias propias).
// ════════════════════════════════════════════════════════════

export const REGIONS = [
  { key: 'all',    label: 'Todas' },
  { key: 'rd',     label: 'Rep. Dominicana' },
  { key: 'caribe', label: 'Caribe' },
  { key: 'latam',  label: 'LATAM' },
]

export const FEATURED_ORGANIZERS = [
  {
    id: 'glitchgang-official', name: 'GlitchGang Official',
    avatar: 'https://i.pravatar.cc/120?img=12', role: 'tournament-organizer',
    roleLabel: 'Org. de torneos', tournaments: 48, players: '12.4k', verified: true,
    color: '#00E676', country: 'DO', region: 'rd', founded: '2024',
    bio: 'La organización oficial de GlitchGang. Circuitos competitivos, ligas y eventos premium nacidos en República Dominicana, con expansión al Caribe.',
    socials: { twitch: 'glitchgangtv', discord: 'glitchgang', youtube: '@glitchgang' },
    tournamentIds: [1, 3, 6],
    news: [
      { id: 'gg-n1', title: 'GlitchGang lanza la Season 01 con circuito nacional', date: '02 Jun 2026', tag: 'Anuncio' },
      { id: 'gg-n2', title: 'Acuerdo con la Federacion Dominicana de Videojuegos para premios de la liga RD', date: '24 May 2026', tag: 'Patrocinio' },
    ],
  },
  {
    id: 'dominican-esports', name: 'Dominican eSports',
    avatar: 'https://i.pravatar.cc/120?img=45', role: 'tournament-organizer',
    roleLabel: 'Org. de torneos', tournaments: 33, players: '8.7k', verified: true,
    color: '#1E9DE3', country: 'DO', region: 'rd', founded: '2022',
    bio: 'Comunidad y torneos del corazón de Santo Domingo. Llevamos el gaming competitivo dominicano al siguiente nivel con eventos presenciales y online.',
    socials: { twitch: 'dominicanesports', discord: 'dr-esports', youtube: '@dresports' },
    tournamentIds: [8, 5],
    news: [
      { id: 'de-n1', title: 'Final presencial en Santo Domingo agota entradas', date: '28 May 2026', tag: 'Evento' },
    ],
  },
  {
    id: 'caribe-gaming-league', name: 'Caribe Gaming League',
    avatar: 'https://i.pravatar.cc/120?img=58', role: 'event-organizer',
    roleLabel: 'Liga regional', tournaments: 27, players: '6.3k', verified: true,
    color: '#22d3ee', country: 'PR', region: 'caribe', founded: '2023',
    bio: 'La liga que une al Caribe: Puerto Rico, Rep. Dominicana, Cuba y Jamaica. Competencia inter-islas con cobertura bilingüe.',
    socials: { twitch: 'caribegaming', discord: 'caribe', youtube: '@caribegl' },
    tournamentIds: [4],
    news: [
      { id: 'cgl-n1', title: 'Arranca el Caribbean Clash inter-islas 2026', date: '30 May 2026', tag: 'Torneo' },
      { id: 'cgl-n2', title: 'Nueva sede regional confirmada en San Juan', date: '12 May 2026', tag: 'Anuncio' },
    ],
  },
  {
    id: 'nova-esports', name: 'Nova Esports',
    avatar: 'https://i.pravatar.cc/120?img=33', role: 'event-organizer',
    roleLabel: 'Organizador de eventos', tournaments: 21, players: '5.1k', verified: true,
    color: '#7c3aed', country: 'AR', region: 'latam', founded: '2021',
    bio: 'Eventos presenciales y online de alto nivel en toda Latinoamérica. Especialistas en Valorant y League of Legends.',
    socials: { twitch: 'novaesports', discord: 'nova', youtube: '@nova' },
    tournamentIds: [2, 4],
    news: [
      { id: 'nv-n1', title: 'Nova abre clasificatorias LATAM para el Spring Split', date: '20 May 2026', tag: 'Torneo' },
    ],
  },
  {
    id: 'latam-pro-liga', name: 'LATAM Pro Liga',
    avatar: 'https://i.pravatar.cc/120?img=15', role: 'tournament-organizer',
    roleLabel: 'Liga profesional', tournaments: 64, players: '20.2k', verified: true,
    color: '#F0A500', country: 'MX', region: 'latam', founded: '2020',
    bio: 'La liga profesional más grande de Latinoamérica. Premios garantizados, cobertura en vivo y franquicias en 8 países.',
    socials: { twitch: 'latamproliga', discord: 'latampro', youtube: '@latampro' },
    tournamentIds: [1, 2, 7],
    news: [
      { id: 'lpl-n1', title: 'LATAM Pro Liga anuncia bolsa récord de $250K', date: '01 Jun 2026', tag: 'Premios' },
      { id: 'lpl-n2', title: 'Cobertura en vivo llega a 1.2M de espectadores', date: '18 May 2026', tag: 'Cobertura' },
    ],
  },
]

export const getOrganizerById = (id) => FEATURED_ORGANIZERS.find(o => o.id === id || String(o.id) === String(id)) || null

