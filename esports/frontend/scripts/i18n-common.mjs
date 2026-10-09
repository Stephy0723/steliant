import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const SRC_DIR = path.join(ROOT, 'src')
export const I18N_DIR = path.join(SRC_DIR, 'i18n')
export const EXTRACTED_PATH = path.join(I18N_DIR, 'extractedTexts.json')
export const GENERATED_PATH = path.join(I18N_DIR, 'generatedTranslations.js')

const SKIP_DIRS = new Set(['node_modules', 'dist', 'public', '.git'])
const SKIP_FILES = new Set([
  path.join('src', 'i18n', 'dictionary.js'),
  path.join('src', 'i18n', 'legacyTranslations.js'),
  path.join('src', 'i18n', 'generatedTranslations.js'),
  path.join('src', 'i18n', 'reviewTranslationOverrides.js'),
])
const SOURCE_EXTS = new Set(['.js', '.jsx', '.mjs'])

const SPANISH_WORDS = /\b(abrir|activo|activa|actual|ajustes|amigos|anadir|aplicar|ayuda|buscar|cambiar|cerrar|codigo|comunidad|crear|cuenta|datos|descargar|editar|eliminar|enviar|equipo|equipos|estado|fecha|guardar|historial|idioma|inicio|jugador|jugadores|juego|juegos|marca|marcas|mensaje|mensajes|nombre|noticia|noticias|notificacion|notificaciones|pago|panel|partida|perfil|premio|privacidad|publicar|ranking|reporte|resumen|rol|solicitud|solicitudes|telefono|torneo|torneos|usuario|ver|volver)\b/i
const SPANISH_CHARS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/

export function walkSourceFiles(dir = SRC_DIR, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSourceFiles(path.join(dir, entry.name), out)
      continue
    }
    if (!entry.isFile() || !SOURCE_EXTS.has(path.extname(entry.name))) continue
    const file = path.join(dir, entry.name)
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    if (SKIP_FILES.has(rel)) continue
    out.push(file)
  }
  return out
}

export function normalizeText(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\r\n]+/g, ' ')
    .trim()
}

export function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function isLikelySpanish(value) {
  const text = normalizeText(value)
  const plain = stripAccents(text)
  return SPANISH_CHARS.test(text) || SPANISH_WORDS.test(plain)
}

export function shouldKeepText(value) {
  const text = normalizeText(value)
  if (text.length < 2 || text.length > 260) return false
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text)) return false
  if (/^--/.test(text)) return false
  if (/^[,.:;)\]}]/.test(text)) return false
  if (/^![a-z0-9_-]+$/i.test(text)) return false
  if (/^(true|false|null|undefined|GET|POST|PUT|PATCH|DELETE)$/i.test(text)) return false
  if (/^(https?:|data:|mailto:|tel:|#|\.{1,2}\/)/i.test(text)) return false
  if (/^\/[A-Za-z0-9_./?=&:-]+$/.test(text)) return false
  if (/[{}<>]/.test(text)) return false
  if (/\b(if|else|return|const|let|var|function|className|style|onClick)\b/.test(text)) return false
  if (/=>|\?\s*['"`]|\$\{|&&|\|\|/.test(text)) return false
  if (text.includes('\\n') || text.includes('n[ ]')) return false
  if (/^[a-z0-9_-]+(\s+[a-z0-9_-]+)*$/i.test(text) && !isLikelySpanish(text) && !/[.!?]$/.test(text)) return false
  if (/^[A-Z0-9_ -]{2,24}$/.test(text) && !isLikelySpanish(text)) return false
  if (text.includes('{') || text.includes('=>') || text.includes('function ')) return false
  return isLikelySpanish(text)
}

export function quoteObject(obj, exportName) {
  const lines = [`export const ${exportName} = {`]
  for (const [key, value] of Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
  }
  lines.push('}', '')
  return lines.join('\n')
}

export function readGeneratedTranslations() {
  if (!fs.existsSync(GENERATED_PATH)) return {}
  const raw = fs.readFileSync(GENERATED_PATH, 'utf8')
  const entries = {}
  for (const match of raw.matchAll(/^\s*("(?:(?:\\.)|[^"\\])*")\s*:\s*("(?:(?:\\.)|[^"\\])*")\s*,?\s*$/gm)) {
    try { entries[JSON.parse(match[1])] = JSON.parse(match[2]) } catch { /* skip malformed line */ }
  }
  return entries
}

