import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { providersStatus } from '../services/ai.service.js'
import { answerQuestion, draftAnnouncement } from '../services/tournamentAi.service.js'
import { Tournament } from '../models/Tournament.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Organization } from '../models/Organization.js'
import { config } from '../config/index.js'
import { createTeamForUser, joinTeamForUser } from './team.controller.js'
import { registerTeamForUser } from './tournament.controller.js'
import { getOrCreateReferralCode } from '../services/codes.service.js'
import { createSystemTicketRecord, priorityForPlan, mapSystemTicket } from '../services/systemTickets.service.js'

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function localPhoneCandidates(phone) {
  const normalized = onlyDigits(phone)
  if (!normalized) return []
  return [...new Set([
    normalized,
    normalized.slice(-10),
    normalized.slice(-9),
    `+${normalized}`,
  ].filter(Boolean))]
}

function hashWhatsappCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex')
}

async function resolveLinkedUser(discordId) {
  const id = String(discordId || '').trim()
  if (!id) return null
  return User.findOne({ 'discord.id': id })
}

async function resolveWhatsappUser(phone) {
  const normalized = onlyDigits(phone)
  if (!normalized) return null

  const phoneCandidates = localPhoneCandidates(normalized)
  const users = await User.find({
    $or: [
      { 'whatsapp.phone': normalized },
      { phoneNumber: { $in: phoneCandidates } },
      { 'social.whatsapp': { $in: phoneCandidates } },
    ],
  }).limit(25)

  return users.find((user) => {
    const mainPhone = `${onlyDigits(user.phoneCountryDial)}${onlyDigits(user.phoneNumber)}`
    const socialPhone = onlyDigits(user.social?.whatsapp)
    const linkedPhone = onlyDigits(user.whatsapp?.phone)
    return linkedPhone === normalized || mainPhone === normalized || socialPhone === normalized || onlyDigits(user.phoneNumber) === normalized.slice(-10)
  }) || null
}

function notLinked(res) {
  return res.status(404).json({
    error: 'not_linked',
    message: 'Esta cuenta de Discord no está vinculada a una cuenta de GlitchGang. Usa /vincular primero.',
  })
}

function whatsappNotRegistered(res) {
  return res.status(404).json({
    error: 'not_registered',
    message: 'Este numero de WhatsApp no esta registrado en GlitchGang.',
  })
}

/** GET /api/bots/ai/providers — estado de los proveedores de IA. */
export function getProviders(req, res) {
  const providers = providersStatus()
  const active = providers.filter(p => p.configured).map(p => p.name)
  res.json({ providers, active, anyConfigured: active.length > 0 })
}

/**
 * POST /api/bots/ai/ask — responde una duda anclada al torneo.
 * body: { question, tournament?, tournamentId?, history? }
 * Funciona sin DB si se pasa `tournament` inline.
 */
export async function askAi(req, res, next) {
  try {
    const { question, tournament: inline, tournamentId, history } = req.body || {}
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Falta "question".' })
    }
    let tournament = inline
    let knowledgeBase
    if (!tournament && tournamentId) {
      const doc = await Tournament.findById(tournamentId).lean()
      if (doc) { tournament = doc; knowledgeBase = doc.botConfig?.knowledgeBase || undefined }
    }
    const { text, provider } = await answerQuestion({ tournament, question, history, knowledgeBase })
    res.json({ answer: text, provider })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/bots/ai/draft — redacta un aviso.
 * body: { kind, details, channel, tournament?, tournamentId? }
 */
export async function draftAi(req, res, next) {
  try {
    const { kind, details, channel, tournament: inline, tournamentId } = req.body || {}
    let tournament = inline
    if (!tournament && tournamentId) {
      tournament = await Tournament.findById(tournamentId).lean()
    }
    const { text, provider } = await draftAnnouncement({ tournament, kind, details, channel })
    res.json({ message: text, provider })
  } catch (err) {
    next(err)
  }
}

/** GET /api/bots/tournaments/:id/config — config de bots de un torneo. */
export async function getBotConfig(req, res, next) {
  try {
    const t = await Tournament.findById(req.params.id).lean()
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado.' })
    res.json({ botConfig: t.botConfig })
  } catch (err) {
    next(err)
  }
}

/** PUT /api/bots/tournaments/:id/config — actualiza la config de bots. */
export async function updateBotConfig(req, res, next) {
  try {
    const t = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $set: { botConfig: req.body.botConfig } },
      { new: true, runValidators: true },
    ).lean()
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado.' })
    res.json({ botConfig: t.botConfig })
  } catch (err) {
    next(err)
  }
}

