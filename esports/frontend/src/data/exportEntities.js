// ════════════════════════════════════════════════════════════
//  Registro de entidades exportables del Centro de Exportación
//  Inteligente. Define para CADA tipo de reporte: campos
//  disponibles, columnas por defecto, agrupaciones para gráficas
//  y texto ejecutivo automático.
//
//  Todos los datos son reales: jugadores/equipos/torneos salen del
//  censo admin (/admin/census, /admin/teams, /admin/tournaments) y
//  el resto de GET /admin/export/:entity (ver adminExport.controller.js).
//  Antes 10 de los 13 tipos generaban filas inventadas.
// ════════════════════════════════════════════════════════════
import { PLAYER_EXPORT_FIELDS } from '../lib/playerExport.js'
import { TEAM_EXPORT_FIELDS } from '../lib/teamExport.js'
import { TOURNAMENT_EXPORT_FIELDS } from '../lib/tournamentExport.js'

const f = (key, label, section = 'Datos', get = (r) => r[key]) => ({ key, label, section, get })
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ORG_FIELDS = [
  f('id', 'ID', 'Identificadores'), f('name', 'Nombre'),
  f('owner', 'Responsable', 'Contacto'), f('email', 'Email', 'Contacto'),
  f('admins', 'Admins adicionales', 'Métricas'), f('tournaments', 'Torneos', 'Métricas'),
  f('discord', 'Servidor de Discord', 'Integraciones'), f('whatsapp', 'WhatsApp', 'Integraciones'),
  f('status', 'Estado'), f('created', 'Registro'),
]
const UNI_FIELDS = [
  f('id', 'Siglas', 'Identificadores'), f('name', 'Universidad'),
  f('region', 'Región', 'Ubicación'), f('city', 'Ciudad', 'Ubicación'), f('campuses', 'Campus', 'Ubicación'),
  f('students', 'Estudiantes verificados', 'Métricas'), f('teams', 'Equipos universitarios', 'Métricas'),
]
const STAFF_FIELDS = [
  f('id', 'ID público', 'Identificadores'), f('internalId', 'ID interno', 'Identificadores'),
  f('name', 'Nick'), f('realName', 'Nombre'), f('role', 'Rol'),
  f('email', 'Email', 'Contacto'), f('country', 'País', 'Ubicación'),
  f('status', 'Estado'), f('joined', 'Ingreso'),
]
const CASTER_FIELDS = [
  f('id', 'ID de caster', 'Identificadores'), f('internalId', 'ID interno', 'Identificadores'),
  f('name', 'Caster'), f('realName', 'Nombre'), f('games', 'Juegos'), f('country', 'País', 'Ubicación'),
  f('broadcasts', 'Torneos asignados', 'Métricas'), f('email', 'Email', 'Contacto'), f('status', 'Estado'),
]
const REF_FIELDS = [
  f('id', 'ID de jugador', 'Identificadores'), f('name', 'Árbitro'), f('games', 'Juegos'),
  f('tournaments', 'Torneos dirigidos', 'Métricas'), f('tournamentList', 'Torneos', 'Métricas'),
]
const SPONSOR_FIELDS = [
  f('id', 'ID público', 'Identificadores'), f('internalId', 'ID interno', 'Identificadores'),
  f('name', 'Marca'), f('industry', 'Industria'), f('tier', 'Nivel'),
  f('campaigns', 'Campañas', 'Métricas'), f('impressions', 'Impresiones', 'Métricas'),
  f('contact', 'Contacto', 'Contacto'), f('email', 'Email', 'Contacto'),
  f('status', 'Estado'), f('since', 'Desde'),
]
const FORM_FIELDS = [
  f('id', 'ID', 'Identificadores'), f('title', 'Solicitud'), f('type', 'Tipo'),
  f('submittedBy', 'Enviado por', 'Contacto'), f('status', 'Estado'), f('date', 'Fecha'),
]
const FINANCE_FIELDS = [
  f('id', 'Comprobante', 'Identificadores'), f('concept', 'Concepto'), f('type', 'Tipo'),
  f('amount', 'Monto', 'Métricas', r => money(r.amount)), f('itbis', 'ITBIS incluido (18%)', 'Métricas', r => money(r.itbis)),
  f('currency', 'Moneda', 'Pago'), f('method', 'Método', 'Pago'), f('mode', 'Modo', 'Pago'),
  f('user', 'Usuario', 'Contacto'), f('status', 'Estado'), f('date', 'Fecha'),
]

const firstCols = (fields, n = 7) => fields.slice(0, n).map(x => x.key)

