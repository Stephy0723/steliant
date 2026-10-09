import {
  AUDIENCE_SIZE_OPTIONS, CREATOR_PLATFORMS, EVENT_SIZE_OPTIONS, EVENT_TYPES, MODERATOR_SPECIALTIES, ROSTER_SIZE_OPTIONS,
  SPONSOR_INDUSTRIES, YEARS_EXP_OPTIONS,
} from './roleFieldOptions.mjs'

export const STELIANT_REVIEW_EMAIL = 'administracion@steliant.com'

// Campos comunes de los perfiles profesionales. `type` decide el control
// (ver components/RoleFieldInput); un campo con `optional` o "(Opcional)" en su
// label no cuenta para "perfil completo". Los ids NO cambian -- los perfiles ya
// guardados siguen validos (el valor viejo de texto libre se conserva).
const PHOTO = { id: 'photo', type: 'image', label: 'Foto profesional (Opcional)', optional: true }
const SOCIAL = (id = 'website', label = 'Red social más usada', extra = {}) => ({
  id, type: 'social', label, placeholder: 'https://… o @usuario', ...extra,
})
const AVAILABILITY = { id: 'availability', type: 'schedule', label: 'Horario disponible' }
const RATE = { id: 'rate', type: 'rate', label: 'Tarifa o rango de cobro' }
const LANGS = { id: 'languages', type: 'languages', label: 'Idiomas' }
const YEARS = (label) => ({ id: 'yearsExp', type: 'select', label, options: YEARS_EXP_OPTIONS })
const SIZE = (label, options) => ({ id: 'maxSize', type: 'select', label, options })
const TOOLS = (label, placeholder) => ({ id: 'toolsUsed', label, placeholder })
const DESC = (label, placeholder) => ({ id: 'descComplex', type: 'textarea', label, placeholder })

