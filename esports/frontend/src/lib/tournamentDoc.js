// Reglamento oficial del torneo: PDF (jsPDF) y vista de impresion. Ambas
// salidas se arman desde buildTournamentRegulation (documento articulado) y
// usan la identidad visual de GlitchGang: fondo oscuro, verde de acento y
// tipografia sans (display para titulos, body para el articulado).

import { buildTournamentRegulation } from './tournamentRegulation.js'

const fileSlug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'torneo'

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''))
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 230, 118]
}
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']

// Paleta GlitchGang (equivalente a los tokens de index.css)
const BG = [10, 12, 18]        // ~ --bg-elev
const BG_SOFT = [16, 19, 26]
const TEXT = [243, 245, 248]   // --text
const DIM = [139, 147, 163]    // --text-dim
const LINE = [42, 46, 56]

// ── PDF con jsPDF ──
export async function downloadTournamentPdf(tournament) {
  const r = buildTournamentRegulation(tournament)
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 58
  const maxW = W - M * 2
  const accent = hexToRgb(r.meta.primaryColor)
  let y = M

  const paintBg = () => {
    doc.setFillColor(...BG); doc.rect(0, 0, W, H, 'F')
  }
  const pageChrome = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DIM)
    doc.text(r.meta.title.toUpperCase(), M, 32)
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.line(M, 40, W - M, 40)
  }

  const ensure = (h) => {
    if (y + h > H - 58) {
      doc.addPage(); paintBg(); pageChrome(); y = 58
    }
  }
  const articleHead = (n, title) => {
    ensure(56); y += 14
    doc.setFillColor(...accent); doc.rect(M, y - 9, 22, 3, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...accent)
    doc.text(`ARTICULO ${ROMAN[n] || n}`, M + 30, y - 6)
    doc.setFontSize(13); doc.setTextColor(...TEXT)
    const tl = doc.splitTextToSize(String(title).toUpperCase(), maxW)
    tl.forEach((ln, i) => doc.text(ln, M, y + 10 + i * 16))
    y += 10 + tl.length * 16
    doc.setDrawColor(...LINE); doc.setLineWidth(0.75); doc.line(M, y, W - M, y)
    y += 16
  }
  const clause = (num, text) => {
    const bullet = text.startsWith('•')
    const indent = bullet ? 20 : 34
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXT)
    const lines = doc.splitTextToSize(bullet ? text.replace(/^•\s*/, '') : text, maxW - indent)
    ensure(lines.length * 13.5 + 7)
    if (bullet) {
      doc.setTextColor(...accent); doc.text('>', M + 6, y); doc.setTextColor(...TEXT)
    } else {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...accent)
      doc.text(num, M, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT)
    }
    lines.forEach((ln, i) => doc.text(ln, M + indent, y + i * 13.5))
    y += lines.length * 13.5 + 7
  }

  // ── Encabezado del documento ──
  paintBg()
  doc.setFillColor(...accent); doc.rect(0, 0, W, 6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...accent)
  doc.text('STELIANT ESPORTS  ·  REGLAMENTO OFICIAL DE TORNEO', M, 64)
  doc.setFontSize(23); doc.setTextColor(...TEXT)
  const titleLines = doc.splitTextToSize(r.meta.title, maxW)
  titleLines.forEach((ln, i) => doc.text(ln, M, 92 + i * 26))
  y = 92 + titleLines.length * 26 + 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DIM)
  doc.text(r.meta.subtitle, M, y); y += 15
  doc.text(`Organiza ${r.meta.organizer}   ·   Emitido ${r.meta.generatedAt}   ·   ${r.meta.publicId}`, M, y); y += 10
  doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 4

  // ── Indice ──
  ensure(28 + r.articles.length * 13)
  y += 16
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent)
  doc.text('INDICE', M, y); y += 15
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DIM)
  r.articles.forEach(a => { ensure(13); doc.text(`Art. ${ROMAN[a.n] || a.n}`, M + 4, y); doc.text(a.title, M + 54, y); y += 13 })

  // ── Articulado ──
  r.articles.forEach(a => {
    articleHead(a.n, a.title)
    a.clauses.forEach((cl, i) => clause(`${a.n}.${i + 1}`, cl))
  })

  if (r.attachedDoc) {
    ensure(24); y += 10
    doc.setFillColor(...BG_SOFT); doc.rect(M, y - 10, maxW, 24, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DIM)
    doc.text(`Anexo  ·  ${r.attachedDoc.name} (documento complementario de la organizacion).`, M + 10, y + 5)
    y += 24
  }

  // ── Pie con paginacion ──
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.line(M, H - 40, W - M, H - 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DIM)
    doc.text(`GlitchGang · ${r.meta.title}`, M, H - 26)
    doc.setTextColor(...accent)
    doc.text(`${i} / ${pages}`, W - M, H - 26, { align: 'right' })
  }

  doc.save(`reglamento-${fileSlug(r.meta.title)}.pdf`)
}

