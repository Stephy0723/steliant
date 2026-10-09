// ════════════════════════════════════════════════════════════
//  Exportación PDF/CSV de JUGADORES. Usa reportKit (mismo diseño
//  que equipos/torneos): portada, ficha por jugador, tabla y cierre
//  con código QR + link de verificación.
// ════════════════════════════════════════════════════════════
import {
  C, mm, px, list, money, text, fill, stroke, drawBadge, codeChip, header, footer,
  sectionTitle, fieldGrid, countBy, drawBarChart, statusKind, statusText, initials,
  drawCover, drawTablePages, drawClosing, buildMeta, attachQr, exportCsv, newDoc,
} from './reportKit.js'

const GENDER_LABEL = { male: 'Masculino', female: 'Femenino', non_binary: 'No binario', prefer_not_to_say: 'Prefiere no decir', other: 'Otro' }
const genderLabel = (g) => GENDER_LABEL[g] || g || '-'

// Campos exportables (CSV, columnas de tabla y selector del modal)
export const PLAYER_EXPORT_FIELDS = [
  { key: 'nick', label: 'Username', section: 'Perfil', get: p => `@${p.nick}` },
  { key: 'realName', label: 'Nombre completo', section: 'Perfil', get: p => p.realName },
  { key: 'email', label: 'Email', section: 'Perfil', get: p => p.email },
  { key: 'phone', label: 'Telefono', section: 'Perfil', get: p => p.phone },
  { key: 'gender', label: 'Genero', section: 'Perfil', get: p => genderLabel(p.gender) },
  { key: 'birthDate', label: 'Fecha de nacimiento', section: 'Perfil', get: p => p.birthDate },
  { key: 'age', label: 'Edad', section: 'Perfil', get: p => p.age != null ? String(p.age) : '-' },
  { key: 'country', label: 'Pais', section: 'Perfil', get: p => p.countryName || p.country },
  { key: 'city', label: 'Ciudad', section: 'Perfil', get: p => p.city },
  { key: 'province', label: 'Provincia', section: 'Perfil', get: p => p.province },
  { key: 'mainGame', label: 'Juego', section: 'Perfil', get: p => p.mainGame },
  { key: 'role', label: 'Rol', section: 'Perfil', get: p => p.role },
  { key: 'status', label: 'Estatus', section: 'Perfil', get: p => statusText(p.status), badge: true, badgeKind: p => p.status },
  { key: 'verified', label: 'Verificado', section: 'Perfil', get: p => p.verified ? 'Si' : 'No', badge: true, badgeKind: p => p.verified ? 'verificado' : 'no' },
  { key: 'joined', label: 'Registro', section: 'Perfil', get: p => p.joined },
  { key: 'lastActive', label: 'Ultima actividad', section: 'Perfil', get: p => p.lastActive },
  { key: 'publicId', label: 'ID publico', section: 'Identificadores', get: p => p.publicId },
  { key: 'internalId', label: 'ID interno', section: 'Identificadores', get: p => p.internalId },
  { key: 'shortId', label: 'ID corto', section: 'Identificadores', get: p => p.shortId },
  { key: 'uuid', label: 'UUID', section: 'Identificadores', get: p => p.uuid },
  { key: 'verifyId', label: 'ID verificacion', section: 'Identificadores', get: p => p.verifyId },
  { key: 'countryNumber', label: 'Codigo pais', section: 'Identificadores', get: p => p.countryNumber },
  { key: 'plan', label: 'Plan', section: 'Identificadores', get: p => p.plan },
  { key: 'planId', label: 'ID plan', section: 'Identificadores', get: p => p.planId },
  { key: 'level', label: 'Nivel', section: 'Competitivo', get: p => String(p.level) },
  { key: 'rank', label: 'Rango', section: 'Competitivo', get: p => p.rank },
  { key: 'matches', label: 'Partidas', section: 'Competitivo', get: p => String(p.matches) },
  { key: 'winrate', label: 'Win rate', section: 'Competitivo', get: p => `${p.winrate}%` },
  { key: 'earnings', label: 'Ganancias', section: 'Competitivo', get: p => money(p.earnings) },
  { key: 'teams', label: 'Equipos', section: 'Relaciones', get: p => list(p.teams, 'name') },
  { key: 'teamIds', label: 'IDs equipos', section: 'Relaciones', get: p => list(p.teams, 'id') },
  { key: 'communities', label: 'Comunidades', section: 'Relaciones', get: p => list(p.communities, 'name') },
  { key: 'communityIds', label: 'IDs comunidades', section: 'Relaciones', get: p => list(p.communities, 'id') },
  { key: 'university', label: 'Universidad', section: 'Relaciones', get: p => p.university?.name || '-' },
  { key: 'universityId', label: 'ID universidad', section: 'Relaciones', get: p => p.university?.id || '-' },
  { key: 'discord', label: 'Discord', section: 'Redes sociales', get: p => p.socials?.discord || '-' },
  { key: 'instagram', label: 'Instagram', section: 'Redes sociales', get: p => p.socials?.instagram || '-' },
  { key: 'facebook', label: 'Facebook', section: 'Redes sociales', get: p => p.socials?.facebook || '-' },
  { key: 'tiktok', label: 'TikTok', section: 'Redes sociales', get: p => p.socials?.tiktok || '-' },
  { key: 'twitch', label: 'Twitch', section: 'Redes sociales', get: p => p.socials?.twitch || '-' },
  { key: 'youtube', label: 'YouTube', section: 'Redes sociales', get: p => p.socials?.youtube || '-' },
  { key: 'x', label: 'X (Twitter)', section: 'Redes sociales', get: p => p.socials?.x || '-' },
  { key: 'kick', label: 'Kick', section: 'Redes sociales', get: p => p.socials?.kick || '-' },
  { key: 'web', label: 'Sitio web', section: 'Redes sociales', get: p => p.socials?.web || '-' },
]

