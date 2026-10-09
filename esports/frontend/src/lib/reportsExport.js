// ════════════════════════════════════════════════════════════
//  Reportes administrativos (crecimiento, moderación, financiero).
//  Usan reportKit: portada adaptativa, KPIs, gráficas, tabla y
//  cierre con QR. Period = etiqueta de período/temporada elegida.
//  Los datos salen del servidor al generar (censo, equipos, torneos,
//  moderacion y pagos reales) -- antes usaban datasets de ejemplo.
// ════════════════════════════════════════════════════════════
import { MODERATION_TYPES } from '../data/admin.js'
import { api } from './api.js'
import {
  C, mm, px, text, fill, stroke, header, footer, sectionTitle, drawBarChart,
  countBy, statusKind, statusText, money, drawCover, drawTablePages, drawClosing,
  buildMeta, attachQr, newDoc,
} from './reportKit.js'

const num = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0

function drawKpis(doc, x, y, bw, kpis) {
  const cw = (bw - mm(6) * (kpis.length - 1)) / kpis.length
  kpis.forEach((k, i) => {
    const cx = x + i * (cw + mm(6))
    stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.white)
    doc.roundedRect(cx, y, cw, mm(20), mm(2.5), mm(2.5), 'FD')
    fill(doc, C.accent); doc.rect(cx, y, cw, mm(1.2), 'F')
    text(doc, String(k[0]).toUpperCase(), cx + mm(4), y + mm(7), { size: px(8.5), color: C.muted })
    text(doc, String(k[1]), cx + mm(4), y + mm(16), { size: px(19), color: C.ink, bold: true })
  })
  return y + mm(28)
}

function reportHead(doc, meta, title, sub) {
  const W = doc.internal.pageSize.getWidth()
  header(doc, W, `${meta.docType} · ${meta.season}`, meta.emittedDate)
  const x = mm(14)
  fill(doc, C.accent); doc.rect(x, mm(28), mm(1.4), mm(7), 'F')
  text(doc, title, x + mm(4), mm(34), { size: px(20), color: C.ink, bold: true })
  text(doc, sub, W - mm(14), mm(34), { size: px(10), color: C.muted, align: 'right' })
  return mm(44)
}

// ── Crecimiento ──
function drawGrowth(doc, meta, { players, teams: teamRows, tournaments, communities }) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const x = mm(14), bw = W - mm(28)
  let y = reportHead(doc, meta, 'REPORTE DE CRECIMIENTO', `${players.length} jugadores`)

  y = drawKpis(doc, x, y, bw, [
    ['Jugadores', players.length],
    ['Equipos', teamRows.length],
    ['Torneos', tournaments.length],
    ['Comunidades', communities],
  ])
  y = drawKpis(doc, x, y, bw, [
    ['Verificados', players.filter(p => p.verified).length],
    ['Baneados', players.filter(p => p.status === 'ban').length],
    ['Paises', new Set(players.map(p => p.country).filter(Boolean)).size],
    ['Torneos en vivo', tournaments.filter(t => t.status === 'live').length],
  ])

  const colGap = mm(10), colW = (bw - colGap) / 2
  const byCountry = countBy(players, p => p.country || '—').slice(0, 6)
  const byGame = countBy(players, p => p.mainGame).slice(0, 6)
  sectionTitle(doc, x, y, colW, 'Jugadores por pais')
  sectionTitle(doc, x + colW + colGap, y, colW, 'Jugadores por juego')
  y += mm(9)
  drawBarChart(doc, x, y, colW, byCountry, Math.max(...byCountry.map(r => r[1]), 1))
  const yEnd = drawBarChart(doc, x + colW + colGap, y, colW, byGame, Math.max(...byGame.map(r => r[1]), 1))

  let y2 = yEnd + mm(8)
  const byStatus = [['En vivo', tournaments.filter(t => t.status === 'live').length], ['Inscripciones', tournaments.filter(t => t.status === 'upcoming').length], ['Finalizados', tournaments.filter(t => t.status === 'finished').length]]
  sectionTitle(doc, x, y2, bw, 'Torneos por estado'); y2 += mm(9)
  drawBarChart(doc, x, y2, colW, byStatus, Math.max(...byStatus.map(r => r[1]), 1))

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode}`, `${meta.web} · ${meta.email}`)
}

// ── Moderación ──
const MOD_FIELDS = [
  { label: 'Usuario', get: m => m.user },
  { label: 'Tipo', get: m => MODERATION_TYPES[m.type]?.label || m.type },
  { label: 'Accion', get: m => m.action },
  { label: 'Motivo', get: m => m.reason },
  { label: 'Moderador', get: m => m.mod },
  { label: 'Fecha', get: m => m.date },
]
function drawModeration(doc, meta, { sanctions }) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const x = mm(14), bw = W - mm(28)
  let y = reportHead(doc, meta, 'REPORTE DE MODERACION', `${sanctions.length} acciones`)
  const by = (t) => sanctions.filter(m => m.type === t).length
  y = drawKpis(doc, x, y, bw, [
    ['Baneos', by('ban')], ['Advertencias', by('warning')], ['Restricciones', by('mute')], ['Reactivaciones', by('unban')],
  ])
  const counts = countBy(sanctions, m => MODERATION_TYPES[m.type]?.label || m.type)
  sectionTitle(doc, x, y, bw, 'Acciones por tipo'); y += mm(9)
  drawBarChart(doc, x, y, (bw - mm(10)) / 2, counts, Math.max(...counts.map(r => r[1]), 1))
  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode}`, `${meta.web} · ${meta.email}`)
}

