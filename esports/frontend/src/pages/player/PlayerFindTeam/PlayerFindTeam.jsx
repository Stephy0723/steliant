import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleFieldInput from '../../../components/RoleFieldInput/RoleFieldInput.jsx'
import RoleProfileCard from '../../../components/RoleProfileCard/RoleProfileCard.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { decodeList, formatFieldValue } from '../../../lib/roleFieldCodec.js'
import { getProPlayerProfile } from '../../../lib/roleCard.js'
import { GAME_BY_ID } from '../../../data/games.js'
import { gameIdOf, plain, rankFits } from '../../../lib/gameMatch.js'
import '../PlayerProfile/PlayerProfile.css'
import './PlayerFindTeam.css'

const LEVELS = [
  { id: '', label: 'Cualquier nivel' },
  { id: 'casual', label: 'Casual' },
  { id: 'competitivo', label: 'Competitivo' },
  { id: 'pro', label: 'Pro' },
]
const STATUS_LABEL = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada' }

const teamMatchesFemale = (team) => plain(team.gender).includes('fem') || (team.recruitment?.vacancies || []).some(v => v.femaleOnly)
const teamLevels = (team) => [team.level, ...(team.recruitment?.vacancies || []).map(v => v.level)].map(plain).filter(Boolean)

function requestIsActive(request) { return request && (request.status === 'pending' || request.status === 'accepted') }

