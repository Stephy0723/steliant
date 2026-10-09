// ════════════════════════════════════════════════════════════
//  Facturación profesional editable (estilo tarjeta vertical).
//    · cliente → recibo
//    · empresa → factura fiscal RD (RNC, NCF, ITBIS 18%)
//  Datos superiores (emisor / cliente / nº / fechas) e inferiores
//  (instrucciones de pago / notas) editables. Código verificable
//  para validar en /admin/validar. PDF con jsPDF + QR.
// ════════════════════════════════════════════════════════════
import QRCode from 'qrcode'

export const COMPANY = {
  name: 'GlitchGang SRL',
  rnc: '1-31-12345-6',
  address: 'Av. Esports #100, Santo Domingo, R.D.',
  email: 'facturacion@glitchgang.gg',
  phone: '+1 809 000 0000',
  web: 'glitchgang.gg',
}

export const DEFAULT_INSTRUCTIONS = [
  'Banco: Banco Popular Dominicano',
  'Cuenta: 123-4567890-1',
  'Realiza el pago indicando el número de factura como referencia.',
]

const ITBIS_RATE = 0.18
const num = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0
export const money = (n) => `$${Number(n || 0).toFixed(2)}`
const pad = (n, l) => String(n).padStart(l, '0')

// ── Código de factura verificable (autocontenido) ──
//  GG-FA-{AAAAAA centavos}-{YYMMDD}-{CC checksum}
function checksum(base) {
  let h = 0
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 1296
  return h.toString(36).toUpperCase().padStart(2, '0')
}
export function makeInvoiceCode({ total = 0, date } = {}) {
  const amt = pad(Math.min(999999, Math.round(total * 100)), 6)
  const d = new Date(date || Date.now())
  const ds = Number.isNaN(d.getTime())
    ? '000000'
    : `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`
  return `GG-FA-${amt}-${ds}-${checksum('FA' + amt + ds)}`
}
export function verifyInvoiceCode(raw) {
  const code = String(raw || '').trim().toUpperCase()
  const m = /^GG-FA-(\d{6})-(\d{6})-([0-9A-Z]{2})$/.exec(code)
  if (!m) return { valid: false, reason: 'Formato de factura inválido' }
  const [, amt, date, cc] = m
  const valid = checksum('FA' + amt + date) === cc
  const yy = date.slice(0, 2), mm = date.slice(2, 4), dd = date.slice(4, 6)
  return {
    valid,
    reason: valid ? 'Factura auténtica (checksum correcto)' : 'Checksum no coincide (posible alteración)',
    code, amount: Number(amt) / 100, date: `20${yy}-${mm}-${dd}`,
  }
}

// ── Construcción de la factura (con overrides editables) ──
export function buildInvoice(payment = {}, ov = {}) {
  const total = num(payment.amount)
  const baseItems = ov.items || [{
    desc: payment.concept || (payment.plan ? `Suscripción plan ${payment.plan}` : 'Pago GlitchGang'),
    qty: 1,
    price: +(total / (1 + ITBIS_RATE)).toFixed(2),
  }]
  const items = baseItems.map(it => ({ desc: it.desc, qty: Number(it.qty) || 0, price: Number(it.price) || 0 }))
  const subtotal = +items.reduce((a, it) => a + it.qty * it.price, 0).toFixed(2)
  const itbis = +(subtotal * ITBIS_RATE).toFixed(2)
  const grand = +(subtotal + itbis).toFixed(2)
  const id4 = String(payment.id || Date.now()).replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(-4).padStart(4, '0')

  return {
    company: { ...COMPANY, ...(ov.company || {}) },
    client: ov.client || {
      name: payment.user || payment.buyer || 'Cliente',
      detail: payment.email || '',
    },
    number: ov.number || `INV-${id4}`,
    ncf: ov.ncf || `B01${id4.padStart(8, '0')}`,
    date: ov.date || payment.date || new Date().toLocaleDateString('es-ES'),
    due: ov.due || '',
    method: ov.method || payment.method || '—',
    items, subtotal, itbis, total: grand,
    instructions: ov.instructions || DEFAULT_INSTRUCTIONS,
    notes: ov.notes || '',
    status: payment.status || 'pagado',
    // El codigo/QR es el id real del comprobante (Order.id), verificable en
    // /verificar contra el servidor. El checksum local queda solo como
    // respaldo para facturas armadas sin un pago real detras.
    code: ov.code || payment.orderCode || makeInvoiceCode({ total: grand, date: ov.date || payment.date }),
  }
}

function qrUrl(code) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://glitchgang.gg'
  return `${origin}/verificar?c=${encodeURIComponent(code)}`
}

