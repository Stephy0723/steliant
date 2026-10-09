import crypto from 'node:crypto'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import {
  isUniversityGameAllowed,
  sanitizeGames,
  UNIVERSITY_ALLOWED_GAMES_LIST,
} from '../config/universityCatalog.js'
import {
  listCatalog,
  getCatalogItem,
  findCatalogItemByEmail,
} from '../services/universityCatalog.service.js'
import { UniversityCatalog } from '../models/UniversityCatalog.js'
import { calculateUniversityStandings, getUniversityPointsConfig } from '../services/universityStandings.js'
import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { UniversityApplication } from '../models/UniversityApplication.js'
import { UniversityMicrosoftPending } from '../models/UniversityMicrosoftPending.js'
import { sendNotif } from '../services/notifications.service.js'
import { createUniversityApplicationCodes } from '../services/codes.service.js'
import { config } from '../config/index.js'

// ─── Inline constants ────────────────────────────────────────────────────────

const ALLOWED_ACADEMIC_LEVELS = new Set(['Tecnico', 'Grado', 'Postgrado', 'Maestria', 'Doctorado'])

// Evita que alguien "salte" de universidad en universidad para colarse en
// distintos equipos exclusivos -- ver unlinkUniversityVerification.
const UNIVERSITY_REVERIFY_COOLDOWN_DAYS = 30

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'live.com', 'aol.com', 'protonmail.com', 'mail.com', 'yahoo.es',
  'hotmail.es', 'msn.com', 'me.com', 'googlemail.com',
])

const getEmailDomain = (email = '') =>
  String(email || '').trim().toLowerCase().split('@').pop() || ''

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalize = (value, max = 120) => String(value || '').trim().slice(0, max)
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
const formatDomains = (domains = []) => domains.join(', ')

// ─── Microsoft OAuth helpers ──────────────────────────────────────────────────

const isMicrosoftConfigured = () =>
  Boolean(config.microsoft.clientId && config.microsoft.clientSecret && config.microsoft.redirectUri)

const buildMicrosoftAuthorizeUrl = (state) => {
  const params = new URLSearchParams({
    client_id:     config.microsoft.clientId,
    response_type: 'code',
    redirect_uri:  config.microsoft.redirectUri,
    response_mode: 'query',
    scope:         'openid profile email User.Read',
    prompt:        'select_account',
    state,
  })
  return `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/authorize?${params.toString()}`
}

const buildMicrosoftTokenEndpoint = () =>
  `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/token`

const decodeJwtPayload = (token = '') => {
  try {
    const payload = String(token).split('.')[1]
    if (!payload) return {}
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch (_) {
    return {}
  }
}

const parseMicrosoftError = (error, fallback = 'No se pudo completar la verificación universitaria con Microsoft.') => {
  const raw =
    error?.response?.data?.error_description ||
    error?.response?.data?.error?.message    ||
    error?.response?.data?.message           ||
    error?.message || fallback
  return normalize(String(raw || fallback).replace(/\+/g, ' ').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' '), 220) || fallback
}

const normalizeMicrosoftIdentity = (value = {}) => ({
  id:          normalize(value.userId      || value.id          || '', 120),
  tenantId:    normalize(value.tenantId    || '', 80),
  email:       normalize(value.email       || '', 160).toLowerCase(),
  displayName: normalize(value.displayName || '', 160),
})

const buildMicrosoftConnectionPayload = (user) => ({
  verified:     Boolean(user?.microsoft?.verified),
  tenantId:     user?.microsoft?.tenantId    || '',
  userId:       user?.microsoft?.id          || '',
  email:        user?.microsoft?.email       || '',
  displayName:  user?.microsoft?.displayName || '',
})

const getFrontendUniversityRedirect = (status, message = '') => {
  const params = new URLSearchParams()
  params.set('universityMs', status)
  if (message) params.set('message', message)
  return `${config.clientOrigin.replace(/\/+$/, '')}/universidad?${params.toString()}`
}

// ─── University snapshot builder ─────────────────────────────────────────────

const buildUniversitySnapshot = ({
  universityId, universityTag, universityName, region, city, campus,
  studentId, program, academicLevel, admissionYear = null, institutionalEmail, verificationSource,
  tenantId = '', status, rejectReason = '', reviewedBy = null,
  appliedAt = null, reviewedAt = null, verifiedAt = null,
}) => ({
  universityId, universityTag, universityName, region, city, campus,
  studentId, program, academicLevel, admissionYear, institutionalEmail, verificationSource,
  tenantId,
  verificationStatus: status,
  verified:           status === 'verified',
  appliedAt, verifiedAt, reviewedAt, reviewedBy, rejectReason,
})

const STATUS_UNLINKED = {
  universityId: '', universityTag: '', universityName: '',
  region: '', city: '', campus: '',
  studentId: '', program: '', academicLevel: '', admissionYear: null,
  institutionalEmail: '', verificationSource: 'none', tenantId: '',
  verificationStatus: 'unlinked', verified: false,
  appliedAt: null, verifiedAt: null, reviewedAt: null, reviewedBy: null, rejectReason: '',
}

// ─── Decision + notification ──────────────────────────────────────────────────

