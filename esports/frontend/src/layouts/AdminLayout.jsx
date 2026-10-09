import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { Icon } from '../components/icons/Icons.jsx'
import Logo from '../components/Logo/Logo.jsx'
import { api } from '../lib/api.js'
import './AdminLayout.css'

const EMPTY_ADMIN_SUMMARY = {
  modules: {},
  totals: { requiresAttention: 0 },
}

function navBadgeForPath(summary, path) {
  const modules = summary?.modules || {}
  const map = {
    '/admin': summary?.totals?.requiresAttention || 0,
    '/admin/operaciones': summary?.totals?.requiresAttention || 0,
    '/admin/torneos': modules.tournaments?.review || 0,
    '/admin/comunidades': modules.communities?.paused || 0,
    '/admin/pagos': modules.payments?.pending || 0,
    '/admin/marcas': modules.brands?.pending || 0,
    '/admin/universidades': modules.universities?.pending || 0,
    '/admin/autorizaciones': modules.roleApplications?.pending || 0,
    '/admin/organizaciones': modules.organizations?.pending || 0,
    '/admin/reportes': (modules.reports?.pending || 0) + (modules.tickets?.new || 0),
    '/admin/moderacion': modules.adminNotices?.unanswered || 0,
    '/admin/discord-sync': modules.discordSync?.failed || 0,
  }
  return Number(map[path] || 0)
}

// Texto del tooltip de cada badge: que esta contando exactamente.
function navBadgeTitle(summary, path) {
  const m = summary?.modules || {}
  const parts = {
    '/admin/torneos': [[m.tournaments?.reportsPending, 'reportes de torneo abiertos']],
    '/admin/comunidades': [[m.communities?.paused, 'comunidades pausadas']],
    '/admin/pagos': [[m.payments?.invoicesPending, 'facturas de marca por verificar'], [m.payments?.campaignPaymentsPending, 'pagos de campaña pendientes']],
    '/admin/marcas': [[m.brands?.applicationsPending, 'solicitudes de marca'], [m.brands?.profileChangesPending, 'cambios de perfil'], [m.brands?.campaignsPending, 'campañas por aprobar'], [m.brands?.creativesReview, 'creativos en revisión']],
    '/admin/universidades': [[m.universities?.pending, 'verificaciones pendientes']],
    '/admin/autorizaciones': [[m.roleApplications?.pending, 'solicitudes de rol']],
    '/admin/organizaciones': [[m.organizations?.pending, 'solicitudes de organización']],
    '/admin/reportes': [[m.reports?.pending, 'reportes sin leer'], [m.tickets?.new, 'tickets con mensajes nuevos']],
    '/admin/moderacion': [[m.adminNotices?.unanswered, 'avisos sin responder']],
  }[path]
  if (path === '/admin' || path === '/admin/operaciones') {
    return Object.values(m).filter(x => x?.label).map(x => {
      const n = x.pending ?? x.review ?? x.new ?? x.unanswered ?? 0
      return n > 0 ? `${n} ${x.label.toLowerCase()}` : null
    }).filter(Boolean).join(' · ')
  }
  return (parts || []).filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(' · ')
}

