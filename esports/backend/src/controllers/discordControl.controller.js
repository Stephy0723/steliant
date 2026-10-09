// Control Center del servidor general de Discord (/admin/discord-sync).
// Todo lo que toca Discord pasa web -> CRM -> bot (crmSync.service.js).
import { DiscordPublication, PUBLICATION_STATUSES, PUBLICATION_TYPES } from '../models/DiscordPublication.js'
import { DISCORD_CHANNEL_FUNCTIONS, DiscordServerConfig } from '../models/DiscordServerConfig.js'
import { DEFAULT_DISCORD_TEMPLATES, DiscordTemplate } from '../models/DiscordTemplate.js'
import { AdminActionLog } from '../models/AdminActionLog.js'
import { Tournament } from '../models/Tournament.js'
import {
  createDiscordChannelViaCrm, deleteDiscordChannelViaCrm, deleteDiscordThreadViaCrm, editDiscordChannelViaCrm,
  getDiscordChannelsFromCrm, getDiscordServerFromCrm, listDiscordForumThreadsViaCrm, publishToDiscordViaCrm,
} from '../services/crmSync.service.js'
import {
  createPublication, editPublishedPublication, imagePayload, publishPublication, retractPublication,
} from '../services/discordPublications.service.js'

const EDITABLE_FIELDS = ['type', 'title', 'body', 'url', 'imageUrl', 'ctaLabel', 'ctaUrl', 'targetChannelId', 'channelName', 'appliedTags']
// Una vez publicada, solo el contenido se puede cambiar (el canal no).
const PUBLISHED_EDITABLE_FIELDS = ['title', 'body', 'url', 'imageUrl', 'ctaLabel', 'ctaUrl']

function pickPublicationFields(body = {}) {
  const fields = {}
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) fields[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
  }
  if (fields.appliedTags !== undefined) {
    fields.appliedTags = Array.isArray(fields.appliedTags) ? fields.appliedTags.map(String).slice(0, 5) : []
  }
  return fields
}

function sendCrmError(res, error, next) {
  if (error.status === 502 || error.status === 503) {
    return res.status(error.status).json({ message: error.message })
  }
  return next(error)
}

// Siempre 200 con el estado de cada eslabon (crm / bot), para que el panel
// muestre exactamente cual esta caido en vez de un error generico.
export async function getDiscordServer(req, res) {
  try {
    const status = await getDiscordServerFromCrm()
    res.json({ ...status, crm: true, bot: Boolean(status.online) })
  } catch (error) {
    res.json({ online: false, crm: Boolean(error.crmReachable), bot: false, error: error.message })
  }
}

// id de Discord (categoria o canal) -> torneo al que pertenece, para que el
// panel agrupe esos canales en la carpeta de cada torneo y los deje en solo
// lectura. Se mapean tambien los ids de canal sueltos: si el bot creo un
// canal sin categoria, igual se reconoce como del torneo.
async function tournamentCategoryMap() {
  const tournaments = await Tournament.find({
    $or: [
      { 'discordProvision.categoryId': { $nin: ['', null] } },
      { 'discordProvision.status': { $in: ['ready', 'processing', 'failed'] } },
      { 'registrations.discordProvision.categoryId': { $nin: ['', null] } },
      { 'registrations.discordProvision.textChannelId': { $nin: ['', null] } },
    ],
  }).select('title publicId status organizer discordProvision registrations.teamMeta.name registrations.discordProvision')
    .populate('organizer', 'nick')
    .lean()

  const map = {}
  const add = (id, info) => { if (id) map[String(id)] = info }
  for (const t of tournaments) {
    const base = {
      tournamentId: String(t._id),
      title: t.title,
      publicId: t.publicId || '',
      status: t.status,
      organizerId: t.organizer?._id ? String(t.organizer._id) : '',
      organizerNick: t.organizer?.nick || '',
    }
    const tp = t.discordProvision || {}
    add(tp.categoryId, { ...base, kind: 'tournament' })
    for (const id of Object.values(tp.channels || {})) add(id, { ...base, kind: 'tournament' })
    for (const reg of t.registrations || []) {
      const rp = reg.discordProvision || {}
      const info = { ...base, kind: 'team', teamName: reg.teamMeta?.name || 'Equipo' }
      for (const id of [rp.categoryId, rp.textChannelId, rp.bracketChannelId, rp.voiceChannelId]) add(id, info)
    }
  }
  return map
}