// ── Financiero ──
const PAY_FIELDS = [
  { label: 'Comprobante', get: p => p.orderCode },
  { label: 'Usuario', get: p => p.user },
  { label: 'Concepto', get: p => p.concept },
  { label: 'Monto', get: p => p.amount },
  { label: 'Metodo', get: p => p.method },
  { label: 'Estado', get: p => p.mode === 'demo' ? `${p.status} (demo)` : p.status },
  { label: 'Fecha', get: p => p.date },
]
function drawFinancial(doc, meta, { payments, tournaments }) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const x = mm(14), bw = W - mm(28)
  let y = reportHead(doc, meta, 'REPORTE FINANCIERO', `${payments.length} transacciones`)

  // Solo cobros reales: los pagos en modo demo no pasaron por PayPal.
  const paid = payments.filter(p => p.status === 'pagado' && p.mode !== 'demo')
  const revenue = paid.reduce((a, p) => a + num(p.amount), 0)
  const itbis = +(revenue - revenue / 1.18).toFixed(2)
  const inscripciones = paid.filter(p => /torneo|inscrip/i.test(p.concept || '')).reduce((a, p) => a + num(p.amount), 0)
  const premios = tournaments.reduce((a, t) => a + num(t.prizePool), 0)
  y = drawKpis(doc, x, y, bw, [
    ['Ingresos', money(revenue)], ['ITBIS (18%)', money(itbis)], ['Inscripciones', money(inscripciones)], ['Premios', money(premios)],
  ])
  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode}`, `${meta.web} · ${meta.email}`)
}

const REPORTS = {
  crecimiento: { docType: 'Reporte de crecimiento', cover: ['REPORTE DE', 'CRECIMIENTO'], draw: drawGrowth, table: null },
  moderacion: { docType: 'Reporte de moderacion', cover: ['REPORTE DE', 'MODERACION'], draw: drawModeration, table: { rows: d => d.sanctions, fields: MOD_FIELDS, title: 'DETALLE DE MODERACION' } },
  financiero: { docType: 'Reporte financiero', cover: ['REPORTE', 'FINANCIERO'], draw: drawFinancial, table: { rows: d => d.payments, fields: PAY_FIELDS, title: 'DETALLE DE TRANSACCIONES' } },
}

export const REPORT_TYPES = [
  { key: 'crecimiento', label: 'Crecimiento', desc: 'Jugadores, equipos, torneos y comunidades.' },
  { key: 'moderacion', label: 'Moderacion', desc: 'Baneos, advertencias y restricciones.' },
  { key: 'financiero', label: 'Financiero', desc: 'Ingresos, ITBIS, inscripciones y premios.' },
]

async function loadReportData(kind) {
  if (kind === 'crecimiento') {
    const [census, teams, tournaments, summary] = await Promise.all([
      api('/admin/census'), api('/admin/teams'), api('/admin/tournaments'), api('/admin/summary').catch(() => null),
    ])
    return {
      players: census.players || [], teams: teams.teams || [], tournaments: tournaments.tournaments || [],
      communities: summary?.totals?.communities ?? 0,
    }
  }
  if (kind === 'moderacion') return { sanctions: (await api('/admin/moderation')).sanctions || [] }
  const [payments, tournaments] = await Promise.all([api('/admin/payments'), api('/admin/tournaments')])
  return { payments: payments.payments || [], tournaments: tournaments.tournaments || [] }
}

export async function exportReport(kind, { requestedBy, season, periodFrom, periodTo } = {}) {
  const cfg = REPORTS[kind]
  if (!cfg) return
  const meta = buildMeta({ requestedBy, docType: cfg.docType, coverLines: cfg.cover, season, periodFrom, periodTo, recordsLabel: cfg.docType })
  await attachQr(meta)
  const data = await loadReportData(kind)
  const doc = await newDoc()
  drawCover(doc, 0, meta)
  doc.addPage(); cfg.draw(doc, meta, data)
  if (cfg.table) { doc.addPage(); drawTablePages(doc, cfg.table.rows(data), cfg.table.fields, meta, { title: cfg.table.title }) }
  doc.addPage(); drawClosing(doc, meta)
  doc.save(`reporte-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

