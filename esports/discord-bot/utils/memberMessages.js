// ============================================
// GlitchGang Bot - Mensajes de bienvenida / despedida
// ============================================
// El texto lo escribe el admin en /admin/discord-sync (Automatizaciones) y
// llega con la organizacion (backendApi.getOrganization). Variables:
//   {usuario}  -> mencion (@persona)
//   {nombre}   -> nombre visible en el servidor
//   {nick}     -> nick de GlitchGang si tiene cuenta vinculada, si no {nombre}
//   {servidor} -> nombre del servidor
//   {miembros} -> total de miembros

const { EmbedBuilder } = require('discord.js');
const { normalizeDiscordColor } = require('./colors');
const { BOT_CONFIG } = require('./constants');

function renderTemplate(template, member, profile = null) {
  const name = member.displayName || member.user.username;
  const values = {
    usuario: `<@${member.id}>`,
    nombre: name,
    nick: profile?.nick || name,
    servidor: member.guild.name,
    miembros: String(member.guild.memberCount ?? ''),
  };
  return String(template || '').replace(/\{(usuario|nombre|nick|servidor|miembros)\}/gi, (_, key) => values[key.toLowerCase()]);
}

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || ''));
}

/**
 * Embed de bienvenida/despedida. `custom` trae lo configurado en la web
 * (title/message/imageUrl/color); `fallback` es el texto por defecto del bot
 * cuando el admin todavia no escribio uno propio.
 */
function buildMemberEmbed(member, custom = {}, fallback = {}, profile = null) {
  const title = renderTemplate(custom.title || fallback.title, member, profile);
  const description = renderTemplate(custom.message || fallback.message, member, profile);
  const embed = new EmbedBuilder()
    .setColor(normalizeDiscordColor(custom.color || fallback.color))
    .setTitle(title.slice(0, 256))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${BOT_CONFIG.BRAND_FOOTER} | v${BOT_CONFIG.VERSION}` })
    .setTimestamp();
  if (description) embed.setDescription(description.slice(0, 4000));
  if (isHttpUrl(custom.imageUrl)) embed.setImage(custom.imageUrl);
  return embed;
}

module.exports = { renderTemplate, buildMemberEmbed };
