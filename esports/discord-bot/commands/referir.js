// ============================================
// GlitchGang Bot - /referir Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('referir')
    .setDescription('Muestra tu codigo de referido de GlitchGang'),

  async execute(interaction) {

    try {
      const { referralCode, registerUrl } = await backendApi.getReferralCode(interaction.user.id);

      const embed = successEmbed(
        'Tu codigo de referido',
        [
          `Codigo: \`${referralCode}\``,
          '',
          `Enlace de registro: ${registerUrl}`,
          '',
          'Comparte este enlace o codigo. Cuando alguien se registre con el, quedara vinculado a tu cuenta.',
        ].join('\n')
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'No se pudo obtener tu codigo de referido. Intenta de nuevo.')],
      });
    }
  },
};
