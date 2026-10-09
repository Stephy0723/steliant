import { getUniversityAllowedDomains } from './universityVerificationRules.js'
import { gameKeyOf, gameName } from '../../../shared/games.mjs'

// Juegos de la competencia universitaria (ids de shared/games.mjs). Incluye
// las disciplinas de la Copa Universitaria Popular (FC, NBA 2K, LoL, Smash,
// Valorant, MLBB). Antes era una lista de NOMBRES comparada al pie de la letra:
// "Mobile Legends: Bang Bang", "League of Legends: Wild Rift" o "EA Sports FC 25"
// (los nombres del catalogo) no pasaban y esos equipos/torneos desaparecian
// del perfil de la universidad y del ranking.
const UNIVERSITY_GAME_IDS = [
  'valorant', 'league-of-legends', 'mobile-legends-bang-bang', 'league-of-legends-wild-rift',
  'rocket-league', 'ea-sports-fc-25', 'super-smash-bros-ultimate', 'nba-2k',
]
const UNIVERSITY_ALLOWED_KEYS = new Set(UNIVERSITY_GAME_IDS)
const UNIVERSITY_ALLOWED_GAMES = new Set(UNIVERSITY_GAME_IDS.map(id => gameName(id)))

const isUniversityGameAllowed = (game = '') => UNIVERSITY_ALLOWED_KEYS.has(gameKeyOf(game))

// Guarda el nombre canonico del catalogo ("Wild Rift" -> "League of Legends:
// Wild Rift") para que coincida con las opciones del panel de admin.
const sanitizeGames = (games = []) =>
  Array.from(new Set(
    (Array.isArray(games) ? games : [])
      .map((g) => String(g || '').trim())
      .filter((g) => g && isUniversityGameAllowed(g))
      .map((g) => gameName(gameKeyOf(g)) || g)
  ))

// ─── Campuses por universidad ─────────────────────────────────────────────────

const UNIVERSITY_CAMPUSES = {
  uasd:      ['Santo Domingo', 'Santiago de los Caballeros', 'San Francisco de Macorís', 'La Romana', 'Puerto Plata', 'San Juan de la Maguana', 'Barahona', 'Bonao', 'Hato Mayor', 'Higüey', 'Mao', 'Nagua', 'Neyba', 'San Cristóbal'],
  pucmm:     ['Santiago de los Caballeros', 'Santo Domingo'],
  intec:     ['Santo Domingo'],
  unibe:     ['Santo Domingo'],
  itla:      ['Santo Domingo Este'],
  unapec:    ['Santo Domingo'],
  unphu:     ['Santo Domingo'],
  utesa:     ['Santiago de los Caballeros', 'Santo Domingo', 'Puerto Plata', 'Moca', 'Dajabón', 'Mao'],
  uapa:      ['Santiago de los Caballeros', 'Santo Domingo'],
  ucne:      ['San Francisco de Macorís'],
  isfodosu:  ['Santo Domingo', 'Santiago de los Caballeros', 'San Juan de la Maguana', 'San Pedro de Macorís', 'San Francisco de Macorís'],
  itsc:      ['Santo Domingo Este'],
  ucateci:   ['La Vega'],
  uniremhos: ['Santo Domingo'],
  unicaribe: ['Santo Domingo'],
  oym:       ['Santo Domingo', 'Santiago de los Caballeros', 'Puerto Plata', 'La Romana', 'Moca', 'San Francisco de Macorís'],
  uce:       ['San Pedro de Macorís'],
  ufhec:     ['Santo Domingo', 'Baní', 'La Romana', 'Moca'],
  ucsd:      ['Santo Domingo'],
  loyola:    ['San Cristóbal'],
}

// ─── Carreras por universidad ─────────────────────────────────────────────────

