// ════════════════════════════════════════════════════════════
//  smartReport — motor de PDF dirigido por configuración para el
//  Centro de Exportación Inteligente. Toma la configuración que
//  arma el usuario en la interfaz (tipo, alcance, portada, intro,
//  secciones ordenadas, columnas, tema) y produce el documento
//  final reutilizando las primitivas de reportKit (mismo diseño
//  que el resto de exportaciones de GlitchGang).
// ════════════════════════════════════════════════════════════
import {
  C, mm, px, text, fill, stroke, drawBadge, codeChip, header, footer,
  sectionTitle, fieldGrid, countBy, drawBarChart, statusKind, truncate, initials,
  drawClosing, buildMeta, attachQr, exportCsv, newDoc, LEGAL_TEXT,
} from './reportKit.js'

const PX0 = mm(18)
const FICHA_CAP = 80   // tope de fichas individuales por documento
const TABLE_PER_PAGE = 30

// Aplica el color de acento del tema sobre la paleta compartida.
// Se restaura al terminar para no contaminar otras exportaciones.
function withAccent(rgb, fn) {
  if (!rgb) return fn()
  const prevA = [...C.accent], prevD = [...C.accentD]
  C.accent = rgb
  C.accentD = rgb.map(v => Math.round(v * 0.7))
  try { return fn() } finally { C.accent = prevA; C.accentD = prevD }
}

const get = (field, row) => { try { return String(field.get(row) ?? '-') } catch { return '-' } }

// ── Soporte de imágenes subidas (fondo de portada y logos) ──
function imgFmt(u) {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(u || '')
  const t = (m && m[1] || 'png').toLowerCase()
  return t === 'jpg' || t === 'jpeg' ? 'JPEG' : t === 'webp' ? 'WEBP' : 'PNG'
}
function setOpacity(doc, o) { try { doc.setGState(new doc.GState({ opacity: o })) } catch { /* sin soporte de opacidad */ } }
function addImageSafe(doc, dataUrl, x, y, w, h) {
  try { doc.addImage(dataUrl, imgFmt(dataUrl), x, y, w, h); return true } catch { return false }
}
// Caja de logo: imagen si existe, si no las iniciales de respaldo.
function logoBox(doc, dataUrl, x, y, s, fallback) {
  stroke(doc, C.accent); doc.setLineWidth(2.2); fill(doc, [16, 30, 42])
  doc.roundedRect(x, y, s, s, mm(2.5), mm(2.5), dataUrl ? 'F' : 'FD')
  if (dataUrl && addImageSafe(doc, dataUrl, x + mm(1.6), y + mm(1.6), s - mm(3.2), s - mm(3.2))) return
  text(doc, fallback, x + s / 2, y + s / 2 + mm(3.5), { size: px(s > mm(26) ? 28 : 14), color: C.accent, bold: true, align: 'center' })
}

// ════════ Portada configurable (toggles del constructor) ════════
function drawSmartCover(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const b = cfg.cover.blocks
  const m = cfg.meta
  const imgs = cfg.cover.images || {}

  if (imgs.background) { drawImageCover(doc, cfg, imgs); return }

  fill(doc, C.ink); doc.rect(0, 0, W, mm(108), 'F')
  stroke(doc, C.accent); doc.setLineWidth(1); doc.circle(W - mm(8), mm(8), mm(34))

  if (b.companyLogo) logoBox(doc, imgs.companyLogo, mm(18), mm(26), mm(28), 'GG')
  if (b.eventLogo) logoBox(doc, imgs.eventLogo, mm(52), mm(28), mm(24), 'EVT')
  text(doc, 'STELIANT ESPORTS', mm(18), mm(96), { size: px(15), color: C.white, bold: true, charSpace: 4 })
  if (b.confidentiality) drawBadge(doc, W - mm(48), mm(96), (m.confidentiality || 'Uso interno').toUpperCase(), 'warn')

  fill(doc, C.accent); doc.rect(0, mm(108), W, mm(3.2), 'F')
  fill(doc, C.ink); doc.rect(W * 0.7, mm(108), W * 0.05, mm(3.2), 'F')

  let y = mm(124)
  if (b.classification) {
    text(doc, `REPORTE ${(m.classification || 'OPERATIVO').toUpperCase()}`, PX0, y, { size: px(11), color: C.accentD, bold: true, charSpace: 2 })
    y += mm(10)
  }
  if (b.title) {
    text(doc, (cfg.cover.title || `Reporte de ${cfg.entityLabel}`).toUpperCase(), PX0, y, { size: px(30), color: C.ink, bold: true, maxW: W - PX0 * 2 })
    y += mm(13)
  }
  if (b.subtitle && cfg.cover.subtitle) {
    text(doc, cfg.cover.subtitle, PX0, y, { size: px(13), color: C.muted, maxW: W - PX0 * 2 })
    y += mm(10)
  }

  text(doc, LEGAL_TEXT, PX0, y, { size: px(9.5), color: C.muted, maxW: W - PX0 * 2 })
  y += mm(26)

  // Metadatos activos (grid de 3)
  const meta = []
  if (b.user) meta.push(['Generado por', m.requestedBy])
  meta.push(['Rol', m.role])
  if (b.date) meta.push(['Fecha de generación', m.emittedDate])
  if (b.period) meta.push(['Periodo', cfg.cover.period || m.period])
  if (b.season) meta.push(['Temporada', m.season])
  if (b.pdfId) meta.push(['ID del PDF', m.printCode])
  if (b.classification) meta.push(['Clasificación', m.classification])
  if (b.confidentiality) meta.push(['Confidencialidad', m.confidentiality])

  const gw = (W - PX0 * 2 - mm(16)) / 3
  meta.forEach((it, i) => {
    const cx = PX0 + (i % 3) * (gw + mm(8))
    const cy = y + Math.floor(i / 3) * mm(17)
    stroke(doc, C.accent); doc.setLineWidth(2); doc.line(cx, cy, cx + gw, cy)
    text(doc, it[0].toUpperCase(), cx, cy + mm(5), { size: px(9), color: C.muted, charSpace: .5 })
    text(doc, it[1], cx, cy + mm(11), { size: px(12), color: C.ink, bold: true, maxW: gw })
  })
  y += Math.ceil(meta.length / 3) * mm(17) + mm(8)

  if (b.count) {
    text(doc, 'REGISTROS INCLUIDOS', PX0, y, { size: px(9), color: C.muted, charSpace: .5 })
    text(doc, `${cfg.records.length} ${cfg.entityLabel.toLowerCase()}`, PX0, y + mm(6), { size: px(13), color: C.ink, bold: true })
  }

  if (b.qr && m.qrDataUrl) {
    const qs = mm(26), qx = W - mm(18) - qs, qy = y - mm(2)
    fill(doc, C.white); doc.roundedRect(qx - mm(2), qy - mm(2), qs + mm(4), qs + mm(4), mm(2), mm(2), 'F')
    doc.addImage(m.qrDataUrl, 'PNG', qx, qy, qs, qs)
  }

  fill(doc, C.ink); doc.rect(0, H - mm(16), W, mm(16), 'F')
  text(doc, m.requestedBy, mm(18), H - mm(6.5), { size: px(9.5), color: C.light })
  text(doc, m.web, W / 2, H - mm(6.5), { size: px(9.5), color: C.light, align: 'center' })
  text(doc, `Código: ${m.printCode}`, W - mm(18), H - mm(6.5), { size: px(9.5), color: C.accent, align: 'right' })
}

