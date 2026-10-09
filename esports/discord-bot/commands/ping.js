// ============================================
// GlitchGang Bot - /ping Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica que el bot este funcionando'),

  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = successEmbed(
      'Pong!',
      `**Latencia:** ${latency}ms\n**API:** ${apiLatency}ms`
    );

    await interaction.reply({ embeds: [embed] });
  },
};
