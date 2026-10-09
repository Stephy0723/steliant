// ============================================
// GlitchGang Bot - Discord Guild Service
// ============================================
// Servicio central para acceder a datos del guild de Discord:
// canales, roles, miembros, voice states. Necesita una referencia
// al client de discord.js que se setea desde el ready event.

const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { normalizeDiscordColor } = require('../utils/colors');

let _client = null;

/**
 * Inicializa el servicio con la referencia del client.
 * Llamar desde el ready event.
 */
function initialize(client) {
  _client = client;
  console.log('[DiscordGuild] Servicio inicializado');
}

function getClient() {
  if (!_client) throw new Error('DiscordGuildService no inicializado. Llama initialize(client) primero.');
  return _client;
}

function getDefaultGuildId() {
  return process.env.GUILD_ID || '';
}

async function resolveGuild(guildId) {
  const id = guildId || getDefaultGuildId();
  if (!id) throw new Error('No se especifico GUILD_ID.');
  const guild = await getClient().guilds.fetch(id).catch(() => null);
  if (!guild) throw new Error(`No se encontro el guild ${id}. Verifica que el bot este en el servidor.`);
  return guild;
}

// ── Guild Overview ──────────────────────────

async function getGuildOverview(guildId) {
  const guild = await resolveGuild(guildId);
  await guild.members.fetch().catch(() => {});

  const channels = guild.channels.cache;
  const textChannels = channels.filter(c => c.type === ChannelType.GuildText);
  const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice);
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory);

  const voiceStates = guild.voiceStates.cache.filter(vs => vs.channelId && !vs.member?.user?.bot);

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 128 }) || null,
    banner: guild.bannerURL({ size: 512 }) || null,
    memberCount: guild.memberCount,
    onlineCount: guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size,
    boostLevel: guild.premiumTier,
    boostCount: guild.premiumSubscriptionCount || 0,
    createdAt: guild.createdAt.toISOString(),
    channels: {
      total: channels.size,
      text: textChannels.size,
      voice: voiceChannels.size,
      categories: categories.size,
    },
    roles: guild.roles.cache.size,
    voiceActive: voiceStates.size,
  };
}

// ── Channels ────────────────────────────────

function channelToJson(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    typeName: ChannelType[channel.type] || 'Unknown',
    position: channel.position ?? 0,
    parentId: channel.parentId || null,
    parentName: channel.parent?.name || null,
    topic: channel.topic || null,
    nsfw: channel.nsfw || false,
    rateLimitPerUser: channel.rateLimitPerUser || 0,
    userLimit: channel.userLimit || 0,
    bitrate: channel.bitrate || 0,
    createdAt: channel.createdAt?.toISOString() || null,
    memberCount: channel.type === ChannelType.GuildVoice
      ? channel.members?.size || 0
      : null,
  };
}

async function getChannels(guildId) {
  const guild = await resolveGuild(guildId);
  const channels = guild.channels.cache
    .filter(c => [
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildCategory,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildStageVoice,
      ChannelType.GuildForum,
    ].includes(c.type))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return channels.map(channelToJson);
}

async function createChannel(guildId, { name, type = 'text', parentId, topic, permissionOverwrites = [] }) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('El bot no tiene permiso para gestionar canales (Manage Channels).');
  }

  const channelType = type === 'voice' ? ChannelType.GuildVoice
    : type === 'category' ? ChannelType.GuildCategory
    : type === 'forum' ? ChannelType.GuildForum
    : ChannelType.GuildText;

  const options = {
    name: name.trim(),
    type: channelType,
    reason: 'Creado desde el panel GlitchGang CRM',
  };

  if (parentId) options.parent = parentId;
  if (topic && (channelType === ChannelType.GuildText || channelType === ChannelType.GuildForum)) options.topic = topic;
  if (Array.isArray(permissionOverwrites) && permissionOverwrites.length) {
    options.permissionOverwrites = permissionOverwrites;
  }

  const channel = await guild.channels.create(options);
  console.log(`[DiscordGuild] Canal creado: #${channel.name} (${ChannelType[channelType]})`);
  return channelToJson(channel);
}

