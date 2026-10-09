import { Creative } from '../models/Creative.js'
import { Campaign } from '../models/Campaign.js'

// ── Pública: servir banners activos por tipo ──────────────────────────────────
// GET /ads/active?type=banner|strip|floating
export async function getActiveAds(req, res, next) {
  try {
    const { type } = req.query
    const filter = { status: 'active' }
    if (type) filter.adType = type

    const ads = await Creative.find(filter)
      .populate('brandId', 'name color logoInitials code')
      .populate('campaignId', 'name startDate endDate')
      .select('-fileData')
      .sort({ createdAt: -1 })

    res.json(ads)
  } catch (e) { next(e) }
}

// GET /ads/active/:adId — un banner específico con fileData para render
export async function getAdById(req, res, next) {
  try {
    const ad = await Creative.findOne({ adId: req.params.adId, status: 'active' })
      .populate('brandId', 'name color logoInitials')
    if (!ad) return res.status(404).json({ error: 'Anuncio no encontrado' })
    res.json(ad)
  } catch (e) { next(e) }
}

// ── Tracking: el frontend llama estos endpoints al renderizar / al hacer click ─
// POST /ads/:adId/impression
export async function trackImpression(req, res, next) {
  try {
    const creative = await Creative.findOne({ adId: req.params.adId })
    if (!creative) return res.status(404).json({ error: 'Anuncio no encontrado' })

    creative.impressions += 1
    await creative.save()

    // Sincroniza el acumulado en la campaña también
    if (creative.campaignId) {
      await Campaign.findByIdAndUpdate(creative.campaignId, { $inc: { impressions: 1 } })
    }

    res.json({ ok: true })
  } catch (e) { next(e) }
}

// POST /ads/:adId/click
export async function trackClick(req, res, next) {
  try {
    const creative = await Creative.findOne({ adId: req.params.adId })
    if (!creative) return res.status(404).json({ error: 'Anuncio no encontrado' })

    creative.clicks += 1
    await creative.save()

    if (creative.campaignId) {
      await Campaign.findByIdAndUpdate(creative.campaignId, { $inc: { clicks: 1 } })
    }

    res.json({ ok: true, linkUrl: creative.linkUrl })
  } catch (e) { next(e) }
}
