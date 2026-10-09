// ============================================
// GlitchGang Bot - Activity Service (SQLite)
// ============================================

const crypto = require('crypto');
const db = require('./db');

const MAX_ACTIVITY = 500; // Limite en DB (antes era 100 en JSON)

function rowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    action: row.action,
    detail: row.detail,
    user: row.user_text,
    meta: JSON.parse(row.meta || '{}'),
    timestamp: row.timestamp,
  };
}

function loadActivity() {
  return db
    .prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?')
    .all(MAX_ACTIVITY)
    .map(rowToEntry);
}

function pushActivity(action, detail, user = 'Sistema', meta = {}) {
  const id = crypto.randomBytes(8).toString('hex');
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO activity (id, action, detail, user_text, meta, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, action || '', detail || '', user || 'Sistema', JSON.stringify(meta || {}), timestamp);

  // Eliminar entradas antiguas si superamos el limite
  const count = db.prepare('SELECT COUNT(*) as n FROM activity').get().n;
  if (count > MAX_ACTIVITY) {
    db.prepare(`
      DELETE FROM activity WHERE id IN (
        SELECT id FROM activity ORDER BY timestamp ASC LIMIT ?
      )
    `).run(count - MAX_ACTIVITY);
  }

  return { id, action, detail, user: user || 'Sistema', meta, timestamp };
}

// Kept for backward-compatibility (API server uses saveActivity)
function saveActivity(entries) {
  const tx = db.transaction(() => {
    for (const a of entries) {
      db.prepare(`
        INSERT OR REPLACE INTO activity (id, action, detail, user_text, meta, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        a.id || crypto.randomBytes(8).toString('hex'),
        a.action || '',
        a.detail || '',
        a.user || 'Sistema',
        JSON.stringify(a.meta || {}),
        a.timestamp || new Date().toISOString()
      );
    }
  });
  tx();
}

module.exports = {
  loadActivity,
  pushActivity,
  saveActivity,
};