export const PLAYER_EXPORT_PRESETS = {
  full: PLAYER_EXPORT_FIELDS.map(f => f.key),
  profile: ['nick', 'realName', 'email', 'country', 'mainGame', 'status', 'verified', 'joined'],
  ids: ['nick', 'publicId', 'internalId', 'countryNumber', 'plan', 'planId', 'teamIds', 'universityId'],
  competitive: ['nick', 'mainGame', 'level', 'rank', 'matches', 'winrate', 'earnings', 'status'],
}

const FIELD_MAP = Object.fromEntries(PLAYER_EXPORT_FIELDS.map(f => [f.key, f]))
function resolveFields(keys) {
  const safe = keys?.length ? keys : PLAYER_EXPORT_PRESETS.profile
  return safe.map(k => FIELD_MAP[k]).filter(Boolean)
}

const playerTotals = (rows) => [
  ['Jugadores', rows.length],
  ['Activos', rows.filter(p => statusKind(p.status) === 'ok').length],
  ['Verificados', rows.filter(p => p.verified).length],
  ['Equipos', new Set(rows.flatMap(p => (p.teams || []).map(t => t.name))).size],
]

// ── Ficha individual (una página por jugador) ──
function drawPlayerFicha(doc, p, meta, idx, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Ficha de jugador · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)

  const av = mm(24)
  fill(doc, C.ink); stroke(doc, C.accent); doc.setLineWidth(1.6)
  doc.roundedRect(x, y, av, av, mm(2.5), mm(2.5), 'FD')
  text(doc, initials(p.realName || p.nick), x + av / 2, y + av / 2 + mm(3), { size: px(20), color: C.accent, bold: true, align: 'center' })

  const nx = x + av + mm(7)
  text(doc, p.nick, nx, y + mm(8), { size: px(24), color: C.ink, bold: true })
  text(doc, `${p.realName} · ${p.mainGame}`, nx, y + mm(14), { size: px(12), color: C.muted })
  drawBadge(doc, nx, y + mm(20), statusText(p.status), statusKind(p.status))

  text(doc, 'ID DE JUGADOR', W - mm(14), y + mm(3), { size: px(9), color: C.muted, align: 'right', charSpace: 1 })
  codeChip(doc, W - mm(14), y + mm(9), p.publicId, 'right')

  y += av + mm(10)

  const foot = () => footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Ficha ${idx} de ${total}`, `${meta.web} · ${meta.email}`)
  // Sección con paginación automática (si no cabe, nueva página con encabezado).
  const sec = (title, items, cols = 3) => {
    const need = mm(10) + Math.ceil(items.length / cols) * mm(11)
    if (y + need > H - mm(20)) {
      foot(); doc.addPage(); header(doc, W, `Ficha de jugador · ${meta.period}`, meta.emittedDate); y = mm(34)
    }
    sectionTitle(doc, x, y, bw, title); y += mm(8)
    y = fieldGrid(doc, x, y, bw, items, cols)
    y += mm(2)
  }
  const s = p.socials || {}

  sec('Identidad', [
    { k: 'Username', v: `@${p.nick}` },
    { k: 'Nombre completo', v: p.realName },
    { k: 'Pais', v: `${p.countryName || p.country} · #${p.countryNumber}` },
    { k: 'Universidad', v: p.university ? `Si · ${p.university.name}` : 'No' },
    { k: 'Estatus', v: statusText(p.status), badge: statusKind(p.status) },
    { k: 'Verificado', v: p.verified ? 'Verificado' : 'Sin verificar', badge: p.verified ? 'ok' : 'warn' },
  ])
  sec('Contacto y datos personales', [
    { k: 'Correo electronico', v: p.email },
    { k: 'Telefono', v: p.phone },
    { k: 'Genero', v: genderLabel(p.gender) },
    { k: 'Fecha de nacimiento', v: p.birthDate },
    { k: 'Edad', v: p.age != null ? `${p.age}` : '-' },
    { k: 'Ciudad', v: p.city },
    { k: 'Provincia', v: p.province },
    { k: 'Ultima actividad', v: p.lastActive },
  ])
  sec('Competitivo', [
    { k: 'Juego principal', v: p.mainGame },
    { k: 'Nivel', v: `${p.level} · ${p.rank}` },
    { k: 'Win rate', v: `${p.winrate}%` },
    { k: 'Partidas', v: String(p.matches) },
    { k: 'Ganancias', v: money(p.earnings) },
    { k: 'Rol', v: p.role },
  ])
  sec('Identificadores', [
    { k: 'ID publico', v: p.publicId, mono: true },
    { k: 'ID interno', v: p.internalId, mono: true },
    { k: 'ID corto', v: p.shortId, mono: true },
    { k: 'UUID', v: p.uuid, mono: true },
    { k: 'ID verificacion', v: p.verifyId, mono: true },
    { k: 'Codigo de pais', v: `#${p.countryNumber}`, mono: true },
  ])
  sec('Pertenencias', [
    { k: 'Plan', v: `${p.plan} · ${p.planId}` },
    { k: 'Equipos', v: list(p.teams, 'name') },
    { k: 'IDs de equipo', v: list(p.teams, 'id'), mono: true },
    { k: 'Comunidades', v: list(p.communities, 'name') },
    { k: 'IDs de comunidad', v: list(p.communities, 'id'), mono: true },
    { k: 'Universidad', v: p.university?.name || '-' },
    { k: 'ID universidad', v: p.university?.id || '-', mono: true },
  ])
  sec('Redes sociales', [
    { k: 'Discord', v: s.discord }, { k: 'Instagram', v: s.instagram }, { k: 'Facebook', v: s.facebook },
    { k: 'TikTok', v: s.tiktok }, { k: 'Twitch', v: s.twitch }, { k: 'YouTube', v: s.youtube },
    { k: 'X (Twitter)', v: s.x }, { k: 'Kick', v: s.kick }, { k: 'Sitio web', v: s.web },
  ])

  foot()
}

