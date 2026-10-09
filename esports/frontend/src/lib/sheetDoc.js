// ════════════════════════════════════════════════════════════
//  Fichas oficiales en PDF — UNA HOJA por entidad (jugador, equipo,
//  torneo). Diseño tipo perfil/certificado para guardar como prueba
//  o censo del crecimiento. jsPDF (import dinámico). Colores del theme.
// ════════════════════════════════════════════════════════════

const INK = [17, 22, 30]
const ACCENT = [0, 160, 86]
const SOFT = [108, 114, 124]
const LINE = [228, 231, 235]
const money = (n) => `$${Number(n || 0).toLocaleString()}`
const toNum = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

// Renderiza una ficha (una página) a partir de un objeto descriptor.
function renderSheet(doc, s, W, H) {
  const M = 50
  // Banda superior
  doc.setFillColor(...INK); doc.rect(0, 0, W, 92, 'F')
  doc.setFillColor(...ACCENT); doc.rect(0, 88, W, 4, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255)
  doc.text('STELIANT ESPORTS', M, 38)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(170, 200, 185)
  doc.text(`Ficha oficial · ${s.kind}`, M, 56)
  doc.setFontSize(8.5); doc.setTextColor(150, 170, 160)
  const emitted = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  doc.text(`Emitido: ${emitted}`, W - M, 38, { align: 'right' })
  if (s.footerCode) doc.text(`Folio: ${s.footerCode}`, W - M, 54, { align: 'right' })

  // Emblema + nombre
  let y = 140
  doc.setFillColor(...ACCENT); doc.circle(M + 28, y - 6, 28, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255)
  doc.text(s.emblem || initials(s.title), M + 28, y, { align: 'center' })

  doc.setTextColor(...INK); doc.setFontSize(22); doc.setFont('helvetica', 'bold')
  doc.text(s.title || '—', M + 72, y - 8)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...SOFT)
  doc.text(s.subtitle || '', M + 72, y + 10)
  if (s.status) {
    doc.setFillColor(...ACCENT); doc.setDrawColor(...ACCENT)
    const sw = doc.getTextWidth(s.status) + 18
    doc.roundedRect(W - M - sw, y - 20, sw, 20, 5, 5, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text(s.status.toUpperCase(), W - M - sw / 2, y - 6, { align: 'center' })
  }
  y += 36

  // Stats grid (hasta 4)
  if (s.stats?.length) {
    const cols = s.stats.length
    const gap = 12
    const cw = (W - M * 2 - gap * (cols - 1)) / cols
    s.stats.forEach((st, i) => {
      const x = M + i * (cw + gap)
      doc.setDrawColor(...LINE); doc.setFillColor(249, 250, 251)
      doc.roundedRect(x, y, cw, 58, 8, 8, 'FD')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...INK)
      doc.text(String(st.value), x + cw / 2, y + 28, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...SOFT)
      doc.text(String(st.label), x + cw / 2, y + 44, { align: 'center' })
    })
    y += 78
  }

  // Secciones
  ;(s.sections || []).forEach(sec => {
    if (y > H - 120) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
    doc.text(sec.heading, M, y)
    doc.setDrawColor(...ACCENT); doc.setLineWidth(1.5); doc.line(M, y + 6, M + 30, y + 6)
    y += 20
    doc.setDrawColor(...LINE); doc.setLineWidth(0.8)
    ;(sec.rows || []).forEach(([k, v]) => {
      if (y > H - 70) return
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...SOFT)
      doc.text(String(k), M, y)
      doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
      const lines = doc.splitTextToSize(String(v ?? '—'), W - M - 200)
      doc.text(lines, M + 200, y)
      doc.line(M, y + 8, W - M, y + 8)
      y += 12 + (lines.length - 1) * 11
    })
    y += 12
  })

  // Pie
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SOFT)
  doc.text('Documento oficial de GlitchGang · Válido como constancia de registro y censo de la plataforma.', M, H - 34)
}

export async function downloadSheets(filename, kind, sheets) {
  if (!sheets.length) return
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  sheets.forEach((s, i) => {
    if (i > 0) doc.addPage()
    renderSheet(doc, { kind, ...s }, W, H)
  })
  doc.save(filename)
}

