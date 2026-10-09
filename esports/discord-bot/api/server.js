require('dotenv').config();

const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const path = require('path');

const { renderDashboard } = require('./renderDashboard');
const { renderDeveloperPortal } = require('./renderDeveloperPortal');
const {
  addPlayer,
  addTeam,
  activateTournament,
  createTournament,
  deleteTournament,
  getActiveTournament,
  getBotEnabledTournament,
  loadTournaments,
  renameTournament,
  upsertImportedTournaments,
  upsertSyncedTournament,
} = require('../services/crmStore');
const {
  getDemoTournaments,
  getTemplateCsv,
  getTemplateWorkbookBuffer,
  parseWorkbook,
} = require('../services/tournamentImport');
const { loadActivity, pushActivity } = require('../services/activityService');
const { getTournamentOperations, loadMatches } = require('../services/matchService');
const { flagDispute, getDisputedReports, loadReports } = require('../services/reportService');
const {
  authorizeApiClient,
  createPartner,
  getApiHubSnapshot,
  getPublicApiCatalog,
  getPublicApiDocs,
  recordApiUsage,
  rotatePartnerKey,
  updatePartner,
} = require('../services/apiPartnerService');
const { createJoinCode, getTeamCode } = require('../services/joinCodeService');
const backendApi = require('../services/backendApi');
const botBridge = require('../services/botBridge');
const db = require('../services/db');
const eventChannels = require('../services/eventChannels');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = Number(process.env.CRM_PORT) || 3000;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
// Mismo fallback que crmSync.service.js del lado backend (CRM_TOKEN): si no
// se define un secreto dedicado, reusa BOT_API_KEY -- evita el caso donde
// alguien configura BOT_API_KEY (obligatorio de todas formas para el resto
// del puente bot<->backend) y asume que ya alcanza, dejando este endpoint
// sin token real y devolviendo 400 en cada sync de torneo.
const GLITCHGANG_SITE_TOKEN = process.env.GLITCHGANG_SITE_TOKEN || process.env.INTERNAL_API_TOKEN || process.env.BOT_API_KEY || '';
const DISCORD_REDIRECT_URI =
  process.env.CRM_DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord/callback`;
const TOURNAMENT_API_URL =
  process.env.TOURNAMENT_API_URL || `http://localhost:${PORT}/tournament`;
// Backend real de la plataforma y secreto compartido para /bot-proxy/* (ver
// mas abajo) -- el bot ya no golpea esto directo, pasa por este CRM.
const PLATFORM_API_URL = process.env.PLATFORM_API_URL || 'http://localhost:4000';
const BOT_API_KEY = process.env.BOT_API_KEY || '';

const SESSION_COOKIE = 'gg_discord_session';
const STATE_COOKIE = 'gg_discord_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const STATE_TTL_MS = 1000 * 60 * 10;

const authStates = new Map();

// Sesiones de login respaldadas en SQLite (no en memoria) para que
// sobrevivan a un `pm2 restart` — antes vivian en un Map y se perdian cada
// vez que el proceso se reiniciaba, obligando a re-loguearse con Discord.
const sessionInsertStmt = db.prepare(
  'INSERT OR REPLACE INTO crm_sessions (id, created_at, user_json) VALUES (?, ?, ?)'
);
const sessionGetStmt = db.prepare('SELECT created_at, user_json FROM crm_sessions WHERE id = ?');
const sessionDeleteStmt = db.prepare('DELETE FROM crm_sessions WHERE id = ?');
const sessionPruneStmt = db.prepare('DELETE FROM crm_sessions WHERE created_at < ?');

function sessionSet(sessionId, entry) {
  sessionInsertStmt.run(sessionId, entry.createdAt, JSON.stringify(entry.user));
}

function sessionGet(sessionId) {
  const row = sessionGetStmt.get(sessionId);
  if (!row) return null;
  return { createdAt: row.created_at, user: JSON.parse(row.user_json) };
}

function sessionDelete(sessionId) {
  sessionDeleteStmt.run(sessionId);
}

function sessionPruneExpired() {
  sessionPruneStmt.run(Date.now() - SESSION_TTL_MS);
}

