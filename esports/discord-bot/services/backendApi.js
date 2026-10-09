// ============================================
// GlitchGang Bot - Backend API Client
// Cliente del backend real (equipos, torneos, perfil, referidos, vinculacion).
// Reemplaza la SQLite/JSON local del bot como fuente de verdad para estos datos.
//
// El proceso del bot (index.js, y todo lo que este archivo alimenta: los
// comandos, eventos y servicios que hacen require de este modulo) nunca
// debe hablar directo con el backend/web -- las unicas conexiones
// permitidas son Web(backend)<->CRM y CRM<->Bot (ver DISCORD-SYNC-PLAN.md).
// Por eso esto ya no golpea PLATFORM_API_URL: apunta al proxy que expone
// el CRM (api/server.js, mismo repo, proceso aparte) en /bot-proxy/*, que
// reenvia 1:1 a /api/bots/* en el backend real. El unico caller que sigue
// yendo directo al backend es el propio CRM (server.js tambien importa
// este modulo para su dashboard) -- ese caso da una vuelta extra por su
// propio /bot-proxy antes de salir, pero sigue siendo CRM->backend, que es
// la conexion permitida.
// ============================================

require('dotenv').config();

// Mismo fallback de puerto que usa api/server.js (Number(process.env.CRM_PORT) || 3000)
// para que este cliente y el servidor real del CRM siempre coincidan aunque
// CRM_PORT no este definido.
const CRM_PROXY_URL = process.env.CRM_INTERNAL_URL || `http://127.0.0.1:${Number(process.env.CRM_PORT) || 3000}`;
const BOT_API_KEY = process.env.BOT_API_KEY || '';
const TIMEOUT_MS = 8000;

class NotLinkedError extends Error {}