// ── Resumen con gráficas ──
function drawPlayerSummary(doc, players, meta) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, W, `Resumen general · ${meta.period}`, meta.emittedDate)

  const x = mm(14)
  const bw = W - mm(28)
  let y = mm(34)
  fill(doc, C.accent); doc.rect(x, y - mm(5), mm(1.4), mm(7), 'F')
  text(doc, 'RESUMEN DE JUGADORES', x + mm(4), y, { size: px(20), color: C.ink, bold: true })
  text(doc, `${players.length} jugadores`, W - mm(14), y, { size: px(10), color: C.muted, align: 'right' })
  y += mm(10)

  const kpis = playerTotals(players)
  const cw = (bw - mm(18)) / 4
  kpis.forEach((k, i) => {
    const cx = x + i * (cw + mm(6))
    stroke(doc, C.line); doc.setLineWidth(0.8); fill(doc, C.white)
    doc.roundedRect(cx, y, cw, mm(20), mm(2.5), mm(2.5), 'FD')
    fill(doc, C.accent); doc.rect(cx, y, cw, mm(1.2), 'F')
    text(doc, String(k[0]).toUpperCase(), cx + mm(4), y + mm(7), { size: px(8.5), color: C.muted })
    text(doc, String(k[1]), cx + mm(4), y + mm(16), { size: px(20), color: C.ink, bold: true })
  })
  y += mm(28)

  const colGap = mm(10)
  const colW = (bw - colGap) / 2
  const byCountry = countBy(players, p => p.countryName || p.country).slice(0, 6)
  const byGame = countBy(players, p => p.mainGame).slice(0, 6)
  sectionTitle(doc, x, y, colW, 'Por pais')
  sectionTitle(doc, x + colW + colGap, y, colW, 'Por juego')
  const yb = y + mm(9)
  drawBarChart(doc, x, yb, colW, byCountry, Math.max(...byCountry.map(r => r[1]), 1))
  drawBarChart(doc, x + colW + colGap, yb, colW, byGame, Math.max(...byGame.map(r => r[1]), 1))

  footer(doc, W, H, `${meta.requestedBy} · ${meta.printCode} · Resumen general`, `${meta.web} · ${meta.email}`)
}

