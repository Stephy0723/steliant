const router = require("express").Router();
const path = require("path");
const store = require("./store");
const { requireCrmAuth, requirePermission } = require("./auth");

const DEFAULT_SESSION_MAX_AGE = 1000 * 60 * 60 * 8;
const REMEMBER_SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
const LOGIN_WINDOW_MS = 1000 * 60 * 15;
const MAX_LOGIN_ATTEMPTS = 5;
const loginBuckets = new Map();

const COLLECTIONS = [
  "contacts",
  "teams",
  "tournaments",
  "matches",
  "groups",
  "checkins",
  "conversations",
  "commandLogs",
  "loginAttempts",
  "notes"
];

const WRITE_PERMISSION_BY_COLLECTION = {
  contacts: "manage_contacts",
  teams: "manage_teams",
  tournaments: "manage_tournaments",
  matches: "manage_matches",
  groups: "manage_groups",
  checkins: "manage_checkins",
  notes: "manage_notes"
};

function getAdminUser(username) {
  const configuredUsername = String(process.env.CRM_ADMIN_USER || "admin");
  if (username !== configuredUsername) return null;

  return {
    id: "admin",
    username: configuredUsername,
    role: "admin",
    permissions: ["*"]
  };
}

function clientKey(req, username) {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${username || "unknown"}`;
}

function isRateLimited(req, username) {
  const key = clientKey(req, username);
  const now = Date.now();
  const bucket = loginBuckets.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };

  if (bucket.resetAt <= now) {
    loginBuckets.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  return bucket.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(req, username) {
  const key = clientKey(req, username);
  const now = Date.now();
  const bucket = loginBuckets.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  const nextBucket = bucket.resetAt <= now
    ? { count: 1, resetAt: now + LOGIN_WINDOW_MS }
    : { count: bucket.count + 1, resetAt: bucket.resetAt };

  loginBuckets.set(key, nextBucket);
}

function clearLoginBucket(req, username) {
  loginBuckets.delete(clientKey(req, username));
}

function logLogin(req, username, success, reason) {
  store.logLoginAttempt({
    username,
    ip: req.ip,
    userAgent: req.get("User-Agent") || "",
    success,
    reason
  });
}

router.get("/login", (req, res) => {
  if (req.session?.crmUser) return res.redirect("/crm");
  res.sendFile(path.join(process.cwd(), "src/crm/public/login.html"));
});

router.get("/linking", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "src/crm/public/linking.html"));
});

router.post("/auth/login", (req, res) => {
  const user = String(req.body.username || "");
  const pass = String(req.body.password || "");
  const remember = req.body.remember === true || req.body.remember === "true" || req.body.remember === "on";

  if (isRateLimited(req, user)) {
    logLogin(req, user, false, "rate_limited");
    return res.status(429).json({ message: "Demasiados intentos. Intenta de nuevo en 15 minutos." });
  }

  const adminUser = getAdminUser(user);

  if (
    adminUser &&
    pass === String(process.env.CRM_ADMIN_PASSWORD || "change-me-now")
  ) {
    clearLoginBucket(req, user);
    req.session.cookie.maxAge = remember ? REMEMBER_SESSION_MAX_AGE : DEFAULT_SESSION_MAX_AGE;
    req.session.crmUser = {
      ...adminUser,
      loginAt: new Date().toISOString(),
      remember
    };
    logLogin(req, user, true, "ok");
    return res.json({ ok: true });
  }

  recordFailedLogin(req, user);
  logLogin(req, user, false, "invalid_credentials");
  res.status(401).json({ message: "Credenciales incorrectas" });
});

router.post("/auth/logout", (req, res) => {
  const username = req.session?.crmUser?.username || "";
  if (username) logLogin(req, username, true, "logout");
  req.session.destroy(() => res.json({ ok: true }));
});

router.use(requireCrmAuth);

router.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "src/crm/public/index.html"));
});

router.get("/api/dashboard", (_req, res) => {
  const db = store.read();

  const scheduled = db.matches.filter((m) => m.status === "scheduled");
  const pendingCheckins = scheduled.reduce((total, match) => {
    const matchCheckins = db.checkins.filter((c) => c.matchId === match.id).length;
    return total + Math.max(0, 2 - matchCheckins);
  }, 0);

  res.json({
    counts: {
      contacts: db.contacts.length,
      teams: db.teams.length,
      tournaments: db.tournaments.length,
      matches: db.matches.length,
      groups: db.groups.length,
      checkins: db.checkins.length,
      conversations: db.conversations.length,
      commands: db.commandLogs.length
    },
    pendingCheckins,
    upcomingMatches: scheduled
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 8),
    recentCommands: db.commandLogs.slice(0, 10),
    recentConversations: db.conversations.slice(0, 10)
  });
});

router.get("/api/analytics/ranking", (_req, res) => {
  const db = store.read();
  const teams = db.teams || [];
  const matches = db.matches || [];
  
  const standings = teams.map(t => {
    const teamMatches = matches.filter(m => 
      (m.teamA === t.name || m.teamB === t.name) && m.status === "completed"
    );
    const wins = teamMatches.filter(m => 
      (m.teamA === t.name && m.winner === t.name) || 
      (m.teamB === t.name && m.winner === t.name)
    ).length;
    const losses = teamMatches.length - wins;
    
    return {
      ...t,
      wins,
      losses,
      matches: teamMatches.length,
      winRate: teamMatches.length > 0 ? Math.round(wins / teamMatches.length * 100) : 0
    };
  }).sort((a, b) => b.wins - a.wins);
  
  res.json(standings);
});

router.get("/api/analytics/tournaments", (_req, res) => {
  const db = store.read();
  const tournaments = db.tournaments || [];
  const matches = db.matches || [];
  
  const stats = tournaments.map(t => {
    const tournamentMatches = matches.filter(m => m.tournamentId === t.id);
    const completed = tournamentMatches.filter(m => m.status === "completed").length;
    const scheduled = tournamentMatches.filter(m => m.status === "scheduled").length;
    
    return {
      ...t,
      totalMatches: tournamentMatches.length,
      completedMatches: completed,
      scheduledMatches: scheduled,
      completionRate: tournamentMatches.length > 0 
        ? Math.round(completed / tournamentMatches.length * 100) 
        : 0
    };
  });
  
  res.json(stats);
});

router.get("/api/analytics/summary", (_req, res) => {
  const db = store.read();
  const matches = db.matches || [];
  const tournaments = db.tournaments || [];
  
  const completed = matches.filter(m => m.status === "completed").length;
  const scheduled = matches.filter(m => m.status === "scheduled").length;
  const activeTournaments = tournaments.filter(t => t.status === "active").length;
  const finishedTournaments = tournaments.filter(t => t.status === "finished").length;
  
  res.json({
    matches: {
      total: matches.length,
      completed,
      scheduled,
      completionRate: matches.length > 0 
        ? Math.round(completed / (completed + scheduled) * 100) 
        : 0
    },
    tournaments: {
      total: tournaments.length,
      active: activeTournaments,
      finished: finishedTournaments
    }
  });
});

const TEAM_TIERS = ["new", "uni", "fem", "pro"];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

// Only touches keys present in `body`, so a partial edit (e.g. the CRM modal
// sending just name/game/region/status) never wipes roster/captain/tiers.
function normalizeTeamPayload(body = {}) {
  const out = { ...body };
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const trim = (k) => { if (has(k)) out[k] = String(body[k] == null ? "" : body[k]).trim(); };

  ["name", "game", "category", "region", "language", "level", "sponsor", "community", "bio"].forEach(trim);
  if (has("tag")) out.tag = String(body.tag || "").trim().toUpperCase().slice(0, 5);
  if (has("status")) out.status = body.status || "active";
  if (has("tiers")) out.tiers = asArray(body.tiers).filter((t) => TEAM_TIERS.includes(t));

  if (has("captain")) {
    const c = body.captain && typeof body.captain === "object" ? body.captain : {};
    out.captain = {
      fullName: String(c.fullName || "").trim(),
      nick: String(c.nick || "").trim(),
      userTag: String(c.userTag || "").trim(),
      role: String(c.role || "").trim()
    };
  }

  if (has("roster")) {
    out.roster = asArray(body.roster)
      .map((m) => (typeof m === "string" ? { nick: m } : m))
      .filter((m) => m && (m.nick || m.contactId))
      .map((m) => ({
        contactId: m.contactId || null,
        nick: String(m.nick || "").trim(),
        role: String(m.role || "").trim(),
        captain: Boolean(m.captain)
      }));
    out.members = out.roster.map((m) => m.nick).filter(Boolean);
  } else if (has("members")) {
    out.members = asArray(body.members);
  }

  return out;
}

router.post("/api/teams", requirePermission("manage_teams"), (req, res) => {
  const payload = normalizeTeamPayload(req.body);
  if (!payload.name) return res.status(422).json({ message: "El nombre del equipo es obligatorio" });
  res.status(201).json(store.create("teams", payload));
});

router.put("/api/teams/:id", requirePermission("manage_teams"), (req, res) => {
  const item = store.update("teams", req.params.id, normalizeTeamPayload(req.body));
  if (!item) return res.status(404).json({ message: "Registro no encontrado" });
  res.json(item);
});

for (const collection of COLLECTIONS) {
  router.get(`/api/${collection}`, (_req, res) => {
    res.json(store.list(collection));
  });

  router.get(`/api/${collection}/:id`, (req, res) => {
    const item = store.get(collection, req.params.id);
    if (!item) return res.status(404).json({ message: "Registro no encontrado" });
    res.json(item);
  });

  const writePermission = WRITE_PERMISSION_BY_COLLECTION[collection] || "manage_crm";

  router.post(`/api/${collection}`, requirePermission(writePermission), (req, res) => {
    res.status(201).json(store.create(collection, req.body));
  });

  router.put(`/api/${collection}/:id`, requirePermission(writePermission), (req, res) => {
    const item = store.update(collection, req.params.id, req.body);
    if (!item) return res.status(404).json({ message: "Registro no encontrado" });
    res.json(item);
  });

  router.delete(`/api/${collection}/:id`, requirePermission(writePermission), (req, res) => {
    const ok = store.remove(collection, req.params.id);
    if (!ok) return res.status(404).json({ message: "Registro no encontrado" });
    res.status(204).end();
  });
}

router.get("/api/settings", (_req, res) => {
  res.json(store.read().settings || {});
});

router.put("/api/settings", requirePermission("manage_settings"), (req, res) => {
  const db = store.read();
  db.settings = { ...db.settings, ...req.body };
  store.write(db);
  res.json(db.settings);
});

module.exports = router;
