// ============================================
// GlitchGang Bot - Mensajes de bienvenida por canal de torneo
// ============================================
// Un embed por cada canal que el bot le crea a un torneo (noticias, reglas,
// bracket, check-in, resultados, staff) la PRIMERA vez que ese canal se
// crea -- no en cada re-sync. Mismo template para todos los torneos,
// los datos fundamentales salen del propio torneo (provisionWorker.js los
// pasa ya resueltos desde el backend real).

const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { COLORS, EMOJI, BOT_CONFIG } = require('./constants');
const { normalizeDiscordColor } = require('./colors');

const WEBSITE_URL = (process.env.WEBSITE_URL || 'https://glitchgang.net').replace(/\/$/, '');

// Discord exige URL absoluta para setImage/setThumbnail -- un torneo
// cargado fuera del flujo normal de la web (ej. insertado directo en la
// base) puede traer banner/logo como ruta relativa ('/ImaHorizontal/x.jpg')
// en vez de absoluta, y esa validacion revienta el aprovisionamiento entero
// del torneo con un error generico ("Expected undefined or null").
function resolveImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${WEBSITE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function resolveSiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${WEBSITE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

const FORMAT_LABEL = {
  single_elimination: 'Eliminacion simple',
  double_elimination: 'Doble eliminacion',
  round_robin: 'Round Robin (todos contra todos)',
  swiss: 'Sistema suizo',
  custom: 'Formato personalizado',
};

const STAFF_ROLE_INFO = {
  Director: { emoji: EMOJI.CROWN, desc: 'Maxima autoridad de este torneo — mismo nivel de confianza que el organizador. Resuelve disputas finales.' },
  Administrador: { emoji: '⚙️', desc: 'Operacion del dia a dia: equipos, check-in, bracket y reportes.' },
  Arbitro: { emoji: '⚖️', desc: 'Valida reportes, resuelve disputas de partidas y aplica walkovers.' },
  Moderador: { emoji: EMOJI.SHIELD, desc: 'Igual que arbitro, enfocado en check-in y moderacion del canal de Discord.' },
  Caster: { emoji: '🎥', desc: 'Transmite el torneo — acceso de solo lectura a reglas, equipos y bracket.' },
  Produccion: { emoji: EMOJI.CAMERA, desc: 'Contenido y branding del torneo — acceso de solo lectura a reglas, equipos y sponsors.' },
  Coach: { emoji: '🧭', desc: 'Guia a su equipo dentro del torneo — acceso de solo lectura a reglas, equipos y bracket.' },
  Analista: { emoji: '📊', desc: 'Analisis de partidas y reportes — acceso de solo lectura a reglas, equipos, bracket y reportes.' },
}

function fmtDate(value) {
  if (!value) return 'Por definir';
  return `<t:${Math.floor(new Date(value).getTime() / 1000)}:F>`;
}

function money(value) {
  const n = Number(value || 0);
  return n > 0 ? `RD$${n.toLocaleString('es-DO')}` : 'Sin premio en efectivo';
}

function baseTournamentEmbed(tournament, { title, color = COLORS.PRIMARY, description }) {
  const embed = new EmbedBuilder()
    .setColor(normalizeDiscordColor(color, COLORS.PRIMARY))
    .setTitle(title)
    .setFooter({ text: `${BOT_CONFIG.BRAND_FOOTER} | ${tournament.publicId || ''}` })
    .setTimestamp();
  if (description) embed.setDescription(description.slice(0, 4096));
  const bannerUrl = resolveImageUrl(tournament.banner);
  if (bannerUrl) embed.setImage(bannerUrl);
  const logoUrl = resolveImageUrl(tournament.logo);
  if (logoUrl) embed.setThumbnail(logoUrl);
  return embed;
}

/** Canal "noticias" -- presentacion general del torneo. */
function tournamentIntroEmbed(tournament) {
  const embed = baseTournamentEmbed(tournament, {
    title: `${EMOJI.TROPHY} ${tournament.title}`,
    description: [
      `Bienvenidos al torneo de **${tournament.game || 'este juego'}** organizado en GlitchGang.`,
      'Aqui encontraran todo lo necesario para competir: reglas, bracket, horarios de check-in y soporte directo con el staff.',
      '',
      `Revisa #reglas para conocer el formato, W.O. y condiciones antes de tu primera partida.`,
    ].join('\n'),
  });
  embed.addFields(
    { name: 'Juego', value: tournament.game || 'Por definir', inline: true },
    { name: 'Formato', value: FORMAT_LABEL[tournament.format] || 'Por definir', inline: true },
    { name: 'Region', value: tournament.region || 'Sin definir', inline: true },
    { name: 'Cupo', value: `${tournament.currentSlots || 0}/${tournament.maxSlots || '?'} equipos`, inline: true },
    { name: 'Premio', value: money(tournament.prizePool), inline: true },
    { name: 'Inicio', value: fmtDate(tournament.date), inline: true },
    { name: 'Codigo del torneo', value: `\`${tournament.publicId || ''}\``, inline: false },
  );
  return embed;
}

/** Canal "reglas" -- el texto real de reglas del torneo. */
function tournamentRulesEmbed(tournament) {
  const rules = String(tournament.rules || '').trim();
  const rulesDocument = resolveSiteUrl(tournament.rulesDocument);
  const rulesName = String(tournament.rulesName || 'Reglamento completo').trim();
  const embed = baseTournamentEmbed(tournament, {
    title: `📜 Reglamento oficial`,
    color: COLORS.INFO,
    description: rules || 'El organizador aun no publico el reglamento — vuelve a revisar antes del check-in.',
  });
  if (rulesDocument && !rules) {
    embed.setDescription('El reglamento completo esta disponible en el PDF adjunto por el organizador.');
  }
  if (rulesDocument) {
    embed.addFields({
      name: 'PDF del reglamento',
      value: `[${rulesName}](${rulesDocument})`,
      inline: false,
    });
  }
  return embed;
}

/** Canal "bracket" -- placeholder hasta que se generen los enfrentamientos reales. */
function tournamentBracketEmbed(tournament) {
  return baseTournamentEmbed(tournament, {
    title: `${EMOJI.TROPHY} Bracket — ${tournament.title}`,
    color: COLORS.MATCH,
    description: [
      'Los enfrentamientos apareceran aqui apenas ambos equipos completen su check-in.',
      '',
      'Cada resultado avanza el bracket **solo** cuando ambos equipos reportan con `/report` y coinciden -- si no coinciden, queda marcado como disputa para que un admin del torneo lo resuelva a mano.',
    ].join('\n'),
  }).addFields({ name: 'Formato', value: FORMAT_LABEL[tournament.format] || 'Por definir', inline: true });
}

/** Canal "check-in" -- ventana e instrucciones de check-in del torneo. */
function tournamentCheckinInfoEmbed(tournament) {
  const cfg = tournament.checkinConfig || {};
  const prematch = cfg.prematchMins ?? 30;
  const tolerance = cfg.toleranceMins ?? 10;
  const autoWalkover = cfg.autoWalkover !== false;
  return baseTournamentEmbed(tournament, {
    title: `${EMOJI.CHECK} Check-in — ${tournament.title}`,
    color: COLORS.SUCCESS,
    description: [
      `El check-in abre **${prematch} minutos** antes de cada partida, con **${tolerance} minutos** de tolerancia.`,
      autoWalkover
        ? 'Si un equipo no hace check-in a tiempo, se aplica walkover automatico a favor del rival.'
        : 'Si un equipo no hace check-in a tiempo, el staff decide el walkover manualmente.',
      '',
      'Cada equipo debe hacer `/checkin` desde su canal de voz asignado antes del cierre.',
    ].join('\n'),
  });
}

/** Canal "resultados" -- placeholder hasta que existan reportes validados. */
function tournamentResultsEmbed(tournament) {
  return baseTournamentEmbed(tournament, {
    title: `${EMOJI.CHART} Resultados — ${tournament.title}`,
    color: COLORS.WARNING,
    description: [
      'Aun no hay resultados reportados.',
      '',
      'Cuando ambos equipos reportan con `/report` y coinciden, el resultado se confirma solo y el bracket avanza -- si no coinciden, un admin del torneo resuelve la disputa.',
    ].join('\n'),
  });
}

/** Canal "staff" -- quien es quien, con explicacion de cada rol. */
function tournamentStaffEmbed(tournament) {
  const accepted = (tournament.staffMembers || []).filter(m => m.status === 'accepted');
  const embed = baseTournamentEmbed(tournament, {
    title: `${EMOJI.SHIELD} Staff de este torneo`,
    color: COLORS.NEUTRAL,
    description: accepted.length
      ? 'Estas son las personas encargadas de este torneo puntual — no tienen acceso a ningun otro torneo del servidor.'
      : 'Todavia no hay staff confirmado para este torneo.',
  });
  for (const role of ['Director', 'Administrador', 'Arbitro', 'Moderador', 'Caster', 'Produccion', 'Coach', 'Analista']) {
    const members = accepted.filter(m => m.role === role);
    if (!members.length) continue;
    const info = STAFF_ROLE_INFO[role] || { emoji: EMOJI.PERSON, desc: '' };
    embed.addFields({
      name: `${info.emoji} ${role}`,
      value: [members.map(m => `**${m.nick || m.name}**`).join(', '), info.desc].filter(Boolean).join('\n'),
    });
  }
  return embed;
}

/** Canal "soporte" -- como pedir ayuda dentro de este torneo. */
function tournamentSupportEmbed(tournament) {
  return baseTournamentEmbed(tournament, {
    title: `🆘 Soporte — ${tournament.title}`,
    color: COLORS.INFO,
    description: [
      'Si tienes un problema con tu inscripcion, check-in o una partida, elige una categoria abajo para abrir un ticket.',
      'El bot avisara al staff y al organizador de este torneo.',
      'Para disputas de un resultado especifico usa `/report` y marca el reporte como disputado si aplica — el staff lo revisa desde ahi.',
    ].join('\n'),
  });
}

function tournamentSupportComponents(tournament) {
  const tournamentId = String(tournament._id || tournament.id || tournament.publicId || '').slice(0, 64);
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`gg_support:${tournamentId}`)
        .setPlaceholder('Con que necesitas ayuda?')
        .addOptions(
          { label: 'Mi sala no carga', value: 'room', description: 'Canales, permisos o acceso a la sala.' },
          { label: 'El voice no funciona', value: 'voice', description: 'Audio, conexion o canal de voz.' },
          { label: 'El bot no entra', value: 'bot', description: 'Check-in, grabacion o comandos del bot.' },
          { label: 'Problema de energia/conexion', value: 'connection', description: 'Un jugador se desconecto o tuvo fallo externo.' },
          { label: 'Otro problema', value: 'other', description: 'Cualquier caso no listado.' },
        ),
    ),
  ];
}