// ── Vista de impresion ──
export function printTournamentDoc(tournament) {
  const r = buildTournamentRegulation(tournament)
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const brand = esc(r.meta.primaryColor)

  const toc = r.articles.map(a => `<li><b>${ROMAN[a.n] || a.n}</b> ${esc(a.title)}</li>`).join('')
  const body = r.articles.map(a => `
    <section class="art">
      <h2><span class="art-n">Artículo ${ROMAN[a.n] || a.n}</span>${esc(a.title)}</h2>
      <div class="clauses">${a.clauses.map((cl, i) => cl.startsWith('•')
        ? `<p class="bullet">${esc(cl.replace(/^•\s*/, ''))}</p>`
        : `<p><span class="cn">${a.n}.${i + 1}</span>${esc(cl)}</p>`).join('')}</div>
    </section>`).join('')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Reglamento oficial · ${esc(r.meta.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&family=Sora:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root{ --brand:${brand}; --bg:#06070b; --elev:#0e1118; --text:#f3f5f8; --dim:#8b93a3; --line:rgba(255,255,255,.09); }
  *{box-sizing:border-box}
  body{font-family:'Sora',system-ui,sans-serif;background:var(--bg);color:var(--text);margin:0 auto;padding:60px 64px 80px;line-height:1.62;font-size:13.5px;max-width:920px}
  h1,h2,h3,.kicker,.cn,.art-n,.toc b{font-family:'Chakra Petch',system-ui,sans-serif}
  .doc-hd{border-left:3px solid var(--brand);padding:4px 0 20px 18px;margin-bottom:10px;border-bottom:1px solid var(--line)}
  .doc-hd .kicker{font-size:11px;font-weight:700;letter-spacing:.18em;color:var(--brand)}
  .doc-hd h1{font-size:32px;font-weight:700;margin:12px 0 8px;line-height:1.12}
  .doc-hd .sub{color:var(--dim);font-size:13px}
  .doc-hd .meta{color:var(--dim);font-size:12px;margin-top:8px;opacity:.85}
  .toc{margin:26px 0 8px;background:var(--elev);border:1px solid var(--line);border-radius:12px;padding:20px 24px}
  .toc h3{font-size:12px;letter-spacing:.14em;color:var(--brand);margin:0 0 12px;text-transform:uppercase}
  .toc ol{margin:0;padding:0;list-style:none;columns:2;column-gap:32px;font-size:12px;color:var(--dim)}
  .toc li{margin:4px 0}
  .toc b{color:var(--brand);margin-right:8px;font-weight:700}
  .art{margin:28px 0;break-inside:avoid}
  .art h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line);display:flex;align-items:baseline;gap:14px}
  .art h2 .art-n{color:var(--brand);font-size:11px;letter-spacing:.1em;white-space:nowrap}
  .clauses p{position:relative;padding-left:46px;margin:10px 0;color:var(--text)}
  .clauses p .cn{position:absolute;left:0;top:0;font-weight:700;color:var(--brand);font-size:12px}
  .clauses p.bullet{padding-left:26px}
  .clauses p.bullet::before{content:"▸";position:absolute;left:6px;color:var(--brand);font-size:10px}
  .anexo{color:var(--dim);font-size:12px;margin-top:22px;padding-top:14px;border-top:1px solid var(--line)}
  .anexo a{color:var(--brand)}
  .foot{margin-top:48px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--dim);display:flex;justify-content:space-between}
  .noprint{position:fixed;top:14px;right:14px;display:flex;gap:8px;z-index:9}
  .noprint button{padding:9px 15px;border:0;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer;font-family:'Chakra Petch',system-ui,sans-serif}
  .noprint .p{background:var(--brand);color:#04120a}.noprint .c{background:rgba(255,255,255,.1);color:var(--text)}
  @media print{
    :root{ --bg:#fff; --elev:#fff; --text:#14161c; --dim:#5a5f6b; --line:rgba(0,0,0,.14); }
    body{padding:0 0 40px;max-width:none}
    .toc{background:none}
    .noprint{display:none}
    .art{break-inside:avoid}
  }
</style></head><body>
  <div class="noprint"><button class="p" onclick="window.print()">Imprimir / Guardar PDF</button><button class="c" onclick="window.close()">Cerrar</button></div>
  <header class="doc-hd">
    <div class="kicker">STELIANT ESPORTS · REGLAMENTO OFICIAL DE TORNEO</div>
    <h1>${esc(r.meta.title)}</h1>
    <div class="sub">${esc(r.meta.subtitle)}</div>
    <div class="meta">Organiza ${esc(r.meta.organizer)} · Emitido ${esc(r.meta.generatedAt)} · ${esc(r.meta.publicId)}</div>
  </header>
  <nav class="toc"><h3>Índice</h3><ol>${toc}</ol></nav>
  ${body}
  ${r.attachedDoc ? `<p class="anexo">Anexo: <a href="${esc(r.attachedDoc.url)}" target="_blank" rel="noreferrer">${esc(r.attachedDoc.name)}</a> — documento complementario adjunto por la organización.</p>` : ''}
  <div class="foot"><span>GlitchGang · ${esc(r.meta.title)}</span><span>${esc(r.meta.publicId)}</span></div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.open(); w.document.write(html); w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* boton manual */ } }, 600)
}