// ════════ Portada con imagen de fondo (full-bleed · "portada fija") ════════
function drawImageCover(doc, cfg, imgs) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const b = cfg.cover.blocks
  const m = cfg.meta
  const LIGHT = [236, 242, 248], DIM = [176, 192, 208]

  // Imagen a página completa
  addImageSafe(doc, imgs.background, 0, 0, W, H)
  // Velo oscuro para legibilidad (más intenso hacia abajo)
  setOpacity(doc, 0.34); fill(doc, [4, 8, 14]); doc.rect(0, 0, W, H, 'F'); setOpacity(doc, 1)
  setOpacity(doc, 0.62); fill(doc, [4, 8, 14]); doc.rect(0, H * 0.42, W, H * 0.58, 'F'); setOpacity(doc, 1)

  // Logos (arriba izquierda)
  if (b.companyLogo) logoBox(doc, imgs.companyLogo, mm(18), mm(16), mm(26), 'GG')
  if (b.eventLogo) logoBox(doc, imgs.eventLogo, mm(18) + (b.companyLogo ? mm(30) : 0), mm(18), mm(22), 'EVT')
  // Confidencialidad (arriba derecha)
  if (b.confidentiality) drawBadge(doc, W - mm(52), mm(24), (m.confidentiality || 'Uso interno').toUpperCase(), 'warn')

  // Franja de acento
  fill(doc, C.accent); doc.rect(PX0, H * 0.42 + mm(2), mm(34), mm(1.6), 'F')

  // Bloque de texto (anclado abajo, texto claro)
  let y = H * 0.42 + mm(14)
  if (b.classification) { text(doc, `REPORTE ${(m.classification || 'OPERATIVO').toUpperCase()}`, PX0, y, { size: px(11), color: C.accent, bold: true, charSpace: 2 }); y += mm(10) }
  if (b.title) { text(doc, (cfg.cover.title || `Reporte de ${cfg.entityLabel}`).toUpperCase(), PX0, y, { size: px(30), color: LIGHT, bold: true, maxW: W - PX0 * 2 }); y += mm(13) }
  if (b.subtitle && cfg.cover.subtitle) { text(doc, cfg.cover.subtitle, PX0, y, { size: px(13), color: DIM, maxW: W - PX0 * 2 }); y += mm(11) }

  // Metadatos (texto claro, 3 columnas)
  const meta = []
  if (b.user) meta.push(['Generado por', m.requestedBy])
  meta.push(['Rol', m.role])
  if (b.date) meta.push(['Fecha', m.emittedDate])
  if (b.period) meta.push(['Periodo', cfg.cover.period || m.period])
  if (b.season) meta.push(['Temporada', m.season])
  if (b.pdfId) meta.push(['ID del PDF', m.printCode])
  y += mm(4)
  const gw = (W - PX0 * 2 - mm(16)) / 3
  meta.forEach((it, i) => {
    const cx = PX0 + (i % 3) * (gw + mm(8))
    const cy = y + Math.floor(i / 3) * mm(16)
    stroke(doc, C.accent); doc.setLineWidth(1.6); doc.line(cx, cy, cx + gw, cy)
    text(doc, it[0].toUpperCase(), cx, cy + mm(5), { size: px(8.5), color: DIM, charSpace: .5 })
    text(doc, it[1], cx, cy + mm(10.5), { size: px(11.5), color: LIGHT, bold: true, maxW: gw })
  })
  y += Math.ceil(meta.length / 3) * mm(16) + mm(8)

  if (b.count) {
    text(doc, 'REGISTROS INCLUIDOS', PX0, y, { size: px(9), color: DIM, charSpace: .5 })
    text(doc, `${cfg.records.length} ${cfg.entityLabel.toLowerCase()}`, PX0, y + mm(6), { size: px(13), color: LIGHT, bold: true })
  }
  if (b.qr && m.qrDataUrl) {
    const qs = mm(24), qx = W - mm(18) - qs
    fill(doc, C.white); doc.roundedRect(qx - mm(2), y - mm(6), qs + mm(4), qs + mm(4), mm(2), mm(2), 'F')
    doc.addImage(m.qrDataUrl, 'PNG', qx, y - mm(4), qs, qs)
  }

  text(doc, 'STELIANT ESPORTS', PX0, H - mm(10), { size: px(12), color: LIGHT, bold: true, charSpace: 3 })
  text(doc, `Código: ${m.printCode}`, W - mm(18), H - mm(10), { size: px(9.5), color: C.accent, align: 'right' })
}

