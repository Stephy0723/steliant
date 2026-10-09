// ============================================
// GlitchGang Bot - Join Code Service
// ============================================
// Genera y valida codigos de acceso para que
// los jugadores se registren en un equipo sin
// que el admin tenga que agregarlos manualmente.

const crypto = require('crypto');
const db = require('./db');

const DEFAULT_MAX_USES = 20;
const DEFAULT_EXPIRY_HOURS = 72; // 3 dias

// Formato: 8 chars hex en mayusculas — identico al portal web (ej: 862A4CDF)
// Tambien acepta codigos externos importados del portal directamente.
function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Normaliza un codigo externo del portal al formato esperado (8 chars, uppercase, sin espacios).
 * @param {string} raw
 * @returns {string}
 */
function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Crea (o renueva) el codigo de acceso de un equipo.
 * Desactiva codigos anteriores del mismo equipo/torneo.
 * @param {{ tournamentId: string, teamName: string, createdBy: string, maxUses?: number, expiryHours?: number }}
 * @returns {{ code: string, expiresAt: string, maxUses: number }}
 */
function createJoinCode({ tournamentId, teamName, createdBy, maxUses = DEFAULT_MAX_USES, expiryHours = DEFAULT_EXPIRY_HOURS, overrideCode = null }) {
  // Desactivar codigos anteriores de este equipo
  db.prepare(
    'UPDATE join_codes SET active = 0 WHERE tournament_id = ? AND LOWER(team_name) = LOWER(?)'
  ).run(tournamentId, teamName);

  // Usar el codigo del portal si se provee, si no generar uno nuevo
  const code = overrideCode ? normalizeCode(overrideCode) : generateCode();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO join_codes (code, tournament_id, team_name, created_by, created_at, expires_at, max_uses, uses, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
  `).run(code, tournamentId, teamName, createdBy || '', createdAt, expiresAt, maxUses);

  return { code, expiresAt, maxUses };
}

/**
 * Obtiene el codigo activo de un equipo (si existe).
 * @param {string} tournamentId
 * @param {string} teamName
 * @returns {object|null}
 */
function getTeamCode(tournamentId, teamName) {
  return db.prepare(`
    SELECT * FROM join_codes
    WHERE tournament_id = ? AND LOWER(team_name) = LOWER(?) AND active = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(tournamentId, teamName) || null;
}

/**
 * Valida un codigo antes de usarlo.
 * @param {string} code
 * @returns {{ valid: boolean, row?: object, error?: string }}
 */
function validateCode(code) {
  const row = db.prepare('SELECT * FROM join_codes WHERE code = ? AND active = 1').get(normalizeCode(code));

  if (!row) {
    return { valid: false, error: 'Codigo invalido o ya desactivado.' };
  }

  if (row.uses >= row.max_uses) {
    return { valid: false, error: `Este codigo ya alcanzo el limite de ${row.max_uses} usos.` };
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { valid: false, error: 'Este codigo ha expirado. Pide uno nuevo al lider del equipo.' };
  }

  return { valid: true, row };
}

/**
 * Incrementa el contador de usos del codigo.
 * @param {string} code
 */
function incrementCodeUse(code) {
  db.prepare('UPDATE join_codes SET uses = uses + 1 WHERE code = ?').run(code);
}

/**
 * Desactiva un codigo manualmente.
 * @param {string} code
 */
function revokeCode(code) {
  db.prepare('UPDATE join_codes SET active = 0 WHERE code = ?').run(code);
}

module.exports = {
  createJoinCode,
  getTeamCode,
  normalizeCode,
  validateCode,
  incrementCodeUse,
  revokeCode,
};
