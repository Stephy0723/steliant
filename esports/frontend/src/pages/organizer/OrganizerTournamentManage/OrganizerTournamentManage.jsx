import { useState, useRef, useMemo, useEffect, useCallback, createContext, useContext } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { getGameArt } from '../../../data/organizerTournaments.js'
import { normalizeTournament, STATUS_LABEL, UI_TO_API_STATUS, competitionSummary } from '../../../lib/tournamentAdapter.js'
import { MANAGE_TABS, MANAGE_TAB_KEYS } from '../../../data/organizerManageTabs.js'
import { registerGGFields } from '../../../lib/ggAssistant.js'
import TabSalaStaff from './TabSalaStaff.jsx'
import BroadcastKit from './BroadcastKit.jsx'
import MatchStats from '../../../components/MatchStats/MatchStats.jsx'
import { isMobileLegends } from '../../../../../shared/matchStats.mjs'
import TabCompetencia from './TabCompetencia.jsx'
import { useNotifications } from '../../../context/NotificationsContext.jsx'
import { downloadTournamentPdf, printTournamentDoc, ROMAN } from '../../../lib/tournamentDoc.js'
import { buildTournamentRegulation } from '../../../lib/tournamentRegulation.js'
import {
  getBracket, saveBracket, pullBracket, normalizeFormat,
  buildSingleBracket, buildDoubleBracket,
  resolveBracketTeams, padToPow2, formatFromCompetition, seriesForRound, seriesTarget,
  computeStandings, roundRobinMatches, groupStage, swissPairings,
} from '../../../lib/bracketStore.js'
import { registrationsApi, reportsApi, tournamentsApi, uploadsApi } from '../../../lib/serverApi.js'
// toggleRoster usa api() directo; sin este import abrir el roster de una inscripción tiraba ReferenceError.
import { api } from '../../../lib/api.js'
import { safeHref } from '../../../lib/safeUrl.js'
import { instant, inputDateTime, STAFF_ROLES, STAFF_ROLE_BY_PLATFORM, PLATFORM_STAFF_ROLES } from '../../../../../shared/tournamentSetup.mjs'
import { modalitiesFor } from '../../../data/tournamentGameConfig.mjs'
import RoleStaffSearch from '../../../components/RoleStaffSearch/RoleStaffSearch.jsx'
import DiscordReports, { discordReportState } from '../../../components/MatchReport/DiscordReports.jsx'
import ResultsReview from '../../../components/ResultsReview/ResultsReview.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import {
  ACCESS_NONE, ACCESS_VIEW, ACCESS_EDIT, ACCESS_LEVELS, ACCESS_LABEL,
  roleDefaults, resolveMemberAccess, isCustomized, getLocalOverrides, setLocalOverride,
} from '../../../lib/staffPermissions.js'
import './OrganizerTournamentManage.css'
import './bracket.css'