function splitDiscordChannels(channels = [], tournamentCategories = {}) {
  const tournamentCategoryIds = new Set(Object.keys(tournamentCategories))
  const tournamentChannelIds = new Set()
  const serverChannels = []
  const tournamentChannels = []

  for (const channel of channels) {
    const tournamentInfo = tournamentCategories[channel.id] || tournamentCategories[channel.parentId]
    if (tournamentInfo || tournamentCategoryIds.has(channel.id)) {
      tournamentChannelIds.add(channel.id)
      tournamentChannels.push({ ...channel, managedScope: 'tournament', tournamentInfo: tournamentInfo || tournamentCategories[channel.id] })
    } else {
      serverChannels.push({ ...channel, managedScope: 'server' })
    }
  }

  return {
    serverChannels,
    tournamentChannels,
    tournamentChannelIds,
    tournamentCategoryIds,
  }
}

async function discordChannelGroups() {
  const [data, tournamentCategories] = await Promise.all([
    getDiscordChannelsFromCrm(),
    tournamentCategoryMap().catch(() => ({})),
  ])
  const channels = data.channels || []
  const groups = splitDiscordChannels(channels, tournamentCategories)
  return { data, tournamentCategories, channels, ...groups }
}

export async function getDiscordChannels(req, res, next) {
  try {
    const { data, tournamentCategories, serverChannels, tournamentChannels } = await discordChannelGroups()
    res.json({
      ...data,
      tournamentCategories,
      serverChannels,
      tournamentChannels,
      counts: {
        ...(data.counts || {}),
        server: serverChannels.length,
        tournament: tournamentChannels.length,
      },
    })
  } catch (error) { sendCrmError(res, error, next) }
}

function logChannelAction(req, action, channelId, summary, extra = {}) {
  req._adminAudited = true // ver services/adminAudit.js
  return AdminActionLog.create({
    actor: req.user?._id || null,
    actorName: req.user?.nick || req.user?.email || 'Admin',
    action,
    module: 'discord-channels',
    targetId: String(channelId),
    summary: String(summary).slice(0, 400),
    ...extra,
  }).catch(err => console.error('[discordControl] No se pudo registrar la accion:', err.message))
}

// POST { name, type: text|voice|category|forum, parentId?, topic? }
export async function createDiscordChannel(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim()
    const type = ['text', 'voice', 'category', 'forum'].includes(req.body?.type) ? req.body.type : 'text'
    if (!name) return res.status(400).json({ message: 'Ponle un nombre al canal.' })
    if (req.body?.parentId) {
      const { tournamentCategoryIds } = await discordChannelGroups()
      if (tournamentCategoryIds.has(String(req.body.parentId))) {
        return res.status(409).json({ message: 'Ese espacio pertenece a un torneo. Crea canales generales fuera de las categorias de torneos.' })
      }
    }
    const { channel } = await createDiscordChannelViaCrm({
      name, type, parentId: req.body?.parentId || undefined, topic: req.body?.topic || undefined,
    })
    await logChannelAction(req, 'create', channel.id, `Creo ${type === 'category' ? 'la categoria' : 'el canal'} ${channel.name}`, { after: channel })
    res.status(201).json({ channel })
  } catch (error) { sendCrmError(res, error, next) }
}

// PATCH { name?, topic?, rateLimitPerUser?, parentId? }
export async function editDiscordChannel(req, res, next) {
  try {
    const updates = {}
    for (const key of ['name', 'topic', 'rateLimitPerUser', 'parentId']) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key]
    }
    if (updates.name !== undefined && !String(updates.name).trim()) {
      return res.status(400).json({ message: 'El nombre no puede quedar vacio.' })
    }
    const { tournamentChannelIds, tournamentCategoryIds } = await discordChannelGroups()
    if (tournamentChannelIds.has(String(req.params.id))) {
      return res.status(409).json({ message: 'Este canal lo maneja el sistema de torneos. Editalo desde el torneo o reprovisiona Discord.' })
    }
    if (updates.parentId && tournamentCategoryIds.has(String(updates.parentId))) {
      return res.status(409).json({ message: 'No muevas canales generales dentro de categorias de torneos.' })
    }
    const { channel } = await editDiscordChannelViaCrm(req.params.id, updates)
    await logChannelAction(req, 'edit', req.params.id, `Edito el canal ${channel.name}`, { after: updates })
    res.json({ channel })
  } catch (error) { sendCrmError(res, error, next) }
}

