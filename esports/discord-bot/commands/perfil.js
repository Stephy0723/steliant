// ============================================
// GlitchGang Bot - /perfil Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { baseEmbed, addFields, addSection } = require('../utils/embeds');
const { COLORS, EMOJI } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Muestra tu perfil de jugador en GlitchGang'),

  async execute(interaction) {

    const profile = interaction.glitchgangProfile || await backendApi.getPlayerProfile(interaction.user.id);

    const embed = baseEmbed({
      title: `${EMOJI.PERSON} Perfil competitivo`,
      color: COLORS.PRIMARY,
      kicker: interaction.user.displayName || interaction.user.username,
      description: `Informacion vinculada a tu cuenta de GlitchGang.`,
    });
    embed.setThumbnail(interaction.user.displayAvatarURL({ size: 128 }));

    addFields(embed, [
      { name: 'GlitchGang ID', value: profile.playerCode, inline: true },
      { name: 'Nick', value: profile.nick, inline: true },
      { name: 'Rol', value: profile.role || 'player', inline: true },
    ]);

    if (profile.team) {
      addFields(embed, [
        { name: 'Equipo', value: `${profile.team.name} (${profile.team.tag})`, inline: true },
        { name: 'Codigo del equipo', value: profile.team.publicCode, inline: true },
        { name: 'Posicion', value: profile.team.isLeader ? 'Lider' : 'Jugador', inline: true },
      ]);
    } else {
      addSection(embed, 'Equipo', 'Sin equipo. Usa `/equipo crear` o `/registrar` con un codigo de invitacion.');
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
