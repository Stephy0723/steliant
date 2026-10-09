import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import StatusPill from '../../../components/StatusPill/StatusPill.jsx'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { CENSUS_ROLES, COUNTRY_NAMES, flagOf, adaptCensusRow } from '../../../data/playersCensus.js'
import { api } from '../../../lib/api.js'
import { exportPlayersCsv, exportPlayersPdf, PLAYER_EXPORT_FIELDS, PLAYER_EXPORT_PRESETS } from '../../../lib/playerExport.js'
import { toast } from '../../../lib/toast.js'
import { GAMES } from '../../../data/games.js'
import './AdminCensus.css'

const GAME_MAP = GAMES.reduce((m, g) => { m[g.id] = g.name; m[g.name] = g.name; return m }, {})
const getGameName = (game) => GAME_MAP[game] || game

const STATUS_OPTS = ['Todos', 'activo', 'inactivo', 'ban']
const PER_PAGE = 8
const DEFAULT_EXPORT_KEYS = PLAYER_EXPORT_PRESETS.profile
const PDF_FORMATS = [
  { key: 'profile', label: 'Ficha completa', desc: 'Una pagina por jugador con cabecera, resumen y bloques detallados.' },
  { key: 'summary', label: 'Resumen ejecutivo', desc: 'Una pagina por jugador con lectura rapida y limpia.' },
  { key: 'table', label: 'Tabla general', desc: 'Varias filas por pagina para reportes operativos.' },
]
const NOTICE_PRESETS = [
  {
    label: 'Cuenta reportada',
    title: 'Cuenta reportada',
    message: 'Tu cuenta recibió un reporte y será revisada por el equipo de moderación. No implica una sanción automática, pero podríamos contactarte si necesitamos más información.',
  },
  {
    label: 'Sospecha de trampa',
    title: 'Revisión por posible trampa',
    message: 'Recibimos una alerta relacionada con posible uso de trampas, software externo o ventaja no permitida. Tu actividad será revisada según las reglas de GlitchGang.',
  },
  {
    label: 'Conducta tóxica',
    title: 'Advertencia por conducta',
    message: 'Recibimos reportes sobre lenguaje ofensivo, acoso o conducta antideportiva. Mantén el respeto en partidas, chats y torneos para evitar sanciones.',
  },
  {
    label: 'Evidencia requerida',
    title: 'Necesitamos evidencia',
    message: 'Para continuar con la revisión de tu caso, necesitamos que envíes evidencia o una aclaración a soporte. Responde lo antes posible para evitar restricciones temporales.',
  },
  {
    label: 'Última advertencia',
    title: 'Última advertencia administrativa',
    message: 'Esta es una advertencia formal. Si se repite la conducta reportada, tu cuenta puede ser suspendida temporal o permanentemente según las reglas de la plataforma.',
  },
]

