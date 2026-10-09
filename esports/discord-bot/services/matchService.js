// ============================================
// GlitchGang Bot - Match Service (SQLite)
// ============================================

const db = require('./db');
const { BOT_CONFIG, MATCH_STATUS } = require('../utils/constants');

const OPEN_CHECKIN_STATUSES = [MATCH_STATUS.CHECKING_IN, MATCH_STATUS.READY];

// ── Row <-> Object converters ─────────────────

function rowToMatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    tournamentId: row.tournament_id ?? null,
    tournamentName: row.tournament_name,
    teamName: row.team_name,
    rivalName: row.rival_name ?? null,
    guildId: row.guild_id,
    channelId: row.channel_id,
    voiceChannelId: row.voice_channel_id,
    notificationChannelId: row.notification_channel_id,
    channelName: row.channel_name,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    checkinWindowMs: row.checkin_window_ms,
    checkinDeadlineAt: row.checkin_deadline_at ?? null,
    readyAt: row.ready_at ?? null,
    startedBy: row.started_by,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    result: row.result ?? null,
    disqualifiedAt: row.disqualified_at ?? null,
    disqualificationReason: row.disqualification_reason ?? null,
    attendance: JSON.parse(row.attendance || '{}'),
  };
}

const INSERT_MATCH = db.prepare(`
  INSERT OR REPLACE INTO matches
    (id, tournament_id, tournament_name, team_name, rival_name, guild_id,
     channel_id, voice_channel_id, notification_channel_id, channel_name,
     status, requested_by, requested_at, checkin_window_ms, checkin_deadline_at,
     ready_at, started_by, started_at, completed_at, result,
     disqualified_at, disqualification_reason, attendance)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

function upsertMatch(m) {
  INSERT_MATCH.run(
    m.id,
    m.tournamentId ?? null,
    m.tournamentName || '',
    m.teamName || '',
    m.rivalName ?? null,
    m.guildId || '',
    m.channelId || '',
    m.voiceChannelId || '',
    m.notificationChannelId || '',
    m.channelName || '',
    m.status || MATCH_STATUS.PENDING,
    m.requestedBy || '',
    m.requestedAt || new Date().toISOString(),
    Number(m.checkinWindowMs || BOT_CONFIG.CHECKIN_WINDOW_MS),
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

// ── Helpers ───────────────────────────────────

function buildAttendanceSnapshot(attendance) {
  return {
    presentCount: attendance.present.length,
    totalCount: attendance.present.length + attendance.missing.length,
    presentPlayers: attendance.present.map((e) => e.player.name),
    missingPlayers: attendance.missing.map((e) => e.player.name),
    unexpectedPlayers: attendance.unexpected.map((e) => e.displayName),
  };
}

function getSortTimestamp(match) {
  return new Date(
    match.completedAt || match.startedAt || match.readyAt || match.requestedAt || 0
  ).getTime();
}

// ── Public API ────────────────────────────────

function loadMatches() {
  return db.prepare('SELECT * FROM matches').all().map(rowToMatch);
}

// Kept for backward-compatibility (API server)
function saveMatches(matches) {
  const tx = db.transaction(() => {
    for (const m of matches) upsertMatch(m);
  });
  tx();
}

function findLatestTeamOperation(teamName, _matches) {
  const row = db
    .prepare(
      `SELECT * FROM matches
       WHERE LOWER(team_name) = LOWER(?)
       ORDER BY COALESCE(completed_at, started_at, ready_at, requested_at) DESC
       LIMIT 1`
    )
    .get(teamName);
  return rowToMatch(row);
}

function findOpenCheckin(teamName, _matches) {
  const placeholders = OPEN_CHECKIN_STATUSES.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT * FROM matches
       WHERE LOWER(team_name) = LOWER(?) AND status IN (${placeholders})
       ORDER BY COALESCE(completed_at, started_at, ready_at, requested_at) DESC
       LIMIT 1`
    )
    .get(teamName, ...OPEN_CHECKIN_STATUSES);
  return rowToMatch(row);
}