const CRM_ADMIN_DISCORD_IDS = new Set(
  String(
    process.env.CRM_ADMIN_DISCORD_IDS ||
      process.env.CRM_PRIMARY_ADMIN_DISCORD_IDS ||
      process.env.CRM_ALLOWED_DISCORD_IDS ||
      ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
);
app.use(cors());
// Las publicaciones del Control Center pueden traer una imagen adjunta en
// base64 (hasta 8MB); solo esa ruta acepta cuerpos grandes.
app.use('/portal/discord/publish', express.json({ limit: '12mb' }));
app.use('/portal/discord/messages', express.json({ limit: '12mb' }));
app.use(express.json());
// /app y /app/ NO son la pagina real del CRM — son solo la carpeta de
// build de Vite (dashboard.js, dashboard.css). Ese directorio trae de
// arrastre un index.html genérico (efecto secundario de "vite build"),
// que express.static serviría si alguien entra directo a /app/ — esa
// version nunca lleva los datos reales inyectados (window.__GG_BOOTSTRAP__
// siempre vacio), a diferencia de "/" que si los arma en cada request.
// Tiene que ir ANTES de los dos express.static de abajo — si no, el
// primero (montado en la raiz) sirve el index.html de public/app/ el
// solo, sin darle nunca la oportunidad a esta ruta de correr.
app.get(['/app', '/app/'], (req, res) => res.redirect(302, '/'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/app', express.static(path.join(__dirname, 'public', 'app')));

function parseCookies(req) {
  const raw = req.headers.cookie || '';

  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function appendCookie(res, cookieValue) {
  const current = res.getHeader('Set-Cookie');

  if (!current) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, cookieValue]);
    return;
  }

  res.setHeader('Set-Cookie', [current, cookieValue]);
}

function setCookie(res, name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  segments.push(`Path=${options.path || '/'}`);

  if (options.httpOnly !== false) {
    segments.push('HttpOnly');
  }

  segments.push(`SameSite=${options.sameSite || 'Lax'}`);

  if (options.secure) {
    segments.push('Secure');
  }

  appendCookie(res, segments.join('; '));
}

function clearCookie(res, name) {
  appendCookie(res, `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

function pruneAuthStorage() {
  const now = Date.now();

  for (const [state, entry] of authStates.entries()) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      authStates.delete(state);
    }
  }

  sessionPruneExpired();
}

function getAvatarUrl(user) {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }

  return 'https://cdn.discordapp.com/embed/avatars/0.png';
}

function getCrmAccessMode() {
  return CRM_ADMIN_DISCORD_IDS.size ? 'allowlist' : 'discord-login';
}

function getCrmAccessSummary() {
  if (CRM_ADMIN_DISCORD_IDS.size) {
    return 'Solo las cuentas Discord incluidas en CRM_ADMIN_DISCORD_IDS pueden modificar el CRM.';
  }

  return 'Cualquier cuenta con login de Discord valido puede modificar el CRM.';
}

function isCrmWriterAuthorized(user) {
  if (!user?.id) {
    return false;
  }

  if (!CRM_ADMIN_DISCORD_IDS.size) {
    return true;
  }

  return CRM_ADMIN_DISCORD_IDS.has(String(user.id).trim());
}

function getAuthSession(req) {
  pruneAuthStorage();

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return null;
  }

  const session = sessionGet(sessionId);
  if (!session) {
    return null;
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessionDelete(sessionId);
    return null;
  }

  return session;
}

function getAuthView(req) {
  const authStatus = String(req.query?.auth || '').trim();
  const messages = {
    'login-ok': {
      kind: 'success',
      text: 'Sesion iniciada con Discord correctamente.',
    },
    'not-configured': {
      kind: 'warning',
      text: 'El login con Discord necesita DISCORD_CLIENT_SECRET en el archivo .env.',
    },
    'oauth-denied': {
      kind: 'warning',
      text: 'Cancelaste el acceso con Discord antes de completar el login.',
    },
    'state-error': {
      kind: 'error',
      text: 'No pude validar la sesion del login. Intentalo otra vez.',
    },
    'login-failed': {
      kind: 'error',
      text: 'No pude completar el login con Discord. Revisa el CLIENT_ID, el CLIENT_SECRET y el redirect URI.',
    },
    'logout-ok': {
      kind: 'success',
      text: 'Sesion cerrada correctamente.',
    },
  };

  const session = getAuthSession(req);
  const user = session ? session.user : null;
  const isAuthorized = isCrmWriterAuthorized(user);

  return {
    configured: Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
    loginUrl: '/auth/discord',
    logoutUrl: '/auth/logout',
    redirectUri: DISCORD_REDIRECT_URI,
    notice: messages[authStatus] || null,
    user,
    isAuthorized,
    role: !user ? 'guest' : isAuthorized ? (CRM_ADMIN_DISCORD_IDS.size ? 'admin' : 'operator') : 'viewer',
    accessMode: getCrmAccessMode(),
    accessSummary: getCrmAccessSummary(),
  };
}

function getApiKeyFromRequest(req) {
  const authorization = String(req.headers.authorization || '').trim();

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return String(req.headers['x-api-key'] || '').trim();
}

function requireApiCapability(capability) {
  return (req, res, next) => {
    const apiKey = getApiKeyFromRequest(req);
    const result = authorizeApiClient(apiKey, capability);

    if (result.error) {
      return res.status(result.statusCode || 401).json({ error: result.error });
    }

    req.apiClient = result.partner;
    return next();
  };
}

function requirePortalToken(req, res, next) {
  if (!GLITCHGANG_SITE_TOKEN) {
    return res.status(503).json({
      error: 'Falta GLITCHGANG_SITE_TOKEN en el servidor para aceptar sincronizacion desde la web.',
    });
  }

  const providedToken = String(req.headers['x-glitchgang-site-key'] || '').trim();

  if (!providedToken || providedToken !== GLITCHGANG_SITE_TOKEN) {
    return res.status(401).json({ error: 'Token interno invalido para GlitchGang Site.' });
  }

  return next();
}

function requireCrmAccess(req, res, next) {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(503).json({
      error:
        'El CRM necesita login con Discord configurado antes de permitir cambios. Agrega DISCORD_CLIENT_ID y DISCORD_CLIENT_SECRET.',
    });
  }

  const session = getAuthSession(req);

  if (!session?.user) {
    return res.status(401).json({
      error: 'Debes iniciar sesion con Discord para modificar el CRM.',
    });
  }

  if (!isCrmWriterAuthorized(session.user)) {
    return res.status(403).json({
      error: CRM_ADMIN_DISCORD_IDS.size
        ? 'Tu cuenta de Discord no esta autorizada para modificar el CRM. Agrega tu ID a CRM_ADMIN_DISCORD_IDS.'
        : 'Tu cuenta no tiene permisos para modificar el CRM.',
    });
  }

  req.crmUser = session.user;
  return next();
}

function sendApiPayload(req, res, payload) {
  if (req.apiClient?.id) {
    recordApiUsage(req.apiClient.id, req.path);
  }

  return res.json(payload);
}

// ── Datos reales del backend (torneo activo por Discord + sus partidas) ──
// El catalogo de torneos del CRM (crear/importar) se queda local, pero el
// "torneo activo" con sus operaciones/reportes ahora refleja el mismo
// backend que usan los comandos de Discord, en vez de la SQLite del CRM.
async function fetchRealActiveTournamentData() {
  try {
    const guildId = process.env.GUILD_ID || '';
    const tournament = await backendApi.getActiveDiscordTournament(guildId);
    const [{ teams }, matchesResponse] = await Promise.all([
      backendApi.getTournamentTeams(tournament.id),
      backendApi.getTournamentMatches(tournament.id),
    ]);
    return { tournament, teams: teams || [], matches: matchesResponse.matches || [] };
  } catch {
    return null;
  }
}

const WEBSITE_URL = (process.env.WEBSITE_URL || 'https://glitchgang.net').replace(/\/$/, '');

const TOURNAMENT_FIELDS = [
  'tournamentCode', 'game', 'date', 'timezone', 'status', 'maxSlots', 'currentSlots',
  'registrationWindow', 'format', 'modality', 'platform', 'region', 'prizePool',
  'currency', 'entryFee', 'winner', 'discordProvision', 'lateRegistration',
];

function pickTournamentFields(t) {
  const out = {};
  for (const key of TOURNAMENT_FIELDS) {
    if (t[key] !== undefined && t[key] !== null) out[key] = t[key];
  }
  return out;
}

// Lista COMPLETA de torneos reales con Discord habilitado para este
// servidor (no solo "el activo") — para que la grilla de Torneos del CRM
// los muestre a todos, no solo al que este en vivo en ese momento.
async function fetchRealTournamentsList() {
  try {
    const guildId = process.env.GUILD_ID || '';
    const { tournaments: list } = await backendApi.listTournaments(guildId);

    const withTeams = await Promise.all(
      (list || []).map(async (t) => {
        const id = t._id || t.id;
        let teams = [];
        try {
          const res = await backendApi.getTournamentTeams(id);
          teams = res.teams || [];
        } catch { /* torneo sin equipos o error puntual — sigue sin romper la lista */ }

        // Todo lo que el backend mande del torneo pasa tal cual (juego,
        // fecha, estado, cupos, formato, premio...) -- antes se tiraba todo
        // menos el titulo y la pagina de Torneos quedaba sin datos.
        return {
          ...pickTournamentFields(t),
          id: String(id),
          name: t.title,
          publicId: t.publicId,
          webUrl: `${WEBSITE_URL}/torneos/${t.publicId || id}`,
          teams,
          bot: { enabled: true },
          organizer: { type: 'glitchgang', name: 'GlitchGang' },
          commercial: {},
          source: { type: 'backend' },
        };
      })
    );

    return withTeams;
  } catch {
    return [];
  }
}

function toLegacyMatchShape(match, tournamentName) {
  return { ...match, tournamentName };
}

function toLegacyReportShape(match, tournamentName) {
  if (!match.report?.createdAt) return null;
  return {
    id: match.id,
    guildId: match.guildId,
    channelId: match.channelId,
    tournamentName,
    teamName: match.teamName,
    matchId: match.id,
    result: match.result,
    evidenceUrl: match.report.evidenceUrl,
    evidenceName: match.report.evidenceName,
    reporter: {
      id: match.report.reporterDiscordId,
      username: match.report.reporterUsername,
      displayName: match.report.reporterUsername,
    },
    disputed: match.report.disputed,
    disputedAt: match.report.disputedAt,
    createdAt: match.report.createdAt,
  };
}

function buildLeaderboard(reportsOverride) {
  const reports = reportsOverride || loadReports();
  const stats = {};

  for (const report of reports) {
    const key = report.teamName;
    if (!stats[key]) {
      stats[key] = { team: key, wins: 0, losses: 0, draws: 0, total: 0 };
    }
    stats[key].total += 1;
    if (report.result === 'win') stats[key].wins += 1;
    else if (report.result === 'lose') stats[key].losses += 1;
    else if (report.result === 'draw') stats[key].draws += 1;
  }

  return Object.values(stats)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    .map((entry, index) => ({
      rank: index + 1,
      team: entry.team,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      total: entry.total,
      winrate: entry.total > 0 ? `${Math.round((entry.wins / entry.total) * 100)}%` : '0%',
    }));
}

async function getDashboardPayload(req) {
  const localTournaments = loadTournaments();
  const auth = getAuthView(req);

  const [real, realTournaments] = await Promise.all([
    fetchRealActiveTournamentData(),
    fetchRealTournamentsList(),
  ]);

  // Los reales primero — son los que de verdad importan; los locales son
  // solo la base de pruebas del CRM.
  const tournaments = [...realTournaments, ...localTournaments];

  let activeTournament;
  let operations;
  let activeMatches;

  if (real) {
    activeTournament = {
      id: real.tournament.id,
      name: real.tournament.title,
      active: true,
      source: 'backend',
      teams: real.teams.map((t) => ({ name: t.name, players: t.players })),
    };
    operations = real.matches
      .filter((m) => ['checking_in', 'ready', 'in_progress', 'disqualified'].includes(m.status))
      .map((m) => toLegacyMatchShape(m, real.tournament.title));
    activeMatches = real.matches
      .filter((m) => m.status === 'in_progress')
      .map((m) => toLegacyMatchShape(m, real.tournament.title));
  } else {
    activeTournament = getActiveTournament(tournaments);
    operations = getTournamentOperations(activeTournament);
    activeMatches = loadMatches().filter((m) => m.status === 'in_progress');
  }

  return {
    tournaments,
    activeTournament,
    operations,
    activeMatches,
    auth,
    notice: auth.notice,
    system: {
      statusLabel: 'CRM online',
      environment: `Node control hub :${PORT}`,
      apiUrl: TOURNAMENT_API_URL,
      publicApiUrl: '/api/public/catalog',
      developerPortalUrl: '/developers',
      portalSyncUrl: '/portal/tournaments/sync',
      freeBotUsagePolicy: 'GlitchGang usa el bot gratis; terceros deben operar con fee por torneo o comision.',
      discordConfigured: auth.configured,
      crmAccessMode: auth.accessMode,
      crmAccessSummary: auth.accessSummary,
      crmWriteAuthorized: Boolean(auth.isAuthorized),
      crmAdminAllowlistSize: CRM_ADMIN_DISCORD_IDS.size,
      pendingCheckins: operations.filter((entry) => entry.status === 'checking_in').length,
    },
  };
}

app.get('/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.redirect('/?auth=not-configured');
  }

  const state = crypto.randomBytes(20).toString('hex');
  authStates.set(state, { createdAt: Date.now() });

  setCookie(res, STATE_COOKIE, state, {
    maxAge: STATE_TTL_MS / 1000,
  });

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: 'identify',
    prompt: 'consent',
    state,
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  const oauthError = String(req.query?.error || '').trim();
  if (oauthError) {
    clearCookie(res, STATE_COOKIE);
    return res.redirect('/?auth=oauth-denied');
  }

  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();
  const cookies = parseCookies(req);
  const storedState = cookies[STATE_COOKIE];

  if (!code || !state || !storedState || state !== storedState || !authStates.has(state)) {
    clearCookie(res, STATE_COOKIE);
    return res.redirect('/?auth=state-error');
  }

  authStates.delete(state);
  clearCookie(res, STATE_COOKIE);

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Discord token status ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Discord user status ${userResponse.status}`);
    }

    const rawUser = await userResponse.json();
    const sessionId = crypto.randomBytes(32).toString('hex');

    sessionSet(sessionId, {
      createdAt: Date.now(),
      user: {
        id: rawUser.id,
        username: rawUser.username,
        globalName: rawUser.global_name || '',
        avatar: rawUser.avatar || '',
        avatarUrl: getAvatarUrl(rawUser),
      },
    });

    setCookie(res, SESSION_COOKIE, sessionId, {
      maxAge: SESSION_TTL_MS / 1000,
    });

    return res.redirect('/?auth=login-ok');
  } catch (error) {
    console.error('[Auth] Discord login error:', error.message);
    return res.redirect('/?auth=login-failed');
  }
});

