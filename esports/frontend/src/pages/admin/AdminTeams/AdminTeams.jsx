import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGTeamCard, { teamTierIds } from '../../../components/GGTeamCard/GGTeamCard.jsx'
import { api } from '../../../lib/api.js'
import { exportTeamsPdf } from '../../../lib/teamExport.js'
import { toast } from '../../../lib/toast.js'
import { GAMES } from '../../../data/games.js'
import './AdminTeams.css'

const GAME_MAP = GAMES.reduce((m, g) => { m[g.id] = g.name; m[g.name] = g.name; return m }, {})
const getGameName = (game) => GAME_MAP[game] || (game === 'mlbb' ? 'Mobile Legends' : game === 'val' ? 'Valorant' : game)
const adminTeamCard = (team, index) => {
  const roster = Array.isArray(team?.roster) ? team.roster : []
  const total = (team?.wins || 0) + (team?.losses || 0)
  const winrate = total ? Math.round((team.wins / total) * 100) : 0
  // Fotos reales del roster (o el avatar por defecto si la cuenta no subio una).
  const members = roster.map(player => player.avatar || '/demos/steliant-esports/avatar-default.svg')

  return {
    name: team?.name || 'Equipo',
    country: team?.country || '',
    gender: team?.gender || '',
    crest: team?.logo || '',
    initials: String(team?.tag || team?.name || 'GG').slice(0, 2).toUpperCase(),
    code: team?.publicCode || team?.tag || '',
    longCode: team?.internalCode || '',
    shortCode: String(team?.tag || team?.name || 'GG').slice(0, 3).toUpperCase(),
    game: getGameName(team?.game),
    region: team?.region || 'Global',
    bio: team?.slogan && team.slogan !== '—' ? `"${team.slogan}"` : `${team?.wins || 0}W - ${team?.losses || 0}L / ${winrate}% WR`,
    tags: [
      { label: team?.status || 'Activo', on: team?.status === 'Activo' },
      team?.partnerBadge?.active ? (team.partnerBadge.label || 'GlitchGang Partner') : '',
      team?.category && team.category !== '—' ? team.category : '',
      team?.level && team.level !== '—' ? team.level : '',
      team?.sponsor && team.sponsor !== '—' ? team.sponsor : '',
      team?.university?.isUniversityTeam ? team.university.universityTag : '',
    ].filter(Boolean),
    members,
    capacity: Math.max(Number(team?.playerCount || roster.length || 5), 5),
    roster: roster.slice(0, 5).map(player => ({
      nick: player.nick || player.name || 'Jugador',
      role: player.role || 'Jugador',
      avatar: player.avatar || '',
    })),
  }
}

const money = (n) => `$${Number(n || 0).toLocaleString()}`
const statusText = (status) => status === 'Activo' ? 'Activo' : 'Eliminado'

const PER_PAGE = 8

