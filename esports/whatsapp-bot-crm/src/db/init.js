const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(process.cwd(), "data", "glitchgang.db");

let db = null;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err);
      } else {
        console.log("Connected to SQLite database");
        initializeTables();
      }
    });
  }
  return db;
}

function initializeTables() {
  const db = getDb();

  db.serialize(() => {
    // Usuarios de GlitchGang
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        game TEXT,
        region TEXT,
        status TEXT DEFAULT 'active',
        verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cuentas de WhatsApp vinculadas
    db.run(`
      CREATE TABLE IF NOT EXISTS whatsapp_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        verified BOOLEAN DEFAULT 0,
        verified_at DATETIME,
        last_activity DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Códigos de verificación OTP
    db.run(`
      CREATE TABLE IF NOT EXISTS whatsapp_verification_codes (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INTEGER DEFAULT 0,
        used BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phone, code)
      )
    `);

    // Equipos
    db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        game TEXT NOT NULL,
        region TEXT,
        status TEXT DEFAULT 'active',
        members TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Torneos
    db.run(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        game TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        start_date DATETIME,
        max_teams INTEGER,
        registered_teams INTEGER DEFAULT 0,
        bracket_url TEXT,
        rules_url TEXT,
        discord_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Partidas
    db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL,
        tournament_name TEXT,
        team_a TEXT NOT NULL,
        team_b TEXT NOT NULL,
        scheduled_at DATETIME,
        checkin_at DATETIME,
        status TEXT DEFAULT 'scheduled',
        winner TEXT,
        discord_url TEXT,
        bracket_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
      )
    `);

    // Check-ins
    db.run(`
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        match_id TEXT NOT NULL,
        status TEXT DEFAULT 'confirmed',
        checked_in_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (match_id) REFERENCES matches(id)
      )
    `);

    // Notificaciones
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        message TEXT,
        data TEXT DEFAULT '{}',
        sent BOOLEAN DEFAULT 0,
        sent_at DATETIME,
        delivered BOOLEAN DEFAULT 0,
        delivered_at DATETIME,
        read BOOLEAN DEFAULT 0,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Preferencias de notificación
    db.run(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        checkin_reminder BOOLEAN DEFAULT 1,
        match_reminder BOOLEAN DEFAULT 1,
        result_notification BOOLEAN DEFAULT 1,
        tournament_alert BOOLEAN DEFAULT 1,
        team_invitation BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Comandos ejecutados
    db.run(`
      CREATE TABLE IF NOT EXISTS command_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        phone TEXT NOT NULL,
        command TEXT NOT NULL,
        group_name TEXT,
        status TEXT DEFAULT 'success',
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversaciones
    db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        user_id TEXT,
        direction TEXT,
        body TEXT,
        group_name TEXT,
        command TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Notas
    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        related_type TEXT,
        related_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Database tables initialized");
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) {
        console.error("Database error:", err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        console.error("Database error:", err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        console.error("Database error:", err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  getDb,
  run,
  get,
  all,
  close,
  initializeTables
};
