// ════════════════════════════════════════════════════════════
//  Datos del Panel de Creador de Contenido (Creator Studio)
//  Audiencia, contenido, analíticas y monetización.
//  (Mock data — reemplazar por API real cuando esté disponible)
// ════════════════════════════════════════════════════════════

export const CREATOR_PROFILE = {
  name: 'StephyStreams',
  realName: 'Stephanie López',
  avatar: 'https://i.pravatar.cc/120?img=47',
  mainPlatform: 'Twitch',
  mainGame: 'Valorant',
  joinDate: 'Febrero 2026',
  verified: true,
  tier: 'Partner',
  followers: 18420,
  bio: 'Streamer competitiva de Valorant · Casting de torneos GlitchGang · LATAM',
}

export const CREATOR_KPIS = [
  { key: 'followers', label: 'Seguidores',        value: '18,420', delta: '+1,240 este mes',   down: false, icon: 'users' },
  { key: 'views',     label: 'Vistas (30d)',      value: '342K',   delta: '+18% vs mes',       down: false, icon: 'eye' },
  { key: 'watch',     label: 'Horas vistas (30d)','value': '12.6K', delta: '+9.4%',             down: false, icon: 'clock' },
  { key: 'earnings',  label: 'Ingresos (30d)',    value: '$1,840', delta: '+$320',             down: false, icon: 'creditCard' },
  { key: 'engage',    label: 'Engagement',        value: '7.8%',   delta: '+0.6 pts',          down: false, icon: 'heart' },
  { key: 'clips',     label: 'Clips publicados',  value: '64',     delta: '+8 esta semana',    down: false, icon: 'tv' },
]

// Evolución de seguidores (últimos 9 puntos)
export const AUDIENCE_TIMELINE = {
  labels: ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
  followers: [9200, 10400, 11800, 12600, 13900, 15100, 16200, 17300, 18420],
  views: [120, 142, 168, 180, 210, 245, 280, 312, 342], // en miles
}

// Plataformas conectadas
export const CREATOR_PLATFORMS = [
  { id: 'twitch',    label: 'Twitch',    icon: 'twitch',    followers: 9300,  color: '#9146FF', connected: true },
  { id: 'youtube',   label: 'YouTube',   icon: 'youtube',   followers: 4100,  color: '#FF0000', connected: true },
  { id: 'tiktok',    label: 'TikTok',    icon: 'tiktok',    followers: 3700,  color: '#e0e0e0', connected: true },
  { id: 'instagram', label: 'Instagram', icon: 'instagram', followers: 1320,  color: '#E1306C', connected: false },
]

// Contenido publicado / gestionable
export const CREATOR_CONTENT = [
  { id: 1, title: 'Clutch 1v5 en Ascent — Grand Final GG Winter Cup', type: 'Clip', game: 'Valorant', status: 'published', views: 48200, likes: 6100, duration: '0:42', date: 'Hoy', thumb: '#FF4655' },
  { id: 2, title: 'VOD completo · Semifinal vs Nyx Esports', type: 'VOD', game: 'Valorant', status: 'published', views: 21400, likes: 1800, duration: '2:14:08', date: 'Ayer', thumb: '#7c3aed' },
  { id: 3, title: 'Guía de Omen — setups de humo en todos los mapas', type: 'Tutorial', game: 'Valorant', status: 'published', views: 33700, likes: 4200, duration: '12:30', date: 'Hace 2d', thumb: '#1E9DE3' },
  { id: 4, title: 'Highlights de la semana — Top 10 jugadas', type: 'Clip', game: 'Valorant', status: 'scheduled', views: 0, likes: 0, duration: '3:18', date: 'Programado 12 jun', thumb: '#F0A500' },
  { id: 5, title: 'Reacción al bracket del Spring Split', type: 'Clip', game: 'CS2', status: 'draft', views: 0, likes: 0, duration: '5:02', date: 'Borrador', thumb: '#22c55e' },
  { id: 6, title: 'Casting oficial — Final Rift Masters Latam', type: 'VOD', game: 'LoL', status: 'published', views: 57900, likes: 7300, duration: '1:48:22', date: 'Hace 5d', thumb: '#e11d48' },
]

