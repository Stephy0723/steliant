import { ExportLog } from '../models/ExportLog.js'
import { Organization } from '../models/Organization.js'
import { Tournament } from '../models/Tournament.js'
import { UniversityCatalog } from '../models/UniversityCatalog.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { Brand } from '../models/Brand.js'
import { Campaign } from '../models/Campaign.js'
import { RoleApplication } from '../models/RoleApplication.js'
import { OrganizationRequest } from '../models/OrganizationRequest.js'
import { GameRequest } from '../models/GameRequest.js'
import { PublicationRequest } from '../models/PublicationRequest.js'
import { Order } from '../models/Order.js'

const ITBIS_RATE = 0.18
const dateOf = (d) => d ? new Date(d).toLocaleDateString('es-DO') : '—'
const STATUS_ES = {
  active: 'Activo', paused: 'Pausado', inactive: 'Inactivo', pending: 'Pendiente', approved: 'Aprobado',
  rejected: 'Rechazado', reviewing: 'En revision', verified: 'Verificado',
  paid: 'Pagado', demo_paid: 'Pagado (demo)', refunded: 'Reembolsado', failed: 'Fallido',
  canceled: 'Cancelado', requires_payment: 'Pendiente de pago',
}
const es = (s) => STATUS_ES[s] || s || '—'
const realName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.nick || '—'

async function organizaciones() {
  const [orgs, counts] = await Promise.all([
    Organization.find().populate('owner', 'nick email').lean(),
    Tournament.aggregate([{ $match: { organization: { $ne: null } } }, { $group: { _id: '$organization', n: { $sum: 1 } } }]),
  ])
  const byOrg = new Map(counts.map(c => [String(c._id), c.n]))
  return orgs.map(o => ({
    id: String(o._id),
    name: o.name,
    owner: o.owner?.nick || '—',
    email: o.owner?.email || '—',
    admins: (o.admins || []).length,
    discord: o.discordGuildId || 'Sin servidor',
    whatsapp: o.whatsappGroupId ? 'Conectado' : 'No',
    tournaments: byOrg.get(String(o._id)) || 0,
    status: es(o.status),
    created: dateOf(o.createdAt),
  }))
}

// Estudiantes verificados de verdad (User.university, la misma fuente que el
// catalogo admin): una solicitud "approved" puede ser de alguien que despues
// se desvinculo.
async function universidades() {
  const [catalog, students, teams] = await Promise.all([
    UniversityCatalog.find().select('id tag name region city campuses').lean(),
    User.find({ 'university.verificationStatus': 'verified', deleted: { $ne: true } }).select('university.universityId university.campus').lean(),
    Team.find({ 'university.isUniversityTeam': true }).select('university.universityId university.universityTag').lean(),
  ])
  const count = (rows, get) => rows.reduce((m, r) => { const k = get(r); if (k) m.set(k, (m.get(k) || 0) + 1); return m }, new Map())
  const studentsByUni = count(students, u => u.university?.universityId)
  const teamsByUni = count(teams, t => t.university?.universityId || String(t.university?.universityTag || '').toLowerCase())
  return catalog.map(u => ({
    id: u.tag || u.id,
    name: u.name,
    region: u.region || '—',
    city: u.city || '—',
    campuses: (u.campuses || []).map(c => c?.name || c).filter(Boolean).join(', ') || '—',
    students: studentsByUni.get(u.id) || 0,
    teams: teamsByUni.get(u.id) || 0,
  }))
}

async function staff() {
  const users = await User.find({ deleted: { $ne: true }, $or: [{ role: { $in: ['admin', 'moderator'] } }, { roles: 'moderator' }] }).lean()
  return users.map(u => ({
    id: u.playerCode, internalId: u.internalCode, name: u.nick, realName: realName(u),
    role: u.role === 'admin' ? 'Administrador' : 'Moderador',
    email: u.email, country: u.countryCode || '—',
    status: u.isBanned ? 'Baneado' : 'Activo', joined: dateOf(u.createdAt),
  }))
}