/** Canal de texto privado del equipo -- bienvenida al crear su sala, primera vez que se inscribe a un torneo con Discord activado. */
function teamWelcomeEmbed(team, tournament, { rulesChannelId, missingDiscordUsers = [] } = {}) {
  const embed = baseTournamentEmbed(tournament, {
    title: `${EMOJI.PEOPLE} Bienvenido, ${team.name}`,
    color: COLORS.SUCCESS,
    description: [
      `Este es el canal privado de **${team.name}** para **${tournament.title}** — solo lo ven los jugadores del equipo y el staff del torneo.`,
      '',
      rulesChannelId
        ? `Antes de jugar, revisen el reglamento en <#${rulesChannelId}>. Ahi esta todo sobre formato, W.O. y condiciones.`
        : 'Revisen el reglamento del torneo antes de su primera partida.',
      '',
      '**Como funciona el bot aca:**',
      `${EMOJI.CHECK} \`/checkin\` — antes de cada partida, desde el canal de voz del equipo.`,
      `${EMOJI.CHART} \`/report\` — para reportar el resultado cuando termine el match (el rival tambien reporta; un admin del torneo valida antes de que cuente).`,
      `${EMOJI.LINK} \`/vincular\` — si algun jugador del roster todavia no vinculo su cuenta de GlitchGang con Discord.`,
      '',
      'El proximo rival y los resultados de este equipo se publican solos en su canal de bracket. Si necesitan ayuda, el staff del torneo ya tiene acceso a este canal.',
    ].join('\n'),
  });
  if (missingDiscordUsers.length) {
    embed.addFields({
      name: `${EMOJI.WARNING} Jugadores pendientes de vincular Discord`,
      value: `${missingDiscordUsers.length} jugador(es) del roster todavia no tienen Discord vinculado y no ven este canal — deben vincular desde GlitchGang → Ajustes → Conexiones, o con \`/vincular\`.`,
    });
  }
  return embed;
}

