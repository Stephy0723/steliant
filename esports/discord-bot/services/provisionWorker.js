const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const backendApi = require('./backendApi');
const discordGuild = require('./discordGuildService');
const announceEmbeds = require('../utils/tournamentAnnounceEmbeds');
const { refreshTournamentsPanel } = require('./tournamentsPanel');
const { archiveResolvedTicket } = require('./supportTicketService');

const CHANNEL_ANNOUNCE_BUILDER = {
  newsId: announceEmbeds.tournamentIntroEmbed,
  rulesId: announceEmbeds.tournamentRulesEmbed,
  bracketId: announceEmbeds.tournamentBracketEmbed,
  checkinId: announceEmbeds.tournamentCheckinInfoEmbed,
  resultsId: announceEmbeds.tournamentResultsEmbed,
  supportId: announceEmbeds.tournamentSupportEmbed,
  staffId: announceEmbeds.tournamentStaffEmbed,
};

const WORKER_ID = `discord-bot:${process.pid}`;
const INTERVAL_MS = Number(process.env.DISCORD_PROVISION_POLL_MS || 8000);

let timer = null;
let running = false;

// Node/undici envuelven fallos de conexion (DNS, timeout, conexion
// rechazada al pegarle a la API de Discord) en un AggregateError cuyo
// .message es solo "Received one or more errors" -- sin esto, el
// organizador solo ve ese texto generico y no hay forma de saber si es
// DNS, timeout, token invalido, etc. Bajamos hasta la causa real.
function describeProvisionError(error) {
  if (!error) return 'Error desconocido';
  const inner = Array.isArray(error.errors) && error.errors.length ? error.errors[0] : error.cause;
  if (inner && inner !== error) {
    const innerMsg = describeProvisionError(inner);
    const code = inner.code ? ` (${inner.code})` : '';
    return `${error.message || 'Error de red'}: ${innerMsg}${code}`;
  }
  const code = error.code ? ` (${error.code})` : '';
  return `${error.message || 'Error desconocido'}${code}`;
}

function slug(value, fallback = 'item') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function mergeDiscordState(current = {}, patch = {}) {
  return {
    guildId: patch.guildId || current.guildId || process.env.GUILD_ID || '',
    categoryId: patch.categoryId || current.categoryId || '',
    organizerRoleId: patch.organizerRoleId || current.organizerRoleId || '',
    staffRoleId: patch.staffRoleId || current.staffRoleId || '',
    playerRoleId: patch.playerRoleId || current.playerRoleId || '',
    teamStaffRoleId: patch.teamStaffRoleId || current.teamStaffRoleId || '',
    channels: {
      ...(current.channels || {}),
      ...(patch.channels || {}),
    },
  };
}

function categoryOverwrites(guildId, roles) {
  return [
    { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.organizerRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MoveMembers] },
    { id: roles.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MoveMembers] },
    { id: roles.playerRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    // Staff de los equipos (coach, analista, manager): ve y escribe en los
    // canales compartidos del torneo, separado de los jugadores. No es el
    // staff del organizador (staffRoleId: arbitros, moderadores).
    { id: roles.teamStaffRoleId, allow: TEAM_STAFF_ALLOW },
    { id: process.env.RECORDER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
  ].filter(item => item.id);
}

const TEAM_STAFF_ALLOW = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
// Canales compartidos del torneo a los que entra el staff de equipo (no #staff).
const TEAM_STAFF_CHANNEL_KEYS = ['newsId', 'rulesId', 'bracketId', 'checkinId', 'resultsId', 'supportId', 'lobbyVoiceId'];

function privateTeamOverwrites(guildId, roles, teamRoleId) {
  return [
    { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.organizerRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MoveMembers] },
    { id: roles.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MoveMembers] },
    { id: teamRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: process.env.RECORDER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
  ].filter(item => item.id);
}

async function ensureRole(guildId, existingId, data) {
  if (existingId) return { id: existingId, created: false };
  const role = await discordGuild.createRole(guildId, data);
  return { id: role.id, created: true };
}