const UNIVERSITY_PROGRAMS = {
  uasd:      ['Ingenieria en Sistemas', 'Ingenieria Industrial', 'Ingenieria Civil', 'Arquitectura', 'Medicina', 'Administracion de Empresas', 'Contabilidad', 'Derecho'],
  pucmm:     ['Administracion de Empresas', 'Administracion Hotelera', 'Arquitectura', 'Comunicacion Social', 'Derecho', 'Diseno e Interiorismo', 'Ecologia y Gestion Ambiental', 'Economia', 'Educacion', 'Estomatologia', 'Filosofia', 'Gestion Financiera', 'Ingenieria Civil', 'Ingenieria Electromecanica', 'Ingenieria Electronica', 'Ingenieria Industrial', 'Ingenieria en Sistemas y Computacion', 'Ingenieria Mecatronica', 'Ingenieria Telematica', 'Medicina', 'Mercadotecnia', 'Nutricion y Dietetica', 'Psicologia', 'Terapia Fisica'],
  intec:     ['Ingenieria Civil', 'Ingenieria de Software', 'Ingenieria Electrica', 'Ingenieria Electronica y de Comunicaciones', 'Ingenieria Industrial', 'Ingenieria Mecanica', 'Ingenieria Mecatronica', 'Ingenieria en Ciberseguridad', 'Ingenieria en Sistemas', 'Administracion y Gestion de Negocios', 'Contabilidad y Auditoria Empresarial', 'Economia', 'Mercadeo y Negocios Electronicos', 'Negocios Internacionales', 'Diseno Industrial', 'Ciencia de Datos', 'Ciberseguridad', 'Biotecnologia', 'Doctor en Medicina', 'Doctor en Odontologia', 'Cine y Comunicacion Audiovisual', 'Medios Digitales y Comunicacion Social', 'Psicologia'],
  unibe:     ['Direccion y Gestion Empresarial', 'Direccion y Gestion del Turismo', 'Arquitectura', 'Comunicacion', 'Diseno', 'Ingenieria Civil', 'Ingenieria en Tecnologias Computacionales', 'Derecho', 'Medicina', 'Odontologia', 'Psicologia', 'Educacion Inicial'],
  itla:      ['Desarrollo de Software', 'Redes de Informacion', 'Ciberseguridad', 'Multimedia', 'Mecatronica', 'Analitica y Ciencia de Datos'],
  unapec:    ['Administracion de Empresas', 'Administracion Turistica y Hotelera', 'Contabilidad', 'Comunicacion Digital', 'Derecho', 'Negocios Internacionales', 'Diseno Grafico', 'Diseno de Interiores', 'Economia y Ciencia de Datos', 'Finanzas', 'Gastronomia y Artes Culinarias', 'Gestion de Operaciones y Logistica', 'Ingenieria de Sistemas de Computacion', 'Ingenieria de Software', 'Ingenieria Industrial', 'Ingenieria Electrica', 'Ingenieria Electronica', 'Mercadeo', 'Periodismo Contemporaneo', 'Psicologia Organizacional', 'Publicidad'],
  unphu:     ['Arquitectura y Urbanismo', 'Diseno de Interiores', 'Ingenieria Civil', 'Ingenieria Industrial', 'Ingenieria Quimica', 'Ingenieria en Sistemas', 'Medicina Veterinaria', 'Medicina', 'Odontologia', 'Administracion de Empresas', 'Administracion de Mercados', 'Contabilidad y Auditoria', 'Derecho', 'Psicologia'],
  utesa:     ['Ingenieria en Sistemas', 'Medicina', 'Odontologia', 'Administracion de Empresas', 'Contabilidad', 'Derecho'],
  uapa:      ['Ingenieria en Software', 'Administracion de Empresas', 'Contabilidad', 'Mercadeo', 'Psicologia', 'Derecho'],
  ucne:      ['Medicina', 'Odontologia', 'Ingenieria en Sistemas', 'Administracion de Empresas', 'Contabilidad', 'Derecho'],
  isfodosu:  ['Licenciatura en Educacion Primaria', 'Licenciatura en Educacion Secundaria', 'Lengua Espanola y Literatura', 'Matematica', 'Ciencias Sociales', 'Biologia Orientada a la Educacion'],
  itsc:      ['Desarrollo de Software', 'Soporte Tecnico', 'Administracion de Redes', 'Diseno Digital', 'Logistica', 'Mecatronica'],
  ucateci:   ['Ingenieria en Sistemas', 'Administracion de Empresas', 'Contabilidad', 'Derecho', 'Mercadeo', 'Arquitectura'],
  uniremhos: ['Medicina', 'Odontologia', 'Administracion de Empresas', 'Mercadeo', 'Psicologia', 'Derecho'],
  unicaribe: ['Ingenieria en Sistemas', 'Administracion de Empresas', 'Contabilidad', 'Mercadeo', 'Derecho', 'Psicologia'],
  oym:       ['Ingenieria en Sistemas', 'Administracion de Empresas', 'Contabilidad', 'Mercadeo', 'Derecho', 'Psicologia'],
  uce:       ['Medicina', 'Odontologia', 'Ingenieria en Sistemas', 'Administracion de Empresas', 'Contabilidad', 'Derecho'],
  ufhec:     ['Ingenieria en Sistemas', 'Administracion de Empresas', 'Contabilidad', 'Mercadeo', 'Derecho', 'Arquitectura'],
  ucsd:      ['Ingenieria en Sistemas', 'Administracion de Empresas', 'Mercadeo', 'Derecho', 'Psicologia', 'Educacion'],
  loyola:    ['Ingenieria en Redes', 'Ingenieria Industrial', 'Desarrollo de Software', 'Mecatronica', 'Electromecanica', 'Agronomia'],
}