function findActiveMatch(teamName) {
  const row = db
    .prepare(
      `SELECT * FROM matches
       WHERE LOWER(team_name) = LOWER(?) AND status = ?
       LIMIT 1`
    )
    .get(teamName, MATCH_STATUS.IN_PROGRESS);
  return rowToMatch(row);
}

function getExpiredCheckins(now = Date.now()) {
  return db
    .prepare(
      `SELECT * FROM matches
       WHERE status = ? AND checkin_deadline_at IS NOT NULL
         AND CAST(strftime('%s', checkin_deadline_at) AS INTEGER) * 1000 <= ?`
    )
    .all(MATCH_STATUS.CHECKING_IN, now)
    .map(rowToMatch);
}

function getTeamHistory(teamName) {
  return db
    .prepare(
      `SELECT * FROM matches
       WHERE LOWER(team_name) = LOWER(?) AND status = ?`
    )
    .all(teamName, MATCH_STATUS.COMPLETED)
    .map(rowToMatch);
}

function getTournamentOperations(tournament) {
  if (!tournament) return [];

  const statuses = [
    MATCH_STATUS.CHECKING_IN,
    MATCH_STATUS.READY,
    MATCH_STATUS.IN_PROGRESS,
    MATCH_STATUS.DISQUALIFIED,
  ];
  const placeholders = statuses.map(() => '?').join(',');

  const rows = db
    .prepare(
      `SELECT * FROM matches
       WHERE (tournament_id = ? OR LOWER(tournament_name) = LOWER(?))
         AND status IN (${placeholders})`
    )
    .all(String(tournament.id), tournament.name, ...statuses)
    .map(rowToMatch);

  return rows.sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
}

// ── Write operations ──────────────────────────

function createOrRefreshCheckin({
  tournamentId,
  tournamentName,
  teamName,
  guildId,
  voiceChannelId,
  notificationChannelId,
  channelName,
  requestedBy,
  attendance,
  checkinWindowMs,
}) {
  const now = new Date();
  const attendanceSnapshot = buildAttendanceSnapshot(attendance);
  const shouldBeReady = attendance.missing.length === 0;
  const existing = findOpenCheckin(teamName);
  const previousStatus = existing?.status ?? null;

  let match;

  if (!existing) {
    const windowMs = Number(checkinWindowMs || BOT_CONFIG.CHECKIN_WINDOW_MS);
    match = {
      id: `M-${Date.now()}`,
      tournamentId,
      tournamentName,
      teamName,
      rivalName: null,
      guildId,
      channelId: notificationChannelId,
      voiceChannelId,
      notificationChannelId,
      channelName,
      status: shouldBeReady ? MATCH_STATUS.READY : MATCH_STATUS.CHECKING_IN,
      requestedBy,
      requestedAt: now.toISOString(),
      checkinWindowMs: windowMs,
      checkinDeadlineAt: new Date(now.getTime() + windowMs).toISOString(),
      readyAt: shouldBeReady ? now.toISOString() : null,
      startedBy: '',
      startedAt: null,
      completedAt: null,
      result: null,
      disqualifiedAt: null,
      disqualificationReason: null,
      attendance: attendanceSnapshot,
    };
  } else {
    const windowMs = checkinWindowMs
      ? Number(checkinWindowMs)
      : existing.checkinWindowMs;

    match = {
      ...existing,
      tournamentId,
      tournamentName,
      guildId,
      channelId: notificationChannelId,
      voiceChannelId,
      notificationChannelId,
      channelName,
      attendance: attendanceSnapshot,
      checkinWindowMs: windowMs,
      checkinDeadlineAt: checkinWindowMs
        ? new Date(new Date(existing.requestedAt).getTime() + windowMs).toISOString()
        : existing.checkinDeadlineAt,
      status:
        existing.status !== MATCH_STATUS.READY && shouldBeReady
          ? MATCH_STATUS.READY
          : existing.status !== MATCH_STATUS.READY
          ? MATCH_STATUS.CHECKING_IN
          : existing.status,
      readyAt:
        existing.status !== MATCH_STATUS.READY && shouldBeReady
          ? now.toISOString()
          : existing.readyAt,
    };
  }

  upsertMatch(match);

  return {
    match,
    created: !existing,
    becameReady: previousStatus !== MATCH_STATUS.READY && match.status === MATCH_STATUS.READY,
  };
}

