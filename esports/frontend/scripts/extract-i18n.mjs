import fs from 'node:fs'
import path from 'node:path'
import { EXTRACTED_PATH, normalizeText, shouldKeepText, walkSourceFiles } from './i18n-common.mjs'

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
}

function readQuotedStrings(source) {
  const texts = []
  const clean = stripComments(source)
  let i = 0
  while (i < clean.length) {
    const quote = clean[i]
    if (quote !== '"' && quote !== "'" && quote !== '`') { i++; continue }
    let j = i + 1
    let value = ''
    let dynamicTemplate = false
    while (j < clean.length) {
      const ch = clean[j]
      if (ch === '\\') {
        value += clean[j + 1] || ''
        j += 2
        continue
      }
      if (quote === '`' && ch === '$' && clean[j + 1] === '{') dynamicTemplate = true
      if (ch === quote) break
      value += ch
      j++
    }
    if (!dynamicTemplate) texts.push(value)
    i = Math.max(j + 1, i + 1)
  }
  return texts
}

function readJsxText(source) {
  const texts = []
  // Texto JSX entre etiquetas y/o expresiones: ">Hola<", "> Hola {n}" y
  // "{Icon.x} Guardar</button>". El caso "}...<" descarta restos de template
  // strings / objetos (comillas de código, backticks, "${").
  for (const match of source.matchAll(/>([^<>{}]+)(?=[<{])/g)) texts.push(match[1])
  for (const match of source.matchAll(/\}([^<>{}]+)(?=<\/?[A-Za-z])/g)) {
    const text = match[1]
    if (/[`$]|['"]\s*[,:\]]|^\s*['"),\]]/.test(text)) continue
    texts.push(text)
  }
  return texts
}

function extractFromFile(file) {
  const source = fs.readFileSync(file, 'utf8')
  return [...readQuotedStrings(source), ...readJsxText(source)]
    .map(normalizeText)
    .filter(shouldKeepText)
}

const byText = new Map()
for (const file of walkSourceFiles()) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
  for (const text of extractFromFile(file)) {
    if (!byText.has(text)) byText.set(text, { text, files: [] })
    const item = byText.get(text)
    if (!item.files.includes(rel)) item.files.push(rel)
  }
}

const texts = [...byText.values()].sort((a, b) => a.text.localeCompare(b.text, 'es'))
fs.writeFileSync(EXTRACTED_PATH, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: texts.length,
  texts,
}, null, 2)}\n`)

console.log(`Extracted ${texts.length} candidate i18n texts -> ${path.relative(process.cwd(), EXTRACTED_PATH)}`)


