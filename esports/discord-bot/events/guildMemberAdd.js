// ============================================
// GlitchGang Bot - Bienvenida
// ============================================
// Al entrar un miembro: si ya tiene cuenta de GlitchGang vinculada, le pone
// su rol al dia y lo saluda por su nombre real. Si no, lo saluda igual pero
// le manda por DM el enlace para vincular su cuenta (o crear una nueva).
//
// Multi-tenant: si el servidor no esta dado de alta como cliente de
// GlitchGang (Organization), no se hace nada — evita que cualquiera meta el
// bot a un servidor sin pagar y le funcione igual.

const { Events } = require('discord.js');
const backendApi = require('../services/backendApi');
const { syncMemberRoles, promptLinking } = require('../services/roleSyncService');
const { resolveGameIconUrl } = require('../utils/gameIcons');
const { buildMemberEmbed } = require('../utils/memberMessages');
const { COLORS, EMOJI } = require('../utils/constants');

async function getWelcomeChannel(guild, welcomeChannelId) {
  if (!welcomeChannelId) return null;
  const channel = await guild.channels.fetch(welcomeChannelId).catch(() => null);
  return channel && channel.isTextBased() ? channel : null;
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    let organization = null;
    try {
      organization = await backendApi.getOrganization(member.guild.id);
    } catch (error) {
      // Servidor no registrado como cliente — sin bienvenida, sin roles.
      return;
    }

    const welcomeEnabled = organization.welcomeEnabled !== false;
    const channel = welcomeEnabled ? await getWelcomeChannel(member.guild, organization.welcomeChannelId) : null;

    let profile = null;
    try {
      profile = await backendApi.getPlayerProfile(member.id);
    } catch (error) {
      if (!(error instanceof backendApi.NotLinkedError)) {
        console.error('[Welcome] Error consultando perfil:', error.message);
      }
    }

    // Texto configurado en /admin/discord-sync (Automatizaciones); si esta
    // vacio se usa el mensaje por defecto de cada caso.
    const custom = {
      title: organization.welcomeTitle,
      message: organization.welcomeMessage,
      imageUrl: organization.welcomeImageUrl,
      color: organization.welcomeColor,
    };

    if (profile) {
      await syncMemberRoles(member, profile).catch(() => {});

      if (channel) {
        const embed = buildMemberEmbed(member, custom, {
          title: `${EMOJI.PEOPLE} Bienvenido, {nombre}`,
          message: `Que bueno tenerte de vuelta, **{nick}** (\`${profile.playerCode}\`). Ya tienes tu rol de GlitchGang listo.`,
          color: COLORS.SUCCESS,
        }, profile);

        const iconUrl = resolveGameIconUrl(profile.mainGame);
        if (iconUrl) embed.setThumbnail(iconUrl);

        await channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
      }
      return;
    }

    if (channel) {
      const embed = buildMemberEmbed(member, custom, {
        title: `${EMOJI.PEOPLE} Bienvenido, {nombre}`,
        message: 'Vincula tu cuenta de GlitchGang con `/vincular` para desbloquear tu rol y participar en los torneos por Discord. Te acabamos de mandar el enlace por mensaje privado.',
        color: COLORS.PRIMARY,
      });
      await channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
    }

    if (organization.welcomeDm === false) return;
    await promptLinking(member.user);
  },
};