async function editChannel(guildId, channelId, { name, topic, rateLimitPerUser, parentId }) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('El bot no tiene permiso para gestionar canales.');
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (topic !== undefined) updates.topic = topic;
  if (rateLimitPerUser !== undefined) updates.rateLimitPerUser = Math.max(0, Math.min(21600, Number(rateLimitPerUser) || 0));
  // parentId: '' o null = sacar de la categoria.
  if (parentId !== undefined && channel.type !== ChannelType.GuildCategory) updates.parent = parentId || null;

  await channel.edit({ ...updates, reason: 'Editado desde el panel GlitchGang CRM' });
  console.log(`[DiscordGuild] Canal editado: #${channel.name}`);

  return channelToJson(channel);
}

async function grantChannelAccess(guildId, channelId, roleId, permissions = {}) {
  if (!roleId || !channelId) return null;
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('El bot no tiene permiso para gestionar permisos de canales.');
  }

  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);

  await channel.permissionOverwrites.edit(roleId, permissions, {
    reason: 'Permisos de grabador GlitchGang',
  });

  return channelToJson(channel);
}

async function deleteChannel(guildId, channelId) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('El bot no tiene permiso para gestionar canales.');
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);

  const name = channel.name;
  await channel.delete('Eliminado desde el panel GlitchGang CRM');
  console.log(`[DiscordGuild] Canal eliminado: #${name}`);
  return { deleted: true, name };
}

// ── Roles ───────────────────────────────────

function roleToJson(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    colorInt: role.color,
    position: role.position,
    hoist: role.hoist,
    mentionable: role.mentionable,
    managed: role.managed,
    isEveryone: role.id === role.guild.id,
    memberCount: role.members.size,
    permissions: role.permissions.bitfield.toString(),
    createdAt: role.createdAt?.toISOString() || null,
  };
}

async function getRoles(guildId) {
  const guild = await resolveGuild(guildId);
  await guild.members.fetch().catch(() => {});

  return guild.roles.cache
    .sort((a, b) => b.position - a.position)
    .map(roleToJson);
}

async function createRole(guildId, { name, color, mentionable = true, hoist = false }) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('El bot no tiene permiso para gestionar roles (Manage Roles).');
  }

  const options = {
    name: name.trim(),
    mentionable,
    hoist,
    reason: 'Creado desde el panel GlitchGang CRM',
  };

  if (color) {
    options.color = normalizeDiscordColor(color);
  }

  const role = await guild.roles.create(options);
  console.log(`[DiscordGuild] Rol creado: @${role.name}`);
  return roleToJson(role);
}

async function editRole(guildId, roleId, { name, color, mentionable, hoist }) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('El bot no tiene permiso para gestionar roles.');
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error(`Rol ${roleId} no encontrado.`);

  if (role.managed) throw new Error('No se puede editar un rol gestionado por una integración.');
  if (role.id === guild.id) throw new Error('No se puede editar el rol @everyone.');
  if (role.position >= botMember.roles.highest.position) {
    throw new Error('El bot no puede editar un rol con posición igual o superior a la suya.');
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (color !== undefined) {
    updates.color = normalizeDiscordColor(color);
  }
  if (mentionable !== undefined) updates.mentionable = mentionable;
  if (hoist !== undefined) updates.hoist = hoist;

  await role.edit({ ...updates, reason: 'Editado desde el panel GlitchGang CRM' });
  console.log(`[DiscordGuild] Rol editado: @${role.name}`);

  return roleToJson(role);
}

async function deleteRole(guildId, roleId) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('El bot no tiene permiso para gestionar roles.');
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error(`Rol ${roleId} no encontrado.`);

  if (role.managed) throw new Error('No se puede eliminar un rol gestionado por una integración.');
  if (role.id === guild.id) throw new Error('No se puede eliminar el rol @everyone.');
  if (role.position >= botMember.roles.highest.position) {
    throw new Error('El bot no puede eliminar un rol con posición igual o superior a la suya.');
  }

  const name = role.name;
  await role.delete('Eliminado desde el panel GlitchGang CRM');
  console.log(`[DiscordGuild] Rol eliminado: @${name}`);
  return { deleted: true, name };
}

