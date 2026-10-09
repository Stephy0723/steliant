// ============================================
// GlitchGang Bot - Panel general de torneos disponibles
// ============================================
// Un solo mensaje fijo (editado in-place) en un canal del servidor
// compartido, listando los torneos abiertos/en curso con link a la web
// para inscribirse -- distinto de los canales especificos de cada torneo
// (esos solo existen una vez que ya estas dentro). El admin elige el canal
// corriendo /torneos-panel; a partir de ahi se refresca solo.

const backendApi = require('./backendApi');
const discordGuild = require('./discordGuildService');
const { tournamentsPanelEmbed } = require('../utils/tournamentAnnounceEmbeds');

const PANEL_STATUSES = new Set(['open', 'ongoing']);

/**
 * Reconstruye y publica/edita el panel de torneos de un servidor, si ya
 * tiene un canal configurado (via /torneos-panel). No-op silencioso si
 * todavia no se configuro nada -- no es un error, solo "nadie lo pidio".
 * @param {string} guildId
 * @returns {Promise<boolean>} true si se publico/actualizo algo
 */
async function refreshTournamentsPanel(guildId) {
  const org = await backendApi.getOrganization(guildId).catch(() => null);
  const channelId = org?.tournamentsPanelChannelId;
  if (!channelId) return false;

  const { tournaments } = await backendApi.listTournaments(guildId);
  const open = (tournaments || []).filter((t) => PANEL_STATUSES.has(t.status));
  const embed = tournamentsPanelEmbed(open);

  const result = await discordGuild.upsertPinnedEmbed(guildId, channelId, org.tournamentsPanelMessageId, embed);
  if (result.id !== org.tournamentsPanelMessageId) {
    await backendApi.updateOrganizationTournamentsPanel(guildId, channelId, result.id).catch(() => {});
  }
  return true;
}

module.exports = { refreshTournamentsPanel };
