// ============================================
// GlitchGang Bot - Match Recorder Service
// ============================================
// Graba audio del voice channel durante partidas y monitorea screen share.
// Se activa con /start-match y se detiene con /report o /cancelar.
// matchId es el TournamentMatch del backend (una partida de UN equipo): al
// subirla, el backend la guarda con el torneo, la partida del bracket, el
// numero de partida de la serie y el equipo (ver recordingUploader.js).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EndBehaviorType } = require('@discordjs/voice');
const db = require('./db');
const recorderPool = require('./recorderPool');
const { OggOpusWriter } = require('./oggOpusWriter');
const recordingUploader = require('./recordingUploader');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recordings');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Grabaciones activas: { matchId => RecordingSession }
const activeRecordings = new Map();

// Referencia al client de discord.js (seteada desde ready)
let _client = null;

function initialize(client) {
  _client = client;
  recorderPool.start();
  recordingUploader.start();
  console.log('[MatchRecorder] Servicio inicializado');
}

function getClient() {
  if (!_client) throw new Error('MatchRecorder no inicializado. Llama initialize(client) primero.');
  return _client;
}

/**
 * Inicia la grabación de audio y el monitoreo de screen share.
 */
async function startRecording(matchId, guildId, voiceChannelId, connection) {
  if (activeRecordings.has(matchId)) {
    console.warn(`[MatchRecorder] Ya existe una grabacion activa para ${matchId}`);
    return activeRecordings.get(matchId).dbRecord;
  }

  const poolAssignment = await recorderPool.acquire({ guildId, channelId: voiceChannelId, matchId }).catch((error) => {
    if (recorderPool.configured()) throw error;
    return null;
  });
  const recordingConnection = poolAssignment?.connection || connection;
  const client = poolAssignment?.client || getClient();
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) throw new Error(`Guild ${guildId} no encontrado.`);

  const channel = guild.channels.cache.get(voiceChannelId) || await guild.channels.fetch(voiceChannelId).catch(() => null);
  const channelName = channel?.name || 'unknown';

  // Crear directorio para esta grabacion
  const recordingDir = path.join(DATA_DIR, matchId);
  if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

  const recordId = crypto.randomBytes(8).toString('hex');
  const startedAt = new Date().toISOString();

  // Obtener participantes actuales del canal
  const participants = channel
    ? channel.members.filter(m => !m.user.bot).map(m => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName,
      }))
    : [];

  // Guardar en SQLite
  db.prepare(`
    INSERT INTO match_recordings (id, match_id, guild_id, channel_id, channel_name, status, started_at, file_path, participants, screen_share_log, upload_status)
    VALUES (?, ?, ?, ?, ?, 'recording', ?, ?, ?, '[]', 'pending')
  `).run(recordId, matchId, guildId, voiceChannelId, channelName, startedAt, recordingDir, JSON.stringify(participants));

  const dbRecord = {
    id: recordId,
    matchId,
    guildId,
    channelId: voiceChannelId,
    channelName,
    status: 'recording',
    startedAt,
    filePath: recordingDir,
    participants,
  };

  // ── Grabar audio de cada usuario ──────────
  // Una pista .ogg por jugador (Ogg Opus, se oye en el navegador), alineada
  // al inicio de la grabacion: el silencio entre frases se rellena.
  const userStreams = new Map();
  const startedAtMs = Date.parse(startedAt);

  const subscribe = (userId, { username, displayName }) => {
    if (userStreams.has(userId)) return;
    try {
      const audioStream = recordingConnection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual },
      });
      const filePath = path.join(recordingDir, `${userId}.ogg`);
      const writer = new OggOpusWriter(filePath, { startedAt: startedAtMs });
      audioStream.on('data', (packet) => writer.writePacket(packet, Date.now()));
      audioStream.on('error', (error) => console.error(`[MatchRecorder] Audio de ${userId}:`, error.message));
      userStreams.set(userId, { audioStream, writer, filePath });
      console.log(`[MatchRecorder] Grabando audio de ${username} (${userId})`);
    } catch (error) {
      console.error(`[MatchRecorder] Error suscribiendo audio de ${userId}:`, error.message);
    }
  };

  let onSpeaking = null;
  if (recordingConnection?.receiver) {
    for (const participant of participants) subscribe(participant.id, participant);

    // Escuchar nuevos miembros que se unan durante la grabacion
    onSpeaking = (userId) => {
      if (userStreams.has(userId)) return;
      const member = channel?.members.get(userId);
      if (!member || member.user.bot) return;
      const participant = { id: userId, username: member.user.username, displayName: member.displayName };
      subscribe(userId, participant);
      if (userStreams.has(userId) && !participants.some(p => p.id === userId)) participants.push(participant);
    };
    recordingConnection.receiver.speaking.on('start', onSpeaking);
  }

  // ── Screen Share Monitor ──────────────────
  const screenShareLog = [];
  const screenShareInterval = setInterval(() => {
    if (!channel) return;

    // Refrescar miembros del canal
    const currentMembers = channel.members.filter(m => !m.user.bot);

    for (const [, member] of currentMembers) {
      const isStreaming = member.voice?.streaming || false;
      const lastEvent = screenShareLog
        .filter(e => e.userId === member.id)
        .pop();

      const wasStreaming = lastEvent?.event === 'screen_on';

      if (isStreaming && !wasStreaming) {
        screenShareLog.push({
          userId: member.id,
          username: member.user.username,
          event: 'screen_on',
          at: new Date().toISOString(),
        });
      } else if (!isStreaming && wasStreaming) {
        screenShareLog.push({
          userId: member.id,
          username: member.user.username,
          event: 'screen_off',
          at: new Date().toISOString(),
        });

        // Alerta: alguien apagó screen share
        const textChannel = guild.channels.cache.get(
          db.prepare('SELECT notification_channel_id FROM matches WHERE id = ?').get(matchId)?.notification_channel_id
        );

        if (textChannel?.isTextBased()) {
          textChannel.send(
            `⚠️ **${member.displayName}** desactivó el screen share durante la partida \`${matchId}\`.`
          ).catch(() => {});
        }

        screenShareLog.push({
          userId: member.id,
          username: member.user.username,
          event: 'alert_sent',
          at: new Date().toISOString(),
        });
      }
    }
  }, 10000); // Cada 10 segundos

  // Guardar sesion activa
  activeRecordings.set(matchId, {
    dbRecord,
    connection: recordingConnection,
    recorderWorkerId: poolAssignment?.workerId || 'primary',
    releaseRecorder: poolAssignment?.release || null,
    userStreams,
    onSpeaking,
    screenShareLog,
    screenShareInterval,
    recordingDir,
    participants,
  });

  console.log(`[MatchRecorder] Grabacion iniciada para match ${matchId} en #${channelName} con ${participants.length} participantes`);

  return dbRecord;
}

