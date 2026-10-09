// ============================================
// GlitchGang Bot - /equipo Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { baseEmbed, errorEmbed, infoEmbed, addFields, addSection } = require('../utils/embeds');
const { COLORS, EMOJI } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equipo')
    .setDescription('Gestion de tu equipo en GlitchGang')
    .addSubcommand((sub) =>
      sub
        .setName('crear')
        .setDescription('Crea un nuevo equipo')
        .addStringOption((opt) =>
          opt.setName('nombre').setDescription('Nombre del equipo').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('tag').setDescription('Tag del equipo (3-4 caracteres)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('codigo').setDescription('Muestra el codigo de invitacion de tu equipo (solo lider)')
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Muestra el roster de tu equipo')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'crear') {
      const nombre = interaction.options.getString('nombre');
      const tag = interaction.options.getString('tag');

      try {
        const team = await backendApi.createTeam(interaction.user.id, { name: nombre, tag });
        const embed = baseEmbed({
          title: `${EMOJI.CHECK} Equipo creado`,
          color: COLORS.SUCCESS,
          kicker: 'Team setup',
          description: `**${team.name}** (${team.tag}) ya esta listo en GlitchGang.`,
        });

        addFields(embed, [
          { name: 'Codigo publico', value: team.publicCode, inline: true },
          { name: 'Invitacion', value: `\`${team.teamInviteCode}\``, inline: true },
          { name: 'Compartir', value: `Tus jugadores se unen con \`/registrar codigo:${team.teamInviteCode}\`.` },
        ]);

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        return interaction.editReply({
          embeds: [errorEmbed('No se pudo crear el equipo', error.message || 'Intenta con otro nombre o tag.')],
        });
      }
    }

    let team;
    try {
      team = await backendApi.getMyTeam(interaction.user.id);
    } catch (error) {
      return interaction.editReply({ embeds: [errorEmbed('Error', 'No se pudo consultar tu equipo.')] });
    }

    if (!team) {
      return interaction.editReply({
        embeds: [
          infoEmbed(
            'Sin equipo',
            'No perteneces a ningun equipo. Crea uno con `/equipo crear` o unete con `/registrar codigo:CODIGO`.'
          ),
        ],
      });
    }

    if (subcommand === 'codigo') {
      if (!team.isLeader) {
        return interaction.editReply({
          embeds: [errorEmbed('Sin permiso', `Solo el lider de **${team.name}** puede ver el codigo de invitacion.`)],
        });
      }

      const embed = baseEmbed({
        title: `${EMOJI.LINK} Codigo de invitacion`,
        color: COLORS.INFO,
        kicker: team.name,
        description: 'Comparte este codigo solo con jugadores que pertenezcan a tu roster.',
      });
      addSection(embed, 'Codigo', `\`\`\`${team.inviteCode}\`\`\``);
      addSection(embed, 'Comando para jugadores', `\`/registrar codigo:${team.inviteCode}\``);

      return interaction.editReply({ embeds: [embed] });
    }

    const embed = baseEmbed({
      title: `${EMOJI.PEOPLE} ${team.name}`,
      color: COLORS.PRIMARY,
      kicker: 'Roster del equipo',
      description: `Codigo publico: **${team.publicCode}**`,
    });

    const lines = team.members.map((m) => {
      const leader = m.isLeader ? ` ${EMOJI.CROWN}` : '';
      return `**${m.nick}**${leader}\n\`${m.playerCode}\``;
    });

    addSection(embed, `Roster (${team.members.length})`, lines.join('\n\n') || 'Sin miembros.');
    addSection(embed, 'Tu posicion', team.isLeader ? 'Lider' : 'Jugador', true);

    return interaction.editReply({ embeds: [embed] });
  },
};
