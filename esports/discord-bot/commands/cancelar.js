// ============================================
// GlitchGang Bot - /cancelar Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { getActiveTournament } = require('../services/tournamentService');
const { cancelMatch, findActiveMatch, findOpenCheckin } = require('../services/liveMatchService');
const { clearCheckinTimer } = require('../services/checkinMonitor');
const { pushActivity } = require('../services/activityService');
const eventChannels = require('../services/eventChannels');
const matchRecorder = require('../services/matchRecorder');
const { getVoiceMembers, selectTeam } = require('../utils/matching');
const { getMemberVoiceChannel } = require('../services/voiceService');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { MATCH_STATUS } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelar')
    .setDescription('Cancela la partida o check-in activo de tu equipo')
    .addStringOption((opt) =>
      opt.setName('equipo')
        .setDescription('Nombre del equipo (solo si no se detecta automático)')
    )
    .addStringOption((opt) =>
      opt.setName('motivo')
        .setDescription('Motivo de la cancelación')
    ),

  async execute(interaction) {

    const tournament = await getActiveTournament(interaction.guildId, interaction.channelId);
    if (!tournament) {
      return interaction.editReply({
        embeds: [errorEmbed('Sin torneo activo', 'No se encontró un torneo activo en el CRM.')],
      });
    }

    const voiceChannel = getMemberVoiceChannel(interaction.member);
    const voiceMembers = voiceChannel ? getVoiceMembers(voiceChannel) : [];
    const requestedName = interaction.options.getString('equipo');

    const { team, reason } = selectTeam({
      teams: tournament.teams,
      requestedName,
      channelName: voiceChannel?.name,
      voiceMembers,
    });

    if (!team) {
      return interaction.editReply({
        embeds: [errorEmbed('Equipo no identificado', reason)],
      });
    }

    const motivo = interaction.options.getString('motivo') || 'Cancelado manualmente por el equipo.';

    // Try to find an active match (in_progress) first, then an open check-in
    const activeMatch = await findActiveMatch(team.id);
    const openCheckin = !activeMatch ? await findOpenCheckin(team.id) : null;
    const target = activeMatch || openCheckin;

    if (!target) {
      return interaction.editReply({
        embeds: [errorEmbed(
          'Sin operación activa',
          `El equipo **${team.name}** no tiene ninguna partida ni check-in activo que cancelar.`
        )],
      });
    }

    clearCheckinTimer(target.id);
    const cancelled = await cancelMatch(target.id, motivo);

    if (!cancelled) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'No se pudo cancelar la operación. Es posible que ya haya sido completada o cancelada.')],
      });
    }

    const wasMatch = target.status === MATCH_STATUS.IN_PROGRESS;

    // Detener grabacion si era una partida activa
    if (wasMatch) {
      try {
        await matchRecorder.stopRecording(target.id);
      } catch (error) {
        console.error('[Cancelar] Error al detener grabacion:', error.message);
      }
    }

    pushActivity(
      'cancel-match',
      `${wasMatch ? 'Partida' : 'Check-in'} de "${team.name}" cancelado. Motivo: ${motivo}`,
      interaction.user.username
    );

    const embed = successEmbed(
      `${wasMatch ? 'Partida' : 'Check-in'} cancelado`,
      [
        `La operación del equipo **${team.name}** ha sido cancelada.`,
        '',
        `**Motivo:** ${motivo}`,
        `**ID:** \`${target.id}\``,
      ].join('\n')
    );

    await interaction.editReply({ embeds: [embed] });

    // La respuesta de arriba es efimera -- esta copia es lo unico que le
    // permite al staff seguir viendo las cancelaciones del equipo.
    await eventChannels.postToEventChannel(interaction.guild, 'staffLog', { embeds: [embed] });
  },
};
