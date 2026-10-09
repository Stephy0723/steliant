// ============================================
// GlitchGang Bot - Despedida
// ============================================
// Multi-tenant: si el servidor no esta dado de alta como cliente de
// GlitchGang (Organization), no se publica nada. El canal y el texto se
// configuran desde /admin/discord-sync (Automatizaciones); si la despedida
// no tiene canal propio usa el de bienvenida.

const { Events } = require('discord.js');
const backendApi = require('../services/backendApi');
const { buildMemberEmbed } = require('../utils/memberMessages');
const { COLORS, EMOJI } = require('../utils/constants');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    let organization = null;
    try {
      organization = await backendApi.getOrganization(member.guild.id);
    } catch (error) {
      return;
    }

    const enabled = organization.farewellEnabled ?? organization.welcomeEnabled;
    if (enabled === false) return;
    const channelId = organization.farewellChannelId || organization.welcomeChannelId;
    if (!channelId) return;

    const channel = await member.guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = buildMemberEmbed(member, {
      title: organization.farewellTitle,
      message: organization.farewellMessage,
      imageUrl: organization.farewellImageUrl,
      color: organization.farewellColor,
    }, {
      title: `${EMOJI.CROSS} {nombre} salio del servidor`,
      message: 'Esperamos verte pronto de nuevo.',
      color: COLORS.DARK,
    });

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
  },
};
