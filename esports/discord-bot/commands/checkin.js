// ============================================
// GlitchGang Bot - /checkin Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { getMemberVoiceChannel, joinChannel } = require('../services/voiceService');
const { getActiveTournament, getTeamAndTournamentByChannel } = require('../services/tournamentService');
const {
  createOrRefreshCheckin,
  findLatestTeamOperation,
} = require('../services/liveMatchService');
const { syncCheckinTimer } = require('../services/checkinMonitor');
const { pushActivity } = require('../services/activityService');
const eventChannels = require('../services/eventChannels');
const { getVoiceMembers, selectTeam, buildAttendance } = require('../utils/matching');
const { checkinEmbed, errorEmbed, warningEmbed } = require('../utils/embeds');
const { BOT_CONFIG, MATCH_STATUS } = require('../utils/constants');

const CHECKIN_WINDOWS = [
  { name: '15 minutos', value: '15m', ms: 15 * 60 * 1000 },
  { name: '20 minutos', value: '20m', ms: 20 * 60 * 1000 },
  { name: '30 minutos', value: '30m', ms: 30 * 60 * 1000 },
  { name: '1 hora', value: '1h', ms: 60 * 60 * 1000 },
  { name: '1 dia', value: '1d', ms: 24 * 60 * 60 * 1000 },
];

function formatDiscordTimestamp(isoString, style = 't') {
  if (!isoString) return 'N/D';
  return `<t:${Math.floor(new Date(isoString).getTime() / 1000)}:${style}>`;
}