const NAV_SECTIONS = [
  {
    section: 'Principal',
    items: [
      { path: '/admin', label: 'Dashboard', icon: Icon.dashboard, end: true },
    ]
  },
  {
    section: 'Gestión',
    items: [
      { path: '/admin/usuarios', label: 'Usuarios', icon: Icon.users },
      { path: '/admin/equipos', label: 'Equipos', icon: Icon.team },
      { path: '/admin/comunidades', label: 'Comunidades', icon: Icon.globe },
      { path: '/admin/torneos', label: 'Torneos', icon: Icon.trophy },
      { path: '/admin/pagos', label: 'Pagos', icon: Icon.creditCard },
    ]
  },
  {
    section: 'Contenido',
    items: [
      { path: '/admin/noticias', label: 'Publicaciones', icon: Icon.news },
      { path: '/admin/banners', label: 'Publicidad', icon: Icon.star },
      { path: '/admin/marcas',  label: 'Centro de Marcas', icon: Icon.gem },
      { path: '/admin/universidades', label: 'Universidades', icon: Icon.award },
      { path: '/admin/sorteos', label: 'Sorteos', icon: Icon.gem },
    ]
  },
  {
    section: 'Operaciones',
    items: [
      { path: '/admin/operaciones', label: 'Centro Operativo', icon: Icon.layoutGrid },
      { path: '/admin/autorizaciones', label: 'Autorizaciones', icon: Icon.check },
      { path: '/admin/tickets', label: 'Tickets de soporte', icon: Icon.msg },
      { path: '/admin/reportes', label: 'Reportes & Soporte', icon: Icon.shield },
      { path: '/admin/moderacion', label: 'Moderación', icon: Icon.bolt },
      { path: '/admin/validar', label: 'Verificación QR', icon: Icon.camera },
    ]
  },
  {
    section: 'Reportes',
    items: [
      { path: '/admin/centro-exportacion', label: 'Centro de Exportación', icon: Icon.layoutGrid },
      { path: '/admin/laboratorio-estadisticas', label: 'Lab. de capturas (temp.)', icon: Icon.camera }, // TEMPORAL
    ]
  },
  {
    section: 'Configuración',
    items: [
      { path: '/admin/organizaciones', label: 'Organizaciones', icon: Icon.shield },
      { path: '/admin/discord-sync', label: 'Discord Sync', icon: Icon.discord },
      { path: '/admin/roles', label: 'Roles & permisos', icon: Icon.lock },
      { path: '/admin/admins', label: 'Usuarios admin', icon: Icon.user },
      { path: '/admin/logs', label: 'Logs & auditoría', icon: Icon.clock },
    ]
  },
]

