// ============================================
// GlitchGang Bot - /calendario Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { getActiveTournament } = require('../services/tournamentService');
const { getTournamentMatches } = require('../services/liveMatchService');
const { baseEmbed, infoEmbed } = require('../utils/embeds');
const { COLORS, MATCH_STATUS, EMOJI } = require('../utils/constants');

function formatDiscordTimestamp(isoString, style = 'f') {
  if (!isoString) return 'N/D';
  return `<t:${Math.floor(new Date(isoString).getTime() / 1000)}:${style}>`;
}

function formatRelative(isoString) {
  if (!isoString) return '';
  return `<t:${Math.floor(new Date(isoString).getTime() / 1000)}:R>`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calendario')
    .setDescription('Muestra check-ins activos, partidas en curso y resultados recientes del torneo'),

  async execute(interaction) {

    const tournament = await getActiveTournament(interaction.guildId, interaction.channelId);
    const matches = tournament ? await getTournamentMatches(tournament.id) : [];

    if (!tournament && matches.length === 0) {
      return interaction.editReply({
        embeds: [infoEmbed('Calendario', 'No hay torneo activo ni operaciones registradas.')],
      });
    }

    const embed = baseEmbed({
      title: `${EMOJI.TROPHY} Calendario${tournament ? `: ${tournament.name}` : ''}`,
      color: COLORS.PRIMARY,
      description: tournament
        ? `Torneo activo con **${tournament.teams.length}** equipo(s).`
        : 'No hay torneo activo actualmente.',
    });

    // ── Check-ins activos ──────────────────────
    const activeCheckins = matches.filter((m) =>
      [MATCH_STATUS.CHECKING_IN, MATCH_STATUS.READY].includes(m.status)
    );

    if (activeCheckins.length > 0) {
      const lines = activeCheckins.map((m) => {
        const icon = m.status === MATCH_STATUS.READY ? '🟢' : '🟡';
        const statusLabel = m.status === MATCH_STATUS.READY ? 'Listo' : 'En espera';
        const deadline = m.checkinDeadlineAt
          ? `Limite: ${formatDiscordTimestamp(m.checkinDeadlineAt, 't')} (${formatRelative(m.checkinDeadlineAt)})`
          : '';
        return `${icon} **${m.teamName}** — ${statusLabel}\n${deadline}`;
      });

      embed.addFields({
        name: `${EMOJI.CLOCK} Check-ins activos (${activeCheckins.length})`,
        value: lines.join('\n\n').slice(0, 1024),
      });
    }

    // ── Partidas en curso ──────────────────────
    const inProgress = matches.filter((m) => m.status === MATCH_STATUS.IN_PROGRESS);

    if (inProgress.length > 0) {
      const lines = inProgress.map((m) => {
        const rival = m.rivalName ? ` vs **${m.rivalName}**` : '';
        const since = m.startedAt ? `Iniciada ${formatRelative(m.startedAt)}` : '';
        return `${EMOJI.GAMEPAD} **${m.teamName}**${rival}\n${since}`;
      });

      embed.addFields({
        name: `${EMOJI.FIRE} Partidas en curso (${inProgress.length})`,
        value: lines.join('\n\n').slice(0, 1024),
      });
    }

    // ── Resultados recientes (últimos 5) ───────
    const completed = matches
      .filter((m) => m.status === MATCH_STATUS.COMPLETED)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5);

    if (completed.length > 0) {
      const lines = completed.map((m) => {
        const icon = m.result === 'win' ? '🏆' : m.result === 'lose' ? '❌' : '🤝';
        const rival = m.rivalName ? ` vs ${m.rivalName}` : '';
        return `${icon} **${m.teamName}**${rival} — ${formatDiscordTimestamp(m.completedAt, 'd')}`;
      });

      embed.addFields({
        name: `${EMOJI.CHART} Resultados recientes`,
        value: lines.join('\n').slice(0, 1024),
      });
    }

    // ── Descalificados ─────────────────────────
    const disqualified = matches.filter((m) => m.status === MATCH_STATUS.DISQUALIFIED);

    if (disqualified.length > 0) {
      const lines = disqualified.map((m) => {
        const when = m.disqualifiedAt ? formatDiscordTimestamp(m.disqualifiedAt, 'd') : 'N/D';
        return `${EMOJI.CROSS} **${m.teamName}** — ${when}`;
      });

      embed.addFields({
        name: 'Descalificados',
        value: lines.join('\n').slice(0, 1024),
      });
    }

    // Sin actividad aun
    if (
      activeCheckins.length === 0 &&
      inProgress.length === 0 &&
      completed.length === 0 &&
      disqualified.length === 0
    ) {
      embed.setDescription(
        tournament
          ? `Torneo **${tournament.name}** activo con **${tournament.teams.length}** equipo(s).\nNo hay check-ins ni partidas registradas todavia.`
          : 'No hay actividad registrada.'
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
