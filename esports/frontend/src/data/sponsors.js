// src/data/sponsors.js - sponsors oficiales visibles en la plataforma

export const SPONSORS = [
  {
    id: 'fdv',
    name: 'Federacion Dominicana de Videojuegos',
    logo: '/demos/steliant-esports/brands/fdde.jpg',
    logoInitials: 'FDV',
    color: '#0B4F8A',
    accentColor: '#D71920',
    tagline: 'Impulsando el ecosistema competitivo dominicano.',
    website: 'https://www.facebook.com/fdde.do',
    category: 'Federacion',
    tier: 'platinum',
    active: true,
    tournaments: [1, 3, 6],
    campaign: {
      id: 'fdv-2026',
      title: 'Federacion Dominicana de Videojuegos',
      subtitle: 'Competencia organizada, comunidad y desarrollo nacional',
      description: 'Apoyo institucional para torneos, jugadores, organizadores y comunidades competitivas de Republica Dominicana.',
      cta: 'Conocer la federacion',
      ctaUrl: 'https://www.facebook.com/fdde.do',
      badge: 'Aliado institucional',
      image: '/demos/steliant-esports/brands/fdde.jpg',
      bg: 'linear-gradient(135deg, #03111f 0%, #0b4f8a 48%, #19070a 100%)',
    },
  },
  {
    id: 'npc-latino',
    name: 'NPC Latino',
    logo: '/demos/steliant-esports/brands/npc-latino.png',
    logoInitials: 'NPC',
    color: '#F47B20',
    accentColor: '#FFFFFF',
    tagline: 'Noticias, cultura y esports para la comunidad latina.',
    website: 'https://npclatino.com/',
    category: 'Medios',
    tier: 'platinum',
    active: true,
    tournaments: [1, 4, 8],
    campaign: {
      id: 'npc-2026',
      title: 'NPC Latino',
      subtitle: 'La escena latina de videojuegos en un solo lugar',
      description: 'Cobertura, historias y contenido competitivo para conectar a jugadores, fans y organizadores de LATAM.',
      cta: 'Visitar NPC Latino',
      ctaUrl: 'https://npclatino.com/',
      badge: 'Media partner',
      image: '/demos/steliant-esports/brands/npc-latino.png',
      bg: 'linear-gradient(135deg, #090909 0%, #1f140d 52%, #f47b20 100%)',
    },
  },
]

export const PROMO_CAMPAIGNS = SPONSORS.map(sponsor => sponsor.campaign)

export const PROMO_ROUTES = ['/torneos', '/tv', '/comunidad']

export function getSponsorByTournament(tournamentId) {
  return SPONSORS.find(s => s.tournaments.includes(tournamentId)) || null
}

export const PLATINUM_SPONSORS = SPONSORS.filter(s => s.tier === 'platinum')
export const GOLD_SPONSORS = SPONSORS.filter(s => s.tier === 'gold')
export const SILVER_SPONSORS = SPONSORS.filter(s => s.tier === 'silver')

