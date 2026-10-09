// ============================================
// GlitchGang Bot - Recording Uploader
// ============================================
// Sube las grabaciones de voz de cada partida al backend, por el CRM
// (/bot-proxy, nunca directo: ver DISCORD-SYNC-PLAN.md). El backend las
// guarda con el torneo, la partida del bracket, el numero de partida de la
// serie y el equipo, y solo el arbitro del torneo las puede escuchar.
//
// 1. POST /matches/:matchId/recording        metadata + sha256 de cada pista
// 2. PUT  /matches/:matchId/recording/tracks/:discordUserId   cada .ogg
// La copia local se borra solo cuando el backend confirma TODAS las pistas
// (mismo sha256). Si algo falla, queda en disco y se reintenta.

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const CRM_PROXY_URL = process.env.CRM_INTERNAL_URL || `http://127.0.0.1:${Number(process.env.CRM_PORT) || 3000}`;
const BOT_API_KEY = process.env.BOT_API_KEY || '';
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_EVERY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 60;
// Lo que promete el aviso de la sala: sin reclamo, se borra a los 30 dias.
// Aplica a lo que se queda en el disco del bot sin poder subirse.
const LOCAL_RETENTION_DAYS = Math.max(1, Number(process.env.RECORDING_RETENTION_DAYS) || 30);
const RECORDINGS_DIR = path.join(__dirname, '..', 'data', 'recordings');

const uploading = new Set();
let timer = null;