function createMatch({
  tournamentId,
  tournamentName,
  teamName,
  rivalName,
  guildId,
  voiceChannelId,
  notificationChannelId,
  channelName,
  startedBy,
}) {
  const now = new Date().toISOString();
  const existing = findOpenCheckin(teamName);

  const match = {
    ...(existing || {}),
    id: existing?.id || `M-${Date.now()}`,
    tournamentId,
    tournamentName,
    teamName,
    rivalName: rivalName || null,
    guildId,
    channelId: notificationChannelId,
    voiceChannelId,
    notificationChannelId,
    channelName,
    status: MATCH_STATUS.IN_PROGRESS,
    requestedBy: existing?.requestedBy || startedBy,
    requestedAt: existing?.requestedAt || now,
    checkinWindowMs: existing?.checkinWindowMs || BOT_CONFIG.CHECKIN_WINDOW_MS,
    checkinDeadlineAt:
      existing?.checkinDeadlineAt ||
      new Date(Date.now() + BOT_CONFIG.CHECKIN_WINDOW_MS).toISOString(),
    readyAt: existing?.readyAt || now,
    startedBy,
    startedAt: now,
    completedAt: null,
    result: null,
    disqualifiedAt: null,
    disqualificationReason: null,
    attendance: existing?.attendance || {},
  };

  upsertMatch(match);
  console.log(`[Match] Partida creada: ${match.id} - ${teamName} vs ${rivalName || 'TBD'}`);
  return match;
}

function completeMatch(matchId, result) {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!row) return null;

  db.prepare(
    `UPDATE matches SET status = ?, result = ?, completed_at = ? WHERE id = ?`
  ).run(MATCH_STATUS.COMPLETED, result, new Date().toISOString(), matchId);

  console.log(`[Match] Partida completada: ${matchId} - Resultado: ${result}`);
  return rowToMatch(db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId));
}

function disqualifyCheckin(matchId, reason) {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!row || row.status !== MATCH_STATUS.CHECKING_IN) return null;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE matches SET status = ?, disqualified_at = ?, disqualification_reason = ? WHERE id = ?`
  ).run(
    MATCH_STATUS.DISQUALIFIED,
    now,
    reason || 'El equipo no completo el check-in dentro del tiempo limite.',
    matchId
  );

  return rowToMatch(db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId));
}

function cancelMatch(matchId, reason) {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!row) return null;

  const cancellable = [
    MATCH_STATUS.IN_PROGRESS,
    MATCH_STATUS.CHECKING_IN,
    MATCH_STATUS.READY,
  ];
  if (!cancellable.includes(row.status)) return null;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE matches
     SET status = ?, disqualified_at = ?, disqualification_reason = ?
     WHERE id = ?`
  ).run(MATCH_STATUS.CANCELLED, now, reason || 'Partida cancelada manualmente.', matchId);

  console.log(`[Match] Partida cancelada: ${matchId}`);
  return rowToMatch(db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId));
}

module.exports = {
  cancelMatch,
  completeMatch,
  createMatch,
  createOrRefreshCheckin,
  disqualifyCheckin,
  findActiveMatch,
  findLatestTeamOperation,
  findOpenCheckin,
  getExpiredCheckins,
  getTeamHistory,
  getTournamentOperations,
  loadMatches,
  saveMatches,
};
