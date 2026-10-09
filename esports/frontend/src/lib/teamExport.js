// ════════════════════════════════════════════════════════════
//  Exportación PDF/CSV de EQUIPOS. Mismo diseño que jugadores
//  (reutiliza reportKit). Formatos: profile (fichas + tabla),
//  summary (gráficas), table (tabla).
// ════════════════════════════════════════════════════════════
import { entityCode } from './ids.js'
import {
  C, mm, px, list, text, fill, stroke, drawBadge, codeChip, header, footer,
  sectionTitle, fieldGrid, countBy, drawBarChart, statusKind, statusText, truncate,
  drawCover, drawTablePages, drawClosing, buildMeta, attachQr, exportCsv, newDoc,
} from './reportKit.js'

function firstText(value, fallback = '-') {
  if (typeof value === 'string') return value || fallback
  if (value && typeof value === 'object') {
    return value.name || value.nick || value.gameNick || value.discordName || fallback
  }
  return fallback
}

function getRosterEntries(raw) {
  const slots = raw.rosterSlots && typeof raw.rosterSlots === 'object' ? raw.rosterSlots : {}
  return Object.entries(slots).filter(([, value]) => value)
}

function rosterSummary(raw) {
  const entries = getRosterEntries(raw)
  if (entries.length) {
    return entries.map(([, player]) => player.fullName || player.nick || '-').join(' | ')
  }
  const roster = Array.isArray(raw.roster) ? raw.roster : []
  return roster.length ? roster.map(player => player.nick || player.name || '-').join(' | ') : (raw.players || '-')
}

function starterSummary(raw) {
  const entries = getRosterEntries(raw).filter(([slot]) => slot.startsWith('titular'))
  return entries.length
    ? entries.map(([slot, player]) => `${slot.toUpperCase()}: ${player.fullName || player.nick || '-'}`).join(' | ')
    : '-'
}

function subSummary(raw) {
  const entries = getRosterEntries(raw).filter(([slot]) => slot.startsWith('sub'))
  return entries.length
    ? entries.map(([slot, player]) => `${slot.toUpperCase()}: ${player.fullName || player.nick || '-'}`).join(' | ')
    : '-'
}

function slotField(raw, slotKey, fieldKey, fallback = '-') {
  const slot = raw.rosterSlots?.[slotKey]
  return slot?.[fieldKey] || fallback
}

function staffField(raw, key) {
  return firstText(raw.staff?.[key], '-')
}

function teamCodes(raw, fallbackUid) {
  return {
    publicCode: raw.publicCode || raw.teamIdCode || raw.uid || fallbackUid,
    internalCode: raw.internalCode || raw.internalId || '-',
  }
}

// Normaliza un equipo crudo (MY_TEAM / TEAM_RANKING) a la forma de export.
export function adaptTeam(raw, index = 0) {
  const wins = Number(raw.wins ?? 0)
  const losses = Number(raw.losses ?? 0)
  const roster = raw.roster || []
  const codes = teamCodes(raw, entityCode('team', raw.id ?? raw.rank ?? index + 1))
  return {
    ...raw,
    uid: codes.publicCode,
    internalCode: codes.internalCode,
    name: raw.name || 'Sin nombre',
    tag: raw.tag || '-',
    region: raw.region || raw.country || '-',
    rank: raw.rank ?? '-',
    pts: raw.pts ?? raw.rankPts ?? '-',
    record: `${wins}-${losses}`,
    winrate: raw.winrate || (wins + losses ? `${Math.round((wins / (wins + losses)) * 100)}%` : '-'),
    captain: raw.captain || raw.captainProfile?.nick || slotField(raw, 'titular-1', 'nick', '-') || roster.find(r => /igl|capit/i.test(r.role))?.nick || roster[0]?.nick || '-',
    coach: raw.coach || staffField(raw, 'coach'),
    manager: raw.manager || staffField(raw, 'manager'),
    analyst: raw.analyst || staffField(raw, 'analyst'),
    players: rosterSummary(raw),
    starters: starterSummary(raw),
    substitutes: subSummary(raw),
    captainName: raw.captainProfile?.name || slotField(raw, 'titular-1', 'fullName', '-'),
    captainGameId: slotField(raw, 'titular-1', 'gameId', '-'),
    captainCedula: slotField(raw, 'titular-1', 'cedula', '-'),
    captainDiscord: [slotField(raw, 'titular-1', 'discordName', ''), slotField(raw, 'titular-1', 'discordId', '')].filter(Boolean).join(' / ') || '-',
    playerCount: Number(raw.playerCount || getRosterEntries(raw).filter(([slot]) => /^titular|^sub/.test(slot)).length || roster.length || 0),
    created: raw.created || raw.foundedAt || '-',
    level: raw.level || '-',
    category: raw.category || '-',
    lang: raw.lang || '-',
    gender: raw.gender || '-',
    sponsor: raw.sponsor || '-',
    community: raw.community || '-',
    status: raw.status || 'Activo',
  }
}