app.get('/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];

  if (sessionId) {
    sessionDelete(sessionId);
  }

  clearCookie(res, SESSION_COOKIE);
  return res.redirect('/?auth=logout-ok');
});

app.get('/bootstrap', async (req, res) => {
  res.json(await getDashboardPayload(req));
});

app.get('/activity', (req, res) => {
  res.json(loadActivity());
});

app.get('/api-hub', (req, res) => {
  res.json(getApiHubSnapshot());
});

app.get('/api/public/catalog', (req, res) => {
  res.json(getPublicApiCatalog());
});

app.get('/api/public/docs', (req, res) => {
  res.json(getPublicApiDocs());
});

app.get('/developers', (req, res) => {
  res.type('html').send(
    renderDeveloperPortal({
      catalog: getPublicApiCatalog(),
      docs: getPublicApiDocs(),
    })
  );
});

app.get('/', async (req, res) => {
  res.type('html').send(renderDashboard(await getDashboardPayload(req)));
});

// GET /tournaments/:id/matches — TODAS las partidas reales de un torneo
// (cualquier estado: checking_in, ready, in_progress, completed,
// cancelled, disqualified), no solo las de "el" torneo activo. A
// diferencia de fetchRealActiveTournamentData, esto sirve para cualquier
// torneo real aunque haya 2+ activos a la vez o ya haya terminado -- es
// la fuente de la pestaña Partidas de TournamentDetail. Si el backend
// falla, se responde con error explicito en vez de quedar en silencio.
app.get('/tournaments/:id/matches', async (req, res) => {
  try {
    const { matches } = await backendApi.getTournamentMatches(req.params.id);
    res.json({ matches: matches || [] });
  } catch (error) {
    res.status(502).json({
      error: error.message || 'No se pudo cargar las partidas de este torneo desde el backend.',
    });
  }
});