function formatClock(isoString) {
  if (!isoString) return 'N/D';

  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function resolveWindowMs(value) {
  return CHECKIN_WINDOWS.find((entry) => entry.value === value)?.ms || BOT_CONFIG.CHECKIN_WINDOW_MS;
}

function formatWindowLabel(ms) {
  const preset = CHECKIN_WINDOWS.find((entry) => entry.ms === ms);
  if (preset) return preset.name;

  const minutes = Math.round(ms / 60000);
  return `${minutes} minutos`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('Verifica la asistencia del equipo en el canal de voz')
    .addStringOption((opt) =>
      opt.setName('equipo')
        .setDescription('Nombre del equipo (auto-detecta si no se indica)')
    )
    .addStringOption((opt) =>
      opt.setName('ventana')
        .setDescription('Tiempo limite para completar el check-in')
        .addChoices(
          ...CHECKIN_WINDOWS.map((entry) => ({
            name: entry.name,
            value: entry.value,
          }))
        )
    )
    .addStringOption((opt) =>
      opt.setName('torneo')
        .setDescription('Codigo del torneo (ej: TOR-STRE-ORG900-002-01) -- usalo si hay mas de uno activo en el servidor')
    ),

  async execute(interaction) {

    const voiceChannel = getMemberVoiceChannel(interaction.member);
    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [errorEmbed('Sin canal de voz', 'Debes estar en un canal de voz para hacer check-in.')],
      });
    }

    const voiceMembers = getVoiceMembers(voiceChannel);
    if (voiceMembers.length === 0) {
      return interaction.editReply({
        embeds: [warningEmbed('Canal vacio', 'No hay jugadores conectados al canal de voz.')],
      });
    }

    // Via directa (sin ambiguedad): el jugador ya esta parado en la sala
    // EXCLUSIVA de su equipo (voz o texto, las que provisionTeam le creo)
    // -- ni el nombre de equipo ni el codigo de torneo hacen falta en ese
    // caso, el canal mismo identifica todo. Si no matchea ningun equipo
    // (ej. corrido desde un canal general del torneo, no del equipo), cae
    // al camino viejo por nombre/codigo.
    let tournament = await getTeamAndTournamentByChannel(interaction.guildId, voiceChannel.id)
      || await getTeamAndTournamentByChannel(interaction.guildId, interaction.channelId);
    let team = tournament?.team;
    if (tournament) tournament = tournament.tournament;

    if (!team) {
      const tournamentCode = interaction.options.getString('torneo');
      tournament = await getActiveTournament(interaction.guildId, interaction.channelId, tournamentCode);
      if (!tournament) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Sin torneo activo',
            tournamentCode
              ? `No encontre el torneo "${tournamentCode}" en este servidor. Revisa el codigo.`
              : 'No se encontro un torneo activo en el CRM, o hay mas de uno activo -- usa la opcion "torneo" con su codigo (ej: TOR-STRE-ORG900-002-01).'
          )],
        });
      }

      const requestedName = interaction.options.getString('equipo');
      const selected = selectTeam({
        teams: tournament.teams,
        requestedName,
        channelName: voiceChannel.name,
        voiceMembers,
      });
      team = selected.team;

      if (!team) {
        return interaction.editReply({
          embeds: [errorEmbed('Equipo no identificado', selected.reason)],
        });
      }
    }

    const latestOperation = await findLatestTeamOperation(team.id);
    if (latestOperation?.status === MATCH_STATUS.DISQUALIFIED) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Equipo descalificado',
            `El equipo **${team.name}** ya fue descalificado por no completar un check-in a tiempo. Revisa el CRM para continuar.`
          ),
        ],
      });
    }

    try {
      await joinChannel(voiceChannel);
    } catch (error) {
      console.error('[Checkin] Error al unirse al canal:', error.message);
    }

    const attendance = buildAttendance(team.players, voiceMembers);
    const selectedWindow = interaction.options.getString('ventana');
    const checkinWindowMs = resolveWindowMs(selectedWindow);
    const { match, created, becameReady } = await createOrRefreshCheckin({
      tournamentId: tournament.id,
      teamId: team.id,
      teamName: team.name,
      guildId: interaction.guildId,
      voiceChannelId: voiceChannel.id,
      notificationChannelId: interaction.channelId,
      channelName: voiceChannel.name,
      requestedBy: interaction.user.id,
      attendance,
      checkinWindowMs,
    });

    syncCheckinTimer(interaction.client, match);

    const embed = checkinEmbed({
      teamName: team.name,
      tournamentName: tournament.name,
      attendance,
      channelName: voiceChannel.name,
    });

    embed.addFields({
      name: 'Cronograma',
      value: [
        `Solicitado: ${formatDiscordTimestamp(match.requestedAt, 't')}`,
        `Ventana acordada: ${formatWindowLabel(match.checkinWindowMs || checkinWindowMs)}`,
        `Limite: ${formatDiscordTimestamp(match.checkinDeadlineAt, 't')} (${formatDiscordTimestamp(match.checkinDeadlineAt, 'R')})`,
      ].join('\n'),
    });

    embed.addFields({
      name: 'Aviso',
      value: 'Usa una ventana acordada para el check-in. Las opciones mas comunes son 1 dia, 1 hora, 30 minutos, 20 minutos o 15 minutos.',
    });

    if (attendance.missing.length === 0) {
      embed.setDescription('El equipo esta completo. Estan listos y deben esperar en sala hasta la siguiente indicacion.');

      if (created || becameReady) {
        pushActivity(
          'checkin-ready',
          `Equipo "${team.name}" completo. Quedo listo en sala a las ${formatClock(match.readyAt || new Date().toISOString())}.`,
          interaction.user.username
        );
      }
    } else if (created) {
        pushActivity(
          'checkin-started',
          `Check-in iniciado para "${team.name}". Ventana: ${formatWindowLabel(match.checkinWindowMs || checkinWindowMs)}. Debe completarse antes de las ${formatClock(match.checkinDeadlineAt)}.`,
          interaction.user.username
        );
      }

    await interaction.editReply({ embeds: [embed] });

    // La respuesta de arriba es efimera (solo la ve quien corrio /checkin) --
    // esta copia es lo unico que le permite al staff seguir viendo el
    // check-in sin tener que pedirselo al equipo.
    await eventChannels.postToEventChannel(interaction.guild, 'staffLog', { embeds: [embed] });
  },
};
