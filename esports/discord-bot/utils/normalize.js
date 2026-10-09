// ============================================
// GlitchGang Bot - Text Normalization Utilities
// ============================================

/**
 * Normalizes text for comparison: lowercase, strip accents, remove special chars.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extracts a known field from an object, trying multiple key variants.
 * @param {object} obj
 * @param {string[]} keys - Possible key names in priority order
 * @param {*} fallback
 * @returns {*}
 */
function extractField(obj, keys, fallback = null) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

/**
 * Normalizes a player object from flexible API/JSON input.
 * @param {object} raw
 * @returns {{ discordId: string, name: string, isLeader: boolean }}
 */
function normalizePlayer(raw) {
  return {
    discordId: String(extractField(raw, ['discordId', 'discord_id', 'id'], '')),
    discordUsername: String(extractField(raw, ['discordUsername', 'discord_username', 'discordTag', 'discord_tag'], '')),
    identityVerified: Boolean(extractField(raw, ['identityVerified', 'identity_verified'], false)),
    identityStatus: extractField(raw, ['identityStatus', 'identity_status'], ''),
    name: extractField(raw, ['name', 'nombre', 'username', 'discord', 'nick'], 'Unknown'),
    isLeader: Boolean(extractField(raw, ['isLeader', 'is_leader', 'leader', 'lider'], false)),
  };
}

/**
 * Normalizes a team object from flexible API/JSON input.
 * @param {object} raw
 * @returns {{ name: string, players: Array }}
 */
function normalizeTeam(raw) {
  const rawPlayers = extractField(raw, ['players', 'jugadores', 'members', 'miembros'], []);
  return {
    name: extractField(raw, ['name', 'nombre'], 'Sin nombre'),
    players: Array.isArray(rawPlayers) ? rawPlayers.map(normalizePlayer) : [],
  };
}

/**
 * Normalizes a tournament object from flexible API/JSON input.
 * @param {object} raw
 * @returns {{ id: number, name: string, teams: Array }}
 */
function normalizeTournament(raw) {
  const rawTeams = extractField(raw, ['teams', 'equipos'], []);
  return {
    id: extractField(raw, ['id'], 0),
    name: extractField(raw, ['name', 'nombre'], 'Torneo'),
    organizer: raw?.organizer || null,
    bot: raw?.bot || { enabled: Boolean(raw?.botEnabled || raw?.useBot) },
    commercial: raw?.commercial || null,
    source: raw?.source || null,
    teams: Array.isArray(rawTeams) ? rawTeams.map(normalizeTeam) : [],
  };
}

module.exports = {
  normalizeText,
  extractField,
  normalizePlayer,
  normalizeTeam,
  normalizeTournament,
};
