import { config } from '../config/index.js'

/**
 * Cerebro IA multi-proveedor.
 *
 * Abstrae Claude (Anthropic), OpenAI y Gemini (Google) tras una sola
 * interfaz `generate()`. Reparte la carga entre los proveedores que
 * tengan API key (round-robin) y, si uno falla, cae automáticamente al
 * siguiente disponible (fallback). Así ninguna cuenta/token se sobrecarga.
 *
 * Usa fetch nativo (Node 18+), sin SDKs.
 */

// ── Adaptadores por proveedor ────────────────────────────────
// Cada uno recibe ({ system, messages, maxTokens }) y devuelve string.

async function callClaude({ system, messages, maxTokens }) {
  const { key, model } = config.ai.providers.claude
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content?.map(b => b.text).join('').trim() || ''
}

async function callOpenAI({ system, messages, maxTokens }) {
  const { key, model } = config.ai.providers.openai
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function callGemini({ system, messages, maxTokens }) {
  const { key, model, fallbackModels } = config.ai.providers.gemini
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  }
  // El nivel gratuito satura (503/429) o retira modelos (404) sin aviso: se
  // prueba el modelo configurado y luego los de respaldo.
  let lastError = ''
  for (const name of [model, ...fallbackModels.filter(m => m !== model)]) {
    const generationConfig = { maxOutputTokens: maxTokens }
    // Los 2.5 "piensan" y ese razonamiento gasta maxOutputTokens.
    if (/2.5-flash/.test(name) && !/lite/.test(name)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`
    const request = () => fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ ...body, generationConfig }),
    })
    let res = await request()
    if (res.status === 503 || res.status === 429) { await new Promise(r => setTimeout(r, 800)); res = await request() }
    if (res.ok) {
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || ''
      if (text) return text
      lastError = `Gemini ${name}: respuesta vacia`
      continue
    }
    lastError = `Gemini ${name} ${res.status}: ${(await res.text()).slice(0, 200)}`
    if (![404, 429, 500, 503].includes(res.status)) break
  }
  throw new Error(lastError)
}

const ADAPTERS = { claude: callClaude, openai: callOpenAI, gemini: callGemini }

// ── Selección de proveedor ───────────────────────────────────

/** Proveedores con API key configurada, en orden estable. */
export function availableProviders() {
  return Object.entries(config.ai.providers)
    .filter(([, cfg]) => Boolean(cfg.key))
    .map(([name]) => name)
}

let rrCursor = 0

/** Orden de intento según la estrategia, empezando por el elegido. */
function providerOrder() {
  const avail = availableProviders()
  if (avail.length === 0) return []
  if (config.ai.strategy === 'failover') return avail
  // round-robin: rota el punto de inicio para repartir la carga
  const start = rrCursor % avail.length
  rrCursor = (rrCursor + 1) % avail.length
  return [...avail.slice(start), ...avail.slice(0, start)]
}

// ── API pública ──────────────────────────────────────────────

/**
 * Genera texto probando proveedores en orden (con fallback).
 * @returns {Promise<{ text: string, provider: string }>}
 */
export async function generate({ system, messages, maxTokens = config.ai.maxTokens }) {
  const order = providerOrder()
  if (order.length === 0) {
    throw new Error('No hay proveedores de IA configurados. Añade ANTHROPIC_API_KEY, OPENAI_API_KEY o GEMINI_API_KEY.')
  }
  const errors = []
  for (const name of order) {
    try {
      const text = await ADAPTERS[name]({ system, messages, maxTokens })
      if (text) return { text, provider: name }
      errors.push(`${name}: respuesta vacía`)
    } catch (err) {
      errors.push(err.message)
    }
  }
  throw new Error(`Todos los proveedores de IA fallaron → ${errors.join(' | ')}`)
}

/** Estado de proveedores para el panel/diagnóstico. */
export function providersStatus() {
  return Object.entries(config.ai.providers).map(([name, cfg]) => ({
    name,
    configured: Boolean(cfg.key),
    model: cfg.model,
  }))
}