export async function deleteDiscordChannel(req, res, next) {
  try {
    const channelId = req.params.id
    const { tournamentChannelIds } = await discordChannelGroups()
    if (tournamentChannelIds.has(String(channelId))) {
      return res.status(409).json({ message: 'Este canal lo maneja el sistema de torneos; se borra solo cuando termina o se cancela el torneo.' })
    }
    const serverConfig = await DiscordServerConfig.getMain()
    const usedBy = Object.entries(DISCORD_CHANNEL_FUNCTIONS)
      .filter(([fn]) => serverConfig.channels?.[fn]?.channelId === channelId)
      .map(([, label]) => label)
    if (usedBy.length) {
      return res.status(409).json({ message: `Este canal se usa para: ${usedBy.join(', ')}. Quitale esa funcion antes de borrarlo.` })
    }
    const result = await deleteDiscordChannelViaCrm(channelId)
    await logChannelAction(req, 'delete', channelId, `Borro el canal ${result.name || channelId}`)
    res.json(result)
  } catch (error) { sendCrmError(res, error, next) }
}

// Ultimos cambios hechos a canales desde el panel.
export async function listDiscordChannelLog(req, res, next) {
  try {
    const filter = { module: 'discord-channels' }
    if (req.query.channelId) filter.targetId = String(req.query.channelId)
    const entries = await AdminActionLog.find(filter).sort({ createdAt: -1 }).limit(30).lean()
    res.json({ entries })
  } catch (error) { next(error) }
}

export async function getDiscordConfig(req, res, next) {
  try {
    const serverConfig = await DiscordServerConfig.getMain()
    res.json({ config: serverConfig, functions: DISCORD_CHANNEL_FUNCTIONS, types: PUBLICATION_TYPES })
  } catch (error) { next(error) }
}

// PATCH { channels: { news: { channelId, channelName }, ... } }
export async function updateDiscordConfig(req, res, next) {
  try {
    const input = req.body?.channels || {}
    const $set = { updatedBy: req.user._id }
    const { tournamentChannelIds } = await discordChannelGroups()
    for (const fn of Object.keys(DISCORD_CHANNEL_FUNCTIONS)) {
      if (input[fn] === undefined) continue
      const channelId = String(input[fn]?.channelId || '').trim()
      if (channelId && tournamentChannelIds.has(channelId)) {
        return res.status(409).json({ message: 'Los canales creados para torneos no se pueden usar como canales generales del servidor.' })
      }
      $set[`channels.${fn}.channelId`] = channelId
      $set[`channels.${fn}.channelName`] = String(input[fn]?.channelName || '').trim()
    }
    await DiscordServerConfig.getMain()
    const serverConfig = await DiscordServerConfig.findOneAndUpdate({ key: 'main' }, { $set }, { new: true })
    res.json({ config: serverConfig })
  } catch (error) { next(error) }
}

export async function listDiscordPublications(req, res, next) {
  try {
    const status = String(req.query.status || '').trim()
    const filter = PUBLICATION_STATUSES.includes(status) ? { status } : { status: { $ne: 'archived' } }
    const publications = await DiscordPublication.find(filter).sort({ createdAt: -1 }).limit(100).lean()
    res.json({ publications })
  } catch (error) { next(error) }
}

export async function createDiscordPublication(req, res, next) {
  try {
    const fields = pickPublicationFields(req.body)
    if (!fields.title) return res.status(400).json({ message: 'El titulo es obligatorio.' })
    if (!PUBLICATION_TYPES[fields.type]) return res.status(400).json({ message: 'Tipo de publicacion invalido.' })
    const publication = await createPublication({ ...fields, sourceType: 'manual' }, req.user._id)
    res.status(201).json({ publication })
  } catch (error) { next(error) }
}