// ════════ Registro principal ════════
// iconKey → se resuelve con Icon[iconKey] en la página.
export const EXPORT_ENTITIES = {
  jugadores: {
    key: 'jugadores', label: 'Jugadores', iconKey: 'users', group: 'Personas', code: 'PLY',
    fields: PLAYER_EXPORT_FIELDS,
    defaultColumns: ['nick', 'realName', 'country', 'mainGame', 'level', 'status', 'verified'],
    statGroups: [
      { label: 'Por país', get: p => p.countryName || p.country },
      { label: 'Por juego', get: p => p.mainGame },
    ],
    identify: p => ({ id: p.id, title: p.nick, sub: `${p.realName} · ${p.mainGame}`, img: p.avatar }),
    intro: {
      title: 'Reporte ejecutivo de jugadores',
      body: 'El presente documento consolida la base de jugadores registrados en la plataforma GlitchGang, incluyendo su identidad, datos de contacto, perfil competitivo, pertenencias e identificadores oficiales. Constituye una herramienta de análisis para la toma de decisiones del área deportiva, comercial y de operaciones, permitiendo evaluar el crecimiento de la comunidad, la distribución geográfica y por título, así como el estado de verificación de cada cuenta. La información refleja el estado del sistema al momento de la generación y se encuentra sujeta a las políticas de confidencialidad y protección de datos de la organización.',
    },
    live: true,
  },
  equipos: {
    key: 'equipos', label: 'Equipos', iconKey: 'team', group: 'Competitivo', code: 'TEAM',
    fields: TEAM_EXPORT_FIELDS,
    defaultColumns: ['uid', 'name', 'tag', 'region', 'level', 'captain', 'status'],
    statGroups: [
      { label: 'Por juego', get: t => t.region || t.game },
      { label: 'Por estado', get: t => t.status },
    ],
    identify: t => ({ id: t.id, title: t.name, sub: `[${t.tag}] · ${t.game || t.region}`, img: t.logo || null }),
    intro: {
      title: 'Reporte ejecutivo de equipos',
      body: 'Este informe presenta el registro completo de equipos competitivos de GlitchGang, detallando su composición (capitán, staff, titulares y suplentes), identificadores oficiales, categoría y estado. Está orientado a la gestión deportiva y a la verificación de rosters de cara a competencias oficiales, facilitando auditorías de elegibilidad y el seguimiento del ecosistema competitivo de la plataforma.',
    },
    live: true,
  },
  torneos: {
    key: 'torneos', label: 'Torneos', iconKey: 'trophy', group: 'Competitivo', code: 'TRN',
    fields: TOURNAMENT_EXPORT_FIELDS,
    defaultColumns: ['uid', 'name', 'game', 'organizer', 'startDate', 'prize', 'status'],
    statGroups: [
      { label: 'Por juego', get: t => t.game },
      { label: 'Por estado', get: t => t.status },
    ],
    identify: t => ({ id: t.id, title: t.name, sub: `${t.game} · ${t.uid || t.publicId || ''}`, img: null }),
    intro: {
      title: 'Reporte ejecutivo de torneos',
      body: 'El documento recopila la actividad de torneos gestionados a través de la plataforma GlitchGang, incluyendo formato, premiación, organizador, participación y estado de cada competencia. Sirve como soporte para la planificación del calendario competitivo, el análisis de premiación y la rendición de cuentas ante patrocinadores y aliados estratégicos.',
    },
    live: true,
  },
  organizaciones: {
    key: 'organizaciones', label: 'Organizaciones', iconKey: 'shield', group: 'Ecosistema', code: 'ORG', remote: true,
    fields: ORG_FIELDS, defaultColumns: firstCols(ORG_FIELDS),
    statGroups: [{ label: 'Por estado', get: r => r.status }, { label: 'Por WhatsApp', get: r => r.whatsapp }],
    identify: r => ({ id: r.id, title: r.name, sub: `${r.owner} · ${r.tournaments} torneos`, img: null }),
    intro: { title: 'Reporte ejecutivo de organizaciones', body: 'Consolidado de las organizaciones (servidores de Discord y grupos de WhatsApp) que operan torneos a través de GlitchGang: responsable, integraciones conectadas y volumen de torneos vinculados.' },
  },
  universidades: {
    key: 'universidades', label: 'Universidades', iconKey: 'award', group: 'Ecosistema', code: 'UNI', remote: true,
    fields: UNI_FIELDS, defaultColumns: firstCols(UNI_FIELDS),
    statGroups: [{ label: 'Por región', get: r => r.region }, { label: 'Por ciudad', get: r => r.city }],
    identify: r => ({ id: r.id, title: r.name, sub: `${r.city} · ${r.students} estudiantes`, img: null }),
    intro: { title: 'Reporte ejecutivo universitario', body: 'Informe del programa universitario de esports de GlitchGang: instituciones con estudiantes verificados (cuenta institucional Microsoft o validación del staff) y sus equipos universitarios registrados.' },
  },
  staff: {
    key: 'staff', label: 'Staff', iconKey: 'gear', group: 'Personas', code: 'STF', remote: true,
    fields: STAFF_FIELDS, defaultColumns: firstCols(STAFF_FIELDS),
    statGroups: [{ label: 'Por rol', get: r => r.role }, { label: 'Por país', get: r => r.country }],
    identify: r => ({ id: r.id, title: r.name, sub: `${r.role} · ${r.email}`, img: null }),
    intro: { title: 'Reporte ejecutivo de staff', body: 'Directorio del personal con acceso administrativo de GlitchGang (administradores y moderadores), con datos de contacto y estado. Documento de uso interno para la gestión y auditoría de accesos.' },
  },
  casters: {
    key: 'casters', label: 'Casters', iconKey: 'tv', group: 'Personas', code: 'CAS', remote: true,
    fields: CASTER_FIELDS, defaultColumns: firstCols(CASTER_FIELDS),
    statGroups: [{ label: 'Por país', get: r => r.country }, { label: 'Por estado', get: r => r.status }],
    identify: r => ({ id: r.id, title: r.name, sub: `${r.games} · ${r.broadcasts} torneos`, img: null }),
    intro: { title: 'Reporte ejecutivo de casters', body: 'Casters aprobados en GlitchGang con sus juegos y la cantidad de torneos a los que están asignados actualmente.' },
  },
  arbitros: {
    key: 'arbitros', label: 'Árbitros', iconKey: 'target', group: 'Competitivo', code: 'ARB', remote: true,
    fields: REF_FIELDS, defaultColumns: firstCols(REF_FIELDS),
    statGroups: [{ label: 'Por juego', get: r => r.games }],
    identify: r => ({ id: r.id, title: r.name, sub: `${r.tournaments} torneos`, img: null }),
    intro: { title: 'Reporte ejecutivo de arbitraje', body: 'Árbitros aceptados como staff en torneos de GlitchGang y los torneos que han dirigido. Soporte para la integridad competitiva y la trazabilidad de decisiones.' },
  },
  sponsors: {
    key: 'sponsors', label: 'Sponsors', iconKey: 'gem', group: 'Comercial', code: 'SPN', remote: true,
    fields: SPONSOR_FIELDS, defaultColumns: firstCols(SPONSOR_FIELDS),
    statGroups: [{ label: 'Por industria', get: r => r.industry }, { label: 'Por nivel', get: r => r.tier }],
    identify: r => ({ id: r.id, title: r.name, sub: `${r.industry} · ${r.tier}`, img: null }),
    intro: { title: 'Reporte ejecutivo de patrocinios', body: 'Cartera de marcas patrocinadoras de GlitchGang con su nivel, campañas registradas e impresiones acumuladas, para la gestión comercial y la rendición de resultados a las marcas.' },
  },
  formularios: {
    key: 'formularios', label: 'Formularios', iconKey: 'fileText', group: 'Operaciones', code: 'FRM', remote: true,
    fields: FORM_FIELDS, defaultColumns: firstCols(FORM_FIELDS),
    statGroups: [{ label: 'Por tipo', get: r => r.type }, { label: 'Por estado', get: r => r.status }],
    identify: r => ({ id: r.id, title: r.title, sub: `${r.type} · ${r.status}`, img: null }),
    intro: { title: 'Reporte de formularios y solicitudes', body: 'Solicitudes recibidas por la plataforma (roles, organizaciones, juegos nuevos y publicidad) con su estado de gestión, para la trazabilidad de procesos y tiempos de respuesta.' },
  },
  financieros: {
    key: 'financieros', label: 'Datos financieros', iconKey: 'creditCard', group: 'Comercial', code: 'FIN', remote: true,
    fields: FINANCE_FIELDS, defaultColumns: firstCols(FINANCE_FIELDS),
    statGroups: [{ label: 'Por tipo', get: r => r.type }, { label: 'Por estado', get: r => r.status }],
    identify: r => ({ id: r.id, title: r.concept, sub: `${r.type} · ${money(r.amount)}`, img: null }),
    intro: { title: 'Reporte financiero', body: 'Pagos procesados por GlitchGang (planes e inscripciones de torneo) con su ITBIS incluido, método, modo (real o demo) y estado. Documento confidencial para conciliación y auditoría.' },
  },
}

