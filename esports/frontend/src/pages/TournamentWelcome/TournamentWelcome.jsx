// Pantalla exclusiva de bienvenida al torneo, apenas un equipo se inscribe.
// No reutiliza TorneoDetalle (la pagina publica) -- es su propia ruta,
// pensada para el momento de mayor entusiasmo del jugador: quien es el
// staff, cuando es el check-in, y por donde va a pasar toda la comunicacion
// del torneo (Discord/WhatsApp), con un llamado claro a su panel de equipo.
import { useEffect, useState } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../components/icons/Icons.jsx'
import { getGameArt } from '../../data/organizerTournaments.js'
import { normalizeTournament } from '../../lib/tournamentAdapter.js'
import { tournamentsApi } from '../../lib/serverApi.js'
import { api } from '../../lib/api.js'
import './TournamentWelcome.css'

const STAFF_ICON = {
  Director: 'crown',
  Administrador: 'shield',
  Arbitro: 'award',
  Moderador: 'lock',
  Caster: 'tv',
  Produccion: 'camera',
}

const STELIANT_ESPORTS_DISCORD_URL = 'https://discord.gg/bZTsanNB3G'

function fmtDeadline(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

const fadeUp = (i = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.12 * i, ease: 'easeOut' },
})

export default function TournamentWelcome() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [teamName, setTeamName] = useState(location.state?.teamName || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    tournamentsApi.get(id)
      .then(data => { if (alive) setTournament(normalizeTournament(data)) })
      .catch(() => { if (alive) setTournament(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  // Si no venimos con el nombre del equipo en el state (por ej. alguien
  // refresca esta pantalla), lo resolvemos por el teamId o por el equipo
  // principal de quien está logueado -- mejor esfuerzo, nunca bloquea la
  // pantalla si no se puede resolver.
  useEffect(() => {
    if (teamName || !location.state?.teamId) return
    let alive = true
    api('/teams/mine')
      .then(t => { if (alive && t?.name) setTeamName(t.name) })
      .catch(() => {})
    return () => { alive = false }
  }, [location.state?.teamId, teamName])

  if (loading) {
    return <div className="tw-page tw-page--loading"><p>Preparando tu bienvenida...</p></div>
  }

  if (!tournament) {
    return (
      <div className="tw-page tw-page--loading">
        <p>No pudimos encontrar este torneo.</p>
        <button className="tw-btn" onClick={() => navigate('/torneos')}>Volver a Torneos</button>
      </div>
    )
  }

  const art = getGameArt(tournament.game)
  const acceptedStaff = (tournament.staffMembers || []).filter(m => m.status !== 'declined')
  const checkinWhen = fmtDeadline(tournament.checkinDeadlineIso)
  const hasDiscord = tournament.discordEnabled
  const discordUrl = STELIANT_ESPORTS_DISCORD_URL
  const hasWhatsapp = tournament.whatsappEnabled || tournament.contactPhone
  const waLink = tournament.contactPhone ? `https://wa.me/${String(tournament.contactPhone).replace(/[^0-9]/g, '')}` : ''

  return (
    <div className="tw-page" style={{ '--tw-accent': tournament.primaryColor || '#00E676' }}>
      <div className="tw-bg" style={art?.image ? { backgroundImage: `url(${art.image})` } : undefined} />
      <div className="tw-bg-scan" />

      <motion.div className="tw-confetti" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.span
            key={i}
            className="tw-confetti__piece"
            style={{ left: `${(i * 37) % 100}%`, '--delay': `${(i % 8) * 0.18}s`, '--hue': `${(i * 47) % 360}deg` }}
          />
        ))}
      </motion.div>

      <div className="tw-content">
        <motion.div className="tw-hero" {...fadeUp(0)}>
          <motion.div
            className="tw-hero__check"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
          >
            {Icon.check}
          </motion.div>
          <span className="tw-eyebrow">{Icon.trophy} Inscripción confirmada</span>
          <h1>¡Bienvenido a<br /><span>{tournament.title}</span>!</h1>
          <p className="tw-hero__sub">
            {teamName ? <><b>{teamName}</b> ya está</> : 'Tu equipo ya está'} inscrito en <b>{tournament.game}</b>. Esto es todo lo que necesitan para llegar listos.
          </p>
        </motion.div>

        <div className="tw-grid">
          <motion.section className="tw-card" {...fadeUp(1)}>
            <h3>{Icon.users} Staff del torneo</h3>
            {acceptedStaff.length ? (
              <div className="tw-staff-list">
                {acceptedStaff.map(m => (
                  <div className="tw-staff" key={m.user || m.nick}>
                    {m.avatar
                      ? <img src={m.avatar} alt={m.nick || m.name} />
                      : <div className="tw-staff__fallback">{(m.nick || m.name || '??').slice(0, 2).toUpperCase()}</div>}
                    <div className="tw-staff__info">
                      <b>{m.nick || m.name}</b>
                      <span>{Icon[STAFF_ICON[m.role]] || Icon.star} {m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tw-muted">El organizador todavía no asignó staff a este torneo.</p>
            )}
          </motion.section>

          <motion.section className="tw-card" {...fadeUp(2)}>
            <h3>{Icon.clock} Check-in</h3>
            {checkinWhen ? (
              <>
                <p className="tw-checkin-when">{checkinWhen}</p>
                <p className="tw-muted">
                  Tenés {tournament.checkinConfig?.prematchMins ?? 30} minutos antes del inicio para confirmar presencia,
                  con {tournament.checkinConfig?.toleranceMins ?? 10} min de tolerancia
                  {tournament.checkinConfig?.autoWalkover ? ' (si no llegan, pierden el cupo automáticamente)' : ''}.
                </p>
              </>
            ) : (
              <p className="tw-muted">El organizador todavía no fijó el horario de check-in — te vamos a avisar apenas lo haga.</p>
            )}
          </motion.section>

          {(hasDiscord || hasWhatsapp) && (
            <motion.section className="tw-card tw-card--wide" {...fadeUp(3)}>
              <h3>{Icon.chat} Toda la comunicación del torneo</h3>
              <p className="tw-muted">Este torneo se coordina por acá — horarios, rivales y avisos importantes salen por estos canales, no por la web.</p>
              <div className="tw-channels">
                {hasDiscord && (
                  <a className="tw-channel tw-channel--link tw-channel--discord" href={safeHref(discordUrl)} target="_blank" rel="noopener noreferrer">
                    {Icon.discord}
                    <div>
                      <b>Discord</b>
                      <span>Entrar al servidor oficial de GlitchGang</span>
                    </div>
                  </a>
                )}
                {hasWhatsapp && (
                  <a className="tw-channel tw-channel--link" href={waLink || undefined} target="_blank" rel="noopener noreferrer">
                    {Icon.whatsapp}
                    <div>
                      <b>WhatsApp</b>
                      <span>{tournament.contactPhone || 'Grupo del torneo'}</span>
                    </div>
                  </a>
                )}
              </div>
            </motion.section>
          )}
        </div>

        <motion.div className="tw-final" {...fadeUp(4)}>
          <p>Toda esta información queda siempre disponible en tu panel — no hace falta que la memorices.</p>
          <div className="tw-final__actions">
            <Link className="tw-btn tw-btn--primary" to="/mi-equipo/enfrentamiento">{Icon.target} Ir a mi equipo: enfrentamiento</Link>
            <Link className="tw-btn" to={`/torneos/${tournament.id}`}>{Icon.eye} Ver el torneo</Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