const ADMIN_HELP = {
  '/admin': {
    title: 'Dashboard Admin',
    summary: 'Vista general del estado operativo de GlitchGang. Sirve para detectar pendientes, riesgos y actividad reciente sin entrar a cada modulo.',
    use: [
      'Revisa los contadores de atencion para saber que modulo requiere accion.',
      'Usa las tarjetas como acceso rapido hacia operaciones, tickets, pagos, marcas o autorizaciones.',
      'Si un contador no cuadra, refresca el panel o entra al modulo especifico para ver el listado real.',
    ],
    does: [
      'Agrupa alertas de varios modulos.',
      'No aprueba ni rechaza nada por si solo.',
      'Es una pantalla de monitoreo, no de decision final.',
    ],
  },
  '/admin/operaciones': {
    title: 'Centro Operativo',
    summary: 'Cola de supervision para ver asuntos que necesitan seguimiento administrativo. Es un resumen transversal, no reemplaza las pantallas especializadas.',
    use: [
      'Entra aqui cuando quieras saber que esta pendiente hoy.',
      'Abre cada item para saltar al modulo donde se toma la decision real.',
      'Usalo como bandeja de trabajo, no como archivo historico.',
    ],
    does: [
      'Agrupa solicitudes, tickets, pagos y alertas importantes.',
      'Te orienta hacia el lugar correcto para resolver.',
      'Evita que tengas que revisar todos los paneles manualmente.',
    ],
  },
  '/admin/autorizaciones': {
    title: 'Autorizaciones de Roles',
    summary: 'Unico lugar donde se aprueban o rechazan roles especiales: organizador, creador, coach, caster, analista, moderador y sponsor.',
    use: [
      'Filtra por rol o estado para reducir la lista.',
      'Abre una solicitud, revisa DNI/documento, formulario y ticket vinculado.',
      'Autoriza solo cuando el documento y la informacion tengan sentido.',
      'Al aprobar, backend asigna el rol y crea el codigo real del perfil con overwriteImmutable.',
      'Si ves "Falta codigo", corre la migracion backend de codigos de roles.',
    ],
    does: [
      'Cambia el rol funcional del usuario.',
      'Genera o muestra el codigo real del rol aprobado.',
      'Mantiene relacion con el ticket de soporte generado por la solicitud.',
    ],
  },
  '/admin/tickets': {
    title: 'Tickets de Soporte',
    summary: 'Centro de conversaciones administrativas con usuarios, marcas y solicitantes. Aqui se da seguimiento, no se aprueban roles directamente.',
    use: [
      'Filtra por estado o prioridad para atender casos nuevos primero.',
      'Responde dentro del ticket para dejar historial.',
      'Si el ticket viene de una autorizacion, usa el enlace de vuelta a Autorizaciones para decidir.',
    ],
    does: [
      'Guarda conversacion, contexto y seguimiento.',
      'Ayuda a resolver dudas o pedir documentos.',
      'No sustituye el boton Autorizar/Rechazar del modulo correspondiente.',
    ],
  },
  '/admin/usuarios': {
    title: 'Usuarios',
    summary: 'Gestiona cuentas, estado, busqueda y revision basica de perfiles registrados.',
    use: [
      'Busca por nick, correo o codigo de jugador.',
      'Revisa actividad y estado antes de tomar decisiones sensibles.',
      'Usa exportacion cuando necesites un reporte de usuarios.',
    ],
    does: [
      'Muestra informacion administrativa de usuarios.',
      'Permite detectar cuentas problematicas o incompletas.',
      'No debe usarse para aprobar roles especiales; eso va en Autorizaciones.',
    ],
  },
  '/admin/usuarios/exportar': {
    title: 'Exportar Usuarios',
    summary: 'Herramienta para generar archivos o listados de usuarios segun filtros administrativos.',
    use: [
      'Selecciona columnas y filtros antes de exportar.',
      'Usalo para reportes internos, auditorias o seguimiento operativo.',
      'Evita exportar datos sensibles si no son necesarios.',
    ],
    does: [
      'Prepara informacion descargable.',
      'No modifica usuarios.',
      'Depende de los filtros activos para el alcance del archivo.',
    ],
  },
  '/admin/centro-exportacion': {
    title: 'Centro de Exportacion',
    summary: 'Panel general para sacar reportes administrativos de distintas entidades.',
    use: [
      'Elige la entidad correcta antes de descargar.',
      'Revisa columnas, rango y formato.',
      'Usalo cuando necesites un paquete de datos mas amplio que una tabla individual.',
    ],
    does: [
      'Centraliza exportaciones.',
      'Reduce trabajo manual.',
      'No aprueba ni edita registros.',
    ],
  },
  '/admin/torneos': {
    title: 'Torneos',
    summary: 'Gestiona torneos creados en la plataforma, su estado, organizador, visibilidad y datos principales.',
    use: [
      'Busca el torneo por nombre, juego, codigo u organizador.',
      'Revisa estado, inscripciones y datos antes de intervenir.',
      'Para problemas con bracket o reglas, entra al detalle del torneo.',
    ],
    does: [
      'Permite supervision administrativa de competiciones.',
      'Ayuda a detectar torneos incompletos o mal configurados.',
      'No reemplaza el panel del organizador para operar el torneo dia a dia.',
    ],
  },
  '/admin/organizaciones': {
    title: 'Organizaciones',
    summary: 'Administra solicitudes y datos de organizaciones o comunidades formales dentro de la plataforma.',
    use: [
      'Revisa solicitudes pendientes y datos de contacto.',
      'Aprueba solo organizaciones verificables.',
      'Usa notas o tickets si falta informacion.',
    ],
    does: [
      'Controla acceso institucional.',
      'Ayuda a ordenar comunidades grandes.',
      'Mantiene trazabilidad de aprobaciones.',
    ],
  },
  '/admin/equipos': {
    title: 'Equipos',
    summary: 'Vista administrativa de equipos, rosters, sponsors y datos publicos asociados.',
    use: [
      'Busca equipos por nombre, tag, juego o lider.',
      'Revisa roster y datos publicos si hay reportes.',
      'Usa acciones administrativas solo cuando haya abuso, error o soporte solicitado.',
    ],
    does: [
      'Permite supervision de equipos.',
      'Ayuda a detectar duplicados o datos invalidos.',
      'No debe reemplazar la gestion normal que hace el lider del equipo.',
    ],
  },
  '/admin/comunidades': {
    title: 'Comunidades',
    summary: 'Controla comunidades creadas por usuarios, su visibilidad y estado.',
    use: [
      'Revisa comunidades pausadas o reportadas.',
      'Valida que nombre, descripcion y reglas sean aceptables.',
      'Usa moderacion si hay contenido indebido.',
    ],
    does: [
      'Ordena comunidades activas.',
      'Da visibilidad a problemas pendientes.',
      'No administra chats externos.',
    ],
  },
  '/admin/reportes': {
    title: 'Reportes y Soporte',
    summary: 'Gestiona reportes de usuarios y casos que requieren moderacion, revision o respuesta.',
    use: [
      'Prioriza reportes abiertos o de alto riesgo.',
      'Revisa evidencia antes de cerrar.',
      'Escala a Tickets si necesitas conversacion con el usuario.',
    ],
    does: [
      'Centraliza reportes internos.',
      'Ayuda a tomar medidas con contexto.',
      'No sustituye la auditoria de Logs cuando necesitas trazabilidad tecnica.',
    ],
  },
  '/admin/noticias': {
    title: 'Publicaciones',
    summary: 'Administra noticias, anuncios o contenido editorial visible para la comunidad.',
    use: [
      'Crea o edita publicaciones con titulo claro e imagen adecuada.',
      'Verifica estado publicado/borrador antes de guardar.',
      'Evita publicar avisos operativos privados aqui.',
    ],
    does: [
      'Controla contenido publico.',
      'Sirve para comunicados y novedades.',
      'No es un sistema de tickets ni notificaciones privadas.',
    ],
  },
  '/admin/moderacion': {
    title: 'Moderacion',
    summary: 'Herramientas para revisar conductas, avisos y acciones de control comunitario.',
    use: [
      'Revisa casos con contexto antes de sancionar.',
      'Usa estados para separar pendiente, en revision y resuelto.',
      'Deja notas claras si una accion afecta una cuenta.',
    ],
    does: [
      'Ayuda a mantener orden y seguridad.',
      'Centraliza casos de conducta.',
      'No debe usarse para aprobar roles o pagos.',
    ],
  },
  '/admin/pagos': {
    title: 'Pagos',
    summary: 'Panel para revisar pagos, comprobantes, facturas y estados financieros operativos.',
    use: [
      'Filtra por pendiente o rechazado primero.',
      'Compara monto, referencia y comprobante antes de verificar.',
      'Si falta informacion, abre o responde el ticket relacionado.',
    ],
    does: [
      'Permite validar pagos.',
      'Ayuda a detectar comprobantes incompletos.',
      'No cambia roles salvo que otro flujo dependa del pago y lo indique.',
    ],
  },
  '/admin/validar': {
    title: 'Validacion QR',
    summary: 'Herramienta para validar accesos o check-ins con QR en eventos presenciales.',
    use: [
      'Usala durante eventos cuando necesites confirmar asistencia o acceso.',
      'Escanea el codigo y revisa el resultado antes de permitir entrada.',
      'No la mezcles con aprobaciones de rol ni tickets.',
    ],
    does: [
      'Valida codigos de evento.',
      'Ayuda en operacion presencial.',
      'No administra usuarios ni roles globales.',
    ],
  },
  '/admin/banners': {
    title: 'Publicidad',
    summary: 'Administra banners, promos y visibilidad publicitaria del sitio.',
    use: [
      'Crea piezas con titulo, destino, ubicacion y estado activo/inactivo.',
      'Verifica que imagen y link funcionen antes de activar.',
      'Usa visibilidad global para apagar promociones sin borrar datos.',
    ],
    does: [
      'Controla anuncios del sitio.',
      'Separa promos, banners y espacios flotantes.',
      'No debe guardar marcas ficticias o hardcodeadas.',
    ],
  },
  '/admin/marcas': {
    title: 'Centro de Marcas',
    summary: 'Gestiona marcas, solicitudes comerciales, campanas, creatividades y relacion con sponsors.',
    use: [
      'Revisa solicitudes de marca antes de aprobar.',
      'Valida datos fiscales, contacto y objetivo comercial.',
      'Usa campanas y creatividades para publicar piezas aprobadas.',
    ],
    does: [
      'Controla sponsors reales.',
      'Conecta marcas con publicidad y reportes.',
      'No debe mezclar datos mock con marcas oficiales.',
    ],
  },
  '/admin/universidades': {
    title: 'Universidades',
    summary: 'Administra verificaciones universitarias y entidades academicas.',
    use: [
      'Revisa dominio, documento o conexion Microsoft si aplica.',
      'Aprueba cuando la identidad academica sea consistente.',
      'Rechaza con motivo claro si falta evidencia.',
    ],
    does: [
      'Verifica estudiantes o instituciones.',
      'Ayuda a torneos universitarios.',
      'No asigna roles de staff competitivo.',
    ],
  },
  '/admin/sorteos': {
    title: 'Sorteos',
    summary: 'Panel para crear, revisar o administrar dinamicas de premios.',
    use: [
      'Define premio, reglas, fechas y elegibilidad.',
      'Revisa participantes antes de cerrar.',
      'Publica resultados con informacion clara.',
    ],
    does: [
      'Gestiona rifas o sorteos.',
      'Ordena participaciones.',
      'No reemplaza pagos, tickets ni autorizaciones.',
    ],
  },
  '/admin/roles': {
    title: 'Roles y Permisos',
    summary: 'Vista de referencia para entender permisos y perfiles. La decision real de aprobar roles ocurre en Autorizaciones.',
    use: [
      'Consulta que puede hacer cada rol.',
      'Usa el acceso a Autorizaciones para aprobar solicitudes.',
      'No apruebes roles desde aqui si la pantalla no ofrece ese flujo real.',
    ],
    does: [
      'Explica permisos.',
      'Sirve como mapa del sistema.',
      'No debe duplicar la cola de aprobaciones.',
    ],
  },
  '/admin/admins': {
    title: 'Usuarios Admin',
    summary: 'Gestiona cuentas con privilegios administrativos.',
    use: [
      'Agrega admins solo si necesitan operar el panel.',
      'Retira acceso cuando ya no sea necesario.',
      'Revisa dos veces antes de cambiar privilegios.',
    ],
    does: [
      'Controla acceso administrativo.',
      'Reduce riesgos operativos.',
      'No gestiona roles publicos como organizador o caster.',
    ],
  },
  '/admin/discord-sync': {
    title: 'Discord Sync',
    summary: 'Supervisa sincronizacion entre GlitchGang y Discord: roles, cuentas vinculadas y fallos de integracion.',
    use: [
      'Revisa fallos antes de reintentar.',
      'Confirma que el usuario tenga Discord vinculado.',
      'Usa logs o tickets si hay errores repetidos.',
    ],
    does: [
      'Ayuda a mantener Discord alineado.',
      'Detecta cuentas sin vinculacion.',
      'No reemplaza el flujo de conectar Discord.',
    ],
  },
  // TEMPORAL — borrar junto con AdminStatsLab.
  '/admin/laboratorio-estadisticas': {
    title: 'Laboratorio de capturas',
    summary: 'Prueba la lectura con IA de capturas de Mobile Legends antes de usarla en torneos. No guarda nada en la web.',
    use: [
      'Sube una captura de resultados y compara cada numero con la imagen.',
      'Marca si acerto y anota los errores para decidir si es fiable.',
      'Las pruebas quedan solo en este navegador.',
    ],
    does: [
      'Usa la misma lectura (Gemini) que el flujo de torneos.',
      'Muestra destacados y una tabla acumulada de ejemplo.',
      'No toca brackets, historiales ni rankings.',
    ],
  },
  '/admin/logs': {
    title: 'Logs y Auditoria',
    summary: 'Historial tecnico y administrativo para entender que paso, cuando y por quien.',
    use: [
      'Busca por usuario, accion o fecha.',
      'Usalo para investigar cambios sensibles.',
      'No edites datos desde aqui; usa el modulo correspondiente.',
    ],
    does: [
      'Da trazabilidad.',
      'Ayuda a investigar errores o abuso.',
      'No resuelve casos por si solo.',
    ],
  },
}

