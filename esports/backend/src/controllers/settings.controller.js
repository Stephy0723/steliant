import { Settings, AD_SLOTS } from '../models/Settings.js'

// GET /settings/ads — público, lo consulta cualquier página que pueda mostrar anuncios
export async function getAdsVisibility(req, res, next) {
  try {
    const settings = await Settings.getGlobal()
    res.json(settings.ads)
  } catch (e) { next(e) }
}

// PATCH /admin/settings/ads — solo admin, { slot, enabled }
export async function updateAdsVisibility(req, res, next) {
  try {
    const { slot, enabled } = req.body
    if (!AD_SLOTS.includes(slot)) {
      return res.status(400).json({ error: `Slot inválido. Debe ser uno de: ${AD_SLOTS.join(', ')}` })
    }
    const settings = await Settings.getGlobal()
    settings.ads[slot] = !!enabled
    await settings.save()
    res.json(settings.ads)
  } catch (e) { next(e) }
}
