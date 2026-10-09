// ============================================
// GlitchGang Bot - Report Service (SQLite)
// ============================================

const db = require('./db');

function rowToReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    tournamentName: row.tournament_name,
    teamName: row.team_name,
    matchId: row.match_id ?? null,
    result: row.result,
    evidenceUrl: row.evidence_url ?? null,
    evidenceName: row.evidence_name ?? null,
    reporter: JSON.parse(row.reporter || '{}'),
    disputed: Boolean(row.disputed),
    disputedAt: row.disputed_at ?? null,
    createdAt: row.created_at,
  };
}

function loadReports() {
  return db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all().map(rowToReport);
}

function saveReport({ guildId, channelId, tournamentName, teamName, matchId, result, evidenceUrl, evidenceName, reporter }) {
  const id = `R-${Date.now()}-${reporter.id}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO reports
      (id, guild_id, channel_id, tournament_name, team_name, match_id,
       result, evidence_url, evidence_name, reporter, disputed, disputed_at, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,NULL,?)
  `).run(
    id,
    guildId || '',
    channelId || '',
    tournamentName || '',
    teamName || '',
    matchId ?? null,
    result || '',
    evidenceUrl ?? null,
    evidenceName ?? null,
    JSON.stringify({
      id: reporter.id,
      username: reporter.username,
      displayName: reporter.displayName || reporter.username,
    }),
    createdAt
  );

  console.log(`[Report] Reporte guardado: ${id} - ${teamName} (${result})`);
  return rowToReport(db.prepare('SELECT * FROM reports WHERE id = ?').get(id));
}

function getTeamReports(teamName) {
  return db
    .prepare('SELECT * FROM reports WHERE LOWER(team_name) = LOWER(?)')
    .all(teamName)
    .map(rowToReport);
}

function getTournamentReports(tournamentName) {
  return db
    .prepare('SELECT * FROM reports WHERE LOWER(tournament_name) = LOWER(?)')
    .all(tournamentName)
    .map(rowToReport);
}

function flagDispute(reportId, disputed) {
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  if (!row) return null;

  db.prepare(
    'UPDATE reports SET disputed = ?, disputed_at = ? WHERE id = ?'
  ).run(
    disputed ? 1 : 0,
    disputed ? new Date().toISOString() : null,
    reportId
  );

  return rowToReport(db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId));
}

function getDisputedReports() {
  return db
    .prepare('SELECT * FROM reports WHERE disputed = 1')
    .all()
    .map(rowToReport);
}

module.exports = {
  flagDispute,
  getDisputedReports,
  loadReports,
  saveReport,
  getTeamReports,
  getTournamentReports,
};