const finalizeApplicationDecision = async ({
  application, user, decision, rejectReason = '', reviewedBy = null, notificationSource = 'University',
}) => {
  const now = new Date()
  const applicationStatus  = decision === 'revoked' ? 'pending' : decision
  const verificationStatus = decision === 'approved' ? 'verified' : decision === 'rejected' ? 'rejected' : 'pending'

  const title = {
    approved: 'Verificación universitaria aprobada',
    rejected: 'Verificación universitaria rechazada',
    revoked:  'Verificación universitaria retirada',
  }[decision] || 'Actualización universitaria'

  const message = decision === 'approved'
    ? `Tu cuenta fue verificada para ${application.universityName}.`
    : decision === 'rejected'
      ? `Tu postulación para ${application.universityName} fue rechazada. ${rejectReason}`.trim()
      : `La verificación de tu cuenta para ${application.universityName} fue retirada. ${rejectReason}`.trim()

  application.status       = applicationStatus
  application.rejectReason = decision === 'approved' ? '' : rejectReason
  application.reviewedAt   = now
  application.reviewedBy   = reviewedBy || null
  await application.save()

  user.university = buildUniversitySnapshot({
    universityId:       application.universityId,
    universityTag:      application.universityTag,
    universityName:     application.universityName,
    region:             application.region,
    city:               application.city,
    campus:             application.campus,
    studentId:          application.studentId,
    program:            application.program,
    academicLevel:      application.academicLevel,
    admissionYear:      application.admissionYear ?? null,
    institutionalEmail: application.institutionalEmail,
    verificationSource: application.verificationSource,
    tenantId:           application.microsoft?.tenantId || '',
    status:             verificationStatus,
    rejectReason:       application.rejectReason,
    reviewedBy,
    appliedAt:  application.submittedAt,
    reviewedAt: now,
    verifiedAt: decision === 'approved' ? now : null,
  })
  await user.save()

  await sendNotif(application.user, {
    type:    'university',
    title,
    message,
    link:    '/universidad',
    meta:    {
      universityId:   application.universityId,
      universityName: application.universityName,
      decision,
      source:         notificationSource,
    },
  })

  return application
}

// ─── Catalog helpers ──────────────────────────────────────────────────────────

// Tarjeta de equipo para el perfil de universidad: lo que la pagina necesita
// para pintar escudo/roster sin pedir /teams/:id por cada equipo. El roster
// respeta showRoster/publicProfile igual que getTeamById (solo con miembros
// poblados; el listado del catalogo no los pide).
const TEAM_CARD_FIELDS = 'name tag color logo publicCode slogan game level category country gender maxMembers members leader rosterSlots showRoster publicProfile university createdAt'

const mapTeamCard = (team = {}) => {
  const members = Array.isArray(team?.members) ? team.members : []
  const showRoster = team?.showRoster !== false && team?.publicProfile !== false
  const leaderId = String(team?.leader?._id || team?.leader || '')
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? Object.values(team.rosterSlots) : []
  const roster = showRoster
    ? members.filter((m) => m && typeof m === 'object' && m.nick).map((m) => {
      const slot = slots.find((sl) => sl && (String(sl.userId || '') === String(m._id) || String(sl.nick || '').toLowerCase() === String(m.nick).toLowerCase()))
      return {
        nick:   m.nick,
        avatar: slot?.avatar || m.avatar || '',
        role:   String(m._id) === leaderId ? 'Lider' : (normalize(slot?.role, 40) || 'Jugador'),
      }
    })
    : []
  return {
    id:          String(team?._id || ''),
    name:        normalize(team?.name    || '', 120) || 'Equipo universitario',
    tag:         normalize(team?.tag || '', 10),
    color:       team?.color || '',
    logo:        team?.logo || '',
    publicCode:  team?.publicCode || '',
    slogan:      normalize(team?.slogan || '', 120),
    game:        normalize(team?.game    || '', 80)  || 'Juego',
    country:     team?.country || '',
    gender:      team?.gender || '',
    createdAt:   team?.createdAt || null,
    // Antes `members` devolvia maxMembers (el cupo), no cuantos hay.
    members:     members.length,
    memberCount: members.length,
    maxMembers:  Number(team?.maxMembers) > 0 ? Number(team.maxMembers) : null,
    roster,
    rank: normalize(team?.level || team?.category || 'Universitario', 60),
  }
}

const UNIVERSITY_TOURNAMENT_FIELDS = 'title publicId game date format status winner registrations bracketDoc eligibility updatedAt'

// Mismo orden que /university/standings: puntos y luego tag.
const rankCatalog = (catalog, standingMap, verifiedStudentMap) => catalog
  .map((item) => mergeStats(item, standingMap, [], verifiedStudentMap))
  .sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return String(a.tag || '').localeCompare(String(b.tag || ''))
  })

const buildStandingMap = (standings = []) =>
  new Map(standings.map((s) => [String(s?.universityId || '').trim().toLowerCase(), s]))

const buildVerifiedStudentMap = (users = []) =>
  (Array.isArray(users) ? users : []).reduce((acc, u) => {
    const id = normalize(u?.university?.universityId || '', 60).toLowerCase()
    if (!id) return acc
    acc.set(id, (acc.get(id) || 0) + 1)
    return acc
  }, new Map())

const mergeStats = (item, standingMap, teams, verifiedStudentMap) => {
  const s = standingMap.get(String(item?.id || '').trim().toLowerCase()) || null
  return {
    ...item,
    points:                Number(s?.points || 0),
    verifiedStudentsCount: Number(verifiedStudentMap.get(String(item?.id || '').trim().toLowerCase()) || 0),
    stats: {
      tournamentsPlayed: Number(s?.tournamentsPlayed || 0),
      matchWins:         Number(s?.matchWins         || 0),
      championships:     Number(s?.championships     || 0),
      finals:            Number(s?.finals            || 0),
      semifinals:        Number(s?.semifinals        || 0),
    },
    teams,
    activeTeamsCount: teams.length,
  }
}

// ─── Public catalog endpoints ─────────────────────────────────────────────────