// ════════ Página 2 — Resumen ejecutivo + ficha del documento + índice ════════
function drawIntro(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const m = cfg.meta
  header(doc, W, `Resumen ejecutivo · ${m.period}`, m.emittedDate)

  const x = mm(14), bw = W - mm(28)
  let y = mm(36)

  // Título grande
  fill(doc, C.accent); doc.rect(x, y - mm(5.5), mm(1.6), mm(8), 'F')
  text(doc, (cfg.intro.title || 'Resumen ejecutivo').toUpperCase(), x + mm(5), y, { size: px(22), color: C.ink, bold: true, maxW: bw })
  y += mm(12)

  // Dos columnas: texto ejecutivo (izq) + panel de información (der)
  const gap = mm(8)
  const leftW = bw * 0.58, rightW = bw - leftW - gap
  const rightX = x + leftW + gap
  const topY = y

  // — Columna izquierda: resumen ejecutivo —
  const body = String(cfg.intro.body || '')
  const lines = doc.splitTextToSize(body, leftW)
  text(doc, body, x, y, { size: px(10.8), color: C.ink2, maxW: leftW })
  let leftEnd = y + lines.length * mm(5.4) + mm(4)

  // — Columna derecha: INFORMACIÓN DEL DOCUMENTO —
  const info = [
    ['Tipo de reporte', cfg.entityLabel],
    ['Variante', m.docType],
    ['Registros', `${cfg.records.length}`],
    ['Fecha de generación', m.emittedDate],
    ['Hora', m.emittedTime],
    ['Periodo', cfg.cover.period || m.period],
    ['Temporada', m.season],
    ['Clasificación', m.classification],
    ['Confidencialidad', m.confidentiality],
    ['ID del documento', m.printCode],
    ['Generado por', m.requestedBy],
    ['Rol', m.role],
  ]
  const panelH = mm(14) + info.length * mm(9.5) + mm(4)
  stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.soft)
  doc.roundedRect(rightX, topY - mm(4), rightW, panelH, mm(2.5), mm(2.5), 'FD')
  fill(doc, C.ink); doc.roundedRect(rightX, topY - mm(4), rightW, mm(9), mm(2.5), mm(2.5), 'F')
  fill(doc, C.ink); doc.rect(rightX, topY - mm(4) + mm(4), rightW, mm(5), 'F')
  text(doc, 'INFORMACIÓN DEL DOCUMENTO', rightX + mm(4), topY + mm(1.5), { size: px(8.8), color: C.white, bold: true, charSpace: .6 })
  let iy = topY + mm(13)
  info.forEach((it, idx) => {
    if (idx) { stroke(doc, C.line); doc.setLineWidth(0.4); doc.line(rightX + mm(4), iy - mm(4.5), rightX + rightW - mm(4), iy - mm(4.5)) }
    text(doc, it[0].toUpperCase(), rightX + mm(4), iy, { size: px(7.6), color: C.muted, charSpace: .3 })
    text(doc, it[1], rightX + rightW - mm(4), iy, { size: px(9.2), color: C.ink, bold: true, align: 'right', maxW: rightW * 0.6 })
    iy += mm(9.5)
  })

  // — Índice de contenido (debajo, ancho completo) — estilo CONTENTS —
  y = Math.max(leftEnd, topY - mm(4) + panelH) + mm(10)
  sectionTitle(doc, x, y, bw, 'Contenido del documento'); y += mm(10)
  const colGap = mm(10), idxColW = (bw - colGap) / 2
  const entries = (cfg.pageMap || []).filter(e => e.key !== 'resumen')
  const half = Math.ceil(entries.length / 2)
  entries.forEach((e, i) => {
    const col = i < half ? 0 : 1
    const row = i < half ? i : i - half
    const ex = x + col * (idxColW + colGap)
    const ey = y + row * mm(13)
    text(doc, String(e.page).padStart(2, '0'), ex, ey, { size: px(15), color: C.accentD, bold: true })
    text(doc, e.label.toUpperCase(), ex + mm(11), ey - mm(0.5), { size: px(9.5), color: C.ink, bold: true, maxW: idxColW - mm(16) })
    const desc = SECTION_DESC[e.key] || `${e.span} pág.`
    text(doc, desc, ex + mm(11), ey + mm(4), { size: px(7.8), color: C.muted, maxW: idxColW - mm(16) })
    stroke(doc, C.line); doc.setLineWidth(0.4); doc.line(ex, ey + mm(7.5), ex + idxColW - mm(2), ey + mm(7.5))
  })

  footer(doc, W, H, `${m.requestedBy} · ${m.printCode}`, `${m.web} · ${m.email}`)
}

