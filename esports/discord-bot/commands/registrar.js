// ============================================
// GlitchGang Bot - /registrar Command
// ============================================
// Une al jugador (ya vinculado) a un equipo real de GlitchGang usando su
// codigo de invitacion (Team.teamInviteCode en el backend).

const { SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { errorEmbed, baseEmbed } = require('../utils/embeds');
const { COLORS, EMOJI } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registrar')
    .setDescription('Unete a un equipo de GlitchGang con su codigo de invitacion')
    .addStringOption((opt) =>
      opt
        .setName('codigo')
        .setDescription('Codigo de invitacion del equipo (8 caracteres, ej: 862A4CDF)')
        .setRequired(true)
        .setMinLength(8)
        .setMaxLength(8)
    ),

  async execute(interaction) {

    const inviteCode = interaction.options.getString('codigo').trim().toUpperCase();

    try {
      const result = await backendApi.joinTeam(interaction.user.id, inviteCode);

      const embed = baseEmbed({
        title: `${EMOJI.CHECK} Te uniste al equipo`,
        color: COLORS.SUCCESS,
        description: `Bienvenido a **${result.team.name}** (${result.team.tag}).`,
      });
      embed.addFields({ name: 'Codigo del equipo', value: result.team.publicCode, inline: true });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed(
          'No se pudo unir al equipo',
          error.message || 'Codigo invalido o el equipo esta lleno.'
        )],
      });
    }
  },
};
