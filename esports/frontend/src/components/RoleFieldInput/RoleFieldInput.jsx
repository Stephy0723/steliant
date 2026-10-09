import { useMemo, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { GAMES_BY_CATEGORY } from '../../data/games.js'
import {
  CURRENCIES, LANGUAGES, NO_EXPERIENCE, RATE_MODES, RATE_UNITS, SCHEDULE_PRESETS, SOCIAL_PLATFORMS, TIMEZONES, WEEK_DAYS,
} from '../../data/roleFieldOptions.js'
import {
  decodeList, decodeRate, decodeSchedule, decodeSocial, encodeList, encodeRate, encodeSchedule, encodeSocial,
} from '../../lib/roleFieldCodec.js'
import { uploadsApi } from '../../lib/serverApi.js'
import './RoleFieldInput.css'

const MAX_GAMES = 6

function resolveMediaUrl(value) {
  if (!value) return ''
  const text = String(value)
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch { /* url invalida: se usa tal cual */ }
  return text
}

// ── Chips multi-seleccion (idiomas, tipos de evento, especialidades) ─────
function ChipMulti({ options, value, onChange }) {
  const selected = decodeList(value)
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
    onChange(encodeList(next))
  }
  return (
    <div className="rfi__chips">
      {options.map(opt => (
        <button type="button" key={opt} className={`rfi__chip${selected.includes(opt) ? ' is-on' : ''}`} aria-pressed={selected.includes(opt)} onClick={() => toggle(opt)}>
          {selected.includes(opt) && Icon.check}{opt}
        </button>
      ))}
    </div>
  )
}

// ── Juegos: categoria -> juegos, varios a la vez ─────────────────────────
function GamesPicker({ value, onChange }) {
  const selected = decodeList(value)
  const categories = useMemo(() => GAMES_BY_CATEGORY.filter(c => c.games.length), [])
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [filter, setFilter] = useState('')
  const games = useMemo(() => {
    const category = categories.find(c => c.id === categoryId)
    const list = category?.games || []
    const q = filter.trim().toLowerCase()
    return q ? list.filter(g => g.name.toLowerCase().includes(q)) : list
  }, [categories, categoryId, filter])

  const toggle = (name) => {
    if (selected.includes(name)) onChange(encodeList(selected.filter(s => s !== name)))
    else if (selected.length < MAX_GAMES) onChange(encodeList([...selected, name]))
  }

  return (
    <div className="rfi__games">
      {selected.length > 0 && (
        <div className="rfi__chips rfi__chips--selected">
          {selected.map(name => (
            <button type="button" key={name} className="rfi__chip is-on" onClick={() => toggle(name)} title="Quitar">
              {name} {Icon.x}
            </button>
          ))}
        </div>
      )}
      <div className="rfi__games-bar">
        <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setFilter('') }} aria-label="Categoría de juego">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar juego…" aria-label="Buscar juego" />
      </div>
      <div className="rfi__chips rfi__chips--scroll">
        {games.map(g => (
          <button
            type="button"
            key={g.id}
            className={`rfi__chip${selected.includes(g.name) ? ' is-on' : ''}`}
            aria-pressed={selected.includes(g.name)}
            disabled={!selected.includes(g.name) && selected.length >= MAX_GAMES}
            onClick={() => toggle(g.name)}
          >
            {selected.includes(g.name) && Icon.check}{g.name}
          </button>
        ))}
        {games.length === 0 && <span className="rfi__hint">No hay juegos que coincidan.</span>}
      </div>
      <span className="rfi__hint">{selected.length}/{MAX_GAMES} juegos seleccionados</span>
    </div>
  )
}