// ── Members ─────────────────────────────────

function memberToJson(member) {
  return {
    id: member.id,
    username: member.user.username,
    displayName: member.displayName,
    avatar: member.user.displayAvatarURL({ size: 64 }) || null,
    bot: member.user.bot,
    roles: member.roles.cache
      .filter(r => r.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
    joinedAt: member.joinedAt?.toISOString() || null,
    status: member.presence?.status || 'offline',
    voiceChannelId: member.voice?.channelId || null,
    voiceChannelName: member.voice?.channel?.name || null,
  };
}

async function getMembers(guildId, { limit = 50, filter } = {}) {
  const guild = await resolveGuild(guildId);
  await guild.members.fetch().catch(() => {});

  let members = guild.members.cache
    .filter(m => !m.user.bot)
    .sort((a, b) => {
      const statusOrder = { online: 0, idle: 1, dnd: 2, offline: 3 };
      const aStatus = statusOrder[a.presence?.status || 'offline'] ?? 3;
      const bStatus = statusOrder[b.presence?.status || 'offline'] ?? 3;
      return aStatus - bStatus || a.displayName.localeCompare(b.displayName);
    });

  if (filter === 'online') {
    members = members.filter(m => m.presence?.status && m.presence.status !== 'offline');
  } else if (filter === 'voice') {
    members = members.filter(m => m.voice?.channelId);
  }

  return {
    total: guild.members.cache.filter(m => !m.user.bot).size,
    showing: Math.min(members.size, limit),
    members: members.first(limit).map(memberToJson),
  };
}

async function addMemberRole(guildId, memberId, roleId) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('El bot no tiene permiso para gestionar roles.');
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error(`Rol ${roleId} no encontrado.`);
  if (role.position >= botMember.roles.highest.position) {
    throw new Error('El bot no puede asignar un rol con posición igual o superior a la suya.');
  }

  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) throw new Error(`Miembro ${memberId} no encontrado.`);

  await member.roles.add(role, 'Asignado manualmente desde el panel GlitchGang CRM');
  return memberToJson(member);
}

async function removeMemberRole(guildId, memberId, roleId) {
  const guild = await resolveGuild(guildId);

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('El bot no tiene permiso para gestionar roles.');
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error(`Rol ${roleId} no encontrado.`);
  if (role.position >= botMember.roles.highest.position) {
    throw new Error('El bot no puede quitar un rol con posición igual o superior a la suya.');
  }

  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) throw new Error(`Miembro ${memberId} no encontrado.`);

  await member.roles.remove(role, 'Quitado manualmente desde el panel GlitchGang CRM');
  return memberToJson(member);
}

// ── Anuncios (mensaje directo a un canal) ───