const SECTION_DESC = {
  portada: 'Carátula del documento',
  estadisticas: 'Indicadores y métricas clave',
  graficos: 'Distribuciones por categoría',
  fichas: 'Una ficha completa por registro',
  tabla: 'Listado general de datos',
  galeria: 'Evidencias visuales',
  evidencias: 'Soportes y comprobantes',
  historial: 'Línea de tiempo',
  anexos: 'Documentación complementaria',
  documentos: 'Referencias cruzadas',
  firmas: 'Aprobación y conformidad',
  auditoria: 'Trazabilidad de generación',
}

// Barras tipo ranking con número, % y valor (más llamativo que drawBarChart)
function drawRankBars(doc, x, y, w, rows, total) {
  const rowH = mm(11)
  const max = Math.max(...rows.map(r => r[1]), 1)
  rows.forEach(([label, v], i) => {
    const cy = y + i * rowH
    fill(doc, i === 0 ? C.accent : C.soft)
    doc.roundedRect(x, cy, mm(6.5), mm(6.5), mm(1.4), mm(1.4), 'F')
    text(doc, String(i + 1), x + mm(3.25), cy + mm(4.4), { size: px(9), color: i === 0 ? C.ink : C.accentD, bold: true, align: 'center' })
    text(doc, truncate(label, 22), x + mm(10), cy + mm(3.6), { size: px(10), color: C.ink, bold: i === 0 })
    const pct = total ? Math.round(v / total * 100) : 0
    text(doc, `${v} · ${pct}%`, x + w, cy + mm(3.6), { size: px(9.2), color: C.muted, align: 'right' })
    const barX = x + mm(10), barY = cy + mm(6.2), barW = w - mm(10)
    fill(doc, C.soft); doc.roundedRect(barX, barY, barW, mm(2.6), mm(1.3), mm(1.3), 'F')
    const bw = Math.max(mm(1.5), barW * (v / max))
    fill(doc, C.accent); doc.roundedRect(barX, barY, bw, mm(2.6), mm(1.3), mm(1.3), 'F')
  })
  return y + rows.length * rowH
}