async function ensureChannel(guildId, existingId, data) {
  if (existingId) {
    const recorderOverwrite = (data.permissionOverwrites || []).find(item => item.id === process.env.RECORDER_ROLE_ID);
    if (recorderOverwrite) {
      await discordGuild.grantChannelAccess(guildId, existingId, process.env.RECORDER_ROLE_ID, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        SendMessages: true,
      }).catch((error) => {
        console.warn(`[Provision] No se pudo sincronizar permiso de grabador en ${existingId}: ${error.message}`);
      });
    }
    return { id: existingId, created: false };
  }
  const channel = await discordGuild.createChannel(guildId, data);
  return { id: channel.id, created: true };
}

async function provisionTournament(event) {
  const tournamentId = event.payload?.tournamentId || event.entityId;
  const { tournament } = await backendApi.getTournamentProvisionState(tournamentId);
  const guildId = tournament.discordProvision?.guildId || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('Falta GUILD_ID para crear el espacio del torneo.');

  const name = tournament.title || tournament.publicId || 'torneo';
  const safe = slug(name, 'torneo');
  const current = tournament.discordProvision || {};

  // Se va llenando a medida que cada paso tiene exito. Antes, si algo
  // truena a mitad de camino (rate limit, error de Discord API), todo lo
  // creado hasta ese punto se perdia -- el evento quedaba en 'failed' sin
  // guardar ningun ID, y el proximo reintento volvia a crear TODO de cero,
  // duplicando roles/canales huerfanos en el servidor. Ahora el catch de
  // abajo adjunta este progreso parcial al error para que el caller lo
  // guarde igual, y el proximo `ensureRole`/`ensureChannel` reutilice esos
  // IDs en vez de crear de nuevo.
  const partial = { guildId };

  try {
    const organizerRole = await ensureRole(guildId, current.organizerRoleId, {
      name: `org-${safe}`.slice(0, 95),
      color: '#ff3b3b',
      mentionable: true,
    });
    partial.organizerRoleId = organizerRole.id;

    const staffRole = await ensureRole(guildId, current.staffRoleId, {
      name: `staff-${safe}`.slice(0, 95),
      color: '#f59e0b',
      mentionable: true,
    });
    partial.staffRoleId = staffRole.id;

    const playerRole = await ensureRole(guildId, current.playerRoleId, {
      name: `torneo-${safe}`.slice(0, 95),
      color: '#00e676',
      mentionable: true,
    });
    partial.playerRoleId = playerRole.id;

    const teamStaffRole = await ensureRole(guildId, current.teamStaffRoleId, {
      name: `coach-${safe}`.slice(0, 95),
      color: '#a855f7',
      mentionable: true,
    });
    partial.teamStaffRoleId = teamStaffRole.id;

    const roles = {
      organizerRoleId: organizerRole.id,
      staffRoleId: staffRole.id,
      playerRoleId: playerRole.id,
      teamStaffRoleId: teamStaffRole.id,
    };

    const category = await ensureChannel(guildId, current.categoryId, {
      name: `Torneo - ${name}`.slice(0, 90),
      type: 'category',
      permissionOverwrites: categoryOverwrites(guildId, roles),
    });
    partial.categoryId = category.id;

    const channels = current.channels || {};
    const channelSpecs = [
      ['newsId', 'noticias', 'Anuncios oficiales del torneo.'],
      ['rulesId', 'reglas', 'Reglamento y requisitos del torneo.'],
      ['bracketId', 'bracket', 'Bracket, rondas y proximos enfrentamientos.'],
      ['checkinId', 'check-in', 'Check-in y avisos operativos.'],
      ['resultsId', 'resultados', 'Resultados reportados por los equipos.'],
      ['supportId', 'soporte', 'Soporte del torneo.'],
      ['staffId', 'staff', 'Canal interno del staff.'],
    ];

    const createdChannels = { ...channels };
    partial.channels = createdChannels;
    for (const [key, channelName, topic] of channelSpecs) {
      const channel = await ensureChannel(guildId, channels[key], {
        name: channelName,
        type: 'text',
        parentId: category.id,
        topic,
        permissionOverwrites: key === 'staffId'
          ? [
              { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
              { id: roles.playerRoleId, deny: [PermissionFlagsBits.ViewChannel] },
              { id: roles.teamStaffRoleId, deny: [PermissionFlagsBits.ViewChannel] },
              { id: roles.organizerRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
              { id: roles.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
            ].filter(item => item.id)
          : [],
      });
      createdChannels[key] = channel.id;
      partial.channels = { ...createdChannels };

      // Mensaje de bienvenida/explicacion del canal -- solo la primera vez
      // que el canal se crea, nunca en un re-sync (para no duplicar posts).
      const buildEmbed = channel.created && CHANNEL_ANNOUNCE_BUILDER[key];
      if (buildEmbed) {
        const options = key === 'supportId' && announceEmbeds.tournamentSupportComponents
          ? { components: announceEmbeds.tournamentSupportComponents(tournament) }
          : undefined;
        await discordGuild.sendEmbed(guildId, channel.id, buildEmbed(tournament), options).catch((error) => {
          console.warn(`[Provision] No se pudo publicar el mensaje de bienvenida en #${channelName}: ${error.message}`);
        });
      }
    }

    const lobby = await ensureChannel(guildId, channels.lobbyVoiceId, {
      name: 'Lobby',
      type: 'voice',
      parentId: category.id,
    });
    createdChannels.lobbyVoiceId = lobby.id;
    partial.channels = { ...createdChannels };

    // Torneo ya armado antes de existir el rol de staff de equipo: la
    // categoria y sus canales no se recrean, asi que se le da acceso a mano.
    if (teamStaffRole.created && !category.created) {
      const allow = { ViewChannel: true, SendMessages: true, Connect: true, Speak: true };
      for (const channelId of [category.id, ...TEAM_STAFF_CHANNEL_KEYS.map(key => createdChannels[key])].filter(Boolean)) {
        await discordGuild.grantChannelAccess(guildId, channelId, teamStaffRole.id, allow).catch((error) => {
          console.warn(`[Provision] No se pudo dar acceso al staff de equipo en ${channelId}: ${error.message}`);
        });
      }
      if (createdChannels.staffId) {
        await discordGuild.grantChannelAccess(guildId, createdChannels.staffId, teamStaffRole.id, { ViewChannel: false }).catch(() => {});
      }
    }

    const organizerDiscordId = tournament.organizer?.discord?.id;
    if (organizerDiscordId) {
      await discordGuild.addMemberRole(guildId, organizerDiscordId, roles.organizerRoleId).catch((error) => {
        console.warn(`[Provision] No se pudo asignar rol organizador a ${organizerDiscordId}: ${error.message}`);
      });
    }

    // Staff aceptado (arbitros, moderadores, casters, etc.) -- sin esto el
    // staffRoleId se crea y se usa en los overwrites de #staff/categoria pero
    // nadie lo recibe nunca, dejando al staff invitado sin acceso real.
    const acceptedStaff = (tournament.staffMembers || []).filter((member) => member.status === 'accepted');
    for (const member of acceptedStaff) {
      const staffDiscordId = member.user?.discord?.id;
      if (!staffDiscordId) continue;
      await discordGuild.addMemberRole(guildId, staffDiscordId, roles.staffRoleId).catch((error) => {
        console.warn(`[Provision] No se pudo asignar rol de staff a ${staffDiscordId}: ${error.message}`);
      });
    }

    // Este torneo puede ser nuevo en la lista de "torneos disponibles" del
    // servidor -- refresca el panel general si ya esta configurado (no falla
    // el aprovisionamiento si el panel no existe o el refresh falla).
    await refreshTournamentsPanel(guildId).catch((error) => {
      console.warn(`[Provision] No se pudo refrescar el panel de torneos: ${error.message}`);
    });

    return {
      tournamentDiscord: mergeDiscordState(current, {
        guildId,
        categoryId: category.id,
        ...roles,
        channels: createdChannels,
      }),
    };
  } catch (error) {
    error.partial = mergeDiscordState(current, partial);
    throw error;
  }
}

async function provisionTeam(event) {
  const teamId = event.payload?.teamId || event.entityId;
  const tournamentId = event.payload?.tournamentId;
  const { team, tournament, registrationId, teamDiscordProvision, staffUserIds: staffIds = [] } = await backendApi.getTeamProvisionState(teamId, tournamentId);
  // Cuentas que son staff del equipo (coach, analista, manager), segun el backend.
  const staffUserIds = new Set(staffIds.map(String));
  const tournamentDiscord = tournament?.discordProvision || {};
  const guildId = tournamentDiscord.guildId || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('Falta GUILD_ID para crear el espacio del equipo.');
  if (!tournamentDiscord.categoryId) throw new Error('El torneo aun no tiene categoria Discord creada.');
  if (!registrationId) {
    return { skipped: true, reason: 'registration_cancelled_or_missing', teamId, tournamentId };
  }

  const safe = slug(team.name || team.tag, 'equipo');
  // Un equipo puede estar inscrito en varios torneos activos a la vez --
  // el estado de su sala se guarda por INSCRIPCION (Tournament.registrations),
  // no en el equipo, porque cada torneo le crea su propia sala/categoria.
  const current = teamDiscordProvision || {};
  // Mismo motivo que en provisionTournament: si algo truena a mitad de
  // camino, esto guarda lo ya creado para que el proximo intento reutilice
  // esos IDs en vez de duplicar rol/categoria/canales del equipo.
  const partial = {};

  try {
    const teamRole = await ensureRole(guildId, current.roleId, {
      name: `team-${safe}`.slice(0, 95),
      color: team.color || '#00e676',
      mentionable: true,
    });
    partial.roleId = teamRole.id;

    const roles = {
      organizerRoleId: tournamentDiscord.organizerRoleId,
      staffRoleId: tournamentDiscord.staffRoleId,
    };
    const overwrites = privateTeamOverwrites(guildId, roles, teamRole.id);

    // Categoria propia del equipo (no cuelga directo de la categoria del
    // torneo -- Discord no anida categorias, pero al vivir en SU PROPIA
    // categoria, sus canales de texto quedan arriba y su voz justo abajo,
    // sin mezclarse con el texto/voz de los demas equipos de este torneo.
    const category = await ensureChannel(guildId, current.categoryId, {
      name: `Equipo - ${team.name}`.slice(0, 90),
      type: 'category',
      permissionOverwrites: overwrites,
    });
    partial.categoryId = category.id;

    const text = await ensureChannel(guildId, current.textChannelId, {
      name: `team-${safe}`.slice(0, 95),
      type: 'text',
      parentId: category.id,
      topic: `Chat privado de ${team.name}.`,
      permissionOverwrites: overwrites,
    });
    partial.textChannelId = text.id;

    const bracket = await ensureChannel(guildId, current.bracketChannelId, {
      name: `team-${safe}-bracket`.slice(0, 95),
      type: 'text',
      parentId: category.id,
      topic: `Bracket y proximos enfrentamientos de ${team.name}.`,
      permissionOverwrites: overwrites,
    });
    partial.bracketChannelId = bracket.id;

    const voice = await ensureChannel(guildId, current.voiceChannelId, {
      name: `Team ${team.name}`.slice(0, 95),
      type: 'voice',
      parentId: category.id,
      permissionOverwrites: overwrites,
    });
    partial.voiceChannelId = voice.id;

    const players = [team.leader, ...(team.members || [])].filter(Boolean);
    const missingDiscordUsers = [];
    const syncedPlayerDiscordIds = [];
    for (const player of players) {
      const discordId = player.discord?.id;
      if (!discordId) {
        missingDiscordUsers.push(String(player._id || player.id || player.playerCode || player.nick));
        continue;
      }
      await discordGuild.addMemberRole(guildId, discordId, teamRole.id).catch((error) => {
        console.warn(`[Provision] No se pudo asignar rol de equipo a ${discordId}: ${error.message}`);
        missingDiscordUsers.push(String(player._id || discordId));
      });
      // Rol del torneo (categoryOverwrites le da acceso a noticias/reglas/
      // bracket general/check-in/resultados) -- sin esto el jugador solo ve
      // su sala de equipo, nunca los canales compartidos del torneo.
      // Coach/analista/manager del equipo: su propio rol (coach-<torneo>),
      // no el de jugador. Torneo armado antes de ese rol: el de jugador.
      const isTeamStaff = staffUserIds.has(String(player._id || player.id || ''));
      const tournamentRoleId = isTeamStaff && tournamentDiscord.teamStaffRoleId
        ? tournamentDiscord.teamStaffRoleId
        : tournamentDiscord.playerRoleId;
      if (tournamentRoleId) {
        await discordGuild.addMemberRole(guildId, discordId, tournamentRoleId).catch((error) => {
          console.warn(`[Provision] No se pudo asignar rol de torneo a ${discordId}: ${error.message}`);
        });
      }
      syncedPlayerDiscordIds.push(discordId);
    }

    // Bienvenida con reglas/bot explicadas -- se reintenta mientras no se haya
    // confirmado que salio (welcomeSent), no solo "la primera vez que se crea
    // el canal": si el envio fallo (Discord caido, permisos, etc) el canal ya
    // quedo creado y un re-sync por "text.created" nunca mas lo hubiera vuelto
    // a intentar. Con welcomeSent en el equipo, un reintento manual (boton
    // "Reintentar Discord"/"Reenviar bienvenida" del organizador) sí lo repite,
    // y una vez que se confirma el envio no se vuelve a mandar.
    let welcomeSent = Boolean(current.welcomeSent)
    if (!welcomeSent) {
      try {
        await discordGuild.sendEmbed(guildId, text.id, announceEmbeds.teamWelcomeEmbed(team, tournament, {
          rulesChannelId: tournamentDiscord.channels?.rulesId,
          missingDiscordUsers,
        }))
        welcomeSent = true
      } catch (error) {
        console.warn(`[Provision] No se pudo publicar la bienvenida en #team-${safe}: ${error.message}`)
      }
    }

    return {
      teamDiscord: {
        status: missingDiscordUsers.length ? 'partial' : 'ready',
        guildId,
        teamName: team.name || team.tag || '',
        roleId: teamRole.id,
        categoryId: category.id,
        textChannelId: text.id,
        bracketChannelId: bracket.id,
        voiceChannelId: voice.id,
        missingDiscordUsers,
        syncedPlayerDiscordIds,
        welcomeSent,
      },
    };
  } catch (error) {
    error.partial = { ...current, ...partial, status: 'failed' };
    throw error;
  }
}

// Limpieza al dar de baja un equipo de un torneo (cancelRegistration) -- la
// inscripcion ya se borro de Mongo para cuando esto corre, asi que los IDs a
// borrar viajan en el payload del evento (no se pueden volver a consultar).
// Best-effort: cada borrado es independiente, "ya no existe" no cuenta como
// error (alguien pudo haberlo borrado a mano antes), y un fallo real en un
// recurso no bloquea el resto.
async function deprovisionTeam(event) {
  const { guildId, roleId, categoryId, textChannelId, bracketChannelId, voiceChannelId, teamName } = event.payload || {};
  if (!guildId) throw new Error('Falta guildId para eliminar la sala del equipo.');

  const isMissing = (error) => /no encontrado/i.test(error.message || '');
  const errors = [];

  // Canales primero, categoria al final (borrar la categoria no borra sus
  // canales, solo los deja sin padre).
  for (const channelId of [textChannelId, bracketChannelId, voiceChannelId, categoryId].filter(Boolean)) {
    await discordGuild.deleteChannel(guildId, channelId).catch((error) => {
      if (isMissing(error)) return;
      console.warn(`[Provision] No se pudo eliminar canal ${channelId} de "${teamName}": ${error.message}`);
      errors.push(error.message);
    });
  }

  if (roleId) {
    await discordGuild.deleteRole(guildId, roleId).catch((error) => {
      if (isMissing(error)) return;
      console.warn(`[Provision] No se pudo eliminar rol de equipo de "${teamName}": ${error.message}`);
      errors.push(error.message);
    });
  }

  return { teamDeprovision: { deletedAt: new Date().toISOString(), errors } };
}

// Se dispara cuando bracketSync.service.js (backend) detecta que AMBOS
// equipos reportaron el mismo resultado y ese resultado dejo campeon --
// publica el podio en el canal de resultados del torneo. No decide nada:
// el backend ya confirmo el resultado antes de encolar esto.
async function announceTournamentFinished(event) {
  const { tournamentId, champion, runnerUp, thirdPlace } = event.payload || {};
  const { tournament } = await backendApi.getTournamentProvisionState(tournamentId);
  const guildId = tournament.discordProvision?.guildId || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
  const channelId = tournament.discordProvision?.channels?.resultsId || tournament.discordProvision?.channels?.newsId;
  if (!guildId || !channelId) throw new Error('Falta guildId o canal de resultados para anunciar el campeon.');

  const embeds = [announceEmbeds.championEmbed(tournament, champion)];
  if (runnerUp) embeds.push(announceEmbeds.runnerUpEmbed(tournament, runnerUp));
  if (Array.isArray(thirdPlace) && thirdPlace.length) embeds.push(announceEmbeds.thirdPlaceEmbed(tournament, thirdPlace));

  await discordGuild.sendEmbed(guildId, channelId, embeds.length === 1 ? embeds[0] : embeds);
  return { announced: true, champion, runnerUp, thirdPlace };
}

// Se dispara cuando un resultado confirmado avanza una ronda pero el
// torneo todavia no tiene campeon -- refresca el canal de bracket GENERAL
// del torneo, y tambien el canal de bracket PROPIO de cada uno de los 2
// equipos del partido (el que provisionTeam les crea, "team-x-bracket") si
// tienen sala -- sin esto la promesa del mensaje de bienvenida ("tu proximo
// rival se publica solo en tu canal de bracket") queda vacia para siempre.
async function announceBracketUpdated(event) {
  const { tournamentId, matchId, winnerName } = event.payload || {};
  const { tournament } = await backendApi.getTournamentProvisionState(tournamentId);
  const guildId = tournament.discordProvision?.guildId || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
  const generalChannelId = tournament.discordProvision?.channels?.bracketId;
  if (!guildId) throw new Error('Falta guildId para actualizar el resultado.');

  const results = tournament.bracketDoc?.results || {};
  const match = results[matchId];
  if (!match) throw new Error(`No se encontro el resultado ${matchId} en el bracket para anunciar.`);

  const embed = announceEmbeds.bracketMatchConfirmedEmbed(tournament, {
    teamA: match.a, teamB: match.b, winner: winnerName,
  });

  if (generalChannelId) {
    await discordGuild.sendEmbed(guildId, generalChannelId, embed).catch((error) => {
      console.warn(`[Provision] No se pudo publicar en el canal de bracket del torneo: ${error.message}`);
    });
  }

  const norm = (s) => String(s || '').trim().toLowerCase();
  const involvedNames = new Set([norm(match.a), norm(match.b)]);
  const teamChannels = (tournament.registrations || [])
    .filter((reg) => involvedNames.has(norm(reg.teamMeta?.name)))
    .map((reg) => reg.discordProvision?.bracketChannelId)
    .filter(Boolean);
  for (const teamChannelId of teamChannels) {
    await discordGuild.sendEmbed(guildId, teamChannelId, embed).catch((error) => {
      console.warn(`[Provision] No se pudo publicar en el canal de bracket del equipo ${teamChannelId}: ${error.message}`);
    });
  }

  return { announced: true, matchId, winnerName, teamChannelsNotified: teamChannels.length };
}

// Comunicado de cambios confirmados en el panel (changeNotice de
// updateTournament): se publica en el canal de noticias del torneo.
async function announceTournamentChanged(event) {
  const { tournamentId, title, sectionLabel, message, changes } = event.payload || {};
  const { tournament } = await backendApi.getTournamentProvisionState(tournamentId);
  const guildId = tournament.discordProvision?.guildId || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
  const channelId = tournament.discordProvision?.channels?.newsId;
  if (!guildId || !channelId) throw new Error('Falta guildId o canal de noticias para publicar el comunicado.');

  const embed = announceEmbeds.tournamentChangedEmbed(tournament, { title, sectionLabel, message, changes: Array.isArray(changes) ? changes : [] });
  await discordGuild.sendEmbed(guildId, channelId, embed);
  return { announced: true, changes: Array.isArray(changes) ? changes.length : 0 };
}

// Aviso puntual del backend a un canal (plazo de capturas, decision del
// arbitro...). El backend arma el texto; aca solo se publica.
const NOTICE_COLORS = { info: 0x5865f2, warning: 0xffb020, success: 0x22c55e, danger: 0xef4444 };
async function postMatchNotice(event) {
  const { tournamentId, channelId, title, description, tone } = event.payload || {};
  if (!channelId) throw new Error('Falta el canal para publicar el aviso.');
  const { tournament } = await backendApi.getTournamentProvisionState(tournamentId);
  const guildId = tournament.discordProvision?.guildId || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('Falta guildId para publicar el aviso.');
  const embed = new EmbedBuilder()
    .setTitle(String(title || 'Aviso del torneo').slice(0, 250))
    .setDescription(String(description || '').slice(0, 4000))
    .setColor(NOTICE_COLORS[tone] || NOTICE_COLORS.info)
    .setFooter({ text: tournament.title || 'GlitchGang' })
    .setTimestamp(new Date());
  await discordGuild.sendEmbed(guildId, channelId, embed);
  return { posted: true, channelId };
}

async function processEvent(event) {
  const started = await backendApi.startEvent(event._id, WORKER_ID);
  const locked = started.event || started;

  try {
    let result;
    if (locked.type === 'discord.tournament.provision') {
      result = await provisionTournament(locked);
    } else if (locked.type === 'discord.team.provision') {
      result = await provisionTeam(locked);
    } else if (locked.type === 'discord.team.deprovision') {
      result = await deprovisionTeam(locked);
    } else if (locked.type === 'discord.tournament.finished') {
      result = await announceTournamentFinished(locked);
    } else if (locked.type === 'discord.bracket.updated') {
      result = await announceBracketUpdated(locked);
    } else if (locked.type === 'discord.tournament.changed') {
      result = await announceTournamentChanged(locked);
    } else if (locked.type === 'discord.support.resolved') {
      result = await archiveResolvedTicket(locked);
    } else if (locked.type === 'discord.match.notice') {
      result = await postMatchNotice(locked);
    } else {
      result = { skipped: true, reason: `Tipo no soportado por este worker: ${locked.type}` };
    }
    await backendApi.completeEvent(locked._id, result);
  } catch (error) {
    console.error(`[Provision] Error procesando ${locked.type}:`, error);
    await backendApi.failEvent(locked._id, describeProvisionError(error), error.partial);
  }
}

async function provisionTournamentFromCrm({ tournamentId }) {
  if (!tournamentId) throw new Error('Falta tournamentId para provisionar el torneo.');

  try {
    const result = await provisionTournament({
      entityId: tournamentId,
      payload: { tournamentId },
    });
    await backendApi.completeTournamentProvision(tournamentId, result);
    return { ok: true, result };
  } catch (error) {
    await backendApi.failTournamentProvision(tournamentId, describeProvisionError(error), error.partial).catch(() => {});
    throw error;
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const { events = [] } = await backendApi.getPendingEvents(5);
    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    console.error('[Provision] Error consultando eventos:', error.message);
  } finally {
    running = false;
  }
}

function startProvisionWorker() {
  if (timer) return;
  timer = setInterval(tick, INTERVAL_MS);
  tick();
  console.log(`[Provision] Worker iniciado cada ${INTERVAL_MS}ms`);
}

module.exports = { startProvisionWorker, provisionTournamentFromCrm };
