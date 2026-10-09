export const NEWS_ORGANIZERS = [
  {
    slug: 'iesf',
    name: 'IESF',
    label: 'International Esports Federation',
    region: 'Global',
    description: 'Cobertura institucional, clasificatorias, desarrollo competitivo y noticias relevantes del circuito internacional.',
    image: '/demos/steliant-esports/ImaHorizontal/Starcraft.jpg',
    accent: '#1D4ED8',
    stats: [
      { label: 'Circuitos cubiertos', value: '14' },
      { label: 'Regiones activas', value: '5' },
      { label: 'Notas clave', value: '28' },
    ],
  },
  {
    slug: 'geg',
    name: 'GEG',
    label: 'Glitch Esports Group',
    region: 'LatAm',
    description: 'Operación de torneos, marcas, creadores y torneos de comunidad conectados al ecosistema GlitchGang.',
    image: '/demos/steliant-esports/ImaHorizontal/rocket.jpg',
    accent: '#00E676',
    stats: [
      { label: 'Eventos del mes', value: '9' },
      { label: 'Partners activos', value: '16' },
      { label: 'Cobertura en vivo', value: '32 h' },
    ],
  },
  {
    slug: 'lck',
    name: 'LCK',
    label: 'League of Legends Champions Korea',
    region: 'Corea',
    description: 'Análisis, resultados y seguimiento de una de las ligas más exigentes del competitivo global.',
    image: '/demos/steliant-esports/ImaHorizontal/lol.jpg',
    accent: '#C89B3C',
    stats: [
      { label: 'Series destacadas', value: '11' },
      { label: 'Equipos top', value: '10' },
      { label: 'Meta reports', value: '7' },
    ],
  },
]