// En cola: edita el borrador. Ya publicada: edita el mismo mensaje en Discord.
export async function updateDiscordPublication(req, res, next) {
  try {
    const publication = await DiscordPublication.findById(req.params.id)
    if (!publication) return res.status(404).json({ message: 'Publicacion no encontrada.' })
    const fields = pickPublicationFields(req.body)
    if (fields.type && !PUBLICATION_TYPES[fields.type]) return res.status(400).json({ message: 'Tipo de publicacion invalido.' })
    if (fields.title !== undefined && !fields.title) return res.status(400).json({ message: 'El titulo es obligatorio.' })

    if (publication.status === 'published') {
      for (const key of PUBLISHED_EDITABLE_FIELDS) {
        if (fields[key] !== undefined) publication[key] = fields[key]
      }
      await editPublishedPublication(publication)
      return res.json({ publication })
    }

    Object.assign(publication, fields)
    if (publication.status === 'failed') { publication.status = 'ready'; publication.error = '' }
    await publication.save()
    res.json({ publication })
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ message: error.message })
    sendCrmError(res, error, next)
  }
}

// Borra el mensaje de Discord y la publicacion vuelve a la cola.
export async function retractDiscordPublication(req, res, next) {
  try {
    const publication = await DiscordPublication.findById(req.params.id)
    if (!publication) return res.status(404).json({ message: 'Publicacion no encontrada.' })
    if (publication.status !== 'published') return res.status(409).json({ message: 'Esta publicacion no esta en Discord.' })
    await retractPublication(publication)
    res.json({ publication })
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ message: error.message })
    sendCrmError(res, error, next)
  }
}

export async function publishDiscordPublication(req, res, next) {
  try {
    const publication = await DiscordPublication.findById(req.params.id)
    if (!publication) return res.status(404).json({ message: 'Publicacion no encontrada.' })
    if (publication.status === 'published') return res.status(409).json({ message: 'Ya se publico en Discord.' })
    if (publication.status === 'archived') return res.status(409).json({ message: 'La publicacion esta archivada.' })
    await publishPublication(publication, req.user._id)
    // Siempre 200: si fallo, publication.status === 'failed' y publication.error
    // traen el motivo real para mostrarlo en el panel.
    res.json({ publication })
  } catch (error) { next(error) }
}

export async function archiveDiscordPublication(req, res, next) {
  try {
    const publication = await DiscordPublication.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'archived' } },
      { new: true },
    )
    if (!publication) return res.status(404).json({ message: 'Publicacion no encontrada.' })
    res.json({ publication })
  } catch (error) { next(error) }
}

// ── Plantillas de texto ──

const TEMPLATE_FIELDS = ['name', 'type', 'title', 'body', 'imageUrl', 'ctaLabel', 'ctaUrl']

function pickTemplateFields(body = {}) {
  const fields = {}
  for (const key of TEMPLATE_FIELDS) {
    if (body[key] !== undefined) fields[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
  }
  return fields
}

export async function listDiscordTemplates(req, res, next) {
  try {
    // La primera vez se siembran las plantillas base (editables/borrables).
    if (await DiscordTemplate.estimatedDocumentCount() === 0) {
      await DiscordTemplate.insertMany(DEFAULT_DISCORD_TEMPLATES.map(t => ({ ...t, builtIn: true })))
    }
    const templates = await DiscordTemplate.find().sort({ builtIn: -1, name: 1 }).lean()
    res.json({ templates })
  } catch (error) { next(error) }
}

export async function createDiscordTemplate(req, res, next) {
  try {
    const fields = pickTemplateFields(req.body)
    if (!fields.name) return res.status(400).json({ message: 'Ponle un nombre a la plantilla.' })
    if (fields.type && !PUBLICATION_TYPES[fields.type]) return res.status(400).json({ message: 'Tipo invalido.' })
    const template = await DiscordTemplate.create({ ...fields, createdBy: req.user._id })
    res.status(201).json({ template })
  } catch (error) { next(error) }
}

export async function updateDiscordTemplate(req, res, next) {
  try {
    const fields = pickTemplateFields(req.body)
    if (fields.type && !PUBLICATION_TYPES[fields.type]) return res.status(400).json({ message: 'Tipo invalido.' })
    const template = await DiscordTemplate.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true })
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada.' })
    res.json({ template })
  } catch (error) { next(error) }
}

export async function deleteDiscordTemplate(req, res, next) {
  try {
    const template = await DiscordTemplate.findByIdAndDelete(req.params.id)
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada.' })
    res.json({ ok: true })
  } catch (error) { next(error) }
}

// ── Automatizaciones (bienvenida, despedida, noticias) ──

const MEMBER_MESSAGE_FIELDS = ['enabled', 'channelId', 'channelName', 'title', 'message', 'imageUrl', 'color']

