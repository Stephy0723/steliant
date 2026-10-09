import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { UPLOAD_DIR } from '../controllers/upload.controller.js'
import { DiscordPublication, PUBLICATION_TYPES } from '../models/DiscordPublication.js'
import { DISCORD_CHANNEL_FUNCTIONS, DiscordServerConfig } from '../models/DiscordServerConfig.js'
import { reserveSequence } from './codes.service.js'
import { deleteDiscordMessageViaCrm, editDiscordMessageViaCrm, publishToDiscordViaCrm } from './crmSync.service.js'

const TYPE_COLORS = {
  news: '#7c5cff',
  announcement: '#00e5ff',
  banner: '#00e5ff',
  brand: '#ffb020',
  sponsor: '#ffb020',
  version: '#00e676',
  rules: '#ff4d5e',
  registration: '#7c5cff',
}

// Primer origen de CLIENT_ORIGIN (puede venir separado por comas).
export function siteUrl(path = '') {
  const origin = String(config.clientOrigin || '').split(',')[0].trim().replace(/\/$/, '')
  if (!path) return origin
  if (/^https?:\/\//i.test(path)) return path
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
}

async function nextPublicId() {
  const year = new Date().getUTCFullYear()
  return `PUB-${year}-${await reserveSequence(`discord-publication-${year}`, 4)}`
}

export async function createPublication(fields, userId = null) {
  return DiscordPublication.create({
    ...fields,
    publicId: await nextPublicId(),
    createdBy: userId,
    status: 'ready',
  })
}

/**
 * Deja en cola (status 'ready') una publicacion para algo creado en la web.
 * Idempotente por origen: si ya hay una en cola se actualiza su contenido; si
 * ya se publico o se archivo no se crea otra (el admin decide re-publicar).
 * Nunca lanza: la cola de Discord no debe romper el guardado de la noticia.
 */
export async function queuePublicationForSource({ sourceType, sourceId, ...fields }, userId = null) {
  try {
    const existing = await DiscordPublication.findOne({ sourceType, sourceId: String(sourceId) })
    if (existing) {
      if (existing.status !== 'ready' && existing.status !== 'failed') return existing
      Object.assign(existing, fields)
      return await existing.save()
    }
    return await createPublication({ ...fields, sourceType, sourceId: String(sourceId) }, userId)
  } catch (error) {
    console.error(`[discordPublications] No se pudo encolar ${sourceType}/${sourceId}:`, error.message)
    return null
  }
}

export async function resolveTargetChannel(publication) {
  if (publication.targetChannelId) {
    return { channelId: publication.targetChannelId, channelName: publication.channelName }
  }
  const serverConfig = await DiscordServerConfig.getMain()
  const fn = PUBLICATION_TYPES[publication.type]
  const mapped = serverConfig.channels?.[fn]
  return { channelId: mapped?.channelId || '', channelName: mapped?.channelName || '', fn }
}

// Una imagen subida a la web (/uploads/x.png) vive en este servidor y Discord
// no la puede descargar (en local es localhost). Se manda el archivo dentro
// del payload y el bot la adjunta al mensaje. URLs externas se pasan tal cual.
export async function imagePayload(imageUrl) {
  if (!imageUrl) return {}
  const match = /^\/uploads\/([^/?#]+)$/.exec(imageUrl)
  if (!match) return { imageUrl: siteUrl(imageUrl) }
  const name = path.basename(match[1])
  const buffer = await fs.readFile(path.join(UPLOAD_DIR, name))
  return { imageData: buffer.toString('base64'), imageName: name }
}

// Lo que viaja al bot para crear o editar el mensaje.
async function messagePayload(publication) {
  return {
    title: publication.title,
    description: publication.body,
    url: publication.url ? siteUrl(publication.url) : '',
    ...(await imagePayload(publication.imageUrl)),
    ctaLabel: publication.ctaLabel,
    ctaUrl: publication.ctaUrl ? siteUrl(publication.ctaUrl) : '',
    color: publication.color || TYPE_COLORS[publication.type],
    footer: `GlitchGang · ${publication.publicId}`,
  }
}

// Web -> CRM -> bot. Marca la publicacion como published/failed con el
// motivo real, para que el panel lo muestre.
export async function publishPublication(publication, userId = null) {
  const target = await resolveTargetChannel(publication)
  if (!target.channelId) {
    publication.status = 'failed'
    publication.error = `No hay canal asignado para "${DISCORD_CHANNEL_FUNCTIONS[target.fn] || target.fn}". Asignalo en la pestaña Canales.`
    await publication.save()
    return publication
  }

  try {
    const result = await publishToDiscordViaCrm({
      channelId: target.channelId,
      ...(await messagePayload(publication)),
      appliedTags: publication.appliedTags || [],
    })
    publication.status = 'published'
    publication.publishedAt = new Date()
    publication.publishedBy = userId
    publication.discordMessageId = result.id || ''
    publication.discordThreadId = result.threadId || ''
    // En un foro el mensaje vive dentro del tema.
    publication.discordChannelId = result.threadId || result.channelId || target.channelId
    publication.channelName = result.channelName || target.channelName
    publication.error = ''
  } catch (error) {
    publication.status = 'failed'
    publication.error = error.message
  }
  await publication.save()
  return publication
}

// Publicaciones viejas (antes de guardar discordChannelId) solo tienen el
// canal destino; sirve igual para mensajes normales, no para temas de foro.
function publishedLocation(publication) {
  const channelId = publication.discordChannelId || publication.discordThreadId || publication.targetChannelId
  if (!channelId || !publication.discordMessageId) {
    throw Object.assign(new Error('No se sabe en que mensaje de Discord quedo esta publicacion; retirala a mano en Discord.'), { status: 409 })
  }
  return { channelId, messageId: publication.discordMessageId }
}

// Edita en Discord una publicacion ya enviada (mismo mensaje, mismo id).
export async function editPublishedPublication(publication) {
  const { channelId, messageId } = publishedLocation(publication)
  await editDiscordMessageViaCrm(channelId, messageId, await messagePayload(publication))
  await publication.save()
  return publication
}

// Borra el mensaje (o el tema de foro) de Discord y la deja otra vez en cola,
// por si se quiere volver a publicar corregida.
export async function retractPublication(publication) {
  const { channelId, messageId } = publishedLocation(publication)
  await deleteDiscordMessageViaCrm(channelId, messageId)
  publication.status = 'ready'
  publication.publishedAt = null
  publication.discordMessageId = ''
  publication.discordChannelId = ''
  publication.discordThreadId = ''
  publication.error = ''
  await publication.save()
  return publication
}