class UploadError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function proxy(pathname, { method = 'POST', json, body, headers = {} }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(`${CRM_PROXY_URL}/bot-proxy${pathname}`, {
      method,
      headers: {
        'content-type': json ? 'application/json' : 'audio/ogg',
        'x-glitchgang-bot-key': BOT_API_KEY,
        ...headers,
      },
      body: json ? JSON.stringify(json) : body,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new UploadError(data.message || data.error || `El backend respondio ${res.status}`, { status: res.status, code: data.error || '' });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function markAttempt(id, status, error = '') {
  db.prepare(`
    UPDATE match_recordings
    SET upload_status = ?, upload_error = ?, upload_attempts = upload_attempts + 1, upload_attempted_at = ?
    WHERE id = ?
  `).run(status, String(error).slice(0, 500), new Date().toISOString(), id);
}

/**
 * Sube una grabacion terminada (fila de match_recordings). Idempotente: el
 * backend solo pide las pistas que todavia no tiene.
 */
async function uploadRecording(recordId) {
  if (uploading.has(recordId)) return null;
  const row = db.prepare('SELECT * FROM match_recordings WHERE id = ?').get(recordId);
  if (!row || row.status !== 'completed' || row.upload_status === 'uploaded') return null;
  if (!BOT_API_KEY) {
    markAttempt(recordId, 'failed', 'BOT_API_KEY no configurado');
    return null;
  }

  uploading.add(recordId);
  try {
    const dir = row.file_path;
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf-8'));
    const files = new Map();
    for (const track of metadata.tracks || []) {
      const filePath = path.join(dir, track.file);
      if (!fs.existsSync(filePath)) continue;
      const buffer = fs.readFileSync(filePath);
      files.set(track.discordUserId, { ...track, buffer, sha256: sha256(buffer), bytes: buffer.length });
    }

    const matchPath = `/matches/${encodeURIComponent(row.match_id)}/recording`;
    let state = await proxy(matchPath, {
      json: {
        recordId: row.id,
        guildId: metadata.guildId,
        channelId: metadata.channelId,
        channelName: metadata.channelName,
        startedAt: metadata.startedAt,
        stoppedAt: metadata.stoppedAt,
        durationMs: metadata.durationMs,
        format: metadata.format,
        screenShareLog: metadata.screenShareLog || [],
        tracks: [...files.values()].map(({ buffer, ...track }) => track),
      },
    });

    for (const discordUserId of state.missingTracks || []) {
      const track = files.get(discordUserId);
      if (!track) continue;
      state = await proxy(`${matchPath}/tracks/${encodeURIComponent(discordUserId)}`, {
        method: 'PUT',
        body: track.buffer,
        headers: { 'x-track-sha256': track.sha256 },
      });
    }

    if ((state.missingTracks || []).length) {
      throw new UploadError(`Faltan ${state.missingTracks.length} pista(s) en el backend`);
    }

    db.prepare(`
      UPDATE match_recordings
      SET upload_status = 'uploaded', upload_error = '', uploaded_at = ?, backend_recording_id = ?,
          upload_attempts = upload_attempts + 1, upload_attempted_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), String(state.id || ''), new Date().toISOString(), row.id);

    // El backend ya tiene todo (sha256 verificado): no dejar copias de voz
    // regadas en el disco del bot.
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[RecordingUploader] Grabacion ${row.match_id} guardada en el backend (${files.size} pistas)`);
    return state;
  } catch (error) {
    // La partida no existe en el backend (p. ej. pruebas locales): no tiene
    // a que enlazarse, se deja en disco sin reintentar.
    const status = error.code === 'match_not_found' ? 'orphan' : 'failed';
    markAttempt(recordId, status, error.message);
    throw error;
  } finally {
    uploading.delete(recordId);
  }
}

// Reintentos con espera creciente (5, 10, 15... hasta 60 min entre intentos).
async function retryPending() {
  const rows = db.prepare(`
    SELECT id, upload_attempts, upload_attempted_at FROM match_recordings
    WHERE status = 'completed' AND upload_status IN ('pending', 'failed') AND upload_attempts < ?
    ORDER BY started_at ASC LIMIT 20
  `).all(MAX_ATTEMPTS);
  const now = Date.now();
  for (const row of rows) {
    const waitMs = Math.min(row.upload_attempts * 5, 60) * 60 * 1000;
    if (row.upload_attempted_at && now - Date.parse(row.upload_attempted_at) < waitMs) continue;
    await uploadRecording(row.id).catch((error) => {
      console.error(`[RecordingUploader] Reintento ${row.id}:`, error.message);
    });
  }
}

/**
 * Borra del disco del bot las grabaciones que nunca van a llegar al backend,
 * cumplidos LOCAL_RETENTION_DAYS desde que empezaron:
 * - 'legacy': las de antes del .ogg. Eran paquetes Opus pegados sin
 *   separacion ni tiempos (.pcm): no hay forma confiable de reconstruirlas.
 * - 'orphan': la partida no existe en el backend.
 * - 'failed' que ya agoto los reintentos.
 * Tambien carpetas sueltas sin fila en la base, por fecha de modificacion.
 */
function purgeLocal(now = Date.now()) {
  const cutoff = new Date(now - LOCAL_RETENTION_DAYS * 86400000).toISOString();
  const rows = db.prepare(`
    SELECT id, file_path FROM match_recordings
    WHERE status != 'recording' AND started_at < ?
      AND (upload_status IN ('legacy', 'orphan') OR (upload_status = 'failed' AND upload_attempts >= ?))
  `).all(cutoff, MAX_ATTEMPTS);
  let removed = 0;
  for (const row of rows) {
    if (row.file_path && path.resolve(row.file_path).startsWith(path.resolve(RECORDINGS_DIR) + path.sep)) {
      fs.rmSync(row.file_path, { recursive: true, force: true });
    }
    db.prepare("UPDATE match_recordings SET upload_status = 'expired', upload_error = '' WHERE id = ?").run(row.id);
    removed += 1;
  }

  // Carpetas sin fila (las filas ya se trataron arriba).
  const known = new Set(db.prepare('SELECT file_path FROM match_recordings WHERE file_path IS NOT NULL').all().map(r => path.resolve(r.file_path)));
  if (fs.existsSync(RECORDINGS_DIR)) {
    for (const entry of fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true })) {
      const dir = path.join(RECORDINGS_DIR, entry.name);
      if (!entry.isDirectory() || known.has(path.resolve(dir))) continue;
      if (fs.statSync(dir).mtimeMs > now - LOCAL_RETENTION_DAYS * 86400000) continue;
      fs.rmSync(dir, { recursive: true, force: true });
      removed += 1;
    }
  }
  if (removed) console.log(`[RecordingUploader] ${removed} grabacion(es) locales vencidas borradas (${LOCAL_RETENTION_DAYS} dias)`);
  return removed;
}

function tick() {
  retryPending().catch(() => {});
  try { purgeLocal(); } catch (error) { console.error('[RecordingUploader] Limpieza local:', error.message); }
}

function start() {
  if (timer) return;
  setTimeout(tick, 15000).unref?.();
  timer = setInterval(tick, RETRY_EVERY_MS);
  timer.unref?.();
}

module.exports = { uploadRecording, retryPending, purgeLocal, start };
