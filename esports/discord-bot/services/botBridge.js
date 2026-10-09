// ============================================
// GlitchGang CRM - Bot Bridge
// ============================================
// El CRM (api/server.js) corre en un proceso separado del bot (index.js) y
// no tiene acceso al Client vivo de discord.js. Para las pocas operaciones
// que todavia necesitan alcanzar al bot (anunciar en un canal, disparar el
// aprovisionamiento de un torneo) habla por HTTP con services/internalBotApi.js,
// que corre DENTRO del proceso del bot en localhost.
//
// Si el bot esta caido, estas llamadas fallan con un mensaje claro en vez
// de un 500 generico.

const PORT = Number(process.env.BOT_INTERNAL_PORT) || 3055;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const KEY = process.env.BOT_API_KEY || '';
const TIMEOUT_MS = Number(process.env.BOT_BRIDGE_TIMEOUT_MS || 45000);

async function request(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-glitchgang-bot-key': KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `El bot respondio ${res.status}`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error.cause?.code === 'ECONNREFUSED') {
      throw new Error('El bot de Discord no esta corriendo o no responde. Sin conexion en vivo no hay datos de canales/roles/voz.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  announce: (guildId, channelId, payload) => request('/announce', { method: 'POST', body: { guildId, channelId, ...payload } }),
  provisionTournament: (tournamentId) => request('/provision/tournaments', { method: 'POST', body: { tournamentId } }),
  getStatus: (guildId) => request(`/status?guildId=${encodeURIComponent(guildId || '')}`),
  getGuildChannels: (guildId) => request(`/guild/channels?guildId=${encodeURIComponent(guildId || '')}`),
  publish: (payload) => request('/publish', { method: 'POST', body: payload }),
  createChannel: (payload) => request('/guild/channels', { method: 'POST', body: payload }),
  editChannel: (channelId, payload) => request(`/guild/channels/${encodeURIComponent(channelId)}`, { method: 'PATCH', body: payload }),
  editMessage: (channelId, messageId, payload) => request(`/messages/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: payload }),
  deleteMessage: (guildId, channelId, messageId) => request(`/messages/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}?guildId=${encodeURIComponent(guildId || '')}`, { method: 'DELETE' }),
  listForumThreads: (guildId, forumId) => request(`/guild/forums/${encodeURIComponent(forumId)}/threads?guildId=${encodeURIComponent(guildId || '')}`),
  deleteThread: (guildId, threadId) => request(`/guild/threads/${encodeURIComponent(threadId)}?guildId=${encodeURIComponent(guildId || '')}`, { method: 'DELETE' }),
  deleteChannel: (guildId, channelId) => request(`/guild/channels/${encodeURIComponent(channelId)}?guildId=${encodeURIComponent(guildId || '')}`, { method: 'DELETE' }),
};