// POST /tournaments/:id/provision — vuelve a mandar un torneo real al bot
// para que cree (o complete) sus roles y canales en Discord. Es el mismo
// camino que usa /portal/tournaments/sync cuando el torneo trae bot activo.
app.post('/tournaments/:id/provision', requireCrmAccess, async (req, res) => {
  try {
    const result = await botBridge.provisionTournament(req.params.id);
    pushActivity(
      'provision-discord-tournament',
      `Reenvio manual del torneo ${req.params.id} al bot para crear roles y canales.`,
      req.crmUser?.username || 'CRM'
    );
    res.json({ ok: true, result });
  } catch (error) {
    res.status(502).json({ error: error.message || 'El bot no pudo aprovisionar este torneo.' });
  }
});

// GET /recordings — todas las grabaciones de voz que hizo el bot (su propia
// SQLite, match_recordings), con el torneo y el equipo de cada partida
// resueltos en vivo desde el backend. Solo datos: el audio se escucha en la
// web, en "Resultados por revisar", y solo lo abre el arbitro del caso.
const RECORDING_COLUMNS = `id, match_id, guild_id, channel_name, status, started_at, stopped_at,
  duration_ms, file_size_bytes, participants, screen_share_log, upload_status,
  upload_attempts, upload_error, uploaded_at`;