export const CONTENT_STATUS_LABEL = {
  published: 'Publicado', scheduled: 'Programado', draft: 'Borrador',
}

// Top contenido por rendimiento
export const TOP_CONTENT = [
  { title: 'Casting oficial — Final Rift Masters Latam', views: 57900, ctr: 9.2 },
  { title: 'Clutch 1v5 en Ascent', views: 48200, ctr: 12.4 },
  { title: 'Guía de Omen', views: 33700, ctr: 6.8 },
  { title: 'VOD Semifinal vs Nyx', views: 21400, ctr: 4.1 },
]

// Demografía de audiencia
export const AUDIENCE_GEO = [
  { country: 'México',           pct: 34 },
  { country: 'Argentina',        pct: 19 },
  { country: 'Colombia',         pct: 14 },
  { country: 'Rep. Dominicana',  pct: 11 },
  { country: 'Chile',            pct: 8 },
  { country: 'Otros',            pct: 14 },
]

// ── Monetización ──
export const REVENUE_SOURCES = [
  { id: 'subs',     label: 'Suscripciones',        amount: 720, pct: 39, icon: 'crown',      color: '#9146FF' },
  { id: 'tips',     label: 'Propinas / Donaciones', amount: 540, pct: 29, icon: 'heart',      color: '#E1306C' },
  { id: 'brand',    label: 'Patrocinios de marca',  amount: 420, pct: 23, icon: 'star',       color: '#F0A500' },
  { id: 'ads',      label: 'Reparto de anuncios',   amount: 160, pct: 9,  icon: 'play',       color: '#1E9DE3' },
]

export const PAYOUT_HISTORY = [
  { id: 1, period: 'Mayo 2026',  amount: 1840, status: 'paid',    method: 'PayPal',   date: '01 jun 2026' },
  { id: 2, period: 'Abril 2026', amount: 1520, status: 'paid',    method: 'PayPal',   date: '01 may 2026' },
  { id: 3, period: 'Marzo 2026', amount: 1180, status: 'paid',    method: 'Transferencia', date: '01 abr 2026' },
  { id: 4, period: 'Junio 2026 (en curso)', amount: 640, status: 'pending', method: 'PayPal', date: '—' },
]

export const PAYOUT_STATUS_LABEL = { paid: 'Pagado', pending: 'Pendiente', processing: 'Procesando' }

// Ofertas de marca / colaboraciones
export const BRAND_DEALS = [
  { id: 1, brand: 'Federacion Dominicana de Videojuegos', type: 'Stream patrocinado', payout: 600, status: 'active', deadline: '20 jun 2026', color: '#0B4F8A' },
  { id: 2, brand: 'NPC Latino', type: 'Cobertura de comunidad', payout: 450, status: 'pending', deadline: '28 jun 2026', color: '#F47B20' },
  { id: 3, brand: 'Federacion Dominicana de Videojuegos', type: 'Activacion en torneo', payout: 800, status: 'invited', deadline: '05 jul 2026', color: '#D71920' },
]

export const DEAL_STATUS_LABEL = { active: 'Activo', pending: 'En revisión', invited: 'Invitación', done: 'Completado' }

// Próximos streams agendados
export const CREATOR_SCHEDULE = [
  { id: 1, title: 'Casting Final · GG Summer Open', date: '12 jun · 19:00', platform: 'Twitch', game: 'Valorant' },
  { id: 2, title: 'Ranked grind a Inmortal',        date: '13 jun · 16:00', platform: 'Twitch', game: 'Valorant' },
  { id: 3, title: 'Watch party — Worlds',           date: '15 jun · 20:30', platform: 'YouTube', game: 'LoL' },
]

