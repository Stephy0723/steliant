// ============================================
// GlitchGang Bot - /torneo Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const backendApi = require('../services/backendApi');
const { baseEmbed, infoEmbed, errorEmbed, successEmbed, addFields, addSection } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');

function formatDate(iso) {
  if (!iso) return 'Por definir';
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:F>`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('torneo')
    .setDescription('Torneos de GlitchGang que se juegan por Discord')
    .addSubcommand((sub) => sub.setName('lista').setDescription('Lista los torneos disponibles'))
    .addSubcommand((sub) =>
      sub
        .setName('inscribir')
        .setDescription('Inscribe a tu equipo en un torneo (solo lider)')
        .addStringOption((opt) =>
          opt
            .setName('codigo')
            .setDescription('Codigo publico del torneo (ej: TOR-VAL-001-01)')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'lista') {
      let tournaments;
      try {
        ({ tournaments } = await backendApi.listTournaments(interaction.guildId));
      } catch (error) {
        return interaction.editReply({
          embeds: [errorEmbed('Error consultando torneos', 'No se pudo consultar la lista de torneos disponibles.')],
        });
      }

      if (!tournaments.length) {
        return interaction.editReply({
          embeds: [infoEmbed('Torneos', 'No hay torneos habilitados para Discord en este momento.')],
        });
      }

      const embed = baseEmbed({
        title: 'Torneos disponibles por Discord',
        color: COLORS.INFO,
        kicker: 'Torneos',
        description: 'Usa el codigo publico del torneo para inscribir tu equipo con `/torneo inscribir`.',
      });

      tournaments.slice(0, 8).forEach((t) => {
        addSection(embed, t.title, [
          `**Codigo:** \`${t.publicId}\``,
          `**Juego:** ${t.game || 'Por definir'}`,
          `**Fecha:** ${formatDate(t.date)}`,
          `**Cupo:** ${t.currentSlots}/${t.maxSlots}`,
          `**Estado:** ${t.status}`,
        ].join('\n'));
      });

      if (tournaments.length > 8) {
        addSection(embed, 'Mas torneos', `Hay ${tournaments.length - 8} torneo(s) adicional(es). Revisa el panel web para verlos todos.`);
      }

      addSection(embed, 'Inscripcion', '`/torneo inscribir codigo:CODIGO_DEL_TORNEO`');
      return interaction.editReply({ embeds: [embed] });
    }

    const codigo = interaction.options.getString('codigo');
    try {
      const result = await backendApi.registerTournament(interaction.user.id, codigo);
      const embed = successEmbed('Inscripcion exitosa', `Tu equipo quedo inscrito en **${result.tournament.title}**.`);
      addFields(embed, [
        { name: 'Torneo', value: result.tournament.title, inline: true },
        { name: 'Codigo', value: `\`${codigo}\``, inline: true },
        { name: 'Siguiente paso', value: 'Revisa avisos del servidor y prepara tu roster para `/checkin`.' },
      ]);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'No se pudo inscribir',
            error.message || 'Verifica el codigo del torneo y que seas el lider del equipo.'
          ),
        ],
      });
    }
  },
};
