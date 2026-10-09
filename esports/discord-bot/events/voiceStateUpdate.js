// ============================================
// GlitchGang Bot - Voice State Update Event
// ============================================

const { Events } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { startAloneTimer, clearAloneTimer, hasAloneTimer } = require('../services/aloneTimer');
const voiceMonitor = require('../services/voiceMonitor');

module.exports = {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member) return;

    // ── Tracking persistente (SQLite) ────────
    voiceMonitor.trackEvent(oldState, newState);

    // ── Logging (solo miembros, no bots) ────────
    if (!member.user.bot) {
      const joined = !oldState.channelId && newState.channelId;
      const left = oldState.channelId && !newState.channelId;
      const moved =
        oldState.channelId &&
        newState.channelId &&
        oldState.channelId !== newState.channelId;

      if (joined) {
        console.log(`[Voice] ${member.displayName} se unio a: ${newState.channel.name}`);
      } else if (left) {
        console.log(`[Voice] ${member.displayName} salio de: ${oldState.channel.name}`);
      } else if (moved) {
        console.log(
          `[Voice] ${member.displayName} se movio de ${oldState.channel.name} a ${newState.channel.name}`
        );
      }
    }

    // ── Logica de "bot solo" ─────────────────────
    // Solo nos importa cuando un miembro (no-bot) entra o sale.
    if (member.user.bot) return;

    const guild = oldState.guild || newState.guild;
    if (!guild) return;

    const connection = getVoiceConnection(guild.id);
    if (!connection) return; // El bot no esta en ningun canal

    const botChannelId = connection.joinConfig?.channelId;
    if (!botChannelId) return;

    // El cambio debe afectar al canal donde esta el bot
    const affectedChannelId = oldState.channelId || newState.channelId;
    if (affectedChannelId !== botChannelId) {
      // Si alguien entra a otro canal, no hacer nada.
      // Pero si el canal del bot queda vacio por un movimiento, la siguiente
      // condicion lo detecta via el canal del bot directamente.
      const botChannel = guild.channels.cache.get(botChannelId);
      if (!botChannel) return;
      const nonBotMembers = botChannel.members.filter((m) => !m.user.bot);
      if (nonBotMembers.size > 0 && hasAloneTimer(guild.id)) {
        clearAloneTimer(guild.id);
      }
      return;
    }

    // Contar miembros no-bot en el canal del bot
    const botChannel = guild.channels.cache.get(botChannelId);
    if (!botChannel) return;

    const nonBotMembers = botChannel.members.filter((m) => !m.user.bot);

    if (nonBotMembers.size === 0) {
      // Bot quedo solo — iniciar countdown de 2 minutos
      startAloneTimer(member.client, guild.id, botChannelId);
    } else {
      // Hay alguien en el canal — cancelar countdown si estaba activo
      if (hasAloneTimer(guild.id)) {
        clearAloneTimer(guild.id);
      }
    }
  },
};
