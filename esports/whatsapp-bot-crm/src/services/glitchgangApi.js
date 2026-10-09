const axios = require("axios");
const demo = require("../data/demo");
const crm = require("../crm/store");

const API_URL = process.env.GLITCHGANG_API;
const API_TOKEN = process.env.GLITCHGANG_API_TOKEN;

const http = axios.create({
  baseURL: API_URL || undefined,
  timeout: 10000,
  headers: API_TOKEN
    ? { Authorization: `Bearer ${API_TOKEN}` }
    : {}
});

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function usingRemoteApi() {
  return Boolean(API_URL);
}

async function getTournaments(status) {
  if (usingRemoteApi()) {
    const { data } = await http.get("/api/tournaments", {
      params: status ? { status } : {}
    });
    return data;
  }

  const rows = crm.list("tournaments");
  return status ? rows.filter((t) => t.status === status) : rows;
}

async function getTournament(id) {
  if (usingRemoteApi()) {
    const { data } = await http.get(`/api/tournaments/${encodeURIComponent(id)}`);
    return data;
  }

  return crm.get("tournaments", id);
}

async function getTeams() {
  if (usingRemoteApi()) {
    const { data } = await http.get("/api/teams");
    return data;
  }

  return crm.list("teams");
}

async function getTeam(name) {
  if (usingRemoteApi()) {
    const { data } = await http.get(`/api/teams/${encodeURIComponent(name)}`);
    return data;
  }

  const key = String(name).toLowerCase();

  return (
    crm.list("teams").find(
      (team) =>
        String(team.name || "").toLowerCase() === key ||
        String(team.id || "").toLowerCase() === key
    ) || null
  );
}

async function getUserByPhone(phone) {
  const normalized = normalizePhone(phone);

  if (usingRemoteApi()) {
    const { data } = await http.get(
      `/api/whatsapp/users/${encodeURIComponent(normalized)}`
    );
    return data;
  }

  return crm.list("contacts").find(
    (u) => normalizePhone(u.phone) === normalized
  ) || null;
}

async function getMatches(phone) {
  const normalized = normalizePhone(phone);

  if (usingRemoteApi()) {
    const { data } = await http.get(
      `/api/whatsapp/users/${encodeURIComponent(normalized)}/matches`
    );
    return data;
  }

  const user = await getUserByPhone(normalized);
  if (!user) return [];

  const team = crm.get("teams", user.teamId);
  if (!team) return [];

  return crm.list("matches").filter(
    (m) => m.teamA === team.name || m.teamB === team.name
  );
}

async function getUpcomingMatch(phone) {
  if (usingRemoteApi()) {
    const normalized = normalizePhone(phone);
    const { data } = await http.get(
      `/api/whatsapp/users/${encodeURIComponent(normalized)}/upcoming-match`
    );
    return data;
  }

  const matches = await getMatches(phone);
  return matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null;
}

async function checkIn(phone, matchId) {
  const normalized = normalizePhone(phone);

  if (usingRemoteApi()) {
    const { data } = await http.post("/api/checkins", {
      phone: normalized,
      matchId
    });
    return data;
  }

  const user = await getUserByPhone(normalized);

  if (!user) {
    const error = new Error("Número no vinculado a una cuenta GlitchGang");
    error.status = 404;
    throw error;
  }

  const match = crm.get("matches", matchId);

  if (!match) {
    const error = new Error("Partida no encontrada");
    error.status = 404;
    throw error;
  }

  return crm.upsertCheckin({
    phone: normalized,
    userId: user.id,
    matchId,
    source: "whatsapp"
  });
}

module.exports = {
  normalizePhone,
  getTournaments,
  getTournament,
  getTeams,
  getTeam,
  getUserByPhone,
  getMatches,
  getUpcomingMatch,
  checkIn
};