export default function AdminUsers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Todos')
  const [game, setGame] = useState('Todos')
  const [country, setCountry] = useState('Todos')
  const [role, setRole] = useState('Todos')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  const [viewMode, setViewMode] = useState('table')
  const [ageRange, setAgeRange] = useState('Todos')
  const [joinedSeason, setJoinedSeason] = useState('Todos')
  const [banPlayer, setBanPlayer] = useState(null)
  const [banReason, setBanReason] = useState('')
  const [noticePlayer, setNoticePlayer] = useState(null)
  const [noticeTitle, setNoticeTitle] = useState('Aviso administrativo')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [casePlayer, setCasePlayer] = useState(null)
  const [caseReason, setCaseReason] = useState('')
  const [caseCategory, setCaseCategory] = useState('Conducta')

  const [exportOpen, setExportOpen] = useState(false)
  const [exportPlayerIds, setExportPlayerIds] = useState([])
  const [exportKeys, setExportKeys] = useState(DEFAULT_EXPORT_KEYS)
  const [exportType, setExportType] = useState('pdf')
  const [pdfFormat, setPdfFormat] = useState('profile')
  const [exportTitle, setExportTitle] = useState('Reporte de jugadores')
  const [exportDescription, setExportDescription] = useState('Documento administrativo con jugadores seleccionados y los campos requeridos para revision, archivo o control interno.')

  useEffect(() => {
    let alive = true
    api('/admin/census')
      .then(res => {
        if (alive) setPlayers(Array.isArray(res.players) ? res.players.map(adaptCensusRow) : [])
      })
      .catch(() => { if (alive) setLoadError('No se pudo cargar el censo desde el servidor.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => players.filter(player => {
    const q = search.trim().toLowerCase()
    const matchesQuery = !q
      || player.nick.toLowerCase().includes(q)
      || player.email.toLowerCase().includes(q)
      || player.realName.toLowerCase().includes(q)
      || player.publicId.toLowerCase().includes(q)
      || player.internalId.toLowerCase().includes(q)

    const matchesAge = ageRange === 'Todos'
      || (ageRange === 'under18' && player.age < 18)
      || (ageRange === '18_24' && player.age >= 18 && player.age <= 24)
      || (ageRange === '25_34' && player.age >= 25 && player.age <= 34)
      || (ageRange === '35_plus' && player.age >= 35)

    const matchesSeason = joinedSeason === 'Todos'
      || (joinedSeason === '2025' && player.joined.includes('2025'))
      || (joinedSeason === '2026' && player.joined.includes('2026'))

    return matchesQuery
      && (status === 'Todos' || player.status === status)
      && (game === 'Todos' || player.mainGame === game)
      && (country === 'Todos' || player.country === country)
      && (role === 'Todos' || player.role === role)
      && matchesAge
      && matchesSeason
  }), [players, search, status, game, country, role, ageRange, joinedSeason])

  const censusGames = useMemo(() => [...new Set(players.map(p => p.mainGame).filter(g => g && g !== '—'))].sort(), [players])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const resetPage = (setter) => (value) => { setter(value); setPage(1) }

  const stats = useMemo(() => ({
    total: players.length,
    active: players.filter(player => player.status === 'activo').length,
    banned: players.filter(player => player.status === 'ban').length,
    online: players.filter(player => player.lastActive === 'En linea').length,
    verified: players.filter(player => player.verified).length,
    countries: new Set(players.map(player => player.country)).size,
  }), [players])

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filtered.some(player => player.id === id)))
  }, [filtered])

  const selectedCount = selectedIds.length
  const exportCandidates = useMemo(
    () => filtered.filter(player => exportPlayerIds.includes(player.id)),
    [filtered, exportPlayerIds]
  )
  const groupedExportFields = useMemo(() => {
    return PLAYER_EXPORT_FIELDS.reduce((acc, field) => {
      if (!acc[field.section]) acc[field.section] = []
      acc[field.section].push(field)
      return acc
    }, {})
  }, [])
  const requestedBy = user?.nick || user?.email || 'Admin GlitchGang'

  const patch = (id, patchData) => setPlayers(prev => prev.map(player => player.id === id ? { ...player, ...patchData } : player))

  const toggleBan = async (player, reason = '') => {
    const nextStatus = player.status === 'ban' ? 'activo' : 'ban'

    try {
      await api(`/admin/users/${player.id}/status`, { method: 'PATCH', body: { status: nextStatus, reason } })
    } catch (error) {
      toast(error.message || 'No se pudo actualizar el estado', 'error')
      setConfirm(null)
      return
    }

    patch(player.id, { status: nextStatus, banReason: nextStatus === 'ban' ? reason : null })
    toast(nextStatus === 'ban' ? `${player.nick} baneado` : `${player.nick} reactivado`, nextStatus === 'ban' ? 'error' : 'success')
    setConfirm(null)
    setSelected(current => current && current.id === player.id ? { ...current, status: nextStatus, banReason: nextStatus === 'ban' ? reason : null } : current)
  }

  const remove = async (player) => {
    try {
      await api(`/admin/users/${player.id}`, { method: 'DELETE' })
    } catch (error) {
      toast(error.message || 'No se pudo eliminar la cuenta', 'error')
      setConfirm(null)
      return
    }
    setPlayers(prev => prev.filter(item => item.id !== player.id))
    setSelectedIds(prev => prev.filter(id => id !== player.id))
    setExportPlayerIds(prev => prev.filter(id => id !== player.id))
    toast(`${player.nick} eliminado del censo`, 'error')
    setConfirm(null)
    setSelected(null)
  }

  const toggleVerify = async (player) => {
    const nextVerified = !player.verified
    try {
      await api(`/admin/users/${player.id}/verify`, { method: 'PATCH', body: { verified: nextVerified } })
    } catch (error) {
      toast(error.message || 'No se pudo actualizar la verificación', 'error')
      return
    }
    patch(player.id, { verified: nextVerified })
    toast(nextVerified ? `${player.nick} verificado` : `Verificacion retirada a ${player.nick}`, 'success')
    setSelected(current => current && current.id === player.id ? { ...current, verified: nextVerified } : current)
  }

  const notify = async (player, title, message) => {
    try {
      await api(`/admin/users/${player.id}/notice`, { method: 'POST', body: { title, message } })
      toast(`Aviso enviado a ${player.nick}`, 'success')
      return true
    } catch (error) {
      toast(error.message || 'No se pudo enviar el aviso', 'error')
      return false
    }
  }
  const toggleKey = (key) => setExportKeys(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  const toggleSelected = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  const toggleExportPlayer = (id) => setExportPlayerIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])

  const toggleSelectPage = () => {
    const ids = pageItems.map(player => player.id)
    const everySelected = ids.length > 0 && ids.every(id => selectedIds.includes(id))
    setSelectedIds(prev => everySelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  const openExportCenter = () => {
    const baseIds = selectedIds.length
      ? selectedIds.filter(id => filtered.some(player => player.id === id))
      : filtered.map(player => player.id)
    navigate('/admin/usuarios/exportar', { state: { selectedIds: baseIds } })
  }

  const doExport = async () => {
    if (!exportPlayerIds.length) {
      toast('Selecciona al menos un jugador', 'error')
      return
    }
    if (!exportKeys.length) {
      toast('Selecciona al menos un campo', 'error')
      return
    }

    const targetPlayers = filtered.filter(player => exportPlayerIds.includes(player.id))
    if (!targetPlayers.length) {
      toast('Los jugadores elegidos ya no coinciden con el filtro actual', 'error')
      return
    }

    if (exportType === 'csv') {
      exportPlayersCsv(targetPlayers, exportKeys)
      toast(`${targetPlayers.length} jugadores exportados a CSV`, 'success')
    } else {
      await exportPlayersPdf({
        players: targetPlayers,
        keys: exportKeys,
        format: pdfFormat,
        requestedBy,
        title: exportTitle.trim() || 'Reporte de jugadores',
        description: exportDescription.trim() || 'Documento administrativo de jugadores.',
      })
      toast(`${targetPlayers.length} jugadores exportados a PDF`, 'success')
    }

    setExportOpen(false)
  }

  return (
    <div className="gg-admin-page gg-census">
      <div className="gg-admin-page__header">
        <div>
          <h2>Censo de jugadores</h2>
          <p>{loading ? 'Cargando censo…' : loadError || `${stats.total} jugadores · ${stats.online} en línea · ${stats.countries} países`}</p>
        </div>
        <div className="gg-census__exports">
          <div className="gg-census__selection-pill">{selectedCount} seleccionados</div>
          <button className="gg-census__export primary" onClick={openExportCenter}>{Icon.download} Centro de exportacion</button>
        </div>
      </div>


      <AnimatePresence>
        {exportOpen && (
          <motion.div className="gg-xport-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExportOpen(false)}>
            <motion.div
              className="gg-xport"
              onClick={event => event.stopPropagation()}
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0 }}
            >
              <div className="gg-xport__head">
                <div>
                  <h3>{Icon.download} Centro de exportacion</h3>
                  <p>Elige personas, datos y formato. {exportCandidates.length} jugador(es) listos y {exportKeys.length} campo(s) activos.</p>
                </div>
                <button className="gg-xport__close" onClick={() => setExportOpen(false)}>{Icon.x}</button>
              </div>

              <div className="gg-xport__summary">
                <div><b>{exportCandidates.length}</b><span>Jugadores</span></div>
                <div><b>{exportKeys.length}</b><span>Campos</span></div>
                <div><b>{exportType === 'pdf' ? 'PDF' : 'CSV'}</b><span>Salida</span></div>
                <div><b>{pdfFormat === 'profile' ? '1x1' : pdfFormat === 'summary' ? 'Brief' : 'Tabla'}</b><span>Layout</span></div>
              </div>

              <div className="gg-xport__body">
                <div className="gg-xport__main">
                  <div className="gg-xport__panel gg-xport__panel--soft">
                    <div className="gg-xport__section-head">
                      <div>
                        <h4>Documento</h4>
                        <p>Configura el archivo y su presentación.</p>
                      </div>
                    </div>

                    <div className="gg-xport__modes">
                      <button className={exportType === 'pdf' ? 'active' : ''} onClick={() => setExportType('pdf')}>{Icon.fileText} PDF</button>
                      <button className={exportType === 'csv' ? 'active' : ''} onClick={() => setExportType('csv')}>{Icon.download} CSV</button>
                    </div>

                    {exportType === 'pdf' && (
                      <div className="gg-xport__formats gg-xport__formats--compact">
                        {PDF_FORMATS.map(format => (
                          <button key={format.key} className={pdfFormat === format.key ? 'active' : ''} onClick={() => setPdfFormat(format.key)}>
                            <b>{format.label}</b>
                            <span>{format.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="gg-xport__stack">
                      <label className="gg-xport__field">
                        <span>Titulo del documento</span>
                        <input value={exportTitle} onChange={event => setExportTitle(event.target.value)} placeholder="Reporte de jugadores" />
                      </label>

                      <label className="gg-xport__field">
                        <span>Solicitado por</span>
                        <input value={requestedBy} readOnly />
                      </label>

                      <label className="gg-xport__field">
                        <span>Descripción</span>
                        <textarea value={exportDescription} onChange={event => setExportDescription(event.target.value)} rows={4} placeholder="Explica que contiene este archivo..." />
                      </label>
                    </div>
                  </div>

                  <div className="gg-xport__panel">
                    <div className="gg-xport__section-head">
                      <div>
                        <h4>Jugadores</h4>
                        <p>Elige quienes van dentro del export.</p>
                      </div>
                      <div className="gg-xport__quick">
                        <button onClick={() => setExportPlayerIds(filtered.map(player => player.id))}>Todos</button>
                        <button onClick={() => setExportPlayerIds(pageItems.map(player => player.id))}>Pagina</button>
                        <button onClick={() => setExportPlayerIds(selectedIds.filter(id => filtered.some(player => player.id === id)))}>Seleccion</button>
                        <button onClick={() => setExportPlayerIds([])}>Limpiar</button>
                      </div>
                    </div>

                    <div className="gg-xport__players">
                      {filtered.map(player => (
                        <label key={player.id} className={`gg-xport__player ${exportPlayerIds.includes(player.id) ? 'on' : ''}`}>
                          <input type="checkbox" checked={exportPlayerIds.includes(player.id)} onChange={() => toggleExportPlayer(player.id)} />
                          <span className="gg-xport__check">{exportPlayerIds.includes(player.id) && Icon.check}</span>
                          <img src={player.avatar} alt={player.nick} />
                          <div>
                            <b>{player.nick}</b>
                            <small>{player.realName} · {getGameName(player.mainGame)}</small>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="gg-xport__panel">
                    <div className="gg-xport__section-head">
                      <div>
                        <h4>Campos</h4>
                        <p>Escoge solo la información que quieres ver.</p>
                      </div>
                      <div className="gg-xport__quick">
                        <button onClick={() => setExportKeys(PLAYER_EXPORT_PRESETS.full)}>Todo</button>
                        <button onClick={() => setExportKeys(PLAYER_EXPORT_PRESETS.profile)}>Perfil</button>
                        <button onClick={() => setExportKeys(PLAYER_EXPORT_PRESETS.ids)}>IDs</button>
                        <button onClick={() => setExportKeys(PLAYER_EXPORT_PRESETS.competitive)}>Competitivo</button>
                      </div>
                    </div>

                    <div className="gg-xport__field-groups">
                      {Object.entries(groupedExportFields).map(([section, fields]) => (
                        <div key={section} className="gg-xport__field-group">
                          <div className="gg-xport__field-group-head">
                            <b>{section}</b>
                            <button onClick={() => {
                              const keys = fields.map(field => field.key)
                              const allOn = keys.every(key => exportKeys.includes(key))
                              setExportKeys(prev => allOn ? prev.filter(key => !keys.includes(key)) : [...new Set([...prev, ...keys])])
                            }}>
                              {fields.every(field => exportKeys.includes(field.key)) ? 'Quitar grupo' : 'Usar grupo'}
                            </button>
                          </div>
                          <div className="gg-xport__chips">
                            {fields.map(field => (
                              <label key={field.key} className={`gg-xport__chip ${exportKeys.includes(field.key) ? 'on' : ''}`}>
                                <input type="checkbox" checked={exportKeys.includes(field.key)} onChange={() => toggleKey(field.key)} />
                                <span>{field.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="gg-xport__preview">
                  <div className="gg-xport__preview-card">
                    <div className="gg-xport__preview-top">
                      <div className="gg-xport__preview-brand">
                        <span className="gg-xport__preview-logo">G</span>
                        <div>
                          <b>GlitchGang</b>
                          <small>Admin Export</small>
                        </div>
                      </div>
                      <span className="gg-xport__preview-badge">{exportType === 'pdf' ? 'PDF' : 'CSV'}</span>
                    </div>

                    <div className="gg-xport__preview-header">
                      <h4>{exportTitle || 'Reporte de jugadores'}</h4>
                      <p>{exportDescription || 'Documento administrativo con jugadores seleccionados.'}</p>
                    </div>

                    <div className="gg-xport__preview-meta">
                      <div><span>Solicitado por</span><b>{requestedBy}</b></div>
                      <div><span>Formato</span><b>{exportType === 'pdf' ? PDF_FORMATS.find(item => item.key === pdfFormat)?.label : 'CSV personalizado'}</b></div>
                      <div><span>Jugadores</span><b>{exportCandidates.length}</b></div>
                      <div><span>Campos</span><b>{exportKeys.length}</b></div>
                    </div>

                    <div className="gg-xport__preview-block">
                      <span>Jugadores incluidos</span>
                      <div className="gg-xport__preview-tags">
                        {exportCandidates.slice(0, 6).map(player => <em key={player.id}>{player.nick}</em>)}
                        {exportCandidates.length > 6 && <em>+{exportCandidates.length - 6} mas</em>}
                        {exportCandidates.length === 0 && <em>Ninguno seleccionado</em>}
                      </div>
                    </div>

                    <div className="gg-xport__preview-block">
                      <span>Campos visibles</span>
                      <div className="gg-xport__preview-list">
                        {PLAYER_EXPORT_FIELDS.filter(field => exportKeys.includes(field.key)).slice(0, 8).map(field => (
                          <div key={field.key}>
                            <small>{field.section}</small>
                            <b>{field.label}</b>
                          </div>
                        ))}
                        {exportKeys.length > 8 && <div><small>Extra</small><b>+{exportKeys.length - 8} campos mas</b></div>}
                        {exportKeys.length === 0 && <div><small>Campos</small><b>No hay seleccion</b></div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="gg-xport__foot">
                <button className="gg-xport__btn ghost" onClick={() => setExportOpen(false)}>Cancelar</button>
                <button className="gg-xport__btn primary" onClick={doExport} disabled={!exportKeys.length || !exportPlayerIds.length}>
                  {exportType === 'pdf' ? Icon.fileText : Icon.download} Descargar {exportType === 'pdf' ? 'PDF' : 'CSV'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="gg-census__stats">
        {[
          { icon: 'users', label: 'Total jugadores', value: stats.total, accent: true },
          { icon: 'bolt', label: 'En línea', value: stats.online },
          { icon: 'check', label: 'Activos', value: stats.active },
          { icon: 'shield', label: 'Verificados', value: stats.verified },
          { icon: 'alert', label: 'Baneados', value: stats.banned, danger: true },
          { icon: 'globe', label: 'Países', value: stats.countries },
        ].map(item => (
          <div key={item.label} className={`gg-census__stat${item.accent ? ' accent' : ''}${item.danger ? ' danger' : ''}`}>
            <span className="gg-census__stat-icon">{Icon[item.icon]}</span>
            <div><b>{item.value}</b><small>{item.label}</small></div>
          </div>
        ))}
      </div>

      <div className="gg-census__controls">
        <div className="gg-admin-filter-tabs">
          {STATUS_OPTS.map(option => (
            <button key={option} className={`gg-admin-filter-tab ${status === option ? 'active' : ''}`} onClick={() => resetPage(setStatus)(option)}>
              {option}
            </button>
          ))}
        </div>
        <div className="gg-census__filters">
          <select value={game} onChange={event => resetPage(setGame)(event.target.value)}>
            <option value="Todos">Todos los juegos</option>
            {censusGames.map(item => <option key={item} value={item}>{getGameName(item)}</option>)}
          </select>
          <select value={country} onChange={event => resetPage(setCountry)(event.target.value)}>
            <option value="Todos">Todos los países</option>
            {Object.entries(COUNTRY_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <select value={role} onChange={event => resetPage(setRole)(event.target.value)}>
            <option value="Todos">Todos los roles</option>
            {Object.entries(CENSUS_ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={ageRange} onChange={event => resetPage(setAgeRange)(event.target.value)}>
            <option value="Todos">Todas las edades</option>
            <option value="under18">Menores (&lt;18)</option>
            <option value="18_24">18 - 24 años</option>
            <option value="25_34">25 - 34 años</option>
            <option value="35_plus">35+ años</option>
          </select>
          <select value={joinedSeason} onChange={event => resetPage(setJoinedSeason)(event.target.value)}>
            <option value="Todos">Todas las temporadas</option>
            <option value="2025">Temporada 2025</option>
            <option value="2026">Temporada 2026</option>
          </select>
          <div className="gg-admin-search">
            <span className="gg-admin-search__icon">{Icon.search}</span>
            <input value={search} onChange={event => resetPage(setSearch)(event.target.value)} placeholder="Buscar nick, nombre, email o ID..." />
            {search && <button className="gg-admin-search__clear" onClick={() => resetPage(setSearch)('')}>{Icon.x}</button>}
          </div>
          <div className="gg-census__view-toggle">
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
            <table className="gg-datatable gg-census__table">
              <thead>
                <tr>
                  <th className="gg-census__checkhead">
                    <input
                      type="checkbox"
                      checked={pageItems.length > 0 && pageItems.every(player => selectedIds.includes(player.id))}
                      onChange={toggleSelectPage}
                    />
                  </th>
                  <th>Jugador</th>
                  <th>ID jugador</th>
                  <th>País</th>
                  <th>Juego</th>
                  <th>Nivel</th>
                  <th>Plan</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((player, index) => (
                  <motion.tr
                    key={player.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.025 }}
                    className="gg-census__row"
                    onClick={() => setSelected(player)}
                  >
                    <td onClick={event => event.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(player.id)} onChange={() => toggleSelected(player.id)} />
                    </td>
                    <td>
                      <div className="gg-census__player">
                        <img src={player.avatar} alt={player.nick} />
                        <div>
                          <b>{player.nick}{player.verified && <i className="gg-census__verif" title="Verificado">{Icon.check}</i>}</b>
                          <small>{player.realName}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="gg-census__ids">
                        <code className="gg-census__id" title="ID público">{player.publicId}</code>
                        <code className="gg-census__id gg-census__id--ext" title="ID interno">{player.internalId}</code>
                        {player.roleProfiles && typeof player.roleProfiles === 'object' && Object.keys(player.roleProfiles).map(role => {
                          const profile = player.roleProfiles[role];
                          const code = profile?.[`${role}Code`];
                          if (!code) return null;
                          return (
                            <code key={role} className="gg-census__id gg-census__id--ext" style={{ color: 'var(--accent)', borderColor: 'rgba(var(--accent-rgb), 0.3)', background: 'rgba(var(--accent-rgb), 0.08)' }} title={`ID ${role}`}>
                              {code}
                            </code>
                          );
                        })}
                      </div>
                    </td>
                    <td><span className="gg-census__country">{flagOf(player.country)} {player.country} <small className="gg-census__cnum">#{player.countryNumber}</small></span></td>
                    <td><span className="gg-census__game">{getGameName(player.mainGame)}</span></td>
                    <td><b>{player.level}</b> <small className="gg-census__rank">{player.rank}</small></td>
                    <td><span className="gg-census__plan">{player.plan}</span></td>
                    <td onClick={event => event.stopPropagation()}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {(Array.isArray(player.roles) && player.roles.length ? player.roles : [player.role || 'user']).map(r => (
                          <span key={r} style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '4px', background: r === player.role ? 'rgba(var(--accent-rgb), 0.08)' : 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', color: r === player.role ? 'var(--accent)' : 'var(--text-dim)', textTransform: 'capitalize' }}>
                            {CENSUS_ROLES[r] || r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td><StatusPill status={player.status} /></td>
                    <td onClick={event => event.stopPropagation()}>
                      <div className="gg-census__actions">
                        <button className="gg-census__act" title="Ver ficha" onClick={() => setSelected(player)}>{Icon.eye}</button>
                        <button
                          className={`gg-census__act ${player.status === 'ban' ? 'ok' : 'danger'}`}
                          title={player.status === 'ban' ? 'Desbanear' : 'Banear'}
                          onClick={() => {
                            if (player.status === 'ban') {
                              toggleBan(player)
                            } else {
                              setBanPlayer(player)
                            }
                          }}
                        >
                          {Icon.lock}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {pageItems.length === 0 && <tr><td colSpan={10} className="gg-datatable__empty">Sin jugadores con ese criterio.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="gg-census__gallery">
            {pageItems.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.025 }}
                className={`gg-user-card ${player.status === 'ban' ? 'banned' : ''}`}
                onClick={() => setSelected(player)}
              >
                <div className="gg-user-card__checkbox" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(player.id)}
                    onChange={() => toggleSelected(player.id)}
                  />
                </div>
                <div className="gg-user-card__top">
                  <span className="gg-user-card__flag" title={player.countryName}>{flagOf(player.country)}</span>
                  {player.verified && (
                    <span className="gg-user-card__verif" title="Verificado">
                      {Icon.check}
                    </span>
                  )}
                </div>
                <div className="gg-user-card__avatar-wrap">
                  <img src={player.avatar} alt={player.nick} className="gg-user-card__avatar" />
                  <span className={`gg-user-card__indicator ${player.lastActive === 'En linea' ? 'online' : 'offline'}`} />
                </div>
                <div className="gg-user-card__info">
                  <h4 className="gg-user-card__nick">{player.nick}</h4>
                  <p className="gg-user-card__name">{player.realName}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '6px' }}>
                    <span className="gg-user-card__plan">{player.plan}</span>
                    {(Array.isArray(player.roles) ? player.roles : [player.role || 'user']).map(r => (
                      <span key={r} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                        {CENSUS_ROLES[r] || r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="gg-user-card__details">
                  <div className="gg-user-card__detail-item">
                    <span className="label">Juego</span>
                    <span className="val">{getGameName(player.mainGame)}</span>
                  </div>
                  <div className="gg-user-card__detail-item">
                    <span className="label">Nivel</span>
                    <span className="val">{player.level} <small className="rank">{player.rank}</small></span>
                  </div>
                  {player.roleProfiles && typeof player.roleProfiles === 'object' && Object.keys(player.roleProfiles).map(role => {
                    const profile = player.roleProfiles[role];
                    const code = profile?.[`${role}Code`];
                    if (!code) return null;
                    return (
                      <div key={role} className="gg-user-card__detail-item" style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dashed var(--line)', paddingTop: '4px' }}>
                        <span className="label" style={{ textTransform: 'capitalize' }}>ID {role}</span>
                        <span className="val" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px' }}>{code}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="gg-user-card__actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="gg-user-card__btn"
                    title="Ver ficha"
                    onClick={() => setSelected(player)}
                  >
                    {Icon.eye} Ver ficha
                  </button>
                  <button
                    className={`gg-user-card__btn ${player.status === 'ban' ? 'unban' : 'ban'}`}
                    title={player.status === 'ban' ? 'Desbanear' : 'Banear'}
                    onClick={() => {
                      if (player.status === 'ban') {
                        toggleBan(player)
                      } else {
                        setBanPlayer(player)
                      }
                    }}
                  >
                    {Icon.lock} {player.status === 'ban' ? 'Desbanear' : 'Banear'}
                  </button>
                </div>
              </motion.div>
            ))}
            {pageItems.length === 0 && (
              <div className="gg-census__gallery-empty">
                Sin jugadores con ese criterio.
              </div>
            )}
          </div>
        )}

        {pages > 1 && (
          <div className="gg-census__pager">
            <button disabled={page === 1} onClick={() => setPage(current => current - 1)}>{Icon.chevronRight}</button>
            <span>Pagina {page} de {pages} · {filtered.length} resultados</span>
            <button disabled={page === pages} onClick={() => setPage(current => current + 1)}>{Icon.chevronRight}</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <PlayerDetail
            player={selected}
            onClose={() => setSelected(null)}
            onBan={() => {
              if (selected.status === 'ban') {
                toggleBan(selected)
              } else {
                setBanPlayer(selected)
              }
            }}
            onVerify={() => toggleVerify(selected)}
            onNotify={() => setNoticePlayer(selected)}
            onOpenCase={() => setCasePlayer(selected)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.action === 'delete' ? `Eliminar ${confirm?.player?.nick}` : confirm?.action === 'ban' ? `Banear ${confirm?.player?.nick}` : `Desbanear ${confirm?.player?.nick}`}
        message={confirm?.action === 'delete' ? 'Esta acción no se puede deshacer.' : undefined}
        confirmLabel={confirm?.action === 'delete' ? 'Eliminar' : confirm?.action === 'ban' ? 'Banear' : 'Desbanear'}
        onConfirm={() => confirm?.action === 'delete' ? remove(confirm.player) : toggleBan(confirm.player)}
        onCancel={() => setConfirm(null)}
        variant={confirm?.action === 'delete' || confirm?.action === 'ban' ? 'danger' : 'primary'}
      />

      {/* Modal de Justificación de Baneo */}
      <AnimatePresence>
        {banPlayer && (
          <motion.div
            className="gg-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBanPlayer(null)}
            style={{ zIndex: 300 }}
          >
            <motion.div
              className="gg-modal"
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3>Justificante de Baneo: {banPlayer.nick}</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: '8px 0 12px' }}>
                Especifica la causa de suspensión. Quedará guardado en su perfil de usuario y en la bitácora de auditoría.
              </p>
              <textarea
                className="gg-ban-textarea"
                rows={3}
                placeholder="Ej. Uso de software no autorizado (hacks), comportamiento altamente tóxico en chat de torneo, smurfing..."
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
              />
              <div className="gg-modal__btns" style={{ marginTop: '16px' }}>
                <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setBanPlayer(null)}>Cancelar</button>
                <button
                  className="gg-btn gg-btn--sm gg-modal__confirm gg-modal__confirm--danger"
                  disabled={!banReason.trim()}
                  onClick={() => {
                    toggleBan(banPlayer, banReason)
                    setBanPlayer(null)
                    setBanReason('')
                  }}
                >
                  Suspender cuenta
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de aviso administrativo */}
      <AnimatePresence>
        {noticePlayer && (
          <motion.div
            className="gg-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNoticePlayer(null)}
            style={{ zIndex: 300 }}
          >
            <motion.div
              className="gg-modal"
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3>Enviar aviso: {noticePlayer.nick}</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: '8px 0 16px' }}>
                Escribe el mensaje que recibirá el usuario en sus notificaciones.
              </p>

              <div className="gg-xport__field" style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>Mensajes predeterminados</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {NOTICE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      className="gg-btn gg-btn--ghost gg-btn--sm"
                      onClick={() => {
                        setNoticeTitle(preset.title)
                        setNoticeMessage(preset.message)
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gg-xport__field" style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Título</span>
                <input
                  className="gg-admin-select"
                  value={noticeTitle}
                  onChange={e => setNoticeTitle(e.target.value)}
                  maxLength={120}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--text)' }}
                />
              </div>

              <div className="gg-xport__field">
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Mensaje</span>
                <textarea
                  className="gg-ban-textarea"
                  rows={4}
                  maxLength={400}
                  placeholder="Escribe aquí el aviso exacto para el usuario..."
                  value={noticeMessage}
                  onChange={e => setNoticeMessage(e.target.value)}
                />
              </div>

              <div className="gg-modal__btns" style={{ marginTop: '16px' }}>
                <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setNoticePlayer(null)}>Cancelar</button>
                <button
                  className="gg-btn gg-btn--sm gg-modal__confirm"
                  disabled={!noticeTitle.trim() || !noticeMessage.trim()}
                  onClick={async () => {
                    const sent = await notify(noticePlayer, noticeTitle.trim(), noticeMessage.trim())
                    if (sent) {
                      setNoticePlayer(null)
                      setNoticeTitle('Aviso administrativo')
                      setNoticeMessage('')
                    }
                  }}
                >
                  Enviar aviso
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de caso interno */}
      <AnimatePresence>
        {casePlayer && (
          <motion.div
            className="gg-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCasePlayer(null)}
            style={{ zIndex: 300 }}
          >
            <motion.div
              className="gg-modal"
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3>Abrir caso de revisión: {casePlayer.nick}</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: '8px 0 16px' }}>
                Esto crea un caso interno para soporte y moderación. El usuario no queda sancionado hasta que el equipo revise la evidencia.
              </p>
              
              <div className="gg-xport__field" style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Tipo de caso</span>
                <select
                  value={caseCategory}
                  onChange={e => setCaseCategory(e.target.value)}
                  className="gg-admin-select"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--text)' }}
                >
                  <option value="Conducta">Conducta / lenguaje acosador</option>
                  <option value="Integridad competitiva">Integridad competitiva</option>
                  <option value="Identidad">Identidad / cuenta alternativa</option>
                  <option value="Soporte">Seguimiento de soporte</option>
                  <option value="Otro">Otro motivo</option>
                </select>
              </div>

              <div className="gg-xport__field">
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Evidencia / justificación</span>
                <textarea
                  className="gg-ban-textarea"
                  rows={3}
                  placeholder="Detalla lo observado y añade enlaces a capturas, clips o tickets si aplica..."
                  value={caseReason}
                  onChange={e => setCaseReason(e.target.value)}
                />
              </div>

              <div className="gg-modal__btns" style={{ marginTop: '16px' }}>
                <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => setCasePlayer(null)}>Cancelar</button>
                <button
                  className="gg-btn gg-btn--sm gg-modal__confirm gg-modal__confirm--danger"
                  disabled={!caseReason.trim()}
                  onClick={async () => {
                    try {
                      const res = await api(`/admin/users/${casePlayer.id}/case`, { method: 'POST', body: { category: caseCategory, reason: caseReason.trim() } })
                      toast(`Caso ${res.ticket.publicCode} abierto para ${casePlayer.nick} (ver Reportes)`, 'warning')
                      setCasePlayer(null)
                      setCaseReason('')
                    } catch (error) {
                      toast(error.message || 'No se pudo abrir el caso', 'error')
                    }
                  }}
                >
                  Abrir caso
                </button>
              </div>
            </motion.div>
          </motion.div>
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
  return <code className="gg-pd__id" onClick={copy} title="Copiar">{value}</code>
}

function PlayerDetail({ player, onClose, onBan, onVerify, onNotify, onOpenCase }) {
  // Pagos y torneos reales del jugador (Order + inscripciones de sus equipos).
  const [activity, setActivity] = useState({ payments: [], tournaments: [], loading: true })
  useEffect(() => {
    let alive = true
    setActivity(a => ({ ...a, loading: true }))
    api(`/admin/users/${player.id}/activity`)
      .then(res => { if (alive) setActivity({ payments: res.payments || [], tournaments: res.tournaments || [], loading: false }) })
      .catch(() => { if (alive) setActivity({ payments: [], tournaments: [], loading: false }) })
    return () => { alive = false }
  }, [player.id])
  const payments = activity.payments
  const playerTournaments = activity.tournaments

  return (
    <motion.div className="gg-pd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="gg-pd"
        onClick={event => event.stopPropagation()}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <button className="gg-pd__close" onClick={onClose}>{Icon.x}</button>
        <div className="gg-pd__head">
          <img src={player.avatar} alt={player.nick} />
          <div>
            <h3>{player.nick} {player.verified && <i className="gg-census__verif">{Icon.check}</i>}</h3>
            <p>{player.realName} · {flagOf(player.country)} {player.countryName}</p>
            <div className="gg-pd__badges">
              <StatusPill status={player.status} />
              {(Array.isArray(player.roles) ? player.roles : [player.role || 'user']).map(r => (
                <span key={r} className="gg-pd__badge">
                  {CENSUS_ROLES[r] || {
                    organizer: 'Organizador',
                    creator: 'Creador',
                    coach: 'Coach',
                    caster: 'Caster',
                    analyst: 'Analista',
                    sponsor: 'Patrocinador'
                  }[r] || r}
                </span>
              ))}
              <span className="gg-pd__badge">{player.plan}</span>
              {player.gp !== undefined && (
                <span className="gg-pd__badge" style={{ color: 'var(--accent)', borderColor: 'rgba(var(--accent-rgb), 0.35)', background: 'rgba(var(--accent-rgb), 0.08)' }}>
                  ✨ {player.gp} GP
                </span>
              )}
            </div>
          </div>
        </div>

        {player.bio && (
          <div className="gg-pd__ban-info" style={{ background: 'rgba(255, 255, 255, 0.02)', borderColor: 'var(--line)', marginTop: '0px', marginBottom: '20px' }}>
            <strong>📝 Biografía</strong>
            <p style={{ color: 'var(--text)', marginTop: '4px', fontSize: '13px' }}>{player.bio}</p>
          </div>
        )}

        {player.status === 'ban' && (
          <div className="gg-pd__ban-info">
            <strong>🚫 Cuenta Baneada</strong>
            <p>{player.banReason || 'Sin motivo especificado por el administrador.'}</p>
          </div>
        )}

        <div className="gg-pd__stats">
          <div><b>{player.level}</b><span>Nivel · {player.rank}</span></div>
          <div><b>{player.matches}</b><span>Partidas</span></div>
          <div><b>{player.winrate}%</b><span>Win rate</span></div>
          <div><b>${player.earnings.toLocaleString()}</b><span>Ganancias</span></div>
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.fileText} Identificadores</h4>
          <div className="gg-pd__rows">
            <div><span>ID jugador público</span><CopyId value={player.publicId} label="ID público" /></div>
            <div><span>ID jugador interno</span><CopyId value={player.internalId} label="ID interno" /></div>
            <div><span>País</span><b>{flagOf(player.country)} {player.countryName} · <code className="gg-pd__id">#{player.countryNumber}</code></b></div>
            <div><span>Plan</span><b>{player.plan} · <code className="gg-pd__id">{player.planId}</code></b></div>
          </div>
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.users} Comunidades ({player.communities.length})</h4>
          {player.communities.length === 0
            ? <p className="gg-pd__empty">Sin comunidades.</p>
            : <div className="gg-pd__rows">{player.communities.map(item => <div key={item.id}><span>{item.name}</span><CopyId value={item.id} label="ID comunidad" /></div>)}</div>}
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.team} Equipos ({player.teams.length})</h4>
          {player.teams.length === 0
            ? <p className="gg-pd__empty">Sin equipos.</p>
            : <div className="gg-pd__rows">{player.teams.map(item => <div key={item.id}><span>{item.name}</span><CopyId value={item.id} label="ID equipo" /></div>)}</div>}
        </div>

        {player.university && (
          <div className="gg-pd__section">
            <h4>{Icon.award} Universidad</h4>
            <div className="gg-pd__rows">
              <div><span>{player.university.name}</span><b>{player.university.siglas}</b></div>
              <div><span>Matricula</span><b>{player.university.matricula}</b></div>
              <div><span>ID universidad</span><CopyId value={player.university.id} label="ID universidad" /></div>
              <div><span>ID universidad interno</span><CopyId value={player.university.internalId} label="ID universidad interno" /></div>
            </div>
          </div>
        )}

        <div className="gg-pd__section">
          <h4>{Icon.trophy} Historial de Torneos ({playerTournaments.length})</h4>
          {playerTournaments.length === 0
            ? <p className="gg-pd__empty">{activity.loading ? 'Cargando…' : 'Este jugador no ha participado en ningún torneo.'}</p>
            : <div className="gg-pd__rows">
                {playerTournaments.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b>{t.name}</b>
                      <small style={{ display: 'block', color: 'var(--text-dim)' }}>{getGameName(t.game)} · {t.publicId} · {t.date}{t.champion ? ` · 🏆 ${t.champion}` : ''}</small>
                    </div>
                    <span className="gg-census__game" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                      {{ ongoing: 'En vivo', open: 'Inscripciones', registration_closed: 'Cerrado', finished: 'Finalizado', cancelled: 'Cancelado', draft: 'Borrador' }[t.status] || t.status}
                    </span>
                  </div>
                ))}
              </div>}
        </div>

        <div className="gg-pd__section">
          <h4>{Icon.user} Informacion</h4>
          <div className="gg-pd__rows">
            <div><span>Email</span><b>{player.email}</b></div>
            <div><span>Teléfono</span><b>{player.phone || '—'}</b></div>
            <div><span>Género</span><b>{
              {
                male: 'Masculino',
                female: 'Femenino',
                non_binary: 'No binario',
                prefer_not_to_say: 'Prefiero no decirlo',
                other: 'Otro'
              }[player.gender] || player.gender || '—'
            }</b></div>
            <div><span>Fecha de Nacimiento</span><b>{player.birthDate || '—'}</b></div>
            <div><span>Edad</span><b>{player.age !== undefined && player.age !== '—' ? `${player.age} años` : '—'}</b></div>
            <div><span>Juego principal</span><b>{player.mainGame}</b></div>
            <div><span>Registro</span><b>{player.joined}</b></div>
            <div><span>Ultima actividad</span><b>{player.lastActive}</b></div>
          </div>
        </div>

        {player.roleProfiles && Object.keys(player.roleProfiles).some(role => {
          const profile = player.roleProfiles[role];
          const codeKey = `${role}Code`;
          const intCodeKey = `${role}InternalCode`;
          return profile && (profile[codeKey] || profile[intCodeKey]);
        }) && (
          <div className="gg-pd__section">
            <h4>{Icon.award} Roles Especializados</h4>
            <div className="gg-pd__rows">
              {Object.keys(player.roleProfiles).map(role => {
                const profile = player.roleProfiles[role];
                if (!profile) return null;
                const codeKey = `${role}Code`;
                const intCodeKey = `${role}InternalCode`;
                const pubCode = profile[codeKey];
                const intCode = profile[intCodeKey];
                if (!pubCode && !intCode) return null;

                const roleLabel = {
                  organizer: 'Organizador',
                  creator: 'Creador de Contenido',
                  coach: 'Coach / Entrenador',
                  caster: 'Caster / Narrador',
                  analyst: 'Analista',
                  sponsor: 'Sponsor / Patrocinador'
                }[role] || role;

                return (
                  <div key={role} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '12.5px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{roleLabel}</span>
                      {profile.approvedAt && (
                        <small style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                          Aprobado: {new Date(profile.approvedAt).toLocaleDateString('es-ES')}
                        </small>
                      )}
                    </div>
                    {pubCode && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', padding: 0 }}>
                        <span style={{ fontSize: '12px' }}>Código público</span>
                        <CopyId value={pubCode} label={`Código ${role} público`} />
                      </div>
                    )}
                    {intCode && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', padding: 0 }}>
                        <span style={{ fontSize: '12px' }}>Código interno</span>
                        <CopyId value={intCode} label={`Código ${role} interno`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {player.socials && Object.values(player.socials).some(Boolean) && (
          <div className="gg-pd__section">
            <h4>{Icon.globe} Redes Sociales</h4>
            <div className="gg-pd__rows">
              {Object.entries(player.socials).map(([net, url]) => {
                if (!url) return null;
                const netLabel = {
                  discord: 'Discord',
                  instagram: 'Instagram',
                  twitch: 'Twitch',
                  youtube: 'YouTube',
                  twitter: 'X (Twitter)'
                }[net] || net;

                const netIcon = {
                  discord: Icon.discord,
                  instagram: Icon.instagram,
                  twitch: Icon.twitch,
                  youtube: Icon.youtube
                }[net] || null;

                return (
                  <div key={net}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {netIcon && <span style={{ width: '14px', height: '14px', display: 'inline-flex', color: 'var(--text-dim)' }}>{netIcon}</span>}
                      {netLabel}
                    </span>
                    <b style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}>{url}</b>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="gg-pd__section">
          <h4>{Icon.creditCard} Pagos ({payments.length})</h4>
          {payments.length === 0
            ? <p className="gg-pd__empty">{activity.loading ? 'Cargando…' : 'Sin pagos registrados.'}</p>
            : <div className="gg-pd__rows">{payments.map(pay => <div key={pay.id}><span>{pay.concept} · {pay.date}</span><b>${pay.amount} · {pay.id}{pay.mode === 'demo' ? ' (demo)' : ''}</b></div>)}</div>}
        </div>

        <div className="gg-pd__actions">
          <button className="gg-pd__btn" onClick={onVerify}>{Icon.check} {player.verified ? 'Quitar verificación' : 'Verificar'}</button>
          <button className="gg-pd__btn" onClick={onNotify}>{Icon.send} Enviar aviso</button>
          <button className={`gg-pd__btn ${player.status === 'ban' ? 'ok' : 'danger'}`} onClick={onBan}>{Icon.lock} {player.status === 'ban' ? 'Desbanear' : 'Banear'}</button>
          <button className="gg-pd__btn danger" onClick={onOpenCase}>{Icon.alert} Abrir caso</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

