import { SiteAnnouncement } from '../models/SiteAnnouncement.js'
import { ChangelogEntry } from '../models/ChangelogEntry.js'

const ANN_FIELDS = ['type', 'title', 'message', 'link', 'date', 'period', 'active']
const LOG_FIELDS = ['version', 'type', 'title', 'items']

const pick = (body, fields) => Object.fromEntries(fields.filter(f => body?.[f] !== undefined).map(f => [f, body[f]]))
const todayISO = () => new Date().toISOString().slice(0, 10)

function mapAnnouncement(a) {
  return {
    id: String(a._id), type: a.type, title: a.title, message: a.message, link: a.link,
    date: a.date, period: a.period, active: a.active, createdAt: a.createdAt,
  }
}

function mapChangelog(c) {
  return {
    id: String(c._id), version: c.version, type: c.type, title: c.title, items: c.items || [],
    date: c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    createdAt: c.createdAt,
  }
}

function cleanItems(items) {
  return (Array.isArray(items) ? items : String(items || '').split('\n'))
    .map(i => String(i).trim()).filter(Boolean).slice(0, 30)
}

// ─── Anuncios ────────────────────────────────────────────────────────────────

export async function listAnnouncementsAdmin(req, res, next) {
  try {
    const rows = await SiteAnnouncement.find().sort({ date: -1, createdAt: -1 }).limit(300).lean()
    res.json({ announcements: rows.map(mapAnnouncement) })
  } catch (error) { next(error) }
}

export async function createAnnouncement(req, res, next) {
  try {
    const data = pick(req.body, ANN_FIELDS)
    if (!String(data.title || '').trim()) return res.status(400).json({ message: 'El titulo es requerido' })
    const row = await SiteAnnouncement.create({ date: todayISO(), ...data, createdBy: req.user?._id || null })
    res.status(201).json({ announcement: mapAnnouncement(row) })
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Datos de anuncio invalidos' })
    next(error)
  }
}

export async function updateAnnouncement(req, res, next) {
  try {
    const row = await SiteAnnouncement.findByIdAndUpdate(req.params.id, pick(req.body, ANN_FIELDS), { new: true, runValidators: true }).lean()
    if (!row) return res.status(404).json({ message: 'Anuncio no encontrado' })
    res.json({ announcement: mapAnnouncement(row) })
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Datos de anuncio invalidos' })
    next(error)
  }
}

export async function deleteAnnouncement(req, res, next) {
  try {
    const row = await SiteAnnouncement.findByIdAndDelete(req.params.id)
    if (!row) return res.status(404).json({ message: 'Anuncio no encontrado' })
    res.json({ message: 'Anuncio eliminado' })
  } catch (error) { next(error) }
}

// GET /site/announcements — activos de hoy en adelante (publico).
export async function listPublicAnnouncements(req, res, next) {
  try {
    const rows = await SiteAnnouncement.find({ active: true, date: { $gte: todayISO() } }).sort({ date: 1 }).limit(20).lean()
    res.json({ announcements: rows.map(mapAnnouncement) })
  } catch (error) { next(error) }
}

// ─── Changelog ───────────────────────────────────────────────────────────────

export async function listChangelog(req, res, next) {
  try {
    const rows = await ChangelogEntry.find().sort({ createdAt: -1 }).limit(Number(req.query.limit) > 0 ? Math.min(Number(req.query.limit), 200) : 100).lean()
    res.json({ changelog: rows.map(mapChangelog) })
  } catch (error) { next(error) }
}

export async function createChangelogEntry(req, res, next) {
  try {
    const data = pick(req.body, LOG_FIELDS)
    if (!String(data.title || '').trim()) return res.status(400).json({ message: 'El titulo es requerido' })
    data.items = cleanItems(data.items)
    const row = await ChangelogEntry.create({ ...data, createdBy: req.user?._id || null })
    res.status(201).json({ entry: mapChangelog(row) })
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Datos de changelog invalidos' })
    next(error)
  }
}

export async function deleteChangelogEntry(req, res, next) {
  try {
    const row = await ChangelogEntry.findByIdAndDelete(req.params.id)
    if (!row) return res.status(404).json({ message: 'Entrada no encontrada' })
    res.json({ message: 'Entrada eliminada' })
  } catch (error) { next(error) }
}
