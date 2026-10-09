// ════════════════════════════════════════════════════════════
//  Exportación PDF/CSV de EVENTOS. Mismo diseño que jugadores.
//  Tolerante a la forma flexible de los eventos (eventsStore).
// ════════════════════════════════════════════════════════════
import { entityCode } from './ids.js'
import {
  C, mm, px, text, fill, stroke, drawBadge, codeChip, header, footer,
  sectionTitle, fieldGrid, countBy, drawBarChart, statusKind, statusText,
  drawCover, drawTablePages, drawClosing, buildMeta, attachQr, exportCsv, newDoc,
} from './reportKit.js'

export function adaptEvent(raw, index = 0) {
  const participants = raw.participants ?? raw.attendees ?? raw.going ?? '-'
  return {
    ...raw,
    uid: raw.uid || entityCode('event', raw.seq ?? index + 1),
    name: raw.name || raw.title || 'Sin nombre',
    type: raw.type || raw.category || '-',
    organizer: raw.organizer || raw.creator || raw.host || '-',
    date: raw.date || raw.startDate || (raw.createdAt ? String(raw.createdAt).slice(0, 10) : '-'),
    place: raw.place || raw.location || raw.venue || (raw.online ? 'En linea' : '-'),
    participants: typeof participants === 'number' ? String(participants) : (participants || '-'),
    participantsCount: Number(raw.participants ?? raw.attendees ?? raw.going ?? 0),
    status: raw.status || (raw.public ? 'Activo' : 'Borrador'),
    history: raw.history || '-',
  }
}

export const EVENT_EXPORT_FIELDS = [
  { key: 'uid', label: 'ID', get: e => e.uid },
  { key: 'name', label: 'Evento', get: e => e.name },
  { key: 'type', label: 'Tipo', get: e => e.type },
  { key: 'organizer', label: 'Organizador', get: e => e.organizer },
  { key: 'date', label: 'Fecha', get: e => e.date },
  { key: 'place', label: 'Lugar', get: e => e.place },
  { key: 'participants', label: 'Participantes', get: e => e.participants },
  { key: 'status', label: 'Estado', get: e => statusText(e.status) },
]

function drawEventFicha(doc, e, meta, idx, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Ficha de evento · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)

  const av = mm(24)
  fill(doc, C.ink); stroke(doc, C.accent); doc.setLineWidth(1.6)
  doc.roundedRect(x, y, av, av, mm(2.5), mm(2.5), 'FD')
  text(doc, String(e.type || e.name).slice(0, 3).toUpperCase(), x + av / 2, y + av / 2 + mm(3), { size: px(18), color: C.accent, bold: true, align: 'center' })

  const nx = x + av + mm(7)
  text(doc, e.name, nx, y + mm(8), { size: px(22), color: C.ink, bold: true, maxW: bw - av - mm(40) })
  text(doc, `${e.type} · ${e.place}`, nx, y + mm(14), { size: px(12), color: C.muted })
  drawBadge(doc, nx, y + mm(20), statusText(e.status), statusKind(e.status))

  text(doc, 'ID DE EVENTO', W - mm(14), y + mm(3), { size: px(9), color: C.muted, align: 'right', charSpace: 1 })
  codeChip(doc, W - mm(14), y + mm(9), e.uid, 'right')

  y += av + mm(10)

  sectionTitle(doc, x, y, bw, 'Datos del evento'); y += mm(8)
  y = fieldGrid(doc, x, y, bw, [
    { k: 'Nombre', v: e.name },
    { k: 'Tipo', v: e.type },
    { k: 'Organizador', v: e.organizer },
    { k: 'Fecha', v: e.date },
    { k: 'Lugar', v: e.place },
    { k: 'Estado', v: statusText(e.status), badge: statusKind(e.status) },
  ], 3)

  y += mm(2)
  sectionTitle(doc, x, y, bw, 'Participacion'); y += mm(8)
  y = fieldGrid(doc, x, y, bw, [
    { k: 'Participantes', v: e.participants },
  ], 3)

  y += mm(2)
  sectionTitle(doc, x, y, bw, 'Historial'); y += mm(8)
  text(doc, e.history, x, y, { size: px(11), color: C.ink, maxW: bw })

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Ficha ${idx} de ${total}`, `${meta.web} · ${meta.email}`)
}

function drawEventSummary(doc, items, meta) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Resumen general · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'RESUMEN DE EVENTOS', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  text(doc, `${items.length} eventos`, W - mm(14), y, { size: px(10), color: C.muted, align: 'right' })
  y += mm(10)

  const totalPart = items.reduce((s, e) => s + Number(e.participantsCount || 0), 0)
  const kpis = [
    ['Eventos', String(items.length)],
    ['Participantes', String(totalPart)],
    ['Tipos', String(countBy(items, e => e.type).length)],
    ['Activos', String(items.filter(e => statusKind(e.status) === 'ok').length)],
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
  const byType = countBy(items, e => e.type).slice(0, 6)
  const byOrg = countBy(items, e => e.organizer).slice(0, 6)
  sectionTitle(doc, x, y, colW, 'Por tipo')
  sectionTitle(doc, x + colW + colGap, y, colW, 'Por organizador')
  const yb = y + mm(9)
  drawBarChart(doc, x, yb, colW, byType, Math.max(...byType.map(r => r[1]), 1))
  drawBarChart(doc, x + colW + colGap, yb, colW, byOrg, Math.max(...byOrg.map(r => r[1]), 1))

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Resumen general`, `${meta.web} · ${meta.email}`)
}

export function exportEventsCsv(items, filename) {
  const rows = items.map(adaptEvent)
  exportCsv(rows, EVENT_EXPORT_FIELDS, filename || `eventos-${new Date().toISOString().slice(0, 10)}.csv`)
}

export async function exportEventsPdf({ events, format = 'profile', requestedBy, filename } = {}) {
  const rows = events.map(adaptEvent)
  if (!rows.length) return
  const meta = buildMeta({
    requestedBy,
    docType: 'Eventos',
    coverLines: ['EXPEDIENTE DE', 'EVENTOS'],
    recordsLabel: `${rows.length} eventos`,
    contentLabel: format === 'profile' ? 'Fichas + tabla' : format === 'summary' ? 'Resumen estadistico' : 'Tabla resumen',
    chips: [['Eventos', true], ['Torneos', false], ['Equipos', false]],
  })
  const doc = await newDoc()
  drawCover(doc, rows.length, meta)

  if (format === 'summary') {
    doc.addPage(); drawEventSummary(doc, rows, meta)
  } else if (format === 'profile') {
    rows.forEach((e, i) => { doc.addPage(); drawEventFicha(doc, e, meta, i + 1, rows.length) })
    doc.addPage(); drawTablePages(doc, rows, EVENT_EXPORT_FIELDS, meta, { title: 'LISTADO DE EVENTOS', totals: [['Eventos', rows.length], ['Participantes', rows.reduce((s, e) => s + Number(e.participantsCount || 0), 0)], ['Tipos', countBy(rows, e => e.type).length], ['Activos', rows.filter(e => statusKind(e.status) === 'ok').length]] })
  } else {
    doc.addPage(); drawTablePages(doc, rows, EVENT_EXPORT_FIELDS, meta, { title: 'LISTADO DE EVENTOS' })
  }

  await attachQr(meta)
  doc.addPage(); drawClosing(doc, meta)
  doc.save(filename || `eventos-${new Date().toISOString().slice(0, 10)}.pdf`)
}