// Campos exportables (CSV y columnas de tabla).
export const TEAM_EXPORT_FIELDS = [
  { key: 'uid', label: 'ID publico', section: 'Identidad', get: t => t.uid },
  { key: 'internalCode', label: 'ID interno', section: 'Identidad', get: t => t.internalCode },
  { key: 'name', label: 'Equipo', section: 'Identidad', get: t => t.name },
  { key: 'tag', label: 'Tag', section: 'Identidad', get: t => t.tag },
  { key: 'region', label: 'Region', section: 'Identidad', get: t => t.region },
  { key: 'category', label: 'Categoria', section: 'Identidad', get: t => t.category },
  { key: 'level', label: 'Nivel', section: 'Identidad', get: t => t.level },
  { key: 'lang', label: 'Idioma', section: 'Identidad', get: t => t.lang },
  { key: 'gender', label: 'Genero', section: 'Identidad', get: t => t.gender },
  { key: 'sponsor', label: 'Patrocinador', section: 'Identidad', get: t => t.sponsor },
  { key: 'community', label: 'Comunidad', section: 'Identidad', get: t => t.community },
  { key: 'created', label: 'Fecha creacion', section: 'Identidad', get: t => t.created },
  { key: 'status', label: 'Estatus', section: 'Identidad', get: t => statusText(t.status) },
  { key: 'rank', label: 'Rank', section: 'Competitivo', get: t => String(t.rank) },
  { key: 'pts', label: 'Puntos', section: 'Competitivo', get: t => String(t.pts) },
  { key: 'record', label: 'Record (V-D)', section: 'Competitivo', get: t => t.record },
  { key: 'winrate', label: 'Win rate', section: 'Competitivo', get: t => t.winrate },
  { key: 'captain', label: 'Capitan', section: 'Staff', get: t => t.captain },
  { key: 'captainName', label: 'Capitan nombre', section: 'Staff', get: t => t.captainName },
  { key: 'captainGameId', label: 'Capitan game ID', section: 'Staff', get: t => t.captainGameId },
  { key: 'captainCedula', label: 'Capitan cedula', section: 'Staff', get: t => t.captainCedula },
  { key: 'captainDiscord', label: 'Capitan Discord', section: 'Staff', get: t => t.captainDiscord },
  { key: 'coach', label: 'Coach', section: 'Staff', get: t => t.coach },
  { key: 'manager', label: 'Manager', section: 'Staff', get: t => t.manager },
  { key: 'analyst', label: 'Analista', section: 'Staff', get: t => t.analyst },
  { key: 'playerCount', label: 'Jugadores', section: 'Roster', get: t => String(t.playerCount) },
  { key: 'players', label: 'Roster completo', section: 'Roster', get: t => t.players },
  { key: 'starters', label: 'Titulares', section: 'Roster', get: t => t.starters },
  { key: 'substitutes', label: 'Suplentes', section: 'Roster', get: t => t.substitutes },
]

