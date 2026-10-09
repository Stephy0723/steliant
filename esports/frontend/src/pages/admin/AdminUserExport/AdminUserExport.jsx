import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { adaptCensusRow } from '../../../data/playersCensus.js'
import { api } from '../../../lib/api.js'
import { exportPlayersCsv, exportPlayersPdf, PLAYER_EXPORT_FIELDS } from '../../../lib/playerExport.js'
import { exportTeamsCsv, exportTeamsPdf, TEAM_EXPORT_FIELDS } from '../../../lib/teamExport.js'
import { exportTournamentsCsv, exportTournamentsPdf, TOURNAMENT_EXPORT_FIELDS } from '../../../lib/tournamentExport.js'
import { downloadSystemExport } from '../../../lib/systemExport.js'
import { logExport, loadExportLogs } from '../../../lib/exportLog.js'
import { REPORT_TYPES, exportReport } from '../../../lib/reportsExport.js'
import { toast } from '../../../lib/toast.js'

const REPORT_PERIODS = ['Mensual', 'Trimestral', 'Semestral', 'Anual', 'Personalizado']
import '../AdminUsers/AdminCensus.css'

const ENTITY_LABEL = { jugadores: 'Jugador', equipos: 'Equipo', torneos: 'Torneo' }

const PDF_FORMATS = [
  { key: 'profile', label: 'Ficha completa', desc: 'Una pagina por registro con todos los datos.' },
  { key: 'summary', label: 'Resumen', desc: 'Una pagina con graficas y totales.' },
  { key: 'table', label: 'Tabla', desc: 'Listado con las columnas elegidas.' },
]

// ── Configuración de cada área exportable ──
function buildAreaRecords(area, players, teamsData, toursData) {
  if (area === 'jugadores') {
    return players.map(p => ({ _id: p.id, _title: p.nick, _sub: `${p.realName} · ${p.mainGame}`, _img: p.avatar, raw: p }))
  }
  if (area === 'equipos') {
    return (teamsData || []).map(t => ({ _id: t.id, _title: t.name, _sub: `[${t.tag}] · ${t.game} · ${t.playerCount} jugadores`, _img: t.logo || null, raw: t }))
  }
  // torneos
  return (toursData || []).map(t => ({
    _id: t.id, _title: t.name, _sub: `${t.game} · ${t.uid}`, _img: null,
    raw: { ...t, publicId: t.uid, filled: t.registered, slots: t.capacity, prize: t.prizePool, cost: t.entryFee > 0 ? `$${t.entryFee}` : 'Gratis' },
  }))
}

const AREA_FIELDS = {
  jugadores: PLAYER_EXPORT_FIELDS,
  equipos: TEAM_EXPORT_FIELDS,
  torneos: TOURNAMENT_EXPORT_FIELDS,
}
const AREAS = [
  { key: 'jugadores', label: 'Jugadores', icon: Icon.users },
  { key: 'equipos', label: 'Equipos', icon: Icon.team },
  { key: 'torneos', label: 'Torneos', icon: Icon.trophy },
]

const TEAM_EXPORT_PRESETS = {
  executive: ['uid', 'name', 'tag', 'region', 'level', 'captain', 'coach', 'playerCount', 'status'],
  roster: ['uid', 'internalCode', 'name', 'captainName', 'captainGameId', 'captainCedula', 'captainDiscord', 'coach', 'manager', 'analyst', 'starters', 'substitutes', 'players'],
  identity: ['uid', 'internalCode', 'name', 'tag', 'region', 'category', 'level', 'lang', 'gender', 'sponsor', 'community', 'created', 'status'],
}

