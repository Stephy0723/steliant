// ============================================
// GlitchGang Bot - Tickets de #soporte del torneo
// ============================================
// Flujo: el jugador elige una categoria en el menu de #soporte -> el bot le
// pide un detalle corto (modal) -> crea el ticket en el backend (que resuelve
// su equipo y avisa al organizador/staff en la web) -> abre un hilo,
// menciona los roles de staff/organizador del torneo (la mencion es lo que
// dispara la notificacion de Discord) y deja un boton "Marcar resuelto".
// El ticket tambien se puede cerrar desde la pestana Discord del panel web:
// el backend encola discord.support.resolved y archiveResolvedTicket() cierra
// el hilo.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const backendApi = require('./backendApi');
const discordGuild = require('./discordGuildService');

const SELECT_PREFIX = 'gg_support:';
const MODAL_PREFIX = 'gg_support_modal:';
const RESOLVE_PREFIX = 'gg_support_resolve:';

const SUPPORT_CATEGORIES = {
  room: 'Mi sala no carga',
  voice: 'El voice no funciona',
  bot: 'El bot no entra',
  connection: 'Problema de energia/conexion',
  other: 'Otro problema',
};

const COLOR_OPEN = 0xf59e0b;
const COLOR_RESOLVED = 0x22c55e;

function slug(value, fallback = 'ticket') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || fallback;
}

function resolveRow(tournamentId, ticketId, { disabled = false } = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${RESOLVE_PREFIX}${tournamentId}:${ticketId}`)
      .setLabel(disabled ? 'Resuelto' : 'Marcar resuelto')
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disabled),
  );
}

// 1) Menu de categorias -> modal con el detalle (obligatorio solo en "Otro problema").
async function handleSupportSelect(interaction) {
  const [, tournamentId] = String(interaction.customId).split(':');
  const category = SUPPORT_CATEGORIES[interaction.values?.[0]] ? interaction.values[0] : 'other';

  const detail = new TextInputBuilder()
    .setCustomId('detail')
    .setLabel(category === 'other' ? 'Cuentanos el problema' : 'Detalle (opcional)')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(category === 'other')
    .setPlaceholder('Ej: el capitan no puede entrar al canal de voz del equipo');

  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${tournamentId}:${category}`)
    .setTitle(SUPPORT_CATEGORIES[category].slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(detail));

  return interaction.showModal(modal);
}

// 2) Modal enviado -> ticket en el backend + hilo en #soporte.
async function handleSupportModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const [, tournamentId, category] = String(interaction.customId).split(':');
  if (!tournamentId) {
    return interaction.editReply('No pude identificar el torneo de este canal de soporte.');
  }
  const detail = interaction.fields.getTextInputValue('detail')?.trim() || '';
  const requester = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;

  const { ticket, tournament } = await backendApi.openTournamentSupportTicket({
    tournamentId,
    discordId: interaction.user.id,
    requesterName: requester,
    category,
    detail,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  });

  const roleIds = [tournament.staffRoleId, tournament.organizerRoleId].filter(Boolean);
  const embed = new EmbedBuilder()
    .setColor(COLOR_OPEN)
    .setTitle(`Ticket de soporte - ${ticket.categoryLabel}`)
    .setDescription(detail || 'Sin detalle adicional.')
    .addFields(
      { name: 'Torneo', value: tournament.title || tournamentId, inline: true },
      { name: 'Equipo', value: ticket.teamName || 'Sin equipo inscrito', inline: true },
      { name: 'Solicitante', value: `${requester} (<@${interaction.user.id}>)`, inline: false },
    )
    .setFooter({ text: 'El staff puede cerrarlo con el boton o desde el panel web.' })
    .setTimestamp();

  const thread = await interaction.channel?.threads?.create({
    name: `soporte-${slug(ticket.teamName || requester, 'jugador')}-${slug(ticket.categoryLabel)}`.slice(0, 90),
    type: ChannelType.PublicThread,
    autoArchiveDuration: 1440,
    reason: `Ticket de soporte GlitchGang abierto por ${interaction.user.tag}`,
  }).catch((error) => {
    console.warn(`[Support] No se pudo crear hilo de soporte: ${error.message}`);
    return null;
  });

  // Sin esto quien abrio el ticket no recibe aviso cuando el staff le responde en el hilo.
  if (thread) await thread.members.add(interaction.user.id).catch(() => {});

  const target = thread || interaction.channel;
  if (!target?.send) {
    return interaction.editReply('El ticket quedo registrado y el staff fue avisado en la web, pero no pude abrir el hilo en Discord.');
  }

  const message = await target.send({
    content: roleIds.map(id => `<@&${id}>`).join(' ') || 'Ticket de soporte abierto.',
    embeds: [embed],
    components: [resolveRow(tournament.id, ticket.id)],
    allowedMentions: { roles: roleIds, users: [interaction.user.id] },
  });

  await backendApi.attachTournamentSupportTicketDiscord(ticket.id, {
    threadId: thread?.id || '',
    messageId: message.id,
    channelId: target.id,
  }).catch((error) => console.warn(`[Support] No se pudo guardar el hilo del ticket ${ticket.id}: ${error.message}`));

  return interaction.editReply(
    thread
      ? `Ticket abierto: <#${thread.id}>. El staff del torneo ya fue notificado.`
      : 'Ticket enviado en #soporte. El staff del torneo ya fue notificado.'
  );
}