const getCampuses = (id = '', fallbackCity = '') => {
  const list     = UNIVERSITY_CAMPUSES[String(id).trim().toLowerCase()] || []
  const fallback = String(fallbackCity || '').trim()
  const items    = list.length > 0 ? list : (fallback ? [fallback] : [])
  return Array.from(new Set(items.map((c) => String(c).trim()).filter(Boolean)))
}

const getPrograms = (id = '') =>
  Array.from(new Set(
    (UNIVERSITY_PROGRAMS[String(id).trim().toLowerCase()] || [])
      .map((p) => String(p).trim())
      .filter(Boolean)
  ))

// ─── Catálogo — datos reales de universidades dominicanas ────────────────────
// logo:    logo oficial en frontend/public/universities (PNG cuadrado 256px)
// verified: false → ninguna universidad está marcada como socia oficial todavía
// bio y offers: información real, puede editarse cuando la universidad confirme datos

export const UNIVERSITY_CATALOG_RD = [
  {
    id: 'uasd', tag: 'UASD', name: 'Universidad Autónoma de Santo Domingo',
    region: 'rd', city: 'Santo Domingo', founded: 1538,
    logo: '/universities/uasd.png', color: '#002D72', verified: false,
    bio: 'La universidad más antigua de América, fundada en 1538. Más de 200,000 estudiantes activos.',
    games: ['Valorant', 'League of Legends', 'Mobile Legends', 'Wild Rift'],
    offers: [],
  },
  {
    id: 'pucmm', tag: 'PUCMM', name: 'Pontificia Universidad Católica Madre y Maestra',
    region: 'rd', city: 'Santiago', founded: 1962,
    logo: '/universities/pucmm.png', color: '#6B1717', verified: false,
    bio: 'Fundada en 1962, una de las mejores universidades privadas del Caribe. Campus en Santiago y Santo Domingo.',
    games: ['Valorant', 'League of Legends', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'intec', tag: 'INTEC', name: 'Instituto Tecnológico de Santo Domingo',
    region: 'rd', city: 'Santo Domingo', founded: 1972,
    logo: '/universities/intec.png', color: '#004FA3', verified: false,
    bio: 'Centro de excelencia en ingeniería y tecnología desde 1972.',
    games: ['Valorant', 'League of Legends', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'unibe', tag: 'UNIBE', name: 'Universidad Iberoamericana',
    region: 'rd', city: 'Santo Domingo', founded: 1982,
    logo: '/universities/unibe.png', color: '#003366', verified: false,
    bio: 'Universidad de élite fundada en 1982.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'itla', tag: 'ITLA', name: 'Instituto Tecnológico de Las Américas',
    region: 'rd', city: 'Santo Domingo Este', founded: 2000,
    logo: '/universities/itla.png', color: '#006633', verified: false,
    bio: 'Principal centro tecnológico del gobierno dominicano.',
    games: ['Valorant', 'League of Legends', 'Mobile Legends', 'Wild Rift'],
    offers: [],
  },
  {
    id: 'unapec', tag: 'UNAPEC', name: 'Universidad APEC',
    region: 'rd', city: 'Santo Domingo', founded: 1965,
    logo: '/universities/unapec.png', color: '#CC2200', verified: false,
    bio: 'Fundada en 1965 por la Acción Pro Educación y Cultura.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'unphu', tag: 'UNPHU', name: 'Universidad Nacional Pedro Henríquez Ureña',
    region: 'rd', city: 'Santo Domingo', founded: 1966,
    logo: '/universities/unphu.png', color: '#004422', verified: false,
    bio: 'Fundada en 1966. Campus extenso con áreas deportivas y espacios de innovación.',
    games: ['Valorant', 'League of Legends'],
    offers: [],
  },
  {
    id: 'utesa', tag: 'UTESA', name: 'Universidad Tecnológica de Santiago',
    region: 'rd', city: 'Santiago', founded: 1974,
    logo: '/universities/utesa.png', color: '#003388', verified: false,
    bio: 'Fundada en 1974 en Santiago. Una de las universidades con mayor matrícula del país.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'uapa', tag: 'UAPA', name: 'Universidad Abierta para Adultos',
    region: 'rd', city: 'Santiago', founded: 1991,
    logo: '/universities/uapa.png', color: '#CC0022', verified: false,
    bio: 'Pionera en educación a distancia en RD desde 1991.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'ucne', tag: 'UCNE', name: 'Universidad Católica Nordestana',
    region: 'rd', city: 'San Fco. de Macorís', founded: 1978,
    logo: '/universities/ucne.png', color: '#002277', verified: false,
    bio: 'Fundada en 1978 en San Francisco de Macorís. Principal centro universitario de la región nordeste.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'isfodosu', tag: 'ISFODOSU', name: 'Instituto Superior de Formación Docente Salomé Ureña',
    region: 'rd', city: 'Santo Domingo', founded: 2003,
    logo: '/universities/isfodosu.png', color: '#8B4513', verified: false,
    bio: 'Institución estatal dedicada a la formación de docentes desde 2003. Múltiples recintos nacionales.',
    games: ['League of Legends', 'Valorant'],
    offers: [],
  },
  {
    id: 'itsc', tag: 'ITSC', name: 'Instituto Técnico Superior Comunitario',
    region: 'rd', city: 'San Pedro de Macorís', founded: 2012,
    logo: '/universities/itsc.png', color: '#005599', verified: false,
    bio: 'Centro técnico fundado en 2012 en San Pedro de Macorís.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'ucateci', tag: 'UCATECI', name: 'Universidad Católica del Cibao',
    region: 'rd', city: 'La Vega', founded: 1983,
    logo: '/universities/ucateci.png', color: '#007744', verified: false,
    bio: 'Fundada en 1983 en La Vega. Fuerte presencia en la región del Cibao.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'uniremhos', tag: 'UNIREMHOS', name: 'Universidad Eugenio María de Hostos',
    region: 'rd', city: 'Santo Domingo', founded: 1981,
    logo: '/universities/uniremhos.png', color: '#3A006F', verified: false,
    bio: 'Fundada en 1981, nombrada en honor al educador puertorriqueño Eugenio María de Hostos.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'unicaribe', tag: 'UNICARIBE', name: 'Universidad del Caribe',
    region: 'rd', city: 'Santo Domingo', founded: 1995,
    logo: '/universities/unicaribe.png', color: '#006B8F', verified: false,
    bio: 'Institución fundada en 1995 con enfoque en accesibilidad educativa.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'oym', tag: 'O&M', name: 'Universidad Organización y Método',
    region: 'rd', city: 'Santo Domingo', founded: 1966,
    logo: '/universities/oym.png', color: '#AA1111', verified: false,
    bio: 'Una de las universidades más populares de RD, fundada en 1966.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'uce', tag: 'UCE', name: 'Universidad Central del Este',
    region: 'rd', city: 'San Pedro de Macorís', founded: 1970,
    logo: '/universities/uce.png', color: '#006644', verified: false,
    bio: 'Fundada en 1970 en San Pedro de Macorís. Reconocida por su facultad de medicina.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'ufhec', tag: 'UFHEC', name: 'Universidad Federico Henríquez y Carvajal',
    region: 'rd', city: 'Santo Domingo', founded: 2003,
    logo: '/universities/ufhec.png', color: '#880022', verified: false,
    bio: 'Institución joven fundada en 2003 con visión moderna.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
  {
    id: 'ucsd', tag: 'UCSD', name: 'Universidad Católica Santo Domingo',
    region: 'rd', city: 'Santo Domingo', founded: 1982,
    logo: '/universities/ucsd.png', color: '#0044AA', verified: false,
    bio: 'Universidad católica fundada en 1982 por la Arquidiócesis de Santo Domingo.',
    games: ['Valorant', 'League of Legends'],
    offers: [],
  },
  {
    id: 'loyola', tag: 'LOYOLA', name: 'Instituto Politécnico Loyola',
    region: 'rd', city: 'San Cristóbal', founded: 1952,
    logo: '/universities/loyola.png', color: '#660000', verified: false,
    bio: 'El más antiguo politécnico del país, fundado en 1952 por los Padres Jesuitas en San Cristóbal.',
    games: ['Valorant', 'Mobile Legends'],
    offers: [],
  },
]

// ─── Funciones de acceso ──────────────────────────────────────────────────────

const enrichItem = (item) => ({
  ...item,
  games:          sanitizeGames(item.games),
  programs:       getPrograms(item.id),
  campuses:       getCampuses(item.id, item.city),
  allowedDomains: getUniversityAllowedDomains(item.id),
})

export const getUniversityCatalogByRegion = (region = 'rd') => {
  if (String(region || 'rd').trim().toLowerCase() !== 'rd') return []
  return UNIVERSITY_CATALOG_RD.map(enrichItem)
}

export const getUniversityCatalogItem = (universityId = '') => {
  const id    = String(universityId || '').trim().toLowerCase()
  if (!id) return null
  const found = UNIVERSITY_CATALOG_RD.find((item) => String(item.id || '').trim().toLowerCase() === id)
  return found ? enrichItem(found) : null
}

export const UNIVERSITY_ALLOWED_GAMES_LIST = Array.from(UNIVERSITY_ALLOWED_GAMES)

export { isUniversityGameAllowed, sanitizeGames }
