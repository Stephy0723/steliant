// ============================================
// GlitchGang Bot - Role Sync Service
// ============================================
// Sincroniza los roles de Discord de un miembro con su(s) rol(es) reales de
// GlitchGang (User.role/roles del backend). Reemplaza la autogestion manual
// que tenia /rol tomar|quitar — el rol de Discord ahora refleja la cuenta
// vinculada, no lo que el usuario elija.

const { PermissionFlagsBits } = require('discord.js');
const backendApi = require('./backendApi');
const { linkPromptEmbed } = require('../utils/embeds');

const WEB_ROLE_DISCORD_NAMES = {
  player: 'Jugador',
  organizer: 'Organizador',
  coach: 'Coach',
  caster: 'Caster',
  analyst: 'Analista',
  creator: 'Creador',
  brand: 'Marca',
  sponsor: 'Patrocinador',
  admin: 'Administrador',
};

const MANAGED_ROLE_NAMES = [...new Set(Object.values(WEB_ROLE_DISCORD_NAMES))];

function canManageRole(botMember, role) {
  return role.position < botMember.roles.highest.position;
}

/** Crea en el servidor los roles del mapa que todavia no existan. */
async function ensureWebRolesExist(guild) {
  const created = [];

  for (const name of MANAGED_ROLE_NAMES) {
    const existing = guild.roles.cache.find((role) => role.name === name);
    if (existing) continue;

    try {
      await guild.roles.create({
        name,
        hoist: false,
        mentionable: true,
        reason: 'Rol automatico de GlitchGang (sincronizacion de cuenta vinculada)',
      });
      created.push(name);
    } catch (error) {
      console.error(`[RoleSync] No se pudo crear el rol "${name}":`, error.message);
    }
  }

  return created;
}

function resolveWebRoleNames(profile) {
  const roles = new Set();
  if (profile?.role) roles.add(profile.role);
  for (const r of profile?.roles || []) roles.add(r);
  return [...roles].map((r) => WEB_ROLE_DISCORD_NAMES[r]).filter(Boolean);
}

/**
 * Ajusta los roles de Discord del miembro para que coincidan con su(s)
 * rol(es) en GlitchGang. Solo toca roles del mapa (Capitan, Arbitro y
 * cualquier otro rol del servidor se quedan de gestion manual).
 */
async function syncMemberRoles(member, profile) {
  const result = { added: [], removed: [] };
  if (!member?.guild || !profile) return result;

  const botMember = member.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return result;

  const wantedNames = new Set(resolveWebRoleNames(profile));

  for (const name of MANAGED_ROLE_NAMES) {
    const role = member.guild.roles.cache.find((r) => r.name === name);
    if (!role || !canManageRole(botMember, role)) continue;

    const has = member.roles.cache.has(role.id);
    const shouldHave = wantedNames.has(name);

    if (shouldHave && !has) {
      await member.roles.add(role, 'Sincronizacion automatica con cuenta de GlitchGang').catch(() => {});
      result.added.push(name);
    } else if (!shouldHave && has) {
      await member.roles.remove(role, 'Sincronizacion automatica con cuenta de GlitchGang').catch(() => {});
      result.removed.push(name);
    }
  }

  return result;
}

/** Le manda al usuario el mismo mensaje/enlace que genera /vincular. */
async function promptLinking(user) {
  try {
    const result = await backendApi.linkStart(user.id, user.username);
    if (result.alreadyLinked) return false;
    await user.send({ embeds: [linkPromptEmbed(result)] });
    return true;
  } catch (error) {
    console.error(`[RoleSync] No se pudo enviar el DM de vinculacion a ${user.id}:`, error.message);
    return false;
  }
}

/**
 * Recorre todos los miembros de un servidor y sincroniza su rol de Discord
 * con su cuenta de GlitchGang. Antes esto solo pasaba si alguien corria
 * /rol sincronizar a mano, o cuando el propio usuario ejecutaba un comando
 * (perfil, torneo, etc) despues de vincular — si nunca volvia a tocar el
 * bot, se quedaba sin rol indefinidamente. Ahora corre solo (ver
 * startAutoRoleSync en events/ready.js).
 */
async function syncGuildRoles(guild) {
  const stats = { linked: 0, unlinked: 0, changed: 0 };

  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return stats;

  await ensureWebRolesExist(guild);

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return stats;

  for (const member of members.values()) {
    if (member.user.bot) continue;

    try {
      const profile = await backendApi.getPlayerProfile(member.id);
      stats.linked += 1;
      const { added, removed } = await syncMemberRoles(member, profile);
      if (added.length || removed.length) stats.changed += 1;
    } catch (error) {
      if (error instanceof backendApi.NotLinkedError) {
        stats.unlinked += 1;
      } else {
        console.error(`[RoleSync] Error sincronizando a ${member.id} en ${guild.name}:`, error.message);
      }
    }
  }

  return stats;
}

/** Corre syncGuildRoles para cada servidor del bot, en un intervalo fijo. */
function startAutoRoleSync(client, intervalMs = 10 * 60 * 1000) {
  const runAll = async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const stats = await syncGuildRoles(guild);
        if (stats.changed > 0) {
          console.log(`[RoleSync] ${guild.name}: ${stats.changed} miembro(s) actualizados (${stats.linked} vinculados, ${stats.unlinked} sin vincular).`);
        }
      } catch (error) {
        console.error(`[RoleSync] Error sincronizando ${guild.name}:`, error.message);
      }
    }
  };

  // Primera pasada poco despues de arrancar (deja que el cache de guilds/members se llene).
  setTimeout(runAll, 15_000);
  setInterval(runAll, intervalMs);
}

module.exports = {
  WEB_ROLE_DISCORD_NAMES,
  MANAGED_ROLE_NAMES,
  canManageRole,
  ensureWebRolesExist,
  syncMemberRoles,
  syncGuildRoles,
  startAutoRoleSync,
  promptLinking,
};