export const listUniversityCatalog = async (req, res) => {
  try {
    const region  = normalize(req.query?.region || 'rd', 30).toLowerCase()
    const catalog = await listCatalog({ region })
    if (catalog.length === 0) return res.json([])

    if (!config.mongoEnabled) {
      return res.json(catalog.map((item) => mergeStats(item, new Map(), [], new Map())))
    }

    const [teams, finishedTournaments, verifiedStudents] = await Promise.all([
      Team.find({ 'university.isUniversityTeam': true, 'university.region': region })
        .select(TEAM_CARD_FIELDS)
        .sort({ createdAt: -1 })
        .lean(),
      Tournament.find({ status: 'finished', 'eligibility.universityOnly': true })
        .select(UNIVERSITY_TOURNAMENT_FIELDS)
        .lean(),
      User.find({ 'university.region': region, 'university.verificationStatus': 'verified' })
        .select('university.universityId')
        .lean(),
    ])

    const filteredTeams       = teams.filter((t) => isUniversityGameAllowed(t?.game))
    const standingMap         = buildStandingMap(calculateUniversityStandings(finishedTournaments.filter((t) => isUniversityGameAllowed(t?.game))))
    const verifiedStudentMap  = buildVerifiedStudentMap(verifiedStudents)
    const teamsByUni = filteredTeams.reduce((acc, team) => {
      const id = normalize(team?.university?.universityId || '', 60).toLowerCase()
      if (!id) return acc
      if (!acc[id]) acc[id] = []
      acc[id].push(mapTeamCard(team))
      return acc
    }, {})

    return res.json(catalog.map((item) => mergeStats(item, standingMap, teamsByUni[item.id] || [], verifiedStudentMap)))
  } catch (error) {
    console.error('listUniversityCatalog error:', error)
    return res.status(500).json({ message: 'No se pudo cargar el catálogo universitario.' })
  }
}

export const getUniversityCatalogDetail = async (req, res) => {
  try {
    const universityId = normalize(req.params?.id || '', 60).toLowerCase()
    const item         = await getCatalogItem(universityId)
    if (!item) return res.status(404).json({ message: 'Universidad no encontrada.' })

    if (!config.mongoEnabled) {
      return res.json(mergeStats(item, new Map(), [], new Map()))
    }

    const region = normalize(item.region || 'rd', 30).toLowerCase()
    // Todos los torneos universitarios (no solo los de esta universidad):
    // hace falta el ranking completo para saber su puesto (`rank`).
    const [teams, finishedTournaments, verifiedStudents, catalog] = await Promise.all([
      Team.find({ 'university.isUniversityTeam': true, 'university.universityId': universityId })
        .select(TEAM_CARD_FIELDS)
        .populate('members', 'nick avatar')
        .sort({ createdAt: -1 })
        .lean(),
      Tournament.find({ status: 'finished', 'eligibility.universityOnly': true })
        .select(UNIVERSITY_TOURNAMENT_FIELDS)
        .lean(),
      User.find({ 'university.region': region, 'university.verificationStatus': 'verified' })
        .select('university.universityId')
        .lean(),
      listCatalog({ region }),
    ])

    const filteredTeams      = teams.filter((t) => isUniversityGameAllowed(t?.game))
    const standingMap        = buildStandingMap(calculateUniversityStandings(finishedTournaments.filter((t) => isUniversityGameAllowed(t?.game))))
    const verifiedStudentMap = buildVerifiedStudentMap(verifiedStudents)
    const ranked             = rankCatalog(catalog, standingMap, verifiedStudentMap)
    const hasPoints          = ranked.some((u) => u.points > 0)
    const position           = ranked.findIndex((u) => String(u.id).toLowerCase() === universityId)

    return res.json({
      ...mergeStats(item, standingMap, filteredTeams.map(mapTeamCard), verifiedStudentMap),
      // Torneos universitarios terminados en que jugo, con su puesto (1-3 o
      // null): misma fuente que stats.championships/finals/semifinals.
      achievements: standingMap.get(universityId)?.achievements || [],
      rank:         hasPoints && position >= 0 ? position + 1 : null,
      rankTotal:    ranked.length,
    })
  } catch (error) {
    console.error('getUniversityCatalogDetail error:', error)
    return res.status(500).json({ message: 'No se pudo cargar la universidad.' })
  }
}

export const getUniversityStandings = async (_req, res) => {
  try {
    const catalog = await listCatalog({ region: 'rd' })

    if (!config.mongoEnabled) {
      const payload = catalog
        .map((item) => mergeStats(item, new Map(), [], new Map()))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          return String(a.tag || '').localeCompare(String(b.tag || ''))
        })
      return res.json({ pointsConfig: getUniversityPointsConfig(), standings: payload })
    }

    const [finishedTournaments, verifiedStudents] = await Promise.all([
      Tournament.find({ status: 'finished', 'eligibility.universityOnly': true })
        .select(UNIVERSITY_TOURNAMENT_FIELDS)
        .lean(),
      User.find({ 'university.region': 'rd', 'university.verificationStatus': 'verified' })
        .select('university.universityId')
        .lean(),
    ])

    const standings          = calculateUniversityStandings(finishedTournaments.filter((t) => isUniversityGameAllowed(t?.game)))
    const payload            = rankCatalog(catalog, buildStandingMap(standings), buildVerifiedStudentMap(verifiedStudents))

    return res.json({ pointsConfig: getUniversityPointsConfig(), standings: payload })
  } catch (error) {
    console.error('getUniversityStandings error:', error)
    return res.status(500).json({ message: 'No se pudo cargar el ranking universitario.' })
  }
}

// ─── Application submit ───────────────────────────────────────────────────────

// ─── My status ───────────────────────────────────────────────────────────────

