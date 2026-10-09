import { SiteAd, SITE_AD_SLOTS } from '../models/SiteAd.js'
import { SitePromo } from '../models/SitePromo.js'

// ── Anuncios "de casa" (banner/tournament/floating/dashboard) ───────────────

// GET /site-ads — público. Devuelve todos (activos e inactivos); las páginas
// que consumen esto filtran por `.active` igual que antes con localStorage.
export async function listSiteAds(req, res, next) {
  try {
    const ads = await SiteAd.find().sort({ slot: 1, order: 1 })
    res.json(ads)
  } catch (e) { next(e) }
}

// POST /admin/site-ads
export async function createSiteAd(req, res, next) {
  try {
    const { slot } = req.body
    if (!SITE_AD_SLOTS.includes(slot)) {
      return res.status(400).json({ error: `Slot inválido. Debe ser uno de: ${SITE_AD_SLOTS.join(', ')}` })
    }
    const order = req.body.order ?? await SiteAd.countDocuments({ slot })
    const ad = await SiteAd.create({ ...req.body, order })
    res.status(201).json(ad)
  } catch (e) { next(e) }
}

// PATCH /admin/site-ads/:id
export async function updateSiteAd(req, res, next) {
  try {
    const ad = await SiteAd.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!ad) return res.status(404).json({ error: 'Anuncio no encontrado' })
    res.json(ad)
  } catch (e) { next(e) }
}

// DELETE /admin/site-ads/:id
export async function deleteSiteAd(req, res, next) {
  try {
    const ad = await SiteAd.findByIdAndDelete(req.params.id)
    if (!ad) return res.status(404).json({ error: 'Anuncio no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// PATCH /admin/site-ads/reorder — { items: [{ id, order }] }
export async function reorderSiteAds(req, res, next) {
  try {
    const { items } = req.body
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items debe ser un array' })
    await Promise.all(items.map(({ id, order }) => SiteAd.findByIdAndUpdate(id, { order })))
    const ads = await SiteAd.find().sort({ slot: 1, order: 1 })
    res.json(ads)
  } catch (e) { next(e) }
}

// POST /site-ads/:id/impression — público, tracking real
export async function trackSiteAdImpression(req, res, next) {
  try {
    const ad = await SiteAd.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1 } })
    if (!ad) return res.status(404).json({ error: 'Anuncio no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// POST /site-ads/:id/click — público, tracking real
export async function trackSiteAdClick(req, res, next) {
  try {
    const ad = await SiteAd.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } })
    if (!ad) return res.status(404).json({ error: 'Anuncio no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// ── Promos modales ───────────────────────────────────────────────────────────

// GET /site-promos — público
export async function listSitePromos(req, res, next) {
  try {
    const promos = await SitePromo.find().sort({ order: 1 })
    res.json(promos)
  } catch (e) { next(e) }
}

// POST /admin/site-promos — { id: 'fdv-2026', title, ... } (id = slug legible)
export async function createSitePromo(req, res, next) {
  try {
    const { id, ...rest } = req.body
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'ID inválido (solo letras minúsculas, números y guiones)' })
    }
    const order = rest.order ?? await SitePromo.countDocuments()
    const promo = await SitePromo.create({ ...rest, slug: id, order })
    res.status(201).json(promo)
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Ya existe una promo con ese ID' })
    next(e)
  }
}

// PATCH /admin/site-promos/:slug
export async function updateSitePromo(req, res, next) {
  try {
    const { id, ...rest } = req.body
    const update = { ...rest }
    if (id) update.slug = id
    const promo = await SitePromo.findOneAndUpdate({ slug: req.params.slug }, update, { new: true, runValidators: true })
    if (!promo) return res.status(404).json({ error: 'Promo no encontrada' })
    res.json(promo)
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Ya existe una promo con ese ID' })
    next(e)
  }
}

// DELETE /admin/site-promos/:slug
export async function deleteSitePromo(req, res, next) {
  try {
    const promo = await SitePromo.findOneAndDelete({ slug: req.params.slug })
    if (!promo) return res.status(404).json({ error: 'Promo no encontrada' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}