// ── Constructores de ficha por entidad ──
const list = (arr, k) => (arr || []).map(x => x[k]).join('  ·  ') || '—'

export function playerSheet(p) {
  return {
    title: p.nick,
    subtitle: `${p.realName} · ${p.countryName || p.country}`,
    emblem: initials(p.realName || p.nick),
    status: p.status,
    footerCode: p.publicId,
    stats: [
      { label: `Nivel · ${p.rank}`, value: p.level },
      { label: 'Partidas', value: p.matches },
      { label: 'Win rate', value: `${p.winrate}%` },
      { label: 'Ganancias', value: money(p.earnings) },
    ],
    sections: [
      { heading: 'Identificadores', rows: [
        ['ID jugador (público)', p.publicId],
        ['ID jugador (extenso)', p.internalId],
        ['País', `${p.countryName || p.country} · #${p.countryNumber}`],
        ['Plan', `${p.plan} · ${p.planId}`],
      ] },
      { heading: 'Pertenencias', rows: [
        ['Comunidades', list(p.communities, 'name')],
        ['IDs comunidades', list(p.communities, 'id')],
        ['Equipos', list(p.teams, 'name')],
        ['IDs equipos', list(p.teams, 'id')],
        ['Universidad', p.university ? `${p.university.name} · ${p.university.id}` : '—'],
      ] },
      { heading: 'Información', rows: [
        ['Email', p.email],
        ['Juego principal', p.mainGame],
        ['Registro', p.joined],
        ['Verificado', p.verified ? 'Sí' : 'No'],
      ] },
    ],
  }
}

export function teamSheet(tm) {
  const [w, l] = String(tm.record || '0-0').split('-').map(Number)
  const wr = (w + l) ? Math.round(w / (w + l) * 100) : 0
  return {
    title: tm.name,
    subtitle: `${tm.tag} · ${tm.game}`,
    emblem: tm.tag,
    status: tm.eliminated ? 'Eliminado' : 'Activo',
    footerCode: tm.tag,
    stats: [
      { label: 'Victorias', value: w || 0 },
      { label: 'Derrotas', value: l || 0 },
      { label: 'Win rate', value: `${wr}%` },
      { label: 'Seed', value: `#${tm.seed}` },
    ],
    sections: [
      { heading: 'Equipo', rows: [
        ['Nombre', tm.name],
        ['Tag', tm.tag],
        ['Juego', tm.game],
        ['Récord', tm.record],
      ] },
      { heading: 'Torneo', rows: [
        ['Torneo', tm.tournament],
        ['ID torneo (público)', tm.tournamentId],
        ['ID torneo (extenso)', tm.tournamentInternal || '—'],
        ['Premio', money(toNum(tm.prize))],
      ] },
    ],
  }
}

export function tournamentSheet(t, det = {}) {
  const entryFee = t.entryFee != null ? t.entryFee : toNum(t.cost)
  const revenue = entryFee * (t.filled || 0)
  return {
    title: t.name,
    subtitle: `${t.game} · ${t.platform}`,
    emblem: (t.gameCode || t.game || '?').slice(0, 4).toUpperCase(),
    status: t.status,
    footerCode: t.publicId,
    stats: [
      { label: 'Equipos', value: `${t.filled}/${t.slots}` },
      { label: 'Premio', value: money(toNum(t.prize)) },
      { label: 'Ingresos', value: money(revenue) },
      { label: 'Inscripción', value: entryFee > 0 ? money(entryFee) : 'Gratis' },
    ],
    sections: [
      { heading: 'Identificadores', rows: [
        ['ID público', t.publicId],
        ['ID extenso', t.internalId],
      ] },
      { heading: 'Detalles', rows: [
        ['Fecha', `${t.date}${t.time ? ` · ${t.time}` : ''}`],
        ['Formato', String(t.format || '—').replace(/_/g, ' ')],
        ['Plataforma', t.platform],
        ['Categoría', t.category || '—'],
        ['Organizador', t.creator],
        ['Ganador', t.winner || '—'],
        ['Equipos inscritos', (det.participants || []).map(p => p.name).join(', ') || '—'],
      ] },
    ],
  }
}