export const getMyUniversityStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('email microsoft university')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    const application = await UniversityApplication.findOne({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .select('universityId universityTag universityName region city campus studentId program academicLevel institutionalEmail verificationSource status rejectReason submittedAt reviewedAt reviewedBy microsoft')

    const pendingMs = await UniversityMicrosoftPending.findOne({ user: req.user._id, expiresAt: { $gt: new Date() } })
      .select('institutionalEmail universityId expiresAt')

    return res.json({
      university:          user.university        || STATUS_UNLINKED,
      application,
      // Ya inicio sesion con Microsoft y falta elegir campus/carrera/nivel.
      pendingMicrosoftVerification: pendingMs
        ? { email: pendingMs.institutionalEmail, universityId: pendingMs.universityId, expiresAt: pendingMs.expiresAt }
        : null,
      microsoftConnection: buildMicrosoftConnectionPayload(user),
      userEmail:           user.email             || '',
    })
  } catch (error) {
    console.error('getMyUniversityStatus error:', error)
    return res.status(500).json({ message: 'No se pudo obtener el estado universitario.' })
  }
}

// ─── Verificación con Microsoft (cuenta institucional) ───────────────────────
// Única forma de vincular una universidad: el estudiante inicia sesión con la
// cuenta Microsoft 365 que le dio su universidad (eso prueba que el correo es
// suyo, sin códigos), la universidad se detecta por el dominio de ESE correo,
// elige campus/carrera/nivel y queda verificado al instante.

const MS_PENDING_TTL_MS = 30 * 60 * 1000

const findEmailOwner = (institutionalEmail, userId) =>
  User.findOne({
    _id: { $ne: userId },
    'university.institutionalEmail': institutionalEmail,
    'university.verificationStatus': { $in: ['pending', 'verified'] },
  }).select('_id')

