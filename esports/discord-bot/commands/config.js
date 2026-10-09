// ============================================
// GlitchGang Bot - /config Command
// ============================================
// Configuracion administrativa del servidor. Por ahora solo controla el
// modulo de bienvenida/despedida custom (services/... via guildMemberAdd.js
// y guildMemberRemove.js), que se activa/desactiva por organizacion.

const { SlashCommandBuilder, PermissionFlagsBits, GuildSystemChannelFlags } = require('discord.js');
const backendApi = require('../services/backendApi');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { refreshTournamentsPanel } = require('../services/tournamentsPanel');

async function handleBienvenida(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply({
      embeds: [errorEmbed('Acceso denegado', 'Solo un administrador (permiso **Gestionar servidor**) puede usar `/config bienvenida`.')],
    });
  }

  const enabled = interaction.options.getString('estado') === 'enable';

  try {
    await backendApi.updateOrganizationWelcome(
      interaction.guildId,
      enabled,
      enabled ? interaction.channelId : undefined
    );
  } catch (error) {
    return interaction.editReply({
      embeds: [errorEmbed('No se pudo guardar', error.message || 'Error consultando el backend de GlitchGang.')],
    });
  }

  // Evita duplicidad: si nuestro mensaje custom esta activo, apagamos el
  // aviso nativo de Discord ("X se unio al servidor"). Si lo desactivamos,
  // devolvemos el nativo como respaldo.
  try {
    const guild = interaction.guild;
    const current = guild.systemChannelFlags?.bitfield ?? 0;
    const nextFlags = enabled
      ? current | GuildSystemChannelFlags.SuppressJoinNotifications
      : current & ~GuildSystemChannelFlags.SuppressJoinNotifications;
    await guild.setSystemChannelFlags(nextFlags, 'Configuracion de bienvenida custom de GlitchGang');
  } catch (error) {
    console.error('[Config] No se pudo ajustar systemChannelFlags:', error.message);
  }

  return interaction.editReply({
    embeds: [
      successEmbed(
        'Bienvenida actualizada',
        enabled
          ? 'La bienvenida/despedida custom de GlitchGang esta **activada**. El aviso nativo de Discord queda silenciado para evitar mensajes duplicados.'
          : 'La bienvenida/despedida custom de GlitchGang esta **desactivada**. El aviso nativo de Discord vuelve a mostrarse.'
      ),
    ],
  });
}

async function handlePanelTorneos(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.editReply({
      embeds: [errorEmbed('Acceso denegado', 'Solo un administrador (permiso **Gestionar servidor**) puede usar `/config panel-torneos`.')],
    });
  }

  try {
    // Fija ESTE canal como el panel -- messageId vacio para forzar que se
    // cree un mensaje nuevo aqui (aunque ya hubiera uno en otro canal).
    await backendApi.updateOrganizationTournamentsPanel(interaction.guildId, interaction.channelId, '');
    const updated = await refreshTournamentsPanel(interaction.guildId);
    return interaction.editReply({
      embeds: [
        successEmbed(
          'Panel de torneos configurado',
          updated
            ? `Este canal (<#${interaction.channelId}>) ahora muestra el panel con los torneos abiertos, y se actualiza solo cada vez que cambia algo.`
            : 'Se guardo el canal, pero no se pudo publicar el panel todavia. Revisa que el bot tenga permiso de escribir aqui.'
        ),
      ],
    });
  } catch (error) {
    return interaction.editReply({
      embeds: [errorEmbed('No se pudo configurar el panel', error.message || 'Error consultando el backend de GlitchGang.')],
    });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configuracion administrativa del servidor')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('bienvenida')
        .setDescription('Activa o desactiva la bienvenida/despedida custom (admin)')
        .addStringOption((option) =>
          option
            .setName('estado')
            .setDescription('enable o disable')
            .setRequired(true)
            .addChoices(
              { name: 'enable', value: 'enable' },
              { name: 'disable', value: 'disable' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('panel-torneos')
        .setDescription('Usa este canal como el panel fijo de torneos disponibles (admin)')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'bienvenida') {
      return handleBienvenida(interaction);
    }
    if (subcommand === 'panel-torneos') {
      return handlePanelTorneos(interaction);
    }
  },
};
