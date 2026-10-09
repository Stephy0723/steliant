// ============================================
// GlitchGang Bot - /vincular Command
// ============================================
// Conecta la cuenta de Discord del jugador con su cuenta de GlitchGang.
// Es el paso obligatorio antes de usar /perfil, /referir, /registrar,
// /equipo o /torneo (ver events/interactionCreate.js).

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { errorEmbed, infoEmbed, linkPromptEmbed, addSection } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula tu cuenta de Discord con tu cuenta de GlitchGang'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await backendApi.linkStart(interaction.user.id, interaction.user.username);

      if (result.alreadyLinked) {
        const embed = infoEmbed(
          'Discord ya esta vinculado',
          `Tu cuenta esta conectada a **${result.nick}**.`
        );
        addSection(embed, 'GlitchGang ID', `\`${result.playerCode}\``, true);
        addSection(embed, 'Siguiente paso', 'Usa `/perfil` para revisar tu cuenta o `/torneo lista` para ver torneos disponibles.');

        return interaction.editReply({
          embeds: [embed],
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('Vincular ahora')
          .setURL(result.url),
      );

      await interaction.editReply({
        embeds: [linkPromptEmbed(result)],
        components: [row],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            'No se pudo iniciar la vinculacion',
            'Intenta de nuevo en unos minutos. Si sigue pasando, revisa que la API de GlitchGang este en linea.'
          ),
        ],
      });
    }
  },
};