// Mismas precondiciones al iniciar y al confirmar.
const verificationBlocker = async (user) => {
  if (user.university?.verified) {
    return { status: 409, message: 'Tu cuenta ya está verificada con una universidad. Cierra esa sesión universitaria primero.' }
  }
  if (user.university?.unlinkedAt) {
    const readyAt = new Date(user.university.unlinkedAt.getTime() + UNIVERSITY_REVERIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
    if (Date.now() < readyAt.getTime()) {
      return {
        status: 429,
        message: `Te desvinculaste de una universidad recientemente. Puedes verificarte de nuevo a partir del ${readyAt.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
      }
    }
  }
  return null
}

/** GET /university/microsoft/start — URL de inicio de sesión de Microsoft. */
export const startUniversityMicrosoftConnect = async (req, res) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ message: 'La verificación con Microsoft no está configurada todavía.' })
    }
    const user = await User.findById(req.user._id).select('university')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
    const blocker = await verificationBlocker(user)
    if (blocker) return res.status(blocker.status).json({ message: blocker.message })

    const state = jwt.sign(
      { purpose: 'university-microsoft-connect', userId: String(req.user._id) },
      config.jwt.secret,
      { expiresIn: '10m' }
    )
    return res.json({ authorizationUrl: buildMicrosoftAuthorizeUrl(state) })
  } catch (error) {
    console.error('startUniversityMicrosoftConnect error:', error)
    return res.status(500).json({ message: 'No se pudo iniciar la verificación con Microsoft.' })
  }
}

// Intercambia el code de Microsoft por la identidad real (correo + tenant).
export async function fetchMicrosoftIdentity(code) {
  const tokenRes = await axios.post(
    buildMicrosoftTokenEndpoint(),
    new URLSearchParams({
      client_id:     config.microsoft.clientId,
      client_secret: config.microsoft.clientSecret,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  config.microsoft.redirectUri,
      scope:         'openid profile email User.Read',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const tokenData = tokenRes.data || {}
  const idClaims  = decodeJwtPayload(tokenData.id_token)
  const graphRes  = await axios.get(
    'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  )
  const graphUser = graphRes.data || {}
  return normalizeMicrosoftIdentity({
    id:          graphUser?.id || idClaims?.oid || '',
    tenantId:    idClaims?.tid || '',
    email:       graphUser?.mail || graphUser?.userPrincipalName || idClaims?.preferred_username || idClaims?.email || '',
    displayName: graphUser?.displayName || idClaims?.name || '',
  })
}

/**
 * Valida la identidad que devolvio Microsoft y deja el paso intermedio listo.
 * Devuelve { ok, status, message } -- separado del callback HTTP para poder
 * probarlo sin hablar con Microsoft.
 */
export async function registerMicrosoftIdentity(userId, msIdentity) {
  if (!msIdentity?.email || !msIdentity?.tenantId) {
    return { ok: false, message: 'No se pudo leer una cuenta institucional válida desde Microsoft.' }
  }
  if (PUBLIC_EMAIL_DOMAINS.has(getEmailDomain(msIdentity.email))) {
    return { ok: false, message: 'Inicia sesión con la cuenta Microsoft que te dio tu universidad, no con una cuenta personal.' }
  }
  const user = await User.findById(userId).select('university')
  if (!user) return { ok: false, message: 'Usuario no encontrado.' }
  const blocker = await verificationBlocker(user)
  if (blocker) return { ok: false, message: blocker.message }

  const catalogItem = await findCatalogItemByEmail(msIdentity.email)
  if (!catalogItem) {
    return { ok: false, message: `La cuenta ${msIdentity.email} no pertenece a ninguna universidad del catálogo.` }
  }
  if (await findEmailOwner(msIdentity.email, user._id)) {
    return { ok: false, message: 'Esa cuenta institucional ya está vinculada a otra cuenta de GlitchGang.' }
  }

  await UniversityMicrosoftPending.findOneAndUpdate(
    { user: user._id },
    {
      institutionalEmail: msIdentity.email,
      universityId:       catalogItem.id,
      microsoft:          msIdentity,
      expiresAt:          new Date(Date.now() + MS_PENDING_TTL_MS),
    },
    { upsert: true, setDefaultsOnInsert: true }
  )
  return { ok: true, universityName: catalogItem.name }
}

/** GET /university/microsoft/callback — Microsoft vuelve aqui tras iniciar sesion. */
export const completeUniversityMicrosoftConnect = async (req, res) => {
  const redirectFrontend = (status, message) => res.redirect(getFrontendUniversityRedirect(status, message))
  try {
    if (!isMicrosoftConfigured()) return redirectFrontend('error', 'La verificación con Microsoft no está configurada.')
    if (req.query?.error) {
      return redirectFrontend('error', normalize(req.query?.error_description || req.query?.error, 220) || 'Cancelaste el inicio de sesión con Microsoft.')
    }
    const code  = normalize(req.query?.code  || '', 4000)
    const state = normalize(req.query?.state || '', 4000)
    if (!code || !state) return redirectFrontend('error', 'Respuesta inválida de Microsoft.')

    let statePayload
    try {
      statePayload = jwt.verify(state, config.jwt.secret)
    } catch (_) {
      return redirectFrontend('error', 'La verificación expiró. Inténtalo de nuevo.')
    }
    if (statePayload?.purpose !== 'university-microsoft-connect' || !statePayload?.userId) {
      return redirectFrontend('error', 'La sesión de verificación no es válida.')
    }

    const msIdentity = await fetchMicrosoftIdentity(code)
    const result = await registerMicrosoftIdentity(statePayload.userId, msIdentity)
    if (!result.ok) return redirectFrontend('error', result.message)
    return redirectFrontend('pick', `Cuenta de ${result.universityName} comprobada. Elige tu campus y carrera para terminar.`)
  } catch (error) {
    console.error('completeUniversityMicrosoftConnect error:', error?.response?.data || error)
    return redirectFrontend('error', parseMicrosoftError(error))
  }
}

/** POST /university/microsoft/confirm — elige campus/carrera/nivel y queda verificado. */
export const confirmUniversityMicrosoftVerification = async (req, res) => {
  try {
    const campus           = normalize(req.body?.campus || '', 100)
    const program          = normalize(req.body?.program || '', 120)
    const academicLevel    = normalize(req.body?.academicLevel || '', 40)
    const admissionYearRaw = req.body?.admissionYear
    const admissionYear    = admissionYearRaw ? Number(admissionYearRaw) : null
    const currentYear      = new Date().getFullYear()

    const pending = await UniversityMicrosoftPending.findOne({ user: req.user._id })
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'La verificación con Microsoft expiró. Vuelve a iniciar sesión con tu cuenta de la universidad.' })
    }

    const user = await User.findById(req.user._id).select('nick email playerCode university team microsoft')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
    const blocker = await verificationBlocker(user)
    if (blocker) {
      await pending.deleteOne()
      return res.status(blocker.status).json({ message: blocker.message })
    }
    if (await findEmailOwner(pending.institutionalEmail, user._id)) {
      await pending.deleteOne()
      return res.status(409).json({ message: 'Esa cuenta institucional ya está vinculada a otra cuenta de GlitchGang.' })
    }

    const catalogItem = await getCatalogItem(pending.universityId)
    if (!catalogItem) return res.status(400).json({ message: 'La universidad ya no está en el catálogo.' })
    if (!(catalogItem.campuses || []).includes(campus)) {
      return res.status(400).json({ message: 'Selecciona un campus válido de tu universidad.' })
    }
    if (!(catalogItem.programs || []).includes(program)) {
      return res.status(400).json({ message: 'Selecciona una carrera válida de tu universidad.' })
    }
    if (!ALLOWED_ACADEMIC_LEVELS.has(academicLevel)) {
      return res.status(400).json({ message: 'El nivel académico seleccionado no es válido.' })
    }
    if (admissionYear !== null && (!Number.isInteger(admissionYear) || admissionYear < 1980 || admissionYear > currentYear + 1)) {
      return res.status(400).json({ message: 'El año de ingreso no es válido.' })
    }

    let application = await UniversityApplication.findOne({ user: user._id })
    if (!application) {
      const codes = await createUniversityApplicationCodes(catalogItem.publicCode || catalogItem.tag, user.playerCode, catalogItem.id)
      application = new UniversityApplication({ user: user._id, publicCode: codes.publicCode, internalCode: codes.internalCode })
    }
    const msIdentity = normalizeMicrosoftIdentity(pending.microsoft || {})
    application.set({
      universityId:       catalogItem.id,
      universityTag:      catalogItem.tag,
      universityName:     catalogItem.name,
      region:             catalogItem.region || 'rd',
      city:               catalogItem.city || '',
      campus,
      program,
      academicLevel,
      admissionYear,
      studentId:          undefined,
      institutionalEmail: pending.institutionalEmail,
      verificationSource: 'microsoft',
      microsoft:          msIdentity,
      submittedAt:        new Date(),
    })
    user.microsoft = { ...msIdentity, verified: true, linkedAt: new Date() }

    await finalizeApplicationDecision({
      application, user, decision: 'approved', reviewedBy: null, notificationSource: 'Microsoft',
    })
    await pending.deleteOne()

    return res.json({
      message: `¡Listo! Tu cuenta quedó verificada con ${catalogItem.name}.`,
      university: user.university,
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Esa cuenta institucional ya está vinculada a otra cuenta de GlitchGang.' })
    }
    console.error('confirmUniversityMicrosoftVerification error:', error)
    return res.status(500).json({ message: 'No se pudo completar la verificación.' })
  }
}

export const getUniversityMicrosoftStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('microsoft university')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    const universityId      = normalize(user.university?.universityId || '', 60).toLowerCase()
    const catalogItem       = universityId ? await getCatalogItem(universityId) : null
    const institutionalEmail = normalize(user.university?.institutionalEmail || '', 160).toLowerCase()
    const msEmail            = normalize(user.microsoft?.email               || '', 160).toLowerCase()

    return res.json({
      microsoftConnection:        buildMicrosoftConnectionPayload(user),
      universityId,
      universityVerificationStatus: user.university?.verificationStatus || 'unlinked',
      institutionalEmail,
      exactEmailMatch:            Boolean(institutionalEmail && msEmail && institutionalEmail === msEmail),
      allowedDomains:             catalogItem?.allowedDomains || [],
    })
  } catch (error) {
    console.error('getUniversityMicrosoftStatus error:', error)
    return res.status(500).json({ message: 'No se pudo obtener el estado de la conexión Microsoft.' })
  }
}

export const unlinkUniversityMicrosoftConnection = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('microsoft university')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    if (user.university?.verified && user.university?.verificationSource === 'microsoft') {
      return res.status(409).json({
        message: 'Tu universidad está verificada con esta cuenta de Microsoft. Para desvincularte usa "Cerrar sesión universitaria".',
      })
    }

    const application    = await UniversityApplication.findOne({ user: req.user._id }).sort({ updatedAt: -1 })
    const hadConnection  = Boolean(user.microsoft?.email || user.microsoft?.verified)

    user.microsoft = { id: '', tenantId: '', email: '', displayName: '', verified: false, linkedAt: null }

    if (application) {
      application.microsoft = { id: '', tenantId: '', email: '', displayName: '' }
      if (application.verificationSource === 'microsoft') application.verificationSource = 'manual'
      await application.save()
    }

    if (user.university && !user.university.verified) {
      user.university.tenantId = ''
      if (user.university.verificationSource === 'microsoft') user.university.verificationSource = 'manual'
    }

    await user.save()

    if (hadConnection) {
      await sendNotif(req.user._id, {
        type:    'university',
        title:   'Cuenta universitaria desconectada',
        message: 'Tu cuenta Microsoft/Entra fue desconectada. Si necesitas volver a verificarte, conecta nuevamente tu cuenta institucional.',
        link:    '/universidad',
        meta:    { action: 'microsoft_unlinked' },
      })
    }

    return res.json({
      message:                    hadConnection ? 'Cuenta universitaria Microsoft/Entra desconectada.' : 'No había una cuenta universitaria conectada.',
      microsoftConnection:        buildMicrosoftConnectionPayload(user),
      universityVerificationStatus: user.university?.verificationStatus || 'unlinked',
    })
  } catch (error) {
    console.error('unlinkUniversityMicrosoftConnection error:', error)
    return res.status(500).json({ message: 'No se pudo desconectar la cuenta universitaria.' })
  }
}

// Saca al usuario de los equipos oficiales de su universidad: transfiere el
// liderazgo al siguiente miembro o disuelve el equipo si queda vacío. Son
// VARIOS desde que un estudiante puede estar en un equipo por juego (el de LoL
// y el de Valorant de su universidad); antes se buscaba uno solo y el resto
// le quedaba sin estar verificado. Devuelve los nombres separados por coma, o null.
const removeFromUniversityTeam = async (user) => {
  const universityId   = user.university?.universityId || ''
  const universityName = user.university?.universityName || 'tu universidad'
  if (!universityId) return null

  const teams = await Team.find({
    'university.isUniversityTeam': true,
    'university.universityId': universityId,
    $or: [{ leader: user._id }, { members: user._id }],
  })
  if (!teams.length) return null

  for (const team of teams) {
    const isLeader = String(team.leader) === String(user._id)
    const otherMembers = (team.members || []).filter(memberId => String(memberId) !== String(user._id))
    // Su puesto del roster tambien se libera (antes quedaba con sus datos).
    const remainingSlots = team.rosterSlots && typeof team.rosterSlots === 'object'
      ? Object.fromEntries(Object.entries(team.rosterSlots).filter(([, slot]) => String(slot?.userId || '') !== String(user._id)))
      : team.rosterSlots

    if (isLeader && otherMembers.length > 0) {
      const newLeaderId = otherMembers[0]
      await Team.updateOne({ _id: team._id }, { $set: { leader: newLeaderId, rosterSlots: remainingSlots }, $pull: { members: user._id } })
      await sendNotif(newLeaderId, {
        type:    'university',
        title:   'Ahora eres líder del equipo',
        message: `${team.name} se quedó sin líder porque un miembro se desvinculó de ${universityName} -- el liderazgo pasó a ti.`,
        link:    '/mi-equipo',
        meta:    { kind: 'leader_transfer', teamId: String(team._id), teamName: team.name || '', teamLogo: team.logo || '', universityName: universityName || '' },
      })
    } else if (isLeader) {
      await Team.deleteOne({ _id: team._id })
    } else {
      await Team.updateOne({ _id: team._id }, { $set: { rosterSlots: remainingSlots }, $pull: { members: user._id } })
    }
  }

  // Puede seguir en equipos normales: User.team apunta a uno de esos.
  const stillIn = await Team.findOne({ members: user._id }).select('_id').lean()
  user.team = stillIn?._id || null
  return teams.map(team => team.name).join(', ')
}

// DELETE /university/me — el propio usuario cierra sesión de su universidad
// (verificada o pendiente). A diferencia de unlinkUniversityMicrosoftConnection
// (que solo suelta la cuenta de Microsoft), esto resetea la verificación
// universitaria completa: si estaba en un equipo exclusivo de esa
// universidad ya no califica para seguir ahí, así que se lo saca del
// roster automáticamente (con aviso), y queda un cooldown antes de poder
// verificarse con otra universidad para evitar que alguien salte de
// universidad en universidad solo para colarse en distintos equipos.
export const unlinkUniversityVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('university team')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    const previousStatus = user.university?.verificationStatus || 'unlinked'
    if (previousStatus === 'unlinked' || previousStatus === 'rejected') {
      return res.status(400).json({ message: 'No tienes ninguna verificación universitaria activa.' })
    }

    const universityName = user.university?.universityName || 'tu universidad'
    const removedFromTeam = await removeFromUniversityTeam(user)

    user.university = { ...STATUS_UNLINKED, unlinkedAt: new Date() }
    await user.save()

    // Si tenía una postulación pendiente, no la dejamos viva en la cola del
    // admin -- ya no aplica, el usuario se retiró por su cuenta.
    await UniversityApplication.updateMany(
      { user: user._id, status: 'pending' },
      { $set: { status: 'rejected', rejectReason: 'Retirada por el usuario al desvincularse.', reviewedAt: new Date() } },
    )

    await sendNotif(user._id, {
      type:    'university',
      title:   'Universidad desvinculada',
      message: removedFromTeam
        ? `Cerraste tu verificación con ${universityName}. También se te removió de ${removedFromTeam} porque ya no calificas para ese equipo. Puedes verificarte con otra universidad en ${UNIVERSITY_REVERIFY_COOLDOWN_DAYS} días.`
        : `Cerraste tu verificación con ${universityName}. Puedes verificarte con otra universidad en ${UNIVERSITY_REVERIFY_COOLDOWN_DAYS} días.`,
      link: '/universidad',
      meta: { action: 'university_unlinked', removedFromTeam },
    })

    return res.json({
      message: 'Verificación universitaria desvinculada.',
      university: user.university,
      removedFromTeam,
    })
  } catch (error) {
    console.error('unlinkUniversityVerification error:', error)
    return res.status(500).json({ message: 'No se pudo desvincular la verificación universitaria.' })
  }
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

export const listUniversityApplications = async (req, res) => {
  try {
    const status = normalize(req.query?.status || '', 20).toLowerCase()
    const region = normalize(req.query?.region || '', 30).toLowerCase()
    const filter = {}
    if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status
    if (region) filter.region = region

    const items = await UniversityApplication.find(filter)
      .sort({ createdAt: -1 })
      .populate('user',       'nick email avatar')
      .populate('reviewedBy', 'nick email')

    return res.json(items)
  } catch (error) {
    console.error('listUniversityApplications error:', error)
    return res.status(500).json({ message: 'No se pudo obtener la cola universitaria.' })
  }
}

// ─── Admin: desvincular ───────────────────────────────────────────────────────
// La verificación es solo por correo institucional; el admin solo puede
// desvincular (casos de abuso o correo que ya no pertenece al estudiante).

export const adminUnlinkUniversity = async (req, res) => {
  try {
    const reason = normalize(req.body?.reason || '', 220)
    const user = await User.findById(req.params.userId).select('nick university team')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })

    const previousStatus = user.university?.verificationStatus || 'unlinked'
    if (previousStatus === 'unlinked') {
      return res.status(400).json({ message: 'Ese usuario no tiene universidad vinculada.' })
    }

    const universityName  = user.university?.universityName || 'su universidad'
    const removedFromTeam = await removeFromUniversityTeam(user)

    user.university = { ...STATUS_UNLINKED }
    await user.save()

    await UniversityApplication.updateMany(
      { user: user._id, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'rejected', rejectReason: reason || 'Desvinculado por un administrador.', reviewedAt: new Date(), reviewedBy: req.user._id } },
    )

    await sendNotif(user._id, {
      type:    'university',
      title:   'Universidad desvinculada',
      message: [
        `Un administrador desvinculó tu cuenta de ${universityName}.`,
        removedFromTeam ? `También saliste de ${removedFromTeam}.` : '',
        reason ? `Motivo: ${reason}` : '',
      ].filter(Boolean).join(' '),
      link: '/universidad',
      meta: { action: 'university_unlinked_by_admin', removedFromTeam },
    })

    return res.json({ message: `${user.nick} fue desvinculado de ${universityName}.`, removedFromTeam })
  } catch (error) {
    console.error('adminUnlinkUniversity error:', error)
    return res.status(500).json({ message: 'No se pudo desvincular la universidad.' })
  }
}

// ─── Admin: catálogo de universidades (crear/editar sin tocar código) ─────────

const SLUG_REGEX      = /^[a-z0-9][a-z0-9-]{1,29}$/
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const DOMAIN_REGEX    = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

const cleanList = (value, max) => Array.from(new Set(
  (Array.isArray(value) ? value : []).map((v) => normalize(v, max)).filter(Boolean)
))

function validateUniversityPayload(body = {}, { partial = false } = {}) {
  const errors = []
  const out = {}
  const has = (key) => !partial || body[key] !== undefined

  if (has('tag'))  { out.tag  = normalize(body.tag, 20);   if (!out.tag)  errors.push('La sigla es obligatoria.') }
  if (has('name')) { out.name = normalize(body.name, 160); if (!out.name) errors.push('El nombre es obligatorio.') }
  if (has('city')) out.city = normalize(body.city, 80)
  if (has('founded')) {
    const raw = body.founded
    const founded = (raw === null || raw === '' || raw === undefined) ? null : Number(raw)
    if (founded !== null && (!Number.isInteger(founded) || founded < 1500 || founded > new Date().getFullYear())) {
      errors.push('El año de fundación no es válido.')
    }
    out.founded = founded
  }
  if (has('color')) {
    const color = normalize(body.color, 7)
    if (color && !HEX_COLOR_REGEX.test(color)) errors.push('El color debe ser un hex válido, ej. #002D72.')
    out.color = color || '#333333'
  }
  if (has('logo'))     out.logo = normalize(body.logo, 500)
  if (has('bio'))      out.bio = normalize(body.bio, 600)
  if (has('verified')) out.verified = Boolean(body.verified)
  if (has('games'))    out.games = sanitizeGames(body.games)
  if (has('programs')) out.programs = cleanList(body.programs, 160)
  if (has('campuses')) out.campuses = cleanList(body.campuses, 100)
  if (has('allowedDomains')) {
    out.allowedDomains = cleanList(body.allowedDomains, 120).map((d) => d.toLowerCase().replace(/^@/, ''))
    const bad = out.allowedDomains.find((d) => !DOMAIN_REGEX.test(d))
    if (bad) errors.push(`"${bad}" no es un dominio válido (ej. intec.edu.do).`)
  }
  return { errors, out }
}

// Un dominio no puede pertenecer a dos universidades: el correo decidiría mal.
async function findDomainConflict(domains = [], exceptId = '') {
  if (!domains.length) return null
  return UniversityCatalog.findOne({ id: { $exists: true, $ne: exceptId }, allowedDomains: { $in: domains } }).select('id tag allowedDomains').lean()
}

export function getUniversityGamesCatalog(_req, res) {
  res.json({ games: UNIVERSITY_ALLOWED_GAMES_LIST })
}

export const adminListUniversityCatalog = async (_req, res) => {
  try {
    const items = await listCatalog({ region: '', includeInactive: true })
    const counts = await User.aggregate([
      { $match: { 'university.verificationStatus': 'verified' } },
      { $group: { _id: '$university.universityId', count: { $sum: 1 } } },
    ])
    const byId = new Map(counts.map((c) => [c._id, c.count]))
    return res.json(items.map((u) => ({ ...u, verifiedStudentsCount: byId.get(u.id) || 0 })))
  } catch (error) {
    console.error('adminListUniversityCatalog error:', error)
    return res.status(500).json({ message: 'No se pudo cargar el catálogo.' })
  }
}

export const createUniversityCatalogEntry = async (req, res) => {
  try {
    const id = normalize(req.body?.id, 30).toLowerCase().replace(/\s+/g, '-')
    if (!SLUG_REGEX.test(id)) {
      return res.status(400).json({ message: 'El ID debe ir en minúsculas, 2-30 caracteres (a-z, 0-9, guiones). Ej: "intec".' })
    }
    const { errors, out } = validateUniversityPayload(req.body || {})
    if (errors.length) return res.status(400).json({ message: errors[0] })
    if (!out.campuses.length && out.city) out.campuses = [out.city]

    if (await getCatalogItem(id, { includeInactive: true })) {
      return res.status(409).json({ message: 'Ya existe una universidad con ese ID.' })
    }
    const conflict = await findDomainConflict(out.allowedDomains)
    if (conflict) return res.status(409).json({ message: `Ese dominio ya pertenece a ${conflict.tag}.` })

    const created = await UniversityCatalog.create({
      id, region: 'rd', active: true, ...out, createdBy: req.user._id, updatedBy: req.user._id,
    })
    return res.status(201).json(created)
  } catch (error) {
    console.error('createUniversityCatalogEntry error:', error)
    return res.status(500).json({ message: 'No se pudo crear la universidad.' })
  }
}

export const updateUniversityCatalogEntry = async (req, res) => {
  try {
    const id = normalize(req.params?.id, 30).toLowerCase()
    const { errors, out } = validateUniversityPayload(req.body || {}, { partial: true })
    if (errors.length) return res.status(400).json({ message: errors[0] })
    if (out.allowedDomains) {
      const conflict = await findDomainConflict(out.allowedDomains, id)
      if (conflict) return res.status(409).json({ message: `Ese dominio ya pertenece a ${conflict.tag}.` })
    }
    await getCatalogItem(id, { includeInactive: true }) // asegura la siembra
    const updated = await UniversityCatalog.findOneAndUpdate(
      { id },
      { $set: { ...out, updatedBy: req.user._id } },
      { new: true, runValidators: true },
    ).lean()
    if (!updated) return res.status(404).json({ message: 'Universidad no encontrada.' })
    return res.json(updated)
  } catch (error) {
    console.error('updateUniversityCatalogEntry error:', error)
    return res.status(500).json({ message: 'No se pudo guardar la universidad.' })
  }
}

// Desactivar oculta la universidad del catálogo público y de la verificación,
// sin borrar estudiantes, equipos ni historial.
export const setUniversityCatalogActive = async (req, res) => {
  try {
    const id = normalize(req.params?.id, 30).toLowerCase()
    await getCatalogItem(id, { includeInactive: true })
    const updated = await UniversityCatalog.findOneAndUpdate(
      { id },
      { $set: { active: Boolean(req.body?.active), updatedBy: req.user._id } },
      { new: true },
    ).lean()
    if (!updated) return res.status(404).json({ message: 'Universidad no encontrada.' })
    return res.json(updated)
  } catch (error) {
    console.error('setUniversityCatalogActive error:', error)
    return res.status(500).json({ message: 'No se pudo actualizar la universidad.' })
  }
}
