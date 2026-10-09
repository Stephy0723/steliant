import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import './NickSuggest.css'

// Mismo criterio que las paginas de equipo: /uploads relativo, URL absoluta tal cual.
function imageUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch { /* no es URL absoluta */ }
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) return value
  return `/${value}`
}

/**
 * Campo de nick con sugerencias para invitar a un equipo: primero los amigos
 * del lider y despues cuentas con nick parecido (GET /teams/:id/invite-suggestions).
 * Cada sugerencia muestra foto, nick, codigo y si puede entrar con ese rol
 * (o por que no), para no invitar a la persona equivocada con un nick casi igual.
 *
 * Props: teamId, role, value, onChange(text), onPick(suggestion | null),
 * placeholder, disabled. onPick(null) cuando el texto ya no es la sugerencia
 * elegida (se volvio a escribir).
 */
export default function NickSuggest({ teamId, role = 'player', value, onChange, onPick, placeholder = 'Nick', disabled = false }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const reqRef = useRef(0)
  const boxRef = useRef(null)

  // Busca con una pausa corta despues de escribir (no una peticion por tecla).
  useEffect(() => {
    const q = String(value || '').trim().replace(/^@/, '')
    if (!teamId || q.length < 2) { setItems([]); setLoading(false); return undefined }
    const id = ++reqRef.current
    setLoading(true)
    const timer = setTimeout(() => {
      api(`/teams/${encodeURIComponent(teamId)}/invite-suggestions?q=${encodeURIComponent(q)}&role=${encodeURIComponent(role)}`)
        .then(data => { if (id === reqRef.current) { setItems(data.suggestions || []); setActive(-1) } })
        .catch(() => { if (id === reqRef.current) setItems([]) })
        .finally(() => { if (id === reqRef.current) setLoading(false) })
    }, 220)
    return () => clearTimeout(timer)
  }, [teamId, role, value])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event) => { if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (item) => {
    onChange?.(item.nick)
    onPick?.(item)
    setOpen(false)
  }

  const onKeyDown = (event) => {
    if (!open || !items.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => (i + 1) % items.length) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => (i <= 0 ? items.length - 1 : i - 1)) }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); pick(items[active]) }
    else if (event.key === 'Escape') setOpen(false)
  }

  const q = String(value || '').trim()
  const showList = open && q.length >= 2

  return (
    <div className="gg-nicksug" ref={boxRef}>
      <input
        value={value}
        onChange={event => { onChange?.(event.target.value); onPick?.(null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        data-no-translate
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />
      {showList && (
        <ul className="gg-nicksug__list" id={listId} role="listbox">
          {loading && !items.length && <li className="gg-nicksug__empty">Buscando…</li>}
          {!loading && !items.length && <li className="gg-nicksug__empty">No hay cuentas con ese nick. Revisa cómo está escrito.</li>}
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`gg-nicksug__item ${index === active ? 'is-active' : ''} ${item.canInvite ? '' : 'is-blocked'}`}
              onMouseDown={event => { event.preventDefault(); pick(item) }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="gg-nicksug__avatar">
                {item.avatar ? <img src={imageUrl(item.avatar)} alt="" /> : String(item.nick || '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="gg-nicksug__who">
                <b data-no-translate>{item.nick}</b>
                <small data-no-translate>{[item.playerCode, item.university].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="gg-nicksug__tags">
                {item.friend && <em className="gg-nicksug__tag gg-nicksug__tag--friend">{Icon.users} Amigo</em>}
                {item.canInvite
                  ? <em className="gg-nicksug__tag gg-nicksug__tag--ok">{Icon.check} Puede entrar</em>
                  : <em className="gg-nicksug__tag gg-nicksug__tag--no" title={item.reason}>{item.reason || 'No puede entrar'}</em>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