export async function getDiscordAutomations(req, res, next) {
  try {
    const serverConfig = await DiscordServerConfig.getMain()
    res.json({ automations: serverConfig.automations || {} })
  } catch (error) { next(error) }
}

// PATCH { welcome?: {...}, farewell?: {...}, welcomeDm?, newsAutoPublish? }
export async function updateDiscordAutomations(req, res, next) {
  try {
    const input = req.body || {}
    const current = await DiscordServerConfig.getMain()
    const $set = { updatedBy: req.user._id }
    for (const kind of ['welcome', 'farewell']) {
      if (!input[kind] || typeof input[kind] !== 'object') continue
      for (const key of MEMBER_MESSAGE_FIELDS) {
        if (input[kind][key] === undefined) continue
        $set[`automations.${kind}.${key}`] = key === 'enabled' ? Boolean(input[kind][key]) : String(input[kind][key] || '').trim()
      }
      const channelId = input[kind].channelId !== undefined ? String(input[kind].channelId || '').trim() : current.automations?.[kind]?.channelId
      const fallbackChannel = kind === 'farewell' ? current.automations?.welcome?.channelId : ''
      if (input[kind].enabled && !channelId && !fallbackChannel) {
        return res.status(400).json({ message: 'Elige un canal antes de activar este mensaje.' })
      }
    }
    for (const key of ['welcomeDm', 'newsAutoPublish']) {
      if (input[key] !== undefined) $set[`automations.${key}`] = Boolean(input[key])
    }
    const serverConfig = await DiscordServerConfig.findOneAndUpdate({ key: 'main' }, { $set }, { new: true, runValidators: true })
    res.json({ automations: serverConfig.automations })
  } catch (error) { next(error) }
}

// POST /automations/:kind/test — manda al canal configurado un ejemplo con
// los datos del admin, para ver como queda sin esperar a que entre alguien.
export async function testDiscordAutomation(req, res, next) {
  try {
    const kind = req.params.kind
    if (!['welcome', 'farewell'].includes(kind)) return res.status(400).json({ message: 'Tipo invalido.' })
    const serverConfig = await DiscordServerConfig.getMain()
    const cfg = serverConfig.automations?.[kind] || {}
    const channelId = cfg.channelId || (kind === 'farewell' ? serverConfig.automations?.welcome?.channelId : '')
    if (!channelId) return res.status(400).json({ message: 'Elige y guarda un canal primero.' })

    const name = req.user?.nick || req.user?.firstName || 'Admin'
    const values = { usuario: `@${name}`, nombre: name, nick: name, servidor: 'GlitchGang', miembros: '—' }
    const render = text => String(text || '').replace(/\{(usuario|nombre|nick|servidor|miembros)\}/gi, (_, key) => values[key.toLowerCase()])
    const fallbackTitle = kind === 'welcome' ? 'Bienvenido, {nombre}' : '{nombre} salio del servidor'
    const fallbackMessage = kind === 'welcome'
      ? 'Vincula tu cuenta de GlitchGang con /vincular para desbloquear tu rol.'
      : 'Esperamos verte pronto de nuevo.'

    const result = await publishToDiscordViaCrm({
      channelId,
      title: render(cfg.title || fallbackTitle),
      description: render(cfg.message || fallbackMessage),
      ...(await imagePayload(cfg.imageUrl)),
      color: cfg.color || (kind === 'welcome' ? '#20c997' : '#111827'),
      footer: 'Mensaje de prueba · Control Center GlitchGang',
    })
    res.json({ ok: true, channelName: result.channelName || cfg.channelName })
  } catch (error) { sendCrmError(res, error, next) }
}

// ── Foros ──

export async function listDiscordForumThreads(req, res, next) {
  try {
    res.json(await listDiscordForumThreadsViaCrm(req.params.id))
  } catch (error) { sendCrmError(res, error, next) }
}

export async function deleteDiscordThread(req, res, next) {
  try {
    const result = await deleteDiscordThreadViaCrm(req.params.id)
    // Si era una publicacion del panel, vuelve a la cola.
    await DiscordPublication.updateMany(
      { discordThreadId: req.params.id, status: 'published' },
      { $set: { status: 'ready', publishedAt: null, discordMessageId: '', discordChannelId: '', discordThreadId: '' } },
    )
    await logChannelAction(req, 'delete', req.params.id, `Borro el tema de foro ${result.name || req.params.id}`)
    res.json(result)
  } catch (error) { sendCrmError(res, error, next) }
}