export const ENTITY_LIST = Object.values(EXPORT_ENTITIES)

// ── Secciones disponibles para el constructor (Drag & Drop) ──
export const SECTION_LIBRARY = [
  { key: 'portada', label: 'Portada', icon: 'star', fixed: true, desc: 'Carátula corporativa con identidad y metadatos.' },
  { key: 'resumen', label: 'Resumen ejecutivo', icon: 'fileText', desc: 'Página introductoria redactada automáticamente.' },
  { key: 'estadisticas', label: 'Estadísticas', icon: 'chartBar', desc: 'KPIs y totales del conjunto seleccionado.' },
  { key: 'graficos', label: 'Gráficos', icon: 'trend', desc: 'Distribuciones por categoría en barras.' },
  { key: 'fichas', label: 'Fichas individuales', icon: 'user', desc: 'Una página por registro con todos sus datos e imagen.' },
  { key: 'tabla', label: 'Tabla de datos', icon: 'list', desc: 'Listado con las columnas elegidas.' },
  { key: 'galeria', label: 'Galería de imágenes', icon: 'camera', desc: 'Espacio para evidencias visuales.' },
  { key: 'evidencias', label: 'Evidencias', icon: 'shield', desc: 'Soportes y comprobantes adjuntos.' },
  { key: 'historial', label: 'Historial', icon: 'clock', desc: 'Línea de tiempo de cambios.' },
  { key: 'anexos', label: 'Anexos', icon: 'fileText', desc: 'Notas y documentación complementaria.' },
  { key: 'auditoria', label: 'Auditoría', icon: 'shield', desc: 'Registro de generación y trazabilidad.' },
  { key: 'firmas', label: 'Firmas', icon: 'edit', desc: 'Bloques de firma y aprobación.' },
  { key: 'documentos', label: 'Documentos relacionados', icon: 'list', desc: 'Referencias a otros expedientes.' },
]

