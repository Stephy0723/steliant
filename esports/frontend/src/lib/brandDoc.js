// PDF de métricas de campaña para marcas/patrocinadores
// Usa jsPDF (ya instalado). Genera un reporte descargable con KPIs y tabla por campaña.

const AD_PLACEMENT_LABEL = {
  'home-banner':       'Banner principal (Inicio)',
  'banner-inicio':     'Banner principal (Inicio)',
  'stream-overlay':    'Overlay en transmisiones',
  'bracket':           'Patrocinio de bracket',
  'banner-torneos':    'Banner (Torneos)',
  'newsletter':        'Espacio en newsletter',
  'creator':           'Creador patrocinado',
  'app-interstitial':  'Interstitial in-app',
  'banner-detalle':    'Banner (Detalle torneo)',
  'patrocinador':      'Patrocinador torneo',
  'sidebar':           'Barra lateral',
  'spotlight':         'Spotlight',
}

function fmtN(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export async function downloadBrandReportPdf(brand, campaigns, period) {
  const { jsPDF } = await import('jspdf')

  const activeCamps = campaigns.filter(c => ['active', 'approved', 'ended'].includes(c.status))
  const totalImp    = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
  const totalClk    = campaigns.reduce((s, c) => s + (c.clicks || 0), 0)
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0)
  const avgCTR      = totalImp > 0 ? (totalClk / totalImp * 100).toFixed(2) : '0.00'
  const reportDate  = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getWidth()
  let y = 0

  // ── Header band ──
  doc.setFillColor(4, 19, 10)
  doc.rect(0, 0, W, 36, 'F')

  // Brand color bar
  const hex = brand?.color || '#F0A500'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, 4, 36, 'F')

  // Logo circle
  doc.setFillColor(r, g, b)
  doc.circle(20, 18, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text((brand?.logoInitials || brand?.name?.[0] || 'M').toUpperCase().slice(0, 2), 20, 21, { align: 'center' })

  // Brand name + platform
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(brand?.name || 'Marca', 35, 15)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 220, 200)
  doc.text('GlitchGang · Reporte de métricas de campaña', 35, 21)
  doc.setTextColor(150, 170, 150)
  doc.text(`Generado el ${reportDate}${period ? ` · Período: ${period}` : ''}`, 35, 27)

  // GG right-side label
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text('STELIANT ESPORTS', W - 10, 15, { align: 'right' })
  doc.setTextColor(150, 170, 150)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('glitchgang.gg', W - 10, 21, { align: 'right' })

  y = 44

  // ── Tier + industry ──
  doc.setFontSize(8)
  doc.setTextColor(100, 120, 100)
  const tierLabel = { platinum: 'Platino', gold: 'Oro', silver: 'Plata' }[brand?.tier] || brand?.tier || ''
  if (brand?.industry || tierLabel) {
    doc.text(`${brand.industry || ''} ${tierLabel ? `· Plan ${tierLabel}` : ''}`.trim(), 14, y)
    y += 8
  }

  // ── KPI boxes ──
  const kpis = [
    { label: 'Impresiones',    value: fmtN(totalImp),     sub: 'totales acumuladas' },
    { label: 'Clicks',         value: fmtN(totalClk),     sub: 'totales' },
    { label: 'CTR promedio',   value: `${avgCTR}%`,       sub: 'tasa de clics' },
    { label: 'Presupuesto',    value: `$${totalBudget.toLocaleString()}`, sub: 'total invertido' },
    { label: 'Campañas',       value: String(campaigns.length), sub: `${activeCamps.length} activas` },
  ]

  const kpiW = (W - 28) / kpis.length
  kpis.forEach((kpi, i) => {
    const x = 14 + i * kpiW
    doc.setFillColor(10, 30, 18)
    doc.roundedRect(x, y, kpiW - 2, 24, 2, 2, 'F')
    doc.setFillColor(r, g, b)
    doc.rect(x, y, 2, 24, 'F')
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(kpi.value, x + kpiW / 2 - 1, y + 11, { align: 'center' })
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(r, g, b)
    doc.text(kpi.label.toUpperCase(), x + kpiW / 2 - 1, y + 17, { align: 'center' })
    doc.setTextColor(120, 140, 120)
    doc.text(kpi.sub, x + kpiW / 2 - 1, y + 21, { align: 'center' })
  })

  y += 32

  // ── Campaign table ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(240, 165, 0)
  doc.text('Detalle por campaña', 14, y)
  y += 6

  // Table header
  const cols = [
    { label: 'Campaña',      x: 14,  w: 52 },
    { label: 'Ubicación',    x: 66,  w: 40 },
    { label: 'Estado',       x: 106, w: 22 },
    { label: 'Impr.',        x: 128, w: 18 },
    { label: 'Clicks',       x: 146, w: 16 },
    { label: 'CTR',          x: 162, w: 14 },
    { label: 'Presupuesto',  x: 176, w: 24 },
  ]

  doc.setFillColor(15, 40, 25)
  doc.rect(14, y, W - 28, 7, 'F')
  cols.forEach(c => {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(r, g, b)
    doc.text(c.label, c.x + 1, y + 4.5)
  })
  y += 7

  const STATUS_LABEL = {
    pending: 'Revisión', approved: 'Aprobada', active: 'Activa',
    ended: 'Finalizada', rejected: 'Rechazada', draft: 'Borrador',
  }
  const STATUS_COLOR_MAP = {
    active: [34, 197, 94], approved: [59, 130, 246], pending: [245, 158, 11],
    ended: [107, 114, 128], rejected: [239, 68, 68], draft: [156, 163, 175],
  }

  campaigns.forEach((c, idx) => {
    if (y > 260) {
      doc.addPage()
      y = 20
    }
    const rowBg = idx % 2 === 0 ? [8, 22, 14] : [12, 30, 18]
    doc.setFillColor(...rowBg)
    doc.rect(14, y, W - 28, 7, 'F')

    const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(1) + '%' : '—'
    const sc  = STATUS_COLOR_MAP[c.status] || [150, 150, 150]
    const placement = AD_PLACEMENT_LABEL[c.placement] || c.placement || '—'

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(230, 240, 230)
    const campName = c.name.length > 28 ? c.name.slice(0, 26) + '…' : c.name
    doc.text(campName, cols[0].x + 1, y + 4.5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 180, 160)
    const plLabel = placement.length > 22 ? placement.slice(0, 20) + '…' : placement
    doc.text(plLabel, cols[1].x + 1, y + 4.5)

    doc.setTextColor(...sc)
    doc.text(STATUS_LABEL[c.status] || c.status, cols[2].x + 1, y + 4.5)

    doc.setTextColor(200, 220, 200)
    doc.text(fmtN(c.impressions || 0), cols[3].x + 1, y + 4.5)
    doc.text(fmtN(c.clicks || 0),      cols[4].x + 1, y + 4.5)
    doc.text(ctr,                       cols[5].x + 1, y + 4.5)
    doc.text(c.budget > 0 ? `$${c.budget.toLocaleString()}` : '—', cols[6].x + 1, y + 4.5)

    y += 7
  })

  y += 10

  // ── Footer ──
  doc.setFillColor(4, 19, 10)
  const pH = doc.internal.pageSize.getHeight()
  doc.rect(0, pH - 14, W, 14, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 130, 100)
  doc.text('Este reporte fue generado automáticamente por GlitchGang. Los datos reflejan las métricas registradas en plataforma.', 14, pH - 5)
  doc.setTextColor(r, g, b)
  doc.text('glitchgang.gg', W - 14, pH - 5, { align: 'right' })

  // Save
  const slug = (brand?.name || 'marca').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`reporte-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