async function casters() {
  const [users, tours] = await Promise.all([
    User.find({ deleted: { $ne: true }, $or: [{ role: 'caster' }, { roles: 'caster' }] }).lean(),
    Tournament.find({ 'staff.casters.0': { $exists: true } }).select('staff.casters').lean(),
  ])
  const assigned = new Map()
  tours.forEach(t => (t.staff?.casters || []).filter(c => !c.removedAt).forEach(c => assigned.set(String(c.user), (assigned.get(String(c.user)) || 0) + 1)))
  return users.map(u => ({
    id: u.roleProfiles?.caster?.casterCode || u.playerCode,
    internalId: u.roleProfiles?.caster?.casterInternalCode || u.internalCode,
    name: u.nick, realName: realName(u),
    games: (u.games || []).join(', ') || '—',
    country: u.countryCode || '—',
    broadcasts: assigned.get(String(u._id)) || 0,
    email: u.email,
    status: u.isBanned ? 'Baneado' : 'Activo',
  }))
}

async function arbitros() {
  const tours = await Tournament.find({ 'staffMembers.role': 'Arbitro' }).select('title game staffMembers').lean()
  const byRef = new Map()
  tours.forEach(t => (t.staffMembers || []).filter(s => s.role === 'Arbitro' && s.status === 'accepted').forEach(s => {
    const key = String(s.user || s.playerCode || s.name)
    const row = byRef.get(key) || { id: s.playerCode || '—', name: s.nick || s.name, games: new Set(), tournaments: 0, list: [] }
    row.tournaments += 1
    if (t.game) row.games.add(t.game)
    row.list.push(t.title)
    byRef.set(key, row)
  }))
  return [...byRef.values()].map(r => ({
    id: r.id, name: r.name, games: [...r.games].join(', ') || '—',
    tournaments: r.tournaments, tournamentList: r.list.slice(0, 10).join(' | '),
  }))
}

async function sponsors() {
  const [brands, campaigns] = await Promise.all([
    Brand.find().lean(),
    Campaign.aggregate([{ $group: { _id: '$brandId', n: { $sum: 1 }, impressions: { $sum: '$impressions' } } }]),
  ])
  const byBrand = new Map(campaigns.map(c => [String(c._id), c]))
  return brands.map(b => ({
    id: b.code, internalId: b.internalCode || '—', name: b.name, industry: b.industry,
    tier: b.tier, campaigns: byBrand.get(String(b._id))?.n || 0,
    impressions: byBrand.get(String(b._id))?.impressions || 0,
    contact: b.contactName || '—', email: b.contactEmail || '—',
    status: es(b.status), since: dateOf(b.since),
  }))
}

async function formularios() {
  const [roles, orgs, games, pubs] = await Promise.all([
    RoleApplication.find().populate('userId', 'nick').lean(),
    OrganizationRequest.find().populate('requester', 'nick').lean(),
    GameRequest.find().lean(),
    PublicationRequest.find().lean(),
  ])
  return [
    ...roles.map(r => ({ id: r.publicCode || String(r._id), title: `Solicitud de ${r.roleLabel}`, type: 'Rol de plataforma', submittedBy: r.userId?.nick || '—', status: es(r.status), date: dateOf(r.createdAt), ts: r.createdAt })),
    ...orgs.map(r => ({ id: String(r._id), title: `Organizacion: ${r.name}`, type: 'Organizacion', submittedBy: r.requester?.nick || '—', status: es(r.status), date: dateOf(r.createdAt), ts: r.createdAt })),
    ...games.map(r => ({ id: String(r._id), title: `Juego: ${r.gameName}`, type: 'Solicitud de juego', submittedBy: r.requesterName || '—', status: es(r.status), date: dateOf(r.createdAt), ts: r.createdAt })),
    ...pubs.map(r => ({ id: String(r._id), title: r.title, type: 'Publicidad', submittedBy: r.userNick || '—', status: es(r.status), date: dateOf(r.createdAt), ts: r.createdAt })),
  ].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)).map(({ ts, ...row }) => row)
}

async function financieros() {
  const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'nick').lean()
  return orders.map(o => ({
    id: o.id,
    concept: o.concept,
    type: o.kind === 'tournament' ? 'Inscripcion de torneo' : 'Plan',
    amount: o.amount,
    itbis: +(o.amount - o.amount / (1 + ITBIS_RATE)).toFixed(2),
    currency: o.currency || 'USD',
    method: o.provider === 'paypal' ? 'PayPal' : o.provider,
    mode: o.mode === 'demo' ? 'Demo' : 'Real',
    user: o.user?.nick || 'Cuenta eliminada',
    status: es(o.status),
    date: dateOf(o.createdAt),
  }))
}

