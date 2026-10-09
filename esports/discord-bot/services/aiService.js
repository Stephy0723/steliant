// ============================================
// GlitchGang Bot - AI Service
// Cliente del "cerebro IA" de la plataforma (Claude + Gemini + OpenAI).
// Llama al backend GlitchGang: POST /api/bots/ai/ask
//
// Igual que backendApi.js: el bot nunca habla directo con el backend, pasa
// por el proxy del CRM (/bot-proxy/*, ver api/server.js) que reenvia a
// /api/bots/ai/ask con el BOT_API_KEY compartido (esa ruta esta detras de
// requireBotAuth en el backend, asi que sin la key esto ya fallaba con 401).
// ============================================

require('dotenv').config();

// Mismo fallback de puerto que usa api/server.js (Number(process.env.CRM_PORT) || 3000).
const CRM_PROXY_URL = process.env.CRM_INTERNAL_URL || `http://127.0.0.1:${Number(process.env.CRM_PORT) || 3000}`;
const BOT_API_KEY = process.env.BOT_API_KEY || '';
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 20000);

/** Mapea el torneo activo del bot al contexto que espera el cerebro IA. */
function buildContext(t) {
  if (!t) return undefined;
  return {
    title: t.name || t.title || 'Torneo activo',
    publicId: t.publicId || t.id || '',
    game: t.game || '',
    format: t.format || '',
    status: t.status || 'live',
    startDate: t.startDate || t.date || '',
    startTime: t.startTime || '',
    region: t.region || '',
    capacity: t.capacity,
    registered: Array.isArray(t.teams) ? t.teams.length : t.registered,
    entryFee: t.entryFee,
    prizePool: t.prizePool,
    prizes: t.prizes,
    checkinMinutes: t.checkinMinutes,
    description: t.description || '',
    rules: t.rules || '',
  };
}

/**
 * Pregunta una duda al cerebro IA, anclada al torneo activo.
 * @param {string} question
 * @param {object|null} tournament  torneo activo del bot (opcional)
 * @param {Array} history  [{ role, content }] historial corto (opcional)
 * @returns {Promise<{ answer: string, provider: string }>}
 */
async function ask(question, tournament = null, history = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CRM_PROXY_URL}/bot-proxy/ai/ask`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-glitchgang-bot-key': BOT_API_KEY,
      },
      body: JSON.stringify({ question, tournament: buildContext(tournament), history }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `La IA respondió ${res.status}`);
    return { answer: data.answer, provider: data.provider };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { ask, buildContext };