/** Se publica en el canal de bracket del torneo cada vez que un resultado confirmado avanza una ronda. */
function bracketMatchConfirmedEmbed(tournament, { teamA, teamB, winner }) {
  return baseTournamentEmbed(tournament, {
    title: `${EMOJI.CHECK || '✅'} Resultado confirmado`,
    color: COLORS.SUCCESS,
    description: [
      `**${teamA}** vs **${teamB}**`,
      `Ganador: **${winner}**`,
      '',
      'Ambos equipos reportaron el mismo resultado -- el bracket ya avanzó solo.',
    ].join('\n'),
  });
}

/** Comunicado de cambios confirmados desde el panel (pestana Competencia, etc.). */
function tournamentChangedEmbed(tournament, { title, sectionLabel, message, changes = [] }) {
  const lines = changes.slice(0, 20).map(change => `• **${change.label}:** ${change.before} → ${change.after}`)
  if (changes.length > 20) lines.push(`… y ${changes.length - 20} cambios más.`)
  return baseTournamentEmbed(tournament, {
    title: `${EMOJI.WARNING || '⚠️'} ${title || `Cambios en ${tournament.title}`}`,
    color: COLORS.WARNING,
    description: [
      sectionLabel ? `El organizador actualizó **${sectionLabel}**.` : 'El organizador actualizó el torneo.',
      ...(lines.length ? ['', ...lines] : []),
      ...(message ? ['', `> ${message}`] : []),
    ].join('\n').slice(0, 4000),
  });
}

