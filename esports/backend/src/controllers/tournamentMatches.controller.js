import mongoose from 'mongoose'
import { Tournament } from '../models/Tournament.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { Organization } from '../models/Organization.js'
import { DiscordServerConfig } from '../models/DiscordServerConfig.js'
import { siteUrl } from '../services/discordPublications.service.js'
import { Team } from '../models/Team.js'
import { autoGenerateBracketIfReady, tryAutoSyncMatchReport } from '../services/bracketSync.service.js'
import { saveRosterSnapshot } from '../services/rosterLock.service.js'
import { notifyCheckinOpen, notifyResultReported } from '../services/matchNotifications.service.js'
import { isMobileLegends } from '../../../shared/matchStats.mjs'
import { archiveReportEvidence, resolveBracketMatch, nextGameNumber, absoluteEvidenceUrl, reportEvidence, gameDeadline, mergeEvidence } from '../services/discordReports.service.js'
import { missingScreenshots } from '../../../shared/reportScreenshots.mjs'
import { recordReport, syncStatusFor } from '../services/matchResults.service.js'

const DEFAULT_CHECKIN_WINDOW_MS = 20 * 60 * 1000
const OPEN_CHECKIN_STATUSES = ['checking_in', 'ready']

function mapMatch(m) {
  return {
    id: String(m._id),
    tournamentId: String(m.tournament),
    teamId: String(m.team),
    teamName: m.teamNameSnapshot || '',
    rivalName: m.rivalName || null,
    guildId: m.guildId,
    channelId: m.channelId,
    voiceChannelId: m.voiceChannelId,
    notificationChannelId: m.notificationChannelId,
    channelName: m.channelName,
    status: m.status,
    requestedBy: m.requestedBy,
    requestedAt: m.requestedAt,
    checkinWindowMs: m.checkinWindowMs,
    checkinDeadlineAt: m.checkinDeadlineAt,
    readyAt: m.readyAt,
    startedBy: m.startedBy,
    startedAt: m.startedAt,
    completedAt: m.completedAt,
    result: m.result,
    disqualifiedAt: m.disqualifiedAt,
    disqualificationReason: m.disqualificationReason,
    attendance: m.attendance,
    bracketMatchId: m.bracketMatchId || '',
    gameNumber: m.gameNumber || null,
    report: m.report?.createdAt ? { ...(m.report.toObject?.() || m.report), evidence: reportEvidence(m.report).map(e => ({ ...e, url: absoluteEvidenceUrl(e.url) })) } : null,
  }
}

function findOpenCheckinDoc(teamId) {
  return TournamentMatch.findOne({ team: teamId, status: { $in: OPEN_CHECKIN_STATUSES } }).sort({ updatedAt: -1 })
}

function findActiveMatchDoc(teamId) {
  return TournamentMatch.findOne({ team: teamId, status: 'in_progress' })
}

/** Resuelve la organizacion (cliente) a partir del servidor de Discord que llama. */
async function resolveOrganizationByGuild(guildId, res) {
  const id = String(guildId || '').trim()
  if (!id) {
    res.status(400).json({ error: 'missing_guild', message: 'Falta guildId.' })
    return null
  }
  const org = await Organization.findOne({ discordGuildId: id, status: 'active' }).lean()
  if (!org) {
    res.status(404).json({
      error: 'organization_not_found',
      message: 'Este servidor de Discord no está registrado como cliente de GlitchGang. Contacta a GlitchGang para activarlo.',
    })
    return null
  }
  return org
}

const ACTIVE_TOURNAMENT_FIELDS = 'publicId title game date status maxSlots currentSlots discordProvision'

/** Torneos con Discord activado de un cliente, en 'ongoing' o (si no hay) 'open'. */
async function findActiveTournaments(orgId) {
  let list = await Tournament.find({ organization: orgId, discordEnabled: true, status: 'ongoing' })
    .select(ACTIVE_TOURNAMENT_FIELDS).lean()
  if (list.length === 0) {
    list = await Tournament.find({ organization: orgId, discordEnabled: true, status: 'open' })
      .select(ACTIVE_TOURNAMENT_FIELDS).lean()
  }
  return list
}

