import { formatFieldValue } from '../../lib/roleFieldCodec.js'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Icon } from '../icons/Icons.jsx'
import { PLATFORM_ROLES } from '../../data/roleApplications.js'
import { isProfileComplete } from '../../lib/roleProfileCompleteness.js'
import './RoleStaffSearch.css'

const ROLE_META = Object.fromEntries(PLATFORM_ROLES.map(r => [r.id, r]))

// Si a alguien le falta un campo basico (tarifa/disponibilidad/etc) su ficha
// no sirve para comparar, asi que se oculta del buscador hasta completarlo
// -- ver isProfileComplete en lib/roleProfileCompleteness.js (mismo criterio
// que usa el aviso "completa tu perfil" en el panel de cada rol).

// Todo lo que realmente mandaron en la solicitud (tarifa, disponibilidad,
// idiomas, especialidad, anos de experiencia...) en vez de un top-3 fijo --
// asi el organizador puede comparar precio contra experiencia de verdad.
function profileStats(role, details) {
  const fields = [...(ROLE_META[role]?.profileFields || []), ...(ROLE_META[role]?.experienceFields || [])]
  const skip = new Set(['photo', 'descComplex'])
  return fields
    .filter(f => !skip.has(f.id) && details?.[f.id])
    .map(f => ({ id: f.id, label: f.label.replace(/\s*\(opcional\)/i, ''), value: formatFieldValue(f, details[f.id]) }))
}

function bioExcerpt(details) {
  const raw = String(details?.descComplex || '').trim()
  if (!raw) return ''
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw
}

function initials(nick = '') {
  return nick.trim().slice(0, 2).toUpperCase() || '??'
}

/**
 * Buscador reutilizable de staff (coach, analyst, caster, moderator, organizer...)
 * aprobado por rol. Usar en Equipos (coach/analyst), Torneos (caster/moderator)
 * y Marcas (organizer).
 */
export default function RoleStaffSearch({
  roles = [],
  onSelect,
  excludeIds = [],
  placeholder = 'Buscar por nick...',
  selectLabel = 'Seleccionar',
  emptyLabel = 'No se encontraron resultados para este rol.',
}) {
  const validRoles = roles.filter(r => ROLE_META[r])
  const [activeRole, setActiveRole] = useState(validRoles[0] || '')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const rolesKey = validRoles.join(',')
  useEffect(() => {
    setActiveRole(current => (validRoles.includes(current) ? current : validRoles[0] || ''))
  }, [rolesKey])

  useEffect(() => { setPage(1) }, [activeRole, query])

  useEffect(() => {
    if (!activeRole) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    setError('')
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ role: activeRole, page: String(page), limit: '12' })
        if (query.trim()) params.set('q', query.trim())
        const res = await api(`/profile/staff?${params.toString()}`)
        if (cancelled) return
        setResults(res.staff || [])
        setPages(res.pages || 1)
      } catch (err) {
        if (cancelled) return
        setError(err.message || 'No se pudo buscar staff')
        setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [activeRole, query, page])

  if (!validRoles.length) return null

  return (
    <div className="gg-staff-search">
      {validRoles.length > 1 && (
        <div className="gg-staff-search__roles">
          {validRoles.map(r => (
            <button
              key={r}
              type="button"
              className={`gg-staff-search__role-tab ${activeRole === r ? 'active' : ''}`}
              onClick={() => setActiveRole(r)}
            >
              {Icon[ROLE_META[r].icon]} {ROLE_META[r].label}
            </button>
          ))}
        </div>
      )}

      <div className="gg-staff-search__bar">
        <span className="gg-staff-search__icon">{Icon.search}</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
        />
        {query && (
          <button type="button" className="gg-staff-search__clear" onClick={() => setQuery('')}>
            {Icon.x}
          </button>
        )}
      </div>

      {error && <div className="gg-staff-search__error">{error}</div>}

      <div className="gg-staff-search__results">
        {loading && <div className="gg-staff-search__hint">Buscando...</div>}
        {!loading && !error && results.length === 0 && (
          <div className="gg-staff-search__hint">{emptyLabel}</div>
        )}
        {!loading && (() => {
          const visible = []
          let hiddenCount = 0
          for (const member of results) {
            const roleEntry = member.roles?.find(r => r.role === activeRole) || {}
            if (isProfileComplete(activeRole, roleEntry.details)) visible.push({ member, roleEntry })
            else hiddenCount += 1
          }
          return (
            <>
              {visible.map(({ member, roleEntry }) => {
                const stats = profileStats(activeRole, roleEntry.details)
                const bio = bioExcerpt(roleEntry.details)
                const already = excludeIds.map(String).includes(String(member.id))
                return (
                  <div className="gg-staff-card" key={member.id}>
                    {(roleEntry.details?.photo || member.avatar)
                      ? <img className="gg-staff-card__avatar" src={roleEntry.details?.photo || member.avatar} alt={member.nick} />
                      : <div className="gg-staff-card__avatar gg-staff-card__avatar--fallback">{initials(member.nick)}</div>}
                    <div className="gg-staff-card__body">
                      <div className="gg-staff-card__head">
                        <b>{member.nick}</b>
                        {member.team?.tag && (
                          <span className="gg-staff-card__team" style={{ color: member.team.color }}>{member.team.tag}</span>
                        )}
                      </div>
                      <div className="gg-staff-card__role">
                        {Icon[ROLE_META[activeRole].icon]} {ROLE_META[activeRole].label}
                        {roleEntry.code && <span className="gg-staff-card__code">{roleEntry.code}</span>}
                        {typeof member.acceptedTournamentsCount === 'number' && (
                          <span className="gg-staff-card__history">· {member.acceptedTournamentsCount} torneo{member.acceptedTournamentsCount === 1 ? '' : 's'} como staff</span>
                        )}
                      </div>
                      {stats.length > 0 && (
                        <div className="gg-staff-card__stats">
                          {stats.map(s => (
                            <div key={s.id} className="gg-staff-card__stat">
                              <span>{s.label}</span>
                              <b>{s.value}</b>
                            </div>
                          ))}
                        </div>
                      )}
                      {bio && <p className="gg-staff-card__bio">{bio}</p>}
                    </div>
                    <button
                      type="button"
                      className="gg-staff-card__select"
                      disabled={already}
                      onClick={() => onSelect?.(member, roleEntry)}
                    >
                      {already ? Icon.check : selectLabel}
                    </button>
                  </div>
                )
              })}
              {hiddenCount > 0 && (
                <div className="gg-staff-search__hint gg-staff-search__hint--muted">
                  {hiddenCount} perfil{hiddenCount === 1 ? '' : 'es'} oculto{hiddenCount === 1 ? '' : 's'} por tener el perfil profesional incompleto (falta tarifa, disponibilidad u otro dato clave).
                </div>
              )}
            </>
          )
        })()}
      </div>

      {pages > 1 && (
        <div className="gg-staff-search__pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{Icon.chevronRight}</button>
          <span>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{Icon.chevronRight}</button>
        </div>
      )}
    </div>
  )
}

