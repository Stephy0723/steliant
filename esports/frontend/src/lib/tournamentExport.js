// ════════════════════════════════════════════════════════════
//  Exportación PDF/CSV de TORNEOS. Mismo diseño que jugadores.
// ════════════════════════════════════════════════════════════
import { entityCode } from './ids.js'
import {
  C, mm, px, money, text, fill, stroke, drawBadge, codeChip, header, footer,
  sectionTitle, fieldGrid, countBy, drawBarChart, statusKind, statusText, truncate,
  drawCover, drawTablePages, drawClosing, buildMeta, attachQr, exportCsv, newDoc,
} from './reportKit.js'

export function adaptTournament(raw, index = 0) {
  return {
    ...raw,
    uid: raw.uid || entityCode('tournament', raw.id ?? index + 1),
    name: raw.name || 'Sin nombre',
    game: raw.game || '-',
    organizer: raw.organizer || raw.creator || '-',
    startDate: raw.startDate || raw.date || '-',
    endDate: raw.endDate || '-',
    teams: `${raw.filled ?? 0}/${raw.slots ?? 0}`,
    teamsCount: Number(raw.filled ?? 0),
    slots: Number(raw.slots ?? 0),
    staff: raw.staff || '-',
    prize: raw.prize ? money(raw.prize) : '-',
    status: raw.status || 'upcoming',
    result: raw.winner || (raw.status === 'finished' ? 'Sin registrar' : 'En curso'),
    format: raw.format || '-',
    platform: raw.platform || '-',
    cost: raw.cost || '-',
  }
}

export const TOURNAMENT_EXPORT_FIELDS = [
  { key: 'uid', label: 'ID', get: t => t.uid },
  { key: 'name', label: 'Torneo', get: t => t.name },
  { key: 'game', label: 'Juego', get: t => t.game },
  { key: 'organizer', label: 'Organizador', get: t => t.organizer },
  { key: 'startDate', label: 'Inicio', get: t => t.startDate },
  { key: 'endDate', label: 'Fin', get: t => t.endDate },
  { key: 'teams', label: 'Equipos', get: t => t.teams },
  { key: 'prize', label: 'Premio', get: t => t.prize },
  { key: 'status', label: 'Estado', get: t => statusText(t.status) },
  { key: 'result', label: 'Resultado', get: t => t.result },
  { key: 'format', label: 'Formato', get: t => t.format },
  { key: 'platform', label: 'Plataforma', get: t => t.platform },
  { key: 'cost', label: 'Costo', get: t => t.cost },
]

