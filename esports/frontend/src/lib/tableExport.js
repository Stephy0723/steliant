// ════════════════════════════════════════════════════════════
//  Export genérico de tablas a CSV y a PDF (jsPDF, import dinámico).
//  columns = [{ label, get(row) }]   ·   rows = []
//  Colores del theme (verde) en tono impreso legible.
// ════════════════════════════════════════════════════════════

function download(filename, content, mime) {
  const blob = new Blob(['﻿', content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function exportCsv(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = columns.map(c => esc(c.label)).join(',')
  const body = rows.map(r => columns.map(c => esc(c.get(r))).join(',')).join('\n')
  download(filename, `${head}\n${body}`, 'text/csv;charset=utf-8;')
}

export async function exportTablePdf(filename, meta, columns, rows) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: meta.orientation || 'landscape' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 36
  const ACCENT = [0, 150, 80]
  const INK = [16, 20, 28]
  const emitted = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // Cabecera de marca
  doc.setFillColor(...INK); doc.rect(0, 0, W, 56, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255)
  doc.text('STELIANT ESPORTS', M, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(180, 200, 190)
  doc.text(meta.title || 'Reporte', M, 44)
  doc.setFontSize(8.5); doc.setTextColor(170, 180, 175)
  doc.text(`Emitido: ${emitted}  ·  ${rows.length} registros`, W - M, 32, { align: 'right' })

  // Anchos de columna proporcionales
  const usable = W - M * 2
  const weights = columns.map(c => c.w || 1)
  const totalW = weights.reduce((a, b) => a + b, 0)
  const widths = weights.map(w => (w / totalW) * usable)
  const xAt = (i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0)

  let y = 78
  const drawHead = () => {
    doc.setFillColor(...ACCENT); doc.rect(M, y - 14, usable, 20, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255)
    columns.forEach((c, i) => doc.text(String(c.label).toUpperCase(), xAt(i) + 4, y, { maxWidth: widths[i] - 6 }))
    y += 14
  }
  drawHead()

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  rows.forEach((r, ri) => {
    if (y > H - 40) { doc.addPage(); y = 50; drawHead() }
    if (ri % 2) { doc.setFillColor(242, 247, 244); doc.rect(M, y - 10, usable, 16, 'F') }
    doc.setTextColor(...INK)
    columns.forEach((c, i) => {
      const txt = String(c.get(r) ?? '')
      doc.text(txt.length > 42 ? txt.slice(0, 41) + '…' : txt, xAt(i) + 4, y, { maxWidth: widths[i] - 6 })
    })
    y += 16
  })

  // Pie
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150, 155, 160)
    doc.text(`GlitchGang · ${meta.title || ''}`, M, H - 18)
    doc.text(`Página ${i} de ${pages}`, W - M, H - 18, { align: 'right' })
  }
  doc.save(filename)
}