function drawTeamFicha(doc, t, meta, idx, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Ficha de equipo · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)

  const av = mm(24)
  fill(doc, C.ink); stroke(doc, C.accent); doc.setLineWidth(1.6)
  doc.roundedRect(x, y, av, av, mm(2.5), mm(2.5), 'FD')
  text(doc, String(t.tag || t.name).slice(0, 3).toUpperCase(), x + av / 2, y + av / 2 + mm(3), { size: px(20), color: C.accent, bold: true, align: 'center' })

  const nx = x + av + mm(7)
  text(doc, t.name, nx, y + mm(8), { size: px(24), color: C.ink, bold: true })
  text(doc, `[${t.tag}] · ${t.region}`, nx, y + mm(14), { size: px(12), color: C.muted })
  drawBadge(doc, nx, y + mm(20), statusText(t.status), statusKind(t.status))

  text(doc, 'ID DE EQUIPO', W - mm(14), y + mm(3), { size: px(9), color: C.muted, align: 'right', charSpace: 1 })
  codeChip(doc, W - mm(14), y + mm(9), t.uid, 'right')

  y += av + mm(10)

  sectionTitle(doc, x, y, bw, 'Identidad'); y += mm(8)
  y = fieldGrid(doc, x, y, bw, [
    { k: 'Nombre', v: t.name },
    { k: 'Tag', v: t.tag },
    { k: 'Region', v: t.region },
    { k: 'Fecha de creacion', v: t.created },
    { k: 'Estatus', v: statusText(t.status), badge: statusKind(t.status) },
    { k: 'Ranking', v: `#${t.rank}` },
  ], 3)

  y += mm(2)
  sectionTitle(doc, x, y, bw, 'Staff'); y += mm(8)
  y = fieldGrid(doc, x, y, bw, [
    { k: 'Capitan', v: t.captain },
    { k: 'Coach', v: t.coach },
    { k: 'Manager', v: t.manager },
    { k: 'Analista', v: t.analyst },
    { k: 'Discord capitan', v: t.captainDiscord },
    { k: 'Game ID capitan', v: t.captainGameId },
  ], 3)

  y += mm(2)
  sectionTitle(doc, x, y, bw, 'Estadisticas competitivas'); y += mm(8)
  y = fieldGrid(doc, x, y, bw, [
    { k: 'Puntos de ranking', v: String(t.pts) },
    { k: 'Record (V-D)', v: t.record },
    { k: 'Win rate', v: t.winrate },
    { k: 'Jugadores activos', v: String(t.playerCount) },
  ], 3)

  y += mm(2)
  sectionTitle(doc, x, y, bw, `Roster (${t.playerCount})`); y += mm(8)
  drawRosterTable(doc, t, x, y, bw)

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Ficha ${idx} de ${total}`, `${meta.web} · ${meta.email}`)
}

// Tabla de roster profesional (rol, jugador, nick/Game ID, cédula, Discord).
function drawRosterTable(doc, t, x, y, bw) {
  // Construir filas desde rosterSlots o roster
  const slots = (t.rosterSlots && typeof t.rosterSlots === 'object') ? t.rosterSlots : {}
  const order = ['titular-1', 'titular-2', 'titular-3', 'titular-4', 'titular-5', 'sub-1', 'sub-2', 'sub-3']
  let rows = order.filter(k => slots[k]).map(k => ({
    rolTipo: k.startsWith('titular') ? 'Titular' : 'Suplente',
    rolNum: k.split('-')[1],
    name: slots[k].fullName || slots[k].nick || '-',
    nick: slots[k].nick || '-',
    gameId: slots[k].gameId || '-',
    cedula: slots[k].cedula || '-',
    discord: slots[k].discordName || '-',
  }))
  if (!rows.length && Array.isArray(t.roster)) {
    rows = t.roster.map((r, i) => ({ rolTipo: i < 5 ? 'Titular' : 'Suplente', rolNum: (i % 5) + 1, name: r.nick || r.name || '-', nick: r.nick || '-', gameId: r.id || '-', cedula: '-', discord: '-' }))
  }
  if (!rows.length) { text(doc, 'Sin roster registrado.', x, y, { size: px(10), color: C.muted }); return y + mm(6) }

  // Columnas (suman ~bw)
  const cols = [
    { label: 'Rol', w: mm(26) },
    { label: 'Jugador', w: mm(50) },
    { label: 'Nick / Game ID', w: mm(44) },
    { label: 'Cedula', w: mm(30) },
    { label: 'Discord', w: mm(32) },
  ]
  const rowH = mm(8.5)
  const xAt = (i) => x + cols.slice(0, i).reduce((a, c) => a + c.w, 0)

  // Cabecera
  fill(doc, C.ink); doc.roundedRect(x, y, bw, mm(7), mm(1.2), mm(1.2), 'F')
  cols.forEach((c, i) => text(doc, c.label.toUpperCase(), xAt(i) + mm(2.5), y + mm(4.8), { size: px(8.5), color: C.white, bold: true }))
  y += mm(7)

  // Filas
  rows.forEach((r, ri) => {
    if (ri % 2) { fill(doc, C.soft); doc.rect(x, y, bw, rowH, 'F') }
    const cy = y + mm(3.6)
    // Rol con punto de color (titular = accent, suplente = gris)
    const isT = r.rolTipo === 'Titular'
    fill(doc, isT ? C.accent : C.muted); doc.circle(xAt(0) + mm(3), cy - mm(0.8), mm(1.3), 'F')
    text(doc, `${r.rolTipo} ${r.rolNum}`, xAt(0) + mm(6.5), cy, { size: px(9), color: isT ? C.ink : C.muted, bold: isT })
    text(doc, truncate(r.name, 24), xAt(1) + mm(2.5), cy, { size: px(9.5), color: C.ink, bold: true })
    text(doc, truncate(`${r.nick} · ${r.gameId}`, 24), xAt(2) + mm(2.5), cy, { size: px(8.5), color: C.muted })
    text(doc, r.cedula, xAt(3) + mm(2.5), cy, { size: px(8.5), color: C.ink })
    text(doc, truncate(r.discord, 18), xAt(4) + mm(2.5), cy, { size: px(8.5), color: C.ink })
    stroke(doc, C.line); doc.setLineWidth(0.4); doc.line(x, y + rowH, x + bw, y + rowH)
    y += rowH
  })
  // Borde externo
  stroke(doc, C.line); doc.setLineWidth(0.6); doc.roundedRect(x, y - rows.length * rowH - mm(7), bw, rows.length * rowH + mm(7), mm(1.2), mm(1.2))
  return y
}

function drawTeamSummary(doc, teams, meta) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Resumen general · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'RESUMEN DE EQUIPOS', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  text(doc, `${teams.length} equipos`, W - mm(14), y, { size: px(10), color: C.muted, align: 'right' })
  y += mm(10)

  const players = teams.reduce((s, t) => s + Number(t.playerCount || 0), 0)
  const kpis = [
    ['Equipos', String(teams.length)],
    ['Jugadores', String(players)],
    ['Regiones', String(countBy(teams, t => t.region).length)],
    ['Activos', String(teams.filter(t => statusKind(t.status) === 'ok').length)],
  ]
  const cw = (bw - mm(18)) / 4
  kpis.forEach((k, i) => {
    const cx = x + i * (cw + mm(6))
    stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.white)
    doc.roundedRect(cx, y, cw, mm(20), mm(2.5), mm(2.5), 'FD')
    fill(doc, C.accent); doc.rect(cx, y, cw, mm(1.2), 'F')
    text(doc, k[0].toUpperCase(), cx + mm(4), y + mm(7), { size: px(8.5), color: C.muted })
    text(doc, k[1], cx + mm(4), y + mm(16), { size: px(20), color: C.ink, bold: true })
  })
  y += mm(28)

  const colGap = mm(10)
  const colW = (bw - colGap) / 2
  const byRegion = countBy(teams, t => t.region).slice(0, 6)
  const topPts = [...teams].sort((a, b) => Number(b.pts) - Number(a.pts)).slice(0, 6).map(t => [t.name, Number(t.pts) || 0])
  sectionTitle(doc, x, y, colW, 'Por region')
  sectionTitle(doc, x + colW + colGap, y, colW, 'Top por puntos')
  const yb = y + mm(9)
  drawBarChart(doc, x, yb, colW, byRegion, Math.max(...byRegion.map(r => r[1]), 1))
  drawBarChart(doc, x + colW + colGap, yb, colW, topPts, Math.max(...topPts.map(r => r[1]), 1))

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Resumen general`, `${meta.web} · ${meta.email}`)
}

