// ============================================
// GlitchGang Bot - /preguntar Command
// Dudas en lenguaje natural respondidas por la IA (Claude + Gemini),
// ancladas a las reglas del sistema y al torneo activo.
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed, errorEmbed } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');
const aiService = require('../services/aiService');
const tournamentService = require('../services/tournamentService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('preguntar')
    .setDescription('Pregunta cualquier duda del torneo y la IA te responde')
    .addStringOption((option) =>
      option
        .setName('pregunta')
        .setDescription('Escribe tu duda (ej: ¿cuánto tiempo tengo para el check-in?)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('pregunta');
    await interaction.deferReply({ ephemeral: true });

    try {
      const tournament = await tournamentService.getActiveTournament(interaction.guildId, interaction.channelId).catch(() => null);
      const { answer, provider } = await aiService.ask(question, tournament);

      const embed = baseEmbed({
        title: '🤖 GlitchGang IA',
        description: answer,
        color: COLORS.INFO,
      }).setFooter({ text: `Respuesta IA · ${provider || 'glitchgang'}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[/preguntar] Error:', error.message);
      await interaction.editReply({
        embeds: [
          errorEmbed(
            'IA no disponible',
            'No pude consultar al asistente en este momento. Usa `/ayuda` o inténtalo de nuevo en unos segundos.'
          ),
        ],
      });
    }
  },
};