// ════════ API pública ════════
export function exportPlayersCsv(players, keys, filename = null) {
  exportCsv(players, resolveFields(keys), filename || `jugadores-${new Date().toISOString().slice(0, 10)}.csv`)
}

export async function exportPlayersPdf({ players, keys, format = 'profile', requestedBy, title, description, filename } = {}) {
  const rows = players || []
  if (!rows.length) return
  const fields = resolveFields(keys)
  const tableFields = fields.length ? fields : PLAYER_EXPORT_FIELDS

  const meta = buildMeta({
    requestedBy,
    docType: 'Jugadores',
    coverLines: ['EXPEDIENTE DE', 'JUGADORES'],
    recordsLabel: `${rows.length} jugadores`,
    contentLabel: format === 'profile' ? 'Fichas + tabla' : format === 'summary' ? 'Resumen estadistico' : 'Tabla resumen',
    chips: [['Jugadores', true], ['Equipos', false], ['Torneos / Eventos', false]],
  })
  if (title) meta.title = title
  if (description) meta.description = description
  await attachQr(meta)

  const doc = await newDoc()
  drawCover(doc, rows.length, meta)

  if (format === 'summary') {
    doc.addPage(); drawPlayerSummary(doc, rows, meta)
  } else if (format === 'profile') {
    rows.forEach((p, i) => { doc.addPage(); drawPlayerFicha(doc, p, meta, i + 1, rows.length) })
    doc.addPage(); drawTablePages(doc, rows, tableFields, meta, { title: 'LISTADO DE JUGADORES', totals: playerTotals(rows) })
  } else {
    doc.addPage(); drawTablePages(doc, rows, tableFields, meta, { title: 'LISTADO DE JUGADORES', totals: playerTotals(rows) })
  }

  doc.addPage(); drawClosing(doc, meta)
  doc.save(filename || `jugadores-${new Date().toISOString().slice(0, 10)}.pdf`)
}