async function sendChannelMessage(guildId, channelId, { title, description, color, footer }) {
  const guild = await resolveGuild(guildId);
  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);
  if (!channel.isTextBased()) throw new Error(`El canal ${channel.name} no acepta mensajes de texto.`);

  const botMember = guild.members.me;
  if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
    throw new Error(`El bot no tiene permiso para escribir en #${channel.name}.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(normalizeDiscordColor(color))
    .setTimestamp();
  if (description) embed.setDescription(description);
  if (footer) embed.setFooter({ text: footer });

  await channel.send({ embeds: [embed] });
  return { sent: true, channelId, channelName: channel.name };
}

/**
 * Manda un embed YA armado (EmbedBuilder de discord.js, con campos/imagen/
 * thumbnail) a un canal -- variante de sendChannelMessage para mensajes mas
 * ricos que titulo/descripcion/footer (bienvenida de torneo, staff, panel
 * general de torneos, etc).
 */
async function sendEmbed(guildId, channelId, embedOrEmbeds, options = {}) {
  const guild = await resolveGuild(guildId);
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);

  const botMember = guild.members.me;
  // Discord acepta hasta 10 embeds en un solo mensaje -- se usa para el
  // podio (campeon/subcampeon/tercer lugar) como un unico anuncio en vez de
  // 3 mensajes separados.
  const embeds = Array.isArray(embedOrEmbeds) ? embedOrEmbeds : [embedOrEmbeds];
  const messagePayload = {
    content: options.content,
    embeds,
    components: options.components || [],
    files: options.files || [],
    allowedMentions: options.allowedMentions,
  };

  if (channel.type === ChannelType.GuildForum) {
    const permissions = botMember?.permissionsIn(channel);
    if (!permissions?.has(PermissionFlagsBits.CreatePublicThreads)
      || !permissions.has(PermissionFlagsBits.SendMessagesInThreads)) {
      throw new Error(`El bot necesita permisos para crear publicaciones y responder en el foro #${channel.name}.`);
    }

    const title = String(options.threadName || embeds[0]?.data?.title || channel.name).trim().slice(0, 100);
    const validTags = new Set((channel.availableTags || []).map(tag => tag.id));
    const appliedTags = (options.appliedTags || []).filter(id => validTags.has(id)).slice(0, 5);
    const thread = await channel.threads.create({
      name: title || channel.name,
      message: messagePayload,
      ...(appliedTags.length ? { appliedTags } : {}),
      reason: 'Publicacion desde el Control Center de GlitchGang',
    });
    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
    return {
      id: starterMessage?.id || thread.id,
      threadId: thread.id,
      threadName: thread.name,
      channelId,
      channelName: channel.name,
    };
  }

  if (!channel.isTextBased()) throw new Error(`El canal ${channel.name} no acepta mensajes de texto.`);
  if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
    throw new Error(`El bot no tiene permiso para escribir en #${channel.name}.`);
  }

  const message = await channel.send(messagePayload);
  return { id: message.id, channelId, channelName: channel.name };
}

/**
 * Crea o edita un mensaje "panel" que debe mantenerse unico y actualizado
 * en un canal (ej. el panel general de torneos disponibles). Si
 * existingMessageId todavia existe se edita in-place; si no (borrado, o es
 * la primera vez), se crea uno nuevo y se intenta fijar.
 */
async function upsertPinnedEmbed(guildId, channelId, existingMessageId, embed) {
  const guild = await resolveGuild(guildId);
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);
  if (!channel.isTextBased()) throw new Error(`El canal ${channel.name} no acepta mensajes de texto.`);

  if (existingMessageId) {
    const existing = await channel.messages.fetch(existingMessageId).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [embed] });
      return { id: existing.id, channelId, created: false };
    }
  }

  const message = await channel.send({ embeds: [embed] });
  await message.pin().catch(() => { /* el bot puede no tener permiso de fijar -- no es critico */ });
  return { id: message.id, channelId, created: true };
}

async function fetchGuildChannel(guildId, channelId) {
  const guild = await resolveGuild(guildId);
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error(`Canal ${channelId} no encontrado.`);
  return { guild, channel };
}

/**
 * Edita un mensaje ya publicado por el bot (publicaciones del Control Center).
 * Si el mensaje vive en un tema de foro, channelId es el id del tema.
 */
async function editMessage(guildId, channelId, messageId, payload) {
  const { channel } = await fetchGuildChannel(guildId, channelId);
  if (!channel.isTextBased()) throw new Error(`El canal ${channel.name} no acepta mensajes.`);
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) throw new Error('El mensaje ya no existe en Discord (lo borraron a mano).');
  // attachments: [] quita la imagen adjunta anterior si ahora va otra (o ninguna).
  await message.edit({ ...payload, attachments: [] });
  if (channel.isThread() && payload.threadName) {
    await channel.setName(String(payload.threadName).slice(0, 100)).catch(() => {});
  }
  return { id: message.id, channelId, channelName: channel.name };
}

