import mongoose from 'mongoose'
import { CoachWorkPlan } from '../models/CoachWorkPlan.js'
import { Team } from '../models/Team.js'
import { sendNotif } from '../services/notifications.service.js'
import { teamStaffSlotKey } from './team.controller.js'

// Planes de trabajo del coach (BACKEND-PENDIENTE #coach-hq-backend). El
// perfil profesional ya vive en PATCH /profile/me (role: 'coach') y los
// equipos en GET /teams/staff/mine?role=coach; esto cubre lo que faltaba.

const PLAN_FIELDS = ['teamName', 'game', 'roster', 'tournament', 'nextMatch', 'opponent', 'weekGoal', 'studyPlan', 'sessionPlan', 'homework', 'notes']
const VISIBLE_TO_TEAM = ['sent', 'seen', 'approved']

function isApprovedCoach(user) {
  return Boolean(user?.roleProfiles?.coach?.approvedAt)
    || String(user?.role || '').toLowerCase() === 'coach'
    || (user?.roles || []).map(r => String(r).toLowerCase()).includes('coach')
}

function pickPlanFields(body = {}) {
  const out = {}
  for (const key of PLAN_FIELDS) if (body[key] !== undefined) out[key] = String(body[key] ?? '')
  return out
}

// Equipo donde `user` es coach de verdad (puesto coach del roster, mismo
// criterio que /teams/staff/mine). null si no lo es.
async function coachedTeam(teamId, user) {
  if (!mongoose.isValidObjectId(teamId)) return null
  const team = await Team.findOne({ _id: teamId, $or: [{ leader: user._id }, { members: user._id }] })
    .select('name tag game leader members rosterSlots')
    .lean()
  return team && teamStaffSlotKey(team, user, 'coach') ? team : null
}

function teamView(plan) {
  const { notes, ...rest } = plan
  return rest
}

/** GET /api/coach/work-plans?teamId=&status= -- mis planes (sin archivados salvo que se pidan). */
export async function listMyWorkPlans(req, res, next) {
  try {
    const filter = { coach: req.user._id }
    const status = String(req.query.status || '').trim()
    filter.status = status ? status : { $ne: 'archived' }
    if (req.query.teamId) {
      if (!mongoose.isValidObjectId(req.query.teamId)) return res.json({ plans: [] })
      filter.team = req.query.teamId
    }
    const plans = await CoachWorkPlan.find(filter).sort({ updatedAt: -1 }).limit(100).lean()
    res.json({ plans })
  } catch (err) { next(err) }
}

/** POST /api/coach/work-plans -- nuevo borrador. */
export async function createWorkPlan(req, res, next) {
  try {
    if (!isApprovedCoach(req.user)) return res.status(403).json({ message: 'Necesitas el rol de coach aprobado.' })
    const fields = pickPlanFields(req.body)
    let team = null
    if (req.body.teamId) {
      team = await coachedTeam(req.body.teamId, req.user)
      if (!team) return res.status(403).json({ message: 'No eres coach de ese equipo.' })
      fields.teamName = fields.teamName || team.name
      fields.game = fields.game || team.game || ''
    }
    const plan = await CoachWorkPlan.create({ ...fields, coach: req.user._id, team: team?._id || null })
    res.status(201).json({ plan })
  } catch (err) { next(err) }
}

/**
 * PATCH /api/coach/work-plans/:id -- editar, archivar (`status: 'archived'`)
 * o desarchivar (`status: 'draft'`). Cambiar el contenido de un plan ya
 * enviado lo devuelve a borrador: el capitan tiene que recibir la version nueva.
 */
export async function updateWorkPlan(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Plan no encontrado.' })
    const plan = await CoachWorkPlan.findOne({ _id: req.params.id, coach: req.user._id })
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado.' })

    if (req.body.teamId !== undefined) {
      if (!req.body.teamId) plan.team = null
      else {
        const team = await coachedTeam(req.body.teamId, req.user)
        if (!team) return res.status(403).json({ message: 'No eres coach de ese equipo.' })
        plan.team = team._id
        if (!req.body.teamName && !plan.teamName) plan.teamName = team.name
      }
    }

    const fields = pickPlanFields(req.body)
    const contentChanged = Object.entries(fields).some(([key, value]) => key !== 'notes' && String(plan[key] || '') !== value.trim())
      || (req.body.teamId !== undefined && plan.isModified('team'))
    Object.assign(plan, fields)

    const status = String(req.body.status || '')
    if (status === 'archived') plan.status = 'archived'
    else if (status === 'draft' || (contentChanged && plan.status !== 'draft' && plan.status !== 'archived')) {
      plan.status = 'draft'
      plan.seenAt = null
      plan.approvedAt = null
    }
    await plan.save()
    res.json({ plan })
  } catch (err) { next(err) }
}