app.get('/recordings', requireCrmAccess, async (req, res) => {
  const guildId = process.env.GUILD_ID || '';
  const rows = guildId
    ? db.prepare(`SELECT ${RECORDING_COLUMNS} FROM match_recordings WHERE guild_id = ? ORDER BY started_at DESC LIMIT 500`).all(guildId)
    : db.prepare(`SELECT ${RECORDING_COLUMNS} FROM match_recordings ORDER BY started_at DESC LIMIT 500`).all();

  const matchIndex = new Map();
  let backendError = '';
  try {
    const { tournaments: list = [] } = await backendApi.listTournaments(guildId);
    await Promise.all(list.map(async (t) => {
      const tournamentId = String(t._id || t.id);
      try {
        const { matches = [] } = await backendApi.getTournamentMatches(tournamentId);
        for (const m of matches) {
          matchIndex.set(m.id, {
            tournamentId,
            tournamentName: t.title,
            teamName: m.teamName,
            rivalName: m.rivalName,
            bracketMatchId: m.bracketMatchId,
            gameNumber: m.gameNumber,
            matchStatus: m.status,
          });
        }
      } catch { /* un torneo sin partidas no tumba la lista */ }
    }));
  } catch (error) {
    backendError = error.message || 'No se pudo leer el backend.';
  }

  const recordings = rows.map((row) => {
    let participants = [];
    let screenShares = [];
    try { participants = JSON.parse(row.participants || '[]'); } catch { /* fila vieja */ }
    try { screenShares = JSON.parse(row.screen_share_log || '[]'); } catch { /* fila vieja */ }
    return {
      id: row.id,
      matchId: row.match_id,
      channelName: row.channel_name,
      status: row.status,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      durationMs: row.duration_ms || 0,
      fileSizeBytes: row.file_size_bytes || 0,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.displayName || p.globalName || p.username || p.id,
      })),
      screenShareEvents: screenShares.length,
      uploadStatus: row.upload_status,
      uploadAttempts: row.upload_attempts,
      uploadError: row.upload_error,
      uploadedAt: row.uploaded_at,
      ...(matchIndex.get(row.match_id) || {}),
    };
  });

  res.json({ recordings, backendError });
});

app.get('/tournaments', (req, res) => {
  const tournaments = loadTournaments();
  res.json(tournaments);
});

app.get('/users', async (req, res) => {
  try {
    const { users = [] } = await backendApi.listCrmUsers(300);
    res.json(users);
  } catch (error) {
    res.status(502).json({ error: error.message || 'No se pudieron cargar usuarios desde MongoDB.' });
  }
});

app.get('/tournament', (req, res) => {
  const tournaments = loadTournaments();
  res.json(getActiveTournament(tournaments));
});

app.get('/tournament/bot', (req, res) => {
  const tournament = getBotEnabledTournament(loadTournaments());

  if (!tournament) {
    return res.status(404).json({
      error: 'No hay un torneo activo con uso del bot habilitado.',
    });
  }

  return res.json(tournament);
});

app.get('/api/v1/tournaments', requireApiCapability('tournaments:read'), (req, res) => {
  return sendApiPayload(req, res, loadTournaments());
});

app.get('/api/v1/tournaments/active', requireApiCapability('tournaments:read'), (req, res) => {
  return sendApiPayload(req, res, getActiveTournament(loadTournaments()));
});

app.get('/api/v1/activity', requireApiCapability('activity:read'), (req, res) => {
  return sendApiPayload(req, res, loadActivity());
});

app.get('/api/v1/reports', requireApiCapability('reports:read'), (req, res) => {
  return sendApiPayload(req, res, loadReports());
});