/** ¿El canal de Discord donde se corrio el comando es uno de los que el bot le creo a este torneo? */
function channelBelongsToTournament(t, channelId) {
  const dp = t.discordProvision || {}
  if (!channelId) return false
  if (dp.categoryId === channelId) return true
  return Object.values(dp.channels || {}).includes(channelId)
}

function serializeActiveTournament(t) {
  return {
    id: String(t._id), publicId: t.publicId, title: t.title, game: t.game,
    status: t.status, date: t.date, maxSlots: t.maxSlots, currentSlots: t.currentSlots,
  }
}

/**
 * GET /api/bots/tournaments/active?guildId=...&channelId=...&tournamentId=... —
 * "el" torneo activo de ese cliente. Varios torneos pueden estar
 * 'ongoing'/'open' a la vez en el mismo servidor (multi-torneo):
 * - Si viene tournamentId (o publicId), es la via mas robusta: el comando
 *   lo pidio explicito, se busca DIRECTO por id sin importar en que canal
 *   se corrio ni si esta ongoing/open (el organizador/staff que lo escribe
 *   ya sabe cual es). channelId se ignora en este caso.
 * - Si no, y el comando ya sabe en que canal de Discord se corrio
 *   (channelId), se usa eso para elegir CUAL torneo es, matcheando contra
 *   los canales que el bot le creo al TORNEO (discordProvision.categoryId/
 *   channels.*) -- OJO: esto NUNCA matchea canales de EQUIPO (los de
 *   provisionTeam viven en su propia categoria, ver
 *   discord-bot/services/provisionWorker.js), asi que un /checkin corrido
 *   desde el canal de voz de un equipo con 2+ torneos activos siempre cae
 *   al caso de abajo.
 * - Sin ninguno de los dos, o si ninguno/mas de uno coincide, se mantiene
 *   el comportamiento anterior (single-tenant): si hay mas de un
 *   candidato, error explicito en vez de adivinar.
 */
