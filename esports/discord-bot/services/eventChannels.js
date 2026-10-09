// ============================================
// GlitchGang Bot - Event Channels
// ============================================
// Mapa "evento del CRM -> canal de Discord donde se anuncia". Sin esto los
// canales (anuncios, torneos, resultados) quedan mudos: nadie los conecta
// a nada. No son webhooks de Discord de verdad (URLs que rotar) — el bot
// ya tiene permiso de postear directo, que es mas simple y no expone nada.

const db = require('./db');

const EVENTS = {
  announcements: { label: 'Anuncios', hint: 'Se postea cuando se crea un torneo nuevo.' },
  tournaments: { label: 'Torneos', hint: 'Se postea cuando un torneo se activa o se inscribe un equipo.' },
  results: { label: 'Resultados', hint: 'Se postea cuando un equipo reporta el resultado de una partida (/report).' },
  staffLog: { label: 'Staff (registro privado)', hint: 'Copia de /checkin, /cancelar y /start-match -- estos comandos ahora responden en privado al jugador, asi que solo el staff con acceso a este canal ve la operacion completa.' },
};

const upsertStmt = db.prepare(`
  INSERT INTO event_channels (event_key, channel_id, channel_name, updated_at)
  VALUES (@key, @channelId, @channelName, @updatedAt)
  ON CONFLICT(event_key) DO UPDATE SET
    channel_id = excluded.channel_id,
    channel_name = excluded.channel_name,
    updated_at = excluded.updated_at
`);
const getAllStmt = db.prepare('SELECT * FROM event_channels');
const getOneStmt = db.prepare('SELECT * FROM event_channels WHERE event_key = ?');
const deleteStmt = db.prepare('DELETE FROM event_channels WHERE event_key = ?');

function listEventChannels() {
  const rows = getAllStmt.all();
  const byKey = Object.fromEntries(rows.map((r) => [r.event_key, { channelId: r.channel_id, channelName: r.channel_name }]));
  return Object.entries(EVENTS).map(([key, meta]) => ({
    key,
    label: meta.label,
    hint: meta.hint,
    channelId: byKey[key]?.channelId || '',
    channelName: byKey[key]?.channelName || '',
  }));
}

function setEventChannel(key, channelId, channelName) {
  if (!EVENTS[key]) throw new Error(`Evento desconocido: ${key}`);
  if (!channelId) {
    deleteStmt.run(key);
    return null;
  }
  upsertStmt.run({ key, channelId, channelName: channelName || '', updatedAt: new Date().toISOString() });
  return getOneStmt.get(key);
}

function getEventChannelId(key) {
  const row = getOneStmt.get(key);
  return row?.channel_id || null;
}

// Publica una copia de un mensaje en el canal configurado para `key`, si hay
// uno. Nunca revienta al que la llama (best-effort, igual que announceEvent):
// si el canal no esta configurado, no existe mas, o el bot no tiene permiso,
// simplemente se loguea y se sigue -- el comando ya le respondio al usuario.
async function postToEventChannel(guild, key, payload) {
  try {
    const channelId = getEventChannelId(key);
    if (!channelId || !guild) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased()) await channel.send(payload);
  } catch (error) {
    console.error(`[EventChannels] Error publicando en "${key}":`, error.message);
  }
}

module.exports = { EVENTS, listEventChannels, setEventChannel, getEventChannelId, postToEventChannel };
