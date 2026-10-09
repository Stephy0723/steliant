// ============================================
// GlitchGang Bot - Live Match Service (backend real)
// ============================================
// Usado por /checkin, /start-match, /report, /cancelar, /calendario y el
// checkinMonitor. No reemplaza matchService.js/reportService.js (SQLite) —
// esos se quedan intactos porque el CRM local (api/server.js) todavia los
// usa para su propio panel de partidas/reportes.

const backendApi = require('./backendApi');

function buildAttendanceSnapshot(attendance) {
  return {
    presentCount: attendance.present.length,
    totalCount: attendance.present.length + attendance.missing.length,
    presentPlayers: attendance.present.map((e) => e.player.name),
    missingPlayers: attendance.missing.map((e) => e.player.name),
    unexpectedPlayers: attendance.unexpected.map((e) => e.displayName),
  };
}

async function createOrRefreshCheckin({
  tournamentId, teamId, teamName, guildId, voiceChannelId,
  notificationChannelId, channelName, requestedBy, attendance, checkinWindowMs,
}) {
  return backendApi.checkinMatch({
    tournamentId,
    teamId,
    teamName,
    guildId,
    voiceChannelId,
    notificationChannelId,
    channelName,
    requestedBy,
    attendance: buildAttendanceSnapshot(attendance),
    checkinWindowMs,
  });
}

async function createMatch({
  tournamentId, teamId, teamName, rivalName, guildId,
  voiceChannelId, notificationChannelId, channelName, startedBy,
}) {
  return backendApi.startMatch({
    tournamentId, teamId, teamName, rivalName, guildId,
    voiceChannelId, notificationChannelId, channelName, startedBy,
  });
}

async function reportResult(matchId, { result, evidence, gameNumber, reporterDiscordId, reporterUsername }) {
  return backendApi.reportMatch(matchId, { result, evidence, gameNumber, reporterDiscordId, reporterUsername });
}

async function addReportEvidence(teamId, { tournamentId, evidence, gameNumber }) {
  return backendApi.addReportEvidence(teamId, { tournamentId, evidence, gameNumber });
}

async function cancelMatch(matchId, reason) {
  try {
    return await backendApi.cancelMatch(matchId, reason);
  } catch (error) {
    console.error('[LiveMatch] No se pudo cancelar:', error.message);
    return null;
  }
}

async function disqualifyCheckin(matchId, reason) {
  try {
    return await backendApi.disqualifyMatch(matchId, reason);
  } catch (error) {
    console.error('[LiveMatch] No se pudo descalificar:', error.message);
    return null;
  }
}

async function findLatestTeamOperation(teamId) {
  try {
    return await backendApi.getTeamLatestOperation(teamId);
  } catch {
    return null;
  }
}

async function findActiveMatch(teamId) {
  try {
    return await backendApi.getTeamActiveMatch(teamId);
  } catch {
    return null;
  }
}

async function findOpenCheckin(teamId) {
  try {
    return await backendApi.getTeamOpenCheckin(teamId);
  } catch {
    return null;
  }
}

async function getTeamHistory(teamId) {
  try {
    const { matches } = await backendApi.getTeamHistory(teamId);
    return matches || [];
  } catch {
    return [];
  }
}

async function getTournamentMatches(tournamentId) {
  try {
    const { matches } = await backendApi.getTournamentMatches(tournamentId);
    return matches || [];
  } catch {
    return [];
  }
}

async function getExpiredCheckins() {
  try {
    const { matches } = await backendApi.getExpiredCheckins();
    return matches || [];
  } catch {
    return [];
  }
}

module.exports = {
  createOrRefreshCheckin,
  createMatch,
  reportResult,
  addReportEvidence,
  cancelMatch,
  disqualifyCheckin,
  findLatestTeamOperation,
  findActiveMatch,
  findOpenCheckin,
  getTeamHistory,
  getTournamentMatches,
  getExpiredCheckins,
};