function drawTournamentFicha(doc, t, meta, idx, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Ficha de torneo · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)

  const av = mm(24)
  fill(doc, C.ink); stroke(doc, C.accent); doc.setLineWidth(1.6)
  doc.roundedRect(x, y, av, av, mm(2.5), mm(2.5), 'FD')
  text(doc, String(t.game).slice(0, 3).toUpperCase(), x + av / 2, y + av / 2 + mm(3), { size: px(18), color: C.accent, bold: true, align: 'center' })

  const nx = x + av + mm(7)
  text(doc, t.name, nx, y + mm(8), { size: px(22), color: C.ink, bold: true, maxW: bw - av - mm(40) })
  text(doc, `${t.game} · ${t.format}`, nx, y + mm(14), { size: px(12), color: C.muted })
  drawBadge(doc, nx, y + mm(20), statusText(t.status), statusKind(t.status))

  text(doc, 'ID DE TORNEO', W - mm(14), y + mm(3), { size: px(9), color: C.muted, align: 'right', charSpace: 1 })
  codeChip(doc, W - mm(14), y + mm(9), t.uid, 'right')

  y += av + mm(10)

  const foot = () => footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Ficha ${idx} de ${total}`, `${meta.web} · ${meta.email}`)
  const ensure = (need) => { if (y + need > H - mm(20)) { foot(); doc.addPage(); header(doc, W, `Ficha de torneo · ${meta.period}`, meta.emittedDate); y = mm(34) } }
  const titledGrid = (title, items, cols = 3) => { ensure(mm(10) + Math.ceil(items.length / cols) * mm(11)); sectionTitle(doc, x, y, bw, title); y += mm(8); y = fieldGrid(doc, x, y, bw, items, cols); y += mm(2) }
  const staff = (typeof t.staff === 'object' && t.staff) ? t.staff : {}
  const parts = Array.isArray(t.participants) ? t.participants : []
  const bracket = Array.isArray(t.bracket) ? t.bracket : []
  const reports = Array.isArray(t.reports) ? t.reports : []
  const prizes = Array.isArray(t.prizes) ? t.prizes : []
  const checkin = t.checkin || {}

  titledGrid('Datos generales', [
    { k: 'Nombre', v: t.name }, { k: 'Juego', v: t.game }, { k: 'Organizador', v: staff.director || t.organizer },
    { k: 'Region', v: t.region }, { k: 'Fecha de inicio', v: t.startDate }, { k: 'Estado', v: statusText(t.status), badge: statusKind(t.status) },
    { k: 'Categoria', v: t.category || 'Mixto' }, { k: 'Temporada', v: meta.season }, { k: 'Resultado', v: `Campeon: ${t.winner || t.result}` },
  ])
  titledGrid('Configuracion', [
    { k: 'Modalidad', v: (t.entryFee > 0 ? 'De pago' : 'Gratuito') }, { k: 'Costo de entrada', v: t.cost }, { k: 'Moneda', v: 'USD' },
    { k: 'Formato', v: t.format }, { k: 'Plataforma', v: t.platform || 'PC/Mobile' }, { k: 'Capacidad', v: `${t.registered}/${t.capacity}` },
  ])
  ensure(mm(14)); sectionTitle(doc, x, y, bw, 'Reglas'); y += mm(7)
  text(doc, t.rules || '—', x, y, { size: px(10), color: C.ink, maxW: bw }); y += mm(12)

  // ── Participación (tabla) ──
  if (parts.length) {
    ensure(mm(12) + (parts.length + 1) * mm(7))
    sectionTitle(doc, x, y, bw, `Participacion (${parts.length} equipos)`); y += mm(8)
    y = drawMiniTable(doc, x, y, bw,
      [{ label: 'Seed', w: mm(16) }, { label: 'Equipo', w: mm(64) }, { label: 'Tag', w: mm(24) }, { label: 'Record', w: mm(30) }, { label: 'Posicion', w: mm(48) }],
      parts.map(p => [`#${p.seed}`, p.name, p.tag, p.record || '-', p.placement || '-']))
    y += mm(4)
  }

  // ── Bracket / Llaves ──
  if (bracket.length) {
    ensure(mm(14))
    sectionTitle(doc, x, y, bw, 'Bracket / Llaves'); y += mm(8)
    bracket.forEach(round => {
      const matches = round.matches || []
      ensure(mm(8) + matches.length * mm(7) + mm(4))
      text(doc, String(round.name).toUpperCase(), x, y, { size: px(9.5), color: C.accentD, bold: true, charSpace: 1 }); y += mm(6)
      matches.forEach(m => {
        const aw = m.winner === m.teamA
        fill(doc, C.soft); doc.roundedRect(x, y - mm(4), bw, mm(6.4), mm(1), mm(1), 'F')
        text(doc, truncate(m.teamA, 28), x + mm(3), y, { size: px(9.5), color: C.ink, bold: aw })
        text(doc, `${m.scoreA} - ${m.scoreB}`, x + bw / 2, y, { size: px(9.5), color: C.accentD, bold: true, align: 'center' })
        text(doc, truncate(m.teamB, 28), x + bw - mm(3), y, { size: px(9.5), color: C.ink, bold: !aw, align: 'right' })
        y += mm(7)
      })
      y += mm(3)
    })
  }

  // ── Premios ──
  if (prizes.length) {
    titledGrid('Premios', prizes.map(pr => ({ k: pr.place, v: `${money(pr.amount)}${pr.extra ? ' · ' + pr.extra : ''}` })).concat([{ k: 'Bolsa total', v: money(t.prizePool) }]))
  }

  // ── Moderación + check-in ──
  titledGrid('Check-in', [
    { k: 'A tiempo', v: String(checkin.aTiempo ?? '-') }, { k: 'Tarde', v: String(checkin.tarde ?? '-') }, { k: 'No-shows', v: String(checkin.noShow ?? '-') },
  ])
  if (reports.length) {
    ensure(mm(12) + (reports.length + 1) * mm(7))
    sectionTitle(doc, x, y, bw, `Moderacion / Reportes (${reports.length})`); y += mm(8)
    y = drawMiniTable(doc, x, y, bw,
      [{ label: 'Tipo', w: mm(28) }, { label: 'Equipo', w: mm(54) }, { label: 'Detalle', w: mm(64) }, { label: 'Estado', w: mm(36) }],
      reports.map(r => [r.type, r.team, r.detail, r.status]))
    y += mm(4)
  }

  // ── Patrocinios / colaboradores / staff / evidencias ──
  titledGrid('Organizacion y patrocinios', [
    { k: 'Director', v: staff.director }, { k: 'Admin', v: staff.admin }, { k: 'Arbitros', v: (staff.arbitros || []).join(', ') },
    { k: 'Patrocinadores', v: (t.sponsors || []).join(', ') }, { k: 'Colaboradores', v: (t.collaborators || []).join(', ') }, { k: 'Evidencias', v: (t.evidences || []).join(', ') },
  ])

  foot()
}

