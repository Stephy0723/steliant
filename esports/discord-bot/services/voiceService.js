// ============================================
// GlitchGang Bot - Voice Service
// ============================================

const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { BOT_CONFIG } = require('../utils/constants');

/**
 * Joins a voice channel and waits for the connection to be ready.
 * @param {import('discord.js').VoiceChannel} channel
 * @returns {Promise<import('@discordjs/voice').VoiceConnection>}
 */
async function joinChannel(channel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, BOT_CONFIG.VOICE_CONNECT_TIMEOUT);
    console.log(`[Voice] Conectado a: ${channel.name} (${channel.guild.name})`);
    return connection;
  } catch (error) {
    connection.destroy();
    throw new Error(`No se pudo conectar al canal de voz: ${error.message}`);
  }
}

/**
 * Disconnects from a voice channel in a guild.
 * @param {import('@discordjs/voice').VoiceConnection} connection
 */
function leaveChannel(connection) {
  if (connection) {
    connection.destroy();
    console.log('[Voice] Desconectado del canal de voz');
  }
}

/**
 * Gets the voice channel a member is currently in.
 * @param {import('discord.js').GuildMember} member
 * @returns {import('discord.js').VoiceChannel|null}
 */
function getMemberVoiceChannel(member) {
  return member.voice?.channel || null;
}

module.exports = {
  joinChannel,
  leaveChannel,
  getMemberVoiceChannel,
};