export const NEWS_ARTICLES = [
  {
    id: 1,
    slug: 'glitchgang-season-01-circuito-ranking-cobertura',
    title: 'GlitchGang lanza Season 01 con circuito competitivo, ranking global y cobertura en vivo',
    excerpt: 'La nueva temporada abre con más torneos, mejor trazabilidad para organizadores y un frente editorial dedicado a historias, resultados y análisis del ecosistema competitivo.',
    body: 'Entre nuevos brackets, paneles de seguimiento y una escena con más creadores y casters, la plataforma entra en una etapa mucho más madura para jugadores, equipos y marcas.',
    paragraphs: [
      'La temporada arranca con una agenda más ambiciosa para organizadores y una experiencia mucho más clara para quienes siguen resultados, clasificaciones y contenido editorial dentro de la app.',
      'El objetivo es que una noticia no sea solo un bloque de texto aislado: cada pieza ahora convive con contexto visual, métricas rápidas y conexiones directas hacia los actores que la protagonizan.',
      'También se refuerza la lógica de cobertura por organizador, permitiendo seguir escenas concretas sin perder de vista el mapa general del ecosistema competitivo.',
    ],
    tag: 'Portada',
    category: 'Plataforma',
    organizer: 'geg',
    date: '05 Jun 2026',
    readTime: '6 min',
    author: 'Redacción GlitchGang',
    image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    color: '#00E676',
    relatedTags: ['GEG', 'IESF', 'LCK'],
    featured: true,
    stats: [
      { label: 'Torneos activos', value: '20+' },
      { label: 'Cobertura en vivo', value: '12 h' },
      { label: 'Prize pool', value: '$50K' },
    ],
  },
  {
    id: 2,
    slug: 'iesf-acelera-clasificatorias-y-amplia-presencia-regional',
    title: 'IESF acelera clasificatorias y amplía su presencia regional con un calendario más sólido',
    excerpt: 'La federación refuerza su capa competitiva con más actividad regional, mayor coordinación de qualifiers y una narrativa más clara para equipos emergentes.',
    body: 'La escena internacional sigue buscando formatos que conecten mejor lo nacional con lo global. IESF está presionando justo en ese punto.',
    paragraphs: [
      'La actualización del calendario apunta a reducir huecos competitivos entre una etapa y otra, algo que equipos y staff llevan tiempo reclamando.',
      'Además del formato, la conversación gira alrededor de producción, visibilidad y cómo ordenar mejor la progresión hacia eventos mayores.',
      'Para plataformas como GlitchGang, esto también abre espacio para producir más cobertura segmentada por región y por organizador.',
    ],
    tag: 'Federaciones',
    category: 'Institucional',
    organizer: 'iesf',
    date: '04 Jun 2026',
    readTime: '5 min',
    author: 'Ari Mendoza',
    image: '/demos/steliant-esports/ImaHorizontal/Starcraft.jpg',
    color: '#1D4ED8',
    relatedTags: ['IESF', 'GEG'],
  },
  {
    id: 3,
    slug: 'lck-vuelve-a-subir-el-liston-del-macro-competitivo',
    title: 'LCK vuelve a subir el listón del macro competitivo con series más limpias y lectura de mapa',
    excerpt: 'La liga coreana está entregando otra vez un estándar táctico que obliga a mirar con más atención rotaciones, setups de objetivo y disciplina de ejecución.',
    body: 'El valor de la LCK no está solo en quién gana, sino en la cantidad de detalles replicables que deja para analysts, coaches y equipos.',
    paragraphs: [
      'La sensación general es que varios equipos están jugando con una claridad de identidad difícil de encontrar en otras regiones.',
      'Eso vuelve a colocar a la liga en el centro del debate global sobre preparación, draft y ritmo competitivo.',
      'También explica por qué cada vez más contenidos de análisis están usando la LCK como referencia visual y táctica.',
    ],
    tag: 'Liga',
    category: 'Análisis',
    organizer: 'lck',
    date: '03 Jun 2026',
    readTime: '7 min',
    author: 'Lucía Ortega',
    image: '/demos/steliant-esports/ImaHorizontal/lol.jpg',
    color: '#C89B3C',
    relatedTags: ['LCK', 'IESF'],
  },
  {
    id: 4,
    slug: 'team-volt-gana-el-winter-cup-con-dominio-total',
    title: 'Team Volt gana el GG Winter Cup con dominio total en el cierre de bracket',
    excerpt: 'El equipo mantuvo un ritmo agresivo de rondas cortas, control de economía y coordinación en post-plant durante toda la final.',
    body: 'Su recorrido dejó claro que el bloque principal ya juega con automatismos de equipo consolidados.',
    paragraphs: [
      'La final fue menos caótica de lo esperado y bastante más quirúrgica en ejecución de utility y cierres de ronda.',
      'Eso eleva la expectativa para el próximo split, sobre todo por cómo el equipo está gestionando profundidad de roster y decisiones tardías.',
      'La cobertura del torneo también dejó claro que GEG está empujando un estándar visual más fuerte para sus eventos grandes.',
    ],
    tag: 'Torneos',
    category: 'Competitivo',
    organizer: 'geg',
    date: '28 May 2026',
    readTime: '4 min',
    author: 'Marina Cuéllar',
    image: '/demos/steliant-esports/ImaHorizontal/rocket.jpg',
    color: '#FACC15',
    relatedTags: ['GEG'],
  },
  {
    id: 5,
    slug: 'valorant-patch-9-10-cambia-prioridades-para-coaches-y-igls',
    title: 'Valorant Patch 9.10 cambia prioridades para coaches y IGLs en escenarios organizados',
    excerpt: 'Riot toca utilidades clave y devuelve protagonismo a composiciones que habían salido del radar en torneos recientes.',
    body: 'El cambio no redefine todo el juego, pero sí obliga a repensar timings, control de espacio y setups defensivos.',
    paragraphs: [
      'Las preguntas ahora pasan por qué equipos adaptan más rápido y cuáles siguen peleando contra inercias viejas del meta anterior.',
      'Ese punto es especialmente importante en ligas cortas, donde el tiempo de ajuste puede definir una temporada.',
      'No es solo parche: es contexto competitivo y toma de decisiones bajo presión.',
    ],
    tag: 'Parche',
    category: 'Meta',
    organizer: 'geg',
    date: '25 May 2026',
    readTime: '7 min',
    author: 'Nico Salazar',
    image: '/demos/steliant-esports/ImaHorizontal/Valo.jpg',
    color: '#FF4655',
    relatedTags: ['GEG', 'LCK'],
  },
  {
    id: 6,
    slug: 'lck-y-su-impacto-en-el-discurso-global-del-league-competitivo',
    title: 'LCK y su impacto en el discurso global del League competitivo',
    excerpt: 'Más allá del resultado semanal, la liga sigue marcando cómo se habla de macro, draft y disciplina colectiva en el alto nivel.',
    body: 'Cada split de la LCK deja tendencias que luego terminan aterrizando en reviews, podcasts y preparación internacional.',
    paragraphs: [
      'Cuando una liga produce lenguaje táctico, no solo produce entretenimiento: produce escuela competitiva.',
      'Eso hace que sus partidos funcionen también como material de estudio para cuerpos técnicos y jugadores de otras regiones.',
      'Seguir la LCK hoy es mirar una vitrina de decisiones refinadas bajo máxima exigencia.',
    ],
    tag: 'Escena',
    category: 'Global',
    organizer: 'lck',
    date: '22 May 2026',
    readTime: '5 min',
    author: 'Paula Jiménez',
    image: '/demos/steliant-esports/ImaHorizontal/Runeterra.jpg',
    color: '#8B5CF6',
    relatedTags: ['LCK'],
  },
]

export const FEATURED_NEWS = NEWS_ARTICLES.find(article => article.featured)
export const NEWS = NEWS_ARTICLES.filter(article => !article.featured)
export const NEWS_SPOTLIGHT = NEWS_ARTICLES.slice(1, 3)
export const NEWS_BRIEFS = [
  { id: 21, title: 'Nuevo calendario de qualifiers publicado para junio', meta: 'Actualización · 2 min', color: '#00E676', organizer: 'geg' },
  { id: 22, title: 'IESF revisa formatos de clasificación para equipos emergentes', meta: 'Institucional · 3 min', color: '#1D4ED8', organizer: 'iesf' },
  { id: 23, title: 'LCK entrega otra semana fuerte de macro y disciplina táctica', meta: 'Análisis · 4 min', color: '#C89B3C', organizer: 'lck' },
]

export function getOrganizerBySlug(slug) {
  return NEWS_ORGANIZERS.find(item => item.slug === slug)
}

export function getNewsArticleBySlug(slug) {
  return NEWS_ARTICLES.find(item => item.slug === slug)
}

export function getArticlesByOrganizer(slug) {
  return NEWS_ARTICLES.filter(item => item.organizer === slug)
}

