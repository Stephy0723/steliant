import fs from 'node:fs'
import path from 'node:path'
import { EXTRACTED_PATH, GENERATED_PATH, isLikelySpanish, quoteObject, readGeneratedTranslations, ROOT } from './i18n-common.mjs'
import { translateLegacy } from '../src/i18n/legacyTranslations.js'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const provider = process.env.I18N_PROVIDER || (process.env.DEEPL_API_KEY ? 'deepl' : 'gemini')
const batchSize = Number(process.env.I18N_BATCH_SIZE || 40)

if (!fs.existsSync(EXTRACTED_PATH)) {
  console.error(`Missing ${path.relative(process.cwd(), EXTRACTED_PATH)}. Run npm run i18n:extract first.`)
  process.exit(1)
}

const extracted = JSON.parse(fs.readFileSync(EXTRACTED_PATH, 'utf8'))
const generated = readGeneratedTranslations()
const candidates = (extracted.texts || []).map(item => item.text || item).filter(Boolean)
const missing = candidates.filter(text => {
  if (generated[text]) return false
  // Tambien las que el diccionario viejo deja a medias ("Guardar Identity").
  const out = translateLegacy(text, 'en')
  return out === text || isLikelySpanish(out)
})

console.log(`Existing generated translations: ${Object.keys(generated).length}`)
console.log(`Missing translations: ${missing.length}`)

if (dryRun || missing.length === 0) {
  if (missing.length) console.log(missing.slice(0, 120).map(text => `- ${text}`).join('\n'))
  process.exit(0)
}

function parseJsonObject(text) {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try { return JSON.parse(clean) } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Provider did not return JSON')
    return JSON.parse(match[0])
  }
}

// gemini-2.5-flash da 404 con claves nuevas; el free tier devuelve 503 a
// menudo, por eso hay lista de respaldo + reintentos.
const GEMINI_MODELS = [
  process.env.I18N_GEMINI_MODEL || 'gemini-flash-lite-latest',
  ...(process.env.I18N_GEMINI_FALLBACK_MODELS || 'gemini-flash-latest').split(',').map(m => m.trim()).filter(Boolean),
]
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function translateWithGemini(texts) {
  let lastError
  for (let attempt = 0; attempt < 6; attempt++) {
    const model = GEMINI_MODELS[attempt % GEMINI_MODELS.length]
    try {
      return await translateWithGeminiModel(texts, model)
    } catch (err) {
      lastError = err
      console.warn(`  ${model} fallo (${err.message.slice(0, 120)}), reintentando...`)
      await sleep(2000 * (attempt + 1))
    }
  }
  throw lastError
}

async function translateWithGeminiModel(texts, model) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is required, or set I18N_PROVIDER=deepl with DEEPL_API_KEY.')
  const prompt = [
    'Translate this JSON array of GlitchGang UI strings from Spanish to English.',
    'Return only one JSON object where each original string is a key and each English translation is the value.',
    'Keep brand names, game names, esports acronyms, route-like strings, and product terms unchanged when appropriate.',
    'Use concise UI wording. Keep emojis, punctuation, leading/trailing symbols and casing style (ALL CAPS stays ALL CAPS). Do not explain.',
    JSON.stringify(texts),
  ].join('\n\n')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 500)}`)
  const data = await res.json()
  return parseJsonObject(data.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '')
}

async function translateWithDeepl(texts) {
  const key = process.env.DEEPL_API_KEY
  if (!key) throw new Error('DEEPL_API_KEY is required, or set I18N_PROVIDER=gemini with GEMINI_API_KEY.')
  const apiUrl = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate'
  const params = new URLSearchParams()
  params.set('target_lang', 'EN-US')
  params.set('source_lang', 'ES')
  params.set('preserve_formatting', '1')
  texts.forEach(text => params.append('text', text))
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      authorization: `DeepL-Auth-Key ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 500)}`)
  const data = await res.json()
  return Object.fromEntries(texts.map((text, index) => [text, data.translations?.[index]?.text || text]))
}

async function translateBatch(texts) {
  if (provider === 'deepl') return translateWithDeepl(texts)
  if (provider === 'gemini') return translateWithGemini(texts)
  throw new Error(`Unsupported I18N_PROVIDER: ${provider}`)
}

function writeGenerated(entries) {
  fs.writeFileSync(GENERATED_PATH, [
    '// Auto-generated by `npm run i18n:generate`.',
    '// Do not edit by hand; use reviewTranslationOverrides.js for manual wording.',
    quoteObject(entries, 'GENERATED_TRANSLATIONS'),
  ].join('\n'))
}

const next = { ...generated }
let failedBatches = 0
for (let i = 0; i < missing.length; i += batchSize) {
  const batch = missing.slice(i, i + batchSize)
  console.log(`Translating ${i + 1}-${i + batch.length} of ${missing.length} with ${provider}...`)
  let translations
  try {
    translations = await translateBatch(batch)
  } catch (err) {
    failedBatches++
    console.error(`  Lote saltado: ${err.message.slice(0, 200)}`)
    continue
  }
  for (const text of batch) {
    const value = String(translations[text] || '').trim()
    if (value && value !== text) next[text] = value
  }
  // Guardar tras cada lote: si se corta, la siguiente corrida sigue desde aqui.
  writeGenerated(next)
}

writeGenerated(next)
if (failedBatches) console.warn(`${failedBatches} lote(s) fallaron; vuelve a correr npm run i18n:generate para completarlos.`)

console.log(`Wrote ${Object.keys(next).length} generated translations -> ${path.relative(ROOT, GENERATED_PATH)}`)