app.post('/api/v1/tournaments/sync', requireApiCapability('tournaments:write'), (req, res) => {
  const payload = req.body?.tournament || req.body || {};
  const result = upsertSyncedTournament(payload, {
    sourceType: 'partner-api',
    defaultOrganizerType: 'partner',
    defaultOrganizerName: req.apiClient.companyName,
    partnerId: req.apiClient.id,
    makeActive: payload.makeActive ?? payload.active,
  });

  recordApiUsage(req.apiClient.id, req.path);
  pushActivity(
    'sync-api-tournament',
    `Torneo "${result.tournament.name}" sincronizado desde la API de ${req.apiClient.companyName}.`,
    req.apiClient.companyName
  );

  return res.json({ ok: true, ...result });
});

app.post('/portal/tournaments/sync', requirePortalToken, async (req, res) => {
  const payload = req.body?.tournament || req.body || {};
  const result = upsertSyncedTournament(payload, {
    sourceType: 'glitchgang-web',
    defaultOrganizerType: 'glitchgang',
    defaultOrganizerName: 'GlitchGang',
    makeActive: payload.makeActive ?? payload.active,
  });

  // Auto-generar codigo de acceso por equipo si no tienen uno activo.
  // Usa el codigo del portal si viene en el payload (team.joinCode),
  // o genera uno nuevo de 8 chars hex.
  const tournament = result.tournament;
  const codesGenerated = [];

  for (const team of tournament.teams || []) {
    const existing = getTeamCode(tournament.id, team.name);
    if (!existing) {
      const portalCode = team.joinCode
        ? String(team.joinCode).trim().toUpperCase()
        : null;

      const { code } = createJoinCode({
        tournamentId: tournament.id,
        teamName: team.name,
        createdBy: 'GlitchGangSite',
        ...(portalCode ? { overrideCode: portalCode } : {}),
      });
      codesGenerated.push({ team: team.name, code });
    }
  }

  pushActivity(
    'sync-site-tournament',
    `Torneo "${tournament.name}" sincronizado desde la pagina principal de GlitchGang. Codigos generados: ${codesGenerated.length}.`,
    'GlitchGangSite'
  );

  let provision = { status: 'skipped', reason: 'Bot no habilitado para este torneo.' };
  const botEnabled = Boolean(payload.botEnabled ?? payload.useBot ?? payload.bot?.enabled);
  const platformTournamentId = String(payload.externalId || payload.id || tournament.source?.externalId || '').trim();
  if (botEnabled && platformTournamentId) {
    try {
      const botResult = await botBridge.provisionTournament(platformTournamentId);
      provision = { status: 'sent_to_bot', result: botResult };
      pushActivity(
        'provision-discord-tournament',
        `CRM envio "${tournament.name}" al bot para crear roles y canales en Discord.`,
        'GlitchGangSite'
      );
    } catch (error) {
      provision = { status: 'failed', error: error.message };
      pushActivity(
        'provision-discord-tournament-failed',
        `No se pudo enviar "${tournament.name}" al bot: ${error.message}`,
        'GlitchGangSite'
      );
    }
  }

  return res.json({ ok: provision.status !== 'failed', ...result, codesGenerated, provision });
});

app.post('/portal/users/sync', requirePortalToken, (req, res) => {
  const payload = req.body?.user || req.body || {};
  const user = payload || {};
  const sourceType = user.source?.type || 'glitchgang-web';

  pushActivity(
    'sync-site-user',
    `Usuario "${user.nick || user.email || user.id || 'sin nombre'}" notificado desde ${sourceType === 'discord-bot' ? 'el bot de Discord' : 'la web de GlitchGang'}. La fuente real queda en MongoDB.`,
    'GlitchGangSite'
  );

  return res.json({ ok: true, source: 'mongodb', user });
});

// ── Discord Control Center (panel /admin/discord-sync) — Fase 1: estado del
// bot y canales reales del servidor general. La web (backend) le pega a
// estos 2 endpoints con el mismo GLITCHGANG_SITE_TOKEN que ya usa el resto
// de /portal/*; el CRM solo hace de puente hacia el bot (botBridge ->
// internalBotApi). Si el bot esta caido, se responde error explicito, no
// datos falsos.
app.get('/portal/discord/server', requirePortalToken, async (req, res) => {
  try {
    const guildId = String(req.query.guildId || process.env.GUILD_ID || '');
    res.json(await botBridge.getStatus(guildId));
  } catch (error) {
    res.status(502).json({ online: false, error: error.message });
  }
});