// ════════ Estadísticas (rediseñadas, más llamativas) ════════
function drawStats(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Estadísticas · ${cfg.meta.period}`, cfg.meta.emittedDate)

  const x = mm(14), bw = W - mm(28)
  let y = mm(36)
  fill(doc, C.accent); doc.rect(x, y - mm(5.5), mm(1.6), mm(8), 'F')
  text(doc, 'INDICADORES CLAVE', x + mm(5), y, { size: px(22), color: C.ink, bold: true })
  y += mm(11)

  // KPIs grandes (4) con cabecera de acento e icono numérico
  const kpis = cfg.kpis
  const cw = (bw - mm(18)) / 4
  kpis.slice(0, 4).forEach((k, i) => {
    const cx = x + i * (cw + mm(6))
    stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.white)
    doc.roundedRect(cx, y, cw, mm(30), mm(3), mm(3), 'FD')
    fill(doc, C.ink); doc.roundedRect(cx, y, cw, mm(8), mm(3), mm(3), 'F'); fill(doc, C.ink); doc.rect(cx, y + mm(4), cw, mm(4), 'F')
    fill(doc, C.accent); doc.rect(cx, y, mm(1.6), mm(8), 'F')
    text(doc, String(k.label).toUpperCase(), cx + mm(4), y + mm(5.2), { size: px(8), color: C.white, bold: true, maxW: cw - mm(6), charSpace: .3 })
    text(doc, String(k.value), cx + mm(4), y + mm(20), { size: px(26), color: C.ink, bold: true })
    text(doc, String(k.sub || ''), cx + mm(4), y + mm(26.5), { size: px(8), color: C.muted, maxW: cw - mm(6) })
  })
  y += mm(38)

  // Banner destacado: categoría principal
  if (cfg.highlight) {
    const hh = mm(24)
    fill(doc, C.ink); doc.roundedRect(x, y, bw, hh, mm(3), mm(3), 'F')
    fill(doc, C.accent); doc.rect(x, y, mm(2), hh, 'F')
    text(doc, 'CATEGORÍA PRINCIPAL', x + mm(7), y + mm(8), { size: px(8.5), color: C.accent, bold: true, charSpace: 1 })
    text(doc, truncate(cfg.highlight.label, 30), x + mm(7), y + mm(17), { size: px(17), color: C.white, bold: true })
    text(doc, `${cfg.highlight.value}`, x + bw - mm(7), y + mm(13), { size: px(26), color: C.accent, bold: true, align: 'right' })
    text(doc, `${cfg.highlight.pct}% del total`, x + bw - mm(7), y + mm(20), { size: px(9), color: C.light, align: 'right' })
    y += hh + mm(10)
  }

  // Dos rankings lado a lado
  const gap = mm(12), colW = (bw - gap) / 2
  const g = cfg.entity.statGroups || []
  const total = cfg.records.length
  if (g[0]) {
    const data = countBy(cfg.records, g[0].get).slice(0, 6)
    sectionTitle(doc, x, y, colW, g[0].label)
    drawRankBars(doc, x, y + mm(10), colW, data, total)
  }
  if (g[1]) {
    const data = countBy(cfg.records, g[1].get).slice(0, 6)
    sectionTitle(doc, x + colW + gap, y, colW, g[1].label)
    drawRankBars(doc, x + colW + gap, y + mm(10), colW, data, total)
  }

  footer(doc, W, H, `${cfg.meta.requestedBy} · ${cfg.meta.printCode} · Estadísticas`, `${cfg.meta.web} · ${cfg.meta.email}`)
}

// ════════ Ficha individual — una página por registro con TODO + imagen ════════
function drawFichas(doc, cfg) {
  const rows = cfg.records.slice(0, FICHA_CAP)
  rows.forEach((r, idx) => {
    if (idx > 0) doc.addPage()
    drawFicha(doc, cfg, r, idx + 1, rows.length)
  })
}

// Secciones que van a la columna lateral (datos compactos label/valor)
const FICHA_SIDE_SECTIONS = ['Identificadores', 'Redes sociales', 'Redes', 'Contacto', 'Pago', 'Pertenencias', 'Ubicación']

function drawFicha(doc, cfg, r, idx, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const m = cfg.meta
  const id = cfg.entity.identify(r)
  const x = mm(12), bw = W - mm(24)
  const bottom = H - mm(16)

  // ── Cabecera tipo currículum (banda oscura con foto) ──
  const hb = mm(42)
  fill(doc, C.ink); doc.rect(0, 0, W, hb, 'F')
  fill(doc, C.accent); doc.rect(0, hb, W, mm(1.8), 'F')
  const av = mm(28), ax = x + mm(2), ay = (hb - av) / 2
  stroke(doc, C.accent); doc.setLineWidth(1.6); fill(doc, [16, 30, 42])
  doc.roundedRect(ax, ay, av, av, mm(2.5), mm(2.5), 'FD')
  const imgData = cfg.imageMap && cfg.imageMap.get(id.id)
  if (!(imgData && addImageSafe(doc, imgData, ax + mm(1.4), ay + mm(1.4), av - mm(2.8), av - mm(2.8)))) {
    text(doc, initials(id.title), ax + av / 2, ay + av / 2 + mm(3), { size: px(18), color: C.accent, bold: true, align: 'center' })
  }
  const nx = ax + av + mm(6)
  text(doc, truncate(id.title, 26), nx, hb / 2 - mm(1.5), { size: px(22), color: C.white, bold: true })
  text(doc, truncate(id.sub || cfg.entityLabel, 44), nx, hb / 2 + mm(5.5), { size: px(10.5), color: C.light })
  // La ficha SIEMPRE muestra todos los campos de la entidad (IDs, equipo, universidad…),
  // independiente de las columnas elegidas para la tabla.
  const cols = cfg.entity.fields
  const idField = cols.find(c => /^(uid|publicId)$/.test(c.key)) || cols.find(c => /id$/i.test(c.key)) || cols[0]
  if (idField) {
    text(doc, 'IDENTIFICADOR', W - mm(13), mm(11), { size: px(8), color: C.light, align: 'right', charSpace: 1 })
    text(doc, get(idField, r), W - mm(13), mm(17.5), { size: px(11.5), color: C.accent, bold: true, align: 'right' })
  }
  const statusField = cols.find(c => c.key === 'status')
  if (statusField) drawBadge(doc, W - mm(38), mm(28), get(statusField, r), statusKind(get(statusField, r)))

  // ── Agrupación de campos ──
  const groups = cols.reduce((acc, c) => { const s = c.section || 'Datos'; (acc[s] = acc[s] || []).push(c); return acc }, {})
  const sideGroups = Object.entries(groups).filter(([s]) => FICHA_SIDE_SECTIONS.includes(s))
  const mainGroups = Object.entries(groups).filter(([s]) => !FICHA_SIDE_SECTIONS.includes(s))

  const top = hb + mm(10)
  const sideW = bw * 0.35, gap = mm(7), mainX = x + sideW + gap, mainW = bw - sideW - gap
  const foot = () => footer(doc, W, H, `${m.requestedBy} · ${m.printCode} · Ficha ${idx} de ${total}`, `${m.web} · ${m.email}`)

  // Fondo de la columna lateral
  fill(doc, C.soft); doc.rect(x, top - mm(4), sideW, bottom - (top - mm(4)), 'F')
  fill(doc, C.accent); doc.rect(x, top - mm(4), mm(1.4), bottom - (top - mm(4)), 'F')

  // Columna lateral: listas etiqueta / valor
  let sy = top + mm(2)
  const sp = mm(5)
  sideGroups.forEach(([section, gcols]) => {
    if (sy > bottom - mm(16)) return
    text(doc, section.toUpperCase(), x + sp, sy, { size: px(9), color: C.accentD, bold: true, charSpace: 1 })
    stroke(doc, C.line); doc.setLineWidth(0.6); doc.line(x + sp, sy + mm(2), x + sideW - sp, sy + mm(2))
    sy += mm(7)
    gcols.forEach(c => {
      if (sy > bottom - mm(8)) return
      text(doc, c.label.toUpperCase(), x + sp, sy, { size: px(7), color: C.muted, charSpace: .2 })
      const v = get(c, r)
      const vlines = doc.splitTextToSize(v, sideW - sp * 2)
      text(doc, v, x + sp, sy + mm(4), { size: px(8.8), color: C.ink, bold: true, maxW: sideW - sp * 2 })
      sy += mm(4) + Math.min(vlines.length, 2) * mm(3.4) + mm(2.4)
    })
    sy += mm(3)
  })

  // Columna principal: secciones con rejilla 2-col + salto de página si desborda
  let my = top + mm(2)
  const ensure = (need) => { if (my + need > bottom) { foot(); doc.addPage(); header(doc, W, `Ficha · ${truncate(id.title, 30)}`, m.emittedDate); my = mm(30) } }
  mainGroups.forEach(([section, gcols]) => {
    ensure(mm(16))
    sectionTitle(doc, mainX, my, mainW, section); my += mm(9)
    const colN = 2, cW = mainW / colN, rowH = mm(11)
    for (let i = 0; i < gcols.length; i += colN) {
      ensure(rowH)
      for (let j = 0; j < colN && i + j < gcols.length; j++) {
        const c = gcols[i + j], cx = mainX + j * cW
        text(doc, c.label.toUpperCase(), cx, my, { size: px(7.4), color: C.muted, charSpace: .2 })
        text(doc, get(c, r), cx, my + mm(4.6), { size: px(10), color: C.ink, bold: true, maxW: cW - mm(4) })
      }
      my += rowH
    }
    my += mm(3)
  })
  foot()
}

// ════════ Gráficos (distribución detallada) ════════
function drawCharts(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Gráficos · ${cfg.meta.period}`, cfg.meta.emittedDate)
  const x = mm(14), bw = W - mm(28)
  let y = mm(40)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'DISTRIBUCIONES', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  y += mm(12)
  ;(cfg.entity.statGroups || []).forEach(g => {
    const data = countBy(cfg.records, g.get).slice(0, 10)
    sectionTitle(doc, x, y, bw, g.label); y += mm(9)
    y = drawBarChart(doc, x, y, bw, data, Math.max(...data.map(r => r[1]), 1)) + mm(8)
  })
  footer(doc, W, H, `${cfg.meta.requestedBy} · ${cfg.meta.printCode} · Gráficos`, `${cfg.meta.web} · ${cfg.meta.email}`)
}