export default function AdminTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [q, setQ] = useState('')
  const [game, setGame] = useState('Todos')
  const [status, setStatus] = useState('Todos')
  const [sel, setSel] = useState(null)
  const [viewMode, setViewMode] = useState('gallery')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let alive = true
    api('/admin/teams')
      .then(res => { if (alive) setTeams(Array.isArray(res?.teams) ? res.teams : []) })
      .catch(() => { if (alive) setLoadError('No se pudieron cargar los equipos desde el servidor.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    return teams.filter(tm => {
      const matchQ = !q || [tm.name, tm.tag, tm.sponsor, tm.community, tm.players, tm.region, tm.category, tm.level, tm.slogan].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()))
      const matchGame = game === 'Todos' || tm.game === game
      const matchStatus = status === 'Todos' || tm.status === status
      return matchQ && matchGame && matchStatus
    })
  }, [teams, q, game, status])

  const stats = useMemo(() => {
    return {
      total: teams.length,
      mlbb: teams.filter(t => t.game === 'mlbb').length,
      val: teams.filter(t => t.game === 'val').length,
      active: teams.filter(t => t.status === 'Activo').length,
      partnered: teams.filter(t => t.partnerBadge?.active).length,
    }
  }, [teams])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const resetPage = (setter) => (value) => { setter(value); setPage(1) }

  const togglePartnerBadge = async (team) => {
    const nextActive = !team.partnerBadge?.active
    const partnerBadge = {
      active: nextActive,
      label: team.partnerBadge?.label || team.sponsor || 'GlitchGang Partner',
      status: nextActive ? 'verified' : 'revoked',
      reason: nextActive
        ? 'Verificado por admin GlitchGang'
        : 'Insignia retirada por conducta, reportes validos o incumplimiento de reglas',
    }
    const optimistic = { ...team, partnerBadge }
    setTeams(prev => prev.map(row => row.id === team.id ? optimistic : row))
    setSel(current => current?.id === team.id ? optimistic : current)

    try {
      const data = await api(`/admin/teams/${encodeURIComponent(team.id)}`, { method: 'PATCH', body: { partnerBadge } })
      if (data?.team) {
        setTeams(prev => prev.map(row => row.id === team.id ? data.team : row))
        setSel(current => current?.id === team.id ? data.team : current)
      }
      toast(nextActive ? 'Insignia verificada.' : 'Insignia retirada.', 'success')
    } catch {
      setTeams(prev => prev.map(row => row.id === team.id ? team : row))
      setSel(current => current?.id === team.id ? team : current)
      toast('No se pudo actualizar la insignia.', 'error')
    }
  }

  const deleteTeamAdmin = async (team) => {
    if (!window.confirm(`¿Eliminar permanentemente el equipo "${team.name}"? Esta accion no se puede deshacer.`)) return

    try {
      await api(`/admin/teams/${encodeURIComponent(team.id)}`, { method: 'DELETE' })
      setTeams(prev => prev.filter(row => row.id !== team.id))
      setSel(null)
      toast(`Equipo ${team.name} eliminado.`, 'success')
    } catch {
      toast('No se pudo eliminar el equipo.', 'error')
    }
  }

  const saveTeamEdit = async (team, patch) => {
    const optimistic = { ...team, ...patch }
    setTeams(prev => prev.map(row => row.id === team.id ? optimistic : row))
    setSel(current => current?.id === team.id ? optimistic : current)

    try {
      const data = await api(`/admin/teams/${encodeURIComponent(team.id)}`, { method: 'PATCH', body: patch })
      if (data?.team) {
        setTeams(prev => prev.map(row => row.id === team.id ? data.team : row))
        setSel(current => current?.id === team.id ? data.team : current)
      }
      toast('Equipo actualizado.', 'success')
    } catch {
      setTeams(prev => prev.map(row => row.id === team.id ? team : row))
      setSel(current => current?.id === team.id ? team : current)
      toast('No se pudo actualizar el equipo.', 'error')
    }
  }

  return (
    <div className="gg-admin-page at-tournaments-page">
      <div className="gg-admin-page__header">
        <div>
          <h2>Equipos</h2>
          <p>
            Censo de equipos inscritos · ficha completa por equipo, export PDF o CSV ·{' '}
            <span className="gg-teams__src backend">{loading ? 'cargando…' : loadError || `${teams.length} equipos`}</span>
          </p>
        </div>
      </div>

      <div className="gg-teams__stats">
        {[
          { icon: 'team', label: 'Total Equipos', value: stats.total, accent: true },
          { icon: 'gamepad', label: 'Mobile Legends', value: stats.mlbb },
          { icon: 'bolt', label: 'Valorant', value: stats.val },
          { icon: 'check', label: 'Equipos Activos', value: stats.active },
          { icon: 'award', label: 'Con Insignia', value: stats.partnered },
        ].map(item => (
          <div key={item.label} className={`gg-teams__stat${item.accent ? ' accent' : ''}`}>
            <span className="gg-teams__stat-icon">{Icon[item.icon]}</span>
            <div>
              <b>{item.value}</b>
              <small>{item.label}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="gg-teams__controls">
        <div className="gg-teams__filters">
          <select value={game} onChange={event => resetPage(setGame)(event.target.value)}>
            <option value="Todos">Todos los juegos</option>
            <option value="mlbb">Mobile Legends</option>
            <option value="val">Valorant</option>
          </select>

          <select value={status} onChange={event => resetPage(setStatus)(event.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="Activo">Activos</option>
            <option value="Eliminado">Eliminados</option>
          </select>

          <div className="gg-admin-search">
            <span className="gg-admin-search__icon">{Icon.search}</span>
            <input
              value={q}
              onChange={event => resetPage(setQ)(event.target.value)}
              placeholder="Buscar equipo, tag, patrocinador, comunidad o integrante..."
            />
            {q && <button className="gg-admin-search__clear" onClick={() => resetPage(setQ)('')}>{Icon.x}</button>}
          </div>

          <div className="gg-teams__view-toggle">
            <button
              className={`gg-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Vista tabla"
            >
              {Icon.list}
            </button>
            <button
              className={`gg-view-btn ${viewMode === 'gallery' ? 'active' : ''}`}
              onClick={() => setViewMode('gallery')}
              title="Vista galería"
            >
              {Icon.layoutGrid}
            </button>
          </div>
        </div>
      </div>



      <div className="gg-admin-card" style={{ padding: 0 }}>
        {viewMode === 'table' ? (
          <div className="gg-datatable-wrap">
            <table className="gg-datatable">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Identificadores</th>
                  <th>Integrantes (Click copia ID)</th>
                  <th>Patrocinador</th>
                  <th>Comunidad</th>
                  <th>Juego</th>
                  <th>Récord</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((tm, index) => {
                  const roster = tm.roster || []
                  return (
                    <motion.tr
                      key={tm.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.025 }}
                      className="gg-census__row"
                      onClick={() => setSel(tm)}
                    >
                      <td>
                        <div className="gg-census__player">
                          <div
                            className="gg-team-table__logo"
                            style={{
                              background: `linear-gradient(135deg, ${tm.color || '#333'}, var(--bg-card))`,
                              border: `1.5px solid ${tm.color || 'var(--line)'}`
                            }}
                          >
                            {tm.tag || String(tm.name).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <b>{tm.name}</b>
                            <small>{[tm.region, tm.country].filter(Boolean).join(' · ')}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="gg-census__ids">
                          <code className="gg-census__id" title="Tag de equipo">{tm.tag}</code>
                          <code className="gg-census__id gg-census__id--ext" title="ID público">{tm.publicCode || '—'}</code>
                          <code className="gg-census__id gg-census__id--ext" title="ID interno">{tm.internalCode || '—'}</code>
                          {tm.teamInviteCode && tm.teamInviteCode !== '—' && (
                            <code className="gg-census__id gg-census__id--ext" style={{ color: 'var(--accent)', borderColor: 'rgba(var(--accent-rgb), 0.3)', background: 'rgba(var(--accent-rgb), 0.08)' }} title="Código de invitación">
                              INV: {tm.teamInviteCode}
                            </code>
                          )}
                        </div>
                      </td>
                      <td className="gg-team-table__members" onClick={event => event.stopPropagation()}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {roster.map(p => {
                            const isCap = p.nick === (tm.captainProfile?.nick || tm.captain)
                            return (
                              <span
                                key={p.nick}
                                className="gg-team-table__badge community"
                                style={{ fontSize: '10.5px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                                onClick={() => {
                                  if (p.id) {
                                    navigator.clipboard?.writeText(p.id)
                                    toast(`ID de ${p.nick} copiado`, 'success')
                                  } else {
                                    toast(`Jugador ${p.nick}`, 'info')
                                  }
                                }}
                                title={p.id ? `ID: ${p.id} (Click para copiar)` : p.nick}
                              >
                                {p.nick} {isCap && '👑'}
                              </span>
                            )
                          })}
                          {roster.length === 0 && <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        {tm.sponsor && tm.sponsor !== '—' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className="gg-team-table__badge sponsor" style={{ width: 'fit-content' }}>{tm.sponsor}</span>
                            {tm.sponsorId && <code className="gg-census__id gg-census__id--ext" style={{ fontSize: '9px', padding: '1px 4px' }} title="ID de patrocinador">{tm.sponsorId}</code>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {tm.community && tm.community !== '—' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className="gg-team-table__badge community" style={{ width: 'fit-content' }}>{tm.community}</span>
                            {tm.communityId && <code className="gg-census__id gg-census__id--ext" style={{ fontSize: '9px', padding: '1px 4px' }} title="ID de comunidad">{tm.communityId}</code>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="gg-census__game">{getGameName(tm.game)}</span>
                      </td>
                      <td>
                        <b>{tm.wins}-{tm.losses}</b>
                      </td>
                      <td>
                        <span className={`gg-teams__src ${tm.status === 'Activo' ? 'backend' : 'mock'}`} style={{ color: tm.status === 'Activo' ? 'var(--accent)' : 'var(--text-dim)' }}>
                          {tm.status || 'Activo'}
                        </span>
                      </td>
                      <td onClick={event => event.stopPropagation()}>
                        <div className="gg-census__actions">
                          <button className="gg-census__act" title="Ver ficha" onClick={() => setSel(tm)}>
                            {Icon.eye}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}

                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="gg-datatable__empty">
                      Sin equipos con ese criterio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="gg-teams__gallery">
            {pageItems.map((tm, index) => (
              <motion.div
                key={tm.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <GGTeamCard
                  team={adminTeamCard(tm, index)}
                  tiers={teamTierIds(tm)}
                  index={index}
                  hideJoin
                  viewLabel="Ver ficha"
                  onView={() => setSel(tm)}
                  actions={[
                    {
                      key: 'copy-public',
                      label: 'ID publico',
                      onClick: () => {
                        if (tm.publicCode) {
                          navigator.clipboard?.writeText(tm.publicCode)
                          toast('ID publico copiado', 'success')
                        }
                      },
                    },
                    {
                      key: 'copy-internal',
                      label: 'ID interno',
                      onClick: () => {
                        if (tm.internalCode) {
                          navigator.clipboard?.writeText(tm.internalCode)
                          toast('ID interno copiado', 'success')
                        }
                      },
                    },
                    {
                      key: 'view',
                      label: 'Ver ficha',
                      primary: true,
                      onClick: () => setSel(tm),
                    },
                  ]}
                />
              </motion.div>
            ))}
            {pageItems.length === 0 && (
              <div className="gg-census__gallery-empty">
                Sin equipos con ese criterio.
              </div>
            )}
          </div>
        )}

        {pages > 1 && (
          <div className="gg-census__pager">
            <button disabled={page === 1} onClick={() => setPage(current => current - 1)}>
              {Icon.chevronRight}
            </button>
            <span>
              Página {page} de {pages} · {filtered.length} resultados
            </span>
            <button disabled={page === pages} onClick={() => setPage(current => current + 1)}>
              {Icon.chevronRight}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {sel && (
          <TeamDetail
            team={sel}
            onClose={() => setSel(null)}
            onDelete={() => deleteTeamAdmin(sel)}
            onToggleStatus={() => saveTeamEdit(sel, { status: sel.status === 'Eliminado' ? 'Activo' : 'Eliminado' })}
            onSaveEdit={patch => saveTeamEdit(sel, patch)}
            onTogglePartnerBadge={() => togglePartnerBadge(sel)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function CopyId({ value, label }) {
  const copy = () => {
    navigator.clipboard?.writeText(value)
    toast(`${label} copiado`, 'success')
  }
  return (
    <code className="gg-pd__id" onClick={copy} title="Copiar">
      {value}
    </code>
  )
}

function TeamDetail({ team, onClose, onDelete, onToggleStatus, onSaveEdit, onTogglePartnerBadge }) {
  const w = team.wins || 0
  const l = team.losses || 0
  const wr = w + l ? Math.round((w / (w + l)) * 100) : 0
  const roster = team.roster || []
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const startEditing = () => {
    setEditForm({
      name: team.name || '',
      tag: team.tag || '',
      region: team.region || '',
      country: team.country || '',
      slogan: team.slogan || '',
      category: team.category || '',
      level: team.level || '',
      logo: team.logo || '',
    })
    setEditing(true)
  }

  const handleLogoFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditForm(f => ({ ...f, logo: reader.result }))
    reader.readAsDataURL(file)
  }

  const submitEdit = (e) => {
    e.preventDefault()
    onSaveEdit?.(editForm)
    setEditing(false)
  }

  // Agrupamiento por roles en rosterSlots (titulares / suplentes)
  const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const slotsList = Object.entries(slots).filter(([, val]) => val)

  return (
    <motion.div
      className="gg-pd-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="gg-pd"
        onClick={event => event.stopPropagation()}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <button className="gg-pd__close" onClick={onClose}>
          {Icon.x}
        </button>

        {!editing && (
          <button className="gg-pd__btn" style={{ marginBottom: '12px' }} onClick={startEditing}>
            {Icon.edit || 'Editar'} Editar equipo
          </button>
        )}

        {editing ? (
          <form onSubmit={submitEdit} className="gg-pd__section" style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
            <label>Logo del equipo
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                {editForm.logo ? (
                  <img src={editForm.logo} alt="logo" style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--line)' }} />
                ) : (
                  <div style={{ width: '56px', height: '56px', borderRadius: '12px', border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>Sin logo</div>
                )}
                <input type="file" accept="image/*" onChange={e => handleLogoFile(e.target.files?.[0])} />
              </div>
            </label>
            <label>Nombre
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>Tag
              <input value={editForm.tag} onChange={e => setEditForm(f => ({ ...f, tag: e.target.value }))} required />
            </label>
            <label>Region
              <input value={editForm.region} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))} />
            </label>
            <label>Pais
              <input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
            </label>
            <label>Categoria
              <input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
            </label>
            <label>Nivel
              <input value={editForm.level} onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))} />
            </label>
            <label>Eslogan
              <input value={editForm.slogan} onChange={e => setEditForm(f => ({ ...f, slogan: e.target.value }))} />
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="gg-pd__btn ok">Guardar cambios</button>
              <button type="button" className="gg-pd__btn" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </form>
        ) : (
          <>
            <div className="gg-pd__head">
              <div
                className="gg-team-table__logo"
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '18px',
                  fontSize: '24px',
                  background: `linear-gradient(135deg, ${team.color || '#333'}, var(--bg-card))`,
                  border: `2.5px solid ${team.color || 'var(--line)'}`
                }}
              >
                {team.tag || String(team.name).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3>
                  {team.name} <code className="gg-pd__id">{team.tag}</code>
                </h3>
                <p>
                  {getGameName(team.game)} · {[team.region, team.country].filter(Boolean).join(' · ')}
                </p>
                <div className="gg-pd__badges">
                  <span className={`gg-teams__src ${team.status === 'Activo' ? 'backend' : 'mock'}`} style={{ color: team.status === 'Activo' ? 'var(--accent)' : 'var(--text-dim)', fontSize: '11px', padding: '3px 9px', borderRadius: '20px' }}>
                    {team.status || 'Activo'}
                  </span>
                  <span className="gg-pd__badge">{team.category && team.category !== '—' ? team.category : 'Amateur'}</span>
                  <span className="gg-pd__badge">{team.level && team.level !== '—' ? team.level : 'Intermedio'}</span>
                  {team.partnerBadge?.active && <span className="gg-pd__badge gg-pd__badge--partner">{team.partnerBadge.label || 'GlitchGang Partner'}</span>}
                </div>
              </div>
            </div>

            <p className="gg-team-card__slogan" style={{ padding: 0, fontSize: '13px', marginBottom: '20px' }}>
              "{team.slogan || 'Por la gloria de Steliant Esports'}"
            </p>
          </>
        )}

        <div className="gg-pd__stats">
          <div>
            <b>{w}</b>
            <span>Victorias</span>
          </div>
          <div>
            <b>{l}</b>
            <span>Derrotas</span>
          </div>
          <div>
            <b>{wr}%</b>
            <span>Win rate</span>
          </div>
          <div>
            <b>{team.rankPts || 0}</b>
            <span>Rank Pts</span>
          </div>
        </div>

        {team.university?.isUniversityTeam && (
          <div className="gg-pd__uni-block">
            <span className="gg-pd__uni-icon">🎓</span>
            <div className="gg-pd__uni-info">
              <b>{team.university.universityName} ({team.university.universityTag})</b>
              <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '11px', marginTop: '2px' }}>Región: {team.university.region || '—'}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', background: 'transparent', padding: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID Universidad</span>
                <CopyId value={team.university.universityId || '—'} label="ID de universidad" />
              </div>
            </div>
          </div>
        )}

        <div className="gg-pd__section">
          <h4>{Icon.fileText} Identificadores</h4>
          <div className="gg-pd__rows">
            <div>
              <span>ID de equipo público</span>
              <CopyId value={team.publicCode || team.uid || '—'} label="ID público" />
            </div>
            <div>
              <span>ID de equipo interno</span>
              <CopyId value={team.internalCode || team.internalId || '—'} label="ID interno" />
            </div>
            {team.teamInviteCode && team.teamInviteCode !== '—' && (
              <div>
                <span>Código de invitación</span>
                <CopyId value={team.teamInviteCode} label="Código de invitación" />
              </div>
            )}
            {team.captainId && team.captainId !== '—' && (
              <div>
                <span>ID de Capitán (Líder)</span>
                <CopyId value={team.captainId} label="ID de Capitán" />
              </div>
            )}
            <div>
              <span>Juego</span>
              <b>{getGameName(team.game)}</b>
            </div>
            <div>
              <span>Región</span>
              <b>{team.region}</b>
            </div>
          </div>
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.users} Integrantes ({roster.length})</h4>
          {slotsList.length > 0 ? (
            <div>
              {slotsList.map(([key, player]) => (
                <div key={key} className="gg-pd__roster-slot">
                  <div className="gg-pd__roster-slot-header">
                    <span className="gg-pd__roster-slot-name">
                      {player.nick} {player.nick === team.captain && '👑'}
                    </span>
                    <span className={`gg-pd__roster-slot-role ${key.startsWith('titular') ? 'titular' : ''}`}>
                      {key.startsWith('titular') ? 'Titular' : 'Suplente'} - {player.role || 'Player'}
                    </span>
                  </div>
                  <div className="gg-pd__roster-slot-details">
                    <div>Nombre: <b>{player.fullName}</b></div>
                    <div>Cédula: <b>{player.cedula || '—'}</b></div>
                    <div>Game ID: <code style={{ fontSize: '10px' }}>{player.gameId || '—'}</code></div>
                    <div>Discord: <span style={{ fontSize: '10px' }}>{player.discordName || '—'}</span></div>
                    {player.id && (
                      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--line)', marginTop: '4px', paddingTop: '4px' }}>
                        <span>ID Jugador</span>
                        <CopyId value={player.id} label="ID de jugador" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : roster.length > 0 ? (
            <div className="gg-pd__rows">
              {roster.map(p => {
                const isCap = p.nick === team.captain
                return (
                  <div key={p.nick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '12px 14px', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', padding: 0 }}>
                      <span>
                        {p.nick} {isCap && '👑 (Capitán)'}
                      </span>
                      <b>{p.role || 'Jugador'}</b>
                    </div>
                    {p.id && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px dashed var(--line)', marginTop: '4px', paddingTop: '6px', background: 'transparent', padding: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID Jugador</span>
                        <CopyId value={p.id} label="ID de jugador" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="gg-pd__empty">Sin integrantes registrados.</p>
          )}
        </div>


        <div className="gg-pd__section">
          <h4>{Icon.award} Staff Técnico</h4>
          <div className="gg-pd__rows">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '12px 14px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', padding: 0 }}>
                <span>Coach</span>
                <b>{team.coach || team.staff?.coach || '—'}</b>
              </div>
              {(team.coachId || team.staff?.coachId) && (team.coachId !== '—' && team.staff?.coachId !== '—') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px dashed var(--line)', marginTop: '4px', paddingTop: '6px', background: 'transparent', padding: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID Coach</span>
                  <CopyId value={team.coachId || team.staff?.coachId} label="ID Coach" />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '12px 14px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', padding: 0 }}>
                <span>Manager</span>
                <b>{team.manager || team.staff?.manager || '—'}</b>
              </div>
              {(team.managerId || team.staff?.managerId) && (team.managerId !== '—' && team.staff?.managerId !== '—') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px dashed var(--line)', marginTop: '4px', paddingTop: '6px', background: 'transparent', padding: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID Manager</span>
                  <CopyId value={team.managerId || team.staff?.managerId} label="ID Manager" />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '12px 14px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', padding: 0 }}>
                <span>Analista</span>
                <b>{team.analyst || team.staff?.analyst || '—'}</b>
              </div>
              {(team.analystId || team.staff?.analystId) && (team.analystId !== '—' && team.staff?.analystId !== '—') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px dashed var(--line)', marginTop: '4px', paddingTop: '6px', background: 'transparent', padding: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ID Analista</span>
                  <CopyId value={team.analystId || team.staff?.analystId} label="ID Analista" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.gem} Marcas & Comunidad</h4>
          <div className="gg-pd__rows">
            <div>
              <span>Patrocinador Principal</span>
              <b style={{ color: 'var(--accent)' }}>{team.sponsor || 'Sin patrocinio'}</b>
            </div>
            {team.sponsorId && (
              <div>
                <span>ID de Marca</span>
                <CopyId value={team.sponsorId} label="ID marca" />
              </div>
            )}
            <div>
              <span>Comunidad Aliada</span>
              <b>{team.community || 'General'}</b>
            </div>
            <div>
              <span>Insignia GG</span>
              <b style={{ color: team.partnerBadge?.active ? 'var(--accent)' : 'var(--text-dim)' }}>
                {team.partnerBadge?.active ? (team.partnerBadge.label || 'GlitchGang Partner') : 'Sin verificar'}
              </b>
            </div>
            {team.communityId && (
              <div>
                <span>ID de Comunidad</span>
                <CopyId value={team.communityId} label="ID comunidad" />
              </div>
            )}
          </div>
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.globe} Redes Sociales</h4>
          <div className="gg-pd__social-links">
            {team.socials?.instagram && (
              <a
                href={`https://${team.socials.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="gg-pd__social-btn"
                title="Instagram"
              >
                {Icon.instagram}
              </a>
            )}
            {team.socials?.x && (
              <a
                href={`https://${team.socials.x}`}
                target="_blank"
                rel="noreferrer"
                className="gg-pd__social-btn"
                title="Twitter/X"
              >
                {Icon.logout} {/* Usamos logout como fallback si no hay icono específico de X, o podemos usar globe/chat */}
              </a>
            )}
            {team.socials?.web && (
              <a
                href={`https://${team.socials.web}`}
                target="_blank"
                rel="noreferrer"
                className="gg-pd__social-btn"
                title="Sitio Web"
              >
                {Icon.globe}
              </a>
            )}
            {!team.socials?.instagram && !team.socials?.x && !team.socials?.web && (
              <p className="gg-pd__empty">Sin redes sociales registradas.</p>
            )}
          </div>
        </div>

        <div className="gg-pd__actions" style={{ gridTemplateColumns: '1fr', gap: '10px', marginTop: '24px' }}>
          <div className="gg-pd__policy">
            <b>Politica de insignia</b>
            <span>Se puede retirar por mala conducta, reportes validos o incumplimiento de reglas.</span>
          </div>
          <button className={`gg-pd__btn ${team.partnerBadge?.active ? 'danger' : 'ok'}`} onClick={onTogglePartnerBadge}>
            {Icon.award} {team.partnerBadge?.active ? 'Quitar insignia' : 'Verificar insignia'}
          </button>
          <button className="gg-pd__btn" onClick={() => {
            exportTeamsPdf({ teams: [team], format: 'profile', requestedBy: 'Admin GlitchGang' })
            toast('Ficha PDF descargada', 'success')
          }}>
            {Icon.fileText} Descargar ficha PDF
          </button>
          <button className={`gg-pd__btn ${team.status === 'Eliminado' ? 'ok' : 'danger'}`} onClick={onToggleStatus} title="Un equipo dado de baja no puede inscribirse a torneos nuevos; conserva su historial">
            {Icon.lock} {team.status === 'Eliminado' ? 'Reactivar equipo' : 'Dar de baja (no puede inscribirse)'}
          </button>
          <button className="gg-pd__btn danger" onClick={onDelete}>
            {Icon.trash || Icon.lock} Eliminar equipo permanentemente
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}