function helpForPath(pathname) {
  const paths = Object.keys(ADMIN_HELP).sort((a, b) => b.length - a.length)
  return ADMIN_HELP[paths.find(path => pathname === path || pathname.startsWith(`${path}/`))] || ADMIN_HELP['/admin']
}

export default function AdminLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [adminSummary, setAdminSummary] = useState(EMPTY_ADMIN_SUMMARY)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer = null

    const loadAdminSummary = async () => {
      try {
        const data = await api('/admin/summary')
        if (!cancelled) setAdminSummary(data || EMPTY_ADMIN_SUMMARY)
      } catch {
        if (!cancelled) setAdminSummary(EMPTY_ADMIN_SUMMARY)
      }
    }

    loadAdminSummary()
    timer = setInterval(loadAdminSummary, 30_000)
    window.addEventListener('gg-system-tickets:update', loadAdminSummary)
    window.addEventListener('gg-admin-summary:update', loadAdminSummary)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('gg-system-tickets:update', loadAdminSummary)
      window.removeEventListener('gg-admin-summary:update', loadAdminSummary)
    }
  }, [])

  const globalAttention = Number(adminSummary?.totals?.requiresAttention || 0)
  const activeHelp = helpForPath(location.pathname)

  return (
    <div className={`gg-admin ${collapsed ? 'collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="gg-admin-side">

        {/* Logo / Header */}
        <div className="gg-admin-side__logo">
          <div className="gg-admin-side__logo-group">
            <div className="gg-admin-side__logo-icon">
              <Logo size={28} />
            </div>
            <div className="gg-admin-side__logo-text">
              <span>GlitchGang</span>
              <small>Admin Panel</small>
            </div>
          </div>
          <button
            className="gg-admin-side__collapse"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {Icon.collapse}
          </button>
        </div>

        {/* Navigation */}
        <nav className="gg-admin-side__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.section}>
              <div className="gg-admin-side__nav-section">{section.section}</div>
              {section.items.map(item => {
                const badge = navBadgeForPath(adminSummary, item.path)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end ?? false}
                    className={({ isActive }) => `gg-admin-nav${isActive ? ' active' : ''}${badge > 0 ? ' has-alert' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="gg-admin-nav__icon">{item.icon}</span>
                    <span className="gg-admin-nav__label">{item.label}</span>
                    {badge > 0
                      ? <span title={navBadgeTitle(adminSummary, item.path)} className={`gg-admin-nav__badge ${item.path === '/admin/reportes' || item.path === '/admin' ? 'gg-admin-nav__badge--dot' : ''}`}>{badge}</span>
                      : item.badge
                        ? <span className="gg-admin-nav__badge">{item.badge}</span>
                        : null
                    }
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="gg-admin-side__bottom">
          <button
            className="gg-admin-nav"
            onClick={() => navigate('/dashboard')}
            title={collapsed ? 'Ver app' : undefined}
          >
            <span className="gg-admin-nav__icon">{Icon.eye}</span>
            <span className="gg-admin-nav__label">Ver app</span>
          </button>
        </div>

        {/* User card */}
        <div className="gg-admin-side__user" onClick={() => navigate('/perfil')}>
          <img
            src={user?.avatar || '/demos/steliant-esports/avatar-default.svg'}
            alt={user?.nick}
          />
          <div className="gg-admin-side__user-info">
            <b>{user?.nick || 'Brooklyn'}</b>
            <small>Admin</small>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="gg-admin-main">
        {/* Topbar */}
        <header className="gg-admin-topbar">
          <span className="gg-admin-topbar__title">Panel de Administración</span>
          <div className="gg-admin-topbar__right">
            <button
              type="button"
              className="gg-admin-help-btn"
              onClick={() => setHelpOpen(true)}
              title={`Ayuda: ${activeHelp.title}`}
            >
              ?
            </button>
            {globalAttention > 0 && (
              <button type="button" className="gg-admin-attention" onClick={() => navigate('/admin/operaciones')}>
                {Icon.bell} {globalAttention}
              </button>
            )}
            <div className="gg-admin-topbar__user">
              <img
                src={user?.avatar || '/demos/steliant-esports/avatar-default.svg'}
                alt={user?.nick}
                className="gg-admin-topbar__avatar"
              />
              <span>{user?.nick || 'Brooklyn'}</span>
              <span className="gg-admin-topbar__role">Admin</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="gg-admin-content">
          <Outlet />
        </div>
      </div>

      <AnimatePresence>
        {helpOpen && (
          <motion.div
            className="gg-admin-help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.aside
              className="gg-admin-help__panel"
              initial={{ opacity: 0, y: 18, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: .96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="gg-admin-help-title"
            >
              <div className="gg-admin-help__head">
                <div>
                  <span>Ayuda del panel</span>
                  <h2 id="gg-admin-help-title">{activeHelp.title}</h2>
                </div>
                <button type="button" onClick={() => setHelpOpen(false)} aria-label="Cerrar ayuda">{Icon.x}</button>
              </div>
              <p className="gg-admin-help__summary">{activeHelp.summary}</p>
              <section>
                <h3>Como se usa</h3>
                <ul>
                  {activeHelp.use.map(item => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <section>
                <h3>Que hace y que no hace</h3>
                <ul>
                  {activeHelp.does.map(item => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <div className="gg-admin-help__note">
                <b>Regla operativa:</b>
                <span>Si una accion cambia permisos, dinero, identidad o visibilidad publica, revisa dos veces el detalle antes de confirmar.</span>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

