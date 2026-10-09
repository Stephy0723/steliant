import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { countBy } from '../../../lib/reportKit.js'
import { api } from '../../../lib/api.js'
import { adaptCensusRow } from '../../../data/playersCensus.js'
import { adaptTournament } from '../../../lib/tournamentExport.js'
import {
  EXPORT_ENTITIES, ENTITY_LIST, SECTION_LIBRARY, COVER_BLOCKS,
  CONFIDENTIALITY_LEVELS, CLASSIFICATIONS, PDF_VARIANTS, THEME_ACCENTS,
} from '../../../data/exportEntities.js'
import { exportSmartReport, exportSmartCsv, estimateSmartReport } from '../../../lib/smartReport.js'
import { logExport, loadExportLogs } from '../../../lib/exportLog.js'
import { toast } from '../../../lib/toast.js'
import './AdminExportCenter.css'

// Presets de secciones por variante de PDF (orden + activación inicial)
const VARIANT_SECTIONS = {
  ejecutivo: ['portada', 'resumen', 'estadisticas', 'graficos', 'firmas'],
  expediente: ['portada', 'resumen', 'fichas', 'tabla', 'auditoria'],
  administrativo: ['portada', 'resumen', 'estadisticas', 'fichas', 'tabla', 'auditoria', 'firmas'],
  auditoria: ['portada', 'resumen', 'tabla', 'auditoria', 'firmas'],
  comercial: ['portada', 'resumen', 'estadisticas', 'graficos', 'galeria'],
  personalizado: SECTION_LIBRARY.map(s => s.key),
}
const SECTION_META = Object.fromEntries(SECTION_LIBRARY.map(s => [s.key, s]))
const SECTION_HINT = {
  portada: 'Carátula del documento', estadisticas: 'Indicadores y métricas clave',
  graficos: 'Distribuciones por categoría', fichas: 'Una ficha completa por registro',
  tabla: 'Listado general de datos', galeria: 'Evidencias visuales', evidencias: 'Soportes y comprobantes',
  historial: 'Línea de tiempo', anexos: 'Documentación complementaria', documentos: 'Referencias cruzadas',
  firmas: 'Aprobación y conformidad', auditoria: 'Trazabilidad de generación', cierre: 'Cierre y verificación',
}
const previewSpan = (key, n) => key === 'tabla' ? Math.max(1, Math.ceil(n / 30)) : key === 'fichas' ? Math.max(1, Math.min(n, 80)) : 1

function buildSections(variant) {
  const preset = VARIANT_SECTIONS[variant] || VARIANT_SECTIONS.administrativo
  const ordered = [...preset, ...SECTION_LIBRARY.map(s => s.key).filter(k => !preset.includes(k))]
  return ordered.map(key => ({ key, label: SECTION_META[key].label, enabled: preset.includes(key) }))
}

// Registros reales de cada entidad (ver data/exportEntities.js).
async function fetchRecords(entityKey) {
  if (entityKey === 'jugadores') return ((await api('/admin/census')).players || []).map(adaptCensusRow)
  if (entityKey === 'equipos') return (await api('/admin/teams')).teams || []
  if (entityKey === 'torneos') return ((await api('/admin/tournaments')).tournaments || []).map((t, i) => adaptTournament(t, i))
  return (await api(`/admin/export/${entityKey}`)).records || []
}

const SCOPES = [
  { key: 'all', label: 'Todos los registros' },
  { key: 'season', label: 'Temporada actual' },
  { key: 'manual', label: 'Selección manual' },
]

