import mongoose from 'mongoose'
import { News } from '../models/News.js'
import { createNewsCodes } from '../services/codes.service.js'
import { DiscordServerConfig } from '../models/DiscordServerConfig.js'
import { publishPublication, queuePublicationForSource } from '../services/discordPublications.service.js'

// Noticia publicada en la web -> queda en la cola del Control Center de
// Discord (/admin/discord-sync) para que el admin la publique en #noticias.
// Con "Noticias automaticas" encendido (Automatizaciones) sale sola.
// Nunca bloquea ni rompe el guardado de la noticia.
function queueNewsForDiscord(article, userId) {
  if (article?.status !== 'publicado') return
  queuePublicationForSource({
    type: 'news',
    sourceType: 'news',
    sourceId: article._id,
    sourceCode: article.publicCode || '',
    title: article.title,
    body: article.excerpt || '',
    url: `/noticias/${article.slug}`,
    imageUrl: article.cover || article.image || '',
    ctaLabel: 'Leer noticia',
    ctaUrl: `/noticias/${article.slug}`,
  }, userId)
    .then(async publication => {
      if (!publication || publication.status !== 'ready') return
      const serverConfig = await DiscordServerConfig.getMain()
      if (serverConfig.automations?.newsAutoPublish) await publishPublication(publication, userId)
    })
    .catch(error => console.error('[news] No se pudo auto-publicar en Discord:', error.message))
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function listNews(req, res, next) {
  try {
    const { category, game, featured, status, page = 1, limit = 100 } = req.query
    const filter = {}
    if (category) filter.category = category
    if (game) filter.game = game
    if (featured === 'true') filter.featured = true
    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin
    if (status && status !== 'all') {
      filter.status = status
    } else if (status === 'all' && isAdmin) {
      // Admin panel needs drafts and published articles.
    } else {
      const today = new Date().toISOString().slice(0, 10)
      filter.status = 'publicado'
      filter.$or = [{ scheduledDate: '' }, { scheduledDate: { $exists: false } }, { scheduledDate: { $lte: today } }]
    }

    const news = await News.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean()

    const total = await News.countDocuments(filter)
    res.json({ news, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

export async function getNewsItem(req, res, next) {
  try {
    const value = String(req.params.id || '').trim()
    const identity = [{ slug: value }]
    if (mongoose.Types.ObjectId.isValid(value)) identity.unshift({ _id: value })
    const news = await News.findOne({ $or: identity }).lean()
    if (!news) return res.status(404).json({ message: 'Article not found' })
    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin
    const today = new Date().toISOString().slice(0, 10)
    const isScheduled = news.scheduledDate && news.scheduledDate > today
    if (!isAdmin && (news.status !== 'publicado' || isScheduled)) {
      return res.status(404).json({ message: 'Article not found' })
    }

    // Increment views without waiting
    News.updateOne({ _id: news._id }, { $inc: { views: 1 } }).catch(() => {})
    res.json(news)
  } catch (err) { next(err) }
}

// Vistas/clics/compartidos solo los cuenta el servidor (getNewsItem y
// trackNews); el panel ya no puede escribirlos. El tiempo de lectura sale del
// cuerpo real (~200 palabras por minuto).
function readingMinutes(body = '') {
  const words = String(body).trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

// POST /news/:id/track  { kind: 'click' | 'share' } — publico.
export async function trackNews(req, res, next) {
  try {
    const field = { click: 'clicks', share: 'shares' }[req.body?.kind]
    if (!field) return res.status(400).json({ message: 'kind invalido' })
    const result = await News.updateOne({ _id: req.params.id, status: 'publicado' }, { $inc: { [field]: 1 } })
    if (!result.matchedCount) return res.status(404).json({ message: 'Noticia no encontrada' })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function createNews(req, res, next) {
  try {
    const {
      title, excerpt, body, category, game, organizer, tags, featured, image, author,
      cover, photo, status, links, scheduledDate, seoDescription, date
    } = req.body
    if (!title || !excerpt || !body) return res.status(400).json({ message: 'title, excerpt and body are required' })

    let slug = slugify(title)
    const exists = await News.findOne({ slug })
    if (exists) slug = `${slug}-${Date.now()}`

    const codes = await createNewsCodes(req.user.playerCode, req.user._id)
    const article = await News.create({
      publicCode: codes.publicCode,
      internalCode: codes.internalCode,
      title, slug, excerpt, body,
      category: category || 'general',
      game: game || '',
      tags: tags || [],
      featured: featured === true,
      image: cover || image || '',
      cover: cover || image || '',
      photo: photo || '',
      status: status || 'borrador',
      links: links || [],
      scheduledDate: scheduledDate || '',
      seoDescription: seoDescription || '',
      readingTime: readingMinutes(body),
      date: date || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      author: author || req.user.nick,
      createdBy: req.user._id,
    })

    queueNewsForDiscord(article, req.user._id)
    res.status(201).json(article)
  } catch (err) { next(err) }
}

export async function updateNews(req, res, next) {
  try {
    const allowed = [
      'title', 'excerpt', 'body', 'category', 'game', 'organizer', 'tags', 'featured', 'image', 'author',
      'cover', 'photo', 'status', 'links', 'scheduledDate', 'seoDescription', 'date'
    ]
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (updates.cover) {
      updates.image = updates.cover
    }
    if (updates.body !== undefined) updates.readingTime = readingMinutes(updates.body)

    const article = await News.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true })
    if (!article) return res.status(404).json({ message: 'Article not found' })
    queueNewsForDiscord(article, req.user._id)
    res.json(article)
  } catch (err) { next(err) }
}

export async function deleteNews(req, res, next) {
  try {
    const article = await News.findByIdAndDelete(req.params.id)
    if (!article) return res.status(404).json({ message: 'Article not found' })
    res.json({ message: 'Article deleted' })
  } catch (err) { next(err) }
}
