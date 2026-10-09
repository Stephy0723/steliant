// Opciones de los campos estructurados de los formularios de rol (solicitud de
// rol y perfil profesional). Compartido por RoleFieldInput y roleFieldCodec.

// Monedas para tarifas: la comunidad cobra en monedas muy distintas.
export const CURRENCIES = [
  { code: 'USD', label: 'USD — Dólar estadounidense' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'DOP', label: 'DOP — Peso dominicano' },
  { code: 'MXN', label: 'MXN — Peso mexicano' },
  { code: 'COP', label: 'COP — Peso colombiano' },
  { code: 'ARS', label: 'ARS — Peso argentino' },
  { code: 'CLP', label: 'CLP — Peso chileno' },
  { code: 'UYU', label: 'UYU — Peso uruguayo' },
  { code: 'VES', label: 'VES — Bolívar venezolano' },
  { code: 'PEN', label: 'PEN — Sol peruano' },
  { code: 'BOB', label: 'BOB — Boliviano' },
  { code: 'BRL', label: 'BRL — Real brasileño' },
  { code: 'CRC', label: 'CRC — Colón costarricense' },
  { code: 'GTQ', label: 'GTQ — Quetzal guatemalteco' },
  { code: 'HNL', label: 'HNL — Lempira hondureño' },
  { code: 'PYG', label: 'PYG — Guaraní paraguayo' },
]

export const RATE_UNITS = ['hora', 'evento', 'día', 'semana', 'mes']

export const RATE_MODES = [
  { id: 'fixed', label: 'Monto o rango' },
  { id: 'negotiable', label: 'Negociable' },
  { id: 'free', label: 'Gratis (para ganar experiencia)' },
]

// Franjas horarias rapidas. "Día completo" y "Flexible" reemplazan al resto.
export const SCHEDULE_PRESETS = [
  { id: 'Mañana', hint: '6 am – 12 pm' },
  { id: 'Tarde', hint: '12 pm – 6 pm' },
  { id: 'Noche', hint: '6 pm – 12 am' },
  { id: 'Madrugada', hint: '12 am – 6 am' },
  { id: 'Fines de semana', hint: 'Sáb y dom' },
  { id: 'Día completo', hint: 'Todo el día', exclusive: true },
  { id: 'Flexible', hint: 'A convenir', exclusive: true },
]

export const WEEK_DAYS = [
  { id: 'Lun', label: 'Lunes' },
  { id: 'Mar', label: 'Martes' },
  { id: 'Mié', label: 'Miércoles' },
  { id: 'Jue', label: 'Jueves' },
  { id: 'Vie', label: 'Viernes' },
  { id: 'Sáb', label: 'Sábado' },
  { id: 'Dom', label: 'Domingo' },
]

export const TIMEZONES = [
  { id: 'GMT-8', label: 'GMT-8 (California, Baja California)' },
  { id: 'GMT-6', label: 'GMT-6 (México, Centroamérica)' },
  { id: 'GMT-5', label: 'GMT-5 (Colombia, Perú, Ecuador, Panamá)' },
  { id: 'GMT-4', label: 'GMT-4 (R. Dominicana, Venezuela, Bolivia, Puerto Rico)' },
  { id: 'GMT-3', label: 'GMT-3 (Argentina, Uruguay, Chile, Brasil)' },
  { id: 'GMT+0', label: 'GMT+0 (Portugal, Reino Unido)' },
  { id: 'GMT+1', label: 'GMT+1 (España, Europa central)' },
]

export const SOCIAL_PLATFORMS = [
  'Twitch', 'YouTube', 'Kick', 'TikTok', 'Instagram', 'X (Twitter)', 'Facebook', 'Discord', 'LinkedIn', 'Sitio web', 'Otra',
]

export const LANGUAGES = ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Otro']

// Valor que se guarda en `yearsExp` cuando la persona indica que aun no tiene
// experiencia en el rol (para que nadie tenga que inventarla).
export const NO_EXPERIENCE = 'Sin experiencia'

export const YEARS_EXP_OPTIONS = [
  'Menos de 1 año', '1 a 2 años', '3 a 5 años', 'Más de 5 años',
]

export const AUDIENCE_SIZE_OPTIONS = [
  'Hasta 50 personas', '50 a 500 personas', '500 a 5,000 personas', 'Más de 5,000 personas',
]

export const EVENT_SIZE_OPTIONS = [
  'Hasta 8 equipos', '9 a 16 equipos', '17 a 32 equipos', '33 a 64 equipos', 'Más de 64 equipos',
]

export const ROSTER_SIZE_OPTIONS = [
  'Un solo jugador', 'Roster de 2 a 5', 'Roster de 6 a 10', 'Varios rosters a la vez',
]

export const MODERATOR_SPECIALTIES = [
  'Árbitro', 'Producción', 'Moderación de Discord', 'Soporte operativo', 'Resolución de disputas',
]

export const EVENT_TYPES = ['Torneos online', 'Torneos presenciales', 'Ligas', 'Copas por temporada', 'Eventos híbridos', 'Scrims / amistosos']

export const CREATOR_PLATFORMS = ['Twitch', 'YouTube', 'Kick', 'TikTok', 'Instagram', 'X (Twitter)', 'Facebook Gaming', 'Otra']

export const SPONSOR_INDUSTRIES = ['Tecnología', 'Periféricos y hardware', 'Bebidas y alimentos', 'Ropa y accesorios', 'Telecomunicaciones', 'Finanzas', 'Educación', 'Entretenimiento', 'Otra']

