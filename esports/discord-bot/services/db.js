// ============================================
// GlitchGang Bot - SQLite Database
// ============================================
// Instancia compartida de better-sqlite3.
// Todos los servicios importan este modulo.

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'glitchgang.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// WAL = lecturas sin bloquear escrituras
db.pragma('journal_mode = WAL');

// ── Schema ───────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id                      TEXT PRIMARY KEY,
    tournament_id           TEXT,
    tournament_name         TEXT NOT NULL DEFAULT '',
    team_name               TEXT NOT NULL DEFAULT '',
    rival_name              TEXT,
    guild_id                TEXT NOT NULL DEFAULT '',
    channel_id              TEXT NOT NULL DEFAULT '',
    voice_channel_id        TEXT NOT NULL DEFAULT '',
    notification_channel_id TEXT NOT NULL DEFAULT '',
    channel_name            TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'pending',
    requested_by            TEXT NOT NULL DEFAULT '',
    requested_at            TEXT NOT NULL DEFAULT '',
    checkin_window_ms       INTEGER NOT NULL DEFAULT 1200000,
    checkin_deadline_at     TEXT,
    ready_at                TEXT,
    started_by              TEXT NOT NULL DEFAULT '',
    started_at              TEXT,
    completed_at            TEXT,
    result                  TEXT,
    disqualified_at         TEXT,
    disqualification_reason TEXT,
    attendance              TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS reports (
    id               TEXT PRIMARY KEY,
    guild_id         TEXT NOT NULL DEFAULT '',
    channel_id       TEXT NOT NULL DEFAULT '',
    tournament_name  TEXT NOT NULL DEFAULT '',
    team_name        TEXT NOT NULL DEFAULT '',
    match_id         TEXT,
    result           TEXT NOT NULL DEFAULT '',
    evidence_url     TEXT,
    evidence_name    TEXT,
    reporter         TEXT NOT NULL DEFAULT '{}',
    disputed         INTEGER NOT NULL DEFAULT 0,
    disputed_at      TEXT,
    created_at       TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS activity (
    id        TEXT PRIMARY KEY,
    action    TEXT NOT NULL DEFAULT '',
    detail    TEXT NOT NULL DEFAULT '',
    user_text TEXT NOT NULL DEFAULT 'Sistema',
    meta      TEXT NOT NULL DEFAULT '{}',
    timestamp TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS join_codes (
    code          TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    team_name     TEXT NOT NULL,
    created_by    TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT '',
    expires_at    TEXT,
    max_uses      INTEGER NOT NULL DEFAULT 20,
    uses          INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS migrations (
    name   TEXT PRIMARY KEY,
    ran_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS voice_sessions (
    id           TEXT PRIMARY KEY,
    guild_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    user_name    TEXT NOT NULL DEFAULT '',
    channel_id   TEXT NOT NULL,
    channel_name TEXT NOT NULL DEFAULT '',
    joined_at    TEXT NOT NULL,
    left_at      TEXT,
    duration_ms  INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS event_channels (
    event_key    TEXT PRIMARY KEY,
    channel_id   TEXT NOT NULL,
    channel_name TEXT NOT NULL DEFAULT '',
    updated_at   TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS crm_sessions (
    id         TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    user_json  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_recordings (
    id               TEXT PRIMARY KEY,
    match_id         TEXT NOT NULL,
    guild_id         TEXT NOT NULL,
    channel_id       TEXT NOT NULL,
    channel_name     TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'recording',
    started_at       TEXT NOT NULL,
    stopped_at       TEXT,
    duration_ms      INTEGER DEFAULT 0,
    file_path        TEXT,
    file_size_bytes  INTEGER DEFAULT 0,
    participants     TEXT NOT NULL DEFAULT '[]',
    screen_share_log TEXT NOT NULL DEFAULT '[]'
  );
`);

// ── Columnas agregadas despues ────────────────
// Subida de grabaciones al backend (services/recordingUploader.js). Las filas
// viejas quedan 'legacy': eran Opus crudo (.pcm) que ningun reproductor abre.
{
  const recordingColumns = new Set(db.prepare('PRAGMA table_info(match_recordings)').all().map(c => c.name));
  const addColumn = (name, definition) => {
    if (!recordingColumns.has(name)) db.exec(`ALTER TABLE match_recordings ADD COLUMN ${name} ${definition}`);
  };
  addColumn('upload_status', "TEXT NOT NULL DEFAULT 'legacy'");
  addColumn('upload_attempts', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('upload_error', "TEXT NOT NULL DEFAULT ''");
  addColumn('upload_attempted_at', 'TEXT');
  addColumn('uploaded_at', 'TEXT');
  addColumn('backend_recording_id', "TEXT NOT NULL DEFAULT ''");
}

// ── Indices para queries frecuentes ──────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_matches_team_status
    ON matches (team_name, status);
  CREATE INDEX IF NOT EXISTS idx_matches_guild
    ON matches (guild_id, status);
  CREATE INDEX IF NOT EXISTS idx_reports_team
    ON reports (team_name);
  CREATE INDEX IF NOT EXISTS idx_activity_timestamp
    ON activity (timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_voice_guild
    ON voice_sessions (guild_id, joined_at DESC);
  CREATE INDEX IF NOT EXISTS idx_voice_user
    ON voice_sessions (user_id, joined_at DESC);
  CREATE INDEX IF NOT EXISTS idx_recordings_match
    ON match_recordings (match_id);
  CREATE INDEX IF NOT EXISTS idx_recordings_guild
    ON match_recordings (guild_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_crm_sessions_created
    ON crm_sessions (created_at);
`);

// ── Migracion desde JSON ──────────────────────
function migrateFromJson() {
  const already = db.prepare("SELECT name FROM migrations WHERE name = 'json_import'").get();
  if (already) return;

  const insertMatch = db.prepare(`
    INSERT OR IGNORE INTO matches
      (id, tournament_id, tournament_name, team_name, rival_name, guild_id,
       channel_id, voice_channel_id, notification_channel_id, channel_name,
       status, requested_by, requested_at, checkin_window_ms, checkin_deadline_at,
       ready_at, started_by, started_at, completed_at, result,
       disqualified_at, disqualification_reason, attendance)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertReport = db.prepare(`
    INSERT OR IGNORE INTO reports
      (id, guild_id, channel_id, tournament_name, team_name, match_id,
       result, evidence_url, evidence_name, reporter, disputed, disputed_at, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertActivity = db.prepare(`
    INSERT OR IGNORE INTO activity (id, action, detail, user_text, meta, timestamp)
    VALUES (?,?,?,?,?,?)
  `);

  const run = db.transaction(() => {
    // Matches
    const matchFile = path.join(DATA_DIR, 'matches.json');
    if (fs.existsSync(matchFile)) {
      try {
        const rows = JSON.parse(fs.readFileSync(matchFile, 'utf-8'));
        if (Array.isArray(rows)) {
          for (const m of rows) {
            insertMatch.run(
              String(m.id || `M-migrated-${Date.now()}`),
              m.tournamentId ?? null,
              m.tournamentName || '',
              m.teamName || '',
              m.rivalName ?? null,
              m.guildId || '',
              m.channelId || m.notificationChannelId || '',
              m.voiceChannelId || '',
              m.notificationChannelId || m.channelId || '',
              m.channelName || '',
              m.status || 'pending',
              m.requestedBy || m.startedBy || '',
              m.requestedAt || new Date().toISOString(),
              Number(m.checkinWindowMs || 1200000),
              m.checkinDeadlineAt ?? null,
              m.readyAt ?? null,
              m.startedBy || '',
              m.startedAt ?? null,
              m.completedAt ?? null,
              m.result ?? null,
              m.disqualifiedAt ?? null,
              m.disqualificationReason ?? null,
              JSON.stringify(m.attendance || {})
            );
          }
          console.log(`[DB] Migrados ${rows.length} matches desde matches.json`);
        }
      } catch (e) {
        console.warn('[DB] Error migrando matches.json:', e.message);
      }
    }

    // Reports
    const reportFile = path.join(DATA_DIR, 'reports.json');
    if (fs.existsSync(reportFile)) {
      try {
        const rows = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
        if (Array.isArray(rows)) {
          for (const r of rows) {
            insertReport.run(
              String(r.id || `R-migrated-${Date.now()}`),
              r.guildId || '',
              r.channelId || '',
              r.tournamentName || '',
              r.teamName || '',
              r.matchId ?? null,
              r.result || '',
              r.evidenceUrl ?? null,
              r.evidenceName ?? null,
              JSON.stringify(r.reporter || {}),
              r.disputed ? 1 : 0,
              r.disputedAt ?? null,
              r.createdAt || new Date().toISOString()
            );
          }
          console.log(`[DB] Migrados ${rows.length} reportes desde reports.json`);
        }
      } catch (e) {
        console.warn('[DB] Error migrando reports.json:', e.message);
      }
    }

    // Activity
    const actFile = path.join(DATA_DIR, 'activity.json');
    if (fs.existsSync(actFile)) {
      try {
        const rows = JSON.parse(fs.readFileSync(actFile, 'utf-8'));
        if (Array.isArray(rows)) {
          for (const a of rows) {
            insertActivity.run(
              String(a.id || `A-migrated-${Date.now()}`),
              a.action || '',
              a.detail || '',
              a.user || 'Sistema',
              JSON.stringify(a.meta || {}),
              a.timestamp || new Date().toISOString()
            );
          }
          console.log(`[DB] Migradas ${rows.length} entradas de activity.json`);
        }
      } catch (e) {
        console.warn('[DB] Error migrando activity.json:', e.message);
      }
    }

    db.prepare("INSERT INTO migrations (name, ran_at) VALUES ('json_import', ?)").run(
      new Date().toISOString()
    );
  });

  run();
  console.log('[DB] Base de datos SQLite lista en:', DB_PATH);
}

migrateFromJson();

module.exports = db;