export async function getActiveDiscordTournament(req, res, next) {
  try {
    const org = await resolveOrganizationByGuild(req.query.guildId, res)
    if (!org) return
    const channelId = String(req.query.channelId || '').trim()
    const tournamentId = String(req.query.tournamentId || '').trim()

    if (tournamentId) {
      const byId = mongoose.isValidObjectId(tournamentId) ? { _id: tournamentId } : null
      const t = await Tournament.findOne({
        organization: org._id,
        ...(byId ? { $or: [byId, { publicId: tournamentId }] } : { publicId: tournamentId }),
      }).select(ACTIVE_TOURNAMENT_FIELDS).lean()

      if (!t) {
        return res.status(404).json({
          error: 'tournament_not_found',
          message: 'No se encontro ese torneo (o no pertenece a este servidor de Discord).',
        })
      }
      return res.json(serializeActiveTournament(t))
    }

    const list = await findActiveTournaments(org._id)
    if (list.length === 0) {
      return res.status(404).json({
        error: 'no_active_tournament',
        message: 'No hay ningún torneo activo para Discord en este momento.',
      })
    }

    if (list.length === 1) return res.json(serializeActiveTournament(list[0]))

    const matches = channelId ? list.filter(t => channelBelongsToTournament(t, channelId)) : []
    if (matches.length === 1) return res.json(serializeActiveTournament(matches[0]))

    return res.status(409).json({
      error: 'multiple_active_tournaments',
      message: channelId
        ? 'Hay más de un torneo activo y ninguno coincide con este canal. Usa el comando dentro de un canal de ese torneo (check-in, bracket, etc).'
        : 'Hay más de un torneo activo para Discord en este servidor. Especifica el canal o deja solo uno en "ongoing" (o "open") a la vez.',
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/bots/tournaments/team-by-channel?guildId=...&channelId=... —
 * resuelve DIRECTO el equipo Y el torneo dueños de un canal de Discord que
 * el bot le creo a ESE equipo EN ESE TORNEO (texto, bracket o voz -- ver
 * provisionTeam en discord-bot/services/provisionWorker.js, que guarda
 * esos 3 ids en Tournament.registrations[].discordProvision). Es la via
 * mas robusta para comandos como /checkin: el jugador ya esta parado en
 * la sala exclusiva de su equipo, no hace falta que escriba nombre de
 * equipo ni codigo de torneo.
 *
 * Antes esto buscaba el equipo por Team.discordProvision (un solo campo
 * por equipo) y LUEGO adivinaba el torneo con
 * `Tournament.findOne({'registrations.team': team._id})` sin desambiguar
 * -- si el equipo estaba en 2+ torneos activos a la vez, devolvia
 * cualquiera de los dos, no necesariamente el dueño real del canal. Ahora
 * se busca directo por el canal dentro de registrations[].discordProvision,
 * que resuelve equipo Y torneo en una sola consulta sin ambiguedad
 * (un canal de equipo pertenece, como mucho, a una sola inscripcion).
 */
export async function getTeamByDiscordChannel(req, res, next) {
  try {
    const org = await resolveOrganizationByGuild(req.query.guildId, res)
    if (!org) return
    const channelId = String(req.query.channelId || '').trim()
    if (!channelId) return res.status(400).json({ error: 'missing_channel', message: 'Falta channelId.' })

    const tournament = await Tournament.findOne({
      organization: org._id,
      $or: [
        { 'registrations.discordProvision.voiceChannelId': channelId },
        { 'registrations.discordProvision.textChannelId': channelId },
        { 'registrations.discordProvision.bracketChannelId': channelId },
      ],
    }).select(`${ACTIVE_TOURNAMENT_FIELDS} registrations`).lean()

    if (!tournament) {
      return res.status(404).json({ error: 'team_not_found', message: 'Ese canal no es la sala de ningun equipo.' })
    }

    const registration = (tournament.registrations || []).find((r) => {
      const dp = r.discordProvision || {}
      return dp.voiceChannelId === channelId || dp.textChannelId === channelId || dp.bracketChannelId === channelId
    })
    if (!registration?.team) {
      return res.status(404).json({ error: 'team_not_found', message: 'Ese canal no es la sala de ningun equipo.' })
    }

    const team = await Team.findById(registration.team).select('name tag leader members').populate('members', 'nick discord').lean()
    if (!team) {
      return res.status(404).json({ error: 'team_not_found', message: 'Ese canal no es la sala de ningun equipo.' })
    }

    const leaderId = String(team.leader)
    const players = (team.members || []).map(m => ({
      id: String(m._id),
      name: m.nick,
      discordId: m.discord?.id || '',
      discordUsername: m.discord?.username || '',
      isLeader: String(m._id) === leaderId,
    }))

    res.json({
      tournament: serializeActiveTournament(tournament),
      team: { id: String(team._id), name: team.name, tag: team.tag, players },
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/bots/tournaments/active-list?guildId=... — TODOS los torneos
 * activos de ese cliente (no solo "el" uno). Para tareas guild-wide sin un
 * canal/interaccion puntual de donde sacar contexto, como reprogramar los
 * timers de check-in de cada torneo al reiniciar el bot.
 */
export async function listActiveDiscordTournaments(req, res, next) {
  try {
    const org = await resolveOrganizationByGuild(req.query.guildId, res)
    if (!org) return
    const list = await findActiveTournaments(org._id)
    res.json({ tournaments: list.map(serializeActiveTournament) })
  } catch (err) { next(err) }
}

/** GET /api/bots/organizations/:guildId — datos del cliente (para bienvenida/despedida). */
// Bienvenida/despedida del servidor general de GlitchGang: se configuran en
// /admin/discord-sync (Automatizaciones) y viven en DiscordServerConfig.
async function mainServerAutomations() {
  const serverConfig = await DiscordServerConfig.getMain()
  const { welcome = {}, farewell = {}, welcomeDm = true } = serverConfig.automations || {}
  const absolute = url => (url ? siteUrl(url) : '')
  return {
    welcomeEnabled: Boolean(welcome.enabled),
    welcomeChannelId: welcome.channelId || '',
    welcomeTitle: welcome.title || '',
    welcomeMessage: welcome.message || '',
    welcomeImageUrl: absolute(welcome.imageUrl),
    welcomeColor: welcome.color || '',
    welcomeDm: welcomeDm !== false,
    farewellEnabled: Boolean(farewell.enabled),
    farewellChannelId: farewell.channelId || '',
    farewellTitle: farewell.title || '',
    farewellMessage: farewell.message || '',
    farewellImageUrl: absolute(farewell.imageUrl),
    farewellColor: farewell.color || '',
  }
}

export async function getOrganizationForBot(req, res, next) {
  try {
    const org = await Organization.findOne({ discordGuildId: req.params.guildId, status: 'active' }).lean()
    const isMainServer = Boolean(process.env.DISCORD_GUILD_ID) && req.params.guildId === process.env.DISCORD_GUILD_ID
    if (!org && !isMainServer) return res.status(404).json({ error: 'organization_not_found', message: 'Servidor no registrado.' })
    const base = {
      id: org ? String(org._id) : 'glitchgang-main',
      name: org?.name || 'GlitchGang',
      welcomeChannelId: org?.welcomeChannelId || '',
      welcomeEnabled: org ? org.welcomeEnabled !== false : false,
      welcomeMessage: org?.welcomeMessage || '',
      farewellMessage: org?.farewellMessage || '',
      tournamentsPanelChannelId: org?.tournamentsPanelChannelId || '',
      tournamentsPanelMessageId: org?.tournamentsPanelMessageId || '',
    }
    res.json(isMainServer ? { ...base, ...(await mainServerAutomations()) } : base)
  } catch (err) { next(err) }
}

/** PATCH /api/bots/organizations/:guildId/welcome — admin del servidor activa/desactiva la bienvenida custom. */
export async function updateOrganizationWelcomeForBot(req, res, next) {
  try {
    const { enabled } = req.body
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'invalid_body', message: 'Falta "enabled" (boolean).' })
    }
    const update = { welcomeEnabled: enabled }
    if (enabled && req.body?.channelId) {
      update.welcomeChannelId = String(req.body.channelId).trim()
    }
    const org = await Organization.findOneAndUpdate(
      { discordGuildId: req.params.guildId, status: 'active' },
      update,
      { new: true }
    ).lean()
    if (!org) return res.status(404).json({ error: 'organization_not_found', message: 'Servidor no registrado.' })
    res.json({
      welcomeEnabled: org.welcomeEnabled !== false,
      welcomeChannelId: org.welcomeChannelId || '',
    })
  } catch (err) { next(err) }
}

/**
 * PATCH /api/bots/organizations/:guildId/tournaments-panel — guarda en que
 * canal vive el panel general de torneos disponibles de este cliente, y el
 * id del mensaje fijo que el bot debe editar (en vez de mandar uno nuevo
 * cada vez). Lo dispara /torneos-panel (admin) y cada refresh del panel.
 */
export async function updateOrganizationTournamentsPanel(req, res, next) {
  try {
    const channelId = String(req.body?.channelId || '').trim()
    const messageId = String(req.body?.messageId || '').trim()
    if (!channelId) return res.status(400).json({ error: 'invalid_body', message: 'Falta "channelId".' })

    const org = await Organization.findOneAndUpdate(
      { discordGuildId: req.params.guildId, status: 'active' },
      { tournamentsPanelChannelId: channelId, tournamentsPanelMessageId: messageId },
      { new: true }
    ).lean()
    if (!org) return res.status(404).json({ error: 'organization_not_found', message: 'Servidor no registrado.' })
    res.json({
      tournamentsPanelChannelId: org.tournamentsPanelChannelId || '',
      tournamentsPanelMessageId: org.tournamentsPanelMessageId || '',
    })
  } catch (err) { next(err) }
}

/** GET /api/bots/tournaments/:id/teams — roster de cada equipo inscrito, listo para detectar por voz. */
export async function getTournamentTeamsForBot(req, res, next) {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .select('registrations')
      .populate({
        path: 'registrations.team',
        select: 'name tag leader members',
        populate: { path: 'members', select: 'nick discord' },
      })
      .lean()
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' })

    const teams = (tournament.registrations || [])
      .filter(r => r.team)
      .map(r => {
        const team = r.team
        const leaderId = String(team.leader)
        const players = (team.members || []).map(m => ({
          id: String(m._id),
          name: m.nick,
          discordId: m.discord?.id || '',
          discordUsername: m.discord?.username || '',
          isLeader: String(m._id) === leaderId,
        }))
        return { id: String(team._id), name: team.name, tag: team.tag, players }
      })

    res.json({ teams })
  } catch (err) { next(err) }
}

/** POST /api/bots/matches/checkin — crea o refresca el check-in de un equipo. */
export async function checkinMatch(req, res, next) {
  try {
    const {
      tournamentId, teamId, teamName, guildId, voiceChannelId,
      notificationChannelId, channelName, requestedBy, attendance, checkinWindowMs,
    } = req.body || {}
    if (!tournamentId || !teamId) return res.status(400).json({ message: 'tournamentId y teamId son requeridos' })

    const snapshot = {
      presentCount: attendance?.presentCount || 0,
      totalCount: attendance?.totalCount || 0,
      presentPlayers: attendance?.presentPlayers || [],
      missingPlayers: attendance?.missingPlayers || [],
      unexpectedPlayers: attendance?.unexpectedPlayers || [],
    }
    const shouldBeReady = snapshot.missingPlayers.length === 0
    const now = new Date()

    let doc = await findOpenCheckinDoc(teamId)
    const created = !doc
    const previousStatus = doc?.status || null

    if (!doc) {
      const windowMs = Number(checkinWindowMs || DEFAULT_CHECKIN_WINDOW_MS)
      doc = new TournamentMatch({
        tournament: tournamentId,
        team: teamId,
        teamNameSnapshot: teamName || '',
        guildId, voiceChannelId, notificationChannelId, channelName,
        channelId: notificationChannelId,
        status: shouldBeReady ? 'ready' : 'checking_in',
        requestedBy,
        requestedAt: now,
        checkinWindowMs: windowMs,
        checkinDeadlineAt: new Date(now.getTime() + windowMs),
        readyAt: shouldBeReady ? now : null,
        attendance: snapshot,
      })
    } else {
      const windowMs = checkinWindowMs ? Number(checkinWindowMs) : doc.checkinWindowMs
      doc.guildId = guildId
      doc.voiceChannelId = voiceChannelId
      doc.notificationChannelId = notificationChannelId
      doc.channelId = notificationChannelId
      doc.channelName = channelName
      doc.attendance = snapshot
      doc.checkinWindowMs = windowMs
      if (checkinWindowMs) doc.checkinDeadlineAt = new Date(new Date(doc.requestedAt).getTime() + windowMs)
      if (doc.status !== 'ready' && shouldBeReady) {
        doc.status = 'ready'
        doc.readyAt = now
      } else if (doc.status !== 'ready') {
        doc.status = 'checking_in'
      }
    }

    await doc.save()
    const becameReady = previousStatus !== 'ready' && doc.status === 'ready'
    if (created && doc.status === 'checking_in') {
      await notifyCheckinOpen(doc).catch((error) => {
        console.error('[Checkin] No se pudo avisar la apertura del check-in:', error.message)
      })
    }

    // Puente check-in de Discord -> registro del torneo: antes esto solo
    // vivia en TournamentMatch (lo que ve el bot), y Tournament.registrations[].status
    // (lo que usa resolveBracketTeams para armar el bracket) solo lo tocaba
    // el checkbox manual del organizador en la web -- dos "check-in" que
    // nunca se hablaban. Con esto, un equipo listo en Discord tambien cuenta
    // para armar el bracket solo.
    if (becameReady) {
      await Tournament.updateOne(
        { _id: tournamentId, registrations: { $elemMatch: { team: teamId, status: 'registered' } } },
        { $set: { 'registrations.$.status': 'checked_in' } },
      ).catch((error) => {
        console.error('[Checkin] No se pudo sincronizar el check-in a la inscripcion:', error.message)
      })
      await saveRosterSnapshot(tournamentId, teamId).catch((error) => {
        console.error('[Checkin] No se pudo guardar el rosterSnapshot:', error.message)
      })
      await autoGenerateBracketIfReady(tournamentId).catch((error) => {
        console.error('[Checkin] Auto-generacion de bracket fallo:', error.message)
      })
    }

    res.json({ match: mapMatch(doc), created, becameReady })
  } catch (err) { next(err) }
}

// Partida del bracket que corresponde a esta operacion de Discord; null si
// no se puede saber (bracket sin armar, varias pendientes sin rival escrito).
async function linkToBracket(doc, rivalName) {
  try {
    const tournament = await Tournament.findById(doc.tournament).lean()
    return tournament ? await resolveBracketMatch(tournament, doc.team, rivalName) : null
  } catch (error) {
    console.error('[Match] No se pudo ubicar la partida en el bracket:', error.message)
    return null
  }
}

/** POST /api/bots/matches/start — inicia la partida oficial de un equipo. */
export async function startMatch(req, res, next) {
  try {
    const {
      tournamentId, teamId, teamName, rivalName, guildId, voiceChannelId,
      notificationChannelId, channelName, startedBy,
    } = req.body || {}
    if (!tournamentId || !teamId) return res.status(400).json({ message: 'tournamentId y teamId son requeridos' })

    let doc = await findOpenCheckinDoc(teamId)
    const now = new Date()
    if (!doc) {
      doc = new TournamentMatch({
        tournament: tournamentId,
        team: teamId,
        teamNameSnapshot: teamName || '',
        requestedBy: startedBy,
        requestedAt: now,
        checkinWindowMs: DEFAULT_CHECKIN_WINDOW_MS,
        checkinDeadlineAt: new Date(now.getTime() + DEFAULT_CHECKIN_WINDOW_MS),
        readyAt: now,
      })
    }

    doc.rivalName = rivalName || ''
    doc.guildId = guildId
    doc.voiceChannelId = voiceChannelId
    doc.notificationChannelId = notificationChannelId
    doc.channelId = notificationChannelId
    doc.channelName = channelName
    doc.status = 'in_progress'
    doc.startedBy = startedBy
    doc.startedAt = now
    doc.bracketMatchId = (await linkToBracket(doc, rivalName))?.matchId || ''

    await doc.save()
    res.json(mapMatch(doc))
  } catch (err) { next(err) }
}

/** POST /api/bots/matches/:matchId/report — completa la partida y adjunta el reporte/evidencia. */
export async function reportMatch(req, res, next) {
  try {
    const doc = await TournamentMatch.findById(req.params.matchId)
    if (!doc) return res.status(404).json({ message: 'Match not found' })

    const { result, evidenceUrl, evidenceName, evidence, reporterDiscordId, reporterUsername } = req.body || {}
    // evidence[] = varias capturas ({ key, url, name }); evidenceUrl suelto es
    // el formato del bot anterior (una sola imagen).
    const incoming = Array.isArray(evidence) && evidence.length ? evidence : evidenceUrl ? [{ key: '', url: evidenceUrl, name: evidenceName }] : []
    const archived = await archiveReportEvidence(incoming)
    const link = await linkToBracket(doc, doc.rivalName)
    if (!doc.bracketMatchId && link) doc.bracketMatchId = link.matchId
    // El rival sale del bracket aunque el capitan no lo haya escrito.
    if (!doc.rivalName && link?.matchId === doc.bracketMatchId) doc.rivalName = link.rivalBracketName
    const series = link?.matchId === doc.bracketMatchId ? link.series : 'BO1'
    // /report partida:N lo fija el capitan; si no, el siguiente de la serie.
    const asked = Number(req.body?.gameNumber)
    const maxGames = Number(String(series).replace(/\D/g, '')) || 1
    if (doc.bracketMatchId) doc.gameNumber = Number.isInteger(asked) && asked >= 1 && asked <= maxGames ? asked : (doc.gameNumber || await nextGameNumber(doc, series))
    const tournament = await Tournament.findById(doc.tournament).select('game').lean()
    doc.status = 'completed'
    doc.result = result || ''
    doc.completedAt = new Date()
    doc.report = {
      evidenceUrl: archived[0] ? absoluteEvidenceUrl(archived[0].url) : '',
      evidenceName: archived[0]?.name || '',
      evidence: archived,
      missing: missingScreenshots(tournament?.game, archived),
      deadlineAt: await gameDeadline(doc),
      reporterDiscordId: reporterDiscordId || '',
      reporterUsername: reporterUsername || '',
      disputed: false,
      disputedAt: null,
      createdAt: new Date(),
    }

    await doc.save()

    // Best-effort: con la partida ubicada en el bracket, el caso de la
    // partida (matchResults.service) cruza los dos reportes y, en MLBB, la
    // lectura de las capturas; sin ubicar, queda el cruce viejo por nombre.
    // Nunca bloquea la respuesta del reporte, que ya quedo guardado arriba.
    const sync = await (doc.bracketMatchId
      ? recordReport(doc).then(outcome => (outcome ? syncStatusFor(outcome, doc.team) : tryAutoSyncMatchReport(doc)))
      : tryAutoSyncMatchReport(doc)
    ).catch((error) => {
      console.error('[Report] Auto-sync con bracket fallo:', error.message)
      return null
    })
    await notifyResultReported(doc, sync).catch((error) => {
      console.error('[Report] No se pudo avisar al rival:', error.message)
    })

    res.json({ ...mapMatch(doc), sync, ...(isMobileLegends(tournament?.game) ? { statsReviewUrl: siteUrl('/mi-equipo/enfrentamiento') } : {}) })
  } catch (err) { next(err) }
}

/**
 * POST /api/bots/teams/:teamId/report/evidence — /report solo con las
 * capturas que faltaban, sin partida en curso: se agregan al ultimo reporte
 * del equipo (o al de gameNumber, si viene). Una captura de la misma clave
 * reemplaza a la anterior. No cambia el resultado declarado.
 */
export async function addReportEvidence(req, res, next) {
  try {
    const filter = { team: req.params.teamId, 'report.createdAt': { $ne: null } }
    const gameNumber = Number(req.body?.gameNumber)
    if (Number.isInteger(gameNumber) && gameNumber > 0) filter.gameNumber = gameNumber
    if (req.body?.tournamentId && mongoose.isValidObjectId(req.body.tournamentId)) filter.tournament = req.body.tournamentId
    const doc = await TournamentMatch.findOne(filter).sort({ 'report.createdAt': -1 })
    if (!doc) return res.status(404).json({ error: 'report_not_found', message: 'Tu equipo no tiene un reporte al que agregar capturas. Usa /start-match y luego /report con el resultado.' })

    const tournament = await Tournament.findById(doc.tournament).select('game bracketDoc.results').lean()
    if (doc.bracketMatchId && tournament?.bracketDoc?.results?.[doc.bracketMatchId]?.confirmed) {
      return res.status(409).json({ error: 'already_confirmed', message: 'Ese resultado ya fue confirmado en el bracket. Si hay un error, avisa al organizador.' })
    }
    const archived = await archiveReportEvidence(req.body?.evidence)
    if (!archived.length) return res.status(400).json({ error: 'missing_evidence', message: 'Adjunta al menos una captura.' })

    const evidence = mergeEvidence(doc.report.evidence || [], archived)
    doc.report.evidence = evidence
    doc.report.missing = missingScreenshots(tournament?.game, evidence)
    doc.report.evidenceUrl = absoluteEvidenceUrl(evidence[0].url)
    doc.report.evidenceName = evidence[0].name || ''
    await doc.save()
    // Capturas nuevas: el caso las vuelve a leer y reevalua.
    const outcome = await recordReport(doc).catch((error) => {
      console.error('[Report] No se pudo actualizar el caso:', error.message)
      return null
    })
    res.json({ ...mapMatch(doc), added: archived.length, late: Boolean(doc.report.deadlineClosedAt), ...(outcome ? { sync: syncStatusFor(outcome, doc.team) } : {}) })
  } catch (err) { next(err) }
}

/** POST /api/bots/matches/:matchId/cancel — cancela un check-in o partida activa. */
export async function cancelMatchAsBot(req, res, next) {
  try {
    const doc = await TournamentMatch.findById(req.params.matchId)
    if (!doc) return res.status(404).json({ message: 'Match not found' })

    const cancellable = ['in_progress', 'checking_in', 'ready']
    if (!cancellable.includes(doc.status)) {
      return res.status(400).json({ message: 'Esta operación ya fue completada o cancelada' })
    }

    doc.status = 'cancelled'
    doc.disqualifiedAt = new Date()
    doc.disqualificationReason = req.body?.reason || 'Partida cancelada manualmente.'
    await doc.save()
    res.json(mapMatch(doc))
  } catch (err) { next(err) }
}

/** POST /api/bots/matches/:matchId/disqualify — usado por el timer de check-in del bot. */
export async function disqualifyMatch(req, res, next) {
  try {
    const doc = await TournamentMatch.findById(req.params.matchId)
    if (!doc || doc.status !== 'checking_in') {
      return res.status(404).json({ message: 'Match not found or not in checking_in state' })
    }

    doc.status = 'disqualified'
    doc.disqualifiedAt = new Date()
    doc.disqualificationReason = req.body?.reason || 'El equipo no completó el check-in dentro del tiempo límite.'
    await doc.save()
    res.json(mapMatch(doc))
  } catch (err) { next(err) }
}

/** PATCH /api/bots/matches/:matchId/report/dispute — marca/resuelve una disputa del reporte. */
export async function disputeReport(req, res, next) {
  try {
    const doc = await TournamentMatch.findById(req.params.matchId)
    if (!doc || !doc.report?.createdAt) return res.status(404).json({ message: 'Report not found' })

    doc.report.disputed = req.body?.disputed !== false
    doc.report.disputedAt = doc.report.disputed ? new Date() : null
    await doc.save()
    res.json(mapMatch(doc))
  } catch (err) { next(err) }
}

/** GET /api/bots/teams/:teamId/latest-operation */
export async function getTeamLatestOperation(req, res, next) {
  try {
    const doc = await TournamentMatch.findOne({ team: req.params.teamId }).sort({ updatedAt: -1 })
    res.json(doc ? mapMatch(doc) : null)
  } catch (err) { next(err) }
}

/** GET /api/bots/teams/:teamId/active-match */
export async function getTeamActiveMatch(req, res, next) {
  try {
    const doc = await findActiveMatchDoc(req.params.teamId)
    res.json(doc ? mapMatch(doc) : null)
  } catch (err) { next(err) }
}

/** GET /api/bots/teams/:teamId/open-checkin */
export async function getTeamOpenCheckin(req, res, next) {
  try {
    const doc = await findOpenCheckinDoc(req.params.teamId)
    res.json(doc ? mapMatch(doc) : null)
  } catch (err) { next(err) }
}

/** GET /api/bots/teams/:teamId/history — partidas completadas. */
export async function getTeamMatchHistory(req, res, next) {
  try {
    const docs = await TournamentMatch.find({ team: req.params.teamId, status: 'completed' }).sort({ completedAt: -1 })
    res.json({ matches: docs.map(mapMatch) })
  } catch (err) { next(err) }
}

/** GET /api/bots/tournaments/:id/matches — todas las operaciones del torneo (usa /calendario). */
export async function getTournamentMatches(req, res, next) {
  try {
    const docs = await TournamentMatch.find({ tournament: req.params.id }).sort({ updatedAt: -1 })
    res.json({ matches: docs.map(mapMatch) })
  } catch (err) { next(err) }
}

/** GET /api/bots/matches/expired-checkins — reconciliación al reiniciar el bot. */
export async function getExpiredCheckinsForBot(req, res, next) {
  try {
    const docs = await TournamentMatch.find({ status: 'checking_in', checkinDeadlineAt: { $lte: new Date() } })
    res.json({ matches: docs.map(mapMatch) })
  } catch (err) { next(err) }
}