// Bloques de la portada (toggles) — Sección 3 del brief
export const COVER_BLOCKS = [
  { key: 'companyLogo', label: 'Logo de empresa', def: true },
  { key: 'eventLogo', label: 'Logo del torneo/evento', def: false },
  { key: 'title', label: 'Nombre del reporte', def: true },
  { key: 'subtitle', label: 'Subtítulo', def: true },
  { key: 'date', label: 'Fecha de generación', def: true },
  { key: 'user', label: 'Usuario exportador', def: true },
  { key: 'period', label: 'Periodo seleccionado', def: true },
  { key: 'season', label: 'Temporada', def: true },
  { key: 'pdfId', label: 'ID del PDF', def: true },
  { key: 'classification', label: 'Clasificación', def: true },
  { key: 'confidentiality', label: 'Nivel de confidencialidad', def: true },
  { key: 'count', label: 'Cantidad de registros', def: true },
  { key: 'qr', label: 'Código QR', def: true },
]

export const CONFIDENTIALITY_LEVELS = ['Público', 'Uso interno', 'Confidencial', 'Restringido']
export const CLASSIFICATIONS = ['Operativo', 'Ejecutivo', 'Auditoría', 'Comercial', 'Legal']

export const PDF_VARIANTS = [
  { key: 'ejecutivo', label: 'PDF Ejecutivo', desc: 'Síntesis para dirección: portada, resumen y gráficos.' },
  { key: 'expediente', label: 'PDF Expediente', desc: 'Una página por registro con todos los datos e imagen + tabla.' },
  { key: 'administrativo', label: 'PDF Administrativo', desc: 'Fichas individuales, estadísticas y tabla completa.' },
  { key: 'auditoria', label: 'PDF Auditoría', desc: 'Énfasis en trazabilidad, IDs y registro de cambios.' },
  { key: 'comercial', label: 'PDF Comercial', desc: 'Enfoque visual para patrocinadores y aliados.' },
  { key: 'personalizado', label: 'PDF Personalizado', desc: 'Exactamente las secciones que configuraste.' },
]

// Paleta corporativa para el constructor visual
export const THEME_ACCENTS = [
  { key: 'glitch', label: 'Glitch (default)', rgb: [45, 224, 192] },
  { key: 'violeta', label: 'Violeta', rgb: [124, 58, 237] },
  { key: 'ambar', label: 'Ámbar', rgb: [245, 158, 11] },
  { key: 'azul', label: 'Azul corporativo', rgb: [37, 99, 235] },
  { key: 'rojo', label: 'Rojo', rgb: [220, 38, 38] },
  { key: 'esmeralda', label: 'Esmeralda', rgb: [16, 185, 129] },
]

