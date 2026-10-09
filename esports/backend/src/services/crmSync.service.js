const CRM_BASE_URL = (process.env.CRM_PORTAL_URL || process.env.DISCORD_CRM_URL || process.env.CRM_URL || 'http://localhost:3000').replace(/\/$/, '')
const CRM_TOKEN = process.env.GLITCHGANG_SITE_TOKEN || process.env.INTERNAL_API_TOKEN || process.env.BOT_API_KEY || ''
const TIMEOUT_MS = Number(process.env.CRM_SYNC_TIMEOUT_MS || 45000)

function iso(value) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function tournamentPayload(tournament, organizer) {
  return {
    id: String(tournament._id),
    externalId: String(tournament._id),
    publicId: tournament.publicId,
    code: tournament.tournamentCode,
    name: tournament.title,
    game: tournament.game,
    format: tournament.format,
    modality: tournament.modality,
    platform: tournament.platform,
    region: tournament.region,
    slots: tournament.maxSlots,
    filledSlots: tournament.currentSlots,
    prize: tournament.prizePool,
    currency: tournament.currency,
    date: iso(tournament.date),
    registrationStart: iso(tournament.registrationWindow?.start),
    registrationEnd: iso(tournament.registrationWindow?.end),
    status: tournament.status,
    active: tournament.status === 'open' || tournament.status === 'ongoing',
    makeActive: false,
    botEnabled: Boolean(tournament.discordEnabled),
    useBot: Boolean(tournament.discordEnabled),
    voiceAutomation: false,
    sourceType: 'glitchgang-web',
    source: {
      type: 'glitchgang-web',
      externalId: String(tournament._id),
      createdBy: 'GlitchGang Web',
    },
    organizer: {
      type: 'glitchgang',
      name: tournament.organizerBrandName || organizer?.nick || organizer?.email || 'GlitchGang',
      contactName: organizer?.nick || '',
      email: organizer?.email || '',
      websiteId: String(organizer?._id || tournament.organizer || ''),
    },
    bot: {
      enabled: Boolean(tournament.discordEnabled),
      commandsEnabled: Boolean(tournament.discordEnabled),
      voiceAutomation: false,
      status: 'pending',
    },
  }
}

function userPayload(user, source) {
  return {
    id: String(user.id || user._id),
    playerCode: user.playerCode,
    nick: user.nick,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    discord: { id: user.discord?.id || '', username: user.discord?.username || '' },
    source: { type: source, channel: source },
    registeredAt: iso(user.createdAt),
  }
}

// Fire-and-forget: la sincronización de visibilidad nunca debe bloquear
// el registro, inicio de sesión ni la vinculación de Discord.
export function syncUserToCrm(user, source = 'glitchgang-web') {
  if (!CRM_TOKEN) return

  fetch(`${CRM_BASE_URL}/portal/users/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-glitchgang-site-key': CRM_TOKEN,
    },
    body: JSON.stringify({ user: userPayload(user, source) }),
  }).catch((err) => {
    console.error('[crmSync] syncUserToCrm fallo (no bloqueante):', err.message)
  })
}

export async function syncTournamentCreatedToCrm(tournament, organizer) {
  if (!CRM_TOKEN) {
    throw new Error('Falta GLITCHGANG_SITE_TOKEN/INTERNAL_API_TOKEN para sincronizar con el CRM.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${CRM_BASE_URL}/portal/tournaments/sync`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-glitchgang-site-key': CRM_TOKEN,
      },
      body: JSON.stringify({ tournament: tournamentPayload(tournament, organizer) }),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || data.message || `CRM respondio ${response.status}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

// ── Control Center del servidor general de Discord (/admin/discord-sync) ──
// Web -> CRM -> bot. El backend nunca habla directo con el bot.
async function crmRequest(path, { method = 'GET', body } = {}) {
  if (!CRM_TOKEN) {
    throw Object.assign(new Error('Falta GLITCHGANG_SITE_TOKEN en el backend para hablar con el CRM de Discord.'), { status: 503 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${CRM_BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-glitchgang-site-key': CRM_TOKEN,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      // El CRM contesto: el fallo es suyo o del bot detras (crmReachable).
      throw Object.assign(new Error(data.error || data.message || `CRM respondio ${response.status}`), { status: 502, crmReachable: true })
    }
    return data
  } catch (error) {
    if (error.status) throw error
    const reason = error.name === 'AbortError' ? 'no respondio a tiempo' : 'no esta corriendo o no responde'
    throw Object.assign(new Error(`El CRM de Discord (${CRM_BASE_URL}) ${reason}.`), { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}

function guildQuery(guildId) {
  const id = guildId || process.env.DISCORD_GUILD_ID || ''
  return id ? `?guildId=${encodeURIComponent(id)}` : ''
}

export const getDiscordServerFromCrm = (guildId) => crmRequest(`/portal/discord/server${guildQuery(guildId)}`)
export const getDiscordChannelsFromCrm = (guildId) => crmRequest(`/portal/discord/channels${guildQuery(guildId)}`)
export const publishToDiscordViaCrm = (payload) => crmRequest('/portal/discord/publish', {
  method: 'POST',
  body: { ...payload, guildId: payload.guildId || process.env.DISCORD_GUILD_ID || '' },
})
export const createDiscordChannelViaCrm = (payload) => crmRequest('/portal/discord/channels', {
  method: 'POST',
  body: { ...payload, guildId: process.env.DISCORD_GUILD_ID || '' },
})
export const editDiscordChannelViaCrm = (channelId, payload) => crmRequest(`/portal/discord/channels/${encodeURIComponent(channelId)}`, {
  method: 'PATCH',
  body: { ...payload, guildId: process.env.DISCORD_GUILD_ID || '' },
})
export const deleteDiscordChannelViaCrm = (channelId) => crmRequest(`/portal/discord/channels/${encodeURIComponent(channelId)}${guildQuery()}`, {
  method: 'DELETE',
})
export const editDiscordMessageViaCrm = (channelId, messageId, payload) => crmRequest(`/portal/discord/messages/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`, {
  method: 'PATCH',
  body: { ...payload, guildId: process.env.DISCORD_GUILD_ID || '' },
})
export const deleteDiscordMessageViaCrm = (channelId, messageId) => crmRequest(`/portal/discord/messages/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}${guildQuery()}`, {
  method: 'DELETE',
})
export const listDiscordForumThreadsViaCrm = (forumId) => crmRequest(`/portal/discord/forums/${encodeURIComponent(forumId)}/threads${guildQuery()}`)
export const deleteDiscordThreadViaCrm = (threadId) => crmRequest(`/portal/discord/threads/${encodeURIComponent(threadId)}${guildQuery()}`, {
  method: 'DELETE',
})