/** Plantilla de 1er lugar -- se publica cuando el bracket queda con campeon. */
function championEmbed(tournament, championName) {
  return baseTournamentEmbed(tournament, {
    title: `🥇 Campeon — ${tournament.title}`,
    color: COLORS.SUCCESS,
    description: [
      `**${championName}** se coronó campeón de **${tournament.title}**.`,
      '',
      'Felicidades al equipo por ganar todas sus partidas del bracket.',
    ].join('\n'),
  });
}

/** Plantilla de 2do lugar. */
function runnerUpEmbed(tournament, runnerUpName) {
  return baseTournamentEmbed(tournament, {
    title: `🥈 Subcampeon — ${tournament.title}`,
    color: COLORS.INFO,
    description: `**${runnerUpName}** terminó en segundo lugar tras caer en la gran final.`,
  });
}

/** Plantilla de 3er lugar -- puede ser 1 o 2 equipos (semifinalistas). */
function thirdPlaceEmbed(tournament, thirdPlaceNames) {
  const names = (thirdPlaceNames || []).filter(Boolean);
  return baseTournamentEmbed(tournament, {
    title: `🥉 Tercer lugar — ${tournament.title}`,
    color: COLORS.WARNING,
    description: names.length
      ? `${names.map(n => `**${n}**`).join(' y ')} comparten el tercer lugar tras caer en semifinal.`
      : 'Tercer lugar por definir.',
  });
}

/**
 * Mensaje recurrente explicando la copa de fin de mes -- se manda junto al
 * podio cuando el torneo que acaba de terminar es esa copa mensual
 * (tournament.isMonthlyCup, o se puede mandar suelto con /anunciar-copa).
 * El monto del prize pool sale del propio torneo (prizePool), con $200
 * como fallback para cuando todavia no se cargo en el torneo.
 */
function monthlyCupEmbed(tournament) {
  const prize = tournament?.prizePool ? money(tournament.prizePool) : 'RD$200 (USD $200 aprox.)';
  return baseTournamentEmbed(tournament, {
    title: `🏆 Copa del mes — GlitchGang`,
    color: COLORS.PRIMARY,
    description: [
      `A finales de cada mes, GlitchGang organiza un torneo especial con los **tres primeros lugares** premiados.`,
      '',
      `**Prize pool: ${prize}**, repartido entre 1er, 2do y 3er lugar.`,
      '',
      'Sigue el canal de noticias de cada torneo para enterarte cuando abran las inscripciones de la próxima edición.',
    ].join('\n'),
  });
}

/** Panel general (fijo, editado in-place) con los torneos abiertos del servidor, con link a la web para inscribirse. */
function tournamentsPanelEmbed(tournaments) {
  const embed = new EmbedBuilder()
    .setColor(normalizeDiscordColor(COLORS.PRIMARY, COLORS.PRIMARY))
    .setTitle(`${EMOJI.ROCKET} Torneos disponibles en GlitchGang`)
    .setFooter({ text: BOT_CONFIG.BRAND_FOOTER })
    .setTimestamp();

  if (!tournaments.length) {
    embed.setDescription('No hay torneos abiertos para inscripcion en este momento. Vuelve a revisar pronto.');
    return embed;
  }

  embed.setDescription('Inscribete desde la web de GlitchGang — cada torneo tiene su propio espacio en este servidor una vez que te inscribes.');
  for (const t of tournaments.slice(0, 15)) {
    embed.addFields({
      name: `${EMOJI.TROPHY} ${t.title}`,
      value: [
        `${t.game || 'Juego por definir'} · ${t.currentSlots || 0}/${t.maxSlots || '?'} equipos · ${t.status === 'ongoing' ? 'En curso' : 'Abierto'}`,
        `[Ver e inscribirse](${BOT_CONFIG.BRAND_URL}/torneos/${t.publicId})`,
      ].join('\n'),
    });
  }
  if (tournaments.length > 15) {
    embed.addFields({ name: 'Mas torneos', value: `Hay ${tournaments.length - 15} torneo(s) adicional(es) — revisa [la web completa](${BOT_CONFIG.BRAND_URL}/torneos).` });
  }
  return embed;
}

module.exports = {
  tournamentChangedEmbed,
  tournamentIntroEmbed,
  tournamentsPanelEmbed,
  tournamentRulesEmbed,
  tournamentBracketEmbed,
  tournamentCheckinInfoEmbed,
  tournamentResultsEmbed,
  tournamentStaffEmbed,
  tournamentSupportEmbed,
  tournamentSupportComponents,
  teamWelcomeEmbed,
  bracketMatchConfirmedEmbed,
  championEmbed,
  runnerUpEmbed,
  thirdPlaceEmbed,
  monthlyCupEmbed,
};