// Mini-tabla reutilizable para participación / reportes.
function drawMiniTable(doc, x, y, bw, cols, rows) {
  const rowH = mm(7)
  const xAt = (i) => x + cols.slice(0, i).reduce((a, c) => a + c.w, 0)
  fill(doc, C.ink); doc.roundedRect(x, y, bw, mm(6.4), mm(1.2), mm(1.2), 'F')
  cols.forEach((c, i) => text(doc, c.label.toUpperCase(), xAt(i) + mm(2.5), y + mm(4.4), { size: px(8), color: C.white, bold: true }))
  y += mm(6.4)
  rows.forEach((r, ri) => {
    if (ri % 2) { fill(doc, C.soft); doc.rect(x, y, bw, rowH, 'F') }
    cols.forEach((c, i) => text(doc, truncate(String(r[i] ?? '-'), Math.floor(c.w / mm(1.6))), xAt(i) + mm(2.5), y + mm(4.6), { size: px(8.5), color: C.ink }))
    stroke(doc, C.line); doc.setLineWidth(0.4); doc.line(x, y + rowH, x + bw, y + rowH)
    y += rowH
  })
  return y
}

function drawTournamentSummary(doc, items, meta) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Resumen general · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'RESUMEN DE TORNEOS', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  text(doc, `${items.length} torneos`, W - mm(14), y, { size: px(10), color: C.muted, align: 'right' })
  y += mm(10)

  const live = items.filter(t => t.status === 'live').length
  const upcoming = items.filter(t => t.status === 'upcoming').length
  const finished = items.filter(t => t.status === 'finished').length
  const kpis = [
    ['Torneos', String(items.length)],
    ['En vivo', String(live)],
    ['Proximos', String(upcoming)],
    ['Finalizados', String(finished)],
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
  const byGame = countBy(items, t => t.game).slice(0, 6)
  const byOrg = countBy(items, t => t.organizer).slice(0, 6)
  sectionTitle(doc, x, y, colW, 'Por juego')
  sectionTitle(doc, x + colW + colGap, y, colW, 'Por organizador')
  const yb = y + mm(9)
  drawBarChart(doc, x, yb, colW, byGame, Math.max(...byGame.map(r => r[1]), 1))
  drawBarChart(doc, x + colW + colGap, yb, colW, byOrg, Math.max(...byOrg.map(r => r[1]), 1))

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Resumen general`, `${meta.web} · ${meta.email}`)
}

const tourFieldsFor = (keys) => (keys?.length ? TOURNAMENT_EXPORT_FIELDS.filter(f => keys.includes(f.key)) : TOURNAMENT_EXPORT_FIELDS)

export function exportTournamentsCsv(items, keys = null, filename = null) {
  const rows = items.map(adaptTournament)
  exportCsv(rows, tourFieldsFor(keys), filename || `torneos-${new Date().toISOString().slice(0, 10)}.csv`)
}

export async function exportTournamentsPdf({ tournaments, keys = null, format = 'profile', requestedBy, filename } = {}) {
  const rows = tournaments.map(adaptTournament)
  if (!rows.length) return
  const tableFields = tourFieldsFor(keys)
  const meta = buildMeta({
    requestedBy,
    docType: 'Torneos',
    coverLines: ['EXPEDIENTE DE', 'TORNEOS'],
    recordsLabel: `${rows.length} torneos`,
    contentLabel: format === 'profile' ? 'Fichas + tabla' : format === 'summary' ? 'Resumen estadistico' : 'Tabla resumen',
    chips: [['Torneos', true], ['Equipos', false], ['Eventos', false]],
  })
  const doc = await newDoc()
  drawCover(doc, rows.length, meta)

  if (format === 'summary') {
    doc.addPage(); drawTournamentSummary(doc, rows, meta)
  } else if (format === 'profile') {
    rows.forEach((t, i) => { doc.addPage(); drawTournamentFicha(doc, t, meta, i + 1, rows.length) })
    doc.addPage(); drawTablePages(doc, rows, tableFields, meta, { title: 'LISTADO DE TORNEOS', totals: [['Torneos', rows.length], ['En vivo', rows.filter(t => t.status === 'live').length], ['Proximos', rows.filter(t => t.status === 'upcoming').length], ['Finalizados', rows.filter(t => t.status === 'finished').length]] })
  } else {
    doc.addPage(); drawTablePages(doc, rows, tableFields, meta, { title: 'LISTADO DE TORNEOS' })
  }

  await attachQr(meta)
  doc.addPage(); drawClosing(doc, meta)
  doc.save(filename || `torneos-${new Date().toISOString().slice(0, 10)}.pdf`)
}

