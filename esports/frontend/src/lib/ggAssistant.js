// Puente entre GG (asistente flotante) y las paginas.
//  - Las paginas publican aqui su contexto (p. ej. el formulario de torneo)
//    para que GG "lea" donde esta el usuario.
//  - GG pide aplicar valores al formulario con un evento; la pagina decide.

const snapshot = {}

export function setGGContext(key, value) {
  if (value == null) delete snapshot[key]
  else snapshot[key] = value
}

export function getGGContext() {
  return { ...snapshot }
}

export const APPLY_TOURNAMENT_FIELDS = 'gg:apply-tournament-fields'

export function applyTournamentFields(fields) {
  window.dispatchEvent(new CustomEvent(APPLY_TOURNAMENT_FIELDS, { detail: fields }))
}

export const TOURNAMENT_SCHEDULE_KEYS = ['registrationStart', 'registrationEnd', 'checkinDeadline', 'date', 'endDate']

// ── Campos de texto que GG puede escribir ─────────────────────────────────
// Dos fuentes:
//  1. Paginas que registran sus campos (useGGFields): sirve aunque el campo no
//     este en pantalla (p. ej. un paso del asistente de torneo).
//  2. Cualquier <textarea> visible de la pagina (paneles, admin...): GG lo
//     detecta solo, con su etiqueta, y al aplicar escribe como si tecleara el
//     usuario (setter nativo + evento input, asi React lo ve).
const fieldSets = new Map()

// set = { label, fields: [{ key, label, value, maxLength }], apply(key, text), scope? }
// scope = selector CSS de la zona que ya cubre el registro (no se re-detecta).
export function registerGGFields(id, set) {
  fieldSets.set(id, set)
  return () => { if (fieldSets.get(id) === set) fieldSets.delete(id) }
}

const clipText = (value, n) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

function labelFor(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (label?.textContent.trim()) return label.textContent.trim()
  }
  const wrapped = el.closest('label')
  if (wrapped?.textContent.trim()) return wrapped.textContent.trim()
  const field = el.closest('.otm-field, .tc-field, .field, [class*="field"], [class*="Field"]')
  const near = field?.querySelector('label, legend, h3, h4, span, b')
  return el.getAttribute('aria-label') || near?.textContent.trim() || el.placeholder || el.name || 'Texto'
}

/** Lista para mandar a GG: [{ key, label, current, maxLength }] (sin funciones). */
export function ggWritableFields() {
  const out = []
  for (const [id, set] of fieldSets) {
    for (const f of set.fields || []) {
      out.push({ key: `${id}:${f.key}`, label: set.label ? `${set.label} · ${f.label}` : f.label, current: clipText(f.value, 400), maxLength: f.maxLength || 0 })
    }
  }
  let n = 0
  document.querySelectorAll('[data-gg-field]').forEach(el => el.removeAttribute('data-gg-field'))
  for (const el of document.querySelectorAll('textarea')) {
    if (el.closest('.ggc') || el.disabled || el.readOnly || !el.getClientRects().length) continue
    // Lo que ya registro la pagina (con su `scope`) no se duplica.
    if ([...fieldSets.values()].some(set => set.scope && el.closest(set.scope))) continue
    const key = `dom:${++n}`
    el.setAttribute('data-gg-field', key)
    out.push({ key, label: clipText(labelFor(el), 60), current: clipText(el.value, 400), maxLength: el.maxLength > 0 ? el.maxLength : 0 })
    if (n >= 8) break
  }
  return out
}

/** Escribe `text` en el campo `key`. Devuelve false si el campo ya no existe. */
export function applyGGField(key, text) {
  const [id, fieldKey] = String(key).split(/:(.+)/)
  if (id === 'dom') {
    const el = document.querySelector(`[data-gg-field="${CSS.escape(key)}"]`)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(el, el.maxLength > 0 ? text.slice(0, el.maxLength) : text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return true
  }
  const set = fieldSets.get(id)
  if (!set?.apply) return false
  set.apply(fieldKey, text)
  return true
}

export function hasGGField(key) {
  const [id] = String(key).split(':')
  return id === 'dom' ? Boolean(document.querySelector(`[data-gg-field="${CSS.escape(key)}"]`)) : fieldSets.has(id)
}