app.get('/portal/discord/channels', requirePortalToken, async (req, res) => {
  try {
    const guildId = String(req.query.guildId || process.env.GUILD_ID || '');
    res.json(await botBridge.getGuildChannels(guildId));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// Edicion de canales del servidor general (Control Center admin).
function portalGuildId(req) {
  return String(req.body?.guildId || req.query.guildId || process.env.GUILD_ID || '');
}

app.post('/portal/discord/channels', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.createChannel({ ...req.body, guildId: portalGuildId(req) }));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.patch('/portal/discord/channels/:channelId', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.editChannel(req.params.channelId, { ...req.body, guildId: portalGuildId(req) }));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.delete('/portal/discord/channels/:channelId', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.deleteChannel(portalGuildId(req), req.params.channelId));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// Publicacion del Control Center admin -> canal del servidor general. La web
// ya resolvio el canal destino (config del servidor); el CRM solo pasa el
// payload al bot y devuelve el id del mensaje creado.
app.post('/portal/discord/publish', requirePortalToken, async (req, res) => {
  try {
    const body = req.body || {};
    const guildId = String(body.guildId || process.env.GUILD_ID || '');
    res.json(await botBridge.publish({ ...body, guildId }));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// Editar / retirar una publicacion ya enviada, y foros del servidor general.
app.patch('/portal/discord/messages/:channelId/:messageId', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.editMessage(req.params.channelId, req.params.messageId, { ...req.body, guildId: portalGuildId(req) }));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.delete('/portal/discord/messages/:channelId/:messageId', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.deleteMessage(portalGuildId(req), req.params.channelId, req.params.messageId));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/portal/discord/forums/:forumId/threads', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.listForumThreads(portalGuildId(req), req.params.forumId));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.delete('/portal/discord/threads/:threadId', requirePortalToken, async (req, res) => {
  try {
    res.json(await botBridge.deleteThread(portalGuildId(req), req.params.threadId));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/template.csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-torneos.csv"');
  res.send(getTemplateCsv());
});

app.get('/template.xlsx', (req, res) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-torneos.xlsx"');
  res.send(getTemplateWorkbookBuffer());
});

app.post('/tournament', requireCrmAccess, (req, res) => {
  const name = String(req.body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'El torneo necesita un nombre.' });
  }

  const tournament = createTournament({
    ...req.body,
    name,
    makeActive: Boolean(req.body?.makeActive),
    sourceType: req.body?.sourceType || 'crm',
  });

  pushActivity('create-tournament', `Torneo "${name}" creado`, req.crmUser?.username);
  announceEvent('announcements', {
    title: `🏆 Nuevo torneo: ${name}`,
    description: 'Ya se abrió un torneo nuevo en el CRM. Usa `/torneo lista` para verlo e inscribirte.',
  });
  return res.json({ ok: true, tournament });
});

app.delete('/tournament/:id', requireCrmAccess, (req, res) => {
  const result = deleteTournament(req.params.id);

  if (result.error) {
    return res.status(404).json({ error: result.error });
  }

  pushActivity('delete-tournament', `Torneo eliminado`, req.crmUser?.username);
  return res.json({ ok: true, ...result });
});

app.patch('/tournament/:id', requireCrmAccess, (req, res) => {
  const newName = String(req.body?.name || '').trim();
  const result = renameTournament(req.params.id, newName);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  pushActivity('rename-tournament', `Torneo renombrado a "${newName}"`, req.crmUser?.username);
  return res.json({ ok: true, ...result });
});

app.post('/tournament/activate', requireCrmAccess, (req, res) => {
  const tournament = activateTournament(req.body?.tournamentId);

  if (!tournament) {
    return res.status(404).json({ error: 'No encontre ese torneo.' });
  }

  pushActivity('activate-tournament', `Torneo "${tournament.name}" activado`, req.crmUser?.username);
  announceEvent('tournaments', {
    title: `🚀 Torneo activado: ${tournament.name}`,
    description: 'El torneo ya está en vivo y disponible para check-in por Discord.',
  });
  return res.json({ ok: true, tournament });
});

app.post('/team', requireCrmAccess, (req, res) => {
  const result = addTeam({
    tournamentId: req.body?.tournamentId,
    teamName: req.body?.teamName,
  });

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  pushActivity('add-team', `Equipo "${req.body?.teamName}" agregado`, req.crmUser?.username);
  announceEvent('tournaments', {
    title: `📋 Equipo inscrito: ${req.body?.teamName}`,
    description: 'Se sumó un equipo nuevo al torneo.',
  });
  return res.json({ ok: true, team: result.team });
});

app.post('/player', requireCrmAccess, (req, res) => {
  const result = addPlayer({
    tournamentId: req.body?.tournamentId,
    teamName: req.body?.teamName,
    player: req.body?.player,
  });

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  pushActivity(
    'add-player',
    `Jugador "${req.body?.player?.name}" agregado a ${req.body?.teamName}`,
    req.crmUser?.username
  );
  return res.json({ ok: true, team: result.team });
});

app.post('/import', requireCrmAccess, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Debes subir un archivo Excel o CSV.' });
  }

  try {
    const importedTournaments = parseWorkbook(req.file.buffer);
    const result = upsertImportedTournaments(
      importedTournaments,
      String(req.body?.makeActive || '').toLowerCase() === 'true'
    );

    pushActivity(
      'import',
      `Importados ${importedTournaments.length} torneo(s) desde archivo`,
      req.crmUser?.username
    );
    return res.json({
      ok: true,
      imported: importedTournaments.length,
      activeTournament: result.activeTournament,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/demo/load', requireCrmAccess, (req, res) => {
  const result = upsertImportedTournaments(getDemoTournaments(), true);

  pushActivity('load-demo', 'Torneo demo cargado', req.crmUser?.username);
  return res.json({
    ok: true,
    imported: 1,
    activeTournament: result.activeTournament,
  });
});

app.post('/api-hub/partners', requireCrmAccess, (req, res) => {
  const result = createPartner(req.body || {});

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  pushActivity(
    'create-api-partner',
    `Cliente API "${result.partner.companyName}" creado en plan ${result.partner.planId}.`,
    req.crmUser?.username
  );

  return res.json({ ok: true, ...result });
});

app.patch('/api-hub/partners/:id', requireCrmAccess, (req, res) => {
  const result = updatePartner(req.params.id, req.body || {});

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  pushActivity(
    'update-api-partner',
    `Cliente API "${result.partner.companyName}" actualizado.`,
    req.crmUser?.username
  );

  return res.json({ ok: true, ...result });
});

app.post('/api-hub/partners/:id/rotate-key', requireCrmAccess, (req, res) => {
  const result = rotatePartnerKey(req.params.id);

  if (result.error) {
    return res.status(404).json({ error: result.error });
  }

  pushActivity(
    'rotate-api-key',
    `API key rotada para "${result.partner.companyName}".`,
    req.crmUser?.username
  );

  return res.json({ ok: true, ...result });
});

app.get('/leaderboard', async (_req, res) => {
  const real = await fetchRealActiveTournamentData();
  if (real) {
    const reports = real.matches.map((m) => toLegacyReportShape(m, real.tournament.title)).filter(Boolean);
    return res.json(buildLeaderboard(reports));
  }
  res.json(buildLeaderboard());
});

app.get('/reports', async (_req, res) => {
  const real = await fetchRealActiveTournamentData();
  if (real) {
    const reports = real.matches.map((m) => toLegacyReportShape(m, real.tournament.title)).filter(Boolean);
    return res.json(reports);
  }
  res.json(loadReports());
});

app.get('/reports/disputes', async (_req, res) => {
  const real = await fetchRealActiveTournamentData();
  if (real) {
    const reports = real.matches
      .map((m) => toLegacyReportShape(m, real.tournament.title))
      .filter((r) => r?.disputed);
    return res.json(reports);
  }
  res.json(getDisputedReports());
});

app.patch('/reports/:id/dispute', requireCrmAccess, async (req, res) => {
  const disputed = req.body?.disputed !== false;
  const isBackendId = /^[0-9a-f]{24}$/i.test(req.params.id);

  if (isBackendId) {
    try {
      const match = await backendApi.disputeReport(req.params.id, disputed);
      pushActivity(
        'dispute-report',
        `Reporte ${match.id} ${disputed ? 'marcado como disputa' : 'disputa resuelta'}.`,
        req.crmUser?.username
      );
      return res.json({ ok: true, report: toLegacyReportShape(match, match.teamName) });
    } catch (error) {
      return res.status(404).json({ error: error.message || 'Reporte no encontrado.' });
    }
  }

  const report = flagDispute(req.params.id, disputed);

  if (!report) {
    return res.status(404).json({ error: 'Reporte no encontrado.' });
  }

  pushActivity(
    'dispute-report',
    `Reporte ${report.id} ${disputed ? 'marcado como disputa' : 'disputa resuelta'}.`,
    req.crmUser?.username
  );

  return res.json({ ok: true, report });
});

// ── Bot -> CRM -> Backend (unico camino permitido) ──────────────────────
// El proceso del bot (index.js) nunca debe hablar directo con el backend:
// services/backendApi.js y services/aiService.js del lado del bot apuntan
// aca en vez de a PLATFORM_API_URL. Reenvia 1:1 a /api/bots/* en el backend
// real, exigiendo el mismo BOT_API_KEY compartido que ya protege esas rutas
// (requireBotAuth) -- la CRM sigue siendo el unico intermediario permitido
// entre el bot y el backend (ver DISCORD-SYNC-PLAN.md).
app.use('/bot-proxy', async (req, res) => {
  const providedKey = String(req.headers['x-glitchgang-bot-key'] || '').trim();
  if (!BOT_API_KEY || providedKey !== BOT_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    // Pistas de voz de /start-match (services/recordingUploader.js): pasan
    // tal cual, en streaming, sin tocar el cuerpo.
    const isAudio = Boolean(req.is('audio/ogg'));
    const upstream = await fetch(`${PLATFORM_API_URL}/api/bots${req.url}`, {
      method: req.method,
      headers: {
        'content-type': isAudio ? 'audio/ogg' : 'application/json',
        'x-glitchgang-bot-key': BOT_API_KEY,
        ...(isAudio && req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {}),
        ...(isAudio && req.headers['x-track-sha256'] ? { 'x-track-sha256': String(req.headers['x-track-sha256']) } : {}),
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : isAudio ? req : JSON.stringify(req.body || {}),
      ...(isAudio ? { duplex: 'half' } : {}),
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (error) {
    res.status(502).json({ error: 'bot_proxy_unreachable', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`CRM interno en http://localhost:${PORT}`);
});

// Dispara un anuncio para un evento — nunca revienta el flujo que lo llama
// si el bot esta caido o el canal no esta configurado, solo lo registra.
// El mapeo evento -> canal (eventChannels.js) ya no tiene UI de configuracion
// en el CRM (se quito junto con el Discord Monitor) — sigue leyendose desde
// la misma SQLite; para cambiarlo hay que usar eventChannels.setEventChannel
// directo hasta que exista otro panel.
async function announceEvent(eventKey, { title, description, footer }) {
  try {
    const channelId = eventChannels.getEventChannelId(eventKey);
    if (!channelId) return;
    await botBridge.announce(process.env.GUILD_ID || '', channelId, { title, description, footer });
  } catch (error) {
    console.error(`[Announce] Error en evento "${eventKey}":`, error.message);
  }
}
