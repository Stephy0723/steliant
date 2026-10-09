// ============================================
// GlitchGang Bot - /rol Command
// ============================================
// El rol de Discord de cada jugador ahora se sincroniza automaticamente con
// su cuenta de GlitchGang (ver services/roleSyncService.js) — ya no existe
// autogestion manual (antes /rol tomar|quitar).

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const backendApi = require('../services/backendApi');
const {
  MANAGED_ROLE_NAMES,
  canManageRole,
  ensureWebRolesExist,
  syncMemberRoles,
} = require('../services/roleSyncService');
const { successEmbed, errorEmbed, infoEmbed, warningEmbed } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');

// Roles con permisos/colores propios ademas de los del mapa automatico
// (services/roleSyncService.js). Capitan y Arbitro no tienen rol web
// equivalente — se quedan de asignacion manual por un admin.
const EXTRA_ROLE_DEFINITIONS = [
  {
    name: 'Administrador',
    color: COLORS.PRIMARY,
    permissions: [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
    ],
  },
  {
    name: 'Arbitro',
    color: COLORS.WARNING,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.MoveMembers,
    ],
  },
  {
    name: 'Caster',
    color: COLORS.INFO,
    permissions: [
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.PrioritySpeaker,
    ],
  },
  {
    name: 'Capitan',
    color: COLORS.SUCCESS,
    permissions: [],
  },
  {
    name: 'Jugador',
    color: COLORS.DARK,
    permissions: [],
  },
];

function formatLines(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

async function ensureManageRolesPermission(interaction) {
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          'Permisos insuficientes',
          'Necesito el permiso **Gestionar roles** para crear, editar o sincronizar roles.'
        ),
      ],
    });
    return false;
  }

  return true;
}

async function handleConfigure(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({
      embeds: [
        errorEmbed(
          'Acceso denegado',
          'Solo alguien con permiso para gestionar roles puede ejecutar `/rol configurar`.'
        ),
      ],
    });
  }

  if (!(await ensureManageRolesPermission(interaction))) {
    return null;
  }

  const createdRoles = [];
  const updatedRoles = [];
  const existingRoles = [];
  const blockedRoles = [];

  // 1. Roles con permisos/colores propios (Administrador, Arbitro, Caster, Capitan, Jugador)
  for (const roleDef of EXTRA_ROLE_DEFINITIONS) {
    const role = interaction.guild.roles.cache.find((r) => r.name === roleDef.name);

    if (!role) {
      try {
        await interaction.guild.roles.create({
          name: roleDef.name,
          color: roleDef.color,
          permissions: roleDef.permissions,
          hoist: false,
          mentionable: true,
          reason: 'Configuracion base de roles del servidor',
        });
        createdRoles.push(roleDef.name);
      } catch (error) {
        console.error(`[Rol] Error creando rol ${roleDef.name}:`, error);
        blockedRoles.push(`${roleDef.name}: no se pudo crear`);
      }
      continue;
    }

    if (!canManageRole(interaction.guild.members.me, role)) {
      blockedRoles.push(`${role.name}: esta por encima del rol del bot`);
      continue;
    }

    const needsUpdate =
      role.color !== roleDef.color ||
      role.mentionable !== true ||
      role.hoist !== false ||
      !role.permissions.equals(roleDef.permissions);

    if (!needsUpdate) {
      existingRoles.push(role.name);
      continue;
    }

    try {
      await role.edit({
        color: roleDef.color,
        permissions: roleDef.permissions,
        hoist: false,
        mentionable: true,
        reason: 'Normalizacion de roles del servidor',
      });
      updatedRoles.push(roleDef.name);
    } catch (error) {
      console.error(`[Rol] Error actualizando rol ${role.name}:`, error);
      blockedRoles.push(`${role.name}: no se pudo actualizar`);
    }
  }

  // 2. Resto de roles del mapa automatico (Organizador, Analista, Creador, Marca, Patrocinador...)
  const createdWebRoles = await ensureWebRolesExist(interaction.guild);
  createdRoles.push(...createdWebRoles.filter((name) => !createdRoles.includes(name)));

  const sections = [
    'Roles del servidor revisados.',
    '',
    `Roles sincronizados automaticamente segun la cuenta de GlitchGang: ${MANAGED_ROLE_NAMES.map((name) => `\`${name}\``).join(', ')}`,
  ];

  if (createdRoles.length > 0) {
    sections.push('', `Creados:\n${formatLines(createdRoles)}`);
  }

  if (updatedRoles.length > 0) {
    sections.push('', `Actualizados:\n${formatLines(updatedRoles)}`);
  }

  if (existingRoles.length > 0) {
    sections.push('', `Sin cambios:\n${formatLines(existingRoles)}`);
  }

  if (blockedRoles.length > 0) {
    sections.push(
      '',
      `Pendientes:\n${formatLines(blockedRoles)}`,
      '',
      'Si algo quedo pendiente, sube el rol del bot por encima de los roles que quieres administrar.'
    );
  }

  const embedBuilder = blockedRoles.length > 0 ? warningEmbed : successEmbed;
  return interaction.editReply({
    embeds: [embedBuilder('Configuracion de roles', sections.join('\n'))],
  });
}

async function handleList(interaction) {
  const description = [
    'Tu rol en Discord ahora se toma directamente de tu cuenta de GlitchGang —',
    'ya no se puede elegir a mano.',
    '',
    `Roles automaticos: ${MANAGED_ROLE_NAMES.map((name) => `\`${name}\``).join(', ')}`,
    '',
    '¿No tienes ninguno? Usa `/vincular` para conectar tu cuenta de Discord con',
    'tu cuenta de GlitchGang (o crear una si aun no tienes) — el bot te asigna',
    'el rol correcto apenas quede vinculada.',
  ].join('\n');

  await interaction.reply({
    embeds: [infoEmbed('Roles automaticos', description)],
    ephemeral: true,
  });
}

async function handleSync(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply({
      embeds: [errorEmbed('Acceso denegado', 'Solo un administrador puede ejecutar `/rol sincronizar`.')],
    });
  }

  if (!(await ensureManageRolesPermission(interaction))) {
    return null;
  }

  const members = await interaction.guild.members.fetch();
  let linked = 0;
  let unlinked = 0;
  let changed = 0;

  for (const member of members.values()) {
    if (member.user.bot) continue;

    try {
      const profile = await backendApi.getPlayerProfile(member.id);
      linked += 1;
      const { added, removed } = await syncMemberRoles(member, profile);
      if (added.length || removed.length) changed += 1;
    } catch (error) {
      if (error instanceof backendApi.NotLinkedError) {
        unlinked += 1;
      } else {
        console.error(`[Rol] Error sincronizando a ${member.id}:`, error.message);
      }
    }
  }

  return interaction.editReply({
    embeds: [
      successEmbed(
        'Sincronizacion completa',
        [
          `Miembros con cuenta vinculada: **${linked}**`,
          `Miembros sin vincular: **${unlinked}**`,
          `Con roles actualizados en esta pasada: **${changed}**`,
        ].join('\n')
      ),
    ],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rol')
    .setDescription('Roles del servidor sincronizados con la cuenta de GlitchGang')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('configurar')
        .setDescription('Crea o normaliza los roles base del servidor')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ver')
        .setDescription('Explica como funcionan los roles automaticos')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sincronizar')
        .setDescription('Ajusta los roles de todos los miembros segun su cuenta de GlitchGang (admin)')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'configurar') {
      return handleConfigure(interaction);
    }

    if (subcommand === 'ver') {
      return handleList(interaction);
    }

    return handleSync(interaction);
  },
};