export const PLATFORM_ROLES = [
  {
    id: 'player',
    label: 'Jugador',
    tag: 'PLAYER',
    desc: 'Participa en comunidades, equipos y torneos oficiales.',
    icon: 'gamepad',
    active: true,
    repTitle: 'Datos del Jugador',
    profileTitle: 'Perfil Competitivo',
    expTitle: 'Experiencia en eSports',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Jugadores y la Política de Privacidad.',
    profileFields: [
      { id: 'gamertag', label: 'Nombre de Invocador / GamerTag', placeholder: 'ej. Steliant#MX1' },
      { id: 'mainGame', label: 'Juego Principal', placeholder: 'ej. Valorant, League of Legends' },
      { id: 'rank', label: 'Rango / División Actual', placeholder: 'ej. Inmortal III, Diamante I' },
      { id: 'trackerUrl', label: 'Sitio Web o Portafolio / Tracker (Opcional)', placeholder: 'https://tracker.gg/...' }
    ],
    experienceFields: [
      { id: 'yearsExp', label: 'Años de Experiencia', placeholder: 'ej. 2 años, 5 años' },
      { id: 'maxTournament', label: 'Torneos Jugados', placeholder: 'ej. 15 torneos amateur, 2 profesionales' },
      { id: 'toolsUsed', label: 'Plataformas competitivas que has usado (Ej: Faceit, Challengermode)', placeholder: 'ej. Challengermode, Battlefy' },
      { id: 'descComplex', label: 'Cuéntanos sobre tus logros competitivos y metas...', placeholder: 'Describe tus mejores victorias, equipos en los que has jugado o tus metas en los eSports...', type: 'textarea' }
    ]
  },
  {
    id: 'organizer',
    label: 'Organizador',
    tag: 'ORGANIZER',
    desc: 'Crea y administra torneos y ligas dentro de la plataforma.',
    icon: 'trophy',
    active: false,
    repTitle: 'Datos del Representante',
    profileTitle: 'Perfil de Organización',
    expTitle: 'Experiencia en eSports',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Organizadores y la Política de Pagos.',
    experienceToggle: true,
    profileFields: [
      { id: 'orgName', label: 'Nombre de la Organización / Marca', placeholder: 'ej. Steliant eSports, Glitch Gaming' },
      { ...PHOTO, label: 'Logo o foto (Opcional)' },
      { id: 'eventType', type: 'multiselect', label: 'Tipo de eventos', options: EVENT_TYPES },
      SOCIAL('website', 'Red social o sitio web (Opcional)', { optional: true }),
    ],
    experienceFields: [
      YEARS('Años de experiencia organizando'),
      SIZE('Evento más grande que has gestionado', EVENT_SIZE_OPTIONS),
      TOOLS('Herramientas de brackets que has usado (Ej: Challonge, Toornament)', 'ej. Challonge, Toornament, Battlefy'),
      DESC('Cuéntanos sobre el torneo más complejo que has organizado...', 'Describe el formato, las dificultades técnicas, la gestión de premios y cómo lo solucionaste...'),
    ]
  },
  {
    id: 'creator',
    label: 'Creador de Contenido',
    tag: 'CREATOR',
    desc: 'Publica contenido destacado y accede a herramientas especiales de streaming.',
    icon: 'camera',
    active: false,
    repTitle: 'Datos del Creador',
    profileTitle: 'Perfil de Creador',
    expTitle: 'Experiencia en Creación',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Creadores y la Política de Privacidad.',
    experienceToggle: true,
    profileFields: [
      { id: 'creatorName', label: 'Nombre del canal / pseudónimo', placeholder: 'ej. StephyStreams' },
      PHOTO,
      { id: 'mainPlatform', type: 'select', label: 'Plataforma principal', options: CREATOR_PLATFORMS },
      SOCIAL('portfolio', 'Enlace de tu canal o red principal', { placeholder: 'https://twitch.tv/…' }),
    ],
    experienceFields: [
      YEARS('Años creando contenido'),
      SIZE('Audiencia promedio', ['Menos de 500 seguidores', '500 a 5,000 seguidores', '5,000 a 50,000 seguidores', 'Más de 50,000 seguidores']),
      TOOLS('Herramientas de streaming que usas (Ej: OBS, Streamlabs)', 'ej. OBS Studio, Streamelements'),
      DESC('Cuéntanos sobre el directo o contenido más complejo que has realizado...', 'Describe un evento especial, stream benéfico o colaboración grande que hayas gestionado...'),
    ]
  },
  {
    id: 'coach',
    label: 'Coach',
    tag: 'COACH',
    desc: 'Acompaña a equipos y jugadores con herramientas avanzadas de análisis.',
    icon: 'users',
    active: false,
    repTitle: 'Datos del Entrenador',
    profileTitle: 'Perfil de Entrenador',
    expTitle: 'Experiencia como Coach',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Entrenadores y la Política de Privacidad.',
    experienceToggle: true,
    profileFields: [
      { id: 'coachName', label: 'Nombre del coach / nickname', placeholder: 'ej. CoachStephy' },
      PHOTO,
      { id: 'mainGame', type: 'games', label: 'Juegos de especialidad' },
      AVAILABILITY,
      RATE,
      SOCIAL('website', 'Red social más usada'),
    ],
    experienceFields: [
      YEARS('Años de experiencia entrenando'),
      SIZE('Roster más grande que has dirigido', ROSTER_SIZE_OPTIONS),
      TOOLS('Herramientas de análisis/estrategia que has usado (Ej: OP.GG, Valorant Tracker)', 'ej. OP.GG, Mobalytics, Tracker.gg'),
      DESC('Cuéntanos sobre el equipo o estrategia más compleja que has dirigido...', 'Describe una situación donde tu análisis de juego cambió el resultado de una partida o liga...'),
    ]
  },
  {
    id: 'caster',
    label: 'Caster',
    tag: 'CASTER',
    desc: 'Participa en transmisiones oficiales y eventos premium de la comunidad.',
    icon: 'play',
    active: false,
    repTitle: 'Datos del Narrador',
    profileTitle: 'Perfil de Caster/Narrador',
    expTitle: 'Experiencia de Casting',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Casters y la Política de Privacidad.',
    experienceToggle: true,
    profileFields: [
      { id: 'casterName', label: 'Nombre artístico / pseudónimo', placeholder: 'ej. StephyCaster' },
      PHOTO,
      { id: 'mainGame', type: 'games', label: 'Juegos que narras' },
      LANGS,
      AVAILABILITY,
      RATE,
      SOCIAL('website', 'Red social más usada', { placeholder: 'https://twitch.tv/…' }),
    ],
    experienceFields: [
      YEARS('Años de experiencia narrando'),
      SIZE('Mayor audiencia que has narrado', AUDIENCE_SIZE_OPTIONS),
      TOOLS('Herramientas o software de caster que usas (Ej: Voicemeeter, OBS)', 'ej. Voicemeeter Banana, OBS, Discord Audio'),
      DESC('Enlace a tu reel/demo y cuéntanos sobre el evento más complejo narrado...', 'Pega un enlace de YouTube/Twitch a tu demo de narración y cuéntanos tu experiencia...'),
    ]
  },
  {
    id: 'analyst',
    label: 'Analista',
    tag: 'ANALYST',
    desc: 'Apoya coberturas competitivas con análisis avanzados y estadísticas.',
    icon: 'trend',
    active: false,
    repTitle: 'Datos del Analista',
    profileTitle: 'Perfil de Analista',
    expTitle: 'Experiencia en Análisis',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Analistas y la Política de Privacidad.',
    experienceToggle: true,
    profileFields: [
      { id: 'analystName', label: 'Nombre / nickname del analista', placeholder: 'ej. StephyStats' },
      PHOTO,
      { id: 'specialty', type: 'games', label: 'Juegos que analizas' },
      AVAILABILITY,
      RATE,
      SOCIAL('website', 'Red social más usada', { placeholder: 'https://github.com/… o @usuario' }),
    ],
    experienceFields: [
      YEARS('Años de experiencia analizando'),
      SIZE('Mayor volumen que has analizado', ['1 equipo', '2 a 5 equipos', '6 a 15 equipos', 'Más de 15 equipos']),
      TOOLS('Herramientas de datos que usas (Ej: Excel, Python, Tableau)', 'ej. Excel avanzado, Python (pandas), Tableau'),
      DESC('Cuéntanos sobre el análisis o reporte más complejo que has realizado...', 'Describe un reporte de veto de mapas, análisis de oponentes o estadísticas de rendimiento...'),
    ]
  },
  {
    id: 'moderator',
    label: 'Moderador de Torneos',
    tag: 'MODERATOR',
    desc: 'Modera torneos como arbitro, produccion o soporte operativo del evento.',
    icon: 'shield',
    active: false,
    repTitle: 'Datos del Moderador',
    profileTitle: 'Perfil de Moderador / Arbitro / Produccion',
    expTitle: 'Experiencia en Operacion de Torneos',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Terminos de Servicio para Moderadores y la Politica de Privacidad.',
    experienceToggle: true,
    profileFields: [
      { id: 'moderatorName', label: 'Nombre público / nickname', placeholder: 'ej. ModStephy' },
      PHOTO,
      { id: 'specialty', type: 'multiselect', label: 'Especialidad', options: MODERATOR_SPECIALTIES },
      { id: 'mainGame', type: 'games', label: 'Juegos que puedes moderar' },
      LANGS,
      AVAILABILITY,
      RATE,
      SOCIAL('website', 'Red social más usada (Opcional)', { optional: true }),
    ],
    experienceFields: [
      YEARS('Años de experiencia moderando'),
      SIZE('Evento más grande en el que has trabajado', EVENT_SIZE_OPTIONS),
      TOOLS('Herramientas que manejas', 'ej. Discord, OBS, Challonge, Battlefy, Google Sheets'),
      DESC('Cuéntanos sobre una situación difícil que hayas moderado...', 'Describe una disputa, W.O., problema técnico o final que hayas gestionado.'),
    ]
  },
  {
    id: 'sponsor',
    label: 'Sponsor',
    tag: 'SPONSOR',
    desc: 'Conecta tu marca con torneos oficiales, equipos y activaciones.',
    icon: 'star',
    active: false,
    repTitle: 'Datos del Patrocinador',
    profileTitle: 'Perfil Corporativo',
    expTitle: 'Propuesta de Patrocinio',
    legalDisclaimer: 'Al enviar esta solicitud, aceptas nuestros Términos de Servicio para Patrocinadores y la Política de Pagos.',
    profileFields: [
      { id: 'companyName', label: 'Nombre de la empresa / marca', placeholder: 'ej. Steliant Corp' },
      { ...PHOTO, label: 'Logo (Opcional)' },
      { id: 'industry', type: 'select', label: 'Sector o industria', options: SPONSOR_INDUSTRIES },
      SOCIAL('website', 'Sitio web o red social de la marca', { placeholder: 'https://…' }),
    ],
    experienceFields: [
      { id: 'yearsExp', label: 'Años de la marca en el mercado', placeholder: 'ej. 5 años, 10 años' },
      { id: 'maxSize', label: 'Tamaño máximo de audiencia que buscas impactar', placeholder: 'ej. +10,000 jóvenes gamers' },
      { id: 'toolsUsed', label: 'Canales o plataformas que deseas patrocinar', placeholder: 'ej. Torneo Spring Split, Canales de Twitch oficiales' },
      DESC('Cuéntanos sobre tu propuesta y lo que buscas lograr patrocinando...', 'Describe los objetivos de visibilidad de marca, activaciones y el alcance esperado...'),
    ]
  }
]

