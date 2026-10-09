import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import TournamentIdentityCorner from '../../../components/TournamentIdentityCorner/TournamentIdentityCorner.jsx'
import { getGameArt } from '../../../data/organizerTournaments.js'
import { normalizeTournaments, STATUS_LABEL } from '../../../lib/tournamentAdapter.js'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import './OrganizerDashboard.css'
import StaffInvitations from '../../../components/StaffInvitations/StaffInvitations.jsx'

const DISCORD_ACCESS_LABEL = {
  pending: 'Tu solicitud de acceso a Discord esta pendiente de aprobacion del admin.',
  revoked: 'Un admin revoco tu acceso a Discord. Podes volver a solicitarlo desde el asistente.',
}

function OrganizerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [discordAccess, setDiscordAccess] = useState('none')
  const [draft, setDraft] = useState(null)
  const [confirmDraftDelete, setConfirmDraftDelete] = useState(false)
  const [deletingDraft, setDeletingDraft] = useState(false)

  useEffect(() => {
    tournamentsApi.list({ mine: 'true', limit: 200 })
      .then(data => setTournaments(normalizeTournaments(data.tournaments)))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false))
    api('/organizations/discord-access').then(d => setDiscordAccess(d.status || 'none')).catch(() => {})
    tournamentsApi.draft().then(d => setDraft(d.draft || null)).catch(() => {})
  }, [])

  const deleteDraft = async () => {
    if (!draft?.creationKey) { setDraft(null); return }
    setDeletingDraft(true)
    try {
      await tournamentsApi.deleteDraft(draft.creationKey)
      setDraft(null)
      setConfirmDraftDelete(false)
      toast('Borrador eliminado', 'success')
    } catch (err) {
      toast(err?.message || 'No se pudo eliminar el borrador', 'error')
    } finally {
      setDeletingDraft(false)
    }
  }

  const hasSavedDraft = Boolean(draft?.form && (draft.step > 0 || draft.form.title || draft.form.gameId))
  const savedDraftCount = hasSavedDraft ? 1 : 0

  const stats = {
    total: tournaments.length,
    draft: tournaments.filter(t => t.status === 'draft').length + savedDraftCount,
    live: tournaments.filter(t => t.status === 'live').length,
    upcoming: tournaments.filter(t => t.status === 'upcoming').length,
    finished: tournaments.filter(t => t.status === 'finished').length,
    pendingStaff: tournaments.reduce((n, t) => n + (t.pendingStaff || 0), 0),
  }

  const filtered = tournaments.filter(t => filterStatus === 'all' || t.status === filterStatus)

  return (
    <div className="org-dash">
      <StaffInvitations compact />
      <motion.div className="org-dash__header org-dash__header--role-id" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="organizer" profile={user} isOwner />
        <div>
          <h1>Mis Torneos</h1>
          <p>Gestiona tus eventos, premios y participantes</p>
        </div>
        <button className="org-btn org-btn--primary" onClick={() => navigate('/torneos/crear')}>
          {Icon.plus} Crear Torneo
        </button>
      </motion.div>

      <motion.div className="org-dash__stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="org-dstat">
          <div className="org-dstat__icon">{Icon.trophy}</div>
          <div className="org-dstat__body"><b>{stats.total}</b><span>Torneos totales</span></div>
        </div>
        <div className="org-dstat">
          <div className="org-dstat__icon org-dstat__icon--red">{Icon.play}</div>
          <div className="org-dstat__body"><b>{stats.live}</b><span>En vivo</span></div>
        </div>
        <div className="org-dstat">
          <div className="org-dstat__icon org-dstat__icon--amber">{Icon.clock}</div>
          <div className="org-dstat__body"><b>{stats.upcoming}</b><span>Próximos</span></div>
        </div>
        <div className="org-dstat">
          <div className="org-dstat__icon org-dstat__icon--blue">{Icon.team}</div>
          <div className="org-dstat__body"><b>{stats.pendingStaff}</b><span>Staff sin confirmar</span></div>
        </div>
      </motion.div>

      {DISCORD_ACCESS_LABEL[discordAccess] && (
        <div className="org-dash__banner">
          {Icon.discord} <span>{DISCORD_ACCESS_LABEL[discordAccess]}</span>
        </div>
      )}

      <motion.div className="org-dash__filters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        {[
          { key: 'all', label: `Todos (${tournaments.length})` },
          { key: 'draft', label: `Borradores (${stats.draft})` },
          { key: 'live', label: `En vivo (${stats.live})` },
          { key: 'upcoming', label: `Próximos (${stats.upcoming})` },
          { key: 'finished', label: `Finalizados (${stats.finished})` },
        ].map(f => (
          <button
            key={f.key}
            className={`org-chip ${filterStatus === f.key ? 'active' : ''}`}
            onClick={() => setFilterStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      <div className="org-dash__grid">
        {['all', 'draft'].includes(filterStatus) && hasSavedDraft && (
          <div className="org-tcard org-tcard--draft">
            <div className="org-tcard__banner org-tcard__banner--draft">
              <span className="org-tcard__status org-tcard__status--draft">Borrador</span>
              {Icon.edit}
            </div>
            <div className="org-tcard__body">
              <h3>{draft.form.title || 'Torneo sin nombre'}</h3>
              <div className="org-tcard__format">{draft.form.game || 'Juego sin elegir'} · paso {(draft.step ?? 0) + 1} de 6</div>
              <p className="org-tcard__draft-hint">Sin publicar. Continúa donde lo dejaste.</p>
            </div>
            {confirmDraftDelete ? (
              <div className="org-tcard__confirm" role="alertdialog" aria-label="Eliminar borrador">
                <p>¿Estás seguro de que deseas eliminar este borrador?</p>
                <div className="org-tcard__actions">
                  <button type="button" className="org-tbtn org-tbtn--ghost" onClick={() => setConfirmDraftDelete(false)} disabled={deletingDraft}>Cancelar</button>
                  <button type="button" className="org-tbtn org-tbtn--danger" onClick={deleteDraft} disabled={deletingDraft}>
                    {Icon.trash} {deletingDraft ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="org-tcard__actions">
                <button type="button" className="org-tbtn org-tbtn--ghost" onClick={() => setConfirmDraftDelete(true)}>{Icon.trash} Eliminar</button>
                <button type="button" className="org-tbtn org-tbtn--solid" onClick={() => navigate('/torneos/crear')}>{Icon.edit} Continuar borrador</button>
              </div>
            )}
          </div>
        )}
        {filtered.map((t, i) => {
          const art = getGameArt(t.game)
          return (
          <motion.div
            key={t.id}
            className="org-tcard org-tcard--role-id"
            style={{ '--gc': t.primaryColor || art.color }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.05 }}
          >
            <TournamentIdentityCorner tournament={t} isOwner />
            <div className="org-tcard__banner" style={{ backgroundImage: `url(${t.banner || art.image})` }}>
              <div className="org-tcard__scrim" />
              <span className="org-tcard__game">
                {t.logo || art.logo
                  ? <img src={t.logo || art.logo} alt={t.game} />
                  : <span className="org-tcard__game-txt">{t.game}</span>}
              </span>
              <span className={`org-tcard__status org-tcard__status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
            </div>

            <div className="org-tcard__body">
              <h3>{t.title}</h3>
              {t.seasonName && <div className="org-tcard__series">{Icon.copy} {t.seasonName} · Temporada {t.seasonNumber}</div>}
              <div className="org-tcard__format">{Icon.award} {t.format}</div>
              <div className="org-tcard__badges">
                {t.discordEnabled && <span className="org-tcard__badge org-tcard__badge--discord">{Icon.discord} Discord</span>}
                {t.pendingStaff > 0 && <span className="org-tcard__badge org-tcard__badge--warn">{t.pendingStaff} staff sin confirmar</span>}
              </div>

              <div className="org-tcard__meta">
                <div>
                  <span className="org-tcard__label">Inicio</span>
                  <span className="org-tcard__val">{t.startDate} · {t.startTime}</span>
                </div>
                <div>
                  <span className="org-tcard__label">Prize Pool</span>
                  <span className="org-tcard__val org-tcard__val--accent">${t.prizePool.toLocaleString()}</span>
                </div>
              </div>

              <div className="org-tcard__progress">
                <div className="org-tcard__progress-top">
                  <span>Inscritos</span>
                  <span>{t.registered}/{t.capacity}</span>
                </div>
                <div className="org-bar">
                  <div
                    className="org-bar__fill"
                    style={{
                      width: `${(t.registered / t.capacity) * 100}%`,
                      background: t.registered === t.capacity ? '#22c55e' : t.primaryColor,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="org-tcard__actions">
              <button className="org-tbtn org-tbtn--ghost" onClick={() => navigate(`/organizador/torneo/${t.id}`)}>
                {Icon.eye} Ver
              </button>
              <button className="org-tbtn org-tbtn--solid" onClick={() => navigate(`/organizador/torneo/${t.id}/gestionar`)}>
                {Icon.gear} Gestionar
              </button>
            </div>
          </motion.div>
          )
        })}
      </div>

      {loading && (
        <div className="org-dash__empty">
          <GGLoader label="Sincronizando torneos" size="sm" />
        </div>
      )}

      {!loading && filtered.length === 0 && !(['all', 'draft'].includes(filterStatus) && hasSavedDraft) && (
        <div className="org-dash__empty">
          <div className="org-dash__empty-icon">{Icon.calendar}</div>
          <h3>Sin torneos en esta categoría</h3>
          <p>Crea tu primer torneo para empezar a recibir inscripciones</p>
          <button className="org-btn org-btn--primary" onClick={() => navigate('/torneos/crear')}>
            {Icon.plus} Crear Torneo
          </button>
        </div>
      )}
    </div>
  )
}

export { OrganizerDashboard }
export default OrganizerDashboard