/** POST /api/coach/work-plans/:id/send -- se lo manda al capitan del equipo. */
export async function sendWorkPlan(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Plan no encontrado.' })
    const plan = await CoachWorkPlan.findOne({ _id: req.params.id, coach: req.user._id })
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado.' })
    if (plan.status === 'archived') return res.status(400).json({ message: 'Desarchiva el plan antes de enviarlo.' })
    if (!plan.team) return res.status(400).json({ message: 'Elige a cuál de tus equipos va el plan.' })
    const team = await coachedTeam(plan.team, req.user)
    if (!team) return res.status(403).json({ message: 'Ya no eres coach de ese equipo.' })
    if (!plan.weekGoal && !plan.studyPlan && !plan.sessionPlan) {
      return res.status(400).json({ message: 'Completa al menos el objetivo, el plan de estudio o la sesión.' })
    }

    plan.status = 'sent'
    plan.sentAt = new Date()
    plan.seenAt = null
    plan.approvedAt = null
    await plan.save()

    await sendNotif(team.leader, {
      type: 'coach_work_plan',
      title: 'Nuevo plan de trabajo',
      message: `${req.user.nick} te envió un plan de trabajo para ${team.name}.`,
      link: '/mi-equipo/planes',
      meta: { planId: String(plan._id), teamId: String(team._id), teamName: team.name, coachNick: req.user.nick, coachAvatar: req.user.avatar || '' },
    })
    res.json({ plan })
  } catch (err) { next(err) }
}

/**
 * GET /api/coach/work-plans/team/:teamId -- planes enviados a mi equipo
 * (lider y miembros; sin las notas internas). Si lo abre el lider, los
 * enviados pasan a "visto".
 */
export async function listTeamWorkPlans(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.teamId)) return res.status(404).json({ message: 'Team not found' })
    const team = await Team.findOne({ _id: req.params.teamId, $or: [{ leader: req.user._id }, { members: req.user._id }] })
      .select('leader').lean()
    if (!team) return res.status(404).json({ message: 'Team not found' })

    if (String(team.leader) === String(req.user._id)) {
      await CoachWorkPlan.updateMany({ team: team._id, status: 'sent' }, { $set: { status: 'seen', seenAt: new Date() } })
    }
    const plans = await CoachWorkPlan.find({ team: team._id, status: { $in: VISIBLE_TO_TEAM } })
      .sort({ sentAt: -1 })
      .limit(50)
      .populate('coach', 'nick avatar playerCode')
      .lean()
    res.json({ plans: plans.map(teamView) })
  } catch (err) { next(err) }
}

/** POST /api/coach/work-plans/:id/approve -- el capitan aprueba el plan. */
export async function approveWorkPlan(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Plan no encontrado.' })
    const plan = await CoachWorkPlan.findById(req.params.id)
    if (!plan || !VISIBLE_TO_TEAM.includes(plan.status)) return res.status(404).json({ message: 'Plan no encontrado.' })
    const team = await Team.findOne({ _id: plan.team, leader: req.user._id }).select('name').lean()
    if (!team) return res.status(403).json({ message: 'Solo el capitán del equipo puede aprobar el plan.' })
    if (plan.status !== 'approved') {
      plan.status = 'approved'
      plan.seenAt = plan.seenAt || new Date()
      plan.approvedAt = new Date()
      await plan.save()
      await sendNotif(plan.coach, {
        type: 'coach_work_plan_approved',
        title: 'Plan aprobado',
        message: `${team.name} aprobó tu plan de trabajo.`,
        link: '/coach/sesiones',
        meta: { planId: String(plan._id), teamId: String(team._id), teamName: team.name },
      })
    }
    res.json({ plan: teamView(plan.toObject()) })
  } catch (err) { next(err) }
}
