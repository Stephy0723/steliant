import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../../components/DataTable/DataTable.jsx'
import StatusPill from '../../../components/StatusPill/StatusPill.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import Button from '../../../components/Button/Button.jsx'
import { useAdmin } from '../../../context/AdminContext.jsx'
import { useLang } from '../../../i18n/LangContext.jsx'
import { api } from '../../../lib/api.js'
import './AdminDashboard.css'

const money = (value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const DASH_TZ = 'America/Santo_Domingo'

function formatAdminTime(value, lang = 'es') {
  if (!value || value === 'â€”' || value === '—') return lang === 'es' ? 'Sin hora' : 'No time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(lang === 'es' ? 'es-DO' : 'en-US', {
    timeZone: DASH_TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ADMIN_COPY = {
  es: {
    system: 'Sistema',
    admin: 'Admin',
    registered: 'registro a',
    tournament: 'torneo',
    banned: 'baneo a',
    newRegistration: 'Nuevo registro',
    adminAction: 'Accion administrativa',
    user: 'usuario',
    none: '—',
  },
  en: {
    system: 'System',
    admin: 'Admin',
    registered: 'registered',
    tournament: 'tournament',
    banned: 'banned',
    newRegistration: 'New registration',
    adminAction: 'Administrative action',
    user: 'user',
    none: '-',
  },
}

// ── Colores para gráficos ──
const REGION_COLORS = ['#00E5A0', '#7c3aed', '#3b82f6', '#f59e0b', '#f87171', '#06b6d4', '#a855f7', '#ec4899', '#6b7280']
const COUNTRY_LABELS = {
  RD: 'Rep. Dominicana', DO: 'Rep. Dominicana', PR: 'Puerto Rico', CO: 'Colombia',
  MX: 'México', VE: 'Venezuela', CL: 'Chile', AR: 'Argentina', PE: 'Perú',
  EC: 'Ecuador', US: 'Estados Unidos', ES: 'España', PA: 'Panamá', CR: 'Costa Rica',
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', BR: 'Brasil',
}
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Derive chart data from real census
function buildRegionChart(players) {
  const counts = {}
  players.forEach(p => {
    const code = (p.country || p.countryCode || '').toUpperCase()
    const label = COUNTRY_LABELS[code] || code || 'Desconocido'
    counts[label] = (counts[label] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 6)
  const othersCount = sorted.slice(6).reduce((s, [, v]) => s + v, 0)
  if (othersCount > 0) top.push(['Otros', othersCount])
  return top.map(([label, value], i) => ({ label, value, color: REGION_COLORS[i] || '#6b7280' }))
}

function buildGamesChart(players) {
  const counts = {}
  players.forEach(p => {
    const game = p.mainGame || '—'
    if (game !== '—') counts[game] = (counts[game] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const total = players.length || 1
  const top = sorted.slice(0, 5)
  const othersCount = sorted.slice(5).reduce((s, [, v]) => s + v, 0)
  if (othersCount > 0) top.push(['Otros', othersCount])
  return top.map(([game, count]) => ({ game, players: count, pct: Math.round((count / total) * 100) }))
}

function buildGrowthChart(players) {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: MONTH_NAMES[d.getMonth()], year: d.getFullYear(), m: d.getMonth() })
  }
  // Count users registered up to each month-end
  const parsed = players.map(p => {
    const parts = (p.joined || '').split('/')
    if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0])
    return p.joined ? new Date(p.joined) : null
  }).filter(d => d && !isNaN(d.getTime()))

  return months.map(({ month, year, m }) => {
    const cutoff = new Date(year, m + 1, 0, 23, 59, 59)
    const count = parsed.filter(d => d <= cutoff).length
    return { month, users: count || 0 }
  })
}

function buildActivityFeedLocalized(players, realTournaments, lang = 'es') {
  const C = ADMIN_COPY[lang] || ADMIN_COPY.es
  const feed = []
  const recent = [...players]
    .filter(p => p.joined && p.joined !== 'â€”' && p.joined !== '—')
    .sort((a, b) => {
      const da = a.joined.includes('/') ? a.joined.split('/').reverse().join('-') : a.joined
      const db = b.joined.includes('/') ? b.joined.split('/').reverse().join('-') : b.joined
      return new Date(db) - new Date(da)
    })
    .slice(0, 3)
  recent.forEach((p, i) => {
    feed.push({
      id: `reg-${i}`,
      icon: Icon.users,
      color: '#06b6d4',
      admin: C.system,
      action: C.registered,
      target: p.nick || p.realName || C.user,
      detail: C.newRegistration,
      time: formatAdminTime(p.joined, lang),
    })
  })
  ;[...realTournaments].slice(0, 2).forEach((t, i) => {
    feed.push({
      id: `tr-${i}`,
      icon: Icon.trophy,
      color: '#f59e0b',
      admin: C.system,
      action: C.tournament,
      target: t.name || t.title,
      detail: `${t.status} - ${t.registered || 0}/${t.capacity || 0}`,
      time: formatAdminTime(t.startDate || t.date, lang),
    })
  })
  players.filter(p => p.status === 'ban').slice(0, 1).forEach((p, i) => {
    feed.push({
      id: `ban-${i}`,
      icon: Icon.lock,
      color: '#f87171',
      admin: C.admin,
      action: C.banned,
      target: p.nick || C.none,
      detail: C.adminAction,
      time: formatAdminTime(p.joined, lang),
    })
  })
  return feed.slice(0, 6)
}

export default function AdminDashboard() {
  const { summary } = useAdmin()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [realPending, setRealPending] = useState(null)
  const [realPlayers, setRealPlayers] = useState([])
  const [realTournaments, setRealTournaments] = useState([])
  const [realTeams, setRealTeams] = useState([])
  const [realInvoices, setRealInvoices] = useState([])
  const [realTickets, setRealTickets] = useState([])
  const [realModeration, setRealModeration] = useState([])
  const [realOrders, setRealOrders] = useState([])
  const [realSystemTickets, setRealSystemTickets] = useState([])

  useEffect(() => {
    api('/role-applications/admin?status=pending')
      .then(data => setRealPending(data))
      .catch(() => setRealPending([]))
    api('/admin/census')
      .then(data => { if (data?.players?.length) setRealPlayers(data.players) })
      .catch(() => {})
    api('/admin/tournaments')
      .then(data => { if (data?.tournaments?.length) setRealTournaments(data.tournaments) })
      .catch(() => {})
    api('/admin/teams')
      .then(data => { if (data?.teams?.length) setRealTeams(data.teams) })
      .catch(() => {})
    api('/demos/steliant-esports/brands/admin/invoices?status=all')
      .then(data => { if (Array.isArray(data)) setRealInvoices(data) })
      .catch(() => {})
    api('/demos/steliant-esports/brands/admin/tickets?status=all')
      .then(data => { if (Array.isArray(data)) setRealTickets(data) })
      .catch(() => {})
    api('/admin/moderation')
      .then(data => { if (Array.isArray(data?.sanctions)) setRealModeration(data.sanctions) })
      .catch(() => {})
    api('/admin/payments')
      .then(data => { if (Array.isArray(data?.payments)) setRealOrders(data.payments) })
      .catch(() => {})
    api('/system-tickets/admin?status=all')
      .then(data => { if (Array.isArray(data?.tickets)) setRealSystemTickets(data.tickets) })
      .catch(() => {})
  }, [])

  // Derived chart data from real API
  const USERS_BY_REGION = useMemo(() => buildRegionChart(realPlayers), [realPlayers])
  const TOP_GAMES = useMemo(() => buildGamesChart(realPlayers), [realPlayers])
  const GROWTH_DATA = useMemo(() => buildGrowthChart(realPlayers), [realPlayers])
  const ACTIVITY_FEED = useMemo(() => buildActivityFeedLocalized(realPlayers, realTournaments, lang), [realPlayers, realTournaments, lang])

  const bannedUsers = realPlayers.filter(u => u.status === 'ban').length
  const activeUsers = realPlayers.length - bannedUsers
  const liveTournaments = realTournaments.filter(t => t.status === 'live').length
  const totalUsers = summary?.totals?.users ?? realPlayers.length
  const totalTournaments = summary?.totals?.tournaments ?? realTournaments.length

  // Normalize real tickets to reports shape
  const mappedReports = useMemo(() => {
    return realTickets.map(t => {
      let mappedStatus = 'pendiente'
      if (t.status === 'in_progress') mappedStatus = 'revisión'
      if (t.status === 'closed') mappedStatus = 'resuelto'

      return {
        id: t._id,
        reporter: t.brandId?.name || 'Marca',
        target: t.category?.toUpperCase() || 'GENERAL',
        reason: t.subject || 'Soporte',
        status: mappedStatus,
        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-DO') : '—',
        updates: (t.messages || []).map((msg, i) => ({
          id: i,
          author: msg.author === 'brand' ? (t.brandId?.name || 'Marca') : 'Admin',
          message: msg.body,
          date: msg.sentAt ? new Date(msg.sentAt).toLocaleDateString('es-DO') : '—'
        }))
      }
    })
  }, [realTickets])

  // Tickets del sistema (soporte, reportes de usuarios, casos de moderacion)
  const mappedSystemReports = useMemo(() => realSystemTickets.map(t => ({
    id: t.id || t._id,
    reporter: t.requesterName || 'Usuario',
    target: t.publicCode || '—',
    reason: t.subject || 'Ticket',
    status: t.status === 'closed' ? 'resuelto' : (t.status === 'open' ? 'pendiente' : 'revisión'),
    date: t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-DO') : '—',
    updates: [],
  })), [realSystemTickets])

  // Pagos de usuarios (Order/PayPal) + facturas de marcas, mismo formato
  const mappedOrders = useMemo(() => realOrders.map(o => ({
    id: o.id,
    user: o.user,
    plan: o.concept,
    amount: `$${Number(o.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}${o.mode === 'demo' ? ' (demo)' : ''}`,
    status: o.status,
    date: o.date,
    demo: o.mode === 'demo',
  })), [realOrders])

  // Normalize real invoices to payments shape
  const mappedInvoices = useMemo(() => {
    return realInvoices.map(inv => {
      let mappedStatus = 'pendiente'
      if (inv.status === 'verified') mappedStatus = 'pagado'
      if (inv.status === 'rejected') mappedStatus = 'fallido'

      return {
        id: inv._id,
        user: inv.brandId?.name || 'Marca',
        plan: inv.campaignId?.name || 'Patrocinio',
        amount: `$${(inv.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        status: mappedStatus,
        date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('es-DO') : '—'
      }
    })
  }, [realInvoices])
  const mappedPayments = useMemo(() => [...mappedOrders, ...mappedInvoices], [mappedOrders, mappedInvoices])

  // Normaliza las solicitudes reales al formato que espera el DataTable del dashboard
  const pendingApprovals = (realPending ?? []).map(app => ({
    id: app._id,
    type: 'Rol',
    title: `Solicitud de ${app.roleLabel}`,
    requester: app.userId?.nick || '—',
    status: 'pendiente',
  }))
  const openReports = [...mappedSystemReports, ...mappedReports].filter(report => ['pendiente', 'revisión'].includes(report.status))
  const summaryModules = summary?.modules || {}
  const summaryPendingAdmin = Number(summary?.totals?.requiresAttention || 0)
  const summaryReports = Number(summaryModules.reports?.pending || 0) + Number(summaryModules.tickets?.new || 0)
  const summaryApprovals = Number(summaryModules.roleApplications?.pending || 0)
  // Solo pagos reales: un pedido en modo demo nunca cobro nada, asi que su
  // fallo/reembolso no es una alerta financiera.
  const failedPayments = mappedPayments.filter(payment => !payment.demo && ['fallido', 'reembolso'].includes(payment.status))
  const paidPayments = mappedPayments.filter(payment => payment.status === 'pagado')
  // Indice simple de la cola admin: 100 sin pendientes, baja por cada reporte
  // abierto, pago con alerta o solicitud sin revisar. Sin piso artificial.
  const health = Math.max(0, Math.min(100, 100 - (openReports.length * 6) - (failedPayments.length * 4) - (pendingApprovals.length * 3)))

  const kpis = [
    { label: 'Usuarios totales', value: totalUsers, meta: `${activeUsers} activos · ${bannedUsers} baneados`, icon: Icon.users, tone: 'green' },
    { label: 'Torneos', value: totalTournaments, meta: `${liveTournaments} en vivo ahora`, icon: Icon.trophy, tone: 'yellow' },
    { label: 'Equipos', value: realTeams.length || '—', meta: `${realTeams.filter(t => t.status === 'Activo').length} activos`, icon: Icon.gamepad, tone: 'purple' },
    { label: 'Pendiente admin', value: pendingApprovals.length + openReports.length, meta: `${pendingApprovals.length} autorizaciones · ${openReports.length} reportes`, icon: Icon.shield, tone: 'red' },
  ]

  const quickActions = [
    { label: 'Autorizar solicitudes', desc: 'Roles, torneos, becas y reembolsos', icon: Icon.check, to: '/admin/autorizaciones' },
    { label: 'Moderar reportes', desc: 'Revisar conducta y sanciones', icon: Icon.shield, to: '/admin/moderacion' },
    { label: 'Gestionar pagos', desc: 'Cobros, reembolsos y fallidos', icon: Icon.creditCard, to: '/admin/pagos' },
    { label: 'Publicar noticia', desc: 'Comunicados para la plataforma', icon: Icon.news, to: '/admin/noticias' },
  ]

  const activity = [
    { label: 'Reportes abiertos', value: openReports.length, detail: 'requieren revisión', tone: 'red' },
    { label: 'Pagos con alerta', value: failedPayments.length, detail: 'fallidos o reembolsos', tone: 'yellow' },
    { label: 'Acciones moderación', value: realModeration.length, detail: 'registradas', tone: 'purple' },
    { label: 'Solicitudes nuevas', value: pendingApprovals.length, detail: 'en bandeja', tone: 'green' },
  ]

  // Alerts
  const alerts = useMemo(() => {
    const out = []
    const summaryPendingAdmin = pendingApprovals.length + openReports.length
    if (summaryPendingAdmin > 0) out.push({ msg: `${summaryPendingAdmin} elementos requieren atencion admin (${pendingApprovals.length} autorizaciones, ${openReports.length} reportes)`, tone: 'red', to: '/admin/reportes' })
    if (openReports.length > 0) out.push({ msg: `${openReports.length} reportes abiertos requieren atención`, tone: 'red', to: '/admin/reportes' })
    if (failedPayments.length > 0) {
      const who = [...new Set(failedPayments.map(p => p.user))].slice(0, 3).join(', ')
      out.push({ msg: `${failedPayments.length} pago${failedPayments.length === 1 ? '' : 's'} fallido${failedPayments.length === 1 ? '' : 's'} o con reembolso: ${who}${failedPayments.length > 3 ? '…' : ''}`, tone: 'yellow', to: '/admin/pagos' })
    }
    if (pendingApprovals.length >= 3) out.push({ msg: `${pendingApprovals.length} solicitudes en cola de autorización`, tone: 'purple', to: '/admin/autorizaciones' })
    return out
  }, [openReports, failedPayments, pendingApprovals, summaryPendingAdmin, summaryApprovals, summaryReports])

  const maxRegion = Math.max(1, ...USERS_BY_REGION.map(r => r.value))
  const maxGrowth = GROWTH_DATA.length ? Math.max(...GROWTH_DATA.map(g => g.users)) : 1
  const minGrowth = GROWTH_DATA.length ? Math.min(...GROWTH_DATA.map(g => g.users)) : 0
  const growthRange = maxGrowth - minGrowth || 1
  const growthPct = GROWTH_DATA.length >= 2 && GROWTH_DATA[0].users > 0
    ? Math.round(((GROWTH_DATA[GROWTH_DATA.length - 1].users - GROWTH_DATA[0].users) / GROWTH_DATA[0].users) * 100)
    : 0

  return (
    <div className="gg-admin-page gg-admin-home">
      {/* ── Urgent Alerts ── */}
      {alerts.length > 0 && (
        <motion.div className="gg-dash-alerts" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          {alerts.map(a => (
            <button key={a.msg} className={`gg-dash-alert gg-dash-alert--${a.tone}`} onClick={() => navigate(a.to)}>
              {Icon.alert}
              <span>{a.msg}</span>
              <span className="gg-dash-alert__go">{Icon.chevronRight}</span>
            </button>
          ))}
        </motion.div>
      )}

      <motion.section
        className="gg-admin-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="gg-admin-hero__copy">
          <span className="gg-admin-hero__eyebrow">{Icon.shield} Centro de control</span>
          <h1>Panel administrativo de GlitchGang</h1>
          <p>Monitorea usuarios, pagos, reportes, torneos y autorizaciones desde una sola consola.</p>
          <div className="gg-admin-hero__actions">
            <Button size="sm" variant="primary" onClick={() => navigate('/admin/autorizaciones')}>Revisar pendientes</Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/usuarios')}>Ver usuarios</Button>
          </div>
        </div>

        <div className="gg-admin-health">
          <div className="gg-admin-health__ring">
            <div className="gg-admin-health__progress" style={{ background: `conic-gradient(var(--accent) ${health}%, rgba(255,255,255,.08) 0)` }} />
            <strong>{health}%</strong>
            <span>salud</span>
          </div>
          <div>
            <b>Estado operativo</b>
            <p>{health >= 85 ? 'Plataforma estable' : 'Atención requerida en la cola admin'}</p>
          </div>
        </div>
      </motion.section>

      <section className="gg-admin-home__kpis">
        {kpis.map((item, index) => (
          <motion.article
            className={`gg-admin-kpi gg-admin-kpi--${item.tone}`}
            key={item.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * .05 }}
          >
            <span className="gg-admin-kpi__icon">{item.icon}</span>
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <p>{item.meta}</p>
            </div>
          </motion.article>
        ))}
      </section>

      <section className="gg-admin-command-grid">
        <motion.div className="gg-admin-panel gg-admin-panel--wide" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.check} Cola de autorizaciones</h3>
              <p>Lo que necesita aprobación antes de mostrarse o ejecutarse.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/autorizaciones')}>Abrir bandeja</Button>
          </div>
          <DataTable
            columns={[
              { key: 'type', label: 'Tipo' },
              { key: 'title', label: 'Solicitud' },
              { key: 'requester', label: 'Solicitante' },
              { key: 'status', label: 'Estado', render: row => <StatusPill status={row.status} /> },
            ]}
            rows={pendingApprovals.slice(0, 6)}
          />
        </motion.div>

        <motion.aside className="gg-admin-panel gg-admin-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.bolt} Acciones rápidas</h3>
              <p>Atajos para operar la plataforma.</p>
            </div>
          </div>
          {quickActions.map(action => (
            <button className="gg-admin-action" key={action.to} onClick={() => navigate(action.to)}>
              <span>{action.icon}</span>
              <div><b>{action.label}</b><small>{action.desc}</small></div>
            </button>
          ))}
        </motion.aside>
      </section>

      <section className="gg-admin-signal-grid">
        {activity.map(item => (
          <article className={`gg-admin-signal gg-admin-signal--${item.tone}`} key={item.label}>
            <b>{item.value}</b>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      {/* ── Charts Section ── */}
      <section className="gg-dash-charts">
        {/* Users by Region */}
        <motion.div className="gg-admin-panel gg-dash-chart" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.globe} Usuarios por región</h3>
              <p>Distribución geográfica de la base de jugadores</p>
            </div>
          </div>
          <div className="gg-dash-bars">
            {USERS_BY_REGION.map((r, i) => (
              <motion.div key={r.label} className="gg-dash-bar" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .25 + i * .04 }}>
                <span className="gg-dash-bar__label">{r.label}</span>
                <div className="gg-dash-bar__track">
                  <motion.div className="gg-dash-bar__fill" style={{ background: r.color }}
                    initial={{ width: 0 }} animate={{ width: `${(r.value / maxRegion) * 100}%` }}
                    transition={{ delay: .3 + i * .06, duration: .5, ease: 'easeOut' }} />
                </div>
                <span className="gg-dash-bar__value">{r.value.toLocaleString()}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Growth Chart */}
        <motion.div className="gg-admin-panel gg-dash-chart" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.trend} Crecimiento de usuarios</h3>
              <p>Últimos 6 meses · {growthPct > 0 ? '+' : ''}{growthPct}% total</p>
            </div>
          </div>
          <div className="gg-dash-growth">
            <div className="gg-dash-growth__chart">
              {GROWTH_DATA.map((g, i) => {
                const h = ((g.users - minGrowth) / growthRange) * 100
                return (
                  <motion.div key={g.month} className="gg-dash-growth__col"
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: .3 + i * .08, duration: .4 }}>
                    <div className="gg-dash-growth__bar" style={{ height: `${Math.max(h, 8)}%` }}>
                      <span className="gg-dash-growth__val">{(g.users / 1000).toFixed(1)}k</span>
                    </div>
                    <span className="gg-dash-growth__mo">{g.month}</span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>

        {/* Top Games */}
        <motion.div className="gg-admin-panel gg-dash-chart" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.gamepad} Top juegos</h3>
              <p>Distribución por título competitivo</p>
            </div>
          </div>
          <div className="gg-dash-games">
            {TOP_GAMES.map((g, i) => (
              <motion.div key={g.game} className="gg-dash-game" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 + i * .04 }}>
                <span className="gg-dash-game__rank">{i + 1}</span>
                <div className="gg-dash-game__info">
                  <b>{g.game}</b>
                  <small>{g.players.toLocaleString()} jugadores</small>
                </div>
                <div className="gg-dash-game__bar">
                  <motion.span style={{ width: `${g.pct}%` }}
                    initial={{ width: 0 }} animate={{ width: `${g.pct}%` }}
                    transition={{ delay: .4 + i * .06, duration: .5 }} />
                </div>
                <b className="gg-dash-game__pct">{g.pct}%</b>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Activity Timeline ── */}
      <section className="gg-admin-command-grid">
        <motion.div className="gg-admin-panel gg-dash-timeline-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .32 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.clock} Actividad reciente</h3>
              <p>Últimas acciones administrativas en la plataforma</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/logs')}>Ver logs completos</Button>
          </div>
          <div className="gg-dash-timeline">
            {ACTIVITY_FEED.map((item, i) => (
              <motion.div key={item.id} className="gg-dash-tl" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .35 + i * .05 }}>
                <span className="gg-dash-tl__dot" style={{ background: item.color }}>{item.icon}</span>
                <div className="gg-dash-tl__body">
                  <p><b>{item.admin}</b> {item.action} <b>{item.target}</b></p>
                  <small>{item.detail}</small>
                </div>
                <span className="gg-dash-tl__time">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div className="gg-admin-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.creditCard} Pagos recientes</h3>
              <p>Cobros confirmados y alertas financieras.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/pagos')}>Ver pagos</Button>
          </div>
          <DataTable
            columns={[
              { key: 'user', label: 'Usuario' },
              { key: 'plan', label: 'Plan' },
              { key: 'amount', label: 'Monto' },
              { key: 'status', label: 'Estado', render: row => <StatusPill status={row.status} /> },
            ]}
            rows={mappedPayments.slice(0, 5)}
          />
        </motion.div>
      </section>

      <section className="gg-admin-command-grid">
        <motion.div className="gg-admin-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .37 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.alert} Reportes abiertos</h3>
              <p>Incidentes activos de comunidad y torneos.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/reportes')}>Ver reportes</Button>
          </div>
          <DataTable
            columns={[
              { key: 'reporter', label: 'De' },
              { key: 'target', label: 'Contra' },
              { key: 'reason', label: 'Motivo' },
              { key: 'status', label: 'Estado', render: row => <StatusPill status={row.status} /> },
            ]}
            rows={openReports.slice(0, 4)}
          />
        </motion.div>

        <motion.div className="gg-admin-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}>
          <div className="gg-admin-panel__head">
            <div>
              <h3>{Icon.trend} Resumen rápido</h3>
              <p>Métricas de crecimiento y engagement</p>
            </div>
          </div>
          <div className="gg-dash-summary">
            <div className="gg-dash-sumrow"><span>Usuarios registrados</span><b style={{ color: '#00E5A0' }}>{totalUsers}</b></div>
            <div className="gg-dash-sumrow"><span>Torneos en vivo</span><b style={{ color: '#ffe600' }}>{liveTournaments}</b></div>
            <div className="gg-dash-sumrow"><span>Equipos registrados</span><b style={{ color: '#7c3aed' }}>{realTeams.length || '—'}</b></div>
            <div className="gg-dash-sumrow"><span>Torneos totales</span><b style={{ color: '#3b82f6' }}>{totalTournaments}</b></div>
            <div className="gg-dash-sumrow"><span>Usuarios verificados</span><b style={{ color: '#06b6d4' }}>{realPlayers.filter(p => p.verified).length}</b></div>
            <div className="gg-dash-sumrow"><span>Usuarios baneados</span><b style={{ color: '#f59e0b' }}>{realPlayers.filter(p => p.status === 'ban').length || bannedUsers}</b></div>
          </div>
        </motion.div>
      </section>
    </div>
  )
}