function canResolve(member, tournament) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  const provision = tournament?.discordProvision || {};
  const roleIds = [provision.staffRoleId, provision.organizerRoleId].filter(Boolean);
  return roleIds.some(id => member.roles?.cache?.has(id));
}

async function closeTicketMessage(message, tournamentId, ticketId, closedLine) {
  const embed = message.embeds?.[0]
    ? EmbedBuilder.from(message.embeds[0]).setColor(COLOR_RESOLVED).setFooter({ text: closedLine })
    : null;
  await message.edit({
    ...(embed ? { embeds: [embed] } : {}),
    components: [resolveRow(tournamentId, ticketId, { disabled: true })],
  }).catch((error) => console.warn(`[Support] No se pudo actualizar el mensaje del ticket: ${error.message}`));
}

async function archiveThread(channel, closedLine) {
  if (!channel?.isThread?.()) return;
  await channel.send(closedLine).catch(() => {});
  await channel.setArchived(true, 'Ticket de soporte resuelto').catch((error) => {
    console.warn(`[Support] No se pudo archivar el hilo ${channel.id}: ${error.message}`);
  });
}

// 3) Boton "Marcar resuelto" -- solo staff/organizador del torneo.
async function handleSupportResolve(interaction) {
  const [, tournamentId, ticketId] = String(interaction.customId).split(':');
  const { tournament } = await backendApi.getTournamentProvisionState(tournamentId);

  if (!canResolve(interaction.member, tournament)) {
    return interaction.reply({ content: 'Solo el staff o el organizador de este torneo pueden cerrar tickets.', ephemeral: true });
  }

  await interaction.deferUpdate();
  const name = interaction.member?.displayName || interaction.user.username;
  await backendApi.resolveTournamentSupportTicket(ticketId, interaction.user.id, name);

  const closedLine = `Resuelto por ${name}.`;
  await closeTicketMessage(interaction.message, tournamentId, ticketId, closedLine);
  await archiveThread(interaction.channel, `✅ ${closedLine} Si el problema vuelve, abre otro ticket desde #soporte.`);
}

// Worker de eventos: cierre hecho desde el panel web.
async function archiveResolvedTicket(event) {
  const { ticketId, tournamentId } = event.payload || {};
  const { ticket } = await backendApi.getTournamentSupportTicket(ticketId);
  const { channelId, threadId, messageId, guildId } = ticket.discord || {};
  if (!messageId && !threadId) return { skipped: true, reason: 'El ticket no tiene hilo en Discord.' };

  const client = discordGuild.getClient();
  const closedLine = `Resuelto por ${ticket.resolvedByName || 'el staff'} desde el panel web.`;
  const messageChannel = await client.channels.fetch(channelId || threadId).catch(() => null);
  const message = messageChannel && messageId ? await messageChannel.messages.fetch(messageId).catch(() => null) : null;
  if (message) await closeTicketMessage(message, tournamentId, ticketId, closedLine);

  const thread = threadId ? await client.channels.fetch(threadId).catch(() => null) : null;
  if (thread) await archiveThread(thread, `✅ ${closedLine}`);

  return { archived: Boolean(thread), messageUpdated: Boolean(message), guildId: guildId || '' };
}

async function replyError(interaction, text) {
  // En el boton, deferUpdate() hace que editReply() pise el mensaje del ticket.
  if (interaction.isButton() && (interaction.replied || interaction.deferred)) {
    return interaction.followUp({ content: text, ephemeral: true }).catch(() => {});
  }
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(text).catch(() => {});
  }
  return interaction.reply({ content: text, ephemeral: true }).catch(() => {});
}

/** Devuelve true si la interaccion era del flujo de soporte (ya respondida). */
async function handleSupportInteraction(interaction) {
  const id = String(interaction.customId || '');
  try {
    if (interaction.isStringSelectMenu() && id.startsWith(SELECT_PREFIX)) {
      await handleSupportSelect(interaction);
      return true;
    }
    if (interaction.isModalSubmit() && id.startsWith(MODAL_PREFIX)) {
      await handleSupportModal(interaction);
      return true;
    }
    if (interaction.isButton() && id.startsWith(RESOLVE_PREFIX)) {
      await handleSupportResolve(interaction);
      return true;
    }
  } catch (error) {
    console.error('[Support] Error en el flujo de tickets:', error);
    await replyError(interaction, 'No pude procesar el ticket ahora mismo. Intenta de nuevo o escribe directamente en #soporte.');
    return true;
  }
  return false;
}

module.exports = { handleSupportInteraction, archiveResolvedTicket, SUPPORT_CATEGORIES };