// ════════ Tabla paginada (columnas configuradas) ════════
function drawTable(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const cols = cfg.columns.slice(0, 7)
  const x = mm(14), tw = W - mm(28)
  const colW = tw / Math.max(cols.length, 1)
  const rowH = mm(8), startY = mm(48)
  const perPage = Math.floor((H - startY - mm(28)) / rowH)
  const rows = cfg.records

  let i = 0, page = 0
  while (i < rows.length || page === 0) {
    if (page > 0) doc.addPage()
    header(doc, W, `Tabla de ${cfg.entityLabel.toLowerCase()} · ${cfg.meta.period}`, cfg.meta.emittedDate)
    fill(doc, C.accent); doc.rect(x, mm(30), mm(1.4), mm(7), 'F')
    text(doc, 'LISTADO DE DATOS', x + mm(4), mm(36), { size: px(20), color: C.ink, bold: true })
    text(doc, `${rows.length} registros · ${cols.length} columnas`, W - mm(14), mm(36), { size: px(10), color: C.muted, align: 'right' })

    let y = startY
    fill(doc, C.ink); doc.roundedRect(x, y - mm(5), tw, mm(7), mm(1.2), mm(1.2), 'F')
    cols.forEach((c, ci) => text(doc, c.label.toUpperCase(), x + ci * colW + mm(2.5), y, { size: px(9), color: C.white, bold: true, maxW: colW - mm(4) }))
    y += mm(5)

    rows.slice(i, i + perPage).forEach((r, ri) => {
      if (ri % 2) { fill(doc, C.soft); doc.rect(x, y - mm(4), tw, rowH, 'F') }
      cols.forEach((c, ci) => text(doc, truncate(get(c, r), 26), x + ci * colW + mm(2.5), y, { size: px(9.5), color: C.ink, maxW: colW - mm(4) }))
      stroke(doc, C.line); doc.setLineWidth(0.4); doc.line(x, y + mm(3.5), x + tw, y + mm(3.5))
      y += rowH
    })
    i += perPage; page++
    footer(doc, W, H, `${cfg.meta.requestedBy} · ${cfg.meta.printCode}`, `${cfg.meta.web} · ${cfg.meta.email}`)
  }
}

// ════════ Secciones de marco (no-vacías, Regla #10) ════════
function drawFramedSection(doc, cfg, { title, lead, slots = [], note }) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `${title} · ${cfg.meta.period}`, cfg.meta.emittedDate)
  const x = mm(14), bw = W - mm(28)
  let y = mm(40)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, title.toUpperCase(), x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  y += mm(11)
  text(doc, lead, x, y, { size: px(11), color: C.ink2, maxW: bw }); y += mm(16)

  const cols = 2, slotW = (bw - mm(8)) / cols, slotH = mm(34)
  slots.forEach((s, i) => {
    const sx = x + (i % cols) * (slotW + mm(8))
    const sy = y + Math.floor(i / cols) * (slotH + mm(8))
    stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.soft)
    doc.roundedRect(sx, sy, slotW, slotH, mm(2.5), mm(2.5), 'FD')
    fill(doc, C.accent); doc.rect(sx, sy, mm(1.2), slotH, 'F')
    text(doc, s.toUpperCase(), sx + mm(5), sy + mm(9), { size: px(9.5), color: C.muted, charSpace: .5 })
    text(doc, 'Pendiente de adjuntar', sx + mm(5), sy + mm(18), { size: px(12), color: C.ink, bold: true })
    text(doc, 'Espacio reservado en la plantilla.', sx + mm(5), sy + mm(26), { size: px(9), color: C.muted })
  })
  if (note) {
    const ny = y + Math.ceil(slots.length / cols) * (slotH + mm(8)) + mm(2)
    text(doc, note, x, ny, { size: px(9.5), color: C.muted, maxW: bw })
  }
  footer(doc, W, H, `${cfg.meta.requestedBy} · ${cfg.meta.printCode} · ${title}`, `${cfg.meta.web} · ${cfg.meta.email}`)
}

