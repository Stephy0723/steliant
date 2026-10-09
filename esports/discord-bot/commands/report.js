// ============================================
// GlitchGang Bot - /report Command
// ============================================

const { SlashCommandBuilder } = require('discord.js');
const { getActiveTournament } = require('../services/tournamentService');
const { findActiveMatch, reportResult, addReportEvidence } = require('../services/liveMatchService');
const { getMemberVoiceChannel } = require('../services/voiceService');
const { pushActivity } = require('../services/activityService');
const matchRecorder = require('../services/matchRecorder');
const eventChannels = require('../services/eventChannels');
const { getVoiceMembers, selectTeam, findTeamLeader } = require('../utils/matching');
const { baseEmbed, reportEmbed, errorEmbed } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');

// Una opcion de adjunto por pantalla. Misma tabla que shared/reportScreenshots.mjs
// (el backend decide cuales son obligatorias segun el juego del torneo); aca
// es fija porque Discord registra los comandos estaticos.
const SCREENSHOT_OPTIONS = [
  { option: 'resumen', key: 'overview', label: 'Resumen', description: 'Pantalla final: Victoria/Derrota y marcador' },
  { option: 'dano', key: 'damage_dealt', label: 'Daño infligido', description: 'MLBB: pestaña de daño infligido' },
  { option: 'recibido', key: 'damage_taken', label: 'Daño recibido', description: 'MLBB: pestaña de daño recibido' },
  { option: 'participacion', key: 'teamfight', label: 'Participación', description: 'MLBB: participación en peleas (opcional)' },
];
const SCREENSHOT_LABEL = Object.fromEntries(SCREENSHOT_OPTIONS.map(s => [s.key, s.label]));
const OPTION_OF = Object.fromEntries(SCREENSHOT_OPTIONS.map(s => [s.key, s.option]));

function formatTime(isoString) {
  return new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit' }).format(new Date(isoString));
}

// "Te falta: Daño recibido. Usa /report recibido:[imagen] antes de las 15:42."
function missingText(missing = [], deadlineAt) {
  if (!missing.length) return '';
  const usage = missing.map(key => `${OPTION_OF[key] || key}:[imagen]`).join(' ');
  return [
    `Te falta: **${missing.map(key => SCREENSHOT_LABEL[key] || key).join(', ')}**.`,
    `Usa \`/report ${usage}\`${deadlineAt ? ` antes de las ${formatTime(deadlineAt)}` : ''}, sin resultado: se agrega a este mismo reporte.`,
  ].join('\n');
}

