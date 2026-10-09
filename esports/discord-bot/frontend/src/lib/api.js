async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (typeof payload === 'object' && payload && payload.error) ||
      (typeof payload === 'string' && payload) ||
      'No se pudo completar la operacion.';

    throw new Error(message);
  }

  return payload;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  return parseResponse(response);
}

export function fetchBootstrap() {
  return request('/bootstrap');
}

export function createTournament(payload) {
  return request('/tournament', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function activateTournament(payload) {
  return request('/tournament/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function addTeam(payload) {
  return request('/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function addPlayer(payload) {
  return request('/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function loadDemo() {
  return request('/demo/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export function importTournamentFile({ file, makeActive }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('makeActive', makeActive ? 'true' : 'false');

  return request('/import', {
    method: 'POST',
    body: formData,
  });
}

export function deleteTournament(tournamentId) {
  return request(`/tournament/${tournamentId}`, {
    method: 'DELETE',
  });
}

export function renameTournament(tournamentId, name) {
  return request(`/tournament/${tournamentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function fetchActivity() {
  return request('/activity');
}

export function fetchTournamentMatches(tournamentId) {
  return request(`/tournaments/${tournamentId}/matches`);
}

export function setMatchDispute(matchId, disputed) {
  return request(`/reports/${matchId}/dispute`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disputed }),
  });
}

export function provisionTournament(tournamentId) {
  return request(`/tournaments/${tournamentId}/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export function fetchRecordings() {
  return request('/recordings');
}
