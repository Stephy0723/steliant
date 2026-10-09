import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import StaffInvitations from '../../../components/StaffInvitations/StaffInvitations.jsx'
import StaffApply from '../../../components/StaffApply/StaffApply.jsx'
import RoleFieldInput, { ExperienceSection } from '../../../components/RoleFieldInput/RoleFieldInput.jsx'
import RoleProfileCard from '../../../components/RoleProfileCard/RoleProfileCard.jsx'
import ShowcaseToggle from '../../../components/RoleProfileCard/ShowcaseToggle.jsx'
import { toast } from '../../../lib/toast.js'
import { PLATFORM_ROLES } from '../../../data/roleApplications.js'
import ProfileCompletionBanner from '../../../components/ProfileCompletionBanner/ProfileCompletionBanner.jsx'
import { tournamentsApi } from '../../../lib/serverApi.js'
import { filterStaffTournamentsForPanel } from '../../../lib/staffPanelRoles.js'
import { api } from '../../../lib/api.js'
import { exportCsv } from '../../../lib/reportKit.js'
import { presenceInfo } from '../../../lib/presence.js'

function resolveAvatarUrl(value) {
  if (!value) return '/demos/steliant-esports/avatar-default.svg'
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

function fmtDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const PROFILE_DEFAULTS = {
  coachName: '',
  mainGame: '',
  availability: '',
  rate: '',
  website: '',
  focus: '',
  methodology: '',
  // Estos 4 ya los pidio el formulario de solicitud de rol (roleApplications.js,
  // experienceFields de coach) y llegan reales en approvedDetails -- antes no
  // se mostraban en ningun lado del panel, asi que la "trayectoria" de la
  // persona se perdia despues de aprobarse el rol.
  yearsExp: '',
  maxSize: '',
  toolsUsed: '',
  descComplex: '',
}

const PLAN_DEFAULTS = {
  teamName: '',
  game: '',
  roster: '',
  nextMatch: '',
  tournament: '',
  opponent: '',
  weekGoal: '',
  studyPlan: '',
  sessionPlan: '',
  homework: '',
  notes: '',
}

const PLAN_STATUS_LABELS = { draft: 'Borrador', sent: 'Enviado', seen: 'Visto por el capitán', approved: 'Aprobado', archived: 'Archivado' }

// Plan del servidor (CoachWorkPlan) -> estado del formulario.
function planFromServer(item = {}) {
  const out = { ...PLAN_DEFAULTS, _id: item._id, teamId: item.team ? String(item.team) : '', status: item.status || 'draft' }
  for (const key of Object.keys(PLAN_DEFAULTS)) out[key] = item[key] || ''
  return out
}

function sentPlanRow(item) {
  return {
    id: item._id,
    sentAt: item.sentAt ? fmtDate(item.sentAt) : '',
    status: PLAN_STATUS_LABELS[item.status] || item.status,
    teamName: item.teamName || 'Equipo sin nombre',
    game: item.game || 'Juego sin definir',
    nextMatch: item.nextMatch || 'Sin fecha',
    summary: item.weekGoal || item.studyPlan || 'Plan sin resumen',
  }
}

function storageKey(user, suffix) {
  return `gg-coach-${user?._id || user?.id || user?.email || user?.nick || 'local'}-${suffix}`
}

function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? { ...fallback, ...JSON.parse(value) } : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function nowLabel() {
  return new Date().toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function CoachDashboard() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = pathname.includes('/sesiones') ? 'sesiones' : pathname.includes('/analisis') ? 'analisis' : pathname.includes('/jugadores') ? 'jugadores' : 'resumen'
  const profileKey = storageKey(user, 'profile-v1')
  // Plan que quedo en este navegador antes de que existiera el backend: se
  // usa solo para precargar el formulario si no hay borrador en el servidor.
  const planKey = storageKey(user, 'work-plan-v1')
  const approvedDetails = user?.roleProfiles?.coach?.details || {}

  const [profile, setProfile] = useState(() => readLocal(profileKey, { ...PROFILE_DEFAULTS, ...approvedDetails }))
  const [plan, setPlan] = useState(() => readLocal(planKey, PLAN_DEFAULTS))
  const [plans, setPlans] = useState([])
  const [planBusy, setPlanBusy] = useState(false)
  const sentPlans = useMemo(() => plans.filter(item => ['sent', 'seen', 'approved'].includes(item.status)).map(sentPlanRow), [plans])
  const [savedAt, setSavedAt] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [tournamentsLoading, setTournamentsLoading] = useState(true)
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    setProfile(readLocal(profileKey, { ...PROFILE_DEFAULTS, ...approvedDetails }))
  }, [profileKey])

  useEffect(() => {
    let alive = true
    api('/coach/work-plans')
      .then(data => {
        if (!alive) return
        const list = Array.isArray(data?.plans) ? data.plans : []
        setPlans(list)
        const draft = list.find(item => item.status === 'draft')
        if (draft) setPlan(planFromServer(draft))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Mismo mecanismo que CasterDashboard/AnalystDashboard: torneos donde este
  // usuario ya es staff aceptado. Hoy "Coach" todavia no es un valor valido en
  // `Tournament.staffMembers.role` (ver BACKEND-PENDIENTE #staff-roles-coach-analista),
  // asi que esto siempre devuelve vacio hasta que el backend lo soporte -- se
  // deja cableado ya para no tener que volver a tocar este archivo despues.
  useEffect(() => {
    let alive = true
    setTournamentsLoading(true)
    tournamentsApi.staffMine('accepted')
      .then(data => { if (alive) setTournaments(filterStaffTournamentsForPanel(data?.tournaments, 'coach')) })
      .catch(() => { if (alive) setTournaments([]) })
      .finally(() => { if (alive) setTournamentsLoading(false) })
    return () => { alive = false }
  }, [])

  // Equipos reales donde soy coach (rosterSlots), no un torneo -- puede ser
  // coach de varios equipos de categorias distintas a la vez (ej. Mobile
  // Legends y Call of Duty), el endpoint ya lo soporta.
  useEffect(() => {
    let alive = true
    setTeamsLoading(true)
    api('/teams/staff/mine?role=coach')
      .then(data => { if (alive) setTeams(Array.isArray(data?.teams) ? data.teams : []) })
      .catch(() => { if (alive) setTeams([]) })
      .finally(() => { if (alive) setTeamsLoading(false) })
    return () => { alive = false }
  }, [])

  const updateProfile = (key, value) => setProfile(current => ({ ...current, [key]: value }))
  const updatePlan = (key, value) => setPlan(current => ({ ...current, [key]: value }))

  // Hasta ahora esto solo escribia en localStorage -- se veia "guardado" en
  // el propio navegador pero nunca llegaba a Mongo, asi que no aparecia en
  // el buscador de staff ni en otro dispositivo. Mismo endpoint que ya usa
  // ModeratorDashboard (PATCH /profile/me con professionalProfile), pero
  // mandando `role: 'coach'` explicito -- ver BACKEND-PENDIENTE.md
  // #role-profile-sin-editar.
  const saveProfile = async () => {
    if (savingProfile) return
    setSavingProfile(true)
    setProfileError('')
    writeLocal(profileKey, profile)
    try {
      const result = await api('/profile/me', {
        method: 'PATCH',
        body: { role: 'coach', professionalProfile: profile },
      })
      if (result.user) updateUser(result.user)
      setSavedAt(`Perfil guardado: ${nowLabel()}`)
      toast('Perfil profesional guardado', 'success')
    } catch (err) {
      setProfileError(err?.message || 'No se pudo guardar el perfil en el servidor. Se guardo localmente mientras tanto.')
      toast('No se pudo guardar en el servidor; quedó guardado en este navegador', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const rememberPlan = (saved) => {
    setPlan(planFromServer(saved))
    setPlans(current => [saved, ...current.filter(item => item._id !== saved._id)])
  }

  // Guarda en el servidor (crea el borrador la primera vez). Devuelve el plan guardado o null.
  const persistPlan = async () => {
    const body = { teamId: plan.teamId || '' }
    for (const key of Object.keys(PLAN_DEFAULTS)) body[key] = plan[key] || ''
    const result = plan._id
      ? await api(`/coach/work-plans/${plan._id}`, { method: 'PATCH', body })
      : await api('/coach/work-plans', { method: 'POST', body })
    try { localStorage.removeItem(planKey) } catch {}
    rememberPlan(result.plan)
    return result.plan
  }

  const savePlan = async () => {
    if (planBusy) return
    setPlanBusy(true)
    try {
      await persistPlan()
      setSavedAt(`Plan guardado: ${nowLabel()}`)
      toast('Plan guardado', 'success')
    } catch (err) {
      toast(err?.message || 'No se pudo guardar el plan', 'error')
    } finally {
      setPlanBusy(false)
    }
  }

  const sendPlan = async () => {
    if (planBusy) return
    if (!plan.teamId) {
      toast('Elige a cuál de tus equipos va el plan', 'error')
      navigate('/coach/sesiones')
      return
    }
    setPlanBusy(true)
    try {
      const saved = await persistPlan()
      const result = await api(`/coach/work-plans/${saved._id}/send`, { method: 'POST' })
      rememberPlan(result.plan)
      setSavedAt(`Plan enviado al capitán: ${nowLabel()}`)
      toast('Plan enviado al capitán del equipo', 'success')
    } catch (err) {
      toast(err?.message || 'No se pudo enviar el plan', 'error')
    } finally {
      setPlanBusy(false)
    }
  }

  const newPlan = () => setPlan(PLAN_DEFAULTS)

  const completedProfile = useMemo(() => ['coachName', 'mainGame', 'availability', 'rate'].filter(key => profile[key]).length, [profile])
  const completedPlan = useMemo(() => ['teamName', 'game', 'nextMatch', 'weekGoal', 'studyPlan', 'sessionPlan'].filter(key => plan[key]).length, [plan])
  const kpis = [
    { label: 'Perfil profesional', value: `${completedProfile}/4`, icon: 'user', delta: 'campos clave' },
    { label: 'Plan de trabajo', value: `${completedPlan}/6`, icon: 'calendar', delta: 'listo para enviar' },
    { label: 'Planes enviados', value: sentPlans.length, icon: 'send', delta: sentPlans[0]?.sentAt || 'sin envios' },
    { label: 'Tarifa', value: profile.rate || 'Sin definir', icon: 'creditCard', delta: 'editable' },
  ]

  return (
    <div className="role-dashboard role-dashboard--coach">
      <motion.div className="pnl-hero pnl-hero--role-id" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="coach" profile={user} isOwner />
        <div className="pnl-hero__glow" />
        <div className="pnl-hero__info">
          <div className="pnl-hero__nameline">
            <h1>Coach HQ de {profile.coachName || user?.nick || 'GlitchGang'}</h1>
            <span className="pnl-tag pnl-tag--accent">Coach</span>
          </div>
          <p className="pnl-hero__sub">Perfil profesional, plan de trabajo para tus equipos, sesiones y analisis. El plan se envia al capitan del equipo.</p>
        </div>
        <div className="pnl-hero__cta">
          <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/coach/sesiones')}>{Icon.calendar} Editar plan</button>
          <button className="pnl-btn" onClick={sendPlan}>{Icon.send} Enviar plan</button>
        </div>
      </motion.div>

      <StaffInvitations compact />
      <StaffApply platformRole="coach" compact />
      <ProfileCompletionBanner role="coach" user={user} />

      <CoachTournaments tournaments={tournaments} loading={tournamentsLoading} />

      <motion.div className="pnl-kpis" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {kpis.map(k => (
          <div key={k.label} className="pnl-kpi">
            <div className="pnl-kpi__icon">{Icon[k.icon]}</div>
            <div className="pnl-kpi__value">{k.value}</div>
            <div className="pnl-kpi__label">{k.label}</div>
            <div className="pnl-kpi__delta">{k.delta}</div>
          </div>
        ))}
      </motion.div>

      {savedAt && <div className="role-status">{Icon.check} {savedAt}</div>}

      {section === 'jugadores' && <CoachTeams teams={teams} loading={teamsLoading} />}
      {section === 'sesiones' && <CoachWorkPlan plan={plan} teams={teams} updatePlan={updatePlan} setPlan={setPlan} savePlan={savePlan} sendPlan={sendPlan} newPlan={newPlan} busy={planBusy} />}
      {section === 'analisis' && <CoachAnalysis plan={plan} profile={profile} sentPlans={sentPlans} />}
      {section === 'resumen' && (
        <CoachProfile user={user} profile={profile} updateProfile={updateProfile} saveProfile={saveProfile} saving={savingProfile} error={profileError} />
      )}
    </div>
  )
}

function CoachTeams({ teams, loading }) {
  const [openId, setOpenId] = useState(null)
  if (loading) return <p className="pnl-empty-hint">Cargando equipos...</p>
  if (!teams.length) {
    return (
      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">{Icon.team} Mis equipos</div>
        <p className="pnl-empty-hint">Cuando un lider de equipo te agregue como coach, el equipo (con roster completo) aparece aca. Podes ser coach de varios equipos de categorias distintas a la vez.</p>
      </motion.div>
    )
  }
  return (
    <div className="pnl-grid pnl-grid--2">
      {teams.map(team => {
        const isOpen = openId === (team._id || team.id)
        return (
          <motion.div className="pnl-card" key={team._id || team.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">
              {team.logo ? <img src={resolveAvatarUrl(team.logo)} alt="" style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover' }} /> : Icon.team}
              {team.name}
              <span className="pnl-tag" style={{ marginLeft: 'auto' }}>{team.game || 'Sin juego'}</span>
            </div>
            <div className="role-info-grid role-info-grid--compact">
              <div><span>Roster</span><b>{(team.roster || []).length} jugadores</b></div>
              <div><span>Region</span><b>{team.region || 'Sin definir'}</b></div>
            </div>
            <div className="role-actions">
              <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => setOpenId(isOpen ? null : (team._id || team.id))}>
                {isOpen ? 'Ocultar roster' : 'Ver roster'}
              </button>
            </div>
            {isOpen && (
              <div className="role-list" style={{ marginTop: 12 }}>
                {(team.roster || []).map(member => (
                  <article className="role-list__item" key={member.id}>
                    <img src={resolveAvatarUrl(member.avatar)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b>{member.nick}</b>
                      <small>{member.role}{presenceInfo(member).online ? ` · ${presenceInfo(member).label}` : ''}</small>
                    </div>
                  </article>
                ))}
                {!team.roster?.length && <p className="pnl-empty-hint">Este equipo todavia no tiene roster cargado.</p>}
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function CoachTournaments({ tournaments, loading }) {
  const navigate = useNavigate()
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.trophy} Torneos donde soy staff</div>
      {loading ? <p className="pnl-empty-hint">Cargando torneos...</p> : tournaments.length ? (
        <div className="role-list">
          {tournaments.slice(0, 6).map(t => (
            <article className="role-list__item role-list__item--stack" key={t._id || t.publicId}>
              <div>
                <b>{t.title}</b>
                <small>{t.game} - {fmtDate(t.date)} - {t.status}</small>
              </div>
              <div className="role-info-grid role-info-grid--compact">
                <div><span>Equipos</span><b>{t.currentSlots || t.registrations?.length || 0}/{t.maxSlots || 0}</b></div>
                <div><span>Check-in</span><b>{fmtDate(t.checkinDeadline || t.registrationWindow?.end)}</b></div>
                <div><span>Staff</span><b>{(t.staffMembers || []).filter(m => m.status !== 'declined').length || 'Sin staff'}</b></div>
                <div><span>Reglas</span><b>{t.rules || t.rulesDocument ? 'Publicadas' : 'Pendientes'}</b></div>
              </div>
              <div className="role-actions">
                <button className="pnl-btn pnl-btn--primary" type="button" onClick={() => navigate(`/organizador/torneo/${t._id || t.publicId}/gestionar`)}>
                  {Icon.eye} Ver equipos, bracket y estado
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="pnl-empty-hint">Cuando un organizador te acepte como staff de un torneo, va a aparecer aca con equipos, bracket y estado en vivo.</p>
      )}
    </motion.div>
  )
}

const COACH_META = PLATFORM_ROLES.find(r => r.id === 'coach')

function CoachProfile({ user, profile, updateProfile, saveProfile, saving, error }) {
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">{Icon.user} Mi perfil profesional</div>

      <div style={{ display: 'grid', justifyItems: 'center', gap: 12, margin: '4px 0 22px' }}>
        <RoleProfileCard role="coach" user={user} details={profile} width={280} />
        <ShowcaseToggle role="coach" />
      </div>

      <div className="role-form-grid">
        {COACH_META.profileFields.map(field => (
          <RoleFieldInput key={field.id} field={field} value={profile[field.id]} onChange={v => updateProfile(field.id, v)} user={user} />
        ))}
      </div>

      <div className="pnl-card__title pnl-card__title--sub">{Icon.chartBar} Trayectoria</div>
      <div className="role-form-grid">
        <ExperienceSection fields={COACH_META.experienceFields} values={profile} setValue={updateProfile} user={user} />
        <label className="role-field role-field--wide">
          <span>Enfoque</span>
          <textarea rows={3} value={profile.focus || ''} placeholder="Ej. macro, draft, disciplina, VOD review, toma de decisiones..." onChange={event => updateProfile('focus', event.target.value)} />
        </label>
        <label className="role-field role-field--wide">
          <span>Metodologia</span>
          <textarea rows={3} value={profile.methodology || ''} placeholder="Como trabajas con equipos y jugadores." onChange={event => updateProfile('methodology', event.target.value)} />
        </label>
      </div>

      {error && <div className="role-status role-status--error">{Icon.alert} {error}</div>}

      <div className="role-actions">
        <button className="pnl-btn pnl-btn--primary" type="button" onClick={saveProfile} disabled={saving}>
          {Icon.check} {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </div>
    </motion.div>
  )
}

function CoachWorkPlan({ plan, teams, updatePlan, setPlan, savePlan, sendPlan, newPlan, busy }) {
  const pickTeam = (teamId) => {
    const team = teams.find(item => String(item._id) === teamId)
    setPlan(current => ({
      ...current,
      teamId,
      teamName: team?.name || '',
      game: current.game || team?.game || '',
    }))
  }
  const textFields = [
    ['game', 'Juego', 'Juego competitivo'],
    ['roster', 'Roster / jugadores', 'Titulares, suplentes, roles'],
    ['nextMatch', 'Proximo enfrentamiento', 'Fecha, hora y rival'],
    ['tournament', 'Torneo', 'Torneo o liga asociada'],
    ['opponent', 'Rival a estudiar', 'Equipo rival / jugador clave'],
  ]
  return (
    <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="pnl-card__title">
        {Icon.calendar} Plan de trabajo
        {plan._id && <span className="pnl-tag">{PLAN_STATUS_LABELS[plan.status] || plan.status}</span>}
        {plan._id && <button type="button" className="pnl-link pnl-card__action" onClick={newPlan}>{Icon.plus} Nuevo plan</button>}
      </div>
      <div className="role-form-grid">
        <label className="role-field">
          <span>Equipo</span>
          <select value={plan.teamId || ''} onChange={event => pickTeam(event.target.value)}>
            <option value="">{teams.length ? 'Elige uno de tus equipos' : 'Aun no eres coach de ningun equipo'}</option>
            {teams.map(team => <option key={team._id} value={String(team._id)}>{team.name}{team.game ? ` · ${team.game}` : ''}</option>)}
          </select>
        </label>
        {textFields.map(([key, label, placeholder]) => (
          <label className="role-field" key={key}>
            <span>{label}</span>
            <input value={plan[key] || ''} placeholder={placeholder} onChange={event => updatePlan(key, event.target.value)} />
          </label>
        ))}
        <label className="role-field role-field--wide">
          <span>Objetivo de la semana</span>
          <textarea rows={3} value={plan.weekGoal || ''} placeholder="Que debe mejorar el equipo esta semana." onChange={event => updatePlan('weekGoal', event.target.value)} />
        </label>
        <label className="role-field role-field--wide">
          <span>Plan de estudio</span>
          <textarea rows={4} value={plan.studyPlan || ''} placeholder="VODs, mapas, draft, composiciones, errores, fortalezas del rival." onChange={event => updatePlan('studyPlan', event.target.value)} />
        </label>
        <label className="role-field role-field--wide">
          <span>Sesion / practica</span>
          <textarea rows={4} value={plan.sessionPlan || ''} placeholder="Agenda de practica, ejercicios, scrims, objetivos por bloque." onChange={event => updatePlan('sessionPlan', event.target.value)} />
        </label>
        <label className="role-field role-field--wide">
          <span>Tareas para jugadores</span>
          <textarea rows={3} value={plan.homework || ''} placeholder="Tareas individuales o por rol." onChange={event => updatePlan('homework', event.target.value)} />
        </label>
        <label className="role-field role-field--wide">
          <span>Notas privadas (el equipo no las ve)</span>
          <textarea rows={3} value={plan.notes || ''} placeholder="Notas internas del coach." onChange={event => updatePlan('notes', event.target.value)} />
        </label>
      </div>
      <div className="role-actions">
        <button className="pnl-btn" type="button" onClick={savePlan} disabled={busy}>{Icon.check} Guardar borrador</button>
        <button className="pnl-btn pnl-btn--primary" type="button" onClick={sendPlan} disabled={busy}>{Icon.send} Enviar plan</button>
      </div>
    </motion.div>
  )
}

const COACH_SENT_PLAN_FIELDS = [
  { label: 'Equipo', get: p => p.teamName },
  { label: 'Juego', get: p => p.game },
  { label: 'Proximo enfrentamiento', get: p => p.nextMatch },
  { label: 'Resumen', get: p => p.summary },
  { label: 'Estado', get: p => p.status },
  { label: 'Enviado', get: p => p.sentAt },
]

function CoachAnalysis({ plan, profile, sentPlans }) {
  const rows = [
    ['Equipo', plan.teamName || 'Sin equipo definido'],
    ['Juego', plan.game || profile.mainGame || 'Sin juego definido'],
    ['Rival', plan.opponent || 'Sin rival definido'],
    ['Proximo enfrentamiento', plan.nextMatch || 'Sin fecha definida'],
    ['Objetivo', plan.weekGoal || 'Sin objetivo semanal'],
    ['Tarifa coach', profile.rate || 'Sin tarifa definida'],
  ]
  return (
    <div className="pnl-grid pnl-grid--2">
      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">{Icon.chartBar} Analisis del plan actual</div>
        <div className="role-info-grid">
          {rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
        </div>
      </motion.div>
      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">
          {Icon.send} Planes enviados
          {sentPlans.length > 0 && (
            <button
              className="pnl-link pnl-card__action"
              onClick={() => exportCsv(sentPlans, COACH_SENT_PLAN_FIELDS, `mis-planes-coach-${new Date().toISOString().slice(0, 10)}.csv`)}
            >
              {Icon.download} Exportar
            </button>
          )}
        </div>
        <div className="role-list">
          {sentPlans.map(item => (
            <article className="role-list__item role-list__item--stack" key={item.id}>
              <div><b>{item.teamName}</b><small>{item.game} - {item.sentAt} - {item.status}</small></div>
              <p className="role-note">{item.summary}</p>
            </article>
          ))}
          {!sentPlans.length && <p className="pnl-empty-hint">Todavia no has enviado ningun plan.</p>}
        </div>
      </motion.div>
    </div>
  )
}

