// Codifica/decodifica los campos estructurados de los formularios de rol a un
// TEXTO legible. El backend guarda cada campo como string (max 500), y varias
// pantallas (buscador de staff, revision del admin, paneles) lo muestran tal
// cual, asi que el formato es legible a proposito -- y a la vez parseable para
// volver a llenar el editor. Un valor "viejo" de texto libre que no encaje en
// el formato se conserva como `legacy` y no se pierde hasta que la persona lo
// reemplace.
import { CURRENCIES, LANGUAGES, NO_EXPERIENCE, SCHEDULE_PRESETS, SOCIAL_PLATFORMS, TIMEZONES, WEEK_DAYS } from '../data/roleFieldOptions.js'

const SEP = ' | '
const TIME_RE = /(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/

// ── Listas (juegos, idiomas, multi-select) ───────────────────────────────
export function decodeList(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean)
}
export function encodeList(items) {
  return (items || []).filter(Boolean).join(', ')
}

// ── Horario ──────────────────────────────────────────────────────────────
// "Mañana, Tarde | Lun 18:00-23:00; Sáb 10:00-14:00 | GMT-4"
export function decodeSchedule(value) {
  const out = { presets: [], days: {}, tz: '', legacy: '' }
  const raw = String(value || '').trim()
  if (!raw) return out
  const presetIds = SCHEDULE_PRESETS.map(p => p.id)
  const dayIds = WEEK_DAYS.map(d => d.id)
  const tzIds = TIMEZONES.map(t => t.id)
  let understood = false
  for (const part of raw.split(SEP).map(p => p.trim()).filter(Boolean)) {
    if (tzIds.includes(part)) { out.tz = part; understood = true; continue }
    const items = part.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    if (items.length && items.every(i => presetIds.includes(i))) { out.presets = items; understood = true; continue }
    if (items.length && items.every(i => dayIds.includes(i.split(' ')[0]) && TIME_RE.test(i))) {
      for (const item of items) {
        const [day, range] = item.split(' ')
        const [, from, to] = range.match(TIME_RE)
        out.days[day] = { from, to }
      }
      understood = true
      continue
    }
    understood = false
    break
  }
  if (!understood) return { presets: [], days: {}, tz: '', legacy: raw }
  return out
}
export function encodeSchedule({ presets = [], days = {}, tz = '' }) {
  const dayText = WEEK_DAYS
    .filter(d => days[d.id]?.from && days[d.id]?.to)
    .map(d => `${d.id} ${days[d.id].from}-${days[d.id].to}`)
    .join('; ')
  return [presets.join(', '), dayText, (presets.length || dayText) ? tz : ''].filter(Boolean).join(SEP)
}

// ── Tarifa ───────────────────────────────────────────────────────────────
// "25 USD / hora", "20-40 USD / evento", "Negociable", "Gratis"
export function decodeRate(value) {
  const raw = String(value || '').trim()
  const out = { mode: 'fixed', min: '', max: '', currency: 'USD', unit: 'hora', legacy: '' }
  if (!raw) return out
  if (/^negociable$/i.test(raw)) return { ...out, mode: 'negotiable' }
  if (/^gratis/i.test(raw)) return { ...out, mode: 'free' }
  const m = raw.match(/^(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*([A-Z]{3})\s*\/\s*(.+)$/)
  if (m && CURRENCIES.some(c => c.code === m[3])) {
    return { ...out, min: m[1], max: m[2] || '', currency: m[3], unit: m[4].trim() }
  }
  return { ...out, legacy: raw }
}
export function encodeRate({ mode = 'fixed', min = '', max = '', currency = 'USD', unit = 'hora' }) {
  if (mode === 'negotiable') return 'Negociable'
  if (mode === 'free') return 'Gratis (para ganar experiencia)'
  const lo = String(min).trim()
  if (!lo) return ''
  const hi = String(max).trim()
  return `${lo}${hi ? `-${hi}` : ''} ${currency} / ${unit}`
}

// ── Red social ───────────────────────────────────────────────────────────
// "Twitch · https://twitch.tv/usuario"
export function decodeSocial(value) {
  const raw = String(value || '').trim()
  if (!raw) return { platform: '', handle: '' }
  const [head, ...rest] = raw.split(' · ')
  if (rest.length && SOCIAL_PLATFORMS.includes(head)) return { platform: head, handle: rest.join(' · ') }
  return { platform: 'Otra', handle: raw }
}
export function encodeSocial({ platform = '', handle = '' }) {
  const h = String(handle).trim()
  if (!h) return ''
  return `${platform || 'Otra'} · ${h}`
}

// ── Experiencia ──────────────────────────────────────────────────────────
export const hasNoExperience = (details) => String(details?.yearsExp || '').trim() === NO_EXPERIENCE

// ── Formato para mostrar ─────────────────────────────────────────────────
// El texto ya es legible; solo se suaviza el separador del horario.
export function formatFieldValue(field, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (field?.type === 'schedule') return raw.split(SEP).join(' · ')
  return raw
}

export const LANGUAGE_OPTIONS = LANGUAGES