// BUSCAR EQUIPO: el jugador elige que busca (juegos, nivel, femenino...) y ve los
// equipos que encajan -- reclutando o no --, y se postula con su tarjeta de
// Jugador Pro. Abajo, "Mis postulaciones". Usa GET /teams, GET /teams/requests/mine
// y POST /teams/:id/requests.
export default function PlayerFindTeam() {
  const { user } = useAuth()
  const myId = String(user?._id || user?.id || '')
  const pro = getProPlayerProfile(user)
  const proEntries = useMemo(() => (Array.isArray(pro?.entries) ? pro.entries.filter(e => e?.gameId) : []), [pro])

  const [teams, setTeams] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => ({
    games: proEntries.map(e => GAME_BY_ID[e.gameId]?.name).filter(Boolean).join(', '),
    level: '',
    female: false,
    recruitingOnly: false,
    fitRank: true,
  }))
  const [applyTo, setApplyTo] = useState(null) // { team, vacancyId }
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const setFilter = (patch) => setFilters(prev => ({ ...prev, ...patch }))

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.allSettled([api('/teams?limit=100'), api('/teams/requests/mine')]).then(([t, r]) => {
      if (t.status === 'fulfilled') setTeams(Array.isArray(t.value?.teams) ? t.value.teams : [])
      else setError('No se pudieron cargar los equipos.')
      setRequests(r.status === 'fulfilled' && Array.isArray(r.value?.requests) ? r.value.requests : [])
    }).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  // Falta algo para poder postularse con la tarjeta.
  const missing = useMemo(() => {
    const out = []
    if (!proEntries.length) out.push('un juego')
    else {
      if (proEntries.some(e => !e.rank)) out.push('tu rango')
      if (proEntries.some(e => !e.role)) out.push('tu rol o línea')
    }
    if (!pro?.schedule) out.push('tu horario')
    const c = pro?.contact || {}
    if (!String(c.discord || '').trim() && !String(c.whatsapp || '').trim() && !c.social) out.push('un contacto')
    return out
  }, [pro, proEntries])
  const canApply = missing.length === 0

  const requestByTeam = useMemo(() => {
    const map = new Map()
    for (const r of requests) if (!map.has(r.teamId) || requestIsActive(r)) map.set(r.teamId, r)
    return map
  }, [requests])

  const myRankFor = useCallback((gameId) => proEntries.find(e => e.gameId === gameId)?.rank || '', [proEntries])

  const results = useMemo(() => {
    const wantedIds = new Set(decodeList(filters.games).map(gameIdOf).filter(Boolean))
    const level = filters.level
    const rows = []
    for (const team of teams) {
      const teamId = String(team._id || team.id)
      const leaderId = String(team.leader?._id || team.leader || '')
      const isMine = leaderId === myId || (team.members || []).some(m => String(m?._id || m) === myId)
      if (isMine) continue
      const gid = gameIdOf(team.game)
      if (wantedIds.size && !wantedIds.has(gid)) continue
      if (level && !teamLevels(team).some(l => l.includes(level))) continue
      if (filters.female && !teamMatchesFemale(team)) continue
      const recruiting = Boolean(team.recruitment?.open)
      if (filters.recruitingOnly && !recruiting) continue
      const vacancies = team.recruitment?.vacancies || []
      const myRank = myRankFor(gid)
      const fits = vacancies.length ? vacancies.map(v => rankFits(gid, myRank, v.rankMin, v.rankMax)) : []
      const anyFit = fits.length ? fits.some(f => f !== false) : true
      if (filters.fitRank && vacancies.length && !anyFit) continue
      rows.push({ team, teamId, gid, recruiting, vacancies, fits, anyFit })
    }
    rows.sort((a, b) => (b.recruiting - a.recruiting) || (Number(b.anyFit) - Number(a.anyFit)) || ((b.team.rankPts || 0) - (a.team.rankPts || 0)))
    return rows
  }, [teams, filters, myId, myRankFor])

  const send = async () => {
    if (!applyTo || sending) return
    setSending(true)
    try {
      await api(`/teams/${applyTo.team._id || applyTo.team.id}/requests`, {
        method: 'POST',
        body: { message: message.trim(), vacancyId: applyTo.vacancyId || '', withCard: true },
      })
      toast(`Te postulaste a ${applyTo.team.name} con tu tarjeta de Jugador Pro`, 'success')
      setApplyTo(null)
      setMessage('')
      load()
    } catch (err) {
      toast(err?.message || 'No se pudo enviar la postulación', 'error')
    } finally {
      setSending(false)
    }
  }

  const openApply = (team, vacancyId = '') => { setApplyTo({ team, vacancyId }); setMessage('') }

  return (
    <div className="plp-shell role-dashboard">
      {!canApply && (
        <div className="pft-gate" role="status">
          {Icon.alert}
          <p>Para postularte con tu tarjeta completa tu <b>perfil profesional de jugador</b> — te falta {missing.join(', ')}.</p>
          <Link className="pnl-btn pnl-btn--primary" to="/jugador/perfil">{Icon.edit} Completar perfil</Link>
        </div>
      )}

      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">{Icon.search} Buscar equipo</div>
        <p className="pnl-empty-hint">Elige qué buscas y verás los equipos que encajan, estén reclutando o no. Te postulas con tu tarjeta de Jugador Pro.</p>
        <div className="role-form-grid">
          <RoleFieldInput field={{ id: 'games', type: 'games', label: 'Juegos (por categoría)' }} value={filters.games} onChange={v => setFilter({ games: v })} />
          <label className="role-field">
            <span>Nivel del equipo</span>
            <select value={filters.level} onChange={e => setFilter({ level: e.target.value })}>
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <div className="pft-toggles">
            <label className={`pft-toggle${filters.female ? ' is-on' : ''}`}><input type="checkbox" checked={filters.female} onChange={e => setFilter({ female: e.target.checked })} /> Solo equipos femeninos</label>
            <label className={`pft-toggle${filters.recruitingOnly ? ' is-on' : ''}`}><input type="checkbox" checked={filters.recruitingOnly} onChange={e => setFilter({ recruitingOnly: e.target.checked })} /> Solo los que están reclutando</label>
            <label className={`pft-toggle${filters.fitRank ? ' is-on' : ''}`}><input type="checkbox" checked={filters.fitRank} onChange={e => setFilter({ fitRank: e.target.checked })} /> Solo donde mi rango encaja</label>
          </div>
        </div>
      </motion.div>

      <div className="pft-results-head">
        <h3>{loading ? 'Buscando…' : `${results.length} equipo${results.length === 1 ? '' : 's'}`}</h3>
      </div>
      {loading && <div className="pft-empty"><GGLoader label="Cargando equipos" size="sm" /></div>}
      {!loading && error && <div className="pft-empty pft-empty--error">{Icon.alert} {error}</div>}
      {!loading && !error && results.length === 0 && (
        <div className="pft-empty">{Icon.team} No hay equipos con esos filtros. Prueba quitando alguno.</div>
      )}

      <div className="pft-list">
        {results.map(({ team, teamId, gid, recruiting, vacancies, fits }) => {
          const req = requestByTeam.get(teamId)
          const full = (team.members || []).length >= (team.maxMembers || 10)
          const closed = team.acceptRequests === false
          const active = requestIsActive(req)
          const disabled = !canApply || full || closed || active
          const label = active ? (req.status === 'accepted' ? 'Aceptada' : 'Postulación enviada')
            : full ? 'Equipo lleno' : closed ? 'No acepta solicitudes' : req?.status === 'rejected' ? 'Volver a postularme' : 'Postularme con mi tarjeta'
          return (
            <motion.article key={teamId} className="pnl-card pft-team" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="pft-team__head">
                <span className="pft-team__logo" style={{ borderColor: team.color || undefined }}>
                  {team.logo ? <img src={team.logo} alt="" loading="lazy" /> : (team.tag || team.name || '?').slice(0, 3)}
                </span>
                <div className="pft-team__info">
                  <b><Link to={`/equipos/${teamId}`}>{team.name}</Link> <small>[{team.tag}]</small></b>
                  <span>{GAME_BY_ID[gid]?.name || team.game || 'Juego sin definir'}{team.region ? ` · ${team.region}` : ''}{team.level ? ` · ${team.level}` : ''} · {(team.members || []).length}/{team.maxMembers || 10} jugadores</span>
                </div>
                <div className="pft-team__badges">
                  <span className={`pnl-tag ${recruiting ? 'pnl-tag--ok' : ''}`}>{recruiting ? 'Reclutando' : 'No está reclutando'}</span>
                  {teamMatchesFemale(team) && <span className="pnl-tag pnl-tag--accent">Femenino</span>}
                  {req && <span className={`pnl-tag ${req.status === 'accepted' ? 'pnl-tag--ok' : req.status === 'rejected' ? 'pnl-tag--live' : 'pnl-tag--warn'}`}>{STATUS_LABEL[req.status] || req.status}</span>}
                </div>
              </div>

              {vacancies.length > 0 && (
                <div className="pft-vacancies">
                  {vacancies.map((v, i) => (
                    <div className="pft-vac" key={v._id || i}>
                      <div className="pft-vac__main">
                        <div className="pft-vac__chips">
                          {(v.roles || []).map(r => <span className="pnl-tag" key={r}>{r}</span>)}
                          {(v.rankMin || v.rankMax) && <span className="pnl-tag">{v.rankMin || '…'} → {v.rankMax || '…'}</span>}
                          {v.level && <span className="pnl-tag">{v.level}</span>}
                          {v.femaleOnly && <span className="pnl-tag pnl-tag--accent">Solo jugadoras</span>}
                          {fits[i] === true && <span className="pnl-tag pnl-tag--ok">Tu rango encaja</span>}
                          {fits[i] === false && <span className="pnl-tag pnl-tag--live">Fuera de tu rango</span>}
                        </div>
                        {(v.schedule || v.description) && (
                          <small>{[v.schedule && formatFieldValue({ type: 'schedule' }, v.schedule), v.description].filter(Boolean).join(' · ')}</small>
                        )}
                      </div>
                      <button type="button" className="pnl-btn" disabled={disabled} onClick={() => openApply(team, String(v._id || ''))}>Postularme a esta vacante</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pft-team__actions">
                <Link className="pnl-btn" to={`/equipos/${teamId}`}>{Icon.eye} Ver equipo</Link>
                <button type="button" className="pnl-btn pnl-btn--primary" disabled={disabled} onClick={() => openApply(team)} title={!canApply ? 'Completa tu perfil profesional de jugador' : undefined}>
                  {Icon.send} {label}
                </button>
              </div>
            </motion.article>
          )
        })}
      </div>

      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">{Icon.mail} Mis postulaciones</div>
        {requests.length === 0 ? (
          <p className="pnl-empty-hint">Aún no te has postulado a ningún equipo.</p>
        ) : (
          <div className="pft-mine">
            {requests.map(r => (
              <div className="pft-mine__row" key={r.requestId}>
                <span className="pft-team__logo pft-team__logo--sm" style={{ borderColor: r.color || undefined }}>
                  {r.logo ? <img src={r.logo} alt="" loading="lazy" /> : (r.tag || r.name || '?').slice(0, 3)}
                </span>
                <div className="pft-team__info">
                  <b><Link to={`/equipos/${r.teamId}`}>{r.name}</Link> <small>[{r.tag}]</small></b>
                  <span>{r.game || '—'} · {new Date(r.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <span className={`pnl-tag ${r.status === 'accepted' ? 'pnl-tag--ok' : r.status === 'rejected' ? 'pnl-tag--live' : 'pnl-tag--warn'}`}>{STATUS_LABEL[r.status] || r.status}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {applyTo && (
        <div className="pft-ov" onClick={() => !sending && setApplyTo(null)}>
          <div className="pft-modal pnl-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <button type="button" className="pft-modal__close" onClick={() => setApplyTo(null)} aria-label="Cerrar">{Icon.x}</button>
            <div className="pnl-card__title">{Icon.send} Postularme a {applyTo.team.name}</div>
            <div className="pft-modal__body">
              <RoleProfileCard role="proplayer" user={user} width={230} />
              <div className="pft-modal__form">
                <p className="pnl-empty-hint">El líder del equipo recibirá tu tarjeta de Jugador Pro y tu contacto. Puedes añadir un mensaje.</p>
                <label className="role-field role-field--wide">
                  <span>Mensaje (opcional)</span>
                  <textarea rows={5} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Cuéntales por qué encajas con el equipo…" />
                </label>
                <div className="role-actions">
                  <button type="button" className="pnl-btn" onClick={() => setApplyTo(null)} disabled={sending}>Cancelar</button>
                  <button type="button" className="pnl-btn pnl-btn--primary" onClick={send} disabled={sending}>{Icon.send} {sending ? 'Enviando…' : 'Enviar postulación'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