function drawSignatures(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Firmas y aprobación · ${cfg.meta.period}`, cfg.meta.emittedDate)
  const x = mm(14), bw = W - mm(28)
  let y = mm(40)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'FIRMAS Y APROBACIÓN', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  y += mm(11)
  text(doc, 'Los abajo firmantes dan conformidad al contenido del presente documento, generado por la plataforma GlitchGang.', x, y, { size: px(11), color: C.ink2, maxW: bw })
  y += mm(24)
  const roles = [['Elaborado por', cfg.meta.requestedBy], ['Revisado por', '________________'], ['Aprobado por', '________________'], ['Recibido por', '________________']]
  const colW = (bw - mm(10)) / 2
  roles.forEach((r, i) => {
    const sx = x + (i % 2) * (colW + mm(10))
    const sy = y + Math.floor(i / 2) * mm(44)
    stroke(doc, C.ink); doc.setLineWidth(0.6); doc.line(sx, sy + mm(20), sx + colW, sy + mm(20))
    text(doc, r[1], sx, sy + mm(18), { size: px(12), color: C.ink, bold: true })
    text(doc, r[0].toUpperCase(), sx, sy + mm(27), { size: px(9), color: C.muted, charSpace: .5 })
    text(doc, 'Fecha: ____ / ____ / ______', sx, sy + mm(34), { size: px(9.5), color: C.muted })
  })
  footer(doc, W, H, `${cfg.meta.requestedBy} · ${cfg.meta.printCode} · Firmas`, `${cfg.meta.web} · ${cfg.meta.email}`)
}

function drawAudit(doc, cfg) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Auditoría · ${cfg.meta.period}`, cfg.meta.emittedDate)
  const x = mm(14), bw = W - mm(28)
  let y = mm(40)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'TRAZABILIDAD Y AUDITORÍA', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  y += mm(12)
  const items = [
    { k: 'ID del documento', v: cfg.meta.printCode, mono: true },
    { k: 'Generado por', v: cfg.meta.requestedBy },
    { k: 'Rol', v: cfg.meta.role },
    { k: 'Fecha y hora', v: `${cfg.meta.emittedDate} · ${cfg.meta.emittedTime}` },
    { k: 'Tipo de reporte', v: cfg.entityLabel },
    { k: 'Variante', v: cfg.meta.docType },
    { k: 'Registros', v: String(cfg.records.length), mono: true },
    { k: 'Columnas', v: String(cfg.columns.length), mono: true },
    { k: 'Temporada', v: cfg.meta.season },
    { k: 'Clasificación', v: cfg.meta.classification },
    { k: 'Confidencialidad', v: cfg.meta.confidentiality },
    { k: 'Versión del sistema', v: cfg.meta.version, mono: true },
  ]
  sectionTitle(doc, x, y, bw, 'Registro de generación'); y += mm(8)
  fieldGrid(doc, x, y, bw, items, 3)
  footer(doc, W, H, `${cfg.meta.requestedBy} · ${cfg.meta.printCode} · Auditoría`, `${cfg.meta.web} · ${cfg.meta.email}`)
}

const SECTION_RENDERERS = {
  portada: drawSmartCover,
  resumen: drawIntro,
  estadisticas: drawStats,
  graficos: drawCharts,
  fichas: drawFichas,
  tabla: drawTable,
  galeria: (d, c) => drawFramedSection(d, c, { title: 'Galería de imágenes', lead: 'Espacios reservados para evidencias visuales asociadas al reporte (logos, capturas, fotografías de eventos).', slots: ['Imagen 1', 'Imagen 2', 'Imagen 3', 'Imagen 4'] }),
  evidencias: (d, c) => drawFramedSection(d, c, { title: 'Evidencias', lead: 'Soportes y comprobantes que respaldan la información del documento.', slots: ['Comprobante A', 'Comprobante B', 'Comprobante C', 'Comprobante D'], note: 'Adjunte los soportes correspondientes antes de la firma del documento.' }),
  historial: (d, c) => drawFramedSection(d, c, { title: 'Historial', lead: 'Línea de tiempo de los cambios y eventos relevantes del conjunto reportado.', slots: ['Hito 1', 'Hito 2', 'Hito 3', 'Hito 4'] }),
  anexos: (d, c) => drawFramedSection(d, c, { title: 'Anexos', lead: 'Notas y documentación complementaria al cuerpo principal del reporte.', slots: ['Anexo I', 'Anexo II'], note: 'Incluya aquí cualquier información adicional requerida por el área solicitante.' }),
  documentos: (d, c) => drawFramedSection(d, c, { title: 'Documentos relacionados', lead: 'Referencias cruzadas a otros expedientes y documentos del sistema.', slots: ['Documento 1', 'Documento 2'] }),
  firmas: drawSignatures,
  auditoria: drawAudit,
}

// Páginas que ocupa cada sección (para el índice y la estimación)
function sectionSpan(key, recordCount) {
  if (key === 'tabla') return Math.max(1, Math.ceil(recordCount / TABLE_PER_PAGE))
  if (key === 'fichas') return Math.max(1, Math.min(recordCount, FICHA_CAP))
  return 1
}