function formatDateTime(isoString) {
  if (!isoString) return 'N/D';

  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function formatResultLabel(result) {
  if (result === 'win') return 'Victoria';
  if (result === 'lose') return 'Derrota';
  if (result === 'draw') return 'Empate';
  return result;
}

function reportHelpEmbed() {
  return baseEmbed({
    title: 'Como usar /report',
    color: COLORS.INFO,
    description:
      'Usa este comando al terminar CADA partida (en BO3/BO5, una vez por partida) con el resultado y las capturas de la pantalla final.',
  }).addFields(
    {
      name: 'Campos',
      value: [
        '- `resultado` - Elige `Victoria`, `Derrota` o `Empate`.',
        '- `resumen` - Captura de la pantalla final (siempre).',
        '- `dano`, `recibido` - En Mobile Legends: las pestañas de daño infligido y daño recibido (obligatorias).',
        '- `participacion` - En Mobile Legends: participación en peleas (opcional).',
      ].join('\n'),
    },
    {
      name: 'Campos opcionales',
      value: [
        '- `partida` - Número de partida de la serie, si el bot no lo calcula bien.',
        '- `equipo` - Solo si el bot no puede detectar tu equipo automaticamente.',
      ].join('\n'),
    },
    {
      name: '¿Te faltó una captura?',
      value: 'Vuelve a usar `/report` solo con esa captura (sin resultado) y se agrega a tu último reporte. Hay 15 minutos desde el primer reporte de la partida.',
    },
    {
      name: 'Quien puede usarlo',
      value: 'El lider del equipo es quien debe reportar cuando ese lider tiene Discord ID registrado.',
    },
    {
      name: 'Ejemplo',
      value: '`/report resultado:Victoria resumen:final.png dano:dano.png recibido:recibido.png`',
    }
  );
}

function addScreenshotOption(builder, s) {
  return builder.addAttachmentOption(option => option.setName(s.option).setDescription(s.description));
}

const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Reporta el resultado o muestra como llenar el comando')
  .addStringOption(option =>
    option
      .setName('resultado')
      .setDescription('Resultado final del match')
      .addChoices(
        { name: 'Victoria (Win)', value: 'win' },
        { name: 'Derrota (Lose)', value: 'lose' },
        { name: 'Empate (Draw)', value: 'draw' },
      )
  );
SCREENSHOT_OPTIONS.forEach(s => addScreenshotOption(data, s));
data
  .addIntegerOption(option =>
    option
      .setName('partida')
      .setDescription('Partida de la serie (1, 2, 3...), solo si no se calcula sola')
      .setMinValue(1)
      .setMaxValue(9)
  )
  .addStringOption(option =>
    option
      .setName('equipo')
      .setDescription('Tu equipo, solo si no se detecta automatico')
  );

module.exports = {
  data,

  async execute(interaction) {
    const result = interaction.options.getString('resultado');
    const gameNumber = interaction.options.getInteger('partida');
    const shots = SCREENSHOT_OPTIONS
      .map(s => ({ ...s, attachment: interaction.options.getAttachment(s.option) }))
      .filter(s => s.attachment);

    if (!result && !shots.length) {
      return interaction.editReply({
        embeds: [reportHelpEmbed()],
      });
    }

    if (shots.some(s => !s.attachment.contentType?.startsWith('image/'))) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Imagen requerida',
            'Las capturas deben ser imágenes (PNG, JPG o WebP).'
          ),
        ],
      });
    }
    const evidence = shots.map(s => ({ key: s.key, url: s.attachment.url, name: s.attachment.name }));

    const tournament = await getActiveTournament(interaction.guildId, interaction.channelId);
    if (!tournament) {
      return interaction.editReply({
        embeds: [errorEmbed('Sin torneo activo', 'No se encontro un torneo activo en el CRM.')],
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

    const leader = findTeamLeader(team);
    if (leader && leader.discordId && leader.discordId !== interaction.user.id) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Solo el lider puede reportar',
            `El lider de **${team.name}** es **${leader.name}**. Solo esa cuenta puede reportar resultados.`
          ),
        ],
      });
    }

    const activeMatch = await findActiveMatch(team.id);

    // Sin partida en curso y sin resultado: son capturas que faltaban.
    if (!activeMatch && !result) {
      let added;
      try {
        added = await addReportEvidence(team.id, { tournamentId: tournament.id, evidence, gameNumber });
      } catch (error) {
        return interaction.editReply({ embeds: [errorEmbed('No se agregaron las capturas', error.message)] });
      }
      const missing = added.report?.missing || [];
      const embed = baseEmbed({
        title: `${shots.length === 1 ? 'Captura agregada' : 'Capturas agregadas'} | Partida ${added.gameNumber || '?'}`,
        color: missing.length ? COLORS.WARNING : COLORS.SUCCESS,
        description: [
          `Se agregó ${shots.map(s => `**${s.label}**`).join(', ')} al reporte de **${team.name}**.`,
          missing.length ? missingText(missing, added.report?.deadlineAt) : 'El reporte ya tiene todas las capturas obligatorias.',
          added.late ? 'Llegó después del plazo: la falta ya quedó registrada, pero el árbitro verá la captura.' : '',
        ].filter(Boolean).join('\n\n'),
      });
      return interaction.editReply({ embeds: [embed] });
    }

    if (!activeMatch) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Sin partida activa',
            `El equipo **${team.name}** no tiene una partida en curso. Usa \`/start-match\` antes de reportar un resultado. Si solo te faltaba una captura, usa \`/report\` sin resultado, solo con esa captura.`
          ),
        ],
      });
    }

    if (!result) {
      return interaction.editReply({ embeds: [errorEmbed('Falta el resultado', 'Elige `resultado` (Victoria, Derrota o Empate) y adjunta las capturas.')] });
    }
    if (!shots.length) {
      return interaction.editReply({ embeds: [errorEmbed('Faltan las capturas', 'Adjunta al menos la captura `resumen` de la pantalla final.')] });
    }

    const matchId = activeMatch.id;

    const updated = await reportResult(matchId, {
      result,
      evidence,
      gameNumber,
      reporterDiscordId: interaction.user.id,
      reporterUsername: interaction.user.displayName || interaction.user.username,
    });

    // ── Detener grabación de la partida ──────
    let recordingResult = null;
    try {
      recordingResult = await matchRecorder.stopRecording(matchId);
    } catch (error) {
      console.error('[Report] Error al detener grabacion:', error.message);
    }

    pushActivity(
      'match-report',
      `Torneo: ${tournament.name} | Equipo: ${team.name} | Reporte: ${formatResultLabel(result)} | Fecha: ${formatDateTime(updated.report.createdAt)} | Publicado por: ${interaction.user.username}${recordingResult ? ` | 🎙️ Grabación: ${recordingResult.durationFormatted}` : ''}`,
      interaction.user.username
    );

    const embed = reportEmbed({
      teamName: team.name,
      tournamentName: tournament.name,
      result,
      reporter: interaction.user.displayName || interaction.user.username,
      evidenceUrl: updated.report.evidenceUrl || shots[0].attachment.url,
      matchId,
      createdAt: updated.report.createdAt,
    });

    if (updated.gameNumber) embed.addFields({ name: 'Partida de la serie', value: String(updated.gameNumber), inline: true });
    embed.addFields({ name: 'Capturas', value: shots.map(s => s.label).join(', '), inline: true });
    const missing = updated.report?.missing || [];
    if (missing.length) embed.addFields({ name: '⚠️ Reporte incompleto', value: missingText(missing, updated.report?.deadlineAt) });

    if (updated.statsReviewUrl) embed.addFields({
      name: 'Estadísticas de Mobile Legends',
      value: `[Ver capturas y estadísticas](${updated.statsReviewUrl}). Las capturas se leen solas: si las de los dos equipos coinciden, las estadísticas quedan confirmadas; si no, las revisa un árbitro.`,
    });

    if (recordingResult) {
      embed.addFields({
        name: '🎙️ Grabación finalizada',
        value: `Duración: ${recordingResult.durationFormatted} • ${recordingResult.participants} participantes • ${recordingResult.screenShareEvents} eventos de screen share`,
      });
    }

    // El backend intenta cruzar este reporte con el del rival y, si
    // coinciden, avanzar el bracket real solo -- avisa el estado de eso
    // para que el equipo sepa si falta algo de su lado.
    const syncStatus = updated.sync?.status;
    const reasons = (updated.sync?.reasons || []).join(' · ');
    if (syncStatus === 'awaiting_rival') {
      embed.addFields({ name: '⏳ Bracket', value: 'Esperando el reporte del equipo rival para confirmar el resultado en el bracket.' });
    } else if (syncStatus === 'analyzing') {
      embed.addFields({ name: '⏳ Analizando capturas', value: 'Se están leyendo las capturas de los dos equipos. Si coinciden, el bracket avanza solo; si no, lo revisa un árbitro.' });
    } else if (syncStatus === 'review') {
      embed.addFields({ name: '⚪ Por confirmar', value: `Un árbitro del torneo confirmará el resultado${reasons ? `: ${reasons}` : ''}.` });
    } else if (syncStatus === 'game_validated') {
      embed.addFields({ name: '🟢 Partida validada', value: `Victoria de **${updated.sync.winnerName}**${updated.sync.scoreA != null ? ` · serie ${updated.sync.scoreA}-${updated.sync.scoreB}` : ''}. La serie sigue.` });
    } else if (syncStatus === 'disputed') {
      embed.addFields({ name: '🟠 En arbitraje', value: `Tu reporte y el de **${updated.sync.rivalTeamName || 'el rival'}** no coinciden${reasons ? ` (${reasons})` : ''}. Un árbitro del torneo decide antes de que cuente en el bracket.` });
    } else if (syncStatus === 'synced') {
      embed.addFields({ name: '✅ Bracket actualizado', value: updated.sync.justFinished ? `¡Resultado confirmado! **${updated.sync.podium?.champion}** es el campeón del torneo.` : 'Ambos equipos coincidieron -- el bracket ya avanzó solo.' });
    }

    // La respuesta de arriba ahora es efimera (solo la ve quien reporto) --
    // esta copia al canal de "Resultados" es la que queda publica a
    // proposito: es el resultado oficial del torneo, no una notificacion de
    // uso interno.
    await interaction.editReply({ embeds: [embed] });
    await eventChannels.postToEventChannel(interaction.guild, 'results', { embeds: [embed] });
  },
};
