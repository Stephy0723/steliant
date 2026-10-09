// ============================================
// GlitchGang Bot - /start-match Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { getMemberVoiceChannel, joinChannel } = require('../services/voiceService');
const { getActiveTournament } = require('../services/tournamentService');
const matchRecorder = require('../services/matchRecorder');
const {
  createMatch,
  findActiveMatch,
  findLatestTeamOperation,
} = require('../services/liveMatchService');
const { clearCheckinTimer } = require('../services/checkinMonitor');
const { pushActivity } = require('../services/activityService');
const eventChannels = require('../services/eventChannels');
const { getVoiceMembers, selectTeam, buildAttendance } = require('../utils/matching');
const { matchStartEmbed, errorEmbed, checkinEmbed, recordingNoticeEmbed } = require('../utils/embeds');
const { MATCH_STATUS } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start-match')
    .setDescription('Inicia una partida oficial del torneo')
    .addStringOption((opt) =>
      opt.setName('equipo')
        .setDescription('Nombre de tu equipo')
    )
    .addStringOption((opt) =>
      opt.setName('rival')
        .setDescription('Nombre del equipo rival')
    ),

  async execute(interaction) {
    const voiceChannel = getMemberVoiceChannel(interaction.member);
    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [errorEmbed('Sin canal de voz', 'Debes estar en un canal de voz para iniciar partida.')],
      });
    }

    const tournament = await getActiveTournament(interaction.guildId, interaction.channelId);
    if (!tournament) {
      return interaction.editReply({
        embeds: [errorEmbed('Sin torneo activo', 'No se encontro un torneo activo en el CRM.')],
      });
    }

    const voiceMembers = getVoiceMembers(voiceChannel);
    const requestedName = interaction.options.getString('equipo');
    const { team, reason } = selectTeam({
      teams: tournament.teams,
      requestedName,
      channelName: voiceChannel.name,
      voiceMembers,
    });

    if (!team) {
      return interaction.editReply({
        embeds: [errorEmbed('Equipo no identificado', reason)],
      });
    }

    const latestOperation = await findLatestTeamOperation(team.id);
    if (latestOperation?.status === MATCH_STATUS.DISQUALIFIED) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Equipo descalificado',
            `El equipo **${team.name}** fue descalificado por no completar el check-in dentro del tiempo permitido.`
          ),
        ],
      });
    }

    const existingMatch = await findActiveMatch(team.id);
    if (existingMatch) {
      return interaction.editReply({
        embeds: [errorEmbed('Partida en curso', `El equipo **${team.name}** ya tiene una partida activa (\`${existingMatch.id}\`). Reporta el resultado antes de iniciar otra.`)],
      });
    }

    const attendance = buildAttendance(team.players, voiceMembers);
    if (attendance.missing.length > 0) {
      const embed = checkinEmbed({
        teamName: team.name,
        tournamentName: tournament.name,
        attendance,
        channelName: voiceChannel.name,
      });
      embed.setTitle('No se puede iniciar - Jugadores faltantes');

      return interaction.editReply({ embeds: [embed] });
    }

    let connection = null;
    if (!matchRecorder.usesRecorderPool()) {
      try {
        connection = await joinChannel(voiceChannel);
      } catch (error) {
        console.error('[StartMatch] Error al unirse al canal:', error.message);
      }
    }

    const rivalName = interaction.options.getString('rival') || null;
    const match = await createMatch({
      tournamentId: tournament.id,
      teamId: team.id,
      teamName: team.name,
      rivalName,
      guildId: interaction.guildId,
      voiceChannelId: voiceChannel.id,
      notificationChannelId: interaction.channelId,
      channelName: voiceChannel.name,
      startedBy: interaction.user.id,
    });

    clearCheckinTimer(match.id);

    // ── Iniciar grabacion de audio + screen share monitor ──
    let recordingInfo = null;
    try {
      recordingInfo = await matchRecorder.startRecording(
        match.id, interaction.guildId, voiceChannel.id, connection
      );
    } catch (error) {
      console.error('[StartMatch] Error al iniciar grabacion:', error.message);
      if (!connection) {
        await interaction.channel?.send({
          embeds: [errorEmbed('Grabacion no iniciada', error.message)],
        }).catch(() => {});
      }
    }

    if (recordingInfo) {
      await interaction.channel?.send({ embeds: [recordingNoticeEmbed()] }).catch(() => {});
    }

    pushActivity(
      'start-match',
      `Partida iniciada para "${team.name}"${rivalName ? ` contra "${rivalName}"` : ''}. ${recordingInfo ? '🎙️ Grabacion activa.' : ''}`,
      interaction.user.username
    );

    const embed = matchStartEmbed({
      teamName: team.name,
      rivalName,
      tournamentName: tournament.name,
      matchId: match.id,
    });

    if (recordingInfo) {
      embed.addFields({
        name: '🎙️ Grabación activa',
        value: `Audio y screen share se están grabando. ${recordingInfo.participants.length} participantes detectados.`,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // La respuesta de arriba es efimera -- esta copia es lo unico que le
    // permite al staff seguir viendo que partidas se iniciaron. El aviso de
    // grabacion activa (arriba, interaction.channel?.send) sigue siendo
    // publico a proposito: los jugadores en el canal deben saber que se
    // esta grabando.
    await eventChannels.postToEventChannel(interaction.guild, 'staffLog', { embeds: [embed] });
  },
};
