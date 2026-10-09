// ============================================
// GlitchGang Bot - Tournament Service
// ============================================
// El "torneo activo" viene del backend real, scoped por servidor de Discord
// (multi-tenant: cada guildId es un cliente distinto con sus propios
// torneos). Ahora puede haber VARIOS torneos activos a la vez en el mismo
// servidor -- si se conoce el canal donde se corrio el comando/mensaje
// (channelId), el backend usa eso para elegir cual es (ver
// tournamentMatches.controller.js). Se mantiene la misma forma
// { id, name, teams } que ya consumen checkin.js, start-match.js,
// report.js, cancelar.js y calendario.js.

const backendApi = require('./backendApi');

function mapTeam(team) {
  return {
    id: team.id,
    name: team.name,
    tag: team.tag,
    players: (team.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      discordId: p.discordId,
      discordUsername: p.discordUsername,
      isLeader: Boolean(p.isLeader),
    })),
  };
}

function mapActiveTournament(tournament, teams) {
  return {
    id: tournament.id,
    name: tournament.title,
    publicId: tournament.publicId,
    game: tournament.game,
    status: tournament.status,
    date: tournament.date,
    maxSlots: tournament.maxSlots,
    currentSlots: tournament.currentSlots,
    teams: (teams || []).map(mapTeam),
  };
}

/**
 * Obtiene el torneo activo del cliente (servidor de Discord) que llama, con
 * su roster de equipos listo para la deteccion por canal de voz
 * (utils/matching.js). Si se conoce el codigo/publicId del torneo (porque
 * el comando trae una opcion explicita, ej. /checkin torneo:TOR-...), esa
 * es la via mas confiable y evita toda ambiguedad -- ni siquiera hace
 * falta que el comando se corra en un canal del torneo (el canal de un
 * EQUIPO nunca matchea por channelId, ver comentario en el backend). Sin
 * eso, si hay mas de un torneo activo en ese servidor, se usa el channelId
 * de donde se disparo el comando para que el backend intente distinguir
 * cual es -- sin ninguno de los dos, con mas de uno activo esto devuelve
 * null.
 * @param {string} guildId
 * @param {string} [channelId]
 * @param {string} [tournamentId] codigo publico o id del torneo, si el comando lo trae
 * @returns {Promise<{ id: string, name: string, teams: Array }|null>}
 */
async function getActiveTournament(guildId, channelId, tournamentId) {
  try {
    const tournament = await backendApi.getActiveDiscordTournament(guildId, channelId, tournamentId);
    const { teams } = await backendApi.getTournamentTeams(tournament.id);
    return mapActiveTournament(tournament, teams);
  } catch (error) {
    console.error('[Tournament] Error fetching active tournament:', error.message);
    return null;
  }
}

/**
 * Resuelve DIRECTO el equipo (y su torneo) dueños de un canal de Discord --
 * texto, bracket o voz, los 3 que provisionTeam le crea a cada equipo con
 * su propia categoria. Es la via mas confiable para comandos como
 * /checkin: el jugador ya esta parado en la sala EXCLUSIVA de su equipo,
 * no hace falta que escriba nombre de equipo ni codigo de torneo, y a
 * diferencia de getActiveTournament esto nunca es ambiguo (un canal es,
 * como mucho, de un solo equipo). Null si ese canal no es la sala de
 * ningun equipo (caso normal y esperado, no se loguea como error).
 * @param {string} guildId
 * @param {string} channelId
 * @returns {Promise<{ tournament: object, team: object }|null>}
 */
async function getTeamAndTournamentByChannel(guildId, channelId) {
  if (!channelId) return null;
  try {
    const { tournament, team } = await backendApi.getTeamByDiscordChannel(guildId, channelId);
    return { tournament: mapActiveTournament(tournament, []), team: mapTeam(team) };
  } catch {
    return null;
  }
}

/**
 * TODOS los torneos activos de ese servidor (no solo "el" uno) -- para
 * tareas guild-wide sin un canal puntual de donde sacar contexto, como
 * reprogramar los timers de check-in de cada torneo al reiniciar el bot.
 * @param {string} guildId
 * @returns {Promise<Array<{ id: string, name: string, teams: Array }>>}
 */
async function getActiveTournaments(guildId) {
  try {
    const { tournaments } = await backendApi.listActiveDiscordTournaments(guildId);
    return Promise.all((tournaments || []).map(async (tournament) => {
      const { teams } = await backendApi.getTournamentTeams(tournament.id).catch(() => ({ teams: [] }));
      return mapActiveTournament(tournament, teams);
    }));
  } catch (error) {
    console.error('[Tournament] Error fetching active tournaments:', error.message);
    return [];
  }
}

/**
 * Gets a specific team from the active tournament.
 * @param {string} guildId
 * @param {string} teamName
 * @returns {Promise<{ tournament: object, team: object }|null>}
 */
async function getTeamFromTournament(guildId, teamName) {
  const tournament = await getActiveTournament(guildId);
  if (!tournament) return null;

  const { findTeamByName } = require('../utils/matching');
  const team = findTeamByName(tournament.teams, teamName);
  if (!team) return null;

  return { tournament, team };
}

module.exports = {
  getActiveTournament,
  getActiveTournaments,
  getTeamFromTournament,
  getTeamAndTournamentByChannel,
};
