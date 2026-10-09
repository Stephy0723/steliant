import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { crmApi, CRM_BASE } from '../../../lib/crmApi.js'
import BotIntegrations from './BotIntegrations.jsx'
import './OrganizerCRM.css'

const TABS = [
  { key: 'integraciones', label: 'Integraciones', icon: Icon.layoutGrid },
  { key: 'resumen',     label: 'Resumen',     icon: Icon.dashboard },
  { key: 'torneos',     label: 'Torneos',     icon: Icon.trophy },
  { key: 'leaderboard', label: 'Leaderboard', icon: Icon.crown },
  { key: 'disputas',    label: 'Disputas',    icon: Icon.alert },
]

function countMetrics(tournaments = []) {
  let teams = 0, players = 0, leaders = 0, verified = 0
  for (const t of tournaments) {
    for (const team of t.teams || []) {
      teams++
      for (const p of team.players || []) {
        players++
        if (p.isLeader) leaders++
        if (p.identityVerified) verified++
      }
    }
  }
  return { tournaments: tournaments.length, teams, players, leaders, verified }
}

export default function OrganizerCRM() {
  const [tab, setTab] = useState('integraciones')
  const [boot, setBoot] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [b, lb, dp] = await Promise.all([
        crmApi('/bootstrap'),
        crmApi('/leaderboard').catch(() => []),
        crmApi('/reports/disputes').catch(() => []),
      ])
      setBoot(b)
      setLeaderboard(Array.isArray(lb) ? lb : [])
      setDisputes(Array.isArray(dp) ? dp : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const tournaments = boot?.tournaments || []
  const metrics = countMetrics(tournaments)
  const active = boot?.activeTournament
  const system = boot?.system || {}

  return (
    <div className="ocrm">
      {/* Header */}
      <div className="ocrm__header">
        <div>
          <h1>Centro de Torneos · CRM</h1>
          <p>
            Datos en vivo del bot de Discord
            <span className={`ocrm__conn ${error ? 'off' : 'on'}`}>{error ? '● Offline' : '● Conectado'}</span>
          </p>
        </div>
        <button className="ocrm__refresh" onClick={load} disabled={loading}>
          {Icon.bolt} {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="ocrm__tabs">
        {TABS.map(t => (
          <button key={t.key} className={`ocrm__tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon}<span>{t.label}</span>
            {t.key === 'disputas' && disputes.length > 0 && <span className="ocrm__tab-badge">{disputes.length}</span>}
          </button>
        ))}
      </div>

      {/* Integraciones no depende de la conexion al bot */}
      {tab === 'integraciones' && (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .18 }}>
            <BotIntegrations />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Estados */}
      {tab !== 'integraciones' && loading && <div className="ocrm__state">{Icon.bolt} Cargando datos del CRM...</div>}

      {tab !== 'integraciones' && error && !loading && (
        <div className="ocrm__offline">
          <div className="ocrm__offline-icon">{Icon.alert}</div>
          <h3>CRM del bot no disponible</h3>
          <p>No pude conectar con <code>{CRM_BASE}</code>.</p>
          <p className="ocrm__offline-hint">
            Arranca el servidor: <code>cd discord-bot</code> → <code>npm run api</code> (sirve en <code>CRM_PORT</code>).
          </p>
          <button className="ocrm__refresh" onClick={load}>{Icon.bolt} Reintentar</button>
        </div>
      )}

      {/* Contenido */}
      {tab !== 'integraciones' && !loading && !error && (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .18 }}>
            {tab === 'resumen' && <TabResumen metrics={metrics} active={active} system={system} />}
            {tab === 'torneos' && <TabTorneos tournaments={tournaments} />}
            {tab === 'leaderboard' && <TabLeaderboard rows={leaderboard} />}
            {tab === 'disputas' && <TabDisputas rows={disputes} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

/* ─────────── Resumen ─────────── */
function TabResumen({ metrics, active, system }) {
  const cards = [
    { label: 'Torneos', value: metrics.tournaments, icon: Icon.trophy, color: '#3b82f6' },
    { label: 'Equipos', value: metrics.teams, icon: Icon.users, color: '#06b6d4' },
    { label: 'Jugadores', value: metrics.players, icon: Icon.user, color: '#a855f7' },
    { label: 'Verificados', value: metrics.verified, icon: Icon.shield, color: '#22c55e' },
  ]
  return (
    <div className="ocrm__panel">
      <div className="ocrm__metrics">
        {cards.map(c => (
          <div className="ocrm__metric" key={c.label}>
            <span className="ocrm__metric-icon" style={{ background: `${c.color}1a`, color: c.color }}>{c.icon}</span>
            <div>
              <b>{c.value}</b>
              <span>{c.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ocrm__grid2">
        <div className="ocrm__card">
          <h3>{Icon.play} Torneo activo</h3>
          {active ? (
            <div className="ocrm__active">
              <div className="ocrm__active-name">{active.name}</div>
              <div className="ocrm__active-meta">
                <span>{(active.teams || []).length} equipos</span>
                <span className="ocrm__badge ocrm__badge--green">● Activo</span>
              </div>
            </div>
          ) : <p className="ocrm__muted">No hay un torneo activo en el bot.</p>}
        </div>

        <div className="ocrm__card">
          <h3>{Icon.gear} Estado del sistema</h3>
          <ul className="ocrm__kv">
            <li><span>Estado</span><b>{system.statusLabel || '—'}</b></li>
            <li><span>Entorno</span><b>{system.environment || '—'}</b></li>
            <li><span>Check-ins pendientes</span><b>{system.pendingCheckins ?? 0}</b></li>
            <li><span>Acceso CRM</span><b>{system.crmAccessMode || '—'}</b></li>
            <li><span>Discord</span><b className={system.discordConfigured ? 'ocrm-on' : 'ocrm-off'}>{system.discordConfigured ? 'Configurado' : 'No configurado'}</b></li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ─────────── Torneos ─────────── */
function TabTorneos({ tournaments }) {
  if (tournaments.length === 0) return <Empty icon={Icon.trophy} text="Sin torneos en el bot." />
  return (
    <div className="ocrm__panel">
      <div className="ocrm__tcards">
        {tournaments.map(t => {
          const teams = t.teams || []
          const players = teams.reduce((s, tm) => s + (tm.players || []).length, 0)
          return (
            <div className="ocrm__tcard" key={t.id}>
              <div className="ocrm__tcard-head">
                <b>{t.name}</b>
                {t.active && <span className="ocrm__badge ocrm__badge--green">● Activo</span>}
              </div>
              <div className="ocrm__tcard-stats">
                <div><b>{teams.length}</b><span>equipos</span></div>
                <div><b>{players}</b><span>jugadores</span></div>
                <div><b>{(typeof t.source === 'string' ? t.source : t.source?.type || t.source?.channel) || 'manual'}</b><span>origen</span></div>
              </div>
              <div className="ocrm__tcard-foot">
                <span className={`ocrm__badge ${t.bot?.enabled ? 'ocrm__badge--blue' : 'ocrm__badge--gray'}`}>
                  {t.bot?.enabled ? 'Bot activo' : 'Bot inactivo'}
                </span>
                {t.organizer?.name && <span className="ocrm__muted">por {t.organizer.name}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────── Leaderboard ─────────── */
function TabLeaderboard({ rows }) {
  if (rows.length === 0) return <Empty icon={Icon.crown} text="Aún no hay resultados en el leaderboard." />
  return (
    <div className="ocrm__panel">
      <div className="ocrm__table-wrap">
        <table className="ocrm__table">
          <thead>
            <tr><th>#</th><th>Equipo</th><th>V</th><th>D</th><th>E</th><th>Total</th><th>Winrate</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === 0 ? 'ocrm__leader' : ''}>
                <td><span className="ocrm__rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${r.rank || i + 1}`}</span></td>
                <td className="ocrm__team-name">{r.team}</td>
                <td className="ocrm__win">{r.wins}</td>
                <td className="ocrm__loss">{r.losses}</td>
                <td>{r.draws}</td>
                <td>{r.total}</td>
                <td><b>{r.winrate}%</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────── Disputas ─────────── */
function TabDisputas({ rows }) {
  if (rows.length === 0) return <Empty icon={Icon.check} text="No hay disputas abiertas. Todo en orden." />
  return (
    <div className="ocrm__panel">
      <div className="ocrm__disputes">
        {rows.map((r, i) => (
          <div className="ocrm__dispute" key={r.id || i}>
            <div className="ocrm__dispute-icon">{Icon.alert}</div>
            <div className="ocrm__dispute-body">
              <b>{r.type || r.reason || 'Disputa de resultado'}</b>
              <span className="ocrm__muted">{r.team || r.reporter || '—'} · {r.matchId || r.tournament || ''}</span>
            </div>
            <span className="ocrm__badge ocrm__badge--red">Abierta</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div className="ocrm__empty">
      <div className="ocrm__empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  )
}

