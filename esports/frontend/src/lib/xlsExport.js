// ════════════════════════════════════════════════════════════
//  Export "tipo Excel" sin dependencias: genera un .xls (HTML que
//  Excel abre nativamente) con portada de marca, fecha de emisión,
//  anchos de columna, fila de totales y estilos profesionales.
//  Las celdas se fuerzan a texto (mso-number-format:\@) para no
//  perder ceros a la izquierda en los IDs (ej. país "01").
// ════════════════════════════════════════════════════════════

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function downloadXls(filename, html) {
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Columnas maestras del censo (key, label, ancho px, getter)
const list = (arr, key) => (arr || []).map(x => x[key]).join('  |  ') || '—'

export const PLAYER_EXPORT_COLUMNS = [
  { key: 'nick',         label: 'Nick',                 w: 120, get: p => p.nick },
  { key: 'realName',     label: 'Nombre real',          w: 160, get: p => p.realName },
  { key: 'email',        label: 'Email',                w: 180, get: p => p.email },
  { key: 'publicId',     label: 'ID jugador (público)', w: 130, get: p => p.publicId },
  { key: 'internalId',   label: 'ID jugador (extenso)', w: 170, get: p => p.internalId },
  { key: 'country',      label: 'País',                 w: 120, get: p => p.countryName },
  { key: 'countryNumber',label: 'ID país',              w: 70,  get: p => p.countryNumber },
  { key: 'mainGame',     label: 'Juego',                w: 140, get: p => p.mainGame },
  { key: 'level',        label: 'Nivel',                w: 60,  get: p => p.level },
  { key: 'rank',         label: 'Rank',                 w: 90,  get: p => p.rank },
  { key: 'plan',         label: 'Plan',                 w: 90,  get: p => p.plan },
  { key: 'planId',       label: 'ID plan',              w: 100, get: p => p.planId },
  { key: 'communities',  label: 'Comunidades',          w: 170, get: p => list(p.communities, 'name') },
  { key: 'communityIds', label: 'IDs comunidades',      w: 200, get: p => list(p.communities, 'id') },
  { key: 'teams',        label: 'Equipos',              w: 150, get: p => list(p.teams, 'name') },
  { key: 'teamIds',      label: 'IDs equipos',          w: 150, get: p => list(p.teams, 'id') },
  { key: 'university',   label: 'Universidad',          w: 200, get: p => p.university ? p.university.name : '—' },
  { key: 'universityId', label: 'ID univ. (abreviado)', w: 150, get: p => p.university ? p.university.id : '—' },
  { key: 'universityInternalId', label: 'ID univ. (extenso)', w: 180, get: p => p.university ? p.university.internalId : '—' },
  { key: 'role',         label: 'Rol',                  w: 90,  get: p => p.role },
  { key: 'status',       label: 'Estado',               w: 90,  get: p => p.status },
  { key: 'joined',       label: 'Registro',             w: 110, get: p => p.joined },
  { key: 'lastActive',   label: 'Última act.',          w: 110, get: p => p.lastActive },
  { key: 'matches',      label: 'Partidas',             w: 80,  get: p => p.matches },
  { key: 'winrate',      label: 'Win rate',             w: 80,  get: p => `${p.winrate}%` },
  { key: 'earnings',     label: 'Ganancias',            w: 100, get: p => `$${Number(p.earnings || 0).toLocaleString()}` },
  { key: 'verified',     label: 'Verificado',           w: 90,  get: p => p.verified ? 'Sí' : 'No' },
]

export const DEFAULT_EXPORT_KEYS = PLAYER_EXPORT_COLUMNS.map(c => c.key)

/**
 * Exporta el censo a .xls. `keys` = columnas seleccionadas (orden maestro).
 */
export function exportPlayersXls(players, keys = DEFAULT_EXPORT_KEYS) {
  const cols = PLAYER_EXPORT_COLUMNS.filter(c => keys.includes(c.key))
  if (!cols.length) return
  const nCols = cols.length
  const accent = '#0d8f4f'   // verde del theme (tono impreso legible)
  const ink = '#0b0e14'
  const now = new Date()
  const emitted = now.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const emittedTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const colGroup = cols.map(c => `<col style="width:${c.w}px;mso-width-source:userset;">`).join('')

  const headCells = cols.map(c =>
    `<th style="background:${accent};color:#fff;font-weight:700;font-size:11px;border:1px solid #0a7a43;padding:8px 10px;text-align:left;white-space:nowrap;">${esc(c.label)}</th>`
  ).join('')

  const bodyRows = players.map((p, i) => {
    const bg = i % 2 ? '#f1f7f3' : '#ffffff'
    const tds = cols.map(c =>
      `<td style="mso-number-format:'\\@';background:${bg};border:1px solid #e3e8e5;padding:6px 10px;color:#1c2024;font-size:11px;">${esc(c.get(p))}</td>`
    ).join('')
    return `<tr>${tds}</tr>`
  }).join('')

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Censo de jugadores</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>5</x:SplitHorizontal><x:TopRowBottomPane>5</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body style="font-family:Calibri,Segoe UI,Arial,sans-serif;">
<table cellspacing="0" cellpadding="0" border="0">
  <colgroup>${colGroup}</colgroup>
  <tr><td colspan="${nCols}" style="background:${ink};color:#fff;font-size:22px;font-weight:800;padding:16px 14px;letter-spacing:1px;">&#9889; STELIANT ESPORTS <span style="font-weight:400;font-size:13px;color:#a99cff;">&#160;&#160;Esports Platform</span></td></tr>
  <tr><td colspan="${nCols}" style="background:${accent};color:#fff;font-size:15px;font-weight:700;padding:9px 14px;">Censo oficial de jugadores</td></tr>
  <tr><td colspan="${nCols}" style="background:#eaf5ef;color:#2c4538;font-size:11px;padding:7px 14px;">Fecha de emisión: ${esc(emitted)} a las ${esc(emittedTime)}&#160;&#160;·&#160;&#160;Total de registros: ${players.length}&#160;&#160;·&#160;&#160;Columnas: ${nCols}</td></tr>
  <tr><td colspan="${nCols}" style="height:6px;"></td></tr>
  <tr>${headCells}</tr>
  ${bodyRows}
  <tr><td colspan="${nCols}" style="background:${ink};color:#fff;font-weight:700;font-size:11px;padding:7px 10px;">TOTAL: ${players.length} jugadores</td></tr>
  <tr><td colspan="${nCols}" style="height:6px;"></td></tr>
  <tr><td colspan="${nCols}" style="color:#9a93bd;font-size:10px;padding:6px 14px;">Documento confidencial generado por el panel admin de GlitchGang · ${esc(emitted)} ${esc(emittedTime)} · No distribuir sin autorización.</td></tr>
</table>
</body></html>`

  downloadXls(`censo-jugadores-${now.toISOString().slice(0, 10)}.xls`, html)
}

