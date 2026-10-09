// Planes de trabajo que el coach le envía al equipo (/mi-equipo/planes).
// Fuente: GET /coach/work-plans/team/:teamId -- abrirlo como capitán marca
// los planes "enviados" como vistos en el servidor. Las notas privadas del
// coach nunca llegan acá (el backend las quita).
import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import GGLoader from '../GGLoader/GGLoader.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import './TeamCoachPlans.css'

const STATUS = {
  sent: { label: 'Nuevo', tone: 'new' },
  seen: { label: 'Visto', tone: 'seen' },
  approved: { label: 'Aprobado', tone: 'ok' },
}

const SECTIONS = [
  ['weekGoal', 'Objetivo de la semana', 'target'],
  ['studyPlan', 'Plan de estudio', 'fileText'],
  ['sessionPlan', 'Sesión / práctica', 'calendar'],
  ['homework', 'Tareas para jugadores', 'list'],
]

const FACTS = [
  ['tournament', 'Torneo', 'trophy'],
  ['nextMatch', 'Próximo enfrentamiento', 'clock'],
  ['opponent', 'Rival a estudiar', 'users'],
  ['roster', 'Roster', 'team'],
]

function fmtDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TeamCoachPlans({ team, isLeader = true }) {
  const teamId = team?._id || team?.id
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [plans, setPlans] = useState([])
  const [openId, setOpenId] = useState(null)
  const [approving, setApproving] = useState('')

  useEffect(() => {
    if (!teamId) return
    let alive = true
    setStatus('loading')
    api(`/coach/work-plans/team/${teamId}`)
      .then(data => {
        if (!alive) return
        const list = Array.isArray(data?.plans) ? data.plans : []
        setPlans(list)
        setOpenId(list[0]?._id || null)
        setStatus('ready')
      })
      .catch(() => { if (alive) setStatus('error') })
    return () => { alive = false }
  }, [teamId])

  const approve = async (plan) => {
    if (approving) return
    setApproving(plan._id)
    try {
      const result = await api(`/coach/work-plans/${plan._id}/approve`, { method: 'POST' })
      setPlans(current => current.map(item => (item._id === plan._id ? { ...item, ...result.plan, coach: item.coach } : item)))
      toast('Plan aprobado. Le avisamos al coach.', 'success')
    } catch (err) {
      toast(err?.message || 'No se pudo aprobar el plan', 'error')
    } finally {
      setApproving('')
    }
  }

  if (!teamId) return null
  if (status === 'loading') return <GGLoader label="Cargando planes del coach" />
  if (status === 'error') {
    return (
      <div className="tcp tcp--empty">
        <span className="tcp-empty__icon">{Icon.alert}</span>
        <h3>No se pudieron cargar los planes</h3>
        <p>Revisa tu conexión e inténtalo de nuevo.</p>
      </div>
    )
  }
  if (!plans.length) {
    return (
      <div className="tcp tcp--empty">
        <span className="tcp-empty__icon">{Icon.fileText}</span>
        <h3>Todavía no hay planes del coach</h3>
        <p>Cuando el coach de {team?.name || 'tu equipo'} te envíe un plan de trabajo desde su panel, aparecerá aquí y te llegará un aviso. El coach tiene que ocupar un puesto de coach en el roster.</p>
      </div>
    )
  }

  return (
    <div className="tcp">
      {plans.map(plan => {
        const st = STATUS[plan.status] || STATUS.seen
        const open = openId === plan._id
        const coach = plan.coach || {}
        const facts = FACTS.filter(([key]) => plan[key])
        const sections = SECTIONS.filter(([key]) => plan[key])
        return (
          <article key={plan._id} className={`tcp-card${open ? ' is-open' : ''}`}>
            <button type="button" className="tcp-card__head" onClick={() => setOpenId(open ? null : plan._id)} aria-expanded={open}>
              <img className="tcp-card__avatar" src={coach.avatar || '/demos/steliant-esports/avatar-default.svg'} alt="" />
              <span className="tcp-card__title">
                <b>{plan.weekGoal ? plan.weekGoal.split('\n')[0].slice(0, 90) : 'Plan de trabajo'}</b>
                <small>{coach.nick || 'Coach'}{plan.game ? ` · ${plan.game}` : ''} · {fmtDate(plan.sentAt)}</small>
              </span>
              <span className={`tcp-chip tcp-chip--${st.tone}`}>{st.label}</span>
              <span className="tcp-card__chev">{Icon.chevronRight}</span>
            </button>

            {open && (
              <div className="tcp-card__body">
                {facts.length > 0 && (
                  <div className="tcp-facts">
                    {facts.map(([key, label, icon]) => (
                      <div key={key} className="tcp-fact">
                        <span>{Icon[icon]} {label}</span>
                        <b>{plan[key]}</b>
                      </div>
                    ))}
                  </div>
                )}
                {sections.map(([key, label, icon]) => (
                  <section key={key} className="tcp-block">
                    <h4>{Icon[icon]} {label}</h4>
                    <p>{plan[key]}</p>
                  </section>
                ))}
                <div className="tcp-card__foot">
                  {plan.status === 'approved'
                    ? <span className="tcp-done">{Icon.check} Aprobado el {fmtDate(plan.approvedAt)}</span>
                    : isLeader
                      ? <button type="button" className="tcp-btn" onClick={() => approve(plan)} disabled={approving === plan._id}>{Icon.check} Aprobar plan</button>
                      : <span className="tcp-muted">Solo el capitán puede aprobar el plan.</span>}
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