/** POST /api/bots/tournaments/:id/activate — enciende/apaga los bots. */
export async function activateBots(req, res, next) {
  try {
    const active = Boolean(req.body?.active ?? true)
    const t = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $set: { 'botConfig.active': active } },
      { new: true },
    ).lean()
    if (!t) return res.status(404).json({ error: 'Torneo no encontrado.' })
    res.json({ active: t.botConfig.active })
  } catch (err) {
    next(err)
  }
}

// ─── Vinculación de cuenta ────────────────────────────────────────────────

/**
 * POST /api/bots/link/start — inicia la vinculación Discord ⇄ GlitchGang.
 * body: { discordId, discordUsername }
 * Devuelve una URL de un solo uso (válida 10 min) que el bot le manda al
 * usuario; el frontend la confirma en /api/auth/discord/link/confirm.
 */
export async function linkStart(req, res, next) {
  try {
    const discordId = String(req.body?.discordId || '').trim()
    const discordUsername = String(req.body?.discordUsername || '').trim()
    if (!discordId) return res.status(400).json({ message: 'discordId es requerido' })

    const existing = await User.findOne({ 'discord.id': discordId }).select('playerCode nick')
    if (existing) {
      return res.json({ alreadyLinked: true, playerCode: existing.playerCode, nick: existing.nick })
    }

    const token = jwt.sign(
      { discordId, discordUsername, purpose: 'discord-link' },
      config.jwt.secret,
      { expiresIn: '10m' },
    )
    const url = `${config.clientOrigin}/conectar-discord?token=${encodeURIComponent(token)}`
    res.json({ url })
  } catch (err) { next(err) }
}

// ─── Perfil / equipo / torneos vía Discord ─────────────────────────────────

/** GET /api/bots/players/:discordId — perfil real del jugador vinculado. */
export async function getPlayerProfile(req, res, next) {
  try {
    const user = await resolveLinkedUser(req.params.discordId)
    if (!user) return notLinked(res)

    // Membresía es roster-based (Team.members), no el campo user.team (removido del modelo).
    const team = await Team.findOne({ members: user._id }).select('name tag publicCode teamInviteCode leader').lean()

    res.json({
      nick: user.nick,
      playerCode: user.playerCode,
      role: user.role,
      roles: user.roles,
      plan: user.plan,
      referralCode: user.referralCode || '',
      mainGame: user.gamerProfile?.mainGame || user.games?.[0] || '',
      games: user.games || [],
      team: team ? {
        name: team.name,
        tag: team.tag,
        publicCode: team.publicCode,
        isLeader: String(team.leader) === String(user._id),
        inviteCode: String(team.leader) === String(user._id) ? team.teamInviteCode : undefined,
      } : null,
    })
  } catch (err) { next(err) }
}

/** GET /api/bots/crm/users — usuarios reales de Mongo para el panel CRM. */
export async function listCrmUsers(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)))
    const users = await User.find({})
      .select('nick email playerCode firstName lastName discord createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    res.json({
      users: users.map(user => ({
        id: String(user._id),
        externalId: String(user._id),
        playerCode: user.playerCode || '',
        nick: user.nick || 'Jugador sin nombre',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        discord: {
          id: user.discord?.id || '',
          username: user.discord?.username || '',
        },
        source: {
          type: user.discord?.id ? 'discord-bot' : 'glitchgang-web',
          channel: user.discord?.id ? 'discord-bot' : 'glitchgang-web',
        },
        registeredAt: user.createdAt || '',
        syncedAt: user.updatedAt || user.createdAt || '',
      })),
    })
  } catch (err) { next(err) }
}

/** GET /api/bots/whatsapp/players/:phone — perfil real del jugador registrado por telefono. */
export async function getWhatsappPlayerProfile(req, res, next) {
  try {
    const user = await resolveWhatsappUser(req.params.phone)
    if (!user) return whatsappNotRegistered(res)

    const team = user.team
      ? await Team.findById(user.team).select('name tag publicCode teamInviteCode leader').lean()
      : null

    res.json({
      nick: user.nick,
      playerCode: user.playerCode,
      role: user.role,
      roles: user.roles,
      mainGame: user.gamerProfile?.mainGame || user.games?.[0] || '',
      games: user.games || [],
      team: team ? {
        name: team.name,
        tag: team.tag,
        publicCode: team.publicCode,
        isLeader: String(team.leader) === String(user._id),
        inviteCode: String(team.leader) === String(user._id) ? team.teamInviteCode : undefined,
      } : null,
    })
  } catch (err) { next(err) }
}

