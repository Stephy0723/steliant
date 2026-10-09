// Datos base del Portal de Marca mientras se cargan datos reales desde API.

export const BRAND_PROFILE = {
  name: 'Federacion Dominicana de Videojuegos',
  industry: 'Esports y videojuegos',
  logo: '/demos/steliant-esports/brands/fdde.jpg',
  logoInitials: 'FDV',
  color: '#0B4F8A',
  tier: 'Platino',
  since: '2026',
  contact: 'contacto@glitchgang.net',
}

export const BRAND_KPIS = [
  { key: 'impressions', label: 'Impresiones (30d)', value: '0', delta: 'Sin datos', down: false, icon: 'eye' },
  { key: 'clicks', label: 'Clics', value: '0', delta: 'Sin datos', down: false, icon: 'target' },
  { key: 'ctr', label: 'CTR medio', value: '0%', delta: 'Sin datos', down: false, icon: 'trend' },
  { key: 'reach', label: 'Alcance unico', value: '0', delta: 'Sin datos', down: false, icon: 'users' },
  { key: 'spend', label: 'Inversion (30d)', value: '$0', delta: 'Sin datos', down: false, icon: 'creditCard' },
  { key: 'roi', label: 'ROAS estimado', value: '0x', delta: 'Sin datos', down: false, icon: 'gem' },
]

export const REACH_TIMELINE = {
  labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
  impressions: [0, 0, 0, 0, 0, 0, 0, 0],
  clicks: [0, 0, 0, 0, 0, 0, 0, 0],
}

export const BRAND_CAMPAIGNS = [
  {
    id: 1,
    name: 'Federacion Dominicana de Videojuegos - Activacion nacional',
    status: 'draft',
    placement: 'Banner principal',
    budget: 0,
    spent: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    start: '-',
    end: '-',
    color: '#0B4F8A',
  },
  {
    id: 2,
    name: 'NPC Latino - Cobertura de comunidad',
    status: 'draft',
    placement: 'Media partner',
    budget: 0,
    spent: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    start: '-',
    end: '-',
    color: '#F47B20',
  },
]

export const CAMPAIGN_STATUS_LABEL = { active: 'Activa', ended: 'Finalizada', draft: 'Borrador', paused: 'Pausada' }

export const AD_INVENTORY = [
  { id: 'home-banner', name: 'Banner principal (Home)', desc: 'Encabezado rotativo en la pagina de inicio.', reach: 'Por medir', price: 0, unit: 'mes', icon: 'layoutGrid', availability: 'available' },
  { id: 'stream-overlay', name: 'Overlay en transmisiones', desc: 'Logo persistente en streams oficiales.', reach: 'Por evento', price: 0, unit: 'evento', icon: 'tv', availability: 'available' },
  { id: 'bracket', name: 'Patrocinio de bracket', desc: 'Marca en el bracket y resultados del torneo.', reach: 'Por torneo', price: 0, unit: 'torneo', icon: 'trophy', availability: 'limited' },
  { id: 'newsletter', name: 'Espacio en newsletter', desc: 'Bloque destacado en el boletin semanal.', reach: 'Por envio', price: 0, unit: 'envio', icon: 'news', availability: 'available' },
  { id: 'creator', name: 'Creador patrocinado', desc: 'Activacion con un creador verificado.', reach: 'Variable', price: 0, unit: 'a medida', icon: 'star', availability: 'available' },
]

export const AVAILABILITY_LABEL = { available: 'Disponible', limited: 'Pocas plazas', soldout: 'Agotado' }

export const BRAND_CREATIVES = [
  { id: 1, name: 'fdv_logo.png', format: 'Logo oficial', size: '-', campaign: 'Federacion Dominicana de Videojuegos', status: 'approved' },
  { id: 2, name: 'npc_latino_logo.png', format: 'Logo oficial', size: '-', campaign: 'NPC Latino', status: 'approved' },
]

export const CREATIVE_STATUS_LABEL = { approved: 'Aprobada', review: 'En revision', rejected: 'Rechazada' }

export const SPONSORABLE_TOURNEYS = [
  { id: 1, name: 'Torneo destacado GlitchGang', game: 'Valorant', date: 'Por definir', slots: 2, prize: 0, reach: 'Por medir' },
]

