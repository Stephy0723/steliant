import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { tournamentsApi } from '../../lib/serverApi.js'
import { normalizeTournament } from '../../lib/tournamentAdapter.js'
import { missingProfileFields } from '../../lib/roleProfileCompleteness.js'
import { STAFF_ROLE_BY_PLATFORM } from '../../../../shared/tournamentSetup.mjs'
import './StaffApply.css'

// Ruta del perfil profesional por rol (donde se completa lo que respalda la
// postulacion). Roles sin pagina propia caen al panel del rol.
const PROFILE_PATH = {
  caster: '/caster/perfil',
  analyst: '/analista/perfil',
  moderator: '/moderador',
  coach: '/coach',
  creator: '/creador',
}

function fmtDate(value) {
  if (!value) return 'Sin fecha'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Sin fecha'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Postularse al staff de un torneo (antes solo existia el camino inverso: el
// organizador busca y agrega desde RoleStaffSearch). Se embebe junto a
// StaffInvitations en cada panel de rol. Ver BACKEND-PENDIENTE.md
// #staff-autopostulacion.
export default function StaffApply({ platformRole, compact = false }) {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [appliedIds, setAppliedIds] = useState(() => new Set())
  const [mine, setMine] = useState(null)
  // Plegado por defecto: con muchos torneos abiertos esta lista ocupaba toda la
  // pantalla y tapaba el resumen y los reportes del panel. Se recuerda la eleccion.
  const storageKey = `gg-staff-apply-open:${platformRole}`
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })
  const toggleOpen = () => setOpen(prev => {
    const next = !prev
    try { localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* almacenamiento no disponible */ }
    return next
  })

  const staffRoleLabel = STAFF_ROLE_BY_PLATFORM[platformRole] || 'Staff'
  // Postularse es presentar tu perfil profesional ante el organizador: sin
  // los datos basicos del rol, la postulacion no tendria nada que mostrar.
  const missing = useMemo(
    () => missingProfileFields(platformRole, user?.roleProfiles?.[platformRole]?.details),
    [platformRole, user],
  )
  const profileReady = missing.length === 0
  const profilePath = PROFILE_PATH[platformRole] || '/editar-perfil'

  const loadMine = useCallback(() => {
    tournamentsApi.staffMine('requested')
      .then(data => setMine(Array.isArray(data?.tournaments) ? data.tournaments : []))
      .catch(() => setMine([]))
  }, [])
  useEffect(loadMine, [loadMine])

  const search = useCallback(() => {
    setSearching(true)
    setError('')
    tournamentsApi.search({ q })
      .then(data => setResults((data?.tournaments || []).filter(t => !['finished', 'cancelled'].includes(t.status))))
      .catch(() => setError('No se pudo buscar torneos.'))
      .finally(() => setSearching(false))
  }, [q])
  useEffect(() => { search() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (tournament) => {
    setBusyId(tournament._id)
    setError('')
    try {
      await tournamentsApi.applyForStaff(tournament.publicId || tournament._id, platformRole)
      setAppliedIds(prev => new Set(prev).add(tournament._id))
      loadMine()
    } catch (err) {
      setError(err?.message || 'No se pudo enviar la postulación.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className={`gg-staff-apply pnl-card${compact ? ' gg-staff-apply--compact' : ''}`}>
      <button
        type="button"
        className="gg-staff-apply__toggle pnl-card__title"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {Icon.search} Postularme como {staffRoleLabel}
        {!open && results.length > 0 && <span className="pnl-tag pnl-tag--accent">{results.length} torneos</span>}
        {!open && mine && mine.length > 0 && <span className="pnl-tag pnl-tag--warn">{mine.length} pendientes</span>}
        <span className="gg-staff-apply__chev" aria-hidden="true">{Icon.chevronRight}</span>
        <span className="gg-staff-apply__toggle-label">{open ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      {open && <>
      <p className="gg-staff-apply__lead">
        Busca un torneo público y postúlate con tu perfil profesional. El organizador revisa y aprueba desde Colaboradores.
      </p>

      {!profileReady && (
        <div className="gg-staff-apply__gate" role="status">
          {Icon.alert}
          <p>
            Completa tu perfil profesional antes de postularte — te falta <b>{missing.join(', ')}</b>.
          </p>
          <Link className="pnl-btn pnl-btn--primary" to={profilePath}>{Icon.edit} Completar perfil</Link>
        </div>
      )}

      {mine && mine.length > 0 && (
        <ul className="gg-staff-apply__mine">
          {mine.map(t => (
            <li key={t._id}>
              <span className="pnl-tag pnl-tag--warn">{Icon.clock} Pendiente</span>
              <Link to={`/torneos/${t.publicId || t._id}`}>{t.title}</Link>
              <span className="gg-staff-apply__role">{t.staffRole}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="gg-staff-apply__search" onSubmit={e => { e.preventDefault(); search() }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar torneo por nombre..."
        />
        <button type="submit" className="pnl-btn" disabled={searching}>{Icon.search} Buscar</button>
      </form>

      {error && <p className="gg-staff-apply__error" role="alert">{error}</p>}

      {searching && <p className="gg-staff-apply__empty">Buscando...</p>}
      {!searching && results.length === 0 && <p className="gg-staff-apply__empty">No hay torneos públicos que coincidan.</p>}

      <ul className="gg-staff-apply__results">
        {results.map(raw => {
          const t = normalizeTournament(raw)
          const already = appliedIds.has(raw._id) || (mine || []).some(m => m._id === raw._id)
          const organizer = raw.organizer || {}
          return (
            <li key={raw._id} className="gg-staff-apply__card">
              <div
                className="gg-staff-apply__cover"
                style={t.banner ? { backgroundImage: `url("${t.banner}")` } : undefined}
              >
                {t.logo && <img className="gg-staff-apply__logo" src={t.logo} alt="" loading="lazy" />}
              </div>
              <div className="gg-staff-apply__body">
                <b className="gg-staff-apply__title">
                  <Link to={`/torneos/${raw.publicId || raw._id}`}>{t.title}</Link>
                </b>
                <div className="gg-staff-apply__meta">
                  <span className="pnl-tag">{t.game || 'Varios'}</span>
                  <span className="pnl-tag">{Icon.team} {t.registered}/{t.capacity || '—'} equipos</span>
                  <span className="pnl-tag">{Icon.calendar} {fmtDate(t.dateIso)}</span>
                </div>
                <div className="gg-staff-apply__creator">
                  {organizer.avatar
                    ? <img src={organizer.avatar} alt="" loading="lazy" />
                    : <span className="gg-staff-apply__creator-mono">{(t.creator || 'O').slice(0, 1).toUpperCase()}</span>}
                  <span>Creado por <b>{t.creator}</b></span>
                </div>
              </div>
              <button
                type="button"
                className="pnl-btn pnl-btn--primary gg-staff-apply__btn"
                disabled={already || busyId === raw._id || !profileReady}
                title={!profileReady ? 'Completa tu perfil profesional para postularte' : undefined}
                onClick={() => apply(raw)}
              >
                {already ? <>{Icon.check} Postulado</> : <>{Icon.plus} Postularme</>}
              </button>
            </li>
          )
        })}
      </ul>
      </>}
    </section>
  )
}