function toDatetimeLocal(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function daysFromNowLocal(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toDatetimeLocal(date)
}

export default function OrganizerTournamentManage() {
  const { id, tab } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pushNotification } = useNotifications()
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const art = tournament ? getGameArt(tournament.game) : null
  const [savedFlash, setSavedFlash] = useState(false)

  // Quién soy respecto de este torneo: el dueño y un admin de GlitchGang
  // siempre tienen todo; cualquier otro staff pasa por la matriz de permisos
  // (ver staffPermissions.js). `tabAccess === null` significa "acceso total,
  // no hay que resolver nada" — así el resto del componente no tiene que
  // preguntar "¿soy dueño?" en cada punto.
  const myId = String(user?._id || user?.id || '')
  const isAdmin = user?.role === 'admin' || (user?.roles || []).includes('admin')
  const isOwner = Boolean(tournament && myId && tournament.organizerId === myId)
  const hasFullAccess = isAdmin || isOwner
  const myStaffRecord = useMemo(
    () => tournament?.staffMembers?.find(m => String(m.user) === myId) || null,
    [tournament, myId],
  )
  const tabAccess = useMemo(() => {
    if (hasFullAccess || !tournament) return null
    return myStaffRecord ? resolveMemberAccess(myStaffRecord, tournament.dbId || tournament.publicId) : {}
  }, [hasFullAccess, tournament, myStaffRecord])
  const allowedTabKeys = useMemo(
    () => (tabAccess ? MANAGE_TAB_KEYS.filter(k => tabAccess[k] && tabAccess[k] !== ACCESS_NONE) : MANAGE_TAB_KEYS),
    [tabAccess],
  )
  const activeTab = allowedTabKeys.includes(tab) ? tab : (allowedTabKeys[0] || 'resumen')
  const tabMeta = MANAGE_TABS.find(t => t.key === activeTab)
  const activeAccess = tabAccess ? (tabAccess[activeTab] || ACCESS_NONE) : ACCESS_EDIT
  // El backend ya valida esto por su cuenta (assertTabAccess/canWriteField en
  // tournament.controller.js), asi que el front solo necesita reflejar el
  // acceso resuelto de la persona para la pestaña activa: 'edit' habilita el
  // formulario, 'view' lo deja en solo lectura.
  const readOnly = !hasFullAccess && activeAccess !== ACCESS_EDIT

  const load = () => {
    setLoading(true)
    tournamentsApi.get(id)
      .then(data => setTournament(normalizeTournament(data)))
      .catch(() => setTournament(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  // Si la pestaña de la URL no está permitida para quien mira (o ya no existe
  // para ese torneo), redirige a la primera que sí tenga — así la URL nunca
  // queda apuntando a algo que el contenido no está mostrando en realidad.
  useEffect(() => {
    if (!tournament || !tab) return
    if (!allowedTabKeys.includes(tab)) {
      navigate(`/organizador/torneo/${tournament.dbId || tournament.id}/gestionar/${allowedTabKeys[0] || 'resumen'}`, { replace: true })
    }
  }, [tournament, tab, allowedTabKeys, navigate])

  // Guarda campos reales del torneo en el backend y refresca el estado local.
  const patchTournament = async (fields) => {
    const saved = await tournamentsApi.update(tournament.dbId || tournament.publicId, fields)
    setTournament(normalizeTournament(saved))
    pushNotification({
      type: 'torneo',
      category: 'torneos',
      tone: 'info',
      title: `Cambios en ${saved.title}`,
      subtitle: `El organizador actualizo "${tabMeta.label}"`,
      desc: `Se actualizo la seccion "${tabMeta.label}" del torneo ${saved.title}.`,
      from: `${saved.title} - Organizacion`,
      fullMessage: `El organizador realizo cambios en la seccion "${tabMeta.label}" de ${saved.title}.`,
      action: { label: 'Ver torneo', link: `/torneos/${saved.publicId}` },
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 3200)
    return saved
  }

  if (loading) {
    return <div className="otm-notfound"><p>Cargando torneo...</p></div>
  }

  if (!tournament) {
    return (
      <div className="otm-notfound">
        <div className="otm-notfound__icon">{Icon.alert}</div>
        <h2>Torneo no encontrado</h2>
        <button className="otm-btn otm-btn--primary" onClick={() => navigate('/organizador')}>
          Volver a mis torneos
        </button>
      </div>
    )
  }

  return (
    <div className="otm">
      {/* ── Header del torneo (fuera del sidebar) ── */}
      <div className="otm__head">
        <div
          className="otm__head-cover"
          style={art?.image
            ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.82), rgba(0,0,0,.35)), url(${art.image})` }
            : { background: `linear-gradient(135deg, ${tournament.primaryColor}, ${tournament.primaryColor}44)` }}
        >
          <div className="otm__head-info">
            <div className="otm__head-titles">
              <span className="otm__game">{tournament.game}</span>
              <h1>{tournament.title}</h1>
              <div className="otm__head-sub">
                <span className="otm__id">{tournament.publicId}</span>
                <span className={`otm__status otm__status--${tournament.status}`}>{STATUS_LABEL[tournament.status]}</span>
              </div>
            </div>
          </div>
          <div className="otm__head-actions">
            <button className="otm-btn otm-btn--ghost" onClick={() => navigate(`/torneos/${tournament.dbId || tournament.id}`)}>
              {Icon.eye} Ver publico
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {savedFlash && (
          <motion.div
            className="otm-flash"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {Icon.check} Cambios guardados
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Título de la seccion actual ── */}
      <div className="otm__crumb">
        <span className="otm__crumb-icon">{Icon[tabMeta.icon]}</span>
        <span>{tabMeta.group}</span>
        <span className="otm__crumb-sep">/</span>
        <b>{tabMeta.label}</b>
      </div>

      {readOnly && (
        <div className="otm-readonly-banner">
          {Icon.lock} Estás viendo esta sección en modo solo lectura. Tu rol de staff ({myStaffRecord?.role || 'staff'}) tiene acceso de "Ver" en "{tabMeta.label}" — si necesitás editarla, pedile al organizador que te dé acceso de edición desde la pestaña "Staff y permisos".
        </div>
      )}

      {/* ── Content ── */}
      <div className="otm__content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            // Resultados: el servidor decide quién arbitra; quien solo ve igual
            // necesita abrir los casos, así que no se bloquea con el candado.
            className={readOnly && activeTab !== 'resultados' ? 'otm-readonly-lock' : undefined}
          >
            {activeTab === 'resumen'       && <TabResumen t={tournament} onSave={patchTournament} />}
            {activeTab === 'equipos'       && <TabEquipos t={tournament} />}
            {activeTab === 'competencia'   && <TabCompetencia t={tournament} onSave={patchTournament} />}
            {activeTab === 'reglas'        && <TabReglas t={tournament} onSave={patchTournament} />}
            {activeTab === 'checkin'       && <TabCheckin t={tournament} onSave={patchTournament} />}
            {activeTab === 'prizepool'     && <TabPrizePool t={tournament} onSave={patchTournament} />}
            {activeTab === 'marca'         && <TabMarca t={tournament} onSave={patchTournament} />}
            {activeTab === 'colaboradores' && <TabColaboradores t={tournament} onUpdate={data => setTournament(normalizeTournament(data))} />}
            {activeTab === 'discord'       && <TabDiscord t={tournament} onSave={patchTournament} onReload={load} />}
            {activeTab === 'bracket'       && <TabBracket t={tournament} />}
            {activeTab === 'resultados'    && <TabResultados t={tournament} />}
            {activeTab === 'ruleta'        && <TabRuleta t={tournament} />}
            {activeTab === 'config'        && <TabConfig t={tournament} onSave={patchTournament} />}
            {activeTab === 'sala'          && <TabSalaStaff t={tournament} />}
            {activeTab === 'reportar'      && <TabReportar t={tournament} />}
            {activeTab === 'actividad'     && <TabActividad t={tournament} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ═══════════════ RESUMEN ═══════════════ */
function TabResumen({ t, onSave }) {
  const [stateDraft, setStateDraft] = useState({
    status: t.status || 'upcoming',
    visibility: t.visibility || 'public',
    registrationStart: toDatetimeLocal(t.registrationStart),
    registrationEnd: toDatetimeLocal(t.registrationEnd),
    lateRegistration: Boolean(t.lateRegistration),
  })
  const [savingState, setSavingState] = useState(false)
  const [stateError, setStateError] = useState('')

  useEffect(() => {
    setStateDraft({
      status: t.status || 'upcoming',
      visibility: t.visibility || 'public',
      registrationStart: toDatetimeLocal(t.registrationStart),
      registrationEnd: toDatetimeLocal(t.registrationEnd),
      lateRegistration: Boolean(t.lateRegistration),
    })
  }, [t.status, t.visibility, t.registrationStart, t.registrationEnd, t.lateRegistration])

  // Inicio del torneo: las inscripciones nunca pueden cerrar despues.
  const startsAt = Date.parse(t.dateIso || '')

  const openRegistrationWeek = () => {
    // 7 dias, o hasta el inicio del torneo si llega antes.
    const weekEnd = Date.now() + 7 * 86400000
    setStateDraft(prev => ({
      ...prev,
      status: 'upcoming',
      visibility: 'public',
      registrationStart: toDatetimeLocal(new Date()),
      registrationEnd: Number.isFinite(startsAt) && startsAt < weekEnd ? toDatetimeLocal(new Date(startsAt)) : daysFromNowLocal(7),
    }))
  }

  const saveState = async () => {
    setStateError('')
    const opens = Date.parse(stateDraft.registrationStart)
    const closes = Date.parse(stateDraft.registrationEnd)
    // Las fechas solo se validan y se mandan si el organizador las toco: asi
    // un torneo viejo con fechas raras se puede seguir marcando como
    // finalizado/cancelado sin tener que arreglarlas antes.
    const datesChanged = stateDraft.registrationStart !== toDatetimeLocal(t.registrationStart)
      || stateDraft.registrationEnd !== toDatetimeLocal(t.registrationEnd)
    // Antes, si el cierre ya habia pasado, se movia en silencio a "hoy + 7 dias"
    // -- aunque el torneo empezara antes -- y se podia inscribir con el torneo
    // ya empezado. Ahora se le pide al organizador una fecha valida.
    if (datesChanged) {
      if (!Number.isFinite(opens) || !Number.isFinite(closes)) {
        setStateError('Indica la apertura y el cierre de inscripciones.')
        return
      }
      if (closes <= opens) {
        setStateError('El cierre de inscripciones debe ser posterior a la apertura.')
        return
      }
      if (Number.isFinite(startsAt) && closes > startsAt) {
        setStateError(`El cierre de inscripciones no puede ser despues del inicio del torneo (${toDatetimeLocal(new Date(startsAt)).replace('T', ' ')}).`)
        return
      }
    }
    if (stateDraft.status === 'upcoming' && !stateDraft.lateRegistration && Number.isFinite(closes) && closes < Date.now()) {
      setStateError('El cierre de inscripciones ya paso: elige una fecha futura, activa "Permitir inscripcion tardia" o marca "Inscripcion cerrada".')
      return
    }
    setSavingState(true)
    try {
      const patch = {
        status: UI_TO_API_STATUS[stateDraft.status] || 'open',
        visibility: stateDraft.visibility,
        lateRegistration: stateDraft.lateRegistration,
      }
      if (datesChanged) {
        // Los inputs datetime-local no llevan zona horaria: se mandan en ISO
        // (UTC) para que el servidor no los interprete en SU zona.
        patch.registrationStart = new Date(opens).toISOString()
        patch.registrationEnd = new Date(closes).toISOString()
      }

      await onSave(patch)
    } catch (error) {
      setStateError(error?.message || 'No se pudo actualizar el estado.')
    } finally {
      setSavingState(false)
    }
  }

  const perSide = Number(String(t.modality || '').match(/^(\d+)\s*v/i)?.[1] || 0)
  const unit = perSide > 1 ? 'equipos' : 'jugadores'
  const staff = Array.isArray(t.staffMembers) ? t.staffMembers : []
  const staffAccepted = staff.filter(m => m.status === 'accepted').length
  const comp = competitionSummary(t.competition)
  const participation = t.participationScope === 'regional'
    ? `${t.allowedCountries.length} pais${t.allowedCountries.length === 1 ? '' : 'es'}`
    : 'Global'

  const cards = [
    { icon: Icon.users, label: 'Inscritos', value: `${t.registered}/${t.capacity}`, color: '#3b82f6' },
    { icon: Icon.trophy, label: 'Prize Pool', value: t.prizePool ? `${t.prizePool.toLocaleString()} ${t.currency}` : 'Sin premio', color: '#f59e0b' },
    { icon: Icon.gamepad || Icon.award, label: 'Modalidad', value: t.modality || '—', color: '#22c55e' },
    { icon: Icon.award, label: 'Competicion', value: t.format, color: '#a855f7' },
  ]
  return (
    <div className="otm-panel">
      <div className="otm-section otm-state-panel">
        <div className="otm-state-panel__head">
          <div>
            <h3>Estado y publicacion</h3>
            <p className="otm-muted">Controla publicacion y ventana real de inscripcion.</p>
          </div>
          <div className="otm-state-actions">
            <button className="otm-btn otm-btn--ghost" type="button" onClick={openRegistrationWeek} disabled={savingState}>
              Abrir 7 dias
            </button>
            <button className="otm-btn otm-btn--primary" type="button" onClick={saveState} disabled={savingState}>
              {savingState ? 'Guardando...' : 'Guardar estado'}
            </button>
          </div>
        </div>
        <div className="otm-state-grid">
          <label className="otm-state-option">
            <span>Estado del torneo</span>
            <select value={stateDraft.status} onChange={e => setStateDraft(prev => ({ ...prev, status: e.target.value }))}>
              <option value="draft">Borrador</option>
              <option value="upcoming">Publicado / Proximo</option>
              <option value="reg_closed">Inscripcion cerrada</option>
              <option value="live">En vivo</option>
              <option value="finished">Finalizado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <label className="otm-state-option">
            <span>Visibilidad</span>
            <select value={stateDraft.visibility} onChange={e => setStateDraft(prev => ({ ...prev, visibility: e.target.value }))}>
              <option value="public">Publicado</option>
              <option value="unlisted">Solo con link</option>
              <option value="private">Privado</option>
            </select>
          </label>
          <label className="otm-state-option">
            <span>Apertura de inscripcion</span>
            <input type="datetime-local" value={stateDraft.registrationStart} onChange={e => setStateDraft(prev => ({ ...prev, registrationStart: e.target.value }))} />
          </label>
          <label className="otm-state-option">
            <span>Cierre de inscripcion</span>
            <input type="datetime-local" value={stateDraft.registrationEnd} onChange={e => setStateDraft(prev => ({ ...prev, registrationEnd: e.target.value }))} />
          </label>
        </div>
        <label className="otm-late-reg">
          <input
            type="checkbox"
            checked={stateDraft.lateRegistration}
            onChange={e => setStateDraft(prev => ({ ...prev, lateRegistration: e.target.checked }))}
          />
          <span>
            <strong>Permitir inscripcion tardia</strong>
            <small>Deja inscribirse aunque ya paso el cierre o el inicio del torneo, mientras haya cupo y el bracket no este publicado. Apagado por defecto.</small>
          </span>
        </label>
        {stateError && <p className="otm-error">{stateError}</p>}
      </div>

      <div className="otm-cards">
        {cards.map((c, i) => (
          <div className="otm-card" key={i}>
            <div className="otm-card__icon" style={{ background: `${c.color}1f`, color: c.color }}>{c.icon}</div>
            <div className="otm-card__body">
              <span className="otm-card__label">{c.label}</span>
              <b className="otm-card__value">{c.value}</b>
            </div>
          </div>
        ))}
      </div>

      <div className="otm-section">
        <h3>Descripcion</h3>
        <p className="otm-muted">{t.description || 'Sin descripcion.'}</p>
      </div>

      <div className="otm-grid2">
        <div className="otm-section">
          <h3>Estructura competitiva</h3>
          {comp.length ? (
            <ul className="otm-keyvals">
              {comp.map((r, i) => <li key={i}><span>{r.label}</span><b>{r.value}</b></li>)}
            </ul>
          ) : <p className="otm-muted">Este torneo no tiene estructura competitiva v2. Editalo en el asistente.</p>}
        </div>
        <div className="otm-section">
          <h3>Detalles</h3>
          <ul className="otm-keyvals">
            <li><span>Inicio</span><b>{t.startDate} - {t.startTime}</b></li>
            <li><span>Participacion</span><b>{participation}</b></li>
            <li><span>Menores</span><b>{t.minorsAllowed ? 'Permitidos con autorizacion' : 'No permitidos'}</b></li>
            <li><span>Cuota de entrada</span><b>{t.entryFee ? `${t.entryFee} ${t.currency}` : 'Gratis'}</b></li>
            <li><span>Capacidad</span><b>{t.capacity} {unit}</b></li>
            <li><span>Servidor / region de juego</span><b>{t.server || '—'}</b></li>
          </ul>
        </div>
      </div>

      <div className="otm-grid2">
        <div className="otm-section">
          <h3>Serie / temporada</h3>
          <ul className="otm-keyvals">
            <li><span>Serie</span><b>{t.seasonName || 'Torneo suelto'}</b></li>
            <li><span>Edicion</span><b>Temporada {t.seasonNumber}</b></li>
          </ul>
        </div>
        <div className="otm-section">
          <h3>Staff {staff.length > 0 && <span className="otm-muted">({staffAccepted}/{staff.length} confirmados)</span>}</h3>
          {staff.length === 0 ? (
            <p className="otm-muted">Sin staff asignado.</p>
          ) : (
            <ul className="otm-keyvals">
              {staff.slice(0, 6).map((m, i) => (
                <li key={m.user || i}>
                  <span>{m.nick || m.name}</span>
                  <b className={m.status === 'accepted' ? 'otm-on' : m.status === 'declined' ? 'otm-off' : ''}>
                    {m.role} · {m.status === 'accepted' ? 'confirmado' : m.status === 'declined' ? 'rechazo' : 'pendiente'}
                  </b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="otm-section">
        <h3>Integraciones</h3>
        <ul className="otm-keyvals">
          <li><span>Discord</span><b className={t.discordEnabled ? 'otm-on' : 'otm-off'}>{t.discordEnabled ? 'Activado — servidor de GlitchGang' : 'Sin Discord (solo panel web)'}</b></li>
          <li><span>Staff</span><b>{staffAccepted}/{staff.length} confirmados</b></li>
        </ul>
      </div>
    </div>
  )
}

/* ============== EQUIPOS (detalle de inscritos + check-in) ============== */
const TEAM_STATUS_META = {
  registered:   { label: 'Sin check-in', cls: '' },
  checked_in:   { label: 'Check-in OK',  cls: 'checked_in' },
  disqualified: { label: 'No-show',      cls: 'disqualified' },
  withdrawn:    { label: 'Retirado',     cls: 'disqualified' },
}

function TabEquipos({ t }) {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openRegId, setOpenRegId] = useState(null)
  const [rosterCache, setRosterCache] = useState({})
  const [rosterLoadingId, setRosterLoadingId] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    registrationsApi.list(t.id)
      .then(data => { if (alive) setRegistrations(Array.isArray(data.registrations) ? data.registrations : []) })
      .catch(() => { if (alive) setRegistrations([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [t.id])

  const counts = useMemo(() => {
    const base = { total: registrations.length, checked_in: 0, disqualified: 0, withdrawn: 0, registered: 0 }
    registrations.forEach(r => { base[r.status] = (base[r.status] || 0) + 1 })
    return base
  }, [registrations])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return registrations.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return [r.name, r.tag, r.teamPublicCode, r.userNick, r.userPlayerCode].some(v => String(v || '').toLowerCase().includes(q))
    })
  }, [registrations, query, statusFilter])

  const toggleRoster = (reg) => {
    if (openRegId === reg.id) { setOpenRegId(null); return }
    setOpenRegId(reg.id)
    const teamId = reg.teamId
    if (!teamId || rosterCache[teamId] !== undefined || rosterLoadingId === String(teamId)) return
    setRosterLoadingId(String(teamId))
    api(`/teams/${encodeURIComponent(teamId)}`)
      .then(data => setRosterCache(prev => ({ ...prev, [teamId]: Array.isArray(data.roster) ? data.roster : [] })))
      .catch(() => setRosterCache(prev => ({ ...prev, [teamId]: null })))
      .finally(() => setRosterLoadingId(''))
  }

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div>
          <h2>Equipos inscritos</h2>
          <p className="otm-muted">Quiénes se anotaron a este torneo, su roster completo y el estatus de check-in de cada uno.</p>
        </div>
      </div>

      <div className="otm-cards">
        <div className="otm-card">
          <div className="otm-card__icon" style={{ background: '#3b82f61f', color: '#3b82f6' }}>{Icon.users}</div>
          <div className="otm-card__body"><span className="otm-card__label">Inscritos</span><b className="otm-card__value">{counts.total}</b></div>
        </div>
        <div className="otm-card">
          <div className="otm-card__icon" style={{ background: '#22c55e1f', color: '#22c55e' }}>{Icon.check}</div>
          <div className="otm-card__body"><span className="otm-card__label">Check-in OK</span><b className="otm-card__value">{counts.checked_in}</b></div>
        </div>
        <div className="otm-card">
          <div className="otm-card__icon" style={{ background: '#ef44441f', color: '#ef4444' }}>{Icon.x}</div>
          <div className="otm-card__body"><span className="otm-card__label">No-show / retirados</span><b className="otm-card__value">{counts.disqualified + counts.withdrawn}</b></div>
        </div>
        <div className="otm-card">
          <div className="otm-card__icon" style={{ background: '#a855f71f', color: '#a855f7' }}>{Icon.clock}</div>
          <div className="otm-card__body"><span className="otm-card__label">Pendientes de check-in</span><b className="otm-card__value">{counts.registered}</b></div>
        </div>
      </div>

      {!loading && registrations.length > 0 && <BroadcastKit t={t} registrations={registrations} />}

      <div className="otm-section">
        <div className="otm-panel__head" style={{ marginBottom: 14 }}>
          <div className="otm-field" style={{ maxWidth: 280 }}>
            <label>Buscar</label>
            <input type="text" placeholder="Nombre, tag o codigo..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="otm-field" style={{ maxWidth: 220 }}>
            <label>Estatus</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="registered">Sin check-in</option>
              <option value="checked_in">Check-in confirmado</option>
              <option value="disqualified">No-show</option>
              <option value="withdrawn">Retirado</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="otm-muted">Cargando equipos...</p>
        ) : filtered.length === 0 ? (
          <div className="otm-empty">{Icon.users}<p>{registrations.length === 0 ? 'Aun no hay equipos inscritos.' : 'Ningun equipo coincide con el filtro.'}</p></div>
        ) : (
          <div className="otm-reg-list">
            {filtered.map(reg => {
              const meta = TEAM_STATUS_META[reg.status] || TEAM_STATUS_META.registered
              const isOpen = openRegId === reg.id
              const roster = reg.teamId ? rosterCache[reg.teamId] : undefined
              return (
                <div key={reg.id} className="otm-team-block">
                  <div className={`otm-reg ${meta.cls}`}>
                    <div className="otm-reg__avatar">
                      {reg.logo ? <img src={reg.logo} alt="" /> : <span>{String(reg.tag || reg.name || 'GG').slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="otm-reg__info">
                      <b>{reg.name}</b>
                      <span>
                        {reg.tag ? `[${reg.tag}] · ` : ''}{reg.teamPublicCode || reg.userPlayerCode || '—'} · Inscrito {reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="otm-reg__actions">
                      <span className={`otm-conn ${reg.status === 'checked_in' ? 'otm-conn--on' : (reg.status === 'disqualified' || reg.status === 'withdrawn') ? 'otm-conn--err' : ''}`}>{meta.label}</span>
                      <button className="otm-btn otm-btn--ghost otm-btn--xs" onClick={() => toggleRoster(reg)}>
                        {isOpen ? 'Ocultar' : 'Ver roster'}
                        <span style={{ display: 'inline-flex', marginLeft: 4, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>{Icon.chevronRight}</span>
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="otm-team-roster">
                      {!reg.teamId ? (
                        <div className="otm-ci-team">
                          <div className="otm-reg__avatar"><span>{String(reg.userNick || 'GG').slice(0, 2).toUpperCase()}</span></div>
                          <div className="otm-ci-team__body">
                            <b>{reg.userNick || 'Jugador'}</b>
                            <span className="otm-ci-team__chans"><span>Inscripcion individual</span>{reg.userPlayerCode && <span>{reg.userPlayerCode}</span>}</span>
                          </div>
                        </div>
                      ) : rosterLoadingId === String(reg.teamId) ? (
                        <p className="otm-muted">Cargando roster...</p>
                      ) : roster === null ? (
                        <p className="otm-muted">Este equipo tiene el roster oculto, o no se pudo cargar.</p>
                      ) : roster && roster.length ? (
                        roster.map(m => (
                          <div className="otm-ci-team" key={m.id}>
                            <div className="otm-reg__avatar">
                              {m.avatar ? <img src={m.avatar} alt="" /> : <span>{String(m.nick || '?').slice(0, 2).toUpperCase()}</span>}
                            </div>
                            <div className="otm-ci-team__body">
                              <b>{m.nick}</b>
                              <span className="otm-ci-team__chans">
                                <span>{m.role}</span>
                                {m.playerCode && <span>{m.playerCode}</span>}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="otm-muted">Sin jugadores en el roster todavia.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============== REGLAS / REGLAMENTO ============== */
// "1. Participación\nEl torneo..." -> "Participación: El torneo..." (una regla por seccion).
const NUMBERED = /^\d+[.)]\s+/
function splitRulesText(text) {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean)
  // Sin numeracion: cada linea es una regla.
  if (!lines.some(line => NUMBERED.test(line))) return lines
  const sections = []
  for (const line of lines) {
    if (NUMBERED.test(line) || !sections.length) sections.push([line])
    else sections[sections.length - 1].push(line)
  }
  return sections.map(([first, ...rest]) => {
    const head = first.replace(NUMBERED, '')
    return rest.length && head.length <= 60 ? `${head.replace(/[:.]$/, '')}: ${rest.join(' ')}` : [head, ...rest].join(' ')
  })
}

function TabReglas({ t, onSave }) {
  const storageKey = `gg-otm-rules-${t.id}`
  const initialRules = useMemo(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length) return p }
    } catch {}
    const fromModel = String(t.rulesText || (Array.isArray(t.rules) ? t.rules.join('\n') : '') || '').split('\n').map(s => s.trim()).filter(Boolean)
    return fromModel.length ? fromModel : ['']
  }, [storageKey, t.rulesText])

  const [rules, setRules] = useState(initialRules)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(rules)) } catch {} }, [storageKey, rules])

  const update = (i, val) => setRules(rules.map((r, idx) => idx === i ? val : r))
  // GG puede redactar el reglamento: cada seccion queda como una regla
  // (se guardan una por linea, asi que titulo y texto van en la misma).
  useEffect(() => registerGGFields('otm-reglas', {
    label: 'Reglas del torneo',
    scope: '.otm-rules',
    fields: [{ key: 'rules', label: 'Reglas del organizador', value: rules.join('\n'), maxLength: 15000 }],
    apply: (_key, text) => {
      const next = splitRulesText(text)
      if (next.length) { setRules(next); setSaved(false) }
    },
  }), [rules])
  const addRule = () => setRules([...rules, ''])
  const removeRule = (i) => setRules(rules.length > 1 ? rules.filter((_, idx) => idx !== i) : [''])

  const docData = { ...t, rulesText: rules.map(r => r.trim()).filter(Boolean).join('\n') }
  const reg = useMemo(() => buildTournamentRegulation(docData), [docData])

  const saveRules = async () => {
    setBusy(true); setError('')
    try {
      await onSave({ rules: rules.map(r => r.trim()).filter(Boolean).join('\n') })
      try { localStorage.removeItem(storageKey) } catch {}
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'No se pudieron guardar las reglas.')
    } finally { setBusy(false) }
  }

  const uploadDoc = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 5 * 1024 * 1024) { setError('Selecciona un PDF de hasta 5 MB.'); return }
    setUploading(true); setError('')
    try {
      const { url } = await uploadsApi.upload(file)
      await onSave({ rulesDocument: url, rulesName: file.name })
    } catch (err) {
      setError(err.message || 'No se pudo subir el PDF.')
    } finally { setUploading(false) }
  }
  const removeDoc = async () => {
    setBusy(true)
    try { await onSave({ rulesDocument: '', rulesName: '' }) }
    catch (err) { setError(err.message || 'No se pudo quitar el PDF.') }
    finally { setBusy(false) }
  }

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div>
          <h2>Reglas y reglamento</h2>
          <p className="otm-muted">Escribe las reglas propias de este torneo. El reglamento completo (info, calendario, premios, politicas de GlitchGang) se arma solo con los datos del torneo.</p>
        </div>
        <div className="otm-doc-actions">
          <button className="otm-btn otm-btn--ghost" onClick={() => printTournamentDoc(docData)}>{Icon.printer} Imprimir</button>
          <button className="otm-btn otm-btn--primary" onClick={() => downloadTournamentPdf(docData)}>{Icon.download} Descargar PDF</button>
        </div>
      </div>
      {error && <p className="otm-muted" style={{ color: 'var(--danger, #e04466)' }}>{error}</p>}

      <div className="otm-section">
        <div className="otm-panel__head" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Reglas del organizador</h3>
          <button className="otm-btn otm-btn--primary otm-btn--xs" onClick={saveRules} disabled={busy}>
            {busy ? 'Guardando...' : saved ? 'Guardado' : 'Guardar reglas'}
          </button>
        </div>
        <div className="otm-rules">
          {rules.map((r, i) => (
            <div className="otm-rule" key={i}>
              <span className="otm-rule__num">{i + 1}</span>
              <textarea className="otm-rule__input" rows={2} value={r} placeholder="Escribe la regla..." onChange={e => update(i, e.target.value)} />
              <button className="otm-iconbtn otm-iconbtn--danger" onClick={() => removeRule(i)} title="Eliminar">{Icon.trash}</button>
            </div>
          ))}
        </div>
        <button className="otm-btn otm-btn--dashed" onClick={addRule}>{Icon.plus} Agregar regla</button>
      </div>

      <div className="otm-section">
        <h3>{Icon.fileText} Reglamento complementario en PDF (opcional)</h3>
        {t.rulesDocument ? (
          <div className="otm-doc-attached">
            <a href={t.rulesDocument} target="_blank" rel="noreferrer">{Icon.fileText} {t.rulesName || 'Reglamento adjunto'}</a>
            <button className="otm-btn otm-btn--danger-ghost otm-btn--xs" onClick={removeDoc} disabled={busy}>Quitar</button>
          </div>
        ) : (
          <label className="otm-btn otm-btn--dashed">
            {uploading ? 'Subiendo...' : <>{Icon.upload} Adjuntar PDF</>}
            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { uploadDoc(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        )}
      </div>

      <div className="otm-section">
        <h3>Vista previa del reglamento oficial</h3>
        <p className="otm-muted">Documento que ven los participantes y que se exporta a PDF. Se arma con los datos del torneo.</p>
        <article className="otm-reg-doc" style={{ '--brand': reg.meta.primaryColor }}>
          <header className="otm-reg-doc__hd">
            <span className="otm-reg-doc__kicker">STELIANT ESPORTS · REGLAMENTO OFICIAL DE TORNEO</span>
            <h1>{reg.meta.title}</h1>
            <p className="otm-reg-doc__sub">{reg.meta.subtitle}</p>
            <p className="otm-reg-doc__meta">Organiza: {reg.meta.organizer} · Emitido el {reg.meta.generatedAt}</p>
          </header>
          {reg.articles.map(a => (
            <section className="otm-reg-doc__art" key={a.n}>
              <h2><span>Artículo {ROMAN[a.n] || a.n}</span> {a.title}</h2>
              <div className="otm-reg-doc__clauses">
                {a.clauses.map((cl, i) => cl.startsWith('•')
                  ? <p className="is-bullet" key={i}>{cl.replace(/^•\s*/, '')}</p>
                  : <p key={i}><b>{a.n}.{i + 1}</b>{cl}</p>)}
              </div>
            </section>
          ))}
          {reg.attachedDoc && <p className="otm-reg-doc__anexo">Anexo: {reg.attachedDoc.name} — documento complementario adjunto por la organización.</p>}
        </article>
      </div>
    </div>
  )
}

/* ═══════════════ CHECK-IN (Discord + Bot) ═══════════════ */
const CI_TZ = (t) => (/^[+-]\d{2}:\d{2}$/.test(t.timezone) ? t.timezone : '-04:00')

// Estructura real que crea discord-bot/services/provisionWorker.js.
// La UI se arma desde Tournament.discordProvision para no inventar estados
// que el backend no guarda.
const CI_BASE_CHANNELS = [
  { key: 'newsId', name: 'noticias', type: 'text', desc: 'Anuncios oficiales y mensaje inicial del torneo.' },
  { key: 'rulesId', name: 'reglas', type: 'text', desc: 'Reglamento y requisitos publicados por el bot.' },
  { key: 'bracketId', name: 'bracket', type: 'text', desc: 'Bracket, rondas y proximos enfrentamientos.' },
  { key: 'checkinId', name: 'check-in', type: 'text', desc: 'Avisos operativos. Los equipos usan /checkin desde su voz asignada.' },
  { key: 'resultsId', name: 'resultados', type: 'text', desc: 'Resultados reportados por los equipos.' },
  { key: 'supportId', name: 'soporte', type: 'text', desc: 'Soporte del torneo.' },
  { key: 'staffId', name: 'staff', type: 'text', desc: 'Canal interno del staff.' },
  { key: 'lobbyVoiceId', name: 'Lobby', type: 'voice', desc: 'Voz general para check-in previo y lobby.' },
]

function CiStatusPill({ status }) {
  const map = {
    ready: { cls: 'otm-conn--on', txt: 'Creado' },
    created: { cls: 'otm-conn--on', txt: 'Creado' },
    partial: { cls: 'otm-conn--warn', txt: 'Parcial' },
    processing: { cls: 'otm-conn--warn', txt: 'Creando...' },
    pending: { cls: '', txt: 'Pendiente' },
    none: { cls: '', txt: 'Sin activar' },
    failed: { cls: 'otm-conn--err', txt: 'Error' },
    error: { cls: 'otm-conn--err', txt: 'Sin crear' },
  }
  const s = map[status] || map.pending
  return <span className={`otm-conn ${s.cls}`}>{s.txt}</span>
}

// { key en Tournament.discordProvision.channels -> etiqueta visible }
const DISCORD_CHANNEL_LINKS = [
  { key: 'newsId', label: 'Noticias' },
  { key: 'rulesId', label: 'Reglas' },
  { key: 'bracketId', label: 'Bracket' },
  { key: 'checkinId', label: 'Check-in' },
  { key: 'resultsId', label: 'Resultados' },
  { key: 'supportId', label: 'Soporte' },
  { key: 'staffId', label: 'Staff' },
  { key: 'lobbyVoiceId', label: 'Voz (Lobby)' },
]

// El bot solo guarda IDs de canal/rol, no nombres -- un link directo al
// canal siempre funciona y no depende de adivinar como los nombro el bot.
function discordChannelUrl(guildId, channelId) {
  return guildId && channelId ? `https://discord.com/channels/${guildId}/${channelId}` : null
}

function provisionStatusForId(provision, value) {
  if (value) return 'created'
  if (!provision?.status || provision.status === 'none') return 'pending'
  if (provision.status === 'ready') return 'pending'
  return provision.status
}

function buildDiscordSpace(t) {
  const provision = t.discordProvision || {}
  const guildId = provision.guildId || ''
  const channels = provision.channels || {}
  const firstChannelId = channels.newsId || channels.checkinId || channels.rulesId || channels.bracketId || ''
  const status = provision.status || (t.discordEnabled ? 'pending' : 'none')

  return {
    status,
    categoryName: provision.categoryId ? `Torneo - ${t.title || t.publicId || 'torneo'}` : (t.title || t.publicId || 'Torneo'),
    url: discordChannelUrl(guildId, firstChannelId),
    channels: CI_BASE_CHANNELS.map(ch => {
      const id = channels[ch.key] || ''
      return {
        ...ch,
        id,
        url: discordChannelUrl(guildId, id),
        status: provisionStatusForId(provision, id),
      }
    }),
    staffRole: {
      id: provision.staffRoleId || '',
      status: provision.staffRoleId ? 'created' : provisionStatusForId(provision, ''),
    },
  }
}

function TabCheckin({ t, onSave }) {
  const navigate = useNavigate()
  const cc = t.checkinConfig || {}
  const space = t.discordSpace || buildDiscordSpace(t)
  const tz = CI_TZ(t)

  const fallbackRegs = useMemo(() => {
    const source = t.registrations || t.participants || []
    return source.map((p, i) => ({
      id: p.id || p._id || `fallback-${i}`,
      name: p.name || p.team || `Equipo ${i + 1}`,
      tag: p.tag || '',
      logo: p.logo || '',
      status: p.status || 'registered',
      discordRoom: p.discordRoom || p.discordProvision || null,
    }))
  }, [t.registrations, t.participants])

  const [registrations, setRegistrations] = useState(fallbackRegs)
  const [checkinStats, setCheckinStats] = useState(t.checkin || {})
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [retryingRegId, setRetryingRegId] = useState('')
  const [retryFeedback, setRetryFeedback] = useState({})

  // Check-in de presencia (persiste como checkinDeadline).
  const [presenceDeadline, setPresenceDeadline] = useState(toDatetimeLocal(t.checkinDeadlineIso))
  const [savingPresence, setSavingPresence] = useState(false)
  const presenceDirty = presenceDeadline !== toDatetimeLocal(t.checkinDeadlineIso)

  // Config del check-in previo y del bot (persiste como checkinConfig).
  const [cfg, setCfg] = useState({
    prematchMins: cc.prematchMins ?? 30,
    toleranceMins: cc.toleranceMins ?? 10,
    autoWalkover: cc.autoWalkover ?? true,
    botReminders: cc.botReminders ?? true,
    dmCaptains: cc.dmCaptains ?? true,
  })
  const [cfgDirty, setCfgDirty] = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const setC = (k, v) => { setCfg(p => ({ ...p, [k]: v })); setCfgDirty(true) }

  // Ritmo de partidas (persiste como matchSchedule): lo ven los jugadores en
  // su Enfrentamiento y los espectadores en la pagina publica del torneo.
  const ms = t.matchSchedule || {}
  const [pace, setPace] = useState({
    durationMins: ms.durationMins ?? 30,
    breakMins: ms.breakMins ?? 15,
    reminderMins: ms.reminderMins ?? 15,
  })
  const [paceDirty, setPaceDirty] = useState(false)
  const [savingPace, setSavingPace] = useState(false)
  const [paceNotStored, setPaceNotStored] = useState(false)
  const setP = (k, v) => { setPace(p => ({ ...p, [k]: Math.max(0, Number(v) || 0) })); setPaceDirty(true) }

  // Sobre cupo + 2o check-in (persiste como overcup).
  const [over, setOver] = useState({
    enabled: !!t.overcup?.enabled,
    locked: !!t.overcup?.locked,
    secondCheckinHours: t.overcup?.secondCheckinHours ?? 6,
    secondCheckinDeadline: toDatetimeLocal(t.overcup?.secondCheckinDeadline),
  })
  const [overDirty, setOverDirty] = useState(false)
  const [savingOver, setSavingOver] = useState(false)
  const setO = (k, v) => { setOver(p => ({ ...p, [k]: v })); setOverDirty(true) }

  useEffect(() => {
    let alive = true
    setLoadingRegs(true)
    registrationsApi.list(t.id)
      .then(data => {
        if (!alive) return
        setRegistrations(Array.isArray(data.registrations) && data.registrations.length ? data.registrations : fallbackRegs)
        setCheckinStats(data.checkin || {})
      })
      .catch(() => { if (alive) setRegistrations(fallbackRegs) })
      .finally(() => { if (alive) setLoadingRegs(false) })
    return () => { alive = false }
  }, [t.id, fallbackRegs])

  const checkedIn = registrations.filter(r => r.status === 'checked_in').length
  const noShow = registrations.filter(r => r.status === 'disqualified').length
  const attendanceStatusLabel = (status) => ({
    registered: 'Pendiente',
    checked_in: 'Confirmado',
    disqualified: 'No-show',
    withdrawn: 'Retirado',
  }[status] || status || 'Pendiente')

  const markCheckin = (registration, type) => {
    const nextStatus = type === 'no_show' ? 'disqualified' : 'checked_in'
    if (String(registration.id).startsWith('fallback-')) {
      setRegistrations(prev => prev.map(r => r.id === registration.id ? { ...r, status: nextStatus } : r))
      return
    }
    registrationsApi.checkin(t.id, registration.id, type)
      .then(data => {
        setRegistrations(Array.isArray(data.registrations) ? data.registrations : registrations)
        setCheckinStats(data.checkin || checkinStats)
      })
      .catch(() => {
        setRegistrations(prev => prev.map(r => r.id === registration.id ? { ...r, status: nextStatus } : r))
      })
  }

  const toInstant = (local) => (local ? new Date(instant(local, tz)).toISOString() : null)

  const savePresence = async () => {
    setSavingPresence(true)
    try { await onSave({ checkinDeadline: toInstant(presenceDeadline) }) }
    finally { setSavingPresence(false) }
  }
  const saveCfg = async () => {
    setSavingCfg(true)
    try { await onSave({ checkinConfig: cfg }); setCfgDirty(false) }
    finally { setSavingCfg(false) }
  }
  const savePace = async () => {
    setSavingPace(true)
    try {
      const saved = await onSave({ matchSchedule: pace })
      // Si el servidor no devuelve el bloque, no lo guardo: avisarlo en vez
      // de dejar creer al organizador que quedo configurado.
      setPaceNotStored(!saved?.matchSchedule)
      setPaceDirty(false)
    } finally { setSavingPace(false) }
  }
  // Vista previa con la hora real de inicio del torneo (si la tiene).
  const pacePreview = useMemo(() => {
    const start = t.dateIso ? new Date(t.dateIso) : null
    const hasStart = start && !Number.isNaN(start.getTime())
    const step = pace.durationMins + pace.breakMins
    // tz es un offset fijo ("-04:00"): se aplica a mano y se formatea en UTC.
    const [, sign, hh, mm] = /^([+-])(\d{2}):(\d{2})$/.exec(tz) || [null, '-', '04', '00']
    const offsetMins = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm))
    const fmt = (mins) => {
      if (hasStart) {
        const d = new Date(start.getTime() + (mins + offsetMins) * 60000)
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      }
      if (mins < 0) return `${-mins} min antes de arrancar`
      return mins === 0 ? 'al arrancar' : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m despues de arrancar`
    }
    return [0, 1, 2].map(i => ({
      label: `Partida ${i + 1}`,
      starts: fmt(i * step),
      notice: fmt(i * step - pace.reminderMins),
    }))
  }, [t.dateIso, tz, pace])

  const saveOver = async () => {
    setSavingOver(true)
    try {
      await onSave({
        overcup: {
          enabled: over.enabled,
          locked: over.locked,
          secondCheckinHours: over.secondCheckinHours,
          secondCheckinDeadline: toInstant(over.secondCheckinDeadline),
        },
      })
      setOverDirty(false)
    } finally { setSavingOver(false) }
  }

  const discordOff = !t.discordEnabled
  const spaceStatus = space?.status || (discordOff ? 'off' : 'pending')
  const provisionReady = ['ready', 'partial'].includes(spaceStatus)

  const retryTeamRoom = async (reg) => {
    if (!reg.teamId) return
    setRetryingRegId(reg.id)
    setRetryFeedback((prev) => { const next = { ...prev }; delete next[reg.id]; return next })
    try {
      await tournamentsApi.retryTeamDiscordProvision(t.id, reg.teamId)
      const resolved = await pollUntilResolved(async () => {
        const data = await registrationsApi.list(t.id)
        const list = Array.isArray(data.registrations) && data.registrations.length ? data.registrations : fallbackRegs
        setRegistrations(list)
        const updated = list.find((r) => r.id === reg.id)
        const room = updated?.discordRoom || {}
        return room.status !== 'failed' && room.status !== 'error' && room.welcomeSent !== false
      })
      setRetryFeedback((prev) => ({
        ...prev,
        [reg.id]: resolved
          ? { tone: 'success', message: 'Listo, la sala se solucionó.' }
          : { tone: 'error', message: 'Sigue fallando. El bot puede tardar un poco mas -- intenta de nuevo en un momento.' },
      }))
      if (resolved) {
        setTimeout(() => {
          setRetryFeedback((prev) => { const next = { ...prev }; delete next[reg.id]; return next })
        }, 8000)
      }
    } catch (err) {
      setRetryFeedback((prev) => ({ ...prev, [reg.id]: { tone: 'error', message: err.message || 'No se pudo reintentar.' } }))
    } finally {
      setRetryingRegId('')
    }
  }

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div>
          <h2>Check-in {Icon.discord}</h2>
          <p className="otm-muted">El bot crea las salas y roles en Discord. El check-in competitivo se ejecuta con /checkin desde la voz asignada del equipo.</p>
        </div>
        <span className="otm-fixed-badge otm-fixed-badge--lg">{Icon.lock} Discord obligatorio</span>
      </div>

      {/* Estado del espacio del torneo en Discord */}
      <div className="otm-section">
        <div className="otm-panel__head" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{Icon.discord} Sala del torneo en Discord</h3>
            <p className="otm-muted">Se crea al publicar con Discord activado. Si despues editas el torneo (fechas, reglamento, premios, estado), el bot lo refleja solo en #anuncios y #reglas — no hay que avisar por otro lado.</p>
          </div>
          <CiStatusPill status={spaceStatus === 'off' ? 'error' : spaceStatus} />
        </div>

        {discordOff ? (
          <div className="otm-callout">
            {Icon.alert}
            <p>
              Este torneo todavia no tiene Discord activado, asi que el bot no ha creado ninguna sala.
              Activalo en la pestana <b>Discord</b> (un admin de GlitchGang tiene que habilitarte una sola vez).
              <br />
              <button className="otm-btn otm-btn--ghost otm-btn--xs" style={{ marginTop: 8 }} onClick={() => navigate(`/organizador/torneo/${t.id}/gestionar/discord`)}>
                {Icon.chevronRight} Ir a Discord
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="otm-ci-space">
              <div className="otm-ci-space__cat">
                <span>{Icon.discord}</span>
                <div>
                  <b>{space?.categoryName || t.title}</b>
                  <small className="otm-muted">Categoria del torneo - solo la ven participantes y staff</small>
                </div>
                {space?.url && <a className="otm-btn otm-btn--ghost otm-btn--xs" href={space.url} target="_blank" rel="noreferrer">{Icon.eye} Abrir</a>}
              </div>
              <ul className="otm-ci-chans">
                {(space?.channels?.length ? space.channels : CI_BASE_CHANNELS).map(ch => (
                  <li key={ch.key || ch.name}>
                    <span className="otm-ci-chans__glyph">{ch.type === 'voice' ? '🔊' : '#'}</span>
                    <div>
                      {ch.url ? (
                        <a href={ch.url} target="_blank" rel="noreferrer"><b>{String(ch.name).replace(/^#/, '')}</b></a>
                      ) : (
                        <b>{String(ch.name).replace(/^#/, '')}</b>
                      )}
                      <small className="otm-muted">{ch.desc || ''}</small>
                    </div>
                    <CiStatusPill status={ch.status || 'pending'} />
                  </li>
                ))}
                <li>
                  <span className="otm-ci-chans__glyph">{Icon.shield}</span>
                  <div>
                    <b>staff-{(t.publicId || 'torneo').toLowerCase()}</b>
                    <small className="otm-muted">Rol exclusivo del staff de este torneo</small>
                  </div>
                  <CiStatusPill status={space?.staffRole?.status || 'pending'} />
                </li>
              </ul>
            </div>
            {!provisionReady && spaceStatus !== 'failed' && (
              <p className="otm-muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                {Icon.refresh} El bot esta creando la sala. Puede tardar unos minutos tras publicar el torneo.
              </p>
            )}
            {spaceStatus === 'failed' && t.discordProvision?.error && (
              <p className="otm-muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                {Icon.alert} Error reportado por el bot: {t.discordProvision.error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Salas por equipo */}
      <div className="otm-section">
        <div className="otm-panel__head" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{Icon.users} Salas privadas por equipo</h3>
            <p className="otm-muted">Al confirmarse la inscripcion, el bot crea el equipo en Discord: chat, bracket propio, voz y un rol exclusivo. Solo entran los jugadores de ese roster que ya vincularon su Discord — el resto queda pendiente hasta que lo hagan.</p>
          </div>
        </div>
        {loadingRegs ? (
          <p className="otm-muted">Cargando inscripciones...</p>
        ) : registrations.length === 0 ? (
          <div className="otm-empty">{Icon.users}<p>Aun no hay equipos inscritos. Las salas se crean con cada inscripcion.</p></div>
        ) : (
          <div className="otm-reg-list">
            {registrations.map(reg => {
              const room = reg.discordRoom
              const slug = String(reg.tag || reg.name || 'equipo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
              const guildId = t.discordProvision?.guildId || ''
              const missingCount = Array.isArray(room?.missingDiscordUsers) ? room.missingDiscordUsers.length : 0
              const hasProblem = !discordOff && !!reg.teamId && (room?.status === 'failed' || room?.status === 'error' || room?.welcomeSent === false)
              const feedback = retryFeedback[reg.id]
              return (
                <div key={reg.id}>
                  <div className="otm-ci-team">
                    <div className="otm-reg__avatar">
                      {reg.logo ? <img src={reg.logo} alt="" /> : <span>{String(reg.tag || reg.name || 'GG').slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="otm-ci-team__body">
                      <b>{reg.name}</b>
                      <span className="otm-ci-team__chans">
                        <span>{room?.textChannelId ? <a href={discordChannelUrl(guildId, room.textChannelId)} target="_blank" rel="noreferrer">{`#team-${slug}`}</a> : `#team-${slug}`}</span>
                        <span>{room?.bracketChannelId ? <a href={discordChannelUrl(guildId, room.bracketChannelId)} target="_blank" rel="noreferrer">{`#team-${slug}-bracket`}</a> : `#team-${slug}-bracket`}</span>
                        <span>{'🔊'} {room?.voiceName || slug}</span>
                        <span>{`@team-${slug}`}</span>
                        {missingCount > 0 && <span>{missingCount} sin vincular</span>}
                      </span>
                    </div>
                    <CiStatusPill status={room?.status || (discordOff ? 'error' : 'pending')} />
                  </div>
                  {hasProblem && (
                    <button
                      type="button"
                      className="otm-btn otm-btn--ghost otm-btn--xs"
                      style={{ margin: '4px 0 0 50px' }}
                      disabled={retryingRegId === reg.id}
                      onClick={() => retryTeamRoom(reg)}
                    >
                      {Icon.refresh} {retryingRegId === reg.id ? 'Reintentando...' : 'Reintentar sala'}
                    </button>
                  )}
                  {feedback && (
                    <p
                      className="otm-muted"
                      style={{ color: feedback.tone === 'success' ? 'var(--success, #22c55e)' : 'var(--danger, #e04466)', fontSize: 11.5, margin: '4px 0 0 50px' }}
                    >
                      {feedback.tone === 'success' ? Icon.check : Icon.alert} {feedback.message}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {discordOff && <p className="otm-muted" style={{ marginTop: 8, fontSize: 12.5 }}>{Icon.alert} Sin Discord activado no se crean salas de equipo.</p>}
      </div>

      {/* Check-in de presencia */}
      <div className="otm-section">
        <h3>1 - Check-in de presencia</h3>
        <p className="otm-muted">Presencia competitiva del equipo. En Discord el lider usa <b>/checkin</b> desde su canal de voz asignado; desde aqui el staff tambien puede marcar asistencia manual.</p>
        <div className="otm-field" style={{ marginTop: 10, maxWidth: 340 }}>
          <label>Fecha y hora limite de presencia</label>
          <input type="datetime-local" value={presenceDeadline} onChange={e => setPresenceDeadline(e.target.value)} />
          <small className="otm-muted">Se guarda en el torneo para que el staff y el bot tengan la misma ventana operativa.</small>
        </div>
        {presenceDirty && (
          <button className="otm-btn otm-btn--primary" style={{ marginTop: 10 }} onClick={savePresence} disabled={savingPresence}>
            {savingPresence ? 'Guardando...' : 'Guardar limite de presencia'}
          </button>
        )}
      </div>

      {/* Check-in previo + comportamiento del bot */}
      <div className="otm-section">
        <h3>2 - Check-in previo al torneo</h3>
        <p className="otm-muted">Antes del inicio, para preparar el lobby, asignar salas y verificar rosters.</p>
        <div className="otm-grid2" style={{ marginTop: 10 }}>
          <div className="otm-field">
            <label>Minutos antes del inicio</label>
            <input type="number" min="5" max="180" value={cfg.prematchMins} onChange={e => setC('prematchMins', Number(e.target.value))} />
          </div>
          <div className="otm-field">
            <label>Tolerancia / walkover (min)</label>
            <input type="number" min="0" max="60" value={cfg.toleranceMins} onChange={e => setC('toleranceMins', Number(e.target.value))} />
          </div>
        </div>
        <div className="otm-toggles" style={{ marginTop: 12 }}>
          <Toggle key={`br-${cfg.botReminders}`} label="Recordatorios operativos del bot" defaultChecked={cfg.botReminders} onChange={v => setC('botReminders', v)} />
          <Toggle key={`aw-${cfg.autoWalkover}`} label="Walkover al agotar la tolerancia" defaultChecked={cfg.autoWalkover} onChange={v => setC('autoWalkover', v)} />
          <Toggle key={`dm-${cfg.dmCaptains}`} label="Aviso a capitanes vinculados" defaultChecked={cfg.dmCaptains} onChange={v => setC('dmCaptains', v)} />
        </div>
        {cfgDirty && (
          <button className="otm-btn otm-btn--primary" style={{ marginTop: 12 }} onClick={saveCfg} disabled={savingCfg}>
            {savingCfg ? 'Guardando...' : 'Guardar configuracion del check-in'}
          </button>
        )}
      </div>

      {/* Ritmo de partidas: duracion + descanso + aviso previo */}
      <div className="otm-section">
        <h3>3 - Ritmo de partidas</h3>
        <p className="otm-muted">Cuanto dura cada partida, cuanto descanso hay entre una y otra, y con cuanta anticipacion se avisa a los equipos que juegan la siguiente. Jugadores y espectadores lo ven como tiempo aproximado ("~30 min"), no como hora exacta de termino.</p>
        <div className="otm-grid3" style={{ marginTop: 10 }}>
          <div className="otm-field">
            <label>Duracion de cada partida (min)</label>
            <input type="number" min="5" max="240" value={pace.durationMins} onChange={e => setP('durationMins', e.target.value)} />
          </div>
          <div className="otm-field">
            <label>Descanso entre partidas (min)</label>
            <input type="number" min="0" max="120" value={pace.breakMins} onChange={e => setP('breakMins', e.target.value)} />
          </div>
          <div className="otm-field">
            <label>Avisar antes de cada partida (min)</label>
            <input type="number" min="5" max="120" value={pace.reminderMins} onChange={e => setP('reminderMins', e.target.value)} />
          </div>
        </div>
        <div className="otm-pace-preview">
          {pacePreview.map(row => (
            <div key={row.label} className="otm-pace-preview__row">
              <b>{row.label}</b>
              <span>{Icon.clock} Empieza {row.starts}</span>
              <span className="otm-muted">Aviso a los equipos {row.notice}</span>
            </div>
          ))}
          <small className="otm-muted">
            {t.dateIso ? 'Calculado desde la hora de inicio del torneo.' : 'El torneo no tiene hora de inicio: se muestra el tiempo desde que arranca.'}
            {' '}Cada partida nueva empieza {pace.durationMins + pace.breakMins} min despues de la anterior.
          </small>
        </div>
        {paceNotStored && (
          <p className="otm-muted" style={{ marginTop: 10 }}>{Icon.alert} El servidor todavia no guarda el ritmo de partidas: los valores se perderan al recargar hasta que el backend lo soporte.</p>
        )}
        {paceDirty && (
          <button className="otm-btn otm-btn--primary" style={{ marginTop: 12 }} onClick={savePace} disabled={savingPace}>
            {savingPace ? 'Guardando...' : 'Guardar ritmo de partidas'}
          </button>
        )}
      </div>

      {/* Asistencia manual */}
      <div className="otm-section">
        <div className="otm-panel__head" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Asistencia</h3>
            <p className="otm-muted">
              {loadingRegs ? 'Cargando...' : `${registrations.length} equipos - ${checkedIn} confirmados - ${noShow} no-show`}
            </p>
          </div>
          <div className="otm-ci-summary">
            <div><b>{checkinStats.aTiempo ?? checkedIn}</b><span>A tiempo</span></div>
            <div><b>{checkinStats.tarde ?? 0}</b><span>Tarde</span></div>
            <div><b>{checkinStats.noShow ?? noShow}</b><span>No-show</span></div>
          </div>
        </div>
        <div className="otm-reg-list">
          {registrations.length === 0 ? (
            <p className="otm-muted">Aun no hay equipos inscritos.</p>
          ) : registrations.map(reg => (
            <div className={`otm-reg ${reg.status}`} key={reg.id}>
              <div className="otm-reg__avatar">
                {reg.logo ? <img src={reg.logo} alt="" /> : <span>{String(reg.tag || reg.name || 'GG').slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="otm-reg__info">
                <b>{reg.name}</b>
                <span>{reg.tag ? `[${reg.tag}] - ` : ''}{attendanceStatusLabel(reg.status)}</span>
              </div>
              <div className="otm-reg__actions">
                <button
                  className={`otm-btn otm-btn--ghost otm-btn--xs ${reg.status === 'checked_in' ? 'is-active' : ''}`}
                  onClick={() => markCheckin(reg, 'checked_in')}
                  disabled={reg.status === 'checked_in'}
                >
                  {Icon.check} {reg.status === 'checked_in' ? 'Confirmado' : 'Confirmar'}
                </button>
                <button
                  className={`otm-btn otm-btn--ghost otm-btn--xs ${reg.status === 'disqualified' ? 'is-danger-active' : ''}`}
                  onClick={() => markCheckin(reg, 'no_show')}
                  disabled={reg.status === 'disqualified'}
                >
                  {Icon.x} {reg.status === 'disqualified' ? 'No-show' : 'Marcar no-show'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sobre cupo */}
      <div className="otm-section">
        <div className="otm-panel__head" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Sobre cupo y segundo check-in</h3>
            <p className="otm-muted">Si faltan equipos tras el check-in de presencia, entran los de la cola y se les abre un segundo check-in.</p>
          </div>
          {over.enabled && over.locked && <span className="otm-fixed-badge">{Icon.lock} Inamovible</span>}
        </div>
        <div className="otm-toggles">
          <Toggle key={`oc-${over.enabled}`} label={`Permitir sobre cupo (capacidad ${t.capacity} equipos)`} defaultChecked={over.enabled} onChange={v => setO('enabled', v)} />
        </div>
        {over.enabled && (
          <>
            <div className="otm-grid2" style={{ marginTop: 12 }}>
              <div className="otm-field">
                <label>Ventana del 2o check-in</label>
                <select value={over.secondCheckinHours} onChange={e => setO('secondCheckinHours', Number(e.target.value))}>
                  {[6, 7, 8, 9, 10, 11, 12].map(h => <option key={h} value={h}>{h} horas</option>)}
                </select>
                <small className="otm-muted">Ventana amplia (6-12 h) porque no todos estan pendientes del cel/PC.</small>
              </div>
              <div className="otm-field">
                <label>Hora limite del 2o check-in</label>
                <input type="datetime-local" value={over.secondCheckinDeadline} onChange={e => setO('secondCheckinDeadline', e.target.value)} />
                <small className="otm-muted">Se publica en el reglamento. Al cambiarla se notifica a los participantes.</small>
              </div>
            </div>
            <div className="otm-toggles" style={{ marginTop: 12 }}>
              <Toggle key={`ol-${over.locked}`} label="Fijar regla de sobre cupo (inamovible)" defaultChecked={over.locked} onChange={v => setO('locked', v)} />
            </div>
          </>
        )}
        {overDirty && (
          <button className="otm-btn otm-btn--primary" style={{ marginTop: 12 }} onClick={saveOver} disabled={savingOver}>
            {savingOver ? 'Guardando...' : 'Guardar sobre cupo'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ PRIZE POOL ═══════════════ */
function TabPrizePool({ t, onSave }) {
  const placeLabel = (index) => index === 0 ? '1er Lugar' : index === 1 ? '2do Lugar' : index === 2 ? '3er Lugar' : `${index + 1}to Lugar`
  const cleanPlace = (place, index) => {
    const raw = String(place || '').trim()
    const value = raw
      .replace(/\u00C2|\uFFFD/g, '')
      .replace(/Ã‚|Ãƒ|Â|�/g, '')
      .replace(/[º°]/g, '')
      .trim()
    if (!value) return placeLabel(index)
    const rank = value.match(/^\d+/)?.[0]
    if (rank === '1') return '1er Lugar'
    if (rank === '2') return '2do Lugar'
    if (rank === '3') return '3er Lugar'
    if (rank) return `${Number(rank)}to Lugar`
    return value
  }
  const normalizePrize = (p, index) => ({
    kind: p.kind === 'award' ? 'award' : 'placement',
    place: p.kind === 'award' ? String(p.place || '').trim() : cleanPlace(p.place, index),
    amount: Number(p.amount || 0),
    currency: p.currency || t.currency || 'USD',
    items: p.items || p.extra || '',
    payoutMethod: p.payoutMethod || 'transfer',
    status: p.status || 'pending',
    conditions: p.conditions || '',
    proofImage: p.proofImage || '',
    signatureImage: p.signatureImage || '',
  })
  const initialDraft = useMemo(() => (
    {
      prizeType: t.prizeType || (t.prizePool > 0 ? 'cash' : 'items'),
      currency: t.currency || 'USD',
      fundingStatus: t.prizeFundingStatus || 'pending',
      sponsor: t.prizeSponsor || '',
      proofUrl: t.prizeProofUrl || '',
      delivery: t.prizeDelivery || 'transfer',
      payoutDeadline: t.prizePayoutDeadline || '',
      notes: t.prizeNotes || '',
      prizes: (Array.isArray(t.prizes) && t.prizes.length ? t.prizes : [{ place: '1 Lugar', amount: t.prizePool || 0, items: '' }]).map(normalizePrize),
    }
  ), [t])
  const [draft, setDraft] = useState(initialDraft)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploadingKey, setUploadingKey] = useState('')
  const prizes = draft.prizes || []
  const total = prizes.reduce((s, p) => s + Number(p.amount || 0), 0)
  const funded = draft.fundingStatus === 'funded'

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const set = (field, value) => setDraft(prev => ({ ...prev, [field]: value }))
  const update = (i, field, val) => setDraft(prev => ({
    ...prev,
    prizes: prev.prizes.map((p, idx) => idx === i ? { ...p, [field]: field === 'amount' ? Number(val) : val } : p),
  }))
  const addPrize = () => setDraft(prev => ({
    ...prev,
    prizes: [...prev.prizes, normalizePrize({ place: placeLabel(prev.prizes.length), currency: prev.currency }, prev.prizes.length)],
  }))
  const remove = (i) => setDraft(prev => ({ ...prev, prizes: prev.prizes.filter((_, idx) => idx !== i) }))
  const uploadPrizeFile = async (i, field, file) => {
    if (!file) return
    const key = `${i}-${field}`
    setUploadingKey(key)
    setError('')
    try {
      const uploaded = await uploadsApi.upload(file)
      update(i, field, uploaded.url || '')
    } catch (err) {
      setError(err.message || 'No se pudo subir el archivo.')
    } finally {
      setUploadingKey('')
    }
  }

  const savePrizePool = async () => {
    setBusy(true)
    setError('')
    try {
      const cleanPrizes = prizes.map((p, index) => ({
        kind: p.kind === 'award' ? 'award' : 'placement',
        place: p.kind === 'award' ? String(p.place || '').trim() : cleanPlace(p.place, index),
        amount: Number(p.amount || 0),
        currency: draft.currency || p.currency || 'USD',
        items: p.items || '',
        payoutMethod: p.payoutMethod || 'transfer',
        status: p.status || 'pending',
        conditions: p.conditions || '',
        proofImage: p.proofImage || '',
        signatureImage: p.signatureImage || '',
      }))
      await onSave({
        prizeType: draft.prizeType,
        currency: draft.currency,
        prizePool: cleanPrizes.reduce((sum, prize) => sum + Number(prize.amount || 0), 0),
        prizes: cleanPrizes,
        prizeFundingStatus: draft.fundingStatus,
        prizeSponsor: draft.sponsor,
        prizeProofUrl: draft.proofUrl,
        prizeDelivery: draft.delivery,
        prizePayoutDeadline: draft.payoutDeadline,
        prizeNotes: draft.notes,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2600)
    } catch (err) {
      setError(err.message || 'No se pudo guardar el prizepool.')
    } finally {
      setBusy(false)
    }
  }

  const DELIVERY = [
    { key: 'live', icon: Icon.tv || Icon.eye, title: 'En vivo', desc: 'Anuncio o entrega durante la transmision final.' },
    { key: 'event', icon: Icon.trophy, title: 'En evento', desc: 'Entrega presencial o coordinada por staff.' },
    { key: 'transfer', icon: Icon.creditCard, title: 'Transferencia', desc: 'Pago validado despues de revisar ganadores.' },
  ]

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div>
          <h2>Prize Pool</h2>
          <p className="otm-muted">Premios reales por torneo: dinero, items, patrocinador, estado de fondos y condiciones de pago.</p>
        </div>
        <div className="otm-total">
          <span>Total declarado</span>
          <b>{draft.currency} {total.toLocaleString()}</b>
          <small className={funded ? 'otm-on' : 'otm-off'}>{funded ? 'Fondos confirmados' : 'Pendiente de fondeo'}</small>
        </div>
      </div>

      <div className="otm-prize-summary">
        <div className="otm-field"><label>Tipo de premio</label><select value={draft.prizeType} onChange={e => set('prizeType', e.target.value)}><option value="cash">Dinero</option><option value="items">Items / productos</option><option value="mixed">Mixto</option><option value="none">Sin premio</option></select></div>
        <div className="otm-field"><label>Moneda</label><select value={draft.currency} onChange={e => set('currency', e.target.value)}><option>USD</option><option>DOP</option><option>MXN</option><option>EUR</option></select></div>
        <div className="otm-field"><label>Estado de fondos</label><select value={draft.fundingStatus} onChange={e => set('fundingStatus', e.target.value)}><option value="pending">Pendiente</option><option value="funded">Confirmado</option><option value="sponsored">Patrocinado</option><option value="escrow">En garantia</option></select></div>
        <div className="otm-field"><label>Patrocinador / fuente</label><input value={draft.sponsor} onChange={e => set('sponsor', e.target.value)} placeholder="GlitchGang, marca, organizador..." /></div>
        <div className="otm-field"><label>Comprobante / contrato</label><input value={draft.proofUrl} onChange={e => set('proofUrl', e.target.value)} placeholder="URL interna o referencia" /></div>
        <div className="otm-field"><label>Fecha limite de pago</label><input value={draft.payoutDeadline} onChange={e => set('payoutDeadline', e.target.value)} placeholder="Ej. 72h despues de la final" /></div>
      </div>

      <div className="otm-prizes">
        {prizes.map((p, i) => (
          <div className="otm-prize otm-prize--pro" key={i}>
            <div className="otm-prize__rank" data-place={i + 1}><span>{i + 1}</span><small>{p.place}</small></div>
            <div className="otm-prize__grid">
              <div className="otm-field"><label>Posicion</label><input value={p.place} onChange={e => update(i, 'place', e.target.value)} /></div>
              <div className="otm-field"><label>Monto</label><input type="number" min="0" value={p.amount} onChange={e => update(i, 'amount', e.target.value)} /></div>
              <div className="otm-field"><label>Items / beneficio</label><input value={p.items} placeholder="Trofeo, skins, clasificacion, hardware..." onChange={e => update(i, 'items', e.target.value)} /></div>
              <div className="otm-field"><label>Metodo</label><select value={p.payoutMethod} onChange={e => update(i, 'payoutMethod', e.target.value)}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="wallet">Wallet</option><option value="product">Producto</option></select></div>
              <div className="otm-field"><label>Estado</label><select value={p.status} onChange={e => update(i, 'status', e.target.value)}><option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="paid">Pagado</option><option value="withheld">Retenido</option></select></div>
              <div className="otm-field otm-field--grow"><label>Condiciones</label><input value={p.conditions} placeholder="Validacion de roster, evidencia, impuestos..." onChange={e => update(i, 'conditions', e.target.value)} /></div>
              <label className={`otm-prize-proof ${p.proofImage ? 'has-file' : ''}`}>
                <input type="file" accept="image/*,.pdf" hidden onChange={e => uploadPrizeFile(i, 'proofImage', e.target.files?.[0])} />
                {p.proofImage && String(p.proofImage).match(/\.(png|jpe?g|webp|gif)$/i) ? <span style={{ backgroundImage: `url(${p.proofImage})` }} /> : Icon.upload}
                <b>Comprobante</b>
                <small>{uploadingKey === `${i}-proofImage` ? 'Subiendo...' : p.proofImage ? 'Archivo cargado' : 'Imagen o PDF'}</small>
              </label>
              <label className={`otm-prize-proof ${p.signatureImage ? 'has-file' : ''}`}>
                <input type="file" accept="image/*" hidden onChange={e => uploadPrizeFile(i, 'signatureImage', e.target.files?.[0])} />
                {p.signatureImage && <span style={{ backgroundImage: `url(${p.signatureImage})` }} />}
                {!p.signatureImage && Icon.edit}
                <b>Firma</b>
                <small>{uploadingKey === `${i}-signatureImage` ? 'Subiendo...' : p.signatureImage ? 'Firma cargada' : 'Imagen de firma'}</small>
              </label>
            </div>
            <button className="otm-iconbtn otm-iconbtn--danger" onClick={() => remove(i)} title="Eliminar premio">{Icon.trash}</button>
          </div>
        ))}
      </div>

      <button className="otm-btn otm-btn--dashed" onClick={addPrize}>{Icon.plus} Agregar premio</button>

      <div className="otm-delivery">
        <div className="otm-delivery__head">
          <h3>{Icon.trophy} Entrega y validacion</h3>
          <p className="otm-muted">Define como se anuncia, valida y paga cada premio. Esto tambien queda en el borrador del torneo.</p>
        </div>
        <div className="otm-delivery__opts">
          {DELIVERY.map(d => (
            <button key={d.key} type="button" className={`otm-delivery__opt${draft.delivery === d.key ? ' active' : ''}`} onClick={() => set('delivery', d.key)}>
              <span className="otm-delivery__emoji">{d.icon}</span>
              <b>{d.title}</b>
              <small>{d.desc}</small>
              {draft.delivery === d.key && <span className="otm-delivery__check">{Icon.check}</span>}
            </button>
          ))}
        </div>
        <div className="otm-field" style={{ marginTop: 14 }}><label>Notas internas de pago</label><textarea rows={3} value={draft.notes} onChange={e => set('notes', e.target.value)} placeholder="Ej. pagar solo al capitan validado, requerir cedula/factura, retener si hay disputa abierta..." /></div>
      </div>

      {error && <p className="otm-muted" style={{ color: 'var(--danger, #e04466)' }}>{error}</p>}
      <button className="otm-btn otm-btn--primary" onClick={savePrizePool} disabled={busy || Boolean(uploadingKey)}>
        {busy ? 'Guardando...' : saved ? 'Guardado' : 'Guardar prizepool'}
      </button>
    </div>
  )
}
/* MARCA / EQUIPO ═══════════════ */
function TabMarca({ t, onSave }) {
  const initialBrand = useMemo(() => ({
    logo: t.logo || '',
    banner: t.banner || '',
    primaryColor: t.primaryColor || '#00E676',
    organizerBrandName: t.organizerBrandName || t.creator || 'GlitchGang Esports',
    sponsors: (Array.isArray(t.sponsors) ? t.sponsors : []).map(sponsor => (
      typeof sponsor === 'string'
        ? { name: sponsor, tier: 'Sponsor', url: '', logo: '' }
        : { name: sponsor.name || sponsor.companyName || '', tier: sponsor.tier || sponsor.type || 'Sponsor', url: sponsor.url || sponsor.link || sponsor.website || '', logo: sponsor.logo || sponsor.image || '', contribution: sponsor.contribution || '' }
    )),
  }), [t])
  const [brand, setBrand] = useState(initialBrand)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState('')
  const logoRef = useRef(null)
  const bannerRef = useRef(null)

  useEffect(() => {
    setBrand(initialBrand)
  }, [initialBrand])

  const validHex = /^#[0-9a-fA-F]{6}$/.test(brand.primaryColor)
  const set = (field, value) => setBrand(prev => ({ ...prev, [field]: value }))
  const updateSponsor = (index, field, value) => setBrand(prev => ({
    ...prev,
    sponsors: prev.sponsors.map((sponsor, i) => i === index ? { ...sponsor, [field]: value } : sponsor),
  }))
  const addSponsor = () => setBrand(prev => ({
    ...prev,
    sponsors: [...prev.sponsors, { name: '', tier: 'Sponsor', url: '', logo: '' }],
  }))
  const removeSponsor = (index) => setBrand(prev => ({
    ...prev,
    sponsors: prev.sponsors.filter((_, i) => i !== index),
  }))

  const uploadBrandFile = async (field, file) => {
    if (!file) return
    setUploading(field)
    setError('')
    try {
      const uploaded = await uploadsApi.upload(file)
      set(field, uploaded.url || '')
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.')
    } finally {
      setUploading('')
    }
  }

  const uploadSponsorLogo = async (index, file) => {
    if (!file) return
    setUploading(`sponsor-${index}`)
    setError('')
    try {
      const uploaded = await uploadsApi.upload(file)
      updateSponsor(index, 'logo', uploaded.url || '')
    } catch (err) {
      setError(err.message || 'No se pudo subir el logo del sponsor.')
    } finally {
      setUploading('')
    }
  }

  const saveBrand = async () => {
    setBusy(true)
    setError('')
    try {
      await onSave({
        logo: brand.logo,
        banner: brand.banner,
        primaryColor: validHex ? brand.primaryColor : (t.primaryColor || '#00E676'),
        organizerBrandName: brand.organizerBrandName,
        sponsors: brand.sponsors
          .map(sponsor => ({
            name: String(sponsor.name || '').trim(),
            tier: String(sponsor.tier || '').trim(),
            url: String(sponsor.url || '').trim(),
            logo: String(sponsor.logo || '').trim(),
            contribution: String(sponsor.contribution || '').trim(),
          }))
          .filter(sponsor => sponsor.name),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2600)
    } catch (err) {
      setError(err.message || 'No se pudo guardar la marca del torneo.')
    } finally {
      setBusy(false)
    }
  }

  const previewSponsors = brand.sponsors.filter(s => s.name.trim())

  return (
    <div className="otm-panel otm-mk">
      <div className="otm-panel__head">
        <div><h2>Sponsors / Marca</h2><p className="otm-muted">Identidad visual del torneo y sus patrocinadores.</p></div>
      </div>

      {/* Identidad visual */}
      <div className="otm-section">
        <h3>Identidad visual</h3>
        <div className="otm-mk-media">
          <button type="button" className={`otm-upload ${brand.logo ? 'has-media' : ''}`} onClick={() => logoRef.current?.click()}>
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={e => uploadBrandFile('logo', e.target.files?.[0])} />
            {brand.logo ? <span className="otm-upload__preview otm-upload__preview--logo" style={{ backgroundImage: `url(${brand.logo})` }} /> : <div className="otm-upload__icon">{Icon.upload}</div>}
            <p>{uploading === 'logo' ? 'Subiendo...' : brand.logo ? 'Logo cargado' : 'Logo del torneo'}</p>
            <span className="otm-muted">PNG/JPG · 512×512</span>
          </button>
          <button type="button" className={`otm-upload otm-upload--wide ${brand.banner ? 'has-media' : ''}`} onClick={() => bannerRef.current?.click()}>
            <input ref={bannerRef} type="file" accept="image/*" hidden onChange={e => uploadBrandFile('banner', e.target.files?.[0])} />
            {brand.banner ? <span className="otm-upload__preview otm-upload__preview--banner" style={{ backgroundImage: `url(${brand.banner})` }} /> : <div className="otm-upload__icon">{Icon.camera}</div>}
            <p>{uploading === 'banner' ? 'Subiendo...' : brand.banner ? 'Banner cargado' : 'Banner del torneo'}</p>
            <span className="otm-muted">1920×480 recomendado</span>
          </button>
        </div>

        <div className="otm-mk-fields">
          <div className="otm-field">
            <label>Nombre visible del organizador</label>
            <input value={brand.organizerBrandName} onChange={e => set('organizerBrandName', e.target.value)} />
          </div>
          <div className="otm-field">
            <label>Color principal</label>
            <div className="otm-mk-color">
              <input type="color" value={validHex ? brand.primaryColor : '#00E676'} onChange={e => set('primaryColor', e.target.value)} />
              <input className="otm-mk-color__hex" value={brand.primaryColor} onChange={e => set('primaryColor', e.target.value)} placeholder="#00E676" />
            </div>
            {!validHex && brand.primaryColor && <small className="otm-muted">Formato #RRGGBB. Al guardar se usa el color actual.</small>}
          </div>
        </div>
        <p className="otm-muted otm-mk-hint">El logo y el color son el mismo dato que en el asistente al crear el torneo.</p>
      </div>

      {/* Patrocinadores */}
      <div className="otm-section">
        <div className="otm-mk-sechead">
          <div><h3>Patrocinadores</h3><p className="otm-muted">Se muestran en la página pública del torneo.</p></div>
          <button className="otm-btn otm-btn--ghost" onClick={addSponsor}>{Icon.plus} Agregar</button>
        </div>
        <datalist id="otm-sponsor-tiers">
          {['Principal', 'Platino', 'Oro', 'Plata', 'Aliado', 'Colaborador', 'Media partner'].map(x => <option key={x} value={x} />)}
        </datalist>

        {brand.sponsors.length === 0 ? (
          <div className="otm-empty">{Icon.globe}<p>Sin patrocinadores todavía.</p></div>
        ) : (
          <div className="otm-mk-sponsors">
            {brand.sponsors.map((sponsor, index) => (
              <div className="otm-mk-sp" key={index}>
                <label className={`otm-mk-sp__logo ${sponsor.logo ? 'has' : ''}`}>
                  <input type="file" accept="image/*" hidden onChange={e => uploadSponsorLogo(index, e.target.files?.[0])} />
                  {sponsor.logo
                    ? <span style={{ backgroundImage: `url(${sponsor.logo})` }} />
                    : <>{Icon.upload}<small>{uploading === `sponsor-${index}` ? '...' : 'Logo'}</small></>}
                </label>
                <div className="otm-mk-sp__body">
                  <div className="otm-field"><label>Marca / sponsor</label><input value={sponsor.name} onChange={e => updateSponsor(index, 'name', e.target.value)} placeholder="Nombre de la marca" /></div>
                  <div className="otm-field"><label>Nivel</label><input list="otm-sponsor-tiers" value={sponsor.tier} onChange={e => updateSponsor(index, 'tier', e.target.value)} placeholder="Oro, Aliado..." /></div>
                  <div className="otm-field otm-mk-sp__wide"><label>Enlace</label><input value={sponsor.url} onChange={e => updateSponsor(index, 'url', e.target.value)} placeholder="https://..." /></div>
                  <div className="otm-field otm-mk-sp__wide"><label>Qué aporta (opcional)</label><input value={sponsor.contribution || ''} onChange={e => updateSponsor(index, 'contribution', e.target.value)} placeholder="Ej. periféricos para el podio, $500 al pozo, difusión" /></div>
                </div>
                <button className="otm-iconbtn otm-iconbtn--danger" onClick={() => removeSponsor(index)} title="Eliminar sponsor">{Icon.trash}</button>
              </div>
            ))}
          </div>
        )}

        {previewSponsors.length > 0 && (
          <div className="otm-mk-preview">
            <span>Vista pública</span>
            <div className="otm-mk-preview__row">
              {previewSponsors.map((s, i) => (
                <div className="otm-mk-chip" key={i}>
                  {s.logo ? <img src={s.logo} alt="" /> : <span className="otm-mk-chip__ph">{Icon.globe}</span>}
                  <div><b>{s.name}</b><small>{s.tier || 'Colaborador'}</small></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="otm-muted" style={{ color: 'var(--danger, #e04466)' }}>{error}</p>}
      <button className="otm-btn otm-btn--primary" onClick={saveBrand} disabled={busy || Boolean(uploading)}>
        {busy ? 'Guardando...' : saved ? 'Guardado' : 'Guardar sponsors / marca'}
      </button>
    </div>
  )
}

/* ═══════════════ COLABORADORES ═══════════════ */
function TabCasters({ t, onUpdate }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState(null) // caster {user, nick} awaiting reason
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const tournamentId = t.dbId || t.publicId
  const casters = (t.staff?.casters || []).filter(c => !c.removedAt)

  const handleSelect = async (member) => {
    setBusy(true)
    setError('')
    try {
      const saved = await tournamentsApi.addCaster(tournamentId, member.id)
      onUpdate(saved)
      setSearchOpen(false)
    } catch (err) {
      setError(err.message || 'No se pudo asignar el caster')
    } finally {
      setBusy(false)
    }
  }

  const confirmRemove = async () => {
    if (!reason.trim()) return
    setBusy(true)
    setError('')
    try {
      const saved = await tournamentsApi.removeCaster(tournamentId, pendingRemove.user, reason.trim())
      onUpdate(saved)
      setPendingRemove(null)
      setReason('')
    } catch (err) {
      setError(err.message || 'No se pudo remover el caster')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div><h2>Casters</h2><p className="otm-muted">Busca casters con rol aprobado y asignalos a este torneo</p></div>
        <button className="otm-btn otm-btn--primary" onClick={() => setSearchOpen(v => !v)}>
          {Icon.search} {searchOpen ? 'Cerrar busqueda' : 'Buscar caster'}
        </button>
      </div>

      {error && <p className="otm-muted" style={{ color: '#ef4444' }}>{error}</p>}

      {searchOpen && (
        <RoleStaffSearch
          roles={['caster']}
          excludeIds={casters.map(c => c.user)}
          selectLabel={busy ? 'Asignando...' : 'Asignar'}
          onSelect={handleSelect}
        />
      )}

      {casters.length === 0 ? (
        <div className="otm-empty">{Icon.play}<p>Aun no hay casters asignados a este torneo</p></div>
      ) : (
        <div className="otm-collab-list">
          {casters.map(c => (
            <div className="otm-collab" key={c.user}>
              {c.avatar ? <img src={c.avatar} alt={c.nick} /> : <div className="otm-collab__avatar-fallback">{(c.nick || '??').slice(0, 2).toUpperCase()}</div>}
              <div className="otm-collab__info"><b>{c.nick}</b><span>Caster</span></div>
              <span className="otm-tag">Caster</span>
              <button className="otm-iconbtn otm-iconbtn--danger" onClick={() => { setPendingRemove(c); setReason('') }}>{Icon.trash}</button>
            </div>
          ))}
        </div>
      )}

      {pendingRemove && (
        <div className="otm-invite" style={{ marginTop: 12 }}>
          <div className="otm-field otm-field--grow">
            <label>Justificacion para remover a {pendingRemove.nick}</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="ej. No confirmo asistencia, cambio de horario del torneo..." />
          </div>
          <button className="otm-btn otm-btn--primary otm-btn--end" disabled={!reason.trim() || busy} onClick={confirmRemove}>
            {Icon.check} Confirmar
          </button>
          <button className="otm-btn" onClick={() => setPendingRemove(null)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}

const STAFF_STATUS_META = {
  accepted: { txt: 'Confirmado', cls: 'otm-on' },
  declined: { txt: 'Rechazo', cls: 'otm-off' },
  pending: { txt: 'Pendiente', cls: '' },
  // Se postulo por su cuenta (StaffApply) -- distinto de 'pending' (el
  // organizador invito y falta que la persona responda): aca falta que EL
  // organizador apruebe/rechace, ver botones abajo.
  requested: { txt: 'Postulacion', cls: 'otm-requested' },
}

function TabColaboradores({ t, onUpdate }) {
  const staff = useMemo(() => (Array.isArray(t.staffMembers) ? t.staffMembers : []), [t.staffMembers])
  const [searchOpen, setSearchOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingRemove, setPendingRemove] = useState(null)
  const [permsOpenFor, setPermsOpenFor] = useState(null)
  const [, forceTick] = useState(0)

  const tournamentId = t.dbId || t.publicId
  const accepted = staff.filter(m => m.status === 'accepted').length

  const addStaff = async (person, roleEntry) => {
    if (staff.some(s => String(s.user) === String(person.id))) return
    setBusy(true); setError('')
    try {
      const { tournament } = await tournamentsApi.addStaff(tournamentId, {
        userId: person.id, nick: person.nick, avatar: person.avatar || '',
        playerCode: person.playerCode || '', platformRole: roleEntry?.role || '',
        role: STAFF_ROLE_BY_PLATFORM[roleEntry?.role] || 'Moderador',
      })
      onUpdate(tournament)
      setSearchOpen(false)
    } catch (err) {
      setError(err.message || 'No se pudo agregar al staff.')
    } finally {
      setBusy(false)
    }
  }
  const setRole = async (userId, role) => {
    setBusy(true); setError('')
    try {
      const { tournament } = await tournamentsApi.updateStaff(tournamentId, userId, { role })
      onUpdate(tournament)
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el rol.')
    } finally {
      setBusy(false)
    }
  }
  const resolveRequest = async (userId, decision) => {
    setBusy(true); setError('')
    try {
      const { tournament } = await tournamentsApi.updateStaff(tournamentId, userId, { status: decision })
      onUpdate(tournament)
    } catch (err) {
      setError(err.message || 'No se pudo resolver la postulación.')
    } finally {
      setBusy(false)
    }
  }
  const confirmRemove = async () => {
    setBusy(true); setError('')
    try {
      const { tournament } = await tournamentsApi.removeStaff(tournamentId, pendingRemove.user)
      onUpdate(tournament)
      setPendingRemove(null)
    } catch (err) {
      setError(err.message || 'No se pudo quitar del staff.')
    } finally {
      setBusy(false)
    }
  }

  // Ajuste de acceso puntual por pestaña (ver staffPermissions.js): se persiste
  // en el torneo (Tournament.staffMembers[].permissions); localStorage queda
  // como respaldo optimista mientras vuelve la respuesta del servidor.
  const setMemberTabAccess = async (userId, tabKey, level) => {
    setLocalOverride(tournamentId, userId, tabKey, level)
    forceTick(v => v + 1)
    try {
      const { tournament } = await tournamentsApi.updateStaff(tournamentId, userId, { permissions: { [tabKey]: level } })
      onUpdate(tournament)
    } catch { /* queda el ajuste local mientras tanto */ }
  }

  return (
    <>
      <TabCasters t={t} onUpdate={onUpdate} />

      <div className="otm-panel">
        <div className="otm-panel__head">
          <div>
            <h2>Staff del torneo</h2>
            <p className="otm-muted">
              Perfiles reales de GlitchGang con rol aprobado. Cada persona confirma desde su panel; hasta entonces figura como pendiente.
            </p>
          </div>
          <button className="otm-btn otm-btn--primary" onClick={() => setSearchOpen(v => !v)} disabled={busy}>
            {Icon.search} {searchOpen ? 'Cerrar' : 'Agregar staff'}
          </button>
        </div>

        {error && <p className="otm-muted" style={{ color: 'var(--danger, #ef4444)' }}>{error}</p>}

        {searchOpen && (
          <RoleStaffSearch
            roles={PLATFORM_STAFF_ROLES}
            excludeIds={staff.map(s => s.user).filter(Boolean)}
            selectLabel={busy ? 'Agregando...' : 'Agregar'}
            onSelect={addStaff}
          />
        )}

        {staff.length === 0 ? (
          <div className="otm-empty">{Icon.users}<p>Sin staff asignado. El staff tambien se invita desde el asistente al crear el torneo.</p></div>
        ) : (
          <>
            <p className="otm-muted" style={{ margin: '4px 0 10px' }}>{accepted}/{staff.length} confirmados</p>
            <div className="otm-collab-list">
              {staff.map(m => {
                const st = STAFF_STATUS_META[m.status] || STAFF_STATUS_META.pending
                const permsOpen = permsOpenFor === m.user
                return (
                  <div key={m.user || m.nick}>
                    <div className="otm-collab">
                      {m.avatar
                        ? <img src={m.avatar} alt={m.nick || m.name} />
                        : <div className="otm-collab__avatar-fallback">{(m.nick || m.name || '??').slice(0, 2).toUpperCase()}</div>}
                      <div className="otm-collab__info">
                        <b>{m.nick || m.name}</b>
                        <span className={st.cls}>{st.txt}{m.platformRole ? ` · ${m.platformRole}` : ''}</span>
                        {m.responseReason && <small className="otm-muted otm-collab__reason">“{m.responseReason}”</small>}
                      </div>
                      <select value={STAFF_ROLES.includes(m.role) ? m.role : 'Moderador'} onChange={e => setRole(m.user, e.target.value)} disabled={busy}>
                        {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {m.status === 'requested' ? (
                        <>
                          <button className="otm-btn otm-btn--xs otm-btn--primary" onClick={() => resolveRequest(m.user, 'accepted')} disabled={busy}>
                            {Icon.check} Aceptar
                          </button>
                          <button className="otm-btn otm-btn--xs otm-btn--ghost" onClick={() => resolveRequest(m.user, 'declined')} disabled={busy}>
                            {Icon.x} Rechazar
                          </button>
                        </>
                      ) : (
                        <button
                          className={`otm-btn otm-btn--xs otm-btn--ghost ${permsOpen ? 'otm-btn--active' : ''}`}
                          onClick={() => setPermsOpenFor(permsOpen ? null : m.user)}
                          title="Permisos por pestaña"
                        >
                          {Icon.shield} Permisos
                        </button>
                      )}
                      <button className="otm-iconbtn otm-iconbtn--danger" onClick={() => setPendingRemove(m)} disabled={busy} title="Quitar del staff">{Icon.trash}</button>
                    </div>
                    {permsOpen && (
                      <StaffPermissionsEditor
                        member={m}
                        tournamentId={tournamentId}
                        onChange={(tabKey, level) => setMemberTabAccess(m.user, tabKey, level)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {pendingRemove && (
          <div className="otm-invite" style={{ marginTop: 12 }}>
            <span className="otm-field otm-field--grow" style={{ alignSelf: 'center' }}>
              Quitar a <b>{pendingRemove.nick || pendingRemove.name}</b> del staff de este torneo.
            </span>
            <button className="otm-btn otm-btn--primary otm-btn--end" disabled={busy} onClick={confirmRemove}>{Icon.check} Quitar</button>
            <button className="otm-btn" onClick={() => setPendingRemove(null)}>Cancelar</button>
          </div>
        )}

        <p className="otm-muted" style={{ fontSize: 12, marginTop: 14 }}>
          {Icon.alert} Al agregar a alguien queda como pendiente y aparece en su pagina de invitaciones. El aviso automatico por notificacion todavia no esta (ver BACKEND-PENDIENTE).
        </p>
        <p className="otm-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {Icon.lock} "Permisos" define qué pestañas de este panel puede ver o editar cada persona (el rol le da un punto de partida, ajustable acá). Se guarda en el servidor, así que se ve igual desde cualquier dispositivo.
        </p>
      </div>
    </>
  )
}

// Vista previa de "Actividad del torneo" — sin datos reales todavia (el
// servidor no guarda ninguna accion de staff, ver BACKEND-PENDIENTE), asi
// que muestra la forma final (columnas + filas fantasma) en vez de una
// oracion suelta. Nada de nombres/acciones inventados: son placeholders.
function TabActividad({ t }) {
  const columns = ['Quién', 'Rol', 'Acción', 'Cuándo']
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    if (!t?.id && !t?._id) return
    tournamentsApi.auditLog(t.id || t._id, { limit: 30 })
      .then(res => { if (alive) setEntries(Array.isArray(res?.entries) ? res.entries : []) })
      .catch(() => { if (alive) setError('No se pudo cargar la actividad del torneo.') })
    return () => { alive = false }
  }, [t?.id, t?._id])

  const formatWhen = (iso) => {
    try { return new Date(iso).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
    catch { return '—' }
  }

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div>
          <h2>Actividad del torneo</h2>
          <p className="otm-muted">Quién del staff hizo qué y cuándo — bracket, check-in, reglas, premios y más, en un mismo historial.</p>
        </div>
      </div>

      {error && <p className="otm-muted">{Icon.alert} {error}</p>}

      {entries === null && !error && (
        <div className="otm-activity-ghost">
          <div className="otm-activity-ghost__row otm-activity-ghost__row--head">
            {columns.map(c => <span key={c}>{c}</span>)}
          </div>
          {[0, 1, 2].map(i => (
            <div className="otm-activity-ghost__row" key={i}>
              {columns.map(c => <span key={c}>—</span>)}
            </div>
          ))}
        </div>
      )}

      {entries !== null && entries.length === 0 && (
        <p className="otm-muted" style={{ textAlign: 'center', marginTop: 4 }}>
          Todavía no hay actividad registrada en este torneo.
        </p>
      )}

      {entries !== null && entries.length > 0 && (
        <div className="otm-activity-ghost">
          <div className="otm-activity-ghost__row otm-activity-ghost__row--head">
            {columns.map(c => <span key={c}>{c}</span>)}
          </div>
          {entries.map(entry => (
            <div className="otm-activity-ghost__row" key={entry.id}>
              <span>{entry.userNick || 'Usuario'}</span>
              <span>{entry.role || '—'}</span>
              <span>{entry.summary}</span>
              <span>{formatWhen(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Editor de acceso por pestaña para un miembro del staff: 3 niveles (Sin
// acceso / Ver / Ver y editar), con el default de su rol como punto de
// partida y un "Restablecer" cuando alguien lo customizó.
function StaffPermissionsEditor({ member, tournamentId, onChange }) {
  const defaults = roleDefaults(member.role)
  return (
    <div className="otm-perms">
      <p className="otm-muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
        Acceso de <b>{member.nick || member.name}</b> ({member.role}) por pestaña del panel:
      </p>
      <div className="otm-perms__grid">
        {MANAGE_TABS.filter(tabDef => tabDef.key !== 'sala').map(tabDef => {
          const current = getLocalOverrides(tournamentId, member.user)[tabDef.key] || defaults[tabDef.key] || ACCESS_NONE
          const customized = isCustomized(member, tabDef.key, tournamentId)
          return (
            <div className="otm-perms__row" key={tabDef.key}>
              <span className="otm-perms__label">{tabDef.label}</span>
              <div className="otm-perms__levels">
                {ACCESS_LEVELS.map(level => (
                  <button
                    key={level}
                    type="button"
                    className={`otm-perms__lvl ${current === level ? 'otm-perms__lvl--on' : ''}`}
                    onClick={() => onChange(tabDef.key, level)}
                  >
                    {ACCESS_LABEL[level]}
                  </button>
                ))}
              </div>
              {customized ? (
                <button type="button" className="otm-perms__reset" onClick={() => onChange(tabDef.key, null)}>Restablecer</button>
              ) : (
                <span className="otm-perms__default">por defecto</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════ WHATSAPP ═══════════════ */
// (Pestana de WhatsApp eliminada: era una maqueta sin backend. El bot de
// WhatsApp vive en el proyecto whatsapp-bot-crm, fuera de este panel.)

/* ═══════════════ DISCORD ═══════════════ */
const MATCH_STATUS_LABEL = {
  checking_in: 'En check-in',
  ready: 'Listo en sala',
  in_progress: 'Partida en curso',
  completed: 'Completada',
  disqualified: 'Descalificado',
  cancelled: 'Cancelada',
}

const DISCORD_STATUS_HELP = [
  { status: 'none', desc: 'Discord esta desactivado para este torneo. Activalo con el boton de arriba.' },
  { status: 'pending', desc: 'El pedido ya salio hacia el bot, todavia no respondio. Si se queda asi mas de un minuto, dale "Recargar" o confirma que el bot este en linea.' },
  { status: 'processing', desc: 'El bot esta creando la categoria, los canales o los roles en Discord ahora mismo.' },
  { status: 'ready', desc: 'Todo se creo correctamente: categoria, canales y roles reales ya existen en el servidor de Discord.' },
  { status: 'partial', desc: 'La sala se creo, pero a algun jugador le falta vincular su cuenta de Discord, asi que todavia no tiene el rol de su equipo.' },
  { status: 'failed', desc: 'Algo fallo. Lee el mensaje de error debajo del equipo o del torneo y usa "Reintentar".' },
]

const DISCORD_SUBNAV = [
  { key: 'resumen', label: 'Resumen', icon: 'dashboard' },
  { key: 'equipos', label: 'Equipos', icon: 'users' },
  { key: 'torneo', label: 'Torneo', icon: 'layers' },
  { key: 'tickets', label: 'Tickets', icon: 'helpCircle' },
  { key: 'mensajes', label: 'Mensajes', icon: 'messageSquare' },
]

// Tickets que los jugadores abren desde #soporte del torneo en Discord.
// Se conversa en el hilo de Discord; aca se ve el historial y se pueden cerrar
// (el bot archiva el hilo solo).
function DiscordTickets({ t }) {
  const tid = t.dbId || t.publicId
  const [tickets, setTickets] = useState(null)
  const [error, setError] = useState('')
  const [resolvingId, setResolvingId] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const guildId = t.discordProvision?.guildId

  const load = () => tournamentsApi.listSupportTickets(tid)
    .then((data) => { setTickets(data.tickets || []); setError('') })
    .catch((err) => setError(err.message || 'No se pudieron cargar los tickets.'))

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid])

  const resolve = async (ticketId) => {
    setResolvingId(ticketId)
    setError('')
    try {
      const { ticket } = await tournamentsApi.resolveSupportTicket(tid, ticketId)
      setTickets((list) => (list || []).map((item) => (item.id === ticket.id ? ticket : item)))
    } catch (err) {
      setError(err.message || 'No se pudo cerrar el ticket.')
    } finally {
      setResolvingId('')
    }
  }

  const open = (tickets || []).filter((ticket) => ticket.status === 'open')
  const resolved = (tickets || []).filter((ticket) => ticket.status === 'resolved')
  const visible = showResolved ? [...open, ...resolved] : open

  return (
    <div className="otm-section">
      <div className="otm-panel__head" style={{ marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Tickets de soporte</h3>
          <p className="otm-muted" style={{ fontSize: 12.5 }}>
            Los jugadores los abren desde <b>#soporte</b> eligiendo una categoria. El bot menciona al
            rol de staff y de organizador en un hilo nuevo; responde ahi y cierralo cuando quede resuelto.
          </p>
        </div>
        <span className="otm-conn otm-conn--on">{open.length} abierto{open.length === 1 ? '' : 's'}</span>
      </div>

      {error && <p className="otm-muted" style={{ color: 'var(--danger, #e04466)', fontSize: 12.5 }}>{Icon.alert} {error}</p>}

      {tickets === null ? (
        <p className="otm-muted" style={{ fontSize: 12.5 }}>Cargando tickets...</p>
      ) : visible.length === 0 ? (
        <div className="otm-empty">{Icon.helpCircle}<p>{open.length === 0 && resolved.length > 0 ? 'No hay tickets abiertos.' : 'Todavia nadie abrio un ticket.'}</p></div>
      ) : (
        <div className="otm-dc-tickets">
          {visible.map((ticket) => {
            const threadUrl = discordChannelUrl(guildId || ticket.discord?.guildId, ticket.discord?.threadId || ticket.discord?.channelId)
            return (
              <div key={ticket.id} className={`otm-dc-ticket ${ticket.status === 'resolved' ? 'is-resolved' : ''}`}>
                <div className="otm-dc-ticket__head">
                  <b>{ticket.categoryLabel}</b>
                  <span className="otm-muted">{fmtDT(ticket.createdAt) || ''}</span>
                </div>
                <p className="otm-dc-ticket__who">
                  {ticket.teamName ? <><b>{ticket.teamName}</b> · </> : null}
                  <span data-no-translate>{ticket.requesterName || 'Jugador'}</span>
                </p>
                {ticket.detail && <p className="otm-dc-ticket__detail">{ticket.detail}</p>}
                <div className="otm-dc-ticket__actions">
                  {threadUrl && (
                    <a className="otm-btn otm-btn--ghost otm-btn--xs" href={safeHref(threadUrl)} target="_blank" rel="noreferrer">
                      {Icon.discord} Abrir hilo
                    </a>
                  )}
                  {ticket.status === 'open' ? (
                    <button type="button" className="otm-btn otm-btn--primary otm-btn--xs" disabled={resolvingId === ticket.id} onClick={() => resolve(ticket.id)}>
                      {Icon.check} {resolvingId === ticket.id ? 'Cerrando...' : 'Marcar resuelto'}
                    </button>
                  ) : (
                    <span className="otm-muted" style={{ fontSize: 12 }}>
                      {Icon.check} Resuelto{ticket.resolvedByName ? ` por ${ticket.resolvedByName}` : ''}{ticket.resolvedFrom === 'web' ? ' (web)' : ticket.resolvedFrom === 'discord' ? ' (Discord)' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" style={{ marginTop: 10 }} onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? 'Ocultar resueltos' : `Ver resueltos (${resolved.length})`}
        </button>
      )}
    </div>
  )
}

function fmtDT(iso) {
  if (!iso) return null
  try { return new Date(iso).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return null }
}

function DiscordHelpModal({ onClose }) {
  return (
    <div className="otm-help" onClick={onClose}>
      <div className="otm-help__card" onClick={e => e.stopPropagation()}>
        <div className="otm-help__head">
          <div><span className="otm-help__pre">AYUDA</span><h3>{Icon.discord} Como funciona Discord aca</h3></div>
          <button type="button" className="otm-iconbtn" onClick={onClose}>{Icon.x}</button>
        </div>

        <p className="otm-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          Un bot crea y mantiene la sala de Discord de <b>este</b> torneo: categoria,
          canales (noticias, reglas, bracket, check-in, resultados, soporte, staff),
          voz, y un canal + rol privado por cada equipo inscrito. No hace falta tocar
          nada a mano en Discord — el bot reacciona solo cuando el torneo o un equipo
          cambian.
        </p>

        <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>Que significa cada estado</h4>
        <ul className="otm-help__list">
          {DISCORD_STATUS_HELP.map(s => (
            <li key={s.status}><CiStatusPill status={s.status} /><span>{s.desc}</span></li>
          ))}
        </ul>

        <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>Si el bot no responde o algo quedo en "Error"</h4>
        <ol className="otm-help__steps">
          <li>Mira el estado en <b>Resumen</b> o <b>Equipos</b> — si dice "Error", el mensaje debajo explica que fallo.</li>
          <li><b>Reintentar</b>, junto al equipo o torneo que fallo, le vuelve a pedir al bot que cree lo que falte sin duplicar lo que ya existe.</li>
          <li>Si algo queda "Pendiente" o "Creando..." por mas de un minuto, usa <b>Recargar</b> arriba — puede que ya haya terminado y solo falte traer el dato nuevo.</li>
          <li>Si sigue sin responder despues de eso, el proceso del bot esta caido del otro lado — avisa a soporte tecnico, no hay nada mas para arreglar desde esta pantalla.</li>
        </ol>
      </div>
    </div>
  )
}

// Despues de pedir un reintento, el bot lo procesa async (poll de su cola,
// cada ~8s) -- esto reconsulta el estado unas cuantas veces para poder avisar
// "ya se soluciono" en vez de dejar al organizador sin saber que paso.
async function pollUntilResolved(check, { intervalMs = 3000, maxAttempts = 6 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    try {
      if (await check()) return true
    } catch { /* seguimos intentando hasta agotar los intentos */ }
  }
  return false
}

function TabDiscord({ t, onSave, onReload }) {
  const navigate = useNavigate()
  const [section, setSection] = useState('resumen')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [retryingTeamId, setRetryingTeamId] = useState('')
  const [retryFeedback, setRetryFeedback] = useState({})
  const [retryingTournament, setRetryingTournament] = useState(false)
  const [tournamentRetryError, setTournamentRetryError] = useState('')
  const [reloading, setReloading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [log, setLog] = useState(null)
  const [loadingLog, setLoadingLog] = useState(false)
  const [logUnavailable, setLogUnavailable] = useState(false)
  const [logError, setLogError] = useState('')

  const loadDiscordSummary = () => {
    setLoadingSummary(true)
    return tournamentsApi.getDiscordSummary(t.dbId || t.publicId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false))
  }

  useEffect(() => {
    loadDiscordSummary()
  }, [t.dbId, t.publicId])

  // El log de mensajes automaticos depende de un endpoint que el backend
  // todavia no tiene (BACKEND-PENDIENTE.md #discord-log-mensajes) -- se pide
  // solo, en vez de reintentar en bucle, y un 404 se trata distinto de un
  // error real (ver logUnavailable mas abajo).
  const loadLog = () => {
    setLoadingLog(true)
    setLogError('')
    return tournamentsApi.getDiscordLog(t.dbId || t.publicId, { limit: 40 })
      .then((data) => { setLog(data.entries || data.log || []); setLogUnavailable(false) })
      .catch((err) => {
        setLog(null)
        setLogUnavailable(err.status === 404)
        if (err.status !== 404) setLogError(err.message || 'No se pudo cargar el registro de mensajes.')
      })
      .finally(() => setLoadingLog(false))
  }

  useEffect(() => {
    if (section === 'mensajes' && log === null && !loadingLog) loadLog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  const reloadAll = async () => {
    setReloading(true)
    try {
      await Promise.all([
        loadDiscordSummary(),
        onReload ? Promise.resolve(onReload()) : Promise.resolve(),
        section === 'mensajes' ? loadLog() : Promise.resolve(),
      ])
    } finally {
      setReloading(false)
    }
  }

  const toggle = async () => {
    setBusy(true)
    setError('')
    try {
      await onSave({ discordEnabled: !t.discordEnabled })
    } catch (err) {
      setError(err.message || 'No se pudo actualizar.')
    } finally {
      setBusy(false)
    }
  }

  const retryTeamProvision = async (teamId) => {
    setRetryingTeamId(teamId)
    setError('')
    setRetryFeedback((prev) => { const next = { ...prev }; delete next[teamId]; return next })
    try {
      await tournamentsApi.retryTeamDiscordProvision(t.dbId || t.publicId, teamId)
      const resolved = await pollUntilResolved(async () => {
        const data = await tournamentsApi.getDiscordSummary(t.dbId || t.publicId)
        setSummary(data)
        const teamProvision = (data.teams || []).find((tm) => tm.id === teamId)?.discordProvision || {}
        return teamProvision.status !== 'failed' && teamProvision.welcomeSent !== false
      })
      setRetryFeedback((prev) => ({
        ...prev,
        [teamId]: resolved
          ? { tone: 'success', message: 'Listo, el problema se solucionó.' }
          : { tone: 'error', message: 'Sigue fallando. El bot puede tardar un poco mas -- intenta de nuevo en un momento.' },
      }))
      if (resolved) {
        setTimeout(() => {
          setRetryFeedback((prev) => { const next = { ...prev }; delete next[teamId]; return next })
        }, 8000)
      }
    } catch (err) {
      setError(err.message || 'No se pudo reintentar la sincronizacion de Discord.')
    } finally {
      setRetryingTeamId('')
    }
  }

  // El backend espera a que el bot termine de crear la sala (o falle) antes
  // de responder -- no hace falta poll, con recargar el torneo al terminar
  // ya viene el discordProvision real (t.discordProvision, no summary).
  const retryTournamentProvision = async () => {
    setRetryingTournament(true)
    setTournamentRetryError('')
    try {
      await tournamentsApi.retryTournamentDiscordProvision(t.dbId || t.publicId)
    } catch (err) {
      setTournamentRetryError(err.message || 'No se pudo reintentar la creacion de la sala del torneo.')
    } finally {
      if (typeof onReload === 'function') await Promise.resolve(onReload())
      setRetryingTournament(false)
    }
  }

  const teams = summary?.teams || []
  const unverifiedTotal = teams.reduce((sum, team) => sum + (team.playersCount - team.verifiedCount), 0)
  const provision = t.discordProvision || {}
  const provisionStatus = provision.status || 'none'
  const roleIds = [
    { key: 'organizerRoleId', label: 'Rol de organizador' },
    { key: 'staffRoleId', label: 'Rol de staff' },
    { key: 'playerRoleId', label: 'Rol de jugador' },
  ]

  return (
    <div className="otm-panel">
      {showHelp && <DiscordHelpModal onClose={() => setShowHelp(false)} />}

      <div className="otm-panel__head">
        <div><h2>Discord</h2><p className="otm-muted">Activa este torneo para que el bot de Discord lo vea (check-in, reportes, roles).</p></div>
        <div className="otm-discord-headactions">
          <span className={`otm-conn ${t.discordEnabled ? 'otm-conn--on' : ''}`}>{t.discordEnabled ? 'o Activado' : 'o Desactivado'}</span>
          {t.discordEnabled && (
            <>
              <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" onClick={reloadAll} disabled={reloading}>
                {Icon.refresh} {reloading ? 'Recargando...' : 'Recargar'}
              </button>
              <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" onClick={() => setShowHelp(true)}>
                {Icon.helpCircle} Ayuda
              </button>
            </>
          )}
        </div>
      </div>

      {!t.discordEnabled && (
        <div className="otm-section">
          <p className="otm-muted">
            Los torneos con Discord se juegan en el servidor de GlitchGang. Un admin
            tiene que habilitarte Discord una sola vez; podes solicitarlo desde el
            asistente de crear torneo. Despues activas el bot aca.
          </p>
        </div>
      )}

      {error && <p className="otm-muted" style={{ color: 'var(--danger, #e04466)' }}>{error}</p>}

      <button className={`otm-btn ${t.discordEnabled ? 'otm-btn--danger-ghost' : 'otm-btn--primary'}`} onClick={toggle} disabled={busy}>
        {busy ? 'Guardando...' : t.discordEnabled ? 'Desactivar en Discord' : 'Activar en Discord'}
      </button>

      {t.discordEnabled && (
        <>
          <div className="otm-subnav">
            {DISCORD_SUBNAV.map(s => (
              <button
                key={s.key}
                type="button"
                className={`otm-subnav__item ${section === s.key ? 'is-active' : ''}`}
                onClick={() => setSection(s.key)}
              >
                {Icon[s.icon]} {s.label}
              </button>
            ))}
          </div>

          {section === 'resumen' && (
            <>
              <div className="otm-section">
                <div className="otm-panel__head" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{Icon.crown} Tu rol de organizador</h3>
                    <p className="otm-muted">
                      El bot te asigna un rol de administracion que solo puede tocar lo que lleva el
                      codigo de <b>este</b> torneo (<b>{t.publicId}</b>) — sus canales, sus roles de equipo,
                      sus mensajes. No te da acceso a ningun otro torneo del servidor de GlitchGang.
                    </p>
                  </div>
                  <CiStatusPill status={provisionStatus} />
                </div>

                {provisionStatus === 'failed' ? (
                  <>
                    <p className="otm-muted" style={{ color: 'var(--danger, #e04466)', fontSize: 12.5 }}>
                      {Icon.alert} El bot no pudo crear la sala de este torneo: {provision.error || 'error desconocido, revisa con soporte tecnico.'}
                    </p>
                    <button
                      type="button"
                      className="otm-btn otm-btn--ghost otm-btn--xs"
                      disabled={retryingTournament}
                      onClick={retryTournamentProvision}
                    >
                      {Icon.refresh} {retryingTournament ? 'Reintentando...' : 'Reintentar'}
                    </button>
                    {tournamentRetryError && (
                      <p className="otm-muted" style={{ color: 'var(--danger, #e04466)', fontSize: 11.5, marginTop: 4 }}>
                        {Icon.alert} {tournamentRetryError}
                      </p>
                    )}
                  </>
                ) : provisionStatus === 'ready' ? (
                  <a
                    className="otm-btn otm-btn--primary"
                    href={discordChannelUrl(provision.guildId, provision.channels?.newsId || provision.channels?.checkinId)}
                    target="_blank" rel="noreferrer"
                  >
                    {Icon.discord} Ir al Discord de este torneo
                  </a>
                ) : (
                  <p className="otm-muted" style={{ fontSize: 12.5 }}>{Icon.refresh} El enlace directo aparece apenas el bot termine de crear la sala del torneo.</p>
                )}

                {provisionStatus === 'ready' && (
                  <div className="otm-discord-links" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {DISCORD_CHANNEL_LINKS.map(({ key, label }) => {
                      const url = discordChannelUrl(provision.guildId, provision.channels?.[key])
                      if (!url) return null
                      return (
                        <a key={key} className="otm-btn otm-btn--ghost otm-btn--xs" href={safeHref(url)} target="_blank" rel="noreferrer">
                          {Icon.discord} {label}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>

              {!loadingSummary && summary && (
                <>
                  <div className="otm-cards">
                    <div className="otm-card">
                      <div className="otm-card__icon" style={{ background: '#f59e0b1f', color: '#f59e0b' }}>{Icon.check}</div>
                      <div className="otm-card__body"><span className="otm-card__label">En check-in</span><b className="otm-card__value">{summary.matchSummary.checking_in}</b></div>
                    </div>
                    <div className="otm-card">
                      <div className="otm-card__icon" style={{ background: '#3b82f61f', color: '#3b82f6' }}>{Icon.discord}</div>
                      <div className="otm-card__body"><span className="otm-card__label">En curso</span><b className="otm-card__value">{summary.matchSummary.in_progress}</b></div>
                    </div>
                    <div className="otm-card">
                      <div className="otm-card__icon" style={{ background: '#22c55e1f', color: '#22c55e' }}>{Icon.award}</div>
                      <div className="otm-card__body"><span className="otm-card__label">Completadas</span><b className="otm-card__value">{summary.matchSummary.completed}</b></div>
                    </div>
                    <div className="otm-card">
                      <div className="otm-card__icon" style={{ background: '#ef44441f', color: '#ef4444' }}>{Icon.alert}</div>
                      <div className="otm-card__body"><span className="otm-card__label">Descalificados</span><b className="otm-card__value">{summary.matchSummary.disqualified}</b></div>
                    </div>
                  </div>

                  <div className="otm-section otm-voice-evidence">
                    <div>
                      <h3>{Icon.wifi} Evidencia de voz y grabaciones</h3>
                      <p className="otm-muted">
                        El CRM del bot debe enviar a este panel las sesiones de voice, grabaciones del match y eventos de screen share para revisar reclamos del torneo.
                      </p>
                    </div>
                    <div className="otm-voice-evidence__grid">
                      <div>
                        <span>Fuente CRM</span>
                        <b>voice_sessions</b>
                        <small>Entradas, salidas, movimientos, canal y duracion.</small>
                      </div>
                      <div>
                        <span>Grabaciones</span>
                        <b>match_recordings</b>
                        <small>Match ID, estado, participantes, duracion y ruta protegida.</small>
                      </div>
                      <div>
                        <span>Panel organizador</span>
                        <b>Pendiente backend</b>
                        <small>Falta endpoint del torneo para recibir esa evidencia desde el CRM.</small>
                      </div>
                    </div>
                  </div>

                  {summary.recentActivity.length > 0 && (
                    <div className="otm-section">
                      <h3>Actividad reciente del bot</h3>
                      <ul className="otm-keyvals">
                        {summary.recentActivity.map((a) => (
                          <li key={a.id}>
                            <span>{a.teamName}</span>
                            <b>{MATCH_STATUS_LABEL[a.status] || a.status}</b>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {section === 'equipos' && (
            <div className="otm-section">
              <h3>Equipos y verificacion de Discord</h3>
              {unverifiedTotal > 0 && (
                <div className="otm-discord-warning">
                  {Icon.alert}
                  <span>{unverifiedTotal} jugador{unverifiedTotal === 1 ? '' : 'es'} sin Discord vinculado — el bot no les da el rol del equipo hasta que vinculen su cuenta en Ajustes → Conexiones.</span>
                </div>
              )}
              {loadingSummary ? (
                <p className="otm-muted" style={{ fontSize: 12.5 }}>Cargando equipos...</p>
              ) : teams.length === 0 ? (
                <div className="otm-empty">{Icon.discord}<p>Sin equipos inscritos todavia</p></div>
              ) : (
                <div className="otm-teamlist">
                  {teams.map((team) => {
                    const ok = team.playersCount > 0 && team.verifiedCount === team.playersCount
                    const teamProvision = team.discordProvision || {}
                    const hasProblem = teamProvision.status === 'failed' || teamProvision.welcomeSent === false
                    const feedback = retryFeedback[team.id]
                    return (
                      <div key={team.id}>
                        <div className="otm-teamrow">
                          <div className="otm-teamrow__icon">{team.tag}</div>
                          <div className="otm-teamrow__body">
                            <span className="otm-teamrow__name">{team.name}</span>
                            <span className="otm-teamrow__meta">{team.playersCount} jugador{team.playersCount === 1 ? '' : 'es'}</span>
                          </div>
                          <span className={`otm-teamrow__badge ${ok ? 'otm-teamrow__badge--ok' : 'otm-teamrow__badge--warn'}`}>
                            {ok ? Icon.check : Icon.alert} {team.verifiedCount}/{team.playersCount} Discord
                          </span>
                          <CiStatusPill status={teamProvision.status || 'none'} />
                        </div>
                        {teamProvision.status === 'failed' && teamProvision.error && (
                          <p className="otm-muted" style={{ color: 'var(--danger, #e04466)', fontSize: 11.5, margin: '4px 0 0 50px' }}>
                            {Icon.alert} {teamProvision.error}
                          </p>
                        )}
                        {/* welcomeSent === false (no undefined) -- el bot ya confirmo el fallo,
                            no es solo un equipo viejo de antes de que este campo existiera. */}
                        {teamProvision.welcomeSent === false && teamProvision.status !== 'failed' && (
                          <p className="otm-muted" style={{ color: '#f59e0b', fontSize: 11.5, margin: '4px 0 0 50px' }}>
                            {Icon.alert} La sala se creo pero el mensaje de bienvenida no se pudo enviar.
                          </p>
                        )}
                        {hasProblem && (
                          <button
                            type="button"
                            className="otm-btn otm-btn--ghost otm-btn--xs"
                            style={{ margin: '6px 0 0 50px' }}
                            disabled={retryingTeamId === team.id}
                            onClick={() => retryTeamProvision(team.id)}
                          >
                            {Icon.refresh} {retryingTeamId === team.id
                              ? 'Reintentando...'
                              : teamProvision.status === 'failed' ? 'Reintentar Discord' : 'Reenviar bienvenida'}
                          </button>
                        )}
                        {feedback && (
                          <p
                            className="otm-muted"
                            style={{ color: feedback.tone === 'success' ? 'var(--success, #22c55e)' : 'var(--danger, #e04466)', fontSize: 11.5, margin: '4px 0 0 50px' }}
                          >
                            {feedback.tone === 'success' ? Icon.check : Icon.alert} {feedback.message}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'torneo' && (
            <div className="otm-section">
              <h3>Espacio de Discord de este torneo</h3>
              <p className="otm-muted" style={{ fontSize: 12.5 }}>
                {provision.guildId ? <>Servidor <code>{provision.guildId}</code>.</> : 'Todavia no se registro el servidor de Discord.'}
                {' '}{provision.provisionedAt ? <>Creado {fmtDT(provision.provisionedAt)}.</> : null}
                {' '}{provision.lastSyncAt ? <>Ultima sincronizacion {fmtDT(provision.lastSyncAt)}.</> : null}
              </p>

              <div className="otm-dc-table">
                {DISCORD_CHANNEL_LINKS.map(({ key, label }) => {
                  const channelId = provision.channels?.[key]
                  const url = discordChannelUrl(provision.guildId, channelId)
                  return (
                    <div key={key} className="otm-dc-row">
                      <span className="otm-dc-row__label">{label}</span>
                      <CiStatusPill status={channelId ? 'ready' : 'pending'} />
                      {url ? (
                        <a href={safeHref(url)} target="_blank" rel="noreferrer" className="otm-btn otm-btn--ghost otm-btn--xs">{Icon.discord} Abrir</a>
                      ) : (
                        <span className="otm-muted" style={{ fontSize: 11.5 }}>—</span>
                      )}
                    </div>
                  )
                })}
                {roleIds.map(({ key, label }) => (
                  <div key={key} className="otm-dc-row">
                    <span className="otm-dc-row__label">{label}</span>
                    <CiStatusPill status={provision[key] ? 'ready' : 'pending'} />
                    <span className="otm-muted" style={{ fontSize: 11.5 }}>{provision[key] || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'tickets' && <DiscordTickets t={t} />}

          {section === 'mensajes' && (
            <div className="otm-section">
              <h3>Mensajes y acciones automaticas</h3>
              <p className="otm-muted" style={{ fontSize: 12.5 }}>
                Registro de lo que el bot mando o intento mandar solo (bienvenidas de
                equipo, anuncios, aprovisionamiento) — para confirmar que un mensaje
                realmente salio sin tener que ir a buscarlo a mano en Discord.
              </p>

              {loadingLog ? (
                <p className="otm-muted" style={{ fontSize: 12.5 }}>Cargando registro...</p>
              ) : logUnavailable ? (
                <div className="otm-empty">
                  {Icon.messageSquare}
                  <p>
                    Esta funcion todavia no esta disponible en el servidor — falta que
                    backend agregue el endpoint del registro. Mientras tanto, para
                    confirmar que un mensaje salio de verdad, entra al canal correspondiente
                    con los enlaces de <b>Resumen</b> o <b>Torneo</b>.
                  </p>
                </div>
              ) : logError ? (
                <div className="otm-empty">
                  {Icon.alert}
                  <p>{logError}</p>
                  <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" onClick={loadLog}>{Icon.refresh} Reintentar</button>
                </div>
              ) : !log || log.length === 0 ? (
                <div className="otm-empty">{Icon.messageSquare}<p>Sin actividad registrada todavia.</p></div>
              ) : (
                <div className="otm-dc-log">
                  {log.map((entry) => (
                    <div key={entry.id || entry._id} className={`otm-dc-log__row otm-dc-log__row--${entry.status || 'info'}`}>
                      <span className="otm-dc-log__time">{fmtDT(entry.createdAt) || '—'}</span>
                      <span className="otm-dc-log__action">{entry.action}</span>
                      <span className="otm-dc-log__msg">{entry.message}{entry.teamName ? ` (${entry.teamName})` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════ BRACKET (por formato) ═══════════════ */
const BRACKET_FORMATS = [
  { key: 'single', label: 'Eliminacion simple', desc: 'Quien pierde un encuentro queda eliminado. Rapido y comun en torneos abiertos.' },
  { key: 'double', label: 'Doble eliminacion', desc: 'Segunda oportunidad: al perder pasas al cuadro de perdedores (Loser\'s Bracket).' },
  { key: 'roundrobin', label: 'Round Robin', desc: 'Todos contra todos al menos una vez. Tipico de fases de grupos por puntos.' },
  { key: 'swiss', label: 'Sistema suizo', desc: 'Te enfrentas a rivales con tu mismo record. Nadie es eliminado hasta X derrotas.' },
  { key: 'groups', label: 'Grupos + Eliminatoria', desc: 'Grupos todos contra todos y los mejores avanzan a un cuadro final.' },
]

// Id del torneo cuando sus partidas tienen ficha de estadisticas por capturas
// (Mobile Legends); null en otros juegos. Lo pone TabBracket para que cada
// MatchCard2 muestre el acceso directo sin pasar la prop por todos los formatos.
const MatchStatsLinkContext = createContext(null)

// Partida editable: muestra marcador, ganador, serie (BO) y boton de reporte.
function MatchCard2({ m, result, status, onReport, onConfirm, final, series }) {
  const statsTournamentId = useContext(MatchStatsLinkContext)
  const bye = m.a === 'BYE' || m.b === 'BYE'
  const known = m.a && m.a !== 'Por definir' && m.b && m.b !== 'Por definir' && !bye
  const r = result
  // Un resultado de verdad tiene ganador (o al menos ambos marcadores) --
  // si solo se guardo un horario (scheduledAt) sin marcador, no cuenta como
  // "reportado" todavia, para no mostrar "Pendiente"/"Confirmar" sin que
  // nadie haya cargado un marcador real.
  const hasResult = Boolean(r && (r.winner || (r.scoreA !== undefined && r.scoreB !== undefined)))
  const pending = hasResult && !r.confirmed
  const wa = r?.winner && r.winner === m.a
  const wb = r?.winner && r.winner === m.b
  return (
    <div className={`otm-bk-match ${final ? 'otm-bk-match--final' : ''} ${hasResult ? (pending ? 'is-pending' : 'is-done') : ''} ${bye ? 'is-bye' : ''}`}>
      {final && <span className="otm-bk-match__crown">{Icon.crown}</span>}
      {series && !bye && <span className="otm-bk-match__bo">{series}</span>}
      {pending && <span className="otm-bk-match__pend">Pendiente</span>}
      {r?.scheduledAt && !hasResult && (
        <span className="otm-bk-match__sched">{Icon.clock} {new Date(r.scheduledAt).toLocaleString()}</span>
      )}
      <div className={`otm-bk-match__row ${!known && !bye ? 'tbd' : ''} ${wa ? 'win' : ''}`}><span>{m.a || 'Por definir'}</span><i>{hasResult ? r.scoreA : bye && m.a !== 'BYE' ? 'W' : '-'}</i></div>
      <div className="otm-bk-match__sep" />
      <div className={`otm-bk-match__row ${!known && !bye ? 'tbd' : ''} ${wb ? 'win' : ''}`}><span>{m.b || 'Por definir'}</span><i>{hasResult ? r.scoreB : bye && m.b !== 'BYE' ? 'W' : '-'}</i></div>
      {bye && <span className="otm-bk-match__byetag">Pase directo</span>}
      {status === 'running' && known && !hasResult && (
        <button className="otm-bk-report" onClick={() => onReport(m, series)}>{Icon.edit} {r?.scheduledAt ? 'Reportar' : 'Reportar / programar'}</button>
      )}
      {pending && (
        <button className="otm-bk-report otm-bk-report--confirm" onClick={() => onConfirm(m.id)}>{Icon.check} Confirmar publicacion</button>
      )}
      {hasResult && !pending && <button className="otm-bk-report otm-bk-report--done" onClick={() => onReport(m, series)}>{Icon.check} Publicado - ver/editar</button>}
      {statsTournamentId && known && (
        <Link className="otm-bk-report otm-bk-report--stats" to={`/torneos/${encodeURIComponent(statsTournamentId)}/partidas/${encodeURIComponent(m.id)}/estadisticas`}>{Icon.chartBar} Estadísticas por capturas</Link>
      )}
    </div>
  )
}

function SingleElim({ teams, results, status, onReport, onConfirm, prefix, competition }) {
  const { rounds, champion } = buildSingleBracket(teams, results, prefix)
  return (
    <div className="otm-bk-cols">
      {rounds.map((c, ci) => (
        <div className="otm-bk-col" key={ci}>
          <div className="otm-bk-col__title">{c.name}{competition ? <em> · {seriesForRound(competition, c.name)}</em> : null}</div>
          <div className="otm-bk-col__matches">
            {c.matches.map((m) => (
              <MatchCard2 key={m.id} m={m} result={results[m.id]} status={status} onReport={onReport} onConfirm={onConfirm} final={c.name === 'Final'} series={competition ? seriesForRound(competition, c.name) : null} />
            ))}
          </div>
        </div>
      ))}
      <div className="otm-bk-col">
        <div className="otm-bk-col__title">Campeon</div>
        <div className="otm-bk-col__matches">
          <div className={`otm-bk-champ ${champion ? 'is-set' : ''}`}>{Icon.trophy}<span>{champion || 'Por definir'}</span></div>
        </div>
      </div>
    </div>
  )
}

// Tabla de posiciones real. `rows` = salida de computeStandings.
function StandingsTable({ rows, allowDraw }) {
  return (
    <table className="otm-bk-table">
      <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th>{allowDraw && <th>E</th>}<th>P</th><th>Dif</th><th>Pts</th></tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.name} className={i === 0 ? 'is-lead' : ''}>
            <td>{i + 1}</td><td>{row.name}</td><td>{row.pj}</td><td>{row.g}</td>
            {allowDraw && <td>{row.e}</td>}
            <td>{row.p}</td><td>{row.gf - row.gc > 0 ? `+${row.gf - row.gc}` : row.gf - row.gc}</td><td><b>{row.pts}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const LIFE_STEPS = [
  { ic: 'send', t: '1. Publicar bracket', d: 'Genera y publica la llave. Los equipos reciben una notificacion y pueden ver sus partidas.' },
  { ic: 'discord', t: '2. Check-in en Discord', d: 'Presencia (confirmar que juegan) + check-in previo ~30 min antes. Todo por el bot oficial.' },
  { ic: 'play', t: '3. Iniciar torneo', d: 'Pulsa "Iniciar torneo": comienzan las partidas y se habilita el reporte de resultados.' },
  { ic: 'edit', t: '4. Reportar con justificacion', d: 'En cada partida ingresa el marcador y sube la captura de AMBOS equipos. Se envia un anuncio de justificacion como evidencia antitrampa.' },
  { ic: 'trend', t: '5. Avanzar rondas', d: 'El ganador avanza automaticamente a la siguiente ronda del bracket.' },
  { ic: 'trophy', t: '6. Culminar torneo', d: 'Cuando hay campeon, pulsa "Culminar torneo": se cierra y se anuncia al ganador.' },
]

function TabBracket({ t }) {
  const { pushNotification } = useNotifications()
  const stored = getBracket(t.id)
  const comp = t.competition || null
  const wizardFormat = formatFromCompetition(comp)
  const [format, setFormat] = useState(stored?.format || wizardFormat || normalizeFormat(t.format))
  const meta = BRACKET_FORMATS.find(f => f.key === format)
  const compFmtForView = ['single', 'double', 'groups', 'swiss'].includes(format) ? comp : null

  // Equipos reales desde inscripciones (con seedOrder guardado si existe).
  const [regs, setRegs] = useState(null)
  const [loadingTeams, setLoadingTeams] = useState(true)
  useEffect(() => {
    let alive = true
    setLoadingTeams(true)
    registrationsApi.list(t.id)
      .then(d => { if (alive) setRegs(Array.isArray(d.registrations) ? d.registrations : []) })
      .catch(() => { if (alive) setRegs([]) })
      .finally(() => { if (alive) setLoadingTeams(false) })
    return () => { alive = false }
  }, [t.id])

  const baseTeams = useMemo(() => resolveBracketTeams(regs || [], stored?.seedOrder), [regs, stored?.seedOrder])
  const elimTeams = useMemo(() => padToPow2(baseTeams), [baseTeams])
  const enoughTeams = baseTeams.length >= 2

  const [status, setStatus] = useState(stored?.status || (t.status === 'finished' ? 'finished' : t.status === 'live' ? 'running' : 'idle'))
  const [published, setPublished] = useState(stored?.published ?? (t.status === 'live' || t.status === 'finished'))
  const [results, setResults] = useState(stored?.results || {})   // id -> { a,b,scoreA,scoreB,winner,series,message,imgA,imgB,confirmed,time }
  const [justify, setJustify] = useState(null)

  // Lo guardado en el servidor manda. El cache de bracketStore empieza vacio
  // al recargar la pagina: antes esta pantalla arrancaba con ese vacio y lo
  // guardaba de inmediato, borrando los resultados ya reportados. Hasta que
  // llega el bracket real no se escribe nada.
  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const lastSaved = useRef('')
  useEffect(() => {
    let alive = true
    setLoadState('loading')
    pullBracket(t.id).then(ok => {
      if (!alive) return
      const saved = getBracket(t.id)
      if (saved) {
        if (saved.format) setFormat(saved.format)
        if (saved.status) setStatus(saved.status)
        if (saved.published !== undefined) setPublished(Boolean(saved.published))
        setResults(saved.results || {})
      }
      setLoadState(ok ? 'ready' : 'error')
    })
    return () => { alive = false }
  }, [t.id])


  const art = getGameArt(t.game)
  const notify = (title, desc, extra = {}) => pushNotification({
    type: 'torneo', category: 'torneos', tone: 'info',
    title, desc, from: `${t.title} - Organizacion`,
    entity: { kind: 'tournament', name: t.title, game: t.game, color: t.primaryColor, image: art?.image },
    action: { label: 'Ver torneo', link: `/torneos/${t.id}` },
    ...extra,
  })

  const publish = () => { setPublished(true); notify('Bracket publicado', `Ya puedes ver el bracket de ${t.title}.`, { tone: 'success' }) }
  const start = () => { setStatus('running'); notify('Torneo iniciado', `${t.title} ha comenzado. Atentos al check-in y a sus partidas.`, { tone: 'success' }) }
  const finish = () => { setStatus('finished'); notify('Torneo finalizado', `${t.title} ha culminado. Gracias por participar`, { tone: 'celebrate' }) }

  const openReport = (m, series) => {
    const r = results[m.id]
    setJustify({ id: m.id, a: m.a, b: m.b, series: series || r?.series || (comp?.defaultSeries) || 'BO1', scoreA: r?.scoreA ?? '', scoreB: r?.scoreB ?? '', message: r?.message ?? null, imgA: r?.imgA ?? null, imgB: r?.imgB ?? null, scheduledAt: r?.scheduledAt ?? '' })
  }

  const confirmResult = (id) => {
    const r = results[id]
    setResults(prev => ({ ...prev, [id]: { ...prev[id], confirmed: true } }))
    if (r && !r.confirmed) notify('Resultado confirmado y publicado', `${r.a} ${r.scoreA} - ${r.scoreB} ${r.b} - Ganador: ${r.winner}`, { tone: 'success', fullMessage: r.message })
  }

  // Reportes de los capitanes (colección aparte, ver matchReports.controller.js).
  // Se refrescan solos mientras el torneo está en curso; nunca tocan `results`
  // hasta que la organización acepta uno.
  const [teamReports, setTeamReports] = useState([])
  const [discordReports, setDiscordReports] = useState([])
  const [reportsError, setReportsError] = useState(false)
  const loadTeamReports = useCallback(() => {
    tournamentsApi.listMatchReports(t.id)
      .then(d => {
        setTeamReports(Array.isArray(d?.reports) ? d.reports : [])
        setDiscordReports(Array.isArray(d?.discord) ? d.discord : [])
        setReportsError(false)
      })
      .catch(() => setReportsError(true))
  }, [t.id])
  useEffect(() => {
    loadTeamReports()
    if (status !== 'running') return undefined
    const timer = setInterval(loadTeamReports, 30000)
    return () => clearInterval(timer)
  }, [loadTeamReports, status])
  const openTeamReports = teamReports.filter(rep => !rep.confirmed && !results[rep.matchId]?.confirmed)
  const openDiscordReports = discordReports.filter(rep => !rep.confirmed && !results[rep.matchId]?.confirmed)

  const acceptTeamReport = (rep) => {
    const { scoreA, scoreB } = rep.A
    const winner = scoreA > scoreB ? rep.a : rep.b
    const message = `Resultado reportado por ambos capitanes - ${rep.a} ${scoreA} : ${scoreB} ${rep.b}. Ganador: ${winner}.`
    setResults(prev => ({
      ...prev,
      [rep.matchId]: {
        ...prev[rep.matchId], a: rep.a, b: rep.b, scoreA, scoreB, winner, message,
        imgA: rep.A.evidenceUrl, imgB: rep.B.evidenceUrl, confirmed: true, time: new Date().toLocaleString(),
      },
    }))
    notify('Resultado publicado', `${rep.a} ${scoreA} - ${scoreB} ${rep.b} - Ganador: ${winner}`, { tone: 'success', fullMessage: message })
  }

  const reviewTeamReport = (rep) => {
    const base = rep.A || rep.B
    const r = results[rep.matchId]
    setJustify({
      id: rep.matchId, a: rep.a, b: rep.b, series: r?.series || comp?.defaultSeries || 'BO1',
      scoreA: base.scoreA, scoreB: base.scoreB, message: null,
      imgA: rep.A?.evidenceUrl || r?.imgA || null, imgB: rep.B?.evidenceUrl || r?.imgB || null,
      scheduledAt: r?.scheduledAt ?? '',
    })
  }

  // /report de Discord: abre el mismo modal con las capturas de cada lado y
  // el marcador que se deduce de lo que declaró cada equipo por partida.
  const reviewDiscordReport = (rep) => {
    const r = results[rep.matchId]
    const other = side => (side === 'A' ? 'B' : 'A')
    const wins = side => new Set([
      ...rep[side].filter(x => x.result === 'win'),
      ...rep[other(side)].filter(x => x.result === 'lose'),
    ].map(x => x.gameNumber || 1)).size
    const shot = side => rep[side][rep[side].length - 1]?.evidence?.[0]?.url || null
    setJustify({
      id: rep.matchId, a: rep.a, b: rep.b, series: r?.series || comp?.defaultSeries || 'BO1',
      scoreA: wins('A'), scoreB: wins('B'), message: null,
      imgA: shot('A') || r?.imgA || null, imgB: shot('B') || r?.imgB || null,
      scheduledAt: r?.scheduledAt ?? '',
    })
  }

  // Datos por formato (con equipos reales).
  const rrMatches = useMemo(() => format === 'roundrobin' ? roundRobinMatches(baseTeams) : [], [format, baseTeams])
  const rrStandings = useMemo(() => computeStandings(baseTeams, results, rrMatches.map(m => m.id), comp?.scoring || {}), [baseTeams, results, rrMatches, comp])
  const swiss = useMemo(() => format === 'swiss' ? swissPairings(baseTeams, results, comp?.swissRounds || Math.max(3, Math.ceil(Math.log2(Math.max(2, baseTeams.length))) + 1)) : null, [format, baseTeams, results, comp])
  const grp = useMemo(() => format === 'groups' ? groupStage(baseTeams, comp?.groups || Math.max(1, Math.round(baseTeams.length / 4))) : [], [format, baseTeams, comp])
  const advancePerGroup = Math.max(1, comp?.advancePerGroup || 2)
  const grpQualifiers = useMemo(() => {
    if (format !== 'groups' || !grp.length) return []
    const perGroupStandings = grp.map(g => computeStandings(g.teams, results, g.matches.map(m => m.id), comp?.scoring || {}))
    const out = []
    for (let pos = 0; pos < advancePerGroup; pos++)
      perGroupStandings.forEach((s, gi) => { if (s[pos]) out.push(s[pos].name) })
    return out
  }, [format, grp, results, comp, advancePerGroup])
  const grpPlayoffTeams = useMemo(() => padToPow2(grpQualifiers), [grpQualifiers])

  // Campeon segun el formato. Se manda al culminar: sin el, el servidor no
  // fija `winner`, no dispara el aviso de podio ni el anuncio de Discord, y
  // el equipo nunca aparece como campeon (el camino /report de Discord si lo
  // calculaba; el de la web no).
  const swissRoundCount = comp?.swissRounds || Math.max(3, Math.ceil(Math.log2(Math.max(2, baseTeams.length))) + 1)
  const champion = useMemo(() => {
    if (format === 'single') return buildSingleBracket(elimTeams, results, 'se').champion || ''
    if (format === 'double') return buildDoubleBracket(elimTeams, results).champion || ''
    if (format === 'groups') return grpPlayoffTeams.length >= 2 ? (buildSingleBracket(grpPlayoffTeams, results, 'gpo').champion || '') : ''
    if (format === 'roundrobin') {
      const done = rrMatches.length > 0 && rrMatches.every(m => results[m.id]?.confirmed)
      return done ? (rrStandings[0]?.name || '') : ''
    }
    if (format === 'swiss' && swiss) {
      const done = swiss.rounds.length >= swissRoundCount &&
        swiss.rounds.every(rd => rd.matches.every(m => m.b === 'BYE' || results[m.id]?.confirmed))
      return done ? (swiss.standings[0]?.name || '') : ''
    }
    return ''
  }, [format, elimTeams, results, grpPlayoffTeams, rrMatches, rrStandings, swiss, swissRoundCount])

  // Persiste en el store compartido -> la vista publica lo ve en vivo.
  useEffect(() => {
    if (loadState !== 'ready') return
    const patch = { published, status, format, results }
    if (baseTeams.length) patch.teams = baseTeams   // no pisar con [] mientras cargan las inscripciones
    if (status === 'finished' && champion) patch.champion = champion
    const key = JSON.stringify(patch)
    if (key === lastSaved.current) return
    lastSaved.current = key
    saveBracket(t.id, patch)
  }, [loadState, t.id, published, status, format, results, baseTeams, champion])

  const banner = status === 'finished'
    ? { cls: 'done', txt: 'Torneo finalizado. El bracket queda como registro con su evidencia.' }
    : status === 'running'
      ? { cls: 'run', txt: 'Torneo en curso. Reporta cada resultado con su justificacion (marcador + capturas de ambos equipos).' }
      : published
        ? { cls: 'ready', txt: 'Bracket publicado. Inicia el torneo cuando termine el check-in.' }
        : { cls: 'idle', txt: 'Publica el bracket para que los equipos vean sus partidas y reciban la notificacion.' }

  return (
    <MatchStatsLinkContext.Provider value={isMobileLegends(t.game) ? t.id : null}>
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div><h2>Bracket</h2><p className="otm-muted">Publica la llave, inicia el torneo y reporta resultados con justificacion.</p></div>
      </div>

      {/* Ciclo de vida */}
      <div className="otm-life">
        <span className={`otm-life__status otm-life__status--${status}`}>
          {status === 'running' ? 'o En curso' : status === 'finished' ? 'Finalizado' : published ? 'Publicado' : 'Borrador'}
        </span>
        <div className="otm-life__btns">
          <button className="otm-lifebtn" onClick={publish} disabled={published || !enoughTeams}>{Icon.send} {published ? 'Bracket publicado' : 'Publicar bracket'}</button>
          <button className="otm-lifebtn otm-lifebtn--go" onClick={start} disabled={!published || status !== 'idle'}>{Icon.play} Iniciar torneo</button>
          <button className="otm-lifebtn otm-lifebtn--end" onClick={finish} disabled={status !== 'running'}>{Icon.trophy} Culminar torneo</button>
        </div>
      </div>

      <div className={`otm-bk-banner otm-bk-banner--${banner.cls}`}>{Icon.alert} <span>{banner.txt}</span></div>
      {isMobileLegends(t.game) && (
        <div className="otm-bk-note">{Icon.chartBar} <span><b>Estadísticas por capturas:</b> cada partida tiene el botón <b>Estadísticas por capturas</b>. Ahí se suben las capturas, la IA las lee y el rival u organizador confirma. Para guardar hace falta que los equipos hayan hecho el check-in (ahí se congela el roster).</span></div>
      )}
      {status === 'finished' && !champion && (
        <div className="otm-bk-note otm-bk-note--warn" role="alert">{Icon.alert} <span>El torneo está culminado pero todavía no hay campeón: confirma el resultado de la final para que se registre el ganador y se avise al podio.</span></div>
      )}
      {loadState === 'loading' && (
        <div className="otm-bk-note">{Icon.clock} <span>Cargando el bracket guardado…</span></div>
      )}
      {loadState === 'error' && (
        <div className="otm-bk-note otm-bk-note--warn" role="alert">{Icon.alert} <span>No se pudo cargar el bracket guardado. Para no borrar nada, lo que hagas en esta pantalla no se guarda hasta que recargues la página.</span></div>
      )}

      {/* Como se lleva a cabo */}
      <details className="otm-guide" open={status === 'idle'}>
        <summary>{Icon.lightbulb} Como se lleva a cabo el torneo</summary>
        <div className="otm-guide__steps">
          {LIFE_STEPS.map((s, i) => (
            <div className="otm-guide__step" key={i}>
              <span className="otm-guide__ic">{Icon[s.ic]}</span>
              <div><b>{s.t}</b><span>{s.d}</span></div>
            </div>
          ))}
        </div>
      </details>

      {/* Equipos reales */}
      <div className="otm-bk-teams">
        <div className="otm-bk-teams__hd">
          <b>{Icon.users} Equipos ({baseTeams.length})</b>
          <span className="otm-muted">
            {loadingTeams ? 'Cargando inscripciones...'
              : baseTeams.length === 0 ? 'Sin equipos confirmados todavia'
              : (regs || []).some(r => r.status === 'checked_in') ? 'Con check-in confirmado' : 'Inscritos (aun sin check-in)'}
          </span>
        </div>
        {baseTeams.length > 0 && (
          <ol className="otm-bk-teams__list">
            {baseTeams.map((n, i) => <li key={n}><span>{i + 1}</span>{n}</li>)}
          </ol>
        )}
      </div>

      {/* Selector de formato */}
      <div className="otm-bk-formats">
        {BRACKET_FORMATS.map(f => (
          <button key={f.key} className={`otm-bk-fmt ${format === f.key ? 'active' : ''} ${wizardFormat === f.key ? 'is-wizard' : ''}`} onClick={() => setFormat(f.key)}>
            <b>{f.label}{wizardFormat === f.key ? <em> · del asistente</em> : null}</b><span>{f.desc}</span>
          </button>
        ))}
      </div>

      {wizardFormat && format !== wizardFormat && (
        <div className="otm-bk-note otm-bk-note--warn">{Icon.alert} <span>Estas usando un formato distinto al que definiste en <b>Competencia</b>. El bracket no coincidira con lo publicado en el reglamento. Si el cambio es definitivo, hazlo en la pestaña <b>Competencia</b> para que se avise a los equipos.</span></div>
      )}
      <div className="otm-bk-note">{Icon.alert} <span><b>{meta?.label}:</b> {meta?.desc}{comp ? ` · Serie por defecto ${comp.defaultSeries}` : ''} · {baseTeams.length} equipos{elimTeams.length !== baseTeams.length && ['single', 'double'].includes(format) ? ` (+${elimTeams.length - baseTeams.length} BYE)` : ''}.</span></div>

      {!enoughTeams ? (
        <div className="otm-empty">{Icon.users}<p>El bracket se arma con los equipos que pasen el check-in. Cuando haya al menos 2, aparece la llave aqui.</p></div>
      ) : (
      <>
      {/* Vista por formato */}
      {format === 'single' && (
        <div className="otm-bk-scroll"><SingleElim teams={elimTeams} results={results} status={status} onReport={openReport} onConfirm={confirmResult} prefix="se" competition={compFmtForView} /></div>
      )}

      {format === 'double' && (() => {
        const { lbRounds, grandFinal } = buildDoubleBracket(elimTeams, results)
        return (
        <div className="otm-bk-double">
          <div className="otm-bk-side">
            <div className="otm-bk-side__label otm-bk-side__label--w">{Icon.trophy} Winner's Bracket</div>
            <div className="otm-bk-scroll"><SingleElim teams={elimTeams} results={results} status={status} onReport={openReport} onConfirm={confirmResult} prefix="wb" competition={compFmtForView} /></div>
          </div>
          <div className="otm-bk-side otm-bk-side--l">
            <div className="otm-bk-side__label otm-bk-side__label--l">{Icon.trend} Loser's Bracket (segunda oportunidad)</div>
            <div className="otm-bk-scroll">
              <div className="otm-bk-cols">
                {lbRounds.map((rd, ci) => (
                  <div className="otm-bk-col" key={ci}>
                    <div className="otm-bk-col__title">{rd.name}</div>
                    <div className="otm-bk-col__matches">
                      {rd.matches.map((m) => (
                        <MatchCard2 key={m.id} m={m} result={results[m.id]} status={status} onReport={openReport} onConfirm={confirmResult} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="otm-bk-grandfinal">
            <div className="otm-bk-col__title">Gran Final{comp ? <em> · {seriesForRound(comp, 'gran final')}</em> : null}</div>
            <MatchCard2 m={grandFinal} result={results[grandFinal.id]} status={status} onReport={openReport} onConfirm={confirmResult} final series={comp ? seriesForRound(comp, 'gran final') : null} />
          </div>
        </div>
        )
      })()}

      {format === 'roundrobin' && (
        <div className="otm-bk-rr">
          <div className="otm-section">
            <h3>Tabla de posiciones</h3>
            <StandingsTable rows={rrStandings} allowDraw={comp?.scoring?.allowDraw !== false} />
          </div>
          <div className="otm-section">
            <h3>Calendario - todos contra todos ({rrMatches.length} partidos)</h3>
            <div className="otm-bk-fixtures">
              {rrMatches.map((m) => <MatchCard2 key={m.id} m={m} result={results[m.id]} status={status} onReport={openReport} onConfirm={confirmResult} series={comp?.defaultSeries || null} />)}
            </div>
          </div>
        </div>
      )}

      {format === 'swiss' && swiss && (
        <div className="otm-bk-rr">
          <div className="otm-section">
            <h3>Clasificacion suiza</h3>
            <table className="otm-bk-table">
              <thead><tr><th>#</th><th>Equipo</th><th>V</th><th>D</th></tr></thead>
              <tbody>{swiss.standings.map((s, i) => <tr key={s.name} className={i === 0 ? 'is-lead' : ''}><td>{i + 1}</td><td>{s.name}</td><td>{s.w}</td><td>{s.l}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="otm-section">
            <div className="otm-bk-scroll">
              <div className="otm-bk-cols">
                {swiss.rounds.map((rd, ri) => (
                  <div className="otm-bk-col" key={ri}>
                    <div className="otm-bk-col__title">{rd.name}</div>
                    <div className="otm-bk-col__matches">
                      {rd.matches.map((m) => <MatchCard2 key={m.id} m={m} result={results[m.id]} status={status} onReport={openReport} onConfirm={confirmResult} series={comp?.defaultSeries || null} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="otm-muted" style={{ marginTop: 12 }}>Los emparejamientos se recalculan por record (victorias) a medida que confirmas resultados. Nadie es eliminado hasta el final.</p>
          </div>
        </div>
      )}

      {format === 'groups' && (
        <div className="otm-bk-groups-wrap">
          <div className="otm-bk-groups">
            {grp.map((g, gi) => (
              <div className="otm-section" key={gi}>
                <h3>{g.name}</h3>
                <StandingsTable rows={computeStandings(g.teams, results, g.matches.map(m => m.id), comp?.scoring || {})} allowDraw={comp?.scoring?.allowDraw !== false} />
                <div className="otm-bk-fixtures" style={{ marginTop: 10 }}>
                  {g.matches.map((m) => <MatchCard2 key={m.id} m={m} result={results[m.id]} status={status} onReport={openReport} onConfirm={confirmResult} series={comp?.defaultSeries || null} />)}
                </div>
              </div>
            ))}
          </div>
          <div className="otm-section">
            <h3>Playoffs — clasifican {advancePerGroup} por grupo</h3>
            {grpQualifiers.length < 2 ? (
              <p className="otm-muted">Los clasificados salen de la tabla de cada grupo. Reporta los partidos de grupos para llenar la llave.</p>
            ) : (
              <div className="otm-bk-scroll">
                <SingleElim teams={grpPlayoffTeams} results={results} status={status} onReport={openReport} onConfirm={confirmResult} prefix="gpo" competition={comp} />
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {/* Reportes de los capitanes */}
      <div className="otm-section" style={{ marginTop: 18 }}>
        <div className="otm-tr__hd">
          <h3>{Icon.users} Reportes de los capitanes ({openTeamReports.length + openDiscordReports.length})</h3>
          <button type="button" className="otm-btn otm-btn--ghost otm-btn--xs" onClick={loadTeamReports}>{Icon.refresh} Actualizar</button>
        </div>
        {reportsError && <p className="otm-jm__err">{Icon.alert} No se pudieron cargar los reportes de los capitanes.</p>}
        {openTeamReports.length === 0 && openDiscordReports.length === 0 ? (
          <p className="otm-muted">Cuando el torneo está en curso, el capitán de cada equipo reporta su marcador con una captura desde su panel o con /report en Discord. Si los dos coinciden, aquí lo publicas con un clic; si no, ves ambas versiones para decidir.</p>
        ) : openTeamReports.length === 0 ? (
          null
        ) : (
          <div className="otm-ev-list">
            {openTeamReports.map(rep => (
              <div className={`otm-ev otm-tr otm-tr--${rep.status}`} key={rep.matchId}>
                <div className="otm-ev__head">
                  <b>{rep.a} vs {rep.b}</b>
                  <span className={`otm-ev__state ${rep.status === 'agreed' ? 'ok' : 'pend'}`}>
                    {rep.status === 'agreed' ? <>{Icon.check} Coinciden</> : rep.status === 'disputed' ? <>{Icon.alert} En disputa</> : <>{Icon.clock} Falta un capitán</>}
                  </span>
                </div>
                <div className="otm-tr__sides">
                  {[['A', rep.a], ['B', rep.b]].map(([side, name]) => {
                    const r = rep[side]
                    return (
                      <div className="otm-tr__side" key={side}>
                        <span>Reporte de {name}{r?.reportedNick ? ` · ${r.reportedNick}` : ''}</span>
                        <b>{r ? `${rep.a} ${r.scoreA} - ${r.scoreB} ${rep.b}` : 'Sin reportar'}</b>
                        {r?.evidenceUrl ? <a href={r.evidenceUrl} target="_blank" rel="noreferrer"><img src={r.evidenceUrl} alt={`Captura de ${name}`} /></a> : <div className="otm-ev__noimg">Sin captura</div>}
                        {r?.note && <p className="otm-tr__note">“{r.note}”</p>}
                      </div>
                    )
                  })}
                </div>
                <div className="otm-ev__foot">
                  <button className="otm-btn otm-btn--ghost otm-btn--xs" onClick={() => reviewTeamReport(rep)}>{Icon.edit} Revisar / corregir</button>
                  {rep.status === 'agreed' && (
                    <button className="otm-btn otm-btn--primary otm-btn--xs" onClick={() => acceptTeamReport(rep)}>{Icon.send} Aceptar y publicar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {openDiscordReports.length > 0 && (
          <div className="otm-ev-list" style={{ marginTop: openTeamReports.length ? 12 : 0 }}>
            {openDiscordReports.map(rep => {
              const state = discordReportState(rep.A, rep.B)
              return (
                <div className={`otm-ev otm-tr otm-tr--${state}`} key={`dc-${rep.matchId}`}>
                  <div className="otm-ev__head">
                    <b>{Icon.discord} {rep.a} vs {rep.b}</b>
                    <span className={`otm-ev__state ${state === 'agreed' ? 'ok' : 'pend'}`}>
                      {state === 'agreed' ? <>{Icon.check} Declaran lo mismo</> : state === 'disputed' ? <>{Icon.alert} Declaran distinto</> : <>{Icon.clock} Falta un equipo</>}
                    </span>
                  </div>
                  <DiscordReports a={rep.a} b={rep.b} A={rep.A} B={rep.B} cases={rep.cases} />
                  <div className="otm-ev__foot">
                    <button className="otm-btn otm-btn--ghost otm-btn--xs" onClick={() => reviewDiscordReport(rep)}>{Icon.edit} Revisar y publicar</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Evidencia / justificaciones reportadas */}
      <div className="otm-section" style={{ marginTop: 18 }}>
        <h3>{Icon.shield} Justificaciones y evidencia ({Object.keys(results).length})</h3>
        {Object.keys(results).length === 0 ? (
          <p className="otm-muted">Aun no hay resultados reportados. Al reportar una partida se guarda aqui el marcador, el mensaje y las capturas de ambos equipos para auditar en cualquier momento.</p>
        ) : (
          <div className="otm-ev-list">
            {Object.entries(results).map(([id, r]) => (
              <div className={`otm-ev ${r.confirmed ? '' : 'otm-ev--pending'}`} key={id}>
                <div className="otm-ev__head">
                  <b>{r.a} <span className="otm-ev__score">{r.scoreA} - {r.scoreB}</span> {r.b}</b>
                  <span className="otm-ev__win">{Icon.trophy} {r.winner}</span>
                  <span className={`otm-ev__state ${r.confirmed ? 'ok' : 'pend'}`}>
                    {r.confirmed ? <>{Icon.check} Publicado</> : <>{Icon.clock} Pendiente</>}
                  </span>
                </div>
                <p className="otm-ev__msg">{r.message}</p>
                <div className="otm-ev__imgs">
                  {r.imgA ? <img src={r.imgA} alt={`Evidencia ${r.a}`} /> : <div className="otm-ev__noimg">Sin captura {r.a}</div>}
                  {r.imgB ? <img src={r.imgB} alt={`Evidencia ${r.b}`} /> : <div className="otm-ev__noimg">Sin captura {r.b}</div>}
                </div>
                <div className="otm-ev__foot">
                  <span className="otm-ev__time">{r.time}</span>
                  {!r.confirmed && <button className="otm-btn otm-btn--primary otm-btn--xs" onClick={() => confirmResult(id)}>{Icon.send} Confirmar y publicar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de justificacion */}
      {justify && (
        <JustifyModal
          tournament={t}
          data={justify}
          onChange={setJustify}
          onClose={() => setJustify(null)}
          onSave={(payload, direct) => {
            setResults(prev => ({ ...prev, [justify.id]: { ...payload, confirmed: direct } }))
            if (direct) {
              notify('Resultado publicado', `${payload.a} ${payload.scoreA} - ${payload.scoreB} ${payload.b} - Ganador: ${payload.winner}`, { tone: 'success', fullMessage: payload.message })
            } else {
              notify('Resultado en revision', `Pendiente de confirmar: ${payload.a} ${payload.scoreA} - ${payload.scoreB} ${payload.b}`, { tone: 'info', fullMessage: payload.message })
            }
            setJustify(null)
          }}
          onSchedule={(scheduledAt) => {
            setResults(prev => ({ ...prev, [justify.id]: { ...(prev[justify.id] || { a: justify.a, b: justify.b, series: justify.series }), scheduledAt } }))
            notify('Horario actualizado', `${justify.a} vs ${justify.b} - ${new Date(scheduledAt).toLocaleString()}`, { tone: 'info' })
            setJustify(null)
          }}
        />
      )}
    </div>
    </MatchStatsLinkContext.Provider>
  )
}

/* ═══════════════ RESULTADOS POR REVISAR ═══════════════ */
// Casos de este torneo (lectura automática de /report). Lo ve el staff con la
// pestaña "resultados"; arbitra quien la tiene en edición.
function TabResultados({ t }) {
  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div><h2>Resultados por revisar</h2><p className="otm-muted">Partidas que la lectura automática no pudo validar sola: faltan datos (⚪) o algo se contradice (🟠). Las que coinciden avanzan el bracket solas.</p></div>
      </div>
      <ResultsReview tournamentId={t.id} />
    </div>
  )
}

/* ═══════════════ MODAL DE JUSTIFICACION ═══════════════ */
function JustifyModal({ data, onChange, onClose, onSave, onSchedule, tournament }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const series = data.series || 'BO1'
  const { win: target, max: maxGames } = seriesTarget(series)
  const sA = Number(data.scoreA), sB = Number(data.scoreB)
  const hasScores = data.scoreA !== '' && data.scoreB !== '' && Number.isFinite(sA) && Number.isFinite(sB)
  const tie = hasScores && sA === sB
  const hi = Math.max(sA, sB), lo = Math.min(sA, sB)
  const seriesOk = hasScores && !tie && hi === target && lo < target && (sA + sB) <= maxGames
  const winner = seriesOk ? (sA > sB ? data.a : data.b) : null
  let scoreErr = null
  if (hasScores && tie) scoreErr = 'El marcador no puede quedar empatado.'
  else if (hasScores && hi !== target) scoreErr = `Serie ${series}: el ganador debe llegar a ${target} (marcador de ${target}-0 a ${target}-${target - 1}).`
  else if (hasScores && sA + sB > maxGames) scoreErr = `Una serie ${series} son maximo ${maxGames} partidas.`
  const defaultMsg = `Resultado verificado - ${data.a} ${data.scoreA || 0} : ${data.scoreB || 0} ${data.b} (${series}).${winner ? ` Ganador: ${winner}.` : ''} Ambos equipos adjuntan captura de la partida como evidencia para auditoria antitrampa.`
  const msg = data.message ?? defaultMsg
  const payload = () => ({ a: data.a, b: data.b, scoreA: sA, scoreB: sB, winner, series, message: msg, imgA: data.imgA, imgB: data.imgB, scheduledAt: data.scheduledAt || '', time: new Date().toLocaleString() })

  const onFile = async (key, file) => {
    if (!file || uploading) return
    setUploadError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError('Usa una captura JPG, PNG o WebP de hasta 5 MB.')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadsApi.upload(file)
      if (!uploaded.url) throw new Error('No se recibió la URL de la captura.')
      if (mounted.current) onChange(current => ({ ...current, [key]: uploaded.url }))
    } catch (error) {
      if (mounted.current) setUploadError(error.message || 'No se pudo subir la captura. Vuelve a seleccionarla para reintentar.')
    } finally {
      if (mounted.current) setUploading(false)
    }
  }

  return (
    <div className="otm-jm" onClick={onClose}>
      <div className="otm-jm__card" onClick={e => e.stopPropagation()}>
        <div className="otm-jm__head">
          <div><span className="otm-jm__pre">REPORTE + JUSTIFICACION · {series}</span><h3>{data.a} vs {data.b}</h3></div>
          <button className="otm-iconbtn" onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="otm-field">
          <label>{Icon.clock} Horario del enfrentamiento (lo ven los equipos en su panel)</label>
          <div className="otm-jm__sched-row">
            <input type="datetime-local" value={data.scheduledAt || ''} onChange={e => onChange({ ...data, scheduledAt: e.target.value })} />
            <button type="button" className="otm-btn otm-btn--ghost" disabled={!data.scheduledAt} onClick={() => onSchedule(data.scheduledAt)}>
              {Icon.check} Guardar horario
            </button>
          </div>
        </div>

        <div className="otm-jm__scores">
          <div className="otm-jm__team">
            <label>{data.a}</label>
            <input type="number" min="0" max={target} value={data.scoreA} onChange={e => onChange({ ...data, scoreA: e.target.value })} />
          </div>
          <span className="otm-jm__vs">VS</span>
          <div className="otm-jm__team">
            <label>{data.b}</label>
            <input type="number" min="0" max={target} value={data.scoreB} onChange={e => onChange({ ...data, scoreB: e.target.value })} />
          </div>
        </div>
        <p className="otm-muted" style={{ textAlign: 'center', marginTop: -4 }}>Serie {series} · primero a {target} {target === 1 ? 'partida' : 'partidas'}</p>
        {scoreErr && <p className="otm-jm__err">{Icon.alert} {scoreErr}</p>}

        <div className="otm-jm__uploads">
          {['imgA', 'imgB'].map((key, i) => {
            const team = i === 0 ? data.a : data.b
            const id = `jm-${key}`
            return (
              <div className="otm-jm__upload" key={key}>
                <label>Captura de {team}</label>
                {data[key]
                  ? <div className="otm-jm__preview" style={{ backgroundImage: `url(${data[key]})` }} onClick={() => document.getElementById(id).click()} />
                  : <div className="otm-jm__drop" onClick={() => document.getElementById(id).click()}>{Icon.camera}<span>Subir captura de la partida</span></div>}
                <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} style={{ display: 'none' }} onChange={e => { onFile(key, e.target.files[0]); e.target.value = '' }} />
              </div>
            )
          })}
        </div>

        {uploading && <p role="status">Subiendo captura…</p>}
        {uploadError && <p className="otm-jm__err" role="alert">{uploadError}</p>}
        {isMobileLegends(tournament?.game) && <MatchStats tournamentId={tournament.id || tournament._id} matchId={data.id} series={series} />}
        <div className="otm-field">
          <label>Mensaje de justificacion (predeterminado, editable)</label>
          <textarea rows={3} value={msg} onChange={e => onChange({ ...data, message: e.target.value })} />
        </div>

        <p className="otm-jm__hint">{Icon.alert} <span><b>Confirmar</b> guarda el resultado como pendiente para revisarlo antes de publicarlo (evita errores). <b>Publicar directo</b> lo envia a los jugadores al instante.</span></p>

        <div className="otm-jm__actions">
          <button className="otm-btn otm-btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="otm-btn otm-btn--ghost" disabled={!winner || uploading} onClick={() => onSave(payload(), false)}>
            {Icon.check} Enviar a confirmacion
          </button>
          <button className="otm-btn otm-btn--primary" disabled={!winner || uploading} onClick={() => onSave(payload(), true)}>
            {Icon.send} Publicar directo
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ RULETA DE SORTEO ═══════════════ */
const WHEEL_COLORS = ['#ff5c00', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6', '#84cc16']

function TabRuleta({ t }) {
  const [mode, setMode] = useState('enfrentamientos') // 'premios' | 'enfrentamientos'
  const [teams, setTeams] = useState([])      // pool en la ruleta (equipos reales + extras en premios)
  const [pool, setPool] = useState([])        // restantes por sortear (enfrentamientos)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)  // resultado modo premios
  const [picks, setPicks] = useState([])      // secuencia sorteada (enfrentamientos)
  const [result, setResult] = useState(null)  // modal de resultado (visible tambien en fullscreen)
  const [fs, setFs] = useState(false)
  const [regs, setRegs] = useState(null)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [extra, setExtra] = useState('')      // nombres manuales para el modo premios
  const [history, setHistory] = useState([])  // ganadores sorteados (modo premios)
  const [applied, setApplied] = useState(false)
  const stageRef = useRef(null)

  const realTeams = useMemo(() => resolveBracketTeams(regs || [], null), [regs])
  const extraNames = useMemo(() => extra.split('\n').map(s => s.trim()).filter(Boolean), [extra])

  // Trae los equipos reales del torneo (inscripciones con check-in > inscritos).
  const fetchTeams = () => {
    setLoadingTeams(true)
    registrationsApi.list(t.id)
      .then(d => setRegs(Array.isArray(d.registrations) ? d.registrations : []))
      .catch(() => setRegs([]))
      .finally(() => setLoadingTeams(false))
  }
  useEffect(() => { fetchTeams() }, [t.id])

  // Carga / recarga la ruleta con el pool actual.
  const loadTeams = () => {
    const source = mode === 'premios' ? [...realTeams, ...extraNames] : [...realTeams]
    setTeams(source)
    setPool(source)
    setWinner(null)
    setPicks([])
    setApplied(false)
  }
  // Auto-carga cuando llegan los equipos o cambia el pool de premios.
  useEffect(() => { loadTeams() }, [realTeams, mode, extraNames.join('|')])   // eslint-disable-line react-hooks/exhaustive-deps

  const segments = mode === 'premios' ? teams : pool

  const spin = () => {
    if (spinning || segments.length === 0) return
    setSpinning(true)
    if (mode === 'premios') setWinner(null)
    const turns = 5 + Math.random() * 3
    const extra = Math.random() * 360
    const newRot = rotation + turns * 360 + extra
    setRotation(newRot)
    setTimeout(() => {
      const segCount = segments.length
      const normalized = (360 - (newRot % 360)) % 360
      const idx = Math.floor(normalized / (360 / segCount)) % segCount
      const picked = segments[idx]
      if (mode === 'premios') {
        setWinner(picked)
        setHistory(prev => [{ name: picked, at: new Date().toLocaleTimeString() }, ...prev])
        setResult({ label: 'Ganador', name: picked })
      } else {
        const nextCount = picks.length + 1
        // ¿Completo una pareja? (cada 2 selecciones)
        const sub = nextCount % 2 === 0
          ? `Enfrentamiento M${nextCount / 2}: ${picks[picks.length - 1]} vs ${picked}`
          : 'Esperando rival...'
        setPicks(prev => [...prev, picked])
        setPool(prev => prev.filter((_, i) => i !== idx))
        setResult({ label: 'Equipo seleccionado', name: picked, sub })
      }
      setSpinning(false)
    }, 4200)
  }

  // Sortea todos los enfrentamientos de una vez (orden aleatorio).
  const drawAll = () => {
    if (!teams.length) return
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    setPicks(shuffled)
    setPool([])
    setApplied(false)
  }

  const reset = () => { setPool(teams); setPicks([]); setWinner(null); setApplied(false) }

  // Aplica el orden sorteado como seed del bracket (lo lee TabBracket).
  const applyToBracket = () => {
    const order = picks.length >= 2 ? picks.filter(Boolean) : [...teams]
    if (order.length < 2) return
    saveBracket(t.id, { seedOrder: order })
    setApplied(true)
    setTimeout(() => setApplied(false), 5000)
  }

  const toggleFullscreen = () => {
    const el = stageRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  // Sincroniza el estado con el fullscreen real (incluido salir con ESC) para no dejar
  // una capa fija invisible que bloquee los clics del resto de la app (p. ej. el sidebar).
  useEffect(() => {
    const onFsChange = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      if (document.fullscreenElement) document.exitFullscreen?.()
    }
  }, [])

  // Empareja la secuencia sorteada de a dos.
  const matchups = []
  for (let i = 0; i < picks.length; i += 2) {
    matchups.push([picks[i], picks[i + 1] || null])
  }

  const seg = segments.length ? 360 / segments.length : 360
  const gradient = segments.length
    ? segments.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ')
    : '#1f2430 0deg 360deg'

  const shortLabel = (s) => (String(s).length > 16 ? `${String(s).slice(0, 15)}…` : s)

  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div><h2>Ruleta de sorteo</h2><p className="otm-muted">Sortea el orden del bracket o un ganador de premio, de forma justa, visual y lista para stream.</p></div>
        <div className="otm-doc-actions">
          <button className="otm-btn otm-btn--ghost" onClick={fetchTeams} disabled={loadingTeams}>{Icon.refresh} {loadingTeams ? 'Cargando...' : 'Recargar equipos'}</button>
          <button className="otm-btn otm-btn--ghost" onClick={toggleFullscreen} disabled={!segments.length}>{Icon.tv} Pantalla completa</button>
        </div>
      </div>

      {/* Selector de modo */}
      <div className="otm-roulette-modes">
        <button className={`otm-rmode ${mode === 'enfrentamientos' ? 'active' : ''}`} onClick={() => setMode('enfrentamientos')}>
          {Icon.award} Sorteo del bracket
          <span>Ordena los equipos al azar y lo aplica como seed del bracket</span>
        </button>
        <button className={`otm-rmode ${mode === 'premios' ? 'active' : ''}`} onClick={() => { setMode('premios'); setWinner(null) }}>
          {Icon.trophy} Premios
          <span>Elige un ganador (giveaway, MVP, sorteo entre inscritos)</span>
        </button>
      </div>

      {loadingTeams ? (
        <div className="otm-empty">{Icon.users}<p>Cargando inscripciones del torneo...</p></div>
      ) : realTeams.length === 0 && mode === 'enfrentamientos' ? (
        <div className="otm-empty">
          {Icon.users}
          <p>Aún no hay equipos con check-in ni inscritos. La ruleta se llena sola con los equipos del torneo.</p>
          <button className="otm-btn otm-btn--ghost" onClick={fetchTeams}>{Icon.refresh} Recargar</button>
        </div>
      ) : (
        <div className="otm-wheel-wrap">
          <div className={`otm-wheel-stage ${fs ? 'is-fs' : ''}`} ref={stageRef}>
            <div className="otm-wheel-pointer">{Icon.chevronRight}</div>
            <div
              className="otm-wheel"
              style={{
                background: `conic-gradient(${gradient})`,
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4.2s cubic-bezier(.17,.67,.12,.99)' : 'none',
              }}
            >
              {segments.map((s, i) => (
                <span key={i} className="otm-wheel__label" style={{ transform: `rotate(${i * seg + seg / 2}deg)` }}>{shortLabel(s)}</span>
              ))}
            </div>
            <button className="otm-wheel__hub" onClick={spin} disabled={spinning || segments.length === 0}>
              {spinning ? '...' : segments.length === 0 ? 'FIN' : 'GIRAR'}
            </button>
            {fs && <button className="otm-wheel__exitfs" onClick={toggleFullscreen}>{Icon.x} Salir</button>}

            {/* Modal de resultado (dentro del stage -> visible tambien en pantalla completa) */}
            {result && !spinning && (
              <div className="otm-result" onClick={() => setResult(null)}>
                <div className="otm-result__card" onClick={e => e.stopPropagation()}>
                  <span className="otm-result__label">{result.label}</span>
                  <b className="otm-result__name">{result.name}</b>
                  {result.sub && <span className="otm-result__sub">{result.sub}</span>}
                  <div className="otm-result__actions">
                    <button className="otm-btn otm-btn--primary" onClick={() => setResult(null)}>Continuar</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="otm-wheel-side">
            {mode === 'premios' ? (
              <div className="otm-matchups">
                <div className="otm-matchups__head"><b>Premios</b></div>
                {winner
                  ? <div className="otm-winner"><span className="otm-winner__label">Ganador</span><b className="otm-winner__name">{winner}</b></div>
                  : <div className="otm-winner otm-winner--empty"><span>Gira la ruleta para elegir un ganador</span></div>}
                <div className="otm-field" style={{ marginTop: 12 }}>
                  <label>Nombres extra (uno por línea) — opcional</label>
                  <textarea rows={3} value={extra} onChange={e => setExtra(e.target.value)} placeholder={'Para giveaways: nicks de espectadores,\nstaff, etc. Los inscritos ya están.'} />
                </div>
                {history.length > 0 && (
                  <div className="otm-section" style={{ marginTop: 8 }}>
                    <h3>Sorteados ({history.length})</h3>
                    <ul className="otm-keyvals">
                      {history.map((h, i) => <li key={i}><span>{h.name}</span><b>{h.at}</b></li>)}
                    </ul>
                    <button className="otm-btn otm-btn--ghost otm-btn--xs" onClick={() => setHistory([])}>Limpiar historial</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="otm-matchups">
                <div className="otm-matchups__head">
                  <b>Enfrentamientos ({matchups.length})</b>
                  <div className="otm-doc-actions">
                    <button className="otm-btn otm-btn--ghost otm-btn--xs" onClick={drawAll}>{Icon.bolt} Sortear todo</button>
                    <button className="otm-btn otm-btn--ghost otm-btn--xs" onClick={reset}>Reiniciar</button>
                  </div>
                </div>
                {matchups.length === 0 ? (
                  <p className="otm-muted">Gira la ruleta (o usa "Sortear todo") para formar las parejas.</p>
                ) : (
                  <>
                    <div className="otm-matchups__list">
                      {matchups.map((m, i) => (
                        <div className="otm-match-card" key={i}>
                          <span className="otm-match-card__n">M{i + 1}</span>
                          <span className="otm-match-card__team">{m[0]}</span>
                          <span className="otm-match-card__vs">VS</span>
                          <span className="otm-match-card__team">{m[1] || 'BYE'}</span>
                        </div>
                      ))}
                    </div>
                    <button className="otm-btn otm-btn--primary" style={{ marginTop: 12, width: '100%' }} onClick={applyToBracket} disabled={picks.filter(Boolean).length < 2}>
                      {applied ? <>{Icon.check} Aplicado al bracket</> : <>{Icon.send} Usar este orden en el bracket</>}
                    </button>
                    <p className="otm-muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Fija el seed del bracket con este orden. {applied ? 'Abre la pestaña Bracket para verlo.' : ''}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="otm-section">
              <h3>{mode === 'premios' ? `Participantes (${teams.length})` : `En la ruleta (${pool.length})`}</h3>
              <div className="otm-wheel-list">
                {segments.map((s, i) => (
                  <div className="otm-wheel-item" key={i}>
                    <span className="otm-dot" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{s}
                  </div>
                ))}
                {segments.length === 0 && <p className="otm-muted">Todos los equipos fueron sorteados.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============== CONFIGURACION ============== */
// Config = datos del torneo editables despues de publicar. La estructura
// competitiva (sistema, BO por ronda, grupos, puntuacion) y el juego se
// editan en el asistente; aca se muestran de solo lectura.
const CONFIG_TZ = [
  ['-04:00', 'UTC-04:00 - Republica Dominicana'], ['+00:00', 'UTC'],
  ['-06:00', 'UTC-06:00'], ['-05:00', 'UTC-05:00'], ['-03:00', 'UTC-03:00'],
  ['+01:00', 'UTC+01:00'], ['+02:00', 'UTC+02:00'],
]
const CONFIG_PLATFORMS = [['pc', 'PC'], ['console', 'Consola'], ['mobile', 'Movil'], ['cross', 'Multiplataforma']]

function TabConfig({ t, onSave }) {
  const tz = /^[+-]\d{2}:\d{2}$/.test(t.timezone) ? t.timezone : '-04:00'
  const gameModalities = modalitiesFor(t.gameId)
  const initial = useMemo(() => ({
    timezone: tz,
    title: t.title || '',
    description: t.description || '',
    visibility: t.visibility || 'public',
    registrationStart: inputDateTime(Date.parse(t.registrationStart) || NaN, tz),
    registrationEnd: inputDateTime(Date.parse(t.registrationEnd) || NaN, tz),
    date: inputDateTime(Date.parse(t.dateIso) || NaN, tz),
    endDate: inputDateTime(Date.parse(t.endDateIso) || NaN, tz),
    checkinDeadline: inputDateTime(Date.parse(t.checkinDeadlineIso) || NaN, tz),
    modality: t.modality || gameModalities[0] || '',
    platform: t.platform || 'pc',
    server: t.server || '',
    patch: t.patch || '',
    mapMode: t.mapMode || 'fixed',
    mapPool: t.mapPool || '',
    participationScope: t.participationScope || 'global',
    allowedCountries: (t.allowedCountries || []).join(', '),
    minAge: t.minAge || 0,
    minorsAllowed: Boolean(t.minorsAllowed),
    universityOnly: Boolean(t.universityOnly),
    entryFee: t.entryFee || 0,
    contactEmail: t.contactEmail || '',
    contactPhone: t.contactPhone || '',
    contactDiscord: t.contactDiscord || '',
    streamUrl: t.streamUrl || '',
    streamLang: t.streamLang || 'Espanol',
  }), [t])
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { setForm(initial) }, [initial])
  const set = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); setError(''); setSaved(false) }

  const handleSubmit = async () => {
    setBusy(true)
    setError('')
    try {
      // Solo enviar lo que cambio. Las fechas van como instante ISO en la zona
      // elegida (mismo criterio que el asistente).
      const patch = {}
      const plain = ['title', 'description', 'visibility', 'platform', 'server', 'patch',
        'mapMode', 'mapPool', 'participationScope', 'streamUrl', 'streamLang', 'contactEmail', 'contactPhone', 'contactDiscord', 'modality', 'timezone']
      for (const k of plain) if (form[k] !== initial[k]) patch[k] = form[k]
      for (const k of ['registrationStart', 'registrationEnd', 'date', 'endDate', 'checkinDeadline']) {
        if (form[k] !== initial[k]) patch[k] = form[k] ? new Date(instant(form[k], form.timezone)).toISOString() : null
      }
      if (Number(form.entryFee) !== t.entryFee) patch.entryFee = Number(form.entryFee) || 0
      if (Number(form.minAge) !== t.minAge) patch.minAge = Number(form.minAge) || 0
      if (form.minorsAllowed !== initial.minorsAllowed) patch.minorsAllowed = form.minorsAllowed
      if (form.universityOnly !== initial.universityOnly) patch.universityOnly = form.universityOnly
      if (form.allowedCountries !== initial.allowedCountries) {
        patch.allowedCountries = form.participationScope === 'regional'
          ? form.allowedCountries.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
          : []
      }
      if (patch.participationScope === 'global') patch.allowedCountries = []

      if (!Object.keys(patch).length) { setSaved(true); setBusy(false); return }
      await onSave(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  const comp = competitionSummary(t.competition)
  return (
    <div className="otm-panel">
      <div className="otm-panel__head">
        <div>
          <h2>Configuracion del torneo</h2>
          <p className="otm-muted">Datos editables despues de publicar. Solo se guarda lo que cambies.</p>
        </div>
      </div>

      <div className="otm-section">
        <h3>Identidad</h3>
        <div className="otm-grid2">
          <div className="otm-field"><label>Nombre del torneo</label><input value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div className="otm-field"><label>Visibilidad</label>
            <select value={form.visibility} onChange={e => set('visibility', e.target.value)}>
              <option value="public">Publico</option><option value="unlisted">Oculto por link</option><option value="private">Privado</option>
            </select>
          </div>
        </div>
        <div className="otm-field"><label>Descripcion</label><textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <p className="otm-muted" style={{ fontSize: 12 }}>El logo, el banner, el color y los sponsors se editan en la pestana <b>Sponsors / Marca</b>.</p>
      </div>

      <div className="otm-section">
        <h3>Calendario</h3>
        <div className="otm-grid2">
          <div className="otm-field"><label>Zona horaria</label>
            <select value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              {CONFIG_TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="otm-field"><label>Apertura de inscripcion</label><input type="datetime-local" value={form.registrationStart} onChange={e => set('registrationStart', e.target.value)} /></div>
          <div className="otm-field"><label>Cierre de inscripcion</label><input type="datetime-local" value={form.registrationEnd} onChange={e => set('registrationEnd', e.target.value)} /></div>
          <div className="otm-field"><label>Inicio del torneo</label><input type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} /></div>
          <div className="otm-field"><label>Fin del torneo</label><input type="datetime-local" value={form.endDate} onChange={e => set('endDate', e.target.value)} /></div>
          <div className="otm-field"><label>Limite de check-in (opcional)</label><input type="datetime-local" value={form.checkinDeadline} onChange={e => set('checkinDeadline', e.target.value)} /></div>
        </div>
      </div>

      <div className="otm-section">
        <h3>Juego</h3>
        <div className="otm-grid2">
          <div className="otm-field"><label>Modalidad</label>
            <select value={form.modality} onChange={e => set('modality', e.target.value)}>
              {gameModalities.map(m => <option key={m} value={m}>{m}</option>)}
              {form.modality && !gameModalities.includes(form.modality) && <option value={form.modality}>{form.modality}</option>}
            </select>
          </div>
          <div className="otm-field"><label>Plataforma</label>
            <select value={form.platform} onChange={e => set('platform', e.target.value)}>
              {CONFIG_PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="otm-field"><label>Servidor / region de juego</label><input value={form.server} onChange={e => set('server', e.target.value)} placeholder="LAN, LAS, NA1..." /></div>
          <div className="otm-field"><label>Parche / version</label><input value={form.patch} onChange={e => set('patch', e.target.value)} placeholder="Ej. 14.10" /></div>
          <div className="otm-field"><label>Seleccion de mapas</label>
            <select value={form.mapMode} onChange={e => set('mapMode', e.target.value)}>
              <option value="fixed">Mapa fijo</option><option value="random">Aleatorio</option><option value="veto">Seleccion y veto</option>
            </select>
          </div>
          <div className="otm-field"><label>{form.mapMode === 'fixed' ? 'Mapa' : 'Mapas (separados por coma)'}</label><input value={form.mapPool} onChange={e => set('mapPool', e.target.value)} /></div>
        </div>
      </div>

      <div className="otm-section">
        <h3>Participacion</h3>
        <div className="otm-grid2">
          <div className="otm-field"><label>Alcance</label>
            <select value={form.participationScope} onChange={e => set('participationScope', e.target.value)}>
              <option value="global">Global</option><option value="regional">Limitada por pais</option>
            </select>
          </div>
          {form.participationScope === 'regional' && (
            <div className="otm-field"><label>Paises permitidos</label><input value={form.allowedCountries} onChange={e => set('allowedCountries', e.target.value)} placeholder="DO, PR, MX, CO..." /></div>
          )}
          <div className="otm-field"><label>Edad minima</label><input type="number" min="0" max="99" value={form.minAge} onChange={e => set('minAge', Number(e.target.value))} /></div>
          <div className="otm-field otm-field--check">
            <label><input type="checkbox" checked={form.minorsAllowed} onChange={e => set('minorsAllowed', e.target.checked)} /> Permitir menores con autorizacion</label>
          </div>
          <div className="otm-field otm-field--check">
            <label><input type="checkbox" checked={form.universityOnly} onChange={e => set('universityOnly', e.target.checked)} /> Solo equipos universitarios</label>
            <p className="otm-muted" style={{ fontSize: 11.5, margin: '4px 0 0' }}>
              Solo se inscriben equipos oficiales de una universidad verificada (uno por universidad en este juego) y el torneo suma al ranking universitario.
            </p>
          </div>
        </div>
      </div>

      <div className="otm-section">
        <h3>Capacidad y cuota</h3>
        <div className="otm-grid2">
          <div className="otm-field"><label>Cupos</label><input value={t.capacity} readOnly aria-describedby="otm-config-slots-hint" /></div>
          <div className="otm-field"><label>Cuota de entrada ({t.currency})</label><input type="number" min="0" value={form.entryFee} onChange={e => set('entryFee', Number(e.target.value))} /></div>
        </div>
        <p id="otm-config-slots-hint" className="otm-muted" style={{ fontSize: 12 }}>Los cupos cambian la llave y los grupos: se editan en <Link to={`/organizador/torneo/${t.dbId || t.id}/gestionar/competencia`}>Competencia</Link>, que avisa a los equipos.</p>
      </div>

      <div className="otm-section">
        <h3>Contacto y stream</h3>
        <div className="otm-grid2">
          <div className="otm-field"><label>Email de soporte</label><input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
          <div className="otm-field"><label>Telefono / WhatsApp</label><input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} /></div>
          <div className="otm-field"><label>Discord (usuario o invitacion)</label><input value={form.contactDiscord} onChange={e => set('contactDiscord', e.target.value)} /></div>
          <div className="otm-field"><label>Idioma del stream</label>
            <select value={form.streamLang} onChange={e => set('streamLang', e.target.value)}>
              {['Espanol', 'Ingles', 'Portugues', 'Bilingue'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="otm-field"><label>URL del stream</label><input value={form.streamUrl} onChange={e => set('streamUrl', e.target.value)} placeholder="https://twitch.tv/..." /></div>
      </div>

      <div className="otm-section">
        <h3>Estructura competitiva <span className="otm-muted">(se edita en <Link to={`/organizador/torneo/${t.dbId || t.id}/gestionar/competencia`}>Competencia</Link>)</span></h3>
        {comp.length ? (
          <ul className="otm-keyvals">{comp.map((r, i) => <li key={i}><span>{r.label}</span><b>{r.value}</b></li>)}</ul>
        ) : <p className="otm-muted">Sin estructura v2.</p>}
      </div>

      {error && <p className="otm-muted" style={{ color: 'var(--danger, #e04466)' }}>{error}</p>}
      <button className="otm-btn otm-btn--primary" onClick={handleSubmit} disabled={busy}>
        {busy ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
      </button>
    </div>
  )
}

const REPORT_TYPES = ['Comportamiento toxico', 'No-show / incomparecencia', 'Trampa / cheating', 'Disputa de resultado', 'Suplantacion de identidad', 'Roster ilegal', 'Otro']
const REPORT_SEVERITY = [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta'], ['urgente', 'Urgente']]
const REPORT_STATUS_META = {
  open: { txt: 'Abierto', cls: 'otm-rstatus--open' },
  in_review: { txt: 'En revision', cls: 'otm-rstatus--review' },
  resolved: { txt: 'Resuelto', cls: 'otm-rstatus--resolved' },
}
const emptyReport = () => ({ team: '', type: REPORT_TYPES[0], severity: 'media', detail: '', evidence: [] })

function TabReportar({ t }) {
  const [reports, setReports] = useState([])
  const [regs, setRegs] = useState([])
  const [form, setForm] = useState(emptyReport)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let alive = true
    reportsApi.list(t.id)
      .then(data => { if (alive && Array.isArray(data.reports)) setReports(data.reports) })
      .catch(() => {})
    registrationsApi.list(t.id)
      .then(data => { if (alive && Array.isArray(data.registrations)) setRegs(data.registrations) })
      .catch(() => {})
    return () => { alive = false }
  }, [t.id])

  const teamNames = useMemo(() => resolveBracketTeams(regs, null), [regs])
  const set = (k, v) => { setForm(prev => ({ ...prev, [k]: v })); setError(''); setOk(false) }

  const addEvidence = async (files) => {
    if (!files?.length) return
    setUploading(true); setError('')
    try {
      const urls = []
      for (const file of Array.from(files)) {
        const up = await uploadsApi.upload(file)
        if (up.url) urls.push(up.url)
      }
      setForm(prev => ({ ...prev, evidence: [...prev.evidence, ...urls] }))
    } catch (err) {
      setError(err.message || 'No se pudo subir la evidencia.')
    } finally { setUploading(false) }
  }

  const submitReport = async () => {
    if (!form.detail.trim()) { setError('Describe la incidencia.'); return }
    setBusy(true); setError('')
    try {
      const data = await reportsApi.create(t.id, form)
      setReports(Array.isArray(data.reports) ? data.reports : [data.report, ...reports].filter(Boolean))
      setForm(emptyReport())
      setOk(true)
      setTimeout(() => setOk(false), 4000)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el reporte. Intenta de nuevo.')
    } finally { setBusy(false) }
  }

  const fmtDate = (r) => {
    const d = r.createdAt || r.date
    return d ? new Date(d).toLocaleDateString() : ''
  }

  return (
    <div className="otm-panel otm-rp">
      <div className="otm-panel__head">
        <div><h2>Reportes y disputas</h2><p className="otm-muted">Escala una incidencia del torneo — se abre un ticket con soporte de GlitchGang.</p></div>
      </div>

      <div className="otm-section">
        <h3>Nuevo reporte</h3>
        <div className="otm-rp-form-grid">
          <div className="otm-field">
            <label>Equipo / jugador reportado</label>
            <input list="otm-report-teams" value={form.team} onChange={e => set('team', e.target.value)} placeholder={teamNames.length ? 'Elige o escribe' : 'Nombre del equipo o jugador'} />
            <datalist id="otm-report-teams">{teamNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="otm-field">
            <label>Tipo</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {REPORT_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="otm-field">
            <label>Gravedad</label>
            <select value={form.severity} onChange={e => set('severity', e.target.value)}>
              {REPORT_SEVERITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="otm-field">
          <label>Detalle</label>
          <textarea rows={4} placeholder="Qué pasó, cuándo, en qué partida, quiénes están involucrados..." value={form.detail} onChange={e => set('detail', e.target.value)} />
        </div>

        <div className="otm-field">
          <label>Evidencia (capturas, VODs) — opcional</label>
          <div className="otm-rp-evidence">
            {form.evidence.map((url, i) => (
              <div className="otm-rp-evidence__thumb" key={i} style={{ backgroundImage: `url(${url})` }}>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, evidence: prev.evidence.filter((_, j) => j !== i) }))}>{Icon.x}</button>
              </div>
            ))}
            <label className="otm-rp-evidence__add">
              {Icon.upload}
              <small>{uploading ? 'Subiendo...' : 'Adjuntar'}</small>
              <input type="file" accept="image/*" multiple hidden onChange={e => addEvidence(e.target.files)} />
            </label>
          </div>
        </div>

        <div className="otm-rp-form-foot">
          <div>
            {error && <p className="otm-rp-msg otm-rp-msg--err">{Icon.alert} {error}</p>}
            {ok && <p className="otm-rp-msg otm-rp-msg--ok">{Icon.check} Reporte enviado. Soporte de GlitchGang lo revisará.</p>}
          </div>
          <button className="otm-btn otm-btn--primary" onClick={submitReport} disabled={busy || uploading}>
            {Icon.send} {busy ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </div>
      </div>

      <div className="otm-section">
        <h3>Historial ({reports.length})</h3>
        {reports.length === 0 ? (
          <div className="otm-empty">{Icon.shield}<p>Sin reportes en este torneo.</p></div>
        ) : (
          <div className="otm-rp-list">
            {reports.map(r => {
              const st = REPORT_STATUS_META[r.status] || REPORT_STATUS_META.open
              return (
                <div className="otm-rp-card" key={r._id || r.id}>
                  <div className="otm-rp-card__top">
                    <span className="otm-rp-card__icon">{Icon.alert}</span>
                    <div className="otm-rp-card__title">
                      <b>{r.type}</b>
                      <span>{[r.team, fmtDate(r)].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="otm-rp-card__badges">
                      {r.severity && <span className={`otm-rp-sev otm-rp-sev--${r.severity}`}>{REPORT_SEVERITY.find(([v]) => v === r.severity)?.[1] || r.severity}</span>}
                      <span className={`otm-rstatus ${st.cls}`}>{st.txt}</span>
                    </div>
                  </div>
                  {r.detail && <p className="otm-rp-card__detail">{r.detail}</p>}
                  {Array.isArray(r.evidence) && r.evidence.length > 0 && (
                    <div className="otm-rp-card__evidence">
                      {r.evidence.map((url, i) => <img key={i} src={url} alt="" />)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ Toggle reusable ═══════════════ */
function Toggle({ label, defaultChecked, onChange }) {
  const [on, setOn] = useState(!!defaultChecked)
  const toggle = () => setOn(v => { const next = !v; onChange?.(next); return next })
  return (
    <button type="button" className={`otm-toggle ${on ? 'on' : ''}`} onClick={toggle}>
      <span className="otm-toggle__track"><span className="otm-toggle__thumb" /></span>
      <span className="otm-toggle__label">{label}</span>
    </button>
  )
}