/**
 * Detiene la grabación de una partida.
 */
async function stopRecording(matchId) {
  const session = activeRecordings.get(matchId);
  if (!session) {
    console.warn(`[MatchRecorder] No hay grabacion activa para ${matchId}`);
    return null;
  }

  // Fuera del mapa antes de cualquier await: un segundo /report o /cancelar
  // no debe cerrar dos veces la misma grabacion.
  activeRecordings.delete(matchId);

  const stoppedAt = new Date().toISOString();
  const durationMs = new Date(stoppedAt) - new Date(session.dbRecord.startedAt);

  // Detener screen share monitor
  if (session.screenShareInterval) {
    clearInterval(session.screenShareInterval);
  }
  if (session.onSpeaking) {
    session.connection?.receiver?.speaking.off('start', session.onSpeaking);
  }

  // Cerrar las pistas: cada una se completa con silencio hasta stoppedAt para
  // que todas duren lo mismo que la partida.
  let totalFileSize = 0;
  const tracks = [];
  for (const [userId, streamData] of session.userStreams) {
    try {
      streamData.audioStream.destroy();
      const summary = await streamData.writer.end(Date.parse(stoppedAt));
      const bytes = fs.existsSync(streamData.filePath) ? fs.statSync(streamData.filePath).size : 0;
      totalFileSize += bytes;
      const participant = session.participants.find(p => p.id === userId) || {};
      tracks.push({
        discordUserId: userId,
        username: participant.username || '',
        displayName: participant.displayName || '',
        file: path.basename(streamData.filePath),
        bytes,
        durationMs: summary.durationMs,
        voicePackets: summary.voicePackets,
      });
    } catch (error) {
      console.error(`[MatchRecorder] Error cerrando stream de ${userId}:`, error.message);
    }
  }

  // Guardar metadata (la usa recordingUploader para subirla al backend)
  const metadataPath = path.join(session.recordingDir, 'metadata.json');
  const metadata = {
    recordId: session.dbRecord.id,
    matchId,
    guildId: session.dbRecord.guildId,
    channelId: session.dbRecord.channelId,
    channelName: session.dbRecord.channelName,
    startedAt: session.dbRecord.startedAt,
    stoppedAt,
    durationMs,
    format: 'ogg-opus',
    participants: session.participants,
    screenShareLog: session.screenShareLog,
    tracks,
    recorderWorkerId: session.recorderWorkerId,
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // Actualizar SQLite
  db.prepare(`
    UPDATE match_recordings
    SET status = 'completed', stopped_at = ?, duration_ms = ?, file_size_bytes = ?,
        participants = ?, screen_share_log = ?
    WHERE match_id = ? AND status = 'recording'
  `).run(
    stoppedAt,
    durationMs,
    totalFileSize,
    JSON.stringify(session.participants),
    JSON.stringify(session.screenShareLog),
    matchId
  );

  if (typeof session.releaseRecorder === 'function') {
    session.releaseRecorder();
  }

  // Sube las pistas al backend (via CRM) en segundo plano; si falla queda
  // pendiente y se reintenta (recordingUploader.retryPending).
  recordingUploader.uploadRecording(session.dbRecord.id).catch((error) => {
    console.error(`[MatchRecorder] Subida de la grabacion ${matchId} pendiente:`, error.message);
  });

  const result = {
    matchId,
    status: 'completed',
    startedAt: session.dbRecord.startedAt,
    stoppedAt,
    durationMs,
    durationFormatted: formatDuration(durationMs),
    participants: session.participants.length,
    fileSizeBytes: totalFileSize,
    screenShareEvents: session.screenShareLog.length,
    tracks: tracks.length,
    filePath: session.recordingDir,
    recorderWorkerId: session.recorderWorkerId,
  };

  console.log(`[MatchRecorder] Grabacion completada para match ${matchId} — ${result.durationFormatted}, ${result.participants} participantes, ${formatFileSize(totalFileSize)}`);

  return result;
}

/**
 * Obtiene el estado actual de una grabación.
 */
function getRecordingStatus(matchId) {
  if (activeRecordings.has(matchId)) {
    const session = activeRecordings.get(matchId);
    const now = new Date();
    const durationMs = now - new Date(session.dbRecord.startedAt);

    return {
      matchId,
      status: 'recording',
      startedAt: session.dbRecord.startedAt,
      durationMs,
      durationFormatted: formatDuration(durationMs),
      participants: session.participants.length,
      screenShareEvents: session.screenShareLog.length,
      recorderWorkerId: session.recorderWorkerId,
    };
  }

  const row = db.prepare(
    'SELECT * FROM match_recordings WHERE match_id = ? ORDER BY started_at DESC LIMIT 1'
  ).get(matchId);

  if (!row) return null;

  return {
    matchId: row.match_id,
    status: row.status,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    durationMs: row.duration_ms,
    durationFormatted: formatDuration(row.duration_ms),
    participants: JSON.parse(row.participants || '[]').length,
    fileSizeBytes: row.file_size_bytes,
    screenShareLog: JSON.parse(row.screen_share_log || '[]'),
  };
}

/**
 * Lista de grabaciones para un guild.
 */
function getRecordings(guildId, { limit = 50 } = {}) {
  return db.prepare(
    'SELECT * FROM match_recordings WHERE guild_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(guildId, limit).map(row => ({
    id: row.id,
    matchId: row.match_id,
    channelName: row.channel_name,
    status: row.status,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    durationMs: row.duration_ms,
    durationFormatted: formatDuration(row.duration_ms),
    fileSizeBytes: row.file_size_bytes,
    fileSizeFormatted: formatFileSize(row.file_size_bytes),
    participants: JSON.parse(row.participants || '[]'),
    screenShareEvents: JSON.parse(row.screen_share_log || '[]').length,
  }));
}

/**
 * Detalle completo de una grabación por matchId.
 */
function getRecording(matchId) {
  const row = db.prepare(
    'SELECT * FROM match_recordings WHERE match_id = ? ORDER BY started_at DESC LIMIT 1'
  ).get(matchId);

  if (!row) return null;

  return {
    id: row.id,
    matchId: row.match_id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    status: row.status,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    durationMs: row.duration_ms,
    durationFormatted: formatDuration(row.duration_ms),
    filePath: row.file_path,
    fileSizeBytes: row.file_size_bytes,
    fileSizeFormatted: formatFileSize(row.file_size_bytes),
    participants: JSON.parse(row.participants || '[]'),
    screenShareLog: JSON.parse(row.screen_share_log || '[]'),
  };
}

// ── Utilidades ──────────────────────────────

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = {
  initialize,
  startRecording,
  stopRecording,
  getRecordingStatus,
  getRecordings,
  getRecording,
  formatDuration,
  formatFileSize,
  usesRecorderPool: recorderPool.configured,
};