export default function AdminExportCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const requestedBy = user?.nick || user?.email || 'Admin GlitchGang'
  const role = user?.role === 'admin' ? 'Administrador' : (user?.role || 'Administrador')
  const season = `${new Date().getFullYear()}-A`

  // ── Estado del constructor ──
  const [entityKey, setEntityKey] = useState('jugadores')
  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [entityCounts, setEntityCounts] = useState({})
  const [scope, setScope] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [columns, setColumns] = useState(EXPORT_ENTITIES.jugadores.defaultColumns)
  const [variant, setVariant] = useState('administrativo')
  const [sections, setSections] = useState(() => buildSections('administrativo'))
  const [coverBlocks, setCoverBlocks] = useState(() => Object.fromEntries(COVER_BLOCKS.map(b => [b.key, b.def])))
  const [coverText, setCoverText] = useState({ title: '', subtitle: 'Documento oficial generado por la plataforma GlitchGang', period: `Temporada ${season}` })
  const [coverImages, setCoverImages] = useState({ background: null, companyLogo: null, eventLogo: null })
  const [intro, setIntro] = useState({ enabled: true, ...EXPORT_ENTITIES.jugadores.intro })
  const [theme, setTheme] = useState('glitch')
  const [classification, setClassification] = useState('Operativo')
  const [confidentiality, setConfidentiality] = useState('Uso interno')
  const [format, setFormat] = useState('pdf')

  const [propTab, setPropTab] = useState('documento')
  const [pageIdx, setPageIdx] = useState(0)
  const [zoom, setZoom] = useState(0.62)
  const [view, setView] = useState('builder') // builder | history
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)

  const entity = EXPORT_ENTITIES[entityKey]
  const dragIndex = useRef(null)

  // Conteos dinámicos por entidad (Sección 2)
  useEffect(() => {
    Promise.all([
      api('/admin/export-counts').catch(() => ({ counts: {} })),
      api('/admin/summary').catch(() => null),
    ]).then(([res, summary]) => setEntityCounts({
      ...(res.counts || {}),
      jugadores: summary?.totals?.users,
      equipos: summary?.totals?.teams,
      torneos: summary?.totals?.tournaments,
    }))
    loadExportLogs().then(setLogs)
  }, [])

  // ── Cambio de entidad: recargar todo ──
  useEffect(() => {
    let alive = true
    setRecords([])
    setLoadingRecords(true)
    setColumns(EXPORT_ENTITIES[entityKey].defaultColumns)
    setIntro({ enabled: true, ...EXPORT_ENTITIES[entityKey].intro })
    setCoverText(c => ({ ...c, title: `Reporte de ${EXPORT_ENTITIES[entityKey].label}` }))
    setScope('all'); setSearch('')
    fetchRecords(entityKey)
      .then(rows => { if (alive) setRecords(rows) })
      .catch(() => { if (alive) toast(`No se pudieron cargar los registros de ${EXPORT_ENTITIES[entityKey].label}`, 'error') })
      .finally(() => { if (alive) setLoadingRecords(false) })
    return () => { alive = false }
  }, [entityKey])

  // Registros tras filtros de alcance
  const scopedRecords = useMemo(() => {
    let out = records
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r => entity.identify(r).title?.toLowerCase().includes(q) || JSON.stringify(r).toLowerCase().includes(q))
    }
    return out
  }, [records, search, entity])

  // Selección efectiva
  useEffect(() => { setSelectedIds(scopedRecords.map(r => entity.identify(r).id)) }, [scopedRecords]) // eslint-disable-line

  const selectedRecords = useMemo(() => {
    if (scope === 'manual') return scopedRecords.filter(r => selectedIds.includes(entity.identify(r).id))
    return scopedRecords
  }, [scopedRecords, selectedIds, scope, entity])

  const columnDefs = useMemo(() => columns.map(k => entity.fields.find(f => f.key === k)).filter(Boolean), [columns, entity])
  const groupedFields = useMemo(() => entity.fields.reduce((acc, fdef) => {
    const s = fdef.section || 'Datos'; (acc[s] = acc[s] || []).push(fdef); return acc
  }, {}), [entity])

  const enabledSections = useMemo(() => sections.filter(s => s.enabled), [sections])
  const pageCount = enabledSections.length + 1 // + cierre
  useEffect(() => { if (pageIdx > pageCount - 1) setPageIdx(0) }, [pageCount]) // eslint-disable-line

  const accentRgb = THEME_ACCENTS.find(t => t.key === theme)?.rgb || THEME_ACCENTS[0].rgb
  const accentCss = `rgb(${accentRgb.join(',')})`

  const estimate = useMemo(() => estimateSmartReport({ records: selectedRecords, columns: columnDefs, sections }),
    [selectedRecords, columnDefs, sections])

  const buildInput = () => ({
    entity, entityLabel: entity.label, records: selectedRecords,
    fields: columnDefs, columns: columnDefs, sections,
    cover: { blocks: coverBlocks, title: coverText.title, subtitle: coverText.subtitle, period: coverText.period, images: coverImages },
    intro, theme: accentRgb,
    meta: { requestedBy, role, season, classification, confidentiality, docType: PDF_VARIANTS.find(v => v.key === variant)?.label || 'Reporte' },
  })

  // ── Acciones ──
  const toggleColumn = (k) => setColumns(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k])
  const moveColumn = (k, dir) => setColumns(prev => {
    const i = prev.indexOf(k); if (i < 0) return prev
    const j = i + dir; if (j < 0 || j >= prev.length) return prev
    const next = [...prev];[next[i], next[j]] = [next[j], next[i]]; return next
  })
  const toggleSection = (key) => setSections(prev => prev.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s))
  const onSectionDrop = (target) => setSections(prev => {
    const from = dragIndex.current; if (from == null || from === target) return prev
    const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(target, 0, moved)
    dragIndex.current = null; return next
  })

  const doExport = async () => {
    if (!selectedRecords.length) { toast('Selecciona al menos un registro', 'error'); return }
    if (!columns.length) { toast('Selecciona al menos una columna', 'error'); return }
    if (!enabledSections.length) { toast('Activa al menos una sección', 'error'); return }
    setBusy(true)
    try {
      const input = buildInput()
      let printCode = '—'
      if (format === 'csv') { exportSmartCsv(input) }
      else { const res = await exportSmartReport(input); printCode = res.printCode }
      await logExport({
          action: format === 'pdf' ? `Reporte ${PDF_VARIANTS.find(v => v.key === variant)?.label}` : 'Exportación CSV',
        entity: entity.label, recordId: printCode, fileType: format.toUpperCase(),
        period: coverText.period, season, count: selectedRecords.length, printCode,
      })
      loadExportLogs().then(setLogs)
      toast(`${entity.label}: ${selectedRecords.length} registros · ${format.toUpperCase()} generado`, 'success')
    } catch (e) {
      console.error(e); toast('No se pudo generar el documento', 'error')
    } finally { setBusy(false) }
  }

  const regenerateIntro = () => setIntro(i => ({ ...i, ...EXPORT_ENTITIES[entityKey].intro }))

  const onPickImage = (key) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Selecciona un archivo de imagen', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('La imagen supera 5 MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => { setCoverImages(c => ({ ...c, [key]: reader.result })); toast('Imagen cargada', 'success') }
    reader.onerror = () => toast('No se pudo leer la imagen', 'error')
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const clearImage = (key) => setCoverImages(c => ({ ...c, [key]: null }))

  // ════════ Render ════════
  return (
    <div className="gg-ec" style={{ '--ec-accent': accentCss }}>
      {/* Cabecera */}
      <header className="gg-ec__top">
        <div className="gg-ec__top-l">
          <button className="gg-ec__back" onClick={() => navigate('/admin')}>{Icon.chevronRight} Panel</button>
          <div>
            <h1>{Icon.layoutGrid} Centro de Exportación Inteligente</h1>
            <p>Construye reportes corporativos a medida y visualiza el PDF en tiempo real antes de generarlo.</p>
          </div>
        </div>
        <div className="gg-ec__top-r">
          <button className={`gg-ec__seg ${view === 'builder' ? 'on' : ''}`} onClick={() => setView('builder')}>{Icon.edit} Constructor</button>
          <button className={`gg-ec__seg ${view === 'history' ? 'on' : ''}`} onClick={() => { loadExportLogs().then(setLogs); setView('history') }}>{Icon.clock} Exportaciones ({logs.length})</button>
        </div>
      </header>

      {view === 'history' ? (
        <ExportHistory logs={logs} onClear={() => { loadExportLogs().then(setLogs) }} />
      ) : (
        <div className="gg-ec__grid">
          {/* ───────── Columna izquierda: Configuración ───────── */}
          <aside className="gg-ec__col gg-ec__col--cfg">
            <Section title="Tipo de reporte" icon={Icon.list}>
              <div className="gg-ec__entities">
                {ENTITY_LIST.map(e => (
                  <button key={e.key} className={`gg-ec__entity ${entityKey === e.key ? 'on' : ''}`} onClick={() => setEntityKey(e.key)}>
                    <span className="gg-ec__entity-ic">{Icon[e.iconKey] || Icon.star}</span>
                    <span className="gg-ec__entity-tx"><b>{e.label}</b><small>{entityCounts[e.key] ?? '…'} registros</small></span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Alcance" icon={Icon.target}>
              <div className="gg-ec__scopes">
                {SCOPES.map(s => (
                  <button key={s.key} className={`gg-ec__pill ${scope === s.key ? 'on' : ''}`} onClick={() => setScope(s.key)}>{s.label}</button>
                ))}
              </div>
              <div className="gg-ec__search">
                {Icon.search}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Filtrar ${entity.label.toLowerCase()}…`} />
              </div>
              <div className="gg-ec__counters">
                <div><b>{scopedRecords.length}</b><span>{entity.label} encontrados</span></div>
                <div className="accent"><b>{selectedRecords.length}</b><span>en el reporte</span></div>
              </div>
              {scope === 'manual' && (
                <div className="gg-ec__manual">
                  <div className="gg-ec__manual-head">
                    <span>Selección manual</span>
                    <div>
                      <button onClick={() => setSelectedIds(scopedRecords.map(r => entity.identify(r).id))}>Todos</button>
                      <button onClick={() => setSelectedIds([])}>Ninguno</button>
                    </div>
                  </div>
                  <div className="gg-ec__manual-list">
                    {scopedRecords.slice(0, 120).map(r => {
                      const id = entity.identify(r); const on = selectedIds.includes(id.id)
                      return (
                        <label key={id.id} className={on ? 'on' : ''}>
                          <input type="checkbox" checked={on} onChange={() => setSelectedIds(p => on ? p.filter(x => x !== id.id) : [...p, id.id])} />
                          <span className="gg-ec__chk">{on && Icon.check}</span>
                          <span className="gg-ec__manual-tx"><b>{id.title}</b><small>{id.sub}</small></span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </Section>

            <Section title="Secciones del documento" icon={Icon.layoutGrid} hint="Arrastra para reordenar · activa o desactiva">
              <div className="gg-ec__sections">
                {sections.map((s, i) => (
                  <div
                    key={s.key}
                    className={`gg-ec__sec ${s.enabled ? 'on' : ''}`}
                    draggable
                    onDragStart={() => { dragIndex.current = i }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onSectionDrop(i)}
                  >
                    <span className="gg-ec__sec-grip">{Icon.moreVertical}</span>
                    <span className="gg-ec__sec-ic">{Icon[SECTION_META[s.key].icon] || Icon.fileText}</span>
                    <span className="gg-ec__sec-tx"><b>{s.label}</b><small>{SECTION_META[s.key].desc}</small></span>
                    <button className={`gg-ec__sec-toggle ${s.enabled ? 'on' : ''}`} onClick={() => toggleSection(s.key)} disabled={SECTION_META[s.key].fixed} title={SECTION_META[s.key].fixed ? 'Obligatoria' : 'Activar/desactivar'}>
                      <span />
                    </button>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Formato y variante" icon={Icon.fileText}>
              <div className="gg-ec__modes">
                <button className={format === 'pdf' ? 'on' : ''} onClick={() => setFormat('pdf')}>{Icon.fileText} PDF</button>
                <button className={format === 'csv' ? 'on' : ''} onClick={() => setFormat('csv')}>{Icon.download} CSV</button>
              </div>
              {format === 'pdf' && (
                <div className="gg-ec__variants">
                  {PDF_VARIANTS.map(v => (
                    <button key={v.key} className={variant === v.key ? 'on' : ''} onClick={() => { setVariant(v.key); setSections(buildSections(v.key)) }}>
                      <b>{v.label}</b><span>{v.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </aside>

          {/* ───────── Columna central: Vista previa ───────── */}
          <main className="gg-ec__col gg-ec__col--preview">
            <div className="gg-ec__pv-bar">
              <div className="gg-ec__pv-nav">
                <button onClick={() => setPageIdx(i => Math.max(0, i - 1))} disabled={pageIdx === 0}>{Icon.chevronRight}</button>
                <span>Página {pageIdx + 1} de {pageCount}</span>
                <button onClick={() => setPageIdx(i => Math.min(pageCount - 1, i + 1))} disabled={pageIdx >= pageCount - 1}>{Icon.chevronRight}</button>
              </div>
              <div className="gg-ec__pv-zoom">
                <button onClick={() => setZoom(z => Math.max(0.4, +(z - 0.08).toFixed(2)))}>−</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(1, +(z + 0.08).toFixed(2)))}>+</button>
              </div>
            </div>

            <div className="gg-ec__pv-stage">
              <div className="gg-ec__page" style={{ transform: `scale(${zoom})` }}>
                <PreviewPage
                  index={pageIdx} sections={enabledSections} pageCount={pageCount}
                  entity={entity} records={selectedRecords} columns={columnDefs}
                  cover={coverText} coverBlocks={coverBlocks} coverImages={coverImages} intro={intro}
                  meta={{ requestedBy, role, season, classification, confidentiality, period: coverText.period }}
                  accent={accentCss}
                />
              </div>
            </div>

            <div className="gg-ec__thumbs">
              {Array.from({ length: pageCount }).map((_, i) => {
                const sec = i < enabledSections.length ? enabledSections[i] : { key: 'cierre', label: 'Cierre' }
                return (
                  <button key={i} className={`gg-ec__thumb ${pageIdx === i ? 'on' : ''}`} onClick={() => setPageIdx(i)}>
                    <span className="gg-ec__thumb-n">{i + 1}</span>
                    <span className="gg-ec__thumb-l">{sec.key === 'cierre' ? 'Cierre' : sec.label}</span>
                  </button>
                )
              })}
            </div>
          </main>

          {/* ───────── Columna derecha: Propiedades ───────── */}
          <aside className="gg-ec__col gg-ec__col--props">
            <div className="gg-ec__prop-tabs">
              {[['documento', 'Documento', Icon.list], ['portada', 'Portada', Icon.star], ['resumen', 'Intro', Icon.fileText], ['datos', 'Datos', Icon.layoutGrid], ['visual', 'Visual', Icon.palette]].map(([k, l, ic]) => (
                <button key={k} className={propTab === k ? 'on' : ''} onClick={() => setPropTab(k)}>{ic}<span>{l}</span></button>
              ))}
            </div>

            <div className="gg-ec__prop-body">
              {propTab === 'documento' && (
                <div className="gg-ec__prop">
                  <h4>Resumen del documento</h4>
                  <div className="gg-ec__kv"><span>Tipo</span><b>{entity.label}</b></div>
                  <div className="gg-ec__kv"><span>Registros</span><b>{selectedRecords.length}</b></div>
                  <div className="gg-ec__kv"><span>Columnas</span><b>{columns.length} de {entity.fields.length}</b></div>
                  <div className="gg-ec__kv"><span>Secciones</span><b>{enabledSections.length}</b></div>
                  <div className="gg-ec__kv"><span>Variante</span><b>{PDF_VARIANTS.find(v => v.key === variant)?.label}</b></div>
                  <div className="gg-ec__est">
                    <div><b>{estimate.pages}</b><span>páginas</span></div>
                    <div><b>~{estimate.sizeKb} KB</b><span>tamaño</span></div>
                    <div><b>~{estimate.seconds}s</b><span>generación</span></div>
                  </div>
                  <p className="gg-ec__hint">El documento incluye una portada corporativa y una página de cierre con código QR de verificación.</p>
                </div>
              )}

              {propTab === 'portada' && (
                <div className="gg-ec__prop">
                  <h4>Constructor de portada</h4>
                  <label className="gg-ec__inp"><span>Nombre del reporte</span>
                    <input value={coverText.title} onChange={e => setCoverText(c => ({ ...c, title: e.target.value }))} placeholder={`Reporte de ${entity.label}`} /></label>
                  <label className="gg-ec__inp"><span>Subtítulo</span>
                    <input value={coverText.subtitle} onChange={e => setCoverText(c => ({ ...c, subtitle: e.target.value }))} /></label>
                  <label className="gg-ec__inp"><span>Periodo</span>
                    <input value={coverText.period} onChange={e => setCoverText(c => ({ ...c, period: e.target.value }))} /></label>

                  <h5>Imágenes</h5>
                  <div className="gg-ec__uploads">
                    <ImagePicker label="Imagen de portada (fondo)" hint="Se usa como fondo fijo a página completa." value={coverImages.background} onPick={onPickImage('background')} onClear={() => clearImage('background')} wide />
                    <div className="gg-ec__uploads-row">
                      <ImagePicker label="Logo de empresa" value={coverImages.companyLogo} onPick={onPickImage('companyLogo')} onClear={() => clearImage('companyLogo')} />
                      <ImagePicker label="Logo del torneo / evento" value={coverImages.eventLogo} onPick={onPickImage('eventLogo')} onClear={() => clearImage('eventLogo')} />
                    </div>
                    <p className="gg-ec__hint">PNG, JPG o WEBP · hasta 5 MB. Los logos requieren tener activado su elemento abajo.</p>
                  </div>

                  <h5>Elementos de portada</h5>
                  <div className="gg-ec__checks">
                    {COVER_BLOCKS.map(b => (
                      <label key={b.key} className={coverBlocks[b.key] ? 'on' : ''}>
                        <input type="checkbox" checked={!!coverBlocks[b.key]} onChange={() => setCoverBlocks(c => ({ ...c, [b.key]: !c[b.key] }))} />
                        <span className="gg-ec__chk">{coverBlocks[b.key] && Icon.check}</span>{b.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {propTab === 'resumen' && (
                <div className="gg-ec__prop">
                  <div className="gg-ec__prop-head"><h4>Resumen ejecutivo</h4>
                    <button className="gg-ec__mini" onClick={regenerateIntro}>{Icon.bolt} Regenerar</button></div>
                  <label className="gg-ec__inp"><span>Título</span>
                    <input value={intro.title} onChange={e => setIntro(s => ({ ...s, title: e.target.value }))} /></label>
                  <label className="gg-ec__inp"><span>Texto ejecutivo</span>
                    <textarea rows={11} value={intro.body} onChange={e => setIntro(s => ({ ...s, body: e.target.value }))} /></label>
                  <p className="gg-ec__hint">Texto generado automáticamente según el tipo de reporte. Edítalo libremente; ocupa una página completa.</p>
                </div>
              )}

              {propTab === 'datos' && (
                <div className="gg-ec__prop">
                  <div className="gg-ec__prop-head"><h4>Campos y columnas</h4>
                    <div className="gg-ec__quick">
                      <button onClick={() => setColumns(entity.fields.map(f => f.key))}>Todos</button>
                      <button onClick={() => setColumns(entity.defaultColumns)}>Reset</button>
                      <button onClick={() => setColumns([])}>Ninguno</button>
                    </div>
                  </div>
                  {columns.length > 0 && (
                    <div className="gg-ec__order">
                      <span className="gg-ec__order-h">Orden de columnas (tabla)</span>
                      {columns.map((k, i) => {
                        const fdef = entity.fields.find(f => f.key === k)
                        return (
                          <div key={k} className="gg-ec__order-row">
                            <span className="gg-ec__order-n">{i + 1}</span>
                            <b>{fdef?.label || k}</b>
                            <div className="gg-ec__order-ctl">
                              <button onClick={() => moveColumn(k, -1)} disabled={i === 0}>↑</button>
                              <button onClick={() => moveColumn(k, 1)} disabled={i === columns.length - 1}>↓</button>
                              <button className="x" onClick={() => toggleColumn(k)}>✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <h5>Disponibles</h5>
                  {Object.entries(groupedFields).map(([sec, fl]) => (
                    <div key={sec} className="gg-ec__fgroup">
                      <div className="gg-ec__fgroup-h"><b>{sec}</b>
                        <button onClick={() => {
                          const gk = fl.map(x => x.key); const allOn = gk.every(k => columns.includes(k))
                          setColumns(prev => allOn ? prev.filter(k => !gk.includes(k)) : [...new Set([...prev, ...gk])])
                        }}>{fl.every(x => columns.includes(x.key)) ? 'Quitar' : 'Añadir'}</button>
                      </div>
                      <div className="gg-ec__chips">
                        {fl.map(fdef => (
                          <button key={fdef.key} className={`gg-ec__chip ${columns.includes(fdef.key) ? 'on' : ''}`} onClick={() => toggleColumn(fdef.key)}>{fdef.label}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {propTab === 'visual' && (
                <div className="gg-ec__prop">
                  <h4>Estilo corporativo</h4>
                  <h5>Color de acento</h5>
                  <div className="gg-ec__swatches">
                    {THEME_ACCENTS.map(t => (
                      <button key={t.key} className={`gg-ec__swatch ${theme === t.key ? 'on' : ''}`} onClick={() => setTheme(t.key)} title={t.label}>
                        <span style={{ background: `rgb(${t.rgb.join(',')})` }} />{t.label}
                      </button>
                    ))}
                  </div>
                  <label className="gg-ec__inp"><span>Clasificación</span>
                    <select value={classification} onChange={e => setClassification(e.target.value)}>{CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}</select></label>
                  <label className="gg-ec__inp"><span>Nivel de confidencialidad</span>
                    <select value={confidentiality} onChange={e => setConfidentiality(e.target.value)}>{CONFIDENTIALITY_LEVELS.map(c => <option key={c}>{c}</option>)}</select></label>
                  <div className="gg-ec__kv"><span>Solicitante</span><b>{requestedBy}</b></div>
                  <div className="gg-ec__kv"><span>Rol</span><b>{role}</b></div>
                  <div className="gg-ec__kv"><span>Temporada</span><b>{season}</b></div>
                </div>
              )}
            </div>

            <div className="gg-ec__actions">
              <button className="gg-ec__gen" onClick={doExport} disabled={busy || !selectedRecords.length}>
                {busy ? Icon.clock : (format === 'pdf' ? Icon.fileText : Icon.download)}
                {busy ? 'Generando…' : `Generar ${format.toUpperCase()}`}
              </button>
              <small>{estimate.pages} págs · {selectedRecords.length} registros · ~{estimate.sizeKb} KB</small>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

// ════════ Subcomponentes ════════
function Section({ title, icon, hint, children }) {
  return (
    <div className="gg-ec__block">
      <div className="gg-ec__block-h">{icon}<b>{title}</b>{hint && <small>{hint}</small>}</div>
      {children}
    </div>
  )
}

function PreviewPage({ index, sections, pageCount, entity, records, columns, cover, coverBlocks, coverImages = {}, intro, meta, accent }) {
  const sec = index < sections.length ? sections[index] : { key: 'cierre' }
  const k = sec.key
  let _p = 0
  const pageMap = sections.map(s => { const page = _p + 1; _p += previewSpan(s.key, records.length); return { key: s.key, label: s.label, page } })
  const Logo = ({ block, img, fallback, alt }) => block ? (
    img ? <img className="ggp-logoimg" src={img} alt={alt} /> : <span className={`ggp-logo ${fallback === 'EVT' ? 'ggp-logo--alt' : ''}`}>{fallback}</span>
  ) : null

  if (k === 'portada') {
    // Portada con imagen de fondo fija (full-bleed)
    if (coverImages.background) {
      return (
        <div className="ggp ggp--cover ggp--coverimg">
          <img className="ggp-cover-bg" src={coverImages.background} alt="" />
          <div className="ggp-cover-scrim" />
          <div className="ggp-img-top">
            <div className="ggp-cover-logos">
              <Logo block={coverBlocks.companyLogo} img={coverImages.companyLogo} fallback="GG" alt="Logo empresa" />
              <Logo block={coverBlocks.eventLogo} img={coverImages.eventLogo} fallback="EVT" alt="Logo evento" />
            </div>
            {coverBlocks.confidentiality && <span className="ggp-conf">{meta.confidentiality}</span>}
          </div>
          <div className="ggp-img-body">
            <span className="ggp-accent-bar" style={{ background: accent }} />
            {coverBlocks.classification && <span className="ggp-kicker" style={{ color: accent }}>Reporte {meta.classification}</span>}
            {coverBlocks.title && <h2>{cover.title || `Reporte de ${entity.label}`}</h2>}
            {coverBlocks.subtitle && <p className="ggp-sub">{cover.subtitle}</p>}
            <div className="ggp-meta ggp-meta--light">
              {coverBlocks.user && <div><span>Generado por</span><b>{meta.requestedBy}</b></div>}
              {coverBlocks.date && <div><span>Fecha</span><b>{new Date().toLocaleDateString('es-DO')}</b></div>}
              {coverBlocks.period && <div><span>Periodo</span><b>{cover.period}</b></div>}
              {coverBlocks.season && <div><span>Temporada</span><b>{meta.season}</b></div>}
              {coverBlocks.pdfId && <div><span>ID del PDF</span><b>GG-PRN-…</b></div>}
            </div>
            <div className="ggp-cover-foot">
              {coverBlocks.count && <div className="ggp-count ggp-count--light"><b>{records.length}</b><span>{entity.label.toLowerCase()}</span></div>}
              {coverBlocks.qr && <div className="ggp-qr ggp-qr--card" aria-hidden>{Array.from({ length: 36 }).map((_, i) => <i key={i} className={(i * 7 + 3) % 3 ? 'on' : ''} />)}</div>}
            </div>
            <span className="ggp-img-brand">STELIANT ESPORTS</span>
          </div>
        </div>
      )
    }
    return (
      <div className="ggp ggp--cover">
        <div className="ggp-cover-top">
          <div className="ggp-cover-logos">
            <Logo block={coverBlocks.companyLogo} img={coverImages.companyLogo} fallback="GG" alt="Logo empresa" />
            <Logo block={coverBlocks.eventLogo} img={coverImages.eventLogo} fallback="EVT" alt="Logo evento" />
          </div>
          {coverBlocks.confidentiality && <span className="ggp-conf">{meta.confidentiality}</span>}
          <span className="ggp-brand">STELIANT ESPORTS</span>
        </div>
        <div className="ggp-accent" />
        <div className="ggp-cover-body">
          {coverBlocks.classification && <span className="ggp-kicker">Reporte {meta.classification}</span>}
          {coverBlocks.title && <h2>{cover.title || `Reporte de ${entity.label}`}</h2>}
          {coverBlocks.subtitle && <p className="ggp-sub">{cover.subtitle}</p>}
          <p className="ggp-legal">Documento oficial generado por la plataforma GlitchGang. La información corresponde al periodo seleccionado y refleja los datos al momento de su generación.</p>
          <div className="ggp-meta">
            {coverBlocks.user && <div><span>Generado por</span><b>{meta.requestedBy}</b></div>}
            {coverBlocks.date && <div><span>Fecha</span><b>{new Date().toLocaleDateString('es-DO')}</b></div>}
            {coverBlocks.period && <div><span>Periodo</span><b>{cover.period}</b></div>}
            {coverBlocks.season && <div><span>Temporada</span><b>{meta.season}</b></div>}
            {coverBlocks.pdfId && <div><span>ID del PDF</span><b>GG-PRN-…</b></div>}
            {coverBlocks.classification && <div><span>Clasificación</span><b>{meta.classification}</b></div>}
          </div>
          <div className="ggp-cover-foot">
            {coverBlocks.count && <div className="ggp-count"><b>{records.length}</b><span>{entity.label.toLowerCase()}</span></div>}
            {coverBlocks.qr && <div className="ggp-qr" aria-hidden>{Array.from({ length: 36 }).map((_, i) => <i key={i} className={(i * 7 + 3) % 3 ? 'on' : ''} />)}</div>}
          </div>
        </div>
      </div>
    )
  }

  if (k === 'resumen') {
    const info = [
      ['Tipo de reporte', entity.label], ['Registros', records.length],
      ['Fecha', new Date().toLocaleDateString('es-DO')], ['Periodo', cover.period],
      ['Temporada', meta.season], ['Clasificación', meta.classification],
      ['Confidencialidad', meta.confidentiality], ['ID del documento', 'GG-PRN-…'],
      ['Generado por', meta.requestedBy], ['Rol', meta.role],
    ]
    const idx = pageMap.filter(e => e.key !== 'resumen')
    return (
      <div className="ggp ggp--doc">
        <PageHead title="Resumen ejecutivo" meta={meta} />
        <h3 className="ggp-h">{intro.title}</h3>
        <div className="ggp-2col">
          <p className="ggp-body">{intro.body}</p>
          <div className="ggp-infopanel">
            <div className="ggp-infopanel-h">Información del documento</div>
            {info.map(([l, v]) => <div key={l} className="ggp-inforow"><span>{l}</span><b>{v}</b></div>)}
          </div>
        </div>
        <span className="ggp-chart-t">Contenido del documento</span>
        <div className="ggp-index">
          {idx.map(e => (
            <div key={e.key} className="ggp-index-row">
              <b className="ggp-index-n">{String(e.page).padStart(2, '0')}</b>
              <div><b>{e.label}</b><small>{SECTION_HINT[e.key] || ''}</small></div>
            </div>
          ))}
        </div>
        <PageFoot meta={meta} />
      </div>
    )
  }

  if (k === 'estadisticas' || k === 'graficos') {
    const g = entity.statGroups || []
    const distinct = (grp) => grp ? new Set(records.map(r => { try { return grp.get(r) } catch { return '' } })).size : 0
    const top = g[0] && records.length ? countBy(records, g[0].get)[0] : null
    const kpis = [
      { v: records.length, l: entity.label, s: 'registros totales' },
      { v: distinct(g[0]), l: g[0]?.label.replace(/^Por /, '') || 'Cat.', s: 'valores distintos' },
      { v: distinct(g[1]), l: g[1]?.label.replace(/^Por /, '') || 'Grupos', s: 'valores distintos' },
      { v: columns.length, l: 'Columnas', s: `de ${entity.fields.length}` },
    ]
    return (
      <div className="ggp ggp--doc">
        <PageHead title={k === 'graficos' ? 'Gráficos' : 'Estadísticas'} meta={meta} />
        <h3 className="ggp-h">{k === 'graficos' ? 'Distribuciones' : 'Indicadores clave'}</h3>
        {k === 'estadisticas' && <>
          <div className="ggp-kpis2">
            {kpis.map((kp, i) => <div key={i}><span className="ggp-kpi-h">{kp.l}</span><b>{kp.v}</b><em>{kp.s}</em></div>)}
          </div>
          {top && <div className="ggp-highlight">
            <div><span>Categoría principal</span><b>{top[0]}</b></div>
            <div className="r"><b>{top[1]}</b><span>{Math.round(top[1] / records.length * 100)}% del total</span></div>
          </div>}
        </>}
        <div className="ggp-rankcols">
          {g.map(grp => {
            const data = countBy(records, grp.get).slice(0, 6)
            const max = Math.max(...data.map(d => d[1]), 1)
            return (
              <div key={grp.label} className="ggp-rankcol">
                <span className="ggp-chart-t">{grp.label}</span>
                {data.map(([label, v], i) => (
                  <div key={label} className="ggp-rank">
                    <span className={`ggp-rank-n ${i === 0 ? 'top' : ''}`} style={i === 0 ? { background: accent } : undefined}>{i + 1}</span>
                    <div className="ggp-rank-b">
                      <div className="ggp-rank-l"><em>{label}</em><b>{v} · {Math.round(v / records.length * 100)}%</b></div>
                      <i><span style={{ width: `${(v / max) * 100}%`, background: accent }} /></i>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <PageFoot meta={meta} />
      </div>
    )
  }

  if (k === 'fichas') {
    const r = records[0]
    const id = r ? entity.identify(r) : { title: '—', sub: '', img: null }
    // La ficha siempre muestra TODOS los campos de la entidad (no solo las columnas de la tabla)
    const cols = entity.fields
    const groups = cols.reduce((acc, c) => { const s = c.section || 'Datos'; (acc[s] = acc[s] || []).push(c); return acc }, {})
    const SIDE = ['Identificadores', 'Redes sociales', 'Redes', 'Contacto', 'Pago', 'Pertenencias', 'Ubicación']
    const sideG = Object.entries(groups).filter(([s]) => SIDE.includes(s))
    const mainG = Object.entries(groups).filter(([s]) => !SIDE.includes(s))
    const val = (c) => { try { return String(c.get(r) ?? '-') } catch { return '-' } }
    const mainId = cols.find(c => /^(uid|publicId)$/.test(c.key)) || cols.find(c => /id$/i.test(c.key)) || cols[0]
    const statusC = cols.find(c => c.key === 'status')
    return (
      <div className="ggp ggp--cv">
        <div className="ggp-cv-head">
          {id.img ? <img className="ggp-cv-av" src={id.img} alt="" /> : <span className="ggp-cv-av is-ph">{String(id.title || '?').slice(0, 2).toUpperCase()}</span>}
          <div className="ggp-cv-name"><h2>{id.title}</h2><p>{id.sub || entity.label}</p></div>
          <div className="ggp-cv-id"><span>Identificador</span><b style={{ color: accent }}>{mainId ? val(mainId) : '—'}</b>{statusC && <em>{val(statusC)}</em>}</div>
          <span className="ggp-cv-accent" style={{ background: accent }} />
        </div>
        <div className="ggp-cv-body">
          <aside className="ggp-cv-side" style={{ borderLeftColor: accent }}>
            {sideG.length === 0 && <p className="ggp-cv-empty">Activa campos de Identificadores o Redes para la barra lateral.</p>}
            {sideG.map(([s, gc]) => (
              <div key={s} className="ggp-cv-sideblock">
                <span className="ggp-cv-st" style={{ color: accent }}>{s}</span>
                {gc.map(c => <div key={c.key} className="ggp-cv-srow"><span>{c.label}</span><b>{val(c)}</b></div>)}
              </div>
            ))}
          </aside>
          <main className="ggp-cv-main">
            {mainG.map(([s, gc]) => (
              <div key={s} className="ggp-cv-mblock">
                <span className="ggp-cv-mt">{s}</span>
                <div className="ggp-cv-mgrid">
                  {gc.map(c => <div key={c.key}><span>{c.label}</span><b>{val(c)}</b></div>)}
                </div>
              </div>
            ))}
          </main>
        </div>
        <div className="ggp-cv-foot"><span>{meta.requestedBy} · GG-PRN-…</span><span>Ficha 1 de {Math.min(records.length, 80)}</span></div>
      </div>
    )
  }

  if (k === 'tabla') {
    const cols = columns.slice(0, 7)
    return (
      <div className="ggp ggp--doc">
        <PageHead title={`Tabla de ${entity.label.toLowerCase()}`} meta={meta} />
        <h3 className="ggp-h">Listado de datos <small>{records.length} registros · {cols.length} columnas</small></h3>
        <table className="ggp-table">
          <thead><tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {records.slice(0, 14).map((r, i) => (
              <tr key={i}>{cols.map(c => { let v = '-'; try { v = String(c.get(r) ?? '-') } catch { v = '-' } return <td key={c.key}>{v.length > 24 ? v.slice(0, 23) + '…' : v}</td> })}</tr>
            ))}
          </tbody>
        </table>
        {records.length > 14 && <p className="ggp-more">+{records.length - 14} registros más en el PDF</p>}
        <PageFoot meta={meta} />
      </div>
    )
  }

  if (k === 'firmas') {
    return (
      <div className="ggp ggp--doc">
        <PageHead title="Firmas y aprobación" meta={meta} />
        <h3 className="ggp-h">Firmas y aprobación</h3>
        <p className="ggp-body">Los abajo firmantes dan conformidad al contenido del presente documento.</p>
        <div className="ggp-signs">
          {['Elaborado por', 'Revisado por', 'Aprobado por', 'Recibido por'].map(l => (
            <div key={l}><i /><b>{l === 'Elaborado por' ? meta.requestedBy : ' '}</b><span>{l}</span></div>
          ))}
        </div>
        <PageFoot meta={meta} />
      </div>
    )
  }

  if (k === 'auditoria') {
    const items = [['ID del documento', 'GG-PRN-…'], ['Generado por', meta.requestedBy], ['Rol', meta.role], ['Tipo', entity.label], ['Registros', records.length], ['Columnas', columns.length], ['Temporada', meta.season], ['Clasificación', meta.classification], ['Confidencialidad', meta.confidentiality]]
    return (
      <div className="ggp ggp--doc">
        <PageHead title="Auditoría" meta={meta} />
        <h3 className="ggp-h">Trazabilidad y auditoría</h3>
        <div className="ggp-audit">{items.map(([k2, v]) => <div key={k2}><span>{k2}</span><b>{v}</b></div>)}</div>
        <PageFoot meta={meta} />
      </div>
    )
  }

  if (k === 'cierre') {
    return (
      <div className="ggp ggp--cover ggp--close">
        <span className="ggp-logo ggp-logo--lg">GG</span>
        <h2>FIN DEL REPORTE</h2>
        <p className="ggp-sub">{cover.title || `Reporte de ${entity.label}`}</p>
        <div className="ggp-verify">
          <div className="ggp-qr ggp-qr--lg" aria-hidden>{Array.from({ length: 64 }).map((_, i) => <i key={i} className={(i * 5 + 2) % 3 ? 'on' : ''} />)}</div>
          <div><span>Código de verificación</span><b>GG-PRN-…</b><em>glitchgang.gg/verificar</em></div>
        </div>
      </div>
    )
  }

  // Secciones de marco (galería, evidencias, historial, anexos, documentos)
  const framed = SECTION_LIBRARY.find(s => s.key === k)
  return (
    <div className="ggp ggp--doc">
      <PageHead title={framed?.label || k} meta={meta} />
      <h3 className="ggp-h">{framed?.label || k}</h3>
      <p className="ggp-body">{framed?.desc}</p>
      <div className="ggp-slots">{Array.from({ length: 4 }).map((_, i) => <div key={i}><span>Espacio {i + 1}</span><em>Pendiente de adjuntar</em></div>)}</div>
      <PageFoot meta={meta} />
    </div>
  )
}

function ImagePicker({ label, hint, value, onPick, onClear, wide }) {
  return (
    <div className={`gg-ec__upload ${wide ? 'wide' : ''} ${value ? 'has' : ''}`}>
      <span className="gg-ec__upload-l">{label}</span>
      <label className="gg-ec__upload-drop">
        {value
          ? <img src={value} alt={label} />
          : <span className="gg-ec__upload-ph">{Icon.upload}<em>Subir imagen</em></span>}
        <input type="file" accept="image/*" onChange={onPick} hidden />
      </label>
      {hint && !value && <small>{hint}</small>}
      {value && <button className="gg-ec__upload-clear" onClick={onClear}>{Icon.trash} Quitar</button>}
    </div>
  )
}

function PageHead({ title, meta }) {
  return (
    <div className="ggp-head">
      <span className="ggp-head-brand">STELIANT ESPORTS</span>
      <span className="ggp-head-meta">{title} · {meta.period}</span>
    </div>
  )
}
function PageFoot({ meta }) {
  return <div className="ggp-foot"><span>{meta.requestedBy} · GG-PRN-…</span><span>glitchgang.gg · contacto@glitchgang.gg</span></div>
}

function ExportHistory({ logs, onClear }) {
  return (
    <div className="gg-ec__history">
      <div className="gg-ec__history-h">
        <div><h3>Centro de exportaciones</h3><p>{logs.length} documento(s) generado(s) · auditoría completa, nada se elimina automáticamente.</p></div>
        {logs.length > 0 && <button className="gg-ec__mini danger" onClick={onClear}>{Icon.clock} Recargar</button>}
      </div>
      {logs.length === 0 ? (
        <div className="gg-ec__history-empty">{Icon.clock}<p>Aún no hay exportaciones. Cada documento generado quedará registrado aquí con su ID, usuario, IP, entidad, registros y fecha.</p></div>
      ) : (
        <div className="gg-ec__history-wrap">
          <table className="gg-ec__history-table">
            <thead><tr><th>LOG</th><th>ID PDF</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Entidad</th><th>Archivo</th><th>Registros</th><th>Temporada</th><th>Fecha</th><th>Hora</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td><code>{l.id}</code></td><td><code>{l.printCode || l.recordId}</code></td>
                  <td><b>{l.user}</b></td><td>{l.role}</td><td>{l.action}</td><td>{l.entity}</td>
                  <td><span className="gg-ec__file">{l.fileType}</span></td><td>{l.count}</td><td>{l.season}</td>
                  <td>{l.date}</td><td>{l.time}</td><td><code>{l.ip}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