async function request(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${CRM_PROXY_URL}/bot-proxy${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-glitchgang-bot-key': BOT_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404 && data.error === 'not_linked') {
      throw new NotLinkedError(data.message || 'Esta cuenta de Discord no esta vinculada.');
    }
    if (!res.ok) {
      throw new Error(data.message || data.error || `El backend respondio ${res.status}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function linkStart(discordId, discordUsername) {
  return request('/link/start', { method: 'POST', body: { discordId, discordUsername } });
}

function getPlayerProfile(discordId) {
  return request(`/players/${discordId}`);
}

function listCrmUsers(limit = 200) {
  return request(`/crm/users?limit=${encodeURIComponent(limit)}`);
}

function getReferralCode(discordId) {
  return request(`/referral/${discordId}`);
}

function createTeam(discordId, payload) {
  return request('/teams', { method: 'POST', body: { discordId, ...payload } });
}

function joinTeam(discordId, inviteCode) {
  return request('/teams/join', { method: 'POST', body: { discordId, inviteCode } });
}

function getMyTeam(discordId) {
  return request(`/teams/${discordId}`);
}

function listTournaments(guildId) {
  return request(`/tournaments?guildId=${encodeURIComponent(guildId)}`);
}

function registerTournament(discordId, tournamentId) {
  return request(`/tournaments/${encodeURIComponent(tournamentId)}/register`, {
    method: 'POST',
    body: { discordId },
  });
}

// ── Partidas en vivo (checkin/start-match/report/cancelar/calendario) ──

function getActiveDiscordTournament(guildId, channelId, tournamentId) {
  let qs = '';
  if (tournamentId) qs += `&tournamentId=${encodeURIComponent(tournamentId)}`;
  else if (channelId) qs += `&channelId=${encodeURIComponent(channelId)}`;
  return request(`/tournaments/active?guildId=${encodeURIComponent(guildId)}${qs}`);
}

function listActiveDiscordTournaments(guildId) {
  return request(`/tournaments/active-list?guildId=${encodeURIComponent(guildId)}`);
}

function getTeamByDiscordChannel(guildId, channelId) {
  return request(`/tournaments/team-by-channel?guildId=${encodeURIComponent(guildId)}&channelId=${encodeURIComponent(channelId)}`);
}

function getOrganization(guildId) {
  return request(`/organizations/${encodeURIComponent(guildId)}`);
}

function updateOrganizationWelcome(guildId, enabled, channelId) {
  return request(`/organizations/${encodeURIComponent(guildId)}/welcome`, {
    method: 'PATCH',
    body: { enabled, ...(channelId ? { channelId } : {}) },
  });
}

function updateOrganizationTournamentsPanel(guildId, channelId, messageId) {
  return request(`/organizations/${encodeURIComponent(guildId)}/tournaments-panel`, {
    method: 'PATCH',
    body: { channelId, messageId },
  });
}

function getTournamentTeams(tournamentId) {
  return request(`/tournaments/${encodeURIComponent(tournamentId)}/teams`);
}

function getTournamentMatches(tournamentId) {
  return request(`/tournaments/${encodeURIComponent(tournamentId)}/matches`);
}

function checkinMatch(payload) {
  return request('/matches/checkin', { method: 'POST', body: payload });
}

function startMatch(payload) {
  return request('/matches/start', { method: 'POST', body: payload });
}

function reportMatch(matchId, payload) {
  return request(`/matches/${encodeURIComponent(matchId)}/report`, { method: 'POST', body: payload });
}

// /report solo con capturas faltantes, sin partida en curso.
function addReportEvidence(teamId, payload) {
  return request(`/teams/${encodeURIComponent(teamId)}/report/evidence`, { method: 'POST', body: payload });
}

function cancelMatch(matchId, reason) {
  return request(`/matches/${encodeURIComponent(matchId)}/cancel`, { method: 'POST', body: { reason } });
}

function disqualifyMatch(matchId, reason) {
  return request(`/matches/${encodeURIComponent(matchId)}/disqualify`, { method: 'POST', body: { reason } });
}

function getTeamLatestOperation(teamId) {
  return request(`/teams/${encodeURIComponent(teamId)}/latest-operation`);
}

function getTeamActiveMatch(teamId) {
  return request(`/teams/${encodeURIComponent(teamId)}/active-match`);
}

function getTeamOpenCheckin(teamId) {
  return request(`/teams/${encodeURIComponent(teamId)}/open-checkin`);
}

function getTeamHistory(teamId) {
  return request(`/teams/${encodeURIComponent(teamId)}/history`);
}

function getExpiredCheckins() {
  return request('/matches/expired-checkins');
}

function disputeReport(matchId, disputed) {
  return request(`/matches/${encodeURIComponent(matchId)}/report/dispute`, {
    method: 'PATCH',
    body: { disputed },
  });
}

function createSupportTicket(discordId, message) {
  return request('/support-ticket', { method: 'POST', body: { discordId, message } });
}

// Tickets de #soporte de un torneo (los atiende su organizador/staff).
function openTournamentSupportTicket(payload) {
  return request('/support-tickets', { method: 'POST', body: payload });
}

function getTournamentSupportTicket(ticketId) {
  return request(`/support-tickets/${encodeURIComponent(ticketId)}`);
}

function attachTournamentSupportTicketDiscord(ticketId, discord) {
  return request(`/support-tickets/${encodeURIComponent(ticketId)}/discord`, { method: 'PATCH', body: discord });
}

function resolveTournamentSupportTicket(ticketId, discordId, name) {
  return request(`/support-tickets/${encodeURIComponent(ticketId)}/resolve`, {
    method: 'POST',
    body: { discordId, name },
  });
}

function getPendingEvents(limit = 5) {
  return request(`/events/pending?limit=${encodeURIComponent(limit)}`);
}

function startEvent(eventId, workerId) {
  return request(`/events/${encodeURIComponent(eventId)}/start`, {
    method: 'POST',
    body: { workerId },
  });
}

function completeEvent(eventId, result) {
  return request(`/events/${encodeURIComponent(eventId)}/done`, {
    method: 'POST',
    body: { result },
  });
}

function failEvent(eventId, message, partial) {
  return request(`/events/${encodeURIComponent(eventId)}/fail`, {
    method: 'POST',
    body: { message, partial },
  });
}

function completeTournamentProvision(tournamentId, result) {
  return request(`/provision/tournaments/${encodeURIComponent(tournamentId)}/done`, {
    method: 'POST',
    body: { result },
  });
}

function failTournamentProvision(tournamentId, message, partial) {
  return request(`/provision/tournaments/${encodeURIComponent(tournamentId)}/fail`, {
    method: 'POST',
    body: { message, partial },
  });
}

function getTournamentProvisionState(tournamentId) {
  return request(`/provision/tournaments/${encodeURIComponent(tournamentId)}`);
}

function getTeamProvisionState(teamId, tournamentId) {
  const qs = tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : '';
  return request(`/provision/teams/${encodeURIComponent(teamId)}${qs}`);
}

module.exports = {
  NotLinkedError,
  linkStart,
  getPlayerProfile,
  listCrmUsers,
  getReferralCode,
  createTeam,
  joinTeam,
  getMyTeam,
  listTournaments,
  registerTournament,
  getActiveDiscordTournament,
  listActiveDiscordTournaments,
  getTeamByDiscordChannel,
  getOrganization,
  updateOrganizationWelcome,
  updateOrganizationTournamentsPanel,
  getTournamentTeams,
  getTournamentMatches,
  checkinMatch,
  startMatch,
  reportMatch,
  addReportEvidence,
  cancelMatch,
  disqualifyMatch,
  getTeamLatestOperation,
  getTeamActiveMatch,
  getTeamOpenCheckin,
  getTeamHistory,
  getExpiredCheckins,
  disputeReport,
  createSupportTicket,
  openTournamentSupportTicket,
  getTournamentSupportTicket,
  attachTournamentSupportTicketDiscord,
  resolveTournamentSupportTicket,
  getPendingEvents,
  startEvent,
  completeEvent,
  failEvent,
  completeTournamentProvision,
  failTournamentProvision,
  getTournamentProvisionState,
  getTeamProvisionState,
};
