// ============================================
// GlitchGang Bot - Embed Builders
// ============================================

const { EmbedBuilder } = require('discord.js');
const { COLORS, BOT_CONFIG, EMOJI } = require('./constants');
const { normalizeDiscordColor } = require('./colors');

const ZERO_WIDTH = '\u200b';

function truncate(value, max = 1024) {
  const text = String(value ?? '').trim();
  if (!text) return ZERO_WIDTH;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function normalizeField(field) {
  return {
    name: truncate(field.name, 256),
    value: truncate(field.value, 1024),
    inline: Boolean(field.inline),
  };
}

function addFields(embed, fields) {
  embed.addFields(fields.map(normalizeField));
  return embed;
}

function addSection(embed, name, value, inline = false) {
  embed.addFields(normalizeField({ name, value, inline }));
  return embed;
}

function baseEmbed({ title, description, color = COLORS.PRIMARY, kicker = BOT_CONFIG.BRAND_NAME, url }) {
  const embed = new EmbedBuilder()
    .setColor(normalizeDiscordColor(color, COLORS.PRIMARY))
    .setTitle(truncate(title, 256))
    .setFooter({ text: `${BOT_CONFIG.BRAND_FOOTER} | v${BOT_CONFIG.VERSION}` })
    .setTimestamp();

  const author = { name: kicker };
  if (BOT_CONFIG.BRAND_ICON_URL) author.iconURL = BOT_CONFIG.BRAND_ICON_URL;
  if (BOT_CONFIG.BRAND_URL) author.url = BOT_CONFIG.BRAND_URL;
  embed.setAuthor(author);

  if (url) embed.setURL(url);
  if (description) embed.setDescription(truncate(description, 4096));
  return embed;
}

function successEmbed(title, description) {
  return baseEmbed({
    title: `${EMOJI.CHECK} ${title}`,
    description,
    color: COLORS.SUCCESS,
    kicker: 'Accion completada',
  });
}

function errorEmbed(title, description) {
  return baseEmbed({
    title: `${EMOJI.CROSS} ${title}`,
    description,
    color: COLORS.ERROR,
    kicker: 'Necesita atencion',
  });
}

function warningEmbed(title, description) {
  return baseEmbed({
    title: `${EMOJI.WARNING} ${title}`,
    description,
    color: COLORS.WARNING,
    kicker: 'Revision recomendada',
  });
}

function infoEmbed(title, description) {
  return baseEmbed({
    title,
    description,
    color: COLORS.INFO,
    kicker: 'Informacion',
  });
}

function commandEmbed({ title, description, color = COLORS.INFO, fields = [], kicker = 'Centro de comandos' }) {
  const embed = baseEmbed({ title, description, color, kicker });
  if (fields.length) addFields(embed, fields);
  return embed;
}

function statusLine(label, value) {
  return `**${label}:** ${value}`;
}

function recordingNoticeEmbed() {
  return baseEmbed({
    title: `${EMOJI.MIC || '[REC]'} Aviso de monitoreo y grabacion`,
    color: COLORS.WARNING,
    kicker: 'Partida oficial',
    description: [
      'Esta sala esta siendo grabada y monitoreada para arbitraje, validacion de resultados y control de calidad.',
      '',
      'Se graba la voz de cada jugador por separado y se guarda con el ID de esta partida y de tu equipo. Solo la escuchan los arbitros del torneo, y cada vez que alguien la escucha queda registrado.',
      '',
      'El audio se usa **exclusivamente** para resolver reclamos o incidentes del torneo. Si no hay reclamos, se elimina automaticamente a los 30 dias.',
      '',
      'Al permanecer en este canal, aceptas los terminos de supervision del torneo (`/ayuda seccion:reglas`).',
    ].join('\n'),
  });
}

function checkinEmbed({ teamName, tournamentName, attendance, channelName }) {
  const allPresent = attendance.missing.length === 0;
  const color = allPresent ? COLORS.SUCCESS : COLORS.WARNING;
  const statusText = allPresent
    ? 'Equipo completo'
    : `Faltan ${attendance.missing.length} jugador(es)`;

  const presentLines = attendance.present.map(
    p => `${EMOJI.CHECK} **${p.player.name}**${p.player.isLeader ? ' (lider)' : ''} - ${p.member.displayName}`
  );
  const missingLines = attendance.missing.map(
    p => `${EMOJI.CLOCK} **${p.player.name}**${p.player.isLeader ? ' (lider)' : ''} - No conectado`
  );
  const unexpectedLines = attendance.unexpected.map(
    u => `${EMOJI.WARNING} **${u.displayName}** - No registrado`
  );

  const embed = baseEmbed({
    title: `${allPresent ? EMOJI.CHECK : EMOJI.CLOCK} Check-in | ${teamName}`,
    color,
    kicker: 'Control de asistencia',
    description: allPresent
      ? 'Roster completo. El equipo queda listo para la siguiente indicacion.'
      : 'Check-in abierto. Revisa quienes faltan antes de que cierre la ventana.',
  });

  addFields(embed, [
    { name: 'Torneo', value: tournamentName, inline: true },
    { name: 'Canal', value: channelName, inline: true },
    { name: 'Estado', value: statusText, inline: true },
  ]);

  const rosterLines = [...presentLines, ...missingLines];
  if (rosterLines.length > 0) {
    addSection(
      embed,
      `Roster (${attendance.present.length}/${attendance.present.length + attendance.missing.length})`,
      rosterLines.join('\n')
    );
  }

  if (unexpectedLines.length > 0) {
    addSection(embed, 'Jugadores no registrados', unexpectedLines.join('\n'));
  }

  return embed;
}

function matchStartEmbed({ teamName, rivalName, tournamentName, matchId }) {
  const embed = baseEmbed({
    title: `${EMOJI.GAMEPAD} Partida iniciada`,
    description: 'La partida comenzo oficialmente. Buena suerte a ambos equipos.',
    color: COLORS.MATCH,
    kicker: 'Match oficial',
  });

  addFields(embed, [
    { name: 'Torneo', value: tournamentName, inline: true },
    { name: 'Equipo', value: teamName, inline: true },
  ]);

  if (rivalName) addSection(embed, 'Rival', rivalName, true);
  if (matchId) addSection(embed, 'Match ID', `\`${matchId}\``, true);

  addSection(
    embed,
    'Siguiente paso',
    'Al finalizar, el lider del equipo debe usar `/report` con una captura del resultado.'
  );

  return embed;
}

function reportEmbed({ teamName, tournamentName, result, reporter, evidenceUrl, matchId, createdAt }) {
  const color =
    result === 'win' ? COLORS.SUCCESS :
    result === 'lose' ? COLORS.ERROR :
    COLORS.WARNING;
  const resultText =
    result === 'win' ? 'Victoria' :
    result === 'lose' ? 'Derrota' :
    'Empate';

  const embed = baseEmbed({
    title: `${EMOJI.TROPHY} Resultado reportado | ${resultText}`,
    color,
    kicker: 'Reporte oficial',
  });

  addFields(embed, [
    { name: 'Torneo', value: tournamentName, inline: true },
    { name: 'Equipo', value: teamName, inline: true },
    { name: 'Reportado por', value: reporter, inline: true },
  ]);

  if (createdAt) {
    addSection(
      embed,
      'Fecha',
      new Intl.DateTimeFormat('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(createdAt)),
      true
    );
  }

  if (matchId) addSection(embed, 'Match ID', `\`${matchId}\``, true);
  if (evidenceUrl) embed.setImage(evidenceUrl);

  return embed;
}

function linkPromptEmbed(result) {
  return baseEmbed({
    title: `${EMOJI.LINK} Vincula tu cuenta de Discord`,
    color: COLORS.INFO,
    kicker: 'Conexion segura',
    description: [
      'Conecta este Discord con tu perfil de GlitchGang para usar torneos, equipos, check-in y reportes desde el servidor.',
      '',
      '**Que pasa despues**',
      '- Si ya tienes cuenta, confirmas la vinculacion.',
      '- Si aun no tienes cuenta, puedes crearla en el mismo flujo.',
      '- El enlace privado expira en **10 minutos**.',
      '',
      'Pulsa el boton **Vincular ahora** para continuar.',
    ].join('\n'),
  });
}

module.exports = {
  baseEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  addSection,
  addFields,
  commandEmbed,
  statusLine,
  checkinEmbed,
  matchStartEmbed,
  reportEmbed,
  linkPromptEmbed,
  recordingNoticeEmbed,
};
