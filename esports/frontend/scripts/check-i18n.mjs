// Valida las traducciones: npm run i18n:check
// - cuantos textos extraidos quedan en español en modo EN
// - que el modo ES no toque textos en español
// - traducciones generadas sospechosas (vacias, iguales, emojis perdidos)
// - tiempo de translateLegacy sobre todos los textos (lo que cuesta el pase del DOM)
import fs from 'node:fs'
import { EXTRACTED_PATH, isLikelySpanish } from './i18n-common.mjs'
import { translateLegacy } from '../src/i18n/legacyTranslations.js'
import { GENERATED_TRANSLATIONS } from '../src/i18n/generatedTranslations.js'

if (!fs.existsSync(EXTRACTED_PATH)) {
  console.error('Falta extractedTexts.json: corre npm run i18n:extract primero.')
  process.exit(1)
}

const texts = JSON.parse(fs.readFileSync(EXTRACTED_PATH, 'utf8')).texts.map(item => item.text || item)
const EMOJI = /\p{Extended_Pictographic}/gu

const untranslated = texts.filter(text => translateLegacy(text, 'en') === text)
const partial = texts.filter(text => { const out = translateLegacy(text, 'en'); return out !== text && isLikelySpanish(out) })
const esChanged = texts.filter(text => translateLegacy(text, 'es') !== text)

const suspicious = []
for (const [from, to] of Object.entries(GENERATED_TRANSLATIONS)) {
  if (!String(to).trim()) suspicious.push([from, to, 'vacia'])
  else if ((from.match(EMOJI) || []).length !== (String(to).match(EMOJI) || []).length) suspicious.push([from, to, 'emojis distintos'])
}

const rounds = 5
const start = performance.now()
for (let r = 0; r < rounds; r++) for (const text of texts) translateLegacy(text, 'en')
const perText = (performance.now() - start) / (rounds * texts.length)

const pct = n => `${((n / texts.length) * 100).toFixed(1)}%`
console.log(`Textos extraidos:          ${texts.length}`)
console.log(`Traducciones generadas:    ${Object.keys(GENERATED_TRANSLATIONS).length}`)
console.log(`Sin traducir en modo EN:   ${untranslated.length} (${pct(untranslated.length)})`)
console.log(`A medias (Spanglish):      ${partial.length}`)
console.log(`Cambiados en modo ES:      ${esChanged.length}`)
console.log(`Generadas sospechosas:     ${suspicious.length}`)
console.log(`Costo por texto (EN):      ${(perText * 1000).toFixed(1)} µs`)

if (process.argv.includes('--verbose')) {
  if (untranslated.length) console.log('\n-- Sin traducir --\n' + untranslated.slice(0, 80).map(t => `  ${t}`).join('\n'))
  if (partial.length) console.log('\n-- A medias --\n' + partial.slice(0, 40).map(t => `  ${t} -> ${translateLegacy(t, 'en')}`).join('\n'))
  if (esChanged.length) console.log('\n-- Modo ES los cambia --\n' + esChanged.slice(0, 40).map(t => `  ${t} -> ${translateLegacy(t, 'es')}`).join('\n'))
  if (suspicious.length) console.log('\n-- Sospechosas --\n' + suspicious.slice(0, 40).map(([f, t, why]) => `  [${why}] ${f} -> ${t}`).join('\n'))
}

