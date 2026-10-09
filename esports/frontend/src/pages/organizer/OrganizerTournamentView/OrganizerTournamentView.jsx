import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { getGameArt } from '../../../data/organizerTournaments.js'
import { normalizeTournament, STATUS_LABEL } from '../../../lib/tournamentAdapter.js'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { downloadTournamentPdf, printTournamentDoc } from '../../../lib/tournamentDoc.js'
import './OrganizerTournamentView.css'

export default function OrganizerTournamentView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [t, setT] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    tournamentsApi.get(id)
      .then(data => setT(normalizeTournament(data)))
      .catch(() => setT(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="otv-notfound"><p>Cargando...</p></div>
  }

  if (!t) {
    return (
      <div className="otv-notfound">
        <div className="otv-notfound__icon">{Icon.alert}</div>
        <h2>Torneo no encontrado</h2>
        <button className="otv-btn otv-btn--primary" onClick={() => navigate('/organizador')}>Volver</button>
      </div>
    )
  }

  const occupancy = Math.round((t.registered / t.capacity) * 100)
  const art = getGameArt(t.game)

  return (
    <div className="otv">
      <button className="otv__back" onClick={() => navigate('/organizador')}>
        {Icon.chevronRight} <span>Mis Torneos</span>
      </button>

      {/* Hero */}
      <motion.div
        className="otv__hero otv__hero--art"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ '--tc': t.primaryColor }}
      >
        <div className="otv__hero-bg" style={{ backgroundImage: `url(${t.banner || art.image})` }} />
        <div className="otv__hero-scrim" />
        {(t.logo || art.logo) && <img className="otv__hero-logo" src={t.logo || art.logo} alt={t.game} />}
        <div className="otv__hero-content">
          <div className="otv__hero-top">
            <span className="otv__game">{t.game}</span>
            <span className={`otv__status otv__status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
          </div>
          <h1>{t.title}</h1>
          <div className="otv__hero-meta">
            <span>{Icon.award} {t.format}</span>
            <span>{Icon.calendar} {t.startDate} · {t.startTime}</span>
            <span>{Icon.globe} {t.region}</span>
          </div>
          <span className="otv__readonly">{Icon.eye} Vista de solo lectura</span>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="otv__stats">
        <Stat icon={Icon.users} label="Inscritos" value={`${t.registered}/${t.capacity}`} sub={`${occupancy}% ocupado`} />
        <Stat icon={Icon.trophy} label="Prize Pool" value={`$${t.prizePool.toLocaleString()}`} />
        <Stat icon={Icon.creditCard} label="Cuota" value={t.entryFee ? `$${t.entryFee}` : 'Gratis'} />
        <Stat icon={Icon.trend} label="Ingresos" value={`$${t.revenue.toLocaleString()}`} />
      </div>

      <div className="otv__grid">
        {/* Descripción */}
        <section className="otv__card otv__card--wide">
          <h3>Descripción</h3>
          <p>{t.description}</p>
        </section>

        {/* Reglas y reglamento */}
        <section className="otv__card otv__card--wide">
          <div className="otv__rules-head">
            <h3>{Icon.fileText} Reglas y reglamento</h3>
            <div className="otv__rules-actions">
              <button className="otv-btn otv-btn--ghost otv-btn--sm" onClick={() => printTournamentDoc(t)}>
                {Icon.printer} Imprimir
              </button>
              <button className="otv-btn otv-btn--primary otv-btn--sm" onClick={() => downloadTournamentPdf(t)}>
                {Icon.download} Descargar PDF
              </button>
            </div>
          </div>
          {t.rules?.length ? (
            <ol className="otv__rules">
              {t.rules.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          ) : (
            <p className="otv__muted">Sin reglas publicadas.</p>
          )}
        </section>

        {/* Premios */}
        <section className="otv__card">
          <h3>{Icon.trophy} Premios</h3>
          <div className="otv__prizes">
            {t.prizes.map((p, i) => (
              <div className="otv__prize" key={i}>
                <span className="otv__prize-medal">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                <div className="otv__prize-info">
                  <b>{p.place}</b>
                  {p.extra && <span>{p.extra}</span>}
                </div>
                <span className="otv__prize-amount">${Number(p.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Staff */}
        <section className="otv__card">
          <h3>{Icon.users} Staff</h3>
          {(t.staffMembers || []).length === 0 ? (
            <p className="otv__muted">Sin staff asignado</p>
          ) : (
            <div className="otv__collabs">
              {t.staffMembers.map((m, i) => (
                <div className="otv__collab" key={m.user || i}>
                  {m.avatar
                    ? <img src={m.avatar} alt={m.nick || m.name} />
                    : <div className="otv__collab-fallback">{(m.nick || m.name || '??').slice(0, 2).toUpperCase()}</div>}
                  <div>
                    <b>{m.nick || m.name}</b>
                    <span>{m.role} · {m.status === 'accepted' ? 'confirmado' : m.status === 'declined' ? 'rechazó' : 'pendiente'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Integraciones */}
        <section className="otv__card otv__card--wide">
          <h3>{Icon.bolt} Integraciones</h3>
          <div className="otv__integrations">
            <div className="otv__integration" style={{ '--brand': '#5865F2' }}>
              <div className="otv__integration-logo">{Icon.discord}</div>
              <div className="otv__integration-body">
                <b>Discord</b>
                <span className={t.integrations.discord.connected ? 'otv__on' : 'otv__off'}>
                  {t.integrations.discord.connected ? `Conectado · ${t.integrations.discord.server}` : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="otv__cta">
        <button className="otv-btn otv-btn--primary" onClick={() => navigate(`/organizador/torneo/${t.id}/gestionar`)}>
          {Icon.gear} Gestionar este torneo
        </button>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub }) {
  return (
    <div className="otv__stat">
      <div className="otv__stat-icon">{icon}</div>
      <div className="otv__stat-body">
        <span className="otv__stat-label">{label}</span>
        <b className="otv__stat-value">{value}</b>
        {sub && <span className="otv__stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

