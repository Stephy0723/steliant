// ════════════════════════════════════════════════════════════
//  reportKit — diseño compartido de los reportes PDF de Steliant Esports.
//  Extraído de playerExport.js para que TODAS las entidades
//  (jugadores, equipos, torneos, eventos) usen exactamente el
//  mismo formato: portada, encabezado, pie, tablas, cierre y CSV.
// ════════════════════════════════════════════════════════════

import QRCode from 'qrcode'

export const C = {
  ink: [12, 22, 34],
  ink2: [21, 36, 54],
  accent: [45, 224, 192],
  accentD: [14, 156, 132],
  muted: [103, 120, 140],
  light: [185, 200, 214],
  line: [228, 234, 240],
  soft: [244, 248, 249],
  white: [255, 255, 255],
}
export const BADGE = {
  ok: { bg: [226, 250, 243], fg: [10, 138, 108], br: [159, 232, 212] },
  warn: { bg: [253, 243, 226], fg: [154, 106, 10], br: [240, 215, 156] },
}

export const mm = (n) => n * 2.83465
export const px = (n) => n * 0.75
export const money = (n) => {
  const num = Number(String(n).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(num) && String(n).trim() !== '' ? `$${num.toLocaleString()}` : String(n || '-')
}
export const list = (arr, key) => (arr || []).map(x => (key ? x[key] : x)).join(' | ') || '-'
export const csvEsc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

export function formatNow() {
  return new Date().toLocaleString('es-DO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function formatDate(date = new Date()) {
  return new Date(date).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
}
export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
}
export function statusKind(status) {
  const s = String(status || '').toLowerCase()
  return ['activo', 'active', 'al día', 'al dia', 'live', 'en vivo', 'finished', 'finalizado', 'verificado', 'ok', 'aprobado'].includes(s) ? 'ok' : 'warn'
}
export function statusText(status) {
  const s = String(status || 'activo').toLowerCase()
  const map = {
    activo: 'Activo', active: 'Activo', ban: 'Baneado', inactivo: 'Inactivo',
    live: 'En vivo', upcoming: 'Proximo', finished: 'Finalizado',
    draft: 'Borrador', cancelled: 'Cancelado', cancelado: 'Cancelado',
  }
  return map[s] || String(status)
}
export const truncate = (str, n) => {
  const s = String(str ?? '-')
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export const SYS_VERSION = 'v3.0'
export const LEGAL_TEXT = 'El presente documento constituye una exportacion oficial generada por la plataforma GlitchGang. La informacion contenida corresponde al periodo seleccionado y refleja los datos registrados en el sistema al momento de su generacion. Los datos incluidos pueden estar sujetos a modificaciones posteriores debido a actualizaciones, verificaciones, correcciones administrativas o cambios operativos realizados dentro de la plataforma. Este documento tiene fines informativos, administrativos y de auditoria.'

// Marca un valor como PENDIENTE si esta vacio. Lo usa fieldGrid para resaltarlo.
export const PENDING = '__PENDING__'
export const val = (v) => (v == null || v === '' || v === '-' || v === '—') ? PENDING : v

// ════════ Primitivas de dibujo ════════
export function fill(doc, c) { doc.setFillColor(...c) }
export function stroke(doc, c) { doc.setDrawColor(...c) }
export function text(doc, t, x, y, { size = 10, color = C.ink, bold = false, italic = false, align, charSpace = 0, maxW } = {}) {
  doc.setFont('helvetica', italic ? 'italic' : bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...color)
  const opts = { align, charSpace }
  if (maxW) { doc.text(doc.splitTextToSize(String(t ?? '-'), maxW), x, y, opts); return }
  doc.text(String(t ?? '-'), x, y, opts)
}

export function drawBadge(doc, x, y, label, kind = 'ok') {
  const b = BADGE[kind] || BADGE.ok
  doc.setFont('helvetica', 'bold'); doc.setFontSize(px(9.5))
  const w = doc.getTextWidth(label) + mm(6)
  fill(doc, b.bg); stroke(doc, b.br); doc.setLineWidth(0.6)
  doc.roundedRect(x, y - mm(3.4), w, mm(5), mm(2.5), mm(2.5), 'FD')
  text(doc, label, x + w / 2, y, { size: px(9.5), color: b.fg, bold: true, align: 'center' })
  return w
}

export function codeChip(doc, x, y, code, align = 'left') {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(px(10.5))
  const w = doc.getTextWidth(code) + mm(8)
  const cx = align === 'right' ? x - w : x
  fill(doc, C.soft); stroke(doc, C.line); doc.setLineWidth(0.6)
  doc.roundedRect(cx, y - mm(4), w, mm(6.5), mm(1.5), mm(1.5), 'FD')
  text(doc, code, cx + mm(4), y, { size: px(10.5), color: C.ink })
}

export function header(doc, W, rightTop, rightBottom) {
  fill(doc, C.ink); doc.rect(0, 0, W, mm(17), 'F')
  fill(doc, C.accent); doc.rect(0, mm(17), W, mm(0.9), 'F')
  text(doc, 'STELIANT ESPORTS', mm(14), mm(11), { size: px(12), color: C.accent, bold: true, charSpace: 1.5 })
  text(doc, rightTop, W - mm(14), mm(8.5), { size: px(9.5), color: C.light, align: 'right' })
  text(doc, rightBottom, W - mm(14), mm(13), { size: px(9.5), color: C.light, align: 'right' })
}

export function footer(doc, W, H, left, right) {
  stroke(doc, C.line); doc.setLineWidth(0.6); doc.line(mm(14), H - mm(13), W - mm(14), H - mm(13))
  text(doc, left, mm(14), H - mm(8), { size: px(9), color: C.muted })
  text(doc, right, W - mm(14), H - mm(8), { size: px(9), color: C.muted, align: 'right' })
}

export function sectionTitle(doc, x, y, w, title) {
  fill(doc, C.accent); doc.rect(x, y - mm(2.4), mm(2.6), mm(2.6), 'F')
  text(doc, title.toUpperCase(), x + mm(4.6), y, { size: px(10.5), color: C.accentD, bold: true, charSpace: 1.2 })
  stroke(doc, C.line); doc.setLineWidth(0.8); doc.line(x, y + mm(2.6), x + w, y + mm(2.6))
}

// items: { k, v, mono?, badge? }
export function fieldGrid(doc, x, y, w, items, cols) {
  const colW = w / cols
  const rowH = mm(11)
  items.forEach((it, i) => {
    const fx = x + (i % cols) * colW
    const fy = y + Math.floor(i / cols) * rowH
    text(doc, it.k.toUpperCase(), fx, fy, { size: px(8.5), color: C.muted })
    const pending = it.v === PENDING || it.v == null || it.v === '' || it.v === '-' || it.v === '—'
    if (it.badge) drawBadge(doc, fx, fy + mm(5), it.v, it.badge)
    else if (pending) text(doc, 'PENDIENTE', fx, fy + mm(5.5), { size: px(11), color: [200, 70, 70], bold: true })
    else text(doc, it.v, fx, fy + mm(5.5), { size: it.mono ? px(10) : px(12), color: C.ink, bold: !it.mono, maxW: colW - mm(4) })
  })
  return y + Math.ceil(items.length / cols) * rowH + mm(3)
}

// ── Agregaciones para resúmenes ──
export function countBy(rows, getKey) {
  const map = new Map()
  rows.forEach(r => {
    const k = getKey(r) || '—'
    map.set(k, (map.get(k) || 0) + 1)
  })
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

// rows: [label, value]. Barras horizontales dentro de un ancho dado.
export function drawBarChart(doc, x, y, w, rows, max) {
  const rowH = mm(9)
  const labelW = mm(34)
  const barX = x + labelW
  const valueW = mm(10)
  const barMaxW = w - labelW - valueW
  rows.forEach(([label, value], i) => {
    const cy = y + i * rowH
    text(doc, truncate(label, 18), x, cy + mm(4), { size: px(9.5), color: C.ink })
    fill(doc, C.soft); doc.roundedRect(barX, cy, barMaxW, mm(5.5), mm(1), mm(1), 'F')
    const bw = max > 0 ? Math.max(mm(1.5), barMaxW * (value / max)) : mm(1.5)
    fill(doc, C.accent); doc.roundedRect(barX, cy, bw, mm(5.5), mm(1), mm(1), 'F')
    text(doc, String(value), barX + barMaxW + mm(3), cy + mm(4), { size: px(10), color: C.ink, bold: true })
  })
  return y + rows.length * rowH
}

// ════════ Páginas comunes ════════
// meta: { requestedBy, role, emittedDate, period, contentType, contentLabel,
//         printCode, web, email, coverLines:[l1,l2], recordsLabel, chips:[[label,on]] }
export function drawCover(doc, count, meta) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  fill(doc, C.ink); doc.rect(0, 0, W, mm(110), 'F')
  stroke(doc, C.accent); doc.setLineWidth(1)
  doc.circle(W - mm(8), mm(8), mm(34))

  const ls = mm(30), lx = W / 2 - ls / 2, ly = mm(30)
  stroke(doc, C.accent); doc.setLineWidth(2.2); fill(doc, [16, 30, 42])
  doc.roundedRect(lx, ly, ls, ls, mm(2.5), mm(2.5), 'FD')
  text(doc, 'GG', W / 2, ly + ls / 2 + mm(4), { size: px(38), color: C.accent, bold: true, align: 'center' })
  text(doc, 'STELIANT ESPORTS', W / 2, mm(78), { size: px(17), color: C.white, bold: true, align: 'center', charSpace: 5 })

  fill(doc, C.accent); doc.rect(0, mm(110), W, mm(3.4), 'F')
  fill(doc, C.ink); doc.rect(W * 0.7, mm(110), W * 0.05, mm(3.4), 'F')

  let y = mm(126)
  const px0 = mm(18)
  text(doc, meta.contentType.toUpperCase(), px0, y, { size: px(11), color: C.accentD, bold: true, charSpace: 2 })
  const lines = meta.coverLines || ['EXPEDIENTE', 'REGISTROS']
  y += mm(11)
  text(doc, lines[0], px0, y, { size: px(38), color: C.ink, bold: true })
  y += mm(12)
  text(doc, lines[1], px0, y, { size: px(38), color: C.ink, bold: true })

  // Encabezado legal profesional
  y += mm(9)
  text(doc, LEGAL_TEXT, px0, y, { size: px(9.5), color: C.muted, maxW: W - px0 * 2 })

  // Información de la exportación (8 campos)
  y += mm(30)
  const metaItems = [
    ['Generado por', meta.requestedBy],
    ['Rol', meta.role],
    ['Fecha de generacion', meta.emittedDate],
    ['Hora de generacion', meta.emittedTime || '—'],
    ['Temporada', meta.season || '—'],
    ['Periodo', meta.periodFrom && meta.periodTo ? `${meta.periodFrom} — ${meta.periodTo}` : (meta.period || '—')],
    ['Tipo de documento', meta.docType || '—'],
    ['Version del sistema', meta.version || SYS_VERSION],
  ]
  const gw = (W - px0 * 2 - mm(16)) / 3
  metaItems.forEach((it, i) => {
    const cx = px0 + (i % 3) * (gw + mm(8))
    const cy = y + Math.floor(i / 3) * mm(18)
    stroke(doc, C.accent); doc.setLineWidth(2); doc.line(cx, cy, cx + gw, cy)
    text(doc, it[0].toUpperCase(), cx, cy + mm(5), { size: px(9), color: C.muted, charSpace: .5 })
    text(doc, it[1], cx, cy + mm(11), { size: px(12.5), color: C.ink, bold: true, maxW: gw })
  })

  // Estado + registros
  y += mm(56)
  text(doc, 'ESTADO', px0, y, { size: px(9), color: C.muted, charSpace: .5 })
  drawBadge(doc, px0, y + mm(6), meta.state || 'Vigente', 'ok')
  text(doc, 'REGISTROS', px0 + gw + mm(8), y, { size: px(9), color: C.muted, charSpace: .5 })
  text(doc, meta.recordsLabel || `${count} registros`, px0 + gw + mm(8), y + mm(6), { size: px(12.5), color: C.ink, bold: true })

  fill(doc, C.ink); doc.rect(0, H - mm(16), W, mm(16), 'F')
  text(doc, meta.requestedBy, mm(18), H - mm(6.5), { size: px(9.5), color: C.light })
  text(doc, meta.web, W / 2, H - mm(6.5), { size: px(9.5), color: C.light, align: 'center' })
  text(doc, meta.email, W - mm(18), H - mm(6.5), { size: px(9.5), color: C.light, align: 'right' })
  text(doc, `Codigo: ${meta.printCode}`, W / 2, H - mm(11), { size: px(9), color: C.accent, align: 'center' })
}

// Tabla genérica. fields: [{ key, label, get, badge? }]. totals: [[label, value]]
export function drawTablePages(doc, rows, fields, meta, { title = 'LISTADO', totals } = {}) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const cols = fields.slice(0, 7)
  const x = mm(14)
  const tw = W - mm(28)
  const colW = tw / cols.length
  const rowH = mm(8)
  const startY = mm(46)
  const perPage = Math.floor((H - startY - mm(40)) / rowH)

  let i = 0, page = 0
  while (i < rows.length || page === 0) {
    if (page > 0) doc.addPage()
    header(doc, W, `Resumen · ${meta.period}`, meta.emittedDate)

    fill(doc, C.accent); doc.rect(x, mm(28), mm(1.4), mm(7), 'F')
    text(doc, title, x + mm(4), mm(34), { size: px(20), color: C.ink, bold: true })
    text(doc, `${rows.length} registros · ${cols.length} columnas`, W - mm(14), mm(34), { size: px(10), color: C.muted, align: 'right' })

    let y = startY
    fill(doc, C.ink); doc.roundedRect(x, y - mm(5), tw, mm(7), mm(1.2), mm(1.2), 'F')
    cols.forEach((c, ci) => text(doc, c.label.toUpperCase(), x + ci * colW + mm(2.5), y, { size: px(9), color: C.white, bold: true, maxW: colW - mm(4) }))
    y += mm(5)

    const slice = rows.slice(i, i + perPage)
    slice.forEach((r, ri) => {
      if (ri % 2) { fill(doc, C.soft); doc.rect(x, y - mm(4), tw, rowH, 'F') }
      cols.forEach((c, ci) => {
        const cx = x + ci * colW + mm(2.5)
        if (c.badge) drawBadge(doc, cx, y, c.get(r), statusKind(c.badgeKind ? c.badgeKind(r) : c.get(r)))
        else text(doc, c.get(r), cx, y, { size: px(10), color: C.ink, maxW: colW - mm(4) })
      })
      stroke(doc, C.line); doc.setLineWidth(0.4); doc.line(x, y + mm(3.5), x + tw, y + mm(3.5))
      y += rowH
    })
    i += perPage
    page++

    if (i >= rows.length && totals?.length) {
      const ty = y + mm(8)
      const cw = (tw - mm(18)) / 4
      totals.slice(0, 4).forEach((t, ti) => {
        const cx = x + ti * (cw + mm(6))
        stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.white)
        doc.roundedRect(cx, ty, cw, mm(18), mm(2.5), mm(2.5), 'FD')
        fill(doc, C.accent); doc.rect(cx, ty, cw, mm(1.2), 'F')
        text(doc, String(t[0]).toUpperCase(), cx + mm(4), ty + mm(7), { size: px(9), color: C.muted })
        text(doc, String(t[1]), cx + mm(4), ty + mm(15), { size: px(19), color: C.ink, bold: true })
      })
    }
    footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode}`, `${meta.web} · ${meta.email}`)
  }
}

// Genera el link de verificación y su código QR (async). Llamar antes de drawClosing.
export async function attachQr(meta) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://glitchgang.gg'
  meta.verifyUrl = `${origin}/verificar?r=${encodeURIComponent(meta.printCode)}`
  try {
    meta.qrDataUrl = await QRCode.toDataURL(meta.verifyUrl, { margin: 1, width: 260, color: { dark: '#0c1622', light: '#ffffff' } })
  } catch { meta.qrDataUrl = null }
  return meta
}

export function drawClosing(doc, meta) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  fill(doc, C.ink); doc.rect(0, 0, W, H, 'F')

  const ls = mm(26), lx = W / 2 - ls / 2, ly = mm(48)
  stroke(doc, C.accent); doc.setLineWidth(2.2); fill(doc, [16, 30, 42])
  doc.roundedRect(lx, ly, ls, ls, mm(2.5), mm(2.5), 'FD')
  text(doc, 'GG', W / 2, ly + ls / 2 + mm(4), { size: px(32), color: C.accent, bold: true, align: 'center' })

  text(doc, 'FIN DEL REPORTE', W / 2, mm(96), { size: px(23), color: C.white, bold: true, align: 'center', charSpace: 2 })

  // De qué se trata este PDF
  const subject = `${(meta.coverLines || ['Reporte']).join(' ')} · ${meta.contentLabel || ''}`.trim().replace(/·\s*$/, '')
  text(doc, subject.toUpperCase(), W / 2, mm(108), { size: px(12), color: C.accent, bold: true, align: 'center', charSpace: 1 })
  text(doc,
    `Este documento contiene ${meta.recordsLabel || 'los registros seleccionados'} y fue generado automaticamente por la plataforma de Steliant Esports el ${meta.emittedDate}. La informacion corresponde al momento de la exportacion y puede cambiar. Escanea el codigo QR o visita el enlace para ver y validar este reporte en la web.`,
    W / 2, mm(120), { size: px(11.5), color: C.light, align: 'center', maxW: mm(140) })

  // Caja de verificación: QR + código + link
  const bw = mm(150), bx = W / 2 - bw / 2, by = mm(165)
  stroke(doc, C.accent); doc.setLineWidth(1); fill(doc, [16, 30, 42])
  doc.roundedRect(bx, by, bw, mm(52), mm(3), mm(3), 'FD')

  if (meta.qrDataUrl) {
    fill(doc, C.white); doc.roundedRect(bx + mm(8), by + mm(8), mm(36), mm(36), mm(2), mm(2), 'F')
    doc.addImage(meta.qrDataUrl, 'PNG', bx + mm(10), by + mm(10), mm(32), mm(32))
  }
  const tx = bx + mm(52)
  text(doc, 'CODIGO DE VERIFICACION', tx, by + mm(13), { size: px(9.5), color: C.light, charSpace: 1 })
  text(doc, meta.printCode, tx, by + mm(23), { size: px(17), color: C.accent, bold: true, charSpace: 1 })
  text(doc, 'Ver y validar en:', tx, by + mm(33), { size: px(10), color: C.light })
  text(doc, meta.verifyUrl || 'www.glitchgang.gg/verificar', tx, by + mm(41), { size: px(10), color: C.white, bold: true, maxW: bw - mm(56) })

  text(doc, `Steliant Esports © ${new Date().getFullYear()} · Documento de uso interno · Emitido por ${meta.requestedBy} · ${meta.email}`,
    W / 2, H - mm(14), { size: px(8.5), color: C.muted, align: 'center' })
}

// Construye el objeto meta común a todos los reportes.
export function buildMeta({ requestedBy = 'Admin GlitchGang', role = 'Administrador', docType = 'Registro', coverLines, recordsLabel, contentLabel = 'Tabla resumen', chips, season, periodFrom, periodTo, fileType = 'PDF' } = {}) {
  const yr = new Date().getFullYear()
  const now = new Date()
  return {
    requestedBy,
    role,
    docType,
    emittedAt: formatNow(),
    emittedDate: formatDate(),
    emittedTime: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    season: season || `${yr}-A`,
    period: `Temporada ${yr}-A`,
    periodFrom,
    periodTo,
    version: SYS_VERSION,
    state: 'Vigente',
    fileType,
    contentType: 'Documento oficial · Auditoria',
    contentLabel,
    printCode: `GG-PRN-${String(Date.now()).slice(-7)}`,
    web: 'www.glitchgang.gg',
    email: 'contacto@glitchgang.gg',
    coverLines: coverLines || ['EXPEDIENTE DE', String(docType).toUpperCase()],
    recordsLabel,
    chips,
  }
}

// ════════ CSV genérico ════════
// fields: [{ label, get }]. Limpio y compatible con Excel/Sheets/LibreOffice.
export function exportCsv(rows, fields, filename) {
  const head = fields.map(f => csvEsc(f.label)).join(',')
  const body = rows.map(r => fields.map(f => csvEsc(f.get(r))).join(',')).join('\r\n')
  const blob = new Blob([`﻿${head}\r\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Carga jsPDF de forma perezosa (igual que playerExport).
export async function newDoc() {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
}

