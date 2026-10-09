// ============================================
// GlitchGang Bot - Voice Monitor Service
// ============================================
// Tracking persistente de sesiones de voice channels.
// Registra join/leave/move en SQLite para métricas y auditoría.

const crypto = require('crypto');
const db = require('./db');

// Sesiones activas en memoria: { `${guildId}:${userId}` => { id, channelId, joinedAt } }
const activeSessions = new Map();

/**
 * Registra un evento de voiceStateUpdate en la base de datos.
 * Llamar al inicio del handler de voiceStateUpdate.
 */
function trackEvent(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guildId = oldState.guild?.id || newState.guild?.id;
  if (!guildId) return;

  const key = `${guildId}:${member.id}`;
  const userName = member.displayName || member.user.username;

  const joined = !oldState.channelId && newState.channelId;
  const left = oldState.channelId && !newState.channelId;
  const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

  if (joined) {
    // Usuario entró a un canal de voz
    const sessionId = crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    activeSessions.set(key, {
      id: sessionId,
      channelId: newState.channelId,
      joinedAt: now,
    });

    db.prepare(`
      INSERT INTO voice_sessions (id, guild_id, user_id, user_name, channel_id, channel_name, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      guildId,
      member.id,
      userName,
      newState.channelId,
      newState.channel?.name || '',
      now
    );
  } else if (left) {
    // Usuario salió del canal de voz
    const session = activeSessions.get(key);
    const now = new Date().toISOString();

    if (session) {
      const durationMs = new Date(now) - new Date(session.joinedAt);
      db.prepare(`
        UPDATE voice_sessions SET left_at = ?, duration_ms = ? WHERE id = ?
      `).run(now, durationMs, session.id);
      activeSessions.delete(key);
    } else {
      // Sesión no estaba en memoria (bot reiniciado), crear registro retroactivo
      const sessionId = crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO voice_sessions (id, guild_id, user_id, user_name, channel_id, channel_name, joined_at, left_at, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        sessionId, guildId, member.id, userName,
        oldState.channelId, oldState.channel?.name || '',
        now, now
      );
    }
  } else if (moved) {
    // Usuario se movió de canal — cerrar sesión anterior, abrir nueva
    const session = activeSessions.get(key);
    const now = new Date().toISOString();

    if (session) {
      const durationMs = new Date(now) - new Date(session.joinedAt);
      db.prepare(`
        UPDATE voice_sessions SET left_at = ?, duration_ms = ? WHERE id = ?
      `).run(now, durationMs, session.id);
    }

    const newSessionId = crypto.randomBytes(8).toString('hex');
    activeSessions.set(key, {
      id: newSessionId,
      channelId: newState.channelId,
      joinedAt: now,
    });

    db.prepare(`
      INSERT INTO voice_sessions (id, guild_id, user_id, user_name, channel_id, channel_name, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newSessionId, guildId, member.id, userName,
      newState.channelId, newState.channel?.name || '',
      now
    );
  }
}

// ── Queries para el panel ───────────────────

/**
 * Historial de sesiones de voice para un guild.
 */
function getVoiceActivity(guildId, { from, to, limit = 100 } = {}) {
  let query = 'SELECT * FROM voice_sessions WHERE guild_id = ?';
  const params = [guildId];

  if (from) {
    query += ' AND joined_at >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND joined_at <= ?';
    params.push(to);
  }

  query += ' ORDER BY joined_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params).map(row => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    channelId: row.channel_id,
    channelName: row.channel_name,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    durationMs: row.duration_ms,
    active: !row.left_at,
  }));
}

/**
 * Estadísticas de voice para un guild.
 */
function getVoiceStats(guildId) {
  const totalSessions = db.prepare(
    'SELECT COUNT(*) as count FROM voice_sessions WHERE guild_id = ?'
  ).get(guildId)?.count || 0;

  const totalDurationMs = db.prepare(
    'SELECT COALESCE(SUM(duration_ms), 0) as total FROM voice_sessions WHERE guild_id = ? AND duration_ms > 0'
  ).get(guildId)?.total || 0;

  const topUsers = db.prepare(`
    SELECT user_id, user_name, COUNT(*) as sessions, COALESCE(SUM(duration_ms), 0) as total_ms
    FROM voice_sessions WHERE guild_id = ? AND duration_ms > 0
    GROUP BY user_id ORDER BY total_ms DESC LIMIT 10
  `).all(guildId);

  const topChannels = db.prepare(`
    SELECT channel_name, COUNT(*) as sessions, COALESCE(SUM(duration_ms), 0) as total_ms
    FROM voice_sessions WHERE guild_id = ? AND duration_ms > 0
    GROUP BY channel_id ORDER BY total_ms DESC LIMIT 10
  `).all(guildId);

  const todaySessions = db.prepare(
    "SELECT COUNT(*) as count FROM voice_sessions WHERE guild_id = ? AND joined_at >= date('now')"
  ).get(guildId)?.count || 0;

  return {
    totalSessions,
    totalDurationMs,
    totalHours: Math.round(totalDurationMs / 3600000 * 10) / 10,
    todaySessions,
    activeNow: [...activeSessions.entries()]
      .filter(([k]) => k.startsWith(guildId + ':'))
      .length,
    topUsers: topUsers.map(u => ({
      userId: u.user_id,
      userName: u.user_name,
      sessions: u.sessions,
      totalMs: u.total_ms,
      totalHours: Math.round(u.total_ms / 3600000 * 10) / 10,
    })),
    topChannels: topChannels.map(c => ({
      channelName: c.channel_name,
      sessions: c.sessions,
      totalMs: c.total_ms,
      totalHours: Math.round(c.total_ms / 3600000 * 10) / 10,
    })),
  };
}

module.exports = {
  trackEvent,
  getVoiceActivity,
  getVoiceStats,
};