/** POST /api/bots/whatsapp/link/confirm — vincula el numero que envio el codigo al bot. */
export async function confirmWhatsappLinkForBot(req, res, next) {
  try {
    const phone = onlyDigits(req.body?.phone)
    const code = String(req.body?.code || '').trim().toUpperCase()
    if (!phone || !code) return res.status(400).json({ error: 'invalid_body', message: 'Faltan phone y code.' })

    const user = await User.findOne({
      'whatsapp.linkCodeHash': hashWhatsappCode(code),
      'whatsapp.linkCodeExpiresAt': { $gt: new Date() },
    }).select('+whatsapp.linkCodeHash +whatsapp.linkCodeExpiresAt')

    if (!user) {
      return res.status(400).json({ error: 'invalid_code', message: 'Codigo invalido o expirado. Genera uno nuevo desde tu perfil.' })
    }

    const taken = await User.findOne({ 'whatsapp.phone': phone, _id: { $ne: user._id } })
    if (taken) {
      return res.status(409).json({ error: 'phone_taken', message: 'Este numero ya esta vinculado a otra cuenta de GlitchGang.' })
    }

    user.whatsapp = {
      ...(user.whatsapp?.toObject?.() || user.whatsapp || {}),
      phone,
      verified: true,
      linkedAt: new Date(),
      linkCodeHash: '',
      linkCodeExpiresAt: null,
    }
    user.social = { ...(user.social?.toObject?.() || user.social || {}), whatsapp: phone }
    await user.save()

    res.json({
      message: 'WhatsApp vinculado correctamente.',
      nick: user.nick,
      playerCode: user.playerCode,
      phone,
    })
  } catch (err) { next(err) }
}

/** POST /api/bots/teams — crea un equipo (comando "/equipo crear"). */
export async function createTeamAsDiscordUser(req, res, next) {
  try {
    const user = await resolveLinkedUser(req.body?.discordId)
    if (!user) return notLinked(res)
    const team = await createTeamForUser(user, req.body || {})
    res.status(201).json(team)
  } catch (err) { next(err) }
}

/** POST /api/bots/teams/join — une al jugador con el código real del equipo. */
export async function joinTeamAsDiscordUser(req, res, next) {
  try {
    const user = await resolveLinkedUser(req.body?.discordId)
    if (!user) return notLinked(res)
    const result = await joinTeamForUser(user, req.body?.inviteCode)
    res.json(result)
  } catch (err) { next(err) }
}

/** GET /api/bots/teams/:discordId — roster + código de invitación si es líder. */
export async function getTeamForDiscordUser(req, res, next) {
  try {
    const user = await resolveLinkedUser(req.params.discordId)
    if (!user) return notLinked(res)

    const team = await Team.findOne({ members: user._id }).populate('members', 'nick playerCode').lean()
    if (!team) return res.json(null)

    const isLeader = String(team.leader) === String(user._id)
    res.json({
      name: team.name,
      tag: team.tag,
      publicCode: team.publicCode,
      members: (team.members || []).map(m => ({ nick: m.nick, playerCode: m.playerCode })),
      isLeader,
      inviteCode: isLeader ? team.teamInviteCode : undefined,
    })
  } catch (err) { next(err) }
}

/** GET /api/bots/tournaments — solo torneos marcados para jugarse por Discord. */
export async function listDiscordTournaments(req, res, next) {
  try {
    const guildId = String(req.query.guildId || '').trim()
    if (!guildId) return res.status(400).json({ error: 'missing_guild', message: 'Falta guildId.' })

    const org = await Organization.findOne({ discordGuildId: guildId, status: 'active' }).lean()
    if (!org) {
      return res.status(404).json({
        error: 'organization_not_found',
        message: 'Este servidor de Discord no está registrado como cliente de GlitchGang.',
      })
    }

    const tournaments = await Tournament.find({ organization: org._id, discordEnabled: true, visibility: { $ne: 'private' } })
      .sort({ date: 1 })
      .select('tournamentCode publicId title game date status maxSlots currentSlots registrationWindow')
      .lean()
    res.json({ tournaments })
  } catch (err) { next(err) }
}

async function resolveWhatsappOrganization(groupId) {
  const id = String(groupId || '').trim()
  if (!id) return null
  return Organization.findOne({ whatsappGroupId: id, status: 'active' }).lean()
}

/** GET /api/bots/whatsapp/organizations/:groupId — datos del grupo para bienvenida/despedida. */
export async function getWhatsappOrganizationForBot(req, res, next) {
  try {
    const org = await resolveWhatsappOrganization(req.params.groupId)
    if (!org) return res.status(404).json({ error: 'organization_not_found', message: 'Grupo de WhatsApp no registrado.' })
    res.json({
      id: String(org._id),
      name: org.name,
      whatsappGroupId: org.whatsappGroupId || '',
      welcomeEnabled: org.welcomeEnabled !== false,
      welcomeMessage: org.welcomeMessage || '',
      farewellMessage: org.farewellMessage || '',
      rules: org.rules || '',
    })
  } catch (err) { next(err) }
}