const teamFieldsFor = (keys) => (keys?.length ? TEAM_EXPORT_FIELDS.filter(f => keys.includes(f.key)) : TEAM_EXPORT_FIELDS)

export function exportTeamsCsv(teams, keys = null, filename = null) {
  const rows = teams.map(adaptTeam)
  exportCsv(rows, teamFieldsFor(keys), filename || `equipos-${new Date().toISOString().slice(0, 10)}.csv`)
}

export async function exportTeamsPdf({ teams, keys = null, format = 'profile', requestedBy, filename } = {}) {
  const rows = teams.map(adaptTeam)
  if (!rows.length) return
  const tableFields = teamFieldsFor(keys)
  const meta = buildMeta({
    requestedBy,
    docType: 'Equipos',
    coverLines: ['EXPEDIENTE DE', 'EQUIPOS'],
    recordsLabel: `${rows.length} equipos`,
    contentLabel: format === 'profile' ? 'Fichas + tabla' : format === 'summary' ? 'Resumen estadistico' : 'Tabla resumen',
    chips: [['Equipos', true], ['Jugadores', false], ['Torneos / Eventos', false]],
  })
  const doc = await newDoc()
  drawCover(doc, rows.length, meta)

  if (format === 'summary') {
    doc.addPage(); drawTeamSummary(doc, rows, meta)
  } else if (format === 'profile') {
    rows.forEach((t, i) => { doc.addPage(); drawTeamFicha(doc, t, meta, i + 1, rows.length) })
    doc.addPage(); drawTablePages(doc, rows, tableFields, meta, { title: 'LISTADO DE EQUIPOS', totals: [['Equipos', rows.length], ['Jugadores', rows.reduce((s, t) => s + Number(t.playerCount || 0), 0)], ['Regiones', countBy(rows, t => t.region).length], ['Activos', rows.filter(t => statusKind(t.status) === 'ok').length]] })
  } else {
    doc.addPage(); drawTablePages(doc, rows, tableFields, meta, { title: 'LISTADO DE EQUIPOS' })
  }

  await attachQr(meta)
  doc.addPage(); drawClosing(doc, meta)
  doc.save(filename || `equipos-${new Date().toISOString().slice(0, 10)}.pdf`)
}