const SOURCES = { organizaciones, universidades, staff, casters, arbitros, sponsors, formularios, financieros }

// GET /admin/export/:entity — registros reales para el Centro de Exportacion.
export async function getExportEntity(req, res, next) {
  try {
    const source = SOURCES[req.params.entity]
    if (!source) return res.status(404).json({ message: 'Entidad no exportable' })
    res.json({ records: await source() })
  } catch (error) { next(error) }
}

// GET /admin/export-counts — cuantos registros tiene cada entidad.
export async function getExportCounts(req, res, next) {
  try {
    const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, fn]) => [key, (await fn()).length]))
    res.json({ counts: Object.fromEntries(entries) })
  } catch (error) { next(error) }
}

function mapLog(l) {
  const d = l.createdAt ? new Date(l.createdAt) : null
  return {
    id: `LOG-${String(l._id).slice(-7).toUpperCase()}`,
    user: l.userName, role: l.role, action: l.action, entity: l.entity, recordId: l.recordId,
    fileType: l.fileType, period: l.period, season: l.season, count: l.count, printCode: l.printCode,
    ip: l.ip || '—',
    date: d ? d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—',
    time: d ? d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—',
    ts: l.createdAt,
  }
}

// GET /admin/export-logs
export async function listExportLogs(req, res, next) {
  try {
    const rows = await ExportLog.find().sort({ createdAt: -1 }).limit(300).lean()
    res.json({ logs: rows.map(mapLog) })
  } catch (error) { next(error) }
}

// POST /admin/export-logs — el usuario y la IP salen del servidor, no del body.
export async function createExportLog(req, res, next) {
  try {
    const b = req.body || {}
    const s = (v, n) => String(v ?? '-').trim().slice(0, n) || '-'
    const row = await ExportLog.create({
      user: req.user?._id || null,
      userName: req.user?.nick || req.user?.email || 'Admin',
      role: req.user?.role === 'admin' ? 'Administrador' : (req.user?.role || 'Administrador'),
      action: s(b.action, 120), entity: s(b.entity, 80), recordId: s(b.recordId, 160),
      fileType: s(b.fileType, 20), period: s(b.period, 80), season: s(b.season, 40),
      count: Math.max(0, Number(b.count) || 0), printCode: s(b.printCode, 80),
      ip: String(req.ip || '').replace(/^::ffff:/, '').slice(0, 80),
    })
    req._adminAudited = true // ya queda en su propia bitacora
    res.status(201).json({ log: mapLog(row) })
  } catch (error) { next(error) }
}

// GET /admin/export-system — export total real (JSON): conteos por coleccion y
// todas las entidades exportables. Antes "Export total" descargaba el
// localStorage del navegador del admin.
export async function getSystemExport(req, res, next) {
  try {
    const { News } = await import('../models/News.js')
    const { Community } = await import('../models/Community.js')
    const { Sanction } = await import('../models/Sanction.js')
    const { Raffle } = await import('../models/Raffle.js')
    const [users, teams, tournaments, communities, orders, brands, news, sanctions, raffles] = await Promise.all([
      User.countDocuments({ deleted: { $ne: true } }), Team.countDocuments(), Tournament.countDocuments(),
      Community.countDocuments(), Order.countDocuments(), Brand.countDocuments(), News.countDocuments(),
      Sanction.countDocuments(), Raffle.countDocuments(),
    ])
    const entities = Object.fromEntries(await Promise.all(Object.entries(SOURCES).map(async ([key, fn]) => [key, await fn()])))
    req._adminAudited = true
    await ExportLog.create({
      user: req.user?._id || null, userName: req.user?.nick || 'Admin', action: 'Export total del sistema',
      entity: 'Sistema', fileType: 'JSON', count: Object.values(entities).reduce((n, rows) => n + rows.length, 0),
      ip: String(req.ip || '').replace(/^::ffff:/, '').slice(0, 80),
    })
    res.json({
      meta: { app: 'GlitchGang', exportType: 'full-system', exportedAt: new Date().toISOString(), exportedBy: req.user?.nick || 'Admin' },
      counts: { users, teams, tournaments, communities, orders, brands, news, sanctions, raffles },
      entities,
    })
  } catch (error) { next(error) }
}