// ════════ Construcción del meta + config interno ════════
function buildConfig(input) {
  const { entity, entityLabel, records, fields, columns, sections, cover, intro, meta: m, imageMap } = input
  const base = buildMeta({
    requestedBy: m.requestedBy, role: m.role, docType: m.docType || 'Reporte',
    coverLines: [cover.title || `Reporte de ${entityLabel}`], recordsLabel: `${records.length} ${entityLabel.toLowerCase()}`,
    season: m.season,
  })
  base.classification = m.classification || 'Operativo'
  base.confidentiality = m.confidentiality || 'Uso interno'
  if (cover.period) base.period = cover.period

  const distinct = (g) => g ? new Set(records.map(r => { try { return g.get(r) } catch { return '' } })).size : 0
  const g0 = entity.statGroups?.[0], g1 = entity.statGroups?.[1]
  const kpis = [
    { label: entityLabel, value: records.length, sub: 'registros totales' },
    { label: g0?.label?.replace(/^Por /i, '') || 'Categorías', value: distinct(g0), sub: 'valores distintos' },
    { label: g1?.label?.replace(/^Por /i, '') || 'Grupos', value: distinct(g1), sub: 'valores distintos' },
    { label: 'Columnas', value: columns.length, sub: `de ${entity.fields.length}` },
  ]
  const top = g0 && records.length ? countBy(records, g0.get)[0] : null
  const highlight = top ? { label: top[0], value: top[1], pct: Math.round(top[1] / records.length * 100) } : null

  // Mapa de páginas (índice de contenido)
  const enabled = sections.filter(s => s.enabled)
  let pageNo = 0
  const pageMap = enabled.map(s => {
    const page = pageNo + 1
    const span = sectionSpan(s.key, records.length)
    pageNo += span
    return { key: s.key, label: s.label, page, span }
  })

  return {
    entity, entityLabel, records, fields, columns, cover, intro,
    sectionCount: enabled.length, kpis, highlight, pageMap,
    imageMap: imageMap || null, meta: base, sections,
  }
}

// Precarga imágenes remotas (avatares) → dataURL para incrustarlas en las fichas.
async function preloadImages(records, identify) {
  const map = new Map()
  await Promise.all(records.slice(0, FICHA_CAP).map(r => new Promise(resolve => {
    const id = identify(r); const src = id.img
    if (!src) return resolve()
    if (typeof src === 'string' && src.startsWith('data:')) { map.set(id.id, src); return resolve() }
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    const timer = setTimeout(finish, 4000) // no bloquear la exportación por una imagen lenta/caída
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const s = 256, cv = document.createElement('canvas'); cv.width = s; cv.height = s
        const ctx = cv.getContext('2d')
        const ratio = Math.max(s / img.width, s / img.height)
        const dw = img.width * ratio, dh = img.height * ratio
        ctx.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh)
        map.set(id.id, cv.toDataURL('image/jpeg', 0.82))
      } catch { /* imagen con CORS restringido → se usa el avatar de iniciales */ }
      clearTimeout(timer); finish()
    }
    img.onerror = () => { clearTimeout(timer); finish() }
    img.src = src
  })))
  return map
}

// ════════ API pública ════════
export async function exportSmartReport(input) {
  // Precarga de imágenes si hay sección de fichas (una página por registro)
  const needsImages = input.sections.some(s => s.enabled && s.key === 'fichas')
  const imageMap = needsImages ? await preloadImages(input.records, input.entity.identify) : null
  const cfg = buildConfig({ ...input, imageMap })
  await attachQr(cfg.meta)
  const doc = await newDoc() // async deps resueltas ANTES de tocar la paleta

  // El dibujo es 100% síncrono → withAccent puede restaurar con seguridad.
  withAccent(input.theme, () => {
    const enabled = cfg.sections.filter(s => s.enabled)
    enabled.forEach((s, i) => {
      if (i > 0) doc.addPage()
      const render = SECTION_RENDERERS[s.key]
      if (render) render(doc, cfg)
      else drawFramedSection(doc, cfg, { title: s.label || s.key, lead: 'Sección personalizada.', slots: ['Contenido'] })
    })
    doc.addPage(); drawClosing(doc, cfg.meta)
  })

  const filename = `${input.entity.code || 'GG'}-${input.entityLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
  return { printCode: cfg.meta.printCode, filename, pages: estimateSmartReport(input).pages }
}

// CSV con las columnas seleccionadas
export function exportSmartCsv(input) {
  const fields = input.columns.map(c => ({ label: c.label, get: c.get }))
  exportCsv(input.records, fields, `${input.entity.code || 'GG'}-${input.entityLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`)
}

// Estima páginas y tamaño aproximado para la UI (Sección 10)
export function estimateSmartReport(input) {
  const { records, columns, sections } = input
  const enabled = sections.filter(s => s.enabled)
  let pages = 1 // cierre
  enabled.forEach(s => { pages += sectionSpan(s.key, records.length) })
  // ~22KB base + por registro/columna en tabla + fichas
  const hasTable = enabled.some(s => s.key === 'tabla')
  const hasFichas = enabled.some(s => s.key === 'fichas')
  const sizeKb = Math.round(46 + pages * 9 + (hasTable ? records.length * columns.length * 0.05 : 0) + (hasFichas ? Math.min(records.length, FICHA_CAP) * 6 : 0))
  const seconds = Math.max(1, Math.round(pages * 0.25 + records.length * 0.004))
  return { pages, sizeKb, seconds }
}