/** GET /api/bots/whatsapp/tournaments?groupId=... — torneos habilitados para el grupo. */
export async function listWhatsappTournaments(req, res, next) {
  try {
    const groupId = String(req.query.groupId || '').trim()
    if (!groupId) return res.status(400).json({ error: 'missing_group', message: 'Falta groupId.' })

    const org = await resolveWhatsappOrganization(groupId)
    if (!org) return res.status(404).json({ error: 'organization_not_found', message: 'Grupo de WhatsApp no registrado.' })

    const tournaments = await Tournament.find({ organization: org._id, whatsappEnabled: true, visibility: { $ne: 'private' } })
      .sort({ date: 1 })
      .select('publicId title game date status maxSlots currentSlots registrationWindow rules')
      .lean()
    res.json({ tournaments })
  } catch (err) { next(err) }
}

/** GET /api/bots/whatsapp/tournaments/active?groupId=... — torneo activo del grupo. */
export async function getActiveWhatsappTournament(req, res, next) {
  try {
    const groupId = String(req.query.groupId || '').trim()
    if (!groupId) return res.status(400).json({ error: 'missing_group', message: 'Falta groupId.' })

    const org = await resolveWhatsappOrganization(groupId)
    if (!org) return res.status(404).json({ error: 'organization_not_found', message: 'Grupo de WhatsApp no registrado.' })

    let list = await Tournament.find({ organization: org._id, whatsappEnabled: true, status: 'ongoing' })
      .select('publicId title game date status maxSlots currentSlots rules').lean()
    if (list.length === 0) {
      list = await Tournament.find({ organization: org._id, whatsappEnabled: true, status: 'open' })
        .select('publicId title game date status maxSlots currentSlots rules').lean()
    }
    if (list.length === 0) {
      return res.status(404).json({ error: 'no_active_tournament', message: 'No hay ningun torneo activo para WhatsApp en este momento.' })
    }
    if (list.length > 1) {
      return res.status(409).json({ error: 'multiple_active_tournaments', message: 'Hay mas de un torneo activo para WhatsApp.' })
    }
    const t = list[0]
    res.json({
      id: String(t._id),
      publicId: t.publicId,
      title: t.title,
      game: t.game,
      status: t.status,
      date: t.date,
      maxSlots: t.maxSlots,
      currentSlots: t.currentSlots,
      rules: t.rules || '',
    })
  } catch (err) { next(err) }
}

// El consentimiento de capturas (MLBB) solo se puede aceptar en la web: desde
// el bot no hay casilla, así que se manda al capitán a la página de inscripción.
function consentToWeb(err, tournamentId) {
  if (err?.payload?.code !== 'DATA_CONSENT_REQUIRED') return err
  const web = String(config.clientOrigin).split(',')[0].trim().replace(/\/+$/, '')
  const url = `${web}/torneos/${encodeURIComponent(tournamentId)}/inscripcion`
  return Object.assign(new Error(`Este torneo pide aceptar el envío de capturas y nicks a Google. Inscríbete desde la web: ${url}`), { status: 400, payload: { code: 'DATA_CONSENT_REQUIRED', url } })
}

/** POST /api/bots/tournaments/:id/register — inscribe al equipo del líder vinculado. */
export async function registerTournamentAsDiscordUser(req, res, next) {
  try {
    const user = await resolveLinkedUser(req.body?.discordId)
    if (!user) return notLinked(res)
    const result = await registerTeamForUser(user, req.params.id)
    res.json(result)
  } catch (err) { next(consentToWeb(err, req.params.id)) }
}

/** POST /api/bots/whatsapp/tournaments/:id/register — inscribe al equipo del lider por telefono. */
export async function registerTournamentAsWhatsappUser(req, res, next) {
  try {
    const user = await resolveWhatsappUser(req.body?.phone)
    if (!user) return whatsappNotRegistered(res)
    const result = await registerTeamForUser(user, req.params.id)
    res.json(result)
  } catch (err) { next(consentToWeb(err, req.params.id)) }
}

/** GET /api/bots/referral/:discordId — código de referido real (se genera si falta). */
export async function getReferralCode(req, res, next) {
  try {
    const user = await resolveLinkedUser(req.params.discordId)
    if (!user) return notLinked(res)

    const code = await getOrCreateReferralCode(user)
    res.json({ referralCode: code, registerUrl: `${config.clientOrigin}/register?ref=${code}` })
  } catch (err) { next(err) }
}