// ── Horario: franjas rapidas o calendario semanal especifico ─────────────
function SchedulePicker({ value, onChange }) {
  const state = useMemo(() => decodeSchedule(value), [value])
  const [showWeek, setShowWeek] = useState(() => Object.keys(state.days).length > 0)
  const set = (patch) => onChange(encodeSchedule({ ...state, ...patch }))

  const togglePreset = (preset) => {
    const has = state.presets.includes(preset.id)
    if (has) return set({ presets: state.presets.filter(p => p !== preset.id) })
    if (preset.exclusive) return set({ presets: [preset.id] })
    set({ presets: [...state.presets.filter(p => !SCHEDULE_PRESETS.find(x => x.id === p)?.exclusive), preset.id] })
  }
  const toggleDay = (dayId) => {
    const days = { ...state.days }
    if (days[dayId]) delete days[dayId]
    else days[dayId] = { from: '18:00', to: '23:00' }
    set({ days })
  }
  const setDayTime = (dayId, key, time) => set({ days: { ...state.days, [dayId]: { ...state.days[dayId], [key]: time } } })

  return (
    <div className="rfi__schedule">
      {state.legacy && <p className="rfi__legacy">Valor anterior: “{state.legacy}”. Elige una opción para reemplazarlo.</p>}
      <div className="rfi__chips">
        {SCHEDULE_PRESETS.map(p => (
          <button type="button" key={p.id} className={`rfi__chip${state.presets.includes(p.id) ? ' is-on' : ''}`} aria-pressed={state.presets.includes(p.id)} onClick={() => togglePreset(p)} title={p.hint}>
            {state.presets.includes(p.id) && Icon.check}{p.id} <small>{p.hint}</small>
          </button>
        ))}
      </div>
      <button type="button" className="rfi__link" onClick={() => setShowWeek(v => !v)} aria-expanded={showWeek}>
        {Icon.calendar} {showWeek ? 'Ocultar horario específico' : 'Elegir un horario específico por día'}
      </button>
      {showWeek && (
        <div className="rfi__week">
          {WEEK_DAYS.map(d => {
            const on = Boolean(state.days[d.id])
            return (
              <div key={d.id} className={`rfi__day${on ? ' is-on' : ''}`}>
                <label className="rfi__day-name">
                  <input type="checkbox" checked={on} onChange={() => toggleDay(d.id)} /> {d.label}
                </label>
                {on ? (
                  <span className="rfi__day-times">
                    <input type="time" value={state.days[d.id].from} onChange={e => setDayTime(d.id, 'from', e.target.value)} aria-label={`${d.label} desde`} />
                    <em>a</em>
                    <input type="time" value={state.days[d.id].to} onChange={e => setDayTime(d.id, 'to', e.target.value)} aria-label={`${d.label} hasta`} />
                  </span>
                ) : <span className="rfi__hint">No disponible</span>}
              </div>
            )
          })}
        </div>
      )}
      {(state.presets.length > 0 || Object.keys(state.days).length > 0) && (
        <label className="rfi__inline">
          <span>Zona horaria</span>
          <select value={state.tz} onChange={e => set({ tz: e.target.value })}>
            <option value="">Sin indicar</option>
            {TIMEZONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

// ── Tarifa: monto/rango + moneda + unidad, o negociable / gratis ─────────
function RatePicker({ value, onChange }) {
  // Borrador local: moneda/unidad elegidas antes de escribir el monto no se
  // pueden reconstruir desde el texto guardado (que aun esta vacio).
  const [state, setState] = useState(() => decodeRate(value))
  const set = (patch) => {
    const next = { ...state, ...patch, legacy: '' }
    setState(next)
    onChange(encodeRate(next))
  }
  const numeric = (v) => v.replace(/[^\d.,]/g, '')
  return (
    <div className="rfi__rate">
      {state.legacy && <p className="rfi__legacy">Valor anterior: “{state.legacy}”. Completa la tarifa para reemplazarlo.</p>}
      <div className="rfi__chips">
        {RATE_MODES.map(m => (
          <button type="button" key={m.id} className={`rfi__chip${state.mode === m.id && !state.legacy ? ' is-on' : ''}`} aria-pressed={state.mode === m.id} onClick={() => set({ mode: m.id, min: m.id === 'fixed' ? state.min : '', max: '' })}>
            {m.label}
          </button>
        ))}
      </div>
      {state.mode === 'fixed' && (
        <div className="rfi__rate-row">
          <input inputMode="decimal" value={state.min} onChange={e => set({ mode: 'fixed', min: numeric(e.target.value) })} placeholder="Desde" aria-label="Tarifa desde" />
          <em>–</em>
          <input inputMode="decimal" value={state.max} onChange={e => set({ mode: 'fixed', max: numeric(e.target.value) })} placeholder="Hasta (opcional)" aria-label="Tarifa hasta" />
          <select value={state.currency} onChange={e => set({ mode: 'fixed', currency: e.target.value })} aria-label="Moneda">
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <em>por</em>
          <select value={RATE_UNITS.includes(state.unit) ? state.unit : 'hora'} onChange={e => set({ mode: 'fixed', unit: e.target.value })} aria-label="Unidad">
            {RATE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Red social mas usada ─────────────────────────────────────────────────
function SocialPicker({ value, onChange, placeholder }) {
  const [state, setState] = useState(() => {
    const d = decodeSocial(value)
    return { platform: d.platform || 'Twitch', handle: d.handle }
  })
  const set = (patch) => {
    const next = { ...state, ...patch }
    setState(next)
    onChange(encodeSocial(next))
  }
  return (
    <div className="rfi__social">
      <select value={state.platform} onChange={e => set({ platform: e.target.value })} aria-label="Red social">
        {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input value={state.handle} maxLength={200} onChange={e => set({ handle: e.target.value })} placeholder={placeholder || 'https://… o @usuario'} />
    </div>
  )
}

// ── Foto profesional ─────────────────────────────────────────────────────
function ImagePicker({ value, onChange, user }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Elige una imagen (JPG, PNG o WebP).')
    if (file.size > 5 * 1024 * 1024) return setError('La imagen supera 5 MB.')
    setBusy(true)
    setError('')
    try {
      const up = await uploadsApi.upload(file)
      if (up?.url) onChange(up.url)
      else setError('No se pudo subir la imagen.')
    } catch (err) {
      setError(err?.message || 'No se pudo subir la imagen.')
    } finally { setBusy(false) }
  }
  return (
    <div className="rfi__image">
      <div className="rfi__image-preview">
        {value ? <img src={resolveMediaUrl(value)} alt="" /> : <span>{Icon.user}</span>}
      </div>
      <div className="rfi__image-actions">
        <label className="rfi__btn">
          {busy ? 'Subiendo…' : value ? 'Cambiar foto' : 'Subir foto'}
          <input type="file" accept="image/*" hidden onChange={pick} disabled={busy} />
        </label>
        {user?.avatar && value !== user.avatar && (
          <button type="button" className="rfi__btn" onClick={() => onChange(user.avatar)}>Usar la foto de mi cuenta</button>
        )}
        {value && <button type="button" className="rfi__btn rfi__btn--ghost" onClick={() => onChange('')}>Quitar</button>}
      </div>
      {error && <small className="rfi__error" role="alert">{error}</small>}
    </div>
  )
}

/**
 * Un campo de los formularios de rol segun su `type`:
 * text | textarea | select | multiselect | games | languages | schedule | rate | social | image.
 * `value` y `onChange` siempre son STRING (ver roleFieldCodec).
 */
export default function RoleFieldInput({ field, value = '', onChange, error = '', user = null }) {
  const label = field.label
  const common = { value: value || '', placeholder: field.placeholder }
  let control
  switch (field.type) {
    case 'textarea':
      control = <textarea rows={4} maxLength={500} {...common} onChange={e => onChange(e.target.value)} />
      break
    case 'select':
      control = (
        <select value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Selecciona…</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      break
    case 'multiselect':
      control = <ChipMulti options={field.options || []} value={value} onChange={onChange} />
      break
    case 'languages':
      control = <ChipMulti options={LANGUAGES} value={value} onChange={onChange} />
      break
    case 'games':
      control = <GamesPicker value={value} onChange={onChange} />
      break
    case 'schedule':
      control = <SchedulePicker value={value} onChange={onChange} />
      break
    case 'rate':
      control = <RatePicker value={value} onChange={onChange} />
      break
    case 'social':
      control = <SocialPicker value={value} onChange={onChange} placeholder={field.placeholder} />
      break
    case 'image':
      control = <ImagePicker value={value} onChange={onChange} user={user} />
      break
    default:
      control = <input type="text" maxLength={500} {...common} onChange={e => onChange(e.target.value)} />
  }
  return (
    <div className={`rfi${error ? ' has-error' : ''}${['textarea', 'games', 'schedule', 'rate', 'social', 'image', 'multiselect', 'languages'].includes(field.type) ? ' rfi--wide' : ''}`}>
      <span className="rfi__label" style={field.type === 'image' ? { color: '#ef4444' } : undefined}>{label}</span>
      {control}
      {field.help && <small className="rfi__hint">{field.help}</small>}
      {error && <small className="rfi__error" role="alert">{error}</small>}
    </div>
  )
}

/**
 * Seccion "Experiencia" con pregunta previa: ¿tienes experiencia? Si no, no
 * hay que inventarla -- se guarda yearsExp = "Sin experiencia" y se omite el
 * resto. `fields` son los experienceFields del rol; `values` el objeto de
 * campos del formulario.
 */
export function ExperienceSection({ fields, values, setValue, errors = {}, user = null }) {
  const noExp = String(values.yearsExp || '').trim() === NO_EXPERIENCE
  const anyFilled = fields.some(f => String(values[f.id] || '').trim())
  const [choice, setChoice] = useState(() => (noExp ? 'no' : anyFilled ? 'yes' : ''))

  const choose = (next) => {
    setChoice(next)
    if (next === 'no') {
      fields.forEach(f => setValue(f.id, f.id === 'yearsExp' ? NO_EXPERIENCE : ''))
    } else if (noExp) {
      setValue('yearsExp', '')
    }
  }

  return (
    <div className="rfi-exp">
      <div className="rfi__label">¿Tienes experiencia previa en este rol?</div>
      <div className="rfi__chips">
        <button type="button" className={`rfi__chip${choice === 'yes' ? ' is-on' : ''}`} aria-pressed={choice === 'yes'} onClick={() => choose('yes')}>Sí, tengo experiencia</button>
        <button type="button" className={`rfi__chip${choice === 'no' ? ' is-on' : ''}`} aria-pressed={choice === 'no'} onClick={() => choose('no')}>No, quiero empezar</button>
      </div>
      {errors.experienceChoice && <small className="rfi__error" role="alert">{errors.experienceChoice}</small>}
      {choice === 'no' && (
        <p className="rfi__note">Sin problema: no hace falta inventar experiencia. Tu perfil se publicará como “Sin experiencia” y podrás actualizarlo cuando la tengas.</p>
      )}
      {choice === 'yes' && (
        <div className="rfi-exp__fields">
          {fields.map(f => (
            <RoleFieldInput key={f.id} field={f} value={values[f.id]} onChange={v => setValue(f.id, v)} error={errors[f.id]} user={user} />
          ))}
        </div>
      )}
    </div>
  )
}

