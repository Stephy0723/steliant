const fs = require("fs");
const path = require("path");

const DEFAULT_DATA = {
  contacts: [],
  teams: [],
  tournaments: [],
  matches: [],
  groups: [],
  checkins: [],
  conversations: [],
  commandLogs: [],
  loginAttempts: [],
  notes: [],
  settings: {
    businessName: "GlitchGang",
    commandPrefix: "!",
    supportMessage: "Contacta al staff de GlitchGang."
  }
};

function resolveFile() {
  const configured = process.env.CRM_DATA_FILE || "./data/crm.json";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

function ensureDb() {
  const file = resolveFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (!fs.existsSync(file)) {
    const seed = structuredClone(DEFAULT_DATA);
    seed.contacts.push({
      id: "contact-demo-1",
      username: "Tephy",
      phone: "18095550000",
      game: "Mobile Legends",
      teamId: "team-neoxys",
      role: "player",
      status: "active",
      verified: true,
      createdAt: new Date().toISOString()
    });

    seed.teams.push({
      id: "team-neoxys",
      name: "NEOXYS",
      tag: "NYX",
      game: "Mobile Legends",
      category: "MOBA",
      region: "RD",
      language: "Español",
      level: "Semi-pro",
      status: "active",
      tiers: ["fem"],
      sponsor: "Steliant",
      community: "Steliant Community",
      bio: "Escuadra femenina de MLBB enfocada en ligas locales y scrims regionales.",
      captain: {
        fullName: "Tephany Gómez",
        nick: "tephygg",
        userTag: "tephy#1234",
        role: "EXP"
      },
      roster: [
        { nick: "tephygg", role: "EXP", captain: true },
        { nick: "Melu", role: "Mid" },
        { nick: "Lala", role: "Jungla" },
        { nick: "Noa", role: "Gold" },
        { nick: "Laydi", role: "Roam" }
      ],
      members: ["tephygg", "Melu", "Lala", "Noa", "Laydi"],
      source: "seed",
      createdAt: new Date().toISOString()
    });

    seed.tournaments.push({
      id: "gg-mlbb-001",
      name: "GlitchGang MLBB Cup",
      game: "Mobile Legends",
      status: "open",
      startDate: "2026-09-05",
      maxTeams: 16,
      registeredTeams: 12,
      bracketUrl: "https://glitchgang.net/tournaments/gg-mlbb-001/bracket",
      rulesUrl: "https://glitchgang.net/tournaments/gg-mlbb-001/rules",
      discordUrl: "https://discord.gg/glitchgang",
      createdAt: new Date().toISOString()
    });

    seed.matches.push({
      id: "match-001",
      tournamentId: "gg-mlbb-001",
      tournamentName: "GlitchGang MLBB Cup",
      teamA: "NEOXYS",
      teamB: "Eclipse",
      scheduledAt: "2026-09-05T20:00:00-04:00",
      checkinAt: "2026-09-05T19:15:00-04:00",
      discordUrl: "https://discord.gg/glitchgang",
      bracketUrl: "https://glitchgang.net/tournaments/gg-mlbb-001/bracket",
      status: "scheduled",
      createdAt: new Date().toISOString()
    });

    write(seed);
  }

  return read();
}

function read() {
  const file = resolveFile();
  if (!fs.existsSync(file)) return ensureDb();
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(data) {
  const file = resolveFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return data;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function list(collection) {
  const db = read();
  return db[collection] || [];
}

function get(collection, id) {
  return list(collection).find((item) => item.id === id) || null;
}

function create(collection, payload) {
  const db = read();
  const item = {
    id: payload.id || uid(collection.replace(/s$/, "")),
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db[collection] = db[collection] || [];
  db[collection].push(item);
  write(db);
  return item;
}

function update(collection, id, payload) {
  const db = read();
  const rows = db[collection] || [];
  const index = rows.findIndex((item) => item.id === id);
  if (index < 0) return null;

  rows[index] = {
    ...rows[index],
    ...payload,
    id,
    updatedAt: new Date().toISOString()
  };

  write(db);
  return rows[index];
}

function remove(collection, id) {
  const db = read();
  const rows = db[collection] || [];
  const before = rows.length;
  db[collection] = rows.filter((item) => item.id !== id);
  write(db);
  return before !== db[collection].length;
}

function upsertCheckin({ phone, userId, matchId, source = "crm" }) {
  const db = read();
  const existing = db.checkins.find(
    (c) => c.matchId === matchId && (c.phone === phone || c.userId === userId)
  );
  if (existing) return existing;

  const item = {
    id: uid("checkin"),
    phone,
    userId,
    matchId,
    source,
    status: "confirmed",
    checkedInAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  db.checkins.push(item);
  write(db);
  return item;
}

function logCommand(entry) {
  const db = read();
  db.commandLogs.unshift({
    id: uid("cmd"),
    ...entry,
    createdAt: new Date().toISOString()
  });
  db.commandLogs = db.commandLogs.slice(0, 2000);
  write(db);
}

function addConversation(entry) {
  const db = read();
  db.conversations.unshift({
    id: uid("msg"),
    ...entry,
    createdAt: new Date().toISOString()
  });
  db.conversations = db.conversations.slice(0, 5000);
  write(db);
}

function logLoginAttempt(entry) {
  const db = read();
  db.loginAttempts = db.loginAttempts || [];
  db.loginAttempts.unshift({
    id: uid("login"),
    ...entry,
    createdAt: new Date().toISOString()
  });
  db.loginAttempts = db.loginAttempts.slice(0, 1000);
  write(db);
}

module.exports = {
  ensureDb,
  read,
  write,
  list,
  get,
  create,
  update,
  remove,
  upsertCheckin,
  logCommand,
  addConversation,
  logLoginAttempt
};
