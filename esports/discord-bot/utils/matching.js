// ============================================
// GlitchGang Bot - Player/Team Matching Logic
// ============================================

const { normalizeText } = require('./normalize');

/**
 * Checks if a Discord member matches a registered player.
 * Priority: discordId > exact Discord username/tag > legacy roster name.
 * @param {import('discord.js').GuildMember} member
 * @param {{ discordId: string, name: string }} player
 * @returns {boolean}
 */
function isPlayerMatch(member, player) {
  if (player.discordId && player.discordId === member.id) return true;

  const normalizedUser = normalizeText(member.user.username);
  const normalizedTag = normalizeText(member.user.tag || '');
  const normalizedDisplay = normalizeText(member.displayName);
  const normalizedDiscordUsername = normalizeText(player.discordUsername);

  if (normalizedDiscordUsername) {
    return (
      normalizedDiscordUsername === normalizedUser
      || normalizedDiscordUsername === normalizedTag
    );
  }

  const normalizedRosterName = normalizeText(player.name);

  if (!normalizedRosterName) return false;

  return (
    normalizedRosterName === normalizedDisplay
    || normalizedRosterName === normalizedUser
    || normalizedRosterName === normalizedTag
  );
}

/**
 * Gets all non-bot members currently connected to a voice channel.
 * @param {import('discord.js').VoiceChannel} channel
 * @returns {import('discord.js').GuildMember[]}
 */
function getVoiceMembers(channel) {
  if (!channel || !channel.members) return [];
  return [...channel.members.values()].filter(m => !m.user.bot);
}

/**
 * Builds attendance report: which players are present, which are missing.
 * @param {Array} players - Registered players from tournament
 * @param {import('discord.js').GuildMember[]} members - Connected voice members
 * @returns {{ present: Array, missing: Array, unexpected: Array }}
 */
function buildAttendance(players, members) {
  const matched = new Set();
  const present = [];
  const missing = [];

  for (const player of players) {
    const member = members.find(m => isPlayerMatch(m, player));
    if (member) {
      present.push({ player, member });
      matched.add(member.id);
    } else {
      missing.push({ player });
    }
  }

  const unexpected = members
    .filter(m => !matched.has(m.id))
    .map(m => ({ id: m.id, displayName: m.displayName }));

  return { present, missing, unexpected };
}

/**
 * Calculates a match score for a team based on how many players are present.
 * @param {{ players: Array }} team
 * @param {import('discord.js').GuildMember[]} members
 * @returns {number} Score from 0 to team.players.length
 */
function getTeamMatchScore(team, members) {
  return team.players.reduce((score, player) => {
    return score + (members.some(m => isPlayerMatch(m, player)) ? 1 : 0);
  }, 0);
}

/**
 * Finds a team by name (normalized comparison).
 * @param {Array} teams
 * @param {string} name
 * @returns {object|null}
 */
function findTeamByName(teams, name) {
  const normalized = normalizeText(name);
  return teams.find(t => normalizeText(t.name) === normalized) || null;
}

/**
 * Smart team selection algorithm.
 * Priority: explicit name > channel name > single team > best score match.
 * @param {object} params
 * @param {Array} params.teams - All tournament teams
 * @param {string|null} params.requestedName - Team name from command option
 * @param {string|null} params.channelName - Voice channel name
 * @param {import('discord.js').GuildMember[]} params.voiceMembers - Connected members
 * @returns {{ team: object|null, reason: string }}
 */
function selectTeam({ teams, requestedName, channelName, voiceMembers }) {
  if (!teams || teams.length === 0) {
    return { team: null, reason: 'No hay equipos registrados en el torneo.' };
  }

  // 1. Explicit name from command
  if (requestedName) {
    const team = findTeamByName(teams, requestedName);
    if (team) return { team, reason: `Equipo seleccionado: ${team.name}` };
    const names = teams.map(t => `\`${t.name}\``).join(', ');
    return { team: null, reason: `Equipo "${requestedName}" no encontrado. Disponibles: ${names}` };
  }

  // 2. Channel name matches a team
  if (channelName) {
    const team = findTeamByName(teams, channelName);
    if (team) return { team, reason: `Equipo detectado por canal: ${team.name}` };
  }

  // 3. Single team in tournament
  if (teams.length === 1) {
    return { team: teams[0], reason: `Equipo auto-seleccionado: ${teams[0].name}` };
  }

  // 4. Best match score from voice members
  if (voiceMembers && voiceMembers.length > 0) {
    const scored = teams
      .map(t => ({ team: t, score: getTeamMatchScore(t, voiceMembers) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0].score > 0 && scored[0].score > (scored[1]?.score || 0)) {
      return { team: scored[0].team, reason: `Equipo detectado por jugadores: ${scored[0].team.name}` };
    }
  }

  // 5. Ambiguous
  const names = teams.map(t => `\`${t.name}\``).join(', ');
  return { team: null, reason: `No se pudo determinar el equipo. Usa la opcion \`equipo\`. Disponibles: ${names}` };
}

/**
 * Finds the leader of a team.
 * @param {{ players: Array }} team
 * @returns {{ discordId: string, name: string, isLeader: boolean }|null}
 */
function findTeamLeader(team) {
  return team.players.find(p => p.isLeader) || null;
}

module.exports = {
  isPlayerMatch,
  getVoiceMembers,
  buildAttendance,
  getTeamMatchScore,
  findTeamByName,
  selectTeam,
  findTeamLeader,
};
