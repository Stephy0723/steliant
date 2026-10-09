// ============================================
// GlitchGang Bot - Alone Timer Service
// ============================================
// Cuando el bot queda solo en un canal de voz
// durante 2 minutos, cancela la operacion
// activa y se desconecta automaticamente.

const { getVoiceConnection } = require('@discordjs/voice');
const { cancelMatch, loadMatches } = require('./matchService');
const { clearCheckinTimer } = require('./checkinMonitor');
const { pushActivity } = require('./activityService');
const { warningEmbed } = require('../utils/embeds');
const { MATCH_STATUS } = require('../utils/constants');

const ALONE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos

/** @type {Map<string, { timer: NodeJS.Timeout, channelId: string }>} */
const aloneTimers = new Map();

/**
 * Cancels the alone timer for a guild without taking any action.
 * @param {string} guildId
 */
function clearAloneTimer(guildId) {
  const entry = aloneTimers.get(guildId);
  if (!entry) return;
  clearTimeout(entry.timer);
  aloneTimers.delete(guildId);
  console.log(`[AloneTimer] Timer cancelado para guild ${guildId}.`);
}

/**
 * Returns true if an alone timer is active for this guild.
 * @param {string} guildId
 */
function hasAloneTimer(guildId) {
  return aloneTimers.has(guildId);
}

/**
 * Fires when the 2-minute alone window expires.
 * Cancels any active match/checkin and disconnects the bot.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} voiceChannelId
 */
async function handleAloneTimeout(client, guildId, voiceChannelId) {
  // Disconnect from voice first
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
    console.log(`[AloneTimer] Bot desconectado del canal ${voiceChannelId} (guild ${guildId}).`);
  }

  // Find active operation in that voice channel
  const matches = loadMatches();
  const activeMatch = matches.find(
    (m) =>
      m.guildId === guildId &&
      m.voiceChannelId === voiceChannelId &&
      [MATCH_STATUS.CHECKING_IN, MATCH_STATUS.READY, MATCH_STATUS.IN_PROGRESS].includes(m.status)
  );

  if (!activeMatch) return;

  const reason = 'El bot quedo solo en el canal de voz por mas de 2 minutos.';
  const cancelled = cancelMatch(activeMatch.id, reason);
  if (!cancelled) return;

  // Clear checkin timer if it was a checkin
  clearCheckinTimer(activeMatch.id);

  pushActivity(
    'auto-cancel-alone',
    `Operacion del equipo "${activeMatch.teamName}" cancelada automaticamente: el bot quedo solo en el canal de voz por 2 minutos.`,
    'Sistema'
  );

  console.log(`[AloneTimer] Operacion cancelada: ${activeMatch.id} (${activeMatch.teamName})`);

  // Notify the text channel
  const notifChannelId = activeMatch.notificationChannelId || activeMatch.channelId;
  if (!notifChannelId) return;

  const channel = await client.channels.fetch(notifChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = warningEmbed(
    'Operacion cancelada automaticamente',
    [
      `La operacion del equipo **${activeMatch.teamName}** fue cancelada por el sistema.`,
      '',
      `El bot quedo **solo en el canal de voz por 2 minutos** sin jugadores presentes.`,
      '',
      'Si necesitan continuar, inicien un nuevo `/checkin`.',
    ].join('\n')
  );

  await channel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * Starts a 2-minute alone timer for the bot in a voice channel.
 * If someone rejoins before it fires, call clearAloneTimer().
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} channelId
 */
function startAloneTimer(client, guildId, channelId) {
  clearAloneTimer(guildId);

  const timer = setTimeout(() => {
    aloneTimers.delete(guildId);
    void handleAloneTimeout(client, guildId, channelId);
  }, ALONE_TIMEOUT_MS);

  aloneTimers.set(guildId, { timer, channelId });
  console.log(`[AloneTimer] Bot solo en canal ${channelId}. Cancelando operacion en 2 min si nadie regresa.`);
}

module.exports = {
  startAloneTimer,
  clearAloneTimer,
  hasAloneTimer,
};