/**
 * Borra un mensaje publicado. Si el mensaje es el inicial de un tema de foro,
 * se borra el tema entero (un tema sin mensaje inicial queda roto).
 */
async function deleteMessage(guildId, channelId, messageId) {
  const { channel } = await fetchGuildChannel(guildId, channelId);
  if (channel.isThread() && channel.parent?.type === ChannelType.GuildForum) {
    await channel.delete('Retirado desde el Control Center de GlitchGang');
    return { deleted: true, thread: true };
  }
  if (!channel.isTextBased()) throw new Error(`El canal ${channel.name} no acepta mensajes.`);
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return { deleted: true, alreadyGone: true };
  await message.delete();
  return { deleted: true };
}

function threadToJson(thread) {
  return {
    id: thread.id,
    name: thread.name,
    parentId: thread.parentId,
    ownerId: thread.ownerId || null,
    archived: Boolean(thread.archived),
    locked: Boolean(thread.locked),
    messageCount: thread.messageCount ?? null,
    memberCount: thread.memberCount ?? null,
    appliedTags: thread.appliedTags || [],
    createdAt: thread.createdAt?.toISOString() || null,
    lastMessageAt: thread.lastMessage?.createdAt?.toISOString() || null,
  };
}

// Temas (posts) de un foro: activos + los ultimos archivados.
async function listForumThreads(guildId, forumId) {
  const { guild, channel } = await fetchGuildChannel(guildId, forumId);
  if (channel.type !== ChannelType.GuildForum) throw new Error(`#${channel.name} no es un foro.`);
  const active = await guild.channels.fetchActiveThreads().catch(() => ({ threads: new Map() }));
  const archived = await channel.threads.fetchArchived({ limit: 50 }).catch(() => ({ threads: new Map() }));
  const threads = new Map();
  for (const t of active.threads.values()) if (t.parentId === channel.id) threads.set(t.id, t);
  for (const t of archived.threads.values()) threads.set(t.id, t);
  const tags = (channel.availableTags || []).map(tag => ({ id: tag.id, name: tag.name, emoji: tag.emoji?.name || null }));
  const list = [...threads.values()]
    .map(threadToJson)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { forum: channelToJson(channel), tags, threads: list };
}

async function deleteThread(guildId, threadId) {
  const { channel } = await fetchGuildChannel(guildId, threadId);
  if (!channel.isThread()) throw new Error('Eso no es un tema de foro.');
  const name = channel.name;
  await channel.delete('Eliminado desde el Control Center de GlitchGang');
  return { deleted: true, name };
}

// ── Voice States ────────────────────────────

async function getVoiceStates(guildId) {
  const guild = await resolveGuild(guildId);

  const voiceChannels = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
    .sort((a, b) => a.position - b.position);

  return voiceChannels.map(channel => ({
    channelId: channel.id,
    channelName: channel.name,
    parentName: channel.parent?.name || null,
    userLimit: channel.userLimit || 0,
    bitrate: channel.bitrate || 0,
    members: channel.members
      .filter(m => !m.user.bot)
      .map(m => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName,
        avatar: m.user.displayAvatarURL({ size: 64 }),
        selfMute: m.voice.selfMute || false,
        selfDeaf: m.voice.selfDeaf || false,
        serverMute: m.voice.serverMute || false,
        serverDeaf: m.voice.serverDeaf || false,
        streaming: m.voice.streaming || false,
        camera: m.voice.selfVideo || false,
      })),
  }));
}

module.exports = {
  initialize,
  getClient,
  getGuildOverview,
  getChannels,
  createChannel,
  editChannel,
  grantChannelAccess,
  deleteChannel,
  getRoles,
  createRole,
  editRole,
  deleteRole,
  getMembers,
  addMemberRole,
  removeMemberRole,
  getVoiceStates,
  sendChannelMessage,
  sendEmbed,
  upsertPinnedEmbed,
  editMessage,
  deleteMessage,
  listForumThreads,
  deleteThread,
};