export default function AdminUserExport() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [players, setPlayers] = useState([])
  const [teamsData, setTeamsData] = useState([])
  const [toursData, setToursData] = useState([])
  const [area, setArea] = useState('jugadores')
  const [selectedIds, setSelectedIds] = useState([])
  const [keys, setKeys] = useState([])
  const [exportType, setExportType] = useState('pdf')
  const [pdfFormat, setPdfFormat] = useState('profile')
  const [tab, setTab] = useState('exportar')
  const [logs, setLogs] = useState([])
  const [reportPeriod, setReportPeriod] = useState('Mensual')

  const requestedBy = user?.nick || user?.email || 'Admin GlitchGang'
  const role = user?.role === 'admin' ? 'Administrador' : (user?.role || 'Administrador')
  const season = `${new Date().getFullYear()}-A`
  const today = useMemo(() => new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }), [])
  const exportId = useMemo(() => `GG-EXP-${String(Date.now()).slice(-7)}`, [])

  useEffect(() => {
    let alive = true
    api('/admin/census').then(res => {
      if (alive && Array.isArray(res.players)) setPlayers(res.players.map(adaptCensusRow))
    }).catch(() => toast('No se pudo cargar el censo', 'error'))
    api('/admin/teams').then(res => { if (alive && Array.isArray(res.teams)) setTeamsData(res.teams) }).catch(() => {})
    api('/admin/tournaments').then(res => { if (alive && Array.isArray(res.tournaments)) setToursData(res.tournaments) }).catch(() => {})
    loadExportLogs().then(rows => { if (alive) setLogs(rows) })
    return () => { alive = false }
  }, [])

  const fields = AREA_FIELDS[area]
  const records = useMemo(() => buildAreaRecords(area, players, teamsData, toursData), [area, players, teamsData, toursData])

  // Al cambiar de área: seleccionar todo + todos los campos (reporte completo por defecto)
  useEffect(() => {
    setSelectedIds(records.map(r => r._id))
    setKeys(fields.map(f => f.key))
  }, [area, players, teamsData, toursData]) // eslint-disable-line react-hooks/exhaustive-deps

  const groupedFields = useMemo(() => fields.reduce((acc, f) => {
    const sec = f.section || 'Datos'
    ;(acc[sec] = acc[sec] || []).push(f); return acc
  }, {}), [fields])

  const selectedRecords = useMemo(() => records.filter(r => selectedIds.includes(r._id)), [records, selectedIds])
  const togglePlayer = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const toggleKey = (k) => setKeys(prev => prev.includes(k) ? prev.filter(i => i !== k) : [...prev, k])

  const recordIdOf = (raws) => raws.length === 1 ? (raws[0].publicId || raws[0].uid || raws[0].id || '—') : `${raws.length} registros`

  const doExport = async () => {
    if (!selectedRecords.length) { toast('Selecciona al menos un registro', 'error'); return }
    if (!keys.length) { toast('Selecciona al menos un campo', 'error'); return }
    const raws = selectedRecords.map(r => r.raw)
    const areaLabel = AREAS.find(a => a.key === area)?.label || 'Reporte'

    if (exportType === 'csv') {
      if (area === 'jugadores') exportPlayersCsv(raws, keys)
      else if (area === 'equipos') exportTeamsCsv(raws, keys)
      else exportTournamentsCsv(raws, keys)
    } else {
      const opts = { keys, format: pdfFormat, requestedBy }
      if (area === 'jugadores') await exportPlayersPdf({ players: raws, ...opts })
      else if (area === 'equipos') await exportTeamsPdf({ teams: raws, ...opts })
      else await exportTournamentsPdf({ tournaments: raws, ...opts })
    }

    // Auditoría: registrar la descarga
    await logExport({
      action: exportType === 'pdf' ? `Exportación PDF (${pdfFormat})` : 'Exportación CSV',
      entity: ENTITY_LABEL[area] || areaLabel,
      recordId: recordIdOf(raws),
      fileType: exportType.toUpperCase(),
      period: today, season, count: raws.length,
    })
    loadExportLogs().then(setLogs)
    toast(`${areaLabel}: ${raws.length} registros a ${exportType.toUpperCase()}`, 'success')
  }

  const generateReport = async (kind, label) => {
    await exportReport(kind, { requestedBy, season: `${reportPeriod} ${new Date().getFullYear()}` })
    await logExport({ action: `Reporte ${label}`, entity: 'Reporte', recordId: kind, fileType: 'PDF', period: `${reportPeriod} ${today}`, season })
    loadExportLogs().then(setLogs)
    toast(`Reporte de ${label} generado`, 'success')
  }

  return (
    <div className="gg-admin-page gg-xport-page">
      <div className="gg-admin-page__header">
        <div>
          <button className="gg-census__export" style={{ marginBottom: 10 }} onClick={() => navigate('/admin/usuarios')}>{Icon.chevronRight} Volver a usuarios</button>
          <h2>Centro de exportacion</h2>
          <p>Genera un reporte por area. Elige los registros y omite los datos delicados que no quieras compartir.</p>
        </div>
        <div className="gg-census__exports">
          <button className="gg-xport__btn ghost" onClick={async () => {
            try { await downloadSystemExport(); toast('Export total del sistema descargado', 'success'); loadExportLogs().then(setLogs) }
            catch (err) { toast(err.message || 'No se pudo generar el export total', 'error') }
          }}>{Icon.shield} Export total</button>
          <button className="gg-xport__btn primary" onClick={doExport} disabled={!keys.length || !selectedRecords.length}>
            {exportType === 'pdf' ? Icon.fileText : Icon.download} Descargar {exportType === 'pdf' ? 'PDF' : 'CSV'}
          </button>
        </div>
      </div>

      <div className="gg-xport__areas gg-xport__tabs">
        <button className={`gg-xport__area ${tab === 'exportar' ? 'on' : ''}`} onClick={() => setTab('exportar')}>{Icon.download}<span>Exportar</span></button>
        <button className={`gg-xport__area ${tab === 'reportes' ? 'on' : ''}`} onClick={() => setTab('reportes')}>{Icon.chartBar}<span>Reportes</span></button>
        <button className={`gg-xport__area ${tab === 'historial' ? 'on' : ''}`} onClick={() => { loadExportLogs().then(setLogs); setTab('historial') }}>{Icon.clock}<span>Historial / Auditoria ({logs.length})</span></button>
      </div>

      {tab === 'reportes' && (
        <div className="gg-reports">
          <div className="gg-reports__bar">
            <div><h3>Reportes administrativos</h3><p>Genera reportes oficiales por periodo con el formato del expediente.</p></div>
            <label className="gg-reports__period">Periodo
              <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}>{REPORT_PERIODS.map(p => <option key={p}>{p}</option>)}</select>
            </label>
          </div>
          <div className="gg-reports__grid">
            {REPORT_TYPES.map(r => (
              <div key={r.key} className="gg-reports__card">
                <div className="gg-reports__icon">{Icon.chartBar}</div>
                <h4>{r.label}</h4>
                <p>{r.desc}</p>
                <button className="gg-xport__btn primary" onClick={() => generateReport(r.key, r.label)}>{Icon.fileText} Generar PDF</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'exportar' && (<>
      {/* Datos permanentes del documento */}
      <div className="gg-xport__permabar">
        <div><span>ID de exportacion</span><b>{exportId}</b></div>
        <div><span>Solicitante</span><b>{requestedBy}</b></div>
        <div><span>Rol</span><b>{role}</b></div>
        <div><span>Fecha</span><b>{today}</b></div>
      </div>

      {/* Selector de área */}
      <div className="gg-xport__areas">
        {AREAS.map(a => (
          <button key={a.key} className={`gg-xport__area ${area === a.key ? 'on' : ''}`} onClick={() => setArea(a.key)}>
            {a.icon}<span>{a.label}</span>
          </button>
        ))}
      </div>

      <div className="gg-xport__body gg-xport__body--page">
        <div className="gg-xport__main">
          <div className="gg-xport__panel gg-xport__panel--soft">
            <div className="gg-xport__section-head"><div><h4>Formato</h4><p>Como quieres el archivo de {AREAS.find(a => a.key === area)?.label.toLowerCase()}.</p></div></div>
            <div className="gg-xport__modes">
              <button className={exportType === 'pdf' ? 'active' : ''} onClick={() => setExportType('pdf')}>{Icon.fileText} PDF</button>
              <button className={exportType === 'csv' ? 'active' : ''} onClick={() => setExportType('csv')}>{Icon.download} CSV</button>
            </div>
            {exportType === 'pdf' && (
              <div className="gg-xport__formats gg-xport__formats--compact">
                {PDF_FORMATS.map(f => (
                  <button key={f.key} className={pdfFormat === f.key ? 'active' : ''} onClick={() => setPdfFormat(f.key)}>
                    <b>{f.label}</b><span>{f.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {area === 'equipos' && (
            <div className="gg-xport__panel gg-xport__panel--team">
              <div className="gg-xport__section-head">
                <div>
                  <h4>Exportacion completa de equipos</h4>
                  <p>Ahora puedes incluir codigos del equipo, capitan, staff, titulares, suplentes, cedula, game ID y Discord del roster.</p>
                </div>
                <div className="gg-xport__quick">
                  <button onClick={() => setKeys(TEAM_EXPORT_PRESETS.executive.filter(key => fields.some(field => field.key === key)))}>Ejecutivo</button>
                  <button onClick={() => setKeys(TEAM_EXPORT_PRESETS.roster.filter(key => fields.some(field => field.key === key)))}>Roster completo</button>
                  <button onClick={() => setKeys(TEAM_EXPORT_PRESETS.identity.filter(key => fields.some(field => field.key === key)))}>Identidad</button>
                </div>
              </div>
              <div className="gg-xport__team-perks">
                <span>ID público e interno</span>
                <span>Capitán y datos del staff</span>
                <span>Game ID, cedula y Discord</span>
                <span>Titulares y suplentes por equipo</span>
              </div>
            </div>
          )}

          <div className="gg-xport__panel">
            <div className="gg-xport__section-head">
              <div><h4>Registros</h4><p>Que {AREAS.find(a => a.key === area)?.label.toLowerCase()} entran en el reporte.</p></div>
              <div className="gg-xport__quick">
                <button onClick={() => setSelectedIds(records.map(r => r._id))}>Todos</button>
                <button onClick={() => setSelectedIds([])}>Limpiar</button>
              </div>
            </div>
            <div className="gg-xport__players">
              {records.map(r => (
                <label key={r._id} className={`gg-xport__player ${selectedIds.includes(r._id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={selectedIds.includes(r._id)} onChange={() => togglePlayer(r._id)} />
                  <span className="gg-xport__check">{selectedIds.includes(r._id) && Icon.check}</span>
                  {r._img ? <img src={r._img} alt={r._title} /> : <span className="gg-xport__avatar">{String(r._title).slice(0, 2).toUpperCase()}</span>}
                  <div><b>{r._title}</b><small>{r._sub}</small></div>
                </label>
              ))}
              {records.length === 0 && <p className="gg-xport__empty">No hay registros en esta area.</p>}
            </div>
          </div>

          <div className="gg-xport__panel">
            <div className="gg-xport__section-head">
              <div><h4>Datos a incluir</h4><p>Desmarca lo que sea delicado para omitirlo del reporte.</p></div>
              <div className="gg-xport__quick">
                <button onClick={() => setKeys(fields.map(f => f.key))}>Todo</button>
                <button onClick={() => setKeys(fields.slice(0, 6).map(f => f.key))}>Minimo</button>
                <button onClick={() => setKeys([])}>Ninguno</button>
              </div>
            </div>
            <div className="gg-xport__field-groups">
              {Object.entries(groupedFields).map(([section, gfields]) => (
                <div key={section} className="gg-xport__field-group">
                  <div className="gg-xport__field-group-head">
                    <b>{section}</b>
                    <button onClick={() => {
                      const gk = gfields.map(f => f.key)
                      const allOn = gk.every(k => keys.includes(k))
                      setKeys(prev => allOn ? prev.filter(k => !gk.includes(k)) : [...new Set([...prev, ...gk])])
                    }}>{gfields.every(f => keys.includes(f.key)) ? 'Quitar grupo' : 'Usar grupo'}</button>
                  </div>
                  <div className="gg-xport__chips">
                    {gfields.map(f => (
                      <label key={f.key} className={`gg-xport__chip ${keys.includes(f.key) ? 'on' : ''}`}>
                        <input type="checkbox" checked={keys.includes(f.key)} onChange={() => toggleKey(f.key)} />
                        <span>{f.label}</span>
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
                <div><b>GlitchGang</b><small>Reporte oficial</small></div>
              </div>
              <span className="gg-xport__preview-badge">{exportType === 'pdf' ? 'PDF' : 'CSV'}</span>
            </div>
            <div className="gg-xport__preview-header">
              <h4>Reporte de {AREAS.find(a => a.key === area)?.label}</h4>
              <p>Documento generado desde la plataforma de gestión de Steliant Esports.</p>
            </div>
            <div className="gg-xport__preview-meta">
              <div><span>ID exportación</span><b>{exportId}</b></div>
              <div><span>Solicitante</span><b>{requestedBy}</b></div>
              <div><span>Registros</span><b>{selectedRecords.length}</b></div>
              <div><span>Campos</span><b>{keys.length} de {fields.length}</b></div>
            </div>
            <div className="gg-xport__preview-block">
              <span>Incluidos</span>
              <div className="gg-xport__preview-tags">
                {selectedRecords.slice(0, 8).map(r => <em key={r._id}>{r._title}</em>)}
                {selectedRecords.length > 8 && <em>+{selectedRecords.length - 8} mas</em>}
                {selectedRecords.length === 0 && <em>Ninguno seleccionado</em>}
              </div>
            </div>
            <div className="gg-xport__preview-block">
              <span>Datos a mostrar</span>
              <div className="gg-xport__preview-tags">
                {fields.filter(f => keys.includes(f.key)).slice(0, 10).map(f => <em key={f.key}>{f.label}</em>)}
                {keys.length > 10 && <em>+{keys.length - 10} mas</em>}
                {keys.length === 0 && <em>Sin datos</em>}
              </div>
            </div>
            <div className="gg-xport__preview-block">
              <span>Pagina final</span>
              <div className="gg-xport__preview-list">
                <div><small>Incluye</small><b>Codigo QR + link</b></div>
                <div><small>Verificacion</small><b>glitchgang.gg/verificar</b></div>
                {area === 'equipos' && <div><small>Extra</small><b>Roster + staff + codigos</b></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
      </>)}

      {tab === 'historial' && <AuditView logs={logs} onClear={() => { loadExportLogs().then(setLogs) }} />}
    </div>
  )
}

function AuditView({ logs, onClear }) {
  return (
    <div className="gg-audit">
      <div className="gg-audit__head">
        <div><h3>Historial de exportaciones y auditoria</h3><p>{logs.length} registro(s) · nada se elimina automaticamente</p></div>
        {logs.length > 0 && <button className="gg-xport__btn ghost" onClick={onClear}>{Icon.clock} Recargar</button>}
      </div>
      {logs.length === 0 ? (
        <div className="gg-audit__empty">{Icon.clock}<p>Aún no hay exportaciones registradas. Cada descarga quedará aquí con su LOG, usuario, IP, entidad y fecha.</p></div>
      ) : (
        <div className="gg-audit__wrap">
          <table className="gg-audit__table">
            <thead><tr><th>LOG</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Entidad</th><th>ID</th><th>Archivo</th><th>Registros</th><th>Temporada</th><th>Fecha</th><th>Hora</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td><code>{l.id}</code></td>
                  <td><b>{l.user}</b></td>
                  <td>{l.role}</td>
                  <td>{l.action}</td>
                  <td>{l.entity}</td>
                  <td><code>{l.recordId}</code></td>
                  <td><span className="gg-audit__file">{l.fileType}</span></td>
                  <td>{l.count}</td>
                  <td>{l.season}</td>
                  <td>{l.date}</td>
                  <td>{l.time}</td>
                  <td><code>{l.ip}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