// ── PDF profesional (tarjeta vertical estilo factura real) ──
export async function downloadInvoicePdf(inv, type = 'cliente') {
  const isCompany = type === 'empresa'
  const [{ jsPDF }, qrData] = await Promise.all([
    import('jspdf'),
    QRCode.toDataURL(qrUrl(inv.code), { margin: 1, width: 200, color: { dark: '#0b0e14', light: '#ffffff' } }).catch(() => ''),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 50
  const ACCENT = [0, 176, 92]   // verde del theme (legible impreso)
  const INK = [16, 20, 28]
  const GRAY = [120, 126, 136]
  const SOFT_GREEN = [42, 120, 80]
  let y = M

  // Cabecera
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK)
  doc.text('STELIANT ESPORTS', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY)
  doc.text(inv.company.name, M, y + 14)
  doc.text(`RNC: ${inv.company.rnc}`, M, y + 26)
  doc.text(inv.company.address, M, y + 38)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(...INK)
  doc.text('FACTURA', W - M, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
  doc.text(isCompany ? 'ORIGINAL — EMPRESA' : 'COPIA — CLIENTE', W - M, y + 22, { align: 'right' })
  y += 66

  // Bloque meta (cliente + números)
  doc.setDrawColor(228, 231, 235); doc.setLineWidth(1); doc.line(M, y, W - M, y); y += 20
  const colR = W - M
  doc.setFontSize(9)
  doc.setTextColor(...GRAY); doc.text('FACTURAR A', M, y)
  doc.setTextColor(...GRAY); doc.text('Nº FACTURA', colR - 150, y); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.text(inv.number, colR, y, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.setFontSize(11); doc.text(inv.client.name, M, y + 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
  if (inv.client.detail) doc.text(String(inv.client.detail), M, y + 30)
  doc.text('FECHA', colR - 150, y + 16); doc.setTextColor(...INK); doc.text(inv.date, colR, y + 16, { align: 'right' }); doc.setTextColor(...GRAY)
  if (isCompany) { doc.text('NCF', colR - 150, y + 30); doc.setTextColor(...INK); doc.text(inv.ncf, colR, y + 30, { align: 'right' }); doc.setTextColor(...GRAY) }
  if (inv.due) { doc.text('VENCE', colR - 150, y + 44); doc.setTextColor(...INK); doc.text(inv.due, colR, y + 44, { align: 'right' }) }
  y += 60

  // Tabla de líneas
  doc.setFillColor(...INK); doc.rect(M, y, W - M * 2, 24, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('DESCRIPCIÓN', M + 10, y + 16)
  doc.text('CANT', W - M - 200, y + 16, { align: 'right' })
  doc.text('PRECIO', W - M - 110, y + 16, { align: 'right' })
  doc.text('IMPORTE', W - M - 10, y + 16, { align: 'right' })
  y += 24
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK); doc.setFontSize(9.5)
  inv.items.forEach((it, i) => {
    if (i % 2) { doc.setFillColor(245, 247, 246); doc.rect(M, y, W - M * 2, 22, 'F') }
    doc.setTextColor(...INK)
    doc.text(String(it.desc).slice(0, 60), M + 10, y + 15)
    doc.text(String(it.qty), W - M - 200, y + 15, { align: 'right' })
    doc.text(money(it.price), W - M - 110, y + 15, { align: 'right' })
    doc.text(money(it.qty * it.price), W - M - 10, y + 15, { align: 'right' })
    y += 22
  })
  y += 10

  // Totales
  const tx = W - M - 200
  const totRow = (k, v, big = false) => {
    doc.setFont('helvetica', big ? 'bold' : 'normal'); doc.setFontSize(big ? 12 : 9.5)
    doc.setTextColor(...(big ? INK : GRAY)); doc.text(k, tx, y)
    doc.setTextColor(...INK); doc.text(v, W - M - 10, y, { align: 'right' }); y += big ? 22 : 18
  }
  if (isCompany) { totRow('Subtotal', money(inv.subtotal)); totRow('ITBIS (18%)', money(inv.itbis)) }
  doc.setDrawColor(...INK); doc.setLineWidth(1.4); doc.line(tx, y - 4, W - M, y - 4); y += 8
  totRow('TOTAL', money(inv.total), true)
  y += 14

  // QR + validación
  if (qrData) doc.addImage(qrData, 'PNG', M, y, 84, 84)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ACCENT)
  doc.text('DOCUMENTO VALIDADO', M + 98, y + 22)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY)
  doc.text('Escanea el QR para verificar la autenticidad.', M + 98, y + 38)
  doc.text(`Código: ${inv.code}`, M + 98, y + 52)

  // Instrucciones de pago (inferior, editable)
  let fy = y + 110
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK)
  doc.text('INSTRUCCIONES DE PAGO', M, fy); fy += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY)
  ;(inv.instructions || []).forEach(line => { doc.text(String(line), M, fy); fy += 12 })
  if (inv.notes) { fy += 6; doc.setFont('helvetica', 'italic'); doc.text(doc.splitTextToSize(inv.notes, W - M * 2), M, fy) }

  // Agradecimiento + pie
  doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...SOFT_GREEN)
  doc.text('¡Gracias por tu compra! Apreciamos tu confianza en GlitchGang.', M, H - 50)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY)
  doc.text(`${inv.company.name} · ${inv.company.email} · ${inv.company.phone}`, M, H - 30)

  doc.save(`${isCompany ? 'factura-empresa' : 'recibo-cliente'}-${inv.number}.pdf`)
}

