// ============================================
// GlitchGang Bot - Message Create Event
// Responde con IA cuando mencionan al bot (@bot) o le escriben por DM.
// ============================================

const { Events } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');
const aiService = require('../services/aiService');
const tournamentService = require('../services/tournamentService');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignora mensajes de bots (incluido el propio)
    if (message.author?.bot) return;

    const isDM = !message.guild;
    const mentioned = message.mentions?.has?.(message.client.user);

    // Solo actúa por DM o cuando mencionan al bot
    if (!isDM && !mentioned) return;

    // Quita la mención del texto para quedarnos con la pregunta
    const question = message.content.replace(/<@!?\d+>/g, '').trim()
      || '¿En qué puedo ayudarte con el torneo?';

    try {
      await message.channel.sendTyping().catch(() => {});
      const tournament = message.guild
        ? await tournamentService.getActiveTournament(message.guild.id, message.channelId).catch(() => null)
        : null;
      const { answer, provider } = await aiService.ask(question, tournament);

      const embed = baseEmbed({
        title: '🤖 GlitchGang IA',
        description: answer,
        color: COLORS.INFO,
      }).setFooter({ text: `Respuesta IA · ${provider || 'glitchgang'}` });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('[messageCreate] Error IA:', error.message);
      await message
        .reply('⚠️ La IA no está disponible ahora mismo. Prueba `/ayuda` o inténtalo en unos segundos.')
        .catch(() => {});
    }
  },
};
